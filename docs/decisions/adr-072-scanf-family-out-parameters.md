# ADR-072: Scanf-Family Out-Parameters

**Status:** Research
**Date:** 2026-11-12
**Decision Makers:** Joshua Austill (owner)
**Related ADRs:** ADR-006 (Simplified References), ADR-061 (C Library Interop), ADR-071 (Read-Only by Default)
**Related Issues:** #2117 (`&x` is not cnx), #1991 (a C pointer parameter takes its `&` from the header)

## Context

`&x` is not cnx (owner ruling, 2026-10-17, #2117; ADR-006). A C function's
pointer parameter does not need it: the header declares the parameter, and cnx
writes the `&` for it (#1991):

```cnx
mut u32 a <- 1;
bump(a);            // void bump(uint32_t* x);  ->  bump(&a);
```

A variadic C function declares nothing past its fixed parameters, so nothing
says that an argument there is written. Before #2117 the only way to give
`sscanf` somewhere to store what it reads was `&`:

```cnx
mut i32 parsed <- 0;
i32 count <- global.sscanf("7", "%d", &parsed);
```

Without `&`, the same call was E0899 ("'parsed' is never written"), because
the value was passed by value, and C's `sscanf` cannot store through a value.

## Decision

Owner ruling, 2026-11-12 (#2117): **the format string decides.**

For a call to a C standard scanf-family function -- `scanf`, `fscanf`,
`sscanf`, `wscanf`, `fwscanf`, `swscanf` -- with a literal format, each
conversion fills the next argument after the format, as C11 7.21.6.2 says,
except `%%` and an assignment-suppressed conversion (`%*d`), which fill none.
An argument a conversion fills is written:

- It must be `mut`; a read-only one is E0900.
- A `mut` one is no E0899, since the call writes it.
- C receives its address: `global.sscanf("7", "%d", parsed)` is
  `sscanf("7", "%d", &parsed)`. An array or a string (`%s`, `%[`) is
  already passed as a pointer to its first element, so it takes no `&`.

A scanf-family call whose format is not a string literal is a compile error,
E0929: nothing else says which arguments it writes.

Past any other variadic function's fixed parameters (`printf`), an argument is
passed as it is written, by value, and an array or a string is one the callee
may write through (ADR-071 Decision 2).

**Rejected:** making every argument to `...` by value, so that an out-parameter
through `...` is impossible in cnx. That would leave the C standard library's
input functions unusable from cnx.

## Diagnostics

| Code  | Meaning                                               | Asserted by                                                                |
| ----- | ----------------------------------------------------- | -------------------------------------------------------------------------- |
| E0929 | A scanf-family call's format is not a string literal  | `tests/bugs/issue-2117-address-of/scanf-format-not-literal-error.test.cnx` |
| E0900 | A read-only binding is an argument a conversion fills | `tests/bugs/issue-2117-address-of/scanf-read-only-error.test.cnx`          |

## Scope-Context Matrix (#1219)

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | error    |
| scope member       | same file           | off      |
| scope method       | same file           | error    |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | warn     |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | warn     |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | warn     |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | warn     |

A global or scope member initializer cannot call a C function, so the
`global variable` and `scope member` rows are `off`. The rule reads only the
call and its literal format, never where the callee or a binding is declared,
so the imported rows are `warn` until fixtures reach them. A `for` header can
hold a call, so its rows are `warn` too.

<!-- MATRIX-SEVERITY code: E0900 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | warn     |
| top-level function | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | warn     |
| top-level function | imported transitive | warn     |
| scope method       | imported transitive | warn     |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | warn     |

<!-- MATRIX-SEVERITY code: E0929 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | warn     |
| top-level function | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | warn     |
| top-level function | imported transitive | warn     |
| scope method       | imported transitive | warn     |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | warn     |

## Consequences

- Rejecting `&x` (ADR-006) leaves the scanf family usable: its out-parameters
  are written as plain names.
- A format built at run time cannot be passed to a scanf-family function from
  cnx. A C wrapper with a declared pointer parameter is the way to do that.
- A non-standard function with a scanf-like format (a vendor `my_scanf`) gets
  no inference: its arguments past `...` are passed by value.

## Open Questions

None.

## References

- #2117, owner rulings of 2026-10-17 and 2026-11-12
- C11 7.21.6.2 (the `fscanf` function), 7.29.2.2 (`fwscanf`)
- `tests/bugs/issue-2117-address-of/scanf-out-parameter.test.cnx`
- `tests/bugs/issue-2117-address-of/scanf-read-only-error.test.cnx`
- `tests/bugs/issue-2117-address-of/scanf-format-not-literal-error.test.cnx`
- `tests/adr-071/c-variadic-write-error.test.cnx`
