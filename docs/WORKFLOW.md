# Development Workflow

**A release is work, so it gets managed as work.** There is no separate release
process — a release is an ordinary issue whose purpose happens to be producing
a release, and it rides the same board as everything else. That is why
"Release" is not a board status: the milestone says _which_ release, the status
says where the work is.

This document is the single source of truth for how work moves. `CONTRIBUTING.md`
covers _how to write the change_; this covers _how the change travels_.

The board: **[cnx](https://github.com/orgs/smeltworks/projects/1)**, owned by the
`smeltworks` organization — it spans [`cnx`](https://github.com/smeltworks/cnx) and
[`vscode-cnx`](https://github.com/smeltworks/vscode-cnx), because a release
that touches the grammar touches the extension too. Until #2189 it lived on the
`jlaustill` account; [Board setup](#board-setup) says why it moved.

---

## The board

Issues and pull requests are **separate cards**. An issue is a unit of work; a
PR is a unit of review. They have a different lifecycle and they finish at
different moments, so conflating them into one card loses information.

| Status             | Applies to | Means                                                                                                                   |
| ------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Grooming**       | Issues     | Just filed. Not triaged — scope, priority and whether it is even right are still open. **Every new issue starts here.** |
| **Backlog**        | Issues     | Groomed and agreed. Ready for someone to pick up.                                                                       |
| **WIP**            | Issues     | Picked up — someone is on it.                                                                                           |
| **PR Review**      | PRs        | A pull request is open and waiting to be looked at.                                                                     |
| **Changes Needed** | PRs        | Review found something. The PR needs work before it merges.                                                             |
| **Ready to Merge** | PRs        | Review is satisfied and CI is green.                                                                                    |
| **Done**           | Both       | Closed, or merged.                                                                                                      |

An issue travels `Grooming → Backlog → WIP → Done`. A pull request travels
`PR Review → Changes Needed → Ready to Merge → Done`.

An issue never travels backwards, and it never comes back from `Done`. **Reopening
a closed issue is not a supported transition.** If a defect turns up after the fix
shipped, that is a new issue with its own reproduction — not a resurrected one. See
[Closed is closed](#closed-is-closed).

### `Blocked by`

GitHub's built-in issue relationship — the "Blocked by" list in an issue's
sidebar — naming the issues the work is waiting on. **It is a record, not a
state, and nothing is ever removed from it.** An issue is blocked while any issue
it lists is still open; once they have all closed it is no longer blocked, and
the links _stay_ — permanently — as the record of what the work waited on.

A new blocker is **added** as a new link, never substituted for an old one. #1318
waited on #1285, and then on #1357; the record is both, not whichever arrived
last. The relationship keeps its own history in the issue timeline, so a removed
link is still visible there — but removing one is not a write this record takes.

Every entry is an issue. A blocker that is not one yet — a pending decision, one
slice of a larger card — is filed as an issue first, so there is something to
link; the qualifier ("only PR5") goes in the comment that records the link.

Blocked-ness is therefore **derived** ("are the linked issues still open?"), and
is never read off whether the list is empty. Empty means no card was ever named,
not that a blocker was resolved.

Until #1893 this was a free-text field on the board. It was prose that every
reader had to parse, it was capped near 1 KB (#1665), and an overwrite destroyed
it with no history (#1419). Its blockers were migrated to built-in links, and
each card's text is preserved verbatim in a comment marked
`<!-- blocked-by-migration #1893 -->`; the field itself is retired.

Blocked-ness is also _orthogonal_ to position: a blocked issue stays in whatever
column it is already in — Grooming or Backlog — it just says why it cannot leave.
This replaced the old `status: blocked` label.

---

## What moves a card

| Transition                            | Trigger                        | Mechanism                      |
| ------------------------------------- | ------------------------------ | ------------------------------ |
| _(nothing)_ → **Grooming**            | Issue opened                   | `project-sync.yml`             |
| **Grooming** → **Backlog**            | Triaged and agreed             | **Manual**                     |
| **Grooming** or **Backlog** → **WIP** | You assign yourself the issue  | `project-sync.yml`             |
| **WIP** → **Backlog**                 | You unassign yourself          | `project-sync.yml`             |
| _(nothing)_ → **PR Review**           | PR opened, reopened, or ready  | `project-sync.yml`             |
| **PR Review** → **Changes Needed**    | Review found something         | **Manual**                     |
| **Changes Needed** → **PR Review**    | You pushed the fix             | **Manual**                     |
| _any PR status_ → **Ready to Merge**  | Review satisfied, checks green | **Manual**                     |
| _any_ → **Done**                      | Issue or PR closed             | Built-in `Item closed`         |
| _any_ → **Done**                      | PR merged                      | Built-in `Pull request merged` |

There is deliberately no row for a reopened issue. See
[Closed is closed](#closed-is-closed).

**Unassigning yourself is how you pause a card.** `WIP`'s option description is
_"This is actively being worked on"_, so a card picked up and then set down — found
blocked, nothing committed — cannot stay there. Unassign, and the board follows; the
added "Blocked by" link and your comment say _why_, the column says _that_. The transition
fires only when the **last** assignee leaves, so stepping off a card someone else is also
on changes nothing, and only from `WIP`, so unassigning a card already in `Grooming`,
`Backlog` or `Done` changes nothing either. Until #1572 there was no such transition and
#1448 read as active work for 9h52m after its work stopped.

**Unassigning while your pull request is open leaves the card in `WIP` (#1578).** An issue
whose pull request is in review is sitting in `WIP` — the pull request gets its own card, and
the built-in that would move the issue is deliberately disabled — so its status cannot say
whether the work is paused or in review. `project-sync.yml` therefore asks GitHub for the
open pull requests that close the issue, and moves the card only when there are none. That is
why the [closing keyword](#closing-keywords-are-load-bearing) matters here too: a pull request that does not
name the issue with one is not linked, and unassigning returns the issue to `Backlog`.

**Assigning yourself is the only thing that fills `WIP`,** and for the life of the board
nothing did it: until #1423 there were zero assigned open issues and zero cards in that
column — work ran `Grooming`/`Backlog` → `Done` while the automation above sat correct
and unfired. Starting work therefore goes through the `start-issue` skill, which assigns
the issue and then blocks until it has re-read the board and seen `WIP`. A
`UserPromptSubmit` hook reminds anyone who types "start on #1234" without it.

Nothing else may write the `Status` field. `project-sync.yml` owns that transition, and
a second writer would both duplicate it and hide it failing.

Automation writes a status only when the current one is unset, or is one the
transition names as safe to overwrite — so a card you have moved by hand survives a
ready-for-review. That is usually the status it advances _from_. `WIP` → `Backlog`
(#1572) is the one transition that moves a card back, and it overwrites `WIP` and
nothing else, and only when no open pull request closes the issue (#1578).

## Closed is closed

**Do not reopen a closed issue.** A defect found after the fix shipped is a new
issue, filed with its own reproduction, linking back to the original.

The reason is that an issue is a unit of evidence, not a container. Its title,
reproduction and acceptance criteria describe one defect that was demonstrated and
then fixed. Reopening overwrites that record with a second, different defect that
merely resembles it — and the closed issue's reproduction, which is the part worth
keeping, stops matching what the issue is now about.

`project-sync.yml` does not subscribe to `issues.reopened` and the built-in
`Item reopened` workflow is off, so **nothing moves the card**. A reopened issue is
left visibly stranded in `Done` while being open. That inconsistency is deliberate:
it is how the policy violation surfaces on the board instead of quietly re-entering
the pipeline.

Pull requests are different — a reopened PR does return to `PR Review`, because a
PR is a unit of review and reviewing it twice is ordinary.

### Why two transitions are manual

`Changes Needed` and `Ready to Merge` look like they should be automatic —
GitHub even ships `Code changes requested` and `Code review approved` built-in
workflows for exactly this. **Neither can ever fire here.** GitHub does not let
you approve or request changes on your own pull request, and this repository has
one maintainer, so every review is a `COMMENTED` review. The built-ins would sit
enabled and silent, which is worse than an honest manual move.

They are left **off** on purpose. If this repository ever gains a second
reviewer, turn them on and delete these two rows.

### Closing keywords are load-bearing

`Pull request merged → Done` moves **the PR's own card**. The linked issue moves
because merging closed it, which fires `Item closed`. That chain only exists if
the PR body says `Closes #NNN`. A PR that merges without a closing keyword
leaves its issue sitting in WIP. The pull request template has a **Related
Issues** section for exactly this.

---

## Releases are issues

Open one from the **Release** issue template. Set its milestone to the version
being released. Work it like any other issue: Grooming → Backlog → WIP → Done.

Milestones name releases (`v0.4.0`), and nothing else. That keeps "which
release" and "where is the work" as two separate questions with two separate
answers.

The checklist inside the template is the operational one; the reasoning behind
each step lives in [`releasing.md`](../releasing.md).

### Which release something shipped in is derived, not recorded

**Do not set a milestone to say what has already shipped.** The only milestone
anyone sets by hand is the one on the release issue, which names the version
being prepared. Everything else is written by `npm run release:milestones`,
from a fact about the repository: the first tag containing the merge commit
that closed the item.

It runs at the end of `publish.yml`, so a release attributes itself. The same
command run at any time is also the backfill and the drift check -- one
derivation, no second answer to disagree with the first.

Recorded by hand it drifted, twice over. Every pull request merged from #1327
onward carried no milestone and nothing noticed for four days. And #1157
carried `v0.3.1` while its fix was already an ancestor of the `v0.3.0` tag: it
closed one second after the tag commit, which is not a race a person can be
expected to win.

Two things it will not do, both by design:

- An item closed by hand with no linked commit or pull request is **reported,
  never guessed at**. Two heuristics were measured and both are unsafe -- an
  issue can close months after its fix shipped (#916 closed 2026-06-20; its fix
  shipped in v0.2.7 on 2026-02-23), and a commit can name an issue before
  fixing it.
- A pull request merged into a stack that never landed is `not-shipped`, not
  attributed. GitHub reports #1276 and #1284 as `MERGED`; their code is not on
  `main`. `state: MERGED` conflates merged with shipped, and
  `git merge-base --is-ancestor` does not.

### Who runs the check

`npm run release:milestones:check` reports drift and writes nothing. It is
**not** a CI gate, deliberately: a pull request becomes a merged pull request
with no milestone the instant it lands, so gating on it would redden every
other open pull request until someone ran `apply`.

So it is run by hand, at two moments:

| When                      | Why                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Preparing a release       | The release issue's own checklist -- confirms the previous release is fully attributed before another one is cut                        |
| After `publish.yml` warns | The attribution step is `continue-on-error`, and emits a `::warning::` when it fails. That warning is the signal to run `apply` locally |

Nothing else is watching, which is the honest position: the derivation is
idempotent and self-healing, so the cost of a missed run is a delay, not a
wrong answer.

Run `git fetch` first when running it locally. The derivation reads this clone,
so a merge commit that has not arrived yet is indistinguishable from one that
never landed, and reports as `not-shipped`. It costs a false referral, never a
wrong milestone -- the run writes only answers it owns -- and `publish.yml`
checks out fresh with `fetch-depth: 0`, so CI cannot hit it.

---

## Board setup

Two halves of a GitHub Project can be provisioned from code, and two cannot.
**Views and built-in workflows have no API at all** — not GraphQL, not REST, not
`gh project`. They are UI-only, so they are documented here rather than
scripted.

### 1. Status options (UI, do this first)

New projects ship a `Status` field with `Todo` / `In Progress` / `Done`.

1. **Rename in place** — `Todo` → **Backlog**, `In Progress` → **WIP**. Renaming
   preserves the option's ID, and the built-in workflows are bound to IDs, not
   names. Deleting and recreating silently breaks them.
2. Add **Grooming**, **PR Review**, **Changes Needed**, **Ready to Merge**.
3. Drag into board order: `Grooming | Backlog | WIP | PR Review | Changes Needed | Ready to Merge | Done`.

> Never rewrite the option list through `updateProjectV2Field`. That mutation
> replaces the whole list and regenerates every option ID, which orphans each
> item's stored value and every workflow bound to an option.

### 2. Provision the rest (scripted)

```bash
gh auth refresh -s project   # one-time; the default token cannot read Projects
npm run project:setup
```

This creates the project if absent, makes it public with its title and
description, links both repositories, and seeds every open issue into Grooming
and every open PR into PR Review. It is idempotent — re-running reports zero
changes and never moves a card that has advanced.

`npm run project:check` reports drift without writing anything.

The board is named by owner and **number** — `ProjectBoard.OWNER` /
`ProjectBoard.NUMBER` in `scripts/utils/ProjectBoard.ts` — not by title, which
anyone can rename in the UI. GitHub numbers a new board itself, so if setup ever
creates one under a different number it stops and names the constant to change.
`project-sync.yml` and the `start-issue` / `issue-check` skills cannot import that
file; `scripts/__tests__/board-identity.test.ts` holds their copies to it.

#### Moving to a new board

```bash
npm run project:migrate -- user jlaustill 1        # copy, then verify
npm run project:migrate:check -- user jlaustill 1  # verify only; exit 1 while anything differs
```

This copies every card from another board (here the pre-#2189 one) onto this one:
in the source's order, with each card's Status unchanged. Order is data —
`BacklogOrder` is a stable sort that keeps whatever order a human set — so a
migration that scrambled it would discard that ordering for good. It is
idempotent and resumes where an interrupted run stopped. Run it before
`project:setup` seeds anything, so seeded cards do not sit between copied ones, and
turn the built-in workflows below off first: `Item added to project` would
overwrite every copied Status, and `Auto-close issue` would close any open issue
whose copied card sits in Done. The #2189 migration copied four, and none of them
had ever been closed.

### 3. Board view (UI)

Create a board view grouped by `Status`.

### 4. Built-in workflows (UI)

Turn **on**:

- `Item closed` → Done
- `Pull request merged` → Done

Leave **off**, and here is why each one. A new project ships with **all** of
`Item added to project`, `Item closed`, `Pull request merged`, `Pull request linked
to issue`, `Auto-close issue` and `Auto-add sub-issues to project` turned on
(measured 2026-10-18, #2189), so turning these off is a step, not a default.

| Workflow                         | Why off                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Item reopened`                  | Fires on issues _and_ pull requests. Reopening an issue is not a supported transition (see [Closed is closed](#closed-is-closed)), and for PRs it would race `project-sync.yml`, which already sends a reopened PR to PR Review.                                                                                            |
| `Pull request linked to issue`   | Forces a linked issue to WIP. WIP here means _you picked it up_, which is self-assignment, not "a PR exists". It would also drag a paused card back into WIP.                                                                                                                                                               |
| `Item added to project`          | Writes a Status on every card added. `project-sync.yml` owns the first Status, and during a [migration](#moving-to-a-new-board) it would overwrite every copied one.                                                                                                                                                        |
| `Auto-close issue`               | Closes an issue when its card reaches Done — the opposite direction from `Item closed`. The board mirrors issues and never drives them: a card dragged to Done by mistake would close real work, and a reopened issue, which is left in Done on purpose (see [Closed is closed](#closed-is-closed)), would be closed again. |
| `Auto-add sub-issues to project` | `project-sync.yml` owns adding.                                                                                                                                                                                                                                                                                             |
| `Code changes requested`         | Cannot fire — see "Why two transitions are manual".                                                                                                                                                                                                                                                                         |
| `Code review approved`           | Cannot fire — same reason.                                                                                                                                                                                                                                                                                                  |
| `Auto-add to project`            | `project-sync.yml` owns adding, so both repositories behave identically regardless of GitHub plan (Free allows only one auto-add workflow, watching one repository).                                                                                                                                                        |

### 5. The board's GitHub App

`GITHUB_TOKEN` is scoped to the repository and **cannot write Projects v2**. The
board is owned by the `smeltworks` organization, so a GitHub App holding the
organization's Projects permission can write it, and the workflows mint a
short-lived token from it on every run (`actions/create-github-app-token`).
Nothing expires, and nothing belongs to one person.

The app is owned by `smeltworks`, installed on `smeltworks` (all repositories),
with no webhook and these permissions:

| Permission                         | Access         | Why                                                   |
| ---------------------------------- | -------------- | ----------------------------------------------------- |
| Organization → Projects            | Read and write | Add cards, write Status, reposition the Backlog       |
| Repository → Issues, Pull requests | Read-only      | Read what a card holds, and each issue's "Blocked by" |
| Repository → Metadata              | Read-only      | Required by GitHub for every app                      |

Its ID is the organization variable `BOARD_APP_ID`, and a private key generated in
the app's settings is the organization secret `BOARD_APP_PRIVATE_KEY`, both visible
to all repositories:

```bash
gh auth refresh -s admin:org   # one-time; organization variables and secrets need it
gh variable set BOARD_APP_ID --org smeltworks --visibility all --body <app id>
gh secret set BOARD_APP_PRIVATE_KEY --org smeltworks --visibility all < key.pem
```

Two things to know:

- **Fork pull requests get no secrets.** Both workflows skip cleanly rather than
  failing; add a fork PR to the board by hand.
- **Rotating the key** is generating a new one in the app's settings, re-setting
  the secret, then deleting the old key there.

Until #2189 the board lived on the `jlaustill` account, where no app can write a
project, so this was `PROJECT_TOKEN`: a classic PAT stored separately in each
repository. The copies drifted apart, and smeltworks/vscode-cnx's had failed every
run since 2026-09-13 before anyone noticed (smeltworks/vscode-cnx#14).

### 6. `vscode-cnx`

`project-sync.yml` is a reusable workflow. The extension repository calls it
rather than copying it:

```yaml
name: Project sync
on:
  issues:
    types: [opened, assigned, unassigned]
  pull_request:
    types: [opened, reopened, ready_for_review]
jobs:
  sync:
    uses: smeltworks/cnx/.github/workflows/project-sync.yml@main
    secrets:
      BOARD_APP_PRIVATE_KEY: ${{ secrets.BOARD_APP_PRIVATE_KEY }}
```

A called workflow reads the **caller's** variables, so `BOARD_APP_ID` resolves from
the organization either way; the private key is a secret and is passed by name.

**A reusable workflow does not inherit the caller's `on:`** — the caller's own `types:`
decides which events ever reach it, so this list is a second copy and it rots. Measured
2026-09-12, the live caller carried `[opened, assigned, reopened]` while this block said
`[opened, assigned]`: already disagreeing, with `reopened` subscribed there and refused
here, and neither carrying `unassigned`. Tracked as smeltworks/vscode-cnx#11.

Subscribe the caller to the **union** of what the shared file handles and let its `case`
statement be the only thing that decides — otherwise a new transition is three edits across
two repositories rather than one.

---

## Picking what to work on

Run `/issue-check` in Claude Code. It triages open issues, detects in-flight
work, and recommends the highest-value one. Assign yourself the issue you pick —
that is what moves it to WIP.
