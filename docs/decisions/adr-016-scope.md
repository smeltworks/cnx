# ADR-016: How to Handle Scope in cnx?

**Status:** Implemented
**Date:** 2025-12-29
**Decision Makers:** cnx Language Design Team
**Supersedes:** ADR-002 (Namespaces), ADR-005 (Classes Without Inheritance)
**Related:** ADR-014 (Structs), ADR-063 (Identifier Syntax — amends the qualified-name separator, see below)
**Amended by:** ADR-057 (Implicit Scope Resolution — withdraws this ADR's requirement that `this.` and `global.` be explicit), ADR-111 (Safe Hardware Abstraction Primitives — `Research`; on acceptance, replaces the `@ address` form used throughout `### Scoped Registers`)
**Amends:** ADR-002 (Namespaces — carries forward its file-independence rule, see _Scope Composition_)

> **Amended by ADR-063 (Issue #1117).** Members are named `Scope__member` in
> generated C. The separator is two underscores, and ADR-063 forbids a cnx
> identifier from ending with `_` or containing `__`, which makes the join
> injective: a global `Reg_flags` and a `scope Reg` member `flags` are now
> distinct C symbols, as are the members of `scope A_B { c }` and
> `scope A { B_c }`.

## Context

After reflection on the language design, the terms "namespace" and "class" carry significant C++ baggage and expectations that cnx explicitly wants to avoid. These terms imply:

- **namespace:** C++ module systems, `using namespace`, ADL (Argument Dependent Lookup), inline namespaces
- **class:** Object-oriented programming, class instances, constructors/destructors, inheritance hierarchies, methods bound to types, `this` pointers, virtual functions

cnx's philosophy is "safety through removal, not addition" and alignment with C's mental model. The C++ terminology conflicts with this goal.

### The Problem with "namespace"

While ADR-002's _behavior_ is correct (singleton services, private by default, name prefixing), the _terminology_ creates wrong expectations:

- Developers expect C++ namespace semantics
- Questions arise about nested namespaces, `using` directives, anonymous namespaces
- The concept carries OOP baggage cnx doesn't want

### The Problem with "class"

ADR-005 attempted to provide "classes without inheritance" but the term "class" inherently implies:

- Instances with bound methods (`obj.method()`)
- Constructors that create instances
- Data and behavior bundled together
- An OOP mental model

This conflicts with cnx's goal of embracing C patterns with safety improvements.

The argument above is stated rather than demonstrated. **[The comparison matrix in the
language guide](../language-guide.md#how-a-scope-compares-to-a-class-a-namespace-and-a-struct)**
turns it into row-by-row claims a reader can check — including the two rows where
"scope" behaves like neither term (`private` members, and no nesting), and the `this.`
rows, where a class and a scope share a spelling but not a meaning.

---

## Proposal: The `scope` Keyword

Introduce a `scope` keyword to replace `namespace`. The term "scope" has minimal baggage — it simply means "a bucket for organizing related code."

### Visibility Defaults

cnx uses **member-type-aware visibility defaults** to reduce boilerplate:

- **Functions**: Public by default (API surface), use `private` keyword to hide
- **Variables/types**: Private by default (internal state), use `public` keyword to expose

This design reflects typical usage patterns — functions are almost always public (they form the API), while variables are almost always private (they hold internal state).

```cnx
scope LED {
    u8 brightness;              // private by default (variable)
    public u8 maxBrightness;    // public (explicit)

    void on() { }               // public by default (function)
    void off() { }              // public by default (function)
    private void reset() { }    // private (explicit)
}

// Usage from outside:
LED.on();                       // OK - public by default
LED.off();                      // OK - public by default
LED.maxBrightness <- 100;       // OK - explicitly public variable
// LED.brightness <- 50;        // ERROR - private variable
// LED.reset();                 // ERROR - explicitly private function
```

Transpiles to:

```c
static uint8_t LED__brightness;        // private → static
uint8_t LED__maxBrightness;            // public → extern linkage

void LED__on(void) { }                 // public → extern linkage
void LED__off(void) { }                // public → extern linkage
static void LED__reset(void) { }       // private → static
```

### Key Properties

- **Member-type-aware defaults** — Functions public, variables/types private
- **Name prefixing** — Members become `Scope__member` in generated C (ADR-063)
- **Static linkage** — Private members use `static` for file-local visibility
- **Not a type** — Cannot create instances of a scope
- **File-independent** — A scope may be reopened; declarations compose (see below)
- **Minimal expectations** — No baggage from C++ namespaces or classes

### Scope Composition (Issue #1333)

**DECIDED: A scope may be reopened. Declaring the same scope again adds members
to it; it does not redefine it.** This holds within one file and across files.

```cnx
// lib.cnx
scope Lib {
    public struct Point { u32 x; u32 y; }
}

// app.cnx
#include "lib.cnx"

scope Lib {                       // reopens Lib, does not redefine it
    public u32 useIt() {
        Point p <- {x: 3, y: 4};  // bare name, resolves to Lib.Point (ADR-057)
    }
}
```

Scopes exist for organization. A scope that must live in exactly one contiguous
block forces one file per scope and grows without bound, which is the opposite of
what the construct is for.

**This rule is not new.** ADR-002 stated it:

> File organization is independent — Multiple namespaces can live in one file, or
> one namespace can span files

ADR-002 is `Rejected`, but by its own rationale it was rejected **for terminology,
not behavior** — "namespace" carried C++ baggage. This ADR superseded it and
carried the behavior while never restating this rule, so the requirement existed
nowhere that governed. It was consequently unimplemented: a second declaration of
a scope was rejected as a duplicate symbol definition, in the same file as well as
across files (#1333).

**What still conflicts.** Reopening composes the scope; it does not relax member
uniqueness. Two definitions of `Lib.useIt` collide whichever block they appear in,
because members are grouped by the scope's own identity rather than by the
declaration block.

**What this requires of resolution.** A bare type name inside a reopened block
resolves against the whole scope, not the block. Cross-file, this means every
type-forming kind must be visible across the include boundary on the same terms —
if enums are visible and structs are not, `Mode` and `Point` declared side by side
in one file resolve differently in another, and the second does not compile.

The same obligation holds over a second axis, and missing it is the more dangerous
half. cnx resolves a type name at **two points** (CLAUDE.md, _"Two resolution
points, one decision"_): the **symbols layer**, which produces the header, and the
**codegen layer**, which produces the body. Both must see the same scope types.
If they disagree, the prototype and the definition disagree — a bare `Point` in a
parameter reaches the `.h` as `Point` and the `.c` as `Lib__Point`, `cnx` exits 0,
and the C compiler rejects the pair.

The two axes multiply rather than add: a kind that is visible in one layer and not
the other fails only in the positions that route through the missing layer. A
function-body local is resolved by codegen alone and keeps working, which is exactly
why this can look fixed while parameters, return types and struct fields are broken.
Coverage therefore has to name positions, not just kinds.

### Scope Variable Persistence (Issue #233)

Scope variables behave like C `static` variables — they are initialized once at program start and persist across all function calls.

```cnx
scope Counter {
    u32 value <- 0;           // Initialized once at program start

    public void increment() {
        this.value <- this.value + 1;
    }

    public u32 getValue() {
        return this.value;
    }
}

// Behavior:
Counter.increment();  // value: 0 -> 1
Counter.increment();  // value: 1 -> 2
Counter.increment();  // value: 2 -> 3
Counter.getValue();   // returns 3
```

**Generated C code:**

```c
static uint32_t Counter__value = 0;  // Static = persists

void Counter__increment(void) {
    Counter__value = Counter__value + 1;
}

uint32_t Counter__getValue(void) {
    return Counter__value;
}
```

**Variable lifetime summary:**

| Variable Type            | Lifetime         | Notes                                      |
| ------------------------ | ---------------- | ------------------------------------------ |
| Scope variables          | Program lifetime | Like C `static` — persist across all calls |
| Function-local variables | Function call    | Reset each call (standard C behavior)      |
| Global variables         | Program lifetime | Persist across all function calls          |

### Thread Safety and Reentrancy (Issue #313)

Scope variables use static storage, which means functions accessing them are **not reentrant** by design. This is intentional and safe in cnx because:

1. **Compiler enforcement**: If a scope variable is accessed from multiple execution contexts (threads, RTOS tasks, interrupts), the compiler requires it to be marked `atomic`. This prevents accidental unsafe sharing.

2. **Semantic clarity**: Scope variables are meant for persistent state (counters, accumulators, state machines). If you need a reentrant utility function, use function-local variables instead.

**Example - Reentrant vs Non-Reentrant Design:**

```cnx
// NON-REENTRANT: Scope variable persists (correct for state)
scope Counter {
    u32 value <- 0;

    public void increment() {
        this.value <- this.value + 1;  // Persists across calls
    }
}

// REENTRANT: Local variable resets each call (correct for utilities)
scope CRC {
    public u32 calculate(u8[] data) {
        u32 acc <- 0xFFFFFFFF;  // Local - each call gets fresh state
        // ... calculate CRC ...
        return acc;
    }
}
```

**Why not optimize single-function variables to local?** (Issue #232, fixed in #313)

A previous optimization attempted to convert scope variables used by only one function into function-local variables. This was **incorrect** because it changed observable behavior — a counter would reset on each call instead of persisting. The optimization was removed because:

- It violated the semantic contract of scope variables (static-like persistence)
- cnx's `atomic` enforcement already prevents unsafe multi-context access
- Users who need reentrant functions should explicitly use local variables

### Scoped Registers

> **Amended by ADR-111 (on acceptance).** The `register GPIO7 @ 0x42004000 { … }` form
> below is ADR-004's, and ADR-111 removes it: a register definition will carry plain
> byte offsets with the base address supplied at instantiation, so one definition can
> produce several instances (`Serial1`, `Serial2`, `Serial3`). ADR-111 is `Research`,
> so the form shown here is still the correct one to write today.

Scopes can contain register declarations for platform-specific hardware:

```cnx
scope Teensy4 {
    register GPIO7 @ 0x42004000 {
        DR:         u32 rw @ 0x00,
        DR_SET:     u32 wo @ 0x84,
        DR_CLEAR:   u32 wo @ 0x88,
        DR_TOGGLE:  u32 wo @ 0x8C,
    }

    const u32 LED_BIT <- 3;

    public void blinkLed() {
        this.GPIO7.DR_TOGGLE[this.LED_BIT] <- true;
    }
}

// Usage from outside:
Teensy4.blinkLed();
Teensy4.GPIO7.DR_SET[3] <- true;
```

Transpiles to:

```c
/* Register: Teensy4__GPIO7 @ 0x42004000 */
#define Teensy4__GPIO7__DR (*(volatile uint32_t*)(0x42004000 + 0x00))
#define Teensy4__GPIO7__DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))
#define Teensy4__GPIO7__DR_CLEAR (*(volatile uint32_t*)(0x42004000 + 0x88))
#define Teensy4__GPIO7__DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

void Teensy4__blinkLed(void) {
    Teensy4__GPIO7__DR_TOGGLE = ((uint32_t)1U << 3U);
}
```

This pattern is useful for:

- **Platform namespacing** — Avoid conflicts with HAL headers (e.g., Teensy's imxrt.h defines GPIO7_DR)
- **Organization** — Group platform-specific registers, constants, and functions together
- **Multiple platforms** — Support different hardware configurations in the same codebase

---

## Instance Model: C-Style with ADR-014 Structs

Instead of "classes," cnx embraces the C approach for instances:

1. **Define data with structs** (ADR-014)
2. **Define behavior with free functions** that take the struct as a parameter (passed by reference, ADR-006)

### Example: UART Implementation

```cnx
// Data definition (ADR-014 struct)
struct UART {
    u32 baseAddress;
    u32 baudRate;
    bool initialized;
}

// Free functions that operate on UART
void UART_init(mut UART self, u32 base, u32 baud) {
    self.baseAddress <- base;
    self.baudRate <- baud;
    self.initialized <- true;
}

void UART_send(UART self, u8[] data, u32 len) {
    // Implementation...
}

u32 UART_receive(UART self, mut u8[] buffer, u32 maxLen) {
    // Implementation...
}

// Usage
UART uart1;
UART uart2;

void init() {
    UART_init(uart1, UART1_BASE, 115200);
    UART_init(uart2, UART2_BASE, 9600);
}

void main_loop() {
    UART_send(uart1, data, len);
}
```

### Why C-Style?

| Aspect         | C-Style (Proposed)                   | Class-Style (Rejected)               |
| -------------- | ------------------------------------ | ------------------------------------ |
| Mental model   | Familiar to C developers             | Requires OOP understanding           |
| Data ownership | Explicit — you see the pointer       | Hidden behind `this`                 |
| Generated code | Obvious, 1:1 mapping                 | Requires understanding transpilation |
| Flexibility    | Can use any function with any struct | Methods bound to types               |
| KISS principle | Simple, no magic                     | Implicit `self`, constructors        |

---

## Research Questions

The following questions remain open and require further exploration:

### DECIDED: Name Resolution with `this.` and `global.`

cnx requires **explicit qualification** for all non-local references inside a scope. This eliminates ambiguity entirely and aligns with cnx's safety-first philosophy.

#### The Rule

Inside a scope, you MUST use:

- **`this.X`** — for ANY scope member (variables, functions, types, enums)
- **`global.X`** — for ANY global (variables, functions, registers, types)
- **Bare `X`** — ONLY for function-local variables and parameters

**`global.` needs a scope or a function around it (#2087).** `global.X` reaches a
file-scope name past a scope member, local or parameter that shadows it, so a
function is a scope for it, its signature (return and parameter types) as well
as its body: in a top-level function `global.total` writes the file-scope
`total` even when a parameter is named `total` (ADR-057). At file level, in a
file-scope variable's initializer or type, an array dimension, a struct
field's type, an enum member's value, or a register's address, member offsets
and member types, nothing can shadow a file-scope name (an enum body shadows
nothing either: `B <- A` there reads the file-scope `A`), so the bare name is written
and `global.` there is E0431. `this.` still needs a `scope`: it names that
scope's member, in the scope's own declarations and in its methods.

**A qualifier is legal only where there is something for it to reach past.**
`this.` reaches past a local or parameter to the scope's member, and `global.`
reaches past a scope member, local or parameter to the file. Where nothing can
shadow, the bare name already names the declaration, so the qualifier is E0431:
`this.` in a top-level function (it would only name the function's own
parameter or local), and `global.` at file level.

The example below is deliberately bad code: every name is `count`. It is here
only to show what each qualifier reaches past. Real code gives the three
declarations different names and needs neither qualifier.

```cnx
u32 count <- 7;                  // the file's count

scope Counter {
    u32 count <- 100;            // Counter's count

    public u32 bump(u32 count) { // Counter.bump(3): parameter count = 3
        this.count <- count;     // legal: Counter's count = 3, past the parameter
        global.count <- count;   // legal: the file's count = 3, past the parameter
        return count;            // returns 3, the parameter
    }
}

u32 f(u32 count) {               // f(5): parameter count = 5
    global.count <- count;       // legal: the file's count = 5, past the parameter
    this.count <- count;         // E0431: no scope member for `this.` to reach
    return count;
}

u32 x <- global.count;           // E0431: nothing at file level shadows count
```

#### Example

```cnx
u8 defaultValue <- 3; // Global

register GPIO7 @ 0x42004000 {
    DR_SET: u32 wo @ 0x84,
}

scope Motor {
    public enum State {
        IDLE,
        RUNNING,
        STALLED
    }

    u8 defaultValue <- 1; // Scope member (shadows global)

    mut this.State current <- this.State.IDLE;

    u8 start() {
        u8 localVar <- 5; // Local - bare identifier OK

        this.current <- this.State.RUNNING;

        return localVar + // Local - bare
            this.defaultValue + // Scope member - MUST use this.
            global.defaultValue; // Global - MUST use global.
    }

    void setPin() {
        global.GPIO7.DR_SET[3] <- true; // Global register - MUST use global.
    }
}
```

#### Transpiles to:

```c
const uint8_t defaultValue = 3U;

#define GPIO7__DR_SET (*(volatile uint32_t*)(0x42004000 + 0x84))

typedef enum {
    Motor__State__IDLE = 0,
    Motor__State__RUNNING = 1,
    Motor__State__STALLED = 2
} Motor__State;

static Motor__State Motor__current = Motor__State__IDLE;

uint8_t Motor__start(void) {
    uint8_t localVar = 5U;
    Motor__current = Motor__State__RUNNING;
    return cnx_clamp_add_u8(cnx_clamp_add_u8(localVar, 1U), defaultValue);
}

void Motor__setPin(void) {
    GPIO7__DR_SET = ((uint32_t)1U << 3);
}
```

#### `this.` for Types

The `this.` prefix also works in type position for scoped types:

```cnx
scope Motor {
    public enum State {
        IDLE,
        RUNNING
    }

    void example() {
        this.State currentState <- this.State.IDLE; // Type is Motor__State
    }
}
```

#### Bare identifiers — withdrawn, see ADR-057

> **Superseded by [ADR-057](adr-057-implicit-scope-resolution.md) (Implemented).**
> This ADR originally required `this.` and `global.` and rejected bare identifiers
> inside a scope. That requirement was withdrawn: bare names resolve
> **local → scope → global**, and `this.` / `global.` remain available to force a
> level. The paragraphs below are kept because the trade-off they weigh is still
> the right one to have weighed — they are **not** a description of the language.

What ADR-016 rejected, and ADR-057 now accepts:

```cnx
scope Motor {
    u8 value <- 1;

    void ok() {
        value; // resolves to Motor.value  (was: ERROR)
    }
}
```

`tests/scope-resolution/bare-scope-member.expected.c` is the committed proof —
bare `value` compiles to `Counter__value`.

What ADR-057 kept from this decision: explicitness still wins where the two
levels genuinely collide, and where C itself cannot express the result the
shadowing local is emitted under a qualified C name so the outer one stays
reachable.

#### Why the original design chose explicitness

| Aspect      | `this.`/`global.` Required     | Implicit Resolution           |
| ----------- | ------------------------------ | ----------------------------- |
| Ambiguity   | **Zero** — always explicit     | Shadowing causes confusion    |
| Safety      | **Maximum** — no accidents     | Easy to reference wrong thing |
| Readability | **Self-documenting**           | Must trace scope manually     |
| Refactoring | **Safe** — rename scope once   | Must update all references    |
| Compiler    | **Simple** — just parse prefix | Complex resolution rules      |

ADR-057 accepted the right-hand column's costs in exchange for a syntax C
developers already know, and mitigated the first two rows by keeping `this.` and
`global.` available and by rejecting the one case C cannot express.

---

### 1. What exactly should `scope` provide?

Options to research:

- **Organization only** — Pure name prefixing, visibility handled separately
- **Organization + visibility** — Current namespace behavior (private by default)
- **Organization + visibility + state** — Can scopes have private state?

### 2. Should scopes nest?

**DECIDED: No nested scopes. This is permanent, not a simplification to revisit.**

**Scopes are a flat namespace.** That is the decision, and the identifier budget is
why unbounded depth was never a candidate for it — not, on its own, an argument that
depth 2 in particular must be refused.

C99 section 5.2.4.1 guarantees only 31 significant initial characters in an external
identifier, and MISRA C:2012 Rule 5.1 is evaluated inside that budget. With
six-character scope names, a depth-3 member generates a 30-character name and stays
distinct; a depth-4 member generates 38 and does not. Unbounded nesting therefore
cannot be admitted without either abandoning the guarantee or silently truncating
names a conforming toolchain is free to conflate.

What the budget proves is that depth must be **bounded**; it does not locate the
bound. `Hw__Gpio__init` is 14 characters and fits comfortably, while a flat
`HardwareAbstractionLayer__initialize` exceeds 31 with no nesting at all — so the
budget neither forbids depth 2 nor rescues a flat name. Flatness is chosen because
one level is a namespace and more than one is a hierarchy: a hierarchy needs
resolution rules, shadowing rules, and a visibility model per level, and every one of
those is a place a reader can be wrong about where a name comes from. cnx declines
to have them. A proposal for depth-2 nesting is not answered by arithmetic and is not
reopened by it either (#1306 review).

```cnx
// NOT supported:
scope Hardware {
    scope GPIO { ... }  // ERROR: nested scopes not allowed
}

// Instead, use flat scopes with naming conventions:
scope Hardware_GPIO { ... }
scope Hardware_UART { ... }
```

### 3. Syntax for "methods" on structs?

If we want `uart1.send(data, len)` sugar (common request), how do we provide it without implying OOP?

Options:

- **No sugar** — Always `UART_send(&uart1, data, len)` (pure C-style)
- **UFCS** — Uniform Function Call Syntax: `uart1.send(data, len)` desugars to `UART_send(&uart1, data, len)`
- **Scope-based association** — Associate functions with structs via scopes

### 4. How does visibility work with scopes?

Current approach (from namespaces):

- `public` keyword makes member externally accessible
- No keyword means private (internal to scope)

Is this sufficient? Should structs also have visibility control?

### 5. Generic/parameterized scopes?

The rejected ADR-005 supported `class RingBuffer<T, N>`. Do we need this for scopes or structs?

```cnx
// Parameterized struct?
struct RingBuffer<T, N> {
    T buffer[N];
    u32 head;
    u32 tail;
}
```

---

## What This ADR Decides

- **Name resolution:** ~~`this.` and `global.` are REQUIRED inside scopes (no implicit resolution)~~ — **withdrawn by [ADR-057](adr-057-implicit-scope-resolution.md)**, which resolves bare names local → scope → global. `this.` and `global.` remain available to force a level.
- **Nested scopes:** Not supported, permanently — the generated name would exceed C99's 31-character significance guarantee at depth 4
- **`this.` in type position:** Supported for scoped types (e.g., `this.State`)

## What This ADR Does NOT Decide

The following questions remain open:

- Whether UFCS or method syntax will be added
- How generic types will work
- The complete visibility model

These questions will be answered through:

- Practical usage in examples
- Community feedback
- Analysis of embedded use cases
- Evaluation against the KISS principle

---

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must
be. Undeclared cells are `off`.

This ADR has never declared a matrix, which per [`README.md`](README.md) is
indistinguishable from claiming the feature cannot occur anywhere. That silence is
why #1333 survived: no obligation existed for "a scope member, in an imported
file", so nothing could report that the cell was empty.

**All six cells are occupied and are declared `error`.** They were `warn` while a
cell's context could only come from a diagnostic's position, and ADR-016's
conflict diagnostic reported `1:0` rather than the offending declaration, so
nothing could be derived from it and the ratchet had no path forward. #1241
(2026-08-29) removed that constraint — occupancy now also derives from where the
rule fired, recorded at the decision itself, which reaches every cell here at once.

**#1334 is fixed (`de137c9f`, 2026-08-29) and is no longer the blocker this ADR
recorded it as.** The conflict diagnostic now reports a real position — but that
position belongs to the file holding the FIRST definition
(`conflict-lib-a.cnx:3:0`), while the matrix resolves a diagnostic line against
the FIXTURE's parse tree, where line 3 is a comment. So
`conflict-across-files.test.cnx` still links to this ADR and lands in "no
derivable context". That costs a fixture its cell, not the matrix its
obligation.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |

off: this table now holds only the composition rule, which is decided once per scope member, so a declaration outside a scope cannot occupy it; the access rules' file-level cells live in their code tables below.

<!-- MATRIX-SEVERITY code: E0425 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: E0425 is reported at the later of two declarations sharing one scope, and a `for` header declares one variable in a scope of its own that opens before its body, so nothing in the header can be the second; a parameter or a body local of the same name is shadowing, as in C, and any report of it would sit at that later declaration, not in the header (#2307: in the C++ output the body local is a redeclaration).

<!-- MATRIX-SEVERITY code: E0430 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: E0430 fires at a `scope` nested in a scope's body, which is no member and no method, and a `scope` inside a function or at file level is a parse error or legal, not E0430; a `for` header's declaration holds one variable, so a `scope` there is a parse error too.

<!-- MATRIX-SEVERITY code: E0431 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

off: inside a scope `this.` and `global.` both have something to reach past, so E0431 fires only in a top-level function or at file level.

<!-- MATRIX-SEVERITY code: E0435 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

off: outside a scope a scope's name is the required spelling, so E0435 fires only in that scope's own members and methods.

<!-- MATRIX-SEVERITY code: E0436 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0437 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

off: E0437 needs a scope member or local inside a scope to shadow the global; at file level nothing can, and a top-level function's local is not inside a scope.

This ADR now owns two families of rules, and they reach different contexts.

The **composition** rule -- a scope's members are declared once, inside it --
is a property of a scope, so a declaration that is not inside one cannot occupy
a cell of it. Those cells used to be left undeclared on that reasoning.

The **access** rules moved here by #1322 -- E0435 (a scope's own member reached
through the scope's name), E0436 (a private member reached from outside), E0437
(a shadowed global enum or register reached bare) -- are properties of a
REFERENCE, and a reference to a scope's member can stand anywhere: `Counter.x`
in `main` is the canonical private-access violation, and a file-scope
initializer can carry one too. So `top-level function` and `global variable`
are `error` for the same-file column now, and `top-level function` in the
imported columns as well, because the private member being reached may be
declared in an included file -- two fixtures assert exactly that. The
`global variable` imported cells are `off` as a stated obligation, not a claim
they cannot exist.

## Diagnostics

| Code  | Reported when                                                                                                                                                                               | Asserted by                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0425 | Two definitions of the same member name in one scope, or a cnx symbol colliding with a C/C++ one                                                                                            | `tests/bugs/issue-1333-scope-reopening/duplicate-member-reopened`, `tests/bugs/issue-1334-scope-declaration-sites/conflict-across-files`, `.../cross-language-conflict`, `tests/adr-016/duplicate-definition-same-file-error`, `tests/adr-016/duplicate-definition-imported-direct-error`, `tests/adr-016/duplicate-definition-imported-transitive-error`                           |
| E0430 | A scope is declared inside another scope, in the entry file or in an included one                                                                                                           | `tests/scope/nested-scope-error`, `tests/bugs/issue-1306-nested-scope-diagnostic/cross-file-nested`                                                                                                                                                                                                                                                                                 |
| E0431 | `this` used outside a scope, as a value or as a case label (#2075), or `global` used at file level, outside a scope and outside a function (#2087), in the entry file or in an included one | `tests/adr-016/this-outside-scope-error`, `tests/adr-016/this-outside-scope-imported-error`, `tests/adr-016/global-outside-scope-error`, `tests/adr-016/global-outside-scope-imported-error`, `tests/adr-016/qualifier-outside-scope-imported-direct-error`, `tests/adr-016/qualifier-outside-scope-imported-transitive-error`                                                      |
| E0435 | A scope's own member reached through the scope's name                                                                                                                                       | `tests/adr-016/self-scope-bare-error`, `tests/adr-016/mixed-access-ultimate-error`, `tests/adr-016/scope-access-uncovered-arms-error`, `tests/adr-016/access-rules-scope-member-error`, `tests/adr-016/access-rules-imported-direct-error`, `tests/adr-016/access-rules-imported-transitive-error`                                                                                  |
| E0436 | A private member reached from outside its scope, in the same file or across an include                                                                                                      | `tests/adr-016/private-var-access-error`, `tests/adr-016/private-imported-direct-error`, `tests/adr-016/private-imported-transitive-error`, `tests/bugs/issue-1190-cross-file-private-member/cross-file-private-const`, `tests/adr-016/access-rules-scope-member-error`, `tests/adr-016/access-rules-imported-direct-error`, `tests/adr-016/access-rules-imported-transitive-error` |
| E0437 | A global enum or register shadowed inside a scope and reached bare                                                                                                                          | `tests/adr-016/cross-scope-register-bare-error`, `tests/adr-016/scope-enum-naming-conflict`, `tests/adr-016/access-rules-scope-member-error`, `tests/adr-016/access-rules-imported-direct-error`, `tests/adr-016/access-rules-imported-transitive-error`                                                                                                                            |

A scope **composes**: reopening it in another file adds members rather than
redefining it (see Scope Composition above). Member names stay unique across every
block, so the check groups by scope identity, not by declaration block — two blocks in
different files that both define `Lib.useIt` are a conflict, and the diagnostic names
each definition's own file and line plus every block the scope is declared in.

Every block that declares a scope is remembered, not just the first. Before #1334
only one position was kept, so a conflict spanning two files printed the same
location twice — the diagnostic named a file the reader had already looked at
instead of the other definition.

E0430 names the position of the inner `scope` keyword. Its advice reaches the reader
on the `help:` line, the shape every other coded diagnostic uses, and it is hedged on
purpose: the reader cannot distinguish a deliberate nesting from a **missing closing
brace** before the next `scope`, because the two produce an identical token stream. A
forgotten `}` is at least as common as deliberate nesting, so the advice names closing
the enclosing scope first and flattening second.

Recovery noise that follows the rejection is suppressed, and only that noise. Error
recovery moves the rejected block out and complains twice — once inside the construct
already reported, once about the closing brace the move left behind at file scope —
and those two describe a structure already known to be wrong. **Everything else still
reports**, including an unrelated syntax error in a different top-level declaration
later in the same file. A blanket suppression swallowed those, so the author fixed the
scope, re-ran, and met a second error that had been sitting there the whole time
(#1306 review). A second genuine nested scope is reported in its own right.

The rejection is stated once here and enforced where a nested scope first becomes
visible, which is while the source is being read — a scope member is not admitted as a
scope declaration in the first place, so the construct never reaches a later stage to
be analyzed.

## Implementation Status

The `scope` keyword replaces `namespace` in the current implementation:

- Grammar updated: `namespace` → `scope`
- Code generator updated
- All examples and tests converted

**Pending implementation:**

- `this.` keyword for scope-local references
- `global.` keyword for global references
- Compile-time enforcement of explicit qualification
- `this.Type` in type position for scoped types

The class implementation has been removed pending further research.

### Private scope consts (#1739)

A private scope const has one value: the one the const pipeline settles from
its initializer, read in the scope's binding context (`N` is the scope's `N`,
and `this.N` is too). The same settled value sizes an array and stands where
the const is named, so `const u32 M <- N * 2;` is 20 at both places.

A use can stand in a static initializer (`bool flag <- EN;` at scope level),
where C11 6.7.9p4 takes only a constant expression and a `const` object is not
one. So a private const is written, wherever it is named, as a literal of its
declared type that holds its settled value:

- an integer as a literal of its type: an initializer that is one literal
  keeps its notation (`0xAB` is `0xABU`), anything else is its digits, a `u64`
  is `ULL`, and a negative value is parenthesized (`-X` is `-(-5)`);
- a float as its value held at its type, so an `f32` is a `float` literal
  (`0.1f`) and a copy of the const equals it;
- a bool as `true` or `false`, and an enum as its member (`EMode__RUN`);
- a char literal as that literal (`(uint8_t)'A'`), and a header macro named
  alone as that name (`(LIMIT)`), which C evaluates.

A private const with no such value -- a string, or one whose initializer is
not constant -- is emitted as a `static const` object and named where it is
used: `string<8> NAME <- "abc";` in `scope S` is
`static const char S__NAME[9] = "abc";`.

A bool or enum const has a value as its literal or member does, so it also
sizes an array the way the literal or member does: `const EMode MODE <-
EMode.STOP; u8[MODE] buf;` is `uint8_t buf[2]`. Owner ruling, 2026-10-12
(#2014): _"Yes, the same way its literal or enum member does"_. Whether a bool
may size an array at all is #2025.

The initializer's source text is never a value. Whether a const is inlined is
one decision, asked both where the declaration is planned and wherever the
const is named -- an expression, `this.`, or a `case` label.

---

## References

### Rejected ADRs

- **ADR-002:** Namespaces Over Static Classes (Rejected — terminology issue)
- **ADR-005:** Classes Without Inheritance (Rejected — OOP baggage)

### Active ADRs

- **ADR-014:** Structs (Defines data containers)
- **ADR-015:** Null State (Zero initialization)
- **ADR-003:** Static Allocation (No dynamic memory after init)

### Design Principles

- [KISS Principle](https://en.wikipedia.org/wiki/KISS_principle)
- [cnx Philosophy: Safety through removal, not addition](../README.md)
