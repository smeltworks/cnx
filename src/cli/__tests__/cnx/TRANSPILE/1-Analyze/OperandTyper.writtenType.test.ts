import { describe, expect, it } from "vitest";

import OperandTyper from "../../../../../cnx/utils/OperandTyper";
import StatementNodes from "../../../../../cnx/utils/StatementNodes";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #2160 review: ADR-044's clamp and the string copy decide from the type a
 * target writes. With no step, that is the root of the chain walk -- the
 * variable's own type, its overflow behavior with it -- for `x`, `this.x`
 * and `global.x`.
 */
const writtenBy = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return syntax.members
    .flatMap((entry) => StatementNodes.assignments(entry.declaration))
    .map((site) => OperandTyper.writtenType(site.target, context));
};

describe("OperandTyper.writtenType", () => {
  it("reads a bare, a global. and a this. target's own type", () => {
    const written = writtenBy(
      [
        "wrap u8 w <- 0;",
        "clamp u8 c <- 0;",
        "scope S {",
        "    wrap u8 m <- 0;",
        "    public void f() {",
        "        this.m <- 1;",
        "    }",
        "}",
        "void f() {",
        "    w <- 1;",
        "    global.c <- 1;",
        "}",
      ].join("\n"),
    );

    expect(written.map((t) => [t?.typeName, t?.overflow])).toEqual([
      ["u8", "wrap"],
      ["u8", "wrap"],
      ["u8", "clamp"],
    ]);
  });
});
