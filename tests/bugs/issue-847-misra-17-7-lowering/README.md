# Issue #847 — MISRA C:2012 Rule 17.7 / ADR-070

Regression fixtures for discarded non-void return values.

## What this guards

ADR-070 splits a discarded return into two cases, handled in two different
places. These fixtures pin the half that lives in **codegen**; the half that
lives in **analysis** is pinned by `tests/analysis/return-value-discarded`.

| Case | Who wrote the call               | Behaviour                           | Guarded by                                       |
| ---- | -------------------------------- | ----------------------------------- | ------------------------------------------------ |
| 1    | the transpiler (string lowering) | `(void)` cast emitted automatically | `lowered-string-calls.test.cnx` (here)           |
| 2    | the developer                    | compile error **E0708**             | `tests/analysis/return-value-discarded.test.cnx` |

## `lowered-string-calls.test.cnx`

Covers the two `StringUtils` lowering forms that emit a library call:

- `copyWithNull` — a plain `string<N>` assignment
- `copy` — a string array element assignment

Every emitted `strncpy`/`strncat` must carry an explicit `(void)`. The author
never wrote these calls, so the cast is codegen rather than a language change —
which is why this is a snapshot fixture and not a `test-error` one.

Since #2207 and #1902 both forms lower to `cnx_string_copy`, a `void` helper, so
no emitted call discards a result and this fixture has no cast left to check.
What it should guard instead is tracked in #2403.

## Why the cast lives in one place

`StringUtils` is the sole producer of these calls. `StringDeclHelper` used to
rebuild two of the sequences inline, which would have meant remembering the
cast in three places; it now delegates. If a future change reintroduces a
second producer, this fixture keeps passing while the new path silently emits
an uncast call — so the guard is the single emit site, and this fixture is what
proves that site is correct.

## Name-resolution fixtures

Added in review of #1260. Each covers a form E0708 silently accepted while the
whole suite stayed green — every one a _name_-resolution gap, not the documented
"return type you cannot see" boundary.

| Fixture                    | Form                                                                      | Was                                                   |
| -------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `bare-intra-scope-discard` | `read();` inside its own scope (ADR-057 house style)                      | accepted; `this.read();` already errored              |
| `cross-file-scope-discard` | `Helper.compute();` and `global.Helper.other();` through a `.cnx` include | accepted; the same-file form already errored          |
| `external-c-discard`       | non-void function from an included `.h`                                   | errored — kept as the control for its `.hpp` twin     |
| `external-cpp-discard`     | non-void function from an included `.hpp`                                 | accepted; `.h` and `.hpp` are separate symbol indexes |

`external-c-discard` also calls a **void** C function on the line above the
flagged one. That is a deliberate negative control: it must stay silent, or the
fixture would pass for the wrong reason.

Each was mutation-checked — disabling the specific lookup it depends on turns
that fixture, and only that fixture, red:

| Mutation                        | Red                        |
| ------------------------------- | -------------------------- |
| ADR-057 scope fallback disabled | `bare-intra-scope-discard` |
| include-merged scopes ignored   | `cross-file-scope-discard` |
| C header symbols ignored        | `external-c-discard`       |
| C++ header symbols ignored      | `external-cpp-discard`     |

> Re-running these by hand: a mutation that lets a `test-error` fixture compile
> leaves `.test.c`/`.test.h` behind, and the stale artifacts then fail the guard
> even after the source is restored. Remove them between runs or the attribution
> is wrong — the first pass of this table was contaminated exactly that way.

## Not covered here

- `concat` / `substring` lowering onto an **assignment** target is broken
  independently of this issue — see **#1257** (declaration path works, assignment
  path emits non-compiling C). Once that is fixed, those two forms belong in this
  fixture too.
- String assignment to a **struct parameter's** field emits `.` rather than `->`
  — see **#1256**. Also independent, also found while writing this fixture.
