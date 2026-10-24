/**
 * #1668 / #1664: lexical frames, built by 1.3 and settled by 1.4, and the
 * binding decision every later pass reads from Program.
 */
import ProgramLowering from "../../2-Parse/ProgramLowering";
import { describe, it, expect } from "vitest";
import CnxSourceParser from "../../2-Parse/CnxSourceParser";
import CnxResolver from "../../3-Declare/cnx/index";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import Program from "../Program";
import type ILexicalFrame from "../../../types/ILexicalFrame";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";
import LexicalFrames from "../LexicalFrames";
import type IProgram from "../../../types/IProgram";
import type IFoldedConstant from "../../../types/IFoldedConstant";
import UNRESOLVED_DIMENSION from "../../../types/UNRESOLVED_DIMENSION";

/**
 * #1175: a bare name's compile-time value where it is used -- what
 * `constantAt` answered, asked of `constantValueOf` with the name written there
 */
function constantAt(
  program: IProgram,
  sourceFile: string,
  name: string,
  at: { line: number; column: number },
): IFoldedConstant | null {
  const result = program.constantValueOf(sourceFile, {
    kind: "name",
    root: null,
    path: [name],
    at: { ...at, endLine: at.line, endColumn: at.column },
  });
  return result.kind === "value"
    ? { value: Number(result.value), typeName: result.typeName }
    : null;
}

/** Build a program from path -> source, in dependency order */
function build(files: Record<string, string>) {
  const registry = new SymbolRegistry();
  const declared = Object.entries(files).map(([path, source]) =>
    CnxResolver.resolve(
      ProgramLowering.program(CnxSourceParser.parse(source).tree, null),
      path,
      registry,
    ),
  );
  // #1724: a file sees the scope types of its include closure only, so the
  // graph is stated as discovery would resolve it -- a quoted `.cnx` include
  // naming another file of the run
  const cnxIncludesByFile = new Map(
    Object.entries(files).map(([path, source]) => [
      path,
      [...source.matchAll(/^#include "([^"]+\.cnx)"/gm)]
        .map((match) => match[1])
        .filter((included) => included in files)
        .map((included) => ({ path: included })),
    ]),
  );
  return Program.build(declared, {
    cppMode: false,
    registry,
    visibility: { cnxIncludesByFile },
  });
}

/** The (1-based) line and 0-based column of the Nth `needle` in `source` */
function at(source: string, needle: string, nth = 1) {
  let index = -1;
  for (let i = 0; i < nth; i++) {
    index = source.indexOf(needle, index + 1);
  }
  expect(index).toBeGreaterThanOrEqual(0);
  const before = source.slice(0, index);
  return {
    line: before.split("\n").length,
    column: index - before.lastIndexOf("\n") - 1,
  };
}

function kinds(frame: ILexicalFrame): unknown {
  return {
    kind: frame.kind,
    names: frame.declarations.map((d) => `${d.kind}:${d.name}`),
    children: frame.children.map(kinds),
  };
}

describe("LexicalScopeCollector (1.3)", () => {
  it("records every frame and what each declares, and no global", () => {
    const source = `u32 g <- 1;
void f(u8 p) {
    u8 a <- 1;
    for (u8 i <- 0; i < 3; i +<- 1) {
        u8 b <- i;
    }
    {
        u8 c <- 2;
    }
}`;
    const program = build({ "a.cnx": source });
    expect(
      kinds(program.lexicalFrameAt("a.cnx", { line: 1, column: 0 })),
    ).toEqual({
      kind: "file",
      names: [],
      children: [
        {
          kind: "function",
          names: ["parameter:p"],
          children: [
            {
              kind: "block",
              names: ["local:a"],
              children: [
                {
                  kind: "for",
                  names: ["for:i"],
                  children: [
                    { kind: "block", names: ["local:b"], children: [] },
                  ],
                },
                { kind: "block", names: ["local:c"], children: [] },
              ],
            },
          ],
        },
      ],
    });
  });

  it("names a scope's function frame by its C name, with the scope's path", () => {
    const source = `scope Motor {
    void run(u8 speed) {
        u8 x <- speed;
    }
}`;
    const program = build({ "a.cnx": source });
    const frame = program.lexicalFrameAt("a.cnx", at(source, "speed;"));
    expect(frame.scopePath).toBe("Motor");
    const fn = program.lexicalFrameAt("a.cnx", at(source, "u8 speed"));
    expect(fn).toMatchObject({ kind: "function", functionCName: "Motor__run" });
  });

  it("records the modifiers a local declares", () => {
    const source = `void f() {
    atomic wrap u8 a <- 1;
    volatile u16 b <- 2;
    u16 c <- 3;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "}");
    expect(program.lexicalDeclarationAt("a.cnx", "a", use)).toMatchObject({
      isAtomic: true,
      overflowBehavior: "wrap",
      isConst: false,
    });
    expect(program.lexicalDeclarationAt("a.cnx", "b", use)).toMatchObject({
      isConst: true,
      isVolatile: true,
      overflowBehavior: "clamp",
      // ADR-064: a volatile is never a compile-time value (#2155 review 9)
      constValue: null,
    });
    expect(program.lexicalDeclarationAt("a.cnx", "c", use)).toMatchObject({
      isConst: true,
      isVolatile: false,
      constValue: { kind: "value", digits: "3", typeName: "u16" },
    });
  });
});

describe("binding (1.4)", () => {
  it("does not bind a use to a declaration later in the same block (#1702)", () => {
    const source = `u32 v <- 300;
void f() {
    u8 w <- v;
    u8 v <- 1;
}`;
    const program = build({ "a.cnx": source });
    const binding = program.bindValue("a.cnx", null, "v", at(source, "v;"));
    expect(binding).toMatchObject({ kind: "variable" });
  });

  // #1760 review: a span's end is exclusive, so the token written right after
  // a frame's last character is outside it. Read as inclusive, `}buf[7]`
  // bound the block's local and got a false E0854.
  it("does not place the token right after a block's closing brace inside it", () => {
    const source = `u8[8] buf <- [0*];
void f() {
    { u8[2] buf <- [0*]; buf[1] <- 1; }buf[7] <- 1;
}`;
    const program = build({ "a.cnx": source });
    const after = program.bindValue("a.cnx", null, "buf", at(source, "buf[7]"));
    expect(after).toMatchObject({ kind: "variable" });
    // Control: the block's own last statement still binds the local
    const inside = program.bindValue(
      "a.cnx",
      null,
      "buf",
      at(source, "buf[1]"),
    );
    expect(inside).toMatchObject({ kind: "local" });
  });

  it("does not place the token right after an unbraced for body inside the loop", () => {
    const source = `u8[8] buf <- [0*];
void f() {
    u32 x <- 0;
    for (u8 buf <- 0; buf < 2; buf +<- 1) x <- 1;buf[7] <- 1;
}`;
    const program = build({ "a.cnx": source });
    const after = program.bindValue("a.cnx", null, "buf", at(source, "buf[7]"));
    expect(after).toMatchObject({ kind: "variable" });
    // Control: the loop's own condition binds the loop variable
    const inside = program.bindValue(
      "a.cnx",
      null,
      "buf",
      at(source, "buf < 2"),
    );
    expect(inside).toMatchObject({ kind: "local" });
  });

  it("keeps sibling blocks disjoint (#1666)", () => {
    const source = `void f() {
    {
        u32 x <- 1;
    }
    {
        u8 x <- 2;
        u8 y <- x;
    }
}`;
    const program = build({ "a.cnx": source });
    const binding = program.bindValue("a.cnx", null, "x", at(source, "x;", 3));
    expect(binding).toMatchObject({
      kind: "local",
      declaration: { type: { kind: "primitive", primitive: "u8" } },
    });
  });

  it("binds a local that shadows a scope member to the local (#1700)", () => {
    const source = `scope S {
    u32 n <- 1;
    public void f() {
        u8 n <- 2;
        u8 m <- n;
    }
}`;
    const program = build({ "a.cnx": source });
    expect(
      program.bindValue("a.cnx", null, "n", at(source, "n;", 3)),
    ).toMatchObject({ kind: "local" });
    expect(
      program.bindValue("a.cnx", "this", "n", at(source, "n;", 3)),
    ).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "S__n" },
    });
  });

  it("never binds global.x to a local that shadows it (#1701)", () => {
    const source = `u32 x <- 1;
void f() {
    u8 x <- 2;
    u32 y <- x;
}`;
    const program = build({ "a.cnx": source });
    expect(
      program.bindValue("a.cnx", "global", "x", at(source, "x;", 3)),
    ).toMatchObject({ kind: "variable", symbol: { name: "x" } });
  });

  describe("a local's emitted name, settled by 1.4 (#1934, ADR-057)", () => {
    const emittedAt = (
      program: IProgram,
      source: string,
      name: string,
      text: string,
      occurrence: number,
    ): string | null => {
      const binding = program.bindValue(
        "a.cnx",
        null,
        name,
        at(source, text, occurrence),
      );
      return binding?.kind === "local" ? binding.declaration.emittedName : null;
    };

    it("moves a local that shadows a file-scope name to <function>__<name>", () => {
      const source = `u32 count <- 1;
void f() {
    u8 count <- 2;
    u8 m <- count;
}`;
      const program = build({ "a.cnx": source });
      expect(emittedAt(program, source, "count", "count;", 1)).toBe("f__count");
    });

    it("qualifies by the scope function's C name", () => {
      const source = `u32 count <- 1;
scope S {
    public void f() {
        u8 count <- 2;
        u8 m <- count;
    }
}`;
      const program = build({ "a.cnx": source });
      expect(emittedAt(program, source, "count", "count;", 1)).toBe(
        "S__f__count",
      );
    });

    it("keeps the name of a local or a parameter that shadows nothing", () => {
      const source = `u32 count <- 1;
void f(u8 count, u8 other) {
    u8 fresh <- other;
    u8 m <- fresh + count;
}`;
      const program = build({ "a.cnx": source });
      expect(emittedAt(program, source, "fresh", "fresh + count", 1)).toBe(
        "fresh",
      );
      expect(emittedAt(program, source, "other", "other;", 1)).toBe("other");
    });

    it("moves a parameter that shadows a file-scope name, as a local (#1290)", () => {
      const source = `u32 count <- 1;
void f(u8 count, u8 other) {
    u8 m <- other + count;
}`;
      const program = build({ "a.cnx": source });
      expect(emittedAt(program, source, "count", "count;", 1)).toBe("f__count");
    });

    it("ends a block's rename with the block (#1953)", () => {
      const source = `u32 count <- 1;
void f() {
    {
        u8 count <- 2;
        u8 m <- count;
    }
    u32 n <- count;
}`;
      const program = build({ "a.cnx": source });
      expect(emittedAt(program, source, "count", "count;", 1)).toBe("f__count");
      expect(
        program.bindValue("a.cnx", null, "count", at(source, "count;", 2)),
      ).toMatchObject({ kind: "variable", symbol: { name: "count" } });
    });
  });

  it("binds this.x in a scope reopened in another file (#1699)", () => {
    const other = `scope S {
    u32 x <- 300;
}`;
    const source = `#include "other.cnx"
scope S {
    public u8 get() {
        return this.x;
    }
}`;
    const program = build({ "other.cnx": other, "a.cnx": source });
    expect(
      program.bindValue("a.cnx", "this", "x", at(source, "x;")),
    ).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "S__x", sourceFile: "other.cnx" },
    });
  });

  it("binds a scope name, and answers null for an unknown name", () => {
    const source = `scope S {
    public u32 x <- 1;
}
void f() {
    u32 y <- S.x;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "S.x");
    expect(program.bindValue("a.cnx", null, "S", use)).toEqual({
      kind: "scope",
      scopePath: "S",
    });
    expect(program.bindValue("a.cnx", null, "nothing", use)).toBeNull();
  });

  it("binds a scope function before a global of the same name (#1760 review)", () => {
    // ADR-057 puts the scope's member first, whatever its kind. The member
    // step accepted variables only, so the global answered for the fold, the
    // typer and the binding, while emission wrote the function, S__LIMIT.
    const source = `const u32 LIMIT <- 8;
u32 total <- 1;
scope S {
    u32 LIMIT() { return 2; }
    u8[LIMIT] buf;
    public void f() {
        u32 v <- LIMIT;
    }
}
void g() {
    u32 w <- LIMIT;
}`;
    const program = build({ "a.cnx": source });
    const inScope = at(source, "LIMIT;");
    expect(program.bindValue("a.cnx", null, "LIMIT", inScope)).toMatchObject({
      kind: "function",
      symbol: { fullyQualifiedCName: "S__LIMIT" },
    });
    expect(constantAt(program, "a.cnx", "LIMIT", inScope)).toBeNull();
    // The function binds, so the global's 8 must not size it. #1175: it is
    // left unresolved, which 2.1 rejects (E0909: 'LIMIT' is a function),
    // where its source text used to reach the header
    expect(program.symbolByCName("S__buf")).toMatchObject({
      arrayDimensions: [UNRESOLVED_DIMENSION],
    });
    // Controls: outside the scope the global answers, and a scope that
    // declares nothing of the name still reaches a global
    const outside = at(source, "LIMIT;", 2);
    expect(program.bindValue("a.cnx", null, "LIMIT", outside)).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "LIMIT" },
    });
    expect(constantAt(program, "a.cnx", "LIMIT", outside)?.value).toBe(8);
    expect(program.bindValue("a.cnx", null, "total", inScope)).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "total" },
    });
  });

  it("stops at a scope type of the name, which binds no value (#1760 review)", () => {
    const source = `u32 Mode <- 3;
scope S {
    enum Mode { A, B }
    public void f() {
        Mode m <- Mode.A;
    }
}`;
    const program = build({ "a.cnx": source });
    expect(
      program.bindValue("a.cnx", null, "Mode", at(source, "Mode.A")),
    ).toBeNull();
  });

  it("binds a parameter", () => {
    const source = `void f(u16 p) {
    u16 q <- p;
}`;
    const program = build({ "a.cnx": source });
    expect(
      program.bindValue("a.cnx", null, "p", at(source, "p;")),
    ).toMatchObject({ kind: "local", declaration: { kind: "parameter" } });
  });
});

// #1760 second review: the member and global steps looked names up in the
// whole run, so a reopened scope's member from a file this one never
// includes beat the global it does include
describe("binding against the include closure", () => {
  const files = {
    "a.cnx": "scope S {\n    public const u32 N <- 2;\n}",
    "c.cnx": "const u32 N <- 8;",
    "b.cnx": [
      '#include "c.cnx"',
      "scope S {",
      "    u8[N] buf;",
      "    public u32 g() {",
      "        u32 v <- N;",
      "        return v;",
      "    }",
      "}",
    ].join("\n"),
    "d.cnx": [
      '#include "a.cnx"',
      '#include "c.cnx"',
      "scope S {",
      "    public u32 h() {",
      "        u32 w <- N;",
      "        return w;",
      "    }",
      "}",
    ].join("\n"),
  };

  it("binds the visible global where the member's file is not included", () => {
    const program = build(files);
    const use = at(files["b.cnx"], "N;");
    expect(program.bindValue("b.cnx", null, "N", use)).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "N" },
    });
    expect(constantAt(program, "b.cnx", "N", use)?.value).toBe(8);
    // A declaration folds against what its own file sees, too
    expect(program.symbolByCName("S__buf")).toMatchObject({
      arrayDimensions: [8],
    });
  });

  it("still binds the member where its file is included", () => {
    const program = build(files);
    const use = at(files["d.cnx"], "N;");
    expect(program.bindValue("d.cnx", null, "N", use)).toMatchObject({
      kind: "variable",
      symbol: { fullyQualifiedCName: "S__N" },
    });
    expect(constantAt(program, "d.cnx", "N", use)?.value).toBe(2);
  });
});

describe("settling (1.4)", () => {
  it("folds a const local, and a dimension that names it", () => {
    const source = `const u32 BASE <- 4;
void f() {
    const u32 N <- BASE + 2;
    u8[N] buf;
    u8 last <- buf[0];
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "buf[0]");
    expect(program.lexicalDeclarationAt("a.cnx", "N", use)?.constValue).toEqual(
      { kind: "value", digits: "6", typeName: "u32" },
    );
    expect(
      program.lexicalDeclarationAt("a.cnx", "buf", use)?.arrayDimensions,
    ).toEqual([6]);
    expect(constantAt(program, "a.cnx", "N", use)?.value).toBe(6);
    expect(constantAt(program, "a.cnx", "BASE", use)?.value).toBe(4);
  });

  it("gives a local that is not a folded const no value, and lets it shadow (#1664 review)", () => {
    // The const views added folded consts only, so each of these read the
    // file-scope const of the same name instead.
    const source = `u32 N <- 10;
u32 D <- 0;
void f(u32 a) {
    mut u32 N <- 1;
    u32 D <- a + 1;
    u8 last <- 0;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "u8 last");
    expect(constantAt(program, "a.cnx", "N", use)).toBeNull();
    expect(constantAt(program, "a.cnx", "D", use)).toBeNull();
  });

  it("does not fold a const local whose value its type cannot hold (#1664 review)", () => {
    // ADR-044: `A - 3` on a u8 is 0 in C, not -1
    const source = `void f() {
    const u8 A <- 2;
    const u8 B <- A - 3;
    const u8 C <- A + 3;
    u8 last <- 0;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "u8 last");
    expect(constantAt(program, "a.cnx", "B", use)).toBeNull();
    expect(constantAt(program, "a.cnx", "C", use)?.value).toBe(5);
  });

  it("folds an initializer where its names bind, before the declaration closes (#1760 review, #1643)", () => {
    // `N + 1` is in `N`'s own initializer, where the new local is not defined
    // yet (ADR-030): it binds the global, and emission reads the global too --
    // the local is emitted as `f__N` (ADR-057), so C's `N` is the global's
    const source = `const u8 N <- 4;
void f() {
    const u16 N <- N + 1;
    u8 last <- 0;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "u8 last");
    expect(
      program.lexicalDeclarationAt("a.cnx", "N", use)?.constValue,
    ).toMatchObject({ kind: "value", digits: "5" });
    expect(
      program.bindValue("a.cnx", null, "N", at(source, "N + 1"))?.kind,
    ).toBe("variable");
  });

  it("folds a declaration's own dimensions before its name (#1760 review)", () => {
    // The dimensions come before the name, so they see the global `N`
    const source = `const u8 N <- 4;
void f() {
    u8[N] N <- [0*];
    u8 last <- 0;
}`;
    const program = build({ "a.cnx": source });
    const use = at(source, "u8 last");
    expect(
      program.lexicalDeclarationAt("a.cnx", "N", use)?.arrayDimensions,
    ).toEqual([4]);
  });

  it("does not show a const local before it is declared", () => {
    const source = `void f() {
    u8 a <- 1;
    const u32 N <- 3;
}`;
    const program = build({ "a.cnx": source });
    expect(constantAt(program, "a.cnx", "N", at(source, "u8 a"))).toBeNull();
  });

  it("settles a local typed by a scope type another file declares", () => {
    const other = `scope Lib {
    public struct Point { u8 x; }
}`;
    const source = `#include "other.cnx"
scope Lib {
    public void f() {
        Point p;
        u8 q <- p.x;
    }
}`;
    const program = build({ "other.cnx": other, "a.cnx": source });
    expect(
      program.lexicalDeclarationAt("a.cnx", "p", at(source, "p.x"))?.type,
    ).toEqual({ kind: "struct", name: "Lib__Point" });
  });
});

// #1760 second review: finding the frame at a position scanned a frame's
// children linearly, once per binding, so a file of N functions compiled in
// O(N^2). The guard counts the children read, not the time taken.
describe("LexicalFrames.frameAt's cost", () => {
  const frame = (
    kind: ILexicalFrame["kind"],
    line: number,
    endLine: number,
    children: ReadonlyArray<ILexicalFrame> = [],
  ): ILexicalFrame => ({
    kind,
    span: TestSourceSpan.at(line, 0, endLine, 1),
    scopePath: "",
    functionCName: null,
    declarations: [],
    children,
  });

  const COUNT = 4096;
  const functions = Array.from({ length: COUNT }, (_, i) =>
    frame("function", 10 * i + 1, 10 * i + 5),
  );
  let reads = 0;
  const counted = new Proxy(functions, {
    get(target, key, receiver) {
      if (typeof key === "string" && /^\d+$/.test(key)) reads += 1;
      return Reflect.get(target, key, receiver);
    },
  });
  const root = frame("file", 1, 10 * COUNT + 1, counted);

  it("reads a logarithmic number of children to find the one containing a position", () => {
    reads = 0;
    const found = LexicalFrames.frameAt(root, {
      line: 10 * 4000 + 2,
      column: 0,
    });
    expect(found).toBe(functions[4000]);
    // log2(4096) is 12; a scan would read about 4000
    expect(reads).toBeLessThanOrEqual(2 * 12 + 2);
  });

  it("answers the file frame between two children", () => {
    expect(
      LexicalFrames.frameAt(root, { line: 10 * 2000 + 7, column: 0 }),
    ).toBe(root);
  });
});
