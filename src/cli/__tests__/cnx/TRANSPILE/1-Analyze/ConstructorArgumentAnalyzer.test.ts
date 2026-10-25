import { describe, expect, it } from "vitest";

import ConstructorArgumentAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/ConstructorArgumentAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. A C++ constructor argument must name a `const` variable (ADR-013,
 * issue #375): the generated C++ passes it by reference into a constructor that
 * runs before `main`, so a mutable file-scope variable would be read at an
 * unspecified point in static initialization.
 *
 * The rule was two throws -- `VariableDeclHelper` for a file-scope declaration
 * and `ScopeGenerator` for one inside a `scope` -- with identical text and two
 * different ways of deciding const-ness: one read `CodeGenState`'s type
 * registry, the other went through `orchestrator.isConstValue` on a
 * scope-qualified name. Two paths agreeing by construction only as long as
 * nobody edited one of them.
 *
 * It moves on the back of `IDeclaredVar.isConst`, which is the fact both copies
 * were reaching for: the collector reads the `constModifier` at every
 * declaration site, so 2.1 can answer this without codegen state at all.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new ConstructorArgumentAnalyzer(context).analyze(syntax);
};

describe("ConstructorArgumentAnalyzer", () => {
  it("rejects a mutable argument, with a real position", () => {
    const found = errors(
      "mut u8 mutablePin <- 10;\nAdafruit_MAX31856 probe(mutablePin);",
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0432");
    expect(found[0].span.line).toBe(2);
    expect(found[0].message).toContain("mutablePin");
  });

  it("accepts a const argument", () => {
    expect(errors("u8 PIN <- 10;\nAdafruit_MAX31856 probe(PIN);")).toEqual([]);
  });

  it("rejects an argument nothing declares", () => {
    // The second diagnostic of the same family: `VariableDeclHelper` threw
    // "is not declared" from the same loop, and it is the same question asked
    // one step earlier.
    const found = errors("Adafruit_MAX31856 probe(missing);");
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0433");
    expect(found[0].message).toContain("missing");
  });

  it("resolves a const declared inside the same scope", () => {
    // The `ScopeGenerator` copy existed because a scope member is not visible
    // by bare name to the file-scope lookup. Lexical frames make that one
    // question rather than two implementations.
    const source = [
      "scope Board {",
      "    u8 PIN <- 10;",
      "    Adafruit_MAX31856 probe(PIN);",
      "}",
    ].join("\n");
    expect(errors(source)).toEqual([]);
  });

  it("rejects a mutable scope member, the case ScopeGenerator owned", () => {
    const source = [
      "scope Board {",
      "    mut u8 pin <- 10;",
      "    Adafruit_MAX31856 probe(pin);",
      "}",
    ].join("\n");
    const found = errors(source);
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0432");
  });

  it("reports every offending argument, not just the first", () => {
    const found = errors(
      "mut u8 a <- 1;\nmut u8 b <- 2;\nAdafruit_MAX31856 probe(a, b);",
    );
    expect(found).toHaveLength(2);
  });

  it("says nothing about an ordinary declaration with an initializer", () => {
    // The negative control the rule turns on: `Type name <- value;` is not a
    // constructor call and must never be visited.
    expect(errors("u8 pin <- 10;\nu8 other <- pin;")).toEqual([]);
  });
});

// #1991: read off 1.2's syntax, so a constructor inside a function body, and
// where its report lands, are asserted directly.
describe("ConstructorArgumentAnalyzer -- local constructors", () => {
  it("checks one declared in a function body, at the declaration", () => {
    const found = errors(
      ["void f() {", "    Widget w(missing);", "}"].join("\n"),
    );
    expect(found.map((e) => [e.code, e.span.line, e.span.column])).toEqual([
      ["E0433", 2, 4],
    ]);
  });
});
