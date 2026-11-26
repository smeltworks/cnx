/**
 * Issue #1578: unassigning yourself from an issue whose pull request is in
 * review must leave the card in `WIP`, and a card kept there must not stay
 * there with nobody on it once that pull request closes unmerged. The card's
 * status cannot tell review from paused work -- it is `WIP` either way -- so
 * `project-sync.yml` asks GitHub for the open pull requests that close it.
 *
 * These run the workflow's own "Sync item status" script against a stub `gh`
 * that answers each read from a fixture and holds a fake board, so what is
 * tested is the shipped bash.
 */

import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface IStep {
  name?: string;
  run?: string;
}

interface IWorkflow {
  on: { pull_request: { types: string[] } };
  jobs: { sync: { steps: IStep[] } };
}

const workflow = YAML.parse(
  readFileSync(
    join(repoRoot, ".github", "workflows", "project-sync.yml"),
    "utf-8",
  ),
) as IWorkflow;

const syncScript =
  workflow.jobs.sync.steps.find((step) => step.name === "Sync item status")
    ?.run ?? "";

/** The script with its expressions resolved; any unknown one throws. */
function substituted(event: string, action: string): string {
  const expressions: Record<string, string> = {
    "github.event_name": event,
    "github.event.action": action,
    "github.event.issue.node_id": "I_issue",
    "github.event.issue.node_id || github.event.pull_request.node_id":
      event === "issues" ? "I_issue" : "PR_node",
  };
  return syncScript.replaceAll(
    /\$\{\{\s*(.+?)\s*\}\}/g,
    (_match, expr: string) => {
      const value = expressions[expr];
      if (value === undefined) {
        throw new Error(`unhandled expression: ${expr}`);
      }
      return value;
    },
  );
}

type TPrState = "OPEN" | "MERGED" | "CLOSED";

/** A `closedByPullRequestsReferences` answer naming these pull requests. */
function closing(...prs: [number, TPrState][]): string {
  return JSON.stringify({
    data: {
      repository: {
        issue: {
          closedByPullRequestsReferences: {
            nodes: prs.map(([number, state]) => ({ number, state })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  });
}

/** A `closingIssuesReferences` answer: [number, state, assignees, repo?]. */
function closes(
  ...issues: [number, "OPEN" | "CLOSED", string[], string?][]
): string {
  return JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          closingIssuesReferences: {
            nodes: issues.map(([number, state, logins, repo]) => ({
              number,
              id: `I_${number}`,
              state,
              repository: { nameWithOwner: repo ?? "smeltworks/cnx" },
              assignees: { nodes: logins.map((login) => ({ login })) },
            })),
            pageInfo: { hasNextPage: false, endCursor: null },
          },
        },
      },
    },
  });
}

const BOARD = JSON.stringify({
  data: {
    organization: {
      projectV2: {
        id: "P_board",
        fields: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: "F_status",
              name: "Status",
              options: ["Grooming", "Backlog", "WIP", "PR Review"].map(
                (name) => ({ id: `O_${name}`, name }),
              ),
            },
          ],
        },
      },
    },
  },
});

/**
 * The stub. A board read answers from GH_STUB_BOARD, or fails when it is
 * unset; a card's status is GH_STUB_STATUS; an issue's closing pull requests
 * are GH_STUB_PRS_<number>, else GH_STUB_PRS. Every call is logged.
 */
const GH_STUB = [
  "#!/usr/bin/env bash",
  'printf "%s\\n" "$*" >> "$GH_STUB_LOG"',
  'arg() { for a in "${@:2}"; do case "$a" in "$1="*) printf "%s" "${a#*=}" ;; esac; done; }',
  'case "$*" in',
  '  *closingIssuesReferences*) printf "%s" "$GH_STUB_ISSUES" ;;',
  '  *closedByPullRequestsReferences*) v="GH_STUB_PRS_$(arg number "$@")"; printf "%s" "${!v:-$GH_STUB_PRS}" ;;',
  '  *"projectV2(number"*) [ -n "${GH_STUB_BOARD:-}" ] || { echo "board read refused" >&2; exit 1; }; printf "%s" "$GH_STUB_BOARD" ;;',
  '  *addProjectV2ItemById*) printf "item-%s\\n" "$(arg contentId "$@")" ;;',
  '  *fieldValueByName*) printf "%s\\n" "${GH_STUB_STATUS:-WIP}" ;;',
  "  *updateProjectV2ItemFieldValue*) ;;",
  '  *) echo "unexpected gh call" >&2; exit 1 ;;',
  "esac",
  "",
].join("\n");

interface IRun {
  status: number | null;
  stdout: string;
  calls: string;
}

function sync(
  event: string,
  action: string,
  env: Record<string, string>,
): IRun {
  const dir = mkdtempSync(join(tmpdir(), "project-sync-"));
  try {
    const log = join(dir, "calls.log");
    const gh = join(dir, "gh");
    writeFileSync(gh, GH_STUB);
    chmodSync(gh, 0o755);
    writeFileSync(log, "");
    const result = spawnSync("bash", ["-c", substituted(event, action)], {
      encoding: "utf-8",
      env: {
        PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
        GH_STUB_LOG: log,
        GH_STUB_BOARD: BOARD,
        REPO: "smeltworks/cnx",
        PROJECT_OWNER: "smeltworks",
        PROJECT_NUMBER: "1",
        ...env,
      },
    });
    return {
      status: result.status,
      stdout: result.stdout,
      calls: readFileSync(log, "utf-8"),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function unassign(
  allAssignees: string,
  removed: string,
  prs: string,
  extra: Record<string, string> = {},
): IRun {
  return sync("issues", "unassigned", {
    ALL_ASSIGNEES: allAssignees,
    REMOVED_ASSIGNEE: removed,
    ISSUE_NUMBER: "1578",
    GH_STUB_PRS: prs,
    ...extra,
  });
}

function closePr(merged: boolean, extra: Record<string, string>): IRun {
  return sync("pull_request", "closed", {
    PR_NUMBER: "2505",
    PR_MERGED: String(merged),
    ...extra,
  });
}

describe("project-sync.yml — unassigning the last assignee", () => {
  it("finds the step it runs", () => {
    expect(syncScript).toContain("issues.unassigned)");
  });

  it("leaves the card in WIP while an open pull request closes the issue", () => {
    const run = unassign("jlaustill", "jlaustill", closing([2500, "OPEN"]));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      "Open pull request #2500 closes #1578; leaving it in WIP.",
    );
    expect(run.calls).not.toContain("projectV2");
  });

  it("names every open pull request that closes the issue", () => {
    const run = unassign(
      "jlaustill",
      "jlaustill",
      closing([2500, "OPEN"], [2501, "OPEN"]),
    );
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Open pull request #2500, #2501 closes");
  });

  it("asks about the issue that fired, in the repository that fired it", () => {
    const run = unassign("jlaustill", "jlaustill", closing([2500, "OPEN"]));
    expect(run.calls).toContain("owner=smeltworks");
    expect(run.calls).toContain("name=cnx");
    expect(run.calls).toContain("number=1578");
  });

  it("moves the card to Backlog when no open pull request closes the issue", () => {
    const run = unassign("jlaustill", "jlaustill", closing());
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Set I_issue: 'WIP' -> 'Backlog'.");
    expect(run.calls).toContain("optionId=O_Backlog");
  });

  it("does not count a merged pull request as open", () => {
    const run = unassign("jlaustill", "jlaustill", closing([1573, "MERGED"]));
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain("Open pull request");
    expect(run.stdout).toContain("Set I_issue: 'WIP' -> 'Backlog'.");
  });

  it("leaves a card that is not in WIP where it is", () => {
    const run = unassign("jlaustill", "jlaustill", closing(), {
      GH_STUB_STATUS: "Done",
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      "Leaving I_issue at 'Done' (would have set 'Backlog').",
    );
    expect(run.calls).not.toContain("updateProjectV2ItemFieldValue");
  });

  it("fails rather than move the card when the pull-request read fails", () => {
    const run = unassign("jlaustill", "jlaustill", "not json");
    expect(run.status).not.toBe(0);
    expect(run.calls).not.toContain("projectV2");
  });

  it("asks nothing while someone else is still assigned", () => {
    const run = unassign("jlaustill,other", "jlaustill", closing());
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("#1578 is still assigned to other");
    expect(run.calls).toBe("");
  });
});

describe("project-sync.yml — a pull request closed without a merge", () => {
  it("is subscribed to", () => {
    expect(workflow.on.pull_request.types).toContain("closed");
  });

  it("leaves a merged pull request's issues to Item closed", () => {
    const run = closePr(true, {});
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Merged; the issues it closes move");
    expect(run.calls).toBe("");
  });

  it("asks each open issue it names the unassign question", () => {
    const run = closePr(false, {
      GH_STUB_ISSUES: closes(
        [10, "OPEN", ["other"]],
        [11, "OPEN", []],
        [12, "OPEN", []],
        [15, "OPEN", []],
        [13, "CLOSED", []],
      ),
      GH_STUB_PRS_11: closing([20, "OPEN"]),
      GH_STUB_PRS: closing(),
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("#10 is still assigned to other");
    expect(run.stdout).toContain(
      "Open pull request #20 closes #11; leaving it in WIP.",
    );
    expect(run.stdout).toContain("Set I_12: 'WIP' -> 'Backlog'.");
    expect(run.stdout).toContain("Set I_15: 'WIP' -> 'Backlog'.");
    expect(run.stdout).not.toContain("I_13");
    expect(run.calls).toContain("number=2505");
    expect(run.calls.match(/projectV2\(number/g)).toHaveLength(1);
  });

  it("asks about an issue in another repository in that repository", () => {
    const run = closePr(false, {
      GH_STUB_ISSUES: closes([14, "OPEN", [], "smeltworks/vscode-cnx"]),
      GH_STUB_PRS: closing(),
    });
    expect(run.status).toBe(0);
    expect(run.calls).toMatch(/name=vscode-cnx -F number=14/);
    expect(run.stdout).toContain("Set I_14: 'WIP' -> 'Backlog'.");
  });

  it("does nothing when it closes no open issue", () => {
    const run = closePr(false, { GH_STUB_ISSUES: closes() });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Closes no open issue");
    expect(run.calls).not.toContain("projectV2");
  });

  it("fails rather than move a card when the issue read fails", () => {
    const run = closePr(false, { GH_STUB_ISSUES: "not json" });
    expect(run.status).not.toBe(0);
    expect(run.calls).not.toContain("projectV2");
  });
});

describe("project-sync.yml — the advancing transitions still write", () => {
  it("sends an opened issue to Grooming", () => {
    const run = sync("issues", "opened", { GH_STUB_STATUS: "unset" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Set I_issue: 'unset' -> 'Grooming'.");
  });

  it("sends an opened pull request to PR Review", () => {
    const run = sync("pull_request", "opened", { GH_STUB_STATUS: "unset" });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Set PR_node: 'unset' -> 'PR Review'.");
  });
});
