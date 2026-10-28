import { describe, expect, it } from "vitest";

import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import CppClassInitializerAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/CppClassInitializerAnalyzer";
import ValuePositions from "../../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1322. Issue #517's rule (E0508), replacing a codegen throw that reported
 * `1:0` against whichever declaration happened to DRAIN the pending-assignment
 * queue rather than the initializer that filled it.
 *
 * A C++ class's constructor lives in the symbol table, which a unit test builds
 * directly and hands to 1.4 as the C++ header facts; the struct types come
 * from the per-file view 1.3 and 1.4 build from the source.
 */
const withCppClass = (className: string) => {
  const table = new SymbolTable();
  // A class's constructor is a function symbol named `Qualified::Class`, which
  // is exactly what `CppConstructorHelper.hasConstructor` looks for.
  table.addCppSymbol({
    name: `${className}::${className.split("::").at(-1)}`,
    unqualifiedName: className.split("::").at(-1)!,
    kind: "function",
    type: "void",
    visibility: "public",
    sourceFile: "Class.hpp",
    span: TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.Cpp,
  });
  // A namespaced class's header declares its namespace too
  const [head, ...rest] = className.split("::");
  if (rest.length > 0) {
    table.addCppSymbol({
      name: head,
      unqualifiedName: head,
      kind: "namespace",
      visibility: "public",
      sourceFile: "Class.hpp",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
    });
  }
  return table;
};

const analyze = (source: string, table: SymbolTable, cppMode: boolean) => {
  // #1428: the analyzer reads the run's mode from `Program`, as in a run.
  const { syntax, context } = testAnalysisContextFor(source, {
    symbolTable: table,
    cppMode,
  });
  return new CppClassInitializerAnalyzer(context).analyze(
    syntax,
    ValuePositions.of(syntax, context).positions,
  );
};

describe("CppClassInitializerAnalyzer (E0508)", () => {
  it("rejects a global initializer at the literal, not at a later declaration", () => {
    const source = [
      "CppTestClass globalObj <- { value: 42 };",
      "",
      "void main() {}",
    ].join("\n");
    const [found] = analyze(source, withCppClass("CppTestClass"), true);
    expect([found.code, found.span.line]).toEqual(["E0508", 1]);
    expect(found.span.column).toBeGreaterThan(20);
    expect(found.message).toContain("CppTestClass");
  });

  it("rejects a scope member, which codegen never checked", () => {
    // A scope member becomes a file-scope `static`, so it has no more room for
    // a statement than a global does. Codegen's queue was never drained here,
    // so the initializer was silently dropped at exit 0.
    const source = [
      "scope Holder {",
      "    private CppTestClass inner <- { value: 5 };",
      "}",
      "",
      "void main() {}",
    ].join("\n");
    expect(
      analyze(source, withCppClass("CppTestClass"), true).map(
        (e) => e.span.line,
      ),
    ).toEqual([2]);
  });

  it("stays silent inside a function body and inside a scope method", () => {
    const source = [
      "void main() {",
      "    CppTestClass a <- { value: 1 };",
      "}",
      "scope Holder {",
      "    public void go() {",
      "        CppTestClass b <- { value: 2 };",
      "    }",
      "}",
    ].join("\n");
    expect(analyze(source, withCppClass("CppTestClass"), true)).toEqual([]);
  });

  it("stays silent for a type with no constructor, in the same position", () => {
    const source = [
      "struct Plain { u32 value; }",
      "Plain p <- { value: 7 };",
      "",
      "void main() {}",
    ].join("\n");
    expect(analyze(source, new SymbolTable(), true)).toEqual([]);
  });

  it("stays silent in C mode, where E0507 has already rejected the header", () => {
    const source = "CppTestClass globalObj <- { value: 42 };\n\nvoid main() {}";
    expect(analyze(source, withCppClass("CppTestClass"), false)).toEqual([]);
  });

  it("names a namespaced class by the spelling 1.3 stored", () => {
    // The text in hand is the SOURCE spelling `TestNS.MyClass`, which the
    // symbol table does not hold -- it keys `TestNS::MyClass`, the spelling
    // 1.3 stored for the path because `TestNS` is a C++ namespace (#2116).
    const source = [
      "TestNS.MyClass globalObj <- { id: 7 };",
      "",
      "void main() {}",
    ].join("\n");
    const [found] = analyze(source, withCppClass("TestNS::MyClass"), true);
    expect(found?.message).toContain("TestNS::MyClass");
  });
});
