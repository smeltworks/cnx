import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import ThisOutsideScopeAnalyzer from "../ThisOutsideScopeAnalyzer";

/**
 * #1322, the first relocation. `this` outside a `scope` was rejected from FOUR
 * places in `output/` -- `CodeGenerator`, `BaseIdentifierBuilder`, and
 * `PostfixExpressionGenerator` twice -- each throwing the identical string, and
 * each reaching the user as `1:0` because a codegen throw carries no position.
 *
 * It is the right first family to move for three reasons: the rule is purely
 * syntactic, so it needs no symbol state at all; four copies collapse to one
 * decision, which is what the relocation constraint requires; and both routes
 * to it are reachable, verified by probe rather than assumed --
 * `u32 x <- this.count;` at file scope AND inside a top-level function each
 * produced the diagnostic before this analyzer existed.
 */
const errors = (source: string) => {
  return new ThisOutsideScopeAnalyzer().analyze(
    CnxSourceParser.parse(source).program,
  );
};

describe("ThisOutsideScopeAnalyzer", () => {
  it("rejects `this` in a file-scope initializer, with a real position", () => {
    // The position is the point of the card: this reported `1:0` from codegen.
    const found = errors("u32 count <- 0;\nu32 shadow <- this.count;");
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0431");
    expect(found[0].span.line).toBe(2);
    expect(found[0].span.column).toBeGreaterThan(0);
  });

  it("rejects `this` inside a top-level function", () => {
    const found = errors(
      "u32 count <- 0;\nu32 main() {\n    u32 x <- this.count;\n    return x;\n}",
    );
    expect(found).toHaveLength(1);
    expect(found[0].span.line).toBe(3);
  });

  it("rejects `this` in an assignment target outside a scope", () => {
    // `AssignmentTargetContext` carries its own THIS token, so a walk that
    // only visited expressions would miss the write path entirely.
    const found = errors(
      "u32 count <- 0;\nu32 main() {\n  this.count <- 5;\n  return 0;\n}",
    );
    expect(found).toHaveLength(1);
  });

  it("rejects `this` in a case label outside a scope (#1629)", () => {
    const found = errors(
      [
        "u8 LIMIT <- 1;",
        "u32 pick(u8 s) {",
        "    switch (s) {",
        "        case this.LIMIT { return 1; }",
        "        case this.State.IDLE { return 2; }",
        "        default { return 0; }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line, e.span.column])).toEqual([
      ["E0431", 4, 13],
      ["E0431", 5, 13],
    ]);
  });

  it("accepts `this` in a case label inside a scope", () => {
    const source = [
      "scope Panel {",
      "    u8 LIMIT <- 1;",
      "    public u32 pick(u8 s) {",
      "        switch (s) {",
      "            case this.LIMIT { return 1; }",
      "            default { return 0; }",
      "        }",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("accepts `this` inside a scope method", () => {
    const source = [
      "scope Motor {",
      "    u32 speed <- 0;",
      "    public u32 read() {",
      "        return this.speed;",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("accepts `this.Type` in a type position inside a scope", () => {
    // `ScopedTypeContext` is the third context carrying THIS. It is legal in a
    // scope and must not be reported there.
    const source = [
      "scope Motor {",
      "    enum State { IDLE, RUNNING }",
      "    public u32 read() {",
      "        this.State s <- this.State.IDLE;",
      "        return 0;",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects `this.Type` in a type position outside a scope", () => {
    // #1991: types are walked as well as expressions -- a declared type, a
    // cast's type and an array's element type
    const found = errors(
      [
        "this.State s <- 0;",
        "void f() {",
        "    u8 v <- (this.State)0;",
        "    this.State[2] w <- [0, 0];",
        "}",
      ].join("\n"),
    );
    expect(found.map((e) => e.span.line)).toEqual([1, 3, 4]);
  });

  it("reports each offending `this` separately, unlike the throw it replaces", () => {
    // A throw aborts at the first occurrence. An analyzer sees the file, which
    // is a behavior change worth asserting rather than discovering in a
    // regenerated snapshot.
    const found = errors("u32 a <- 0;\nu32 b <- this.a;\nu32 c <- this.a;");
    expect(found).toHaveLength(2);
    expect(found.map((e) => e.span.line)).toEqual([2, 3]);
  });

  it("rejects `global` at file level (#2087)", () => {
    const found = errors(
      [
        "u32 count <- 0;",
        "u8 LIMIT <- 1;",
        "struct Pt { u8 x; }",
        "u32 atFile <- global.count;",
        "global.Pt atType <- { x: 1 };",
        "u8[global.LIMIT] atDimension;",
        "struct Holder { global.Pt inner; }",
      ].join("\n"),
    );
    expect(found.map((e) => e.span.line)).toEqual([4, 5, 6, 7]);
    expect(found[0].message).toBe(
      "'global' can only be used inside a scope or a function",
    );
  });

  it("accepts `global` inside a scope or a function (#2087)", () => {
    const found = errors(
      [
        "u32 count <- 0;",
        "u8 LIMIT <- 1;",
        "struct Pt { u8 x; }",
        "scope S {",
        "    public u32 f() {",
        "        global.Pt p <- { x: 1 };",
        "        global.count <- p.x;",
        "        return global.count;",
        "    }",
        "}",
        "u32 pick(u8 s, u32 count) {",
        "    global.Pt q <- { x: 1 };",
        "    global.count <- count;",
        "    switch (s) {",
        "        case global.LIMIT { return q.x; }",
        "        default { return 0; }",
        "    }",
        "    return 0;",
        "}",
      ].join("\n"),
    );
    expect(found).toEqual([]);
  });

  it("still rejects `this` in a top-level function", () => {
    const found = errors("u32 count <- 0;\nu32 f() { return this.count; }");
    expect(found.map((e) => e.message)).toEqual([
      "'this' can only be used inside a scope",
    ]);
  });

  it("in a function, says `global.` reaches past a shadowing parameter (#2087)", () => {
    const [found] = errors(
      "u32 count <- 0;\nu32 f(u32 count) {\n    return this.count;\n}",
    );
    expect(found.helpText).toContain("`global.Name`");
  });

  it("says what to write instead", () => {
    const [found] = errors("u32 count <- 0;\nu32 shadow <- this.count;");
    expect(found.helpText).toContain("bare name");
    // `global.` is no advice at file level either (#2087)
    expect(found.helpText).not.toContain("global.");
  });
});
