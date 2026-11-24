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
   * include's `#define BIG` picked its `#ifdef BIG` branch. The unit runs to
   * find out whenever a counted header has a conditional. One the unit does not reach either is `unsettled`: nothing judges
   * a header on the text as written (owner ruling 6 of 2026-10-03, #1542).
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
    const recovery =
      recovers ||
      [...counted].some((i) => HeaderSources._hasConditional(alone[i].raw))
        ? await ExternalDeclarationOracle.recover(
            unit.directives,
            settings.preprocessor,
            {
              // #1723: the unit holds every file's C includes, so it is searched
              // along every file's search path, not --include alone.
              includePaths: [...unit.includePaths],
              defines: { ...settings.defines },
            },
          )
        : null;
    // The preprocessor names a header by the path it found it along; the
    // walk, by the one it resolved. Both name the same file.
    const slices = new Map<string, string>();
    for (const [path, text] of recovery?.perFileContent ?? []) {
      slices.set(resolve(path), text);
    }
    HeaderSources._count(slices.keys(), index, alone, counted);
    const sources = new Map<string, IHeaderSource>();
    const unsettled = new Map<string, string>();
    headers.forEach((file, i) => {
      if (!counted.has(i)) return;
      const header = alone[i];
      const slice = slices.get(resolve(file.path));
      if (header.source !== null) {
        sources.set(
          file.path,
          // The unit is read as C; a C++ header alone, as C++ (#211)
          slice === undefined ||
            file.type === EFileType.CppHeader ||
            HeaderSources._sameText(
              slice,
              LineMarkers.ownText(header.preprocessed, file.path) ?? "",
            )
            ? header.source
            : Object.freeze({
                text: slice,
                language: HeaderSources._languageOf(file.type, slice),
              }),
        );
        return;
      }
      if (slice === undefined) {
        unsettled.set(file.path, header.error);
        return;
      }
      sources.set(
        file.path,
        HeaderSources._sourceOf(file, {
          raw: header.raw,
          unexpanded: header.raw,
          preprocessed: slice,
          own: slice,
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

  /** Whether a header has an `#if`, `#ifdef`, `#ifndef` or `#elif` */
  private static _hasConditional(raw: string): boolean {
    return /^[ \t]*#[ \t]*(?:el)?if/m.test(raw);
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
