/**
 * Unit tests for SafeDivision: the one ADR-051 call predicate 2.1, 2.2 and
 * 2.3 all ask (#1991).
 */
import { describe, it, expect } from "vitest";
import SafeDivision from "../SafeDivision";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";

const lowered = (exprSource: string) => {
  const { tree, parseErrors } = CnxSourceParser.parse(
    `void main() { u32 x <- ${exprSource}; }`,
  );
  expect(parseErrors).toEqual([]);
  const statement = tree
    .declaration()[0]
    .functionDeclaration()!
    .block()
    .statement()[0];
  return SyntaxLowering.expression(
    statement.variableDeclaration()!.expression()!,
  );
};

describe("SafeDivision", () => {
  it.each([
    ["safe_div(r, a, b, 0)", "safe_div", "div"],
    ["safe_mod(r, a, b, 0)", "safe_mod", "mod"],
  ])("recognizes %s", (source, name, operation) => {
    const call = SafeDivision.callOf(lowered(source));
    expect(call?.name).toBe(name);
    expect(call?.args).toHaveLength(4);
    expect(SafeDivision.operationOf(call!.name)).toBe(operation);
    expect(SafeDivision.outputName(call!.args)).toBe("r");
  });

  // #2424: the numerator and default land in the output's type; the
  // divisor is a `/` divisor (ADR-044) and the output is written through
  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
  ])("argument %i lands in the output's type: %s", (index, lands) => {
    expect(SafeDivision.landsInOutput(index)).toBe(lands);
  });

  it("keeps a wrong argument count a safe-division call, for E0884 to report", () => {
    expect(SafeDivision.callOf(lowered("safe_div(r, a)"))?.args).toHaveLength(
      2,
    );
  });

  it.each([
    "foo(r, a, b, 0)",
    "safe_div",
    "this.safe_div(r, a, b, 0)",
    "safe_div(r, a, b, 0).x",
    "toString(r, a, b, 0)",
  ])("is not a safe-division call: %s", (source) => {
    expect(SafeDivision.callOf(lowered(source))).toBeNull();
  });
});
