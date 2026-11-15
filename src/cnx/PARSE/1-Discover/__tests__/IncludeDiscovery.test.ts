/**
 * Unit tests for IncludeDiscovery
 *
 * Tests include path discovery functionality:
 * - discoverIncludePaths: Auto-discovery of include directories
 * - findProjectRoot: Project root detection
 * - extractIncludesWithInfo: Parse #include directives
 * - resolveInclude: Resolve include paths
 * - PlatformIO and Arduino library discovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import IncludeDiscovery from "../IncludeDiscovery";
import IFileSystem from "../../../types/IFileSystem";
import TestFileSystem from "../../../types/__testUtils__/TestFileSystem";
import NodeFileSystem from "../NodeFileSystem";

/** The include directories discovered from `inputFile`. */
function includePaths(inputFile: string, fs: IFileSystem): readonly string[] {
  return IncludeDiscovery.discoverIncludePaths(inputFile, fs);
}

/** The project root found from `startDir`, or null. */
function projectRoot(startDir: string, fs: IFileSystem): string | null {
  return IncludeDiscovery.findProjectRoot(startDir, fs);
}

describe("IncludeDiscovery", () => {
  // #1640: NOT under `src/`. A test that writes into the tree another
  // test scans is the coupling -- `tmpdir()` has no scanner. The pid
  // suffix keeps concurrent runs apart, which being under `__dirname`
  // used to provide by accident.
  const testDir = join(tmpdir(), `cnx-include-discovery-${process.pid}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // findProjectRoot
  // ==========================================================================

  describe("findProjectRoot", () => {
    it.each([
      [
        "finds project root with platformio.ini",
        "platformio.ini",
        "[env:esp32]",
      ],
      ["finds project root with cnx.config.json", "cnx.config.json", "{}"],
      ["finds project root with .cnx.json", ".cnx.json", "{}"],
      ["finds project root with .cnxrc", ".cnxrc", "{}"],
      ["finds project root with package.json", "package.json", "{}"],
    ])("%s", (_label, source, source2) => {
      writeFileSync(join(testDir, source), source2);
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = projectRoot(join(testDir, "src"), NodeFileSystem.instance);

      expect(result).toBe(resolve(testDir));
    });

    it("finds project root with .git directory", () => {
      mkdirSync(join(testDir, ".git"), { recursive: true });
      mkdirSync(join(testDir, "src", "modules"), { recursive: true });

      const result = projectRoot(
        join(testDir, "src", "modules"),
        NodeFileSystem.instance,
      );

      expect(result).toBe(resolve(testDir));
    });

    it("prefers platformio.ini over other markers", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      writeFileSync(join(testDir, "cnx.config.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });

      const result = projectRoot(join(testDir, "src"), NodeFileSystem.instance);

      // Should find testDir since platformio.ini is checked first
      expect(result).toBe(resolve(testDir));
    });

    it("stops at first directory with marker", () => {
      // Inner has cnx.config.json, outer has platformio.ini
      const innerDir = join(testDir, "inner");
      mkdirSync(innerDir, { recursive: true });
      writeFileSync(join(testDir, "platformio.ini"), "[env]");
      writeFileSync(join(innerDir, "cnx.config.json"), "{}");

      const result = projectRoot(innerDir, NodeFileSystem.instance);

      expect(result).toBe(resolve(innerDir));
    });

    it("returns null when no marker found", () => {
      // Use a path that walks up to filesystem root
      // This is tricky to test - the actual repo has markers
      // We test with a mock filesystem instead
      const mockFs: IFileSystem = TestFileSystem.with({
        exists: () => false,
        isDirectory: () => true,
        isFile: () => false,
        readdir: () => [],
        stat: () => ({ mtimeMs: 0 }),
      });

      const result = projectRoot("/some/deep/path", mockFs);

      expect(result).toBeNull();
    });

    it("checks the filesystem root itself", () => {
      const mockFs: IFileSystem = TestFileSystem.with({
        exists: (path: string) => path === join("/", ".git"),
        isDirectory: () => true,
        isFile: () => false,
        readdir: () => [],
        stat: () => ({ mtimeMs: 0 }),
      });

      expect(projectRoot("/some/deep/path", mockFs)).toBe("/");
    });
  });

  // ==========================================================================
  // extractIncludesWithInfo paths
  // ==========================================================================

  describe("extractIncludesWithInfo paths", () => {
    it("extracts local includes with quotes", () => {
      const content = `
        #include "types.h"
        #include "utils/helper.h"
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toContain("types.h");
      expect(includes).toContain("utils/helper.h");
    });

    it("extracts system includes with angle brackets", () => {
      const content = `
        #include <stdio.h>
        #include <Arduino.h>
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toContain("stdio.h");
      expect(includes).toContain("Arduino.h");
    });

    it("extracts mixed include styles", () => {
      const content = `
        #include "local.h"
        #include <system.h>
        #include "another/path.h"
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toHaveLength(3);
    });

    it("handles includes with whitespace variations", () => {
      const content = `
        #include "normal.h"
        #  include "spaced.h"
        #include  "extra.h"
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toContain("normal.h");
      expect(includes).toContain("spaced.h");
      expect(includes).toContain("extra.h");
    });

    it("returns empty array for content without includes", () => {
      const content = `
        void main() {
          int x = 5;
        }
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toHaveLength(0);
    });

    it("handles nested paths", () => {
      const content = '#include "deep/nested/path/header.h"';

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toContain("deep/nested/path/header.h");
    });

    it("handles .cnx includes", () => {
      const content = '#include "shared.cnx"';

      const includes = IncludeDiscovery.extractIncludesWithInfo(content).map(
        (info) => info.path,
      );

      expect(includes).toContain("shared.cnx");
    });
  });

  // ==========================================================================
  // extractIncludesWithInfo
  // ==========================================================================

  describe("extractIncludesWithInfo", () => {
    // The corpus the scan was checked against when it replaced
    // /^\s*#\s*include\s*([<"])([^>"]+)[>"]/gm. Two behaviors are
    // deliberate rather than accidental: the closing delimiter need not match
    // the opening one, and whitespace runs may span newlines.
    it.each([
      ["a plain angle include", "#include <stdio.h>\n", [["stdio.h", false]]],
      ["a plain quoted include", '#include "local.h"\n', [["local.h", true]]],
      ["an indented include", "   #include <a.h>\n", [["a.h", false]]],
      ["space after the hash", "#   include <a.h>\n", [["a.h", false]]],
      ["no space before the delimiter", "#include<a.h>\n", [["a.h", false]]],
      ["mismatched delimiters", '#include <a.h"\n', [["a.h", false]]],
      ["the hash on its own line", "#\ninclude <a.h>\n", [["a.h", false]]],
      // Only the first is read: the second does not start its line, and the
      // original regex anchored with ^\\s* too. A directive must begin its line.
      [
        "back-to-back includes on one line",
        "#include <a.h>#include <b.h>\n",
        [["a.h", false]],
      ],
    ])("reads %s", (_label, source, expected) => {
      const result = IncludeDiscovery.extractIncludesWithInfo(source as string);
      expect(result.map((r) => [r.path, r.isLocal])).toEqual(expected);
    });

    it.each([
      ["an include not at line start", "int x; #include <a.h>\n"],
      ["an empty path", "#include <>\n"],
      ["a commented-out include", "// #include <a.h>\n"],
      ["an unterminated delimiter", "#include <unterminated"],
      ["a bare hash", "#"],
      ["the word include with no delimiter", "#include"],
    ])("reads no directive from %s", (_label, source) => {
      expect(
        IncludeDiscovery.extractIncludesWithInfo(source as string),
      ).toEqual([]);
    });

    it("identifies local includes", () => {
      const content = '#include "local.h"';

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(1);
      expect(includes[0].path).toBe("local.h");
      expect(includes[0].isLocal).toBe(true);
    });

    it("identifies system includes", () => {
      const content = "#include <system.h>";

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(1);
      expect(includes[0].path).toBe("system.h");
      expect(includes[0].isLocal).toBe(false);
    });

    it("differentiates mixed includes", () => {
      const content = `
        #include "local.h"
        #include <system.h>
        #include "another.h"
      `;

      const includes = IncludeDiscovery.extractIncludesWithInfo(content);

      expect(includes).toHaveLength(3);
      expect(includes[0].isLocal).toBe(true);
      expect(includes[1].isLocal).toBe(false);
      expect(includes[2].isLocal).toBe(true);
    });
  });

  // ==========================================================================
  // extractCnxIncludes (#1745)
  // ==========================================================================

  describe("extractCnxIncludes", () => {
    // Each case beside its opposite: a directive the grammar reads, and the
    // same text in a place the grammar does not, where the text scan above
    // read one anyway.
    it.each([
      ["a quoted include", '#include "a.cnx"\n', [["a.cnx", true]]],
      ["an angle include", "#include <stdio.h>\n", [["stdio.h", false]]],
      [
        "an include after a comment on its line",
        '/* driver */ #include "a.cnx"\n',
        [["a.cnx", true]],
      ],
      [
        "the includes around a block comment",
        '#include "a.cnx"\n/*\n#include "ghost.cnx"\n*/\n#include <b.h>\n',
        [
          ["a.cnx", true],
          ["b.h", false],
        ],
      ],
      // The grammar's token runs to its closing delimiter, so the path is
      // everything between: what 2.1 and the parser name too (#1830 review).
      [
        "a quote inside an angle include",
        '#include <a"b.h>\n',
        [['a"b.h', false]],
      ],
      [
        "an angle inside a quoted include",
        '#include "a>b.h"\n',
        [["a>b.h", true]],
      ],
    ])("reads %s", (_label, source, expected) => {
      const result = IncludeDiscovery.extractCnxIncludes(source as string);
      expect(result.map((r) => [r.path, r.isLocal])).toEqual(expected);
    });

    it.each([
      ["a block comment", '/*\n#include "ghost.cnx"\n*/\n'],
      ["a line comment", '// #include "ghost.cnx"\n'],
      ["a doc comment", '/// #include "ghost.cnx"\n'],
      ["a hash on its own line", "#\ninclude <a.h>\n"],
      ["mismatched delimiters", '#include <a.h"\n'],
      ["an empty path", "#include <>\n"],
    ])("reads no directive from %s", (_label, source) => {
      expect(IncludeDiscovery.extractCnxIncludes(source as string)).toEqual([]);
    });

    it("leaves a lexical error for 1.2 to report, printing nothing", () => {
      const printed = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        IncludeDiscovery.extractCnxIncludes("#\ninclude <a.h>\n@\n");
        expect(printed).not.toHaveBeenCalled();
      } finally {
        printed.mockRestore();
      }
    });
  });

  // ==========================================================================
  // directivesOf (#1830 review)
  // ==========================================================================

  describe("directivesOf", () => {
    const COMMENTED = '/*\n#include "ghost.h"\n*/\n';

    it("reads a .cnx file as the grammar does", () => {
      expect(IncludeDiscovery.directivesOf("lib.cnx", COMMENTED)).toEqual([]);
    });

    // Today's answer for a header, which #1829 changes: the text scan does not
    // know C's comments yet. Pinned so the branch is watched, not to bless it.
    it("reads a C header with the text scan (#1829)", () => {
      expect(IncludeDiscovery.directivesOf("lib.h", COMMENTED)).toEqual([
        { path: "ghost.h", isLocal: true },
      ]);
    });
  });

  // ==========================================================================
  // resolveInclude
  // ==========================================================================

  describe("resolveInclude", () => {
    beforeEach(() => {
      mkdirSync(join(testDir, "include"), { recursive: true });
      writeFileSync(join(testDir, "include", "types.h"), "typedef int MyInt;");
      writeFileSync(join(testDir, "include", "utils.h"), "void helper();");
    });

    it("resolves include in search path", () => {
      const result = IncludeDiscovery.resolveInclude(
        "types.h",
        [join(testDir, "include")],
        NodeFileSystem.instance,
      );

      expect(result).toBe(join(testDir, "include", "types.h"));
    });

    it("resolves an absolute path only when it names a file (#1672)", () => {
      // Every other branch of the one decision asks `exists && isFile`. An
      // absolute path naming a directory was "resolved", then dropped by
      // `discoverFile`, so it read as resolved where any other missing header
      // reads as unresolved.
      const directory = join(testDir, "include", "subdir.h");
      mkdirSync(directory);
      expect(
        IncludeDiscovery.resolveInclude(directory, [], NodeFileSystem.instance),
      ).toBeNull();
      const file = join(testDir, "include", "types.h");
      expect(
        IncludeDiscovery.resolveInclude(file, [], NodeFileSystem.instance),
      ).toBe(file);
    });

    it("returns null when include not found", () => {
      const result = IncludeDiscovery.resolveInclude(
        "nonexistent.h",
        [join(testDir, "include")],
        NodeFileSystem.instance,
      );

      expect(result).toBeNull();
    });

    it("searches paths in order", () => {
      const secondDir = join(testDir, "second");
      mkdirSync(secondDir, { recursive: true });
      writeFileSync(join(secondDir, "types.h"), "// second");

      const result = IncludeDiscovery.resolveInclude(
        "types.h",
        [join(testDir, "include"), secondDir],
        NodeFileSystem.instance,
      );

      // Should find in first search path
      expect(result).toBe(join(testDir, "include", "types.h"));
    });

    it("resolves nested paths", () => {
      mkdirSync(join(testDir, "include", "nested"), { recursive: true });
      writeFileSync(join(testDir, "include", "nested", "deep.h"), "// deep");

      const result = IncludeDiscovery.resolveInclude(
        "nested/deep.h",
        [join(testDir, "include")],
        NodeFileSystem.instance,
      );

      expect(result).toBe(join(testDir, "include", "nested", "deep.h"));
    });

    it("handles absolute paths directly", () => {
      const absolutePath = join(testDir, "include", "types.h");

      const result = IncludeDiscovery.resolveInclude(
        absolutePath,
        [],
        NodeFileSystem.instance,
      );

      expect(result).toBe(absolutePath);
    });

    it("returns null for non-existent absolute path", () => {
      const absolutePath = join(testDir, "include", "nonexistent.h");

      const result = IncludeDiscovery.resolveInclude(
        absolutePath,
        [],
        NodeFileSystem.instance,
      );

      expect(result).toBeNull();
    });

    it("skips directories (only returns files)", () => {
      mkdirSync(join(testDir, "include", "subdir"), { recursive: true });

      const result = IncludeDiscovery.resolveInclude(
        "subdir",
        [join(testDir, "include")],
        NodeFileSystem.instance,
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // discoverIncludePaths
  // ==========================================================================

  describe("discoverIncludePaths", () => {
    it("includes file's own directory", () => {
      writeFileSync(join(testDir, "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths).toContain(resolve(testDir));
    });

    it("adds common project directories when project root found", () => {
      writeFileSync(join(testDir, "cnx.config.json"), "{}");
      mkdirSync(join(testDir, "include"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths).toContain(join(testDir, "include"));
      expect(paths).toContain(join(testDir, "src"));
    });

    it("removes duplicate paths", () => {
      writeFileSync(join(testDir, "cnx.config.json"), "{}");
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      const uniquePaths = new Set(paths);
      expect(paths).toHaveLength(uniquePaths.size);
    });

    it("discovers PlatformIO library paths when platformio.ini exists", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "SomeLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(
        paths.some((p) => p.includes(".pio") && p.includes("SomeLib")),
      ).toBe(true);
    });

    it("parses lib_extra_dirs from platformio.ini", () => {
      mkdirSync(join(testDir, "extra_libs"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = extra_libs
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("extra_libs"))).toBe(true);
    });

    it("parses a CRLF platformio.ini's lib_extra_dirs (#1760 review)", () => {
      mkdirSync(join(testDir, "crlf_libs"), { recursive: true });
      mkdirSync(join(testDir, "crlf_more"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        "[env:esp32]\r\nlib_extra_dirs =\r\n    crlf_libs\r\n    crlf_more\r\n",
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.endsWith("crlf_libs"))).toBe(true);
      expect(paths.some((p) => p.endsWith("crlf_more"))).toBe(true);
    });

    it("collects every path from a multi-line lib_extra_dirs (#1181)", () => {
      // The multi-line form is what PlatformIO's own docs show for more than
      // one directory. The previous pattern captured only the first path,
      // because under /m its `$` lookahead alternative matched at the end of
      // the first line and the lazy capture stopped there.
      mkdirSync(join(testDir, "libs_one"), { recursive: true });
      mkdirSync(join(testDir, "libs_two"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs =
    libs_one
    libs_two
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("libs_one"))).toBe(true);
      expect(paths.some((p) => p.includes("libs_two"))).toBe(true);
    });

    it("stops a multi-line lib_extra_dirs at the next key (#1181)", () => {
      mkdirSync(join(testDir, "libs_one"), { recursive: true });
      mkdirSync(join(testDir, "not_a_lib_dir"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs =
    libs_one
build_flags = not_a_lib_dir
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("libs_one"))).toBe(true);
      expect(paths.some((p) => p.includes("not_a_lib_dir"))).toBe(false);
    });

    it("keeps a continuation path containing = (#1181)", () => {
      mkdirSync(join(testDir, "vendor", "lib=v2"), { recursive: true });
      mkdirSync(join(testDir, "libs_after"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs =
    vendor/lib=v2
    libs_after
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("lib=v2"))).toBe(true);
      expect(paths.some((p) => p.includes("libs_after"))).toBe(true);
    });

    it("handles comma-separated lib_extra_dirs", () => {
      mkdirSync(join(testDir, "lib1"), { recursive: true });
      mkdirSync(join(testDir, "lib2"), { recursive: true });
      // Use comma-separated format which is more reliably parsed
      writeFileSync(
        join(testDir, "platformio.ini"),
        `[env:esp32]
lib_extra_dirs = lib1, lib2
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("lib1"))).toBe(true);
      expect(paths.some((p) => p.includes("lib2"))).toBe(true);
    });

    it("handles lib_extra_dirs with comments", () => {
      mkdirSync(join(testDir, "extra"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = extra ; this is a comment
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("extra"))).toBe(true);
    });

    it("handles lib_extra_dirs with quoted paths", () => {
      mkdirSync(join(testDir, "quoted lib"), { recursive: true });
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = "quoted lib"
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("quoted lib"))).toBe(true);
    });

    it("adds no directory for an empty quoted lib_extra_dirs", () => {
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");
      const discover = (ini: string) => {
        writeFileSync(join(testDir, "platformio.ini"), ini);
        return includePaths(
          join(testDir, "src", "main.cnx"),
          NodeFileSystem.instance,
        );
      };

      // Unquoted, `""` is empty: it names no directory, not the project root
      expect(discover('[env:esp32]\nlib_extra_dirs = ""\n')).toEqual(
        discover("[env:esp32]\n"),
      );
    });
  });

  // ==========================================================================
  // PlatformIO library discovery
  // ==========================================================================

  describe("PlatformIO library discovery", () => {
    it("discovers library root directories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "Library1"), {
        recursive: true,
      });
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "Library2"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("Library1"))).toBe(true);
      expect(paths.some((p) => p.includes("Library2"))).toBe(true);
    });

    it("discovers library src subdirectories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      const libPath = join(testDir, ".pio", "libdeps", "esp32", "MyLib");
      mkdirSync(join(libPath, "src"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.endsWith("src") && p.includes("MyLib"))).toBe(
        true,
      );
    });

    it("discovers library include subdirectories", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      const libPath = join(testDir, ".pio", "libdeps", "esp32", "MyLib");
      mkdirSync(join(libPath, "include"), { recursive: true });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(
        paths.some((p) => p.endsWith("include") && p.includes("MyLib")),
      ).toBe(true);
    });

    it("handles multiple environments", () => {
      writeFileSync(
        join(testDir, "platformio.ini"),
        "[env:esp32]\n[env:teensy41]",
      );
      mkdirSync(join(testDir, ".pio", "libdeps", "esp32", "EspLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, ".pio", "libdeps", "teensy41", "TeensyLib"), {
        recursive: true,
      });
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      expect(paths.some((p) => p.includes("EspLib"))).toBe(true);
      expect(paths.some((p) => p.includes("TeensyLib"))).toBe(true);
    });
  });

  // ==========================================================================
  // Arduino library discovery
  // ==========================================================================

  describe("Arduino library discovery", () => {
    it("discovers Arduino libraries when HOME is set", () => {
      // This test is environment-dependent
      // We'll test with a mock filesystem
      const mockHome = testDir;
      const originalHome = process.env.HOME;

      try {
        process.env.HOME = mockHome;

        // Create Arduino library structure
        mkdirSync(join(mockHome, "Arduino", "libraries", "MyLib"), {
          recursive: true,
        });
        writeFileSync(join(testDir, "cnx.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = includePaths(
          join(testDir, "src", "main.cnx"),
          NodeFileSystem.instance,
        );

        expect(paths.some((p) => p.includes("MyLib"))).toBe(true);
      } finally {
        process.env.HOME = originalHome;
      }
    });

    it("discovers Arduino library src subdirectory", () => {
      const mockHome = testDir;
      const originalHome = process.env.HOME;

      try {
        process.env.HOME = mockHome;

        mkdirSync(join(mockHome, "Arduino", "libraries", "MyLib", "src"), {
          recursive: true,
        });
        writeFileSync(join(testDir, "cnx.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = includePaths(
          join(testDir, "src", "main.cnx"),
          NodeFileSystem.instance,
        );

        expect(
          paths.some((p) => p.endsWith("src") && p.includes("MyLib")),
        ).toBe(true);
      } finally {
        process.env.HOME = originalHome;
      }
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles missing .pio directory gracefully", () => {
      writeFileSync(join(testDir, "platformio.ini"), "[env:esp32]");
      // No .pio directory
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      // Should not throw
      expect(paths.length).toBeGreaterThan(0);
    });

    it("handles malformed platformio.ini gracefully", () => {
      writeFileSync(join(testDir, "platformio.ini"), "not valid ini content");
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      // Should not throw
      expect(paths.length).toBeGreaterThan(0);
    });

    it("handles non-existent lib_extra_dirs", () => {
      writeFileSync(
        join(testDir, "platformio.ini"),
        `
[env:esp32]
lib_extra_dirs = nonexistent_dir
`,
      );
      mkdirSync(join(testDir, "src"), { recursive: true });
      writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

      const paths = includePaths(
        join(testDir, "src", "main.cnx"),
        NodeFileSystem.instance,
      );

      // Should not include nonexistent dir
      expect(paths.some((p) => p.includes("nonexistent_dir"))).toBe(false);
    });

    it("handles empty HOME environment variable", () => {
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;

      try {
        delete process.env.HOME;
        delete process.env.USERPROFILE;

        writeFileSync(join(testDir, "cnx.config.json"), "{}");
        mkdirSync(join(testDir, "src"), { recursive: true });
        writeFileSync(join(testDir, "src", "main.cnx"), "void main() {}");

        const paths = includePaths(
          join(testDir, "src", "main.cnx"),
          NodeFileSystem.instance,
        );

        // Should not throw, just skip Arduino discovery
        expect(paths.length).toBeGreaterThan(0);
      } finally {
        process.env.HOME = originalHome;
        process.env.USERPROFILE = originalUserProfile;
      }
    });
  });
});
