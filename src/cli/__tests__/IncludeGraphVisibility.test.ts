/**
 * Issue #1435: what a file can SEE is the include graph discovery resolved.
 *
 * Discovery resolves every `.cnx` include with the full search policy (the
 * file's directory, the project tiers, PlatformIO libdeps, Arduino libraries)
 * through the injected `IFileSystem`. Visibility must read that same graph. A
 * second derivation that re-reads files and rebuilds a weaker search path
 * compiles a file and then reports its types as "not defined" to the file that
 * included it.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

const COLORS = `enum EColor { RED, GREEN, BLUE }
`;

const MAIN_USES_ENUM = `#include <colors.cnx>

void main() {
    EColor c <- EColor.GREEN;
}
`;

describe("include-graph visibility (Issue #1435)", () => {
  describe("PlatformIO libdeps", () => {
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-"));
      writeFileSync(
        join(project, "platformio.ini"),
        "[env:teensy41]\nplatform = teensy\n",
      );
      mkdirSync(join(project, "src"));
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    async function transpileMain() {
      const mainPath = join(project, "src", "main.cnx");
      writeFileSync(mainPath, MAIN_USES_ENUM);
      // An explicit outDir: without one the run writes into the cwd (#1705).
      const result = await new Transpiler(
        {
          target: "host",
          input: mainPath,
          outDir: join(project, "build"),
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({ kind: "files" });
      return {
        result,
        main: result.files.find((f) => f.sourcePath === mainPath),
      };
    }

    it("an enum declared in a .pio/libdeps include is visible to the includer", async () => {
      const lib = join(project, ".pio", "libdeps", "teensy41", "colors", "src");
      mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, "colors.cnx"), COLORS);

      const { result, main } = await transpileMain();

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("control: the same include beside the includer", async () => {
      writeFileSync(join(project, "src", "colors.cnx"), COLORS);

      const { result, main } = await transpileMain();

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an in-memory root resolves a .pio/libdeps include as its file on disk does", async () => {
      const lib = join(project, ".pio", "libdeps", "teensy41", "colors", "src");
      mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, "colors.cnx"), COLORS);
      const mainPath = join(project, "src", "main.cnx");

      // Exactly how `ServeCommand` (the editor preview) calls it.
      const result = await new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({
        kind: "source",
        source: MAIN_USES_ENUM,
        sourcePath: mainPath,
      });

      expect(result.errors).toEqual([]);
      expect(
        result.files.find((f) => f.sourcePath === mainPath)?.code,
      ).toContain("EColor c = EColor__GREEN;");
    });

    it("text with no path discovers the project's tiers from its workingDir, and so does an empty path", async () => {
      const lib = join(project, ".pio", "libdeps", "teensy41", "colors", "src");
      mkdirSync(lib, { recursive: true });
      writeFileSync(join(lib, "colors.cnx"), COLORS);

      for (const sourcePath of [undefined, ""]) {
        const result = await new Transpiler(
          {
            target: "host",
            input: "",
            outDir: "",
            noCache: true,
          },
          NodeFileSystem.instance,
        ).transpile({
          kind: "source",
          source: MAIN_USES_ENUM,
          workingDir: project,
          sourcePath,
        });

        expect(result.errors).toEqual([]);
        expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
      }
    });
  });

  describe("a C header named like a cnx file of the run", () => {
    // A vendor header is not the generated header of a .cnx because they
    // share a basename: `uart.cnx` wrapping `<driver/uart.h>` is the normal
    // ESP-IDF shape. A generated header carries the cnx marker, and that is
    // what identifies it.
    const VENDOR_UART = `#ifndef DRIVER_UART_H
#define DRIVER_UART_H
#include <stdint.h>
void uart_init(uint32_t baud);
#endif
`;
    const USES_VENDOR = `#include <driver/uart.h>

void setup() {
    uart_init(115200);
}
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-hdr-"));
      mkdirSync(join(project, "vendor", "driver"), { recursive: true });
      writeFileSync(join(project, "vendor", "driver", "uart.h"), VENDOR_UART);
      mkdirSync(join(project, "src"));
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    async function bothModes(name: string, text = USES_VENDOR) {
      const path = join(project, "src", name);
      writeFileSync(path, text);
      const config = {
        includeDirs: [join(project, "vendor")],
        outDir: join(project, "build"),
        noCache: true,
      };
      const files = await new Transpiler(
        {
          target: "host",
          ...config,
          input: path,
        },
        NodeFileSystem.instance,
      ).transpile({
        kind: "files",
      });
      const source = await new Transpiler(
        {
          target: "host",
          ...config,
          input: "",
        },
        NodeFileSystem.instance,
      ).transpile({
        kind: "source",
        source: text,
        workingDir: join(project, "src"),
        sourcePath: path,
      });
      return { files, source };
    }

    it("is read as the C header it is, in both modes", async () => {
      const { files, source } = await bothModes("uart.cnx");

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    it("control: the same program under another name", async () => {
      const { files, source } = await bothModes("serial.cnx");

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    // `uart.cnx` owns `Reading`, and the header on the path defines the same
    // type, as the header generated from it does. Read as input, that header
    // is a second definition (E0425). A struct, not an `extern` variable: a C
    // declaration of a variable cnx defines is not a conflict, and a guard
    // that relied on one would go silent when E0425 stops over-reporting it
    // (#1707).
    const OWNS_READING = `#include <driver/uart.h>

struct Reading {
    i32 raw;
}
`;
    const DEFINES_READING = `#include <stdint.h>
typedef struct Reading { int32_t raw; } Reading;
`;

    it("a header the transpiler generated is not read as input", async () => {
      writeFileSync(
        join(project, "vendor", "driver", "uart.h"),
        `/**\n * generated by cnx from: uart.cnx\n */\n${DEFINES_READING}`,
      );

      const { files, source } = await bothModes("uart.cnx", OWNS_READING);

      expect(files.errors).toEqual([]);
      expect(source.errors).toEqual([]);
    });

    it("control: the same header, hand-written, is read -- and conflicts", async () => {
      writeFileSync(
        join(project, "vendor", "driver", "uart.h"),
        DEFINES_READING,
      );

      const { files, source } = await bothModes("uart.cnx", OWNS_READING);

      for (const result of [files, source]) {
        expect(result.errors.map((e) => e.message).join("\n")).toMatch(
          /E0425.*'Reading'/,
        );
      }
    });

    // A file that includes the wrapper and names a vendor type in its own
    // signature needs the vendor header in its own header. It includes that
    // header itself, as it must to name the type (#1881). Emission dropped
    // an external header whose basename matched one of the file's includes,
    // so `<driver/uart.h>` read as uart.cnx's "uart.h": exit 0, and a header
    // no compiler accepts. `serial.cnx` differs only by that basename.
    it.each(["uart.cnx", "serial.cnx"])(
      "a file using a vendor type through %s names the vendor header",
      async (wrapper) => {
        writeFileSync(
          join(project, "vendor", "driver", "uart.h"),
          "#include <stdint.h>\ntypedef struct { uint32_t baud; } uart_config_t;\nvoid uart_init(uint32_t baud);\n",
        );
        writeFileSync(join(project, "src", wrapper), USES_VENDOR);

        const { files, source } = await bothModes(
          "main.cnx",
          `#include "${wrapper}"\n#include <driver/uart.h>\n\nu32 baudOf(uart_config_t cfg) {\n    return cfg.baud;\n}\n`,
        );

        for (const result of [files, source]) {
          expect(result.errors).toEqual([]);
          expect(
            result.files.find(
              (f) => f.sourcePath === join(project, "src", "main.cnx"),
            )?.headerCode,
          ).toContain("#include <driver/uart.h>");
        }
      },
    );
  });

  describe("an in-memory root's directory is one decision", () => {
    // ADR-010: a quoted include resolves from the file it appears in. Text
    // given a path lives at that path, resolved as the root's identity is;
    // `workingDir` is where text with no path resolves from. Discovery (which files enter the run) and E0506
    // (which quoted includes are missing) must both use that one directory:
    // when they disagreed, a missing include read as a foreign header, E0426
    // declined, and cnx member syntax reached the C output at exit 0.
    const QUOTED = `#include "colors.cnx"

void main() {
    EColor c <- EColor.GREEN;
}
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-dir-"));
      mkdirSync(join(project, "proj"));
      mkdirSync(join(project, "other"));
      writeFileSync(join(project, "proj", "colors.cnx"), COLORS);
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    function transpile(where: { workingDir?: string; sourcePath?: string }) {
      return new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({
        kind: "source",
        source: QUOTED,
        ...where,
      });
    }

    it("a workingDir with no sourcePath resolves quoted includes there", async () => {
      const result = await transpile({ workingDir: join(project, "proj") });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("a sourcePath with no workingDir resolves quoted includes beside it", async () => {
      const result = await transpile({
        sourcePath: join(project, "proj", "main.cnx"),
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("a sourcePath decides the directory, whatever the workingDir", async () => {
      // `scripts/format-fidelity.ts` passed the repository root as workingDir
      // and a fixture's absolute path as sourcePath.
      const result = await transpile({
        workingDir: join(project, "other"),
        sourcePath: join(project, "proj", "main.cnx"),
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    /**
     * Run from inside the project, so a relative path climbs nothing: a path
     * that climbs to `/` hides a second resolution, because `resolve` clamps
     * at the root and lands on the right file by accident.
     */
    async function fromProject<T>(run: () => Promise<T>): Promise<T> {
      const cwd = process.cwd();
      process.chdir(project);
      try {
        return await run();
      } finally {
        process.chdir(cwd);
      }
    }

    it("a relative sourcePath resolves once, as the file's identity does", async () => {
      // The editor's shape: ServeCommand passed the path it was sent AND
      // `workingDir: dirname(path)`, so resolving a relative path against the
      // workingDir took its directory twice (`proj/proj`).
      const result = await fromProject(() =>
        transpile({ workingDir: "proj", sourcePath: "proj/main.cnx" }),
      );

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("a cycle back to a root given by a relative path is an edge, not a second file", async () => {
      writeFileSync(
        join(project, "proj", "colors.cnx"),
        `#include "main.cnx"\n\n${COLORS}`,
      );
      writeFileSync(join(project, "proj", "main.cnx"), QUOTED);

      const result = await fromProject(() =>
        transpile({
          workingDir: join(project, "other"),
          sourcePath: "proj/main.cnx",
        }),
      );

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an empty sourcePath is no path: the workingDir decides", async () => {
      const result = await transpile({
        workingDir: join(project, "proj"),
        sourcePath: "",
      });

      expect(result.errors).toEqual([]);
      expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("an include missing beside the sourcePath is E0506, not cnx in the C", async () => {
      const result = await transpile({
        workingDir: join(project, "proj"),
        sourcePath: join(project, "other", "main.cnx"),
      });

      expect(result.errors.map((e) => e.message).join("\n")).toContain("E0506");
      expect(result.files.map((f) => f.code).join("\n")).not.toContain(
        "EColor.GREEN",
      );
    });
  });

  describe("a missing cnx include inside an included file", () => {
    // A `.cnx` include that resolves to nothing is not a C or C++ header. It
    // counted as one, and once reaching a header became transitive a missing
    // include in an INCLUDED file -- which a source run does not analyze, so
    // nothing reported it -- switched the root's E0426 off, and cnx member
    // syntax reached the C output at exit 0.
    const ROOT = `#include "a.cnx"

void main() {
    EColor c <- EColor.GREEN;
}
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-gone-"));
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    /** Exactly how `ServeCommand` (the editor preview) calls it. */
    function preview(included: string) {
      writeFileSync(
        join(project, "a.cnx"),
        `${included}\n\nu8 fa() {\n    return 1;\n}\n`,
      );
      return new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({
        kind: "source",
        source: ROOT,
        sourcePath: join(project, "main.cnx"),
      });
    }

    it.each(['#include "b.cnx"', "#include <b.cnx>"])(
      "%s, missing, leaves the includer's E0426 on",
      async (include) => {
        const result = await preview(include);

        expect(result.errors.map((e) => e.message).join("\n")).toContain(
          "E0426",
        );
        expect(result.files.map((f) => f.code).join("\n")).not.toContain(
          "EColor.GREEN",
        );
      },
    );

    // #1881: a C header's names are visible only in a file that includes it
    // itself, so one the included file includes does not exempt the root.
    it("a C header reached only through the included file leaves E0426 on", async () => {
      writeFileSync(join(project, "real.h"), "#define REAL_MAX 3\n");

      const result = await preview('#include "real.h"');

      expect(result.errors.map((e) => e.message).join("\n")).toContain("E0426");
    });
  });

  describe("a source run's includeDirs", () => {
    // The caller's include directories for the RUN, as `config.includeDirs`
    // are: a file the root includes resolves its own includes through them
    // too. They reached the root alone, so lib.cnx's `<util.cnx>` resolved
    // nowhere and the root could not see EColor.
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-dirs-"));
      mkdirSync(join(project, "a"));
      mkdirSync(join(project, "b"));
      writeFileSync(join(project, "a", "lib.cnx"), "#include <util.cnx>\n");
      writeFileSync(join(project, "b", "util.cnx"), COLORS);
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    it("reach the files the root includes, as config.includeDirs do", async () => {
      const dirs = [join(project, "a"), join(project, "b")];
      const input = {
        kind: "source" as const,
        source: MAIN_USES_ENUM.replace("<colors.cnx>", "<lib.cnx>"),
        sourcePath: join(project, "main.cnx"),
      };

      const fromInput = await new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({ ...input, includeDirs: dirs });
      const fromConfig = await new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
          includeDirs: dirs,
        },
        NodeFileSystem.instance,
      ).transpile(input);

      for (const result of [fromInput, fromConfig]) {
        expect(result.errors).toEqual([]);
        expect(result.files[0]?.code).toContain("EColor c = EColor__GREEN;");
      }
    });
  });

  describe("a generated header spells a C include as its own file does", () => {
    // A quoted include is relative to the file that writes it, so "dev.h" in
    // lib/a.cnx and "../lib/dev.h" in src/main.cnx name one header. The spelling
    // used to be stored once per run, last writer wins, so main.h could get
    // a.cnx's "dev.h" -- which names src/dev.h, which does not exist.
    const DEV_H = `#ifndef DEV_H
#define DEV_H
#include <stdint.h>
typedef struct { uint32_t id; } Dev;
#endif
`;
    let project: string;

    beforeEach(() => {
      project = mkdtempSync(join(tmpdir(), "cnx-1435-spell-"));
      mkdirSync(join(project, "lib"));
      mkdirSync(join(project, "src"));
      writeFileSync(join(project, "lib", "dev.h"), DEV_H);
      writeFileSync(
        join(project, "lib", "a.cnx"),
        `#include "dev.h"\n\nscope A {\n    public u32 idOf(Dev d) {\n        return d.id;\n    }\n}\n`,
      );
    });

    afterEach(() => {
      rmSync(project, { recursive: true, force: true });
    });

    const MAIN = `#include "../lib/dev.h"
#include "../lib/a.cnx"

scope M {
    public u32 use(Dev d) {
        return A.idOf(d);
    }
}
`;

    function includesOf(header: string | undefined): string[] {
      return (header ?? "").split("\n").filter((l) => l.startsWith("#include"));
    }

    it("in files mode, each header keeps its own file's spelling", async () => {
      const mainPath = join(project, "src", "main.cnx");
      writeFileSync(mainPath, MAIN);

      const result = await new Transpiler(
        {
          target: "host",
          input: mainPath,
          outDir: join(project, "src"),
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({ kind: "files" });

      expect(result.errors).toEqual([]);
      const byPath = (p: string) =>
        includesOf(result.files.find((f) => f.sourcePath === p)?.headerCode);
      expect(byPath(mainPath)).toContain('#include "../lib/dev.h"');
      expect(byPath(mainPath)).not.toContain('#include "dev.h"');
      // control: a.cnx's own spelling is right for a.h
      expect(byPath(join(project, "lib", "a.cnx"))).toContain(
        '#include "dev.h"',
      );
    });

    it("in source mode, the root's header keeps its own spelling", async () => {
      const mainPath = join(project, "src", "main.cnx");

      const result = await new Transpiler(
        {
          target: "host",
          input: "",
          outDir: "",
          noCache: true,
        },
        NodeFileSystem.instance,
      ).transpile({ kind: "source", source: MAIN, sourcePath: mainPath });

      expect(result.errors).toEqual([]);
      const header = includesOf(result.files[0]?.headerCode);
      expect(header).toContain('#include "../lib/dev.h"');
      expect(header).not.toContain('#include "dev.h"');
    });
  });

  describe("an injected IFileSystem", () => {
    let fs: MockFileSystem;

    beforeEach(() => {
      fs = new MockFileSystem();
      fs.addFile("/vfs/src/colors.cnx", COLORS);
    });

    async function transpile(main: string) {
      fs.addFile("/vfs/src/main.cnx", main);
      const result = await new Transpiler(
        {
          input: "/vfs/src/main.cnx",
          outDir: "/vfs/build",
          noCache: true,
          target: "host",
        },
        fs,
      ).transpile({ kind: "files" });
      return {
        result,
        main: result.files.find((f) => f.sourcePath === "/vfs/src/main.cnx"),
      };
    }

    it("an enum from a nested include is visible when no file is on disk", async () => {
      const { result, main } = await transpile(MAIN_USES_ENUM);

      expect(result.errors).toEqual([]);
      expect(main?.code).toContain("EColor c = EColor__GREEN;");
    });

    it("control: discovery itself reads the injected filesystem", async () => {
      const { result } = await transpile(`#include <colors.cnx>

void main() {
}
`);

      expect(result.errors).toEqual([]);
      expect(result.files.map((f) => f.sourcePath).sort()).toEqual([
        "/vfs/src/colors.cnx",
        "/vfs/src/main.cnx",
      ]);
    });
  });
});
