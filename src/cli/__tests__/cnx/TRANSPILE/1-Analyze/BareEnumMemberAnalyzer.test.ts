import { describe, expect, it } from "vitest";

import BareEnumMemberAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/BareEnumMemberAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-017's bare-member rule (E0424): an enum member written bare is
 * accepted where its position names the enum -- a declaration or assignment
 * of the type, a return from a function of the type, a field or element of
 * the type -- and rejected everywhere else, with the enums that declare it.
 * Four codegen throws decided this by which generator happened to be running.
 *
 * The rule reads the per-file symbol view, so each source declares the enums
 * and structs it uses and the view comes from the program 1.4 built for it.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new BareEnumMemberAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context),
  );
};

describe("BareEnumMemberAnalyzer (E0424)", () => {
  it("accepts a bare member where the position names its enum", () => {
    const source = [
      "enum Color { RED, GREEN }",
      "struct P {",
      "    Color c;",
      "}",
      "Color g <- RED;",
      "P p <- { c: GREEN };",
      "Color[2] pair <- [RED, GREEN];",
      "Color pick(bool f) {",
      "    Color c <- (f = true) ? RED : GREEN;",
      "    c <- GREEN;",
      "    p.c <- RED;",
      "    pair[0] <- GREEN;",
      "    return RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects a bare member where nothing names the enum, with the suggestion", () => {
    const source = [
      "enum Color { RED, GREEN }",
      "u8 g <- RED;",
      "u8 f(Color c) {",
      "    if (c = RED) {",
      "    }",
      "    u8 v <- RED + 1;",
      "    return GREEN;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0424", 2],
      ["E0424", 4],
      ["E0424", 6],
      ["E0424", 7],
    ]);
    expect(found[0].message).toBe(
      "'RED' is not defined; did you mean 'Color.RED'?",
    );
    expect(found[0].span.column).toBeGreaterThan(0);
  });

  it("names every enum that declares an ambiguous member", () => {
    const [found] = errors(
      "enum Color { RED }\nenum Status { RED }\nu8 g <- RED;",
    );
    expect(found.message).toBe(
      "'RED' is not defined; did you mean 'Color.RED' or 'Status.RED'?",
    );
  });

  it("rejects a member of the OTHER enum under an enum-typed position (the closed hole)", () => {
    // `Color c <- YELLOW` resolved nothing and codegen emitted `YELLOW` into C.
    const found = errors(
      "enum Color { RED }\nenum Status { YELLOW }\nColor c <- YELLOW;",
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("'Status.YELLOW'");
  });

  it("clears the expectation inside a call's arguments, a subscript and a dimension", () => {
    const source = [
      "enum Color { RED, COUNT }",
      "void take(Color c) {",
      "}",
      "u8[COUNT] data;",
      "void main() {",
      "    take(RED);",
      "    u8 v <- data[COUNT];",
      "}",
    ].join("\n");
    expect(errors(source).map((e) => e.span.line)).toEqual([4, 6, 7]);
  });

  it("leaves a declared name of the same spelling alone", () => {
    // A local, a parameter or a const wins over the enum member, as codegen
    // resolved a declared name before ever asking the enums.
    const source = [
      "enum Color { RED }",
      "void f(u8 RED) {",
      "    u8 v <- RED;",
      "}",
      "void g() {",
      "    u8 RED <- 1;",
      "    u8 w <- RED;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("says nothing without a symbol view", () => {
    expect(errors("u8 g <- RED;")).toEqual([]);
  });
});

// #1991: the positions are read top down off 1.2's syntax, so each place that
// names no enum -- or is not a value at all -- is asserted on its own.
describe("BareEnumMemberAnalyzer -- positions on 1.2's syntax", () => {
  const codes = (body: readonly string[]) =>
    errors(
      [
        "enum Color { RED, GREEN }",
        "Color[2] pair;",
        "void f(u8 i) {",
        ...body.map((line) => `    ${line}`),
        "}",
      ].join("\n"),
    ).map((e) => `${e.code}@${e.span.line}:${e.span.column}`);

  it("a comparison names no enum, even inside an enum's position", () => {
    expect(codes(["Color d <- (pair[0] = RED) ? GREEN : RED;"])).toEqual([
      "E0424@4:26",
    ]);
  });

  it("a subscript names no enum for its index", () => {
    expect(codes(["Color d <- pair[RED];"])).toEqual(["E0424@4:20"]);
  });

  it("a for loop's init and update name no enum", () => {
    expect(
      codes([
        "Color c <- GREEN;",
        "for (c <- RED; i < 3; c <- GREEN) { }",
        "for (Color k <- RED; i < 3; i +<- 1) { }",
      ]),
    ).toEqual(["E0424@5:14", "E0424@5:31", "E0424@6:20"]);
  });

  it("a parenthesized chain head takes its chain's position", () => {
    expect(codes(["Color d <- (GREEN).x;"])).toEqual([]);
  });

  it("a chain's head and an assignment's target are not values", () => {
    expect(codes(["u8 n <- RED.length;", "RED <- 1;"])).toEqual([]);
  });

  it("a bit range names no enum", () => {
    expect(codes(["Color c <- GREEN;", "c[0, 2] <- RED;"])).toEqual([
      "E0424@5:15",
    ]);
  });
});

describe("BareEnumMemberAnalyzer reads 2.1's value sites (#1991 review)", () => {
  const header = [
    "enum Color { RED, GREEN }",
    "struct Pt { Color c; u8 x; }",
    "Color[4] arr <- [Color.RED*];",
  ];
  const codes = (body: string[]) =>
    errors([...header, ...body].join("\n")).map((error) => error.span.line);

  it("rejects a member written to a slice", () => {
    expect(codes(["void main() {", "    arr[0, 1] <- GREEN;", "}"])).toEqual([
      5,
    ]);
  });

  it("accepts a struct literal's field in a for header", () => {
    expect(
      codes([
        "void main(u8 limit) {",
        "    u8 i <- 0;",
        "    for (Pt p <- { c: RED, x: 1 }; i < limit; i +<- 1) {}",
        "}",
      ]),
    ).toEqual([]);
  });

  it("accepts a struct literal's field passed as an argument", () => {
    expect(
      codes([
        "void take(Pt p) {}",
        "void main() {",
        "    take({ c: RED, x: 1 });",
        "}",
      ]),
    ).toEqual([]);
  });

  it("still rejects a member passed as an argument, and a for header's own value (#1537)", () => {
    expect(
      codes([
        "void takeColor(Color c) {}",
        "void main() {",
        "    takeColor(RED);",
        "    for (Color c <- RED; c != Color.GREEN; c <- GREEN) {}",
        "}",
      ]),
    ).toEqual([6, 7, 7]);
  });
});
