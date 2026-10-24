# ADR-014: Structs

**Status:** Implemented
**Date:** 2025-12-28
**Decision Makers:** cnx Language Design Team

## Context

cnx needs a way to group related data fields together. This is the foundation for:

- Complex data types (point, vector, configuration)
- Register layouts with multiple fields
- The `class` feature (ADR-005) which adds methods to structs

C already has `struct`, and cnx should provide an equivalent with:

- Same semantics as C structs
- Fixed-width types (`u8`, `u32`, etc.)
- Integration with null state semantics (ADR-015)

## Decision

### Struct Syntax

```cnx
struct Point {
    i32 x;
    i32 y;
}

struct UARTConfig {
    u32 baudRate;
    u8 dataBits;
    u8 stopBits;
    u8 parity;
}
```

A field may carry an overflow modifier (`wrap u8 checksum;`). Its meaning and
default are [ADR-044](adr-044-primitive-types.md#struct-fields-and-array-elements)'s,
not restated here.

### Declaration and Initialization

```cnx
// Declaration (zero-initialized per ADR-015)
Point origin;
UARTConfig config;

// Initialization in init()
void init() {
    origin <- { x: 0, y: 0 };
    config <- {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 0
    };
}
```

### Inline Initialization (for read-only structs)

```cnx
Point ORIGIN <- { x: 0, y: 0 };
```

### Member Access

```cnx
i32 xVal <- origin.x;
origin.x <- 100;
```

### Pass by Reference (per ADR-006)

A `mut` parameter is passed by reference, including a primitive, so its
argument must be a variable, a field or an element: a literal is E0915
(ADR-006). A read-only parameter is passed by value (ADR-071) and accepts a
literal, though named values remain the recommended style (ruling on #1203):

```cnx
void movePoint(mut Point p, i32 dx, i32 dy) {
    p.x +<- dx;
    p.y +<- dy;
}

// Usage
i32 MOVE_X <- 10;
i32 MOVE_Y <- 20;
movePoint(origin, MOVE_X, MOVE_Y);  // origin is modified
movePoint(origin, 10, 20);          // valid: dx and dy are read-only
```

### Transpilation

```cnx
struct Point {
    i32 x;
    i32 y;
}

Point p;
p <- { x: 10, y: 20 };
```

Generates:

```c
typedef struct {
    int32_t x;
    int32_t y;
} Point;

Point p = {0};

// In function:
p = (Point){ .x = 10, .y = 20 };
```

## What Structs Do NOT Have

| Feature                   | Rationale                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Methods                   | Use `namespace` (ADR-002) for singleton services, `class` (ADR-005) for multiple instances |
| Constructors              | Use `class` or inline initialization                                                       |
| Visibility modifiers      | All fields are public (use `class` for encapsulation)                                      |
| Inheritance               | Not in cnx                                                                                 |
| Nested struct definitions | Define separately, compose by field                                                        |

## Design Decisions

### All Fields Public

Structs are pure data containers. For behavior, use `namespace` or `class`:

```cnx
// Struct: public data, no behavior
struct Point {
    i32 x;
    i32 y;
}

// Namespace: singleton service with behavior (ADR-002)
namespace PointUtils {
    public void move(Point p, i32 dx, i32 dy) {
        p.x +<- dx;
        p.y +<- dy;
    }
}

// Class: multiple instances with encapsulated behavior (ADR-005)
class Circle {
    i32 centerX;    // private by default
    i32 centerY;
    u32 radius;

    public Circle(i32 x, i32 y, u32 r) { ... }
    public u32 area() { ... }
}
```

### Named Field Initialization

Use `{ field: value }` syntax (like Rust, Go, TypeScript):

```cnx
Point p <- { x: 10, y: 20 };
```

The type is **not** repeated, and there is no syntax for repeating it. It is
already declared to the left, and every position that declares a type behaves
the same way: a variable's declaration, an assignment target, a field of an
enclosing initializer, a call argument, and a `return` statement.

```cnx
// NOT SYNTAX -- `Point { ... }` does not parse
Point p <- Point { x: 10, y: 20 };
```

**This was a grammar alternative until #1322, and removing it followed from
having no position left where it was useful.** It was rejected as redundant in
every position that consumes a value, since all of them declare a type; the one
place it parsed was a bare expression statement, where it built a compound
literal and discarded it. A form legal only where it does nothing is not a form
the language offers, so the alternative is gone and the diagnostic that rejected
it (E0356) is retired rather than reassigned.

**Literals are allowed** in struct initializers because initialization is not a function call — no pass-by-reference occurs. This is the same as `u8 flags <- 44;`.

Not positional (error-prone with many fields):

```cnx
// NOT SUPPORTED
Point p <- Point(10, 20);
```

### Zero Initialization by Default

Per ADR-015, uninitialized structs are zero-initialized:

```cnx
Point p;  // p.x = 0, p.y = 0
```

This is explicit in generated C:

```c
Point p = {0};
```

## Relationship to Namespaces and Classes

| Feature     | Struct         | Namespace         | Class              |
| ----------- | -------------- | ----------------- | ------------------ |
| Fields      | Yes            | Yes               | Yes                |
| Methods     | No             | Yes               | Yes                |
| Constructor | No             | No                | Yes                |
| Visibility  | All public     | Private default   | Private default    |
| Instances   | N/A            | Singleton         | Multiple           |
| Use case    | Data container | Singleton service | Multiple instances |

### When to Use Each

| Scenario                                       | Use                                 |
| ---------------------------------------------- | ----------------------------------- |
| Group related data fields                      | `struct`                            |
| Singleton service (LED, Console, ErrorHandler) | `namespace`                         |
| Multiple instances (UART1, UART2, UART3)       | `class`                             |
| Data + behavior, only one exists               | `namespace` with `struct` parameter |
| Data + behavior, multiple exist                | `class`                             |

### Examples

```cnx
// Struct: just data
struct Point { i32 x; i32 y; }

// Namespace: singleton service operating on data
namespace LED {
    public void on() { ... }
    public void off() { ... }
}

// Class: multiple instances with their own data
class UART {
    u32 baseAddress;
    public UART(u32 base) { ... }
    public void send(u8* data, u32 len) { ... }
}
```

## Examples

### Simple Data Types

```cnx
struct Vector3 {
    f32 x;
    f32 y;
    f32 z;
}

struct Color {
    u8 r;
    u8 g;
    u8 b;
    u8 a;
}
```

### Configuration Structures

```cnx
struct SPIConfig {
    u32 clockSpeed;
    u8 mode;
    u8 bitOrder;
}

struct I2CConfig {
    u32 clockSpeed;
    u8 address;
}
```

### Composition

```cnx
struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

Rectangle r <- {
    topLeft: { x: 0, y: 0 },
    bottomRight: { x: 100, y: 50 }
};
```

## Diagnostics

| Code      | Reported when                                                                                                                                                                                                       | Asserted by                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| ~~E0356~~ | _Retired._ Was: a struct initializer writes a type where the position already declares one. The syntax it rejected is removed, so it is a parse error — `tests/adr-014/struct-written-type-rejected-error.test.cnx` |                                                                               |
| E0357     | A struct initializer writes no type and stands where no position declares one                                                                                                                                       | `tests/adr-014/struct-no-type-error.test.cnx`                                 |
| E0358     | A struct initializer stands where the position gives a type that is not a struct: a primitive, a string, a bitmap, an enum, a function type, or a C header's scalar, pointer or function pointer                    | `tests/bugs/issue-1802-struct-initializer-target/non-struct-targets.test.cnx` |
| E0508     | A C++ class with a constructor is initialized where no statement can follow it                                                                                                                                      | `tests/external-types/cpp-class-scope-member-error.test.cnx`                  |

A struct literal has no type of its own, and the position it stands in gives it
one. The positions that do are a variable's declaration (including a `for`
header's), an assignment target, a field of an enclosing initializer, a call
argument, and a `return` statement, whose type is the enclosing function's
declared return type. Repeating the type in any of them is an error.

Every position that carries a value is on that list, so the written form
`Point { x: 1 }` is left legal only where nothing consumes it -- a bare
expression statement. E0357's help therefore does not offer "write the type" as
a remedy: it would name the other error.

**Only a struct takes `{ field: value }`.** Where the position gives a type
that is not a struct, the initializer is E0358. That covers a primitive, a
string, a bitmap, an enum, an ADR-029 function type, and a C header's scalar,
pointer or function pointer. A header's struct and union take it, including a
typedef whose struct is named by its tag. That holds in every position on the
list above, and for an element of an array's list, which is typed by the
element. An array's whole initializer is ADR-035's list (E0866), wherever a
whole array is taken: a declaration, a field, an assignment target, and a
parameter (#1760 review, 2026-09-28). A bitmap's
value is its backing integer (ADR-034), wherever it is written. Owner ruling,
2026-09-28: _"a bitmap should be defined the exact same way it is anywhere else,
being inside a struct changes nothing"_. The brace form had emitted a designated
initializer on a scalar, which C rejects.

All three are decided during analysis, at the initializer's own position, and
every offense in a file is reported.

**E0508 is the one place this syntax depends on the target language.** A C++
class with a user-defined constructor is not an aggregate, so the initializer
cannot be a single expression: the fields are assigned one at a time, and
assignments are statements. A declaration outside a function body has no
statement position after it, and that is true of a **scope member** as much as
of a global -- a scope member becomes a file-scope definition. So the rule is
about where the initializer stands, not about what it initializes, which is why
it lives beside E0357 rather than with the interop decisions.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0357 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0358 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0508 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | warn     |
| for header         | imported direct     | warn     |
| for header         | imported transitive | warn     |

off: E0508 only fires outside a function body; inside a function or a method the fields are assigned as statements.

warn: a `for` header's declaration has no statement position after it either, so E0508 should fire there; it does not (#2304). Since #1534 the fields are not lost: the object is built as a temporary before the loop and the loop variable is initialized from it.

E0357 is decided entirely within the file that writes the initializer, because
whether the position supplies a type is a question about the initializer's own
ancestors. E0358 asks which type the position supplies, and that type can be
declared in an included file: the imported cells exist because of it. They
record a bitmap declared one include away and two includes away, each written
with braces in all four contexts beside a struct initializer that stays silent
(`tests/adr-014/struct-init-non-struct-direct-error.test.cnx`,
`tests/adr-014/struct-init-non-struct-transitive-error.test.cnx`). Until #1802
these cells were `off`, recorded as unable to exist.

A `for` header's declaration gives its variable a type, so both codes fire
inside it as they do in a function body: a subscript in the initializer
supplies no type (E0357), and a `u32` or bitmap variable is not a struct
(E0358). Its cells record that with the struct and the bitmap in the same file,
one include away and two includes away, each beside a struct variable and a
bitmap given its integer that stay silent
(`tests/adr-014/struct-init-for-header-same-file-error.test.cnx`,
`tests/adr-014/struct-init-for-header-direct-error.test.cnx`,
`tests/adr-014/struct-init-for-header-transitive-error.test.cnx`).

## Implementation Notes

### Grammar Changes

Add to `Cnx.g4`:

```antlr
structDeclaration
    : 'struct' IDENTIFIER '{' structMember* '}'
    ;

structMember
    : overflowModifier? type IDENTIFIER arrayDimension* ';'   // modifier: ADR-044
    ;

structInitializer
    : typeName '{' (fieldInitializer (',' fieldInitializer)*)? '}'
    ;

fieldInitializer
    : IDENTIFIER ':' expression
    ;
```

### Code Generator Changes

1. Generate `typedef struct { ... } Name;` for struct declarations
2. Generate `= {0}` for uninitialized struct variables
3. Generate `(Type){ .field = value }` for struct initializers
4. Handle struct member access with `.`
5. Issue #517 / #1534: in C++, a struct initializer for a class with a
   user-declared constructor cannot be an aggregate initializer (C++20 §9.4.2,
   aggregates). The object is constructed with `= {}` and each field is
   assigned to it after. A declaration fills its own object. Anywhere else
   (an assignment, an argument, a return, an array element, a field) the
   object is built as a temporary before the statement, and that temporary
   is the value. Issue #2332: a temporary built inside an operand that runs
   only sometimes -- the right of `&&` or `||`, an arm of `?:` -- is built
   only when that operand runs (C11 §6.5.13-§6.5.15). The left side becomes a
   `bool` the operand's `if` tests, and a ternary's value a variable each
   branch sets; a `string<N>` field's temporary (#2236) is built the same way.
   2.2 decides which operands these are, and only an operand holding such an
   initializer is lowered; any other temporary (a float bit read, #2157's
   typedef) is still written before the statement. This holds where a
   statement's temporaries come before it: a declaration, an assignment, a
   `return`, an argument. A loop's condition cannot hold such an initializer,
   because E0702 rejects the call it needs. An `else if` condition still
   puts its temporary in the wrong place (#2340).

## References

- ADR-002: Namespaces (singleton services with behavior)
- ADR-005: Classes Without Inheritance (multiple instances with behavior)
- ADR-006: Simplified References (structs passed by reference)
- ADR-015: Null State / Zero Initialization (default struct values)
