/**
 * Issue #1241: one transpile of a fixture, read for where its ADRs' rules fired.
 *
 * The matrix resolves a fixture's cell by walking the parse tree at a POSITION.
 * Diagnostic positions come from `.expected.error`, which is why an ADR about
 * resolution SUCCEEDING had no way in: ADR-057's fixtures assert generated C and
 * emit no diagnostic, so eleven of them occupied nothing and seventeen declared
 * cells sat `warn` with no path to green.
 *
 * Transpiling the fixture and reading `result.adrSites` supplies the missing
 * positions from the transpiler's own behavior. Occupancy stays DERIVED -- the
 * fixture still declares nothing, and a cell is credited only where the rule
 * demonstrably fired.
 *
 * #1402: the run is a files run over the fixture, as the harness's own CLI
 * transpile is (`transpileViaCli`, with the same include directory), so every
 * `.cnx` file the fixture reaches is transpiled too and a rule firing in one
 * is recorded at that file. A source run transpiled the fixture alone and read
 * its includes for symbols only, so every site carried the fixture's own path.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import Transpiler from "../../src/cli/Transpiler";
import TestUtils from "../test-utils";
import IncludeHops from "./IncludeHops";
import NodeFileSystem from "../../src/cnx/PARSE/1-Discover/NodeFileSystem";
import type IFixtureRun from "../types/IFixtureRun";

/** Throwaway output directory, removed after the run; the matrix cares about provenance, not files. */
function scratchDir(): string {
  return mkdtempSync(join(tmpdir(), "cnx-matrix-"));
}

/**
 * Transpile `fixturePath` and everything it includes.
 *
 * Returns null when the transpiler throws. A run that did not happen is not
 * evidence of anything, and inventing occupancy from it is the same error as
 * trusting a synthetic 1:0 position.
 */
async function of(
  fixturePath: string,
  includeDirs: readonly string[],
): Promise<IFixtureRun | null> {
  const fixture = resolve(fixturePath);
  const outDir = scratchDir();
  try {
    const source = readFileSync(fixture, "utf-8");
    const transpiler = new Transpiler(
      {
        input: fixture,
        outDir,
        includeDirs: [...includeDirs],
        target: TestUtils.harnessTarget(source),
        // #1844 review: the mode of the harness's first run of this fixture,
        // so provenance comes from a run the harness performs
        cppRequired: !TestUtils.getTestModes(source).includes("c"),
      },
      NodeFileSystem.instance,
    );
    const result = await transpiler.transpile({ kind: "files" });
    return {
      sites: result.adrSites ?? [],
      errors: result.errors,
      hops: IncludeHops.from(fixture, result.includes ?? new Map()),
      includesForeignHeader:
        result.includesForeignHeader?.has(fixture) ?? false,
    };
  } catch {
    return null;
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

class FixtureRun {
  static of = of;
}

export default FixtureRun;
