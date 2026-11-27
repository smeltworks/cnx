# ADR-046: Nullable C Interop with c\_ Prefix

**Status:** Accepted (was Implemented; it declares no test matrix yet, which #1406 tracks. Owner ruling on #1933, 2026-10-17)
**Date:** 2026-01-19
**Implemented:** 2026-01-19 (v0.1.12)
**Supersedes:** ADR-047 (NULL Keyword for C Library Interop)

## Context

cnx eliminates null bugs by design for native types through:

- ADR-003: No dynamic allocation (no malloc/free)
- ADR-006: No pointer arithmetic or reassignment
- ADR-015: Zero initialization + init-before-use checks
- ADR-039: Null safety is emergent from these constraints

However, ADR-047's approach to C library interop was too restrictive:

- Could not store nullable returns in variables (E0904)
- Functions like `fopen`, `getenv` were forbidden (E0902)
- Required awkward inline-only patterns: `if (fgets(...) != NULL)`
- Created conflicts with MISRA Rule 13.5 (E0702) requiring special exemptions

## Decision

**Allow nullable C pointer types with a mandatory `c_` prefix.**

The `c_` prefix signals to both compiler and reader: "this variable holds a C pointer that may be NULL."

### Core Rules

1. Variables storing nullable C pointer returns must use the `c_` prefix
2. NULL comparisons are allowed only for `c_` prefixed variables
3. cnx native types (`string`, `u32`, arrays, structs) remain non-nullable
4. Compiler enforces correct prefix usage and NULL checks before use

### Valid Code

```cnx
#include <stdio.h>

// Nullable C return - requires c_ prefix
FILE c_file <- fopen("data.txt", "r");
if (c_file != NULL) {
    string<256> line;
    while (fgets(line, line.size, c_file) != NULL) {
        printf("%s", line);
    }
    fclose(c_file);
}

// Non-nullable cnx variable - no prefix, no NULL
string<64> buffer;  // Always valid, zero-initialized
```

### When c\_ Prefix is Required

| Scenario                         | Prefix Required? |
| -------------------------------- | ---------------- |
| C function returning pointer     | Yes              |
| C function returning int/value   | No               |
| C struct with pointer members    | Yes              |
| C struct with only value members | No               |
| cnx native types                 | No (forbidden)   |

### Struct Member Access

The `c_` prefix goes on the variable, not member access:

```cnx
// C header: typedef struct { char* name; int id; } Customer;
Customer c_customer <- get_customer(42);

if (c_customer != NULL) {
    if (c_customer.name != NULL) {  // Member access is normal
        printf("Name: %s", c_customer.name);
    }
}
```

### Where a NULL Check Holds

A NULL check holds where its condition decided control reached (#2348
review). Two shapes still hold it further, and are open: a check made before
a loop, in a later pass after the body reassigns the variable (#2524), and a
guard clause on an inner `c_` local, for an outer one of the same name
(#2525). `c_x != NULL` holds in the body of an `if` or `while` it
is the condition of, on the right of an `&&` it is the left of, and in the
first branch of a ternary. `c_x = NULL` holds the other way round: on the
right of an `||`, in an `else`, in a ternary's second branch, and, as a guard
clause, after an `if` with no `else` whose body returns on every path: a
`return` inside a loop may never run, so it makes no guard clause. A guard
clause inside a branch, a `for`, `while` or `forever` loop, or a switch holds
only inside it, since a path may skip it; a do-while body runs at least once,
so a guard at its top level holds after the loop. A true `&&` holds
each of its operands' checks and a false `||` each of its operands', so one
condition checks several variables; a `!` turns its operand's around, and so
do `x = false` and `x != true`, E0701's spelling of `!x`, while `x = true` and
`x != false` are `x`.

```cnx
cstring c_a <- strstr(haystack, "lo");
cstring c_b <- strstr(haystack, "he");
bool hasText <- c_a != NULL && strlen(c_a) > 0;        // OK
u64 length <- (c_a = NULL) ? 0 : strlen(c_a);         // OK
if (c_a != NULL && c_b != NULL) {
    n <- strlen(c_a) + strlen(c_b);                    // OK: both checked
} else {
    n <- strlen(c_a);                                  // ERROR E0908
}
n <- strlen(c_a);                                      // ERROR E0908
if (c_a = NULL || c_b = NULL) {
    return;
}
n <- strlen(c_a) + strlen(c_b);                        // OK: guard clause
```

Until then only a whole `if` or `while` condition of exactly `c_x != NULL`
or `c_x = NULL` checked anything, `c_a != NULL && strlen(c_a) > 0` was E0908,
and an `if (c_a != NULL)` left `c_a` checked in its `else` and after it.

### Operators on a C String

A `cstring` is a C pointer, and cnx has no pointer arithmetic (ADR-006), so
no arithmetic, bitwise or shift operator takes one, nor a prefix `-` or `~`,
nor a compound assignment (owner ruling, #2348). Each is E0925. Until then
`c_pos + 1` was accepted at exit 0 and emitted as C pointer arithmetic.

A C string is compared with `NULL`, compared and ordered by content (ADR-045),
passed whole to a C function, and reassigned from a call:

```cnx
mut cstring c_pos <- strstr(haystack, "lo");
if (c_pos != NULL) {
    i32 order <- strcmp(c_pos, "lo");   // OK: passed whole
    u32 next <- (u32)(c_pos + 1);       // ERROR E0925: '+' is not valid on a C string
    c_pos +<- 1;                        // ERROR E0925
}
c_pos <- strstr(haystack, "he");        // OK: reassigned from a call
```

To reach a part of it, copy it into a `string<N>` and take a substring.

### A C String's C Type

A `cstring` is emitted as `const char*`, `mut` or not (#2311). Its characters
are C's: a string literal, or what `strstr` returns for a read-only string.
`mut` lets the pointer be reassigned; it never lets cnx write the characters,
because no cnx form writes through a `cstring`. A read-only `cstring` adds no
second `const`. Nor can a `cstring` land where C may write its characters: a
C pointer parameter that is not const, `char*` or `void*`, and a C struct's
`char*` field are E0900, and a function returning `cstring` does not match a
C function-pointer type that returns `char*` (E0879) (#2348 review).

```cnx
mut cstring label <- "a";                   // const char* label = "a";
label <- "b";                               // OK: the pointer is reassigned
string<16> haystack <- "hello world";
mut cstring c_at <- strstr(haystack, "lo"); // const char* c_at = strstr(...)
cstring c_he <- strstr(haystack, "he");     // const char* c_he = strstr(...)
texts_upper(c_at);                          // ERROR E0900: texts_upper takes char*
```

Until then a `mut cstring` was `char*`. ISO C++ rejects a string literal
there, and `strstr` on a `const char[]` returns `const char*` in C++, so both
failed to compile under `-Werror` while the transpiler exited 0.

## Error Codes

| Code  | Message                                           |
| ----- | ------------------------------------------------- |
| E0925 | An operator other than a comparison on a C string |
| E0905 | Missing `c_` prefix for nullable C type           |
| E0906 | Invalid `c_` prefix on non-nullable type          |
| E0907 | NULL comparison on non-nullable variable          |
| E0908 | Missing NULL check before use                     |

### Retired Error Codes

- E0901 → Replaced by E0908 (more general)
- E0902 → Retained, and re-scoped: the stream and lookup functions this ADR
  allows no longer trigger it, but importing a dynamic memory function still
  does (see _Functions Still Forbidden_ below). It reads "importing X from
  C/C++ is forbidden" rather than naming X as a cnx function
- E0904 → Removed (storage allowed with `c_` prefix)
- E0903 → Retained (NULL invalid for cnx types)

## Functions Now Usable

Previously forbidden by ADR-047, now allowed:

- `fopen`, `fclose`, `freopen`, `tmpfile`
- `getenv`
- `strstr`, `strchr`, `strrchr`
- Any user-defined C function returning pointers

## Functions Still Forbidden

Dynamic memory imported from C or C++, reported as **E0902**.

**Which names, and the match rule, are stated once — in
[ADR-003 § What a `.cnx` File May Not Call](adr-003-static-allocation.md#decision-what-a-cnx-file-may-not-call).**
That is the ADR that owns static allocation, so that is where the language-level
statement of what compiles belongs. This section deliberately does not repeat the
list: when it did, the two homes disagreed — ADR-003 named five functions and
this file named fourteen plus a suffix rule, so a transpiler rebuilt from one
rejected `heap_caps_malloc` and one rebuilt from the other did not.

What belongs here is the interop consequence: a header that declares these
functions can still be included, and every other function it declares remains
usable under this ADR's `c_` rules. Only a call to a forbidden name from a `.cnx`
file is rejected, and the diagnostic names the **import** as what is forbidden
rather than describing the function as a cnx one.

## Compiler Enforcement

The compiler determines nullability via:

1. **Built-in knowledge** of standard library functions (stdio.h, stdlib.h, string.h)
2. **Header parsing** of user `.h` files to detect pointer return types and pointer-containing structs

## Benefits

1. **Self-documenting** — `c_` prefix tells readers "nullable C territory"
2. **Maintains null safety** — cnx native types remain non-nullable
3. **Unlocks practical I/O** — File handling, environment variables now usable
4. **Simpler rules** — No special exemptions needed (removes E0702 workaround)
5. **Clear errors** — Compiler guides correct usage

## Consequences

- ADR-047 is superseded
- E0702's exemption for stream functions is no longer needed and goes away: the
  rule becomes one that applies everywhere rather than one with a carve-out, which
  is the point of the change
- Existing code using `if (fgets(...) != NULL)` still works
- New code can store results: `cstring c_result <- fgets(...)`

## Related ADRs

- **ADR-003**: Static Allocation - malloc/free remain forbidden
- **ADR-006**: Simplified References - No raw pointers in cnx
- **ADR-039**: Null Safety - Native types remain non-nullable
- **ADR-047**: Superseded by this ADR
- **ADR-103**: Stream Handling - FILE\* now usable with c\_ prefix
