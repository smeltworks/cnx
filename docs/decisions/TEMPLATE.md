# ADR-NNN: Title

> Copy this file to `adr-NNN-short-stem.md` and delete every `<!-- guidance -->`
> comment as you fill it in. The band `NNN` sits in is a commitment about which
> release the decision must ship in — see [`README.md`](README.md) before
> choosing a number.
>
> **The rewrite test governs every section below.** If the transpiler were
> rebuilt from scratch in a different language and stack, this document must
> still be fully applicable. It decides something about the _cnx language_;
> it does not record how today's TypeScript/ANTLR/Node implementation satisfies
> that decision. What that admits and excludes is listed once, in
> [`README.md`](README.md#the-rewrite-test) — read it before you fill in
> anything below.

**Status:** Research
**Date:** YYYY-MM-DD
**Decision Makers:**
**Related ADRs:**
**Related Issues:**

<!-- Status is one of Research / Accepted / WIP / Implemented / Rejected /
     Superseded. It starts at Research and only the owner moves it. Nobody
     else changes this line, in any circumstance. -->

## Context

<!-- What is true today that makes this worth deciding, and what goes wrong if
     nothing changes. Show the current behavior rather than describing it —
     a transpiled snippet is worth a paragraph. If a rule is being added, this
     is where the bug it prevents belongs.

     "Show it" means the cnx that triggers the behavior and the C or C++ it
     currently generates. Both survive a rewrite: they are what the language
     promises, observable from outside. The TypeScript that produces them does
     not, and pasting it here is the single most common way an ADR rots —
     ADR-013's const-checking method moved file and became static, and the ADR
     still describes the old shape. If a passage is only true of the current
     implementation, it belongs in `docs/implementation/`. -->

## Decision

<!-- What cnx does, stated so an implementer needs nothing else. Say what is
     REJECTED as well as what is chosen: an ADR that lists only the choice
     leaves the next reader re-litigating the alternatives.

     If the decision changes what compiles, say so plainly here. -->

## Diagnostics

<!-- Every error code this ADR introduces, with the exact message and the fixture
     that asserts it. Allocate the code in `docs/error-codes.md` in the same
     change; a code reserved and never allocated reads as implemented when it is
     not. Omit this section only if the ADR adds no diagnostic.

     Name the FIXTURE, not the module that raises the diagnostic. A rewrite
     keeps the conformance corpus and discards every module name, so a fixture
     path is the citation that survives it — and it fails loudly when it stops
     resolving, which a prose module name never does. ADR-063 is the worked
     example; ADR-016 names `SymbolTable.detectCnxDuplicate` and is what this
     guidance exists to prevent. -->

| Code | Meaning | Asserted by |
| ---- | ------- | ----------- |

## Scope-Context Matrix (#1219)

<!-- REQUIRED for any ADR whose behavior a fixture can observe. Do not skip it
     because the gate does not force you: undeclared cells default to `off`, so
     skipping is indistinguishable from claiming the feature cannot occur
     anywhere, and that claim is almost never true.

     Severity follows the eslint model:
       off   — this cell CANNOT EXIST for this feature
       warn  — it should be covered and is not, yet
       error — it must be covered

     `off` is the one that gets people into trouble. It is a claim about the
     grammar or the semantics, and it is reviewed as one. Before writing `off`,
     try to WRITE the program that would occupy the cell. If it is a parse
     error, say so and quote it. If it merely has no fixture, the cell is
     `error` or `warn` — never `off`.

     Never declare a cell because a fixture happens to occupy it. Declare the
     obligation the feature has, then run `npm run coverage:matrix` and let the
     tool report occupancy. Working backwards from the corpus produces a matrix
     that measures what you already wrote.

     Where a cell should be `error` and nothing reaches it, write the fixture.
     Where writing it is a project rather than an afternoon, declare `warn`,
     say plainly here why, and file the follow-up. ADR-051 held eight cells at
     `warn` while the transpiler defect behind them was open, and promoted them
     when it was fixed — that staging is legitimate and documented. Declaring
     `off` because `error` would be red is not.

     Mark each fixture with `// test-adr: NNN`. -->

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           |          |
| top-level function | same file           |          |
| scope member       | same file           |          |
| scope method       | same file           |          |
| global variable    | imported direct     |          |
| top-level function | imported direct     |          |
| scope member       | imported direct     |          |
| scope method       | imported direct     |          |
| global variable    | imported transitive |          |
| top-level function | imported transitive |          |
| scope member       | imported transitive |          |
| scope method       | imported transitive |          |

<!-- How the relationship axis is measured (#1402, #1523):

     Per position, over the include graph the transpiler resolved -- `.cnx`,
     `.h` and `.hpp` edges alike, nearest path first. A diagnostic or a
     recording site in the fixture is measured to the declaration it is about
     (`declaredAt`, set by the pass that decided it): 0 hops is `same file`,
     1 is `imported direct`, 2 or more is `imported transitive`. A rule that
     fires inside an included file is measured to that file: 1 hop is
     `exercised from one away`, 2 or more `exercised through chain`. A
     position with no declaration measures `same file` only in a fixture that
     includes nothing; anywhere else it occupies no cell, it is never guessed.
     So declare an imported cell `off` when the diagnostic can only be about
     a declaration in the file being transpiled, and say why under the table.

     A codegen-only ADR CAN occupy a cell — #1241 (2026-08-29) made occupancy
     derive from diagnostic positions union ADR provenance. It costs one line
     at the decision itself, `AdrProvenance.record("NNN", line)`. An ADR with
     no recording site occupies nothing, so declare `error` and add the
     recording site rather than declaring `warn` and calling it a tooling gap.

     Two things the axes cannot see at all, worth knowing before you trust a
     green row:

     - SYNTACTIC FORM. A bare `read()` and a qualified `this.read()` inside the
       same scope method derive the same cell. A rule enforced on one spelling
       and not the other shows green. This has happened twice (#1210, #1260).
     - DECLARATION KIND. A local, a parameter and a `for` variable doing the
       same thing in the same function derive the same cell, and they reach
       codegen by different paths. ADR-057's scope-method row was green from
       a shadowing local while a shadowing parameter was wrong (#1290).

     If your feature can be written more than one way, can be done by more than
     one kind of declaration, or resolves symbols from C or C++ headers, write
     fixtures for those forms anyway. They will not
     occupy distinct cells, but they will fail when someone breaks one spelling.

     Worked example: ADR-051 section 5, including how it staged warn -> error.
     Second example: ADR-070, including how it argues two rows to `off`. -->

## Consequences

<!-- What this costs. Breaking changes, migration size (measured, not
     estimated), interactions with other ADRs, and anything it forecloses. -->

## Open Questions

<!-- Genuinely undecided things. Move them into the Decision as they settle,
     and say who settled them. An Open Question still open when the ADR reaches
     Implemented is a contradiction worth catching in review. -->

## References

<!-- Issues, standards clauses, prior art, and the fixtures that hold the
     decision to account. Cite a path or a command, not recollection.

     NOT the implementing modules. That requirement used to live here and it
     mandated exactly what the rewrite test forbids — see CLAUDE.md. A pointer
     into `src/` belongs in `docs/implementation/`, where going stale is
     expected and harmless.

     A fixture path is the strongest citation available to an ADR: it survives a
     rewrite, and it is the one kind of reference that fails when the decision
     it documents stops being true. -->
