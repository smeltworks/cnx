/**
 * 1.2 Parse over the run's cnx files (#1991): each file 1.1 discovered, as
 * plain syntax. The tree is a local of `SourceSyntax.of` and never leaves 1.2.
 */
import type ISourceGraph from "../1-Discover/types/ISourceGraph";
import type ITranspileError from "../../types/ITranspileError";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import invariant from "../../utils/invariant";
import HeaderParser from "./HeaderParser";
import SourceSyntax from "./SourceSyntax";
import type IParsedRecovery from "./types/IParsedRecovery";
import type TParsedHeaderEntry from "./types/TParsedHeaderEntry";
import TargetCatalogParser from "./TargetCatalogParser";
import HeaderReading from "./HeaderReading";
import type IHeaderServices from "./types/IHeaderServices";
import type IReadHeaders from "./types/IReadHeaders";
import RunTarget from "./RunTarget";
import TargetDescriptions from "./TargetDescriptions";
import type TRunTarget from "../../types/TRunTarget";
import type IParsedSource from "./types/IParsedSource";
import type IParsedSources from "./types/IParsedSources";

class Parse {
  /**
   * Each file that parsed cleanly, every other file's errors, the run's
   * target, its headers read with that target's compiler (#1713), and the
   * run's facts that later passes read
   */
  static async sources(
    graph: Pick<
      ISourceGraph,
      | "cnxFiles"
      | "targetCatalog"
      | "headerFiles"
      | "headerTexts"
      | "headerIncludes"
      | "headerUnit"
      | "headerSearchPaths"
      | "includeSearchPaths"
      | "includes"
      | "outputs"
      | "anchor"
      | "run"
    >,
    services: IHeaderServices,
  ): Promise<IParsedSources> {
    const sources: IParsedSource[] = [];
    const errors: ITranspileError[] = [];
    for (const file of graph.cnxFiles) {
      const syntax = SourceSyntax.of(file.source);
      // #1445: 1.2 carries its own errors; this stamps the path the text
      // came from, the one fact 1.2 cannot know because it parses a string.
      const fileErrors = [...syntax.parseErrors, ...syntax.formErrors];
      if (fileErrors.length > 0) {
        errors.push(
          ...fileErrors.map((e) => ({ ...e, sourcePath: file.path })),
        );
      } else {
        sources.push({ file, syntax });
      }
    }
    const target = Parse._target(graph, sources);
    const headers = await HeaderReading.read(graph, target, services);
    const mode = headers.cppMode ? "cpp" : "c";
    return {
      headers: Parse._headers(headers),
      headerReaders: headers.readers,
      disputedHeaders: headers.disputed,
      recovered: Parse._recovered(headers.recovered),
      sources,
      errors: [...errors, ...headers.errors],
      target,
      discovery: {
        cppMode: headers.cppMode,
        anchor: graph.anchor,
        includes: graph.includes[mode],
        outputs: graph.outputs[mode],
        headerMacroDumps: headers.macroDumps,
        run: graph.run,
      },
    };
  }

  /**
   * #1713: ADR-049's one target, chosen here from the catalog and the
   * `#pragma` lines 1.2 parses, so each header can be read with its compiler
   */
  private static _target(
    graph: Pick<ISourceGraph, "targetCatalog" | "anchor" | "run">,
    sources: readonly IParsedSource[],
  ): TRunTarget {
    return RunTarget.resolve({
      // ADR-049's command-line rungs, which 1.1 returned with the run
      option: graph.run.target.option,
      pioEnv: graph.run.target.pioEnv,
      catalog: TargetDescriptions.catalog(
        TargetCatalogParser.parse(graph.targetCatalog.text),
        graph.targetCatalog.path,
      ),
      // ADR-049's build-system rung, read once by 1.1 (#1444, owner ruling 3)
      platformio: graph.anchor.platformio,
      files: sources.map(({ file, syntax }) => ({
        sourcePath: file.path,
        directives: syntax.targetDirectives,
      })),
    });
  }

  /** #1991: each header read, in its order: its cache record, or its syntax */
  private static _headers(read: IReadHeaders): TParsedHeaderEntry[] {
    return read.headerFiles.map((file): TParsedHeaderEntry => {
      const cached = read.cached.get(file.path);
      if (cached !== undefined) return { file, ...cached };
      const source = read.sources.get(file.path);
      invariant(
        source !== undefined,
        `1.2 settles the source of every header it resolves (missing ${file.path})`,
      );
      try {
        return {
          file,
          kind: "parsed",
          language: source.language,
          parsed: HeaderParser.parse(source),
        };
      } catch (error) {
        // #1319: 1.3 decides, in header order, whether it is a diagnostic
        return { file, kind: "failed", error };
      }
    });
  }

  /** Issue #985's slices, each parsed as its own language and as C */
  private static _recovered(
    recovered: IRecoveredDeclarations | null,
  ): IParsedRecovery | null {
    if (recovered === null) return null;
    return {
      slices: [...recovered.slices].map(([path, slice]) => ({
        path,
        parsed: HeaderParser.parse(slice),
        asC: HeaderParser.parseC(slice.text).syntax,
      })),
      macroNames: recovered.macroNames,
    };
  }
}

export default Parse;
