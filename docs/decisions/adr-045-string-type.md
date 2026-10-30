# ADR-045: Bounded String Type

**Status:** Implemented
**Date:** 2025-12-30
**Decision Makers:** cnx Language Design Team

## Context

Strings in embedded C are problematic:

1. **Dynamic allocation danger** - `malloc`-based strings cause fragmentation and OOM crashes
2. **Buffer overflows** - `strcpy` and `sprintf` are notorious security vulnerabilities
3. **No length tracking** - C strings require `strlen()` which traverses the entire string
4. **Null terminator confusion** - Developers constantly forget the +1 for null byte
5. **Inconsistent patterns** - Every embedded project reinvents string handling

CNX needs a string type that is:

- **Statically allocated** - No heap, no fragmentation (aligned with ADR-003)
- **Bounded** - Maximum capacity known at compile time
- **Safe** - No buffer overflows possible
- **Ergonomic** - Better developer experience than raw `char[]`
- **Optional** - Developers can still use `u8[]` if they prefer

---

## Research: How Other Languages Handle This

### Ada: Bounded_String

Ada's standard library provides `Bounded_String` for embedded use:

```ada
-- Ada bounded string: max 80 characters, always uses 80+ bytes
declare
   Name : Bounded_String(Max_Length => 80);
begin
   Name := To_Bounded_String("Hello");  -- Stores "Hello" in 80-byte container
   Put_Line(Length(Name));              -- 5 (current length)
end;
```

> "A Bounded-Length String type always allocates memory for the maximum permitted string length for the type."
> — [AdaCore: Standard Library Strings](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html)

### Rust: heapless::String<N>

Rust's embedded ecosystem uses the `heapless` crate:

```rust
use heapless::String;

let mut s: String<64> = String::new();  // 64-byte capacity
s.push_str("Hello").unwrap();           // Returns Result (can fail if full)
println!("{}", s.len());                // 5 (current length)
println!("{}", s.capacity());           // 64 (max capacity)
```

> "All heapless data structures store their memory allocation inline and specify their capacity via their type parameter N."
> — [heapless crate documentation](https://docs.rs/heapless/latest/heapless/)

### Arduino: char[] Best Practice

Arduino documentation advises against `String` class for embedded:

```cpp
// BAD: Dynamic allocation
String name = "Hello";  // Heap allocates, causes fragmentation

// GOOD: Static char array
char name[64] = "Hello";  // Fixed memory, predictable
```

> "For these reasons you should always use character arrays (c strings) when you're using Arduino."
> — Arduino community best practices

---

## Decision

### Syntax: `string<N>`

CNX introduces a bounded string type where **N is the character capacity** (null terminator handled automatically):

```cnx
string<5> name <- "Hello";     // Holds 5 chars, transpiles to char[6]
string<256> buffer;            // Empty string, 256-char capacity
string<32> greeting <- "Hi!";  // Holds up to 32 chars
```

**Key insight:** The developer specifies character count, not byte count. CNX handles the null terminator automatically.

### Properties

| Property    | Returns               | Description          |
| ----------- | --------------------- | -------------------- |
| `.capacity` | Compile-time constant | Maximum capacity (N) |

A string's character count and storage size are length properties, defined in
[ADR-058](adr-058-explicit-length-properties.md).

```cnx
string<64> name <- "Hello";

u32 cap <- name.capacity;     // 64 (compile-time constant)
```

### Generated C

```cnx
string<5> name <- "Hello";
```

Transpiles to:

```c
char name[6] = "Hello";  // 5 + 1 for null terminator
```

Property access:

```cnx
u32 cap <- name.capacity;
```

Transpiles to:

```c
uint32_t cap = 5;             // Compile-time constant (character capacity)
```

---

## Detailed Design

### Capacity Rules Summary

All string operations are checked at **compile time** against capacity:

| Operation             | Rule                                          | Example                     |
| --------------------- | --------------------------------------------- | --------------------------- |
| Literal assignment    | literal's character count ≤ dest.capacity     | `string<5> s <- "Hello"` ✓  |
| Variable assignment   | src.capacity ≤ dest.capacity                  | `string<64> big <- small` ✓ |
| Concatenation         | src1.capacity + src2.capacity ≤ dest.capacity | `string<64> r <- a + b`     |
| Substring             | start + length ≤ src.capacity                 | `string<10> s <- src[0,10]` |
| Literal in expression | Tight capacity (its character count)          | `"Hello"` is `string<5>`    |

### Declaration and Initialization

```cnx
// With initializer - capacity must fit the literal
string<13> greeting <- "Hello, World!"; // 13 chars, transpiles to char[14]

// Without initializer (empty string)
string<256> buffer; // Initialized to "" (first byte = '\0')

// Read-only string with automatic sizing (no capacity needed!)
string VERSION <- "1.0.0"; // Automatically string<5>, transpiles to char[6]
```

**Generated C:**

```c
char greeting[14] = "Hello, World!";
char buffer[257] = "";
const char VERSION[6] = "1.0.0";
```

### Read-only String Type Inference

For a read-only `string` declaration (no `mut`, ADR-071) with a literal initializer, the capacity is **automatically calculated**:

```cnx
string VERSION <- "1.0.0"; // Inferred as string<5>
string APP_NAME <- "MyApp"; // Inferred as string<5>
string LONG_MSG <- "Hello!"; // Inferred as string<6>
```

This eliminates redundancy - you don't need to count characters for constants.

### String Literals Must Fit

String literals assigned to `string<N>` must fit within the capacity:

```cnx
string<5> ok <- "Hello";      // OK: "Hello" is exactly 5 chars
string<5> also_ok <- "Hi";    // OK: "Hi" is 2 chars, fits in 5
string<4> error <- "Hello";   // ERROR: "Hello" is 5 chars, exceeds capacity 4
```

**This is a compile-time error, not a warning.**

---

## Concatenation

CNX supports string concatenation with **compile-time capacity checking**:

```cnx
string<32> first <- "Hello";
string<32> second <- " World";
string<64> result <- first + second;  // OK: 64 >= 32 + 32
```

### String Literal Capacity

String literals have **tight capacity** - their capacity equals their character length:

```cnx
// "Hello" is string<5>, " World" is string<6>
string<11> result <- "Hello" + " World";  // OK: 11 >= 5 + 6

// Mixed literals and variables
string<32> greeting <- "Hello";
string<38> message <- greeting + " World";  // OK: 38 >= 32 + 6
```

This allows efficient concatenation with literals without over-allocating the destination.

### Capacity-Based Safety

The destination must have capacity >= sum of source capacities:

```cnx
string<32> a <- "Hi";
string<32> b <- "There";
string<50> too_small <- a + b;  // ERROR: 50 < 32 + 32 (64 required)
string<64> just_right <- a + b; // OK: 64 >= 32 + 32
```

**Why capacity-based, not content-based?**

Even though "Hi" + "There" = 7 characters, we check against the maximum possible (32 + 32 = 64). This is **memory safe** - the destination can never overflow regardless of what's actually stored in `a` and `b` at runtime.

### Generated C

```cnx
string<64> result <- a + b;
```

Transpiles to:

```c
char result[65] = "";  // 64 + 1 for null
strncpy(result, a, 64);
strncat(result, b, 64 - strlen(result));
result[64] = '\0';
```

---

## Substring Extraction

CNX uses the same `[start, length]` syntax as bit indexing (ADR-007) for substrings:

```cnx
string<64> source <- "Hello, World!";
string<5> hello <- source[0, 5];     // "Hello" - 5 chars starting at index 0
string<6> world <- source[7, 6];     // "World!" - 6 chars starting at index 7
```

### Single Character Access

Single-index access is syntactic sugar for a 1-character substring:

```cnx
string<64> source <- "Hello";
string<1> ch <- source[0];    // Sugar for source[0, 1] -> "H"
```

**`s[0]` is equivalent to `s[0, 1]`** - both return a `string<1>` containing the character at that position.

Writing one character is a `string<1>` write (owner ruling, 2026-10-30, #1748). It
takes a character -- a char literal or another string's character -- or a string
that fits one character, which writes that string's character:

```cnx
mut string<8> s <- "hello";
s[0] <- 'j';      // OK: s is "jello"
s[0] <- "j";      // OK: the same write
s[0] <- "jy";     // E0864: "jy" does not fit a string<1>
s[0] <- 65;       // E0927: an integer is not a character (MISRA C:2012 Rule 10.3)
```

### Character Operands (MISRA C:2012 Rule 10.1)

A character -- a string element, a char literal, a C `char` -- takes only binary `+` and `-` and the comparisons. Under `*`, `/`, `%`, `&`, `|`, `^`, `<<`, `>>`, a prefix `-` or `~`, or the compound form of one of these, it is E0925; a cast to an integer type is the fix (#2347 review, owner ruling 2026-10-25: "MISRA always wins, so cast required as per 10.1").

```cnx
string<8> s <- "A1";
u8 hi <- s[0] >> 4;        // E0925
u8 ok <- (u8)s[0] >> 4;    // OK
u8 d <- s[0] - '0';        // OK: binary - takes a char
```

### Bounds Checking (Capacity-Based)

Substring bounds are checked against the **source capacity**, not the current content length. This ensures:

- Compile-time verification (capacity is always known)
- Zero runtime overhead
- Memory safety (never reads past allocated memory)

```cnx
string<64> source <- "Hello";  // Capacity: 64, content: 5 chars

string<10> sub1 <- source[0, 10];   // OK: 0 + 10 ≤ 64 (capacity)
string<10> sub2 <- source[60, 10];  // ERROR: 60 + 10 > 64 (exceeds capacity)
string<5> sub3 <- source[64, 5];    // ERROR: 64 + 5 > 64 (start beyond capacity)
```

**Note:** Reading within capacity but beyond actual content may return null bytes (ASCII zero from initialization). This is memory-safe but semantically the developer's responsibility.

### Substring Concatenation

```cnx
string<32> a <- "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";  // 32 A's
string<32> b <- "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";  // 32 B's

// Take first half of a, second half of b
string<32> result <- a[0, 16] + b[16, 16];  // OK: 16 + 16 = 32
```

### Generated C

```cnx
string<5> hello <- source[0, 5];
```

Transpiles to:

```c
char hello[6];
strncpy(hello, source + 0, 5);
hello[5] = '\0';
```

---

## Safety Features

### Compile-Time Errors (Not Warnings)

CNX enforces strict compile-time safety. These are **errors**, not warnings:

| Situation               | Error                                                                             |
| ----------------------- | --------------------------------------------------------------------------------- |
| Literal too long        | `ERROR: String literal "Hello" (5 chars) exceeds string<4> capacity`              |
| Concatenation overflow  | `ERROR: Concatenation requires capacity 64, but string<50> only has 50`           |
| Assignment from larger  | `ERROR: Cannot assign string<64> to string<32> (potential truncation)`            |
| Substring out of bounds | `ERROR: Substring [60,10] exceeds source capacity 64`                             |
| In-place concatenation  | `ERROR: Self-referential concat: 64 < 64 + 6`                                     |
| Not a string            | `error[E0923]: A value that is not a string cannot be assigned to string<8>: 'n'` |

```cnx
string<4> s <- "Hello";           // ERROR: 5 > 4
string<32> a;
string<64> b;
a <- b;                           // ERROR: potential truncation (64 > 32)
string<50> c <- a + b;            // ERROR: 32 + 64 = 96 > 50
string<10> d <- b[60, 10];        // ERROR: 60 + 10 > 64
b <- b + "!";                     // ERROR: 64 < 64 + 1
```

Only a string lands in a `string<N>`: a literal, another string, a
concatenation, a substring, or a C string (a `char*` or a `char[]`). Anything
else -- an integer, a float or its bits, a bool, a char, an enum, a struct or
an array -- is E0923, as a declaration's initializer, an assignment's value or
an argument (#1634). Until then each was accepted at exit 0 and emitted as the
string copy, which C reads as an address. A string array's list element is
ADR-035's E0866, which takes only a string literal there (#2195). E0914
(ADR-024) is the other direction. A declaration's copy is decided by the
`string<N>` it declares, as
an assignment's is by its target: every initializer but a literal, a
concatenation and a substring is copied in.

A value written whole into a `string<N>` has one of four forms, decided once
for a declaration and an assignment alike (#1257), parentheses looked through
(#2232): a literal, one string copied in, a substring, or a concatenation of
two or more parts (#1954), each part a whole string or a substring. A
substring's source may be any string -- a field, an element or a `this.`
member (#2223, #2237). The capacity rules above hold for an assignment as for
a declaration (#2191): its value is E0864 when it may not fit. An assignment
builds a concatenation or a substring in a temporary and then copies it in,
so a part may read the string written (`message <- message[0, 58] + " World"`).
A substring contributes at most its length, and never more than the space left in
the string it is written into.
A substring's length is a compile-time constant -- a literal or a constant --
wherever the substring is read (#2240): a run-time length is E0922, because
what it copies could not be checked to fit. Its start may be computed at run
time.
An argument is written into its `string<N>` parameter, so the same rules hold
there (#2239): a value that may not fit the parameter is E0864, and a
concatenation or a substring is built into a `string<N>` before the call.
A struct initializer's `string<N>` field is written the same way (#2236): its
value is E0864 when it may not fit, and inside a function it is copied into
the field like any string. At file scope only a literal can initialize one
(E0863), for the reason a file-scope string takes only a literal.

| Code  | Reported when                                                                     | Asserted by                                                                                                                                                                                                  |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E0862 | A string's capacity cannot be determined: none written, and none inferable        | `tests/adr-045/string-error-const-no-init.test.cnx`, `tests/adr-045/string-error-uncovered-forms.test.cnx`, `tests/adr-045/string-syntax-rules-*.test.cnx`                                                   |
| E0863 | A string, or a string field, at file scope is initialized by other than a literal | `tests/adr-045/string-error-init-global.test.cnx`, `tests/adr-045/string-imported-global-error.test.cnx`, `tests/adr-045/string-syntax-rules-*.test.cnx`                                                     |
| E0864 | A value written into a `string<N>` may not fit its capacity                       | `tests/adr-045/string-error-overflow.test.cnx`, `tests/adr-045/string-error-in-scope.test.cnx`, `tests/adr-045/string-fit-rules-imported-*.test.cnx`, `tests/adr-045/string-fit-rules-for-header-*.test.cnx` |
| E0865 | A substring's bounds exceed its source's capacity                                 | `tests/adr-045/string-error-substring-bounds.test.cnx`, `tests/adr-045/string-fit-rules-*.test.cnx`                                                                                                          |

### No Silent Truncation

Unlike C's `strncpy`, CNX **never silently truncates**. If data might not fit, it's a compile error.

To explicitly truncate, use substring:

```cnx
string<64> long_string <- "This is a very long string";
string<8> short <- long_string[0, 8];  // Explicit: take first 8 chars
```

### Small-to-Large Assignment

Assigning a smaller-capacity string to a larger-capacity destination is allowed:

```cnx
string<32> small <- "Hello";
string<64> big <- small;  // OK: 64 >= 32, copies content, null-fills remaining bytes
```

The destination's remaining bytes are initialized to ASCII zero (null bytes) for safety. This ensures `strlen()` returns the correct content length.

### In-Place Concatenation

Self-referential concatenation is a **compile error** because capacity math fails:

```cnx
mut string<64> message <- "Hello";
message <- message + " World"; // ERROR: 64 < 64 + 6 (capacity check fails)
```

To append to a string, use explicit substring to manage bounds:

```cnx
mut string<64> message <- "Hello";
message <- message[0, 58] + " World"; // OK: 64 >= 58 + 6
```

This forces the developer to consciously manage string bounds rather than risk silent overflow.

A declaration's own initializer is different: it cannot name the string at all.
The string is defined once its declaration closes (ADR-030), so both
`string<32> s <- s + "x";` and `string<32> s <- s[0, 2];` are E0427, `'s' is
not defined`, before any capacity is compared (#1643). They had emitted a read
of the uninitialized buffer, and an overlapping `strncpy(s, s + 0, 2)`.

---

## Comparison

String comparison uses standard `strcmp`:

```cnx
string<32> a <- "Hello";
string<64> b <- "Hello";

if (a == b) {      // strcmp(a, b) == 0
    // Equal content
}

if (a != b) {      // strcmp(a, b) != 0
    // Different content
}
```

---

## Optional Feature

**Important:** The `string` type is completely optional in CNX. Developers are free to continue using `u8[]` for string handling if they prefer:

```cnx
// Using string type (recommended)
string<64> message <- "Hello";

// Using u8 array (also valid)
u8[65] message <- "Hello";  // Must manually account for null terminator
```

The `string` type provides safety and ergonomics, but `u8[]` remains available for:

- Legacy code compatibility
- Manual memory layout control
- Interop with specific C APIs

---

## Interaction with Other Features

### Null State (ADR-015)

Strings are never null in CNX - they're always valid arrays:

```cnx
string<64> name;    // Empty string "", not null
```

### C Interoperability (ADR-010)

Strings can be passed to C functions expecting `char*` or `const char*`:

```cnx
string<64> message <- "Hello";
printf("%s\n", message);        // Works: string<N> is a char[]
```

### Read-only by Default (ADR-071, which supersedes ADR-013)

```cnx
string VERSION <- "1.0.0"; // Immutable, auto-sized
```

Transpiles to:

```c
const char VERSION[6] = "1.0.0";
```

### Arrays of Strings

```cnx
string<32>[10] names;    // Array of 10 strings, each up to 32 chars
```

Transpiles to:

```c
char names[10][33];  // 32 + 1 for null terminator each
```

### A `for` Header (ADR-036)

A `for` header declares one scalar loop variable, and a string is a `char`
array in C, so a string declared there, sized or unsized, is E0917. Declare it
before the loop (owner ruling on #1823, 2026-10-18):

```cnx
for (string<8> s <- "ab"; n < 1; n <- n + 1) { }  // E0917
```

---

## Trade-offs

### Advantages

1. **No heap allocation** - Memory usage known at compile time
2. **Safe by default** - No buffer overflows, no silent truncation
3. **Null terminator handled** - Developer specifies chars, not bytes
4. **Familiar syntax** - Generic-style `string<N>` is intuitive
5. **C compatible** - Just a `char[]` underneath
6. **Ergonomic** - `.capacity`, and ADR-058's length properties
7. **Read-only inference** - No need to count chars for constants
8. **Optional** - Can still use `u8[]` if preferred

### Disadvantages

1. **Memory overhead** - Always allocates max capacity + 1
2. **Fixed size** - Cannot grow beyond capacity
3. **Runtime length** - the character count requires a `strlen()` call
4. **Strict errors** - May require explicit substring for truncation

### Why Not Track Length at Runtime?

Some languages store length alongside the string:

```c
struct String {
    char data[N];
    size_t length;
};
```

We chose not to for:

1. **C compatibility** - `char[]` works with all C functions
2. **Simplicity** - No struct overhead
3. **Memory** - Saves a `size_t` per string
4. **Predictability** - Matches what embedded developers expect

The trade-off is that the character count requires calling `strlen()`.

---

## Implementation Notes

### Grammar Changes

Add `string` as a type with optional generic capacity:

```antlr
type
    : primitiveType
    | 'string' '<' INTEGER '>'    // Sized string
    | 'string'                    // Read-only, capacity inferred
    | customType
    ;
```

### Code Generator Changes

1. Detect `string<N>` type declarations
2. Generate `char name[N+1]` for declarations (add 1 for null)
3. For a read-only `string` with a literal, infer N from literal length
4. Generate `strncpy()` + null termination for assignments
5. Generate `strlen()` for the character count (ADR-058)
6. Generate compile-time constant N for `.capacity`
7. Validate concatenation: dest.capacity >= src1.capacity + src2.capacity
8. Validate assignment: dest.capacity >= src.capacity
9. Generate substring extraction with bounds checking

### Required C Headers

```c
#include <string.h>   // For strlen, strncpy, strncat, strcmp
```

---

## Success Criteria

1. `string<5> s <- "Hello"` transpiles to `char s[6] = "Hello"`
2. `.capacity` returns compile-time constant N (character count)
3. Literal overflow is a **compile error**
4. Truncation on assignment is a **compile error**
5. Concatenation capacity mismatch is a **compile error**
6. A read-only `string X <- "lit"` auto-sizes to literal length
7. Substring `s[start, len]` extracts substring safely
8. Strings work with C standard library functions
9. No heap allocation ever
10. `u8[]` remains available as alternative

---

## Future Work

- **String formatting** - `string.format()` or similar
- **Unicode considerations** - Currently assumes ASCII/single-byte
- **String methods** - `.trim()`, `.upper()`, `.lower()`, etc.

---

## Diagnostics: the storage properties

| Code  | Reported when                                               | Asserted by                                                                                          |
| ----- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| E0887 | `.capacity` or `.size` is asked of something with no buffer | `tests/adr-045/string-storage-properties-error.test.cnx`, `tests/adr-045/string-property-*.test.cnx` |

`.capacity` is the declared `N` and `.size` is that plus the null terminator.
Both describe the BUFFER a string is, so neither has an answer for a scalar or
an array -- an array's length is `.type_element_count`, and a value's size in bytes
is `.type_byte_length` (ADR-058).

As with those, the name is only a property when it names nothing else: a scope
variable may be called `capacity`.

## Scope-context matrix

Declared for the string DECLARATION rules #1322 moved out of codegen: the
declaration must state a capacity that can be determined, a string at file scope
may only be initialized by a literal, the initializer must fit, a substring's
bounds must stay within its source, and a string array's initializer must match
its declaration.

<!-- MATRIX-SEVERITY code: E0862 -->

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

off: E0862 judges a string declaration, and a `for` header cannot declare a string: one there is E0917 (ADR-036).

<!-- MATRIX-SEVERITY code: E0863 -->

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
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: E0863 is a file-scope rule; inside a function or method a string may be copied, concatenated or sliced, and a string declared in a `for` header is E0917 (ADR-036).

<!-- MATRIX-SEVERITY code: E0864 -->

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

<!-- MATRIX-SEVERITY code: E0865 -->

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

<!-- MATRIX-SEVERITY code: E0887 -->

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

A string declaration is a DECLARATION, so unlike a statement rule it reaches all
four same-file contexts.
A `for` header cannot declare a string (E0917), but its loop variable's
initializer can pass one to a `string<N>` parameter or ask a storage property,
so E0864, E0865 and E0887 reach it too.

The imported columns matter because the rules compare a destination's capacity
against a SOURCE's, and the source may be declared in another file. A check
reading only the file in front of it finds no capacity there, and an unknown
capacity correctly never rejects -- so the rule would go quiet across an
include rather than fail. Two of the imported cells are `error` and occupied;
the scope contexts are `off` as a stated obligation, not a claim they cannot
exist.

### The bounded copy

A write of a whole `string<N>` -- a variable, a field, an element, through any
path -- is a bounded copy of at most `N` characters followed by the terminator,
decided from the type the target writes and not from how it is spelled (#1731).
It must not depend on which file declared the string: a function or a scope
method writing a scope member declared one or two includes away makes the same
copy as one declared beside it (#1595).

This rule has its own matrix, so only the copy's fixtures occupy it and they
cannot stand in for the declaration rules' fixtures above. A write is a
statement, so it reaches only the two contexts that hold statements: a `for`
header's update cannot hold the copy (E0715, ADR-068), and a declaration's
initializer belongs to the declaration rules.

<!-- MATRIX-SEVERITY rule: string-copy -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |

## References

- ADR-003: Static Memory Allocation - Research on bounded strings in Ada, Rust
- ADR-007: Type-Aware Bit Indexing - Substring syntax inspiration `[start, length]`
- [Ada Bounded_String](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_strings.html)
- [Rust heapless::String](https://docs.rs/heapless/latest/heapless/struct.String.html)
- [MISRA C string handling guidelines](https://www.misra.org.uk/)
- [Arduino String class problems](https://arduino.stackexchange.com/questions/1013/how-do-i-split-an-incoming-string)
- [Feabhas: Working with Strings in Embedded C++](https://blog.feabhas.com/2022/02/working-with-strings-in-embedded-c/)
