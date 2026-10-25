import type IGateViolation from "./IGateViolation";

/**
 * One place an ADR names something that a rewrite of the transpiler would
 * discard (issue #1403).
 */
interface IAdrViolation extends IGateViolation {
  /** ADR filename, e.g. `adr-013-const-qualifier.md`. */
  file: string;
  /** 1-indexed line the violation was found on. */
  line: number;
  /**
   * Why it fails the rewrite test. `fence` is a code block in a stack language,
   * `directive` an ANTLR-only lexer action inside an otherwise-fine grammar
   * block, `path` a `src/`/`scripts/` source path, `identifier` a transpiler
   * class, interface or type name.
   */
  kind: "fence" | "directive" | "path" | "identifier";
  /** The offending text, for the report. */
  detail: string;
}

export default IAdrViolation;
