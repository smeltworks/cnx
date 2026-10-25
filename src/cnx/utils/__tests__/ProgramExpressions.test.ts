import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import ProgramExpressions from "../ProgramExpressions";

const written = (source: string): string[] =>
  ProgramExpressions.of(CnxSourceParser.parse(source).program).map(
    (expression) => expression.written,
  );

describe("ProgramExpressions", () => {
  it("returns every outermost expression of a file, in source order", () => {
    expect(
      written(
        [
          "u8 g[2 + 1] <- [1, 2, 3];",
          "enum E { A <- 4 }",
          "register R @ 0x40000000 { D: u32 rw @ 0x04, }",
          "struct P { u8 t[5]; }",
          "scope S { u8 m <- 9; }",
          "u8 f(u8 a[6]) {",
          "    a[0] <- 7;",
          "    if (a[0] = 7) { f(a); }",
          "    for (u8 i <- 0; i < 2; i +<- 1) { }",
          "    switch (a[0]) { case 1 { } default { } }",
          "    return 8;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([
      "2 + 1",
      "[1, 2, 3]",
      "4",
      "0x40000000",
      "0x04",
      "5",
      "9",
      "6",
      "a[0]",
      "7",
      "a[0] = 7",
      "f(a)",
      "0",
      "i < 2",
      "i",
      "1",
      "a[0]",
      "8",
    ]);
  });

  it("reads an expression's children, and a cast's written dimensions after them", () => {
    const [cast] = ProgramExpressions.of(
      CnxSourceParser.parse("void f(u8 x) { u8 y <- (u8[2 + 2])x; }").program,
    );
    expect(cast.kind).toBe("cast");
    expect(
      ProgramExpressions.readsIn(cast).map((expression) => expression.written),
    ).toEqual(["x", "2 + 2"]);
  });

  it("reads nothing from a leaf", () => {
    const [literal] = ProgramExpressions.of(
      CnxSourceParser.parse("u8 g <- 4;").program,
    );
    expect(ProgramExpressions.readsIn(literal)).toEqual([]);
  });
});
