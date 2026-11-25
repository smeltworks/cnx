import { createHash } from "node:crypto";

import TargetToolchain from "../../utils/TargetToolchain";
import type ITargetDescription from "../../types/ITargetDescription";
import type IHeaderCompiler from "./preprocessor/types/IHeaderCompiler";
import type IHeaderPreprocessor from "./preprocessor/types/IHeaderPreprocessor";
import type IHeaderSource from "../1-Discover/types/IHeaderSource";

class HeaderCompiler {
  /**
   * #1713: a run's headers are read by its target's own compiler, chosen by
   * the rule the target matrix compiles by (`TargetToolchain`): `gcc` for
   * `host`, `avr-gcc` for AVR, `arm-none-eabi-gcc` for Cortex-M, with the
   * target's flags. A compiler the project names (`configured`) reads them
   * instead, with the same flags, once `disagreement` finds it builds for the
   * target (#1542 ruling 10). Otherwise, why there is no compiler.
   */
  static of(
    description: ITargetDescription,
    configured: string | null,
  ): IHeaderCompiler | string {
    const gcc = TargetToolchain.gccFor(description);
    const flags = typeof gcc === "string" ? [] : gcc.archFlags;
    if (configured !== null) return { driver: configured, flags };
    return typeof gcc === "string"
      ? gcc
      : { driver: `${gcc.driverPrefix}gcc`, flags };
  }

  /**
   * #1542 ruling 10: a compiler the project names must build for the run's
   * target, and its own data-model macros say what it builds for. Null when
   * they agree; otherwise, the first way they differ.
   */
  static async disagreement(
    preprocessor: IHeaderPreprocessor,
    description: ITargetDescription,
  ): Promise<string | null> {
    const probe = await preprocessor.preprocessString("", "data-model.c", {
      dumpMacros: true,
    });
    if (!probe.success) {
      return probe.error ?? "the compiler could not be run";
    }
    const macros = new Map(
      [...probe.content.matchAll(/^#define (\w+) (.*)$/gm)].map((match) => [
        match[1],
        match[2].trim(),
      ]),
    );
    const charBits = Number(macros.get("__CHAR_BIT__"));
    if (charBits !== description.char_bits) {
      return `target '${description.name}' has ${description.char_bits}-bit char, and this compiler's __CHAR_BIT__ is ${macros.get("__CHAR_BIT__") ?? "undefined"}`;
    }
    for (const width of HeaderCompiler.DATA_MODEL) {
      const expected = description[width.field];
      const bits = Number(macros.get(width.macro)) * charBits;
      if (bits !== expected) {
        const given = Number.isNaN(bits) ? "none" : String(bits) + "-bit";
        return `target '${description.name}' has ${expected}-bit ${width.what}, and this compiler's ${width.macro} gives ${given}`;
      }
    }
    const bigEndian = macros.get("__BYTE_ORDER__") === "__ORDER_BIG_ENDIAN__";
    if (bigEndian !== description.big_endian) {
      return `target '${description.name}' is ${description.big_endian ? "big" : "little"}-endian, and this compiler is not`;
    }
    return null;
  }

  private static readonly DATA_MODEL: ReadonlyArray<{
    readonly field:
      | "pointer_bits"
      | "int_bits"
      | "long_bits"
      | "long_long_bits";
    readonly macro: string;
    readonly what: string;
  }> = [
    { field: "pointer_bits", macro: "__SIZEOF_POINTER__", what: "pointers" },
    { field: "int_bits", macro: "__SIZEOF_INT__", what: "int" },
    { field: "long_bits", macro: "__SIZEOF_LONG__", what: "long" },
    {
      field: "long_long_bits",
      macro: "__SIZEOF_LONG_LONG__",
      what: "long long",
    },
  ];

  /**
   * Who read a run's headers, as a cache names it: what one compiler declares
   * for a header another may not (`uintptr_t` is 64-bit for `gcc`, 32-bit for
   * `arm-none-eabi-gcc -mcpu=cortex-m7`), and what one run's defines and
   * search paths select another's may not (#1250). So it names the compiler
   * where it was found, its flags, the defines and every search path.
   * `null`: the text was read as written.
   */
  static identity(
    compiler: IHeaderCompiler | null,
    reading: {
      readonly compilerPath: string | null;
      readonly defines: Readonly<Record<string, string | boolean>>;
      readonly includeSearchPaths: readonly string[];
      readonly headerSearchPaths: ReadonlyMap<string, readonly string[]>;
    },
  ): string {
    if (compiler === null) return "unpreprocessed";
    return JSON.stringify({
      compiler: HeaderCompiler.key(compiler),
      path: reading.compilerPath,
      defines: Object.entries(reading.defines).sort(([a], [b]) =>
        a.localeCompare(b),
      ),
      includePaths: reading.includeSearchPaths,
      headerPaths: [...reading.headerSearchPaths].sort(([a], [b]) =>
        a.localeCompare(b),
      ),
    });
  }

  /**
   * What one header's cache record is good for: `reader`, and the text the
   * header was read as, in the language it was parsed as. The headers before it can change that text while its
   * file does not: `#ifdef BIG` after an earlier include's `#define BIG`.
   */
  static readerOf(reader: string, source: IHeaderSource): string {
    return JSON.stringify({
      reader,
      text: createHash("sha256").update(source.text).digest("hex"),
      language: source.language,
    });
  }

  /** One compiler run's key: its driver and flags */
  static key(compiler: IHeaderCompiler): string {
    return [compiler.driver, ...compiler.flags].join("\0");
  }
}

export default HeaderCompiler;
