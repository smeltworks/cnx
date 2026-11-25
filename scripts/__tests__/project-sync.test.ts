/**
 * Issue #1578: unassigning yourself from an issue whose pull request is in
 * review must leave the card in `WIP`. The card's status cannot tell review
 * from paused work -- it is `WIP` either way -- so `project-sync.yml` asks
 * GitHub for the open pull requests that close the issue.
 *
 * These run the workflow's own "Sync item status" script, with a stub `gh`
 * answering each read from a fixture, so what is tested is the shipped bash.
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

/** The only expressions the script reads; any other fails the substitution. */
const EXPRESSIONS: Record<string, string> = {
  "github.event_name": "issues",
  "github.event.action": "unassigned",
  "github.event.issue.node_id || github.event.pull_request.node_id": "I_node",
};

function substituted(script: string): string {
  return script.replaceAll(/\$\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
    const value = EXPRESSIONS[expr];
    if (value === undefined) {
      throw new Error(`unhandled expression: ${expr}`);
    }
    return value;
  });
}

/** A `closedByPullRequestsReferences` answer naming these pull requests. */
function closing(...numbers: number[]): string {
  return JSON.stringify({
    data: {
      repository: {
        issue: {
          closedByPullRequestsReferences: {
            nodes: numbers.map((number) => ({ number })),
          },
        },
      },
    },
  });
}

interface IRun {
  status: number | null;
  stdout: string;
  calls: string;
}

/**
 * Runs the unassign arm. The stub answers the open-pull-request read from
 * `prs` and fails every board read, so a run that gets past the guard stops
 * at "Could not read board" -- which is how these tell "moved on to write the
 * board" from "left the card alone" without a board.
 */
function unassign(allAssignees: string, removed: string, prs: string): IRun {
  const dir = mkdtempSync(join(tmpdir(), "project-sync-"));
  try {
    const log = join(dir, "calls.log");
    const gh = join(dir, "gh");
    writeFileSync(
      gh,
      [
        "#!/usr/bin/env bash",
        'printf "%s\\n" "$*" >> "$GH_STUB_LOG"',
        'case "$*" in',
        '  *closedByPullRequestsReferences*) printf "%s" "$GH_STUB_PRS" ;;',
        '  *) echo "board read refused by stub" >&2; exit 1 ;;',
        "esac",
        "",
      ].join("\n"),
    );
    chmodSync(gh, 0o755);
    writeFileSync(log, "");
    const result = spawnSync("bash", ["-c", substituted(syncScript)], {
      encoding: "utf-8",
      env: {
        PATH: `${dir}${delimiter}${process.env.PATH ?? ""}`,
        GH_STUB_LOG: log,
        GH_STUB_PRS: prs,
        ALL_ASSIGNEES: allAssignees,
        REMOVED_ASSIGNEE: removed,
        REPO: "smeltworks/cnx",
        ISSUE_NUMBER: "1578",
        PROJECT_OWNER: "smeltworks",
        PROJECT_NUMBER: "1",
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

describe("project-sync.yml — unassigning the last assignee", () => {
  it("finds the step it runs", () => {
    expect(syncScript).toContain("issues.unassigned)");
  });

  it("leaves the card in WIP while an open pull request closes the issue", () => {
    const run = unassign("jlaustill", "jlaustill", closing(2500));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain(
      "Open pull request #2500 closes this issue; leaving it in WIP.",
    );
    expect(run.calls).not.toContain("projectV2");
  });

  it("names every open pull request that closes the issue", () => {
    const run = unassign("jlaustill", "jlaustill", closing(2500, 2501));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Open pull request #2500, #2501 closes");
  });

  it("asks about the issue that fired, in the repository that fired it", () => {
    const run = unassign("jlaustill", "jlaustill", closing(2500));
    expect(run.calls).toContain("owner=smeltworks");
    expect(run.calls).toContain("name=cnx");
    expect(run.calls).toContain("number=1578");
  });

  it("goes on to move the card when no open pull request closes the issue", () => {
    const run = unassign("jlaustill", "jlaustill", closing());
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("Could not read board");
    expect(run.calls).toContain("projectV2");
  });

  it("fails rather than move the card when the pull-request read fails", () => {
    const run = unassign("jlaustill", "jlaustill", "not json");
    expect(run.status).not.toBe(0);
    expect(run.calls).not.toContain("projectV2");
  });

  it("asks nothing while someone else is still assigned", () => {
    const run = unassign("jlaustill,other", "jlaustill", closing());
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("Still assigned to other");
    expect(run.calls).toBe("");
  });
});
