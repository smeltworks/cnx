/**
 * C/C++ Preprocessor
 * Runs the system preprocessor on C/C++ files before parsing
 */

import { execFile } from "node:child_process";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import IToolchain from "./types/IToolchain";
import IPreprocessResult from "./types/IPreprocessResult";
import ISourceMapping from "./types/ISourceMapping";
import IPreprocessOptions from "./types/IPreprocessOptions";
import ToolchainDetector from "./ToolchainDetector";
import ExecFailure from "../../../utils/ExecFailure";
import type IPreprocessCacheEntry from "./types/IPreprocessCacheEntry";
import IFileSystem from "../../../types/IFileSystem";
import LineMarkers from "./LineMarkers";
import PreprocessCache from "./PreprocessCache";
import type IHeaderPreprocessor from "./types/IHeaderPreprocessor";

/** What one run of the compiler printed, and why it failed, if it did */
type IPreprocessOutcome = Omit<IPreprocessCacheEntry, "deps" | "absent">;

/** The `-MT` target the dependency list is printed for */
const DEPS_TARGET = "cnx";

/**
 * The language cpp gives a file of each extension, which a string on standard
 * input has to be told with `-x` (gcc's table, "Options Controlling the Kind
 * of Output").
 */
const LANGUAGE_OF_EXTENSION: Readonly<Record<string, string>> = {
  ".c": "c",
  ".h": "c-header",
  ".cc": "c++",
  ".cp": "c++",
  ".cxx": "c++",
  ".cpp": "c++",
  ".CPP": "c++",
  ".c++": "c++",
  ".C": "c++",
  ".hh": "c++-header",
  ".H": "c++-header",
  ".hp": "c++-header",
  ".hxx": "c++-header",
  ".hpp": "c++-header",
  ".HPP": "c++-header",
  ".h++": "c++-header",
  ".tcc": "c++-header",
};

/** A string the preprocessor reads on standard input, and where it runs */
interface IStringInput {
  readonly filename: string;
  readonly content: string;
}

/**
 * Handles preprocessing of C/C++ files
 */
class Preprocessor implements IHeaderPreprocessor {
  /** The input argument that names standard input */
  private static readonly STDIN = "-";

  private readonly toolchain: IToolchain | null;

  private readonly defaultIncludePaths: string[] = [];

  private readonly fs: IFileSystem;

  /** Where cpp reads a string from: a directory that holds no header */
  private readonly headerFreeDirectory: string;

  /** Where each run is kept, so a warm run starts none (#1844) */
  private readonly cache: PreprocessCache | null;

  /**
   * #1713: the host constructs one for the compiler 1.2 chose for the run's
   * target; `toolchain` is null when that compiler is not installed.
   */
  constructor(
    fs: IFileSystem,
    toolchain: IToolchain | null,
    settings: {
      readonly headerFreeDirectory: string;
      readonly cache: PreprocessCache | null;
    },
  ) {
    this.fs = fs;
    this.toolchain = toolchain;
    this.headerFreeDirectory = settings.headerFreeDirectory;
    this.cache = settings.cache;

    if (this.toolchain) {
      this.defaultIncludePaths = ToolchainDetector.getDefaultIncludePaths(
        this.toolchain,
      );
    }
  }

  /**
   * Check if a toolchain is available
   */
  isAvailable(): boolean {
    return this.toolchain !== null;
  }

  compilerPath(): string | null {
    return this.toolchain?.cc ?? null;
  }

  /**
   * Preprocess a C/C++ file
   */
  async preprocess(
    filePath: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    const { asIncluded, ...rest } = options;
    // A `"` cannot be spelled in a quoted include
    if (!asIncluded || filePath.includes('"')) {
      return this.run(filePath, rest, null);
    }
    const result = await this.preprocessString(
      `#include "${resolve(filePath)}"\n`,
      `cnx-include${extname(filePath)}`,
      // The file's own directory stays on the path, as for a main file
      {
        ...rest,
        includePaths: [...(rest.includePaths ?? []), dirname(filePath)],
      },
    );
    result.originalFile = filePath;
    return result;
  }

  /**
   * Preprocess content from a string, on standard input (#1991: 1.1 creates no
   * file, scratch included). On stdin cpp searches its working directory first
   * for a quoted `#include` (#1653, measured on gcc), so it runs from a
   * directory that holds no header, which keeps the resolution the string had
   * from a temporary file alone in its directory.
   */
  async preprocessString(
    content: string,
    filename: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    const result = await this.run(filename, options, { filename, content });
    result.originalFile = filename;
    return result;
  }

  /**
   * One preprocessor run, from `options.cache` when no file it read has
   * changed (#1844). For a string, `filePath` is its `filename`, and the key
   * names it with its text.
   */
  private async run(
    filePath: string,
    options: IPreprocessOptions,
    text: IStringInput | null,
  ): Promise<IPreprocessResult> {
    const toolchain = options.toolchain ?? this.toolchain;
    if (!toolchain) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error:
          "No C/C++ toolchain available. Install gcc, clang, or arm-none-eabi-gcc.",
        originalFile: filePath,
      };
    }
    const extension = text === null ? null : extname(text.filename);
    const language =
      extension === null ? null : LANGUAGE_OF_EXTENSION[extension];
    if (language === undefined) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error: `Preprocessor failed for ${filePath}: no C or C++ language has the extension ${extension}`,
        originalFile: filePath,
        toolchain: toolchain.name,
      };
    }
    const input =
      language === null ? [filePath] : ["-x", language, Preprocessor.STDIN];
    const args = this.argsFor(
      text === null ? dirname(filePath) : null,
      options,
    );
    const cache = this.cache;
    let outcome: IPreprocessOutcome;
    if (cache) {
      const key = PreprocessCache.keyOf([
        toolchain.name,
        toolchain.cpp,
        toolchain.version ?? null,
        toolchain.target ?? null,
        [...args, ...input],
        text?.content ?? null,
      ]);
      outcome =
        cache.lookup(key) ??
        (await this.runRecorded(toolchain, filePath, options, key, cache, {
          input,
          text,
        }));
    } else {
      outcome = await this.exec(toolchain, [...args, ...input], filePath, text);
    }
    return this.resultOf(outcome, filePath, options, toolchain);
  }

  /**
   * Ask the compiler which files a run reads (`-M`) and stat them at once,
   * then run, and record the outcome under `key` with every one of them: a
   * file saved after the stat is newer than its entry, so the next run misses.
   * A run whose dependencies the compiler could not list (a missing
   * `#include` stops it before it prints them) is not recorded: what it would
   * have read is not known.
   */
  private async runRecorded(
    toolchain: IToolchain,
    filePath: string,
    options: IPreprocessOptions,
    key: string,
    cache: PreprocessCache,
    run: { readonly input: string[]; readonly text: IStringInput | null },
  ): Promise<IPreprocessOutcome> {
    const own = run.text === null ? dirname(filePath) : null;
    const listed = await this.exec(
      toolchain,
      [
        ...this.argsFor(own, { ...options, dumpMacros: false }),
        "-M",
        "-MT",
        DEPS_TARGET,
        ...run.input,
      ],
      filePath,
      run.text,
    );
    // An `#error` fails the run after the list is printed (measured on gcc)
    const read = Preprocessor.depsOf(listed.stdout, this.cwdFor(run.text));
    const deps = this.modifiedTimes(read);
    const outcome = await this.exec(
      toolchain,
      [...this.argsFor(own, options), ...run.input],
      filePath,
      run.text,
    );
    if (read.length > 0 && deps !== null) {
      cache.record(key, {
        ...outcome,
        deps,
        absent: this.shadowing(read, this.searchPath(own, options)),
      });
    }
    return outcome;
  }

  /** Each file's mtime; null when one is already gone: nothing to key on */
  private modifiedTimes(paths: readonly string[]): [string, number][] | null {
    try {
      return paths.map((path): [string, number] => [
        path,
        this.fs.stat(path).mtimeMs,
      ]);
    } catch {
      return null;
    }
  }

  /**
   * #1844: where a file added would be found ahead of one the run read -- the
   * same name in an earlier directory of its search path -- that does not
   * exist now. A file under several search directories (one inside another)
   * may have been found through any of them, so each counts; a candidate that
   * exists now was not ahead of it.
   */
  private shadowing(
    read: readonly string[],
    search: readonly string[],
  ): string[] {
    const absent = new Set<string>();
    for (const file of read) {
      search.forEach((found, k) => {
        if (!file.startsWith(found.endsWith(sep) ? found : found + sep)) return;
        const name = relative(found, file);
        for (const dir of search.slice(0, k)) {
          const candidate = join(dir, name);
          if (!this.fs.exists(candidate)) absent.add(candidate);
        }
      });
    }
    return [...absent];
  }

  /**
   * The files a `-M -MT ${DEPS_TARGET}` dependency list names: the target,
   * then each file, with backslash-newline continuations, `\ ` for a space
   * and `\#` for a `#` in a path. A relative path is relative to the
   * compiler's directory, `cwd`, or this process's when null.
   */
  private static depsOf(text: string, cwd: string | null): string[] {
    const body = text.replaceAll(/\\\r?\n/g, " ").trim();
    if (!body.startsWith(`${DEPS_TARGET}:`)) return [];
    return body
      .slice(DEPS_TARGET.length + 1)
      .trim()
      .split(/(?<!\\)\s+/)
      .filter((path) => path !== "")
      .map((path) =>
        resolve(
          cwd ?? ".",
          path
            .replaceAll(String.raw`\ `, " ")
            .replaceAll(String.raw`\#`, "#")
            .replaceAll("$$", "$"),
        ),
      );
  }

  private resultOf(
    outcome: IPreprocessOutcome,
    filePath: string,
    options: IPreprocessOptions,
    toolchain: IToolchain,
  ): IPreprocessResult {
    if (outcome.error !== null) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error: outcome.error,
        diagnostics: outcome.stderr,
        originalFile: filePath,
        toolchain: toolchain.name,
      };
    }
    // Log warnings to console but don't fail
    if (outcome.stderr.trim()) {
      console.warn(`Preprocessor warnings for ${filePath}:\n${outcome.stderr}`);
    }
    const content = outcome.stdout;
    return {
      // Optionally strip #line directives for cleaner output
      content:
        options.keepLineDirectives === false
          ? LineMarkers.strip(content)
          : content,
      sourceMappings:
        options.keepLineDirectives === false
          ? []
          : this.parseLineDirectives(content),
      success: true,
      originalFile: filePath,
      toolchain: toolchain.name,
    };
  }

  /**
   * The preprocessor's arguments, up to its input: `ownDirectory` is the
   * input file's, which a string on standard input has none of
   */
  private argsFor(
    ownDirectory: string | null,
    options: IPreprocessOptions,
  ): string[] {
    const args: string[] = [
      // #1713: the target's own flags, so cpp defines the macros its compiler does
      ...((options.toolchain ?? this.toolchain)?.flags ?? []),
      "-E", // Preprocess only
      "-P", // Don't generate linemarkers (we'll add them back if needed)
    ];

    // If we want line directives, don't use -P
    if (options.keepLineDirectives !== false) {
      args.pop(); // Remove -P
    }

    // Dump macro definitions (#define list) instead of preprocessed source,
    // to discover function-like macros the normal preprocess would consume.
    if (options.dumpMacros) {
      args.push("-dM");
    }
    if (options.dumpDefines) {
      args.push("-dD");
    }
    if (options.directivesOnly) {
      args.push("-fdirectives-only");
    }

    for (const path of this.searchPath(ownDirectory, options)) {
      args.push(`-I${path}`);
    }

    // Add defines
    if (options.defines) {
      for (const [key, value] of Object.entries(options.defines)) {
        if (value === true) {
          args.push(`-D${key}`);
        } else if (value !== false) {
          args.push(`-D${key}=${value}`);
        }
      }
    }

    // Import predecessor macros (gcc/clang -imacros) so include-order-dependent
    // headers get the guards/attribute macros their includer would have defined
    // first. -imacros keeps only the macros, not the predecessors' declarations,
    // so the output stays scoped to the target file.
    if (options.imacros) {
      for (const macroHeader of options.imacros) {
        args.push("-imacros", resolve(macroHeader));
      }
    }
    return args;
  }

  /**
   * The directories searched for an include, absolute: cpp reading a string
   * runs from another directory than this process (`cwdFor`)
   */
  private searchPath(
    ownDirectory: string | null,
    options: IPreprocessOptions,
  ): string[] {
    return [
      ...this.defaultIncludePaths,
      ...(options.includePaths ?? []),
      ...(ownDirectory === null ? [] : [ownDirectory]),
    ].map((dir) => resolve(dir));
  }

  /** Where cpp runs: a string from a directory with no headers, else here */
  private cwdFor(text: IStringInput | null): string | null {
    return this.stdinOf(text)?.cwd ?? null;
  }

  private stdinOf(
    text: IStringInput | null,
  ): { readonly content: string; readonly cwd: string } | null {
    return text === null
      ? null
      : {
          content: text.content,
          cwd: this.headerFreeDirectory,
        };
  }

  /**
   * Invoke the preprocessor via argv (execFile, NOT a shell). A shell would
   * re-parse -D values that legitimately contain spaces / parentheses (e.g.
   * -DARDUINO_BOARD="Espressif ... (8 MB QD, No PSRAM)"), breaking on the
   * metacharacters. Passing args directly mirrors how the real compiler is
   * invoked and is safe for any value the compiler accepts.
   */
  private async exec(
    toolchain: IToolchain,
    args: readonly string[],
    filePath: string,
    text: IStringInput | null,
  ): Promise<IPreprocessOutcome> {
    try {
      const { stdout, stderr } = await Preprocessor.spawn(
        toolchain.cpp,
        args,
        this.stdinOf(text),
      );
      return { stdout, stderr: stderr ?? "", error: null };
    } catch (error: unknown) {
      // Include stderr in error message for better debugging
      const failure = ExecFailure.of(error);
      return {
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? "",
        error: `Preprocessor failed for ${filePath}:\n${failure.message}\n${failure.stderr ?? ""}`,
      };
    }
  }

  /** `execFile`, handing `stdin.content` to the process from `stdin.cwd` */
  private static spawn(
    file: string,
    args: readonly string[],
    stdin: { readonly content: string; readonly cwd: string } | null,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolvePromise, reject) => {
      const child = execFile(
        file,
        args,
        {
          maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large headers
          ...(stdin === null ? {} : { cwd: stdin.cwd }),
        },
        (error, stdout, stderr) => {
          if (error === null) {
            resolvePromise({ stdout, stderr });
          } else {
            reject(Object.assign(error, { stdout, stderr }));
          }
        },
      );
      child.stdin?.end(stdin?.content ?? "");
    });
  }

  /**
   * Parse #line directives to build source mappings
   * Format: # linenum "filename" [flags]
   */
  private parseLineDirectives(content: string): ISourceMapping[] {
    const mappings: ISourceMapping[] = [];
    const lines = content.split("\n");

    let currentFile = "";
    let currentOriginalLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match # linenum "filename" or #line linenum "filename"
      const match = /^#\s*(?:line\s+)?(\d+)\s+"([^"]+)"(?:\s+\d+)*\s*$/.exec(
        line,
      );

      if (match) {
        currentOriginalLine = Number.parseInt(match[1], 10);
        currentFile = match[2];
      } else if (currentFile) {
        mappings.push({
          preprocessedLine: i + 1,
          originalFile: currentFile,
          originalLine: currentOriginalLine,
        });
        currentOriginalLine++;
      }
    }

    return mappings;
  }
}

export default Preprocessor;
