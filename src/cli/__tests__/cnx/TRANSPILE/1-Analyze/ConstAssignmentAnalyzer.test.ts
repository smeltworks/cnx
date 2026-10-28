import { describe, expect, it } from "vitest";

import ConstAssignmentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ConstAssignmentAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";

/**
 * #1322, ADR-071. Every binding is read-only unless declared `mut`: E0900 (an
 * assignment to or through a read-only binding, any form, or a read-only value
 * passed to a `mut` parameter) and E0899 (a `mut` nothing writes).
 *
 * Mutability comes from the lexical frames; a callee's parameters and a binding
 * from an include come from the program's symbols. The cases here assert only
 * the lexical arms; `tests/adr-013/const-uncovered-arms-error` and the imported
 * fixtures assert the program arms end to end.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ConstAssignmentAnalyzer(context).analyze(syntax);
};

const at = (source: string) =>
  errors(source).map((e) => `${e.code}@${e.span.line}`);

describe("ConstAssignmentAnalyzer (E0900)", () => {
  it("rejects every assignment operator on a read-only variable, at the target", () => {
    const found = errors(
      "u32 K <- 1;\nvoid f() {\n    K <- 2;\n    K +<- 1;\n    K <<<- 1;\n}",
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0900", 3],
      ["E0900", 4],
      ["E0900", 5],
    ]);
    expect(found[0].message).toBe("cannot assign to read-only variable 'K'");
    expect(found[0].span.column).toBeGreaterThan(0);
  });

  it("names a parameter as a parameter", () => {
    const [found] = errors("void f(i32 value) {\n    value <- 1;\n}");
    expect(found.message).toBe("cannot assign to read-only parameter 'value'");
  });

  it("says where the written binding is declared, for its `mut`", () => {
    const found = errors(
      "u32 K <- 1;\nvoid f(i32 value) {\n    value <- 1;\n    K <- 2;\n}",
    );
    expect(
      found.map((e) => [e.declaredAt?.line, e.declaredAt?.column]),
    ).toEqual([
      [2, 7],
      [1, 0],
    ]);
  });

  it("carries the element and member suffixes codegen used", () => {
    const found = errors(
      "struct C { u8 x; }\nvoid f(u8[4] t, C c) {\n    t[0] <- 1;\n    c.x <- 2;\n}",
    );
    expect(found.map((e) => e.message)).toEqual([
      "cannot assign to read-only parameter 't' (array element)",
      "cannot assign to read-only parameter 'c' (member access)",
    ]);
  });

  it("checks a for header's initializer and update (the closed holes)", () => {
    const found = errors(
      "u8 K <- 1;\nvoid f() {\n    for (K <- 0; K < 3; K +<- 1) {\n    }\n}",
    );
    expect(found).toHaveLength(2);
    expect(found.every((e) => e.span.line === 3)).toBe(true);
  });

  it("resolves this. and global. against the right frame", () => {
    const source = [
      "u8 K <- 1;",
      "scope S {",
      "    u8 STEP <- 2;",
      "    mut u8 K <- 0;",
      "    public void go() {",
      "        this.STEP <- 3;",
      "        global.K <- 4;",
      "        K <- 5;",
      "    }",
      "}",
    ].join("\n");
    // `K` bare inside S is the `mut` scope member; `global.K` is read-only.
    expect(errors(source).map((e) => [e.span.line, e.message])).toEqual([
      [6, "cannot assign to read-only variable 'STEP'"],
      [7, "cannot assign to read-only variable 'K'"],
    ]);
  });

  it("reaches the member a scope-qualified write names, not the scope", () => {
    // `S.arr[0]` binds its head to the scope `S`; the write is to `S__arr`.
    // Missed, the member stayed read-only and rendered C `const`, which the
    // generated assignment then failed to compile against.
    const found = errors(
      "scope S {\n    public u8[4] arr;\n    public u8 x;\n}\nvoid f() {\n    S.arr[0] <- 1;\n    global.S.x <- 2;\n}",
    );
    expect(found.map((e) => [e.code, e.span.line, e.message])).toEqual([
      ["E0900", 6, "cannot assign to read-only variable 'arr' (array element)"],
      ["E0900", 7, "cannot assign to read-only variable 'x'"],
    ]);
    expect(
      errors(
        "scope S {\n    public mut u8[4] arr;\n}\nvoid f() {\n    S.arr[0] <- 1;\n}",
      ),
    ).toEqual([]);
  });

  it("accepts a `mut` binding in every form, and a shadowing local", () => {
    const source = [
      "u8 K <- 1;",
      "struct C { u8 x; }",
      "void f(mut u8 p, mut u8[4] arr, mut C c) {",
      "    mut u8 K <- 2;",
      "    K <- 3;",
      "    p <- 1;",
      "    arr[0] <- 1;",
      "    c.x <- 1;",
      "    for (p <- 0; p < 3; p +<- 1) {",
      "    }",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("reaches the function a callback call goes through", () => {
    // `h.onPoke(p)` names no function; its field's type `poke` does, and
    // poke's `mut` parameter writes `p`. Missed, `p` rendered `const` and
    // the call did not compile.
    const source = (decl: string) =>
      "struct P { u8 x; }\n" +
      "void poke(mut P p) { p.x <- 1; }\n" +
      "struct H { poke onPoke; }\n" +
      "void f() {\n" +
      "    mut H h;\n" +
      "    h.onPoke <- poke;\n" +
      `    ${decl} q <- { x: 0 };\n` +
      "    h.onPoke(q);\n" +
      "}";
    expect(
      errors(source("P")).map((e) => [e.code, e.span.line, e.message]),
    ).toEqual([
      [
        "E0900",
        8,
        "cannot pass read-only 'q' to `mut` parameter 'p' of function 'h.onPoke'",
      ],
    ]);
    expect(errors(source("mut P"))).toEqual([]);
  });
});

describe("ConstAssignmentAnalyzer on 1.2's syntax (#1991)", () => {
  const source = [
    "struct C { u8 x; }",
    "void take(mut u8 v) {",
    "    v <- 0;",
    "}",
    "scope S {",
    "    C CFG <- { x: 1 };",
    "    u8 K <- 1;",
    "    public void go() {",
    "        take(this.K);",
    "        take(this.CFG.x);",
    "        this.K <- 2;",
    "    }",
    "}",
  ].join("\n");

  it("names a read-only argument, and one reached through a read-only member", () => {
    expect(
      errors(source)
        .filter((e) => e.message.startsWith("cannot pass"))
        .map((e) => [e.span.line, e.message]),
    ).toEqual([
      [
        9,
        "cannot pass read-only 'this.K' to `mut` parameter 'v' of function 'take'",
      ],
      [
        10,
        "cannot pass read-only 'this.CFG.x' to `mut` parameter 'v' of function 'take'",
      ],
    ]);
  });

  it("reports calls and assignments in source order", () => {
    expect(at(source)).toEqual(["E0900@9", "E0900@10", "E0900@11"]);
  });

  it("passes a read-only binding to a read-only parameter", () => {
    expect(
      errors(
        "u32 LIMIT <- 5;\nvoid readOnly(u32 value) {\n    u32 local <- value;\n}\nvoid f() {\n    readOnly(LIMIT);\n}",
      ),
    ).toEqual([]);
  });
});

describe("ConstAssignmentAnalyzer (E0899, ADR-071 Decision 6)", () => {
  it("rejects a `mut` local, parameter or private member nothing writes", () => {
    const source = [
      "void show(mut u32 v) {",
      "    mut u32 a <- v;",
      "}",
      "scope S {",
      "    mut u8 hidden <- 0;",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found.map((e) => `${e.code}@${e.span.line}`).sort()).toEqual([
      "E0899@1",
      "E0899@2",
      "E0899@5",
    ]);
    expect(found.map((e) => e.message)).toContain(
      "'v' is never written; remove `mut`",
    );
  });

  it("counts a call to a `mut` parameter and a safe_div output as writes", () => {
    const source = [
      "void bump(mut u32 v) {",
      "    v <- v + 1;",
      "}",
      "void f() {",
      "    mut u32 n <- 0;",
      "    bump(n);",
      "    mut u32 q <- 0;",
      "    mut bool err <- safe_div(q, 10, 2, 0);",
      "    err <- false;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("counts an argument to a function it cannot see as written", () => {
    const source = [
      "void f() {",
      "    mut u8[4] buf;",
      "    fgets(buf, 4, stdin);",
      "}",
    ].join("\n");
    expect(at(source)).not.toContain("E0899@2");
  });

  it("exempts a global and a public scope member, which C can write", () => {
    expect(
      errors("mut u32 G <- 0;\nscope S {\n    public mut u8 shown <- 0;\n}"),
    ).toEqual([]);
  });

  it("exempts the parameters of a function used as a callback type", () => {
    const source = [
      "void onTick(mut u32 v) {",
      "}",
      "struct Timer {",
      "    onTick handler;",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });
});

describe("ConstAssignmentAnalyzer, a C callee's pointer (#2103)", () => {
  const withC = (source: string): string[] => {
    const symbolTable = new SymbolTable();
    for (const [name, type, isConst, isArray] of [
      ["c_bump", "uint8_t *", false, false],
      ["c_read", "const uint8_t *", false, false],
      ["c_fill", "uint8_t", false, true],
      ["c_scan", "uint8_t", true, true],
    ] as const) {
      symbolTable.addCSymbol({
        name,
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "c.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
        parameters: [{ name: "p", type, isConst, isArray }],
      });
    }
    const { syntax, context } = testAnalysisContextFor(source, {
      symbolTable,
      cppMode: false,
    });
    return new ConstAssignmentAnalyzer(context)
      .analyze(syntax)
      .map((e) => `${e.code}@${e.span.line} ${e.message}`);
  };

  it("counts a non-const C pointer argument as a write, bare or `global.`", () => {
    expect(
      withC(
        "void f(mut u8 a, mut u8 b, mut u8 c) {\n    c_bump(a);\n    global.c_bump(b);\n    c_read(c);\n}",
      ),
    ).toEqual(["E0899@1 'c' is never written; remove `mut`"]);
  });

  it("counts a non-const C array parameter as a write (#986)", () => {
    expect(
      withC(
        "void f(mut u8[8] a, mut u8[8] b) {\n    c_fill(a);\n    c_scan(b);\n}",
      ),
    ).toEqual(["E0899@1 'b' is never written; remove `mut`"]);
  });
});

describe("ConstAssignmentAnalyzer, a C++ method's object (#2102 review)", () => {
  const withCounter = (source: string): string[] => {
    const symbolTable = new SymbolTable();
    for (const [name, unqualifiedName, isConstMember] of [
      ["Counter::bump", "bump", false],
      ["Counter::get", "get", true],
    ] as const) {
      symbolTable.addCppSymbol({
        name,
        unqualifiedName,
        kind: "function",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "counter.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "uint8_t",
        parent: "Counter",
        isConstMember,
      });
    }
    const { syntax, context } = testAnalysisContextFor(source, {
      symbolTable,
      cppMode: true,
    });
    return new ConstAssignmentAnalyzer(context)
      .analyze(syntax)
      .map((e) => `${e.code}@${e.span.line} ${e.message}`);
  };

  it("counts a method that is not `const` as a write of its object", () => {
    const source = [
      "void f() {",
      "    Counter c;",
      "    c.bump();",
      "    Counter r;",
      "    u8 v <- r.get();",
      "    mut Counter m;",
      "    m.bump();",
      "}",
    ].join("\n");
    expect(withCounter(source)).toEqual([
      "E0900@3 cannot call non-`const` method 'bump' on read-only variable 'c'",
    ]);
  });
});

describe("ConstAssignmentAnalyzer (E0915, ADR-006 #1203)", () => {
  const header = (): SymbolTable => {
    const symbolTable = new SymbolTable();
    const base = {
      sourceLanguage: ESourceLanguage.C,
      sourceFile: "h.h",
      span: TestSourceSpan.at(1),
      visibility: "public",
    } as const;
    symbolTable.addCSymbol({
      ...base,
      name: "COLOR_GREEN",
      kind: "enum_member",
      parent: "Color",
    });
    symbolTable.addCSymbol({
      ...base,
      name: "headerCounter",
      kind: "variable",
      type: "uint32_t",
    });
    symbolTable.addCSymbol({
      ...base,
      name: "c_tick",
      kind: "function",
      type: "void",
      parameters: [],
    });
    return symbolTable;
  };
  const passed = (args: readonly string[]): string[] => {
    const source = [
      "struct In { u32 v; }",
      "struct Out { In inner; }",
      "enum EMode { IDLE, RUN }",
      "void modifies(mut u32 value) {",
      "    value +<- 1;",
      "}",
      "u32 readIt() {",
      "    return 1;",
      "}",
      "void f() {",
      "    mut u32 a <- 0;",
      "    mut Out o <- { inner: { v: 0 } };",
      "    mut u32[2] arr <- [0, 0];",
      ...args.map((arg) => `    modifies(${arg});`),
      "}",
    ].join("\n");
    const { syntax, context } = testAnalysisContextFor(source, {
      symbolTable: header(),
      cppMode: false,
      macros: {
        LIMIT: {
          kind: "integer",
          valueByIntBits: new Map([
            [16, 5],
            [32, 5],
          ]),
        },
      },
    });
    return new ConstAssignmentAnalyzer(context)
      .analyze(syntax)
      .filter((e) => e.code === "E0915")
      .map((e) => e.message.split("'")[1]);
  };

  it("rejects every argument that is not an object", () => {
    const values = [
      "5",
      "readIt()",
      "a + 1",
      "(u32)a",
      "EMode.RUN",
      "a[0]",
      "a[0, 2]",
      "readIt",
      "LIMIT",
      "COLOR_GREEN",
      "c_tick",
    ];
    expect(passed(values)).toEqual(values);
  });

  it("accepts a variable, a field, an element and a header's variable, through brackets", () => {
    expect(
      passed([
        "a",
        "((a))",
        "o.inner.v",
        "(o.inner).v",
        "((o).inner).v",
        "(o.inner.v)",
        "arr[1]",
        "(arr[1])",
        "headerCounter",
      ]),
    ).toEqual([]);
  });

  it("rejects a call's result reached through brackets", () => {
    expect(passed(["(readIt())"])).toEqual(["(readIt())"]);
  });
});
