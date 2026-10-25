import chalk from "chalk";
import type ICheckOutcome from "../types/ICheckOutcome";
import type IGateViolation from "../types/IGateViolation";

/**
 * How a docs/manifest gate CLI prints an `ICheckOutcome`, and how a gate that
 * finds violations lists them (#2115)
 */
class CheckOutcome {
  /** Prints the outcome; returns the exit code it calls for */
  static report(outcome: ICheckOutcome): number {
    for (const line of outcome.warnings ?? []) console.warn(chalk.yellow(line));
    for (const line of outcome.info) console.log(chalk.green(line));
    if (outcome.ok) return 0;
    console.error(chalk.red(outcome.errors.join("\n")));
    return 1;
  }

  static printViolations(violations: readonly IGateViolation[]): void {
    for (const violation of violations) {
      console.log(
        `${chalk.red("error")}  ${violation.file}:${violation.line}  ${violation.kind}  ${violation.detail}`,
      );
    }
  }
}

export default CheckOutcome;
