/**
 * A generated header names a scoped cnx type by its C name, `Lib__Point`,
 * and asks which included header declares that name. The run recorded cnx
 * types by their bare name, so the answer was "none":
 *
 * - the header forward-declared `Lib__Point` after including lib.h, which
 *   defines it -- a typedef redefinition C99 forbids (MISRA C:2012 Rule 5.6);
 * - a scoped enum `Lib.Data`, recorded as `Data`, answered for a C typedef
 *   `Data` in another header, so the header included the wrong one and the C
 *   did not compile.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("a scoped type in a generated header", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnx-scoped-hdr-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  async function headerOf(files: Record<string, string>, entry: string) {
    for (const [name, text] of Object.entries(files)) {
      writeFileSync(join(project, name), text);
    }
    const result = await new Transpiler(
      {
        target: "host",
        input: join(project, entry),
        outDir: project,
        noCache: true,
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    expect(result.errors).toEqual([]);
    return (
      result.files.find((f) => f.sourcePath === join(project, entry))
        ?.headerCode ?? ""
    );
  }

  const LIB = `scope Lib {
    public struct Point {
        u32 x;
    }
}
`;

  it.each([
    ["named by its scope", "u32 xOf(Lib.Point p) {\n    return p.x;\n}\n"],
    [
      "named bare in a reopened scope",
      "scope Lib {\n    public u32 xOf(Point p) {\n        return p.x;\n    }\n}\n",
    ],
  ])(
    "comes from the header that declares it, %s, and is not declared again",
    async (_shape, body) => {
      const header = await headerOf(
        { "lib.cnx": LIB, "main.cnx": `#include "lib.cnx"\n\n${body}` },
        "main.cnx",
      );

      expect(header).toContain('#include "lib.h"');
      expect(header).not.toContain("typedef struct Lib__Point Lib__Point;");
    },
  );

  it("does not answer for a C typedef of its bare name", async () => {
    const header = await headerOf(
      {
        "h.h": "#include <stdint.h>\ntypedef struct { int16_t value; } Data;\n",
        "x.cnx": "scope Lib {\n    public enum Data { ONE, TWO }\n}\n",
        "mid.cnx": '#include "h.h"\n\nu8 midValue <- 1;\n',
        "main.cnx": `#include "x.cnx"
#include "mid.cnx"
#include "h.h"

scope Manager {
    public Data getData() {
        Data d <- { value: 0 };
        return d;
    }
}
`,
      },
      "main.cnx",
    );

    expect(header).toContain('#include "h.h"');
  });
});
