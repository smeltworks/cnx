import type ICheckOutcome from "./ICheckOutcome";

/**
 * What a manifest command decided, separated from printing it.
 *
 * `check`'s ordering bug lived in the CLI's `main()`, which nothing could reach
 * from a test -- so the decision is returned as data and `main()` only prints it.
 */
interface IManifestOutcome extends ICheckOutcome {
  readonly warnings: readonly string[];
}

export default IManifestOutcome;
