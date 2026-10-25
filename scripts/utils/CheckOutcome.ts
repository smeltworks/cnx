import chalk from "chalk";
import type ICheckOutcome from "../types/ICheckOutcome";
import type IGateViolation from "../types/IGateViolation";

/** The one way every gate CLI prints its outcome and sets the exit code */
class CheckOutcome {
  static report(outcome: ICheckOutcome): void {
    for (const line of outcome.warnings ?? []) console.warn(chalk.yellow(line));
    for (const line of outcome.info) console.log(chalk.green(line));
    if (!outcome.ok) {
      console.error(chalk.red(outcome.errors.join("\n")));
      process.exit(1);
    }
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
