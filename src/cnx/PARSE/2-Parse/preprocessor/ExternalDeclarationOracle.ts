/**
 * ExternalDeclarationOracle — recover FULL external symbols (function signatures,
 * typedefs, opaque structs) from a set of C/C++ headers that cnx's normal,
 * per-header-standalone symbol collection could not resolve.
 *
 * Two things defeat standalone collection of framework headers:
 *  1. Include-order guards — FreeRTOS `task.h` opens with
 *     `#ifndef INC_FREERTOS_H / #error`, so it refuses to preprocess unless
 *     `FreeRTOS.h` ran first.
 *  2. The parser's twin failure modes on a single header:
 *     - RAW (unpreprocessed) text still contains function-attribute macros like
 *       FreeRTOS `PRIVILEGED_FUNCTION` (`void vTaskDelay(...) PRIVILEGED_FUNCTION;`)
 *       — the trailing token breaks the declaration, so `vTaskDelay` is lost.
 *     - FULLY preprocessed text inlines the header's entire transitive tree
 *       (e.g. `driver/twai.h` -> ~100KB of xtensa HAL); ANTLR error-recovery then
 *       skips tokens in the blob and silently drops later declarations.
 *
 * The fix is to preprocess the include set AS A TRANSLATION UNIT (predecessors
 * first) while KEEPING `#line` directives, then bucket the output BY SOURCE FILE.
 * Each header's own slice is macro-expanded (PRIVILEGED_FUNCTION is gone) yet
 * small (no inlined tree), so parsing it robustly yields full signatures. The
 * caller parses each slice with cnx's real header parser, so recovered symbols
 * carry their full types — codegen needs these to pass structs by address
 * (`twai_driver_install(&cfg)`) and treat opaque types as pointers
 * (`lv_obj_t` -> `lv_obj_t *`).
 *
 * Function-like macros (e.g. `pdMS_TO_TICKS`) have no declaration to parse, so
 * their NAMES are collected separately (`-dM`) for the undeclared-call check
 * only — a by-value macro invocation is already correct.
 *
 * Requires a toolchain that can preprocess the target's headers; for cross
 * targets (ESP32/xtensa) set CNX_CROSS_COMPILER.
 */
import { resolve } from "node:path";

import type IHeaderPreprocessor from "./types/IHeaderPreprocessor";
import STDIN_MARKER from "./STDIN_MARKER";
import RegExpUtils from "../../../utils/RegExpUtils";
import IPreprocessOptions from "./types/IPreprocessOptions";

// Function-like macro definitions from a `-dM` dump: `#define pdMS_TO_TICKS(`.
const FUNCTION_MACRO = /^#define\s+([A-Za-z_]\w*)\(/gm;
// gcc/clang line marker: `# 958 "/path/to/task.h" 2`.
const LINE_MARKER = /^#\s+(\d+)\s+"([^"]+)"(.*)$/;
// Synthetic TU filename (appears in preprocessor errors, keyed on to locate a
// failing include by its line number).
const TU_NAME = "cnx-external-decl-oracle.c";
/** #1881: a `-dD` dump's `#define NAME ...` or `#undef NAME` */
const DEFINE_OR_UNDEF = /^#(define|undef)\s+([A-Za-z_]\w*)/;

interface IExternalRecovery {
  /**
   * Map of source header path -> that header's OWN preprocessed text (its
   * macro-expanded declarations, without the transitively-inlined tree). Parse
   * each with the real header parser to register full external symbols.
   */
  perFileContent: Map<string, string>;
  /** Names of function-like macros — no declaration exists to parse. */
  macroNames: Set<string>;
  /**
   * #1844: per header, the unit's include through which the compile entered
   * it. E0507 is reported at the `.cnx` include that wrote it.
   */
  directiveOf: Map<string, string>;
}

class ExternalDeclarationOracle {
  /**
   * Preprocess `includeDirectives` (e.g. `"<freertos/task.h>"`) as one TU and
   * return each header's own preprocessed slice plus function-like-macro names.
   *
   * @param includeDirectives include specs, in source order (angle- or
   *   quote-form, e.g. `<Arduino.h>` or `"foo.h"`)
   * @param preprocessor the compiler run 1.2 chose for the target (#1713)
   * @param options include paths + defines for the TU
   */
  static async recover(
    includeDirectives: readonly string[],
    preprocessor: IHeaderPreprocessor,
    options: IPreprocessOptions,
  ): Promise<IExternalRecovery | null> {
    if (includeDirectives.length === 0 || !preprocessor.isAvailable()) {
      return null;
    }

    // KEEP line directives so the output can be split back into per-file slices.
    const base: IPreprocessOptions = { ...options, keepLineDirectives: true };

    // Build the largest subset that preprocesses cleanly (drop a header that
    // can't preprocess — e.g. a fragile lvgl.h — instead of losing everything).
    const working = await ExternalDeclarationOracle.preprocessLargestWorkingTu(
      [...includeDirectives],
      preprocessor,
      base,
    );
    if (!working) return null;

    const { perFileContent, directiveOf } =
      ExternalDeclarationOracle.splitByFile(
        working.content,
        working.directives,
      );

    // Function-like macros the plain preprocess would have consumed at use.
    const macroNames = new Set<string>();
    const macros = await preprocessor.preprocessString(
      ExternalDeclarationOracle.buildTu(working.directives),
      TU_NAME,
      { ...options, keepLineDirectives: false, dumpMacros: true },
    );
    if (macros.success) {
      for (const match of macros.content.matchAll(FUNCTION_MACRO)) {
        macroNames.add(match[1]);
      }
    }

    return { perFileContent, macroNames, directiveOf };
  }

  /**
   * #1688: the macro dump of `includeDirectives` as one TU: every macro C
   * sees after them, builtins included, as `-dM` would list it. A header that
   * cannot be preprocessed is dropped, as for recovery, and `complete` says
   * whether any was; null when none can be preprocessed.
   *
   * #1881: and every header the TU entered. C includes are textual, so a
   * file that includes `<stdio.h>` sees what the headers `stdio.h` includes
   * declare. So the dump is taken with `-dD` and its line markers, which name
   * each header the preprocessor entered.
   */
  static async macroDump(
    includeDirectives: readonly string[],
    preprocessor: IHeaderPreprocessor,
    options: IPreprocessOptions,
  ): Promise<{
    dump: string;
    headerFiles: ReadonlySet<string>;
    complete: boolean;
  } | null> {
    const working = await ExternalDeclarationOracle.preprocessLargestWorkingTu(
      [...includeDirectives],
      preprocessor,
      { ...options, keepLineDirectives: true, dumpDefines: true },
    );
    if (!working) return null;
    return {
      ...ExternalDeclarationOracle.definesAndHeaders(working.content),
      complete: working.directives.length === includeDirectives.length,
    };
  }

  /**
   * #1881: a `-dD` dump with line markers, reduced to the `#define`s still in
   * force at its end and the headers its markers name, as resolved paths.
   * The unit itself, `<built-in>` and `<command-line>` are not headers.
   */
  static definesAndHeaders(content: string): {
    dump: string;
    headerFiles: ReadonlySet<string>;
  } {
    const defines = new Map<string, string>();
    const headerFiles = new Set<string>();
    let unit: string | null = null;
    for (const line of content.split("\n")) {
      const marker = LINE_MARKER.exec(line);
      if (marker !== null) {
        const file = marker[2];
        unit ??= file;
        if (file !== unit && !ExternalDeclarationOracle.isSynthetic(file)) {
          headerFiles.add(resolve(file));
        }
        continue;
      }
      const directive = DEFINE_OR_UNDEF.exec(line);
      if (directive === null) continue;
      const name = directive[2];
      defines.delete(name);
      if (directive[1] === "define") defines.set(name, line);
    }
    return { dump: [...defines.values()].join("\n"), headerFiles };
  }

  /**
   * Bucket preprocessed output by originating source file using its `#line`
   * markers. Synthetic units (`<built-in>`, `<command-line>`, the TU itself) are
   * skipped. Each real header maps to the concatenation of its own emitted lines.
   *
   * #1844: and each file entered (flag 1) maps to the include of `directives`
   * that reached it. The unit is one include per line, so the marker that
   * returns to it (`# N "<unit>" 2`) closes line N-1's include.
   */
  private static splitByFile(
    content: string,
    directives: readonly string[],
  ): { perFileContent: Map<string, string>; directiveOf: Map<string, string> } {
    const buckets = new Map<string, string[]>();
    const directiveOf = new Map<string, string>();
    const walk = { current: "", entered: [] as string[] };
    for (const line of content.split("\n")) {
      const marker = LINE_MARKER.exec(line);
      if (marker) {
        ExternalDeclarationOracle.followMarker(
          marker,
          directives,
          walk,
          directiveOf,
        );
        // #1844: a header entered with no line of its own still was entered
        if (
          !ExternalDeclarationOracle.isSynthetic(walk.current) &&
          !buckets.has(walk.current)
        ) {
          buckets.set(walk.current, []);
        }
      } else if (!ExternalDeclarationOracle.isSynthetic(walk.current)) {
        const bucket = buckets.get(walk.current);
        if (bucket) bucket.push(line);
        else buckets.set(walk.current, [line]);
      }
    }
    const perFileContent = new Map<string, string>();
    for (const [file, lines] of buckets) {
      perFileContent.set(file, lines.join("\n"));
    }
    return { perFileContent, directiveOf };
  }

  /** `<built-in>`, `<command-line>`, the unit itself (`<stdin>`), or no file yet */
  private static isSynthetic(file: string): boolean {
    return file === "" || file.startsWith("<");
  }

  /**
   * Move `walk` to the file a line marker names. Entering a header (flag 1)
   * records it; returning to the unit (flag 2) gives every header entered
   * since the include that line closes.
   */
  private static followMarker(
    marker: RegExpExecArray,
    directives: readonly string[],
    walk: { current: string; entered: string[] },
    directiveOf: Map<string, string>,
  ): void {
    walk.current = marker[2];
    const flags = new Set(marker[3].trim().split(/\s+/));
    if (!ExternalDeclarationOracle.isSynthetic(walk.current)) {
      if (flags.has("1")) walk.entered.push(walk.current);
      return;
    }
    const directive = directives[Number(marker[1]) - 2];
    if (walk.current === STDIN_MARKER && flags.has("2") && directive) {
      for (const file of walk.entered) {
        if (!directiveOf.has(file)) directiveOf.set(file, directive);
      }
    }
    walk.entered = [];
  }

  private static buildTu(directives: readonly string[]): string {
    return directives.map((d) => `#include ${d}`).join("\n") + "\n";
  }

  /**
   * Preprocess the directives as a TU; on failure, drop the single include that
   * caused it (identified by its line in the synthetic TU) and retry. Returns
   * the preprocessed content and the surviving directive list, or null.
   */
  private static async preprocessLargestWorkingTu(
    directives: string[],
    preprocessor: IHeaderPreprocessor,
    base: IPreprocessOptions,
  ): Promise<{ content: string; directives: string[] } | null> {
    const remaining = directives;
    // At most one drop per iteration; bound iterations by the ORIGINAL directive
    // count, captured once. `remaining` aliases `directives` and shrinks via
    // splice() below, so re-reading `directives.length` in the bound would halve
    // the allowed attempts and bail before trying the last surviving includes.
    const initialCount = directives.length;
    for (
      let attempt = 0;
      remaining.length > 0 && attempt <= initialCount;
      attempt++
    ) {
      const result = await preprocessor.preprocessString(
        ExternalDeclarationOracle.buildTu(remaining),
        TU_NAME,
        base,
      );
      if (result.success) {
        return { content: result.content, directives: remaining };
      }
      const failedIndex = ExternalDeclarationOracle.findFailingIncludeIndex(
        result.error,
        remaining.length,
      );
      if (failedIndex < 0) return null; // can't localize — give up
      remaining.splice(failedIndex, 1);
    }
    return null;
  }

  /**
   * From a preprocessor error, find the index of the top-level `#include` that
   * failed, via its line number in the synthetic TU (directive i is at line
   * i+1). Returns -1 if it can't be localized.
   */
  private static findFailingIncludeIndex(
    error: string | undefined,
    count: number,
  ): number {
    if (!error) return -1;
    const pattern = new RegExp(
      RegExpUtils.escape(STDIN_MARKER) + String.raw`:(\d+)`,
      "g",
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(error)) !== null) {
      const line = Number.parseInt(match[1], 10);
      if (line >= 1 && line <= count) return line - 1;
    }
    return -1;
  }
}

export default ExternalDeclarationOracle;
