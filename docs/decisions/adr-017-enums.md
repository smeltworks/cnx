# ADR-017: Enums

## Status

**Implemented**

**Related:** ADR-063 (Identifier Syntax — amends the qualified-name separator)

> **Amended by ADR-063 (Issue #1117).** Enum members join their components with
> `__`: `State__IDLE` globally, `Motor__State__IDLE` inside a scope. ADR-063
> forbids a cnx identifier from containing `__`, so a generated member name
> can no longer collide with a plain identifier such as `u8 State_IDLE`.

## Context

Enums are fundamental to embedded C programming:

- State machines (IDLE, RUNNING, ERROR)
- Error codes (OK, TIMEOUT, INVALID_PARAM)
- Register field values (MODE_SPI, MODE_I2C)
- Configuration options (BAUD_9600, BAUD_115200)
- Bit flags ({ A <- 1, B <- 2, C <- 4 })

cnx currently has no enum support. This is a critical gap for v1.

## Research Summary

### The Problem with C Enums

C enums are just integers, which allows bugs:

```c
typedef enum { IDLE = 0, RUNNING = 1 } State;
typedef enum { OFF = 0, ON = 1 } Power;

void handleState(State s);

Power p = ON;
handleState(p);      // COMPILES! But Power != State - BUG!
handleState(42);     // COMPILES! 42 isn't a valid State - BUG!
```

### Modern Language Approach (TypeScript, C#, Zig)

Enums are their own type, not freely interchangeable with integers:

- Can't compare different enum types
- Can't assign integer to enum without explicit cast
- Explicit conversion required for integer value

## Decision

**Type-safe enums with C-style cast syntax for hardware access.**

### Syntax

```cnx
enum State {
    IDLE,
    RUNNING,
    PAUSED,
    ERROR
}
```

With explicit values:

```cnx
enum Command {
    READ  <- 0x01,
    WRITE <- 0x02,
    ERASE <- 0x04,
    RESET <- 0xFF
}
```

Bit flags pattern:

```cnx
enum Flags {
    NONE     <- 0,
    READABLE <- 1,
    WRITABLE <- 2,
    EXECUTABLE <- 4
}
```

### Default Value

An enum-typed variable, struct field or array element declared without an
initializer holds the enum's **zero enumerator**: the member whose value is 0,
else the first member (owner ruling on #1971, 2026-10-10). This holds at any
nesting depth and in any struct, with or without a callback field:

```cnx
enum Mode { IDLE <- 5, RUNNING }
struct Inner { Mode m; }
struct Holder { Inner inner; Mode[2] modes; }
Holder h;   // h.inner.m, h.modes[0] and h.modes[1] are Mode.IDLE
```

So a struct with an enum field has a non-zero default (and a
`<Struct>_init()`), and an enum array lists every element, which is why its
size must be one cnx can read (E0359).

The zero enumerator is the value, not an initialization: a local enum, an enum
field of a local, or an element of a local enum array read before it is
assigned is still E0381 (ADR-015, #1980).

### Member Values

A member's value is computed while the program compiles, as in C (owner ruling, 2026-10-03,
#1669). It may be any integer expression built from these parts:

- literals;
- read-only bindings (ADR-071) that have a value;
- a type's length property (`u32.type_byte_length`, ADR-058);
- casts;
- the integer operators;
- members of the same enum declared above it.

It is evaluated with ADR-044's arithmetic, including its rule that a value fixed at compile time
never overflows. A member written without a value continues from the one before it.

```cnx
u32 BASE <- 0x10;

enum Reg {
    CTRL <- BASE, // 16
    STATUS, // 17
    DATA <- BASE + 4 // 20
}
```

**A member of the same enum needs no cast** (owner ruling, 2026-10-03). A member is of its
enum's own type, which is the type the new member's value is being given, so nothing is
converted. The two common cases are a combined flag and an alias:

```cnx
enum Perm {
    READ  <- 1,
    WRITE <- 2,
    EXEC  <- 4,
    RW    <- Perm.READ | Perm.WRITE,   // 3
    ALL   <- Perm.RW | Perm.EXEC       // 7
}

enum Mode {
    SLOW,
    FAST,
    DEFAULT <- Mode.FAST               // 1
}
```

**A member's value is an `i32`** (owner ruling, 2026-10-03). When nothing gives a literal a type,
it is an `i32` (ADR-044), so arithmetic on literals alone happens at `i32`. Whatever the
arithmetic, the value it produces must fit `i32`: `A <- 0x80000000` is an error. Together with E0894, this puts a member's value in
`0`…`2147483647`. On some targets C's `int` is narrower than `i32`, for example 16 bits on an
8-bit microcontroller. Whether the range narrows there is #1862.

Some things are not a member value, and each is an error at the member:

- the member itself, or a member declared below it. Neither has a value yet;
- a variable;
- a function call;
- a name that an included C or C++ header defines, such as a macro. cnx needs the value
  itself: auto-increment continues from it, E0894 checks its sign, and #1862 checks its range.
  Owner ruling, 2026-10-03: a header name is rejected for now. Accepting it later breaks no
  program.

### Usage

```cnx
State currentState <- State.IDLE;

// Comparison - enum to enum of SAME type only
if (currentState = State.IDLE) {
    startMotor();
}

// Assignment
currentState <- State.ERROR;
```

### Type Safety Rules

```cnx
enum State { IDLE, RUNNING }
enum Power { OFF, ON }

State s <- State.IDLE;
Power p <- Power.ON;

// ALLOWED:
if (s = State.RUNNING) { }     // Same enum type comparison
s <- State.IDLE;                // Same enum type assignment

// NOT ALLOWED (compile errors):
if (s = Power.ON) { }          // ERROR: can't compare State to Power
if (s = 0) { }                 // ERROR: can't compare enum to integer
s <- 1;                        // ERROR: can't assign integer to enum
s <- p;                        // ERROR: can't assign Power to State
```

**An enum is not a number, so arithmetic on it needs the cast** (owner, #1864, 2026-10-25:
"what is the type of EColor.COUNT?"). `EColor.COUNT` is of type `EColor`, and an enum is
"not freely interchangeable with integers". The same holds in a local, a file-scope value
and an array dimension. Only a member of the enum whose member values are being given is
exempt (above).

```cnx
enum EColor { RED, GREEN, COUNT }

u8[EColor.COUNT] lone;                // ALLOWED: no arithmetic
u32 x <- EColor.COUNT + 1;            // ERROR E0925: '+' does not take an enum
u32 y <- (u32)EColor.COUNT + 1;       // ALLOWED: the cast makes it a number
```

### Casting to Integer (for hardware registers)

When you need the integer value for hardware access, use C-style cast:

```cnx
enum SPIMode {
    MODE_0 <- 0,
    MODE_1 <- 1,
    MODE_2 <- 2,
    MODE_3 <- 3
}

// Writing enum value to hardware register
SPI_CR1[3, 2] <- (u8)SPIMode.MODE_2;

// Storing enum as integer
u8 modeValue <- (u8)SPIMode.MODE_1;
```

Enums are always treated as **unsigned integers** when cast:

- Cast to `u8`, `u16`, `u32`, or `u64`
- Value must fit in target type (compile error if too large)
- Negative values are NOT allowed (compile error)

### Scoped Enums

Enums declared inside a scope get the scope prefix:

```cnx
scope Motor {
    public enum State {
        IDLE,
        RUNNING,
        STALLED
    }
}

Motor.State current <- Motor.State.IDLE;
```

Generates:

```c
typedef enum {
    Motor__State__IDLE = 0,
    Motor__State__RUNNING = 1,
    Motor__State__STALLED = 2
} Motor__State;

Motor__State current = Motor__State__IDLE;
```

### Error Messages

Type safety violations produce clear error messages, each at the position of
the construct it is about:

```
error[E0434]: Cannot compare State enum to Power enum
error[E0428]: Cannot assign integer to State enum
error[E0428]: Cannot assign Power enum to State enum
error[E0894]: Negative values not allowed in enum (found -1 in State.FAULT)
```

### Generated C

```cnx
enum State { IDLE, RUNNING, ERROR <- 255 }
State currentState <- State.IDLE;
if (currentState = State.IDLE) { }
u8 val <- (u8)State.ERROR;
```

Generates:

```c
typedef enum {
    State__IDLE = 0,
    State__RUNNING = 1,
    State__ERROR = 255
} State;

State currentState = State__IDLE;
if (currentState == State__IDLE) { }
uint8_t val = (uint8_t)State__ERROR;
```

## Implementation

### Grammar Changes

```antlr
enumDeclaration
    : 'enum' IDENTIFIER '{' enumMember (',' enumMember)* ','? '}'
    ;

enumMember
    : IDENTIFIER ('<-' expression)?
    ;

// Cast expression (for enum to integer)
castExpression
    : '(' type ')' unaryExpression
    ;
```

### Type System

- Register enum types in type registry
- Track enum members and their integer values
- Validate comparisons: same enum type only
- Validate assignments: same enum type only
- Allow explicit cast to unsigned integer types

### Generated C

- Generate typedef enum with prefixed member names
- Handle explicit value assignments with `<-`
- Auto-increment values when not specified (like C)
- Prefix member names: `State.IDLE` → `State__IDLE`

## Consequences

### Positive

- Prevents real bugs (wrong enum type, accidental integer comparison)
- Hardware access still possible via explicit cast
- Matches modern language expectations (TypeScript, C#)
- Still generates standard C enums

### Negative

- Slightly more verbose than C for hardware writes
- Stricter than C (but that's the point!)

## Open Questions (Deferred)

1. Exhaustiveness checking in switch statements? (ADR-025)

## Diagnostics

| Code  | Reported when                                                                                                         | Asserted by                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E0424 | An enum member is written bare where nothing names its enum, or names a different enum                                | `tests/adr-017/unqualified-enum-*.test.cnx`, `tests/adr-017/enum-bare-in-*.test.cnx`                                                                                                       |
| E0428 | A value assigned to an enum-typed target is not of that enum                                                          | `tests/adr-017/enum-error-assign-*.test.cnx`                                                                                                                                               |
| E0434 | The two sides of a comparison are not the same enum type                                                              | `tests/adr-017/enum-error-compare-*.test.cnx`                                                                                                                                              |
| E0894 | An enum member's value is negative, reported at the member                                                            | `tests/enum/enum-error-negative.test.cnx`, `tests/bugs/issue-1531-declaration-rejections/cross-file-enum.test.cnx`, `tests/bugs/issue-1669-enum-member-values/value-negative-hex.test.cnx` |
| E0909 | A member's value is not known at compile time: a variable, a call, a header's name, the member itself or one below it | `tests/bugs/issue-1669-enum-member-values/value-variable.test.cnx`, `value-call.test.cnx`, `value-header-macro.test.cnx`, `value-self-later.test.cnx`                                      |
| E0910 | A member's value is arithmetic that would clamp or wrap (ADR-044)                                                     | `tests/bugs/issue-1669-enum-member-values/value-overflow.test.cnx`                                                                                                                         |
| E0911 | A member's value does not fit `i32`                                                                                   | `tests/bugs/issue-1669-enum-member-values/value-i32-range.test.cnx`                                                                                                                        |
| E0925 | An enum is an operand of an arithmetic, bitwise or shift operator, outside its own enum's member values               | `tests/bugs/issue-1191-non-scalar-operand/enum-member-arithmetic.test.cnx`, `enum-operand.test.cnx`                                                                                        |

A bare member (`RED` for `Color.RED`) is accepted only where the position
already names the enum: a declaration or assignment whose type is the enum, a
return from a function of that type, a struct field or array element of that
type, and a ternary arm in any of those. A comparison operand, a call
argument, a subscript and an array dimension name nothing, and a bare member
there is rejected with the enums that declare it. A member of a DIFFERENT enum
under an enum-typed position is the same mistake and is reported the same way
(#1322 closed that one -- it used to reach the generated C bare). The rule is
decided during analysis, at the member's own position, and every offense in a
file is reported.

## Scope-context matrix

Declared for the enum type-safety rules -- a value assigned to an enum must be
of that enum type, and the two sides of a comparison must be the same enum type.

<!-- MATRIX-SEVERITY code: E0424 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0428 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0434 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

Every cell is `error`, and none of them is an assumption. An enum value is an
EXPRESSION, so it reaches an initializer as well as a function body, which
occupies the two declaration contexts and a `for` header's declaration; and
an enum TYPE crosses an include boundary, so the rule is observable wherever
the enum was declared. Both were probed rather than reasoned about.

The imported columns are the ones worth stating: a checker that consulted only
the file it is looking at finds no enum there, and "no enum" reads as "the rule
does not apply" -- so the rule would go quiet across an include instead of
failing, which is the silence this matrix exists to make visible.

<!-- MATRIX-SEVERITY code: E0894 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0894 fires at an enum member, and an enum is declared at file scope or in a scope, never inside a function, a variable or a `for` header (whose declaration cannot declare an enum: it is a parse error), so no context encloses it.

<!-- MATRIX-SEVERITY code: E0925 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

Every cell is `error`: an enum member is an expression, so an arithmetic operator meets one in a function body, an initializer and a `for` header alike, and the enum's type crosses an include (`tests/adr-017/enum-arithmetic-*.test.cnx`, owner ruling #1864).

<!-- MATRIX-SEVERITY code: E0909 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: ADR-017's E0909 fires at an enum member, which no context encloses (a `for` header's declaration cannot declare an enum: it is a parse error); E0909 in a variable's initializer is ADR-044's, and in an array dimension ADR-036's.

<!-- MATRIX-SEVERITY code: E0910 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: ADR-017's E0910 fires at an enum member, which no context encloses (a `for` header's declaration cannot declare an enum: it is a parse error); E0910 in a variable's initializer is ADR-044's, and in an array dimension ADR-036's.

<!-- MATRIX-SEVERITY code: E0911 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0911 fires at an enum member, and an enum is declared at file scope or in a scope, never inside a function, a variable or a `for` header (whose declaration cannot declare an enum: it is a parse error), so no context encloses it.

## References

- TypeScript enum semantics
- C# enum with explicit casting
- Zig enum type safety
- [Safer Enums in Go](https://threedots.tech/post/safer-enums-in-go/)
