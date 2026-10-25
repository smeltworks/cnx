import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import ProgramAccesses from "../ProgramAccesses";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";

const program = (lines: readonly string[]): IProgramSyntax =>
  CnxSourceParser.parse(lines.join("\n")).program;

describe("ProgramAccesses", () => {
  const file = program([
    "mut u8 x;",
    "void f() {",
    "    x <- 1;",
    "    x +<- 2;",
    "    u8 y <- x;",
    "    for (mut u8 i <- 0; i < 2; i +<- 1) { }",
    "}",
  ]);

  it("lists every assignment site as a write, a for loop's update included", () => {
    expect(
      ProgramAccesses.writes(file).map(
        (site) => `${site.target.written} ${site.operator}`,
      ),
    ).toEqual(["x <-", "x +<-", "i +<-"]);
  });

  it("reads every expression once but a write's target, which its site owns", () => {
    // A compound operator reads its target too, but that read is the write
    // site's to judge (checkSite), so it is not a second, separate read.
    expect(ProgramAccesses.reads(file).map((expr) => expr.written)).toEqual([
      "1",
      "2",
      "x",
      "0",
      "i < 2",
      "i",
      "2",
      "1",
    ]);
  });

  it("lists every expression, targets included, each once", () => {
    expect(
      ProgramAccesses.expressions(file).map((expr) => expr.written),
    ).toEqual(["x", "1", "x", "2", "x", "0", "i < 2", "i", "2", "i", "1"]);
  });
});
