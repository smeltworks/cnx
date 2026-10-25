/**
 * One place a source-scanning gate failed, as `CheckOutcome.printViolations`
 * prints it (#2115). Each gate narrows `kind` to its own reasons.
 */
interface IGateViolation {
  readonly file: string;
  /** 1-indexed line the violation was found on */
  readonly line: number;
  readonly kind: string;
  readonly detail: string;
}

export default IGateViolation;
