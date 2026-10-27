/**
 * #1668: the one operand typer, a row per shape (design §3), through real
 * declared and resolved programs.
 */
import SyntaxLowering from "../../../../cnx/PARSE/2-Parse/SyntaxLowering";
import { describe, it, expect } from "vitest";
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CnxListener } from "../../../../cnx/PARSE/2-Parse/grammar/CnxListener";
import * as Parser from "../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import OperandTyper from "../../../../cnx/utils/OperandTyper";
import QualifiedCName from "../../../../cnx/utils/QualifiedCName";
import HeaderParser from "../../../../cnx/PARSE/2-Parse/HeaderParser";
import CResolver from "../../../../cnx/PARSE/3-Declare/c/index";
import CppResolver from "../../../../cnx/PARSE/3-Declare/cpp/index";
import CompositeType from "../../../../cnx/utils/CompositeType";
import ESourceLanguage from "../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "../TRANSPILE/1-Analyze/testAnalysisContextFor";
import type IOperandType from "../../../../cnx/types/IOperandType";
import type ITypingContext from "../../../../cnx/types/ITypingContext";
import type TSubscriptKind from "../../../../cnx/types/TSubscriptKind";
import ExpressionUnwrapper from "../../../../cnx/PARSE/2-Parse/ExpressionUnwrapper";

/** Register a C symbol, as Stage 2 would from a header */
function withC(
  table: SymbolTable,
  symbols: Array<Record<string, unknown> & { kind: string; name: string }>,
): SymbolTable {
  for (const symbol of symbols) {
    table.addCSymbol({
      sourceFile: "api.h",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      ...symbol,
    } as never);
  }
  return table;
}

/** A real header, parsed and resolved as Stage 2 does, in a fresh table */
function header(source: string, cpp = false): SymbolTable {
  const table = new SymbolTable();
  if (cpp) {
    const tree = HeaderParser.parseCpp(source).syntax;
    table.addCppSymbols(CppResolver.resolve(tree!, "api.hpp", table).symbols);
  } else {
    const tree = HeaderParser.parseC(source).syntax;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
  }
  return table;
}

/** The initializer of the declaration of `name`, and the context to type it */
function initializerOf(
  source: string,
  name: string,
  symbolTable?: SymbolTable,
  helpers?: Record<string, string>,
): { node: Parser.ExpressionContext; ctx: ITypingContext } {
  const { tree, context } = testAnalysisContextFor(source, {
    cppMode: false,
    symbolTable,
    helpers,
  });
  let found: Parser.ExpressionContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CnxListener {
      override enterVariableDeclaration = (
        ctx: Parser.VariableDeclarationContext,
      ): void => {
        if (ctx.IDENTIFIER().getText() === name) found = ctx.expression();
      };
    })(),
    tree,
  );
  expect(found).not.toBeNull();
  return { node: found!, ctx: { ...context, sourceFile: "test.cnx" } };
}

function typeOf(
  source: string,
  name = "r",
  symbolTable?: SymbolTable,
  helpers?: Record<string, string>,
): IOperandType | null {
  const { node, ctx } = initializerOf(source, name, symbolTable, helpers);
  return OperandTyper.typeOf(
    SyntaxLowering.expressionNode(node as ParserRuleContext),
    ctx,
  );
}

/** The facts a row asserts */
function facts(t: IOperandType | null) {
  return t === null
    ? null
    : {
        typeName: t.typeName,
        category: t.category,
        bitWidth: t.bitWidth,
        form: t.form.kind,
      };
}

const inMain = (body: string) => `void main() {\n${body}\n}`;

describe("OperandTyper.typeOf: names", () => {
  it.each([
    ["a local", inMain("u8 a <- 1;\nu8 r <- a;"), "u8", "unsigned", 8],
    ["a parameter", "void f(i16 p) {\n    i16 r <- p;\n}", "i16", "signed", 16],
    [
      "a global",
      "f32 g <- 1.0;\n" + inMain("f32 r <- g;"),
      "f32",
      "floating",
      null,
    ],
    [
      "a bool",
      inMain("bool b <- true;\nbool r <- b;"),
      "bool",
      "boolean",
      null,
    ],
  ])("types %s", (_why, source, typeName, category, bitWidth) => {
    expect(facts(typeOf(source))).toEqual({
      typeName,
      category,
      bitWidth,
      form: "declared",
    });
  });

  it("carries a whole variable's overflow behavior and binding", () => {
    const t = typeOf(inMain("wrap u8 a <- 1;\nu8 r <- a;"));
    expect(t?.overflow).toBe("wrap");
    expect(t?.binding?.kind).toBe("local");
  });

  it("binds a local that shadows a scope member to the local (#1700)", () => {
    const t = typeOf(`scope S {
    u32 n <- 1;
    public void f() {
        u8 n <- 2;
        u8 r <- n;
    }
}`);
    expect(t?.typeName).toBe("u8");
  });

  it("types this.x in a scope reopened in another file (#1699)", () => {
    const t = typeOf(
      `#include "other.cnx"
scope S {
    public void f() {
        u32 r <- this.x;
    }
}`,
      "r",
      undefined,
      { "other.cnx": "scope S {\n    u32 x <- 300;\n}" },
    );
    expect(t?.typeName).toBe("u32");
  });

  it("types global.x, never the local that shadows it (#1701)", () => {
    const t = typeOf(`u32 x <- 1;
void f() {
    u8 x <- 2;
    u32 r <- global.x;
}`);
    expect(t?.typeName).toBe("u32");
  });

  it("types Scope.member (C07)", () => {
    const t = typeOf(`scope S {
    public u16 m <- 1;
}
void f() {
    u16 r <- S.m;
}`);
    expect(t?.typeName).toBe("u16");
  });

  it("marks a volatile or atomic read as a side effect", () => {
    expect(
      typeOf(inMain("volatile u8 a <- 1;\nu8 r <- a;"))?.hasSideEffect,
    ).toBe(true);
    expect(typeOf(inMain("u8 a <- 1;\nu8 r <- a;"))?.hasSideEffect).toBe(false);
  });
});

describe("OperandTyper.typeOfWritten (#1668)", () => {
  it.each([
    ["this.T inside its scope", "this.EMode", ["Motor", "EMode"]],
    ["a bare T inside its scope", "EMode", ["Motor", "EMode"]],
    ["global.T", "global.EMode", ["EMode"]],
    ["Scope.T", "Motor.EMode", ["Motor", "EMode"]],
  ])("types a cast to %s by 1.3's one ladder", (_why, written, parts) => {
    const source = `enum EMode { A, B }\nscope Motor {\nenum EMode { C, D }\npublic void f() {\nu8 x <- 1;\nu8 r <- (${written})x;\n}\n}`;
    const t = typeOf(source);
    expect(t?.category).toBe("enum");
    expect(t?.enumTypeName).toBe(
      QualifiedCName.fromSourceName(parts.join(".")),
    );
  });
});

describe("OperandTyper.constantOf (#1668)", () => {
  function constantOf(source: string): number | null {
    const { node, ctx } = initializerOf(source, "r");
    return OperandTyper.constantOf(
      SyntaxLowering.expressionNode(node as ParserRuleContext),
      ctx,
    );
  }

  it.each([
    ["a literal", "u8 r <- 9;", 9],
    ["a suffixed literal", "u8 r <- 9u8;", 9],
    ["a negated literal", "i8 r <- -9;", -9],
    ["a doubly negated literal", "i8 r <- - -9;", 9],
    ["a const local", "u8 N <- 7;\nu8 r <- N;", 7],
    ["a mutable local", "mut u8 N <- 7;\nu8 r <- N;", null],
    ["a leading-zero literal (#1728)", "u8 r <- 010;", null],
    // #1175: arithmetic folds now, at its operands' width (ADR-044), where it
    // used to be called a runtime value because folding ignored that width
    ["arithmetic", "u8 r <- 2 + 3;", 5],
    ["a bitwise complement: an untyped literal is an i32", "u8 r <- ~3;", -4],
    ["arithmetic over a variable", "mut u8 v <- 2;\nu8 r <- v + 3;", null],
    ["arithmetic ADR-044 would clamp", "u8 A <- 200;\nu8 r <- A + A;", null],
  ])("evaluates %s", (_why, body, value) => {
    expect(constantOf(inMain(body))).toBe(value);
  });

  it("binds a file const, and a const local shadowing it", () => {
    expect(constantOf("u8 N <- 4;\nvoid main() {\nu8 r <- N;\n}")).toBe(4);
    expect(
      constantOf("u8 N <- 4;\nvoid main() {\nu8 N <- 6;\nu8 r <- N;\n}"),
    ).toBe(6);
  });

  it("binds this.NAME and global.NAME to the scope's and the file's", () => {
    const source = (spelling: string) =>
      `const u8 N <- 4;\nscope S {\nconst u8 N <- 6;\npublic void f() {\nu8 r <- ${spelling};\n}\n}`;
    expect(constantOf(source("this.N"))).toBe(6);
    expect(constantOf(source("global.N"))).toBe(4);
  });

  it("does not evaluate an element of a const array", () => {
    expect(constantOf(inMain("u8[2] T <- [1, 2];\nu8 r <- T[0];"))).toBeNull();
  });
});

describe("OperandTyper.typeOf: literals (R2)", () => {
  it.each([
    ["an unsuffixed integer", "5", "int", "none", null, "literal"],
    ["a suffixed integer", "5u16", "u16", "unsigned", 16, "literal"],
    ["a signed suffix", "5i32", "i32", "signed", 32, "literal"],
    ["a hex integer", "0xFF", "int", "none", null, "literal"],
    ["a float", "2.5", "f64", "floating", null, "literal"],
    ["a suffixed float", "2.5f32", "f32", "floating", null, "literal"],
    ["a Boolean", "true", "bool", "boolean", null, "literal"],
    ["a character", "'A'", "char", "character", 8, "literal"],
  ])("types %s", (_why, literal, typeName, category, bitWidth, form) => {
    expect(facts(typeOf(inMain(`u32 r <- ${literal};`)))).toEqual({
      typeName,
      category,
      bitWidth,
      form,
    });
  });
});

describe("OperandTyper.typeOf: operators", () => {
  it("types a cast by its target type, keeping the operand's side effect", () => {
    const t = typeOf(`u8 get() {
    return 1;
}
void main() {
    f32 r <- (f32)get();
}`);
    expect(facts(t)).toEqual({
      typeName: "f32",
      category: "floating",
      bitWidth: null,
      form: "cast",
    });
    expect(t?.hasSideEffect).toBe(true);
  });

  it("types a composite by its leaves", () => {
    const t = typeOf(inMain("u8 a <- 1;\nu8 b <- 2;\nu8 r <- a + b;"));
    expect(t?.form.kind).toBe("composite");
    expect(t?.category).toBe("unsigned");
    expect(t?.typeName).toBe("u8");
  });

  // #1760 second review: an integer composite of mixed widths was untyped,
  // so each consumer rebuilt its type from the leaves
  it.each([
    ["u32 + u16", "u32 a <- 1;\nu16 b <- 2;\nu32 r <- a + b;", "u32", 32],
    ["i8 x i16", "i8 a <- 1;\ni16 b <- 2;\ni16 r <- a * b;", "i16", 16],
    ["u8 + a literal", "u8 a <- 1;\nu8 r <- a + 5;", "u8", 8],
    ["u32 + a character", "u32 a <- 1;\nu32 r <- a + 'A';", "u32", 32],
  ])(
    "types an integer composite, %s, with its width",
    (_why, body, name, width) => {
      expect(typeOf(inMain(body))).toMatchObject({
        typeName: name,
        bitWidth: width,
      });
    },
  );

  it("gives a non-integer composite no width", () => {
    expect(typeOf(inMain("f32 k <- 2.0;\nf32 r <- k * k;"))).toMatchObject({
      typeName: "f32",
      bitWidth: null,
    });
  });

  it("types a parenthesized composite (ETR :759-763)", () => {
    const t = typeOf(inMain("u8 a <- 1;\nu8 r <- (a + a);"));
    expect(t?.form.kind).toBe("composite");
  });

  it("types a ternary by its value arms, never its condition", () => {
    const same = typeOf(
      inMain("i32 c <- 1;\nu8 a <- 1;\nu8 r <- (c > 0) ? a : a;"),
    );
    expect(same).toMatchObject({ typeName: "u8", category: "unsigned" });
    expect(same?.form.kind).toBe("ternary");
    const mixed = typeOf(
      inMain("u8 a <- 1;\ni8 s <- 1;\nu8 r <- (a > 0) ? a : s;"),
    );
    expect(mixed).toMatchObject({ typeName: null, category: "none" });
  });

  // #1760 review: floating leaves of different names were untyped, so a
  // cast of them skipped ADR-024's saturation
  it.each([
    ["f32 x f64 literal", "f32 k <- 2.0;\nf32 r <- k * 2.0;", "f64"],
    ["f32 + f64", "f32 k <- 2.0;\nf64 d <- 2.0;\nf64 r <- k + d;", "f64"],
    ["f32 x integer literal", "f32 k <- 2.0;\nf32 r <- k * 2;", "f32"],
    ["a control: one name", "f32 k <- 2.0;\nf32 r <- k * k;", "f32"],
  ])(
    "types a floating composite, %s, by C's conversion",
    (_why, body, name) => {
      expect(typeOf(inMain(body))).toMatchObject({
        typeName: name,
        category: "floating",
      });
    },
  );

  it("types floating arms of different names by C's conversion", () => {
    const arms = typeOf(inMain("f32 k <- 2.0;\nf64 r <- (k > 1.0) ? k : 2.0;"));
    expect(arms).toMatchObject({ typeName: "f64", category: "floating" });
    // Control: an integer arm beside a floating one stays untyped (E0810)
    const mixed = typeOf(
      inMain("f32 k <- 2.0;\nu8 a <- 1;\nf32 r <- (k > 1.0) ? k : a;"),
    );
    expect(mixed).toMatchObject({ typeName: null, category: "none" });
  });

  it.each([
    ["-x", "-a", "i16"],
    ["~x", "~a", "i16"],
  ])("types %s as its operand", (_why, expr, typeName) => {
    expect(typeOf(inMain(`i16 a <- 1;\ni16 r <- ${expr};`))?.typeName).toBe(
      typeName,
    );
  });

  it("types !x and a comparison as Boolean", () => {
    expect(typeOf(inMain("u8 a <- 1;\nbool r <- !(a > 0);"))?.form.kind).toBe(
      "boolean",
    );
    expect(typeOf(inMain("u8 a <- 1;\nbool r <- a > 0;"))?.form.kind).toBe(
      "boolean",
    );
  });

  it("types a shift by its left operand (C01)", () => {
    expect(
      typeOf(inMain("u16 a <- 1;\ni32 n <- 2;\nu16 r <- a << n;"))?.typeName,
    ).toBe("u16");
  });
});

describe("OperandTyper.typeOf: fields, elements and bits", () => {
  it("types a struct field", () => {
    const t = typeOf(`struct P { i8 v; }
void main() {
    P p <- {v: 1};
    i8 r <- p.v;
}`);
    expect(t).toMatchObject({
      typeName: "i8",
      category: "signed",
      overflow: "clamp",
    });
  });

  it("removes the LEADING dimension per subscript (ETR :706-716)", () => {
    const row = typeOf(inMain("u32[2][3] grid;\nu32 r <- grid[1][0];"));
    expect(row).toMatchObject({ typeName: "u32", dimensions: [] });
    const part = typeOf(inMain("u32[2][3] grid;\nu32 r <- grid[1];"), "r");
    expect(part?.dimensions).toEqual([3]);
  });

  it("types a string's element as a character", () => {
    expect(typeOf(inMain('string<8> s <- "hi";\nu8 r <- s[0];'))).toMatchObject(
      {
        typeName: "char",
        category: "character",
      },
    );
  });

  it("types one bit of a scalar as a bit index, not a Boolean", () => {
    const t = typeOf(inMain("u32 w <- 1;\nbool r <- w[3];"));
    expect(t?.form.kind).toBe("bitIndex");
    expect(OperandTyper.isBoolean(t)).toBe(false);
  });

  it("gives an element read the side effect of its index (#1668, C26)", () => {
    const decls =
      "mut u32 calls <- 0;\nf32[4] arr;\nu32 nextIndex() { calls +<- 1; return 0; }\n";
    const called = typeOf(
      `${decls}void main() {\nf32 r <- arr[nextIndex()];\n}`,
    );
    expect(called?.hasSideEffect).toBe(true);
    const pure = typeOf(`${decls}void main() {\nf32 r <- arr[0];\n}`);
    expect(pure?.hasSideEffect).toBe(false);
  });

  it("types a string field as a string, not an array of its C buffer", () => {
    const struct = "struct Config {\nstring<32> name;\nstring<8>[4] tags;\n}\n";
    const name = typeOf(
      `${struct}void main() {\nConfig c;\nstring<32> r <- c.name;\n}`,
    );
    expect(name).toMatchObject({ stringCapacity: 32, dimensions: [] });
    const tags = typeOf(
      `${struct}void main() {\nConfig c;\nstring<8> r <- c.tags[1];\n}`,
    );
    expect(tags).toMatchObject({ stringCapacity: 8, dimensions: [] });
  });

  it("decays a string field like an array, though its buffer is no dimension (#1737)", () => {
    const struct = "struct Config {\nstring<32> name;\nu8 count;\n}\n";
    const name = typeOf(
      `${struct}void main() {\nConfig c;\nstring<32> r <- c.name;\n}`,
    );
    expect(OperandTyper.decaysToPointer(name)).toBe(true);
    const count = typeOf(
      `${struct}void main() {\nConfig c;\nu8 r <- c.count;\n}`,
    );
    expect(OperandTyper.decaysToPointer(count)).toBe(false);
  });

  it("gives a scalar string's capacity, and none for an array of them (#1737)", () => {
    const decls = "string<8>[2][3] grid;\nstring<8> one;\n";
    expect(
      OperandTyper.scalarStringCapacity(
        typeOf(`${decls}void main() {\nstring<8> r <- grid[0][1];\n}`),
      ),
    ).toBe(8);
    expect(
      OperandTyper.scalarStringCapacity(
        typeOf(`${decls}void main() {\nstring<8> r <- one;\n}`),
      ),
    ).toBe(8);
    expect(
      OperandTyper.scalarStringCapacity(
        typeOf(`${decls}void main() {\nstring<8>[3] row <- grid[0];\n}`, "row"),
      ),
    ).toBeNull();
    expect(
      OperandTyper.scalarStringCapacity(
        typeOf(`${decls}void main() {\nu8 r <- one[0];\n}`),
      ),
    ).toBeNull();
  });

  it("does not call an array of bools a Boolean", () => {
    const row = typeOf(inMain("bool[2][3] f;\nbool r <- f[0];"));
    expect(row).toMatchObject({ typeName: "bool", dimensions: [3] });
    expect(OperandTyper.isBoolean(row)).toBe(false);
    const cell = typeOf(inMain("bool[2][3] f;\nbool r <- f[0][1];"));
    expect(OperandTyper.isBoolean(cell)).toBe(true);
  });

  it("types a bit range at its folded width (C18b)", () => {
    const t = typeOf(inMain("u8 W <- 8;\nu32 w <- 1;\nu8 r <- w[0, W];"));
    expect(t).toMatchObject({ typeName: "u8", bitWidth: 8 });
    expect(t?.form).toEqual({ kind: "bitRange", width: 8 });
  });

  it("types a variable of an enum, and an enum member", () => {
    const source = `enum Color { RED, GREEN }
void main() {
    Color c <- Color.RED;
    Color r <- c;
    Color m <- Color.GREEN;
}`;
    expect(typeOf(source)).toMatchObject({
      category: "enum",
      enumTypeName: "Color",
    });
    expect(typeOf(source, "m")).toMatchObject({
      category: "enum",
      enumTypeName: "Color",
      form: { kind: "enumMember" },
    });
  });

  it("types a bitmap field: one bit Boolean, wider unsigned", () => {
    const source = `bitmap8 Flags { Mode[3], Enable, Rest[4] }
void main() {
    Flags f;
    u8 r <- f.Mode;
    bool e <- f.Enable;
}`;
    expect(typeOf(source)).toMatchObject({
      typeName: "u8",
      category: "unsigned",
      bitWidth: 3,
    });
    expect(typeOf(source, "e")).toMatchObject({ category: "boolean" });
  });

  it("types a register member (C11)", () => {
    const t = typeOf(`register R @ 0x40000000 {
    CTRL: u16 rw @ 0x00,
}
void main() {
    u16 r <- R.CTRL;
}`);
    expect(t).toMatchObject({ typeName: "u16", overflow: null });
  });
});

describe("OperandTyper.typeOf: calls", () => {
  it("binds a bare call in a scope to the scope's function (#1698)", () => {
    const t = typeOf(`u8 get() {
    return 1;
}
scope S {
    u32 get() {
        return 300;
    }
    public void f() {
        u32 r <- get();
    }
}`);
    expect(t).toMatchObject({ typeName: "u32", form: { kind: "call" } });
  });

  it.each([
    ["this.f()", "this.get()"],
    ["Scope.f()", "S.get()"],
  ])("types %s (C17)", (_why, call) => {
    const t = typeOf(`scope S {
    public u16 get() {
        return 1;
    }
    public void f() {
        u16 r <- ${call};
    }
}`);
    expect(t?.typeName).toBe("u16");
  });

  it("keeps walking after a call: get().v (C10)", () => {
    const t = typeOf(`struct P { i8 v; }
P make() {
    P p <- {v: 1};
    return p;
}
void main() {
    i8 r <- make().v;
}`);
    expect(t?.typeName).toBe("i8");
  });
});

describe("OperandTyper.typeOf: C and C++ operands (R4)", () => {
  it.each([
    ["uint32_t", "", "u32", "unsigned", 32],
    ["int", "", "i32", "signed", 32],
    ["int", "#pragma target avr\n", "i16", "signed", 16],
    ["unsigned long", "", "u64", "unsigned", 64],
    ["unsigned long", "#pragma target cortex-m7\n", "u32", "unsigned", 32],
    ["uint_fast16_t", "", null, "unsigned", null],
    ["float", "", "f32", "floating", null],
    ["double", "#pragma target avr\n", "f32", "floating", null],
    ["char", "", "char", "character", 8],
  ])(
    "types a C %s variable (%s)",
    (cType, pragma, typeName, category, bitWidth) => {
      const table = withC(new SymbolTable(), [
        { kind: "variable", name: "cVar", type: cType },
      ]);
      const t = typeOf(`${pragma}${inMain("u32 r <- cVar;")}`, "r", table);
      expect(t).toMatchObject({ typeName, category, bitWidth });
    },
  );

  it("matches the fixed-width name before following its typedef (M34)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "type", name: "uint32_t", type: "unsigned long" },
      { kind: "variable", name: "cVar", type: "uint32_t" },
    ]);
    expect(typeOf(inMain("u32 r <- cVar;"), "r", table)?.typeName).toBe("u32");
  });

  it("follows a typedef to a known spelling", () => {
    const table = withC(new SymbolTable(), [
      { kind: "type", name: "real_t", type: "float" },
      { kind: "variable", name: "cVar", type: "real_t" },
    ]);
    expect(typeOf(inMain("f32 r <- cVar;"), "r", table)?.category).toBe(
      "floating",
    );
  });

  it("keeps a C array's dimensions, so its subscript is an element (#978)", () => {
    const table = withC(new SymbolTable(), [
      {
        kind: "variable",
        name: "buf",
        type: "uint8_t",
        isArray: true,
        arrayDimensions: [""],
      },
    ]);
    expect(typeOf(inMain("u8 r <- buf[3];"), "r", table)).toMatchObject({
      typeName: "u8",
      dimensions: [],
    });
  });

  it("leaves a pointer untyped", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "ptr", type: "uint8_t *" },
    ]);
    expect(typeOf(inMain("u8 r <- ptr;"), "r", table)).toBeNull();
  });
});

describe("OperandTyper.valueLeaves", () => {
  function leaves(source: string) {
    const { node, ctx } = initializerOf(source, "r");
    return OperandTyper.valueLeaves(
      SyntaxLowering.expressionNode(node as ParserRuleContext),
      ctx,
    ).map((leaf) => leaf?.typeName ?? null);
  }

  it("collects every value leaf of a composite", () => {
    expect(
      leaves(inMain("u8 a <- 1;\nu16 b <- 2;\nu16 r <- a + b * 2;")),
    ).toEqual(["u8", "u16", "int"]);
  });

  it("never counts a shift count or a ternary's condition", () => {
    expect(
      leaves(
        inMain(
          "u8 a <- 1;\ni32 n <- 1;\ni8 c <- 1;\nu8 r <- (a << n) + ((c > 0) ? a : a);",
        ),
      ),
    ).toEqual(["u8", "u8", "u8"]);
  });

  it("descends through parentheses and unary minus, not an address", () => {
    expect(leaves(inMain("i8 a <- 1;\ni8 r <- -(a + a);"))).toEqual([
      "i8",
      "i8",
    ]);
  });

  it("stops at a comparison, as one Boolean leaf", () => {
    expect(leaves(inMain("u8 a <- 1;\nu8 r <- a + (a > 0);"))).toEqual([
      "u8",
      "bool",
    ]);
  });
});

describe("CompositeType.integerOf", () => {
  function integerOf(source: string, table?: SymbolTable) {
    const { node, ctx } = initializerOf(source, "r", table);
    return CompositeType.integerOf(
      OperandTyper.valueLeaves(
        SyntaxLowering.expressionNode(node as ParserRuleContext),
        ctx,
      ),
    );
  }

  it.each([
    ["the widest integer", "u8 a <- 1;\nu32 b <- 1;\nu32 r <- a + b;", "u32"],
    [
      "an unsuffixed literal is not counted",
      "u8 a <- 1;\nu8 r <- a + 300;",
      "u8",
    ],
    [
      "a suffixed literal counts at its suffix",
      "u8 b <- 1;\nu32 r <- b + 100u32;",
      "u32",
    ],
    ["a float vetoes", "u32 a <- 1;\nf32 k <- 1.0;\nf32 r <- a * k;", null],
    [
      "a bit range counts at its width",
      "u32 w <- 1;\nu8 b <- 1;\nu16 r <- b + w[0, 12];",
      "u16",
    ],
    ["a Boolean is not counted", "u8 a <- 1;\nu8 r <- a + (a > 0);", "u8"],
  ])("%s", (_why, body, expected) => {
    expect(integerOf(inMain(body))).toBe(expected);
  });

  it("counts a C integer at the target's width (S23)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "cU32", type: "uint32_t" },
    ]);
    expect(integerOf(inMain("u8 b <- 1;\nu32 r <- b + cU32;"), table)).toBe(
      "u32",
    );
  });

  it("vetoes a C integer of unknown width (S24)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "cFast", type: "uint_fast16_t" },
    ]);
    expect(
      integerOf(inMain("u8 b <- 1;\nu32 r <- b + cFast;"), table),
    ).toBeNull();
  });
});

describe("OperandTyper", () => {
  it("holds no state: a static class with no fields", () => {
    const own = Object.getOwnPropertyNames(OperandTyper).filter(
      (name) =>
        typeof (OperandTyper as unknown as Record<string, unknown>)[name] !==
        "function",
    );
    expect(own.sort()).toEqual(["length", "name", "prototype"]);
  });
});

describe("OperandTyper.typeOf: headers, end to end", () => {
  it("keeps an array typedef's dimensions, so gv[0] is an element (C20)", () => {
    const table = header("typedef float vec3[3];\nextern vec3 gv;");
    expect(typeOf(inMain("f32 r <- gv[0];"), "r", table)).toMatchObject({
      typeName: "f32",
      category: "floating",
      dimensions: [],
    });
  });

  it("types a C struct's field, and a C function's result", () => {
    const table = header(
      "typedef struct { float v; unsigned short n; } Sample;\nextern Sample cs;\nint cGet(void);",
    );
    expect(typeOf(inMain("f32 r <- cs.v;"), "r", table)?.category).toBe(
      "floating",
    );
    expect(typeOf(inMain("u16 r <- cs.n;"), "r", table)?.typeName).toBe("u16");
    const call = typeOf(inMain("i32 r <- cGet();"), "r", table);
    expect(call).toMatchObject({ typeName: "i32", hasSideEffect: true });
  });

  it("leaves a C++ overload set whose categories disagree indeterminate (C03)", () => {
    const table = header(
      "#include <stdint.h>\nuint32_t choose(uint32_t x);\nfloat choose(float x);",
      true,
    );
    const t = typeOf(inMain("u32 y <- 1;\nu32 r <- choose(y);"), "r", table);
    expect(t?.form).toEqual({ kind: "foreign", indeterminate: true });
    expect(t?.category).toBe("none");
  });

  it("types a namespaced C++ function by its :: key (C05)", () => {
    const table = header("namespace ns {\n    float scale();\n}", true);
    expect(typeOf(inMain("f32 r <- ns.scale();"), "r", table)?.category).toBe(
      "floating",
    );
  });
});

describe("OperandTyper.typeOf: callbacks (ADR-029)", () => {
  it("types a callback field's call by its defining function", () => {
    const t = typeOf(`u16 handler(u8 x) {
    return 1;
}
struct Ops { handler fn; }
void main() {
    Ops ops <- {fn: handler};
    u16 r <- ops.fn(1);
}`);
    expect(t).toMatchObject({ typeName: "u16", form: { kind: "call" } });
  });
});

describe("OperandTyper.chainOf", () => {
  /** The first assignment target in `source`, and the context to type it */
  function targetOf(
    source: string,
    view: (ctx: ITypingContext) => ITypingContext = (ctx) => ctx,
  ) {
    const { tree, context } = testAnalysisContextFor(source, {
      cppMode: false,
    });
    let found: Parser.AssignmentTargetContext | null = null;
    ParseTreeWalker.DEFAULT.walk(
      new (class extends CnxListener {
        override enterAssignmentTarget = (
          ctx: Parser.AssignmentTargetContext,
        ): void => {
          found ??= ctx;
        };
      })(),
      tree,
    );
    expect(found).not.toBeNull();
    return OperandTyper.chainOf(
      SyntaxLowering.assignmentTarget(found!),
      view({ ...context, sourceFile: "test.cnx" }),
    );
  }

  it("types each operation of a target, with its subscript kind", () => {
    const chain = targetOf(`struct P { u8[4] data; u32 word; }
void main() {
    mut P p;
    p.data[2] <- 1;
}`);
    expect(chain.root?.kind).toBe("local");
    expect(
      chain.steps.map((step) => [
        step.before?.typeName ?? null,
        step.subscript,
        step.after?.typeName ?? null,
        step.after?.dimensions,
      ]),
    ).toEqual([
      ["P", null, "u8", [4]],
      ["u8", "array_element", "u8", []],
    ]);
  });

  it("classifies a subscript on a scalar field as a bit", () => {
    const chain = targetOf(`struct P { u32 word; }
void main() {
    mut P p;
    p.word[3] <- true;
}`);
    expect(chain.steps.at(-1)?.subscript).toBe("bit_single");
  });

  // #2158/#2185: the register member a step's prefix is, however the
  // register is spelled -- the one answer the classifier and handlers read
  describe("the register member a step reads from", () => {
    const declarations = `register MOTOR @ 0x40000000 {
    CTRL: u8 rw @ 0x00,
}
scope Drive {
    register PWM @ 0x40001000 {
        FLAGS: u8 w1c @ 0x04,
    }
    public void bare() { %BODY% }
}
`;
    const lastOf = (body: string) =>
      targetOf(declarations.replace("%BODY%", body)).steps.at(-1);

    it.each([
      [
        "a scope's own bare register",
        "PWM.FLAGS[0] <- true;",
        "Drive__PWM__FLAGS",
        "Drive__PWM",
      ],
      [
        "this.",
        "this.PWM.FLAGS[0] <- true;",
        "Drive__PWM__FLAGS",
        "Drive__PWM",
      ],
      [
        "the scope's name",
        "Drive.PWM.FLAGS[0] <- true;",
        "Drive__PWM__FLAGS",
        "Drive__PWM",
      ],
      ["a global register", "MOTOR.CTRL[1] <- true;", "MOTOR__CTRL", "MOTOR"],
      ["global.", "global.MOTOR.CTRL[1] <- true;", "MOTOR__CTRL", "MOTOR"],
    ])("names the member through %s", (_, body, member, register) => {
      const step = lastOf(body);
      expect(step?.beforeRegisterMember).toBe(member);
      expect(step?.beforeRegister).toBe(register);
      expect(step?.subscript).toBe("bit_single");
    });

    // #2275: `this.` through a scope spanned from an un-included file still
    // reaches a register this file's view does not type (`global.` cannot:
    // E0427); the member is still named. Retire with that fix
    it("names a member this file's view does not type", () => {
      const step = targetOf(
        declarations.replace("%BODY%", "global.MOTOR.CTRL[1] <- true;"),
        (ctx) => ({
          ...ctx,
          symbols: { ...ctx.symbols, registerMemberCTypes: new Map() },
        }),
      ).steps.at(-1);
      expect(step?.beforeRegisterMember).toBe("MOTOR__CTRL");
      expect(step?.beforeRegister).toBe("MOTOR");
      expect(step?.before?.typeName).toBeNull();
    });

    it("names the member a bitmap field of a register member is in", () => {
      const step = targetOf(`bitmap8 Ctl { A, B, Mode[3], C, D, E }
scope Drive {
    register PWM @ 0x40001000 {
        CTRL: Ctl rw @ 0x00,
    }
    public void bare() { PWM.CTRL.Mode <- 2; }
}
`).steps.at(-1);
      expect(step?.member).toBe("Mode");
      expect(step?.beforeRegisterMember).toBe("Drive__PWM__CTRL");
      expect(step?.beforeRegister).toBe("Drive__PWM");
      expect(step?.before?.bitmapTypeName).toBe("Ctl");
    });

    it("names no member for a struct's field", () => {
      const step = targetOf(`struct P { u8 word; }
void main() {
    mut P p;
    p.word[3] <- true;
}`).steps.at(-1);
      expect(step?.beforeRegisterMember).toBeNull();
    });

    it("records the name a member step reads", () => {
      const steps = targetOf(`struct P { u8 word; }
void main() {
    mut P p;
    p.word <- 1;
}`).steps;
      expect(steps.map((step) => step.member)).toEqual(["word"]);
    });
  });

  describe("a subscript's kind on a C or C++ header's value (S25)", () => {
    /** The subscript kind of `r`'s initializer, a postfix chain */
    function subscriptOf(
      body: string,
      table: SymbolTable,
    ): TSubscriptKind | null {
      const { node, ctx } = initializerOf(inMain(body), "r", table);
      const postfix = ExpressionUnwrapper.getPostfixExpression(node);
      expect(postfix).not.toBeNull();
      return (
        OperandTyper.chainOf(
          SyntaxLowering.expressionNode(postfix!),
          ctx,
        ).steps.at(-1)?.subscript ?? null
      );
    }

    const c = header(`#include <stdint.h>
extern uint32_t word;
extern uint8_t buf[];
extern uint8_t *ptr;
extern float cf;
typedef struct { uint8_t v; } pod_t;
extern pod_t pod;`);

    it.each([
      [
        "a scalar integer is bits (ADR-024)",
        "bool r <- word[4];",
        "bit_single",
      ],
      ["an unsized array is elements", "u8 r <- buf[3];", "array_element"],
      ["a pointer is elements", "u8 r <- ptr[1];", "array_element"],
      // #1760 review: a header float is a float (ADR-024), and a float's
      // subscript is a bit (ADR-007). This row said "left to C", and C got
      // `cf[1]`, a subscript of a float, which it rejects
      ["a float is bits (ADR-007)", "bool r <- cf[1];", "bit_single"],
      ["a struct is left to C", "u8 r <- pod[1];", "array_element"],
    ])("%s", (_why, body, expected) => {
      expect(subscriptOf(body, c)).toBe(expected);
    });

    it("leaves a C++ type's own operator[] to C++", () => {
      const cpp = header(
        `#include <stdint.h>
struct Frame { uint8_t data[4]; uint8_t operator[](int i) const; };
extern Frame frame;`,
        true,
      );
      expect(subscriptOf("u8 r <- frame[2];", cpp)).toBe("array_element");
    });

    // #1760 review: the rows above assert the subscript's KIND only, which is
    // how an element with no dimensions came to be typed `char` unnoticed.
    it("types no dimensionless header element as a character", () => {
      /** The typer's answer for `r`'s initializer, after its last subscript */
      function elementOf(body: string, table: SymbolTable) {
        const { node, ctx } = initializerOf(inMain(body), "r", table);
        const postfix = ExpressionUnwrapper.getPostfixExpression(node);
        expect(postfix).not.toBeNull();
        return (
          OperandTyper.chainOf(
            SyntaxLowering.expressionNode(postfix!),
            ctx,
          ).steps.at(-1)?.after ?? null
        );
      }
      expect(elementOf("u8 r <- pod[1];", c)).toBeNull();
      const cpp = header(
        `#include <stdint.h>
struct Frame { uint8_t data[4]; uint8_t operator[](int i) const; };
extern Frame frame;`,
        true,
      );
      expect(elementOf("u8 r <- frame[2];", cpp)).toBeNull();
      // Control: a string's element is a character
      expect(
        elementOf('string<4> s <- "ab";\nchar r <- s[0];', new SymbolTable()),
      ).toMatchObject({ category: "character" });
    });

    it("keeps a cnx scalar's subscript a bit", () => {
      // The control: the header rule does not reach cnx's own values
      expect(
        subscriptOf("u32 w <- 16;\nbool r <- w[4];", new SymbolTable()),
      ).toBe("bit_single");
    });
  });

  it("consumes a this. root's first member", () => {
    const chain = targetOf(`scope S {
    mut u16[3] vals;
    public void f() {
        this.vals[0] <- 1;
    }
}`);
    expect(chain.root).toMatchObject({ kind: "variable" });
    expect(chain.steps.map((step) => step.subscript)).toEqual([
      "array_element",
    ]);
  });
});

// #1760 review: whether `.name` reads a property or a field named like one is
// the typer's, recorded on the step for 2.1 and render (ADR-058)
describe("OperandTyper.chainOf: a field named like a property", () => {
  function lastStep(body: string, table: SymbolTable, decls = "") {
    const { node, ctx } = initializerOf(`${decls}${inMain(body)}`, "r", table);
    const postfix = ExpressionUnwrapper.getPostfixExpression(node);
    expect(postfix).not.toBeNull();
    return OperandTyper.chainOf(
      SyntaxLowering.expressionNode(postfix!),
      ctx,
    ).steps.at(-1);
  }

  it("types a cnx struct's field as the field", () => {
    const step = lastStep(
      "u32 r <- b.length;",
      new SymbolTable(),
      "struct Buf {\n    u32 length;\n}\nBuf b;\n",
    );
    expect(step?.property).toBeNull();
    expect(step?.after).toMatchObject({ typeName: "u32" });
  });

  it("types a header struct's field as the field", () => {
    const c = header(`#include <stdint.h>
typedef struct { uint32_t size; } ring_t;
extern ring_t ring;`);
    const step = lastStep("u32 r <- ring.size;", c);
    expect(step?.property).toBeNull();
    expect(step?.after).toMatchObject({ typeName: "u32" });
  });

  it("reads the property of a value that declares no such field", () => {
    const step = lastStep(
      'string<8> name <- "ab";\nu32 r <- name.value_char_count;',
      new SymbolTable(),
    );
    expect(step?.property).toBe("value_char_count");
  });
});
