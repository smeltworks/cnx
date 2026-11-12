import { describe, expect, it } from "vitest";
import CnxSourceParser from "../CnxSourceParser";
import * as Parser from "../grammar/CnxParser";
import StatementLowering from "../StatementLowering";
import SyntaxLowering from "../SyntaxLowering";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import type TExpression from "../../../types/syntax/TExpression";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";

/** The expression `source` lowers to, written as a variable's initializer */
function expressionOf(source: string): TExpression {
  const tree = CnxSourceParser.parse(`u32 q <- ${source};\n`).tree;
  const expression = tree.declaration()[0].variableDeclaration()?.expression();
  if (!expression) throw new Error(`no expression in: ${source}`);
  return SyntaxLowering.expression(expression);
}

/** The type `source` lowers to, written as a variable's type */
function typeOf(source: string): TTypeSyntax {
  const tree = CnxSourceParser.parse(`${source} q;\n`).tree;
  const type = tree.declaration()[0].variableDeclaration()?.type();
  if (!type) throw new Error(`no type in: ${source}`);
  return SyntaxLowering.type(type);
}

/** A compact rendering of a lowered expression's shape, for assertions */
function shape(e: TExpression): string {
  switch (e.kind) {
    case "ternary":
      return `(${shape(e.condition)} ? ${shape(e.whenTrue)} : ${shape(e.whenFalse)})`;
    case "binary":
      return `${e.level}(${e.operands
        .map((operand, i) =>
          i === 0 ? shape(operand) : `${e.operators[i - 1]} ${shape(operand)}`,
        )
        .join(" ")})`;
    case "unary":
      return `${e.operator}${shape(e.operand)}`;
    case "postfix":
      return `${shape(e.primary)}${e.ops
        .map((op) => {
          if (op.kind === "member") return `.${op.name}`;
          if (op.kind === "subscript") {
            return `[${op.indexes.map(shape).join(", ")}]`;
          }
          if (op.kind === "missing") return "<missing op>";
          return `(${op.arguments.map(shape).join(", ")})`;
        })
        .join("")}`;
    case "identifier":
      return e.name;
    case "root":
      return e.root;
    case "literal":
      return `${e.literalKind}:${e.text}`;
    case "parenthesized":
      return `paren(${shape(e.expression)})`;
    case "cast":
      return `cast<${e.type.kind}:${e.type.text}>(${shape(e.operand)})`;
    case "sizeof":
      return "sizeof";
    case "structInitializer":
      return `{${e.fields.map((f) => `${f.name}: ${shape(f.value)}`).join(", ")}}`;
    case "missing":
      return "<missing>";
    case "arrayInitializer":
      return e.fill
        ? `[${shape(e.fill)}*]`
        : `[${e.elements.map(shape).join(", ")}]`;
  }
}

describe("SyntaxLowering", () => {
  it.each<[string, string]>([
    ["x", "x"],
    ["a + b - c", "additive(a + b - c)"],
    ["a + b * c", "additive(a + multiplicative(b * c))"],
    ["a << 2 | b & c", "bitwiseOr(shift(a << integer:2) | bitwiseAnd(b & c))"],
    [
      "A = B && C != D || !E",
      "or(and(equality(A = B) && equality(C != D)) || !E)",
    ],
    ["a < b", "relational(a < b)"],
    ["a ^ b", "bitwiseXor(a ^ b)"],
    ["10 / 3 % 2", "multiplicative(integer:10 / integer:3 % integer:2)"],
    ["(a < b) ? 1 : 2", "(relational(a < b) ? integer:1 : integer:2)"],
    ["-x", "-x"],
    ["~0", "~integer:0"],
    ["!!x", "!!x"],
    ["1 - -1", "additive(integer:1 - -integer:1)"],
    ["this.n", "this.n"],
    ["global.s.n", "global.s.n"],
    ["arr[i][0, 4]", "arr[i][integer:0, integer:4]"],
    ["f()", "f()"],
    ["s.f(a, 1)", "s.f(a, integer:1)"],
    ["(x)", "paren(x)"],
    ["(u8)x", "cast<primitive:u8>(x)"],
    ["(Scope.T)x", "cast<qualified:Scope.T>(x)"],
    ["sizeof(u32)", "sizeof"],
    ["sizeof(a - -1)", "sizeof"],
    ["{ a: 1, b: x }", "{a: integer:1, b: x}"],
    ["[1, 2, 3]", "[integer:1, integer:2, integer:3]"],
    ["[0*]", "[integer:0*]"],
    ["[{ a: 1 }, [2]]", "[{a: integer:1}, [integer:2]]"],
    ["9u8", "suffixedDecimal:9u8"],
    ["0xFFu16", "suffixedHex:0xFFu16"],
    ["0b11i8", "suffixedBinary:0b11i8"],
    ["1.5f32", "suffixedFloat:1.5f32"],
    ["0x10", "hex:0x10"],
    ["0b101", "binary:0b101"],
    ["1.5", "float:1.5"],
    ['"s"', 'string:"s"'],
    ["'c'", "char:'c'"],
    ["true", "true:true"],
    ["false", "false:false"],
    ["NULL", "null:NULL"],
  ])("%s lowers to %s", (source, expected) => {
    expect(shape(expressionOf(source))).toBe(expected);
  });

  it("keeps the source as written, spaces and all, which getText() loses", () => {
    expect(expressionOf("a - -1").written).toBe("a - -1");
  });

  it("records each node's span", () => {
    const lowered = expressionOf("1 + limit");
    expect(lowered.kind === "binary" && lowered.operands[1].span).toEqual({
      line: 1,
      column: 13,
      endLine: 1,
      endColumn: 18,
    });
  });

  it.each<[string, string]>([
    ["u8", "primitive"],
    ["string<8>", "string"],
    ["this.T", "scoped"],
    ["global.T", "global"],
    ["Scope.T", "qualified"],
    ["Vec<u8, 4>", "template"],
    ["T", "user"],
    ["u8[4]", "array"],
  ])("lowers the type %s as %s", (source, kind) => {
    const type = typeOf(source);
    expect(type.kind).toBe(kind);
    expect(type.text).toBe(source.replaceAll(" ", ""));
  });

  it("lowers an array type's element and dimensions", () => {
    const type = typeOf("string<8>[4][]");
    expect(type.kind === "array" && type.element).toMatchObject({
      kind: "string",
      capacity: "8",
      text: "string<8>",
    });
    expect(
      type.kind === "array" && type.dimensions.map((d) => d && shape(d)),
    ).toEqual(["integer:4", null]);
  });

  it("is plain data: it survives a JSON round trip unchanged", () => {
    const lowered = expressionOf(
      "(u32)EColor.COUNT + f(a[1], { x: 1 }) * u8.type_byte_length - ((b) ? 1 : 2)",
    );
    expect(JSON.parse(JSON.stringify(lowered))).toEqual(lowered);
  });

  // The editor's symbol collection (`parseWithSymbols`) lowers a tree with
  // parse errors, so every gap the parser recovers from lowers as `missing`
  it.each<[string, string]>([
    ["(b ? 1 : 2)", "<missing>"],
    ["-", "-<missing>"],
    ["a <", "relational(a < <missing>)"],
    ["(u8)", "cast<primitive:u8>(<missing>)"],
    ["{ a: }", "{a: <missing>}"],
    ["a[", "a<missing op><missing op>"],
    ["[1, [", "[integer:1, <missing>]<missing op><missing op>"],
    ["- <- ( ] - global", "-<missing>(-global)"],
    ["( u8", "<missing>"],
    // a field recovered without a name initializes nothing
    ["{ a: 1, : 2 }", "{a: integer:1}"],
    ["- {", "-{}"],
    ["{ a: 1, b }", "{a: integer:1, b: <missing>}"],
    ["a.", "a<missing op>"],
  ])(
    "lowers %s, which the parser recovered from, as %s",
    (source, expected) => {
      const { tree, parseErrors } = CnxSourceParser.parse(
        `u32 q <- ${source};\n`,
      );
      expect(parseErrors.length).toBeGreaterThan(0);
      const expression = tree
        .declaration()[0]
        .variableDeclaration()
        ?.expression();
      expect(shape(SyntaxLowering.expression(expression!))).toBe(expected);
    },
  );
});

/*
 * Random token runs, at a fixed seed, in every position a type or an
 * expression is written. Lowering a recovered tree never throws: a getter the
 * generated parser types as required can be null after recovery.
 */
describe("SyntaxLowering on recovered trees", () => {
  const TOKENS = [
    "a",
    "1",
    "0x1",
    "true",
    '"s"',
    "u8",
    "string<4>",
    "sizeof",
    "this",
    "global",
    "+",
    "-",
    "*",
    "<",
    "<-",
    "||",
    "!",
    "~",
    "&",
    "<<",
    "?",
    ":",
    ",",
    ".",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "x:",
    ";",
  ];
  const POSITIONS = [
    (run: string) => `u32 q <- ${run};`,
    (run: string) => `u32 q <- sizeof(${run});`,
    (run: string) => `u32 q <- (${run}) a;`,
    (run: string) => `${run} q;`,
    (run: string) => `u8[${run}] q;`,
    (run: string) => `Vec<${run}> q;`,
    (run: string) => `u8[4] q <- [${run}];`,
    (run: string) => `T q <- { x: ${run} };`,
    (run: string) => `T q <- { x: 1, ${run} };`,
    (run: string) => `u32 q <- (u8) ${run};`,
    (run: string) => `u32 q <- a.${run};`,
    (run: string) => `u32 q <- a(${run};`,
    // #1949 review: a `for` header's clauses are where recovery still builds
    // an assignment target around a missing piece
    (run: string) => `void f() { for (a <- 0; a < 1; ${run} +<- 1) {} }`,
    (run: string) => `void f() { for (${run} <- 0; a < 1; a +<- 1) {} }`,
    (run: string) => `void f() { ${run} <- 1; }`,
    // #1950 review: statements whose required parts recovery drops
    (run: string) => `void f() { if (${run}) { } }`,
    (run: string) => `void f() { while (${run} }`,
    (run: string) => `void f() { for (u8 i <- 0; ${run}) { } }`,
    (run: string) => `void f() { ${run} }`,
  ];

  /** A seeded pseudo-random generator, so every run sees the same cases */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function lowerEverything(
    node: unknown,
    lowered: { count: number; targets: number; statements: number },
  ): void {
    if (node instanceof Parser.StatementContext) {
      StatementLowering.statement(node);
      lowered.count++;
      lowered.statements++;
    } else if (node instanceof Parser.ExpressionContext) {
      ConstExprLowering.lower(SyntaxLowering.expression(node));
      lowered.count++;
    } else if (node instanceof Parser.TypeContext) {
      SyntaxLowering.type(node);
      lowered.count++;
    } else if (node instanceof Parser.AssignmentTargetContext) {
      SyntaxLowering.assignmentTarget(node);
      lowered.count++;
      lowered.targets++;
    }
    for (const child of (node as { children?: unknown[] }).children ?? []) {
      lowerEverything(child, lowered);
    }
  }

  it("never throws, and reaches every position", () => {
    const next = random(1932);
    const lowered = { count: 0, targets: 0, statements: 0 };
    let recovered = 0;
    for (let i = 0; i < 2000; i++) {
      const length = 1 + Math.floor(next() * 6);
      const run = Array.from(
        { length },
        () => TOKENS[Math.floor(next() * TOKENS.length)],
      ).join(" ");
      const position = POSITIONS[i % POSITIONS.length];
      const { tree, parseErrors } = CnxSourceParser.parse(`${position(run)}\n`);
      if (parseErrors.length === 0) continue;
      recovered++;
      lowerEverything(tree, lowered);
    }
    expect(recovered).toBeGreaterThan(1500);
    expect(lowered.count).toBeGreaterThan(recovered);
    expect(lowered.targets).toBeGreaterThan(100);
    expect(lowered.statements).toBeGreaterThan(100);
  });

  // #1950 review: each threw before statements had a `missing` kind
  it.each([
    "for (i <- 0; i < 3; i) { }",
    "if () { }",
    "u8 <- 3;",
    "for (u8 i <- 0; ; i +<- ) { }",
    "while (x < 3",
    "x 5;",
  ])("lowers the repaired statement in `%s` to a missing part", (body) => {
    const { tree, parseErrors } = CnxSourceParser.parse(
      `void f() { ${body} }\n`,
    );
    expect(parseErrors.length).toBeGreaterThan(0);
    const block = tree.declaration()[0].functionDeclaration()!.block();
    expect(JSON.stringify(StatementLowering.block(block))).toContain(
      '"kind":"missing"',
    );
  });

  /** Every assignment target in a recovered source, lowered */
  function loweredTargets(source: string): TExpression[] {
    const { tree, parseErrors } = CnxSourceParser.parse(`${source}\n`);
    expect(parseErrors.length).toBeGreaterThan(0);
    const targets: TExpression[] = [];
    const visit = (node: unknown): void => {
      if (node instanceof Parser.AssignmentTargetContext) {
        targets.push(SyntaxLowering.assignmentTarget(node));
      }
      for (const child of (node as { children?: unknown[] }).children ?? []) {
        visit(child);
      }
    };
    visit(tree);
    return targets;
  }

  /** The ops of a target whose head is `head`, after lowering */
  function opKinds(target: TExpression, head: string): string[] | null {
    if (target.kind !== "postfix") return null;
    const primary = target.primary;
    const named =
      primary.kind === "root"
        ? primary.root
        : primary.kind === "identifier"
          ? primary.name
          : null;
    return named === head ? target.ops.map((op) => op.kind) : null;
  }

  // Each source below was found by the seeded run above; each reaches one
  // recovery branch of `assignmentTarget` / `postfixTargetOp`.
  it.each([
    [
      "a name the parser invented after `this.`",
      "void f() { for (a <- 0; a < 1; this ! . +<- 1) {} }",
      "this",
      ["missing"],
    ],
    [
      "`this` with no `.name` at all",
      "void f() { for (a <- 0; a < 1; this global <- b ; + +<- 1) {} }",
      "this",
      ["missing"],
    ],
    [
      "a member name the parser invented",
      "void f() { for (a <- 0; a < 1; a . +<- 1) {} }",
      "a",
      ["missing"],
    ],
    [
      "a subscript with no index",
      "void f() { for (a <- 0; a < 1; a [ +<- 1) {} }",
      "a",
      ["missing", "missing"],
    ],
  ])("lowers %s to a missing op", (_label, source, head, kinds) => {
    const shapes = loweredTargets(source)
      .map((target) => opKinds(target, head))
      .filter((shape) => shape !== null);

    expect(shapes).toContainEqual(kinds);
  });
});

describe("SyntaxLowering member spans", () => {
  function find<T>(
    node: unknown,
    kind: abstract new (...a: never[]) => T,
  ): T[] {
    const found: T[] = [];
    if (node instanceof kind) found.push(node);
    for (const child of (node as { children?: unknown[] }).children ?? []) {
      found.push(...find(child, kind));
    }
    return found;
  }

  it("a rooted target's first member op covers the `.`, as an expression's does", () => {
    const tree = CnxSourceParser.parse(
      "scope S { mut u8 x; void f() { this.x <- 1; u8 y <- this.x; } }\n",
    ).tree;
    const target = SyntaxLowering.assignmentTarget(
      find(tree, Parser.AssignmentTargetContext)[0],
    );
    const expression = SyntaxLowering.expression(
      find(tree, Parser.ExpressionContext).find(
        (e) => e.getText() === "this.x",
      )!,
    );
    if (target.kind !== "postfix" || expression.kind !== "postfix") {
      throw new Error("both lower to a postfix chain");
    }
    const targetOp = target.ops[0];
    const expressionOp = expression.ops[0];
    if (targetOp.kind !== "member" || expressionOp.kind !== "member") {
      throw new Error("both start with a member op");
    }

    expect(targetOp.span.column).toBe(targetOp.nameSpan.column - 1);
    expect(expressionOp.span.column).toBe(expressionOp.nameSpan.column - 1);
  });
});
