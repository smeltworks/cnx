import IToolchain from "./IToolchain";

/**
 * Preprocessor options
 */
interface IPreprocessOptions {
  /** Additional include paths */
  includePaths?: string[];

  /** Preprocessor defines (-D flags) */
  defines?: Record<string, string | boolean>;

  /** Specific toolchain to use (auto-detect if not specified) */
  toolchain?: IToolchain;

  /** Keep #line directives for source mapping (default: true) */
  keepLineDirectives?: boolean;

  /**
   * Headers whose macros to import before preprocessing the target file
   * (gcc/clang `-imacros`), in order. Supplies include-order macro context so a
   * header that requires a predecessor can preprocess — e.g. FreeRTOS `task.h`
   * needs `INC_FREERTOS_H` and attribute macros defined by `FreeRTOS.h` first.
   * Unlike `-include`, `-imacros` keeps only the predecessors' macros, not their
   * declarations, so the output stays scoped to the target file.
   */
  imacros?: string[];

  /**
   * Dump macro definitions (gcc/clang `-dM`) instead of preprocessed source.
   * Output is the `#define` list, used to discover function-like macros (e.g.
   * FreeRTOS `pdMS_TO_TICKS`) that a plain preprocess consumes at use sites.
   */
  dumpMacros?: boolean;

  /**
   * #1881: keep each `#define` and `#undef` in the output (gcc/clang `-dD`),
   * so its line markers say which file each macro is defined in.
   */
  dumpDefines?: boolean;

  /**
   * #2096: evaluate the conditionals and expand no macro (gcc
   * `-fdirectives-only`), so a header's text keeps its spelling and loses
   * only the branches a compile skips.
   */
  directivesOnly?: boolean;

  /**
   * #1844: preprocess the file as a build meets a header -- `#include`d from a
   * one-line main file, not as the main file itself -- so `#pragma once` and
   * `#include_next` behave as they do in a compile.
   */
  asIncluded?: boolean;
}

export default IPreprocessOptions;
