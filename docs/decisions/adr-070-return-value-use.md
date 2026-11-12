# ADR-070: Mandatory Use of Non-Void Return Values

> **Formerly ADR-115.** Renumbered 2026-08-23 into the `0xx` band — this is
> v1-gating work. See [`README.md`](README.md) for the numbering rule and the full
> mapping table.

**Status:** Implemented (owner confirmed on #1933, 2026-10-17)
**Date:** 2026-06-27 (accepted 2026-06-28)
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-051 (Safe Division), ADR-066 (DO-178C Compliance), ADR-067 (All-Paths-Return), ADR-068 (Forever Loops), ADR-069 (Dead-Code / Reachability)
**Related Issues:** #1080 (this ADR), #847 (MISRA Rule 17.7 `(void)` casts in generated C — the codegen counterpart), #1081 (Rule 21.15, unmasked by the slice-`memcpy` cast)

## Context

cnx today **silently allows a non-void function's return value to be discarded.**
This transpiles without complaint:

```cnx
u32 next() { value <- value + 1; return value; }

i32 main() {
    next();          // return value silently dropped
    return 0;
}
```

Ignoring a return value is a classic embedded foot-gun: a dropped error/status code, a
discarded `safe_div` outcome, an unchecked parse result. cnx's whole premise is "a safer
C" with **explicit data flow** (`<-` for assignment, no implicit conversions, no `switch`
fallthrough, all-paths-return). "You must acknowledge what a function hands back" fits that
philosophy directly — and is exactly the class of bug ADR-066 (DO-178C) and MISRA care about.

### Why the #847 codegen fix is not enough

**#847** made the _generated C_ MISRA C:2012 **Rule 17.7** compliant by emitting a `(void)`
cast on discarded non-void calls. That silences the downstream tool, but does nothing for the
cnx author — the language still lets you silently drop a value you may have wanted. A safer
language should reject the mistake at its own source level, not paper over it in the output.

Work on #847 surfaced that "discarded non-void call" splits into **two cases that must be
handled differently**, and PR #1082 was closed because it conflated them:

| Case                              | Example                                            | Who wrote the call | Correct behavior                                                              |
| --------------------------------- | -------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------- |
| **1. Compiler-internal lowering** | `s <- "x"` → `strncpy`; `buf[0,4] <- v` → `memcpy` | the transpiler     | auto-`(void)` cast — **not** a language change; the author never wrote a call |
| **2. User-written discard**       | `next();`, `printf(...)`, `parse();`               | the developer      | **compile error** unless explicitly discarded                                 |

This ADR governs **Case 2**. Case 1 is uncontroversial codegen (the compiler casting its own
emitted calls) and can ship independently; it is in scope here only so the two are designed
together and the relationship is explicit.

## Decision

> This ADR is **Accepted** (2026-06-28): the design direction below is approved. It is **not yet
> implemented** — the remaining items in "Open Questions" (rollout, unresolvable-return handling)
> are implementation details to settle during the build, not open design decisions.

Make it a **compile error (proposed E0708)** to discard the value of a non-void function call
used as a bare expression statement, **unless** the discard is explicit. Concretely:

```cnx
next();             // E0708 — return value of non-void 'next' is discarded
(void) next();      // OK — explicitly discarded
u32 v <- next();    // OK — used
```

### Recommended model: safe-by-default + explicit `(void)` discard, no exceptions

Two sub-decisions, with **no opt-out mechanism** — cnx is C, and the project principle is
that _exceptions to rules are where bugs come from._

1. **Default — every non-void return must be used or explicitly discarded** (safe-by-default).
   Strongest guarantee, fits cnx's explicit-flow ethos. There is no opt-in/opt-out; the rule
   holds uniformly for every non-void call whose return type cnx can resolve.
2. **Explicit discard syntax — `(void) expr;`, and only `void`.** A cast to any _other_ type
   does not silence the rule: `(u32) next();` throws the value away exactly as completely, so it
   is the silent-discard hole wearing a cast rather than an explicit discard. (Confirmed during
   #1260 review; note cppcheck does not flag it under Rule 17.7, treating any cast as a use —
   cnx is deliberately stricter than the tool here.)

   The form itself is the standard C cast-to-`void`. This is the
   established C idiom for "I am intentionally not using this return value," e.g.
   `(void) printf("not using the return value intentionally!");`. It **parses today**: it is the
   existing ADR-017 cast expression (`'(' type ')' unaryExpression`, with `void` a valid
   `type`), so no new syntax, keyword, or magic identifier is introduced. It is also the _exact
   same token sequence_ the #847 codegen emits for Case 1 — so the author's explicit discard and
   the compiler's auto-discard are one idiom in source and in generated C.

### Considered alternatives

- **Opt-in `must_use` annotation** (Rust's default `#[must_use]`): only annotated functions
  error on discard; everything else is silently discardable. _Rejected as the default stance_ —
  unsafe-by-default contradicts cnx's philosophy; the dangerous case (an un-annotated
  error-returning function) slips through.
- **A `discardable` opt-out** (Swift's `@discardableResult`: annotate functions whose return is
  "usually ignored" so they may be discarded silently). _Rejected._ The opt-out is itself the
  silent-discard hole the rule exists to close — the moment a function is marked `discardable`,
  every dropped return at every call site stops being checked, which is exactly the class of bug
  (a dropped status/error code) this ADR targets. Exceptions to rules are where bugs come from;
  there is no exception.
- **`_ <- expr;` Rust-style sink, or a `discard`/`ignore` keyword** instead of `(void) expr;`:
  _Rejected._ cnx is C, not Swift or Rust — the C cast-to-`void` is the idiom C programmers
  already know, it already parses, and it matches the generated output. A new sink identifier or
  keyword would be a gratuitous divergence from C for no gain.

### Standard-library / C-interop returns

Under safe-by-default, `printf(...)` as a statement errors (it returns `int`). Options:

- **(a) Curated `discardable` stdlib set**: treat the printf-family and similar
  "result usually ignored" libc functions as silently discardable via a curated set. _Rejected_ — same reason as the `discardable`
  opt-out above: a curated carve-out is a standing exception, and exceptions to rules are where
  bugs come from.
- **(b) Require `(void) printf(...)`** everywhere the return is dropped (chosen). Maximally
  explicit and uniform: the rule has no special cases, and a discarded stdlib return reads
  identically to a discarded cnx return. The "noise" is the point — every intentional discard
  is visible at its call site.
- **(c) Exempt all unparsed external C** (functions whose return type cnx cannot see): cnx
  _does_ know many returns (cnx functions, symbols from parsed C headers, and the stdlib map), so
  a blanket exemption under-enforces. The enforce-where-resolvable boundary in (b) is not an
  _exception_ to the rule — it is the rule's domain (you cannot check a return type you cannot
  see); see Open Questions for the unresolvable-return case.

Decision: **(b)** — require an explicit `(void)` cast wherever the return type is known,
including the stdlib. No curated exemption list.

## Architecture

The rule is a **compile-time check over function bodies**, decided before any code is
generated. ADR-067's all-paths-return rule (E0704) is the nearest precedent: same shape, same
concern, and rejecting rather than warning.

Components and constraints:

- **Enforcement:** a diagnostic carrying a code, a position, a message and help text — the
  same shape every other compile-time check reports, so a discarded return is not a special
  kind of failure to a reader or to a build log.
- **Inputs:** the analyzer needs callee return types at analysis time. Those come from the
  return-type knowledge already available to analyzers — cnx functions and scope methods,
  parsed C symbols (via the C resolver), and the stdlib metadata map. A callee whose return is
  `void`, or whose return type is unresolvable, is outside the rule's domain.
- **Single source of truth:** "is this expression statement a discarded non-void call?" is one
  decision, owned by one predicate, shared by the Case 2 enforcement (error) and the Case 1
  codegen (`(void)` cast). The two paths must not re-derive it independently (project "No
  Duplicate Code Paths" rule) — they agree because they consult the same predicate, not by
  coincidence.
- **Discard form:** the explicit discard is the existing `(void)` cast expression (ADR-017); no
  grammar, keyword, or symbol-model addition is required to express it. A cast-to-`void` wrapping
  the call is what suppresses the error.
- **Layer constraint:** `logic/analysis/` must not import from `output/`.

### Error codes (allocated: E0708 is in `docs/error-codes.md`)

| Code  | Meaning                                     |
| ----- | ------------------------------------------- |
| E0708 | Return value of non-void function discarded |

(E0708 is the next free Control-Flow code: E0705/E0707 are used by ADR-068, E0706 is reserved
by ADR-069.)

## What counts as "used"

Settled by this ADR:

- **Used:** bound in a declaration/assignment, passed as a call argument, returned, tested in a
  condition/`switch`, or an operand of any larger expression.
- **Discarded (needs `(void)`):** the call is the _entire_ expression statement.
- A member/element access on the result (`foo().field;`, `foo()[0];`) is **not** a bare call —
  out of scope (it is an unusual statement form; revisit if it appears in practice).

## Relationship to #847 and #1081

- **#847 (Case 1):** the compiler-internal `(void)` casts for `string`/slice lowering are the
  correct, non-breaking half. They can ship independently of this ADR. Full enforcement of
  MISRA Rule 17.7 (i.e. removing it from the baseline) is **blocked on this ADR**, because user
  discards must become errors before the rule holds without per-call casts.
- **#1081 (Rule 21.15):** adding the slice-`memcpy` `(void)` cast unmasks a pre-existing 21.15
  (incompatible `uint8_t*` vs `uintN_t*`). cppcheck reports one rule per line, so 21.15 is
  latent on `main` until the cast lands. Implementing Case 1 here will surface it.
- **safe_div / safe_mod (ADR-051):** these are **not** exempt — the must-use rule applies to
  them like any other non-void function.

  > **Corrected during implementation (#847).** An earlier revision of this ADR exempted them,
  > on the premise that "at the cnx source level these are out-parameter builtins with no
  > bound return". **That premise was factually wrong.** Authors bind the return constantly —
  > `err <- safe_div(result, 10, 2, 0);` appears six times in
  > `tests/arithmetic/safe-div-basic.test.cnx` alone. The exemption appears to have been
  > reasoned from the _generated_ helper without checking the cnx surface.
  >
  > It also contradicted this ADR's own opening argument, which names "a discarded `safe_div`
  > outcome" as a motivating example of the very bug the rule exists to prevent. Exempting the
  > example is not a defensible carve-out, and the ADR's own principle — _exceptions to rules
  > are where bugs come from_ — points the other way.

  `safe_div`/`safe_mod` return `bool` (true on error). A discarded outcome is an **E0708**, and
  an intentional discard is written `(void) safe_div(result, 100, 0, 999);`.

## Breaking-Change Note

Turning user discards into an error is a **breaking change**: every site that currently drops a
non-void return starts failing. Scoping #847 surfaced **100+** such call sites across the test
suite (printf-family, scope getters used as statements, etc.). Rollout strategy is an open
question (below). Every shipped example is transpiled in CI, and that must gate the rule's introduction: the
examples and the test suite must be migrated (wrap each intentional discard in `(void)`) before the
rule turns on.

Sequencing relative to #847: ship Case 1 (compiler-internal casts) first (non-breaking), then
this rule.

## Decided Direction

The owner has set these (they are no longer open):

- **Default stance:** safe-by-default — every resolvable non-void return must be used or
  explicitly discarded. No opt-in (`must_use`) and no opt-out (`discardable`); exceptions to
  rules are where bugs come from.
- **Discard syntax:** the C cast-to-`void`, `(void) expr;` (ADR-017, parses today). No new
  sink identifier or keyword.
- **stdlib handling:** no curated carve-out — `(void)` is required at every dropped stdlib
  return whose type is resolvable, identical to cnx calls.

## Settled During Implementation (#847)

The questions left open above were implementation details, and the build settled them:

- **Unknown external C — resolve it where visible, exempt only where it is not.** Functions
  declared in included C **and** C++ headers are resolvable, and both are consulted — not only
  the cnx include graph, which is a third and separate source. So
  `global.spi_device_init(...)` declared in a `.h` is enforced. A name that resolves through neither route is
  outside the rule's domain — not exempted from it.

  > `.h` and `.hpp` symbols live in **separate indexes**. An earlier revision of this section
  > claimed C/C++ headers were resolvable when only the C half was wired, so a non-void function
  > from an included `.hpp` was silently exempt while its `.h` twin was an error. Corrected in
  > review of #1260; both halves are now consulted, with a fixture each.

- **Rollout — straight to an error, no flag.** The suite and examples were migrated in the same
  change (61 author-written discards), so there is no window in which a flag would have had
  anything to guard. A flag would also have been a second code path deciding the same question.
- **Error code — E0708 confirmed**, and allocated in `docs/error-codes.md`.

### Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must
be. Undeclared cells are `off`.

E0708 fires on an **expression statement** whose entire value is a discarded
call. That single fact decides the context axis, because cnx only admits an
expression statement inside a function body:

- **top-level function** and **scope method** are where the construct lives, so
  every file relationship in those rows is `error`.
- **global variable** and **scope member** are `off`, and this is a claim about
  the grammar rather than about coverage. Writing `next();` at file scope or in
  a scope-member position is not an unenforced case — it is a parse error
  (`no viable alternative at input 'next('`), verified both ways. There is no
  program in which E0708 could fire in those contexts, so a fixture cannot be
  written for them.
- **for header** is `off` as well. A call inside a `for` header's declaration
  (`for (mut u32 i <- next(); ...)`) is the initializer, so its value is used,
  and a bare call in the initializer position (`for (next(); ...)`) is a parse
  error. The header's condition and update belong to the enclosing function.

The relationship axis carries no such argument. The callee's return type is what
the rule needs, and it may be declared in the same file, one `.cnx` include away,
or reached through an intermediate — and #847 shipped with the cross-file case
silently unenforced precisely because nothing exercised it. All three
relationships are `error` in both live rows.

<!-- MATRIX-SEVERITY code: E0708 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | error    |
| scope member       | same file           | off      |
| scope method       | same file           | error    |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | error    |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | error    |
| for header         | imported transitive | off      |

off: E0708 cannot fire in a global-variable or scope-member position, because a bare call there is a parse error; nor inside a `for` header's declaration, where a call is the initializer, whose value is used (a bare call as the `for` initializer is itself a parse error).

Six cells are `error` and all six are occupied — see
`docs/scope-context-matrix.md`. Three of the six were reached only by fixtures
written for this declaration (`scope-method-imported-discard`,
`transitive-function-discard`, `transitive-scope-method-discard`); the
declaration is what showed they were missing.

The two provider-side relationships carry no declaration: `.expected.error`
holds no file path, so occupancy for them is not derivable and the report
renders them `n/a` rather than counting them empty.

#### What this matrix cannot see

Recorded because #847's review found three enforcement gaps and this matrix
would have caught only one of them — the cross-file case above.

- **Syntactic form.** A bare `read()` and a qualified `this.read()` inside the
  same scope method derive the _same_ cell, so a fixture using one leaves the
  cell green while the other is unenforced. That is exactly what happened: the
  qualified spelling was checked, the bare one — which CLAUDE.md makes house
  style — was not. #1210 records the same shape for a different rule.
- **External-header provenance.** The relationship axis counts `.cnx` include
  hops only, so a callee declared in a `.h` or a `.hpp` is indistinguishable
  from a same-file one. `.h` and `.hpp` symbols live in separate indexes, and
  the `.hpp` half was silently exempt while the `.h` half errored.

Neither is a defect in this declaration; both are limits of the axes. The
fixtures for those two dimensions exist (`bare-intra-scope-discard`,
`external-c-discard`, `external-cpp-discard`) and are marked `// test-adr: 070`,
but they occupy cells that other fixtures already occupy, so the gate cannot
require them.

## Implementation Notes (#847)

- **Case 1 has one producer.** Every lowered `strncpy`/`strncat` the string operations emit
  carries the `(void)` cast as part of what is produced, from a single place. Two of those
  sequences were previously rebuilt separately; they now come from the one producer, so the
  cast cannot be present in one lowering and missing from another. Since #2207 and #1902 that
  producer, `StringUtils`, lowers every string write to the `void` helper `cnx_string_copy`, so
  nothing is left for Case 1 to cast (#2403).
- **Case 2 reports E0708** when a resolvable non-void call is the entire expression
  statement.
- **ADR-016 qualifiers are separate tokens.** `this.member()` and `global.Scope.member()` do
  not present as `IDENTIFIER` primaries. An implementation that only handled identifiers would
  silently pass exactly the scope getters this rule is meant to catch — the analyzer resolves
  all three forms.
- **ADR-057's bare intra-scope call needs a scope fallback.** `functionReturnTypes` is keyed by
  transpiled C name, so a bare `read()` inside `scope Timer` misses the lookup that
  `this.read()` hits. Without the fallback the rule would be enforced on the qualified spelling
  and silently skipped on the one CLAUDE.md makes house style — the same key-by-layer defect
  `tests/bugs/issue-1210-bare-intra-scope-call/` records. "When does an unqualified name mean a
  scope member" is answered once and shared, not decided again per rule: two rules that agree
  today only because they were written from the same understanding will diverge the first time
  one is edited.
- **Scope names must come from the include-merged set.** Scopes merged across `.cnx` includes,
  not a per-file collection: with the latter every cross-file `Helper.compute()` is
  unrecognized as a call at all, which is a _name_-resolution gap rather than the documented
  "return type you cannot see" boundary.
- **Stdlib metadata is one list.** "Which header declares this name" and "does it return void"
  are answered from the same place, shared with the other rule that asks them.
- **MISRA Rules 17.7 and 11.8 are both enforced, neither baselined.** Removing 17.7 unmasked a
  pre-existing Rule 11.8 const-discard (cppcheck reports one rule per line), filed as **#1259**.
  It turned out to be the same defect from the other side: const inference walks statements
  looking for modifications and did not descend through a cast, so making `(void)` the
  sanctioned discard idiom would have hidden every discarded call from it — silently flipping a
  mutating callee's argument to `const`. Seeing through the cast fixes #1259 and is what makes
  the `(void)` idiom safe to recommend at all. A discard syntax is not inert: it changes what
  every other analysis can see.

## Prior Art

| Language  | Mechanism                                              | Default                                           | Explicit discard        |
| --------- | ------------------------------------------------------ | ------------------------------------------------- | ----------------------- |
| **Swift** | `@discardableResult`                                   | **must-use** (since Swift 3, reversed for safety) | assign to `_`           |
| **Rust**  | `#[must_use]` (warn) / `unused_results` (allow)        | opt-in must-use                                   | `let _ = e;` / `_ = e;` |
| **C++**   | `[[nodiscard]]` / `[[nodiscard("reason")]]` (C++17/20) | opt-in; cast-to-`void` exempt                     | `(void)e;`              |
| **Go**    | `errcheck` / `go vet` (lint, not language)             | tool-enforced                                     | `_ = e`                 |

cnx takes the **strictest** stance: safe-by-default like Swift's _default_, but with **no
opt-out** at all (stricter than Swift/Rust/C++), and the discard form is **C's own
`(void)` cast** (as in C++'s `[[nodiscard]]` exemption) rather than a borrowed sink or keyword —
cnx is C.

## References

- Issue #1080 (this ADR's tracking issue, with the original design discussion)
- Issue #847 (MISRA Rule 17.7 `(void)` casts — Case 1 codegen counterpart)
- Issue #1081 (MISRA Rule 21.15 — unmasked by the slice-`memcpy` cast)
- ADR-067 / ADR-069 (all-paths-return and reachability: the E0704 precedent)
- ADR-068 (Forever Loops — most recent compile-time control-flow rejection precedent)
- ADR-066 (DO-178C Compliance — frames unchecked returns as a certification concern)
- `docs/error-codes.md` (E07xx Control-Flow range; E0708 next free)
- MISRA C:2012 Rule 17.7 (the output-level rule #847 satisfies)
- Rust `unused_must_use` / `unused_results` lints; RFC 1940 (must-use functions)
- C++ `[[nodiscard]]` (cppreference); Swift `@discardableResult`
