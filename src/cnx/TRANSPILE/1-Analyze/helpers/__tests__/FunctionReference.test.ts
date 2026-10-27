import ProgramLowering from "../../../../PARSE/2-Parse/ProgramLowering";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import CnxResolver from "../../../../PARSE/3-Declare/cnx/index";
import CnxSourceParser from "../../../../PARSE/2-Parse/CnxSourceParser";
import TranspileState from "../../../TranspileState";
import Program from "../../../../PARSE/4-Resolve/Program";
import SymbolRegistry from "../../../../PARSE/3-Declare/SymbolRegistry";
import FunctionReference from "../FunctionReference";
import type IProgram from "../../../../types/IProgram";
import type TSymbol from "../../../../types/symbols/TSymbol";
import testAnalysisContext from "../../__tests__/testAnalysisContext";

/**
 * #1322. Which cnx function a spelling denotes, and -- the part that is a
 * DECISION rather than a lookup -- the ORDER the candidates are tried in.
 *
 * ADR-057: inside a scope, a bare `f` means the scope's own `f` when one
 * exists and the global `f` otherwise, and codegen emits `S__f()` for a bare
 * `f()` inside `S` whichever of the two is declared. Two analyzers held that
 * order independently and one held it BACKWARDS, so a bare `f();` inside a
 * scope was checked against the global `f`. Only two scopes -- or a scope and
 * a global -- sharing a name make the order observable at all.
 */
const build = (source: string) => {
  const { tree } = CnxSourceParser.parse(source);
  state.program = Program.build(
    [
      CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "a.cnx",
        registry,
      ),
    ],
    { cppMode: false },
  );
};

afterEach(() => {
  state = new TranspileState();
});

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

let state = new TranspileState();

describe("FunctionReference.candidates -- the ADR-057 order", () => {
  /** `scope S { void f() {} }`, as 3-Declare names it (#2116). */
  const scopeF: Pick<IProgram, "memberOf"> = {
    memberOf: (scopePath, name) =>
      scopePath === "S" && name === "f"
        ? ({ fullyQualifiedCName: "S__f" } as TSymbol)
        : undefined,
  };

  it("tries the enclosing scope's member before the file-scope name", () => {
    expect(FunctionReference.candidates("f", "S", false, scopeF)).toEqual([
      "S__f",
      "f",
    ]);
  });

  it("gives a `global.` call exactly one candidate", () => {
    // Falling back to the scope's `f` here would make `global.f` resolve to
    // the very thing the spelling exists to bypass.
    expect(FunctionReference.candidates("f", "S", true, scopeF)).toEqual(["f"]);
  });

  it("has one candidate at file scope, where there is no scope to prefer", () => {
    expect(FunctionReference.candidates("f", "", false, scopeF)).toEqual(["f"]);
  });
});

describe("FunctionReference.candidatesForTypeText", () => {
  // 3-Declare declared `handler` in scope `S` and nothing else
  const declared: Pick<IProgram, "memberOf"> = {
    memberOf: (scopePath, name) =>
      scopePath === "S" && name === "handler"
        ? ({ fullyQualifiedCName: "S__handler" } as unknown as TSymbol)
        : undefined,
  };

  it("reads an array spelling as its element type", () => {
    expect(
      FunctionReference.candidatesForTypeText("onDown[4]", "", declared),
    ).toEqual(["onDown"]);
  });

  it("binds `this.` to the enclosing scope and nothing else", () => {
    expect(
      FunctionReference.candidatesForTypeText("this.handler", "S", declared),
    ).toEqual(["S__handler"]);
    // A member the scope does not declare names nothing either
    expect(
      FunctionReference.candidatesForTypeText("this.other", "S", declared),
    ).toEqual([]);
    // Outside a scope, `this.` names nothing -- E0431 is the rule that says so.
    expect(
      FunctionReference.candidatesForTypeText("this.handler", "", declared),
    ).toEqual([]);
  });

  it("binds `global.` to the file scope, unqualified", () => {
    expect(
      FunctionReference.candidatesForTypeText("global.onDown", "S", declared),
    ).toEqual(["onDown"]);
  });

  it("transpiles an explicitly qualified path", () => {
    expect(
      FunctionReference.candidatesForTypeText("Outer.Inner.h", "", declared),
    ).toEqual(["Outer__Inner__h"]);
  });

  it("searches from the enclosing scope for a bare name", () => {
    expect(
      FunctionReference.candidatesForTypeText("handler", "S", declared),
    ).toEqual(["S__handler", "handler"]);
  });
});

describe("FunctionReference.ofTypeText -- the order, observed", () => {
  it("resolves a bare name to the SCOPE's function over the global one", () => {
    // The shape that makes the order observable: both exist, and they differ.
    build(
      [
        "u8 handler() { return 1; }",
        "scope S {",
        "    public void handler() {}",
        "}",
      ].join("\n"),
    );
    const found = FunctionReference.ofTypeText(
      "handler",
      "S",
      testAnalysisContext(state),
    );
    expect(found).not.toBeNull();
    expect(FunctionReference.cNameOf(found!)).toBe("S__handler");
  });

  it("falls back to the global one when the scope declares none", () => {
    build("u8 handler() { return 1; }\nscope S {\n    public void go() {}\n}");
    const found = FunctionReference.ofTypeText(
      "handler",
      "S",
      testAnalysisContext(state),
    );
    expect(FunctionReference.cNameOf(found!)).toBe("handler");
  });

  it("takes the global one when the spelling says `global.`", () => {
    build(
      [
        "u8 handler() { return 1; }",
        "scope S {",
        "    public void handler() {}",
        "}",
      ].join("\n"),
    );
    const found = FunctionReference.ofTypeText(
      "global.handler",
      "S",
      testAnalysisContext(state),
    );
    expect(FunctionReference.cNameOf(found!)).toBe("handler");
  });

  it("answers null for a name the program does not declare as a function", () => {
    build("u8 value <- 1;");
    expect(
      FunctionReference.ofTypeText("value", "", testAnalysisContext(state)),
    ).toBeNull();
    expect(
      FunctionReference.ofTypeText("missing", "", testAnalysisContext(state)),
    ).toBeNull();
  });

  // `testAnalysisContext` substitutes `Program.build([], {})` when the state
  // has none, and `FunctionReference.lookup` no longer has a `!program` branch
  // -- so this is the EMPTY-program case, not the absent-program one. Renamed
  // rather than deleted: an empty program is a state a caller can reach.
  it("answers null when the program declares no such function", () => {
    state = new TranspileState();
    expect(
      FunctionReference.ofTypeText("handler", "", testAnalysisContext(state)),
    ).toBeNull();
  });
});
