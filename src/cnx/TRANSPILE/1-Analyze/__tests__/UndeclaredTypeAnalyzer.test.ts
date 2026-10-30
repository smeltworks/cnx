/**
 * Unit tests for UndeclaredTypeAnalyzer.
 *
 * Issue #1312 (E0426): a type name that denotes nothing this file can see.
 * Issue #1336 (E0429): a name that denotes a REGISTER, which is not a type.
 *
 * The integration fixtures in `tests/bugs/issue-1336-register-in-type-position`
 * assert the diagnostic end to end, but they cannot reach every branch here: a
 * `test-error` fixture stops the analyzer pipeline at the first analyzer that
 * returns errors.
 */
import ProgramLowering from "../../../PARSE/2-Parse/ProgramLowering";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../../PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../../PARSE/2-Parse/grammar/CnxParser";
import CnxResolver from "../../../PARSE/3-Declare/cnx/index";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import Program from "../../../PARSE/4-Resolve/Program";
import TranspileState from "../../TranspileState";
import UndeclaredTypeAnalyzer from "../UndeclaredTypeAnalyzer";
import testAnalysisContext from "./testAnalysisContext";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CnxLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CnxParser(tokenStream);
  return parser.program();
}

/**
 * Analyze with real resolved symbols, so the `known*` sets come from the same
 * source the transpiler uses rather than a hand-built mock that could drift
 * from it -- which is the disagreement #1336 was.
 */
function analyze(source: string) {
  const tree = parse(source);
  const declared = CnxResolver.resolve(
    ProgramLowering.program(tree, null),
    "test.cnx",
    registry,
  );
  state.symbols = TSymbolInfoAdapter.convert(declared.symbols);
  state.program = Program.build([declared], {
    registry,
    cppMode: state.cppMode,
  });
  // `true` is the declining default -- the analyzer stays silent unless the
  // transpiler knows the file's whole name universe. These sources include
  // nothing, so the diagnostic is in scope.
  return new UndeclaredTypeAnalyzer(
    testAnalysisContext(state, { reachesForeignHeader: false }),
  ).analyze(ProgramLowering.program(tree, null));
}

const REGISTER = `register Control @ 0x40000000 { DR: u32 rw @ 0x00, }`;

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

let state = new TranspileState();

describe("UndeclaredTypeAnalyzer", () => {
  afterEach(() => {
    state = new TranspileState();
  });

  describe("a register in a type position (E0429, #1336)", () => {
    it("rejects it, and names it a register rather than undefined", () => {
      const errors = analyze(`
        ${REGISTER}
        u32 main() {
            Control c;
            return 0;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0429");
      expect(errors[0].message).toBe("'Control' is a register, not a type");
    });

    it("reports the use site, not the declaration", () => {
      const errors = analyze(
        `${REGISTER}\nu32 main() {\n    Control c;\n    return 0;\n}`,
      );
      expect(errors[0].span.line).toBe(3);
      expect(errors[0].span.column).toBe(4);
    });

    it("finds a scope-declared register through its qualified spelling", () => {
      // ADR-057: inside `Board` the bare `Control` is recorded as
      // `Board__Control`, so this exercises the qualified branch rather than
      // the bare one.
      const errors = analyze(`
        scope Board {
            public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
            public void go() {
                Control c;
            }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0429");
      expect(errors[0].typeName).toBe("Control");
    });
  });

  describe("a name that denotes nothing (E0426, #1312)", () => {
    it("rejects it as undefined, not as a register", () => {
      const errors = analyze(`
        u32 main() {
            Nowhere c;
            return 0;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0426");
      expect(errors[0].message).toBe("type 'Nowhere' is not defined");
    });

    it("reports every undefined type in one walk, not just the first", () => {
      // Why the `Point` control in the integration fixture is live: a second
      // wrongly-rejected type would show up as a second error.
      const errors = analyze(`
        u32 main() {
            Nowhere a;
            Elsewhere b;
            return 0;
        }
      `);
      expect(errors.map((e) => e.typeName)).toEqual(["Nowhere", "Elsewhere"]);
    });

    // #1991: the walk reads 1.2's syntax, so each place a type is written is
    // listed here rather than found by a tree walk that visits them all.
    it("finds a type in every position 1.2 records, at its own position", () => {
      const errors = analyze(
        [
          "struct S { Field f; }",
          "Ret go(Param p) {",
          "    Elem[(Dim) 4] a;",
          "    u32 n <- (Cast) 1;",
          "    return n;",
          "}",
        ].join("\n"),
      );
      expect(
        errors.map((e) => [e.typeName, e.span.line, e.span.column]),
      ).toEqual([
        ["Field", 1, 11],
        ["Ret", 2, 0],
        ["Param", 2, 7],
        ["Elem", 3, 4],
        ["Dim", 3, 10],
        ["Cast", 4, 14],
      ]);
    });
  });

  describe("names that must stay silent", () => {
    it("accepts a struct declared in the file", () => {
      expect(
        analyze(
          `struct Point { u32 x; }\nu32 main() { Point p <- { x: 1 }; return p.x; }`,
        ),
      ).toHaveLength(0);
    });

    it("accepts an enum declared in the file", () => {
      expect(
        analyze(
          `enum EColor { RED, GREEN }\nu32 main() { EColor c <- EColor.RED; return 0; }`,
        ),
      ).toHaveLength(0);
    });

    it("accepts a scope-declared struct by its bare name inside the scope", () => {
      // The qualified branch answering TRUE -- the mirror of the register case.
      expect(
        analyze(`
          scope Board {
              public struct Point { u32 x; }
              public void go() {
                  Point p <- { x: 1 };
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("accepts a primitive", () => {
      expect(analyze(`u32 main() { u32 x <- 1; return x; }`)).toHaveLength(0);
    });

    // #1456: "stays silent when there is no symbol view" lived here. It set
    // `state.symbols` to null and asserted the analyzer reported
    // nothing, and its own comment recorded that "no integration fixture can
    // construct this state".
    //
    // That is the tell. A test cannot document intentional behavior of a
    // state the program cannot enter: `Analyze._inputsOf` is the
    // single producer and it returns `ICodeGenSymbols` or throws, so 2.1 never
    // runs without a view. What the test actually held up was a defensive
    // guard in `isVisibleType` (`denotesType` since #1458), reachable only
    // from the test itself -- the #1418 shape, where a unit test is the sole
    // caller keeping a branch alive.
    //
    // `IAnalysisContext.symbols` is non-nullable now, so the state is
    // unrepresentable rather than guarded, and six `if (!symbols)` branches
    // went with it. The case below is the one that always mattered: a file
    // that CAN see a foreign header stays silent for a reason production
    // reaches.

    it("stays silent when the file can reach a foreign header (#985)", () => {
      // A C/C++ header is not parsed into the symbol table, so an unresolved
      // name there is indistinguishable from a type the compiler will supply.
      // Rejecting valid interop code is a regression; not diagnosing is the
      // status quo -- so the analyzer declines rather than guesses.
      const tree = parse(`u32 main() { Nowhere c; return 0; }`);
      state.symbols = TSymbolInfoAdapter.convert(
        CnxResolver.resolve(
          ProgramLowering.program(tree, null),
          "test.cnx",
          registry,
        ).symbols,
      );
      expect(
        new UndeclaredTypeAnalyzer(
          testAnalysisContext(state, { reachesForeignHeader: true }),
        ).analyze(ProgramLowering.program(tree, null)),
      ).toHaveLength(0);
    });
  });

  describe("a qualified type form (#1458)", () => {
    it("rejects a register named by global., this. or Scope. as E0429", () => {
      const errors = analyze(`
        register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
        scope Board {
            register Pins @ 0x40001000 { DR: u32 rw @ 0x00, }
            public register Leds @ 0x40002000 { DR: u32 rw @ 0x00, }
            public void go() {
                global.Control gc;
                this.Pins tc;
            }
        }
        u32 main() {
            Board.Leds sc;
            return 0;
        }
      `);
      expect(errors.map((e) => `${e.code} ${e.typeName}`)).toEqual([
        "E0429 global.Control",
        "E0429 this.Pins",
        "E0429 Board.Leds",
      ]);
    });

    it("rejects a name that is nothing, or a variable, as E0426", () => {
      const errors = analyze(`
        u32 count <- 0;
        scope Board {
            public u32 level <- 0;
            public void go() {
                global.Nope gn;
                this.Nope tn;
                global.count gv;
                this.level tv;
            }
        }
        u32 main() {
            Board.Nope sn;
            return 0;
        }
      `);
      expect(errors.map((e) => `${e.code} ${e.typeName}`)).toEqual([
        "E0426 global.Nope",
        "E0426 this.Nope",
        "E0426 global.count",
        "E0426 this.level",
        "E0426 Board.Nope",
      ]);
      expect(errors[0].message).toBe("type 'global.Nope' is not defined");
    });

    it("accepts a type named through each qualifier", () => {
      expect(
        analyze(`
          struct Point { u32 x; }
          scope Board {
              public struct Point { u32 y; }
              public void go() {
                  global.Point gp <- { x: 1 };
                  this.Point tp <- { y: 2 };
              }
          }
          u32 main() {
              Board.Point sp <- { y: 3 };
              return sp.y;
          }
        `),
      ).toHaveLength(0);
    });

    it("stays silent when the file can reach a foreign header (#985)", () => {
      const tree = parse(`u32 main() { global.Nowhere c; return 0; }`);
      state.symbols = TSymbolInfoAdapter.convert(
        CnxResolver.resolve(
          ProgramLowering.program(tree, null),
          "test.cnx",
          registry,
        ).symbols,
      );
      expect(
        new UndeclaredTypeAnalyzer(
          testAnalysisContext(state, { reachesForeignHeader: true }),
        ).analyze(ProgramLowering.program(tree, null)),
      ).toHaveLength(0);
    });
  });
});
