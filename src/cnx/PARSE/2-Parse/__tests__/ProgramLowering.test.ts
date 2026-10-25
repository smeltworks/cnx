import { describe, expect, it } from "vitest";
import CnxSourceParser from "../CnxSourceParser";
import CommentScanner from "../CommentScanner";
import ProgramLowering from "../ProgramLowering";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";

function lower(source: string): IProgramSyntax {
  const parsed = CnxSourceParser.parse(source);
  return ProgramLowering.program(
    parsed.tree,
    new CommentScanner(parsed.tokenStream),
  );
}

describe("ProgramLowering", () => {
  it("lowers every declaration alternative to its own kind, in source order", () => {
    const program = lower(`
      scope Motor { public void run() { } u8 speed; }
      register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, }
      struct Point { i32 x; u8 tags[4]; }
      enum Color { RED, GREEN }
      bitmap8 Flags { a, b[7] }
      u32 add(u32 a, u8 buf[]) { return a; }
      u32 total <- 0;
      Widget w(total);
    `);
    expect(program.declarations.map((d) => d.declaration.kind)).toEqual([
      "scope",
      "register",
      "struct",
      "enum",
      "bitmap",
      "function",
      "variableDeclaration",
      "constructorDeclaration",
    ]);
  });

  it("lists every declaration, a scope's members included, in source order with its scope (#2115)", () => {
    const program = lower(`
      u8 a;
      scope Lib { u8 b; void c() { } }
      u8 d;
      scope Lib { u8 e; }
      void main() { }
    `);
    expect(
      program.members.map(({ declaration, scope }) => [
        declaration.kind === "missing" ? null : declaration.name,
        scope,
      ]),
    ).toEqual([
      ["a", null],
      ["b", "Lib"],
      ["c", "Lib"],
      ["d", null],
      ["e", "Lib"],
      ["main", null],
    ]);
  });

  it("lists the same declaration objects `declarations` holds, not copies (#2115)", () => {
    const program = lower(`
      u8 a;
      scope Lib { u8 b; void c() { } }
    `);
    const nested = program.declarations.flatMap(({ declaration }) =>
      declaration.kind === "scope"
        ? declaration.members.map((member) => member.declaration)
        : [declaration],
    );
    expect(program.members).toHaveLength(nested.length);
    program.members.forEach(({ declaration }, index) => {
      expect(declaration).toBe(nested[index]);
    });
  });

  it("is plain data: it survives a JSON round trip unchanged", () => {
    const program = lower(`
      #include <stdint.h>
      #define DEBUG
      scope Motor { public void run() { if (true) { u8 n <- 1; } } u8 speed; }
      register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, }
      struct Point { i32 x; u8 tags[4]; }
      enum Color { RED, GREEN }
      bitmap8 Flags { a, b[7] }
      u32 add(u32 a, u8 buf[]) { while (a > 0) { { return a; } } return 0; }
      u32 total <- 0;
      Widget w(total);
    `);
    expect(program.includes).toHaveLength(1);
    expect(program.directives).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(program))).toEqual(program);
  });

  it("records a scope member's written visibility, or null when unwritten", () => {
    const [{ declaration }] = lower(
      "scope Motor { public void run() { } u8 speed; private u8 gear; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "scope",
      name: "Motor",
      members: [
        {
          visibility: "public",
          declaration: { kind: "function", name: "run" },
        },
        {
          visibility: null,
          declaration: { kind: "variableDeclaration", name: "speed" },
        },
        {
          visibility: "private",
          declaration: { kind: "variableDeclaration", name: "gear" },
        },
      ],
    });
  });

  it("records a function's return type, parameters and body", () => {
    const [{ declaration }] = lower(
      "u32 add(mut u32 a, u8 buf[]) { return a; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "function",
      name: "add",
      returnType: { kind: "primitive", name: "u32" },
      parameters: [
        { const: false, mut: true, name: "a", dimensions: [] },
        { const: false, mut: false, name: "buf", dimensions: [null] },
      ],
      body: { statements: [{ kind: "return" }] },
    });
  });

  it("has no parameter list for a function written with ()", () => {
    const [{ declaration }] = lower("void f() { }").declarations;
    expect(declaration).toMatchObject({ kind: "function", parameters: null });
  });

  it("records a register's address and each member's type, access and offset", () => {
    const [{ declaration }] = lower(
      "register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, SR: u8 ro @ 0x08 }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "register",
      name: "GPIO",
      address: { written: "0x40000000" },
      members: [
        { name: "DR", access: "rw", offset: { written: "0x04" } },
        { name: "SR", access: "ro", offset: { written: "0x08" } },
      ],
    });
  });

  it("records a struct's fields with their dimensions", () => {
    const [{ declaration }] = lower(
      "struct Point { i32 x; wrap u8 tags[4]; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "struct",
      name: "Point",
      fields: [
        { name: "x", dimensions: [], overflow: null },
        { name: "tags", dimensions: [{ written: "4" }], overflow: "wrap" },
      ],
    });
  });

  it("keeps includes, directives and the comments written above each", () => {
    const program = lower(
      [
        "// the header",
        "#include <stdint.h>",
        "#define PLATFORM",
        "/* the counter */",
        "u32 count <- 0;",
      ].join("\n"),
    );
    expect(program.includes).toMatchObject([
      {
        written: "#include <stdint.h>",
        leadingComments: [{ content: " the header" }],
      },
    ]);
    expect(program.directives).toMatchObject([
      { kind: "define-flag", text: "#define PLATFORM", leadingComments: [] },
    ]);
    expect(program.declarations[0].leadingComments).toMatchObject([
      { content: " the counter " },
    ]);
  });

  it("reads no comments when there is no token stream", () => {
    const parsed = CnxSourceParser.parse("// note\nu32 count <- 0;\n");
    const program = ProgramLowering.program(parsed.tree, null);
    expect(program.declarations[0].leadingComments).toEqual([]);
  });
});

/**
 * #1932: 1.2 lowers every file on parse, so lowering a recovered file must
 * never throw. A declaration recovery repaired lowers as `missing`.
 */
describe("ProgramLowering on recovered files", () => {
  const TOKENS = [
    "u8",
    "x",
    "<-",
    "1",
    ";",
    "{",
    "}",
    "(",
    ")",
    "scope",
    "struct",
    "register",
    "@",
    "rw",
    ":",
    ",",
    "[",
    "]",
    "void",
    "enum",
    "public",
  ];
  const POSITIONS: ReadonlyArray<(run: string) => string> = [
    (run) => run,
    (run) => `struct S {\n${run}\n}`,
    (run) => `register R @ 0x40000000 {\n${run}\n}`,
    (run) => `scope S {\n${run}\n}`,
    (run) => `void f(${run}) { }`,
    (run) => `enum ${run}`,
  ];

  /** A seeded pseudo-random generator, so every run sees the same cases */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function missingCount(source: string): number {
    const parsed = CnxSourceParser.parse(source);
    if (parsed.parseErrors.length === 0) return -1;
    return JSON.stringify(parsed.program).split('"kind":"missing"').length - 1;
  }

  it("never throws, and repairs declarations as missing", () => {
    const next = random(1932);
    let recovered = 0;
    let repaired = 0;
    for (let i = 0; i < 2000; i++) {
      const length = 1 + Math.floor(next() * 6);
      const run = Array.from(
        { length },
        () => TOKENS[Math.floor(next() * TOKENS.length)],
      ).join(" ");
      const count = missingCount(POSITIONS[i % POSITIONS.length](run));
      if (count < 0) continue;
      recovered++;
      repaired += count;
    }
    expect(recovered).toBeGreaterThan(1000);
    expect(repaired).toBeGreaterThan(100);
  });

  // Each threw before declarations lowered a repaired member as `missing`
  it.each([
    [
      "a scope keyword in a struct body",
      "struct S {\n    scope B { u8 x <- 1; }\n}",
    ],
    [
      "a scope keyword in a register body",
      "register R @ 0x40000000 {\n    scope B { u8 x <- 1; }\n}",
    ],
  ])("lowers %s as missing", (_, source) => {
    expect(missingCount(source)).toBeGreaterThan(0);
  });
});

describe("ProgramLowering name spans", () => {
  // #1991: 2.1 reports a parameter or field at its name, not at its type
  it("spans a parameter and a struct field at the name", () => {
    const program = lower(
      "struct Point { u8 tags[4]; }\nvoid f(mut u8 value) { }\n",
    );
    const struct = program.declarations[0].declaration;
    const fn = program.declarations[1].declaration;
    if (struct.kind !== "struct" || fn.kind !== "function") {
      throw new Error("expected a struct then a function");
    }
    expect(struct.fields[0].nameSpan).toMatchObject({ line: 1, column: 18 });
    expect(fn.parameters?.[0].nameSpan).toMatchObject({ line: 2, column: 14 });
  });
});
