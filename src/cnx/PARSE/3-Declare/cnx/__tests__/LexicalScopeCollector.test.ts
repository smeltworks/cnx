import { describe, expect, it } from "vitest";
import parse from "./testHelpers";
import ProgramLowering from "../../../2-Parse/ProgramLowering";
import LexicalScopeCollector from "../collectors/LexicalScopeCollector";
import SymbolRegistry from "../../SymbolRegistry";
import type ILexicalFrame from "../../../../types/ILexicalFrame";
import QualifiedTypeNames from "../QualifiedTypeNames";

const NONE_WRITTEN = new Map<string, string>();

const framesOf = (source: string): ILexicalFrame =>
  LexicalScopeCollector.collect(
    ProgramLowering.program(parse(source), null),
    new SymbolRegistry(),
    {
      isScopeType: () => false,
      qualifiedTypeName: (written) =>
        QualifiedTypeNames.read(NONE_WRITTEN, written),
    },
  );

interface IShape {
  kind: ILexicalFrame["kind"];
  declarations: string[];
  children: IShape[];
}

const shapeOf = (frame: ILexicalFrame): IShape => ({
  kind: frame.kind,
  declarations: frame.declarations.map((d) => `${d.kind} ${d.name}`),
  children: frame.children.map(shapeOf),
});

const block = (...declarations: string[]): IShape => ({
  kind: "block",
  declarations,
  children: [],
});

describe("LexicalScopeCollector (#1668, #1991)", () => {
  it("opens a block for every statement body, holding that body's locals", () => {
    const root = framesOf(`
      void f(u8 x) {
        if (x = 1) { u8 a <- 1; } else { u8 b <- 2; }
        while (x = 2) { u8 c <- 3; }
        do { u8 d <- 4; } while (x = 3);
        critical { u8 g <- 6; }
        switch (x) {
          case 1 { u8 h <- 7; }
          default { u8 i <- 8; }
        }
        forever { u8 e <- 5; }
      }
    `);

    expect(shapeOf(root)).toEqual({
      kind: "file",
      declarations: [],
      children: [
        {
          kind: "function",
          declarations: ["parameter x"],
          children: [
            {
              kind: "block",
              declarations: [],
              children: [
                block("local a"),
                block("local b"),
                block("local c"),
                block("local d"),
                block("local g"),
                block("local h"),
                block("local i"),
                block("local e"),
              ],
            },
          ],
        },
      ],
    });
  });

  it("records a constructor declaration as one", () => {
    const body = framesOf(`void f() { Sensor probe(pin); }`).children[0]
      .children[0];

    expect(body.declarations.map((d) => [d.kind, d.name])).toEqual([
      ["constructor", "probe"],
    ]);
  });

  it("places a parameter at its name", () => {
    const fn = framesOf(`void f(u8 value) { }`).children[0];

    expect(fn.declarations[0].span).toMatchObject({ line: 1, column: 10 });
  });

  it("spans the whole file with the file frame", () => {
    const root = framesOf(`u8 a;\n\nvoid f() { }`);

    expect(root.span).toMatchObject({ line: 1, column: 0, endLine: 3 });
  });
});
