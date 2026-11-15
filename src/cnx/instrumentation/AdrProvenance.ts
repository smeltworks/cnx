/**
 * Issue #1241: records where an ADR's rule fired during transpilation.
 *
 * Occupancy of the scope-context matrix is derived from source POSITIONS. A
 * diagnostic supplies one; a codegen decision did not, so ADRs governing
 * successful resolution (ADR-016, ADR-057) had fixtures that could never occupy
 * a cell -- the gate read `warn` for seventeen cells that eleven fixtures were
 * already exercising. That is an observability gap, not a coverage gap, and
 * writing more fixtures could not have closed it.
 *
 * Deliberately a plain sink, not a decision-maker: it records that a rule fired
 * at a position and answers nothing about which cell that is. Classification
 * stays in the matrix tooling, walking the parse tree, so provenance cannot
 * drift from the fixture the way a declared cell can.
 *
 * The current file lives here rather than being passed at every call. A
 * recording site is a one-liner inside a decision it is already making, and
 * threading a path through helpers that deliberately take injected deps
 * (TypeGenerationHelper) would have made those helpers know about global state
 * purely to report on themselves.
 *
 * ## #1452, and what this module does NOT satisfy
 *
 * It moved out of `src/transpiler/state/` for box 1, and it does not satisfy
 * box 4 -- "no module reachable from the pipeline holds mutable cross-pass
 * state". It holds two mutable statics, written at 17 `record` sites across
 * 2.1 Analyze and 2.3 Render plus four `beginFile` sites, and read once at the
 * end of the run. That is cross-pass by the box's literal text.
 *
 * Neither alternative is better. Splitting the sink per pass yields three
 * accumulators where there is one, and the only consumer
 * (`scripts/matrix/AdrProvenanceLines.ts`) reads `adr` and `line` and never
 * `sourcePath`, so the attribution a split changes is unobservable to the only
 * gate watching it. Threading an instance through the call sites contradicts
 * the paragraph above, which is a recorded design decision, not an oversight.
 *
 * The owner's call, taken 2026-09-23: box 4 governs PROGRAM state. A fact about
 * the run is not one, so `src/cnx/instrumentation/` is admitted by
 * `docs/architecture/README.md` as a fourth kind of root beside the layers, the
 * shared contracts and the host -- and as the one root that may hold mutable
 * state, because what it accumulates is an observation rather than a fact
 * carried between passes. Nothing downstream branches on it.
 *
 * That exemption is stated, not incidental. `passes-hold-no-mutable-state.test.ts`
 * scans the layers and not this root because instrumentation is not a pass, and
 * the line it rests on is enforced: `instrumentation-cannot-import-a-layer`
 * (`reachable: true`) stops this module reaching back into the thing it reports
 * on. Mutation-checked -- an import of a 1-Analyze module produces twelve
 * violations naming this file.
 *
 * The sibling arrives with the rest of #1452: the toolchain-requirement
 * accumulator, still inside `CodeGenState` today, is the same kind of fact and
 * belongs here too.
 */
import type IRecordedAdrSite from "../types/IRecordedAdrSite";
import type ISourceSite from "../types/ISourceSite";

class AdrProvenance {
  private static sites: IRecordedAdrSite[] = [];
  private static currentSourcePath: string | null = null;

  /** Attribute subsequent recordings to `sourcePath`. */
  static beginFile(sourcePath: string | null): void {
    this.currentSourcePath = sourcePath;
  }

  /**
   * Note that `adr`'s rule fired at `line` of the current file -- the rule
   * named `rule` when the ADR declares a separate matrix for it.
   *
   * Silently ignores a call with no current file or a non-positive line: a
   * position that cannot be resolved must not become occupancy for whatever
   * declaration happens to start the file, which is the same reason
   * FixtureContext refuses the synthetic 1:0 placeholder.
   */
  static record(
    adr: string,
    line: number | null | undefined,
    rule?: string,
    declaredAt?: ISourceSite,
  ): void {
    if (!this.currentSourcePath || line == null || line <= 0) {
      return;
    }
    this.sites.push({
      adr,
      sourcePath: this.currentSourcePath,
      line,
      rule,
      ...(declaredAt && { declaredAt }),
    });
  }

  /** Every site recorded since the last reset, deduplicated. */
  static collect(): readonly IRecordedAdrSite[] {
    const seen = new Set<string>();
    const unique: IRecordedAdrSite[] = [];
    for (const site of this.sites) {
      const key = `${site.adr} ${site.rule ?? ""} ${site.sourcePath} ${site.line}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(site);
    }
    return unique;
  }

  static reset(): void {
    this.sites = [];
    this.currentSourcePath = null;
  }
}

export default AdrProvenance;
