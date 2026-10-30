# ADR-044: Primitive Types

**Status:** Implemented
**Date:** 2025-12-30
**Decision Makers:** cnx Language Design Team

## Context

cnx needs well-defined primitive types that:

1. **Guarantee fixed widths** - Unlike C's `int` which varies by platform (16-bit on AVR, 32-bit on ARM)
2. **Map cleanly to C99 stdint.h types** - For interoperability and portability
3. **Support embedded systems** - Where knowing exact memory layouts is critical
4. **Enable type-aware features** - Like bit indexing (ADR-007) and length properties (ADR-058)

### The Problem with C's Built-in Types

```c
// C type sizes are platform-dependent
int value;       // 16 bits on AVR, 32 bits on ARM
long data;       // 32 bits on most 32-bit, 64 bits on many 64-bit systems
```

This causes real bugs when code moves between microcontrollers or when data structures are serialized.

---

## Research: How Other Languages Handle This

### Rust

Rust uses explicit-width types as the default:

```rust
let x: i32 = 42;     // Always 32-bit signed
let y: u8 = 255;     // Always 8-bit unsigned
let z: f64 = 3.14;   // Always 64-bit float
```

Rust also has `isize` and `usize` for pointer-sized integers.

### Zig

Zig follows a similar pattern with explicit widths:

```zig
const x: i32 = 42;
const y: u8 = 255;
const z: f64 = 3.14;
```

Zig also supports arbitrary bit-width integers like `u3`, `i17`, etc.

### C99 with stdint.h

C99 added fixed-width types via `<stdint.h>`:

```c
#include <stdint.h>
int32_t x = 42;
uint8_t y = 255;
```

This is widely supported but requires explicit includes.

---

## Decision

### Primitive Type Mappings

CNX provides fixed-width types that transpile to C99 stdint.h types:

| CNX Type | C Type     | Description             |
| -------- | ---------- | ----------------------- |
| `u8`     | `uint8_t`  | 8-bit unsigned integer  |
| `u16`    | `uint16_t` | 16-bit unsigned integer |
| `u32`    | `uint32_t` | 32-bit unsigned integer |
| `u64`    | `uint64_t` | 64-bit unsigned integer |
| `i8`     | `int8_t`   | 8-bit signed integer    |
| `i16`    | `int16_t`  | 16-bit signed integer   |
| `i32`    | `int32_t`  | 32-bit signed integer   |
| `i64`    | `int64_t`  | 64-bit signed integer   |
| `f32`    | `float`    | 32-bit floating point   |
| `f64`    | `double`   | 64-bit floating point   |
| `bool`   | `bool`     | Boolean (stdbool.h)     |

### Usage Examples

```cnx
// Integer types
u8 byte <- 255;
i32 counter <- -100;
u64 bigNumber <- 0xFFFFFFFFFFFFFFFF;

// Floating point
f32 temperature <- 23.5;
f64 preciseValue <- 3.141592653589793;

// Boolean
bool isReady <- true;
bool hasData <- false;
```

### Generated C

```c
#include <stdint.h>
#include <stdbool.h>

uint8_t byte = 255;
int32_t counter = -100;
uint64_t bigNumber = 0xFFFFFFFFFFFFFFFF;

float temperature = 23.5f;
double preciseValue = 3.141592653589793;

bool isReady = true;
bool hasData = false;
```

### Length Properties

A type's width is read through the length properties in [ADR-058](adr-058-explicit-length-properties.md). This ADR defines none.

---

## Design Decisions

### No Implicit Type Coercion

CNX does not allow implicit narrowing conversions:

```cnx
u32 big <- 1000;
u8 small <- big;     // ERROR: Cannot implicitly convert u32 to u8

u8 small <- (u8)big;  // OK: Explicit cast (see ADR-024)
```

This prevents subtle truncation bugs common in C.

### Integer Literals

An integer literal is written in decimal (`42`), hexadecimal (`0x2A`) or binary (`0b101010`), with
an optional type suffix (`42u8`). Leading zeros after a `0x` or `0b` prefix are allowed (`0x001`,
`0b0000001`). **There is no octal literal** (owner ruling, 2026-10-03, #1728): a decimal literal
never begins with `0` unless it is `0` itself, so `010` is an error, where C would read it as 8.

Integer literals default to the smallest type that fits the context at compile time, or `i32` when
unspecified (owner ruling, 2026-10-03):

```cnx
u8 a <- 42;          // 42 fits in u8, OK
u8 b <- 256;         // ERROR: 256 doesn't fit in u8
i32 c <- 42;         // Default to i32
u8 d <- 010;         // ERROR: a leading zero; there is no octal literal
u8 e <- 0x0A;        // OK: 10
i64 f <- 2147483647 + 1; // 2147483648: each literal takes i64, its context's type
```

### Floating Point Literals

Floating point literals default to `f64` unless explicitly typed:

```cnx
f32 temp <- 23.5;    // OK: f64 literal narrowed to f32 (loses precision)
f64 precise <- 23.5; // OK: f64 literal assigned to f64
```

### Integer Overflow Behavior

See **Research: Integer Overflow** section below for the full decision.

**Summary:** CNX uses per-variable overflow semantics with `clamp` (default) and `wrap` keywords:

```cnx
clamp u16 sensorValue <- 0;  // Saturates at boundaries (safe default)
wrap u32 counter <- 0;       // Two's complement wrap (opt-in)
u8 normal <- 0;              // Default: clamp
```

**What can be caught at compile time is an error, never a clamp or a wrap.** `clamp` and `wrap`
apply only to values not known until runtime, and `--debug` still makes every one of them panic
on overflow during development. See _Compile time first_ below.

---

## Research: Integer Overflow

Integer overflow is a major source of bugs in embedded systems. This section documents real-world failures, how other languages handle overflow, and options for CNX.

### Real-World Disasters

| Incident                | Cause                                          | Consequence                                          |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| **Ariane 5 (1996)**     | 64-bit float to 16-bit signed integer overflow | Rocket destroyed 37 seconds after launch, $370M loss |
| **Therac-25 (1985-87)** | Arithmetic overflow + no hardware safety       | 6 deaths from radiation overdoses                    |
| **Boeing 787 (2015)**   | 32-bit signed counter after 248 days           | FAA ordered periodic resets to prevent power loss    |
| **WhatsApp (2022)**     | CVE-2022-36934 integer overflow                | Remote code execution during video calls             |

Integer overflow ranked **#14 in CWE Top 25** most dangerous software weaknesses (2023).

> "The software had been considered bug-free since it had been used in many previous flights, but those used smaller rockets which generated lower acceleration than Ariane 5."
> — [Wikipedia: Integer Overflow](https://en.wikipedia.org/wiki/Integer_overflow)

### C's Undefined Behavior Problem

In C, signed integer overflow is **undefined behavior**. This means:

1. The compiler assumes it **cannot happen**
2. Overflow checks can be **optimized away**
3. Code that worked in older compilers may **silently break** in newer ones

```c
// This "overflow check" gets REMOVED by modern compilers!
if (a + 1 < a) {
    handle_overflow();  // DELETED - compiler assumes this is dead code
}
```

Why compilers do this:

- **Performance**: 30-50% speedup in tight loops when exploiting signed overflow UB
- **Standard compliance**: C standard says signed overflow is undefined

> "When GCC's developers changed their compiler in 2008 such that it omitted certain overflow checks that relied on undefined behavior, CERT issued a warning against the newer versions of the compiler."
> — [A Guide to Undefined Behavior in C](https://blog.regehr.org/archives/213)

**Unsigned integers** wrap predictably (two's complement), but this silent wrapping can still cause bugs.

### How Other Languages Handle Overflow

| Language      | Debug Mode                          | Release Mode | Explicit Control                          |
| ------------- | ----------------------------------- | ------------ | ----------------------------------------- |
| **C**         | Undefined (signed), Wrap (unsigned) | Same         | `-fwrapv` flag                            |
| **Rust**      | Panic                               | Wrap         | `checked_*`, `wrapping_*`, `saturating_*` |
| **Zig**       | Panic                               | Panic        | `+%`, `-%`, `*%` wrapping operators       |
| **Swift**     | Trap (crash)                        | Trap (crash) | `&+`, `&-`, `&*` overflow operators       |
| **Ada/SPARK** | Constraint_Error                    | Configurable | Range types, preconditions                |

#### Rust's Approach

Rust provides **different behavior per build mode** plus explicit methods:

```rust
let a: u8 = 255;

// Debug mode: panics
// Release mode: wraps to 0
let b = a + 1;

// Explicit control (works same in all modes):
let c = a.wrapping_add(1);     // 0 - always wraps
let d = a.saturating_add(1);   // 255 - clamps to max
let e = a.checked_add(1);      // None - returns Option
let (f, overflow) = a.overflowing_add(1);  // (0, true)
```

> "When compiling in release mode with the --release flag, Rust does not include checks for integer overflow that cause panics. Instead, if overflow occurs, Rust performs two's complement wrapping."
> — [Rust Book: Data Types](https://doc.rust-lang.org/book/ch03-02-data-types.html)

#### Zig's Approach

Zig treats overflow as **illegal by default** in all builds:

```zig
var a: u8 = 255;
a = a + 1;    // Runtime panic! (illegal overflow)

a = a +% 1;   // OK: wrapping add, result is 0
```

> "In Zig both signed and unsigned integers have illegal behavior on overflow, contrasted to only signed integers in C."
> — [Zig Guide: Integer Rules](https://zig.guide/language-basics/integer-rules/)

#### Swift's Approach

Swift **always traps** on overflow (cannot be caught):

```swift
var a: UInt8 = 255
a = a + 1     // Fatal error: crash

a = a &+ 1   // OK: overflow operator, wraps to 0
```

> "In Swift, arithmetic operators do not overflow or underflow by default... the result is a crash."
> — [Apple: Integer Overflow](https://developer.apple.com/documentation/xcode/integer-overflow)

#### Ada/SPARK's Approach

Ada raises an exception; SPARK can **prove at compile-time** that overflow is impossible:

```ada
X : Integer := Integer'Last;
X := X + 1;  -- Raises Constraint_Error at runtime

-- SPARK can prove this is safe with preconditions:
procedure Increment(X : in out Integer)
  with Pre => X < Integer'Last;
```

> "GNATprove can be used to demonstrate statically that none of these errors can ever occur at runtime."
> — [AdaCore: Proof of Program Integrity](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)

### MISRA C Guidelines

MISRA C treats signed overflow as a critical issue:

<!-- cspell:disable-next-line -- verbatim MISRA C:2012 Rule 1.3 text; the standard is written in British English -->

- **Rule 1.3**: "There shall be no occurrence of undefined or critical unspecified behaviour"
- **Signed overflow**: Undefined behavior (violation)
- **Unsigned overflow**: Well-defined wrap, but flagged in constant expressions

> "Appendix H of MISRA:C 2012 lists hundreds of cases of undefined and critical unspecified behavior in the C programming language standard."
> — [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

### Decision: Per-Variable Overflow Semantics

CNX takes a unique approach: **overflow behavior is declared per-variable** using keywords, with a safe default.

#### Syntax

```cnx
// Explicit overflow behavior at declaration (keyword before type)
clamp u16 egtTemp <- 0;      // Saturates at 0 and 65535
wrap u32 cycleCounter <- 0;  // Wraps intentionally (two's complement)
u8 normalVar <- 0;           // Default: clamp (safe)
```

#### Keywords

| Keyword | Behavior                     | Use Case                                         |
| ------- | ---------------------------- | ------------------------------------------------ |
| `clamp` | Saturates at min/max of type | Sensor readings, control values, safety-critical |
| `wrap`  | Two's complement wrap-around | Counters, checksums, timing, hashing             |
| (none)  | Default to `clamp`           | Most variables                                   |

#### Compile time first: clamp and wrap are for runtime values only

**Owner ruling, 2026-10-23 (#1618):** anything the compiler can catch at compile time is a
compile error. `clamp` and `wrap` never apply to it. They exist only for values that are not
known until runtime, where no compiler could have caught the overflow.

How that ruling applies to each operator. The owner sent the scope question to the cnx-way
skill rather than ruling on it, so this is the principle applied, not a further ruling
([#1618](https://github.com/smeltworks/cnx/issues/1618#issuecomment-6376354988)):

- A literal operand of `+`, `-` or `*` that does not fit the target is E0868 (ADR-024), with
  `clamp`, with `wrap` and with neither: clamp or wrap would act on a known value.
  `u8 a +<- 300` and `a <- a + 300` are rejected; they do not saturate to 255 or wrap to
  `a + 44`. A literal operand of `|` or `^` must fit the target's width, since bits past it
  would be dropped: `u8 a <- b | 0x100` is rejected, `i16 m ^<- 0xAAAA` is not.
- A literal operand of `&`, or a `/` or `%` divisor, that does not fit the target does not make
  the result overflow: `b & 0x1FF` keeps only `b`'s bits and `b / 300` is 0. Nothing is
  rejected: `u8 a <- b & 0x1FF` and `a <- b / 300` compile. A `+`, `-` or `*`
  inside such an operand is still checked: `a &<- (b + 300)` is rejected.
- A literal operand of `+`, `-` or `*` must also fit the type its arithmetic happens at, when
  that is narrower than the target, since the clamp acts there
  ([owner ruling, 2026-10-24](https://github.com/smeltworks/cnx/issues/1618#issuecomment-6379394725)): with `u8 b`, `u32 r <- b + 300` is E0868, where it
  compiled to `cnx_clamp_add_u8(b, 300U)`. `u32 r <- (u32)b + 300` compiles.
- A value the compiler folds, bound names included, is checked as one value, at the target's
  width. A name that is not `mut` is a constant, and so is arithmetic over it
  ([owner ruling, 2026-10-24](https://github.com/smeltworks/cnx/issues/1618#issuecomment-6379394725)): inside a function too, `u8 a <- 250; u8 c <- a + a;` is
  E0910. `u32 x <- 0x10000 * 0x10000` is E0910, the code a static initializer's overflow
  already had, and so is `u32 y <- BIG * BIG` after `u32 BIG <- 0x10000`. The first analyzer
  stage that can detect the overflow reports it. A value a typed name
  folds to keeps its type's range, which E0869 judges. `i8 x <- -(128)` compiles.
- A wider operand is E0869 (ADR-024): `u8 a +<- big` with `u32 big` is rejected, and code that
  means the low bits says so with `a +<- big[0, 8]`.
- Clamping or wrapping a runtime value is still allowed, but it can hide a bug. `--debug`
  (below) is there to catch that: every `clamp` and `wrap` operation panics on overflow instead,
  so the overflows they would hide in production surface during development.

```cnx
mut clamp u8 level <- 200;
level +<- 300;         // ERROR E0868: 300 is known at compile time and does not fit u8
level +<- reading();   // runtime value: clamps at 255; --debug panics instead
```

#### Struct fields and array elements

A struct field takes the same modifier, in the same place, with the same
default (#1411, owner ruling 2026-10-11). An array element has its array's
behavior (#1887). Every rule in this ADR about "the value" holds for a field
and an element exactly as for a variable:

```cnx
struct Reading {
    u8 level; // clamp (default)
    clamp u8 peak; // clamp
    wrap u8 checksum; // wraps
}

Reading r <- { level: 250, peak: 250, checksum: 250 };
r.level <- r.level + 10; // 255
r.checksum +<- 10; // 4

wrap u8[4] ring;
ring[0] +<- 10; // wraps, as `ring` does
u8[4] levels <- [250, 250, 250, 250];
levels[1] +<- 10; // 255
```

The field's modifier is its own: it does not come from the struct variable it
is reached through. A clamping compound assignment evaluates its target once,
so `levels[next()] +<- 10` calls `next()` once, as `+=` does in C.

#### Call results and casts

A function's return type takes `clamp` or `wrap` like a variable, and a call
result has that behavior; without one it clamps, the default _(owner ruling,
2026-10-29, #1703)_. A scope method is declared the same way, and the
modifier travels with the function, so a call from another file behaves the
same.

A cast keeps its operand's behavior: `(u16)w` of a `wrap` value wraps. To
choose another, write it in the cast: `(clamp u16)w` clamps and `(wrap u16)a`
wraps _(owner ruling, 2026-10-29, #1703)_. A cast of a literal is a literal,
and counts no more than one does.

```cnx
u8 full() {
    return 255;
}

wrap u8 ring() {
    return 255;
}

u8 a <- full() + 1; // 255
u8 b <- ring() + 1; // 0
u8 c <- (u8)ring() + 1; // 0 -- the cast keeps `wrap`
u8 d <- (clamp u8)ring() + 1; // 255
```

The modifier changes what the call's result does in its caller's arithmetic.
It does not change the function's own `return` expression, which follows its
own operands.

#### Scope: expressions, not just compound assignment

The modifier governs **every arithmetic operation on the value**, not only
compound assignment. These are equivalent:

```cnx
u8 a <- 250;
u8 b <- 250;

mut u8 viaCompound <- 250;
viaCompound +<- b; // 255

u8 viaExpression <- a + b; // 255 -- same helper, same result
```

Both generate `cnx_clamp_add_u8(...)`. Between #238 and #1152 only the compound
form did, so `a + b` wrapped to 244 while `a +<- b` saturated to 255, and `wrap`
generated byte-identical code to `clamp` in every expression -- the opt-in
modifier bought nothing and the default protected nothing.

**An operation happens at the operands' width.** `u16 wide <- a + b` saturates
at `u8` and then widens, giving 255; to add at `u16`, widen the operands:
`(u16)a + (u16)b` (ADR-024).

**A mix saturates.** An expression wraps only when every integer operand was
declared `wrap`; one saturating operand is enough to make the result saturate.
That is what makes a bounds guard trustworthy when one of its terms can
saturate -- see #231, where an unclamped `offset + length` wrapped past a guard
and wrote out of bounds.

Applies to `+`, `-` and `*`. Unsigned division and modulo cannot overflow, and
the single signed case (`INT_MIN / -1`) is left to the safe-division path.

#### Values fixed at compile time

Owner ruling, 2026-10-03 (#1175): some values are fixed while the program compiles, such as an
array's size and an enum member's value. They use the same arithmetic as every
other expression: an operation happens at its operands' width, and a literal takes the smallest
type that fits its context at compile time, or `i32` when unspecified (see Integer Literals
above). **Where that arithmetic would
clamp or wrap, the program is rejected.** The operand's modifier makes no difference: neither a
`clamp` nor a `wrap` operand silently saturates or wraps a size or a value that is fixed at
compile time.

```cnx
u8 A <- 200;

u8[A + A] buf; // ERROR: A + A overflows u8 (clamp would give 255, C would give 400)
u8[(u16)A + (u16)A] wide; // OK: 400, added at u16
```

A clamped size is a buffer smaller than its arithmetic says, and a wrapped one is smaller
still. At run time, saturating protects a value that cannot be known in advance. Here the
value is known in advance, so the rejection reports the overflow while it can still be fixed.

Owner ruling, 2026-10-21 ([#1735](https://github.com/smeltworks/cnx/issues/1735#issuecomment-6329098698)): a file-scope or scope variable's initializer is a value fixed
at compile time too, with or without `mut`, and **in C++ output as in C**. It is written as its
folded value. Where its arithmetic would clamp or wrap, the program is rejected. An initializer
with no value at compile time, such as a read of a `mut` variable or a function call, is rejected
as well. A cast of a value its type does not hold is rejected too, because ADR-024 forbids a
narrowing cast; that is not part of this ruling.

Owner ruling, 2026-10-21 ([#1735](https://github.com/smeltworks/cnx/issues/1735#issuecomment-6329098698)), on a header macro in such an initializer. A macro cnx can
read, such as `#define LIMIT 10`, is checked like any other value and written as the macro, so
`u32 L <- LIMIT + A` with `A` at 4 is written `LIMIT + 4`. A macro it cannot read, such as
`#define UNREAD (sizeof(int) * 100)`, is written through to C when it is used alone. Arithmetic
over one it cannot read is rejected (E0909), even though C would compile it, because cnx
cannot check that the arithmetic does not clamp or wrap. An enum member's value is rejected the
same way (ADR-017).

```cnx
mut u32 g <- 4;
u8 D <- 250;

u32 F <- g;     // ERROR: g has no value at compile time, also with --cpp
u8 E <- D + 10; // ERROR: D + 10 overflows u8
u8 G <- D + 5;  // OK: written as 255
```

C would refuse a static initializer it could not settle. C++ would run it before `main` (dynamic
initialization), so `--cpp` could accept what C refuses. The same cnx program means the same
thing whichever language it is written out in, so cnx settles the value, or rejects the
program, before either compiler sees it.

#### Rationale

1. **Intent is documented at declaration** - Code is self-documenting
2. **Default to safe (clamp)** - Must opt-in to dangerous wrap behavior
3. **No hidden surprises** - Behavior is explicit and predictable
4. **Matches embedded reality** - Different variables genuinely need different behavior
5. **Uniform across contexts** - The same arithmetic means the same thing wherever it is written

#### Why Clamp is the Default

From [MATLAB Fixed-Point documentation](https://www.mathworks.com/help/fixedpoint/ug/saturation-and-wrapping.html):

> "For most control applications, **saturation is the safer way** of dealing with fixed-point overflow."

The disasters (Ariane 5, Therac-25, Boeing 787) were all **wrap-around bugs**:

- EGT sensor: 65535 + 1 = **0** with wrap (reads "cold" - engine melts)
- EGT sensor: 65535 + 1 = **65535** with clamp (reads "max hot" - safe)

#### Debug Mode: `--debug` Flag

When compiled with `--debug`, **all** arithmetic operations panic on overflow regardless of `clamp`/`wrap` keywords:

```cnx
mut clamp u8 temp <- 255;
temp <- temp + 1; // Normal: clamps to 255
// --debug: PANIC! Overflow detected
```

This catches bugs during development before they matter in production.

#### Examples

```cnx
// Safety-critical: exhaust gas temperature (clamp is explicit but matches default)
mut clamp u16 egtTemp <- 0;
egtTemp <- egtTemp + 100; // If at 65535, stays at 65535

// Intentional wrap: CPU cycle counter for timing
mut wrap u32 cycleCount <- 0;
cycleCount <- cycleCount + 1; // At 0xFFFFFFFF, wraps to 0

// Default behavior (clamp): most variables
mut u8 brightness <- 200;
brightness <- brightness + 100; // Clamps to 255, not 44
```

#### Generated C

```c
// clamp u16 egtTemp <- 0;
uint16_t egtTemp = 0;

// egtTemp <- egtTemp + 100;
egtTemp = cnx_clamp_add_u16(egtTemp, 100);

// wrap u32 cycleCount <- 0;
uint32_t cycleCount = 0;

// cycleCount <- cycleCount + 1;
cycleCount = (uint32_t)(cycleCount + 1);  // Natural wrap

// With --debug flag, ALL operations become:
// cnx_clamp_add_u16(egtTemp, 100);  // Panics on overflow
```

#### Helper Functions (Generated)

Transcribed from actual transpiler output. Note that `b` is the **wider** type,
not the value type: the right-hand operand is checked before any narrowing, so
an out-of-range operand cannot be truncated into an in-range one (Issue #94).

```c
// Saturating addition for u16 (default: clamp)
static inline uint16_t cnx_clamp_add_u16(uint16_t a, uint32_t b) {
    if (b > (uint32_t)(UINT16_MAX - a)) return UINT16_MAX;
    return (uint16_t)(a + (uint16_t)b);
}
```

With `--debug`, the same function name is generated with a panic body -- there
is no separate `cnx_debug_*` symbol, so switching modes changes what the helper
does and never what a caller is linked against:

```c
static inline uint16_t cnx_clamp_add_u16(uint16_t a, uint32_t b) {
    if (b > (uint32_t)(UINT16_MAX - a)) {
        fprintf(stderr, "PANIC: Integer overflow in u16 addition\n");
        abort();
    }
    return (uint16_t)(a + (uint16_t)b);
}
```

Debug mode therefore pulls in `<stdio.h>` and `<stdlib.h>`, which a freestanding
target may not have. Release mode needs neither.

**The range check is the whole overflow test.** Falling through it proves
`a + b <= UINT16_MAX` _and_ that `(uint16_t)b` does not truncate, so the
addition below it cannot overflow.

Between #238 and #1143 these helpers also called `__builtin_add_overflow` /
`__builtin_sub_overflow` / `__builtin_mul_overflow` after the range check. That
call was unreachable for exactly the reason above, and was removed in #1143:

- Verified unreachable over 58,903,538 cases (u8 exhaustive, u16 exhaustive,
  u32/u64 boundary-biased); the builtin branch fired zero times, and the range
  check alone produced the correct saturating value every time.
- It was introduced as a value-range hint to suppress a `-Wstringop-overflow`
  false positive (#231), but it does not suppress that diagnostic: with and
  without it, GCC emits identical `-Wstringop-overflow` and `-Warray-bounds`
  output.
- Removing it drops a **GCC 5+ / Clang 3.8+** floor from generated code, which
  is otherwise C99, and shrinks these helpers by roughly 30% at `-Os` on
  Cortex-M4.

#### Trade-offs

**Advantages:**

- Intent is always clear at declaration
- Safe default prevents catastrophic wrap bugs
- Explicit `wrap` keyword documents intentional wrapping
- Debug mode catches all overflow bugs during development
- More expressive than any other language surveyed

**Disadvantages:**

- Slight runtime cost for clamp checks (mitigated by compiler optimization)
- New syntax for C programmers to learn
- Generated C is more verbose

---

## Platform-Specific Considerations

### 8-bit Microcontrollers (AVR)

On 8-bit platforms, 64-bit types may be emulated in software. CNX should:

1. Allow their use (for portability)
2. Warn about performance implications
3. Never silently fail

---

## Trade-offs

### Advantages

1. **Portability** - Code works identically across platforms
2. **Clarity** - Type size is obvious from the name
3. **Safety** - No surprise narrowing or widening
4. **Interoperability** - Clean mapping to C99 types

### Disadvantages

1. **Unfamiliar syntax** - `u32` vs `int` looks different to C programmers
2. **Learning curve** - C programmers must adapt
3. **No "native" int** - Can't get optimal register-sized type

---

## Interaction with Other Features

### Bit Indexing (ADR-007)

Bit width is known from the type:

```cnx
mut u8 flags <- 0;
flags[7] <- true; // OK: bit 7 exists in u8
flags[8] <- true; // ERROR: u8 only has bits 0-7
```

### Type Casting (ADR-024)

Explicit casts between numeric types:

```cnx
i32 signed <- -42;
u32 unsigned <- (u32)signed;   // Explicit cast required
```

### Arrays

Array element types are explicit:

```cnx
u8[256] buffer;      // 256-byte buffer
i32[10] values;      // 10 32-bit integers
```

---

## Implementation Notes

### Required C Headers

The transpiler must emit:

```c
#include <stdint.h>   // For uint8_t, int32_t, etc.
#include <stdbool.h>  // For bool, true, false
```

### Type Width Tracking

Bit widths come from the type table above; ADR-058's length properties expose
them. Nothing here restates them -- three copies of a width table is three
chances for them to disagree.

---

## Success Criteria

1. All primitive types transpile to correct C99 types
2. No implicit narrowing conversions allowed
3. `<stdint.h>` and `<stdbool.h>` are automatically included when needed
4. Type errors caught at compile time, not runtime
5. `clamp` keyword generates saturating arithmetic
6. `wrap` keyword generates natural two's complement wrap
7. Default (no keyword) behaves as `clamp`
8. `--debug` flag causes panic on any overflow

---

## Diagnostics

| Code  | Reported when                                                                                                                                                                                                                                                                                                                     | Asserted by                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0909 | A file-scope or scope variable's initializer has no value at compile time, such as a read of a `mut` variable or a function call, or is arithmetic over a header macro cnx cannot read, so it cannot check that the arithmetic does not clamp or wrap. This applies in C++ output as in C (#1735, "Values fixed at compile time") | `tests/bugs/issue-1735-static-initializer-arithmetic/static-not-constant.test.cnx`                                                                                                                                          |
| E0910 | A value known at compile time -- an array's size, an enum member's value, a file-scope or scope variable's initializer (#1735), or a value at any position a value lands (#1618) -- is arithmetic that would clamp or wrap at its operands' width, or a cast of a value its type does not hold ("Values fixed at compile time")   | `tests/bugs/issue-1175-constant-dimensions/overflow-dimension.test.cnx`, `tests/bugs/issue-1669-enum-member-values/value-overflow.test.cnx`, `tests/bugs/issue-1735-static-initializer-arithmetic/static-overflow.test.cnx` |
| E0912 | A decimal integer literal has a leading zero: there is no octal literal ("Integer Literals")                                                                                                                                                                                                                                      | `tests/bugs/issue-1728-leading-zero/leading-zero.test.cnx`                                                                                                                                                                  |

## Scope-Context Matrix

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | warn     |
| top-level function | same file           | error    |
| scope member       | same file           | warn     |
| scope method       | same file           | error    |
| global variable    | imported direct     | warn     |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported transitive | warn     |
| top-level function | imported transitive | warn     |
| scope member       | imported transitive | warn     |
| scope method       | imported transitive | warn     |

<!-- MATRIX-SEVERITY code: E0909 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | off      |
| scope member       | same file           | error    |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0909 fires only on a file-scope or scope variable's initializer; a function or method body, and a `for` header, declare variables that have no static storage, so reading a `mut` variable or calling a function there is accepted.

<!-- MATRIX-SEVERITY code: E0910 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

A `for` header is a value position like any other (#1618): `for (mut u16 i <- BASE + BASE; ...)` overflows at compile time, so it is E0910, not a clamp. An array declared there is still E0917 (ADR-036).

<!-- MATRIX-SEVERITY code: E0912 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

E0912 is about how a literal is spelled, so it fires wherever a literal can be written, a `for` header included; that row is declared here although the ADR-wide table has none.

Until #1303 this ADR declared no matrix at all, which per
[`README.md`](README.md) reads as a claim that clamp and wrap cannot occur
anywhere — and the defect #1303 fixed was precisely a cell nothing was watching:
the declared behavior was dropped the moment a symbol crossed a file boundary.

**No cell is `off`.** All four contexts are reachable: the rule fires in a
file-scope initializer as readily as in a function body, so `global variable`
is uncovered rather than impossible. There it fires as a rejection, not a
helper call (#1735): a file-scope or scope variable's initializer is a value
fixed at compile time, so `u8 sum <- base + 10` with `base` at 250 is E0910,
and one that fits is written as its folded value. It used to emit
`cnx_clamp_add_u8`, a call C does not take in a static initializer (C11
6.7.9p4). Declaring `off` anywhere here would be the quiet-report claim this
project treats as dishonest.

Three cells are occupied and `error`. The other nine are **untested**, not
unreachable, and #1410 tracks closing them. Two things are worth recording for
whoever picks that up:

- Occupancy needs the rule to _fire_, not merely to be declared. A fixture full
  of `clamp u8` declarations with no arithmetic occupies nothing, which is why
  `primitives/clamp-declaration.test.cnx` is deliberately not tagged.
- The two forms reach different decisions and both record: `a <- a + b` through
  `tryClampOperands`, `a +<- b` through the compound handler. A fixture written
  in one form does not cover the other, and the axes cannot see the difference —
  they derive the same cell.

## References

### Type Systems

- [C99 stdint.h specification](https://en.cppreference.com/w/c/types/integer)
- [Rust primitive types](https://doc.rust-lang.org/book/ch03-02-data-types.html)
- [Zig primitive types](https://ziglang.org/documentation/master/#Primitive-Types)
- [MISRA C: Type rules](https://www.misra.org.uk/)

### Integer Overflow

- [Wikipedia: Integer Overflow](https://en.wikipedia.org/wiki/Integer_overflow) - Ariane 5, Therac-25, Boeing 787 cases
- [CWE-190: Integer Overflow or Wraparound](https://cwe.mitre.org/data/definitions/190.html)
- [A Guide to Undefined Behavior in C](https://blog.regehr.org/archives/213)
- [Compilers Exploiting Signed Overflow](https://gist.github.com/rygorous/e0f055bfb74e3d5f0af20690759de5a7)

### Language Approaches

- [Rust: Overflow Behavior](https://www.slingacademy.com/article/exploring-rusts-overflow-behavior-wrapping-saturating-and-panicking/)
- [Zig: Integer Rules](https://zig.guide/language-basics/integer-rules/)
- [Swift: Integer Overflow](https://developer.apple.com/documentation/xcode/integer-overflow)
- [Ada/SPARK: Proof of Program Integrity](https://learn.adacore.com/courses/intro-to-spark/chapters/03_Proof_Of_Program_Integrity.html)
- [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

### Related ADRs

- ADR-007: Type-Aware Bit Indexing
- ADR-024: Type Casting
