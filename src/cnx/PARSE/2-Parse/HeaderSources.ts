import { availableParallelism } from "node:os";
import { resolve } from "node:path";

import detectAssemblySyntax from "./detectAssemblySyntax";
import detectCppSyntax from "./detectCppSyntax";
import ExternalDeclarationOracle from "./preprocessor/ExternalDeclarationOracle";
import LineMarkers from "./preprocessor/LineMarkers";
import type IPreprocessOptions from "./preprocessor/types/IPreprocessOptions";
import type IHeaderPreprocessor from "./preprocessor/types/IHeaderPreprocessor";
import FileKinds from "../../utils/FileKinds";
import EFileType from "../1-Discover/types/EFileType";
import EHeaderLanguage from "../1-Discover/types/EHeaderLanguage";
import type IDiscoveredFile from "../1-Discover/types/IDiscoveredFile";
import type IHeaderSource from "../1-Discover/types/IHeaderSource";
import type IRecoveredDeclarations from "./types/IRecoveredDeclarations";
import type IRecoveredSlice from "./types/IRecoveredSlice";
import ConcurrencyLimit from "../../utils/ConcurrencyLimit";
import invariant from "../../utils/invariant";

type TPreprocessLimit = ReturnType<typeof ConcurrencyLimit.create>;

/** What settling a run's headers needs from the run. */
interface IHeaderSourceSettings {
  /** Each header's text, as 1.1 read it */
  readonly texts: ReadonlyMap<string, string>;
  readonly preprocessor: IHeaderPreprocessor;
  readonly defines: Readonly<Record<string, string | boolean>>;
}

/**
 * One header preprocessed on its own: settled, or the preprocessor's message
 * and the text it was read as, for #985's unit to settle.
 */
type TAlone =
  | {
      readonly source: IHeaderSource;
      readonly raw: string;
      /** The files that preprocessing opened from inside the header */
      readonly entered: ReadonlySet<string>;
      /** That preprocessing's output, with its line markers */
      readonly preprocessed: string;
    }
  | { readonly source: null; readonly raw: string; readonly error: string };

/**
 * Issue #985: the translation unit a run's C includes make -- each `.cnx`
 * file's, deduped in first-seen order -- and the path it is searched along.
 */
interface ITranslationUnit {
  readonly directives: readonly string[];
  readonly includePaths: readonly string[];
  /** The headers a `.cnx` file includes itself, by the path the walk resolved */
  readonly headers: ReadonlySet<string>;
  /**
   * #1755: a `<...>` include the walk found no file for, which only the
   * compiler's own search path finds, so the unit is read whole
   */
  readonly searchesSystemPath: boolean;
  /** Each `.cnx` file's own C includes, as its own compile reads them */
  readonly files: readonly IFileUnit[];
  /** The same, spelled for a C++ build */
  readonly cppFiles: readonly IFileUnit[];
  /** Whether the run is a C++ build, when the run says so */
  readonly cppRequired: boolean | undefined;
}

/** By real path; null when two files' compiles read the header differently */
type TReadings = ReadonlyMap<string, string | null>;

const NO_READINGS: TReadings = new Map();

/** One `.cnx` file's C includes and the path its compile searches */
interface IFileUnit {
  readonly directives: readonly string[];
  readonly includePaths: readonly string[];
}

/**
 * #1844: each header's text and language, settled once: in 1.2, with the
 * compiler of the run's target, since #1713.
 *
 * §1 gives 1.1 a file's kind. A header's language was judged in Stage 2
 * instead, twice and on two texts: a cold run judged the preprocessed text it
 * parsed, and a warm one, which parsed nothing, judged the raw text. So C++
 * inside an `#if` the preprocessor removed passed cold and failed warm
 * (#1851). It is judged here now, on the text a C compile meets (#1542,
 * owner ruling 4), and Stage 2 parses that same text.
 */
class HeaderSources {
  /**
   * #1817: a header's first preprocessor run depends on nothing but the
   * header, so they all start at once, at most `availableParallelism()` at a
   * time. Only a retry depends on other headers: every earlier one that
   * preprocessed cleanly, including one that did so only through its own
   * retry. So each header is handed the headers before it, and waits for them
   * only if it has to retry.
   *
   * A header that cannot be preprocessed even so is settled from its slice
   * of `unit` preprocessed whole (#985): that slice is the text a C compile
   * meets. So is one whose slice differs from its text alone: an earlier
   * include's `#define BIG` picked its `#ifdef BIG` branch, or its macro
   * wrote a declaration. Any header can read an earlier one's macros, so the
   * unit runs whenever a C header counts, and again as C++ (#211) whenever a
   * C++ header does. One the unit does not reach either is `unsettled`:
   * nothing judges a header on the text as written (owner ruling 6 of 2026-10-03, #1542).
   *
   * Only a header a C compile opens counts (owner ruling of 2026-10-07 on
   * #1914): one a `.cnx` file includes, or one a counted header's
   * preprocessing (or the unit's) opened. The walk also finds headers behind
   * an `#if` that is false; those get no language, no error and no source.
   * A file a counted header opened that the walk did not find (one a macro
   * names, or a system header) is judged on its own lines there, so the run
   * meets its C++ whether or not the unit runs.
   *
   * The preprocessor must be available: Discover rejects a run that includes
   * headers without one.
   *
   * @returns each settled header's source, by path, in `headers` order, then
   *   each opened file the walk did not find; the declarations `unit`
   *   recovered -- null unless a header needed them; each unsettled header,
   *   with the preprocessor's message; and, by resolved path, the files each
   *   header that settled alone opened -- the edges a C compile follows
   */
  static async settle(
    headers: readonly IDiscoveredFile[],
    searchPaths: ReadonlyMap<string, readonly string[]>,
    settings: IHeaderSourceSettings,
    unit: ITranslationUnit,
  ): Promise<{
    readonly sources: ReadonlyMap<string, IHeaderSource>;
    readonly recovered: IRecoveredDeclarations | null;
    readonly unsettled: ReadonlyMap<string, string>;
    readonly opened: ReadonlyMap<string, ReadonlySet<string>>;
  }> {
    invariant(
      headers.length === 0 || settings.preprocessor.isAvailable(),
      "1.2 rejects a run that includes headers when no preprocessor is available",
    );
    const limit = ConcurrencyLimit.create(availableParallelism());
    const settled: Promise<TAlone>[] = [];
    for (const file of headers) {
      const paths = searchPaths.get(file.path);
      invariant(
        paths !== undefined,
        `discovery records the search path of every header it resolves (missing ${file.path})`,
      );
      // A copy: the headers before this one. The live array would come to
      // hold this header too, and a retry would wait for itself.
      const earlier = headers.slice(0, settled.length);
      settled.push(
        HeaderSources._alone(file, paths, earlier, [...settled], {
          ...settings,
          limit,
        }),
      );
    }
    const alone = await Promise.all(settled);
    const index = new Map(headers.map((file, i) => [resolve(file.path), i]));
    const counted = new Set<number>();
    HeaderSources._count([...unit.headers], index, alone, counted);
    const recovers =
      unit.searchesSystemPath ||
      [...counted].some((i) => alone[i].source === null);
    // #1723: the unit holds every file's C includes, so it is searched
    // along every file's search path, not --include alone.
    const unitOptions = {
      includePaths: [...unit.includePaths],
      defines: { ...settings.defines },
    };
    const counts = (cpp: boolean): boolean =>
      [...counted].some(
        (i) => (headers[i].type === EFileType.CppHeader) === cpp,
      );
    // #985: the whole unit only recovers what no header alone settles
    const recovery = recovers
      ? await ExternalDeclarationOracle.recover(
          unit.directives,
          settings.preprocessor,
          unitOptions,
        )
      : null;
    const slices = HeaderSources._resolvedKeys(
      recovery?.perFileContent ?? null,
    );
    HeaderSources._count(slices.keys(), index, alone, counted);
    const realOf = new Map(
      headers.map((file) => [
        resolve(file.path),
        file.realPath ?? resolve(file.path),
      ]),
    );
    const read = { settings, limit, realOf, index, alone, counted };
    const cReadings = counts(false)
      ? await HeaderSources._readings(unit.files, false, read)
      : NO_READINGS;
    const cppBuild =
      unit.cppRequired ??
      [...counted].some(
        (i) =>
          headers[i].type === EFileType.CppHeader ||
          alone[i].source?.language === EHeaderLanguage.Cpp,
      );
    // A C++ header is read as C++ (#211), and so is every header a C++
    // build's compile meets: which declarations it gets is the text g++ reads
    const cppReadings =
      counts(true) || (cppBuild && counts(false))
        ? await HeaderSources._readings(unit.cppFiles, true, read)
        : NO_READINGS;
    const keyOf = (file: IDiscoveredFile): string =>
      realOf.get(resolve(file.path)) ?? resolve(file.path);
    const cppOf = (file: IDiscoveredFile): boolean =>
      file.type === EFileType.CppHeader || cppBuild;
    const readingsOf = (file: IDiscoveredFile): TReadings =>
      cppOf(file) ? cppReadings : cReadings;
    // A header whose unit reading differs from its own, or that has none
    const fromUnit = headers.flatMap((file, i) => {
      if (!counted.has(i)) return [];
      const header = alone[i];
      const met = readingsOf(file).get(keyOf(file)) ?? undefined;
      if (header.source === null) {
        const slice = met ?? slices.get(resolve(file.path));
        return slice === undefined ? [] : [{ i, slice }];
      }
      return met === undefined ||
        HeaderSources._sameText(
          met,
          LineMarkers.ownText(header.preprocessed, file.path) ?? "",
        )
        ? []
        : [{ i, slice: met }];
    });
    const sources = new Map<string, IHeaderSource>();
    const unsettled = new Map<string, string>();
    const sliced = new Map(fromUnit.map((entry) => [entry.i, entry.slice]));
    headers.forEach((file, i) => {
      if (!counted.has(i)) return;
      const header = alone[i];
      const slice = sliced.get(i);
      if (slice === undefined) {
        if (header.source === null) unsettled.set(file.path, header.error);
        else sources.set(file.path, header.source);
        return;
      }
      // #1542 ruling 4: a header's language is judged on the text C meets
      const judged = cReadings.get(keyOf(file)) ?? slice;
      sources.set(
        file.path,
        HeaderSources._sourceOf(file, {
          raw: header.raw,
          // #985: a unit slice exists only expanded, as C reads it
          unexpanded: null,
          preprocessed: slice,
          own: judged,
        }),
      );
    });
    const opened = new Map<string, ReadonlySet<string>>();
    headers.forEach((file, i) => {
      const header = alone[i];
      if (!counted.has(i) || header.source === null) return;
      opened.set(resolve(file.path), header.entered);
      HeaderSources._judgeOpenedOnly(header, index, sources);
    });
    return {
      sources,
      recovered:
        recovery === null || !recovers
          ? null
          : HeaderSources._recovered(headers, sources, recovery),
      unsettled,
      opened,
    };
  }

  /**
   * The preprocessor names a header by the path it found it along; the walk,
   * by the one it resolved. Both name the same file, and two spellings of it
   * (`"dev.h"`, `"../lib/dev.h"`) are one file's lines.
   */
  private static _resolvedKeys(
    slices: ReadonlyMap<string, string> | null,
  ): ReadonlyMap<string, string> {
    const resolved = new Map<string, string>();
    for (const [path, text] of slices ?? []) {
      const key = resolve(path);
      const earlier = resolved.get(key);
      resolved.set(key, earlier === undefined ? text : `${earlier}\n${text}`);
    }
    return resolved;
  }

  /**
   * Each header's reading by the compile of every `.cnx` file that opens it,
   * by real path; null when two files' compiles read it differently, because
   * one includes a configuration the other does not. Every header a file's
   * compile opens is counted.
   */
  private static async _readings(
    files: readonly IFileUnit[],
    cpp: boolean,
    read: {
      readonly settings: IHeaderSourceSettings;
      readonly limit: TPreprocessLimit;
      readonly realOf: ReadonlyMap<string, string>;
      readonly index: ReadonlyMap<string, number>;
      readonly alone: readonly TAlone[];
      readonly counted: Set<number>;
    },
  ): Promise<TReadings> {
    const distinct = new Map(
      files.map((file) => [JSON.stringify(file), file] as const),
    );
    const perFile = await Promise.all(
      [...distinct.values()].map((file) =>
        read.limit(() =>
          ExternalDeclarationOracle.slices(
            file.directives,
            read.settings.preprocessor,
            {
              includePaths: [...file.includePaths],
              defines: { ...read.settings.defines },
            },
            cpp,
          ),
        ),
      ),
    );
    const readings = new Map<string, string | null>();
    for (const slices of perFile) {
      const resolved = HeaderSources._resolvedKeys(slices);
      HeaderSources._count(
        resolved.keys(),
        read.index,
        read.alone,
        read.counted,
      );
      const own = new Map<string, string>();
      for (const [path, text] of resolved) {
        const key = read.realOf.get(path) ?? path;
        const earlier = own.get(key);
        own.set(key, earlier === undefined ? text : `${earlier}\n${text}`);
      }
      for (const [key, text] of own) {
        const earlier = readings.get(key);
        if (earlier === undefined) readings.set(key, text);
        else if (earlier !== null && !HeaderSources._sameText(earlier, text)) {
          readings.set(key, null);
        }
      }
    }
    return readings;
  }

  /** Whether two preprocessed texts hold the same tokens */
  private static _sameText(a: string, b: string): boolean {
    return a.replace(/\s+/g, "") === b.replace(/\s+/g, "");
  }

  /**
   * Each file `header`'s preprocessing opened that the walk did not find, and
   * nothing has judged yet, judged on its own lines there.
   */
  private static _judgeOpenedOnly(
    header: {
      readonly entered: ReadonlySet<string>;
      readonly preprocessed: string;
    },
    index: ReadonlyMap<string, number>,
    sources: Map<string, IHeaderSource>,
  ): void {
    const openedOnly = [...header.entered].filter(
      (path) => !index.has(path) && !sources.has(path),
    );
    if (openedOnly.length === 0) return;
    const own = LineMarkers.byFile(header.preprocessed);
    for (const path of openedOnly) {
      const text = own.get(path) ?? "";
      sources.set(
        path,
        Object.freeze({
          text,
          language: HeaderSources._languageOf(FileKinds.of(path), text),
        }),
      );
    }
  }

  /**
   * Adds to `counted` each header in `paths`, and each one a counted header's
   * preprocessing opened, by its index in `headers`.
   */
  private static _count(
    paths: Iterable<string>,
    index: ReadonlyMap<string, number>,
    alone: readonly TAlone[],
    counted: Set<number>,
  ): void {
    const pending = [...paths];
    for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
      const i = index.get(resolve(path));
      if (i === undefined || counted.has(i)) continue;
      counted.add(i);
      const header = alone[i];
      if (header.source !== null) pending.push(...header.entered);
    }
  }

  /**
   * A slice of a header the walk reached takes that header's language: one
   * judgement per header. Any other is one the toolchain found on its own
   * path, and is judged on its slice.
   */
  private static _recovered(
    headers: readonly IDiscoveredFile[],
    sources: ReadonlyMap<string, IHeaderSource>,
    recovery: {
      perFileContent: ReadonlyMap<string, string>;
      macroNames: ReadonlySet<string>;
      directiveOf: ReadonlyMap<string, string>;
    },
  ): IRecoveredDeclarations {
    const reached = new Map(
      headers.map((file) => [resolve(file.path), sources.get(file.path)]),
    );
    const slices = new Map<string, IRecoveredSlice>();
    for (const [path, text] of recovery.perFileContent) {
      const language =
        reached.get(resolve(path))?.language ??
        HeaderSources._languageOf(FileKinds.of(path), text);
      slices.set(
        path,
        Object.freeze({
          text,
          language,
          directive: recovery.directiveOf.get(path) ?? null,
        }),
      );
    }
    return Object.freeze({ slices, macroNames: recovery.macroNames });
  }

  /**
   * One header preprocessed on its own, and again with the macros of the
   * headers before it if it must (#1817).
   */
  private static async _alone(
    file: IDiscoveredFile,
    searchPaths: readonly string[],
    earlierFiles: readonly IDiscoveredFile[],
    earlier: readonly Promise<TAlone>[],
    settings: IHeaderSourceSettings & { readonly limit: TPreprocessLimit },
  ): Promise<TAlone> {
    const raw = settings.texts.get(file.path);
    invariant(
      raw !== undefined,
      `1.1 reads the text of every header it resolves (missing ${file.path})`,
    );
    // #1723: along the path this header was found on, so a header that
    // includes a sibling library's header preprocesses as it resolved. Its
    // line markers say which lines are the header's own.
    const options = {
      defines: { ...settings.defines },
      includePaths: [...searchPaths],
      keepLineDirectives: true,
      asIncluded: true,
    };
    const result = await settings.limit(() =>
      settings.preprocessor.preprocess(file.path, options),
    );
    if (result.success) {
      return HeaderSources._settled(
        file,
        raw,
        result.content,
        await HeaderSources._directives(file, options, settings),
      );
    }

    // Some headers cannot be preprocessed standalone: they require a
    // predecessor to have run first (e.g. FreeRTOS task.h needs FreeRTOS.h to
    // define INC_FREERTOS_H and its attribute macros, and enforces this with
    // its own #error). Retry importing the macros of the headers before this
    // one (only those that themselves preprocessed cleanly, so one
    // unpreprocessable predecessor can't defeat the retry). #1817: the only
    // step that waits on other headers.
    const before = await Promise.all(earlier);
    const imacros = earlierFiles
      .filter((_, i) => before[i].source !== null)
      .map((header) => header.path);
    if (imacros.length > 0) {
      const retry = await settings.limit(() =>
        settings.preprocessor.preprocess(file.path, { ...options, imacros }),
      );
      if (retry.success) {
        return HeaderSources._settled(
          file,
          raw,
          retry.content,
          await HeaderSources._directives(
            file,
            { ...options, imacros },
            settings,
          ),
        );
      }
    }
    return {
      source: null,
      raw,
      error: result.diagnostics?.trim() || (result.error ?? "unknown error"),
    };
  }

  /**
   * #2096: the header's own lines with its conditionals evaluated and no
   * macro expanded, each on its own line; null when that compile fails
   */
  private static async _directives(
    file: IDiscoveredFile,
    options: IPreprocessOptions,
    settings: IHeaderSourceSettings & { readonly limit: TPreprocessLimit },
  ): Promise<string | null> {
    const result = await settings.limit(() =>
      settings.preprocessor.preprocess(file.path, {
        ...options,
        directivesOnly: true,
      }),
    );
    return result.success
      ? LineMarkers.ownLinesInPlace(result.content, file.path)
      : null;
  }

  private static _settled(
    file: IDiscoveredFile,
    raw: string,
    preprocessed: string,
    directives: string | null,
  ): TAlone {
    const own = LineMarkers.ownText(preprocessed, file.path);
    invariant(
      own !== null,
      `a header's preprocessed text holds its own lines (${file.path})`,
    );
    return {
      source: HeaderSources._sourceOf(file, {
        raw,
        unexpanded: directives,
        preprocessed: LineMarkers.strip(preprocessed),
        own,
      }),
      raw,
      entered: LineMarkers.entered(preprocessed, file.path),
      preprocessed,
    };
  }

  /**
   * #1852: the language is judged on the header's own lines as a C compile
   * meets them, so C++ under `#ifdef __cplusplus` is gone and C++ a macro
   * writes is there. Issue #945: the text parsed is the preprocessed one only
   * when the header's `#if`s need an expression evaluated, to avoid the side
   * effects of full expansion. Otherwise it is the header with its
   * conditionals evaluated and nothing expanded (#2096: the parser does not
   * skip an `#if 0` or `#ifdef` branch itself), or the preprocessed text when
   * that compile failed.
   */
  private static _sourceOf(
    file: IDiscoveredFile,
    text: {
      readonly raw: string;
      readonly unexpanded: string | null;
      readonly preprocessed: string;
      readonly own: string;
    },
  ): IHeaderSource {
    return Object.freeze({
      text: HeaderSources._needsConditionalPreprocessing(text.raw)
        ? text.preprocessed
        : (text.unexpanded ?? text.preprocessed),
      language: HeaderSources._languageOf(file.type, text.own),
    });
  }

  /**
   * Whether a header's `#if`s need the preprocessor to evaluate an
   * expression. Issue #945.
   *
   * Needed: `#if MACRO != 0`, `#if MACRO == 1`, `#if MACRO > 0`, a bare
   * `#if MACRO`, `#elif MACRO != 0`, `#if defined(X) && MACRO`, ...
   *
   * Handled by the parser without it: `#ifdef MACRO`, `#ifndef MACRO`,
   * `#if defined(MACRO)`, `#if 1`, `#if 0`.
   */
  private static _needsConditionalPreprocessing(content: string): boolean {
    const ifExpressionPattern =
      /#(?:if|elif)\s+(?!defined\s*\()(?![01]\s*(?:$|\n|\/\*|\/\/))\w+/m;
    return ifExpressionPattern.test(content);
  }

  /**
   * The language `text` is written in. Issue #211: a C++ header extension is
   * always C++. Assembler headers (e.g. xtensa coreasm.h, pulled in
   * transitively by FreeRTOS port headers) are not C: their `.macro` bodies
   * parsed as C gave instruction mnemonics like `loop` as C symbols.
   */
  private static _languageOf(type: EFileType, text: string): EHeaderLanguage {
    if (type === EFileType.CppHeader) return EHeaderLanguage.Cpp;
    if (detectAssemblySyntax(text)) return EHeaderLanguage.Assembler;
    if (detectCppSyntax(text)) return EHeaderLanguage.Cpp;
    return EHeaderLanguage.C;
  }
}

export default HeaderSources;
