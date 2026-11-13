# ADR-035: Array Initializers

## Status

**Implemented**

## Context

Array initialization is common in embedded:

- Lookup tables
- Default configurations
- ROM data
- Font/image data

C supports brace-enclosed initializers:

```c
int values[] = {1, 2, 3, 4, 5};
```

## Decision Drivers

1. **Lookup Tables** - Sin tables, CRC tables, etc.
2. **Configuration** - Default settings arrays
3. **C Compatibility** - Generate valid initializers
4. **Const Data** - ROM placement

## Decision

**Support array initializers** with cnx assignment syntax. cnx uses square brackets `[]` instead of curly brackets `{}` to avoid confusion between arrays and scopes (functions, loops, etc).

## Syntax

### Basic Initializer

```cnx
u8[5] data <- [1, 2, 3, 4, 5];
```

### Inferred Size

```cnx
u8[] data <- [1, 2, 3, 4, 5];  // Size inferred as 5
```

### Fill-All Initialization

```cnx
u8[100] buffer <- [0*];  // All 100 elements initialized to 0
```

### String Initialization

```cnx
u8[] message <- "Hello";  // Includes null terminator
```

### Read-only Lookup Tables

```cnx
u8[256] sinTable <- [
    0, 3, 6, 9, 12, 15, 18, 21,
    // ... more values
];
```

### Struct Array Initialization

```cnx
struct Command {
    u8 code;
    u8 length;
}

Command[] commands <- [
    { code: 0x01, length: 4 },
    { code: 0x02, length: 8 },
    { code: 0x03, length: 2 },
];
```

### Nested Array Initialization

```cnx
u8[3][3] matrix <- [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
];
```

## Implementation Notes

### Grammar Changes

```antlr
arrayInitializer
    : '[' (expression '*'? | arrayInitializer) (',' (expression '*'? | arrayInitializer))* ','? ']'
    ;

variableDeclaration
    : constModifier? type IDENTIFIER arrayDimension? ('<-' (expression | arrayInitializer))? ';'
    ;
```

### Size Inference

When `[]` used without size, count initializer elements:

```cnx
u8[] data <- [1, 2, 3];  // u8[3] data
```

Only a one-dimensional array may omit its size: `u8[] data <- [1, 2, 3]` is
`u8[3]`. A multi-dimensional array states every dimension. cnx arrays
always have a size, so a `[]` with nothing to count is rejected (E0892): any
dimension of a multi-dimensional array (`u8[][3]`, `u8[2][]`, `u8[][]`), a
one-dimensional array with no initializer (`u8[] buffer;`), and a struct field
(`u8[] payload;`). An array parameter is ADR-036's rule (E0875).

### Generated C

```c
uint8_t data[5] = {1, 2, 3, 4, 5};
const uint8_t sinTable[256] = { 0, 3, 6, ... };
```

### Priority

**Medium** - Useful for lookup tables and configuration.

## MISRA Research

### MISRA C:2023 Rule 9.3: "Arrays shall not be partially initialized"

The rationale is that explicit initialization demonstrates every element was deliberately considered. Exceptions allowed:

| Pattern                      | Allowed? | Reason                        |
| ---------------------------- | -------- | ----------------------------- |
| `int x[3] = {0,1,2}`         | ✅       | All elements explicit         |
| `int z[3] = {0}`             | ✅       | Shorthand for all zeros       |
| `int a[30] = {[1]=1,[15]=1}` | ✅       | Only designated initializers  |
| `char c[20] = "Hello"`       | ✅       | String literal exception      |
| `int y[3] = {0,1}`           | ❌       | Missing final element         |
| `int b[30] = {[1]=1, 1}`     | ❌       | Mixed designated and implicit |

### MISRA C:2023 Rule 9.5: Explicit Size with Designated Initializers

When using designated initializers, array size must be explicit—because adding/removing the highest index can silently change array size.

### C99 Standard: Partial Initialization Zero-Fill

C99 §6.7.8/6.7.9 guarantees: When fewer initializers are provided than array elements, remaining elements are initialized "implicitly the same as objects with static storage duration" (i.e., zero for arithmetic types, NULL for pointers).

```c
int y[5] = {1,2,3};   // y = {1, 2, 3, 0, 0}
int z[4] = {1};       // z = {1, 0, 0, 0}
```

### Common Bugs

| Bug                                    | Description                                    | cnx Mitigation               |
| -------------------------------------- | ---------------------------------------------- | ---------------------------- |
| **Uninitialized elements**             | Relying on implicit zeros without realizing it | Require explicit fill syntax |
| **Size mismatch**                      | Too many/few initializers                      | Compile error                |
| **Designated initializer size change** | Removing `[19]=x` silently shrinks array       | Not supported                |

## cnx Decisions

### 1. Size Mismatch: Compile Error

More initializer elements than array size is a **hard error**:

```cnx
u8[3] data <- [1, 2, 3, 4, 5];  // ERROR: 5 elements for size-3 array
```

### 2. Explicit Fill Syntax: `[value*]`

cnx does NOT support C's implicit zero-fill for partial initialization. Instead, use the explicit fill-all syntax `[value*]`:

```cnx
u8[100] buffer <- [0*];      // All 100 elements initialized to 0
u8[50] ones <- [1*];         // All 50 elements initialized to 1
i32[10] magic <- [0xDEAD*];  // All 10 elements initialized to 0xDEAD
```

The `*` is familiar from bash globs, regex, and other contexts meaning "all" or "any number of".

This is clearer than C's `{0}` which looks like it only initializes the first element but actually zero-fills all.

### 3. No Designated Initializers

cnx does **not** support C99 designated initializers like `[index]=value`. Rationale:

- Violates explicit initialization principle (gaps are implicitly zero-filled)
- Can silently change array size when highest index changes
- Sparse arrays are rare in embedded; explicit full initialization is clearer

### 4. Partial Initialization: Not Allowed

```cnx
u8[5] data <- [1, 2, 3];  // ERROR: 3 elements for size-5 array
```

If you want partial values with zero-fill, be explicit:

```cnx
u8[5] data <- [1, 2, 3, 0, 0];  // OK: all elements explicit
```

## Diagnostics

| Code  | Reported when                                                                                                                                                    | Asserted by                                                                                                                                                                                                                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0866 | An array's initializer is not a list, or a level of it has the wrong number of elements                                                                          | `tests/adr-035/array-init-error.test.cnx`, `tests/adr-035/array-form-error.test.cnx`, `tests/adr-035/array-count-included-error.test.cnx`, `tests/adr-035/array-count-transitive-error.test.cnx`, `tests/adr-035/array-form-included-error.test.cnx`, `tests/adr-035/array-form-transitive-error.test.cnx` |
| E0876 | The fill-all form `[v*]` initializes an array whose size is inferred (`u8[]`)                                                                                    | `tests/adr-035/array-form-error.test.cnx`, `tests/adr-035/array-form-included-error.test.cnx`, `tests/adr-035/array-form-transitive-error.test.cnx`                                                                                                                                                        |
| E0892 | A dimension has no size and nothing to count it from: any dimension of a multi-dimensional array, a one-dimensional array with no initializer, or a struct field | `tests/adr-035/empty-dimension-error.test.cnx`, `tests/adr-035/empty-dimension-included.test.cnx`, `tests/adr-035/array-form-included-error.test.cnx`, `tests/adr-035/array-form-transitive-error.test.cnx`                                                                                                |

The count is checked at every nesting level against the dimension it fills:
`u8[2][2] m <- [[1, 2, 3], [4, 5]]` is rejected on the inner list. Until #1322
only the outer list was counted, and the inner excess reached the generated C.
A string literal is the one non-list initializer accepted, and only for a `u8`
array (see "String Initialization" above); an array initialized from another
array at file scope is rejected, since C has no such initializer and the
generated code did not compile. Inside a function another array is accepted
and copied (see "Arrays Are Values" below). Each rule is decided during analysis, at the initializer's own
position, and every offense in a file is reported.

The same rules hold for an array assigned a whole value (`a <- [1, 2]`), since
ADR-014 makes the list the whole value at an assignment target and at a field
as well (#1782). A scalar, a list of the wrong length, or an array of another
shape there is E0866. These had been emitted as a C array assignment (`a = b;`,
`a = {1U, 2U};`), which C rejects, at exit 0. An accepted list cannot be
assigned in C either, so it fills a temporary of the target's own type, written
as a declaration's initializer is (struct elements designated, and each
fill-all expanded where its size folds), and the temporary is copied element by
element. A fill-all expands to one value per slot at every level of a whole
array's list, at a declaration, a scope member, an assignment target, a field
and an argument (#2110): `[[1*], [2*]]` for a `u32[2][3]` is
`{{1U, 1U, 1U}, {2U, 2U, 2U}}`. A fill-all row had been emitted as C's `{v}`,
which sets only its first slot, so the rest read 0 at exit 0. A fill-all other
than zero needs a size cnx can fold: C has no initializer that repeats a
value for a size it is not told, so `u8[SIZE] a <- [5*]` with `SIZE` a C macro
had set only `a[0]`. It is E0866 at a declaration, a scope member, an assignment
target, a field and an argument (#2196). C zero-fills what an initializer leaves
out, so a zero fill (`[0*]`, `[0x0*]`, `[false*]`, a const that folds to zero,
or `[""*]` for a string array) is right for any size. Every element is
read before any is written, so `pair <- [pair[1], pair[0]]` swaps. A target
whose subscripts call a function is reached through a pointer, so the call is
made once, and a `volatile` (or `atomic`) target keeps its qualifier on that
pointer. A compound operator on a whole array is E0857 (#2193). A list given for
an array parameter is the same whole value (#2157): it is counted the same way
and passed as an array of the parameter's full shape, written where the argument
stands, so `&&`, `||` and `?:` evaluate it only when they evaluate the call. An
array passed there must have the parameter's shape (#2194). Fixtures:
`tests/bugs/issue-1782-whole-array-assignment/`,
`tests/bugs/issue-2157-array-parameter-list/`,
`tests/bugs/issue-2194-array-argument-shape/`,
`tests/bugs/issue-2195-array-row-slot/`,
`tests/bugs/issue-2110-nested-fill-all/`.

### Arrays Are Values (owner ruling, 2026-11-13, #1209)

An array is a value, as a string is. Another array of the same element type
and shape -- a variable, a parameter, a field, a call to a function that
returns one -- is accepted where a whole array's list is: a declaration
inside a function, an assignment target (a field's among them) and an argument.
A struct initializer's array field still takes a list (#2411). C has no
array assignment, so it is copied element by element, the lowering a list
already gets; a declaration copied into is not `const` in C, since the copy is
written after it. An array of another shape or element type is E0866. At file
scope, and for an inferred size (`u8[]`), only a list or a literal is
accepted: a copy is a statement, and file scope has none to run before `main`.

C cannot return an array either, so a function that returns one takes a
buffer from its caller, the lowering ADR-045 gives `string<N>` (#1209):

```cnx
u8[4] make() {
    u8[4] a <- [1, 2, 3, 4];
    return a;
}
u32 main() {
    u8[4] x <- make();
    u8 second <- make()[1];
}
```

```c
void make(uint8_t cnx_return[4]) {
    const uint8_t a[4] = {1U, 2U, 3U, 4U};
    for (uint32_t cnx_tmp0 = 0U; cnx_tmp0 < 4U; cnx_tmp0++) {
        cnx_return[cnx_tmp0] = a[cnx_tmp0];
    }
    return;
}
```

The caller's buffer outlives the call, so returning a local is safe. A
declaration of the return type is filled in place (`make(x);`), as ADR-045's
string return is. Any other call fills a temporary of the declared return
type, which an assignment and an argument copy from or pass, and an element
read (`make()[1]`) indexes. `make()[1]` had read a bit of the call's result, and the
function had returned a pointer as a `uint8_t`. Fixtures:
`tests/bugs/issue-1209-string-array-return/`.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY code: E0866 -->

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
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: a for header declares one scalar loop variable, so an array declared there
is ADR-036's E0917 alone, in a file that includes others too; a scalar given a
list there is #2305.

<!-- MATRIX-SEVERITY code: E0876 -->

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
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: a for header declares one scalar loop variable, so an array declared there
is ADR-036's E0917 alone, in a file that includes others too; a scalar given a
list there is #2305.

<!-- MATRIX-SEVERITY code: E0892 -->

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
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: a for header declares one scalar loop variable, so an array declared there
is ADR-036's E0917 alone, in a file that includes others too; a scalar given a
list there is #2305.

Each code has its own table (#1620). An initializer sits on a declaration,
which stands in every context. A for header's declaration is one scalar loop
variable, where an array is E0917, so every context but a for header is `error`
for each code. Each rule is decided at the declaration's own position, and that declaration can use
an included file's names -- a const dimension, an array -- so each code fires in
a file that includes others as it does in a single file, and the imported cells
are `error` too (`array-form-included-error`, `array-count-included-error` and
their `-transitive` pair).

These tables cover a declaration's initializer. A whole array is also taken at a
field, at an assignment target, and at a parameter, and the rules above apply
at each as they do here: one element per slot at every level, and a row's slot
is a list too (#2195), so a plain fill-all of an array of rows (`u8[4][4] g <- [0*]`)
is E0866 and each row takes its own (`[[0*], [0*], [0*], [0*]]`) until ADR-036's
`[0*][4*]` parses (#2206). At a field and an assignment target this is #1782's. At a
parameter (#2157) a list is passed as an array of the parameter's full shape,
written where the argument stands so `&&`, `||` and `?:` evaluate it only when
they evaluate the call; a scalar, a struct initializer or a C macro is E0866, and a callback's
parameter (ADR-029) is the named function's. An array
argument is passed by reference and must have the parameter's shape wherever
both sizes fold (#2194), since the callee reads it with that shape. Whether a
field or a parameter is an array is read from its struct or function, which an
include can declare. Those positions are ADR-014's rule, and
their imported cells are ADR-014's to declare and occupy (#1760 review,
2026-09-28).

## References

- [MISRA C:2023 Rule 9.3 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule9.3.html)
- [MISRA C:2023 Rule 9.5 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule9.5.html)
- [V2540 MISRA Arrays Partial Initialization - PVS-Studio](https://pvs-studio.com/en/docs/warnings/v2540/)
- [C Array Initialization - cppreference.com](https://en.cppreference.com/w/c/language/array_initialization)
- C99 Standard §6.7.8, §6.7.9
