import type EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type IHeaderDeclarationRecord from "../../1-Discover/types/IHeaderDeclarationRecord";

/** #1991: what 1.3 made of the run's C/C++ headers, for the host to record */
interface IDeclaredHeaders {
  /** The headers 1.3 parsed rather than restored, each as it declared it */
  readonly declared: ReadonlyArray<{
    readonly path: string;
    readonly language: EHeaderLanguage;
    readonly record: IHeaderDeclarationRecord;
  }>;
  /** #1319: the headers that would not parse, which degrade to a warning */
  readonly warnings: readonly string[];
  /** The headers declared or restored */
  readonly processed: number;
  /** `IParsedSources.headerReaders`: what read each header `declared` came from */
  readonly readers: ReadonlyMap<string, string>;
}

export default IDeclaredHeaders;
