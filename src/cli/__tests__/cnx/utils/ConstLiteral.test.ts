/**
 * #2372: a const of a cast character is a C constant expression, cast as
 * written, so a static initializer that reads it compiles.
 */

import { describe, expect, it } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

async function transpileSource(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", target: "host" },
    NodeFileSystem.instance,
  );
  const result = (await transpiler.transpile({ kind: "source", source }))
    .files[0];
  expect(result.errors).toEqual([]);
  return result.code;
}

describe("ConstLiteral", () => {
  it("spells a cast character const as its cast, once", async () => {
    const code = await transpileSource(
      "u8 CH <- (u8)'A';\nu8 first <- CH;\nvoid main() { }\n",
    );
    expect(code).toContain("const uint8_t CH = (uint8_t)'A';");
    expect(code).toContain("const uint8_t first = (uint8_t)'A';");
  });
});
