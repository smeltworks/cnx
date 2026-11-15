# ADR-023: Sizeof Mechanism

## Status

**Rejected**

cnx has no `sizeof` (#1975, below): a size is one of ADR-058's kind-named
lengths, `.type_byte_length` or `.memory_byte_length`. The
problem, options and research are kept as the record of how that was decided;
"Recommended Decision" is kept as the recommendation it was, and is superseded
by the ruling.

## Owner Ruling (#1975)

cnx has no `sizeof`. The size of a type or of a value is ADR-058's
`.type_byte_length` (and `.type_bit_length`), which cnx decides itself rather than the
C compiler:

```cnx
u32 a <- u32.type_byte_length;        // 4: a type answers its length properties
u32 b <- Point.type_byte_length;      // a cnx struct: its fields' sizes, summed
u32 c <- Point.x.type_byte_length;    // a field of a type
u32 d <- reading.type_byte_length;    // a value: the same answer as its type
u32 e <- Cfg.type_byte_length;        // a C header's struct: also its fields summed
```

- A struct's size is the sum of its fields' sizes, without C padding, wherever
  the struct is declared. For `typedef struct { uint32_t a; uint8_t b; } Cfg;`
  from a header, `Cfg.type_byte_length` is 5, not gcc's 8: a memory-safe language
  has no use for C's own size.
- cnx has no pointers, so it cannot size one. A header struct's pointer
  field, and a header struct holding one, has no `.type_byte_length`: E0867.
- Writing `sizeof(...)` is a compile error, E0603, whose help names
  `.type_byte_length`. It is parsed only so that it is rejected with a code.
- E0601 and E0602 judged `sizeof`'s operand; with no `sizeof` they are retired.

Later (#1975 review 2, ADR-058's Decision) the owner split the length into
three kinds, each named: `.value_*`, `.type_*` and `.memory_*`. The `type_`
row is the one above. `.memory_byte_length` is C's layout, emitted as
`sizeof(T)` in the generated C for the C compiler to answer (`Cfg` is 8 there,
and a pointer has one). This is not a cnx `sizeof`: the operator stays
rejected, and this ADR stays Rejected.

The sections below that describe `sizeof` syntax and its rules are the
research the ruling replaced.

## Context

C's `sizeof` operator is essential for:

- Buffer sizing
- Memory operations (memcpy, memset)
- Array length calculations
- Struct padding awareness

cnx needs a way to query type and value sizes.

However, `sizeof` is also the source of several common bugs:

- **Array parameter decay**: `sizeof(arrayParam)` returns pointer size, not array size
- **Side effects ignored**: expressions inside `sizeof()` are never executed
- **VLA complications**: Variable-length arrays make sizeof runtime-evaluated

## Decision Drivers

1. **Buffer Operations** - memcpy, memset need sizes
2. **Type Introspection** - Know size of structs
3. **Compile-Time** - Must be constant expression (no VLAs)
4. **C Compatibility** - Generate valid sizeof
5. **Safety** - Prevent classic sizeof bugs at compile time

## Options Considered

### Option A: C-Style `sizeof()`

```cnx
usize size <- sizeof(u32);           // 4
usize arrSize <- sizeof(buffer);     // Total bytes
usize structSize <- sizeof(Point);   // Struct size with padding
```

**Pros:** Familiar, direct C mapping
**Cons:** Parentheses required, function-like syntax

### Option B: `.size` Property

```cnx
usize size <- u32.size;        // 4
usize arrSize <- buffer.size;  // Total bytes
usize pointSize <- Point.size; // Struct size
```

**Pros:** Consistent with `.length`, cleaner syntax
**Cons:** Conflicts if struct has `size` field

### Option C: Both

Support both `sizeof()` and `.size`:

```cnx
// Either works
usize a <- sizeof(u32);
usize b <- u32.size;
```

**Pros:** Flexibility
**Cons:** Two ways to do same thing

## Recommended Decision

**Option A: C-Style `sizeof()`** - Familiar and unambiguous.

Reserve `.size` for potential future use (e.g., collections).

## Syntax

### Type Sizeof

```cnx
usize intSize <- sizeof(u32);      // 4
usize ptrSize <- sizeof(usize);    // Platform-dependent
usize structSize <- sizeof(Point); // Includes padding
```

### Variable Sizeof

```cnx
u8[256] buffer;
usize bufSize <- sizeof(buffer);   // 256

Point p;
usize pSize <- sizeof(p);          // Same as sizeof(Point)
```

### Common Patterns

```cnx
// Clear struct
memset(&config, 0, sizeof(config));

// Copy buffer - use sizeof(type) * .length for byte count
void copyBuffer(u8[] dest, u8[] src) {
    memcpy(dest, src, sizeof(u8) * src.length);
}

// Array element count vs byte count (local arrays only)
u32[10] arr;
usize count <- arr.length;      // 10 (element count, ADR-007)
usize bytes <- sizeof(arr);     // 40 (total bytes)

// Struct array byte count
Point[5] points;
usize pointBytes <- sizeof(Point) * points.length;  // Safe pattern
```

## Safety Rules

These are the research's rules, kept as the record of what was weighed. cnx
has no `sizeof` (#1975), so E0601 and E0602 are retired; the VLA rule below
stands, under E0909.

### E0601: sizeof on Array Parameter

Using `sizeof()` on an array parameter is a compile error. In C, array parameters decay to pointers, so `sizeof(arrayParam)` returns pointer size (4 or 8 bytes), not the array size.

```cnx
void process(u8[] data) {
    usize size <- sizeof(data);  // ERROR E0601
}
```

**Error message:**

```
error[E0601]: sizeof() on array parameter returns pointer size, not array size
  --> file.cnx:2:18
   |
2  |     usize size <- sizeof(data);
   |                   ^^^^^^^^^^^^ use data.length for element count
   |
   = help: for element count: data.length
   = help: for byte count: sizeof(u8) * data.length
```

**Safe alternatives:**

```cnx
void process(u8[] data) {
    usize count <- data.length;               // Element count
    usize bytes <- sizeof(u8) * data.length;  // Byte count
}
```

### E0602: Side Effects in sizeof (MISRA C:2012 Rule 13.6)

The `sizeof` operator evaluates types at compile-time; expressions inside it are **never executed**. Side effects in sizeof operands are a compile error.

```cnx
u32 x <- 5;
usize s <- sizeof(x++);  // ERROR E0602
```

**Error message:**

```
error[E0602]: sizeof() operand must not have side effects (MISRA C:2012 Rule 13.6)
  --> file.cnx:2:16
   |
2  |     usize s <- sizeof(x++);
   |                       ^^^ side effect never executes
   |
   = help: move side effects outside: x++; sizeof(x)
```

**Safe alternative:**

```cnx
u32 x <- 5;
x++;
usize s <- sizeof(x);  // OK - no side effects
```

### Variable-Length Arrays Forbidden (ADR-003, E0909)

Variable-length arrays (VLAs) are not allowed in cnx. This aligns with ADR-003 (static allocation) and avoids:

- Runtime sizeof evaluation
- Stack overflow risks
- Security vulnerabilities
- The reason VLAs were banned from the Linux kernel

```cnx
void process(u32 n) {
    u8[n] buffer;  // ERROR E0909
}
```

**Error message:**

```
error[E0909]: Array dimension must be known at compile time: 'n' is a parameter
```

**Safe alternatives:**

```cnx
// Fixed-size buffer
void process(u32 n) {
    u8[MAX_SIZE] buffer;  // Compile-time constant
    // Use only first n elements...
}

// Or allocate at startup (ADR-003)
```

## Valid sizeof Uses

```cnx
// Type sizes
usize intSize <- sizeof(u32);           // 4
usize ptrSize <- sizeof(usize);         // Platform-dependent

// Struct sizes
usize pointSize <- sizeof(Point);       // Includes padding

// Local fixed arrays (not parameters)
u8[256] localBuffer;
usize bufBytes <- sizeof(localBuffer);  // 256 - OK

// Struct instances
Point p;
usize pSize <- sizeof(p);               // Same as sizeof(Point)

// Byte count via explicit multiplication (recommended for params)
void clear(u8[] data) {
    memset(data, 0, sizeof(u8) * data.length);  // Explicit and safe
}
```

## Implementation Notes

### Grammar Changes

```antlr
primaryExpression
    : ...
    | 'sizeof' '(' (type | expression) ')'
    ;
```

### Semantic Analysis

The compiler must:

1. Track which variables are array parameters vs local arrays
2. Detect side effects in sizeof operands (increment, decrement, assignment, function calls)
3. Verify array sizes are compile-time constants (no VLAs)

### Generated C

Direct pass-through for valid cases:

```c
size_t size = sizeof(uint32_t);
size_t arrSize = sizeof(buffer);
```

### Priority

**High** - Essential for memory operations.

## Resolved Questions

1. **sizeof on expressions vs types?** - Neither: cnx has no `sizeof` (#1975). Both a type and a value answer `.type_byte_length`.
2. **Compile-time only?** - Yes, a length property is always compile-time (no VLAs).
3. **A C header struct's size?** - Its fields' sizes summed, no padding; a pointer field has none (E0867) (#1975).

## Diagnostics

| Code  | Reported when                         | Asserted by                                                                                                                                                                                           |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0603 | `sizeof(...)` is written, in any form | `tests/adr-023/sizeof-rejected-error.test.cnx`, `tests/adr-023/same-file-contexts-error.test.cnx`, `tests/adr-023/imported-direct-error.test.cnx`, `tests/adr-023/imported-transitive-error.test.cnx` |

E0601 (`sizeof` of an array parameter measured a pointer) and E0602 (an operand
with a side effect, MISRA C:2012 Rule 13.6) are retired by #1975 and not
reassigned: `.type_byte_length` of an array parameter is the array's, and a length
property reads no value, so it has no operand to evaluate.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY code: E0603 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| for header         | same file               | error    |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| for header         | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | imported transitive     | off      |
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

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0603 rejects `sizeof` wherever it is written; it is about no declaration, so it cannot occupy one; its cross-file case is the provider side.

E0603 is decided by the syntax alone, where `sizeof` is written, so it fires in
every context and at every include depth: a global variable's or a scope
member's initializer, or a `for` header, can write it as a function body can,
and an include changes nothing about it.

## References

- [MISRA C:2012 Rule 13.6](https://pvs-studio.com/en/docs/warnings/v2557/) - sizeof operand side effects
- [SEI CERT ARR01-C](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array) - sizeof on array parameters
- [LWN: VLAs and the max() mess](https://lwn.net/Articles/749064/) - Why Linux banned VLAs
- C sizeof operator semantics
