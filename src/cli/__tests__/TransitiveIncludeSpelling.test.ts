/**
 * Issue #1725: a quoted `#include` is spelled relative to the file that wrote
 * it. A generated header that needs a header its file reaches only THROUGH
 * another `.cnx` copied that other file's spelling unchanged -- relative to a
 * different directory -- so `src/main.h` said `"dev.h"` for `lib/dev.h`, and
 * gcc failed at exit 0.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";
import ToolchainDetector from "../../cnx/PARSE/2-Parse/preprocessor/ToolchainDetector";

const DEV_H = `#ifndef DEV_H
#define DEV_H
#include <stdint.h>
typedef struct { uint32_t id; } Dev;
#endif
`;

const B_CNX = `struct Pt {
    u32 x;
}
`;

const A_CNX = `#include "dev.h"
#include "b.cnx"

scope A {
    public u32 idOf(Dev d) {
        return d.id;
    }
    public u32 xOf(Pt p) {
        return p.x;
    }
}
`;

// #1881: main names `Dev`, so it includes dev.h itself -- a header's names
// are not visible through another `.cnx`'s include.
function mainIncluding(aSpelling: string): string {
  return `#include "${aSpelling}"
#include "${aSpelling.replace("a.cnx", "dev.h")}"

scope M {
    public u32 use(Dev d) {
        return A.idOf(d);
    }
    public u32 usePt(Pt p) {
        return A.xOf(p);
    }
}
`;
}

describe("a header reached through another file's include (#1725)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnx-1725-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  /** Both modes, each file's generated header, by file name. */
  async function headersOf(mainDir: string, libDir: string, aSpelling: string) {
    mkdirSync(join(project, mainDir), { recursive: true });
    mkdirSync(join(project, libDir), { recursive: true });
    writeFileSync(join(project, libDir, "dev.h"), DEV_H);
    writeFileSync(join(project, libDir, "b.cnx"), B_CNX);
    writeFileSync(join(project, libDir, "a.cnx"), A_CNX);
    const mainPath = join(project, mainDir, "main.cnx");
    const main = mainIncluding(aSpelling);
    writeFileSync(mainPath, main);

    const files = await new Transpiler(
      {
        target: "host",
        input: mainPath,
        outDir: join(project, mainDir),
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    const source = await new Transpiler(
      {
        target: "host",
        input: "",
        outDir: "",
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "source", source: main, sourcePath: mainPath });
    expect(files.errors).toEqual([]);
    expect(source.errors).toEqual([]);
    const headerOf = (result: typeof files, dir: string, name: string) =>
      result.files.find((f) => f.sourcePath === join(project, dir, name))
        ?.headerCode ?? "";
    return {
      files: headerOf(files, mainDir, "main.cnx"),
      source: headerOf(source, mainDir, "main.cnx"),
      a: headerOf(files, libDir, "a.cnx"),
    };
  }

  it("spells it from the file whose header is being written", async () => {
    const headers = await headersOf("src", "lib", "../lib/a.cnx");

    for (const main of [headers.files, headers.source]) {
      expect(main).toContain('#include "../lib/dev.h"');
      expect(main).toContain('#include "../lib/b.h"');
      expect(main).not.toContain('#include "dev.h"');
      expect(main).not.toContain('#include "b.h"');
    }
    // Control: the file that wrote the spelling keeps it, as its own.
    expect(headers.a).toContain('#include "dev.h"');
    expect(headers.a).toContain('#include "b.h"');
  });

  it("control: in one directory the spelling is the same from every file", async () => {
    const headers = await headersOf("flat", "flat", "a.cnx");

    for (const main of [headers.files, headers.source]) {
      expect(main).toContain('#include "dev.h"');
      expect(main).toContain('#include "b.h"');
    }
  });
});

/**
 * #2272/#1473: a quoted include is spelled from where the generated file that
 * carries it is written, which is where a compiler resolves it from. With
 * `--header-out` that is not the `.cnx`'s directory.
 */
describe("a quoted include spelled from the generated file (#2272)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnx-2272-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("spells each header's includes from the header's directory", async () => {
    mkdirSync(join(project, "lib"), { recursive: true });
    writeFileSync(join(project, "lib", "dev.h"), DEV_H);
    writeFileSync(join(project, "lib", "b.cnx"), B_CNX);
    writeFileSync(join(project, "lib", "a.cnx"), A_CNX);
    const mainPath = join(project, "main.cnx");
    writeFileSync(mainPath, mainIncluding("lib/a.cnx"));

    const result = await new Transpiler(
      {
        target: "host",
        input: mainPath,
        outDir: join(project, "out", "src"),
        headerOutDir: join(project, "out", "include"),
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    expect(result.errors).toEqual([]);
    const fileOf = (name: string) =>
      result.files.find((f) => f.sourcePath === join(project, name));

    // out/include/main.h
    const main = fileOf("main.cnx")?.headerCode ?? "";
    expect(main).toContain('#include "../../lib/dev.h"');
    expect(main).not.toContain('#include "dev.h"');
    expect(main).toContain('#include "lib/b.h"');
    // out/include/lib/a.h: one spelling per header (#2271 review)
    const a = fileOf("lib/a.cnx")?.headerCode ?? "";
    expect(a).toContain('#include "../../../lib/dev.h"');
    expect(a).not.toContain('#include "dev.h"');
    expect(a).toContain('#include "b.h"');
    // out/src/lib/a.c: its own C header too (#1746)
    const aSource = fileOf("lib/a.cnx")?.code ?? "";
    expect(aSource).toContain('#include "../../include/lib/a.h"');
    expect(aSource).toContain('#include "../../include/lib/b.h"');
    expect(aSource).toContain('#include "../../../lib/dev.h"');
    expect(aSource).not.toContain('#include "dev.h"');
  });
});

// #1746: a quoted C header beside the `.cnx` is named from where each
// generated file is written, so output compiles with no `-I` wherever
// `-o`/`--header-out` put it
describe("a C header beside the .cnx, wherever the output goes (#1746)", () => {
  const gcc = ToolchainDetector.fromPath("gcc", NodeFileSystem.instance);
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnx-1746-"));
    mkdirSync(join(project, "src", "lib"), { recursive: true });
    writeFileSync(join(project, "src", "lib", "dev.h"), DEV_H);
    writeFileSync(
      join(project, "src", "lib", "bitmaps.cnx"),
      "bitmap8 Ctl { En, Rest[7] }\n",
    );
    writeFileSync(
      join(project, "src", "lib", "uart.cnx"),
      `#include "dev.h"
#include "bitmaps.cnx"

scope Uart {
    public u32 put(Dev d, Ctl c) {
        return d.id;
    }
}
`,
    );
    writeFileSync(
      join(project, "src", "main.cnx"),
      '#include "lib/uart.cnx"\n\nvoid main() { }\n',
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  async function transpile(outDir: string, headerOutDir?: string) {
    const result = await new Transpiler(
      {
        target: "host",
        input: join(project, "src", "main.cnx"),
        outDir: join(project, outDir),
        ...(headerOutDir === undefined
          ? {}
          : { headerOutDir: join(project, headerOutDir) }),
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    expect(result.errors).toEqual([]);
    return result;
  }

  /** The include lines a generated file carries */
  const includesOf = (code: string | null | undefined) =>
    (code ?? "").split("\n").filter((line) => line.startsWith("#include"));

  /** Every written `.c` compiles with no `-I` */
  function compilesAlone(written: readonly string[]): void {
    for (const file of written.filter((f) => f.endsWith(".c"))) {
      execFileSync(gcc!.cc, ["-std=c99", "-fsyntax-only", file]);
    }
  }

  const layouts: [string, string, string | undefined, string][] = [
    ["beside the source (control)", "src", undefined, '"dev.h"'],
    ["with -o", "out", undefined, '"../../src/lib/dev.h"'],
    [
      "with -o and --header-out at another depth",
      "out/build",
      "out/inc/x",
      '"../../../../src/lib/dev.h"',
    ],
  ];

  it.each(layouts)(
    "names it once %s",
    async (_, outDir, headerOutDir, devInHeader) => {
      const result = await transpile(outDir, headerOutDir);
      const uart = result.files.find((f) =>
        f.sourcePath.endsWith(join("lib", "uart.cnx")),
      );
      const devLines = includesOf(uart?.headerCode).filter((line) =>
        line.includes("dev.h"),
      );
      expect(devLines).toEqual([`#include ${devInHeader}`]);
      expect(
        includesOf(uart?.code).filter((line) => line.includes("dev.h")),
      ).toHaveLength(1);
    },
  );

  it.skipIf(gcc === null).each(layouts)(
    "compiles with no -I %s",
    async (_, outDir, headerOutDir) => {
      const result = await transpile(outDir, headerOutDir);
      compilesAlone(result.outputFiles);
    },
  );
});
