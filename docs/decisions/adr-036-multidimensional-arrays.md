# ADR-036: Multi-dimensional Arrays

## Status

**Implemented**

## Context

Multi-dimensional arrays are used for:

- Matrices (graphics, transforms)
- 2D sensor data
- Lookup tables with multiple indices
- Display buffers

## Decision Drivers

1. **Graphics** - Transformation matrices
2. **Display** - Framebuffers, character buffers
3. **Tables** - 2D lookup tables
4. **C Compatibility** - Row-major layout
5. **Safety** - Bounds checking and type enforcement

## Recommended Decision

**Support multi-dimensional arrays** with compile-time safety guarantees exceeding standard C.

### Dimension Range

Every dimension's value is at least 1 (#1874). C (C99 6.7.5.2p1) gives an array
of zero or fewer elements no meaning, and ISO C and MISRA have no `[0]`. A
dimension below 1 is E0913 at the dimension, whatever produced the value: a
literal (`u8[0]`), folded arithmetic (`u8[1 - 2]`), a negative const, or a
header macro's value cnx reads (`onSample[N_HANDLERS - 5]`). This holds at
file scope, for a local, a struct field and a parameter.

## Syntax

### 2D Arrays

```cnx
mut u8[24][80] display; // 24 rows, 80 columns

display[0][0] <- 'H';
display[0][1] <- 'i';
```

### 3D Arrays

```cnx
u8[16][16][16] voxels;

voxels[x][y][z] <- material;
```

### Matrices

```cnx
mut f32[4][4] transform;

// Identity matrix
transform[0][0] <- 1.0;
transform[1][1] <- 1.0;
transform[2][2] <- 1.0;
transform[3][3] <- 1.0;
```

### With Initialization (ADR-035 Syntax)

Per ADR-035, array initializers use square brackets `[]`, not curly braces:

```cnx
u8[128][8] font <- [
    [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],  // ' '
    [0x18, 0x3C, 0x3C, 0x18, 0x18, 0x00, 0x18, 0x00],  // '!'
    // ... more character data
];
```

### Fill-All Syntax for Multi-dimensional

Extending ADR-035's `[value*]` syntax:

```cnx
u8[4][4] matrix <- [0*][4*];     // All 16 elements = 0
                                 // Read as: 4 rows, each filled with [0*]

i32[3][3][3] cube <- [0*][3*][3*];  // All 27 elements = 0

// Fill with non-zero values
u8[24][80] screen <- [' '*][80*];   // All spaces (ASCII 32)
```

### In Struct

```cnx
struct Image {
    u32 width;
    u32 height;
    u8[240][320] pixels;  // 320x240 display
}
```

### As Function Parameter (Size Enforced)

```cnx
void matrixMultiply(f32[4][4] a, f32[4][4] b, f32[4][4] result) {
    // All dimensions enforced at compile time
    // Unlike C, you cannot pass a [3][3] matrix here
}
```

## Type System Design

### Nested Types

Multi-dimensional array indexing produces nested array types:

```cnx
u8[8][8][8] matrix;

// Type of matrix[1] is u8[8][8]
// Type of matrix[1][2] is u8[8]
// Type of matrix[1][2][3] is u8

u8[8][8] row <- matrix[0];      // Copy first "plane"
u8[8] column <- matrix[0][0];   // Copy first row of first plane
u8 value <- matrix[0][0][0];    // Single element
```

### Length Properties

Each dimension's length is a compile-time constant, read through the length
properties in [ADR-058](adr-058-explicit-length-properties.md). This ADR defines none.

### Function Parameters: Strict Enforcement

Unlike C (where array sizes in parameters are advisory), cnx enforces dimensions at compile time:

```cnx
void process4x4(f32[4][4] matrix) {
    // Both dimensions are 4, known at compile time
}

f32[3][3] small;
f32[4][4] correct;

process4x4(correct);  // OK
process4x4(small);    // COMPILE ERROR: expected [4][4], got [3][3]
```

This prevents the entire class of "array decay" bugs that plague C.

## Implementation Notes

### Grammar Changes

```antlr
arrayDimension
    : '[' expression? ']' ('[' expression? ']')*
    ;

// Fill-all for multi-dimensional
arrayInitializer
    : '[' expression '*' ']' ('[' INTEGER_LITERAL '*' ']')*  // Fill-all
    | '[' (expression | arrayInitializer) (',' (expression | arrayInitializer))* ','? ']'
    ;
```

### Memory Layout

cnx uses **row-major** order (same as C):

- `arr[i][j]` = `arr + i * cols + j`
- Last index varies fastest in memory

This is the only sensible choice for C compatibility.

### Generated C

Direct mapping to C with size enforcement:

```c
// cnx input
void process(u8[4][4] data) { }

// Generated C - preserve array notation for safety
void process(uint8_t data[4][4]) {
    // Or: void process(uint8_t (*data)[4])
    // With static analysis metadata
}
```

### Priority

**Medium** - Useful but many embedded apps don't need.

### Research Note: A Whole Array in a `for` Clause (#1782, 2026-10-19)

#1823 keeps a `for` header to scalars: an array or a string declared there is E0917. An
assignment in a `for` clause that takes a whole array, `for (u32 i <- 0; i < 2; pair <- src)`
or `pair <- [1, 2]`, reached C as `pair = src` / `pair = {1U, 2U}`, which gcc and g++ reject.
ADR-014 lowers a whole-array assignment to an element-by-element copy, a block a `for` clause
cannot hold, so the same E0917 now reports a whole-array target in a `for` init or update
clause; an element write such as `pair[0] <- 1` stays legal there. This note records the
lowering; the Status and Decision above are unchanged.

## MISRA C Research

### Relevant MISRA C:2012 Rules

| Rule     | Category | Description                                      | cnx Mitigation                                |
| -------- | -------- | ------------------------------------------------ | --------------------------------------------- |
| **9.2**  | Required | Initializers shall be enclosed in braces         | Enforced: nested `[]` required                |
| **17.5** | Advisory | Array parameters should have bounds specified    | Enforced: bounds always specified and checked |
| **18.1** | Required | Pointer arithmetic must stay within array bounds | Compile-time bounds checking                  |
| **1.3**  | Required | No undefined behavior                            | Bounds checks eliminate UB from array access  |

### Rule 9.2: Brace Enclosure for Multi-dimensional

MISRA requires each row's initializers to be enclosed in braces:

```c
// MISRA Compliant
int x[4][2] = {{0,0}, {1,0}, {0,1}, {1,1}};

// MISRA Non-Compliant (missing inner braces)
int w[4][2] = {0, 0, 1, 0, 0, 1, 1, 1};
```

cnx enforces this with `[]` syntax - each dimension requires its own brackets.

### Rule 17.5: Array Parameter Bounds

MISRA advises specifying array bounds in function parameters to enable static analysis. cnx makes this **mandatory and enforced**.

### Rule 18.1: Pointer Arithmetic Within Bounds

MISRA requires pointer arithmetic to stay within the originating array. cnx achieves this through:

- Compile-time bounds checking for constant indices
- Runtime bounds checking for variable indices (optional, enabled by default)
- Length properties (ADR-058) eliminate manual size tracking

## Security Research: CWE Vulnerabilities

### CWE-125: Out-of-bounds Read

"The product reads data past the end, or before the beginning, of the intended buffer."

**Consequences:**

- Information disclosure (cryptographic keys, PII, memory addresses)
- ASLR bypass through memory address leaks
- Denial of service via segmentation faults
- The 2024 CrowdStrike outage was caused by CWE-125

**cnx Mitigation:** Compile-time and runtime bounds checking prevents all out-of-bounds reads.

### CWE-787: Out-of-bounds Write

"The product writes data past the end, or before the beginning, of the intended buffer."

**Consequences:**

- Arbitrary code execution
- Data corruption
- Stack smashing attacks
- Control flow hijacking

**cnx Mitigation:** Same bounds checking prevents out-of-bounds writes.

### CWE-119: Improper Restriction of Operations within Bounds

Parent category covering all buffer access issues.

**cnx Mitigation:** Comprehensive bounds enforcement addresses the entire category.

## Common Bug Patterns

### Bug 1: Array Decay in Function Parameters (SEI CERT ARR01-C)

**The Problem:**

```c
void clear(int array[]) {
    // sizeof(array) returns pointer size (4 or 8), NOT array size!
    for (size_t i = 0; i < sizeof(array) / sizeof(array[0]); i++) {
        array[i] = 0;
    }
}

int data[100];
clear(data);  // Only clears 1-2 elements!
```

**Why This Happens:**
In C, array parameters "decay" to pointers. The size information is lost. This affects multi-dimensional arrays too:

```c
void process(int matrix[4][4]) {
    // sizeof(matrix) is still pointer size!
    // Only the innermost dimension is preserved
}
```

**cnx Solution:**

- Array lengths (ADR-058) are resolved at compile time, never at runtime
- Array parameters retain their full type including all dimensions
- Transpiler generates size constants, not runtime calculations

### Bug 2: Loop Index/Dimension Mismatch (SEI CERT ARR30-C)

**The Problem:**

```c
#define ROWS 10
#define COLS 5

int matrix[ROWS][COLS];

// WRONG: swapped loop limits
for (size_t i = 0; i < COLS; i++) {     // Should be ROWS
    for (size_t j = 0; j < ROWS; j++) { // Should be COLS
        matrix[i][j] = 0;  // Out-of-bounds when i >= 5
    }
}
```

**cnx Solution:**

Bound each loop by its own dimension's length property (ADR-058). Each bound is
read from the array, so the two cannot be swapped.

### Bug 3: Negative Index (SEI CERT ARR30-C)

**The Problem:**

```c
int *table = ...;
int len = ...;

int get(int index) {
    if (index < len) {  // Missing: index >= 0 check!
        return table[index];  // UB if index < 0
    }
    return -1;
}
```

**cnx Solution:**

- Use `usize` for indices (unsigned, cannot be negative)
- Runtime bounds checking catches any remaining issues

### Bug 4: sizeof on Pointer Parameter

**The Problem:**

```c
void clear(int a[100]) {
    memset(a, 0, sizeof(a));  // WRONG: sizeof(int*), not sizeof(int[100])
}
```

Even when you specify the size in the parameter declaration, C ignores it and treats the parameter as a pointer.

**cnx Solution:**
An array parameter keeps every dimension, so its length properties (ADR-058) are compile-time constants rather than a measurement of a decayed pointer. This extends to multi-dimensional arrays.

### Bug 5: Blaster Worm Pattern (Unbounded Loop)

**The Problem:**
The Blaster worm exploited this exact pattern:

```c
while (*pwszTemp != L'\\')
    *pwszServerName++ = *pwszTemp++;  // No bounds check!
```

**cnx Solution:**

- All array access is bounds-checked
- Loop patterns with array indexing generate bounds checks

## Bounds Checking Strategy

### Compile-Time Checking (Always)

- Constant indices checked at compile time
- Dimension mismatches in function calls are compile errors
- Length properties (ADR-058) resolved to constants

### Runtime Checking (Default, Optional)

For variable indices, generate bounds checks:

```cnx
u8[10][10] matrix;
u8 value <- matrix[x][y];  // x and y are variables
```

Generated C (with bounds checking):

```c
uint8_t matrix[10][10];
// Bounds check macro/inline function
if (x >= 10 || y >= 10) {
    cnx_bounds_error(__FILE__, __LINE__, x, y, 10, 10);
}
uint8_t value = matrix[x][y];
```

Compiler flags:

- `--bounds-check` (default): Generate runtime checks
- `--no-bounds-check`: Omit for release builds (user's responsibility)
- `--bounds-panic`: Abort on violation (development)
- `--bounds-clamp`: Clamp to valid range (safety-critical)

## Diagnostics

| Code  | Reported when                                                                                                                 | Asserted by                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| E0854 | A constant index is negative or not below the dimension it indexes, read or written                                           | `tests/adr-036/bounds-error.test.cnx`, `tests/adr-036/array-bounds-uncovered-arms-error.test.cnx`                                 |
| E0874 | A variable declaration or a parameter puts a dimension after the name (`u8 arr[4]`)                                           | `tests/adr-036/c-style-error.test.cnx`, `tests/adr-036/c-style-trailing-bracket-rejected.test.cnx`                                |
| E0875 | A parameter's array type leaves a dimension unbounded (`u8[] data`)                                                           | `tests/adr-036/array-shape-uncovered-arms-error.test.cnx`                                                                         |
| E0909 | A dimension is not known at compile time -- a variable or a parameter, since cnx has no variable-length arrays (ADR-023)      | `tests/bugs/issue-1175-constant-dimensions/variable-dimension-local.test.cnx`, `variable-dimension-global.test.cnx`               |
| E0910 | A dimension is arithmetic that would clamp or wrap (ADR-044)                                                                  | `tests/bugs/issue-1175-constant-dimensions/overflow-dimension.test.cnx`                                                           |
| E0917 | A `for` header declares an array, in either spelling (`u8[3] v`, `u32 c[2]`) or through a header typedef, or a string (#1823) | `tests/adr-036/for-header-array-error.test.cnx`, `tests/adr-036/for-header-typedef-array-error.test.cnx`, and their `--cpp` twins |

The bound is the dimension the subscript indexes: `grid[i][9]` is checked
against `grid[i]`'s shape. A field of a struct is bounded like a variable
(`s.data[9]` with `u8[4] data`); until #1322 only the root variable's
dimensions were consulted, so a struct field was never checked. A runtime
index, a dimension sized by a C macro, and a two-expression subscript (a slice
or bit range, ADR-007) are not checked here.

The C-style form is rejected on a variable declaration and on a parameter --
the two places it was rejected before #1322. A scope member and a struct
member still accept it: thirty-one fixtures use it there, so closing it is a
language change for the ADR's owner to decide, and it is recorded rather than
silently widened.

A `for` header declares one scalar loop variable, so an array declared there
is E0917 in either spelling: `for (u8[3] v <- [1, 2, 3]; ...)` and
`for (u32 c[2]; ...)` alike. The array is declared before the loop instead
(owner ruling on #1823, 2026-09-30). Until #1823 both forms transpiled and the
prefix form was emitted as a scalar, `uint8_t v = {1U, 2U, 3U}`; no fixture or
example declared an array there, against 85 scalar loop variables.

A string is a `char` array in C, so it is not a scalar loop variable either:
`for (string<8> s <- "ab"; ...)` and the unsized `for (string t <- "ab"; ...)`
are E0917 too (owner ruling on #1823, 2026-10-18). Until then the string was
emitted as a scalar `const char s = "ab"`.

A header typedef can name an array (`typedef uint8_t Buf[4];`), so
`for (mut Buf b; ...)` declares an array as surely as `u8[4] b` does, and it is
E0917 as well. Pass 1.2 cannot see through the typedef, so pass 2.1 reports it
from the header's symbols
(`tests/adr-036/for-header-typedef-array-error.test.cnx`). Until then it
transpiled at exit 0 to `for (Buf b; ...)`.

Which declarations ADR-035's and ADR-036's declaration rules judge is decided
once, by one walk that pass 1.2 and pass 2.1 share (#2073), and a `for`
header's declaration is judged by E0917 alone.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | same file               | off      |
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

off: this table is occupied only by provenance, which carries a line and no
column, and only a position with a column lands in a for header; E0917's table
holds that cell.

<!-- MATRIX-SEVERITY code: E0854 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | same file               | error    |
| for header         | imported direct         | error    |
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

<!-- MATRIX-SEVERITY code: E0874 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0874 rejects a C-style dimension after the name as it is parsed, so it cannot occupy one; its cross-file case is the provider side.

off: a scope member still accepts the C-style form (below).
off: a for header's declaration, wherever its names are declared, is judged
by E0917 alone.

<!-- MATRIX-SEVERITY code: E0875 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0875 rejects an unbounded parameter dimension as it is parsed, so it cannot occupy one; its cross-file case is the provider side.

off: E0875 judges a parameter, which only a function or a scope method has;
an unbounded global or member is ADR-035's E0892.
off: a for header's declaration, wherever its names are declared, is judged
by E0917 alone.

<!-- MATRIX-SEVERITY code: E0909 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | same file               | error    |
| for header         | imported direct         | error    |
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

A for header's declaration reaches E0909 through a cast's array type,
`for (u32 a <- (u8[count]) n; ...)`, since an array loop variable is E0917;
that such a cast is accepted at all is #2306.

<!-- MATRIX-SEVERITY code: E0910 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| scope member       | imported direct         | error    |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| for header         | same file               | error    |
| for header         | imported direct         | error    |
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

A for header's declaration reaches E0910 through a cast's array type,
`for (u32 b <- (u8[A + A]) n; ...)`, since an array loop variable is E0917;
that such a cast is accepted at all is #2306.

<!-- MATRIX-SEVERITY code: E0917 -->

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
| for header         | same file               | error    |
| for header         | imported direct         | error    |
| for header         | imported transitive     | error    |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | warn     |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | warn     |

off: a `for` loop stands only in a function or a scope method body.

A subscript is an expression, so it reaches an initializer as well as a
function body; a C-style declaration stands at file scope; both occupy the
four same-file cells. The bound of an array declared in an included file is
read from that declaration, which the `imported direct` top-level cell asserts
(`tests/bugs/issue-1360-read-path-bounds/cross-file-macro-dimension`).

The other imported cells were `off` until #1175, which recorded that no fixture
yet reached them -- an obligation, not a claim that they cannot exist. #1175
meets it. A dimension must be a constant expression in every context, whatever
file the names it uses are declared in: a dimension naming a variable from an
included file is rejected where it is written, and one naming a const from it
folds to that const's value. `tests/bugs/issue-1175-constant-dimensions/`
occupies each imported cell, one and two includes away, in all four contexts.

A `for` header is a context of its own (#1646): it rejected nothing that a
block-scope declaration rejects, and the prefix form was miscompiled there.
Every array or string declared in one is E0917, so the `for header / same file`
cell is `error`, occupied by `tests/adr-036/for-header-array-error.test.cnx` and
its `--cpp` twin. Its imported cells stay `off`: an imported cell is a `.cnx`
declaration reached across a `.cnx` include, and a `for` header declares
nothing another file can reach. A header typedef that names an array is read
from a C header, which the matrix does not count as an import.

## Open Questions

1. ~~Row-major vs column-major?~~ **Decided: Row-major (C compatible)**
2. ~~Bounds checking?~~ **Decided: Compile-time always, runtime by default**
3. Slicing syntax? `matrix[0]` returns `u8[cols]` - is this sufficient?
4. Should `--bounds-clamp` be an option, or is panic-only safer?

## References

### MISRA C Standards

- [MISRA C:2012 Rule 9.2 - Brace Enclosure](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule9.2.html)
- [MISRA C:2012 Pointer Rules - AdaCore Analysis](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)

### SEI CERT C Coding Standard

- [ARR30-C: Do not form or use out-of-bounds pointers](https://wiki.sei.cmu.edu/confluence/display/c/ARR30-C.+Do+not+form+or+use+out-of-bounds+pointers+or+array+subscripts)
- [ARR01-C: Do not apply sizeof to pointer when taking array size](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array)

### CWE (Common Weakness Enumeration)

- [CWE-125: Out-of-bounds Read](https://cwe.mitre.org/data/definitions/125.html)
- [CWE-787: Out-of-bounds Write](https://cwe.mitre.org/data/definitions/787.html)
- [CWE-119: Improper Restriction of Operations within Bounds](https://cwe.mitre.org/data/definitions/119.html)

### Bounds Checking

A constant subscript is checked at compile time, and the rule is one decision applied at
every position a subscript can appear — not a check repeated per position. That
distinction is the whole content of #1360: while only the assignment positions asked the
question, `arr[9] <- 1` was rejected and `u8 x <- arr[9]` compiled and exited 0, which
contradicted this ADR's own CWE-125 mitigation claim. A rule enforced in one position and
not another is more dangerous than no rule, because the passing case teaches the reader it
is covered.

A dimension that cannot be folded to a constant keeps its slot rather than being dropped,
so an unresolvable bound cannot be mistaken for an absent one.

Not yet covered: a subscript on a **struct field** (`s.arr[9]`) is unchecked in both
positions — tracked as #1168.

### Related ADRs

- ADR-007: bit indexing
- ADR-058: length properties
- ADR-035: Array initializers (syntax applies to multi-dimensional)
- ADR-023: cnx has no sizeof; an array parameter's `.type_byte_length` is the array's (#1975)
