/**
 * #1688: each cnx file's header macros, as the preprocessor's dump of that
 * file's own C includes -- so a file sees the macros C sees for it, system
 * headers and compiler builtins included, and no other file's (#1881).
 *
 * #1713: run in 1.2, with the compiler of the run's target, once 1.2 has
 * chosen it (owner ruling 2026-10-16: running the compiler over the headers
 * is not discovery's). #1991 had moved it from the host into 1.1.
 */
import { availableParallelism } from "node:os";

import ConcurrencyLimit from "../../utils/ConcurrencyLimit";
import ExternalDeclarationOracle from "./preprocessor/ExternalDeclarationOracle";
import type IHeaderPreprocessor from "./preprocessor/types/IHeaderPreprocessor";
import type IFileIncludes from "../1-Discover/types/IFileIncludes";
import type IHeaderMacroDump from "./types/IHeaderMacroDump";
import type IPipelineFile from "../1-Discover/types/IPipelineFile";

class HeaderMacroDumps {
  /** Every cnx file with a C include, to its dump */
  static async read(
    files: readonly IPipelineFile[],
    includes: ReadonlyMap<string, IFileIncludes>,
    preprocessor: IHeaderPreprocessor | null,
    options: {
      readonly includeSearchPaths: readonly string[];
      readonly defines: Readonly<Record<string, string | boolean>>;
    },
  ): Promise<ReadonlyMap<string, IHeaderMacroDump>> {
    const withIncludes = files.flatMap((file) => {
      const own = includes.get(file.path);
      return own === undefined || own.cHeaderSpecs.length === 0
        ? []
        : [{ file, own }];
    });
    // Without a preprocessor a macro has no type, as before #1688
    if (!preprocessor?.isAvailable()) {
      return new Map(
        withIncludes.map(({ file }) => [
          file.path,
          { dump: null, headerFiles: new Set<string>(), complete: false },
        ]),
      );
    }
    const limit = ConcurrencyLimit.create(availableParallelism());
    const dumps = await Promise.all(
      withIncludes.map(async ({ file, own }) => {
        const read = await limit(() =>
          ExternalDeclarationOracle.macroDump(own.cHeaderSpecs, preprocessor, {
            // The file's own directory first, as C searches a quoted include
            includePaths: [
              own.quotedIncludeDirectory,
              ...options.includeSearchPaths,
            ],
            defines: { ...options.defines },
          }),
        );
        const dump: IHeaderMacroDump = {
          dump: read?.dump ?? null,
          headerFiles: read?.headerFiles ?? new Set<string>(),
          complete: read?.complete === true,
        };
        return [file.path, dump] as const;
      }),
    );
    return new Map(dumps);
  }
}

export default HeaderMacroDumps;
