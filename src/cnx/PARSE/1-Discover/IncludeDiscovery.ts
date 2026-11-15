import { dirname, resolve, join, isAbsolute } from "node:path";

import { CharStream } from "antlr4ng";

import { CnxLexer } from "../2-Parse/grammar/CnxLexer";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import invariant from "../../utils/invariant";
import FileDiscovery from "./FileDiscovery";
import PlatformIOIni from "./PlatformIOIni";
import EFileType from "./types/EFileType";
import IFileSystem from "../../types/IFileSystem";
import PROJECT_MARKERS from "../../types/PROJECT_MARKERS";

/**
 * Auto-discovery of include paths for cnx compilation
 *
 * Implements 4-tier include path discovery:
 * 1. File's own directory (for relative #include "header.h")
 * 2. Project root (walk up to find platformio.ini, cnx.config.json, .git)
 * 3. PlatformIO library dependencies (.pio/libdeps/ and lib_extra_dirs)
 * 4. Arduino library paths (~/Arduino/libraries/ or ~/Documents/Arduino/libraries/)
 *
 * Note: System paths (compiler defaults) not included to avoid dependencies.
 * Users can add system paths via --include flag if needed.
 */
class IncludeDiscovery {
  /**
   * Discover include paths for a file
   *
   * @param inputFile - Path to .cnx file being compiled
   * @param fs - File system abstraction
   * @returns the include directory paths
   */
  static discoverIncludePaths(inputFile: string, fs: IFileSystem): string[] {
    const paths: string[] = [];

    // Tier 1: File's own directory (highest priority)
    const fileDir = dirname(resolve(inputFile));
    paths.push(fileDir);

    // Tier 2: Project root detection
    const projectRoot = this.findProjectRoot(fileDir, fs);
    if (projectRoot) {
      // Add common include directories if they exist
      const commonDirs = ["include", "src", "lib"];
      for (const dir of commonDirs) {
        const includePath = join(projectRoot, dir);
        if (fs.exists(includePath) && fs.isDirectory(includePath)) {
          paths.push(includePath);
        }
      }

      // Tier 3: Issue #355 - PlatformIO library dependencies
      // When platformio.ini exists, check for .pio/libdeps/ and add all library paths
      const pioIniPath = join(projectRoot, "platformio.ini");
      if (fs.exists(pioIniPath)) {
        const libDepsPath = join(projectRoot, ".pio", "libdeps");
        if (fs.exists(libDepsPath) && fs.isDirectory(libDepsPath)) {
          const pioLibPaths = this.discoverPlatformIOLibPaths(libDepsPath, fs);
          paths.push(...pioLibPaths);
        }

        // Issue #355: Also parse lib_extra_dirs from platformio.ini
        const extraDirs = this.parsePlatformIOLibExtraDirs(
          pioIniPath,
          projectRoot,
          fs,
        );
        paths.push(...extraDirs);
      }
    }

    // Tier 4: Issue #355 - Arduino library paths
    // Check for Arduino libraries in common locations
    const arduinoPaths = this.discoverArduinoLibPaths(fs);
    paths.push(...arduinoPaths);

    // Remove duplicates
    return Array.from(new Set(paths));
  }

  /** Common subdirectories where library headers might live */
  private static readonly LIBRARY_SUB_DIRS = ["src", "include", "src/include"];

  /**
   * Add a library path and its common subdirectories to the paths array.
   * Checks src/, include/, and src/include/ subdirectories.
   */
  private static _addLibraryWithSubDirs(
    libPath: string,
    paths: string[],
    fs: IFileSystem,
  ): void {
    paths.push(libPath);

    for (const subDir of this.LIBRARY_SUB_DIRS) {
      const subPath = join(libPath, subDir);
      if (fs.exists(subPath) && fs.isDirectory(subPath)) {
        paths.push(subPath);
      }
    }
  }

  /**
   * Collect all library directories from a parent directory.
   * Each subdirectory is treated as a library root.
   */
  private static _collectLibrariesFromDir(
    parentDir: string,
    paths: string[],
    fs: IFileSystem,
  ): void {
    const entries = fs.readdir(parentDir);
    for (const entry of entries) {
      const entryPath = join(parentDir, entry);
      if (fs.isDirectory(entryPath)) {
        this._addLibraryWithSubDirs(entryPath, paths, fs);
      }
    }
  }

  /**
   * Discover Arduino library paths
   *
   * Issue #355: Arduino stores libraries in platform-specific locations:
   * - Linux: ~/Arduino/libraries/
   * - macOS: ~/Documents/Arduino/libraries/
   * - Windows: %USERPROFILE%\Documents\Arduino\libraries\
   *
   * @param fs - File system abstraction
   * @returns Array of library directory paths
   */
  private static discoverArduinoLibPaths(fs: IFileSystem): string[] {
    const paths: string[] = [];
    const home = process.env.HOME || process.env.USERPROFILE || "";

    if (!home) return paths;

    // Common Arduino library locations
    const arduinoLibDirs = [
      join(home, "Arduino", "libraries"), // Linux
      join(home, "Documents", "Arduino", "libraries"), // macOS / Windows
    ];

    for (const libDir of arduinoLibDirs) {
      if (fs.exists(libDir) && fs.isDirectory(libDir)) {
        try {
          this._collectLibrariesFromDir(libDir, paths, fs);
        } catch {
          // Expected: directory may not exist or be readable
        }
      }
    }

    return paths;
  }

  /**
   * Discover PlatformIO library dependency paths
   *
   * PlatformIO stores libraries in .pio/libdeps/<env>/<library>/
   * This function finds all library directories across all environments.
   *
   * @param libDepsPath - Path to .pio/libdeps/
   * @param fs - File system abstraction
   * @returns Array of library directory paths
   */
  private static discoverPlatformIOLibPaths(
    libDepsPath: string,
    fs: IFileSystem,
  ): string[] {
    const paths: string[] = [];

    try {
      // Iterate through environment directories (e.g., teensy40, teensy41, esp32)
      const envDirs = fs.readdir(libDepsPath);
      for (const envDir of envDirs) {
        const envPath = join(libDepsPath, envDir);
        if (fs.isDirectory(envPath)) {
          this._collectLibrariesFromDir(envPath, paths, fs);
        }
      }
    } catch {
      // Expected: .pio directory may not exist
    }

    return paths;
  }

  /**
   * Parse platformio.ini for lib_extra_dirs
   *
   * Issue #355: PlatformIO allows specifying additional library directories
   * via lib_extra_dirs in platformio.ini. This parses those and returns
   * resolved absolute paths.
   *
   * @param pioIniPath - Path to platformio.ini
   * @param projectRoot - Project root directory for resolving relative paths
   * @param fs - File system abstraction
   * @returns Array of library directory paths
   */
  private static parsePlatformIOLibExtraDirs(
    pioIniPath: string,
    projectRoot: string,
    fs: IFileSystem,
  ): string[] {
    const paths: string[] = [];

    try {
      const content = fs.readFile(pioIniPath);

      // Match lib_extra_dirs in any section
      // Format can be:
      //   lib_extra_dirs = path1, path2
      //   lib_extra_dirs =
      //     path1
      //     path2
      // The one list rule (#1760 review: this file split and stripped
      // comments with its own copy). A path in quotes is read without them,
      // as it was before (679035029); PlatformIO keeps them, and quotes are
      // stripped nowhere else, since in a section name they change the section.
      for (const value of PlatformIOIni.valuesOf(content, "lib_extra_dirs")) {
        const dirs = PlatformIOIni.list(value)
          .map((dir) => (/^(["']).*\1$/.test(dir) ? dir.slice(1, -1) : dir))
          .filter((dir) => dir.length > 0);

        for (const dir of dirs) {
          // Resolve relative to project root
          const fullPath = isAbsolute(dir) ? dir : join(projectRoot, dir);
          if (fs.exists(fullPath) && fs.isDirectory(fullPath)) {
            paths.push(fullPath);
          }
        }
      }
    } catch {
      // Expected: platformio.ini may not exist or be malformed
    }

    return paths;
  }

  /**
   * Find the project root by walking up from `startDir` to the nearest
   * directory holding any project marker, the filesystem root included.
   *
   * The one finder (#1668): include discovery and the transpiler's cache and
   * header base used to walk with two marker lists that each lacked a marker
   * the other had.
   *
   * #2261: this is the config's walk too. `ConfigLoader` reads the config
   * from the root it returns and from no directory above, so a run's settings
   * and its root are one directory.
   *
   * @param startDir - Directory to start search from
   * @param fs - File system abstraction
   * @returns the project root, or null if there is none
   */
  static findProjectRoot(startDir: string, fs: IFileSystem): string | null {
    let dir = resolve(startDir);
    while (true) {
      if (PROJECT_MARKERS.some((marker) => fs.exists(join(dir, marker)))) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) {
        return null;
      }
      dir = parent;
    }
  }

  /**
   * Scan `#include` directives, replacing
   * /^\s*#\s*include\s*([<"])([^>"]+)[>"]/gm, which backtracks
   * super-linearly on its whitespace runs (S8786).
   *
   * Behavior is preserved exactly, including two quirks worth naming:
   * the closing delimiter is not required to match the opening one
   * (`#include <a.h"` is accepted), and every whitespace run may span
   * newlines, so a `#` alone on one line with `include` on the next still
   * matches. Only whitespace may precede the `#` on its own line.
   */
  private static _scanIncludeDirectives(
    content: string,
  ): { delimiter: string; path: string }[] {
    const found: { delimiter: string; path: string }[] = [];

    let index = 0;
    while (index < content.length) {
      if (content[index] !== "#") {
        index += 1;
        continue;
      }
      const directive = IncludeDiscovery._readIncludeAt(content, index);
      if (directive === null) {
        index += 1;
        continue;
      }
      found.push({ delimiter: directive.delimiter, path: directive.path });
      index = directive.next;
    }

    return found;
  }

  /** True when only whitespace separates `index` from the start of its line. */
  private static _lineStartIsClear(content: string, index: number): boolean {
    for (
      let before = index - 1;
      before >= 0 && content[before] !== "\n";
      before -= 1
    ) {
      if (!IncludeDiscovery._isSpace(content[before])) {
        return false;
      }
    }
    return true;
  }

  private static _isSpace(character: string | undefined): boolean {
    return character !== undefined && /\s/.test(character);
  }

  /** Advance past a run of whitespace. */
  private static _skipSpace(content: string, from: number): number {
    let cursor = from;
    while (IncludeDiscovery._isSpace(content[cursor])) {
      cursor += 1;
    }
    return cursor;
  }

  /**
   * Read one `#include` beginning at the `#` in `index`, or null if there
   * isn't one there. `next` is the index just past the closing delimiter.
   */
  private static _readIncludeAt(
    content: string,
    index: number,
  ): { delimiter: string; path: string; next: number } | null {
    if (!IncludeDiscovery._lineStartIsClear(content, index)) {
      return null;
    }

    let cursor = IncludeDiscovery._skipSpace(content, index + 1);
    if (!content.startsWith("include", cursor)) {
      return null;
    }

    cursor = IncludeDiscovery._skipSpace(content, cursor + "include".length);
    const delimiter = content[cursor];
    if (delimiter !== "<" && delimiter !== '"') {
      return null;
    }

    const pathStart = cursor + 1;
    let pathEnd = pathStart;
    while (
      pathEnd < content.length &&
      content[pathEnd] !== ">" &&
      content[pathEnd] !== '"'
    ) {
      pathEnd += 1;
    }
    // [^>"]+ requires at least one character, and a closing delimiter
    if (pathEnd === pathStart || pathEnd >= content.length) {
      return null;
    }

    return {
      delimiter,
      path: content.slice(pathStart, pathEnd),
      next: pathEnd + 1,
    };
  }

  /**
   * Extract #include directives with local/system info
   *
   * Issue #355: Returns whether each include is local ("...") or system (<...>)
   * so we can warn appropriately when local includes aren't found.
   *
   * A text scan, for C and C++ headers. It does not know about comments, so
   * it reads a directive inside one (#1829). A `.cnx` file's directives are
   * read by `extractCnxIncludes`, which the grammar decides, and
   * `directivesOf` is where a file on disk is given one or the other.
   *
   * @param content - Source file content
   * @returns Array of include info objects
   */
  static extractIncludesWithInfo(
    content: string,
  ): Array<{ path: string; isLocal: boolean }> {
    const includes: Array<{ path: string; isLocal: boolean }> = [];

    // Match #include directives, capturing the delimiter to determine local vs system
    for (const directive of IncludeDiscovery._scanIncludeDirectives(content)) {
      includes.push({
        path: directive.path,
        isLocal: directive.delimiter === '"',
      });
    }

    return includes;
  }

  /**
   * A `.cnx` file's #include directives, as the grammar reads them (#1745).
   *
   * The text scan above did not know about comments, while the parser's
   * `INCLUDE_DIRECTIVE` token treats a comment as a hidden token. So discovery
   * pulled in a file that a block comment had disabled, and missed a directive
   * written after a comment on its line. Reading the parser's own token makes
   * the two agree by construction rather than by what the fixtures exercise.
   *
   * It lexes rather than reading 1.2's artifact because discovery decides
   * which files the run parses, so no parse exists yet when it asks. It is
   * why this module appears in `docs/architecture/parse-tree-sites.md`.
   *
   * The path is everything between the token's delimiters. The grammar makes
   * the closing delimiter the token's last character, so a `"` inside `<...>`
   * belongs to the path, as the parser and 2.1 read it. Splitting the token
   * with the scan above stopped at that quote and named a different file
   * (#1830 review).
   *
   * @param source - A `.cnx` file's text
   */
  static extractCnxIncludes(
    source: string,
  ): Array<{ path: string; isLocal: boolean }> {
    return IncludeDiscovery.directiveTextsOf(source).flatMap(
      (text) => IncludeDirectiveText.split(text) ?? [],
    );
  }

  /**
   * The text of every `INCLUDE_DIRECTIVE` token in a `.cnx` file, in source
   * order and exactly as written: the author's spacing and form survive. It
   * is the token 1.2's `includeDirective` holds, so these are the directives
   * the parser sees (#1745).
   *
   * #1444: a file's user includes were derived from that tree in Stage 5,
   * after 1.1 had already lexed the same tokens. 1.1 keeps the text instead.
   *
   * @param source - A `.cnx` file's text
   */
  static directiveTextsOf(source: string): string[] {
    return IncludeDiscovery.directivesWithPositionsOf(source).map(
      (directive) => directive.text,
    );
  }

  /**
   * #1844: `directiveTextsOf`, with where each directive sits -- E0507 is
   * reported at the include that reached a C++ header.
   */
  static directivesWithPositionsOf(
    source: string,
  ): Array<{ text: string; line: number; column: number }> {
    const lexer = new CnxLexer(CharStream.fromString(source));
    // 1.2 Parse reports a lexical error once, with its position. Here it
    // would only print ANTLR's console default a second time.
    lexer.removeErrorListeners();

    return lexer
      .getAllTokens()
      .filter((token) => token.type === CnxLexer.INCLUDE_DIRECTIVE)
      .map((token) => {
        // A token the lexer produced always carries its text. The type allows
        // none, and an empty default would drop the directive without a trace.
        invariant(
          token.text !== undefined,
          "an INCLUDE_DIRECTIVE token carries its text",
        );
        return { text: token.text, line: token.line, column: token.column };
      });
  }

  /**
   * Whether `include` is a quoted include of cnx source: the form ADR-010
   * resolves beside the including file only, and whose absence is E0506.
   */
  static isQuotedCnx(include: { path: string; isLocal: boolean }): boolean {
    return (
      include.isLocal &&
      FileDiscovery.classifyFile(include.path).type === EFileType.Cnx
    );
  }

  /**
   * #1672: where an include resolves -- the one decision, for both routes
   * by which 1.1 resolves a file's includes: a `.cnx` file's own
   * (`IncludeResolver`) and the C/C++ entry point's scan
   * (`CppEntryPointScanner`). A quoted cnx include resolves beside the
   * including file and only there (ADR-010); anything else by its absolute
   * path or along the search path, as a compiler searches its -I list.
   *
   * @param quotedIncludeDirectory - The including file's directory. It is
   *   required: with no directory, a quoted cnx include was searched like
   *   any other, which is the second rule #1672 removed (#1835 review)
   */
  static resolveSpelling(
    include: { path: string; isLocal: boolean },
    quotedIncludeDirectory: string,
    searchPaths: string[],
    fs: IFileSystem,
  ): string | null {
    if (IncludeDiscovery.isQuotedCnx(include)) {
      return IncludeDiscovery.resolveQuoted(
        include.path,
        quotedIncludeDirectory,
        (path) => fs.exists(path) && fs.isFile(path),
      );
    }
    return IncludeDiscovery.resolveInclude(include.path, searchPaths, fs);
  }

  /**
   * A file's #include directives, read by the rules of its kind: a cnx
   * file's as the grammar reads them, anything else's by the text scan.
   *
   * The one place that choice is made for the readers that walk files on
   * disk: the C/C++ entry-point scan and the transitive header walk. The
   * #1830 review found the entry-point scan still reading a `.cnx` file it
   * reached with the text scan, so a commented-out include joined the run
   * through that route. #1829 changes the other branch.
   *
   * A file with no path to classify, a source run's in-memory root, never
   * reaches here. The pipeline's own files are cnx by construction and
   * call `extractCnxIncludes` directly.
   */
  static directivesOf(
    path: string,
    content: string,
  ): Array<{ path: string; isLocal: boolean }> {
    return FileDiscovery.classifyFile(path).type === EFileType.Cnx
      ? IncludeDiscovery.extractCnxIncludes(content)
      : IncludeDiscovery.extractIncludesWithInfo(content);
  }

  /**
   * Resolve an include path using search directories
   *
   * @param includePath - The include path from #include directive
   * @param searchPaths - Directories to search in
   * @param fs - File system abstraction
   * @returns Resolved absolute path or null if not found
   */
  static resolveInclude(
    includePath: string,
    searchPaths: string[],
    fs: IFileSystem,
  ): string | null {
    // Already absolute: a file there, as every other branch asks (#1672).
    // A directory "resolved" here and was then dropped by `discoverFile`.
    if (isAbsolute(includePath)) {
      return fs.exists(includePath) && fs.isFile(includePath)
        ? includePath
        : null;
    }

    return IncludeDiscovery.resolveAlong(
      includePath,
      searchPaths,
      (path) => fs.exists(path) && fs.isFile(path),
    );
  }

  /**
   * The first search directory holding `includePath`, in priority order --
   * how an angle include resolves.
   *
   * @param isFile - Whether a path is an existing file, through the run's
   *   file system
   */
  static resolveAlong(
    includePath: string,
    searchPaths: readonly string[],
    isFile: (path: string) => boolean,
  ): string | null {
    for (const searchDir of searchPaths) {
      const fullPath = join(searchDir, includePath);
      if (isFile(fullPath)) {
        return fullPath;
      }
    }
    return null;
  }

  /**
   * #1672: where a quoted `.cnx` include resolves -- beside the file it
   * appears in, and only there (ADR-010). 1.1 searched every search path, and
   * pulled in a file 2.1 then said the include could not reach.
   *
   * @param isFile - Whether a path is an existing file, through the run's
   *   file system
   */
  static resolveQuoted(
    includePath: string,
    quotedIncludeDirectory: string,
    isFile: (path: string) => boolean,
  ): string | null {
    const candidate = resolve(quotedIncludeDirectory, includePath);
    return isFile(candidate) ? candidate : null;
  }
}

export default IncludeDiscovery;
