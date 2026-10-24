import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import CallbackAssignmentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CallbackAssignmentAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import TranspileState from "../../../../../cnx/TRANSPILE/TranspileState";
import testAnalysisContext from "../../../../../cnx/TRANSPILE/1-Analyze/__tests__/testAnalysisContext";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import type ICParameterInfo from "../../../../../cnx/types/symbols/c/ICParameterInfo";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. ADR-029's callback typing: E0879 (a function whose declared signature
 * does not match the slot's callback type) and E0880 (a function that is
 * itself a callback type standing in for another -- nominal typing).
 *
 * Both rules resolve a name to a function symbol through `Program`, so every
 * case but the first runs against a real, declared and resolved one (#1668,
 * `testAnalysisContextFor`); `tests/adr-029/` asserts the rules end to end.
 * The walk cases assert "does not throw" over the four slots a function name
 * can land in and the shapes that are not slots.
 *
 * The first case keeps an EMPTY program on purpose. It used to assert that
 * with nothing declared neither rule can report; since the analyzer asks
 * Program where each node sits (#1668), an empty program is refused loudly
 * instead, which is the better answer to a caller error than silence.
 *
 * #1322 review: the `with a program behind it` block below asserts the two
 * rules actually fire, with a control beside each.
 */
const build = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new CallbackAssignmentAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context).positions,
  );
};

// Only the empty-program case below: it asserts what an EMPTY program does,
// which a real declared program cannot stand in for.
const findings = (source: string) => {
  const syntax = CnxSourceParser.parse(source).program;
  return new CallbackAssignmentAnalyzer(
    testAnalysisContext(new TranspileState()),
  ).analyze(syntax, new Map());
};

describe("CallbackAssignmentAnalyzer", () => {
  // Same as `FunctionReference`: the context always carries a program, so
  // "absent" is unrepresentable. What this checks is an empty one: a program
  // that does not hold the file is a caller error (#1668), refused rather than
  // answered "nothing is declared", which is how this case used to pass.
  it("refuses a program that does not hold the file", () => {
    expect(() =>
      findings(
        [
          "struct P { u32 x; }",
          "void onDown(P p) { }",
          "void onUp(P p) { }",
          "struct H { onDown down; }",
          "void t() { H h; h.down <- onUp; }",
        ].join("\n"),
      ),
    ).toThrow("is a file of this program");
  });

  it("walks every slot and every construct without throwing", () => {
    // ADR-029's four slots plus the shapes that are NOT slots. The analyzer
    // walks each one; a crash here is the failure this catches, and it has
    // caught two -- an `ArgumentList` whose parent chain is not a call, and a
    // `for` header's declaration with no initializer.
    const source = [
      "struct P { u32 x; }",
      "void onDown(P p) { }",
      "struct H { onDown down; }",
      "void takesDown(onDown cb) { }",
      "void t() {",
      "    H h;",
      "    h.down <- onDown;", // slot 1: assignment
      "    onDown cb <- onDown;", // slot 2: declaration
      "    H init <- { down: onDown };", // slot 3: struct initializer field
      "    takesDown(onDown);", // slot 4: call argument
      "    for (u8 i <- 0; i < 2; i +<- 1) { }", // a for header, no initializer to type
      "    u8[2] arr <- [1, 2];", // an array initializer, not a struct one
      "    u8 v <- arr[0];", // a subscript, where no struct is expected
      "    h.down(h.down);", // a call THROUGH a value, which names no function
      "}",
    ].join("\n");
    expect(() => build(source)).not.toThrow();
  });

  it("types an inferred struct initializer from each establishing node", () => {
    // `StructInitializerType` is shared with #1277, so its walk is exercised
    // here rather than only through the callback rule: a declaration, a
    // return statement, a nested field, and an argument each establish a type
    // for a `{ ... }` that does not name one.
    const source = [
      "struct Inner { u32 v; }",
      "struct Outer { Inner inner; }",
      "void takes(Outer o) { }",
      "Outer make() {",
      "    return { inner: { v: 1 } };",
      "}",
      "void t() {",
      "    Outer a <- { inner: { v: 2 } };",
      "    takes({ inner: { v: 3 } });",
      "    a <- { inner: { v: 4 } };",
      "}",
    ].join("\n");
    expect(() => build(source)).not.toThrow();
  });
  describe("with a program behind it, the rules fire", () => {
    // ADR-029 compares DECLARED signatures. The types below differ only in the
    // one thing each case is about, so a rule that compared something else
    // would not report where these expect it to.
    const preamble = [
      "struct P { u32 x; }",
      "void onDown(P p) { }",
      "void matching(P p) { }",
      "void wrongConst(mut P p) { }",
      "struct H { onDown down; }",
      "void takesDown(onDown cb) { }",
    ].join("\n");

    it("reports E0879 when the declared signature differs, in each slot", () => {
      // One slot per line, so a dropped slot is a count change.
      const found = build(
        [
          preamble,
          "void t() {",
          "    H h;",
          "    h.down <- wrongConst;", // assignment target
          "    onDown cb <- wrongConst;", // declaration
          "    H init <- { down: wrongConst };", // struct-initializer field
          "    takesDown(wrongConst);", // call argument
          "    h <- { down: wrongConst };", // initializer typed by its target
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual([
        "E0879",
        "E0879",
        "E0879",
        "E0879",
        "E0879",
      ]);
      expect(found[0].message).toContain("does not match callback type");
      expect(found[0].span.column).toBeGreaterThan(0);
    });

    it("accepts a function whose declared signature matches exactly", () => {
      // The control for E0879: same shape, same slots, a matching signature.
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    H h;",
            "    h.down <- matching;",
            "    onDown cb <- matching;",
            "    H init <- { down: matching };",
            "    takesDown(matching);",
            "    h <- { down: matching };",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });

    it("resolves a callback type and a function declared in a scope", () => {
      // Both names are looked up from the scope the slot sits in (#1668:
      // Program's lexical frame), not from file scope
      const scoped = (value: string) =>
        build(
          [
            "struct P { u32 x; }",
            "scope Motor {",
            "    public void onStop(P p) { }",
            "    void matchingStop(P p) { }",
            "    void wrongStop(mut P p) { }",
            `    public void f() { onStop cb <- ${value}; }`,
            "}",
          ].join("\n"),
        ).map((e) => e.code);
      expect(scoped("wrongStop")).toEqual(["E0879"]);
      expect(scoped("matchingStop")).toEqual([]);
    });

    it("reports E0880 for a function that is itself a field type", () => {
      // Nominal typing: `other` is `G`'s field type, so it is its own callback
      // type and cannot stand in for `onDown` even with a matching signature.
      const found = build(
        [
          preamble,
          "void other(P p) { }",
          "struct G { other cb; }",
          "void t() {",
          "    H h;",
          "    h.down <- other;",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0880"]);
      expect(found[0].message).toContain("nominal typing");
    });

    it("names a `this.` target as the variable it is (#1991)", () => {
      const found = build(
        [
          preamble,
          "void other(P p) { }",
          "struct G { other cb; }",
          "scope S {",
          "    onDown handler;",
          "    void t() { this.handler <- other; }",
          "}",
        ].join("\n"),
      );
      expect(found.map((e) => e.code)).toEqual(["E0880"]);
      expect(found[0].message).toContain("callback variable 'this.handler'");
    });

    it("accepts a matching function that is NOT a field type", () => {
      // The control for E0880, and the reason it is a separate rule from
      // E0879: `matching` has the identical signature to `other` above.
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    H h;",
            "    h.down <- matching;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });

    it("stays silent where the slot's type is not a function", () => {
      expect(
        build(
          [
            preamble,
            "void t() {",
            "    u8 plain <- 1;",
            "    plain <- 2;",
            "}",
          ].join("\n"),
        ),
      ).toEqual([]);
    });
  });
});

/**
 * #1619: a function a C header declares is held to the slot's signature by C
 * type identity under the header compiler, which names the C type of each
 * `<stdint.h>` name (`__UINT32_TYPE__`).
 */
describe("CallbackAssignmentAnalyzer with a function a C header declares", () => {
  const ARM = {
    uint32_t: "long unsigned int",
    uint16_t: "short unsigned int",
    uint8_t: "unsigned char",
    size_t: "unsigned int",
  };
  const X86_64 = { uint32_t: "unsigned int", uint8_t: "unsigned char" };

  const declare = (
    symbolTable: SymbolTable,
    name: string,
    type: string,
    parameters: ICParameterInfo[] = [],
    isVariadic = false,
  ): void => {
    symbolTable.addCSymbol({
      name,
      kind: "function",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "clock.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type,
      parameters: parameters.length > 0 ? parameters : undefined,
      isVariadic: isVariadic || undefined,
      isDeclaration: true,
    });
  };

  const run = (
    value: string,
    integerTypes: Record<string, string>,
    cppMode: boolean,
  ): string[] => {
    const symbolTable = new SymbolTable();
    declare(symbolTable, "millis", "unsigned long");
    declare(symbolTable, "spelled", "long unsigned int");
    declare(symbolTable, "clock32", "unsigned int");
    declare(symbolTable, "stdintClock", "uint32_t");
    declare(symbolTable, "variadicClock", "uint32_t", [], true);
    declare(symbolTable, "onByte", "void", [
      { name: "b", type: "uint8_t", isConst: false, isArray: false },
    ]);
    declare(symbolTable, "onBytePtr", "void", [
      { name: "b", type: "uint8_t *", isConst: false, isArray: false },
    ]);
    symbolTable.addCSymbol({
      name: "tick_t",
      kind: "type",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "clock.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "unsigned long",
    });
    declare(symbolTable, "typedefClock", "tick_t");
    const typedef = (name: string, type: string): void => {
      symbolTable.addCSymbol({
        name,
        kind: "type",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "clock.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type,
      });
    };
    typedef("U8Ref", "uint8_t*");
    typedef("clock_fn", "uint32_t (*)(void)");
    declare(symbolTable, "onByteRef", "void", [
      { name: "b", type: "U8Ref", isConst: false, isArray: false },
    ]);
    declare(symbolTable, "onClockFn", "void", [
      { name: "t", type: "clock_fn", isConst: false, isArray: false },
    ]);
    declare(symbolTable, "onClockPtr", "void", [
      {
        name: "t",
        type: "uint32_t",
        isConst: false,
        isArray: false,
        isNestedDeclarator: true,
      },
    ]);
    declare(symbolTable, "onClockValue", "void", [
      { name: "t", type: "uint32_t", isConst: false, isArray: false },
    ]);
    const grid = (name: string, dimensions: string[]): void => {
      declare(symbolTable, name, "void", [
        {
          name: "g",
          type: "uint8_t",
          isConst: true,
          isArray: true,
          arrayDimensions: dimensions,
        },
      ]);
    };
    declare(symbolTable, "sizeClock", "size_t");
    declare(symbolTable, "timeClock", "time_t");
    declare(symbolTable, "onVolatileByte", "void", [
      {
        name: "b",
        type: "uint8_t*",
        isConst: false,
        isArray: false,
        isVolatile: true,
      },
    ]);
    symbolTable.addCSymbol({
      name: "CByte",
      kind: "type",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "clock.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "uint8_t",
      isConst: true,
    });
    declare(symbolTable, "onCBytes", "void", [
      { name: "b", type: "CByte*", isConst: false, isArray: false },
    ]);
    declare(symbolTable, "onMutBytes", "void", [
      { name: "b", type: "uint8_t*", isConst: false, isArray: false },
    ]);
    grid("onGrid44", ["4", "4"]);
    grid("onGrid48", ["4", "8"]);
    grid("onGridMacro", ["4", "WIDTH"]);
    grid("onGridFlat", ["16"]);
    declare(symbolTable, "unsignedByte", "unsigned char");
    declare(symbolTable, "plainChar", "char");
    declare(symbolTable, "signedChar", "signed char");
    declare(symbolTable, "unsignedShort", "unsigned short");
    declare(symbolTable, "cBool", "_Bool");
    for (const [name, type] of [
      ["legacySink", "void"],
      ["legacyCount", "uint16_t"],
    ]) {
      symbolTable.addCSymbol({
        name,
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "clock.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type,
        isUnprototyped: true,
        isDeclaration: true,
      });
    }
    symbolTable.addCSymbol({
      name: "mac_t",
      kind: "type",
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "clock.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
      type: "uint8_t",
      arrayDimensions: ["6"],
    });
    declare(symbolTable, "onMacs", "void", [
      {
        name: "m",
        type: "mac_t",
        isConst: true,
        isArray: true,
        arrayDimensions: ["4"],
      },
    ]);
    const { syntax, context } = testAnalysisContextFor(
      [
        "u32 tickSource() { return 0; }",
        "void byteSink(u8 b) { (void) b; }",
        "void byteOut(mut u8 b) { b <- 1; }",
        "u8 byteSource() { return 0; }",
        "u16 halfSource() { return 0; }",
        "bool flagSource() { return false; }",
        "void tickSink(tickSource t) { u32 n <- t(); }",
        "void gridSink(u8[4][4] g) { u8 b <- g[0][0]; }",
        "void rowSink(u8[4] r) { u8 b <- r[0]; }",
        "struct T { tickSource tick; byteSink sink; byteOut out; byteSource byte; halfSource half; flagSource flag; tickSink sinkTick; gridSink grid; rowSink row; }",
        `T t <- { ${value} };`,
      ].join("\n"),
      { symbolTable, integerTypes, cppMode },
    );
    return new CallbackAssignmentAnalyzer(context)
      .analyze(syntax, ValuePositions.of(syntax, context).positions)
      .map((e) => `${e.code} ${e.message}`);
  };

  it("accepts unsigned long where uint32_t is unsigned long", () => {
    expect(run("tick: millis", ARM, false)).toEqual([]);
    expect(run("tick: spelled", ARM, false)).toEqual([]);
    expect(run("tick: stdintClock", ARM, false)).toEqual([]);
  });

  it("rejects unsigned int there, though it is 32 bits too", () => {
    expect(run("tick: clock32", ARM, false)).toEqual([
      "E0879 Function 'clock32' signature does not match callback type 'tickSource'",
    ]);
  });

  it("follows the compiler, not the spelling, on another target", () => {
    expect(run("tick: clock32", X86_64, false)).toEqual([]);
    expect(run("tick: millis", X86_64, false)).toEqual([
      "E0879 Function 'millis' signature does not match callback type 'tickSource'",
    ]);
  });

  it("rejects a variadic function, though it takes no named parameter", () => {
    expect(run("tick: variadicClock", ARM, false)).toEqual([
      "E0879 Function 'variadicClock' signature does not match callback type 'tickSource'",
    ]);
  });

  it("compares a parameter as the callback typedef writes it", () => {
    expect(run("sink: onByte", ARM, false)).toEqual([]);
    expect(run("out: onBytePtr", ARM, false)).toEqual([]);
    expect(run("sink: onBytePtr", ARM, false)).toEqual([
      "E0879 Function 'onBytePtr' signature does not match callback type 'byteSink'",
    ]);
    expect(run("out: onByte", ARM, false)).toEqual([
      "E0879 Function 'onByte' signature does not match callback type 'byteOut'",
    ]);
  });

  it("names the function through global. as well as bare", () => {
    expect(run("tick: global.millis", ARM, false)).toEqual([]);
    expect(run("tick: global.clock32", ARM, false)).toEqual([
      "E0879 Function 'global.clock32' signature does not match callback type 'tickSource'",
    ]);
  });

  it("follows a header typedef to the type it names", () => {
    expect(run("tick: typedefClock", ARM, false)).toEqual([]);
    expect(run("tick: typedefClock", X86_64, false)).toEqual([
      "E0879 Function 'typedefClock' signature does not match callback type 'tickSource'",
    ]);
  });

  it("keeps char, signed char and unsigned char three types", () => {
    expect(run("byte: unsignedByte", ARM, false)).toEqual([]);
    expect(run("byte: plainChar", ARM, false)).toEqual([
      "E0879 Function 'plainChar' signature does not match callback type 'byteSource'",
    ]);
    expect(run("byte: signedChar", ARM, false)).toEqual([
      "E0879 Function 'signedChar' signature does not match callback type 'byteSource'",
    ]);
  });

  it("matches short and bool by their C spellings", () => {
    expect(run("half: unsignedShort", ARM, false)).toEqual([]);
    expect(run("half: millis", ARM, false)).toEqual([
      "E0879 Function 'millis' signature does not match callback type 'halfSource'",
    ]);
    expect(run("flag: cBool", ARM, false)).toEqual([]);
  });

  it("counts a pointer typedef's own *", () => {
    expect(run("out: onByteRef", ARM, false)).toEqual([]);
    expect(run("sink: onByteRef", ARM, false)).toEqual([
      "E0879 Function 'onByteRef' signature does not match callback type 'byteSink'",
    ]);
  });

  it("leaves a function-pointer parameter undecided, not mismatched", () => {
    expect(run("sinkTick: onClockFn", ARM, false)).toEqual([]);
    expect(run("sinkTick: onClockPtr", ARM, false)).toEqual([]);
    expect(run("sinkTick: onClockValue", ARM, false)).toEqual([
      "E0879 Function 'onClockValue' signature does not match callback type 'tickSink'",
    ]);
  });

  it("holds an array's inner dimensions to the slot's", () => {
    expect(run("grid: onGrid44", ARM, false)).toEqual([]);
    expect(run("grid: onGridMacro", ARM, false)).toEqual([]);
    expect(run("grid: onGrid48", ARM, false)).toEqual([
      "E0879 Function 'onGrid48' signature does not match callback type 'gridSink'",
    ]);
    expect(run("grid: onGridFlat", ARM, false)).toEqual([
      "E0879 Function 'onGridFlat' signature does not match callback type 'gridSink'",
    ]);
  });

  it("decides a system typedef the compiler names, and leaves one it does not", () => {
    expect(run("tick: sizeClock", ARM, false)).toEqual([
      "E0879 Function 'sizeClock' signature does not match callback type 'tickSource'",
    ]);
    expect(run("tick: timeClock", ARM, false)).toEqual([]);
  });

  it("holds a volatile pointee and a typedef's const to the slot", () => {
    expect(run("out: onVolatileByte", ARM, false)).toEqual([
      "E0879 Function 'onVolatileByte' signature does not match callback type 'byteOut'",
    ]);
    expect(run("row: onCBytes", ARM, false)).toEqual([]);
    expect(run("row: onMutBytes", ARM, false)).toEqual([
      "E0879 Function 'onMutBytes' signature does not match callback type 'rowSink'",
    ]);
  });

  it("takes a mut scalar as a reference in C++", () => {
    expect(run("out: onBytePtr", ARM, true)).toEqual([
      "E0879 Function 'onBytePtr' signature does not match callback type 'byteOut'",
    ]);
  });

  it("leaves an unprototyped C function's parameters open, not its return type", () => {
    expect(run("sink: legacySink", ARM, false)).toEqual([]);
    expect(run("tick: legacyCount", ARM, false)).toEqual([
      "E0879 Function 'legacyCount' signature does not match callback type 'tickSource'",
    ]);
  });

  it("reads C++'s `f()` as `f(void)`", () => {
    expect(run("sink: legacySink", ARM, true)).toEqual([
      "E0879 Function 'legacySink' signature does not match callback type 'byteSink'",
    ]);
  });

  it("leaves an array typedef's element open: its own dimensions are not counted", () => {
    expect(run("grid: onMacs", ARM, false)).toEqual([]);
  });
});
