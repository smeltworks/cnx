import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import Discover from "../../../../../cnx/PARSE/1-Discover/Discover";
import Preprocessor from "../../../../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import RunAnchor from "../../../../../cnx/PARSE/1-Discover/RunAnchor";
import EFileType from "../../../../../cnx/PARSE/1-Discover/types/EFileType";
import MockFileSystem from "../../../MockFileSystem";
import type ISourceGraph from "../../../../../cnx/PARSE/1-Discover/types/ISourceGraph";
import type TTranspileInput from "../../../../../cnx/types/TTranspileInput";

/**
 * #1444 box 1: 1.1 Discover emits a `SourceGraph` carrying the file set, each
 * file's kind, the include edges, topological order and resolved absolute
 * paths, frozen at the end of 1.1.
 */
describe("Discover", () => {
  let fs: MockFileSystem;

  // #1844: a run with headers needs a preprocessor. This one hands back the
  // header as written, which is what a C compile meets in these headers.
  // #2166: a developer's export must not decide what a run's anchor names
  const exported = {
    CNX_CROSS_COMPILER: process.env.CNX_CROSS_COMPILER,
  };

  beforeEach(() => {
    delete process.env.CNX_CROSS_COMPILER;
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(true);
    vi.spyOn(Preprocessor.prototype, "preprocess").mockImplementation(
      async (file: string) => ({
        content: fs.readFile(file),
        sourceMappings: [],
        success: true,
        originalFile: file,
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [name, value] of Object.entries(exported)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const noIncludeDirs: string[] = [];
  const settings = {
    input: "/proj/src/app.cnx",
    includeDirs: noIncludeDirs,
    defines: { BOARD: "uno" },
    outDir: "",
    debugMode: false,
  };

  /** `app.cnx` includes `lib.cnx` and a C header; the header includes nothing. */
  function project(): MockFileSystem {
    return new MockFileSystem()
      .addFile(
        "/proj/src/app.cnx",
        '#include "lib.cnx"\n#include "board.h"\n\nvoid main() { }\n',
      )
      .addFile("/proj/src/lib.cnx", "u32 twice(u32 v) { return v * 2; }\n")
      .addFile("/proj/src/board.h", "#define LED 13\n");
  }

  async function discover(files: MockFileSystem): Promise<{
    graph: ISourceGraph;
    warnings: string[];
  }> {
    fs = files;
    const warnings: string[] = [];
    const anchor = RunAnchor.at(settings.input, null, settings, fs);
    const { graph } = Discover.run(
      { kind: "files" },
      anchor,
      settings,
      fs,
      warnings,
    );
    return { graph, warnings };
  }

  // #1991: 1.1 reads the target catalog, so no later stage reads the disk for it
  it("carries the target catalog's text and path", async () => {
    const { graph } = await discover(project());

    expect(graph.targetCatalog.path).toMatch(/targets[\\/]targets\.cnx$/);
    expect(graph.targetCatalog.text).toBe(
      fs.readFile(graph.targetCatalog.path),
    );
    expect(graph.targetCatalog.text.length).toBeGreaterThan(0);
  });

  // #1991: 1.1 names every output path, so no later stage asks PathResolver
  it("names each file's output paths, below its input directory", async () => {
    fs = new MockFileSystem()
      .addFile("/proj/app.cnx", '#include "src/lib.cnx"\n\nvoid main() { }\n')
      .addFile("/proj/src/lib.cnx", "u32 twice(u32 v) { return v * 2; }\n");
    const tree = { ...settings, input: "/proj/app.cnx", outDir: "/out" };
    const anchor = RunAnchor.at(tree.input, null, tree, fs);
    const { graph } = Discover.run({ kind: "files" }, anchor, tree, fs, []);

    expect(graph.outputs.c.get("/proj/src/lib.cnx")).toEqual({
      selfInclude: "lib.h",
      source: "/out/src/lib.c",
      header: "/out/src/lib.h",
    });
  });

  // #2272/#1473: a quoted include is spelled from where each generated file is
  // written, so a nested file's output does not depend on its entry
  it("spells a nested file's sibling include relative to its own output", async () => {
    fs = new MockFileSystem()
      .addFile("/proj/app.cnx", '#include "lib/a.cnx"\n\nvoid main() { }\n')
      .addFile("/proj/lib/a.cnx", '#include "b.cnx"\n\nu8 A <- 1;\n')
      .addFile("/proj/lib/b.cnx", "u8 B <- 2;\n");
    const split = {
      ...settings,
      input: "/proj/app.cnx",
      outDir: "/out/src",
      headerOutDir: "/out/include",
    };
    const anchor = RunAnchor.at(split.input, null, split, fs);
    const { graph } = Discover.run({ kind: "files" }, anchor, split, fs, []);

    const nested = graph.includes.c.get("/proj/lib/a.cnx");
    expect(nested?.headerIncludeDirectives.get("/proj/lib/b.cnx")).toBe(
      '#include "b.h"',
    );
    expect(nested?.userIncludes).toEqual(['#include "b.h"']);
    expect(nested?.includeRewrites.get("b.cnx")).toBe("../../include/lib/b.h");
    expect(nested?.generatedHeaderDirectory).toBe("/out/include/lib");
    expect(graph.outputs.c.get("/proj/lib/a.cnx")?.selfInclude).toBe(
      "../../include/lib/a.h",
    );
    expect(graph.includes.c.get("/proj/app.cnx")?.includeRewrites).toEqual(
      new Map([["lib/a.cnx", "../include/lib/a.h"]]),
    );
  });

  it("orders the files so each follows the files it includes", async () => {
    const { graph } = await discover(project());

    expect(graph.cnxFiles.map((file) => file.path)).toEqual([
      "/proj/src/lib.cnx",
      "/proj/src/app.cnx",
    ]);
  });

  it("carries each file's kind, its edges and the text it was read from", async () => {
    const { graph } = await discover(project());
    const byPath = new Map(graph.cnxFiles.map((file) => [file.path, file]));
    const app = byPath.get("/proj/src/app.cnx");
    const lib = byPath.get("/proj/src/lib.cnx");
    if (app === undefined || lib === undefined) {
      throw new Error("both files are discovered");
    }

    expect(app.discoveredFile.type).toBe(EFileType.Cnx);
    expect(app.cnxIncludes.map((include) => include.path)).toEqual([
      "/proj/src/lib.cnx",
    ]);
    expect(lib.cnxIncludes).toEqual([]);
    expect(app.source).toContain('#include "lib.cnx"');
    // The header is the file's edge to C, which is what E0426/E0427 decline on
    expect(app.includesForeignHeader).toBe(true);
    expect(lib.includesForeignHeader).toBe(false);
    expect(graph.headerFiles.map((header) => header.path)).toEqual([
      "/proj/src/board.h",
    ]);
  });

  it("records each file's include facts, in the order it visited them", async () => {
    const { graph } = await discover(project());

    // Visit order, not `cnxFiles`' dependency order (see `ISourceGraph`)
    expect([...graph.includes.c.keys()]).toEqual([
      "/proj/src/app.cnx",
      "/proj/src/lib.cnx",
    ]);
    const app = graph.includes.c.get("/proj/src/app.cnx");
    expect(app?.resolutions.get('#include "lib.cnx"')).toBe(
      "/proj/src/lib.cnx",
    );
    expect(app?.resolutions.get('#include "board.h"')).toBe(
      "/proj/src/board.h",
    );
    expect(app?.quotedIncludeDirectory).toBe("/proj/src");
    expect(app?.includeRewrites.get("lib.cnx")).toBe("lib.h");
  });

  // #1881: C includes are textual, so a header a file includes brings in the
  // headers it includes; another `.cnx` file's headers are not brought in
  it("keeps the headers a file's own C includes bring in, nested ones too", async () => {
    const { graph } = await discover(
      project()
        .addFile("/proj/src/board.h", '#include "pins.h"\n#define LED 13\n')
        .addFile("/proj/src/pins.h", "typedef unsigned pin_t;\n")
        .addFile("/proj/src/lib.cnx", '#include "hw.h"\nu32 one <- 1;\n')
        .addFile("/proj/src/hw.h", "void hw(void);\n"),
    );

    const reached = (path: string) =>
      [...(graph.includes.c.get(path)?.cHeaderPaths ?? [])].sort();
    expect(reached("/proj/src/app.cnx")).toEqual([
      "/proj/src/board.h",
      "/proj/src/pins.h",
    ]);
    expect(reached("/proj/src/lib.cnx")).toEqual(["/proj/src/hw.h"]);
  });

  it("carries the anchor's facts", async () => {
    const { graph } = await discover(project());

    expect(graph.anchor).toEqual({
      directory: "/proj/src",
      projectRoot: undefined,
      defines: { BOARD: "uno" },
      platformio: null,
      configuredCompiler: null,
    });
  });

  it("is frozen when discovery ends", async () => {
    const { graph } = await discover(project());

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.cnxFiles)).toBe(true);
    expect(graph.cnxFiles.every((file) => Object.isFrozen(file))).toBe(true);
    expect(Object.isFrozen(graph.headerFiles)).toBe(true);
    expect(Object.isFrozen(graph.includeSearchPaths)).toBe(true);
    expect(
      [...graph.includes.c.values()].every((facts) => Object.isFrozen(facts)),
    ).toBe(true);
    expect(Object.isFrozen(graph.anchor)).toBe(true);
  });

  it("is frozen all the way down, not just the records (#1444 review)", async () => {
    const { graph } = await discover(project());
    const app = graph.cnxFiles.find(
      (file) => file.path === "/proj/src/app.cnx",
    );

    expect(Object.isFrozen(app?.discoveredFile)).toBe(true);
    expect(Object.isFrozen(app?.cnxIncludes)).toBe(true);
    expect(Object.isFrozen(app?.cnxIncludes[0])).toBe(true);
    expect(Object.isFrozen(graph.headerFiles[0])).toBe(true);
    // The `RunAnchor`'s own object, which the next run at this anchor reuses
    expect(Object.isFrozen(graph.anchor.defines)).toBe(true);
  });

  it("has no files when the entry is not cnx", async () => {
    const fs = new MockFileSystem().addFile("/proj/src/readme.txt", "hello");
    const warnings: string[] = [];
    const notCnx = { ...settings, input: "/proj/src/readme.txt" };

    const { graph } = Discover.run(
      { kind: "files" },
      RunAnchor.at(notCnx.input, null, notCnx, fs),
      notCnx,
      fs,
      warnings,
    );

    expect(graph.cnxFiles).toEqual([]);
    expect(graph.includes.c.size).toBe(0);
  });

  // #2165: every project-root walk reports the old-name configs it passes
  describe("the cross compiler variable (#2166)", () => {
    function run(input: TTranspileInput = { kind: "files" }) {
      fs = project();
      return Discover.run(
        input,
        RunAnchor.at(settings.input, null, settings, fs),
        settings,
        fs,
        [],
      );
    }

    it("names the compiler CNX_CROSS_COMPILER sets", () => {
      process.env.CNX_CROSS_COMPILER = "xtensa-esp32-elf-gcc";

      const { graph, errors } = run();

      expect(errors).toEqual([]);
      expect(graph.anchor.configuredCompiler).toBe("xtensa-esp32-elf-gcc");
    });

    it("names none when it is empty", () => {
      process.env.CNX_CROSS_COMPILER = "";

      expect(run().graph.anchor.configuredCompiler).toBeNull();
    });
  });

  // #2221 review: the root is walked again on every run, so a marker created
  // between runs moves it, and an unchanged root keeps the anchor
  describe("the anchor's project root across runs", () => {
    it("follows a marker created between runs, at the same anchor", () => {
      fs = project();
      const anchor = RunAnchor.at(settings.input, null, settings, fs);
      const first = Discover.run({ kind: "files" }, anchor, settings, fs, []);
      fs.addFile("/proj/cnx.config.json", "{}");

      const second = Discover.run(
        { kind: "files" },
        first.anchor,
        settings,
        fs,
        [],
      );

      expect(first.errors).toEqual([]);
      expect(second.errors).toEqual([]);
      expect(first.anchor.projectRoot).toBeUndefined();
      expect(second.anchor.projectRoot).toBe("/proj");
    });

    it("keeps the anchor while its project root is unchanged", () => {
      fs = project().addFile("/proj/cnx.config.json", "{}");
      const anchor = RunAnchor.at(settings.input, null, settings, fs);
      const first = Discover.run({ kind: "files" }, anchor, settings, fs, []);

      const second = Discover.run(
        { kind: "files" },
        first.anchor,
        settings,
        fs,
        [],
      );

      expect(first.anchor.projectRoot).toBe("/proj");
      expect(second.anchor).toBe(first.anchor);
    });
  });
});
