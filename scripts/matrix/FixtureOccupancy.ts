/**
 * Issue #1219: builds per-ADR matrix occupancy from the fixture corpus.
 *
 * Occupancy is derived, never declared. A fixture states only which ADR it
 * exercises (`// test-adr:`); which cell that lands in comes from the parse
 * tree and the include graph, so the classification cannot drift from the
 * fixture -- it IS the fixture.
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { ProgramContext } from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";
import CnxSourceParser from "../../src/cnx/PARSE/2-Parse/CnxSourceParser";
import FixtureContext from "./FixtureContext";
import FixturePosition from "./FixturePosition";
import MatrixCell from "./MatrixCell";
import MatrixRule from "./MatrixRule";
import TestUtils from "../test-utils";
import DiagnosticManifest from "../diagnostics/DiagnosticManifest";
import FixtureRun from "./FixtureRun";
import type IFixtureRun from "../types/IFixtureRun";
import type ILocatedPosition from "../types/ILocatedPosition";
import type TMatrixRelationship from "../types/TMatrixRelationship";
import type IRecordedAdrSite from "../../src/cnx/types/IRecordedAdrSite";
import type ISourceSite from "../../src/cnx/types/ISourceSite";
import IMatrixOccupancy from "../types/IMatrixOccupancy";
import ISourcePosition from "../types/ISourcePosition";
import TMatrixContext from "../types/TMatrixContext";

/**
 * Source positions carrying a diagnostic, from a fixture's `.expected.error`.
 *
 * Position `1:0` is excluded: 13 error codes report it as a placeholder while
 * the real line sits in the message text or is lost entirely at the catch
 * (#1235). Resolving line 1 would classify every one of them as whatever
 * declaration happens to start the file.
 *
 * This does discard the rare genuine diagnostic at line 1 column 0. That is the
 * safe direction: the cost is an under-reported cell, whereas trusting the
 * placeholder invents occupancy for a cell nothing exercises. Once #1235 lands
 * the position is unambiguous and this exclusion should go.
 *
 * KNOWN GAP (#1408): the path prefix is discarded, so a position naming ANOTHER
 * file is still resolved against this fixture's parse tree. Harmless today --
 * the one fixture that reports a foreign path (#1334's cross-file conflict,
 * which reports at the FIRST definition) lands on a comment and yields no
 * context -- but there is no guard, and every diagnostic that gains a real
 * cross-file position turns a skipped 1:0 into a real number aimed at the wrong
 * tree.
 *
 * #1620: positions are grouped by the code each line asserts, so a cell is
 * occupied for that code alone. A line asserting no code (a parse error) is
 * grouped under `null` and speaks for the ADR's own matrix, as before.
 */
function diagnosticPositions(
  expectedErrorPath: string,
): Map<string | null, ISourcePosition[]> {
  const byCode = new Map<string | null, ISourcePosition[]>();
  if (!existsSync(expectedErrorPath)) return byCode;

  const content = readFileSync(expectedErrorPath, "utf-8");
  for (const text of content.split("\n")) {
    const match = /^(\d+):(\d+)/.exec(text);
    if (match === null) continue;
    const line = Number(match[1]);
    const column = Number(match[2]);
    if (line === 1 && column === 0) continue;

    const codes = DiagnosticManifest.parseCodes(text);
    for (const code of codes.length > 0 ? codes : [null]) {
      const positions = byCode.get(code) ?? [];
      addPosition(positions, { line, column });
      byCode.set(code, positions);
    }
  }
  return byCode;
}

function addPosition(
  positions: ISourcePosition[],
  next: ISourcePosition,
): void {
  const seen = positions.some(
    (position) =>
      position.line === next.line && position.column === next.column,
  );
  if (!seen) positions.push(next);
}

/** Contexts the given source positions resolve to. Empty when none can be. */
function contextsAt(
  positions: readonly ILocatedPosition[],
): Map<string, TMatrixContext> {
  const keys = new Map<string, TMatrixContext>();
  for (const { tree, line, column, relationship } of positions) {
    const context = FixtureContext.at(tree, line, column);
    if (context !== null)
      keys.set(MatrixCell.key(context, relationship), context);
  }
  return keys;
}

/**
 * #1618: the positions a code's diagnostics land in, recorded for its matrix
 * beside the contexts `recordFixture` resolves from the same diagnostics.
 */
function recordPositions(
  tree: ProgramContext,
  diagnostics: readonly ISourcePosition[],
  fixture: string,
  matrix: Map<string, string[]>,
): void {
  for (const { line, column } of diagnostics) {
    if (column === undefined) continue;
    const position = FixturePosition.at(tree, line, column);
    if (position === null) continue;
    const occupants = matrix.get(position) ?? [];
    if (!occupants.includes(fixture)) occupants.push(fixture);
    matrix.set(position, occupants);
  }
}

/**
 * #1402: the relationship of a position in the fixture itself -- the hops to
 * the file that declares its construct, as the deciding pass recorded it
 * (`declaredAt`). With no declaration recorded it is `same-file` only where
 * the fixture includes nothing, so nothing else could have declared it;
 * otherwise it is not measured, never guessed.
 */
function consumerRelationship(
  run: IFixtureRun,
  declaredAt: ISourceSite | undefined,
): TMatrixRelationship | null {
  if (declaredAt === undefined) {
    return run.hops.size === 1
      ? MatrixCell.relationshipFor("consumer", 0)
      : null;
  }
  const hops = run.hops.get(resolve(declaredAt.sourcePath));
  return hops === undefined
    ? null
    : MatrixCell.relationshipFor("consumer", hops);
}

/** The declaration the run reported for the diagnostic at `position` */
function declarationAt(
  run: IFixtureRun,
  fixture: string,
  position: ISourcePosition,
): ISourceSite | undefined {
  return run.errors.find(
    (error) =>
      error.declaredAt !== undefined &&
      error.sourcePath !== undefined &&
      resolve(error.sourcePath) === fixture &&
      error.line === position.line &&
      error.column === position.column,
  )?.declaredAt;
}

/**
 * Where a recorded site sits. #1402: a site in a file the fixture includes is
 * the provider side, read from that file's own tree.
 */
function locateSite(
  run: IFixtureRun,
  fixture: string,
  site: IRecordedAdrSite,
  treeOf: (path: string) => ProgramContext | null,
): ILocatedPosition | null {
  const path = resolve(site.sourcePath);
  const tree = treeOf(path);
  if (tree === null) return null;
  if (path === fixture) {
    const relationship = consumerRelationship(run, site.declaredAt);
    return relationship === null
      ? null
      : { tree, line: site.line, relationship };
  }
  const hops = run.hops.get(path);
  return hops === undefined
    ? null
    : {
        tree,
        line: site.line,
        relationship: MatrixCell.relationshipFor("provider", hops),
      };
}

/** Each file's parse tree, parsed once */
function treeCache(
  fixture: string,
  fixtureTree: ProgramContext,
): (path: string) => ProgramContext | null {
  const trees = new Map<string, ProgramContext | null>([
    [fixture, fixtureTree],
  ]);
  return (path) => {
    if (!trees.has(path)) {
      trees.set(
        path,
        existsSync(path)
          ? CnxSourceParser.parse(readFileSync(path, "utf-8")).tree
          : null,
      );
    }
    return trees.get(path)!;
  };
}

/**
 * Fold one fixture into the per-ADR occupancy maps.
 */
function recordFixture(
  fixturePath: string,
  testsDir: string,
  cells: Map<string, Map<string, string[]>>,
  withoutContext: Map<string, string[]>,
  run: IFixtureRun | null,
  positionCells: Map<string, Map<string, string[]>>,
): void {
  let source: string;
  try {
    source = readFileSync(fixturePath, "utf-8");
  } catch {
    return;
  }

  const adrs = TestUtils.findAdrReferences(source);
  if (adrs.length === 0) return;

  const fixture = resolve(fixturePath);
  const shortPath = relative(testsDir, fixturePath);

  // #1241: a diagnostic's position is ADR-agnostic -- a fixture's `.expected.error`
  // speaks for every ADR it is tagged with. Provenance is not: it records WHICH
  // rule fired where, so contexts are resolved per ADR rather than once per file.
  const expectedError = fixturePath.replace(/\.test\.cnx$/, ".expected.error");
  const diagnostics = diagnosticPositions(expectedError);
  const { tree } = CnxSourceParser.parse(source);
  const treeOf = treeCache(fixture, tree);

  const locateDiagnostics = (
    positions: readonly ISourcePosition[],
  ): ILocatedPosition[] => {
    if (run === null) return [];
    return positions.flatMap((position) => {
      const relationship = consumerRelationship(
        run,
        declarationAt(run, fixture, position),
      );
      return relationship === null ? [] : [{ tree, ...position, relationship }];
    });
  };

  for (const adr of adrs) {
    // #1731 review: a rule with its own table is occupied only by provenance
    // recorded for that rule. #1620: a coded diagnostic occupies only its
    // code's matrix -- never the ADR's own, nor another code's.
    const matrices = new Map<string, ILocatedPosition[]>([
      [adr, locateDiagnostics(diagnostics.get(null) ?? [])],
    ]);
    for (const [code, codePositions] of diagnostics) {
      if (code === null) continue;
      const codeId = MatrixRule.id(adr, code);
      matrices.set(codeId, locateDiagnostics(codePositions));
      const matrix = positionCells.get(codeId) ?? new Map<string, string[]>();
      recordPositions(tree, codePositions, shortPath, matrix);
      if (matrix.size > 0) positionCells.set(codeId, matrix);
    }
    for (const site of run?.sites ?? []) {
      const matrixId = MatrixRule.id(site.adr, site.rule);
      if (MatrixRule.adrOf(matrixId) !== adr) continue;
      const located = locateSite(run!, fixture, site, treeOf);
      if (located === null) continue;
      matrices.set(matrixId, [...(matrices.get(matrixId) ?? []), located]);
    }

    let placed = false;
    for (const [matrixId, matrixPositions] of matrices) {
      const keys = contextsAt(matrixPositions);
      if (keys.size === 0) continue;
      placed = true;
      const matrixCells = cells.get(matrixId) ?? new Map<string, string[]>();
      for (const key of keys.keys()) {
        const occupants = matrixCells.get(key) ?? [];
        if (!occupants.includes(shortPath)) occupants.push(shortPath);
        matrixCells.set(key, occupants);
      }
      cells.set(matrixId, matrixCells);
    }

    if (!placed) {
      const pending = withoutContext.get(adr) ?? [];
      pending.push(shortPath);
      withoutContext.set(adr, pending);
    }
  }
}

/** Build occupancy for every ADR referenced by any fixture under `testsDir`. */
async function build(
  fixturePaths: readonly string[],
  testsDir: string,
  searchPaths: readonly string[] = [],
): Promise<Map<string, IMatrixOccupancy>> {
  const cells = new Map<string, Map<string, string[]>>();
  const withoutContext = new Map<string, string[]>();
  const positionCells = new Map<string, Map<string, string[]>>();

  for (const fixturePath of fixturePaths) {
    // #1241: only tagged fixtures are transpiled -- provenance is the expensive
    // input, and an untagged fixture contributes to no ADR's occupancy anyway.
    let source: string;
    try {
      source = readFileSync(fixturePath, "utf-8");
    } catch {
      continue;
    }
    const run = TestUtils.findAdrReferences(source).length
      ? await FixtureRun.of(fixturePath, searchPaths)
      : null;

    recordFixture(
      fixturePath,
      testsDir,
      cells,
      withoutContext,
      run,
      positionCells,
    );
  }

  const result = new Map<string, IMatrixOccupancy>();
  const adrs = new Set([
    ...cells.keys(),
    ...withoutContext.keys(),
    ...positionCells.keys(),
  ]);
  for (const adr of [...adrs].sort()) {
    result.set(adr, {
      adr,
      cells: cells.get(adr) ?? new Map<string, string[]>(),
      fixturesWithoutContext: withoutContext.get(adr) ?? [],
      positions: positionCells.get(adr) ?? new Map<string, string[]>(),
    });
  }
  return result;
}

class FixtureOccupancy {
  static build = build;
}

export default FixtureOccupancy;
