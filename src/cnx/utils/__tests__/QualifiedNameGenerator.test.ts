/**
 * Tests for QualifiedNameGenerator
 *
 * QualifiedNameGenerator is the ONLY place that constructs transpiled C names
 * like "Test__fillData" from function symbols.
 */
import { describe, it, expect, beforeEach } from "vitest";
import QualifiedNameGenerator from "../QualifiedNameGenerator";
import SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import Program from "../../PARSE/4-Resolve/Program";
import FunctionUtils from "../../PARSE/3-Declare/__tests__/FunctionUtils";
import TTypeUtils from "../TTypeUtils";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, for the source-scanning guard below. */
const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("QualifiedNameGenerator", () => {
  describe("forFunction", () => {
    it("returns bare name for global scope function", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        sourceFile: "main.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("main");
    });

    it("returns Scope_name for scoped function", () => {
      registry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("Test__fillData");
    });

    it("returns Outer_Inner_name for nested scope function", () => {
      registry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scopePath: "Outer.Inner",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "Outer__Inner__deepFunc",
      );
    });

    it("returns deeply nested path for 3-level scope", () => {
      registry.getOrCreateScope("A.B.C");
      const func = FunctionUtils.create({
        name: "veryDeep",
        scopePath: "A.B.C",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "A__B__C__veryDeep",
      );
    });
  });

  // #1298 removed the `getScopePath` suite with the delegate it tested. It
  // asserted that a chain walk recovered ["Outer","Middle","Inner"] from a scope
  // object; a scope now carries that path as a field, so the property belongs to
  // construction and is asserted in ScopeUtils.test.ts ("createScope" and
  // "no scope cycle is representable").

  describe("forFunctionInScope", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forFunctionInScope("", "main", null)).toBe(
        "main",
      );
    });

    it("returns transpiled C name for a simple scope", () => {
      registry.getOrCreateScope("Test");
      expect(
        QualifiedNameGenerator.forFunctionInScope("Test", "fillData", null),
      ).toBe("Test__fillData");
    });

    it("keeps every outer component for a nested scope", () => {
      // #1285: the leaf-name signature this replaced dropped the outer scope, so
      // this returned `Inner__func`. #1298 makes the parameter a string again --
      // but the whole PATH, which carries the chain the scope object used to.
      registry.getOrCreateScope("Outer.Inner");

      expect(
        QualifiedNameGenerator.forFunctionInScope("Outer.Inner", "func", null),
      ).toBe("Outer__Inner__func");
    });

    it("uses SymbolRegistry when function is registered", () => {
      const func = FunctionUtils.create({
        name: "init",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "motor.cnx",
        span: TestSourceSpan.at(1),
      });
      registry.registerFunction(func);

      // #1452 box 3: the scope graph arrives as an argument. Passing `null`
      // here took the `if (!program)` fallback, so this test registered a
      // function the code never looked at and its title was false --
      // `return "MUTATED"` after the null guard left the file green.
      expect(
        QualifiedNameGenerator.forFunctionInScope(
          "Motor",
          "init",
          Program.build([], { cppMode: false, registry }),
        ),
      ).toBe("Motor__init");
    });

    it("resolves through the scope the path names, not the global one", () => {
      // The `program.scope(scopePath) ?? program.globalScope()` arm. Registering
      // under `Motor` and asking as `Motor` is the only way to tell the two
      // apart, since a global lookup would miss.
      registry.getOrCreateScope("Motor");
      registry.registerFunction(
        FunctionUtils.create({
          name: "spin",
          scopePath: "Motor",
          parameters: [],
          returnType: TTypeUtils.createPrimitive("void"),
          visibility: "public",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
        }),
      );

      expect(
        QualifiedNameGenerator.forFunctionInScope(
          "Motor",
          "spin",
          Program.build([], { cppMode: false, registry }),
        ),
      ).toBe("Motor__spin");
    });

    it("falls back to qualifying the bare name when not in the registry", () => {
      registry.getOrCreateScope("Unknown");

      expect(
        QualifiedNameGenerator.forFunctionInScope(
          "Unknown",
          "func",
          Program.build([], { cppMode: false, registry }),
        ),
      ).toBe("Unknown__func");
    });

    it("qualifies without a program at all, which is the null arm", () => {
      // Kept explicit: `null` is a real caller shape (a site with no artifact
      // in hand), and it must not be the shape every other case takes by
      // accident.
      expect(
        QualifiedNameGenerator.forFunctionInScope("Unknown", "func", null),
      ).toBe("Unknown__func");
    });
  });

  /**
   * #2116: `QualifiedNameGenerator.forMember`, the render pass's door to
   * `ScopeUtils.qualifyInScope`, is gone. 3-Declare stores every member's C name
   * on its symbol, and the render pass reads `fullyQualifiedCName`, so no render
   * file calls the encoder at all.
   */
  describe("ScopeUtils.qualifyInScope is never called from the render pass", () => {
    /** `qualifyInScope` CALLED -- not merely named in prose. */
    const CALLS = /ScopeUtils\s*\.\s*qualifyInScope\s*\(/;

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory()
          ? walk(full)
          : entry.endsWith(".ts")
            ? [full]
            : [];
      });

    it("finds the population at all", () => {
      // Guards the selector: if the regex stops matching, the assertion below
      // passes over an empty list and proves nothing.
      const anywhere = walk(join(repoRoot, "src")).filter((file) =>
        CALLS.test(readFileSync(file, "utf-8")),
      );
      expect(anywhere.length).toBeGreaterThan(0);
    });

    it("has no caller inside the render pass", () => {
      const offenders = walk(
        join(repoRoot, "src", "cnx", "TRANSPILE", "3-Render"),
      )
        .map((file) => relative(repoRoot, file))
        .filter((file) => !file.includes("__tests__"))
        .filter((file) =>
          CALLS.test(readFileSync(join(repoRoot, file), "utf-8")),
        );

      expect(offenders).toEqual([]);
    });
  });
});
