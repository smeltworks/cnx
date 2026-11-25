---
name: issue-check
description: "Review open GitHub issues for the cnx repo, detect in-flight work (open PRs, assigned issues, recent pushes), and recommend the best issue to tackle next using cnx's label taxonomy and conventions. Use when the user says /issue-check, 'what should I work on', 'check issues', 'next issue', or wants to pick their next task from the backlog."
user-invocable: true
tools: Bash, Read, Grep, Glob, WebFetch, Task, AskUserQuestion
---

# Issue Check — Smart Issue Triage and Recommendation (cnx)

Analyze the cnx repo's open GitHub issues, automatically detect what's already in-flight, and recommend the best issue to tackle next using a heuristic tuned to **this project's actual labels and workflow**. For bug issues, transition into the cnx TDD workflow; for features, into the ADR-first research workflow.

> **Project-specialized skill.** The scoring rubric (Phase 3) is tailored to cnx's labels, board fields and milestone-as-sprint convention. Phase 6 hands off to the `start-issue` skill, which owns the begin-work procedure and the ADR / `.test.cnx` TDD conventions from `CLAUDE.md`.
>
> This file previously claimed to override a personal `issue-check` of the same name. It did not: on a name collision the personal skill won, and everything below — the board query, the sprint filter, the cnx label taxonomy — never ran (#1415). Do not reintroduce a personal skill named `issue-check`; there is no override, only a shadow.

## Execution Workflow

Run these phases in order.

---

### Phase 0: Repo Context

Establish the repo and current state.

```
COMMANDS (run in parallel):
  git remote get-url origin                          # → extract {owner}/{repo}
  git branch --show-current                          # → current branch
  git log --oneline -10                              # → recent work context
```

```
EXTRACT owner/repo from remote URL:
  - HTTPS: https://github.com/{owner}/{repo}.git → {owner}/{repo}
  - SSH: git@github.com:{owner}/{repo}.git → {owner}/{repo}

STORE:
  OWNER_REPO = {owner}/{repo}   (expected: smeltworks/cnx)
```

---

### Phase 1: Detect In-Flight Work

Identify everything currently being worked on so we don't recommend conflicting work.

#### 1a: Open Pull Requests

```bash
# Get all open PRs with their linked issues and branch names.
# --limit is REQUIRED: this command defaults to 30, sorted by CREATED
# descending. An open PR older than the 30 newest reads as absent, and the
# issue it is fixing then reads as free work (#1416).
gh pr list --state open --limit 1000 \
  --json number,title,headRefName,body,author,updatedAt,labels \
  --jq '.[] | {number, title, branch: .headRefName, author: .author.login, updated: .updatedAt, labels: [.labels[].name], refs: ([(.body // "") | scan("(?i)\\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|part of):?\\s+(#[0-9]+)") | .[0]] | unique)}'
```

```
ASSERT the returned PR count is strictly less than the --limit above. If it
  equals the limit the list was truncated: SAY SO and stop, rather than
  detecting in-flight work from a page you can only partly see.
```

```
FOR each open PR:
  EXTRACT linked issue numbers from:
    - PR title (e.g., "Fix #123", "#123")
    - `refs`: the issues the WHOLE body names after a closing keyword or "Part of" ("Closes #123",
      "Fixes #123", "Resolves #123", "Part of #123"), a stacked PR's included. A bare mention ("see #123")
      is not in-flight work, and `smeltworks/vscode-cnx#11` is another repository's issue, so neither is kept.
      `gh pr list` has no `closingIssuesReferences` field on gh 2.45.0, so the keywords are read here
    - Branch name (e.g., "fix/123-description", "feature/123-thing", "issue-123")

  STORE as IN_FLIGHT_ISSUES: [{issue_number, pr_number, pr_title, author, domain_labels}]
```

#### 1b: Assigned Issues

```bash
# Issues assigned to anyone.
# `--assignee "*"` filters on the SERVER, so the answer does not depend on the
# page size at all -- it returns the assigned rows, where the unfiltered list
# must first receive every open issue and receives thirty of them.
# --limit is the bound behind it; the ASSERT below is what survives growth.
# The row count is deliberately not written here: it changed the day after it
# was measured, and this comment is read as ground truth. The assertion is what
# does not rot.
#
# Filtering an UNBOUNDED list here is what recommended #1449 as the top new pick
# while it was assigned, in WIP, and 34 minutes into planning. This command
# defaults to 30 sorted by CREATED descending, and #1449 sat outside that page
# despite being the 2nd-most-recently-UPDATED issue in the repo (#1416).
gh issue list --state open --assignee "*" --limit 1000 \
  --json number,title,assignees,labels,milestone,updatedAt,createdAt \
  --jq '.[] | {number, title, assignees: [.assignees[].login], labels: [.labels[].name]}'
```

```
ASSERT the returned count is strictly less than the --limit above, as in 1a.

ADD assigned issues to IN_FLIGHT_ISSUES (if not already there)
```

#### 1c: Recent Branch Activity

```bash
# Branches with recent pushes that reference issue numbers
git branch -r --sort=-committerdate --format='%(refname:short) %(committerdate:relative)' | head -20
```

```
EXTRACT issue numbers from branch names (e.g., "origin/fix/525-parser-bug" → #525,
  "origin/feature/1075-forbid-loops" → #1075)
ADD to IN_FLIGHT_ISSUES if not already tracked
```

#### 1d: Board State (REQUIRED — the board holds facts no label carries)

Where an issue sits, what is blocking it, and which release it ships in live on the
**project board**, not on labels. See [`docs/WORKFLOW.md`](../../../docs/WORKFLOW.md).

```bash
# --paginate is REQUIRED: the board is past 200 items, and a bare
# items(first: 100) truncates silently — every card past the first page
# reads as "not on the board" — no blocker, no status, no sprint.
#
# fieldValues is 100, not 20. --paginate cannot advance a NESTED connection, so
# an inner cap needs headroom rather than pagination (#1416). blockedBy is the
# same: 12 is the longest list on the board, and the jq REFUSES a truncated one
# rather than reading a dropped blocker as "not blocked".
#
# Blockers are GitHub's built-in "Blocked by" relationship on the issue (#1893),
# not a board field. The board's free-text `Blocked by` field is retired.
gh api graphql --paginate -f query='
query($endCursor: String) { organization(login: "smeltworks") { projectV2(number: 1) {
  items(first: 100, after: $endCursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
    content { ... on Issue { number
      blockedBy(first: 50) { totalCount nodes { number state } } } }
    fieldValues(first: 100) { nodes {
      ... on ProjectV2ItemFieldSingleSelectValue { name field { ... on ProjectV2FieldCommon { name } } } } }
  } } } } }' \
  --jq '.data.organization.projectV2.items.nodes[] | select(.content.number != null) |
        if .content.blockedBy.totalCount > (.content.blockedBy.nodes|length)
        then error("#\(.content.number): blockedBy truncated") else . end |
        "\(.content.number)\t\([.fieldValues.nodes[]|select(.field.name=="Status")|.name][0] // "-")\t\([.content.blockedBy.nodes[]|select(.state=="OPEN")|"#\(.number)"]|join(","))\t\([.content.blockedBy.nodes[]|select(.state=="CLOSED")|"#\(.number)"]|join(","))"'
```

```
STORE per issue: BOARD_STATUS, OPEN_BLOCKERS (column 3), CLOSED_BLOCKERS (column 4)

IS_BLOCKED = OPEN_BLOCKERS is non-empty. Nothing to parse, nothing to judge:
every entry is an issue, and its state comes back with it.

A CLOSED blocker STAYS on the relationship. It is the record of what the work
waited on, not a stale value — never remove it, never propose removing it.

A blocker that is not an issue yet — a pending decision, a slice of a larger
card — has no relationship to name it. File it as an issue and link that. The
qualifier ("only PR5", "the naming decision") goes in the comment that records
the link. Text written into the retired field before 2026-10-06 is preserved
verbatim in a comment on each card, marked `<!-- blocked-by-migration #1893 -->`.

OPEN_BLOCKERS is assigned for every card, because both consumers below print it,
and Phase 3's UNBLOCKS factor reads it in reverse.

"BLOCKED BY" ANSWERS ONLY HALF THE QUESTION. It records whether a CARD WAS NAMED,
not whether the work CAN BE FINISHED. A card whose definition of done requires an
artifact that does not exist yet — a directory another card creates, a generated
document another card gates — is unstartable with a permanently, correctly empty
"Blocked by". There is nothing to fix in it and nothing a board query can see.
Phase 3.5 asks the second question, and it is NOT OPTIONAL: skipping it is how
#1444 got recommended as the top pick while carrying a 13-hour-old comment saying
it could not close.

IF the query fails (needs `gh auth refresh -s project`):
  SAY SO EXPLICITLY and stop — do not fall back to label-only scoring and
  present it as a recommendation. A ranking that silently ignores "Blocked by"
  is worse than no ranking, because it looks authoritative.
```

---

### Phase 2: Fetch Open Issues

```bash
# --limit must exceed the open-issue count or the tail is dropped in silence.
# gh returns the most recently CREATED first — NOT the most recently updated.
# That distinction is the whole trap: recency of ACTIVITY does not keep a row in
# the page, so an assigned issue, or one commented on minutes ago, drops out
# exactly like a dormant one. The previous version of this comment said
# "most recently updated", which made an assigned issue look safe unbounded and
# is why Phases 1a and 1b kept the bug after Phase 2 was fixed (#1416).
# Measured: the default page's createdAt column is byte-identical to itself
# sorted descending, updatedAt is not, and the 2nd-most-recently-updated issue
# in the repo was outside it.
# The ASSERT below is the part that survives backlog growth; the number alone rots.
gh issue list --state open --limit 1000 --json number,title,labels,milestone,createdAt,updatedAt,comments,body \
  --jq '.[] | {number, title, labels: [.labels[].name], milestone: .milestone.title, created: .createdAt, updated: .updatedAt, comment_count: (.comments | length), body: .body[:300]}'
```

```
ASSERT the returned issue count is strictly less than the --limit above. If it
  equals the limit the list was truncated: SAY SO and stop, rather than ranking a
  backlog you can only partly see.

DETERMINE ACTIVE_MILESTONE = the release being prepared, as printed by
  `git fetch --tags && npm run -s release:preparing` (tags decide it, so fetch first).
  That is `ReleaseWindows.preparing`, the one definition (#1912): the lowest-versioned
  open `vMAJOR.MINOR.PATCH` milestone that is not yet a tag. This repo uses a milestone
  as its sprint (docs/WORKFLOW.md, "Releases are issues"). Every higher release is
  pre-planning, and nothing is recommended from it: hard stop (owner ruling on #1918).
  If the command exits non-zero, SAY SO and stop. Do not restate or re-derive the rule.

  Not "the milestone with the most open issues". The two agreed only while the release
  being finished also happened to be the largest. On 2026-10-07 `v0.3.1` had 4 open and
  `V0.4.1` had 7, all 7 of them in Grooming. "Most issues" picked `V0.4.1`, which had
  nothing to recommend, while `v0.3.1` still had an unblocked card (#1428).

PARTITION issues into:
  IN_FLIGHT_DISPLAY = open issues that ARE in IN_FLIGHT_ISSUES (for the report)

  EXCLUDED = open issues, each with the reason, where any of:
    - BLOCKED       IS_BLOCKED (Phase 1d)         → name the OPEN_BLOCKERS
    - GROOMING      BOARD_STATUS == "Grooming"    → not triaged; scope is still open
    - EPIC          has the "epic" label          → a tracker, never picked up directly
                    EXCEPT the release card: the ACTIVE_MILESTONE card titled
                    `Release <ACTIVE_MILESTONE>` (`.github/ISSUE_TEMPLATE/release.md`).
                    It is the work of cutting the release, not a tracker, whatever its
                    labels say, and it stays in AVAILABLE_ISSUES. Its definition of
                    done needs every other card in the milestone closed, so Phase 3.5
                    reports it Not startable until they are, and it ranks first once it
                    is the last open card in the milestone. On 2026-10-07 #1324 was the
                    only open card in `v0.3.1`, and dropping it as an epic reported
                    "nothing in it can be scored" for a release that was ready to cut.
    - OUT_OF_SPRINT milestone != ACTIVE_MILESTONE → a later release is pre-planning

  AVAILABLE_ISSUES = everything else

Recommend only from ACTIVE_MILESTONE. There is no flag or argument that widens it
  (owner ruling on #1918): a higher release is pre-planning, and nothing is picked from it.
```

---

### Phase 3: Smart Prioritization (cnx rubric)

Score each AVAILABLE_ISSUE using a weighted heuristic tuned to cnx's label taxonomy.
Higher score = recommend first.

**Note:** there are no `status:` labels. Where an issue sits, what blocks it, and
which release it ships in live on the project board — read in Phase 1d and applied
as *exclusions* in Phase 2. By the time an issue reaches this rubric it
is already known unblocked, triaged, and in the active sprint. Scoring only ranks
what can actually be started.

The board feeds one score as well: **UNBLOCKS**, read from the *other* cards' blockers.
A card's own "Blocked by" decides whether it can be picked; every other card's
"Blocked by" says what picking it frees. Without that, a card holding back the
sprint's biggest bug scores the same as one that frees nothing.

#### Scoring Rubric

```
FOR each available issue, compute SCORE:

  LABEL PRIORITY (0-40 points) — take the HIGHEST matching label:
    "priority: high"                      → +40
    "bug"                                 → +30
    "validation-bug"                      → +28   (missing compile-time validation)
    "priority: medium"                    → +20
    "safety" or "MISRA Violations"        → +18   (correctness-critical for embedded)
    "enhancement"                         → +12
    "test-coverage"                       → +10
    "good first issue"                    → +8
    "documentation"                       → +5
    "tech-debt"                           → +15   (architecture/duplicate-path work)
    "interop"                             → +12
    "priority: low"                       → +3
    "question"                            → +2
    "epic" / "wontfix" / "test-blocked"   → -100 (skip — see Anti-Patterns;
                                             the release card is exempt, Phase 2)
    "duplicate" / "invalid"               → -100 (skip)

  SPRINT MEMBERSHIP (0-30 points):
    In ACTIVE_MILESTONE                   → +30
    In a different open milestone         → +5
    No milestone                          → +0

    Due dates are NOT scored. This repo does not set them — the milestone names
    the release, and the board status says where the work is. Scoring proximity to
    a date nobody sets gave every issue in a milestone an identical +5, which made
    sprint membership a rounding error.

  COMMUNITY SIGNAL (0-15 points):
    Comment count:
      10+ comments                        → +15
      5-9 comments                        → +10
      2-4 comments                        → +5
      0-1 comments                        → +0

  AGE (0-5 points):
    A mild nudge against stale backlog — deliberately too small to outrank
    sprint membership, which it used to do 3:1.
      > 6 months old                      → +5
      3-6 months old                      → +3
      1-3 months old                      → +2
      < 1 month old                       → +0

  ESTIMATED COMPLEXITY (0-10 points):
    Prefer medium complexity (good progress, not overwhelming):
      Short body (<100 chars)             → +5 (likely small fix)
      Medium body (100-500 chars)         → +10 (well-scoped)
      Long body (500+ chars)              → +3 (may be complex)

  UNBLOCKS (0-20 points):
    What closing this card frees. It is a REVERSE index over Phase 1d: the
    OPEN_BLOCKERS of every OTHER open card, not anything on this card.

    FOR each open card X whose OPEN_BLOCKERS name this issue:
      SKIP X if it has the "epic" label. An epic or release tracker is blocked by
        every card it tracks, so counting it would give every sprint card the same
        points, and the factor would rank nothing.
      SKIP X if it is outside ACTIVE_MILESTONE, the same as the
        sprint filter in Phase 2.
      this issue is X's ONLY open blocker   → +10  (closing it frees X)
      X has other open blockers as well     → +5   (closing it shortens X's chain)
    Cap at 20.

    Use OPEN_BLOCKERS exactly as Phase 1d read it, not a regex over a body or a
    comment. Prose quotes issues it does not wait on: #1668's old field named #1780
    next to "#1780 no longer gates it". Counting those references would credit
    cards that free nothing. A blocker Phase 3.5 derived but nobody has linked yet
    names no card here and scores nothing.
```

```
DOMAIN LABELS (parser, code-generator, types, scope, operators, control-flow,
  interop, embedded, primitives, bitwise-ops, postfix-chains, ...):
  → NOT scored. Used only for conflict detection vs in-flight PRs (see Decision Trees).

RANK available issues by SCORE descending.
```

---

### Phase 3.5: Startability Gate (top candidates only) — REQUIRED

Phase 1d asked *"was a card named?"*. This phase asks *"can this finish?"* — the question
that actually decides whether to recommend. They are different questions, they disagree on
real cards, and the answer to the first is not the answer to the second.

**#1313 states the governing rule, and it is the authority for the whole board:**

> An empty `Blocked by` means _no card was named_, not _this can be finished today_.
> Where the two disagree, **the definition of done is the authority**.

Run this on the **top 5 ranked candidates only**. You are burned only by a card you are
about to recommend, so the gate is bounded — reading comments across the whole backlog is
not affordable and is not the point.

```
FOR each of the top 5 ranked candidates:

  1. COMMENTS — cheapest check, and the one that has actually fired.
       # --paginate is REQUIRED. This endpoint pages at 30 and returns comments
       # ASCENDING by creation, so the tail that drops is the NEWEST — which is
       # exactly where a set-aside note lives, and is the signal this phase
       # exists to find. A per-item --jq is safe under --paginate; an aggregate
       # one like `length` is not, it prints once per page (#1416).
       gh api --paginate 'repos/smeltworks/cnx/issues/<n>/comments?per_page=100' \
         --jq '.[] | "\(.created_at) @\(.user.login)\n\(.body)"'

     A comment that sets the card aside, defers it, assigns it a later wave, says it
     "cannot close", or records a branch created and deleted unused → NOT STARTABLE.
     Quote it WITH ITS TIMESTAMP, so the reader sees how long the signal sat there.

  2. PARENT SEQUENCING — if the body says "Part of #NNNN", or a parent issue is set,
     read that issue's BODY (not its comments — roadmaps live in the body):
       gh api repos/smeltworks/cnx/issues/<parent> --jq '.body' \
         | grep -nEi "wave|startable|sequencing|critical path"

     Find THIS card in what comes back. A parent that places it in a later wave, or
     names it in a "cannot finish" section, outranks the card's empty "Blocked by".

  3. DEFINITION OF DONE — read it, and ask of every checkbox: does this require
     something that does not exist yet?
       gh api repos/smeltworks/cnx/issues/<n> --jq '.body' \
         | grep -A25 -i "definition of done"

     A checkbox naming a directory, a generated document, or an artifact another card
     owns is a dependency "Blocked by" does not carry. VERIFY it with a command — `ls` the
     directory, `test -f` the document, `grep` for the symbol — rather than assuming in
     either direction.

  4. CROSS-ISSUE CLAIMS IN THE DoD — a box that NAMES another issue is ASSERTING
     something about it, and `.state` is not that assertion. Check the claim, not the
     state. This is the check the other three cannot make: they all pass when the named
     issue is cleanly closed, which is exactly when the claim is most likely to be wrong.
       gh api repos/smeltworks/cnx/issues/<n> --jq '.body' \
         | grep -nE "#[0-9]{3,4}" | grep -iE "fixed|landed|by the|subsumed|requires"

     For each such box, resolve WHEN and BY WHAT the named issue closed — a close date
     alone settles it in most cases:
       gh api repos/smeltworks/cnx/issues/<named> --jq '{state, closed_at}'
       gh api --paginate 'repos/smeltworks/cnx/issues/<named>/timeline?per_page=100' \
         --jq '.[] | select(.event=="closed" or .event=="cross-referenced")
               | "\(.event) \(.created_at) \(.commit_id // .source.issue.number // "-")"'

     A box reading "#A and #B are fixed BY <the change this card makes>" is FALSE for #B
     if #B closed BEFORE that change landed — however cleanly #B is closed. #1448 is the
     worked example: its blockers were #1320, #1322 and #1447, all three closed, so
     the blockers, the board and checks 1-3 all said available and it ranked top. Box 3
     claimed the hoist fixed #1430 **and #1398**; #1398 had closed a week earlier via
     PR #1502, with no fixture anywhere in `tests/`. The box was unsatisfiable as
     written and the card could not close.

  A card failing ANY of the four is NOT STARTABLE: drop it from the recommendation,
  report it under "Not Recommended Yet" with reason `Not startable` and the evidence,
  and re-rank without it.

  A card passing all four: SAY WHAT YOU CHECKED when recommending it. "startable: no
  set-aside comment, parent places it in wave 1, DoD has no unbuilt-artifact item, and
  its cross-issue claims hold" is an artifact a reader can check. "Unblocked" is not.
```

**A card's own claim about its readiness is not evidence.** #1444's body says _"which is
why this card is first: it has no open blocker."_ That sentence is scoped to its track, and
#1313's correction 1 is titled _"'This card is first' scopes to Track F, not to the epic"_ —
reading it as first-overall "routes work to a card five waves early." Quoting a card's
self-assessment back as justification is the failure, not the check: the body is written
once, at filing, and the sequencing that invalidates it lands later and elsewhere.

**When the gate fires and "Blocked by" is silent, that is the link case.** The blocker you
just derived is a NEW blocker — added as a built-in link beside whatever the issue already
lists, never in place of it (see Anti-Patterns). Surface it and offer to record it; do not
write it unasked.

---

### Phase 4: Present Report

Output a clear, actionable report.

#### In-Flight Work Summary

```
## Currently In-Flight

| Issue | Title | Status | Who |
|-------|-------|--------|-----|
| #525  | Fix parser bug | PR #530 open | @username |
| #510  | Add feature X  | Assigned to @dev | @dev |

These issues are excluded from recommendations to avoid conflicts.
```

#### Excluded by the Board

Always print this, even when empty. A card skipped silently reads as a card that
does not exist, and the reason it was skipped is usually the useful part.

```
## Not Recommended Yet

| Issue | Reason | Detail |
|-------|--------|--------|
| #1323 | Blocked | #1301, #1319 — both open |
| #1324 | Blocked | #1313 open; #1357 closed, no longer a blocker |
| #1444 | Not startable | no blockers; #1313 places it in wave 5 — DoD needs `PARSE/1-Discover/`, which needs #1443's map |
| #1313 | Epic    | tracker; closes when its children do |
| #1374 | Grooming | not triaged — scope still open |

`Blocked` and `Not startable` are different findings and must not be merged into one
reason. `Blocked` means a linked card is still open, "Blocked by" is doing its job, and
the remedy is to wait. `Not startable` means "Blocked by" is silent or satisfied and the
work still cannot finish — the remedy is to link the derived blocker (Phase 3.5). Collapsing
them hides the second, which is the one no query can see.

Ranking below covers <ACTIVE_MILESTONE> only. Later releases are pre-planning.

Detail names the OPEN blockers — a closed one is history and does not belong in a
"why this is skipped" column. An earlier version of this
sample read `| #1322 | Blocked | #1316, #1321 |` and
`| #1318 | Blocked | #1285 (PR5-PR7) |`; those values are what #1419 recovered the
two cleared fields from, and `git show 21823602` still carries them.
```

#### Top Recommendations

```
## Recommended: #<number> — <title>

**Score**: <N>/120
**Type**: <bug|validation-bug|enhancement|feature|docs|test-coverage>
**Domain**: <parser|code-generator|types|scope|safety|MISRA|... if labeled>
**Board**: <BOARD_STATUS> · <milestone> · unblocked
**Why this one**:
  - <reason 1: e.g., "priority: high + bug — correctness over convenience">
  - <unblocks, when it scored: e.g., "unblocks #1668 (+5, which also waits on #1737)">
  - <reason 2: e.g., "bug label — correctness over convenience">
  - <reason 3: e.g., "8 comments indicate active discussion">
  - <reason 4: e.g., "Well-scoped description suggests medium effort">

**Summary**: <first 2-3 sentences of issue body>

---

### Runners-up

| Rank | Issue | Title | Score | Type |
|------|-------|-------|-------|------|
| 2    | #<n>  | <title> | <score> | <type> |
| 3    | #<n>  | <title> | <score> | <type> |
```

---

### Phase 5: User Decision

```
ASK the user:
  "Want to start on #<recommended>? Or pick a different one from the list?"

  Options:
    1. Start on #<recommended>
    2. Pick a runner-up (show list)
    3. Let me choose a specific issue number
    4. Skip for now
```

---

### Phase 6: Begin Work (after user confirms) — hand off to `start-issue`

**Invoke the `start-issue` skill with the chosen issue number.** It owns the whole
begin-work procedure: assign the issue, block until the board reaches `WIP`, derive
blocked-ness, run the dedup gate, deep-read the issue, create the branch, and route
into the TDD or ADR-first workflow.

These steps used to live here in full. They moved so that the two ways of starting work
— picking an issue through this skill, and naming one directly ("start on #1234") —
run the same procedure instead of two copies that must be edited together (#1423).

```
INVOKE: start-issue, with <issue_number>
```

**Do not restate those steps here, and do not re-implement any of them.** In particular
the assignment is not optional and not this skill's to perform: assigning is what moves
the card to `WIP`, and duplicating it here would give the transition two owners.

---

## Decision Trees

### Conflict Detection (domain-label aware)

```
IF a recommended issue shares a DOMAIN label (parser, code-generator, types, scope, ...)
   with an in-flight PR:
  WARN: "Note: #<recommended> (<domain>) overlaps the area of in-flight PR #<pr>.
         There's some conflict risk. Proceed carefully or pick another."
```

### Blocked Work and Sequencing

```
"Blocked by" is GitHub's built-in issue relationship (#1893). Every entry is an
issue, so it is a link, not text. It is also a PERMANENT RECORD of what the work
waited on: a blocker that has closed STAYS linked. Never remove a link, never
replace one, and never propose either. A new blocker is a new link beside the old.

A card with blockers is therefore not by itself a reason to skip an issue. Use
IS_BLOCKED from Phase 1d, which asks whether any linked blocker is still open.

NEVER recommend an issue that IS_BLOCKED. Report it under "Not Recommended Yet"
with the OPEN blockers named, so the user can see the chain.

IF every issue in the active milestone is blocked:
  SAY SO, and name the root blockers — that set IS the recommendation.
  "Everything in <milestone> is blocked on #<a> and #<b>. Those are the work."

IF every linked blocker has closed:
  The issue is AVAILABLE and the links are already correct — a resolved blocker is
  history, not a stale value, and there is nothing to fix. Say so when recommending
  it: "unblocked (was: #1316, #1321 — both closed)", so the reader can see the
  blockers were read rather than ignored.

IF a comment qualifies an open blocker ("#1285 PR5 - do PR5 first"):
  The link cannot see inside it, so the issue stays BLOCKED. Print the qualifier
  verbatim so the user can overrule it.
```

### Unblocked Is Not Startable

```
An empty "Blocked by" is not a green light. It says no card was named — nothing more.
A card can be correctly, permanently unblocked there and still be unable to
finish, because its definition of done requires an artifact that other cards produce.

The two failures look identical from the board and are distinguished only by Phase 3.5:

  BLOCKED        a linked card is still open
                 → "Blocked by" is working; wait, and name the open blockers
  NOT STARTABLE  "Blocked by" is silent or satisfied, and the DoD still cannot be met
                 → it never knew; derive the blocker, and offer to LINK it

The shape to watch for is a card that BUILDS SOMETHING OTHER CARDS PLACE. Migration
and restructuring cards read as "first" — they create the destination — but the
destination cannot be decided until the cards that move into it have decided what
moves. Those cards are structurally LAST while reading as first. #1444 and #1451 are
both this shape; each ends with "create the directory and move the modules", and the
map authorizing the move is gated on the pass splits.

WHEN THE WAVE TABLE AND A CARD'S DoD DISAGREE, SAY SO — do not silently pick one.
#1313 places #1446 in wave 1, yet #1446 carries the same two DoD checkboxes that
disqualify #1444 and #1451. That is a defect in the roadmap, not a judgement call for
this skill to make quietly: report both readings and let the user adjudicate.
```

### Stale Issues

```
IF an issue has no activity for 12+ months AND no milestone:
  DEPRIORITIZE (but don't hide) — note "stale" in the report
  Suggest the user consider closing it if no longer relevant
```

### Empty Backlog

```
IF no open issues exist:
  "No open issues found. The backlog is clear!
   Consider: reviewing closed issues for follow-ups, or creating new issues for planned work."
```

## Anti-Patterns

- **DO NOT** recommend issues that are clearly in-flight (have open PRs, are assigned, or have recent branch activity)
- **DO NOT** start implementing without user confirmation of which issue to work on
- **DO NOT** pick issues labeled "test-blocked", "wontfix", or "epic", except the release
  card (Phase 2): it is the release's last piece of work, not a tracker
- **DO NOT** recommend an issue that IS_BLOCKED (its "Blocked by" links something
  still open), or one sitting in `Grooming`
- **DO NOT** treat an empty "Blocked by" as "startable" — it means no card was named.
  Run Phase 3.5 on the top candidates before recommending any of them; a card can be
  correctly unblocked and still unable to close
- **DO NOT** quote a card's own claim that it is ready ("this card is first: it has no
  open blocker") as evidence that it is. That sentence is written at filing; the
  sequencing that invalidates it lands later, in the parent. Check the parent
- **DO NOT** accept a definition-of-done box that names another issue on the strength of
  that issue's `.state`. A box claiming "#A and #B are fixed by this change" is false for
  any of them that closed BEFORE the change landed, and a cleanly-closed issue is exactly
  when checks 1-3 all pass — #1448 ranked top that way
- **DO NOT** skip reading the top candidate's comments. #1444 carried an explicit
  "Set aside — this card is wave 5, not wave 1" for 13 hours and was still recommended
  as the top pick, because no phase read comments
- **DO NOT** remove a "Blocked by" link, replace one, or propose either — it is a
  permanent record, and a blocker that has closed is history, not a stale value. A new
  blocker is a new link beside the old, never substituted for it
- **DO NOT** read or write the board's retired free-text `Blocked by` field. Blockers
  are the built-in relationship (#1893); the old text survives only as a comment
- **DO NOT** fall back to label-only scoring when the board query fails — say it failed
  and stop; a ranking that ignores "Blocked by" looks authoritative and is not
- **DO NOT** widen past the active milestone, for any reason — the milestone is the sprint
- **DO NOT** assume issue type from title alone — check labels and body content
- **DO NOT** propose massive refactors as "quick fixes" — scope work to the issue
- **DO NOT** restate or re-implement `start-issue`'s begin-work phases here — the dedup
  gate, the assignment, the branch rules and the TDD/ADR routing live there, and a copy
  in this file is two procedures to keep in step (#1423)

