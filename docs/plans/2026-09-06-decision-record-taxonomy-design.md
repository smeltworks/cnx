# Decision-Record Taxonomy Design

**Date:** 2026-09-06
**Issue:** [#1522](https://github.com/smeltworks/cnx/issues/1522)
**Status:** Approved

## Summary

Give every long-lived document in `docs/` a series, a stable number, and a gate. Four series
draw from one shared number ledger: `ADR-NNN` for cnx language decisions, `PDR-NNN` for
project and toolchain decisions, `ARC-NNN` for architecture descriptions, `IMP-NNN` for
implementation descriptions. Decision records carry a Status; descriptions never do, and that
difference is what the gate enforces. Generate the index from the files instead of maintaining
it by hand.

## Goals

1. Give a non-language decision a home, so it is not exiled into a folder meant for descriptions
2. Make the category of a document observable and gated, not conventional
3. Give every long-lived document a number that survives a rename — 8 `src/**` comments cite
   architecture docs by path today, and a path is what breaks when a file moves
4. Remove the hand-maintained index as a drift source
5. Settle ADR-010's category, so the C/C++ interop matrix has a stable file to declare against

## Non-Goals

- The C/C++ interop testing matrix itself. Tracked separately; this work only unblocks it.
- Renumbering any existing document. Every migrated file keeps its number and changes only its
  prefix, so no `.test.cnx` fixture comment changes and no snapshot regeneration. Description
  _paths_ do change, in steps 5 and 6.
- Changing the rewrite test or any of its rules. All 70 ADRs pass it today and must continue to.

## Context

### The gap

The rewrite test (#1403) admits only decisions about the cnx language:

> If the transpiler were rebuilt from scratch in a different language and stack, every ADR must
> still be fully applicable.

That is the right test, and `npm run adr:independence:check` enforces it — measured
2026-09-06, it reports "Scanned 70 ADR(s) ... Rewrite test passed for every ADR." But the test
says only what an ADR may _not_ contain. It does not say where a genuine decision that fails it
should live. #1403 answered by moving six retired ADRs into `docs/architecture/` and
`docs/implementation/`, and the outcome splits cleanly along a line nobody drew on purpose:

| Retired | Moved to                                      | Kept a `**Status:**` line |
| ------- | --------------------------------------------- | ------------------------- |
| `011`   | `docs/implementation/vscode-extension.md`     | yes — `Implemented`       |
| `012`   | `docs/implementation/static-analysis.md`      | yes — `Implemented`       |
| `048`   | `docs/implementation/cli-distribution.md`     | yes — `Implemented`       |
| `060`   | `docs/implementation/extension-separation.md` | yes — `Research`          |
| `055`   | `docs/architecture/symbol-resolution.md`      | no                        |
| `065`   | `docs/architecture/codegen-decomposition.md`  | no                        |

The bottom two genuinely became descriptions and shed their lifecycle. The top four are still
decision records — `extension-separation.md` sits at **Research**, an ADR lifecycle state, in a
folder whose stated purpose is documenting work already carried out. They were moved for want
of anywhere better.

### Two bugs this surfaces

Both are fixed by this work rather than filed, per the project's bug-tracking rule.

1. **A stale status nothing can detect.** `docs/implementation/adr-045-string-implementation.md`
   reads `**Status:** Ready for Implementation`; `ADR-045` itself reads `**Status:** Implemented`.
   A description grew a lifecycle field, and the two now contradict each other with nothing
   failing in between.
2. **The index has already drifted.** `docs/architecture-decisions.md` lists 68 ADRs; 70 exist
   on disk. **ADR-061 (C Library Interoperability)** and **ADR-062** are absent. Its ADR-010 row
   also describes the decision as "Unified ANTLR parser architecture", which the split below
   makes wrong. The file is hand-maintained, so adding a record and adding a row are two actions
   and only one of them is enforced — the "update it in two places" anti-pattern, expressed in
   Markdown.

### Two status formats

Every ADR carries a status, but in one of two incompatible shapes (measured 2026-09-06):

| Shape                                                              | Count  | Example                   |
| ------------------------------------------------------------------ | ------ | ------------------------- |
| Header block — `**Status:** Implemented` (what `TEMPLATE.md` uses) | **37** | ADR-010, ADR-016          |
| Section — `## Status` followed by `**Implemented**`                | **33** | ADR-017, ADR-051, ADR-061 |
| Neither                                                            | 0      | —                         |

Any tool that reads a status must therefore handle both shapes forever, or silently miss a third
of the corpus. That is the same "one fact, two representations" anti-pattern the project forbids
in code, expressed in Markdown. The migration normalizes all 70 records to the template form and
the gate enforces that exactly one shape exists.

## Decision

### Four series

| Directory                 | Holds                                            | Prefix | Status        | Rewrite test | Bands | Matrix |
| ------------------------- | ------------------------------------------------ | ------ | ------------- | ------------ | ----- | ------ |
| `docs/cnx-spec-adrs/`     | decisions about the **cnx language**             | `ADR`  | **required**  | yes          | yes   | yes    |
| `docs/project-decisions/` | decisions about the **project/toolchain**        | `PDR`  | **required**  | no           | yes   | no     |
| `docs/architecture/`      | descriptions of how the transpiler is structured | `ARC`  | **forbidden** | no           | no    | no     |
| `docs/implementation/`    | descriptions of how one decision is carried out  | `IMP`  | **forbidden** | no           | no    | no     |

`docs/plans/` is out of scope and stays as it is: dated, unnumbered, and ephemeral by design.

**Numbering and lifecycle are orthogonal, and keeping them so is what makes the gate possible.**
A number is _stable identity_ — it survives a rename, which is exactly what 8 `src/**` comments
citing architecture docs by path need. A Status is _lifecycle_ — it says a document describes
something in flight. A description gets the first and never the second, so a series either has
statuses or it does not, and **that** is the observable difference between a decision record and
a description. If descriptions carried statuses there would be four series with no structural
difference between them, and the split would be back to convention with a gate that cannot tell
the categories apart.

The band gate follows from this rather than needing an exemption: it asks whether every
non-terminal record in band `N` is Implemented, and a description has no status to be
non-terminal, so it can never block a release.

### Numbering: one ledger, four prefixes

**A number is allocated once, ever, to one document. The prefix says which series holds it. The
band says which release it must ship in — for the two decision series only.** All four series
draw from the same ledger, so `011` names exactly one document whether it is written `ADR-011` or
`PDR-011`, and `055` names exactly one whether written `ADR-055` or `ARC-055`.

This is a strengthening of the existing guarantee, not a change to it. `docs/decisions/README.md`
promises that a number "can never resolve to a different decision than the one its author meant"
— and `PDR-011` _is_ `ADR-011`, the same decision relocated to a series that fits it. Every
migrated document therefore **keeps its number and changes only its prefix**, so a reference in
an old commit resolves to a document still bearing the number its author wrote rather than to a
table row pointing somewhere else. That is what collapses #1403's retirement table: all six
retirees are recategorized, none is redirected.

A new document in any series takes the next free number in the shared ledger. A new **decision**
also picks its band by the same question an ADR asks: _which release must this ship in?_ The
mechanism half of ADR-010 is therefore `PDR-071` — the next free number, band `0xx`, Status
Implemented. The five architecture descriptions with no ADR ancestry take `072`–`076`.

A description consuming a number that falls inside a band range is **not** a band claim. The
ledger is a numbering space; a band is a property only decision records have, and a description
has no Status for the band gate to read.

**PDRs are band-gated on the same terms as ADRs; ARC and IMP are not band-gated at all.** Cutting
`v(N+1)` requires every non-terminal record in band `N` to be Implemented, across **both decision
series**. A release needs its toolchain and distribution story as much as its language surface,
so a project decision that v1 depends on should block v1 — the release gate becomes more honest,
not merely broader.

The practical cost is one new v1 blocker. Verified 2026-09-06: `vscode-extension`,
`static-analysis` and `cli-distribution` are all `Implemented`, but `extension-separation`
(`PDR-060`) is `Research`, so it must be implemented, moved to band `1xx` by the documented
`git mv` procedure, or marked terminal before v1 is cut.

Because bands apply to both decision series identically, no reserved number range is needed and
no grandfathered exception set exists: `PDR-071` in band `0xx` means exactly what it appears to
mean.

### Initial population

**Decision series.** Four migrated from #1403's retirees, one new from the ADR-010 split.

| New       | From                                                        | Band  | Status                      |
| --------- | ----------------------------------------------------------- | ----- | --------------------------- |
| `PDR-011` | `docs/implementation/vscode-extension.md` (was ADR-011)     | `0xx` | Implemented                 |
| `PDR-012` | `docs/implementation/static-analysis.md` (was ADR-012)      | `0xx` | Implemented                 |
| `PDR-048` | `docs/implementation/cli-distribution.md` (was ADR-048)     | `0xx` | Implemented                 |
| `PDR-060` | `docs/implementation/extension-separation.md` (was ADR-060) | `0xx` | **Research — a v1 blocker** |
| `PDR-071` | new — the mechanism half of ADR-010                         | `0xx` | Implemented                 |

**Architecture series.** Two keep numbers they already carry in their own headers; five need new
ones, allocated alphabetically from the next free run.

| New       | From                             | Note                                                             |
| --------- | -------------------------------- | ---------------------------------------------------------------- |
| `ARC-055` | `symbol-resolution.md`           | header already reads "Formerly ADR-055"                          |
| `ARC-065` | `codegen-decomposition.md`       | header already reads "Formerly ADR-065, and ADR-109 before that" |
| `ARC-072` | `module-destinations.md`         | new number                                                       |
| `ARC-073` | `output-throw-classification.md` | new number; citation-gated, see below                            |
| `ARC-074` | `scope-join-sites.md`            | new number; **generated**, see below                             |
| `ARC-075` | `symbol-store-prior-art.md`      | new number                                                       |
| `ARC-076` | `symbol-view-scopes.md`          | new number                                                       |

`docs/architecture/README.md` is the series README, not a member. `dependency-graph.svg` is an
asset, not a member. The gate therefore keys on `*.md` excluding `README.md`.

Two of these are not hand-authored, and their headers must come from the same place their content
does:

- **`ARC-074` is generated** by `scripts/scope-join-sites.ts` (`docPath`, line 22) and gated by
  `scope-joins:check`. Its `ARC-074` number and `**Summary:**` become generator output, not text
  a person edits, and the generator's path constant changes with the rename.
- **`ARC-073` is citation-gated** by `docs:throw-citations:check`, whose filename constant sits at
  `scripts/throw-citations.ts:40`. The rename touches that constant. The citations themselves are
  `file:line` into `src/`, unaffected by a docs rename.

**Implementation series.** Starts **empty**. Its only current occupant,
`adr-045-string-implementation.md`, is a plan, not a description — it carries
`**Estimated Phases:** 4` and the stale `**Status:** Ready for Implementation` — so it moves to
`docs/plans/2025-12-31-adr-045-string-implementation.md`, keeping its authoring date (`b35c5d81`,
2025-12-31). `docs/implementation/` keeps a README defining the series; `IMP-NNN` numbers are
allocated from the shared ledger when the first real implementation description is written.

### The retirement table collapses

#1403's table redirected six numbers to paths. Under one ledger every retiree keeps its number,
so five of its six rows become recategorizations and the table states a rule rather than six
exceptions:

| Number                  | Fate                             | Resolves to                                |
| ----------------------- | -------------------------------- | ------------------------------------------ |
| `011` `012` `048` `060` | recategorized                    | `PDR-011`, `PDR-012`, `PDR-048`, `PDR-060` |
| `055` `065`             | recategorized                    | `ARC-055`, `ARC-065`                       |
| `053`                   | withdrawn — no document survives | nothing; permanently retired               |
| `059` `107`             | never allocated                  | nothing; never will be                     |

Only `053` remains a genuine retirement, because nothing was moved: it was withdrawn for
describing the transpiler's pipeline rather than deciding anything, and no document carries its
content forward.

### ADR-010 splits

ADR-010 currently carries a language promise and a parser-architecture decision in one file. It
passes the independence gate — which catches `src/**` paths and transpiler identifiers, not "we
chose ANTLR" — but its title is "C/C++ Interoperability **via Unified ANTLR Parsing**" and its
Decision section is a component diagram.

**ADR-010 keeps** (the promise a rebuild in another stack still owes):

- No declaration files, no extern blocks, no special syntax
- `.c` / `.h` / `.cpp` / `.hpp` are consumed as-is
- What the emitted `#include` names
- The limits of the boundary — what cnx promises to understand from a C/C++ header
- A `MATRIX-SEVERITY` table, once the interop matrix exists

**PDR-071 takes** (the mechanism):

- Why vendored ANTLR grammars over libclang, a hand-written parser, or declaration files
- C and CPP14 grammar caveats, preprocessor handling
- Implementation phases and status

The number `010` does not move, so every existing reference resolves unchanged.

The boundary-limits section is the load-bearing part of this split. Read as spec it states what
cnx promises to understand at the boundary; read as implementation it states which grammar
was vendored. The interop matrix will derive its `off` cells from the first reading, so this
section must live where it is reviewed as a language promise.

### Sweep

Only three ADRs carry mechanism-shaped `Implementation Phases` / `Implementation Status`
sections: **010, 016, 051**. The 21 ADRs that mention a toolchain are almost all ` ```antlr `
grammar fences, which the in/out list explicitly permits, plus ADR-070 citing cppcheck's
interpretation of a MISRA rule, which is evidence about the rule rather than implementation
detail. 016 and 051 are reviewed in this work; neither is expected to need a split.

## The gate

`adr:independence:check` becomes `docs:taxonomy:check` — **one** scanner with per-series
rulesets. A second scanner would duplicate the directory walk, the front-matter read and the
violation reporting that `AdrIndependence` (312 lines) already performs, and the two would
diverge the first time a rule changed.

| Directory            | Must have                       | Must not have                              |
| -------------------- | ------------------------------- | ------------------------------------------ |
| `cnx-spec-adrs/`     | `adr-NNN-*.md`, Status, Summary | _(existing rewrite-test rules, unchanged)_ |
| `project-decisions/` | `pdr-NNN-*.md`, Status, Summary | a `MATRIX-SEVERITY` table                  |
| `architecture/`      | `arc-NNN-*.md`, Summary         | a status declaration, in **either** shape  |
| `implementation/`    | `imp-NNN-*.md`, Summary         | a status declaration, in **either** shape  |

Plus three mechanical invariants: exactly one status shape exists corpus-wide, **no number is
used twice across all four series** (one ledger, so the collision check spans the whole of
`docs/`, not one folder), and the numbering README's allocation table matches what is on disk.

**Only the two fields tooling consumes are required.** `## Context`, `## Decision` and a
rejected-alternatives section are deliberately NOT gated: 15 ADRs express their decision under
another heading (ADR-016 uses `## Proposal:`, ADR-004 uses `## Research:`) and 2 of the 4 PDR
candidates have no alternatives section. Requiring them would mean editing prose to satisfy a
linter, which is the gate driving the content rather than measuring it. The rewrite test and
human review keep covering section quality.

The status rule is the load-bearing one. It is the only invariant here that fails on the case it
exists to catch: filename patterns and collision checks would never have flagged the four
mis-filed ADRs, because those files had perfectly good names. `adr-045-string-implementation.md`
proves the rule fires on real content today.

It must reject **both** shapes in a description, not only the template form. Normalizing decision
records to one shape does not stop a description from acquiring the other, so a check that knew
only `**Status:**` would have a hole exactly where someone would naturally write one.

Runs in the **`lint`** job, where the current independence check runs. It is not added to
`test:all`, which must stay update-free to remain a gate.

## The generated index

`docs/architecture-decisions.md` is **renamed to `docs/document-index.md`** and becomes generated
and gated. Its current name stops being true the moment `ARC` exists: it would list architecture
documents that are explicitly _not_ decisions, under a heading saying they are.

It follows the `scope-context-matrix.md` and `diagnostic-manifest.md` pattern: `npm run
docs:index` writes, `docs:index:check` regenerates in memory and diffs against what is committed,
and the output carries the `<!-- GENERATED FILE - DO NOT EDIT -->` header and no timestamp.

The two kinds of series render differently, because they answer different questions:

- **Decision series** (`ADR`, `PDR`) — grouped by Status, since "what is still in flight?" is the
  question a reader has. Number, title, summary, band.
- **Description series** (`ARC`, `IMP`) — one flat table each, since a description has no Status
  to group by. Number, title, summary.

Because migration step 1 normalizes the corpus, the generator reads exactly one status shape. It
is deliberately not given a both-shapes parser, which would let the duplicate representation
survive behind it.

Its Description column needs a source. ADRs have none — only 1 of 70 carries a `**Summary:**`
field — while the 68 descriptions that exist live in the index itself, away from the records they
describe. That separation _is_ the drift: nothing ties ADR-010's row to ADR-010, which is why the
row still describes a decision the file no longer makes. The fix is a one-time transfer, not an
authoring job: lift each description into a required `**Summary:**` field on its own record,
author two for ADR-061 and ADR-062, and add the field to all four templates. The `ARC` and `IMP`
summaries are authored during steps 5 and 6, since those documents were never in the old index.

## Migration

Ordered so each step is independently reviewable.

1. **Normalize status and backfill `**Summary:**`** across all 70 ADRs: move the 33 section-style
   statuses into the template's header block, and lift each record's description out of the index
   into a `**Summary:**` field. Author the two missing descriptions (ADR-061, ADR-062) and add the
   field to `TEMPLATE.md`. No moves, so every diff is confined to a file's header.
2. **`git mv docs/decisions docs/cnx-spec-adrs`.** Pure rename.
3. **Create `docs/project-decisions/`** with its README and TEMPLATE; move the four #1403 retirees
   in as PDR-011, PDR-012, PDR-048 and PDR-060, each keeping its original number; replace the
   numbering README's redirect table with the recategorization table above.
4. **Split ADR-010** into ADR-010 + PDR-071.
5. **Number the architecture series**: rename the seven `docs/architecture/*.md` members to
   `arc-NNN-<stem>.md`, add `**Summary:**` to each, and update the 33 references — 8 of them in
   `src/**` comments. Update `scripts/scope-join-sites.ts` (`docPath`) and
   `scripts/throw-citations.ts:40`, and make the `ARC-074` header generator output.
6. **Establish the implementation series**: move `adr-045-string-implementation.md` to
   `docs/plans/2025-12-31-adr-045-string-implementation.md` (which also resolves its stale-status
   bug), leave `docs/implementation/` holding only its series README, and update the 24 references
   to `docs/implementation/` paths.
7. **Generate the index** (`docs:index` / `:check`), covering all four series.
8. **Extend the gate** to `docs:taxonomy:check` with the per-series rulesets.

Step 1 precedes step 2 deliberately. Combining them would render every file as "moved +
modified", burying 70 one-line additions inside a 32-file path substitution. Keeping them apart
lets `git mv` rename-detection stay clean, so step 2's diff reads as a pure rename — the only way
a reviewer can confirm no content changed during the move. Steps 5 and 6 follow the same
discipline: each renames one series and updates its references, so a reviewer sees one
substitution at a time.

Steps 3–6 each touch the shared ledger, so the numbering README's allocation table is updated in
the same commit as the moves it records — the gate checks that table against disk, and a step that
moved files without updating it would go red on the next step rather than its own.

### Blast radius (measured 2026-09-06)

| What                                                | Count | Notes                                                                                                           |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Textual `docs/decisions` occurrences                | 47    | across 32 files                                                                                                 |
| Hardcoded `decisions` path constants                | 3     | `adr-matrix.ts:28`, `AdrIndependence.ts:288`, `adr-independence.test.ts:215`                                    |
| Doc-comment mentions in code                        | 5     | `adr-independence.ts:37`, `AdrIndependence.ts:13,280`, `IAdrIndependenceOutcome.ts:4`, `cspell-scope.test.ts:5` |
| Config and skills                                   | 3     | `.github/ISSUE_TEMPLATE/release.md:28`, `cnx-way/SKILL.md:76`, `start-issue/SKILL.md:293`                       |
| References to `docs/architecture/` paths            | 33    | **8 in `src/**` comments\*\*                                                                                    |
| Hardcoded architecture-doc paths in gates           | 2     | `scope-join-sites.ts:22` (generator), `throw-citations.ts:40` (checker)                                         |
| References to `docs/implementation/` paths          | 24    | —                                                                                                               |
| Relative sibling links inside `decisions/`          | 56    | unaffected by a folder rename                                                                                   |
| `.test.cnx` fixtures referencing any of these paths | **0** | 461 reference ADR _numbers_, which do not move                                                                  |

Because no fixture references any of these paths and no number changes, `npm run test:update` is
**not** required and no snapshot may change. A snapshot diff during this work indicates a mistake.

The `src/**` citations are the reason for numbering descriptions in the first place: this
migration pays the cost of updating 8 of them once, so that the next move of an architecture
document costs nothing — `ARC-055` survives a rename, `docs/architecture/symbol-resolution.md`
does not.

## Testing

Each gate rule gets a mutation check, because a gate that cannot fail on its own case is the
`/* test-no-warnings */` shape (#1143).

| Gate rule                              | Mutation                                        | Expected                                         |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------ |
| No status in descriptions              | add `**Status:** Research` to an `ARC` file     | `docs:taxonomy:check` red                        |
| No status in descriptions, other shape | add a `## Status` section to an `ARC` file      | red — the hole a template-only check would leave |
| Status required in decisions           | remove the Status line from an ADR              | red                                              |
| One status shape                       | revert one ADR to the `## Status` section form  | red                                              |
| Summary required, all four series      | remove `**Summary:**` from an `ARC` file        | red                                              |
| PDRs own no matrix                     | add a `MATRIX-SEVERITY` table to a PDR          | red                                              |
| One ledger, no cross-series collisions | number an `ARC` file with a number an ADR holds | red                                              |
| No duplicate numbers within a series   | duplicate a number in `project-decisions/`      | red                                              |
| Filename pattern                       | add `notes.md` to `architecture/`               | red                                              |
| README/disk agreement                  | delete a row from the allocation table          | red                                              |
| Index is current                       | delete a row from the generated index           | `docs:index:check` red                           |
| Rewrite test unchanged                 | add a `src/**` path to an ADR                   | red, as today                                    |

The cross-series collision case is the one worth being deliberate about: it is the only rule that
would pass if the checker scanned each folder independently, which is the natural way to write it
and the wrong one. One ledger means one collision check spanning all of `docs/`.

Restore and re-run after each; assert the mutation is gone before moving on, since a scripted
replacement can silently match nothing and report the same green as a guard that cannot fail.

Unit tests live in `scripts/__tests__/`, alongside the existing `adr-independence.test.ts`.

## Documentation

- `docs/cnx-spec-adrs/README.md` — the shared numbering ledger (all four prefixes), bands, the
  rewrite test and its in/out list (unchanged content, new path), the recategorization table, and
  a pointer to the PDR series for decisions that fail the rewrite test
- `docs/project-decisions/README.md` — what belongs here, that a PDR owns no matrix obligation,
  and that numbering and bands are the shared rules defined once in the ADR README, not restated
- `docs/project-decisions/TEMPLATE.md`
- `docs/architecture/README.md` — becomes the `ARC` series README: what belongs here, and that a
  description carries a number but never a Status
- `docs/implementation/README.md` — the `IMP` series README; the series starts empty, and this
  file states the boundary against `docs/architecture/` (structure of the transpiler) and
  `docs/plans/` (dated, ephemeral)
- `.github/ISSUE_TEMPLATE/release.md` — §2's band gate must count every non-terminal record in
  **both decision series**, not ADRs alone; its checklist item and its link both need updating.
  Without this the band decision is stated in the READMEs and enforced by nothing at release time.
- `CLAUDE.md`, `CONTRIBUTING.md`, `AGENTS.md`, root `README.md` — path updates; the in/out list
  stays in one home and is not copied
- `.claude/skills/cnx-way/SKILL.md`, `.claude/skills/start-issue/SKILL.md` — path updates

Four series READMEs is itself a duplication risk. The numbering rules, the band rules and the
ledger are defined **once**, in the ADR README; the other three state what belongs in their series
and link. This file's own history is the argument — the rewrite test reached seven copies across
CLAUDE.md and CONTRIBUTING.md before anyone noticed (#1403).

## Follow-up

The C/C++ interop testing matrix is the sibling project this unblocks. The scope-context matrix
measured only `.cnx` include hops when this was written — `IncludeDepth.resolveCnxInclude`
returned null for any path not ending `.cnx`, until #1523 measured each position over the
resolved include graph, headers included — so all 168 fixtures that include a C or C++ header measure as `same-file`,
including the two tagged ones. No interop ADR declares a single obligation today. That work
declares `MATRIX-SEVERITY` rows on ADR-010, 046, 047 and 061, which is why ADR-010's category
had to be settled first.
