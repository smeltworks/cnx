---
name: start-issue
description: "Begin work on a known cnx issue: assign it, block until the project board reaches WIP, run the dedup gate, read the issue and its blockers, create the branch, and route into the TDD or ADR-first workflow. Use when the user says 'start on #1234', 'work on #1234', 'let's do #1234', '/start-issue 1234', or when issue-check has selected an issue."
user-invocable: true
tools: Bash, Read, Grep, Glob, AskUserQuestion
---

# Start Issue — Begin Work on a Chosen cnx Issue

The single begin-work procedure for this repository. Two entry points reach it:

- **Directly** — "start on #1234", when the issue is already chosen.
- **From `issue-check`** — its Phase 6 hands off here once the user picks an issue.

There is deliberately no second copy of these steps. `issue-check` used to own them
(its Phase 6) and now delegates; adding the branch rules or the routing back into that
file would recreate the duplicate code path CLAUDE.md calls the project's worst
anti-pattern (#1423).

> **What this skill exists to stop.** Before it, nothing ever assigned an issue, so the
> board's `WIP` column had been empty since it was created — zero open issues assigned,
> zero cards in `WIP`, with the `issues.assigned → WIP` automation in
> `.github/workflows/project-sync.yml` sitting correct and unfired. Work went
> `Grooming`/`Backlog` → `Done`, and `issue-check`'s assignee-based in-flight detection
> could never find anything. Phase 1 is the whole point of the skill; the rest is the
> procedure that used to live elsewhere.

## Execution Workflow

Run these phases in order. **Phase 2 blocks** — do not read code, create a branch, or
start work until the board is confirmed.

---

### Phase 0: Resolve the Issue Number

```
EXTRACT the issue number from the user's message ("start on #1234" → 1234).

IF no number is present or more than one is:
  ASK which issue. Do not guess, and do not pick the largest or most recent.

STORE: ISSUE = <number>, OWNER_REPO = smeltworks/cnx
```

---

### Phase 1: Assign — FIRST, before reading anything

Assignment is what moves the card. It happens before the deep read so that the board
reflects the work from the moment it starts, not from whenever the reading finishes.

```bash
# Confirm the issue is open and see who, if anyone, already holds it.
gh api repos/smeltworks/cnx/issues/<ISSUE> \
  --jq '{state, assignees: [.assignees[].login], title}'
```

```
IF state is "closed":
  STOP. Say so. A closed issue is not started — "closed is closed"
  (docs/WORKFLOW.md), and a defect found after the fix shipped is a NEW issue.

IF assignees already contains someone else:
  STOP and ask. Someone is on it. Do not co-assign silently.

IF assignees already contains jlaustill:
  Already assigned. Skip the write, go to Phase 2 and verify the board anyway —
  a previous attempt may have assigned without the card moving.
```

```bash
gh issue edit <ISSUE> --add-assignee jlaustill

# Fallback — `gh issue` subcommands are unreliable in this repo (CLAUDE.md).
# Use the REST endpoint if the above fails:
gh api -X POST repos/smeltworks/cnx/issues/<ISSUE>/assignees \
  -f "assignees[]=jlaustill"
```

```bash
# Confirm the write landed before waiting on anything downstream.
gh api repos/smeltworks/cnx/issues/<ISSUE> --jq '[.assignees[].login] | join(",")'
```

---

### Phase 2: Verify the Board Reached WIP — BLOCKING

`project-sync.yml` maps `issues.assigned → WIP`. It is a **GitHub Actions run**, so it
completes seconds to minutes after the assignment, not instantly. Re-query the board
and report the value you actually read (CLAUDE.md, "Reported State — Re-query, Never
Restate"): asserting `WIP` because you assigned is exactly the failure that rule names.

```bash
# Poll until the card reaches WIP, or ~5 minutes elapse.
# --paginate is REQUIRED: the board is past 200 items and items(first: 100)
# truncates silently, which reads as "not on the board".
deadline=$((SECONDS+300))
q='query($endCursor: String) { organization(login: "smeltworks") { projectV2(number: 1) {
  items(first: 100, after: $endCursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      content { ... on Issue { number } }
      fieldValues(first: 100) { nodes {
        ... on ProjectV2ItemFieldSingleSelectValue {
          name field { ... on ProjectV2FieldCommon { name } } } } }
    } } } } }'
while [ $SECONDS -lt $deadline ]; do
  s=$(gh api graphql --paginate -f query="$q" \
    --jq '.data.organization.projectV2.items.nodes[]
          | select(.content.number == <ISSUE>)
          | [.fieldValues.nodes[]|select(.field.name=="Status")|.name][0] // "unset"' \
    2>/dev/null | head -1)
  echo "#<ISSUE> board status: ${s:-<not on board>}"
  [ "$s" = "WIP" ] && { echo "REACHED WIP"; exit 0; }
  sleep 15
done
echo "TIMED OUT without reaching WIP"; exit 1
```

Run it with `run_in_background` so the wait does not block the tool call itself, then
**wait for its result before Phase 3.**

```
INTERPRET the final status. Three outcomes, and they are NOT the same:

  WIP
    → Correct. Proceed to Phase 3.

  "Changes Needed" | "Ready to Merge" | "PR Review" | "Done"
    → The automation DECLINED ON PURPOSE. project-sync.yml only overwrites
      `unset|Grooming|Backlog`, because it must never drag a card backwards.
      This is correct behavior, not a failure. Say which status it is and why the
      card was left alone, then ask whether to continue — a card in `Done` or
      `PR Review` usually means the work is already under way or finished.

  unset | Grooming | Backlog | <not on board>, after the timeout
    → The automation FAILED. Report it as a failure and STOP.
      Likely causes, in order:
        - The smeltworks board GitHub App cannot mint its token: it is not
          installed on the organization, or BOARD_APP_ID / BOARD_APP_PRIVATE_KEY
          is missing (#2189). GITHUB_TOKEN cannot write Projects v2.
        - The workflow run errored. Check it:
              gh run list --workflow=project-sync.yml --limit 5
              gh run view <id> --log-failed
        - The board has no `WIP` option (see docs/WORKFLOW.md).
```

**NEVER write the Status field by hand to "fix" this.** `project-sync.yml` is the sole
owner of that transition. A second writer is the duplicate code path again, and it would
mask the broken automation for every future issue instead of surfacing it once here.

---

### Phase 3: Blocked Check

`issue-check` refuses to recommend a blocked issue. Naming an issue directly bypasses
that filter, so the check is repeated here — otherwise this entry point silently loses
a guard the other one has.

```bash
# The issue's built-in "Blocked by" relationship (#1893). The board's free-text
# `Blocked by` field is retired; nothing reads or writes it.
gh api --paginate 'repos/smeltworks/cnx/issues/<ISSUE>/dependencies/blocked_by?per_page=100' \
  --jq '.[] | "#\(.number) \(.state)"'
```

```
"Blocked by" is a PERMANENT RECORD of what the work waited on, never a live state.
A blocker that has closed STAYS linked — never remove a link or replace one.
Blocked-ness is DERIVED from the blockers' states, never from whether the list is empty.

any blocker still open
  → STOP. Name the open blockers, and any qualifier a comment gives them ("only
    PR5"), and ask whether to proceed anyway. The user may overrule; you may not
    overrule silently.

every blocker closed
  → Not blocked. Say "unblocked (was: #1316, #1321 — both closed)" so the reader
    can see the blockers were read rather than ignored. Change nothing.

no blockers
  → Not blocked by any card. That is not "startable" — Phases 5 and 7 still apply.
```

---

### Phase 4: Dedup Gate

```bash
git log --oneline --grep="<ISSUE>"
```

```
IF commits reference this issue:
  WARN that it may already be done; show the commits and confirm before continuing.
  A commit names an issue before it fixes one, so this is a prompt to look, not proof.
```

---

### Phase 5: Deep Read

```bash
# gh issue view may fail in this repo — use the API directly (CLAUDE.md).
gh api repos/smeltworks/cnx/issues/<ISSUE> \
  --jq '{title, body, labels: [.labels[].name], milestone: .milestone.title, created_at, state}'

# --paginate is REQUIRED. This endpoint pages at 30 and returns comments
# ASCENDING by creation, so the tail that drops is the NEWEST — the half of the
# history that says what the card looks like today (#1416).
gh api --paginate 'repos/smeltworks/cnx/issues/<ISSUE>/comments?per_page=100' \
  --jq '.[] | {author: .user.login, created: .created_at, body}'
```

---

### Phase 6: Create the Branch

```
NEVER work on main. Create a feature branch first:
  bug / validation-bug         → fix/<ISSUE>-short-description
  enhancement / feature        → feature/<ISSUE>-short-description
  documentation / ADR          → docs/<ISSUE>-short-description
  test-coverage                → test/<ISSUE>-short-description
```

---

### Phase 7: Route by Issue Type

```
CLASSIFY the issue:
  BUG → Phase 7a (TDD workflow)
  ENHANCEMENT/FEATURE/OTHER → Phase 7b (ADR-first planning workflow)

Classification rules:
  - Has "bug", "validation-bug", or "MISRA Violations" label → BUG
  - Title starts with "Fix", "Bug:", "Broken" → BUG
  - Body contains "expected behavior" / "actual behavior" / "steps to reproduce" → BUG
  - Otherwise → ENHANCEMENT/FEATURE/OTHER
```

#### 7a: Bug → cnx TDD Workflow

```
FOR bugs, follow Test-Driven Development with cnx test conventions:

  1. ANALYZE the bug:
     - What is the expected behavior? What is the actual behavior?
     - What layer is affected? (data / logic / output / state — see CLAUDE.md architecture)

  2. WRITE A FAILING TEST FIRST as a .test.cnx with the correct marker:
     - Compile-error bug      → // test-error  + a .expected.error file
     - Wrong runtime behavior → // test-execution (validate every result, unique return codes)
     - Wrong generated code   → .expected.c / .expected.cpp / .expected.h snapshot
     - Place reproduction under tests/ (or tests/bugs/issue-<name>/ for regression cases)
     - Run it (npm test -- <path>) and confirm it FAILS with a useful message

  3. MUTATION-CHECK the test: presence is not proof. A fixture that cannot fail when
     the fix is reverted is not a regression test (#1222).

  4. PRESENT THE PLAN:
     "Here's the failing test that proves the bug. Here's my plan to fix it: ..."

  5. WAIT for user approval before implementing the fix.

  6. After approval, implement the fix UPSTREAM (never work around cnx bugs) and verify:
     - The previously failing test now passes
     - npm run test:gate is green — test:all is four checks of twenty-four
     - Commit generated .test.c / .test.h files — they are part of the suite
```

#### 7b: Enhancement/Feature → ADR-First Planning Workflow

```
FOR non-bug issues, research first (CLAUDE.md "Workflow: Research First"):

  1. ANALYZE the requirement and find the relevant ADR(s) in docs/decisions/.
     Only reference Accepted/Implemented ADRs as working syntax.

  2. EXPLORE the codebase for relevant files, patterns, and integration points.
     Respect layer constraints (logic/ cannot import from output/, transitively).

  3. UPDATE the ADR with research findings, links, and context as you go.
     NEVER change an ADR's Status or Decision without explicit user approval.
     An ADR must still pass the rewrite test — no src/** paths, no module lists.

  4. PRESENT THE PLAN:
     "Scope / files to modify / approach / testing strategy / ADR impact"

  5. WAIT for user approval before implementing.
```

---

#### 7c: If Analysis Reveals a Blocker — Pause, Do Not Work Around

Phase 3 reads the built-in "Blocked by" relationship. Phases 5 and 7 read the card itself,
and that is where the blockers no link carries turn up — most often a definition-of-done box that
cannot be satisfied as written.

```
IF analysis shows a definition-of-done box cannot be satisfied as written, AND nothing
has been committed yet:

  STOP. Do not implement the achievable subset, do not reword the box, do not narrow
  the card. CLAUDE.md: "never reword a box to match what you did, which is moving the
  goalposts rather than meeting them."

  1. LINK the derived blocker as a built-in "Blocked by" relationship, beside whatever
     the issue already lists — never remove or replace an existing link. The endpoint
     takes the blocker's numeric id, not its number. A blocker that is not an issue yet
     (a pending decision) is filed as one first, so there is something to link.

       gh api -X POST repos/smeltworks/cnx/issues/<ISSUE>/dependencies/blocked_by \
         -F issue_id="$(gh api repos/smeltworks/cnx/issues/<BLOCKER> --jq .id)"

     THEN re-read Phase 3's query and report the list it returned — not the POST's success.

  2. COMMENT the measurements that establish the blocker, and what would unblock it.
     Record boxes that are already true but unchecked; do NOT tick them if another card
     made them true — "this is not my commit-and-push cycle" is the established form.

  3. DELETE the unused branch. A branch created and deleted unused is a recognized
     not-startable signal in this repo, which is why recording it is worth the line.

  4. UNASSIGN YOURSELF. That IS the pause: `project-sync.yml` moves the card
     `WIP` -> `Backlog` when the last assignee leaves (#1572), so the column stops
     claiming active work. An open pull request that closes the issue keeps it in
     `WIP` (#1578); a paused card has none, because nothing was committed. Do not write `Status` by hand -- `docs/WORKFLOW.md` gives
     project-sync.yml sole ownership of that field. RE-QUERY the board and report the
     status you read, exactly as Phase 2 does for the assign.

     THIS STEP DEPENDS ON STEP 1, and nothing enforces the order. Unassigning drops the
     card back into the recommendable pool; what keeps a blocked one from being picked
     straight back up is `/issue-check` Phase 1d reading the link that step 1
     added. Unassign without it and the card can be recommended again with no record of
     why it was set down. If step 1 did not happen, do it before this one.

  5. FIND OTHER WORK — re-run `/issue-check`, or take the next unblocked runner-up it
     already ranked, and re-run its startability gate before starting.
```

---


### Phase 8: Announce on the Issue

```bash
gh issue comment <ISSUE> --body "Starting work. Approach: <brief plan>"
```

```
THROUGHOUT the work:
  ON progress:      gh issue comment <ISSUE> --body "Progress: <done / next>"
  WHEN opening PR:  reference the issue ("Fixes #<ISSUE>" / "Closes #<ISSUE>")
                    All changes go through a PR. Merge with a merge commit — NEVER squash.
```

---

## Anti-Patterns

- **DO NOT** read code, create a branch, or start work before Phase 2 confirms the
  board. The assignment is the point of this skill; doing the work first and assigning
  afterwards is how `WIP` stayed empty for the life of the board
- **DO NOT** report the card as moved because you assigned it. `project-sync.yml` is an
  async workflow run — re-query and report the status you read
- **DO NOT** write the board's Status field by hand. `project-sync.yml` owns that
  transition; a second writer is a duplicate code path and hides a broken automation
- **DO NOT** treat "left at Changes Needed" as a failure — the guard declining to drag a
  card backwards is correct behavior. Tell the two cases apart before reporting either
- **DO NOT** remove a "Blocked by" link, replace one, or propose either — it is a
  permanent record, and a blocker that has closed is history, not a stale value
- **DO NOT** read or write the board's retired free-text `Blocked by` field. Blockers
  are the built-in relationship (#1893)
- **DO NOT** start on an issue whose "Blocked by" links something still open without
  saying so and getting an explicit override
- **DO NOT** start on a closed issue, or reopen one. A defect found after the fix
  shipped is a new issue with its own reproduction
- **DO NOT** skip the dedup gate — issues are sometimes already resolved
- **DO NOT** skip the failing-test step for bugs, or accept a fixture you have not
  mutation-checked
- **DO NOT** implement the achievable subset of a card whose definition of done cannot be
  satisfied as written, and **DO NOT** reword the box. Pause per Phase 7c: append the
  blocker, record the measurements, delete the branch, unassign yourself, take other work
- **DO NOT** leave a paused card assigned. `WIP` means someone is on it or its closing
  pull request is open, and unassigning a card with no open closing pull request is what
  returns it to `Backlog` for whoever picks it up next (#1572, #1578)
- **DO NOT** work around a cnx bug downstream — fix it upstream in the transpiler
- **DO NOT** change cnx syntax/behavior or an ADR's Status without explicit approval
- **DO NOT** copy these phases back into `issue-check`. It delegates here on purpose
- **DO NOT** squash-merge — always use a merge commit
