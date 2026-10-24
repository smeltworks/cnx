/**
 * #2332: 2.2 decides which `&&`/`||` operands and `?:` arms build a struct
 * initializer before their statement, so 2.3 builds it only when that operand
 * runs -- and plans the C types the lowering writes.
 */
import { describe, it, expect } from "vitest";
import ProgramGeneration from "./ProgramGeneration";

const NAMED = [
  "struct Named {",
  "  string<8> s;",
  "  u32 n;",
  "}",
  "u32 w(Named x) {",
  "  return x.n;",
  "}",
];

function plan(body: readonly string[]) {
  return ProgramGeneration.planSource(
    [
      ...NAMED,
      "u32 main() {",
      "  u32 a <- 0;",
      '  string<8> t <- "hi";',
      ...body,
      "  return 0;",
      "}",
    ].join("\n"),
  );
}

describe("2.2 plans the operands built only when they run (#2332)", () => {
  // The bool the lowering writes is guarded by bool-less-file.test.cnx: any
  // one-file chain here spells bool itself, so asserting it could not fail.
  it("lowers a later operand that holds a string-field initializer", () => {
    const planned = plan(["  bool b <- (a = 1) && (w({ s: t, n: 1 }) = 1);"]);

    expect(planned.lazyOperands.size).toBe(1);
  });

  it("leaves the first operand alone: it always runs", () => {
    const planned = plan(["  bool b <- (w({ s: t, n: 1 }) = 1) || (a = 1);"]);

    expect(planned.lazyOperands.size).toBe(0);
  });

  it("leaves an operand that builds nothing alone", () => {
    const planned = plan(["  bool b <- (a = 1) && (a = 2);"]);

    expect(planned.lazyOperands.size).toBe(0);
    expect(planned.lazyTernaries.size).toBe(0);
  });

  it("plans a ternary's value as its own C type", () => {
    const planned = plan([
      "  Named p <- (a = 1) ? { s: t, n: 1 } : { s: t, n: 2 };",
    ]);

    expect([...planned.lazyTernaries.values()]).toEqual(["Named"]);
  });
});
