import { describe, expect, it } from "vitest";

import ProgramAccesses from "../../../../cnx/utils/ProgramAccesses";
import ValuePositions from "../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "../TRANSPILE/1-Analyze/testAnalysisContextFor";

// The reads are what 2.1's value walk did not place as a target, so the file
// is analyzed as runAnalyzers does it.
const analyzed = (lines: readonly string[]) =>
  testAnalysisContextFor(lines.join("\n"), { cppMode: false });

describe("ProgramAccesses", () => {
  const { syntax: file, context } = analyzed([
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
    expect(
      ProgramAccesses.reads(file, ValuePositions.of(file, context)).map(
        (expr) => expr.written,
      ),
    ).toEqual(["1", "2", "x", "0", "i < 2", "i", "2", "1"]);
  });

  it("lists every expression, targets included, each once", () => {
    expect(
      ProgramAccesses.expressions(file).map((expr) => expr.written),
    ).toEqual(["x", "1", "x", "2", "x", "0", "i < 2", "i", "2", "i", "1"]);
  });
});
