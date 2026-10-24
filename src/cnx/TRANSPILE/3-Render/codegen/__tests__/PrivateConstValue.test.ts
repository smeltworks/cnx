import { describe, expect, it } from "vitest";
import PrivateConstValue from "../PrivateConstValue";
import type IProgram from "../../../../types/IProgram";
import type TConstExpr from "../../../../types/TConstExpr";
import type TSettledConst from "../../../../types/TSettledConst";
import type TranspileState from "../../../TranspileState";
import type IGeneratorState from "../generators/IGeneratorState";

const AT = { line: 1, column: 0, endLine: 1, endColumn: 0 };

const ENUM = {
  kind: "enum",
  members: new Map([
    ["IDLE", {}],
    ["RUN", {}],
  ]),
};

function stateWith(
  symbol: Record<string, unknown>,
  settled: TSettledConst | null,
): TranspileState {
  const full = {
    kind: "variable",
    fullyQualifiedCName: "S__K",
    scopePath: "S",
    visibility: "private",
    isConst: true,
    isArray: false,
    type: {
      kind: "primitive",
      primitive: settled?.kind === "value" ? settled.typeName : "u32",
    },
    ...symbol,
  };
  const program = {
    symbolByCName: (cName: string) =>
      ({ S__K: full, EMode: ENUM })[cName] ?? undefined,
    settledConstOf: (cName: string) => (cName === "S__K" ? settled : null),
    enumMemberValues: (cName: string) =>
      cName === "EMode"
        ? [
            { kind: "value", value: 0n, typeName: null },
            { kind: "value", value: 1n, typeName: null },
          ]
        : [],
  } as unknown as IProgram;
  return {
    typingContext: () => ({ program }),
    getTypedefType: () => undefined,
  } as unknown as TranspileState;
}

const GENERATOR = { expectedType: null } as unknown as IGeneratorState;

const inline = (
  symbol: Record<string, unknown>,
  settled: TSettledConst | null,
): string | null =>
  PrivateConstValue.inlined(GENERATOR, stateWith(symbol, settled), "S__K")
    ?.code ?? null;

const literal = (
  digits: string,
  typeName: string | null = null,
  text: string = digits,
): TConstExpr => ({
  kind: "literal",
  digits,
  text,
  typeName,
});

const binary: TConstExpr = {
  kind: "binary",
  op: "*",
  left: { kind: "name", root: null, path: ["N"], at: AT },
  right: literal("2"),
};

const negated: TConstExpr = { kind: "unary", op: "-", operand: literal("5") };

const value = (digits: string, typeName = "u32"): TSettledConst => ({
  kind: "value",
  digits,
  typeName,
});

const float = (digits: string, typeName: "f32" | "f64"): TSettledConst => ({
  kind: "float",
  digits,
  typeName,
});

describe("PrivateConstValue.inlined", () => {
  it("spells a folded expression as a literal of the const's type", () => {
    expect(
      inline({ initialValue: "N * 2", initialValueExpr: binary }, value("20")),
    ).toBe("20U");
  });

  it("keeps a literal's notation and renders its suffix as C's", () => {
    expect(
      inline(
        {
          initialValue: "0xAB",
          initialValueExpr: literal("171", null, "0xAB"),
        },
        value("171", "u8"),
      ),
    ).toBe("0xABU");
    expect(
      inline(
        { initialValue: "9u8", initialValueExpr: literal("9", "u8", "9u8") },
        value("9", "u8"),
      ),
    ).toBe("9U");
  });

  it("writes a literal's token, not the initializer's source text", () => {
    expect(
      inline(
        {
          initialValue: "(0xAB /* mask */)",
          initialValueExpr: literal("171", null, "0xAB"),
        },
        value("171", "u8"),
      ),
    ).toBe("0xABU");
  });

  it("spells a u64 past INT64_MAX as an unsigned long long", () => {
    expect(
      inline(
        { initialValue: "A + 1", initialValueExpr: binary },
        value("18446744073709551615", "u64"),
      ),
    ).toBe("18446744073709551615ULL");
  });

  it("parenthesizes a negative value, so `-X` stays a negation", () => {
    expect(
      inline(
        { initialValue: "-5", initialValueExpr: negated },
        value("-5", "i32"),
      ),
    ).toBe("(-5)");
    expect(
      inline(
        { initialValue: "-5", initialValueExpr: negated },
        value("-9223372036854775808", "i64"),
      ),
    ).toBe("(-9223372036854775807LL - 1)");
  });

  it("spells a float as its value held at its type", () => {
    const expr = { initialValue: "0.1", initialValueExpr: binary };
    expect(inline(expr, float(String(Math.fround(0.1)), "f32"))).toBe("0.1f");
    expect(inline(expr, float("0.5", "f64"))).toBe("0.5");
    expect(inline(expr, float("2", "f64"))).toBe("2.0");
    expect(inline(expr, float("-0.5", "f32"))).toBe("(-0.5f)");
    expect(inline(expr, float("Infinity", "f64"))).toBeNull();
  });

  it("spells a bool as its literal and an enum as its member", () => {
    const expr = { initialValue: "A", initialValueExpr: binary };
    expect(inline(expr, { kind: "bool", value: true })).toBe("true");
    expect(inline(expr, { kind: "bool", value: false })).toBe("false");
    expect(
      inline(expr, { kind: "named", digits: "1", typeName: "EMode" }),
    ).toBe("EMode__RUN");
    expect(
      inline(expr, { kind: "named", digits: "1", typeName: "Flags" }),
    ).toBeNull();
  });

  it("spells a char literal and a lone header macro as C does", () => {
    const character: TConstExpr = {
      kind: "other",
      what: "character",
      spelling: "'A'",
      at: AT,
    };
    expect(
      inline(
        { initialValue: "'A'", initialValueExpr: character },
        {
          kind: "notConstant",
          reason: "character",
          spelling: "'A'",
          at: AT,
        },
      ),
    ).toBe("'A'");
    const macro: TConstExpr = {
      kind: "name",
      root: null,
      path: ["LIMIT"],
      at: AT,
    };
    const foreign: TSettledConst = {
      kind: "foreign",
      spelling: "LIMIT",
      why: "header",
    };
    expect(
      inline({ initialValue: "LIMIT", initialValueExpr: macro }, foreign),
    ).toBe("(LIMIT)");
    expect(
      inline({ initialValue: "LIMIT * 2", initialValueExpr: binary }, foreign),
    ).toBeNull();
  });

  it("gives any const's value to a case label, not only a private one's", () => {
    const state = stateWith(
      {
        initialValue: "4",
        initialValueExpr: literal("4"),
        visibility: "public",
      },
      value("4"),
    );
    expect(PrivateConstValue.inlined(GENERATOR, state, "S__K")).toBeNull();
    expect(PrivateConstValue.constant(GENERATOR, state, "S__K")?.code).toBe(
      "4U",
    );
  });

  it("emits a const with no settled value", () => {
    expect(
      inline({ initialValue: '"abc"', initialValueExpr: binary }, null),
    ).toBeNull();
  });

  it("inlines only a private, scalar scope const", () => {
    const base = { initialValue: "4", initialValueExpr: literal("4") };
    for (const differs of [
      { visibility: "public" },
      { isArray: true },
      { isConst: false },
      { scopePath: "" },
    ]) {
      expect(inline({ ...base, ...differs }, value("4"))).toBeNull();
    }
    expect(inline(base, value("4"))).toBe("4U");
  });
});
