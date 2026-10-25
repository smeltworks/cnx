/**
 * Unit tests for ReturnValueUseAnalyzer
 * ADR-070 / Issue #847: a non-void return must be used or explicitly discarded.
 */
import ProgramLowering from "../../../PARSE/2-Parse/ProgramLowering";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../../PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../../PARSE/2-Parse/grammar/CnxParser";
import CnxResolver from "../../../PARSE/3-Declare/cnx/index";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import TranspileState from "../../TranspileState";
import ReturnValueUseAnalyzer from "../ReturnValueUseAnalyzer";
import testAnalysisContext from "./testAnalysisContext";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CnxLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CnxParser(tokenStream);
  return parser.program();
}

/**
 * Analyze with real resolved symbols, so return types come from the same
 * source the transpiler uses rather than a hand-built mock that could drift.
 */
function analyze(source: string) {
  const tree = parse(source);
  state.symbols = TSymbolInfoAdapter.convert(
    CnxResolver.resolve(
      ProgramLowering.program(tree, null),
      "test.cnx",
      registry,
    ).symbols,
  );
  return ReturnValueUseAnalyzer.analyze(
    ProgramLowering.program(tree, null),
    testAnalysisContext(state),
  );
}

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

let state = new TranspileState();

describe("ReturnValueUseAnalyzer", () => {
  afterEach(() => {
    state = new TranspileState();
  });

  describe("flags a discarded non-void return (E0708)", () => {
    it("flags a bare call to a cnx function", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        void run() { next(); }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0708");
      expect(errors[0].message).toContain("next");
    });

    it("reports the statement's own line and column", () => {
      const errors = analyze(
        "u32 next() { return 7; }\nvoid run() {\n    next();\n}",
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].span.line).toBe(3);
      expect(errors[0].span.column).toBe(4);
    });

    it("offers the explicit-discard form in its help text", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        void run() { next(); }
      `);
      expect(errors[0].helpText).toContain("(void)");
    });

    it("flags each discard separately", () => {
      const errors = analyze(`
        u32 a() { return 1; }
        u32 b() { return 2; }
        void run() { a(); b(); }
      `);
      expect(errors).toHaveLength(2);
    });

    it("flags a stdlib function that returns a value", () => {
      const errors = analyze(`void run() { printf("hi"); }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("printf");
    });

    it("flags safe_div, which returns bool (ADR-051)", () => {
      // ADR-070 originally exempted safe_div on the premise that it had no
      // bound return; authors bind it, and the ADR's own opening example names
      // a discarded safe_div outcome as the bug this rule prevents.
      const errors = analyze(`
        void run() {
          u32 result;
          safe_div(result, 100, 0, 999);
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("safe_div");
    });
  });

  describe("accepts a return that is used or explicitly discarded", () => {
    it("accepts an explicit (void) discard", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        void run() { (void) next(); }
      `);
      expect(errors).toEqual([]);
    });

    it("flags a discard cast to something other than void", () => {
      // ADR-070 makes `(void)` THE discard form and allows no opt-out. A cast
      // to any other type throws the value away just as completely, so it is
      // not an explicit discard -- it is the silent-discard hole wearing a
      // cast. Guards against accepting `(void)` merely because the traversal
      // cannot see through a cast at all.
      const errors = analyze(`
        u32 next() { return 7; }
        void run() { (u32) next(); }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0708");
    });

    it("accepts a bound return", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        void run() { u32 v <- next(); }
      `);
      expect(errors).toEqual([]);
    });

    it("accepts a void callee", () => {
      const errors = analyze(`
        void doIt() { return; }
        void run() { doIt(); }
      `);
      expect(errors).toEqual([]);
    });

    it("accepts a call used as an argument", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        void take(u32 v) { return; }
        void run() { take(next()); }
      `);
      expect(errors).toEqual([]);
    });

    it("accepts a returned call", () => {
      const errors = analyze(`
        u32 next() { return 7; }
        u32 run() { return next(); }
      `);
      expect(errors).toEqual([]);
    });

    it("stays silent when the callee's return type is unresolvable", () => {
      // ADR-070's domain boundary: you cannot check a return type you cannot
      // see. This is the rule not applying, rather than an exemption.
      const errors = analyze(`void run() { mysteryExternal(); }`);
      expect(errors).toEqual([]);
    });
  });

  describe("ADR-016 qualified call targets", () => {
    it("flags this.member() inside its own scope", () => {
      const errors = analyze(`
        scope Timer {
          u32 read() { return 1; }
          void poll() { this.read(); }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("Timer");
    });

    it("accepts an explicitly discarded this.member()", () => {
      const errors = analyze(`
        scope Timer {
          u32 read() { return 1; }
          void poll() { (void) this.read(); }
        }
      `);
      expect(errors).toEqual([]);
    });

    it("flags global.Scope.member()", () => {
      const errors = analyze(`
        scope Timer {
          public u32 read() { return 1; }
        }
        void run() { global.Timer.read(); }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("Timer");
    });
  });

  describe("out of scope", () => {
    it("ignores a member access on a call result", () => {
      // ADR-070 puts `foo().field;` out of scope: the statement's value is the
      // member, not the call, and the form is vanishingly rare.
      const errors = analyze(`
        struct P { u32 x; }
        P make() { P p; return p; }
        void run() { make().x; }
      `);
      expect(errors).toEqual([]);
    });
  });
});
