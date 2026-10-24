import { describe, expect, it } from "vitest";

import StaticInitializerAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/StaticInitializerAnalyzer";
import StaticInitializers from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/StaticInitializers";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import PrivateConstSpelling from "../../../../../cnx/TRANSPILE/2-Plan/PrivateConstSpelling";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1735: a static-storage initializer is a value fixed at compile time, so
 * each value in it is folded at the type its position holds it at -- E0910
 * where that would clamp or wrap, E0909 where it has no value.
 */
const setUp = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  const positions = ValuePositions.of(syntax, context);
  return { syntax, context, positions };
};

const codes = (source: string): string[] => {
  const { syntax, context, positions } = setUp(source);
  return new StaticInitializerAnalyzer(context)
    .analyze(syntax, positions)
    .map((e) => `${e.span.line}:${e.code}`);
};

const spelled = (source: string): (string | null)[] => {
  const { syntax, context, positions } = setUp(source);
  return StaticInitializers.values(syntax, positions.positions).map(
    (value) =>
      PrivateConstSpelling.ofValue(
        context.program,
        StaticInitializers.settle(value, context.program, context.sourceFile),
        value.typeName ?? "",
      )?.text ?? null,
  );
};

describe("StaticInitializerAnalyzer", () => {
  it("rejects arithmetic that would clamp at file scope, in an array and in a scope", () => {
    expect(
      codes(
        [
          "u8 D <- 250;",
          "u8 E <- D + 10;",
          "u8[2] R <- [D, D + 10];",
          "scope S {",
          "    public u8 Q <- D + 6;",
          "}",
        ].join("\n"),
      ),
    ).toEqual(["2:E0910", "3:E0910", "5:E0910"]);
  });

  it("rejects a float fold past its finite range, and not one that fits", () => {
    expect(
      codes("f32 F <- 3.0e38;\nf32 FO <- F * 10.0;\nf32 FW <- F * 0.5;"),
    ).toEqual(["2:E0910"]);
  });

  it("stays silent where the arithmetic fits", () => {
    expect(codes("u8 D <- 250;\nu16 W <- (u16)D + 10;")).toEqual([]);
  });

  it("rejects a variable and a call, which have no value", () => {
    expect(
      codes(
        [
          "mut u32 g <- 4;",
          "bool f() {",
          "    return true;",
          "}",
          "u32 FromVariable <- g;",
          "bool FromCall <- f();",
        ].join("\n"),
      ),
    ).toEqual(["5:E0909", "6:E0909"]);
  });

  it("stays silent for a char-literal const, whose value C has", () => {
    expect(codes("u8 CH <- 'A';\nu8 first <- CH;")).toEqual([]);
  });
});

describe("StaticInitializers", () => {
  it("folds each value, leaving a literal as written", () => {
    expect(
      spelled(
        [
          "u32 A <- 4;",
          "u32 B <- A * 2;",
          "f32 F <- 1.5;",
          "f32 G <- F * 2.0;",
          "bool T <- A > 2;",
          "i64 M <- -9223372036854775807 - 1;",
          "struct P {",
          "    u32 x;",
          "    u32 y;",
          "}",
          "P p <- { x: A + 1, y: 2 };",
        ].join("\n"),
      ),
    ).toEqual(["8", "3.0f32", "true", "(-9223372036854775807LL - 1)", "5"]);
  });

  it("has no spelling for a value that overflows", () => {
    expect(spelled("u8 D <- 250;\nu8 E <- D + 10;")).toEqual([null]);
  });

  it("knows which values read a variable", () => {
    const { syntax, context, positions } = setUp(
      [
        "u32 A <- 4;",
        "u32 B <- A + 1;",
        "u32 L <- A.type_bit_length;",
        "u32 N <- 3 + 4;",
      ].join("\n"),
    );
    expect(
      StaticInitializers.values(syntax, positions.positions).map((value) =>
        StaticInitializers.readsVariable(
          value.value,
          context.program,
          context.sourceFile,
        ),
      ),
    ).toEqual([true, false, false]);
  });

  it("finds the const a value names alone", () => {
    const { syntax, context, positions } = setUp(
      "u8 CH <- 'A';\nu8 first <- CH;\nu8 next <- CH + 1;",
    );
    expect(
      StaticInitializers.values(syntax, positions.positions).map(
        (value) =>
          StaticInitializers.namedConst(
            value.value,
            context.program,
            context.sourceFile,
          )?.name ?? null,
      ),
    ).toEqual(["CH", null]);
  });
  it("rejects an enum or a struct value that reads a variable, not one that names a const", () => {
    expect(
      codes(
        [
          "enum EColor { RED, GREEN }",
          "struct Pt { u32 x; u32 y; }",
          "mut EColor g <- EColor.RED;",
          "mut Pt gp <- {x: 1, y: 2};",
          "EColor K <- EColor.GREEN;",
          "EColor h <- g;",
          "Pt hp <- gp;",
          "EColor k2 <- K;",
        ].join("\n"),
      ),
    ).toEqual(["6:E0909", "7:E0909"]);
  });

  it("names the cast when a cast's value does not fit", () => {
    const { syntax, context, positions } = setUp("u8 X <- (u8)300;");
    const [error] = new StaticInitializerAnalyzer(context).analyze(
      syntax,
      positions,
    );
    expect(error?.code).toBe("E0910");
    expect(error?.message).toContain("the value cast to u8 does not fit it");
  });

  it("reads a scope's const through the scope, as the fold does", () => {
    const { syntax, context, positions } = setUp(
      [
        "scope S {",
        "    public u8 CH <- 'A';",
        "    public u32 LIMIT <- 10;",
        "}",
        "u8 QCH <- S.CH;",
        "u32 QL <- S.LIMIT + 1;",
      ].join("\n"),
    );
    const [qch, ql] = StaticInitializers.values(syntax, positions.positions);
    const { program, sourceFile } = context;
    expect(
      StaticInitializers.namedConst(qch!.value, program, sourceFile)
        ?.fullyQualifiedCName,
    ).toBe("S__CH");
    expect(
      StaticInitializers.readsVariable(ql!.value, program, sourceFile),
    ).toBe(true);
    expect(StaticInitializers.bareNames(ql!.value)).toEqual([]);
  });

  it("writes a header name mixed with a const as C evaluates it", () => {
    const { syntax, context, positions } = setUp(
      ["u32 A <- 4;", "u32 S <- A.type_bit_length + A;"].join("\n"),
    );
    const [value] = StaticInitializers.values(syntax, positions.positions);
    expect(
      StaticInitializers.cText(value!, context.program, context.sourceFile),
    ).toBe("36");
  });
});
