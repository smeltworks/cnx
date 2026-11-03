import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface IStep {
  id?: string;
  name?: string;
  if?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, unknown>;
}

interface IJob {
  name?: string;
  if?: string;
  "runs-on"?: string;
  steps?: IStep[];
}

interface IWorkflow {
  name: string;
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, IJob>;
}

function load(file: string): IWorkflow {
  return YAML.parse(
    readFileSync(join(repoRoot, ".github", "workflows", file), "utf-8"),
  ) as IWorkflow;
}

const prChecks = load("pr-checks.yml");
const sonar = load("sonar.yml");
const scanJob = sonar.jobs.scan;
const steps = scanJob.steps ?? [];
const runScripts = steps.flatMap((step) => (step.run ? [step.run] : []));

function stepUsing(action: string): IStep[] {
  return steps.filter((step) => step.uses?.startsWith(`${action}@`));
}

/**
 * #1680: a pull request from a fork gets no repository secrets, so a Sonar
 * scan inside `pr-checks.yml` cannot authenticate there. `sonar.yml` runs on
 * `workflow_run`, in the base repository's context WITH `SONAR_TOKEN` -- and,
 * for a fork, with the fork's files on disk. Everything below is the reason
 * that is safe; each assertion names the attack it stops.
 */
describe("sonar.yml — scans every pull request and push from a trusted context", () => {
  it("scans every pull request and every push PR Quality Checks runs on, except a cancelled run", () => {
    expect(scanJob.if).toBe(
      "github.event.workflow_run.conclusion != 'cancelled' && (github.event.workflow_run.event == 'pull_request' || github.event.workflow_run.event == 'push')",
    );
  });

  it("runs after PR Quality Checks completes, by that workflow's own name", () => {
    expect(sonar.on).toEqual({
      workflow_run: { workflows: [prChecks.name], types: ["completed"] },
    });
  });

  it("never runs on a self-hosted runner, because fork files land on disk", () => {
    for (const job of Object.values(sonar.jobs)) {
      expect(job["runs-on"]).toBe("ubuntu-latest");
    }
  });

  it("grants the token read scopes, plus statuses to report the scan's outcome", () => {
    expect(sonar.permissions).toEqual({
      actions: "read",
      contents: "read",
      "pull-requests": "read",
      statuses: "write",
    });
  });

  it("executes no fork-controlled code: no package manager or node in any run step", () => {
    expect(runScripts.length).toBeGreaterThan(0);
    for (const script of runScripts) {
      expect(script).not.toMatch(/\b(npm|npx|node|yarn|pnpm|tsx)\b/);
    }
  });

  it("interpolates no event payload into a shell script (branch names are attacker-chosen)", () => {
    for (const script of runScripts) {
      expect(script).not.toMatch(/\$\{\{[^}]*github\.event/);
    }
  });

  it("checks the analyzed commit out without credentials, at the ref the resolve step validated", () => {
    const prCheckout = stepUsing("actions/checkout").filter(
      (step) => step.with?.path === undefined,
    );
    expect(prCheckout).toHaveLength(1);
    expect(prCheckout[0].with?.["persist-credentials"]).toBe(false);
    expect(prCheckout[0].with?.ref).toBe("${{ steps.target.outputs.ref }}");
  });

  /**
   * A `workflow_run` failure is reported on the default branch's commit, not
   * on the pull request, so a broken scan would otherwise show on the PR only
   * as a required check that never arrives. The status is posted for EVERY
   * outcome: a context keeps its last state, so posting only failures would
   * leave a stale red after a successful re-run.
   */
  it("reports the scan's outcome on the analyzed commit, whatever it was", () => {
    const report = steps.filter((step) =>
      step.run?.includes("/statuses/$HEAD_SHA"),
    );
    expect(report).toHaveLength(1);
    expect(report[0].name).toBe(steps[steps.length - 1].name);
    expect(report[0].if).toBe("always()");
    expect(report[0].env?.JOB_STATUS).toBe("${{ job.status }}");
    expect(report[0].env?.HEAD_SHA).toBe(
      "${{ github.event.workflow_run.head_sha }}",
    );
  });

  /**
   * actions/checkout refuses fork code in a `workflow_run` unless the step opts
   * in (first live run, 36252707112). The opt-in is what every test above makes
   * safe, so it belongs on the one step that needs fork code and nowhere else.
   */
  it("opts into fork checkout on the pull request step only", () => {
    const optedIn = stepUsing("actions/checkout").filter(
      (step) => step.with?.["allow-unsafe-pr-checkout"] !== undefined,
    );
    expect(optedIn).toHaveLength(1);
    expect(optedIn[0].with?.path).toBeUndefined();
    expect(optedIn[0].with?.["allow-unsafe-pr-checkout"]).toBe(true);
  });

  it("asserts the checked-out commit is the one PR Quality Checks ran on", () => {
    const assertion = runScripts.filter((script) =>
      script.includes("git rev-parse HEAD"),
    );
    expect(assertion).toHaveLength(1);
    expect(assertion[0]).toContain('"$HEAD_SHA"');
  });

  it("reads Sonar settings from the default branch, never from the fork", () => {
    const trusted = stepUsing("actions/checkout").filter(
      (step) => step.with?.path !== undefined,
    );
    expect(trusted).toHaveLength(1);
    expect(trusted[0].with?.ref).toBe(
      "${{ github.event.repository.default_branch }}",
    );

    const scan = stepUsing("SonarSource/sonarqube-scan-action");
    expect(scan).toHaveLength(1);
    expect(scan[0].with?.args).toBe(
      `-Dproject.settings=${String(trusted[0].with?.path)}/sonar-project.properties`,
    );
    expect(scan[0].env?.SONAR_HOST_URL).toBe("https://sonarcloud.io");
  });

  it("pins the scan action to a full commit SHA, not a movable tag", () => {
    const scan = stepUsing("SonarSource/sonarqube-scan-action")[0];
    expect(scan.uses).toMatch(/@[0-9a-f]{40}$/);
  });

  /**
   * By the time this workflow_run fires, the PR it targets may have already
   * merged or closed -- the "exactly one open PR" query then finds zero, which
   * is a race, not a defect. Only more than one match is still a real error.
   */
  it("skips without failing when the resolved PR has already been merged or closed", () => {
    const resolve = steps.find(
      (step) => step.name === "Resolve what to analyze",
    );
    expect(resolve?.run).toMatch(
      /if \[ "\$count" -eq 0 \][\s\S]*echo "skip=true" >> "\$GITHUB_OUTPUT"[\s\S]*exit 0/,
    );
    expect(resolve?.run).toMatch(
      /if \[ "\$count" -ne 1 \][\s\S]*::error::expected one open PR/,
    );
  });

  /**
   * PR Quality Checks can finish without ever uploading coverage-report (it
   * failed before that step, or was skipped) -- that run's own conclusion
   * already reports the problem, so downloading an artifact that was never
   * produced must not also fail this job.
   */
  it("skips without failing when PR Quality Checks produced no coverage-report artifact", () => {
    const artifactCheck = steps.find((step) => step.id === "artifact");
    expect(artifactCheck?.name).toBe("Check coverage artifact exists");
    expect(artifactCheck?.if).toBe("steps.target.outputs.skip != 'true'");
    expect(artifactCheck?.run).toContain(
      "repos/$REPO/actions/runs/$RUN_ID/artifacts",
    );
    expect(artifactCheck?.run).toMatch(
      /if \[ "\$count" -eq 0 \][\s\S]*echo "skip=true" >> "\$GITHUB_OUTPUT"/,
    );
  });

  it("gates every step after resolution on neither skip output being set", () => {
    const expectedIf =
      "steps.target.outputs.skip != 'true' && steps.artifact.outputs.skip != 'true'";
    const gated = [
      "Checkout the analyzed commit",
      "Assert checkout matches the analyzed run",
      "Checkout trusted Sonar settings",
      "Download coverage artifact",
      "SonarCloud Scan",
    ];
    for (const name of gated) {
      const step = steps.find((candidate) => candidate.name === name);
      expect(step?.if).toBe(expectedIf);
    }
  });

  it("reports success with a reason instead of failing the status check when skipped", () => {
    const report = steps[steps.length - 1];
    expect(report.env?.TARGET_SKIP).toBe("${{ steps.target.outputs.skip }}");
    expect(report.env?.ARTIFACT_SKIP).toBe(
      "${{ steps.artifact.outputs.skip }}",
    );
    expect(report.run).toMatch(
      /\$TARGET_SKIP"\s*=\s*"true"[\s\S]*state=success/,
    );
    expect(report.run).toMatch(
      /\$ARTIFACT_SKIP"\s*=\s*"true"[\s\S]*state=success/,
    );
  });
});

/**
 * #1680's transition: `sonar.yml` now scans everything, and the old
 * `pr-checks.yml` job still scans pushes and same-repository pull requests.
 * It stays for one cycle so the pull request that deletes it can take its own
 * required check from the widened `sonar.yml` -- `workflow_run` only ever runs
 * the default branch's copy. That pull request deletes this describe with the
 * job.
 */
describe("#1680 transition — the old pr-checks.yml job until it is deleted", () => {
  it("pr-checks.yml scans pushes and same-repository pull requests only", () => {
    expect(prChecks.jobs.sonar.if).toBe(
      "github.event_name == 'push' || !github.event.pull_request.head.repo.fork",
    );
  });

  it("All Checks Passed accepts a skipped Sonar job for a fork only", () => {
    const verify = prChecks.jobs["all-checks-passed"].steps?.[0].run ?? "";
    const sonarLines = verify
      .split("\n")
      .filter((line) => line.includes("needs.sonar.result"));
    expect(sonarLines).toHaveLength(1);
    expect(sonarLines[0]).toContain("github.event.pull_request.head.repo.fork");
  });

  it("both paths pin the same scan action", () => {
    const prChecksScan = (prChecks.jobs.sonar.steps ?? []).find((step) =>
      step.uses?.startsWith("SonarSource/sonarqube-scan-action@"),
    );
    expect(prChecksScan?.uses).toBe(
      stepUsing("SonarSource/sonarqube-scan-action")[0].uses,
    );
  });
});
