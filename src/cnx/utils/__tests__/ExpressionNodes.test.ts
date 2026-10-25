import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import DeclarationParts from "../DeclarationParts";
import ExpressionNodes from "../ExpressionNodes";

/** The identifiers ExpressionNodes reaches in the file's first declaration */
const names = (source: string): string[] => {
  const parsed = CnxSourceParser.parse(source);
  expect(parsed.parseErrors).toEqual([]);
  return DeclarationParts.of(parsed.program.members[0].declaration)
    .flatMap(ExpressionNodes.of)
    .flatMap((e) => (e.kind === "identifier" ? [e.name] : []));
};

describe("ExpressionNodes", () => {
  it("reaches nested operands and call arguments", () => {
    expect(names("u32 n <- a + f(b);\n").sort()).toEqual(["a", "b", "f"]);
  });

  it("reaches a dimension inside a cast's type", () => {
    expect(names("u32 n <- (u8[a]) b;\n").sort()).toEqual(["a", "b"]);
  });

  it("reaches a dimension of a declared type", () => {
    expect(names("u8[a] buffer;\n")).toEqual(["a"]);
  });
});
