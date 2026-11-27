import type IParsedRecovery from "./IParsedRecovery";
import type TParsedHeaderEntry from "./TParsedHeaderEntry";
import type TRunFacts from "./TRunFacts";
import type ITranspileError from "../../../types/ITranspileError";
import type IParsedSource from "./IParsedSource";
import type TRunTarget from "../../../types/TRunTarget";

/** 1.2's artifact (#1991): each file that parsed, the others' errors, and 1.1's facts carried on */
interface IParsedSources {
  /** #1991: the C/C++ headers 1.1 settled, in its order */
  readonly headers: readonly TParsedHeaderEntry[];
  /** `IReadHeaders.readers`: what read each of `headers`, for the host's cache */
  readonly headerReaders: ReadonlyMap<string, string>;
  /** `IReadHeaders.disputed` */
  readonly disputedHeaders: ReadonlySet<string>;
  /** #1991: issue #985's recovery slices, parsed; null when 1.1 had none */
  readonly recovered: IParsedRecovery | null;
  readonly sources: readonly IParsedSource[];
  readonly errors: readonly ITranspileError[];
  readonly target: TRunTarget;
  readonly discovery: TRunFacts;
}

export default IParsedSources;
