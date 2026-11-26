import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface IStep {
  uses?: string;
}

interface IJob {
  if?: string;
  "runs-on"?: string;
  needs?: string | string[];
  steps?: IStep[];
}

interface IWorkflow {
  concurrency: {
    group: string;
    "cancel-in-progress"?: boolean;
    queue?: string;
  };
  jobs: Record<string, IJob>;
}

const workflow = YAML.parse(
  readFileSync(
    join(repoRoot, ".github", "workflows", "pr-checks.yml"),
    "utf-8",
  ),
) as IWorkflow;

/**
 * The shared queue protects the self-hosted runners, so a run must be in it
 * exactly when it can reach them. Both decisions are written as the same
 * expression in several places -- Actions has no way to define one once for
 * `concurrency:` and every `runs-on:` -- so this pins every copy to the queue's.
 * A fork run in the shared queue could fill it; a trusted run outside it
 * overlaps the others on the runners.
 */
describe("pr-checks.yml queue and runners agree on which runs are trusted", () => {
  const queueGroup =
    /^\$\{\{ \((?<trusted>.+)\) && 'pr-checks' \|\| format\('pr-checks-fork-\{0\}', github\.event\.pull_request\.number\) \}\}$/.exec(
      workflow.concurrency.group,
    );
  const trusted = queueGroup?.groups?.trusted ?? "";

  it("queues trusted runs in one shared group, waiting rather than replacing", () => {
    expect(trusted).not.toBe("");
    expect(workflow.concurrency.queue).toBe("max");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(false);
  });

  it("sends a run to the self-hosted runners only under the queue's predicate", () => {
    const selectsRunner = `\${{ (${trusted}) && 'self-hosted' || 'ubuntu-24.04' }}`;
    const offenders = Object.entries(workflow.jobs).filter((entry) => {
      const job = entry[1];
      if (job["runs-on"] === selectsRunner) return false;
      return !(job["runs-on"] === "self-hosted" && job.if === trusted);
    });

    expect(offenders.map((entry) => entry[0])).toEqual([]);
  });
});

/**
 * A superseded run cancels itself in `supersede`, and holds that job until the
 * cancellation lands. That only keeps the run's work from starting if every
 * other job waits for `supersede`, directly or through its own needs.
 */
describe("pr-checks.yml starts nothing before the superseded-run check", () => {
  function needsOf(job: IJob): string[] {
    if (job.needs === undefined) return [];
    return Array.isArray(job.needs) ? job.needs : [job.needs];
  }

  function reachesSupersede(name: string, seen: Set<string>): boolean {
    if (name === "supersede") return true;
    if (seen.has(name)) return false;
    seen.add(name);
    return needsOf(workflow.jobs[name]).some((need) =>
      reachesSupersede(need, seen),
    );
  }

  it("has a supersede job that needs nothing", () => {
    expect(workflow.jobs.supersede).toBeDefined();
    expect(needsOf(workflow.jobs.supersede)).toEqual([]);
  });

  it("makes every other job wait for it", () => {
    const unguarded = Object.keys(workflow.jobs).filter(
      (name) => !reachesSupersede(name, new Set()),
    );

    expect(unguarded).toEqual([]);
  });
});

/**
 * A GitHub-hosted runner is a fresh VM with no cross compiler, and a fork's
 * run is the one that lands on it. Each job below transpiles or compiles for
 * a cross target, so each installs the toolchains through the one composite
 * action; the self-hosted runner has them already:
 * - lint: the scope-context matrix transpiles every fixture, and one pinned
 *   to cortex-m7 reads its headers with arm-none-eabi-gcc's preprocessor
 * - integration: the target matrix compiles every fixture for a Cortex-M and
 *   an AVR
 * - unit-tests: the example tests transpile and compile the Cortex-M examples
 * - cli-tests: the CLI smoke transpiles examples/teensy4/blink.cnx
 * Without the step, each of them fails every fork run, which is how #2500's
 * and #2501's first runs failed (E0516: no C preprocessor was found).
 */
describe("pr-checks.yml gives a GitHub-hosted run the cross toolchains", () => {
  it.each(["lint", "integration", "unit-tests", "cli-tests"])(
    "installs them in %s",
    (jobId) => {
      const steps = workflow.jobs[jobId]?.steps ?? [];
      const installs = steps.filter(
        (step) => step.uses === "./.github/actions/cross-toolchains",
      );

      expect(installs).toHaveLength(1);
    },
  );
});
