# ADR-029: Callbacks (Function-as-Type Pattern)

## Status

**Implemented**

## Context

Callbacks are essential in embedded C for event handling, driver interfaces, and library extensibility. However, C's function pointer syntax is confusing and error-prone:

```c
void (*callback)(int, int);           // What does this even mean?
int (*compare)(const void*, const void*);  // Worse with void pointers
```

Common bugs include null dereference, signature mismatches, and uninitialized pointers.

**Note:** For ISR vector tables and interrupt handlers, see ADR-040 (ISR Declaration).

## Decision Drivers

1. **Null Safety** - Calling a null function pointer crashes
2. **Type Safety** - Signature mismatches cause undefined behavior
3. **Clarity** - C syntax is notoriously confusing
4. **Simplicity** - Keep it stupid simple (KISS)

## Recommended Decision

**Function-as-Type Pattern** with nominal typing.

A function definition serves as both the **type definition** and the **default value**. Type identity is the function name, not just the signature. Callbacks are never null - they always have a valid default.

## Design Principles

### 1. Function-as-Type

A function definition creates both a callable function AND a type:

```cnx
void onReceive(CAN_Message_T msg) {
    // default: no-op
}
```

This single declaration:

- Defines a callable function `onReceive`
- Creates a type `onReceive` for callback fields/parameters
- Provides the default value (the function itself)

### 2. Nominal Typing

Type identity is the **function name**, not the signature. Two callbacks with identical signatures are distinct types:

```cnx
void onMouseDown(const Point p) { }
void onMouseUp(const Point p) { }

// These are DIFFERENT types, even with matching signatures
handler.down <- onMouseUp;  // COMPILE ERROR - type mismatch
```

This prevents accidentally swapping handlers that happen to have the same signature.

### 3. Never Null

Callback fields are always initialized to their default function. There is no null state:

```cnx
struct Controller {
    onReceive _handler;  // Initialized to onReceive (the default)
}

// Always safe to call - worst case is no-op
controller._handler(msg);
```

### 4. Explicit "Is Set" Tracking

If you need to know whether a callback was explicitly set (vs using the default), use a boolean flag - this is user code, not compiler magic:

```cnx
void onReceive(CAN_Message_T msg) { /* NO-OP */ }

struct Controller {
    onReceive _handler;
    bool _handlerIsSet;
}

void Controller_setHandler(Controller self, onReceive handler) {
    self._handler <- handler;
    self._handlerIsSet <- true;
}

void Controller_process(Controller self, CAN_Message_T msg) {
    if (self._handlerIsSet) {
        self._handler(msg);
    }
}
```

## Syntax Examples

### Define Callback Type with Default

```cnx
// The function IS the type AND the default value
void defaultCallback(CAN_Message_T msg) {
    // no-op - this is what happens if no callback set
}

void onError(CAN_Message_T msg) {
    // default: log and continue
    log("Unhandled CAN error");
}
```

### Use in Struct

```cnx
struct CANController {
    defaultCallback _receiveHandler;  // Type is defaultCallback
    onError _errorHandler;            // Type is onError
    bool _receiveHandlerSet;
}
```

### Use as Parameter

```cnx
void setReceiveHandler(defaultCallback handler) {
    _receiveHandler <- handler;
    _receiveHandlerSet <- true;
}
```

### User Implementation

```cnx
// User's handler - must match defaultCallback signature exactly
void myReceiver(const CAN_Message_T msg) {
    Serial.print("Received: ");
    Serial.println(msg.id);
}

// OK - signature matches defaultCallback
controller.setReceiveHandler(myReceiver);

// COMPILE ERROR - wrong type (onError vs defaultCallback)
controller.setReceiveHandler(myErrorHandler);
```

## Recommended Patterns

### State Machines: Use Enum + Switch

State machines should use enums, not callback swapping. This is simpler, safer, and preferred by MISRA:

```cnx
enum RobotMood {
    Sleepy,
    Happy,
    Grumpy
}

struct Robot {
    RobotMood currentMood;
}

void Robot_poke(Robot self) {
    switch (self.currentMood) {
        case RobotMood.Sleepy {
            yawn();
        }
        case RobotMood.Happy {
            giggle();
        }
        case RobotMood.Grumpy {
            growl();
        }
    }
}

void Robot_wake(Robot self) {
    self.currentMood <- RobotMood.Happy;
}
```

**Why enum + switch is better:**

- No function pointers = no null dereference risk
- Exhaustive switch = compiler catches missing states
- Direct calls = easier static analysis and debugging
- Simpler mental model

### Plugins: Still Type-Safe

Even plugin systems maintain type safety. Plugins provide typed handler overrides:

```cnx
void yawn() { /* default */ }
void giggle() { /* default */ }
void growl() { /* default */ }

struct Robot {
    yawn _yawnHandler;
    giggle _giggleHandler;
    growl _growlHandler;
}

struct MoodOverride {
    RobotMood mood;
    yawn sleepyHandler;      // Must match yawn's signature
    giggle happyHandler;     // Must match giggle's signature
    growl grumpyHandler;     // Must match growl's signature
}

void Robot_loadPlugin(Robot self, MoodOverride override) {
    switch (override.mood) {
        case RobotMood.Sleepy {
            self._yawnHandler <- override.sleepyHandler;
        }
        case RobotMood.Happy {
            self._giggleHandler <- override.happyHandler;
        }
        case RobotMood.Grumpy {
            self._growlHandler <- override.grumpyHandler;
        }
    }
}
```

### Multiple Handlers: Use Named Fields

Arrays of same-type callbacks are rarely needed in embedded. Use explicit named fields instead:

```cnx
// Instead of: callback[3] handlers;
// Use:
struct EventSystem {
    onEvent preHandler;
    onEvent mainHandler;
    onEvent postHandler;
}

void EventSystem_fire(EventSystem self, Event e) {
    self.preHandler(e);
    self.mainHandler(e);
    self.postHandler(e);
}
```

**Why named fields are better:**

- Self-documenting (what does handlers[2] mean?)
- Fixed at compile time (embedded rarely needs dynamic arrays)
- Each can have different defaults if needed
- Easier to reason about and debug

## Implementation Notes

### Transpilation to C

```cnx
// Cnx source:
void defaultHandler(CAN_Message_T msg) {}

struct Controller {
    defaultHandler _handler;
}
```

```c
// Generated C:
void defaultHandler(const CAN_Message_T msg) { }

typedef void (*defaultHandler_fp)(const CAN_Message_T);

struct Controller {
    defaultHandler_fp _handler;
};

// Initialization always sets to default
Controller Controller_init(void) {
    Controller value = { ._handler = defaultHandler };
    return value;
}

// Every declaration without an initializer holds the same default (#1283),
// at file scope, in a scope, as a local, and in every array element:
Controller ctrl = { ._handler = defaultHandler };
Controller controllers[2] = { { ._handler = defaultHandler }, { ._handler = defaultHandler } };
```

The default is a constant brace rather than a call to `Controller_init()`
because C forbids a function call in a file-scope or `static` initializer.
C++14 has no designated initializers, so there every field is listed in
declaration order and a zero field is `{}`: `Controller ctrl = { defaultHandler };`.
The default is recursive (#1570): a field whose type is a struct with
callbacks holds that struct's default, and a callback array field holds the
default in every element (#1565). Spelling every element needs the count, so
a dimension written as a macro from an included C header is read for its
value (cnx reads a macro whose C replacement is plain integer arithmetic,
evaluated from the preprocessor's own macro dump) while the declaration keeps
the macro as its size. A dimension whose value cnx cannot read (a `sizeof`,
a cast, a macro it cannot see) is E0359 on an array whose elements have a
default; every other array is still sized by C as written. A struct gets `<Struct>_init()` when its
default is not all zero; a scope-nested struct is initialized the same way at
its declarations.

### Type Checking

The compiler:

1. Sees a function definition -> creates matching typedef with `_fp` suffix
2. Tracks which functions match which callback types
3. Only allows assignment of functions explicitly marked as compatible
4. Initializes all callback fields to the default function

### No Conversions (MISRA 11.1)

Following MISRA C Rule 11.1:

- No casting function pointers to/from `void*`
- No casting between incompatible function pointer types
- No pointer arithmetic on function pointers

---

## Diagnostics

| Code  | Reported when                                                                                   | Asserted by                                                                                                                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0879 | A function's declared signature differs from the callback type of the slot it is placed in      | `tests/adr-029/callback-signature-error.test.cnx`, `tests/adr-029/callback-signature-*-error.test.cnx`, `tests/adr-029/callback-imported-*-error.test.cnx`, `tests/adr-029/callback-scope-type-imported-error.test.cnx`, `tests/adr-029/callback-c-header-*-error.test.cnx` |
| E0880 | A function that is itself used as a struct field's type is placed in a slot of a different type | `tests/adr-029/callback-error-nominal.test.cnx`, `tests/adr-029/callback-uncovered-arms-error.test.cnx`                                                                                                                                                                     |

A function name reaches a callback-typed slot in exactly four ways, and all
four are decided on the same terms: an assignment target, a declaration's
initializer, a struct initializer's field, and a call argument -- the last
being the case the "User Implementation" example above marks `COMPILE ERROR`.
Each is reported at the value's own position, and every offense in a file is
reported rather than only the first.

A function a C header declares is held to the same rule (#1619). Its C
signature is compared with the callback type's `_fp` typedef, type by type, by
C type identity under the compiler that read the run's headers: two C types
match when that compiler would take them as the same type, not when they merely
have one width. The compiler's own predefined macros (`__UINT32_TYPE__` and its
siblings) say which C type each `uN`/`iN` is. So `unsigned long millis(void)`
fills a `u32 tickSource()` slot on stm32f4 and AVR, where `uint32_t` is
`unsigned long`, and is E0879 on a 64-bit host, where it is `unsigned int`;
`unsigned int clock32(void)` is the other way round. A variadic C function
matches no callback type. A pointer typedef counts its own `*`s
(`typedef Sample *SampleRef` is `Sample*`), and every dimension of an array
parameter after the first is part of its type (`uint8_t g[4][8]` does not fill a
`u8[4][4]` slot). A `const` or `volatile` pointee is part of the type, whether
the parameter or a typedef spells it. Where a C type in the signature cannot be
determined from the headers the program includes, that part is not reported;
the C compiler remains the check. Asserted by
`tests/adr-029/callback-c-header-*.test.cnx`.

The signature compared is the one the author **declared**. A parameter may also
acquire `const` because no body modifies it, but that is a property of an
implementation rather than of the type, and a contract shared by several
implementations cannot promise it.

Nominal identity is a property of the **program**, not of a file: a function is
a callback type because some struct declares a field of it, and that stays true
in a file that imports the struct. The alternative would make the same
assignment legal or illegal depending on the include graph.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |

This table holds what no diagnostic code carries: writing a parameter that
names a function-as-type as that type's function-pointer typedef. The
callback type can be declared in an included file, so both function contexts
are `error` at one hop and at two.

off: global variable and scope member -- a parameter only exists in a function
or scope method signature.

<!-- MATRIX-SEVERITY code: E0879 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| for header         | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| for header         | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | imported transitive     | error    |
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | warn     |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | warn     |

<!-- MATRIX-SEVERITY code: E0880 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| for header         | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| for header         | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | imported transitive     | error    |
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | warn     |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | warn     |

An assignment and a call are statements, so both rules occupy the two function
contexts; a declaration's initializer is where a callback-typed global or scope
member gets its value, which occupies the other two. Both the declared
signature and the fact that makes a function a type can be declared in an
included file, so every imported cell is `error` and is asserted at one hop and
at two. A `for` header's loop variable is a declaration too, so its
initializer, and any call argument inside it, is a callback slot: the
`for header` row is `error` in every column.

## Research: MISRA C Guidelines

### Rule 11.1 - Function Pointer Conversions

"Conversions shall not be performed between a pointer to a function and any other type"

- Converting function pointers to `void*`, integers, or other pointer types is **prohibited**
- Converting between incompatible function pointer types causes undefined behavior
- Only exception: casting from `NULL`
- Rationale: Calling a function through an incompatible pointer type is undefined behavior

### Rule 18.4 - Pointer Arithmetic

- Pointer arithmetic to calculate function addresses is prohibited
- Prevents crafting function pointers at runtime from arbitrary memory
- Array subscript syntax `ptr[expr]` preferred over pointer manipulation

### Key MISRA Philosophy

"MISRA's focus on eliminating ambiguous, error-prone, or non-portable language constructs directly supports safety goals. In cybersecurity, this reduces the attack surface; in functional safety, it minimizes the risk of hazardous failures."

## Research: How Other Languages Handle Function Pointers

### Rust

```rust
// Non-null by default - cannot be null
fn handler(x: i32) -> i32 { x * 2 }
let fp: fn(i32) -> i32 = handler;

// Nullable version uses Option
let maybe_fp: Option<fn(i32) -> i32> = Some(handler);
// Option<fn()> has same ABI as nullable C function pointer (zero-cost)

// Safe vs unsafe function pointers
let safe_fp: fn(i32) = safe_function;
let unsafe_fp: unsafe fn(i32) = risky_function;  // Must call in unsafe block
```

**Safety features:**

- Function pointers are **never null** unless wrapped in `Option`
- `Option<fn()>` has zero-cost representation (uses null for `None`)
- Separate types for safe vs unsafe functions
- Compile-time signature matching prevents mismatches

### Ada

```ada
-- Null exclusion prevents null values
type Callback is not null access function (X : Integer) return Integer;

-- Accessibility rules prevent dangling references
-- Nested functions cannot escape their scope unsafely

-- Contracts on function pointer types (Ada 2022+)
type Comparator is access function (A, B : Integer) return Boolean
   with Pre => A /= B;  -- Verified at call time!
```

**Safety features:**

- **Null exclusion** (`not null access`) guarantees non-null at compile time
- **Accessibility rules** prevent dangling references from scope issues
- **Contracts** can be attached to function pointer types
- Original Ada 83 had no function pointers at all to preserve type safety

### Zig

```zig
// Functions are first-class, can be assigned to variables
const handler: *const fn(u32) void = myHandler;

// Null safety through explicit optionals
const maybe_handler: ?*const fn(u32) void = null;
```

**Safety features:**

- Null safety through explicit optionals
- Explicit casting required between pointer types
- Comptime verification of function types
- Proposal for "restricted function types" that limit indirect call targets

### Swift

```swift
// Non-escaping by default - closure cannot outlive function
func process(handler: (Int) -> Void) {
    handler(42)  // Must be called before function returns
}

// Escaping closures explicitly marked
func setCallback(handler: @escaping (Int) -> Void) {
    self.storedHandler = handler  // Can outlive function
}
```

**Safety features:**

- Non-escaping closures **cannot cause retain cycles** (compiler guarantees)
- `@escaping` forces awareness of memory/lifetime implications
- Optional closures are implicitly escaping
- Compiler manages closure memory more effectively with this distinction

### Go

Go largely avoids function pointers in favor of interfaces:

```go
type Handler interface {
    Handle(data int)
}
```

**Safety features:**

- Interfaces provide type-safe polymorphism without raw function pointers
- Static type system enforces strict signature matching
- Interface values are two pointers: type info + data (not raw function address)

## Research: Common Function Pointer Bugs

### 1. Null Dereference

Calling through uninitialized or null function pointer causes crash/segfault.

```c
void (*callback)(int) = NULL;
callback(42);  // Crash!
```

### 2. Signature Mismatch

Wrong parameter types lead to undefined behavior - stack corruption, wrong values.

```c
void (*handler)(int) = (void (*)(int))wrong_signature_func;
handler(42);  // UB - may appear to work, then fail mysteriously
```

### 3. Uninitialized (Wild Pointers)

Uninitialized function pointers contain garbage addresses.

```c
void (*handler)(int);  // Contains garbage!
handler(42);  // Jumps to random memory - crash or worse
```

### 4. Type Punning

Casting function pointer to `void*` and back is undefined behavior.

```c
void *ptr = (void*)my_function;  // UB per C standard
void (*fp)(void) = (void (*)(void))ptr;  // UB
```

### 5. Dangling Pointer

Function unloaded (dynamic library) but pointer retained.

```c
void (*fp)(void) = get_plugin_function();
unload_plugin();
fp();  // Dangling - jumps to unmapped memory
```

### 6. Unchecked Nullable Callbacks

Common pattern that crashes:

```c
if (config.on_complete)  // Check exists
    config.on_complete(result);
// But what if on_complete is set to invalid non-null garbage?
```

## Research: Bug Prevention Summary

| Bug Class              | How Cnx Prevents It                                      |
| ---------------------- | -------------------------------------------------------- |
| **Null dereference**   | Never null - always initialized to default function      |
| **Signature mismatch** | Nominal typing - function name IS the type               |
| **Type conversions**   | Prohibited (MISRA 11.1 compliance)                       |
| **Uninitialized**      | Always initialized to default at declaration             |
| **Accidental swap**    | Nominal typing prevents swapping same-signature handlers |

## Research: Summary Comparison Table

| Language  | Null Handling                    | Type Safety | Special Features                     |
| --------- | -------------------------------- | ----------- | ------------------------------------ |
| **C**     | Nullable, unchecked              | Structural  | Maximum flexibility, maximum danger  |
| **Rust**  | Non-null default; `Option<fn()>` | Structural  | `unsafe fn` distinction              |
| **Zig**   | Explicit optionals               | Structural  | Restricted function types (proposed) |
| **Ada**   | `not null` available             | Structural  | Contracts on types                   |
| **Swift** | Optionals                        | Structural  | `@escaping`/`@noescape`              |
| **Go**    | Interfaces instead               | Structural  | Avoids raw function pointers         |
| **Cnx**   | Never null (default function)    | **Nominal** | Function-as-type pattern             |

## References

- ADR-040: ISR Declaration (for interrupt vector tables)
- ADR-009: ISR Safety (for shared state and atomics)
- [MISRA C:2012 Rule 11.1 - Function Pointer Conversions](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule11.1.html)
- [MISRA C:2023 Rule 18.4 - Pointer Arithmetic](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule18.4.html)
- [Rust Function Pointer Types](https://doc.rust-lang.org/reference/types/function-pointer.html)
- [Ada Access Types](https://learn.adacore.com/courses/advanced-ada/parts/resource_management/access_types.html)
- [Swift Closures - Escaping](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/closures/)
- [Common Pointer Mistakes in Embedded C](https://deepbluembedded.com/pointers-embedded-c/)
- [SPARK for MISRA-C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)
- [Zig Function Pointers](https://gencmurat.com/en/posts/mastering-functions-in-zig/)
- [MISRA C Guidelines Overview](https://www.perforce.com/resources/qac/misra-c-cpp)
- [FlexCAN_T4 Callback Pattern](https://github.com/tonton81/FlexCAN_T4/blob/master/FlexCAN_T4.h)
