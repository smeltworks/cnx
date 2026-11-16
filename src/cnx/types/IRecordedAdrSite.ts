/**
 * Issue #1241: a source position at which an ADR's rule actually fired.
 *
 * The counterpart to IRequirementSite (#1143), and recorded the same way: by the
 * code that took the decision, at the moment it took it, so a consumer can never
 * disagree with what happened.
 *
 * This exists because matrix occupancy is DERIVED, never declared. The context
 * axis is resolved by walking the parse tree at a position, and until now the
 * only positions available were diagnostic positions from an `.expected.error`.
 * That made every codegen-only fixture invisible: ADR-057 is about resolution
 * SUCCEEDING, so its fixtures assert generated C and emit no diagnostic, and
 * eleven of them could not occupy a single cell. Recording where the rule fired
 * gives those fixtures a position without asking them to declare one.
 */
import type ISourceSite from "./ISourceSite";

interface IRecordedAdrSite {
  /** ADR number as it appears in `// test-adr:`, e.g. "057". */
  readonly adr: string;

  /** Path of the .cnx file whose source carried the construct. */
  readonly sourcePath: string;

  /** 1-based line in that file. */
  readonly line: number;

  /**
   * #1731 review: the rule of the ADR that fired, when the ADR declares a
   * separate matrix for it (`<!-- MATRIX-SEVERITY rule: <name> -->`). Absent
   * for the ADR's own table, so one rule's fixtures cannot fill the cells
   * another rule must fill.
   */
  readonly rule?: string;

  /**
   * #1402: the declaration of the construct the rule fired on, in the file
   * that declares it, when it has one. The matrix measures the consumer-side
   * relationship from it.
   */
  readonly declaredAt?: ISourceSite;

  /**
   * #1402: the construct is what is written at the site itself, so no other
   * file supplies it (`ITranspileError.aboutItsPosition`)
   */
  readonly aboutItsPosition?: true;
}

export default IRecordedAdrSite;
