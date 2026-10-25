import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import DeclarationModifierAnalyzer from "../DeclarationModifierAnalyzer";

/**
 * #1322. ADR-049's E0889: `atomic` already implies `volatile`, so writing both
 * says one of two different things.
 *
 * Entirely syntactic -- two modifier tokens on one declaration -- so nothing
 * here needs a type, a scope or the program's symbols.
 */
const errors = (source: string) => {
  return new DeclarationModifierAnalyzer().analyze(
    CnxSourceParser.parse(source).program,
  );
};

describe("DeclarationModifierAnalyzer (E0889)", () => {
  it("rejects both modifiers at file scope, in a function, and in a scope", () => {
    const found = errors(
      [
        "atomic volatile u32 atFile <- 0;",
        "void f() {",
        "    atomic volatile u32 inBody <- 0;",
        "}",
        "scope S {",
        "    atomic volatile u32 member <- 0;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0889", 1],
      ["E0889", 3],
      ["E0889", 6],
    ]);
  });

  it("reaches a declaration nested in a block, a loop and a switch case", () => {
    // #1991: the walk is over 1.2's statements, so nesting is the walk's job
    const found = errors(
      [
        "void f(u8 v) {",
        "    if (v = 1) {",
        "        atomic volatile u32 inIf <- 0;",
        "    }",
        "    while (v = 2) {",
        "        atomic volatile u32 inLoop <- 0;",
        "    }",
        "    switch (v) {",
        "        case 3 { atomic volatile u32 inCase <- 0; }",
        "        default { }",
        "    }",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => e.span.line)).toEqual([3, 6, 9]);
  });

  it("accepts either modifier alone", () => {
    expect(
      errors("atomic u32 a <- 0;\nvolatile u32 b <- 0;\nu32 c <- 0;"),
    ).toEqual([]);
  });

  it("checks a for header's declaration too", () => {
    // The grammar lets a `for` init carry the same modifiers. Codegen's copy
    // lived in the builder that file-scope and block declarations share, so
    // this form was never asked.
    const found = errors(
      "void f() {\n    for (atomic volatile u32 i <- 0; i < 2; i +<- 1) {\n    }\n}",
    );
    expect(found.map((e) => e.code)).toEqual(["E0889"]);
  });
});

describe("DeclarationModifierAnalyzer (E0919)", () => {
  // #2233: `atomic` already implies `mut`, so writing both says nothing more
  it("rejects atomic mut at file scope, in a function, in a scope and in a for header", () => {
    const found = errors(
      [
        "atomic mut u32 atFile <- 0;",
        "void f() {",
        "    atomic mut u32 inBody <- 0;",
        "    for (atomic mut u32 i <- 0; i < 2; i +<- 1) {",
        "    }",
        "}",
        "scope S {",
        "    atomic mut u32 member <- 0;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0919", 1],
      ["E0919", 3],
      ["E0919", 4],
      ["E0919", 8],
    ]);
  });

  it("accepts atomic and mut alone", () => {
    expect(errors("atomic u32 a <- 0;\nmut u32 b <- 0;")).toEqual([]);
  });

  it("reports both rules on atomic volatile mut", () => {
    const found = errors("atomic volatile mut u32 a <- 0;");
    expect(found.map((e) => e.code)).toEqual(["E0919", "E0889"]);
  });
});
