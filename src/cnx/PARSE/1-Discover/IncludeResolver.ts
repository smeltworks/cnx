import { dirname, resolve } from "node:path";

import CnxMarkerDetector from "./CnxMarkerDetector";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import IncludeDiscovery from "./IncludeDiscovery";
import IncludeRewriter from "../../utils/IncludeRewriter";
import CnxSourcePath from "../../utils/CnxSourcePath";
import IncludePath from "../../utils/IncludePath";
import FileDiscovery from "./FileDiscovery";
import type THeaderExtension from "../../types/THeaderExtension";
import IDiscoveredFile from "./types/IDiscoveredFile";
import type IHeaderRoot from "./types/IHeaderRoot";
import EFileType from "./types/EFileType";
import DependencyGraph from "./DependencyGraph";
import IFileSystem from "../../types/IFileSystem";

/**
 * The header extensions ADR-010 admits, and the cnx source each names:
 * E0504 asks whether `ext.cnx` is where an include of `ext.h` would find it.
 */
const ADMITTED_HEADER = /\.(h|hpp)$/i;

/**
 * Result of resolving includes from source content
 */
interface IResolvedIncludes {
  /** C/C++ headers to parse for symbol collection */
  headers: IDiscoveredFile[];

  /** cnx files to parse for symbol collection */
  cnxIncludes: IDiscoveredFile[];

  /** Warnings for unresolved local includes */
  warnings: string[];

  /**
   * Whether any include brings in names this transpiler cannot see -- a C/C++
   * header, or an include that resolved to nothing and does not name cnx
   * source (an unresolved `<system.h>` is silently ignored, and its names still
   * exist at compile time; an unresolved `.cnx` supplies no C or C++ names).
   *
   * #1399 review: consumed by the E0426/E0427 precondition. Recorded HERE
   * because this class already decides what each directive IS; the analyzer's
   * own attempt re-derived it from `#include` token text, became a third
   * spelling of "is this a cnx include?", and was the one that disagreed
   * with this class. `headers` alone cannot answer it -- `<stdio.h>` resolves to
   * nothing on most systems and so appears in no list at all, which is exactly
   * how `FILE` slipped through.
   */
  hasForeignInclude: boolean;

  /**
   * #1672: the file every directive this resolver read resolved to, or null,
   * keyed by `IncludeDirectiveText.join`. 2.1's E0506 reads it rather
   * than resolving the include a second time.
   */
  resolutions: Map<string, string | null>;

  /**
   * #1672: for each include of a header ADR-010 admits whose cnx source
   * the same form of include would find, that source's spelling (`ext.cnx`
   * for `ext.h`), keyed like `resolutions`. 2.1's E0504 reads it.
   */
  cnxAlternatives: Map<string, string>;

  /**
   * The kind of file each directive's spelling names, by its extension, keyed
   * like `resolutions` (#1444, owner ruling 1). The one classification of an
   * include: 2.1's ADR-010 rules and render read it, and neither classifies a
   * spelling itself. A directive 1.2 parsed always has an entry.
   */
  kinds: Map<string, EFileType>;

  /**
   * The file's other includes -- every directive that does not name cnx
   * source -- exactly as written, in source order.
   *
   * Issue #424: a macro from one of these can appear inside a generated
   * declaration -- `u32[DEVICE_COUNT] devices` becomes
   * `extern uint32_t devices[DEVICE_COUNT]`. Such a header only compiles for a
   * translation unit that already included the macro's source, so when the
   * generated header names a macro it must carry the include itself. Kept apart
   * from `userIncludes` because it is added conditionally: propagating every C
   * include into every header would put implementation-only dependencies into
   * the public interface. Issue #985's translation-unit recovery reads it too.
   */
  cHeaderIncludes: string[];
  cHeaderSpecs: string[];
  cHeaderPaths: Set<string>;

  /**
   * #1844: every file this resolver categorized, in the order it met them.
   * `spell` names each one's header once the run's mode is settled: a `.cnx`
   * include's spelling depends on the generated header's extension, and 1.1
   * knows that only after it has judged every header the run reaches.
   */
  included: IResolvedInclude[];

  /** #1844: the directives that name cnx source, in source order. */
  cnxDirectives: string[];

  /**
   * #1844: where each directive sits in the file, keyed like `resolutions`.
   * E0507 is reported at the one that reached a C++ header.
   */
  positions: Map<string, { line: number; column: number }>;
}

/** #1844: one file an include resolved to, before its header is spelled. */
interface IResolvedInclude {
  readonly absolutePath: string;
  readonly includeInfo: { readonly path: string; readonly isLocal: boolean };
  readonly isCnx: boolean;
  /** #1725: a quoted include found beside the file that wrote it */
  readonly besideWriter: boolean;
}

/**
 * #2272/#1473: the generated file a file's includes are spelled for -- its
 * `.h` or its `.c` -- and where the header for each `.cnx` is written.
 */
interface IIncludeWriter {
  /** The directory the generated file is written to */
  readonly directory: string;
  readonly headerPathFor: (cnxPath: string) => string;
}

/**
 * How a file spells the headers it includes, given the run's generated-header
 * extension (#1844: spelled after 1.1 settles the run's mode).
 */
interface IIncludeSpelling {
  /**
   * Issue #497: Map from resolved header path to original include directive.
   * Used to include C headers (instead of forward declarations) when their
   * types are used in public interfaces.
   * Example: "/abs/path/data-types.h" => '#include "data-types.h"'
   */
  headerIncludeDirectives: Map<string, string>;

  /**
   * Issue #1467: for each `.cnx` include, the author's spelling mapped to the
   * path the generated header is actually reachable at, relative to the header
   * output root -- e.g. `"utils.cnx"` => `"Display/utils.h"`. #2272/#1746: or
   * relative to the generated file, for a quoted include found beside the
   * `.cnx` -- a C header's own path then, e.g. `"dev.h"` => `"../../src/dev.h"`.
   *
   * Recorded here because this class is where an include's spelling and its
   * RESOLVED file are both in hand; every consumer downstream has one or the
   * other. The value comes from the owner injected as `headerIncludePathFor`,
   * never from the spelling: those were derived independently in three places,
   * and agreed only because all three copied what the author typed.
   */
  includeRewrites: Map<string, string>;

  /**
   * #1725: for each quoted include that resolved beside the file that wrote
   * it -- so its spelling is relative to that file -- the absolute file the
   * spelling names: the header, or for a `.cnx` the header generated for it:
   * where 1.1 writes it (#2272), or, with no writer known, beside the `.cnx`
   * when the output root does not reach it. Keyed like
   * `headerIncludeDirectives`.
   *
   * Another file that needs the same header spells it relative to ITSELF from
   * this. Copying the spelling gave `src/main.h` lib/a.cnx's `"dev.h"`, which
   * names `src/dev.h` from there. A spelling that resolved along the search
   * path is not recorded: it is valid wherever that path is, and re-spelling it
   * relative to a file would climb into an SDK or a library directory.
   */
  writerRelativeIncludes: Map<string, string>;

  /**
   * The file's other includes, as its generated file names them, in source
   * order: a quoted C header found beside the `.cnx` is named from where that
   * file is written (#1746), and any other directive is kept as written.
   */
  cHeaderIncludes: string[];

  /**
   * The file's `.cnx` includes, each rendered as the include its generated
   * header carries: the author's directive with its path replaced by the
   * header `includeRewrites` names, or by the extension swap when it
   * names none (#1467). In source order, the author's spacing and form kept.
   *
   * Issue #589 / #941: these define types used in function signatures, so the
   * generated header needs them. #1444: derived here, from the tokens this
   * resolver lexes, rather than from 1.2's tree in Stage 5.
   */
  userIncludes: string[];
}

/**
 * Unified include resolution for the cnx Pipeline
 *
 * This class encapsulates the complete include resolution workflow,
 * used by the unified `transpile()` entry point for both file and source modes.
 *
 * Key responsibilities:
 * - Extract #include directives from source content
 * - Resolve include paths using search directories
 * - Categorize resolved files into headers vs cnx includes
 * - Track warnings for unresolved local includes
 * - Deduplicate resolved files by path
 *
 * @example
 * const resolver = new IncludeResolver(['/path/to/includes'], fs, '/path/to/src');
 * const result = resolver.resolve('#include "header.h"');
 * // result.headers contains resolved header files
 */
class IncludeResolver {
  private readonly resolvedPaths: Set<string> = new Set();
  private readonly fs: IFileSystem;

  /**
   * #1725: the directory a quoted include from the file being resolved
   * resolves beside (ADR-010). Required since #1835's review: its `null`
   * default served only tests, and with no directory a quoted cnx include
   * was searched like any other -- a second rule beside #1672's one.
   */
  private readonly quotedIncludeDirectory: string;

  /**
   * @param quotedIncludeDirectory #1725: see the field above.
   */
  constructor(
    private readonly searchPaths: string[],
    fs: IFileSystem,
    quotedIncludeDirectory: string,
  ) {
    this.fs = fs;
    this.quotedIncludeDirectory = quotedIncludeDirectory;
  }

  /**
   * Extract includes from source content and resolve them to files
   *
   * @param content - A `.cnx` file's content. Its directives are read as the
   *   grammar reads them (#1745), so C header text does not belong here.
   * @param sourceFilePath - Optional path to source file (for error messages)
   * @returns Resolved includes categorized by type, plus warnings
   */
  resolve(content: string, sourceFilePath?: string): IResolvedIncludes {
    const result: IResolvedIncludes = {
      headers: [],
      cnxIncludes: [],
      warnings: [],
      resolutions: new Map<string, string | null>(),
      cnxAlternatives: new Map<string, string>(),
      kinds: new Map<string, EFileType>(),
      cHeaderIncludes: [],
      cHeaderSpecs: [],
      cHeaderPaths: new Set(),
      hasForeignInclude: false,
      included: [],
      cnxDirectives: [],
      positions: new Map<string, { line: number; column: number }>(),
    };

    const located = IncludeDiscovery.directivesWithPositionsOf(content);
    const directives = located.map((directive) => directive.text);

    for (const { text, line, column } of located) {
      const includeInfo = IncludeDirectiveText.split(text);
      if (includeInfo !== null) {
        const key = IncludeDirectiveText.join(includeInfo);
        if (!result.positions.has(key)) {
          result.positions.set(key, { line, column });
        }
        this._processInclude(includeInfo, sourceFilePath, result);
      }
    }

    // After every directive is resolved, so each `.cnx` include's header is
    // known. Issue #1467 review: one predicate for "is this a cnx
    // include?" -- a substring test disagreed with the resolver. #1444:
    // and that predicate is the kind recorded above.
    for (const directive of directives) {
      if (IncludeRewriter.namesCnx(directive, result.kinds)) {
        result.cnxDirectives.push(directive);
      } else {
        result.cHeaderIncludes.push(directive);
        const spec = IncludeDirectiveText.spec(directive);
        if (spec !== null) result.cHeaderSpecs.push(spec);
        const path = result.resolutions.get(directive);
        if (path !== null && path !== undefined) {
          result.cHeaderPaths.add(resolve(path));
        }
      }
    }

    return result;
  }

  /**
   * #1844: how a resolved file spells its includes, in a run whose generated
   * headers take `headerExtension`. Kept apart from `resolve` because 1.1
   * learns the extension only after judging every header the run reaches,
   * and a `.cnx` include's spelling names a generated header.
   *
   * @param headerIncludePathFor Issue #1467: where the generated header for a
   *   `.cnx` is reachable, relative to the header output root. Null when the
   *   caller does not know (no PathResolver yet) or the header lands outside
   *   that root; the author's spelling is kept then, with its extension
   *   swapped, which is what every caller did before.
   * @param writer #2272/#1473: where the generated file carrying these
   *   includes is written, and where each `.cnx`'s header is. A quoted include
   *   found beside the `.cnx` that wrote it is spelled relative to that
   *   generated file, so it compiles with no `-I` and does not depend on which
   *   entry pulled the file in. Null when the caller does not know.
   */
  static spell(
    resolved: IResolvedIncludes,
    headerExtension: THeaderExtension,
    headerIncludePathFor: ((cnxPath: string) => string | null) | null,
    writer: IIncludeWriter | null = null,
  ): IIncludeSpelling {
    const spelling: IIncludeSpelling = {
      headerIncludeDirectives: new Map<string, string>(),
      includeRewrites: new Map<string, string>(),
      writerRelativeIncludes: new Map<string, string>(),
      cHeaderIncludes: [],
      userIncludes: [],
    };
    for (const include of resolved.included) {
      const { absolutePath, includeInfo, besideWriter } = include;
      if (!include.isCnx) {
        // Issue #497: the directive for this header. #1746: a quoted header
        // found beside the `.cnx` is named from where the generated file is
        // written, as a `.cnx`'s header is (#2272), so it needs no `-I`
        let path = includeInfo.path;
        if (besideWriter && writer !== null) {
          path = IncludePath.relative(writer.directory, absolutePath);
          spelling.includeRewrites.set(includeInfo.path, path);
        }
        spelling.headerIncludeDirectives.set(
          absolutePath,
          IncludeDirectiveText.join({ path, isLocal: includeInfo.isLocal }),
        );
        if (besideWriter) {
          spelling.writerRelativeIncludes.set(absolutePath, absolutePath);
        }
        continue;
      }
      // Issue #854: Track header directive for cnx includes so their types
      // can be mapped by ExternalTypeHeaderBuilder, preventing duplicate
      // forward declarations (MISRA Rule 5.6)
      // Issue #1467: ask the owner where the header is reachable. The
      // extension swap below is the fallback for a caller with no resolver
      // and for a header outside the output root -- not a second answer.
      let writerHeader: string | null = null;
      let reachable: string | null;
      if (besideWriter && writer !== null) {
        writerHeader = writer.headerPathFor(absolutePath);
        reachable = IncludePath.relative(writer.directory, writerHeader);
      } else {
        reachable = headerIncludePathFor?.(absolutePath) ?? null;
      }
      const headerPath =
        reachable ??
        CnxSourcePath.withExtension(includeInfo.path, headerExtension);
      spelling.headerIncludeDirectives.set(
        absolutePath,
        IncludeDirectiveText.join({
          path: headerPath,
          isLocal: includeInfo.isLocal,
        }),
      );
      spelling.includeRewrites.set(includeInfo.path, headerPath);
      // #1725: an output-root path is valid from every file. A spelling
      // relative to the writer is not, so another includer must spell the
      // header it names relative to itself: the header written for the `.cnx`
      // (#2272), or the one generated beside it when no writer is known.
      if (writerHeader !== null) {
        spelling.writerRelativeIncludes.set(absolutePath, writerHeader);
      } else if (reachable === null && besideWriter) {
        spelling.writerRelativeIncludes.set(
          absolutePath,
          CnxSourcePath.withExtension(absolutePath, headerExtension),
        );
      }
    }
    for (const directive of resolved.cHeaderIncludes) {
      spelling.cHeaderIncludes.push(
        IncludeRewriter.rewrite(
          directive,
          resolved.kinds,
          spelling.includeRewrites,
          headerExtension,
        ),
      );
    }
    for (const directive of resolved.cnxDirectives) {
      spelling.userIncludes.push(
        IncludeRewriter.rewrite(
          directive,
          resolved.kinds,
          spelling.includeRewrites,
          headerExtension,
        ),
      );
    }
    return spelling;
  }

  /**
   * Process a single include directive
   */
  private _processInclude(
    includeInfo: { path: string; isLocal: boolean },
    sourceFilePath: string | undefined,
    result: IResolvedIncludes,
  ): void {
    const resolved = this._resolveSpelling(includeInfo);
    const directive = IncludeDirectiveText.join(includeInfo);
    result.resolutions.set(directive, resolved);
    result.kinds.set(
      directive,
      FileDiscovery.classifyFile(includeInfo.path).type,
    );
    const alternative = this._cnxAlternativeOf(includeInfo);
    if (alternative !== null) {
      result.cnxAlternatives.set(directive, alternative);
    }

    if (!resolved) {
      this._handleUnresolvedInclude(includeInfo, sourceFilePath, result);
      return;
    }

    this._handleResolvedInclude(resolved, includeInfo, result);
  }

  /** Where an include resolves from this file, by the one rule (#1672). */
  private _resolveSpelling(includeInfo: {
    path: string;
    isLocal: boolean;
  }): string | null {
    return IncludeDiscovery.resolveSpelling(
      includeInfo,
      this.quotedIncludeDirectory,
      this.searchPaths,
      this.fs,
    );
  }

  /**
   * For an include of a header ADR-010 admits, the cnx source spelling
   * when the same form of include would find it -- E0504's question, which
   * 2.1 reads rather than asks (#1672).
   */
  private _cnxAlternativeOf(includeInfo: {
    path: string;
    isLocal: boolean;
  }): string | null {
    if (!ADMITTED_HEADER.test(includeInfo.path)) return null;
    const spelling = includeInfo.path.replace(ADMITTED_HEADER, ".cnx");
    const found = this._resolveSpelling({
      path: spelling,
      isLocal: includeInfo.isLocal,
    });
    return found === null ? null : spelling;
  }

  /**
   * Handle a resolved include path
   */
  private _handleResolvedInclude(
    resolved: string,
    includeInfo: { path: string; isLocal: boolean },
    result: IResolvedIncludes,
  ): void {
    const absolutePath = resolve(resolved);

    // Deduplicate by absolute path
    if (this.resolvedPaths.has(absolutePath)) {
      return;
    }
    this.resolvedPaths.add(absolutePath);

    const file = FileDiscovery.discoverFile(resolved, this.fs);
    if (!file) return;

    this._categorizeFile(file, absolutePath, includeInfo, result);
  }

  /**
   * Categorize a discovered file into headers or cnx includes
   */
  private _categorizeFile(
    file: IDiscoveredFile,
    absolutePath: string,
    includeInfo: { path: string; isLocal: boolean },
    result: IResolvedIncludes,
  ): void {
    if (file.type === EFileType.CHeader || file.type === EFileType.CppHeader) {
      result.headers.push(file);
      result.hasForeignInclude = true;
      result.included.push({
        absolutePath,
        includeInfo,
        isCnx: false,
        besideWriter: this._resolvedBesideWriter(includeInfo, absolutePath),
      });
      return;
    }

    if (file.type === EFileType.Cnx) {
      result.cnxIncludes.push(file);
      result.included.push({
        absolutePath,
        includeInfo,
        isCnx: true,
        besideWriter: this._resolvedBesideWriter(includeInfo, absolutePath),
      });
    }
  }

  /**
   * #1725: is this a quoted include whose spelling is relative to the file
   * that wrote it -- found beside that file, not along the search path?
   */
  private _resolvedBesideWriter(
    includeInfo: { path: string; isLocal: boolean },
    absolutePath: string,
  ): boolean {
    return (
      includeInfo.isLocal &&
      resolve(this.quotedIncludeDirectory, includeInfo.path) === absolutePath
    );
  }

  /**
   * Handle an unresolved include (warn for local includes only)
   */
  private _handleUnresolvedInclude(
    includeInfo: { path: string; isLocal: boolean },
    sourceFilePath: string | undefined,
    result: IResolvedIncludes,
  ): void {
    // An include that resolved to nothing still supplies names at compile
    // time -- unless it names cnx source, which is not a C or C++ header
    // (ADR-030) whether it is found or not. #1435 made reaching a header
    // transitive, so counting a missing `.cnx` switched E0426 off for every
    // file that reached this one.
    if (FileDiscovery.classifyFile(includeInfo.path).type !== EFileType.Cnx) {
      result.hasForeignInclude = true;
    }

    const warnings = result.warnings;

    // System includes (<...>) that aren't found are silently ignored
    if (!includeInfo.isLocal) return;

    const fromFile = sourceFilePath ? ` (from ${sourceFilePath})` : "";
    warnings.push(
      `#include "${includeInfo.path}" not found${fromFile}. ` +
        `Struct field types from this header will not be detected.`,
    );
  }

  /**
   * Check if a resolved include is a header file to process.
   */
  private static isProcessableHeader(file: IDiscoveredFile | null): boolean {
    return (
      file !== null &&
      (file.type === EFileType.CHeader || file.type === EFileType.CppHeader)
    );
  }

  /**
   * Read header content, returning null if not readable or if generated by cnx.
   */
  private static readHeaderContent(
    file: IDiscoveredFile,
    fs: IFileSystem,
    warnings: string[],
    onDebug?: (message: string) => void,
  ): string | null {
    let content: string;
    try {
      content = fs.readFile(file.path);
    } catch {
      warnings.push(`Could not read header ${file.path}`);
      return null;
    }

    // #1435: the marker is the only thing that identifies a generated header
    // now, so it is asked of the one detector rather than spelled again here.
    if (CnxMarkerDetector.isCnxGenerated(content)) {
      onDebug?.(`Skipping cnx generated header: ${file.path}`);
      return null;
    }

    return content;
  }

  /**
   * Issue #592: Recursively resolve all headers from a set of root headers.
   *
   * This method handles the recursive include graph traversal that was
   * previously in Transpiler.doCollectHeaderSymbols(). It:
   * - Discovers all nested #include directives
   * - Tracks visited paths to avoid cycles
   * - Returns headers in dependency order (dependencies first)
   * - Skips headers the transpiler generated (they carry its banner)
   *
   * #1723: each root is searched along its own path, and every header it
   * reaches inherits that path -- the one discovery built for the `.cnx` file
   * that included the root, discovered tiers and all. A single list of
   * `--include` directories for every header lost a libdeps header's include
   * of a sibling library, which a compiler with PlatformIO's -I path finds.
   *
   * @param roots - The headers to resolve from, each with its search path
   * @param options - Optional configuration
   * @returns All headers (root + nested) in dependency order, and the search
   *   path each was resolved along -- the -I list its preprocessing must use
   */
  static resolveHeadersTransitively(
    roots: ReadonlyArray<IHeaderRoot>,
    options: {
      /** Callback for debug logging */
      onDebug?: (message: string) => void;
      /** File system abstraction: the port the host injected */
      fs: IFileSystem;
    },
  ): {
    headers: IDiscoveredFile[];
    searchPaths: ReadonlyMap<string, readonly string[]>;
    /** #1844: per header, the headers it includes, as the walk resolved them */
    edges: ReadonlyMap<string, readonly string[]>;
    warnings: string[];
  } {
    const fs = options.fs;
    const visited = new Set<string>();
    const warnings: string[] = [];
    const depGraph = new DependencyGraph();
    const fileByPath = new Map<string, IDiscoveredFile>();
    const searchPathsByHeader = new Map<string, readonly string[]>();
    const edges = new Map<string, string[]>();

    const processHeader = (file: IDiscoveredFile, root: IHeaderRoot): void => {
      const rootSearchPaths = root.searchPaths;
      const absolutePath = resolve(file.path);

      if (visited.has(absolutePath)) return;
      visited.add(absolutePath);

      const content = IncludeResolver.readHeaderContent(
        file,
        fs,
        warnings,
        options.onDebug,
      );
      if (!content) return;

      depGraph.addFile(absolutePath);
      fileByPath.set(absolutePath, file);
      searchPathsByHeader.set(file.path, rootSearchPaths);
      const included: string[] = [];
      edges.set(file.path, included);

      const includes = IncludeDiscovery.directivesOf(file.path, content);
      const searchPaths = [dirname(absolutePath), ...rootSearchPaths];

      options.onDebug?.(`Processing includes in ${file.path}:`);
      options.onDebug?.(`  Search paths: ${searchPaths.join(", ")}`);

      for (const includeInfo of includes) {
        const resolved = IncludeDiscovery.resolveInclude(
          includeInfo.path,
          searchPaths,
          fs,
        );

        options.onDebug?.(
          `  #include "${includeInfo.path}" → ${resolved ?? "NOT FOUND"}`,
        );

        if (!resolved) {
          if (includeInfo.isLocal) {
            warnings.push(
              `#include "${includeInfo.path}" not found (from ${file.path}). ` +
                `Struct field types from this header will not be detected.`,
            );
          }
          continue;
        }

        const includedFile = FileDiscovery.discoverFile(resolved, fs);
        if (!IncludeResolver.isProcessableHeader(includedFile)) continue;

        const includedPath = resolve(includedFile!.path);
        depGraph.addDependency(absolutePath, includedPath);
        included.push(includedFile!.path);

        options.onDebug?.(`    → Recursively processing ${includedFile!.path}`);
        processHeader(includedFile!, root);
      }
    };

    for (const root of roots) {
      processHeader(root.file, root);
    }

    const sortedPaths = depGraph.getSortedFiles();
    warnings.push(...depGraph.getWarnings());

    const sortedHeaders: IDiscoveredFile[] = [];
    for (const path of sortedPaths) {
      const file = fileByPath.get(path);
      if (file) {
        sortedHeaders.push(file);
      }
    }

    return {
      headers: sortedHeaders,
      searchPaths: searchPathsByHeader,
      edges,
      warnings,
    };
  }

  /**
   * Build search paths from a source file location
   *
   * Consolidates the search path building logic used by the unified
   * transpile() entry point.
   *
   * Search order (highest to lowest priority):
   * 1. Source file's directory (for relative includes)
   * 2. Additional include directories (e.g., from --include flag, and the
   *    tiers `IncludeDiscovery.discoverIncludePaths` found)
   * 3. Config include directories
   *
   * #2165: this walked to the project root a second time and appended its
   * `include/`, `src/` and `lib/`, which the discovered tiers already carry
   * from the same walk; the dedupe dropped every one. The project tier is
   * `discoverIncludePaths`' alone.
   *
   * @param sourceDir - Directory containing the source file
   * @param includeDirs - Include directories from config
   * @param additionalIncludeDirs - Extra include directories (e.g., from API options)
   * @returns Array of search paths in priority order
   */
  static buildSearchPaths(
    sourceDir: string,
    includeDirs: readonly string[],
    additionalIncludeDirs: readonly string[],
  ): string[] {
    // Remove duplicates while preserving order
    return Array.from(
      new Set([sourceDir, ...additionalIncludeDirs, ...includeDirs]),
    );
  }
}

export default IncludeResolver;
