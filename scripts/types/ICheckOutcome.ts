/**
 * What a docs/manifest gate decided, separated from printing it: `ok` is the
 * verdict and `CheckOutcome.report` the one way a CLI prints it (#2115).
 */
interface ICheckOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
  readonly warnings?: readonly string[];
}

export default ICheckOutcome;
