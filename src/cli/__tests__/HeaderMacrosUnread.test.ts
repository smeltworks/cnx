/**
 * #1688 review (owner ruling 2026-10-05): when a file's C includes' macros
 * cannot be read -- a header its own unit cannot preprocess -- a name nothing
 * declares may be a float macro, so beside an integer it is unreadable and
 * asks for a cast, instead of silently reaching the integer clamp helper.
 *
 * #1844: a run without a preprocessor no longer reaches that question. Each
 * header's language is judged on its preprocessed text, so the run is E0516.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import Preprocessor from "../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import ExternalDeclarationOracle from "../../cnx/PARSE/2-Parse/preprocessor/ExternalDeclarationOracle";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

const HEADER = "#define SCALE_F 2.5f\nextern float gain;\n";

describe("header macros a file's preprocessing could not read (#1688)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-1688-"));
    writeFileSync(join(dir, "m.h"), HEADER);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  async function codesOf(operand: string) {
    writeFileSync(
      join(dir, "main.cnx"),
      `#include "m.h"\nf32 f() {\n    u32 i <- 3;\n    f32 x <- i * ${operand};\n    return x;\n}\n`,
    );
    const result = await new Transpiler(
      {
        input: join(dir, "main.cnx"),
        includeDirs: [dir],
        outDir: join(dir, "out"),
        noCache: true,
        target: "host",
      },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });
    return [...JSON.stringify(result.errors).matchAll(/E0[58]\d\d/g)].map(
      (m) => m[0],
    );
  }

  it("asks for a cast when the file's unit cannot be preprocessed", async () => {
    vi.spyOn(ExternalDeclarationOracle, "macroDump").mockResolvedValue({
      dump: "",
      visible: new Set<string>(),
      complete: false,
    });
    expect(await codesOf("SCALE_F")).toEqual(["E0811"]);
  });

  it("rejects the run when no preprocessor is available", async () => {
    vi.spyOn(Preprocessor.prototype, "isAvailable").mockReturnValue(false);
    expect(await codesOf("SCALE_F")).toEqual(["E0516"]);
  });

  it("control: a name the header declares keeps its type", async () => {
    vi.spyOn(ExternalDeclarationOracle, "macroDump").mockResolvedValue({
      dump: "",
      visible: new Set<string>(),
      complete: false,
    });
    expect(await codesOf("gain")).toEqual(["E0810"]);
  });
});
