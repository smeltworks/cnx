import chalk from "chalk";

/** What a docs/manifest gate decided; the CLI only prints it (#2115) */
interface ICheckOutcome {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly info: readonly string[];
  readonly warnings?: readonly string[];
}

/** The violations a source-scanning gate found */
interface IViolation {
  readonly file: string;
  readonly line: number;
  readonly kind: string;
  readonly detail: string;
}

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

  static printViolations(violations: readonly IViolation[]): void {
    for (const violation of violations) {
      console.log(
        `${chalk.red("error")}  ${violation.file}:${violation.line}  ${violation.kind}  ${violation.detail}`,
      );
    }
  }
}

export default CheckOutcome;
