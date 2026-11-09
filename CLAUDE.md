# cnx Project Instructions

## Critical Rules

> **The cnx way** is captured as a skill: `.claude/skills/cnx-way/SKILL.md`
> (`/cnx-way`). Read it before implementing, and again before calling work done —
> it carries the verification discipline these rules depend on.

### Correctness Over Convenience — ZERO EXCEPTIONS

**NEVER take shortcuts without explicit user permission.** This is non-negotiable.

Violations include: deleting/skipping failing tests, `--no-verify`/`--force` flags, `any` types, `@ts-ignore`, disabling lints, stubbing with no-ops, skipping validation. **If unclear or blocked — ASK the user.**

### Bug Tracking — ZERO EXCEPTIONS

**NEVER sweep bugs under the rug.** When a bug is discovered, it MUST be either:

1. **Fixed** — resolve the issue immediately, OR
2. **Tracked** — file a GitHub issue with clear reproduction steps

There are NO exceptions. Do not ignore, dismiss, or defer bugs without creating an issue. Pre-existing bugs found during other work still require tracking.

### Reported State — Re-query, Never Restate

**State you report is only as fresh as the query that produced it.** PR status, CI
conclusions, merge state, issue labels, file contents on another branch — re-query at
report time rather than repeating an earlier observation. A status read once and then
narrated carries no timestamp, so a true sentence becomes a false one with nothing
failing in between; six status claims went stale this way in a single session.

**Show the query, do not assert it.** The instruction above is to perform an action, and
the failure mode is being sincerely wrong about whether you performed it — "queried just
now" costs nothing to write and reads as true, and nothing inside distinguishes a fresh
read from a recalled one. So a status claim carries the command or the returned value, and
a table of PR states carries the SHA or timestamp it came from. That turns an unfalsifiable
claim into an artifact a reader can check, which is the same move as a negative control in a
fixture, or running a mutation instead of reasoning about it.

The author of this rule wrote a six-row status table labelled "queried just now, not
carried" in the pull request that added it. Five rows were wrong; four of those PRs had
merged two hours earlier. The turn carried an injected timestamp and the rule text itself,
so both halves of the guard were present and neither fired — **time context makes
staleness detectable, it does not make anyone look.**

`mergeStateStatus` is the sharpest case: it reads `CLEAN` on a PR stacked on a
non-default base because **no checks are required there**, and `CLEAN` again once the
same PR is genuinely gated and fifteen have passed. Same string, opposite meaning —
merging on the first would have landed ADR-070's definition-of-done evidence on zero
CI (#1269). Query the check-run rollup by head SHA, not the mergeable state.

### Definition of Done — Tick Each Box As It Lands

**An issue's `## Definition of done` is updated in the same commit-and-push cycle that makes
a box true, never reviewed and ticked in a batch at the end.** The card is where the work is
visible to everyone who is not reading the branch; a box left unchecked while its work is
merged says the work was not done.

- Tick a box **only** with evidence you can point at — a commit SHA, a command and its
  output, a file that now exists. A box you believe is done but cannot evidence stays
  unchecked, and you say on the issue what is missing.
- A box that names a **number** ("the count falls from 136") is not satisfied by falling; it
  is satisfied by falling _and_ the new number being written on the issue. Record the
  measurement next to the tick.
- When work spans sessions, comment the interim state as you go. A long-running card with no
  comments is indistinguishable from an abandoned one.
- Read and write the body through the API, since `gh issue view` is unreliable here:
  `gh api repos/smeltworks/cnx/issues/<n> --jq .body` to read, and
  `gh api -X PATCH repos/smeltworks/cnx/issues/<n> -F body=@<file>` to write. Change only
  the checkbox characters and the recorded numbers — never reword a box to match what you
  did, which is moving the goalposts rather than meeting them.

**Why this is a rule and not a habit:** #1322 reached thirty-three commits, one hundred
fifty-seven relocated diagnostics and two closed sub-issues with **zero** of its seven boxes
checked and none of its measured numbers recorded, while every one of those numbers had been
measured more than once during the work. The card read as untouched for a week. Nothing
failed, because nothing checks this — the checkbox is the one artifact in this repository
with no gate behind it, which is exactly why it has to be a discipline instead.

### A Card That Turns Out Blocked Is Paused, Not Worked Around

**When a picked-up issue turns out to be blocked and nothing has been committed yet, stop
and pick different work.** Link the blocker as the issue's built-in "Blocked by", comment the measurements that
establish it, delete the unused branch, and choose another card. Do **not** reword the box to
something achievable, do not quietly narrow the card, and do not ship the achievable subset
and call the card done — #1285 closed _"with 2 of 7 items unlanded and untracked, which is why
#1357 existed"_.

**A definition-of-done box that names another issue is a claim about that issue, and
open-or-closed is not the claim.** This is the check every blocked-gate misses, because every
blocked-gate asks the wrong question. #1448's box 3 reads _"#1430 and #1398 are fixed **by the
hoist**, with fixtures that fail if it is reverted"_. Its blockers were #1320, #1322 and
#1447 — all three closed — so the blockers said available, the board said available, and
`/issue-check`'s startability gate passed it as the top pick. The box was unsatisfiable
anyway: **#1398 closed 2026-09-05 via PR #1502, a week before the hoist landed** (#1320,
`2026-09-12T03:29:14Z`), so it was not fixed by the hoist and has no fixture. Both named
issues being _closed_ is what made every existing check pass. Verify what the box asserts —
the causal claim, the artifact, the number — not merely the state of the issue it cites.

**Pausing a card is unassigning it.** Unassign yourself and `project-sync.yml` moves it
`WIP` → `Backlog` (#1572) — only when the **last** assignee leaves, and only from `WIP`, so
stepping off a shared card changes nothing, and neither does unassigning one already in
`Grooming`, `Backlog` or `Done`. Note what that does _not_ cover: an issue whose pull request
is in review is still in `WIP`, because the pull request has its own card — so unassigning
yourself then does return the issue to `Backlog`. The added "Blocked by" link and the comment
carry _why_ it paused; the column carries _that_ it did, which is the part the next person
reads. Do not write `Status` by hand — `docs/WORKFLOW.md` gives `project-sync.yml` sole
ownership of that field, and a second writer both duplicates the transition and hides it
failing.

**What keeps a paused card out of `/issue-check` is now its "Blocked by" (Phase 1d), not its
assignee.** The rule this replaces leaned on the assignee-based in-flight filter, which is
unconditional: assigned meant never recommended. The "Blocked by" exclusion is unconditional
too, but only once Phase 7c **step 1** has actually linked the blocker — so step 4 depends
on step 1 in a way neither step says. A pause for any other reason — context switch, handoff,
end of day — returns the card to `Backlog` with no new "Blocked by" link and nothing holding it
back. That is right for those pauses and wrong for a blocked card whose step 1 was skipped.

**A rule derived under a constraint that does not exist reads as principled indefinitely.**
The predecessor of this rule said to _keep_ the assignment, because unassigning strands the card
in `WIP` with nobody on it. That inference was sound and its premise was false — the same rule
also forbade writing `Status`, having assumed the board unwritable, when its token could write it
(`PROJECT_TOKEN`, with the `project` scope, then; the smeltworks board GitHub App since #2189). Doing **both** was never considered, and strands nothing. Nothing failed in
between: #1448 sat in `WIP` for **9h52m** after its work stopped, while #1445 — the single card
the rule named as stranded — had itself been moved to `Backlog` by hand at `2026-09-12T13:49:37Z`,
so the rule's one worked example was refuting it. Check a rule's premise when its conclusion is a
choice between two bad states; that shape usually means an option was ruled out too early.

### No Duplicate Code Paths — ZERO EXCEPTIONS

**NEVER create or perpetuate duplicate code paths.** If changing something in one place requires a corresponding change in another place, that is a bug in the architecture. Fix it immediately.

**This applies whether the duplication is newly introduced OR pre-existing — if you touch code containing a duplicate path, you fix it.** "It pre-dates this change," "it follows an existing pattern," and "it's really just a misleading comment" are NOT reasons to defer, downgrade, or merge around it. Touching it means owning it.

- If two interfaces need the same fields, extract a shared type or push the data onto the shared model (e.g., `IParameterSymbol`)
- If two code paths must produce identical output, they MUST share the same logic — not copy it
- When fixing a bug caused by divergent paths, **unify the paths** rather than patching both independently
- **Single source of truth means the _decision_, not just the data.** Sharing one detection function (or setting one flag on a shared model) is NOT enough if each path then re-derives the _consequences_ independently. Paths that agree only "by coincidence" — e.g. because some unrelated predicate currently happens to hold — are a latent divergence, not a unified path
- **Example (Issue #914):** `.c` and `.h` generation had separate callback-handling logic. The fix put the decision in one parser, `TypedefParamParser`: the `.h` path stores its answer on `IParameterSymbol` (`isCallbackPointer`/`isCallbackConst`) and the `.c` path asks the same parser (`FunctionContextManager.getCallbackTypedefParamInfo`). One rule — but the rest of a parameter's signature is still derived twice, once per path, which #1639 tracks

Having to update something in 2 places instead of 1 is the WORST anti-pattern in this project. When you find it, fix it.

### cnx Syntax Changes — ZERO EXCEPTIONS

**NEVER change cnx language syntax or behavior without explicit ADR approval and user confirmation.** This is absolutely non-negotiable.

- cnx syntax MUST always follow the ADRs exactly
- If there is any ambiguity about syntax behavior, **ASK the user for direction**
- NEVER assume a syntax change is acceptable, even as a "beneficial side effect"
- Test files marked `// test-error` define expected behavior — changing them to pass is a syntax change

**What an ADR governs is the cnx language spec** — the syntax, and the semantics the
language promises. It does NOT gate the generated C/C++ or compile behavior generally: fixing
codegen so it emits correct C, or turning a wrong guess into a diagnostic, is ordinary bug
fixing and needs no ADR. A previous version of this list said behavioral changes affecting
"what cnx code compiles" always require an ADR; that read every codegen fix as a spec
change and was wrong.

**Example (Issue #872):** Setting `expectedType` for MISRA compliance accidentally enabled bare enum resolution in function arguments. This was reverted because it changed cnx behavior without ADR approval. The fix added `suppressBareEnumResolution` to get MISRA compliance without changing syntax behavior.

When in doubt: **ASK.** Syntax changes require ADR discussion and user approval.

### Project Hygiene

- No root-level analysis artifacts (`*.csv`, `*-report.md`) — use terminal or `docs/`
- `.auto-claude-status` is gitignored

### Starting a Task

**Always ask the user what to work on.** Check if issue was already done: `git log --oneline --grep="<issue-number>"`

**Before implementing plan findings**: Verify findings are current, search before removing "unused" code, check if state is file-specific.

### Workflow: Research First

1. **Always start with research/planning** before implementation
2. If unsure about approach, **ask the user**
3. Update the relevant ADR with research findings, links, and context as you go
4. **Never update ADR status or decisions without user direction**

---

## Quick Reference

| Task                   | Command                                                   |
| ---------------------- | --------------------------------------------------------- |
| Build transpiler       | `npm run build`                                           |
| Integration tests      | `npm test` or `npm run test:q` (quiet)                    |
| Single test            | `npm test -- tests/dir/file.test.cnx`                     |
| Unit tests             | `npm run unit`                                            |
| Coverage               | `npm run unit:coverage`                                   |
| C static analysis      | `npm run validate:c`                                      |
| All tests + checks     | `npm run test:all`                                        |
| **Everything CI runs** | **`npm run test:gate`**                                   |
| Local transpiler       | `npx tsx src/cli/index.ts <file.cnx> --target host`       |
| C++ mode               | `npx tsx src/cli/index.ts <file.cnx> --cpp --target host` |
| Generate snapshots     | `npm test -- <path> --update`                             |
| ANTLR regenerate       | `npm run antlr`                                           |

**GitHub CLI**: `gh issue view` may fail — use `gh api repos/smeltworks/cnx/issues/<number>` instead. `gh pr edit` fails here on a Projects-classic GraphQL deprecation — use `gh api -X PATCH repos/smeltworks/cnx/pulls/<n> -F body=@<file>`, then re-read the body to confirm; it errors on stderr, so an `&&` chain hides it and the body silently keeps its old text. The project board (`/issue-check`
Phase 1d) needs `gh auth refresh -s read:project`; **writing** a board field needs
`-s project` — `read:project` is not enough and the mutation fails with
`INSUFFICIENT_SCOPES`, not a permission message. Both are interactive, so the user runs
them. The board query also needs `--paginate`: the board is past 200 items and a bare
`items(first: 100)` truncates silently, so every card past page one reads as "not on the
board" — no status, no blocker.

**And `--paginate` only advances a cursor variable named `$endCursor`.** Any other name —
`query($c: String) { … after: $c }` — compiles, runs, and re-fetches page one forever:
`after` is always null, nothing errors, nothing terminates. It reads as a slow query, so the
instinct is to raise the timeout, which makes it worse. Measured on this board: 37,248 output
lines holding 97 distinct issues, with the cards being verified absent entirely, because the
loop never reached their page. The first attempt then died on a rate limit _caused by_ the
loop — and `gh` printed that error while **exiting 0**, so the failure was invisible to the
exit code too. To check a paginated result rather than trust it, compare
`cut -f1 out | sort -u | wc -l` against `wc -l`; equal means no page repeated. For a handful
of known items, N separate `node(id:)` queries are faster and cannot loop at all.

**The same cap applies to every list, not just GraphQL — and this section used to omit it.**
`gh issue list` and `gh pr list` default to **30** (`-L, --limit int … (default 30)`), and a
REST collection such as `.../issues/<n>/comments` pages at 30 without `--paginate`. A filter
over a truncated page returns a shorter answer, never an error. Enforced by
`npm run gh:pagination:check` in the **`lint`** job, which has no exemption mechanism.

**They sort by CREATED descending, not updated.** That distinction is the whole trap, and
getting it backwards is what made this recur: `/issue-check` recommended #1449 as free work
while it was assigned, in `WIP`, and 34 minutes into planning, because the fix for #1416 left
behind a comment saying `gh` "returns the most recently updated first". If that were true,
recency of _activity_ would keep a row in the page and an **assigned** issue would be safe
unbounded. It is not: #1449 was the 2nd-most-recently-**updated** issue in the repo and still
outside the default page. Prefer a server-side filter where one exists — `--assignee "*"`
returns the assigned rows, where filtering the list client-side must first receive every
open issue and receives thirty — then `--limit`, then assert the returned count is strictly
below it. (Both counts this sentence used to quote had moved within a day of being measured,
which is the same argument in miniature: assert the bound, do not record the reading.) `--paginate` concatenates pages, so a per-item `--jq '.[] | …'`
is safe under it but an aggregate `--jq 'length'` prints once **per page**.

**Refactoring with ts-morph**: `ts-morph` is a direct devDependency (28.x). Use it for
anything that moves or renames across files — a relative specifier changes differently
depending on where the IMPORTER sits, so `../../utils` from one directory and `../../../utils`
from another cannot both be right under one regex.

After moving a module, run `npm run typecheck:scripts` as well as `npx tsc --noEmit`: the
root tsconfig's program does not include `scripts/`.

**Do not use the transitively-installed ts-morph 13.** It bundles TypeScript ~4.x, which
predates `moduleResolution: "bundler"`: it cannot resolve directory-index specifiers such as
`./cnx` and leaves them broken **with no error**. Import the direct dependency.

This section previously named four `*_by_tsmorph` MCP tools as the first choice. No ts-morph
MCP server is configured for this repo (`claude mcp list`, and no `mcpServers` entry in any
project or user config), and the successor package no longer exposes those names, so the
instruction could not be followed as written.

**Layer constraints (depcruise)**: `PASS_ORDER` in `.dependency-cruiser.cjs` lists the places a
module can sit, earliest first, and one generated rule per place (`*-reads-no-later-pass`, #1443)
forbids it reaching any later one — **transitively**, not just as a direct edge. No pass after
1.1 Discover reaches a 1.1 module other than its artifact's `types/` (`nothing-after-1-1-discovers`,
#1444 box 4). `TranspileState` and `CodeGenWalker.ts` sit directly under `src/cnx/TRANSPILE/`, which
README §1's tree draws, and each has its own place in the order: the state after 2.1 (an analyzer
reaching it is the #1456 defect), the walker after 2.3 (its whole job is calling renderers).
`npm run layout:check` reports the order rules together with the tree's shape. Check import dependencies before choosing extraction location; shared contracts
go in `src/cnx/types/`, which every layer may depend on — and which may depend on no
pass in return, enforced by `shared-contracts-cannot-import-a-pass` (`error`, `reachable`).
That claim was prose with nothing behind it until #1452 broke it twice: `IAssignmentContext`
gained a `TranspileState` member, so an analyzer importing the CONTRACT reached a pass root
through it, and `ITranspilerResult` named a 2.1 type. Both moved; the rule is what stops a
third. Until #1297 these matched direct
edges only, so `logic/ -> state/ -> output/` was live through `CodeGenState` while CI printed
`no dependency violations found` — ten analyzers coupled to codegen's type vocabulary with the
guard green. A rule that cannot fail on the case it exists to catch is the
`// test-no-warnings` shape (#1143) at the architecture level, so the property is asserted
rather than remembered: `scripts/__tests__/layer-rules.test.ts` requires every rule whose
`from` and `to` are both transpiler paths to carry `reachable: true`. It keys on that shape
because transitivity is wrong for the other rules — `collectors-build-names-from-scopes` names
a single utility module and yields seven errors under `reachable`, since everything reaches
`QualifiedCName` through `utils/`.

**Local MISRA validation**: `sudo apt-get install cppcheck` then `npm run validate:c`

**MISRA rule details**: `cppcheck --addon=misra -I tests/include <file.c>` shows specific rule violations (batch-validate only shows file names)

**Transpiler failures**: `npx tsx src/cli/index.ts` prints `Error:` (capital E) and exits non-zero —
detect with the exit code. `grep -q error` silently misses every diagnostic.

**Mismatch masks execution**: a fixture failing `C output mismatch` never runs, so behavioral
regressions only surface _after_ `npm run test:update`. Re-run the suite post-regeneration before
calling a codegen change behavior-preserving.

**Snapshot updates**: `.expected.*` files are rewritten **only** under `--update`. A plain
`npm test` regenerates transpiler output (`.test.c/.h/.cpp/.hpp`) and _compares_ it against the
snapshots — it never edits them. That is why `test:all` is a gate and must never include an
update step: an `--update` inside it could not fail on a mismatch. `npm run test:update`
regenerates every snapshot, `tests/bugs/` included (#1142); `npm run test:bugs:update` narrows
it to the regression fixtures.

**`test:all` is four checks of thirty-eight — run `npm run test:gate` before pushing.**
`test:all` is `build && unit && test:q && validate:c`. CI runs thirty-four more with no local
alias: the whole **`Static Analysis`** job (`prettier:check`, `plugin:test`, `test:hooks`,
`cspell:check`, `oxlint:check`, `knip`, `depcruise`, `lint:test-location`,
`analyze:duplication`, `docs:toolchain:check`, `docs:misra-guards:check`, `coverage:matrix:check`,
`diagnostics:manifest:check`, `error-codes:check`, `docs:throw-citations:check`, `scope-joins:check`,
`adr:independence:check`, `gh:pagination:check`, `parse-tree:check`, `unused-code:check`,
`typedef-const:parity:check`, `layout:check`, `plan-render-state:check`,
`gate:roster:check`), plus `typecheck`, `typecheck` for
`prettier-plugin`, `typecheck` for `scripts` (`typecheck:scripts`), `test:cli`, `cli smoke`,
`coverage:grammar:check`, `format:fidelity`, `headers:standalone:check`, `re-run warm`, and the
`working tree clean` check that `Verify Clean` performs.

**This roster is no longer maintained by hand.** `npm run gate:roster:check` derives it: it
counts `run_check` invocations in `scripts/gate.sh`, compares the npm scripts CI runs against
the ones the gate runs, and asserts the two numerals in the paragraph above. A check added to
`pr-checks.yml` and forgotten here now fails the **`lint`** job. That is the point — this list
had drifted three times in silence (`24 → 26`, `26 → 27`, `27 → 30`), each time reading as
complete while being short, and the command previously offered as proof was itself wrong twice
in ways that cancelled: `grep -c '^run_check'` matched `run_check() {`, the function
definition, while missing the `Verify Clean` check that open-coded its own pass/fail
bookkeeping. **A guard that passes by coincidence is worse than one that fails, because nothing
ever prompts anyone to look** — which is the whole argument for deriving the claim rather than
asserting it. `scripts/gate.sh` runs all of them, reports each against the CI job that owns it,
and does **not** stop at the first failure.

**`npx tsc --noEmit` is the ROOT tsconfig, which excludes `scripts/`.**
`npm run typecheck:scripts` (`tsconfig.scripts.json`) is a separate CI check, so "tsc is
clean" after the first and meaning both is a claim you have not made. A `scripts/` import
of a moved module resolves to `unknown` rather than erroring at the import line, so it
surfaces far away: one move produced six `TS18046: 'a' is of type 'unknown'` in a sort
comparator.

**Run the gate ALONE, from a committed tree.** Its last two checks assert over the whole
working directory (`git diff --exit-code tests/`, `working tree clean`), so a second gate
running beside it — or any uncommitted change — fails them for reasons that read exactly like
real defects: #1511 nearly went hunting for a warm-cache divergence that was its own
concurrent run. A process search for `gate.sh` also matches the command asking, so filter on
an elapsed time above a few seconds. **Never pipe it**: `npm run test:gate | tail` reports
`tail`'s status, not the gate's. Redirect to a file and capture `$?`, or read the printed
`All N checks passed` line.

The one npm script CI runs that the gate deliberately skips (`antlr:all`) is listed in `gate.sh`'s header
as a `# not-in-gate:` line with its reason, and `gate:roster:check` fails on any script that
is neither run nor listed — in either direction, so an exclusion CI stopped running also fails. Sonar and Deploy Coverage need tokens and run no npm script, so they
never enter the comparison. A green `test:all` says nothing about any of
them: #1399 pushed on one and turned CI red on `docs:throw-citations:check`, because
**adding a single import to a file under `output/` shifts every later `throw new` down one
line** and all 20 citations in `docs/architecture/throw-classification.md` missed by
exactly one. The prose is authored, but the line numbers are not hand-edited:
`npm run docs:throw-citations` remaps them by reading the PREVIOUS revision, where an
unchanged `throw` count makes the Nth throw then the Nth throw now. It **refuses** a file
whose count changed — the one case it cannot decide, and precisely the objection that used to
justify having no write mode at all (#1518). Each row also carries an `anchor`, a verbatim
substring of what its throw says, which the gate holds to the cited line: two rows cannot
trade sites and stay green, and a drifted row's anchor says which throw it meant (#1374).
**It gates the population too, not only the citations**: a `throw` added anywhere under `src/`
with no row fails it as `throw statement is not classified`. Tests and ANTLR's generated parsers
are left out, by the mark ANTLR writes rather than by a directory list. Until #1531 the corpus was
`output/` alone, so the user-facing throws #1322 had not reached, all outside it, were invisible.
That is what holds `3-Render/` at the zero #1322 emptied it to — verified by mutation, with a
negative control, since the line-shifting edit above is the thing a file-level check would confuse
it with.

**A lost diagnostic used to erase its own evidence (#1316)**: under `--update`, a
`test-error` fixture that stopped erroring had its `.expected.error` unlinked and rewritten
as a `.expected.c`, reported `passed: true`. A regression that silenced a diagnostic and an
intentional fix were indistinguishable — on the one command a diagnostic migration runs
repeatedly, across 287 fixtures. `--update` now **fails** on that transition, keeps the
`.expected.error`, and writes the `.expected.c` for inspection only.

**`docs/diagnostic-manifest.md`** is the committed record of which fixture asserts which
codes, gated by `npm run diagnostics:manifest:check` in the **`lint`** job — not `test:all`,
which must stay update-free to remain a gate. It fails when a listed fixture loses its
`.expected.error` (`assertion-removed`) or stops asserting a code it used to
(`code-removed` — the quieter one, since the fixture still errors and the suite stays
green). Growth never fails it. Removing a diagnostic on purpose means deleting its row in
the same commit. Regenerate with `npm run diagnostics:manifest`.

**`docs/error-codes.md` is read in code order**: `error-codes:check` fails a new code placed
in its thematic section out of sequence. Add it after the highest code, under its own
heading.

**C vs C++ const linkage**: C const at file scope has external linkage; C++ const has internal linkage (needs `extern`). `TranspileState.cppMode` controls this.

---

## Code Quality

**Pre-commit hooks handle formatting automatically.** Manual if needed: `npm run prettier:fix && npm run oxlint:check`

**A pre-commit `prettier … terminated with SIGKILL` is not prettier.** `lint-staged` runs
prettier and oxlint concurrently and kills the survivor when one fails, so the oxlint error
scrolls past above while the SIGKILL's huge argv dump lands at the tail. Run
`npx lint-staged` directly and read the whole output — splitting the commit or raising the
heap does nothing.

### SonarCloud — Never Merge a New Issue — ZERO EXCEPTIONS

**A PR that introduces ANY new SonarCloud issue does not merge, whatever the
quality gate says.** Not one Code Smell, not one Minor, not "it's only a test
file."

**The gate passing is NOT the standard.** The gate scores _ratings_ on new code,
so a handful of new Code Smells can land while it still reports OK. Reading a
green gate as permission to merge is the mistake — check the issue list, not the
gate:

```
# issues introduced by a PR (must report total 0 before merge)
# statuses= is REQUIRED: without it the response also lists CLOSED/FIXED issues,
# so a PR whose issues you already fixed still reports a non-zero total.
curl -s "https://sonarcloud.io/api/issues/search?componentKeys=smeltworks_cnx&pullRequest=<PR>&statuses=OPEN,CONFIRMED,REOPENED&ps=100"

# and the gate, which is necessary but NOT sufficient
curl -s "https://sonarcloud.io/api/qualitygates/project_status?projectKey=smeltworks_cnx&pullRequest=<PR>"
```

**`&files=<path>` is IGNORED by this endpoint.** It returns the project-wide list whatever
you pass, so a "per-file count" is the project count. Three modules each reporting exactly
`2` is the tell — that was one project total read three times and summed to "6", and it was
cited to justify a scope decision before anyone checked (#1511). Filter on `.component`
client-side instead.

**A `0` from a commit Sonar has not analyzed yet is not a pass.** Confirm the analysis actually ran on the
head SHA before believing the count:

```
gh api --paginate repos/smeltworks/cnx/commits/<sha>/check-runs \
  --jq '.check_runs[]|select(.name|test("Sonar"))|"\(.conclusion) \(.completed_at)"'
```

**A moved file re-attributes its issues to the mover.** Relocating a file makes
its pre-existing issues count as new code. "It was already there" is not an
out — if the PR moved it, the PR owns it.

**Fix the clusters you create, not just the ones reported.** If a PR adds tests
in the shape SonarCloud flags (S5976 parameterized-test clusters are the common
one), convert them in the same PR rather than waiting for the next scan to
report them.

Resolving an issue means fixing the code. Marking it Won't Fix or False Positive
to clear the list requires explicit user approval, the same as any other
shortcut.

### SonarCloud Quality Gate

| Requirement          | Threshold                                      |
| -------------------- | ---------------------------------------------- |
| Coverage (new code)  | >= 80%                                         |
| Duplicated lines     | <= 3%                                          |
| Cognitive complexity | <= 15 per method                               |
| Bugs/vulnerabilities | 0 new                                          |
| **New issues**       | **0 — blocks merge regardless of gate status** |

**Before PRs**: Run `npm run unit:coverage` and check new/modified files.

**Reducing complexity**: Extract nested logic to private helpers with early returns. Check `src/cnx/utils/ExpressionShape.ts` for existing patterns first.

**Generated Markdown**: format the generator's output through Prettier before writing or diffing —
the pre-commit hook formats staged `.md`, so unformatted output makes the committed file
permanently differ from what the generator produces. Emit no timestamp (it churns every run and
makes a diff gate useless — see `GRAMMAR-COVERAGE.md`, #1150). **Verify Clean runs no generators**
(it only re-downloads build artifacts), so gate generated docs in the `lint` job instead.

**API queries**: `https://sonarcloud.io/api/issues/search?componentKeys=smeltworks_cnx&statuses=OPEN,CONFIRMED`
— add `&pullRequest=<n>` for PR-scoped issues, and
`api/qualitygates/project_status?projectKey=smeltworks_cnx&pullRequest=<n>` for the gate.

### Other Tools

| Tool          | Command                       |
| ------------- | ----------------------------- |
| Spelling      | `npm run cspell:check`        |
| Duplication   | `npm run analyze:duplication` |
| Dead code     | `npx knip`                    |
| Circular deps | `npm run analyze:madge`       |
| All analysis  | `npm run analyze:all`         |

---

## TypeScript Standards

**See `CONTRIBUTING.md` for full guide.** Key rules:

- **Default exports only** (oxlint `no-named-export` rule)
- **Static classes** for utilities, not object literals or singletons
- **No destructuring** — use `ClassName.method()` for self-documenting code
- **No re-exports/barrel files** — import directly from source
- **Composition over inheritance** — never use class inheritance
- **Shared types** in `/types` directories, one interface per file

### Static Class Pattern

```typescript
// ✅ Correct - static class
class TestUtils {
  static normalize(str: string): string { ... }
  static validate(file: string): IResult { ... }
}
export default TestUtils;

// ❌ Wrong - singleton (knip can't detect unused methods)
class Registry { private map = new Map(); register() { ... } }
export default new Registry();
```

**That rationale is only true because #1556 made it true.** knip does not analyze class
members by default, so for the life of this rule a static class's unused methods were
reported clean too — the very detectability the pattern is chosen for.
`TestUtils.executeTest` sat with no caller at all, green, until it was deleted by hand in
#1554. Three separate settings were needed, and two of them fail **silently** when wrong:

- `include: ["classMembers"]` — the analysis itself, off by default.
- `includeEntryExports: true` — without it a member of an **entry** file is exempt, and
  `scripts/*.ts` is an entry pattern, so the exact file the rule is illustrated with was
  the one it could not check. Fixing only the first setting still leaves the card's own
  reproduction passing; the mutation check is what catches that.
- `ignore` pointing at directories that **exist** — `src/parser/grammar/**` had not
  existed for some time, so 3300 generated findings drowned the real ones.

`ignore` removes a file from the graph, not just from the report, so ignoring a directory
stops it counting as a _user_ — over-ignoring invents dead code rather than hiding it.
**A test is not a user (#1418).** `knip.json` sets `"vitest": false` and negates the test
globs (`__tests__`, `*.test.ts`, `__testUtils__`, `src/tests`) on both `entry` and
`project`, so no call from a test counts as usage. A member whose only callers are tests
is reported by the same plain `npx knip` that CI and `gate.sh` run; there is no
`--production` mode, so `@internal` does nothing here. The vitest plugin has to be off:
left on, it adds every test file back as an entry and the negations stop mattering.

A member whose only reason to exist is its own unit test is deleted. One kept on purpose
with no production caller carries `@public` and a one-line reason saying which kind it is:

- **Dispatch knip cannot see** -- the members reached through `ICodeGenApi` via
  `requireGenerator()`; `SymbolTable.getSymbol`, `getStructFields` and
  `getStructFieldInfo`, supplied to `ISymbolLookup`, `IForeignSymbolLookup` and
  `IStructFieldLookup` by structural conformance; the `ParseTreeListener` callbacks
  `ParseTreeWalker` calls.
- **The one list a test enumerates** -- `DynamicAllocation.names`,
  `ComplianceAnnotations.all`, `TestMarkers.names`, the printer's `handledRuleIndices`.
  A hand-listed copy in the test would be a second list.
- **A module function exposed to its own test, or read by a guard test that is the
  check** -- `GateRoster`, `MatrixRenderer`, `SourceScan.scan`.
- **A member of a guard or factory set** tests narrow or build with -- `SymbolGuards`,
  `TTypeUtils`.

`yaml` is in `ignoreDependencies` because only `sonar-workflow.test.ts` imports it.

Mutation-checked, and the check is the point: add a static method nothing calls, or
remove the one production call of a member a test still calls, and `npx knip` must exit
non-zero naming it, while a class of used methods stays silent. Strip a `@public` tag
and knip names that member.

### Common Gotchas

- **`replace_all` tool**: Iterative replacement can cause double-substitution
- **Readonly Map restore**: Use `map.clear()` + loop, not reassignment
- **Dead code**: Use TypeScript "declared but never read" diagnostics

---

## Architecture

### Pass layout (`src/`, README §1)

| Layer        | Path                          | Purpose                                                                                                                                                                                                                                                                     |
| ------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discover     | `src/cnx/PARSE/1-Discover/`   | 1.1 Discover — `Discover.run` emits the frozen `SourceGraph`; FileDiscovery, IncludeResolver, DependencyGraph, the port (the preprocessor moved to 1.2 Parse, `2-Parse/preprocessor/`, with #1713). Was `data/` and `logic/` until #1444                                    |
| Render       | `src/cnx/TRANSPILE/3-Render/` | 2.3 Render — codegen/, headers/. Moved out of `transpiler/output/` by #1450 box 5                                                                                                                                                                                           |
| State        | _(gone)_                      | `src/transpiler/state/` was deleted by #1452. The per-file working state 2.2 and 2.3 share is `TranspileState` at the `src/cnx/TRANSPILE/` root; `SymbolRegistry` and `SymbolTable` are 1.3 Declare's                                                                       |
| Constants    | _(gone)_                      | `src/transpiler/constants/` was dissolved by #1853: a constant one area reads sits in that area (a pass, or `src/cnx/utils/constants/`), and one that more than one area reads sits in `src/cnx/types/`. Areas are counted by where each reader is going, not where it sits |
| Orchestrator | `src/cli/Transpiler.ts`       | Constructs the pipeline, orders the stages, owns the caches (#1443)                                                                                                                                                                                                         |

### Utility Locations

| Type                                                        | Location                                             |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| Type utilities (`ScopeUtils`, `TTypeUtils`, `TypeResolver`) | `src/cnx/utils/`                                     |
| Type definitions (interfaces, enums)                        | `src/cnx/types/`                                     |
| Stateful classes (`TranspileState`)                         | `src/cnx/TRANSPILE/`                                 |
| Runtime lookups                                             | in the one area that reads them, or `src/cnx/types/` |

---

## Symbol Resolution

> Full model: [`docs/architecture/symbol-resolution.md`](docs/architecture/symbol-resolution.md) (formerly ADR-055).

### Symbol Types

| Type             | Purpose                        | Status            |
| ---------------- | ------------------------------ | ----------------- |
| `TSymbol`        | New discriminated union        | Use for new code  |
| `ISymbol`        | Legacy flat interface          | Removed (Phase 7) |
| `TSymbolAdapter` | Converts TSymbol[] → ISymbol[] | Removed (Phase 7) |

**Use**: `CnxResolver.resolve(program, file, registry)` → `IFileSymbols` (its `.symbols` is the `TSymbol[]`)
**Avoid**: Deleted `SymbolCollector`, `CnxSymbolCollector`

### C/C++ Resolvers (symbol-resolution Phase 6)

| Resolver      | Location                       | Returns        |
| ------------- | ------------------------------ | -------------- |
| `CResolver`   | `PARSE/3-Declare/c/index.ts`   | `TCSymbol[]`   |
| `CppResolver` | `PARSE/3-Declare/cpp/index.ts` | `TCppSymbol[]` |

- **Composable collector pattern**: Static classes with `collect()` (StructCollector, EnumCollector, etc.)
- **C/C++ symbols use string types**: Unlike cnx's `TType`, pass through unchanged
- **TAnySymbol**: Cross-language union (`TSymbol | TCSymbol | TCppSymbol`)
- **Adapters**: none. `CTSymbolAdapter`/`CppTSymbolAdapter` were named here but have never
  existed in `src/`; `TCSymbol`/`TCppSymbol` are consumed directly

### Enum `expectedType` Contexts

| Works (bare members)                              | Requires qualified (`EnumType.MEMBER`)                |
| ------------------------------------------------- | ----------------------------------------------------- |
| Variable declarations: `EColor c <- RED`          | Comparisons: `cfg.pType != EPressureType.PSIA`        |
| Assignments, a struct field's in any file         | Function arguments                                    |
| Return statements (enum return type)              | Array dimensions and subscripts: `u8[EColor.COUNT]`   |
| Struct field inits `{color: RED}`, array elements | A `for` header's declaration or update (#1537: a bug) |
| Switch cases, ternary arms                        |                                                       |

The table is `BareEnumMemberAnalyzer`'s (2.1), which walks up from the identifier to
the nearest node that establishes a type. It used to list "cross-file struct
assignments" as requiring qualification, which was false on `main` too: with the
struct and the variable in an included file, `shared.color <- GREEN` transpiles to
`shared.color = EColor__GREEN;`.

### Enum Error Locations (E0424 "not defined; did you mean")

E0424 is a 2.1 Analyze diagnostic since #1322, and render asserts it never sees the case.

| Location                                        | Context                                                                                         |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `BareEnumMemberAnalyzer`                        | Every position in the table above, returns included                                             |
| `SwitchStatementAnalyzer`                       | Case labels: a bare member when the switch is not on an enum, or one its enum does not declare  |
| `CodeGenWalker._resolveUnqualifiedEnumMember()` | Render: qualifies an accepted bare member, and an `invariant` that a rejected one never arrives |

### Key Patterns

- **SymbolTable ownership**: the table is 1.3 Declare's artifact, reached through 1.4's `program.symbolTable()`; `TranspileState.symbolTable` is a getter over it, not a second owner
- **TSymbols use bare names**: `name: "init"` with `scopePath: string` -- the dotted path of the enclosing scope (`""` at file scope), never the scope object. #1298: holding the object gave every symbol a chain to walk and a cycle to represent, which made the graph unserializable and left `getScopePath`'s identity-based guard unable to fire on a proxy chain. The scope object is one `SymbolRegistry.getScope(path)` away where a mutable member list is genuinely needed
- **Lookup key by layer**: `getOverloads(bareName)` answers "what does `init` mean _here_?" and needs ADR-057 scope context; `getOverloadsByCName("Motor__init")` answers "which symbol _is_ this?" and is an exact canonical identity. Codegen and anything downstream of it holds the latter — asking the bare-name index with a transpiled C name returns empty for every scoped symbol, which reads as "no such symbol" rather than "wrong question" (#1139). Build the key with `ScopeUtils.getTranspiledCName()`, the single encoder; never re-derive a qualified name by hand
- **Per-file vs run-wide symbol views**: `ICodeGenSymbols.known*` is built by 1.4 Resolve
  (`Program.deriveVisibleSymbols`, through `TSymbolInfoAdapter.convert`) over the file's
  include closure — the include graph discovery resolved (#1435) — and holds what **this
  file** can see; a later pass reads it through `IProgram.codeGenSymbolsFor`. `_declareFile`
  does not build it, and since #1472 takes only `(tree, sourcePath)` — it returns
  `IFileSymbols`; `SymbolTable.getOverloadsByCName` accumulates the **whole run** and is
  cleared once. A sibling that was never included is absent from the first and present in
  the second — that disagreement _is_ #1312. `TranspileState.isScopeType()` is per-file: it
  asks `IProgram.isScopeTypeVisibleFrom(sourcePath, name)` — the scope types the file being
  generated declares or includes — the same predicate 1.4 settled that file's types with
  (#1724). It reads the run-wide table no longer, and answers "missing" for every C/C++
  header type, since a scope type is a cnx one. Ask the per-file sets about a cnx name
  and the run-wide table about a foreign one
- **Test isolation**: build a fresh `new SymbolRegistry()` per test and pass it to `CnxResolver.resolve(program, file, registry)` — there is no global registry to reset (#1452 box 3 deleted the static and its `reset()`)
- **Array dimensions**: `IVariableSymbol.arrayDimensions` is `(number | string)[]` — numbers for resolved constants, strings for C macros
- **What an analyzer may read is `IAnalysisContext`, plus the 1.2 syntax it walks.** #1456
  made it a parameter: `symbols` (this file's view), `program` (1.4's artifact),
  `symbolTable` (an `IResolvedSymbols`), `includesForeignHeader`, and `sourceFile`. 2.1 builds it
  itself (`Analyze`) from what 1.4 returned (#1991); `runAnalyzers` also hands
  some analyzers `IValuePositions`, 2.1's own walk of 1.2's syntax. And
  `2-1-analyze-reads-no-later-pass` (`error`, `reachable: true`) makes an
  analyzer that reaches `TranspileState` fail the **`lint`** job — through a
  shared helper as readily as directly. `symbols` and `program` are NON-nullable,
  so `?? []` and `if (!symbols)` in an analyzer are guards that cannot fire and
  a wrong answer if they ever did: `?? []` for "what consts does this scope
  have" means "none", not "unknown"
- **Cross-file facts come from `program`, not from the render state**: external
  struct fields are derived by 1.4 Resolve and read as
  `context.program.externalStructFields()`. Use
  `context.symbols.functionReturnTypes` for the ADR-029 function-as-type fact
- **Analyzer test isolation**: build the context, not the state. `testAnalysisContext`
  lives in `src/cnx/TRANSPILE/1-Analyze/__tests__/`, the one place allowed to read a
  `TranspileState` into a context. `testAnalysisContextFor`, which needs the host's
  target catalog, lives in `src/cli/__tests__/cnx/TRANSPILE/1-Analyze/` (#1992).
  `testAnalysisContextFor(source)` runs the real
  1.3 and 1.4 on the source and returns a context with a settled `program`; use it
  for anything that types an operand or binds a name. `testAnalysisContext(state)`
  reads the facts a test set on a `TranspileState` and stands an
  **empty** `Program` in for one the test never built, so a typing test built on it
  passes by asserting silence
- **The timing hazard this list used to describe is gone, and so is the registry.**
  It said three analyzers read the private per-file `typeRegistry`, so one could see
  a stale per-file local ahead of the cross-file answer. #1456 put the state out of
  analyzers' reach, and #1668 deleted the registry and `getVariableTypeInfo` with
  it; what `grep` still finds is comments recounting that history
- **Analyzer operand types**: ask `OperandTyper` (`typeOf`, `valueLeaves`,
  `chainOf`) with the analysis context, and `program.bindValue` for what a name binds
  to. Do not record declarations in an analyzer's own `enterVariableDeclaration` /
  `enterParameter` / `enterForVarDecl`: that is a second binding decision. #1220
  removed `trackIfFloat` and `SignedShiftAnalyzer`'s `trackType`, and #1668 the
  last, `ArrayIndexTypeAnalyzer.trackType` -- the helpers this entry used to recommend
- **Ternary grammar** (1.2's lowering only; analyzers read the lowered syntax, not `ternaryExpression`): `ternaryExpression` has 3 `orExpression` children: `[0]` = condition, `[1]` = true value, `[2]` = false value. When validating value types, skip index 0 — and address them via `orExpression()`, **never `getChild(i)`**: the condition is parenthesized, so `getChild(0)` is `(` and an index-based skip silently does nothing
- **Callback header params**: a callback-compatible function's parameters take pointer and const from its typedef, found by `TranspileState.callbackTypedefTypeFor` and read by `TypedefParamParser.isParamPointer`/`isParamConst` — one rule for both files. The `.h` path (`Transpiler.convertToHeaderSymbols()`) stores it on `IParameterSymbol.isCallbackPointer`/`isCallbackConst`; the `.c` path asks the parser through `FunctionContextManager.getCallbackTypedefParamInfo`. The two paths are two call chains to one rule, the shape #1639 tracks
- **Scope type predicate**: `TranspileState.isScopeType(qualifiedName)` checks whether a qualified name is a scope type — an enum, struct, bitmap or ADR-029 function-as-type (the kinds are `TYPE_FORMING_KINDS`) — that the file being generated can see: declared by it or by a file in its include closure (`IProgram.isScopeTypeVisibleFrom`, #1724). Codegen sites bind it through `TranspileState.typeBindingDeps()`, which pairs `TranspileState.scopeTypePredicate` with the caller's `resolveQualifiedType` — don't re-pair the predicate with `currentScopePath` at each site, and don't inline `knownEnums || knownStructs || knownBitmaps`. This used to name `CodeGenState.qualifyScopeType(bareName)`; that method had **no production caller** and is deleted (#1452), because a rule naming a helper nothing uses teaches the next reader a pattern the codebase does not have.

---

## Testing

### Test Types

| Marker                                                         | Behavior                                                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_                                                       | Run in BOTH C and C++ modes                                                                                                       |
| `// test-c-only`                                               | C mode only                                                                                                                       |
| `// test-cpp-only`                                             | C++ mode only                                                                                                                     |
| `// test-execution`                                            | Execute and validate (MUST use `if (x != y) return N;`)                                                                           |
| `// test-error`                                                | Expect compile error (create `.expected.error`)                                                                                   |
| `// test-transpile-only`                                       | Skip compilation entirely                                                                                                         |
| `// test-no-warnings`                                          | Compile `-O3 -Wall -Wextra -Werror` (every TU)                                                                                    |
| `// test-no-target`                                            | Pass no `--target`; the fixture is about where one comes from                                                                     |
| `// test-target-xfail: <target>... [c\|cpp] #<issue> "<text>"` | Those targets' cells must fail until the issue is fixed (every mode, or the one named), with a failure containing the quoted text |

**Execution tests MUST validate every result** with unique return codes (1, 2, 3...). Return 0 only if ALL pass.

### File Patterns

```
foo.test.cnx          # Source
foo.expected.c        # Expected C output
foo.expected.cpp      # Expected C++ output (required unless // test-c-only or // test-error)
foo.expected.h        # Expected C header
foo.expected.error    # Expected error (if test-error)
```

**Generate C++ snapshots**: `npm test -- <path> --update` writes them beside the C ones. A dual-mode
fixture with no `.expected.cpp` fails `npm test` (`No expected file`), so there is no separate
generator (#1489 deleted the one that duplicated this).

### Unit Tests

- Location: `__tests__/` adjacent to module (e.g., `src/cli/cache/__tests__/CacheManager.test.ts`).
  The exception is a test of a `src/cnx/` module that reaches `src/cli/` or `src/lib/`. It lives at
  `src/cli/__tests__/cnx/<the module's path under cnx/>`, because nothing in `cnx/`, tests included,
  imports the host (#1992; `transpiler-imports-no-host`)
- Parser imports: `import * as Parser from "../../PARSE/2-Parse/grammar/CnxParser.js"`
- Direct parsing: `CnxSourceParser.parse(source)` when you just need AST
- **Mock types**: `TTypeInfo` needs `baseType`, `bitWidth`, `isArray`, `isConst`; `TParameterInfo` needs `name`, `baseType`, `isArray`, `isStruct`, `isConst`, `isCallback`, `isString`
- **IAssignmentContext changes**: Update `createMockContext` in ALL handler test files when adding fields
- **Vitest ESM mocks**: Use `vi.mock()` at top with class pattern; create `*.mocked.test.ts` for mock isolation
- **Mock static resolver**: For CResolver, use `vi.mock("path", () => ({ default: { resolve: () => mockFn() } }))`

### Gotchas

- **The target matrix (#1668)**: every fixture whose program names no target is
  transpiled and compiled for the host (and executed there), and also for
  `cortex-m7` and `atmega328p`, each against its real library: newlib and its C++
  headers, avr-libc, and the vendored CMSIS-Core in `vendor/cmsis-core/`. A
  fixture whose program names a target (a pragma, a helper's pragma, an inline
  description, `platformio.ini`) runs for that target alone. The compilers are
  GCC's (`TargetToolchain`, from the catalog's `toolchain_triple`/`toolchain_cpu`;
  other compilers are #1761). Every cell compiles with `-Werror`. An inline
  description compiles with the toolchain of the catalog row sharing its platform
  facts, and a cell nothing compiles fails unless the fixture is
  `// test-transpile-only` (#1760). Install the
  cross toolchains with `xargs sudo apt-get install -y < scripts/cross-toolchain-packages.txt`;
  without them the run stops at its preflight, which also compiles a data-model
  probe for every catalog row, so a false fact in `targets/targets.cnx` fails
  before any fixture. **A cross target must produce the host's output byte for
  byte** (and a `test-error` fixture the host's diagnostics). One that differs
  legitimately, such as a C header integer's width, is pinned with
  `#pragma target host`. A cell that fails for a known bug carries
  `// test-target-xfail` naming its issue and quoting its failure, and must keep
  failing that way: a marked cell that passes, fails with other text, or is named
  but never runs fails the fixture. A marked host cell waives only the `-Werror`
  compile: a `test-execution` program still links and runs, and must pass, unless
  the marker covers that failure too (#1760 second review)
- **Cross-file testing**: Always test with symbols in included files, not just same-file
- **Scope-context matrix (#1219)**: a check that works in one context routinely fails in
  another, and the corpus does not notice — 35 of 37 error codes have **zero** cross-file
  fixtures and none has a 2+hop one. An ADR owns its matrix: declare per-cell severity in a
  `<!-- MATRIX-SEVERITY -->` table (`off` / `warn` / `error`, undeclared → `off`), mark
  fixtures with `// test-adr: 051`, and run `npm run coverage:matrix`. Occupancy is
  **derived** — the context from a source position through the parse tree (a diagnostic's
  position, or one recorded by `AdrProvenance` where the rule fired), the file relationship
  from the include graph — so never declare a cell a fixture occupies; declare
  only the obligation. `off` is the recorded claim that a cell _cannot_ exist (a division
  cannot appear in a file-scope initializer), which is why exemptions live in the ADR where
  they get reviewed. `npm run coverage:matrix:check` gates in the `lint` job and fails on an
  unoccupied `error` cell or a stale `docs/scope-context-matrix.md`
- **The relationship axis counts cnx include hops.** A C header is not a hop, so a fact
  about a foreign type occupies `same file` however many headers the fixture includes: the
  cell is about how far the cnx program reaches to USE a name, not where the name is
  declared. #1511 declared ADR-030's `same file` cells `off` on the opposite reading, with a
  plausible justification, and `npm run coverage:matrix` disproved it on the first run.
  Adding `// test-adr: NNN` also changes generated output — ADR-043 carries a fixture's
  comments into it — so marking fixtures needs `npm run test:update` and a re-run after
- **Matrix limits, and what #1241 already fixed**: #1241 landed 2026-08-29 (`6192279d`,
  `bc3a2ad4`). A codegen-only fixture **can** now occupy a cell, so an ADR governing
  generated-code shape can declare `error` — occupancy derives from diagnostic positions
  **union** ADR provenance. What it costs is one line at the decision itself
  (`AdrProvenance.record("NNN", line)`); an ADR with no recording site still occupies
  nothing, and only ADR-016, ADR-044 and ADR-057 have one today (2026-09-05). Do not read `warn` on an existing
  matrix as "cannot be covered" — a `warn` declaration is an obligation, not a verdict on
  reachability; `docs/scope-context-matrix.md` is what says whether a cell is occupied.
  What remains is tracked as **#1402**: the relationship axis still measures the
  deepest include chain reachable from the fixture rather than the hops to the declaration
  under test, so **a helper feeding a matrix fixture cannot gain an include without silently
  moving cells**; and the two provider-side relationships stay not-derivable. Both need the
  provenance run to cover the include chain first: `IRecordedAdrSite.sourcePath` has a slot
  for the file, but provenance transpiles the fixture alone, so every site carries the
  fixture's own path and the field discriminates nothing yet
- **Presence is not proof**: a cell showing `ok` means a fixture reaches it, not that the
  fixture would **fail** if the feature broke. #1222 is exactly that — regression fixtures
  that cannot fail if the fix is reverted. Mutation-check anything you add: break the thing
  it watches and confirm it goes red
- **New PRs use the matrix (#1508, #1511)**: adoption is iterative — a PR brings the
  matrix along for the behavior it touches, never for someone else's ADR, and no PR is
  gated on completing another ADR's table. A PR that adds or changes a **cross-file**
  behavior does four things for that behavior: the owning ADR declares the cells it is
  observable in (`direct` and `transitive` per context; an undeclared cell reads as `off`
  and is a claim, so give it a sentence), the fixtures that exercise it gain
  `// test-adr: NNN` or get written, `npm run coverage:matrix` regenerates with
  `coverage:matrix:check` green for the declared rows, and the mutation check names the
  `transitive` cell it reddens. **Adoption is in progress, and which ADRs
  have a table is deliberately not recorded here** — it is one command,
  `grep -l MATRIX-SEVERITY docs/decisions/adr-*.md`, and what those declared cells
  actually occupy is `docs/scope-context-matrix.md`, which is generated. A count in prose
  is an ungated reading and rots, which this sentence demonstrated on itself: it named
  five ADRs as of 2026-09-05 and was short by twenty-two six days later, and the
  conclusion it drew from that count — that most cross-file work lands on an ADR with no
  rows, so "mutation-checked" has nothing cross-file to redden — had **inverted** rather
  than merely drifted. Ask the command, not the paragraph: if the ADR you are touching
  declares no rows, you are the PR that adds them for the behavior you touch; if it
  declares some, check the cells you are about to change. #1508 §2–4 is the worked example
  (ADR-010's include patterns); #1511 carries the per-PR rule for the Tier 2 moves
- **String comparison vs indexing**: `a = b` / `a != b` on whole `string<N>` values compiles to `strcmp` (value comparison, ADR-045). Indexing a string (`s[i]`) yields a `char` and compares as a `char` — e.g. `s[0] != 'H'` generates `s[0] != 'H'`, not `strcmp`. (Verified 2026-06-26; the prior note claiming `str[0]` generates `strcmp` was stale.)
- **Array declarations**: use prefix syntax `u32[N] arr` — C-style `u32 arr[N]` is rejected. `N` may be a literal or a `const`; the transpiler resolves consts to their value (no C VLA), so const-sized arrays are fine
- **C++ mode**: `const T` params become `const T&` with `.` access (not pointers)
- **Helper files**: the harness does not clean up a helper's generated files. An `.expected.h`/`.expected.c` beside a helper is a snapshot it compares (#1521) — create one to assert that helper's output, not to protect it from cleanup
- **Struct tests**: Need `.expected.h` alongside `.expected.c`
- **Bug reproduction**: `tests/bugs/issue-<name>/` directories — commit with fixes for regression prevention. They live under `tests/` so every fixture-walking script picks them up (#1142); a top-level `bugs/` tree was invisible to `npm test`, `test:all` and `validate:c`
- **test-error stale artifacts**: a test that compiled before becoming `test-error` leaves `.test.c/.test.h` behind — `rm` them or the guard fails with "stale generated artifacts". **This also contaminates mutation-checking**: a mutation that lets a `test-error` fixture compile leaves those artifacts behind, and they fail the guard on every later run even after the source is restored — so one mutation appears to redden fixtures it never touched. Delete them between runs or the attribution is wrong (found while mutation-checking #847's E0708 fixtures; the first table read as a stronger result than the truth)
- **Mutation-checking a fixture directory**: apply the mutation → `npm run build` → `rm` that directory's generated `.test.c/.test.h/.test.cpp/.test.hpp` → `npm test -- <dir>` → restore the source and clean again. **Assert the edit actually applied**: a scripted replacement matches on source text and prettier moves source text, so a stale anchor silently mutates nothing and reports the same green as a guard that cannot fail (three times in #1260 — an en-dash in `scripts/misra-baseline.mjs`, a prettier-rewritten emphasis marker in `docs/decisions/adr-070-return-value-use.md`, and a joined line in `ReturnValueUseAnalyzer.ts`). A correct table reddens exactly one fixture per mutation. **Assert the restore too, and never `git checkout --` a file
  carrying uncommitted work** — that reverts the fix along with the mutation. It happened
  twice in #1399, and the second time was noticed only when a fixture failed for an
  unrelated-looking reason, because the mutation _and_ the change under test had both
  vanished. Commit before mutating, or `cp` the file aside and copy it back, then grep for
  the mutation marker to confirm it is gone
- **Full-suite mutation or before-fix runs**: `git clone --local` into scratch and check out
  the SHA. Not `git archive`, since unit tests run `git ls-files`.
  Parallel runs each keep their logs inside their own clone
- **2.1 stops at a file's first failing analyzer stage**: a `test-error` fixture cannot
  assert that a later-stage diagnostic stays silent (a false E0854 beside an E0892 never
  runs). Put that guard across an include, where the includer is analyzed on its own
  (#1824 review)
- **Match an invariant's test on text only that invariant produces**: two invariants that
  share a message prefix let `toThrow(prefix)` pass with either one removed (#1824 review)
- **Counting fixtures**: `git ls-files 'tests/**/*.test.cnx'` misses the top-level
  `tests/*.test.cnx`. Add that pattern, or read the harness's `Passed:` line
- **A mutation must imitate the defect, not fit the guard.** Both are green-to-red, and
  only one is evidence. Twice in #1657 a guard was re-aimed and "mutation-checked" with a
  probe written to match its own pattern: the `isScopeType` guard kept the STATIC spelling
  (`Class.method(`), which occurs **0** times since the class became an instance, and
  `FLAG_READ` gained a receiver the code does not use. Both passed their checks and stayed
  dead against real code. Write the probe the way production spells it, then confirm it
  reddens
- **A `length > 0` population control cannot catch a dropped alternative.** The other
  alternatives keep the population non-empty, so the guard looks healthy while three
  spellings walk past it. Give an alternation **one control per arm**
- **A path-keyed guard detaches silently when its target moves.** #1657 moved
  `src/transpiler/state/` and left two depcruise rules, a source-scanning test, a
  `sonar-project.properties` exclusion and `ParseTreeSites`' roster pointing at nothing —
  each passing vacuously. `layer-rules.test.ts` now asserts every rule path still matches a
  tracked file; when you move anything, grep for the old path in **regex literals** too,
  which a string-literal sweep misses
- **Negative controls in error fixtures**: an `.expected.error` proves the diagnostic fires, not that it fires _only_ where it should. Put a case that must stay silent beside the flagged one — `tests/bugs/issue-847-misra-17-7-lowering/external-c-discard.test.cnx` calls a `void` C function directly above the non-void call and names only the latter in its `.expected.error`, so an analyzer that flagged every call regardless of return type would fail it. The assertion catches under-enforcement; the control catches over-enforcement
- **Examples are CI-guarded**: `scripts/__tests__/examples-transpile.test.ts` transpiles every `examples/**/*.cnx` during `npm run unit`
- **Orphaned snapshots are gone, and cannot come back (#1149).** A `.expected.cpp/.hpp` beside a
  `// test-c-only` fixture — or `.c/.h` beside `test-cpp-only` — is never regenerated _or_
  compared, so it preserves whatever codegen produced the day it was written; several held C++
  syntax in a `.h`. This entry used to say "30 exist … exclude them from any corpus-wide
  analysis", which is an instruction to remember something. **90 existed** when it was measured
  (66 snapshots, 24 generated files); all are deleted, and
  `scripts/__tests__/snapshot-modes.test.ts` fails on another. Nothing needs excluding, so
  nothing has to remember to
- **Dependency snapshots are compared (#1521).** The harness walks `*.test.cnx`, so a helper's
  `.expected.h` had no fixture to drive it: 60 were compared by nothing and 48 had gone stale —
  `chain-types-base.expected.h` still described a transpiler that predated scope-qualified C
  names, with the suite green. `runTest` now checks and updates every file a run generated for
  something other than the entry. CLAUDE.md's own "create `.expected.h` to prevent test framework
  cleanup" is what made them look like snapshots; the harness stopped cleaning helper files, so
  they are assertions now instead
- **`// test-no-warnings`** compiles `-c -O3` (`TestUtils.validateNoWarnings`). `-Wstringop-overflow`/`-Warray-bounds` are middle-end diagnostics — under the previous `-fsyntax-only` with no `-O` they could never fire, so the marker was inert (#1143). It compiles **every translation unit the fixture generates**, entry and helpers: until #1553 it compiled the entry alone, so a warning in a helper's implementation was invisible — that file reaches a compiler only at the execution link step, which passes neither `-Wall` nor `-Werror`. #1553 also passes the fixture's own directory on the include path, without which a generated `#include <sibling.h>` is not found and the check fails on a missing header rather than on warnings; a **quoted** include resolves relative to the includer and never needed it, which is why one multi-file fixture carried the marker for months without hitting it. **Line form only**, like every other marker. It was read in _block_ form only until #1555 — a spelling nothing decided (`7bd86291` glossed it "marker in block comment"; #239's extraction pinned it as a characterization test) and the corpus had already voted against, 954 line-form markers to 17. One fixture asked for the check and silently never got it. The block form is now **rejected loudly** by `scripts/__tests__/marker-spellings.test.ts`, which asks `scripts/TestMarkers.ts` — the one vocabulary naming every marker and its single spelling, and the thing to extend rather than re-deriving a regex at a sixth site

### Transpiler Entry Point

| Entry Point   | Purpose                                  |
| ------------- | ---------------------------------------- |
| `transpile()` | Single entry point for all transpilation |

Accepts `{ kind: 'files' }` for CLI/multi-file or `{ kind: 'source', source }` for API/single-file.
Always returns `ITranspilerResult`. `DualCodePaths.test.ts` verifies parity between both modes.
Header directive propagation is handled by `IncludeResolver.resolve()` for all include types.

---

## Code Generation

### Compliance Annotations — cnx STANDARD

**Whenever codegen emits code whose shape is dictated by a safety standard (MISRA C:2012, DO-178C, CERT, AUTOSAR, …) rather than by the obvious/naive translation, it MUST emit an explanatory comment directly above the generated construct.** This is a cnx standard, not optional.

The comment names the **standard + specific rule** and gives a **short WHY** (what the naive form would have done and which rule it violates):

```c
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint8_t* vs uint32_t*). */
buffer[0] = (uint8_t)(magic);
```

- **Why:** the generated C is the certification artifact. An annotation traces each non-obvious construct back to the rule that shaped it, so reviewers/auditors don't mistake it for accidental complexity.
- **Applies to** structural transformations and idiom substitutions: loop-idiom rewrites, compile-time unrolling, type-punning via unions, suppressions, etc. (Ubiquitous inline casts like a single narrowing `(uint8_t)` need not each carry a comment.)
- **Existing examples to follow:** `ControlFlowGenerator` (`forever` → Rule 14.3) and `ArrayHandlers.handleArraySlice` (slice unroll → Rule 21.15). Use the `/* <Standard> Rule <N>: <what> (<why>). */` form for consistency.
- **Format note:** use `/* … */` (house style for generated comments) and never nest `/*` inside the text (MISRA Rule 3.1).
- **Cite a standard only when one of its rules directly applies** (owner ruling, 2026-09-27:
  _"if no misra rules directly applies, then it should NOT be mentioned"_). A shape that cnx's
  own semantics dictate, such as a saturating clamp or evaluating an operand once, cites its ADR
  in the `/* ADR-NNN / Issue #N: … */` form the ADR-044 helpers use. It never cites a
  merely related rule: #1668's single-evaluation cast helper cites ADR-024, not MISRA
  Directive 4.9, whose rationale is similar but whose subject is function-like macros.

### Essential Patterns

- **expectedType**: render reads `state.expectedType` to qualify a bare enum member
  that 2.1 has already accepted; whether one is allowed is 2.1's decision (see
  "Enum `expectedType` Contexts")
- **Struct access**: Track `currentStructType` through member chains
- **A declaration renders through three plans**: a statement's (`planVariableDecl`), a
  scope member's (the scope-variable plan) and a struct field's. A change to declaration
  rendering is checked in all three (#1824 review)
- **C++ mode**: Parameter signatures are rendered by `ParameterSignatureBuilder.build()` for both `.c` and `.h` generation — shared from the builder inwards; what reaches it is still derived once per path (#1639). Use `CppModeHelper` for mode-specific logic
- **Handler state**: reach it through the context you were handed —
  `IAssignmentContext.state` in a handler, `IOrchestrator.state` in a generator,
  `this.host.state` in the walk; `CodeGenWalker.transpileState` is
  the accessor the ORCHESTRATOR reads, not the walk's own route. Never import
  `TranspileState` to
  construct one
- **`TranspileState`**: sole state container, and an INSTANCE since #1452 —
  `CodeGenerator` owns it as `readonly state`. This entry used to read
  "don't add instance state to CodeGenerator", which the same card inverted:
  the one instance field is exactly where the state now lives. What the rule
  still forbids is a SECOND container — another field holding per-file facts
  beside it

### Assignment Classification (`docs/architecture/codegen-decomposition.md`, formerly ADR-065)

To add new patterns: (1) Add `AssignmentKind` enum, (2) Update `AssignmentClassifier`, (3) Create handler, (4) Register handler, (5) Update test count.

### Adding CLI Flags

Update: `src/cli/index.ts` (parse + pass), `src/cnx/types/ITranspilerConfig.ts` (interface).

### Adding Generator Effects

1. Add to the `TIncludeHeader` union in `src/cnx/types/` — it is a shared
   contract, not a codegen type: `TranspileState` names it too, and
   `transpile-state-reads-no-later-pass` forbids the state importing `3-Render/`
2. Require it in 2.2 through **`PlannedRequirements.require()`** (`2-Plan/`), the
   one sink; `planFile` makes one per file, so it is never shared state
3. Read it into `IEmissionFacts` in **`FilePlanner.planEmissionFacts()`**
4. Emit it in **`CodeGenWalker.assembleGeneratedOutput()`** (via `addAutoIncludes()` for
   a real `#include`, or `addGeneratedHelpers()` for the three deferred code-emission
   members)

Three of the four names this list carried were wrong: `processEffects()` and
`assembleOutput()` have never existed, and the `needs*` fields were on the state
class rather than on `CodeGenerator` — which is the same file's own rule
("sole state container"). Corrected under #1449, which needed the real ones; the
class was `CodeGenState` then and is `TranspileState` now (#1452), which is the
second time this list has gone stale in prose. `npx tsc --noEmit` cannot catch a
name in prose; only a reader can.

### Struct Param Access Helpers

Use `memberAccessChain.ts` helpers rather than inlining the pointer-or-reference check: `getStructParamSeparator()` for `->` vs `.`, and `wholeParamValue()` for `(*param)` vs `param` wherever a parameter is used as a whole value — read, written, or the scalar a bitmap parameter's field is worked in. Both read one decision — a pointer in C, and a pointer in C++ too for a callback-promoted parameter (`forcePointerSemantics`) — so a member access and a whole-value use of one parameter cannot disagree. Never inline these. `wholeParamValue()` also holds the exceptions: a whole-value use of an opaque handle (`TParameterInfo.isOpaqueHandle`, ADR-030) or of an array parameter is not wrapped at all, because the pointer is the value. Until #1760 only the read side asked, so a written struct parameter was the bare pointer (`p = (*q);`) and a bitmap parameter's field was worked on the pointer itself.

This used to name a third, `buildStructParamMemberAccess()`, "for chains". It had **no production caller** — chains are built incrementally by `MemberSeparatorResolver` and the postfix generator, never in one call — and knip could not report it then, because its six test callers counted as usage (they no longer do: #1418). Deleted under #1450. A rule naming a helper nothing uses teaches the next reader a pattern the codebase does not have.

### Function Argument Generation

**Key principle**: Ask "What does the TARGET parameter expect?" not "What is the argument?"

- If target expects a pointer and the arg is a pointer of the same depth → pass directly
- If target expects a pointer exactly one level deeper than the arg → `&arg` (a handle passed to a `Dev**` out-parameter)
- If target expects a pointer and the arg is a struct value → `&arg`
- A whole array never takes `&`: it decays to a pointer to its first element
- If target expects value and arg is pointer → dereference
- Handler: `CallExprGenerator._generateCFunctionArg()` implements this logic
- Callback-promoted params (`forcePointerSemantics=true`) are already pointers matching typedef
- A call through a callback-typed value (a struct field, parameter or local) shapes its arguments from the function that is its type (`_signatureName`), exactly as a direct call to that function does

---

## Parser & Grammar

### Key Patterns

- **Keywords are separate tokens**: Use `ctx.THIS()` not `ctx.IDENTIFIER()?.getText() === "this"`
- **Grammar rules**: `arrayType` vs `arrayDimension`, `templateType` for C++ interop
- **AST navigation**: Use `functionDeclaration()` not `functionDefinition()`
- **Expression unwrapping**: Use `ExpressionUnwrapper` (`PARSE/2-Parse/`), in 1.2 only: `parse-tree-confined-to-parser` rejects it anywhere else

### After Grammar Changes

1. `npm run antlr`
2. Update `Parser.*Context` references
3. Remove dead methods (TypeScript flags "never read")
4. Update unit test mocks

---

## Cross-Scope Rules

- **Self-scope reference**: `Scope.member` inside `Scope` → error, use `this.member`
- **Global prefix**: `global.Scope.member` inside `Scope` → allowed
- **Private access**: Own scope can access via `this.` or `global.Scope.`
- **ADR-057 type qualification**: Check the _qualified_ name against the scope types the file can see (`TranspileState.isScopeType`), not the bare name against `scopeMembers`. This prevents non-type scope members (functions/variables) from capturing a same-named global type at a type position.
- **Qualify only the bare `userType()` branch.** `this.T`, `global.T` and `Scope.T` state their answer in the syntax and keep their own branches. This is not a style point: once a type name is resolved to a string, `global.Mode` and a bare `Mode` are byte-identical, so anything that qualifies _after_ resolution silently rewrites `global.` references. A post-pass over resolved names cannot be made correct — qualify while the parse tree is still available.
- **Two resolution points, one decision.** Type names are resolved twice, in different layers, and both must qualify:
  - **Symbols layer** — `TypeUtils.resolveType()`, fed an `isScopeType` predicate threaded from `CnxResolver.resolve()`. (`dispatchTypeResolution` was named here and was removed by #1285.) It answers with a settled name OR a `TDeferredType` when 1.3 cannot settle a bare name, and 1.4 Resolve settles those against the scope types that file can see — its own and its include closure's (`IProgram.isScopeTypeVisibleFrom`, #1724). Everything downstream (`TSymbol`, `HeaderSymbolAdapter`, the `.h`) inherits the name from here and must NOT re-qualify.
  - **Codegen layer** — `CodeGenWalker.getTypeName()` and friends (the method is the walker's; `CodeGenerator` has none), via the deps `TranspileState.typeBindingDeps()` hands to `TypeBinding`. The decision is still made here; it is reached by resolving a whole `TypeContext` rather than by qualifying a bare name at the call site. Its predicate is the symbols layer's: `TranspileState.isScopeType` asks `IProgram.isScopeTypeVisibleFrom` about the file being generated, so the `.h` and the `.c` qualify from one answer (#1724).
- **`CnxResolver` Pass 0b** collects the qualified names of scope-declared types (`TYPE_FORMING_KINDS`: enums, structs, bitmaps, and functions, which ADR-029 makes callback types) _before_ any type is resolved, so qualification does not depend on whether a type is declared above or below its use. Do not swap this for `scope.members`: that list is kind-agnostic (a scope variable named `B` would capture global type `B`) and is still being built while collectors read it.
- **`ScopeUtils.qualifyScopeType()`**: Shared utility in `src/cnx/utils/ScopeUtils.ts`. Takes `typeName`, the enclosing `scopePath`, and an `isKnownType(qualifiedName)` predicate. Its production callers are the symbols layer — `3-Declare/TypeBinding.ts` and `4-Resolve/DeferredTypes.ts` — and `OperandTyper`, with `program.isScopeTypeVisibleFrom` for the file being typed, when an operand names an enum type. Codegen reaches the same decision through `TranspileState.typeBindingDeps()`; `TypeGenerationHelper` injects the predicate through `ITypeGenerationDeps` instead, to stay unit-testable.
- **`ParameterInputAdapter.fromAST` struct detection**: `isKnownStruct` must check both the bare name AND the qualified name (`ScopeUtils.qualifyInScope(typeName, currentScopePath)` -- the whole PATH, not a scope's leaf name) for scope-local struct types. Without this, scope struct params get classified as pass-by-value while `mappedType` comes back qualified, causing `.c` body to use `->` on a non-pointer.

---

## ADR Rules

**CRITICAL: NEVER change ADR status without explicit user confirmation.**

| Status      | Meaning                                               |
| ----------- | ----------------------------------------------------- |
| Research    | Proposal under investigation — NOT established syntax |
| Accepted    | User-approved decision                                |
| Implemented | User-confirmed complete                               |
| WIP         | Accepted design, implementation in progress           |
| Rejected    | Decision NOT to implement                             |
| Superseded  | Replaced by a later ADR                               |

- **DO**: Update ADRs with research, context, links, findings
- **DO NOT**: Change Status or Decision without explicit approval
- **Sync order**: Update ADR file FIRST, then README.md

### What belongs in an ADR — the rewrite test

**If the transpiler were rewritten from scratch in a different language and stack, every ADR
must still be fully applicable.** That is the whole test. An ADR records a decision about the
_cnx language_ — its syntax, its semantics, the promises it makes. It is not a record of
how the current TypeScript/ANTLR/Node implementation happens to satisfy that decision today.

Implementation detail belongs in `docs/architecture/` (how the transpiler is structured) or
`docs/implementation/` (how one decision is carried out — see
`docs/implementation/adr-045-string-implementation.md`). Those documents are free to name
modules, and they go stale visibly.

**The in/out list lives in [`docs/decisions/README.md`](docs/decisions/README.md), once.** The
test above is the invariant and is safe to restate; the list is derived from it and is the part
that will change, so it has exactly one home. Do not copy it here — this rule's own predecessor
reached seven copies across CLAUDE.md and CONTRIBUTING.md before anyone noticed (#1403).

**ADRs point at nothing.** A previous version of this file required "implementing modules
cited as `file:line` in `## References`", which mandated the exact thing the rewrite test
forbids. It was also unenforceable in the direction that mattered: the prose is what rots.
ADR-013 described `private checkConstAssignment()` as a method on the codegen class long after
it became `static TypeValidator.checkConstAssignment()` in another file. ADR-055 specified a
13-field `interface ISymbol` whose flat model Phase 7 had removed — and the name survives in
`SymbolLookupHelper` on an unrelated two-field structural type, so a reader who grepped for it
found something that looked like confirmation and was not. Both are fixed; 055 is no longer an
ADR at all.

The prohibition is not new — it is why ADR-053 was withdrawn on 2026-08-28, "described the
transpiler's pipeline rather than deciding anything about the language". What was missing was a
_test_: "no implementation detail" gave no way to adjudicate a borderline passage, and 40 of 76
ADRs drifted past it (#1403) — a hand audit found 29 and the gate found the rest, which is the
argument for having a gate at all. The rewrite test adjudicates. Ask it of the passage, not the file.

### Numbering — an ADR's number band is the release it must ship in

**Never pick "the next free number."** Ask which release the decision must ship in:

| Band  | Work done during | Release gate                          |
| ----- | ---------------- | ------------------------------------- |
| `0xx` | v0.x             | All must be implemented to cut **v1** |
| `1xx` | v1.x             | All must be implemented to cut **v2** |
| `2xx` | v2.x             | All must be implemented to cut **v3** |

A band is a commitment, not a label: cutting `v(N+1)` requires every non-terminal ADR in band
`N` to be fully implemented (`Rejected` and `Superseded` are exempt). An ADR filed today but
deliberately deferred until after v1 is `1xx` work, even though it was written during v0.x.

Numbers are never reused, and changing an ADR's target release means `git mv` plus updating
every reference — including `.test.cnx` fixture comments, which ADR-043 carries into generated
output, so `npm run test:update` is required.

**Full rules and the old→new mapping table: [`docs/decisions/README.md`](docs/decisions/README.md).**

---

## Git Workflow

**All changes MUST go through Pull Requests.** See `CONTRIBUTING.md` for full workflow,
and [`docs/WORKFLOW.md`](docs/WORKFLOW.md) for how work moves on the project board.

- Never work directly on main — create feature branch first
- Check branch: `git branch --show-current`
- Branch naming: `feature/`, `fix/`, `docs/`, `test/` + descriptive name
- Commit generated `.test.c`/`.test.h` files — they're part of the test suite
- **Never delete generated test files** or run `git restore tests/`
- **Never squash-merge** — always use merge commits (`gh pr merge --merge`)

---

## Documentation Checklist

A task is NOT complete until:

- [ ] `README.md` updated (if feature-visible)
- [ ] ADR updated: decision, diagnostics, matrix — and it still passes the **rewrite test** above. No `src/**` paths, no module lists, no `file:line` citations, no transpiler identifiers, no TypeScript: they are wrong the moment the next merge shifts a line, and an ADR is the decision record, not a map of the code that currently implements it. Implementation detail goes to `docs/architecture/` or `docs/implementation/`. Enforced by `npm run adr:independence:check`
- [ ] `docs/learn-cnx-in-y-minutes.md` updated (if syntax changed)
- [ ] Memory bank updated

---

## Release

See [`releasing.md`](releasing.md) for complete process.

**Release attribution is derived, never recorded.** `npm run release:milestones`
gives every issue and pull request the milestone of the release that shipped it,
taken from the first tag containing its closing merge commit; `:check` reports
drift and writes nothing. It runs at the end of `publish.yml`, so a release
attributes itself, and the same command is also the backfill and the drift check
— one derivation, not three. The only milestone set by hand is the one on the
release issue, naming the version being prepared; the script reads it from the
open milestone that is not yet a tag.

An item closed by hand with no linked commit is **reported, not guessed at** —
an issue can close months after its fix shipped (#916 closed 2026-06-20; its fix
shipped in v0.2.7 on 2026-02-23), and a commit names an issue before it fixes
one, so both cheap heuristics are wrong in opposite directions. A pull request
merged into a stack that never landed is `not-shipped`: GitHub calls #1276 and
#1284 `MERGED` while their code is not on `main`, because `state: MERGED`
conflates merged with shipped and `git merge-base --is-ancestor` does not.

VS Code extension updates (if grammar changed):

1. `npm run antlr`
2. Update [vscode-cnx](https://github.com/smeltworks/vscode-cnx): `tmLanguage.json`, `completionProvider.ts`
