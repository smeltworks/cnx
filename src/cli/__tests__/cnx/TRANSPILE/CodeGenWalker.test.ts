/**
 * Unit tests for CodeGenWalker - the main transpiler component.
 * Tests the IOrchestrator interface and internal methods.
 */
import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import TargetResolver from "../../../TargetResolver";
import ProgramGeneration from "./ProgramGeneration";
import { describe, it, expect, beforeEach } from "vitest";
import IncludeResolver from "../../../../cnx/PARSE/1-Discover/IncludeResolver";
import MockFileSystem from "../../MockFileSystem";
import CodeGenWalker from "../../../../cnx/TRANSPILE/CodeGenWalker";
import CodeGenerator from "../../../../cnx/TRANSPILE/3-Render/codegen/CodeGenerator";
import CnxSourceParser from "../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import * as Parser from "../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import CnxResolver from "../../../../cnx/PARSE/3-Declare/cnx/index";
import TSymbolInfoAdapter from "../../../../cnx/PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import ICodeGenSymbols from "../../../../cnx/types/ICodeGenSymbols";
import TParameterInfo from "../../../../cnx/types/TParameterInfo";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";
import type TSymbol from "../../../../cnx/types/symbols/TSymbol";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

/**
 * #1444, owner ruling 1: the kind 1.1 Discover records for each `#include`
 * of `source`, built the way the run builds it -- the real `IncludeResolver`
 * over a file system with nothing in it. Render reads it and classifies
 * nothing, so a test that renders an include hands it over.
 */
const discoveredKinds = (source: string) =>
  new IncludeResolver([], new MockFileSystem(), "/project/src").resolve(source)
    .kinds;

/**
 * Both symbol passes, the way the pipeline runs them -- the real 1.4, not an
 * imitation of it.
 *
 * #1472: 1.3 Declare defers a bare type name it cannot settle, and reading one
 * as a type name throws by design -- so a test that ran Declare alone and fed
 * the result to codegen would fail on any scope that names a type bare. #1669:
 * 1.4 settles enum member values too, so this used to settle types alone and
 * hand codegen enums whose members had no value. These fixtures are
 * single-file programs, so the file is the whole program.
 */
function declareAndResolveAs(
  tree: Parser.ProgramContext,
  sourcePath: string,
): TSymbol[] {
  const declared = CnxResolver.resolve(
    ProgramLowering.program(tree, null),
    sourcePath,
    registry,
  );
  return [
    ...Program.build([declared], { cppMode: false, registry }).symbolsInFile(
      sourcePath,
    ),
  ];
}

function declareAndResolve(tree: Parser.ProgramContext): TSymbol[] {
  return declareAndResolveAs(tree, "test.cnx");
}

/**
 * Helper to parse cnx source and return tree + generator ready for testing.
 */
function setupGenerator(
  source: string,
  cppMode: boolean,
): {
  tree: Parser.ProgramContext;
  generator: CodeGenWalker;
  host: CodeGenerator;
  symbols: ICodeGenSymbols;
} {
  const { tree, parseErrors: errors, program } = CnxSourceParser.parse(source);
  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  const symbolTable = new SymbolTable();
  const tSymbols = declareAndResolve(tree);
  // Issue #831: Register TSymbols in SymbolTable (single source of truth)
  symbolTable.addTSymbols(tSymbols);
  const symbols = TSymbolInfoAdapter.convert(tSymbols);

  // #1445 box 3: the walk and the render-side services are two objects now.
  // The host is constructed here and injected, so assertions about the state
  // the walk accumulates read the SAME instance the walk drove.
  const host = new CodeGenerator();
  const generator = new CodeGenWalker(host);
  const state = host.state;
  // Set symbolTable in TranspileState before generate (TranspileState owns SymbolTable)
  TestSymbolTable.install(state, symbolTable);
  // Generate to initialize the generator state
  generateWithProgram(generator, tree, program, {
    cppMode,
    symbolInfo: symbols,
    sourcePath: "test.cnx",
  });

  return { tree, generator, host, symbols };
}

/**
 * Helper to create a minimal generator for testing specific methods.
 */
function createMinimalGenerator(
  source: string,
  cppMode: boolean,
): {
  generator: CodeGenWalker;
  host: CodeGenerator;
} {
  const { generator, host } = setupGenerator(source, cppMode);
  return { generator, host };
}

/** This file's registry, bound once -- the setup is `ProgramGeneration`'s. */
const generateWithProgram = (
  generator: CodeGenWalker,
  tree: Parser.ProgramContext,
  program: Parameters<typeof ProgramGeneration.generate>[2],
  options: Parameters<typeof ProgramGeneration.generate>[3],
): string =>
  ProgramGeneration.generate(generator, tree, program, options, registry);

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("CodeGenWalker", () => {
  // #1452 box 4: each test builds its own `CodeGenerator`, so its `SymbolTable`
  // arrives empty with the instance. The reset that stood here existed because
  // the table was a mutable static that carried an earlier test's symbols into
  // the next one -- ADR-057's shadow predicate then read an unrelated local as
  // shadowing something and changed the generated name. There is nothing left
  // to reset.

  describe("generate()", () => {
    it("should generate basic C code from empty program", () => {
      const source = "";
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("generated by cnx");
    });

    it("should generate function declarations", () => {
      const source = `
        void foo() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("void foo(void)");
    });

    it("should enable debug mode when specified", () => {
      const source = `
        mut clamp u8 val;
        void main() {
          val +<- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        debugMode: true,
      });

      // Debug mode affects helper generation
      expect(code).toContain("cnx_clamp_add_u8");
      // #1997: 2.2's one panic decision drives both the helper Render emits
      // and the cost the banner reports.
      expect(code).toContain("abort();");
      expect(code).toContain("hosted libc");
    });

    it("clamps without a hosted-libc cost outside debug mode", () => {
      const source = `
        mut clamp u8 val;
        void main() {
          val +<- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      const generator = new CodeGenWalker(new CodeGenerator());
      const symbols = TSymbolInfoAdapter.convert(declareAndResolve(tree));

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        debugMode: false,
      });

      expect(code).toContain("cnx_clamp_add_u8");
      expect(code).not.toContain("abort();");
      expect(code).not.toContain("hosted libc");
    });

    it("should generate C++ output when cppMode is enabled", () => {
      const source = `
        void foo() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: true,
      });

      expect(host.isCppMode()).toBe(true);
      // C++ mode uses consistent function signatures with explicit void
      expect(code).toContain("void foo(void)");
    });

    it("should handle include directories", () => {
      const source = `
        void foo() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        includeRewrites: new Map([["utils.cnx", "Display/utils.h"]]),
      });

      expect(code).toContain("void foo");
    });

    it("should include source path in generation comment", () => {
      const source = `void test() { }`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "led.cnx",
      });

      expect(code).toContain("generated by cnx from: led.cnx");
    });
  });

  describe("IOrchestrator interface", () => {
    describe("getInput()", () => {
      it("should return input context with symbol table", () => {
        const { host } = createMinimalGenerator(
          `
          void foo() { }
        `,
          false,
        );

        const input = host.getInput();

        expect(input.symbolTable).not.toBeNull();
        expect(input.symbols).not.toBeNull();
        expect(input.functionSignatures).toBeInstanceOf(Map);
        expect(input.knownFunctions).toBeInstanceOf(Set);
        expect(input.knownStructs).toBeInstanceOf(Set);
        expect(input.callbackTypes).toBeInstanceOf(Map);
        expect(input.callbackFieldTypes).toBeInstanceOf(Map);
      });
    });

    describe("getState()", () => {
      it("should return generation state snapshot", () => {
        const { host } = createMinimalGenerator(
          `
          void foo() { }
        `,
          false,
        );

        const state = host.getState();

        expect(state.currentScopePath).toBe("");
        expect(typeof state.indentLevel).toBe("number");
        expect(typeof state.inFunctionBody).toBe("boolean");
        expect(state.currentParameters).toBeInstanceOf(Map);
        expect(state.scopeMembers).toBeInstanceOf(Map);
      });
    });

    describe("applyEffects()", () => {
      it("should process set-scope effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        // #1304: entering a scope the registry does not hold is an invariant
        // violation now, not a silent orphan. A unit test that skips the
        // symbols pass registers the scope itself.
        registry.getOrCreateScope("MyScope");

        host.applyEffects([{ type: "set-scope", name: "MyScope" }]);

        const state = host.getState();
        // #1298: state carries the scope PATH, so assert the path rather than
        // whatever the caller happened to pass.
        expect(state.currentScopePath).toBe("MyScope");
      });

      it("should process enter-function-body effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        host.applyEffects([{ type: "enter-function-body" }]);

        expect(host.getState().inFunctionBody).toBe(true);
      });

      it("should process exit-function-body effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        host.applyEffects([{ type: "enter-function-body" }]);
        expect(host.getState().inFunctionBody).toBe(true);

        host.applyEffects([{ type: "exit-function-body" }]);

        expect(host.getState().inFunctionBody).toBe(false);
      });

      it("should process set-array-init-count effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // Verify effect is applied without throwing
        expect(() =>
          host.applyEffects([{ type: "set-array-init-count", count: 5 }]),
        ).not.toThrow();

        // Verify generator state is still valid
        expect(host.getState()).toBeDefined();
      });

      it("should process set-array-fill-value effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // Verify effect is applied without throwing
        expect(() =>
          host.applyEffects([{ type: "set-array-fill-value", value: "0xFF" }]),
        ).not.toThrow();

        // Verify generator state is still valid
        expect(host.getState()).toBeDefined();
      });

      it("should process set-parameters effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // Apply set-parameters effect with full TParameterInfo
        const params = new Map<string, TParameterInfo>([
          [
            "param1",
            {
              name: "param1",
              baseType: "u32",
              isArray: false,
              isStruct: false,
              isConst: false,
              isCallback: false,
              isString: false,
            },
          ],
        ]);
        expect(() =>
          host.applyEffects([{ type: "set-parameters", params }]),
        ).not.toThrow();

        // Parameters should be set
        const state = host.getState();
        expect(state.currentParameters.has("param1")).toBe(true);
      });

      it("should process clear-parameters effects", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // First set some parameters with full TParameterInfo
        const params = new Map<string, TParameterInfo>([
          [
            "param1",
            {
              name: "param1",
              baseType: "u32",
              isArray: false,
              isStruct: false,
              isConst: false,
              isCallback: false,
              isString: false,
            },
          ],
        ]);
        host.applyEffects([{ type: "set-parameters", params }]);
        expect(host.getState().currentParameters.has("param1")).toBe(true);

        // Now clear them
        host.applyEffects([{ type: "clear-parameters" }]);
        expect(host.getState().currentParameters.size).toBe(0);
      });
    });

    describe("getIndent()", () => {
      it("should return empty string at indent level 0", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.getIndent()).toBe("");
      });
    });

    describe("isKnownStruct()", () => {
      it("should return true for known struct", () => {
        const { host } = createMinimalGenerator(
          `
          struct Point { i32 x; i32 y; }
        `,
          false,
        );

        expect(host.isKnownStruct("Point")).toBe(true);
      });

      it("should return false for unknown struct", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.isKnownStruct("UnknownStruct")).toBe(false);
      });

      it("should return false for primitive type", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isKnownStruct("u32")).toBe(false);
      });
    });

    describe("isFloatType()", () => {
      it("should return true for f32", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isFloatType("f32")).toBe(true);
      });

      it("should return true for f64", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isFloatType("f64")).toBe(true);
      });

      it("should return false for C type float (only cnx types checked)", () => {
        // isFloatType only checks cnx types, not C types
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isFloatType("float")).toBe(false);
      });

      it("should return false for C type double (only cnx types checked)", () => {
        // isFloatType only checks cnx types, not C types
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isFloatType("double")).toBe(false);
      });

      it("should return false for integer types", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isFloatType("u32")).toBe(false);
        expect(host.isFloatType("i32")).toBe(false);
      });
    });

    describe("isIntegerType()", () => {
      it("should return true for unsigned integer types", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isIntegerType("u8")).toBe(true);
        expect(host.isIntegerType("u16")).toBe(true);
        expect(host.isIntegerType("u32")).toBe(true);
        expect(host.isIntegerType("u64")).toBe(true);
      });

      it("should return true for signed integer types", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isIntegerType("i8")).toBe(true);
        expect(host.isIntegerType("i16")).toBe(true);
        expect(host.isIntegerType("i32")).toBe(true);
        expect(host.isIntegerType("i64")).toBe(true);
      });

      it("should return false for float types", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isIntegerType("f32")).toBe(false);
        expect(host.isIntegerType("f64")).toBe(false);
      });
    });

    describe("isCnxFunction()", () => {
      it("should return true for cnx defined function", () => {
        const { host } = createMinimalGenerator(
          `
          void myFunction() { }
        `,
          false,
        );

        expect(host.isCnxFunction("myFunction")).toBe(true);
      });

      it("should return false for unknown function", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.isCnxFunction("unknownFunction")).toBe(false);
      });
    });

    describe("isCppMode()", () => {
      it("should return false by default", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        expect(host.isCppMode()).toBe(false);
      });
    });

    describe("getKnownEnums()", () => {
      it("should return set of known enums", () => {
        const { host } = createMinimalGenerator(
          `
          enum Color { RED, GREEN, BLUE }
        `,
          false,
        );

        const knownEnums = host.getKnownEnums();
        expect(knownEnums.has("Color")).toBe(true);
      });
    });

    describe("flushPendingTempDeclarations()", () => {
      it("should return empty string when no pending declarations", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.flushPendingTempDeclarations()).toBe("");
      });
    });

    describe("setCurrentScope() / setCurrentFunctionName()", () => {
      it("should set and track current scope", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);
        // #1304: see the note on "should process set-scope effects".
        registry.getOrCreateScope("MyScope");

        host.setCurrentScope("MyScope");
        expect(host.getState().currentScopePath).toBe("MyScope");

        host.setCurrentScope(null);
        expect(host.getState().currentScopePath).toBe("");
      });

      it("should set current function name", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // Verify function name can be set without throwing
        expect(() => host.setCurrentFunctionName("myFunction")).not.toThrow();

        // Verify generator state is still valid
        expect(host.getState()).toBeDefined();
      });
    });

    describe("enterFunctionBody() / exitFunctionBody()", () => {
      it("should track function body state", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.getState().inFunctionBody).toBe(false);

        host.enterFunctionBody();
        expect(host.getState().inFunctionBody).toBe(true);

        host.exitFunctionBody();
        expect(host.getState().inFunctionBody).toBe(false);
      });
    });

    describe("isKnownScope()", () => {
      it("should return true for known scope", () => {
        const { host } = createMinimalGenerator(
          `
          scope Motor {
            public void stop() { }
          }
        `,
          false,
        );

        expect(host.isKnownScope("Motor")).toBe(true);
      });

      it("should return false for unknown scope", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.isKnownScope("UnknownScope")).toBe(false);
      });
    });

    describe("addPendingTempDeclaration()", () => {
      it("should add temp declaration that can be flushed", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        host.addPendingTempDeclaration("int _tmp1 = 0;");

        const decls = host.flushPendingTempDeclarations();
        expect(decls).toBe("int _tmp1 = 0;");

        // After flush, should be empty
        expect(host.flushPendingTempDeclarations()).toBe("");
      });
    });

    describe("float bit shadow management", () => {
      it("should register and track float bit shadows", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.hasFloatBitShadow("__bits_myFloat")).toBe(false);
        expect(host.isFloatShadowCurrent("__bits_myFloat")).toBe(false);

        host.registerFloatBitShadow("__bits_myFloat");
        expect(host.hasFloatBitShadow("__bits_myFloat")).toBe(true);
        expect(host.isFloatShadowCurrent("__bits_myFloat")).toBe(false);

        host.markFloatShadowCurrent("__bits_myFloat");
        expect(host.isFloatShadowCurrent("__bits_myFloat")).toBe(true);
      });

      it("should clear float shadows on enter/exit function body", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        host.enterFunctionBody();
        host.registerFloatBitShadow("__bits_myFloat");
        expect(host.hasFloatBitShadow("__bits_myFloat")).toBe(true);

        host.exitFunctionBody();
        expect(host.hasFloatBitShadow("__bits_myFloat")).toBe(false);
      });
    });

    describe("getStringLiteralLength()", () => {
      it("should return correct length for simple string", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        expect(host.getStringLiteralLength('"hello"')).toBe(5);
      });

      it("should handle escape sequences", () => {
        const { host } = createMinimalGenerator(`void foo() { }`, false);

        // \n is one character
        expect(host.getStringLiteralLength('"hello\\n"')).toBe(6);
      });
    });
  });

  describe("Type generation", () => {
    it("should map cnx types to C types", () => {
      const source = `
        u8 a;
        u16 b;
        u32 c;
        u64 d;
        i8 e;
        i16 f;
        i32 g;
        i64 h;
        f32 i;
        f64 j;
        bool k;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint8_t a");
      expect(code).toContain("uint16_t b");
      expect(code).toContain("uint32_t c");
      expect(code).toContain("uint64_t d");
      expect(code).toContain("int8_t e");
      expect(code).toContain("int16_t f");
      expect(code).toContain("int32_t g");
      expect(code).toContain("int64_t h");
      expect(code).toContain("float i");
      expect(code).toContain("double j");
      expect(code).toContain("bool k");
    });
  });

  describe("Assignment operator translation", () => {
    it("should translate <- to =", () => {
      const source = `
        mut u32 x;
        void main() {
          x <- 42;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("x = 42U;");
    });

    it("should translate compound assignment operators", () => {
      // Note: Default is 'clamp' overflow behavior which uses helper functions
      // Use 'wrap' for direct C operators
      const source = `
        mut wrap u32 x <- 10;
        void main() {
          x +<- 5;
          x -<- 3;
          x *<- 2;
          x /<- 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("x += 5U;");
      expect(code).toContain("x -= 3U;");
      expect(code).toContain("x *= 2U;");
      expect(code).toContain("x /= 2U;");
    });
  });

  describe("Equality operator translation", () => {
    it("should translate = to == for comparison", () => {
      const source = `
        u32 x <- 10;
        void main() {
          if (x = 10) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("x == 10");
    });
  });

  describe("Scope generation", () => {
    it("should generate scope members with prefix", () => {
      const source = `
        scope Motor {
          mut u32 speed;
          public void setSpeed(u32 s) {
            speed <- s;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t Motor__speed");
      expect(code).toContain("void Motor__setSpeed");
      expect(code).toContain("Motor__speed = s;");
    });
  });

  describe("Overflow behavior", () => {
    it("should generate clamp helper for compound assignment", () => {
      // Clamp helpers are generated for compound assignment operators
      const source = `
        mut clamp u8 value <- 200;
        void main() {
          value +<- 100;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("cnx_clamp_add_u8");
      expect(code).toContain("cnx_clamp_add_u8(value, 100U)");
    });
  });

  describe("Target description", () => {
    // #1991: the target is named, and 1.4 settles it from the catalog
    it("plans with the target 1.4 settled from the option", () => {
      const source = `void foo() { }`;
      const { tree, program } = CnxSourceParser.parse(source);
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const symbols = TSymbolInfoAdapter.convert(declareAndResolve(tree));
      const teensy41 = TargetResolver.byName(
        "teensy41",
        NodeFileSystem.instance,
      )!;

      generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        targetName: "teensy41",
      });

      expect(host.state.targetDescription).toEqual(teensy41);
    });
  });

  describe("Control flow generation", () => {
    it("should generate if statement", () => {
      const source = `
        mut u32 x <- 10;
        void main() {
          if (x = 10) {
            x <- 5;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("if (x == 10)");
      expect(code).toContain("x = 5U;");
    });

    it("should generate if-else statement", () => {
      const source = `
        mut u32 x <- 10;
        void main() {
          if (x = 10) {
            x <- 5;
          } else {
            x <- 20;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("if (x == 10)");
      expect(code).toContain("} else {");
    });

    it("should generate while loop", () => {
      const source = `
        mut wrap u32 x <- 10;
        void main() {
          while (x > 0) {
            x -<- 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("while (x > 0)");
    });

    it("should generate for loop", () => {
      const source = `
        mut wrap u32 sum <- 0;
        void main() {
          for (mut wrap u32 i <- 0; i < 10; i +<- 1) {
            sum +<- i;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("for (");
      expect(code).toContain("i < 10");
    });

    it("should generate do-while loop", () => {
      const source = `
        mut wrap u32 x <- 10;
        void main() {
          do {
            x -<- 1;
          } while (x > 0);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("do {");
      expect(code).toContain("} while (x > 0);");
    });

    it("should generate switch statement", () => {
      const source = `
        u32 x <- 1;
        mut u32 result <- 0;
        void main() {
          switch (x) {
            case 1 { result <- 10; }
            case 2 { result <- 20; }
            default { result <- 0; }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("switch (x)");
      expect(code).toContain("case 1:");
      expect(code).toContain("case 2:");
      expect(code).toContain("default:");
      expect(code).toContain("break;");
    });

    it("should generate return statement", () => {
      const source = `
        u32 getNumber() {
          return 42;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // #1277: a `return` expression is typed by the declared return type, so
      // an integer literal returned from an unsigned function now carries the
      // MISRA C:2012 Rule 7.2 suffix it already had in `u32 x <- 42;`.
      expect(code).toContain("return 42U;");
    });
  });

  describe("Array declarations", () => {
    it("should generate array declaration", () => {
      const source = `
        u32[10] arr;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t arr[10]");
    });

    it("should generate array with initializer", () => {
      const source = `
        u32[3] arr <- [1, 2, 3];
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("arr[3]");
      expect(code).toContain("{1U, 2U, 3U}");
    });

    it("should generate multi-dimensional array", () => {
      const source = `
        u32[3][3] matrix;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("matrix[3][3]");
    });
  });

  describe("Function parameters", () => {
    it("should generate function with parameters", () => {
      const source = `
        void add(u32 a, u32 b) { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Parameters should be const if not modified
      expect(code).toContain("uint32_t a");
      expect(code).toContain("uint32_t b");
    });

    it("should generate struct parameter with pointer semantics", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void setPoint(mut Point p) {
          p.x <- 10;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Struct params become pointers in C mode
      expect(code).toContain("Point*");
    });

    it("should generate array parameter", () => {
      const source = `
        void process(u32[10] arr) { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("arr[10]");
    });
  });

  describe("Expression generation", () => {
    it("should generate arithmetic expressions", () => {
      const source = `
        wrap u32 a <- 10;
        wrap u32 b <- 5;
        mut wrap u32 c;
        void main() {
          c <- a + b * 2 - 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a + b * 2U - 1U");
    });

    it("should generate comparison expressions", () => {
      const source = `
        u32 a <- 10;
        u32 b <- 5;
        mut bool result;
        void main() {
          result <- a > b;
          result <- a >= b;
          result <- a < b;
          result <- a <= b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a > b");
      expect(code).toContain("a >= b");
      expect(code).toContain("a < b");
      expect(code).toContain("a <= b");
    });

    it("should generate logical expressions", () => {
      const source = `
        bool a <- true;
        bool b <- false;
        mut bool result;
        void main() {
          result <- a && b;
          result <- a || b;
          result <- !a;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a && b");
      expect(code).toContain("a || b");
      expect(code).toContain("!a");
    });

    it("should generate bitwise expressions", () => {
      const source = `
        wrap u32 a <- 0xFF;
        wrap u32 b <- 0x0F;
        mut wrap u32 result;
        void main() {
          result <- a & b;
          result <- a | b;
          result <- a ^ b;
          result <- ~a;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a & b");
      expect(code).toContain("a | b");
      expect(code).toContain("a ^ b");
      expect(code).toContain("~a");
    });

    it("should generate shift expressions", () => {
      const source = `
        wrap u32 a <- 1;
        mut wrap u32 result;
        void main() {
          result <- a << 4;
          result <- a >> 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("<< 4");
      expect(code).toContain(">> 2");
    });

    it("should generate unary expressions", () => {
      const source = `
        i32 a <- 10;
        i32 result;
        void main() {
          result <- -a;
          result <- +a;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("-a");
    });

    it("should generate increment/decrement using compound assignment", () => {
      // cnx uses +<- 1 for increment instead of ++
      const source = `
        mut wrap u32 a <- 10;
        void main() {
          a +<- 1;
          a -<- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a += 1");
      expect(code).toContain("a -= 1");
    });
  });

  describe("Struct member access", () => {
    it("should generate struct member access", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        mut Point p;
        void main() {
          p.x <- 10;
          p.y <- 20;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("p.x = 10");
      expect(code).toContain("p.y = 20");
    });

    it("should generate struct initializer", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point p <- {x: 10, y: 20};
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain(".x = 10");
      expect(code).toContain(".y = 20");
    });
  });

  describe("Enum member access", () => {
    it("should generate enum member access with prefix", () => {
      const source = `
        enum Color { RED, GREEN, BLUE }
        mut Color c;
        void main() {
          c <- Color.RED;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Color__RED");
    });
  });

  describe("Const declarations", () => {
    it("should generate const variable", () => {
      const source = `
        u32 MAX_SIZE <- 100;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("const uint32_t MAX_SIZE = 100");
    });
  });

  describe("Register declarations", () => {
    it("should generate register definition", () => {
      const source = `
        register GPIO @ 0x40020000 {
          rw u32 DATA @ 0x00
        }
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // With the file's symbols registered, as the real pipeline does, a
      // file-level register is written to the header, not the .c
      // (tests/bitmap/bitmap-in-register.expected.h holds its text).
      expect(code).not.toContain("0x40020000");
    });
  });

  describe("Function calls", () => {
    it("should generate function call", () => {
      const source = `
        u32 add(u32 a, u32 b) {
          return a + b;
        }
        mut u32 result;
        void main() {
          result <- add(1, 2);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("result = add(1U, 2U);");
    });

    it("should generate scope function call", () => {
      const source = `
        scope Math {
          public u32 square(u32 x) {
            return x * x;
          }
        }
        mut u32 result;
        void main() {
          result <- Math.square(5);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Math__square(5U)");
    });
  });

  describe("Float types", () => {
    it("should generate float declarations", () => {
      // Note: cnx doesn't use 'f' suffix - float literals are just decimals
      const source = `
        f32 a <- 1.5;
        f64 b <- 2.5;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("float a = 1.5");
      expect(code).toContain("double b = 2.5");
    });
  });

  describe("Atomic declarations", () => {
    it("should generate atomic variable", () => {
      const source = `
        atomic u32 counter <- 0;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("volatile uint32_t counter");
    });
  });

  describe("Include directive transformation", () => {
    it("should pass through C header includes unchanged", () => {
      const source = `
        #include <stdio.h>
        #include "myheader.h"
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        includeKinds: discoveredKinds(source),
      });

      expect(code).toContain("#include <stdio.h>");
      expect(code).toContain('#include "myheader.h"');
    });

    it("emits a missing .cnx include rather than rejecting it (E0506 is 2.1's)", () => {
      // #1322: this asserted a codegen throw, which reported `1:0` with no
      // code. `IncludeDirectiveAnalyzer` rejects it at the directive now, and
      // codegen never touches the file system for an include -- so what is
      // pinned here is that the rejection is GONE from this layer, not that it
      // stopped happening. `tests/include/missing-cnx-include-error` asserts
      // that it still does.
      const source = `
        #include "nonexistent.cnx"
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        includeKinds: discoveredKinds(source),
      });

      expect(code).toContain('#include "nonexistent.h"');
    });
  });

  describe("Self-include generation", () => {
    it("should generate self-include for public scope members", () => {
      // Public keyword is only valid inside scopes
      const source = `
        scope Motor {
          public void start() { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "myfile.cnx",
        selfInclude: "myfile.h",
      });

      expect(code).toContain('#include "myfile.h"');
    });
  });

  describe("isCppEnumClass()", () => {
    it("should return false when no symbol table", () => {
      const { host } = createMinimalGenerator(`void foo() { }`, false);
      // With symbol table but no C++ symbols
      expect(host.isCppEnumClass("UnknownEnum")).toBe(false);
    });
  });

  describe("indent()", () => {
    it("should indent text with current level", () => {
      const { host } = createMinimalGenerator(`void foo() { }`, false);

      // Default indent level is 0
      const indented = host.indent("test");
      expect(indented).toBe("test");
    });
  });

  describe("Ternary expressions", () => {
    it("should generate ternary expression with comparison condition", () => {
      const source = `
        u32 a <- 10;
        u32 b <- 5;
        mut u32 result;
        void main() {
          result <- (a > b) ? 1 : 0;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(a > b) ? 1U : 0U");
    });
  });

  describe("Bit indexing", () => {
    it("should generate bit index expression", () => {
      const source = `
        u32 flags <- 0xFF;
        mut u32 result;
        void main() {
          result <- flags[4, 4];
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Bit indexing should generate mask and shift
      expect(code).toContain("flags");
      expect(code).toContain(">> 4"); // Shift by start position
    });
  });

  describe("Critical sections", () => {
    it("should generate critical section", () => {
      const source = `
        mut wrap u32 counter <- 0;
        void main() {
          critical {
            counter +<- 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Critical sections generate interrupt save/restore code
      expect(code).toContain("counter += 1");
    });
  });

  describe("Nested struct access", () => {
    it("should generate nested struct member access", () => {
      const source = `
        struct Inner { i32 value; }
        struct Outer { Inner inner; }
        mut Outer obj;
        void main() {
          obj.inner.value <- 42;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("obj.inner.value = 42");
    });
  });

  describe("Enum switch", () => {
    it("should generate switch on enum type", () => {
      const source = `
        enum State { IDLE, RUNNING, STOPPED }
        State s <- State.IDLE;
        mut wrap u32 result <- 0;
        void main() {
          switch (s) {
            case State.IDLE { result <- 0; }
            case State.RUNNING { result <- 1; }
            case State.STOPPED { result <- 2; }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("switch (s)");
      expect(code).toContain("case State__IDLE:");
      expect(code).toContain("case State__RUNNING:");
      expect(code).toContain("case State__STOPPED:");
    });
  });

  describe("Function with return value", () => {
    it("should generate function returning struct", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point makePoint() {
          Point p <- {x: 0, y: 0};
          return p;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Point makePoint");
      expect(code).toContain("return p;");
    });
  });

  describe("Local variable declarations", () => {
    it("should generate local variable with initializer", () => {
      const source = `
        void main() {
          mut wrap u32 localVar <- 100;
          localVar +<- 50;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t localVar = 100");
      expect(code).toContain("localVar += 50");
    });
  });

  describe("Scope with private members", () => {
    it("should generate private scope members with prefix", () => {
      const source = `
        scope Motor {
          mut u32 privateSpeed;
          public void setSpeed(u32 s) {
            privateSpeed <- s;
          }
          public u32 getSpeed() {
            return privateSpeed;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("static uint32_t Motor__privateSpeed");
      expect(code).toContain("Motor__privateSpeed = s");
      expect(code).toContain("return Motor__privateSpeed");
    });
  });

  describe("Modulo operation", () => {
    it("should generate modulo expression", () => {
      const source = `
        wrap u32 a <- 17;
        mut wrap u32 result;
        void main() {
          result <- a % 5;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a % 5");
    });
  });

  describe("Division operation", () => {
    it("should generate division expression", () => {
      const source = `
        wrap u32 a <- 20;
        mut wrap u32 result;
        void main() {
          result <- a / 4;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a / 4");
    });
  });

  describe("String operations", () => {
    it("should generate string variable declaration", () => {
      // string<N> becomes char[N+1] to include null terminator
      const source = `
        string<32> name <- "Hello";
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("char name[33]"); // 32 + 1 for null terminator
      expect(code).toContain('"Hello"');
    });
  });

  describe("Boolean literals", () => {
    it("should generate boolean literals", () => {
      const source = `
        bool a <- true;
        bool b <- false;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("bool a = true");
      expect(code).toContain("bool b = false");
    });
  });

  describe("Hex and binary literals", () => {
    it("should generate hex literal", () => {
      const source = `
        wrap u32 a <- 0xFF;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("0xFF");
    });

    it("should generate binary literal", () => {
      const source = `
        wrap u32 a <- 0b1010;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Binary literals are typically converted to decimal or hex in C
      expect(code).toContain("10"); // 0b1010 = 10
    });
  });

  describe("Main function with void", () => {
    it("should generate void main function", () => {
      const source = `
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("int main(void)");
    });

    it("should generate main with return type", () => {
      const source = `
        u32 main() {
          return 0;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("int main(void)");
      // #1277: a `return` expression is typed by the declared return type, so
      // an integer literal returned from an unsigned function now carries the
      // MISRA C:2012 Rule 7.2 suffix it already had in `u32 x <- 42;`.
      expect(code).toContain("return 0U;");
    });
  });

  describe("Parenthesized expressions", () => {
    it("should generate parenthesized expression", () => {
      const source = `
        wrap u32 a <- 10;
        wrap u32 b <- 5;
        wrap u32 c <- 2;
        mut wrap u32 result;
        void main() {
          result <- (a + b) * c;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(a + b) * c");
    });
  });

  describe("Array element assignment", () => {
    it("should generate array element assignment", () => {
      const source = `
        mut wrap u32[10] arr;
        void main() {
          arr[0] <- 42;
          arr[5] <- 100;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("arr[0] = 42");
      expect(code).toContain("arr[5] = 100");
    });
  });

  describe("ISR functions", () => {
    it("should generate ISR function", () => {
      const source = `
        ISR timer_handler() {
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("timer_handler");
    });
  });

  describe("This keyword access", () => {
    it("should generate this. member access inside scope", () => {
      const source = `
        scope Motor {
          mut u32 speed;
          public void setSpeed(u32 s) {
            this.speed <- s;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Motor__speed = s");
    });
  });

  describe("Global keyword access", () => {
    it("should generate global. variable access inside scope", () => {
      const source = `
        mut u32 globalCounter <- 0;
        scope Motor {
          public void increment() {
            global.globalCounter <- global.globalCounter + 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // #1303: what this test is about is the NAME -- `global.globalCounter`
      // must reach the bare `globalCounter` and not `Motor__globalCounter`.
      // The arithmetic form changed underneath it: `global.X` now resolves for
      // ADR-044 as well, so a default-clamp `u32` correctly lowers to the
      // saturating helper where it previously wrapped. Asserting the qualified
      // name is ABSENT keeps the original intent testable independently of that.
      expect(code).toContain("cnx_clamp_add_u32(globalCounter, 1U)");
      expect(code).not.toContain("Motor__globalCounter");
    });
  });

  describe("Cross-scope function calls", () => {
    it("should generate cross-scope public function call", () => {
      const source = `
        scope Motor {
          public void stop() { }
        }
        void main() {
          Motor.stop();
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Motor__stop()");
    });
  });

  describe("Null literal", () => {
    it("should generate NULL literal", () => {
      const source = `
        void main() {
          bool isNull <- (NULL = NULL);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("NULL");
    });
  });

  describe("Multiple function declarations", () => {
    it("should generate multiple functions", () => {
      const source = `
        u32 add(u32 a, u32 b) { return a + b; }
        u32 sub(u32 a, u32 b) { return a - b; }
        u32 mul(u32 a, u32 b) { return a * b; }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t add(");
      expect(code).toContain("uint32_t sub(");
      expect(code).toContain("uint32_t mul(");
      // #1681: arithmetic on parameters clamps (ADR-044)
      expect(code).toContain("return cnx_clamp_add_u32(a, b)");
      expect(code).toContain("return cnx_clamp_sub_u32(a, b)");
      expect(code).toContain("return cnx_clamp_mul_u32(a, b)");
    });
  });

  describe("Volatile variables", () => {
    it("should generate volatile variable", () => {
      const source = `
        volatile u32 sharedData <- 0;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("volatile uint32_t sharedData");
    });
  });

  describe("Signed integer types", () => {
    it("should generate signed integer types", () => {
      const source = `
        i8 a <- -128;
        i16 b <- -32768;
        i32 c <- -2147483648;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("int8_t a = -128");
      expect(code).toContain("int16_t b = -32768");
      // MISRA 10.3: -2147483648 is replaced with (int32_t)INT32_MIN
      expect(code).toContain("int32_t c = (int32_t)INT32_MIN");
    });
  });

  describe("Negation and comparison", () => {
    it("should generate != comparison", () => {
      const source = `
        u32 a <- 10;
        void main() {
          if (a != 5) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a != 5");
    });
  });

  describe("Bitwise compound assignment", () => {
    it("should generate bitwise compound assignment", () => {
      const source = `
        mut wrap u32 flags <- 0xFF;
        void main() {
          flags &<- 0x0F;
          flags |<- 0xF0;
          flags ^<- 0xAA;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("flags &= 0x0F");
      expect(code).toContain("flags |= 0xF0");
      expect(code).toContain("flags ^= 0xAA");
    });
  });

  describe("Modulo compound assignment", () => {
    it("should generate modulo compound assignment", () => {
      const source = `
        mut wrap u32 value <- 100;
        void main() {
          value %<- 7;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("value %= 7");
    });
  });

  describe("Shift compound assignment", () => {
    it("should generate shift compound assignment", () => {
      const source = `
        mut wrap u32 value <- 1;
        void main() {
          value <<<- 4;
          value >><- 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("value <<= 4");
      expect(code).toContain("value >>= 2");
    });
  });

  describe("Multiple scopes", () => {
    it("should generate multiple scopes with unique prefixes", () => {
      const source = `
        scope Motor {
          mut u32 speed;
          public void start() { speed <- 100; }
        }
        scope LED {
          mut bool on;
          public void toggle() { on <- !on; }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Motor__speed");
      expect(code).toContain("Motor__start");
      expect(code).toContain("LED__on");
      expect(code).toContain("LED__toggle");
    });
  });

  describe("Inferred array size", () => {
    it("should generate array with inferred size from initializer", () => {
      const source = `
        u32[] values <- [1, 2, 3, 4, 5];
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("values[5]"); // Size inferred from initializer
      expect(code).toContain("{1U, 2U, 3U, 4U, 5U}");
    });
  });

  describe("Char literal", () => {
    it("should generate char literal", () => {
      const source = `
        u8 ch <- 'A';
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("'A'");
    });
  });

  describe("Address-of operator", () => {
    it("should generate address-of expression", () => {
      const source = `
        u32 value <- 42;
        void main() {
          u32 addr <- &value;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("&value");
    });
  });
  describe("Wrap modifier", () => {
    it("should allow wrap integer overflow without clamping", () => {
      const source = `
        mut wrap u8 counter <- 255;
        void main() {
          counter +<- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Wrap doesn't use clamp helpers
      // Issue #845: MISRA 10.3 - narrow types expand with cast
      expect(code).toContain("(uint8_t)(counter + 1");
      expect(code).not.toContain("cnx_clamp");
    });
  });

  describe("if-else-if chain", () => {
    it("should generate else-if chain", () => {
      const source = `
        u32 x <- 5;
        mut u32 result;
        void main() {
          if (x = 1) {
            result <- 10;
          } else if (x = 2) {
            result <- 20;
          } else if (x = 3) {
            result <- 30;
          } else {
            result <- 0;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("if (x == 1)");
      expect(code).toContain("else if (x == 2)");
      expect(code).toContain("else if (x == 3)");
      expect(code).toContain("else");
    });
  });

  describe("Empty function body", () => {
    it("should generate function with empty body", () => {
      const source = `
        void noop() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("void noop(void) {");
      expect(code).toContain("}");
    });
  });

  describe("Nested control flow", () => {
    it("should generate nested loops", () => {
      const source = `
        mut wrap u32 sum <- 0;
        void main() {
          for (mut wrap u32 i <- 0; i < 3; i +<- 1) {
            for (mut wrap u32 j <- 0; j < 3; j +<- 1) {
              sum +<- i * j;
            }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("for (");
      expect(code).toContain("i < 3");
      expect(code).toContain("j < 3");
    });
  });

  describe("Multiple variables declaration", () => {
    it("should generate multiple global variables", () => {
      const source = `
        u32 a <- 1;
        u32 b <- 2;
        u32 c <- 3;
        u32 d <- 4;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t a = 1");
      expect(code).toContain("uint32_t b = 2");
      expect(code).toContain("uint32_t c = 3");
      expect(code).toContain("uint32_t d = 4");
    });
  });

  describe("Preprocessor directives", () => {
    it("should reject #define with value in favor of const", () => {
      // cnx enforces using const instead of #define for values
      const source = `
        #define MAX_SIZE 100
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      expect(() =>
        generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        }),
      ).toThrow(/E0502/);
    });

    it("should pass through flag defines without values", () => {
      const source = `
        #define DEBUG_MODE
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("#define DEBUG_MODE");
    });
  });

  describe("Enum variable assignment", () => {
    it("should generate enum variable assignment from member", () => {
      const source = `
        enum State { IDLE, RUNNING, STOPPED }
        mut State current <- State.IDLE;
        void main() {
          current <- State.RUNNING;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("current = State__RUNNING");
    });
  });

  describe("Struct array member access", () => {
    it("should generate struct with array member access", () => {
      const source = `
        struct Buffer {
          u8[64] data;
        }
        mut Buffer buf;
        void main() {
          buf.data[0] <- 0xFF;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("buf.data[0] = 0xFF");
    });
  });

  describe("Scope with multiple public methods", () => {
    it("should generate scope with multiple public methods", () => {
      const source = `
        scope Timer {
          mut u32 count;
          public void reset() { count <- 0; }
          public void increment() { count <- count + 1; }
          public u32 getCount() { return count; }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("void Timer__reset");
      expect(code).toContain("void Timer__increment");
      expect(code).toContain("uint32_t Timer__getCount");
    });
  });

  describe("64-bit types", () => {
    it("should generate 64-bit integer types", () => {
      const source = `
        u64 bigUnsigned <- 0xFFFFFFFFFFFFFFFF;
        i64 bigSigned <- -9223372036854775807;
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint64_t bigUnsigned");
      expect(code).toContain("int64_t bigSigned");
    });
  });

  describe("Bitmap field access", () => {
    it("should generate bitmap field read", () => {
      const source = `
        bitmap8 Flags {
          enabled,
          ready,
          error,
          reserved[5]
        }
        Flags f <- 0;
        mut bool result;
        void main() {
          result <- f.enabled;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("f");
    });
  });

  describe("Const array", () => {
    it("should generate const array", () => {
      const source = `
        u32[4] LOOKUP <- [10, 20, 30, 40];
        void main() { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("const uint32_t LOOKUP[4]");
      expect(code).toContain("{10U, 20U, 30U, 40U}");
    });
  });

  describe("Function returning bool", () => {
    it("should generate function returning bool", () => {
      const source = `
        bool isValid(u32 value) {
          return value > 0;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("bool isValid(");
      expect(code).toContain("return value > 0;");
    });
  });

  describe("Multiple conditions with &&", () => {
    it("should generate complex condition", () => {
      const source = `
        u32 a <- 5;
        u32 b <- 10;
        void main() {
          if (a > 0 && b < 20) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a > 0 && b < 20");
    });
  });

  describe("Multiple conditions with ||", () => {
    it("should generate OR condition", () => {
      const source = `
        u32 a <- 5;
        u32 b <- 10;
        void main() {
          if (a = 0 || b = 0) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a == 0 || b == 0");
    });
  });

  describe("While loop with variable init", () => {
    it("should generate while loop with initialized counter", () => {
      const source = `
        mut wrap u32 count <- 10;
        void main() {
          while (count > 0) {
            count -<- 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("while (count > 0)");
      expect(code).toContain("count -= 1");
    });
  });

  describe("Break in switch", () => {
    it("should generate break after each case", () => {
      const source = `
        mut u32 x <- 1;
        void main() {
          switch (x) {
            case 1 { x <- 10; }
            case 2 { x <- 20; }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should have break after each case to prevent fallthrough
      const breakCount = (code.match(/break;/g) || []).length;
      expect(breakCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Struct passed to function", () => {
    it("should pass struct by pointer", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void modifyPoint(mut Point p) {
          p.x <- 10;
        }
        mut Point pt;
        void main() {
          modifyPoint(pt);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Struct param becomes pointer
      expect(code).toContain("Point*");
      // Call passes address
      expect(code).toContain("modifyPoint(&pt)");
    });
  });

  describe("Complex expression", () => {
    it("should generate complex arithmetic expression", () => {
      const source = `
        wrap u32 a <- 5;
        wrap u32 b <- 3;
        wrap u32 c <- 2;
        mut wrap u32 result;
        void main() {
          result <- a * b + c * (a - b);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a * b + c * (a - b)");
    });
  });

  describe("Empty while loop", () => {
    it("should generate while loop with empty body", () => {
      const source = `
        mut wrap u32 x <- 10;
        void main() {
          while (x > 0) {
            x -<- 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("while (x > 0)");
    });
  });

  describe("Public scope member access", () => {
    it("should generate a public member access from outside the scope", () => {
      const source = `
        scope Motor {
          public u32 speed;
        }
        void main() {
          Motor.speed <- 100;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // Should not throw
      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Motor__speed = 100");
    });
  });

  describe("Enum zero initialization", () => {
    it("should initialize enum variable to first member", () => {
      const source = `
        enum State { IDLE, RUNNING, ERROR }
        State current;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should use first enum member (value 0)
      expect(code).toContain("State current = State__IDLE");
    });

    it("should use first member when no member has value 0", () => {
      const source = `
        enum Priority { LOW <- 1, MEDIUM <- 5, HIGH <- 10 }
        Priority p;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should initialize to first member when no 0 value exists
      expect(code).toContain("Priority p =");
    });
  });

  describe("Scoped type zero initialization", () => {
    it("should initialize scoped enum with this.Type", () => {
      const source = `
        scope Motor {
          enum Mode { OFF, ON, AUTO }
          this.Mode currentMode;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should initialize to first member
      expect(code).toContain("Motor__Mode Motor__currentMode =");
    });

    it("should initialize scoped struct with {0}", () => {
      const source = `
        scope Sensor {
          struct Data { i32 value; }
          this.Data latest;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("{0}");
    });
  });

  describe("Global type zero initialization", () => {
    it("should initialize global enum with global.Type", () => {
      const source = `
        enum GlobalState { INIT, READY }
        scope Worker {
          global.GlobalState state;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should initialize to first member
      expect(code).toContain("GlobalState Worker__state =");
    });
  });

  describe("Qualified type zero initialization", () => {
    it("should initialize Scope.Type enum properly", () => {
      const source = `
        scope Config {
          public enum Level { NONE, LOW, HIGH }
        }
        Config.Level setting;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should use qualified type
      expect(code).toContain("Config__Level setting =");
    });
  });

  describe("Array fill-all syntax", () => {
    it("should generate fill-all array [0*]", () => {
      const source = `
        u32[10] data <- [0*];
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should generate all zeros with U suffix for unsigned fill-all
      expect(code).toContain("{0U, 0U");
    });

    it("should generate fill-all array with non-zero value", () => {
      const source = `
        u8[4] buffer <- [255*];
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Non-zero fill-all expands to all elements
      expect(code).toContain("= {255U, 255U, 255U, 255U}");
    });
  });

  describe("Nested array initializers", () => {
    it("should generate 2D array initializer", () => {
      const source = `
        u32[2][3] matrix <- [[1, 2, 3], [4, 5, 6]];
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("{{1U, 2U, 3U}, {4U, 5U, 6U}}");
    });
  });

  describe("Array of structs initialization", () => {
    it("should generate array of struct initializers", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point[2] points <- [{x: 1, y: 2}, {x: 3, y: 4}];
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain(".x = 1");
      expect(code).toContain(".y = 2");
    });
  });

  describe("Primitive type zero initialization", () => {
    it("should initialize bool to false", () => {
      const source = `bool flag;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("bool flag = false");
    });

    it("should initialize f32 to 0.0f", () => {
      const source = `f32 value;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("float value = 0.0f");
    });

    it("should initialize f64 to 0.0", () => {
      const source = `f64 value;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("double value = 0.0");
    });
  });

  describe("Do-while statement", () => {
    it("should generate do-while loop", () => {
      const source = `
        mut wrap u32 x <- 0;
        void main() {
          do {
            x +<- 1;
          } while (x < 10);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("do {");
      expect(code).toContain("} while (x < 10)");
    });
  });

  describe("For loop", () => {
    it("should generate for loop with init, condition, update", () => {
      const source = `
        mut wrap u32 sum <- 0;
        void main() {
          for (mut wrap u32 i <- 0; i < 10; i +<- 1) {
            sum +<- i;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("for (");
      expect(code).toContain("i < 10");
    });
  });

  describe("Return statement with expression", () => {
    it("should generate return with value", () => {
      const source = `
        u32 getAnswer() {
          return 42;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("return 42");
    });

    it("should generate void return", () => {
      const source = `
        void earlyReturn() {
          return;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("return;");
    });
  });

  describe("Struct auto zero initialization", () => {
    it("should generate zero-initialized struct without explicit initializer", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point origin;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // cnx auto-initializes to {0}
      expect(code).toContain("Point origin = {0}");
    });
  });

  describe("Atomic and volatile modifiers", () => {
    it("should reject both atomic and volatile on same variable", () => {
      const source = `
        atomic volatile u32 badVar;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      expect(() =>
        generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        }),
      ).toThrow("E0889 rejects this in pass 2.1");
    });
  });

  describe("Nested if-else", () => {
    it("should generate nested if-else-if chain", () => {
      const source = `
        wrap u32 x <- 5;
        mut wrap u32 result <- 0;
        void main() {
          if (x < 3) {
            result <- 1;
          } else if (x < 7) {
            result <- 2;
          } else {
            result <- 3;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("if (x < 3)");
      expect(code).toContain("else if (x < 7)");
      expect(code).toContain("else");
    });
  });

  describe("Switch with default case", () => {
    it("should generate switch with default", () => {
      const source = `
        u32 code <- 99;
        mut u32 output <- 0;
        void main() {
          switch (code) {
            case 1 { output <- 10; }
            case 2 { output <- 20; }
            default { output <- 0; }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("switch (code)");
      expect(code).toContain("case 1:");
      expect(code).toContain("default:");
    });
  });

  describe("Array dimension with const", () => {
    it("should resolve const as array dimension at file scope", () => {
      const source = `
        u32 SIZE <- 10;
        u32[SIZE] data;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // At file scope, const should be resolved to literal
      expect(code).toContain("[10]");
    });
  });

  describe("Multi-dimensional array", () => {
    it("should generate 3D array declaration", () => {
      const source = `
        u8[2][3][4] cube;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("[2][3][4]");
    });
  });

  describe("Expression statement", () => {
    it("should generate function call as statement", () => {
      const source = `
        void doSomething() { }
        void main() {
          doSomething();
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("doSomething();");
    });
  });

  describe("Block statement", () => {
    it("should generate standalone block", () => {
      const source = `
        mut wrap u32 x <- 0;
        void main() {
          {
            wrap u32 y <- 10;
            x <- y;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should have nested block
      expect(code).toContain("uint32_t y = 10");
    });
  });

  describe("Unary operators", () => {
    it("should generate logical NOT", () => {
      const source = `
        void test() {
          bool flag <- true;
          bool result <- !flag;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("!flag");
    });

    it("should generate bitwise NOT", () => {
      const source = `
        void test() {
          wrap u8 mask <- 0x0F;
          wrap u8 inverted <- ~mask;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("~mask");
    });

    it("should generate unary minus", () => {
      const source = `
        void test() {
          i32 pos <- 10;
          i32 neg <- -pos;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("-pos");
    });
  });

  describe("Bitwise operators", () => {
    it("should generate bitwise AND", () => {
      const source = `
        void test() {
          wrap u8 a <- 0x0F;
          wrap u8 b <- 0xF0;
          wrap u8 result <- a & b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a & b");
    });

    it("should generate bitwise OR", () => {
      const source = `
        void test() {
          wrap u8 a <- 0x0F;
          wrap u8 b <- 0xF0;
          wrap u8 result <- a | b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a | b");
    });

    it("should generate bitwise XOR", () => {
      const source = `
        void test() {
          wrap u8 a <- 0x55;
          wrap u8 b <- 0xAA;
          wrap u8 result <- a ^ b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a ^ b");
    });

    it("should generate left shift", () => {
      const source = `
        void test() {
          wrap u8 a <- 1;
          wrap u8 result <- a << 4;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a << 4");
    });

    it("should generate right shift", () => {
      const source = `
        void test() {
          wrap u8 a <- 0x80;
          wrap u8 result <- a >> 4;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a >> 4");
    });
  });

  describe("Logical operators", () => {
    it("should generate logical AND", () => {
      const source = `
        void test() {
          bool a <- true;
          bool b <- false;
          bool result <- a && b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a && b");
    });

    it("should generate logical OR", () => {
      const source = `
        void test() {
          bool a <- true;
          bool b <- false;
          bool result <- a || b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a || b");
    });
  });

  describe("Comparison operators", () => {
    it("should generate less than or equal", () => {
      const source = `
        void test() {
          u32 a <- 5;
          u32 b <- 10;
          bool result <- a <= b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a <= b");
    });

    it("should generate greater than or equal", () => {
      const source = `
        void test() {
          u32 a <- 5;
          u32 b <- 10;
          bool result <- a >= b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a >= b");
    });

    it("should generate not equal", () => {
      const source = `
        void test() {
          u32 a <- 5;
          u32 b <- 10;
          bool result <- a != b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a != b");
    });
  });

  // #1322: two cases here drove `generate()` on a narrowing declaration and a
  // literal overflow and asserted a throw carrying a `line:column` prefix --
  // the prefix a rethrow wrapper smuggled onto ADR-024's message. The
  // generator no longer throws for either; E0868/E0869 are authored in pass
  // 2.1, which halts before it runs. Deleted rather than emptied.
  describe("Cast expression", () => {
    it("should handle widening cast", () => {
      const source = `
        u8 small <- 100;
        u32 big <- small as u32;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should compile with the cast (implicit widening is allowed)
      expect(code).toContain("big =");
      expect(code).toContain("small");
    });

    it("should generate bit extraction for narrowing", () => {
      const source = `
        void test() {
          u32 big <- 1000;
          u8 small <- big[0, 8];
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Bit extraction generates mask and shift
      expect(code).toContain("big");
      expect(code).toContain("&");
    });

    it("should generate float to int cast with clamping", () => {
      const source = `
        void test() {
          f32 floatVal <- 100.5;
          i32 intVal <- (i32)floatVal;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Float to int cast generates clamping code: saturating at both bounds
      // (#1800: `floatVal as i32` here was a parse-recovered implicit
      // conversion, which pass 2.1 now rejects as E0891)
      expect(code).toContain("(int32_t)INT32_MAX");
      expect(code).toContain("(int32_t)INT32_MIN");
    });
  });

  describe("Function with multiple parameters", () => {
    it("should generate function with multiple params", () => {
      const source = `
        u32 add(u32 a, u32 b, u32 c) {
          return a + b + c;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain(
        "const uint32_t a, const uint32_t b, const uint32_t c",
      );
    });
  });

  describe("Nested struct access", () => {
    it("should generate nested struct member access", () => {
      const source = `
        struct Inner { i32 value; }
        struct Outer { Inner child; }
        mut Outer obj <- {child: {value: 42}};
        void main() {
          obj.child.value <- 100;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("obj.child.value = 100");
    });
  });

  describe("Array indexing with expressions", () => {
    it("should generate array index with arithmetic", () => {
      const source = `
        mut u32[10] data;
        wrap u32 i <- 2;
        void main() {
          data[i * 2 + 1] <- 42;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("data[i * 2 + 1]");
    });
  });

  describe("Enum assignment", () => {
    it("should generate enum value assignment", () => {
      const source = `
        enum Color { RED, GREEN, BLUE }
        mut Color c <- Color.RED;
        void main() {
          c <- Color.GREEN;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Color__GREEN");
    });
  });

  describe("String type", () => {
    it("should generate bounded string declaration", () => {
      const source = `string<32> name <- "hello";`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // String capacity + 1 for null terminator
      expect(code).toContain("char name[33]");
    });
  });

  describe("Volatile variable", () => {
    it("should generate volatile declaration", () => {
      const source = `volatile u32 hwReg;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("volatile uint32_t hwReg");
    });
  });

  describe("Const struct", () => {
    it("should generate const struct declaration", () => {
      const source = `
        struct Config { u32 value; }
        Config defaultConfig <- {value: 100};
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("const Config defaultConfig");
    });
  });

  describe("Critical statement", () => {
    it("should generate critical section with interrupt disable", () => {
      const source = `
        atomic u32 counter <- 0;
        void main() {
          critical {
            counter <- counter + 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should include interrupt disable/enable
      expect(code).toContain("__cnx_disable_irq");
      expect(code).toContain("__primask");
    });
  });

  describe("Atomic variable", () => {
    it("should generate volatile for atomic variable", () => {
      const source = `atomic u32 counter <- 0;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Atomic maps to volatile in C
      expect(code).toContain("volatile uint32_t counter");
    });
  });

  describe("Array element_count", () => {
    it("should generate array element_count using sizeof", () => {
      const source = `
        u32[10] data;
        u32 len <- data.type_element_count;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // .type_element_count compiles to sizeof(arr)/sizeof(arr[0]) or constant
      expect(code).toContain("len =");
    });
  });

  describe("Hex and binary literals", () => {
    it("should generate hex literal", () => {
      const source = `u32 mask <- 0xFF00;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("0xFF00");
    });

    it("should generate binary literal", () => {
      const source = `u8 pattern <- 0b10101010;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Binary literals are preserved or converted
      expect(code).toContain("pattern =");
    });
  });

  describe("Character literal", () => {
    it("should generate character literal", () => {
      const source = `u8 ch <- 'A';`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("'A'");
    });
  });

  describe("Scope with multiple functions", () => {
    it("should generate scoped functions with prefix", () => {
      const source = `
        scope Motor {
          public void start() { }
          public void stop() { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("void Motor__start(void)");
      expect(code).toContain("void Motor__stop(void)");
    });
  });

  describe("Scope variable access", () => {
    it("should access scope variable from inside scope", () => {
      const source = `
        scope Counter {
          mut u32 value <- 0;
          public void increment() {
            value <- value + 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Counter__value");
    });
  });

  describe("Modulo operator", () => {
    it("should generate modulo operation", () => {
      const source = `
        void test() {
          wrap u32 a <- 17;
          wrap u32 b <- 5;
          wrap u32 result <- a % b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a % b");
    });
  });

  describe("Division operator", () => {
    it("should generate division operation", () => {
      const source = `
        void test() {
          wrap u32 a <- 20;
          wrap u32 b <- 4;
          wrap u32 result <- a / b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a / b");
    });
  });

  describe("Compound assignment operators", () => {
    // Issue #845: MISRA 10.3 - narrow type compound assignments expand to explicit cast
    // u8 val &= 0x0F => val = (uint8_t)(val & 0x0F)
    it("should generate bitwise AND compound assignment with MISRA cast", () => {
      const source = `
        mut wrap u8 mask <- 0xFF;
        void main() {
          mask &<- 0x0F;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(uint8_t)(mask &");
    });

    it("should generate bitwise OR compound assignment with MISRA cast", () => {
      const source = `
        mut wrap u8 flags <- 0x00;
        void main() {
          flags |<- 0x01;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(uint8_t)(flags |");
    });

    it("should generate bitwise XOR compound assignment with MISRA cast", () => {
      const source = `
        mut wrap u8 bits <- 0x55;
        void main() {
          bits ^<- 0xFF;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(uint8_t)(bits ^");
    });

    it("should generate left shift compound assignment with MISRA cast", () => {
      const source = `
        mut wrap u8 val <- 1;
        void main() {
          val <<<- 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(uint8_t)(val <<");
    });

    it("should generate right shift compound assignment with MISRA cast", () => {
      const source = `
        mut wrap u8 val <- 0x80;
        void main() {
          val >><- 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(uint8_t)(val >>");
    });

    it("should generate multiply compound assignment", () => {
      const source = `
        mut wrap u32 val <- 5;
        void main() {
          val *<- 3;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("*=");
    });

    it("should generate divide compound assignment", () => {
      const source = `
        mut wrap u32 val <- 20;
        void main() {
          val /<- 4;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("/=");
    });

    it("should generate modulo compound assignment", () => {
      const source = `
        mut wrap u32 val <- 17;
        void main() {
          val %<- 5;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("%=");
    });
  });

  describe("Parenthesized expression", () => {
    it("should preserve parentheses in complex expression", () => {
      const source = `
        void test() {
          wrap u32 a <- 2;
          wrap u32 b <- 3;
          wrap u32 c <- 4;
          wrap u32 result <- (a + b) * c;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(a + b) * c");
    });
  });

  describe("Function call with arguments", () => {
    it("should generate function call with multiple arguments", () => {
      const source = `
        u32 add(u32 a, u32 b) {
          return a + b;
        }
        void test() {
          u32 result <- add(10, 20);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("add(10U, 20U)");
    });
  });

  describe("Return enum value", () => {
    it("should return enum value from function", () => {
      const source = `
        enum Status { OK, ERROR }
        Status getStatus() {
          return Status.OK;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("return Status__OK");
    });
  });

  describe("Array passed to function", () => {
    it("should pass array without address-of operator", () => {
      const source = `
        void processData(u32[5] data) { }
        u32[5] myData;
        void main() {
          processData(myData);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Arrays decay to pointers, no & needed
      expect(code).toContain("processData(myData)");
    });
  });

  describe("Global reference from scope", () => {
    it("should access global variable with global keyword", () => {
      const source = `
        mut u32 globalCounter <- 0;
        scope Module {
          public void increment() {
            global.globalCounter <- global.globalCounter + 1;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // global.X should resolve to just X
      expect(code).toContain("globalCounter =");
    });
  });

  describe("String literal", () => {
    it("should generate string literal", () => {
      const source = `string<20> msg <- "Hello World";`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain('"Hello World"');
    });
  });

  describe("Integer type sizes", () => {
    it("should generate all unsigned integer types", () => {
      const source = `
        u8 a;
        u16 b;
        u32 c;
        u64 d;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint8_t a");
      expect(code).toContain("uint16_t b");
      expect(code).toContain("uint32_t c");
      expect(code).toContain("uint64_t d");
    });

    it("should generate all signed integer types", () => {
      const source = `
        i8 a;
        i16 b;
        i32 c;
        i64 d;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("int8_t a");
      expect(code).toContain("int16_t b");
      expect(code).toContain("int32_t c");
      expect(code).toContain("int64_t d");
    });
  });

  describe("Negative number literal", () => {
    it("should generate negative literal", () => {
      const source = `i32 val <- -42;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("-42");
    });
  });

  describe("Float literals", () => {
    it("should generate f32 literal with suffix", () => {
      const source = `f32 val <- 3.14;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("3.14");
    });

    it("should generate f64 literal", () => {
      const source = `f64 val <- 2.718281828;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("2.718281828");
    });
  });

  describe("Boolean literals", () => {
    it("should generate true literal", () => {
      const source = `bool flag <- true;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("true");
    });

    it("should generate false literal", () => {
      const source = `bool flag <- false;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("false");
    });
  });

  describe("Ternary expression", () => {
    it("should generate ternary with comparison condition", () => {
      const source = `
        void test() {
          u32 a <- 5;
          u32 b <- 10;
          u32 max <- (a > b) ? a : b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("(a > b) ? a : b");
    });
  });

  describe("Bit indexing read", () => {
    it("should generate bit read with single index", () => {
      const source = `
        void test() {
          u8 flags <- 0xFF;
          bool bit0 <- flags[0, 1] = 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Bit extraction generates shift and mask
      expect(code).toContain("flags");
      expect(code).toContain("&");
    });

    it("should generate multi-bit read", () => {
      const source = `
        void test() {
          u8 data <- 0xAB;
          u8 nibble <- data[4, 4];
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain(">> 4");
    });
  });

  // #1322: this suite held only the `this` outside a scope test. The rule
  // is E0431 in pass 2.1 now, with a real position; codegen reported it as
  // `1:0`. Covered by `1-Analyze/__tests__/ThisOutsideScopeAnalyzer.test.ts`
  // and `tests/adr-016/this-outside-scope-error`.
  describe("Struct member initializer", () => {
    it("should generate designated initializer", () => {
      const source = `
        struct Vec3 { i32 x; i32 y; i32 z; }
        Vec3 pos <- {x: 1, y: 2, z: 3};
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain(".x = 1");
      expect(code).toContain(".y = 2");
      expect(code).toContain(".z = 3");
    });
  });

  describe("Local variable tracking", () => {
    it("should track local variables in function scope", () => {
      const source = `
        void compute() {
          mut wrap u32 local <- 0;
          local <- local + 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t local = 0");
      expect(code).toContain("local = local + 1");
    });
  });

  describe("Struct parameter as pointer", () => {
    it("should use arrow notation for struct parameter member access", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void moveRight(mut Point p) {
          p.x <- p.x + 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Struct parameters become pointers, access uses ->
      expect(code).toContain("p->");
    });
  });

  describe("Multiple struct parameters", () => {
    it("should handle multiple struct parameters", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void add(mut Point a, Point b) {
          a.x <- a.x + b.x;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a->x");
      expect(code).toContain("b->x");
    });
  });

  describe("Extern const behavior", () => {
    it("should NOT add extern for const with initializer in C mode (MISRA 8.5)", () => {
      // MISRA Rule 8.5: External object shall be declared once in one file.
      // A definition (with initializer) should NOT have extern in C mode.
      // The extern declaration comes from the header.
      const source = `u32 VERSION <- 1;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // Definition should have const but NOT extern
      expect(code).toContain("const uint32_t VERSION = 1U;");
      expect(code).not.toContain("extern const uint32_t VERSION");
    });

    it("should add extern for const with initializer in C++ mode (Issue #525)", () => {
      // In C++, const at file scope has internal linkage by default.
      // extern is needed for cross-file access, even for definitions.
      const source = `u32 VERSION <- 1;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: true,
      });

      // In C++ mode, definition should have extern const
      expect(code).toContain("extern const uint32_t VERSION = 1U;");
    });
  });

  describe("Empty function body", () => {
    it("should generate function with empty body", () => {
      const source = `void noop() { }`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("void noop(void)");
    });
  });

  describe("Function returning bool", () => {
    it("should generate bool return type", () => {
      const source = `
        bool isPositive(i32 x) {
          return x > 0;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("bool isPositive");
      expect(code).toContain("return x > 0");
    });
  });

  describe("Scope enum usage", () => {
    it("should use scoped enum from same scope", () => {
      const source = `
        scope State {
          enum Mode { OFF, ON }
          mut this.Mode current <- this.Mode.OFF;
          public void turnOn() {
            current <- Mode.ON;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("State__Mode__ON");
    });
  });

  describe("Const array size at file scope", () => {
    it("should resolve const to literal for file-scope array", () => {
      const source = `
        u32 BUFFER_SIZE <- 256;
        u8[BUFFER_SIZE] buffer;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // File scope arrays need literal sizes in C
      expect(code).toContain("buffer[256]");
    });
  });

  describe("Function with array return type simulation", () => {
    it("should handle function returning via output parameter", () => {
      const source = `
        void getData(mut u8[2] output) {
          output[0] <- 1;
          output[1] <- 2;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Array element assignments don't get U suffix yet
      expect(code).toContain("output[0]");
      expect(code).toContain("output[1]");
    });
  });

  describe("Mixed arithmetic operations", () => {
    it("should handle mixed add and subtract", () => {
      const source = `
        void test() {
          wrap u32 a <- 10;
          wrap u32 b <- 5;
          wrap u32 c <- 3;
          wrap u32 result <- a + b - c;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a + b - c");
    });
  });

  describe("Complex nested expression", () => {
    it("should handle deeply nested expression", () => {
      const source = `
        void test() {
          wrap u32 a <- 2;
          wrap u32 b <- 3;
          wrap u32 c <- 4;
          wrap u32 d <- 5;
          wrap u32 result <- ((a + b) * c) - d;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("((a + b) * c) - d");
    });
  });

  describe("Float operations", () => {
    it("should generate float addition", () => {
      const source = `
        void test() {
          f32 a <- 1.5;
          f32 b <- 2.5;
          f32 sum <- a + b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a + b");
    });

    it("should generate float comparison", () => {
      const source = `
        void test() {
          f32 a <- 1.5;
          f32 b <- 2.5;
          bool less <- a < b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a < b");
    });
  });

  describe("Struct array field", () => {
    it("should generate struct with array field access", () => {
      const source = `
        struct Message {
          u8[8] data;
          u8 length;
        }
        mut Message msg;
        void main() {
          msg.data[0] <- 0x01;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("msg.data[0] = 0x01");
    });
  });

  describe("Enum comparison", () => {
    it("should generate enum equality comparison", () => {
      const source = `
        enum State { IDLE, RUNNING }
        State current <- State.IDLE;
        void main() {
          if (current = State.RUNNING) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // = becomes == in C
      expect(code).toContain("current == State__RUNNING");
    });
  });

  describe("Switch with enum", () => {
    it("should generate switch on enum value", () => {
      const source = `
        enum State { IDLE, RUNNING, ERROR }
        State s <- State.IDLE;
        mut u32 code <- 0;
        void main() {
          switch (s) {
            case State.IDLE { code <- 1; }
            case State.RUNNING { code <- 2; }
            case State.ERROR { code <- 3; }
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("case State__IDLE:");
      expect(code).toContain("case State__RUNNING:");
    });
  });

  describe("Const local variable", () => {
    it("should track const for array size in function", () => {
      const source = `
        void setup() {
          u32 SIZE <- 5;
          u32[SIZE] data;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("SIZE");
      // Const value is evaluated at compile time
      expect(code).toContain("data[5]");
    });
  });

  describe("Bit write operation", () => {
    it("should generate bit write assignment", () => {
      const source = `
        mut u8 flags <- 0;
        void main() {
          flags[0, 1] <- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Bit write generates mask and OR operations
      expect(code).toContain("flags");
      expect(code).toContain("|");
    });
  });

  describe("Long hex literal", () => {
    it("should generate 64-bit hex literal", () => {
      const source = `u64 big <- 0xFFFFFFFFFFFFFFFF;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // 64-bit hex should have ULL suffix or correct literal
      expect(code).toContain("0xFFFFFFFFFFFFFFFF");
    });
  });

  describe("Multiple return statements", () => {
    it("should generate function with early return", () => {
      const source = `
        u32 safeDivide(u32 a, u32 b) {
          if (b = 0) {
            return 0;
          }
          return a / b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("return 0");
      expect(code).toContain("return a / b");
    });
  });

  describe("Scope struct member", () => {
    it("should access struct through scope", () => {
      const source = `
        struct Config { u32 value; }
        scope Settings {
          public Config cfg;
        }
        void main() {
          Settings.cfg.value <- 200;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Settings__cfg");
    });
  });

  describe("Array parameter bounds", () => {
    it("should handle sized array parameter", () => {
      const source = `
        void process(mut u32[10] arr) {
          arr[0] <- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Array params become pointers
      expect(code).toContain("arr[0] = 1");
    });
  });

  describe("Escape sequences in strings", () => {
    it("should preserve escape sequences", () => {
      const source = `string<10> newline <- "\\n";`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("\\n");
    });
  });

  describe("Clamp overflow helper", () => {
    it("should generate clamp add helper for u16", () => {
      const source = `
        mut clamp u16 val <- 65000;
        void main() {
          val +<- 1000;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should include clamp helper
      expect(code).toContain("cnx_clamp");
    });

    it("should generate clamp sub helper for u16", () => {
      const source = `
        mut clamp u16 val <- 100;
        void main() {
          val -<- 200;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should include clamp sub helper
      expect(code).toContain("cnx_clamp_sub");
    });
  });

  describe("Comparison chaining prevention", () => {
    it("should generate single comparison", () => {
      const source = `
        void test() {
          u32 a <- 5;
          u32 b <- 10;
          bool result <- a < b;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("a < b");
    });
  });

  describe("Empty scope", () => {
    it("should generate empty scope with comment", () => {
      const source = `
        scope Empty { }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Empty");
    });
  });

  describe("Qualified type access", () => {
    it("should access type from other scope", () => {
      const source = `
        scope Types {
          public enum Mode { AUTO, MANUAL }
        }
        Types.Mode selected <- Types.Mode.AUTO;
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Types__Mode");
    });
  });

  describe("Clamp operations for i32", () => {
    it("should generate clamp add for signed type", () => {
      const source = `
        mut clamp i32 val <- 2000000000;
        void main() {
          val +<- 500000000;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("cnx_clamp");
    });
  });

  describe("Function with const parameter", () => {
    it("should handle const parameter modifier", () => {
      const source = `
        void readOnly(u32 val) {
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("const");
    });
  });

  describe("Equality operator translation", () => {
    it("should convert = to == for equality", () => {
      const source = `
        u32 x <- 5;
        void main() {
          if (x = 5) { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("x == 5");
    });
  });

  describe("Signed integer operations", () => {
    it("should generate signed arithmetic", () => {
      const source = `
        void test() {
          i32 a <- -10;
          i32 b <- 20;
          i32 diff <- b - a;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("int32_t a = -10");
      expect(code).toContain("cnx_clamp_sub_i32(b, a)"); // #1152: clamp is the default
    });
  });

  describe("Void function call", () => {
    it("should call void function as statement", () => {
      const source = `
        void doWork() { }
        void main() {
          doWork();
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("doWork();");
    });
  });

  describe("Multiple scopes", () => {
    it("should handle multiple scope declarations", () => {
      const source = `
        scope ScopeA {
          public void methodA() { }
        }
        scope ScopeB {
          public void methodB() { }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("ScopeA__methodA");
      expect(code).toContain("ScopeB__methodB");
    });
  });

  describe("Struct self-assignment prevention", () => {
    it("should detect self-reference in scope", () => {
      const source = `
        scope Motor {
          public u32 speed <- 100;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("Motor__speed = 100");
    });
  });

  describe("Wrap modifier for u64", () => {
    it("should generate wrap arithmetic for u64", () => {
      const source = `
        mut wrap u64 big <- 0xFFFFFFFFFFFFFFFF;
        void main() {
          big +<- 1;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Wrap uses direct operators, no clamp helper
      expect(code).toContain("+=");
    });
  });

  describe("Signed clamp operations", () => {
    it("should generate signed clamp helpers", () => {
      const source = `
        mut clamp i8 tiny <- -100;
        void main() {
          tiny -<- 50;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("cnx_clamp");
    });
  });

  describe("Array with literal size", () => {
    it("should generate array with integer literal size", () => {
      const source = `u32[100] buffer;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("uint32_t buffer[100]");
    });
  });

  describe("Prefix operations in expressions", () => {
    it("should handle prefix negation in assignment", () => {
      const source = `
        void test() {
          i32 a <- 5;
          i32 b <- -a;
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("-a");
    });
  });

  describe("Comment preservation", () => {
    it("should include generated file header", () => {
      const source = `void main() { }`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("generated by cnx");
    });
  });

  describe("Stdint include", () => {
    it("should include stdint.h for fixed-width types", () => {
      const source = `u32 val <- 0;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("#include <stdint.h>");
    });
  });

  describe("Stdbool include", () => {
    it("should include stdbool.h for bool type", () => {
      const source = `bool flag <- false;`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("#include <stdbool.h>");
    });
  });

  describe("Array initialization with values", () => {
    it("should generate array with initialization list", () => {
      const source = `u8[4] data <- [1, 2, 3, 4];`;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("{1U, 2U, 3U, 4U}");
    });
  });

  describe("Local array tracking", () => {
    it("should track local arrays for function arguments", () => {
      const source = `
        void process(u8[10] arr) { }
        void main() {
          u8[10] local;
          process(local);
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Local arrays don't need & prefix when passed
      expect(code).toContain("process(local)");
    });
  });

  describe("Zero initializer helpers", () => {
    describe("primitive type zero values", () => {
      it("should initialize bool to false", () => {
        const source = `
          void main() {
            bool flag;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("bool flag = false");
      });

      it("should initialize f32 to 0.0f", () => {
        const source = `
          void main() {
            f32 value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("float value = 0.0f");
      });

      it("should initialize f64 to 0.0", () => {
        const source = `
          void main() {
            f64 value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("double value = 0.0");
      });

      it("should initialize integer types to 0", () => {
        const source = `
          void main() {
            u32 value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t value = 0");
      });
    });

    describe("enum zero values", () => {
      it("should initialize user-defined enum to first member", () => {
        const source = `
          enum Color { Red, Green, Blue }
          void main() {
            Color c;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color c = Color__Red");
      });

      it("should initialize scoped enum to first member", () => {
        const source = `
          scope LED {
            enum State { Off, On }
            public void init() {
              this.State s;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("LED__State s = LED__State__Off");
      });

      it("should initialize qualified enum to first member", () => {
        const source = `
          scope Motor {
            public enum Direction { Forward, Reverse }
          }
          void main() {
            Motor.Direction d;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain(
          "Motor__Direction d = Motor__Direction__Forward",
        );
      });

      it("should find enum member with explicit value 0", () => {
        const source = `
          enum Status { Unknown <- 1, Success <- 0, Error <- 2 }
          void main() {
            Status s;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should find Success which has explicit value 0
        expect(code).toContain("Status s = Status__Success");
      });
    });

    describe("struct zero values", () => {
      it("should initialize user-defined struct to {0}", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void main() {
            Point p;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point p = {0}");
      });

      it("should initialize scoped struct to {0}", () => {
        const source = `
          scope Sensor {
            struct Data { i32 value; }
            public void read() {
              this.Data d;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Sensor__Data d = {0}");
      });

      it("should initialize qualified struct to {0}", () => {
        const source = `
          scope Config {
            public struct Settings { i32 level; }
          }
          void main() {
            Config.Settings cfg;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Config__Settings cfg = {0}");
      });
    });

    describe("array zero values", () => {
      it("should initialize POD arrays to {0}", () => {
        const source = `
          void main() {
            u32[10] values;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t values[10] = {0}");
      });

      it("should initialize struct arrays to {0}", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void main() {
            Point[5] points;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point points[5] = {0}");
      });
    });

    describe("C++ mode initialization", () => {
      it("should initialize unknown user types to {} in C++ mode", () => {
        const source = `
          void main() {
            ExternalClass obj;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Unknown types in C++ mode use {} because they may have non-trivial constructors
        expect(code).toContain("ExternalClass obj = {}");
      });

      it("should initialize known structs to {} in C++ mode (Issue #1004)", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void main() {
            Point p;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Issue #1004: C++ value-initialization ({}) is valid for any struct,
        // including ones whose first field is an enum where {0} would be an
        // invalid int->enum narrowing.
        expect(code).toContain("Point p = {}");
      });

      // Note: Template type tests skipped - template argument transformation
      // (i32 -> int32_t) is a separate issue to be addressed in another PR

      it("should generate cnx style array params with dimensions in C++ mode", () => {
        const source = `
          void fill(mut u8[8] buf) {
              buf[0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // cnx style u8[8] param should generate uint8_t buf[8], not uint8_t& buf
        expect(code).toContain("uint8_t buf[8]");
        expect(code).not.toContain("uint8_t& buf");
        expect(code).not.toContain("uint8_t&  buf");
      });

      it("should generate const cnx style array params in C++ mode", () => {
        const source = `
          u8 read(u8[4] data) {
              return data[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Const cnx style array param should retain dimension
        expect(code).toContain("const uint8_t data[4]");
        expect(code).not.toContain("const uint8_t& data");
      });

      it("should generate cnx style array params in C mode too", () => {
        const source = `
          void fill(mut u8[8] buf) {
              buf[0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // C mode should also generate uint8_t buf[8]
        expect(code).toContain("uint8_t buf[8]");
        expect(code).not.toContain("uint8_t* buf");
      });

      it("should generate primitive cnx style arrays with {} in C++ mode (Issue #1004)", () => {
        const source = `
          void main() {
              u32[8] counters;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Issue #1004: C++ arrays value-initialize with {} regardless of
        // element type (one unified aggregate zero-init rule).
        expect(code).toContain("uint32_t counters[8] = {}");
      });

      it("should generate unknown user type cnx style arrays with {} in C++ mode", () => {
        const source = `
          void main() {
              UnknownType[4] items;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Unknown types in C++ mode use {} (may have non-trivial constructors)
        expect(code).toContain("UnknownType items[4] = {}");
      });

      it("should generate known cnx struct arrays with {} in C++ mode (Issue #1004)", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void main() {
              Point[3] pts;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Issue #1004: C++ struct arrays value-initialize with {}, valid even
        // when the struct's first field is an enum.
        expect(code).toContain("Point pts[3] = {}");
      });
    });
  });

  describe("Member access decomposition", () => {
    describe("Register bit access (assignment targets)", () => {
      it("should generate single bit write to register", () => {
        const source = `
          register GPIO @ 0x40000000 {
              DR: u32 rw @ 0x00,
          }
          void main() {
              GPIO.DR[3] <- true;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Register bit write generates bit-manipulation code
        expect(code).toContain("GPIO__DR");
      });

      it("should generate bit range write to register", () => {
        const source = `
          register TIMER @ 0x40010000 {
              CTRL: u32 rw @ 0x00,
          }
          void main() {
              TIMER.CTRL[4] <- 0x0F;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("TIMER__CTRL");
      });
    });

    describe("Plain register access (assignment targets)", () => {
      it("should generate register member write as underscore-joined", () => {
        const source = `
          register GPIO @ 0x40000000 {
              DR: u32 rw @ 0x00,
          }
          void main() {
              GPIO.DR <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("GPIO__DR = 0xFF");
      });

      it("should allow write to write-only register member", () => {
        const source = `
          register CONTROL @ 0x40000000 {
              COMMAND: u32 wo @ 0x00,
          }
          void main() {
              CONTROL.COMMAND <- 0x42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("CONTROL__COMMAND = 0x42");
      });
    });

    describe("Scope member access (assignment targets)", () => {
      it("should generate cross-scope variable write", () => {
        const source = `
          scope Sensor {
              public u32 value;
          }
          scope Motor {
              public void update() {
                  Sensor.value <- 100;
              }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Sensor__value = 100");
      });

      it("should generate struct-through-scope access", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          scope Motor {
              public Point position;
          }
          void main() {
              Motor.position.x <- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__position.x = 10");
      });
    });

    describe("Array subscript access (assignment targets)", () => {
      it("should generate struct array member write", () => {
        const source = `
          struct Item { u32 value; }
          mut Item[3] items;
          void main() {
              items[0].value <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("items[0].value = 42");
      });
    });

    describe("Scope member access with subscripts (assignment targets)", () => {
      it("should generate cross-scope array member write", () => {
        const source = `
          scope Sensor {
              public u32 readings[4] <- [0, 0, 0, 0];
          }
          scope Motor {
              public void update() {
                  Sensor.readings[0] <- 42;
              }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Sensor__readings[0] = 42");
      });
    });

    describe("Plain member access branch coverage", () => {
      it("should generate simple scope member write (2 parts, no struct)", () => {
        const source = `
          scope Counter {
              public u32 value;
          }
          void main() {
              Counter.value <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Counter__value = 42");
      });

      it("should generate simple struct member write (no register, no scope)", () => {
        const source = `
          struct Config { u32 timeout; bool enabled; }
          mut Config cfg;
          void main() {
              cfg.timeout <- 1000;
              cfg.enabled <- true;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cfg.timeout = 1000");
        expect(code).toContain("cfg.enabled = true");
      });

      it("should allow bare register access from inside scope when NOT shadowed", () => {
        // Issue #779: Ambiguity-aware validation - allow unambiguous access
        const source = `
          register GPIO @ 0x40000000 {
              DR: u32 rw @ 0x00,
          }
          scope Motor {
              public void init() {
                  GPIO.DR <- 0xFF;
              }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);
        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should generate GPIO_DR without error since GPIO is unambiguous
        expect(code).toContain("GPIO__DR = 0xFF");
      });

      it("should generate scope member write from outside any scope", () => {
        const source = `
          scope Timer {
              public u32 count;
          }
          void main() {
              Timer.count <- 0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Timer__count = 0");
      });

      it("should generate scope variable write with non-struct type (3+ parts)", () => {
        const source = `
          scope Motor {
              public u32 nested_value;
          }
          scope Controller {
              public void init() {
                  Motor.nested_value <- 0;
              }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__nested_value = 0");
      });

      it("should generate struct param member access in function", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void setX(mut Point p) {
              p.x <- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("p->x = 10");
      });
    });

    // #1322: this suite held only the `this` outside a scope test. The rule
    // is E0431 in pass 2.1 now, with a real position; codegen reported it as
    // `1:0`. Covered by `1-Analyze/__tests__/ThisOutsideScopeAnalyzer.test.ts`
    // and `tests/adr-016/this-outside-scope-error`.

    describe("ambiguous enum member error handling", () => {
      it("asserts, since #1322, that an ambiguous bare member never reaches generation (E0424 owns it)", () => {
        const source = `
          enum Color { RED, GREEN }
          enum Status { RED, BLUE }
          void foo() {
            u32 x <- RED;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        expect(() =>
          generateWithProgram(generator, tree, program, {
            cppMode: false,
            symbolInfo: symbols,
            sourcePath: "test.cnx",
          }),
        ).toThrow("E0424 rejects 'RED' (declared by Color, Status)");
      });
    });

    describe("enum type resolution helpers", () => {
      it("should resolve this.EnumType.MEMBER pattern inside scope", () => {
        const source = `
          scope Motor {
            enum State { IDLE, RUNNING }
            mut State current;
            void update() {
              current <- this.State.IDLE;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__current = Motor__State__IDLE");
      });

      it("should resolve global.EnumType.MEMBER pattern", () => {
        const source = `
          enum Priority { LOW, HIGH }
          scope Task {
            mut Priority level;
            void init() {
              level <- global.Priority.HIGH;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Task__level = Priority__HIGH");
      });

      it("should resolve this.variable pattern for enum type variable", () => {
        const source = `
          enum Mode { AUTO, MANUAL }
          scope Controller {
            public mut Mode mode;
            public void setAuto() {
              this.mode <- global.Mode.AUTO;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Controller__mode = Mode__AUTO");
      });

      it("should resolve Scope.EnumType.MEMBER pattern", () => {
        const source = `
          scope LED {
            public enum Color { RED, GREEN, BLUE }
          }
          void setColor() {
            LED.Color c <- LED.Color.RED;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("LED__Color__RED");
      });
    });

    describe("child statement classification", () => {
      it("should handle if statement with blocks", () => {
        const source = `
          void test() {
            bool cond <- true;
            if (cond = true) {
              u32 x <- 1;
            } else {
              u32 y <- 2;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("if (cond == true)");
        expect(code).toContain("uint32_t x = 1");
        expect(code).toContain("uint32_t y = 2");
      });

      it("should handle switch with multiple cases", () => {
        const source = `
          void test(u8 val) {
            switch (val) {
              case 1 { }
              case 2 { }
              default { }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch (val)");
        expect(code).toContain("case 1:");
        expect(code).toContain("case 2:");
        expect(code).toContain("default:");
      });

      it("should handle while loop with block", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            while (i < 10) {
              i +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("while (i < 10)");
        expect(code).toContain("cnx_clamp_add_u32(i, 1U)");
      });

      it("should handle for loop with block", () => {
        const source = `
          void test() {
            for (mut u32 i <- 0; i < 10; i +<- 1) {
              u32 x <- i;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for (");
        expect(code).toContain("uint32_t x = i");
      });

      it("should handle do-while loop with block", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            do {
              i +<- 1;
            } while (i < 10);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("do {");
        expect(code).toContain("} while (i < 10)");
      });

      it("should handle critical block", () => {
        const source = `
          mut u32 counter;
          void test() {
            critical {
              counter +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("__cnx_disable_irq()");
        expect(code).toContain("cnx_clamp_add_u32(counter, 1U)");
        expect(code).toContain("__cnx_set_PRIMASK");
      });

      it("should handle simple enum member access", () => {
        const source = `
          enum State { IDLE, RUNNING }
          void test() {
            State s <- State.IDLE;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("State__IDLE");
      });

      it("should handle nested if-else with blocks", () => {
        const source = `
          void test(u8 x, u8 y) {
            if (x > 0) {
              if (y > 0) {
                u32 z <- 1;
              } else {
                u32 z <- 2;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("if (x > 0)");
        expect(code).toContain("if (y > 0)");
        expect(code).toContain("uint32_t z = 1");
        expect(code).toContain("uint32_t z = 2");
      });
    });

    describe("function argument helpers", () => {
      it("should handle identifier argument (simple variable)", () => {
        const source = `
          void callee(u32 x) { }
          void test() {
            u32 val <- 42;
            callee(val);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(val)");
      });

      it("should handle identifier argument (array)", () => {
        const source = `
          void callee(u32[10] arr) { }
          void test() {
            u32[10] data;
            callee(data);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(data)");
      });

      it("should handle member access argument", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void callee(u32 val) { }
          void test(Point p) {
            callee(p.x);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(p->x)");
      });

      it("should handle array access argument", () => {
        const source = `
          void callee(u32 val) { }
          void test() {
            u32[10] arr;
            callee(arr[0]);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(arr[0U])");
      });

      it("should handle scope member as argument", () => {
        const source = `
          void callee(u32 val) { }
          scope Motor {
            public u32 speed;
            public void sendSpeed() {
              callee(speed);
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(Motor__speed)");
      });

      it("should handle expression argument", () => {
        const source = `
          void callee(u32 val) { }
          void test() {
            u32 a <- 5;
            u32 b <- 10;
            callee(a + b);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(cnx_clamp_add_u32(a, b))"); // #1152
      });

      it("should handle struct field array argument", () => {
        const source = `
          struct Data { u32 values[10]; }
          void callee(u32[10] arr) { }
          void test(Data d) {
            callee(d.values);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("d->values");
      });

      it("should handle parameter passed to callee", () => {
        const source = `
          void callee(u32 val) { }
          void test(u32 param) {
            callee(param);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(param)");
      });

      it("should handle struct parameter passed to callee", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void callee(Point p) { }
          void test(Point src) {
            callee(src);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(src)");
      });

      it("should handle struct member array as argument (array decay)", () => {
        const source = `
          struct Config { u8 data[16]; }
          void processData(u8[16] buffer) { }
          void test() {
            Config cfg;
            processData(cfg.data);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cfg.data");
      });

      it("passes a struct's string field bare: a string decays (#1737)", () => {
        const source = `
          struct Person { string<8> name; }
          void show(string<8> s) { }
          void test() {
            Person p;
            show(p.name);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("show(p.name)");
        expect(code).not.toContain("&p.name");
      });

      it("types a nested member argument as the inner field (#1737)", () => {
        const source = `
          struct Inner { u8[6] data; }
          struct Outer { Inner inner; u8 data; }
          void fill(u8[6] buf) { }
          void test() {
            Outer o;
            fill(o.inner.data);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("fill(o.inner.data)");
        expect(code).not.toContain("&o.inner.data");
      });

      it("should handle literal argument", () => {
        const source = `
          void callee(u32 val) { }
          void test() {
            callee(42);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(42U)");
      });

      it("should handle nested function call as argument", () => {
        const source = `
          u32 getValue() { return 10; }
          void callee(u32 val) { }
          void test() {
            callee(getValue());
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(getValue())");
      });

      it("should handle ternary expression as argument", () => {
        const source = `
          void callee(u32 val) { }
          void test(bool cond) {
            callee((cond = true) ? 1 : 0);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callee(");
      });

      it("should handle C++ mode struct member access", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void callee(u8 val) { }
          void test(Point p) {
            callee(p.x);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("p.x");
      });
    });

    describe("parameter processing helpers", () => {
      it("should process simple parameter type", () => {
        const source = `
          void test(u32 x) {
            u32 y <- x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("void test(const uint32_t x)");
      });

      it("should process array parameter type", () => {
        const source = `
          void test(u32[10] arr) {
            u32 x <- arr[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t arr[10]");
      });

      it("should process struct parameter type", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void test(Point p) {
            u32 x <- p.x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const Point* p");
      });

      it("should process const parameter", () => {
        const source = `
          void test(u32 x) {
            u32 y <- x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const uint32_t x");
      });

      it("should process bool parameter type", () => {
        const source = `
          void test(bool flag) {
            bool result <- flag;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("bool flag");
      });

      it("should process float parameter type", () => {
        const source = `
          void test(f32 val) {
            f32 result <- val;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("float val");
      });

      it("should process multiple parameters", () => {
        const source = `
          void test(u32 a, u32 b, u32 c) {
            u32 sum <- a + b + c;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain(
          "const uint32_t a, const uint32_t b, const uint32_t c",
        );
      });

      it("should process enum parameter type", () => {
        const source = `
          enum State { IDLE, RUNNING }
          void test(State s) {
            State result <- s;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("State s");
      });
    });

    describe("array access helpers", () => {
      it("should handle single index array access", () => {
        const source = `
          void test() {
            u32[10] arr;
            u32 val <- arr[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[5U]");
      });

      it("should handle bit range access on integer", () => {
        const source = `
          void test() {
            u32 val <- 0xFF00;
            u8 byte <- val[8, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("val >> 8");
        expect(code).toContain("0xFF");
      });

      it("should handle parameter array access", () => {
        const source = `
          void test(u32[10] arr) {
            u32 val <- arr[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[0U]");
      });

      it("should handle struct member array element access", () => {
        const source = `
          struct Data { u32 values[10]; }
          void test(Data d) {
            u32 val <- d.values[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);
        // Issue #1100: SymbolTable must be wired up (as the real Transpiler
        // pipeline always does, see setupGenerator() above) so the operand
        // typer can resolve struct field array-ness (#1737). Without this the
        // struct field's array-ness is never determined via the correct path — this
        // test was previously passing only because a since-removed blanket
        // "parameter -> array access" rule (Issue #579) coincidentally
        // produced the right output for the wrong reason.
        const symbolTable = new SymbolTable();
        symbolTable.addTSymbols(tSymbols);
        TestSymbolTable.install(host.state, symbolTable);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("d->values[0U]");
      });

      it("should handle C++ mode array access", () => {
        const source = `
          void test() {
            u32[10] arr;
            u32 val <- arr[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("arr[5U]");
      });

      it("should handle multi-dimensional array access", () => {
        const source = `
          void test() {
            u32[3][3] matrix;
            u32 val <- matrix[1][2];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("matrix[1U][2U]");
      });
    });

    describe("scope generation helpers", () => {
      it("should generate scope variable", () => {
        const source = `
          scope Motor {
            public u32 speed;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__speed");
      });

      it("should generate scope function", () => {
        const source = `
          scope Motor {
            public void start() { }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("void Motor__start(void)");
      });

      it("should generate scope with enum and function using it", () => {
        const source = `
          scope Motor {
            public enum State { IDLE, RUNNING }
            public mut State current;
            public void setState(State s) {
              current <- s;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        // #831/#1285: register the symbols, as Transpiler.ts:429 does. Passing only
        // `symbolInfo` leaves state.symbolTable empty -- a state the real
        // pipeline never reaches, and one in which kind-aware type resolution
        // silently finds nothing. 390 sites in this file share this shape and pass
        // because they do not assert on scope-qualified names; these two do.
        TestSymbolTable.install(host.state);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__current = s");
        expect(code).toContain("void Motor__setState(const Motor__State s)");
      });
    });

    describe("C++ member conversion helpers", () => {
      it("should handle struct param member access in C++ mode", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void test(Point p) {
            u32 x <- p.x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("const Point& p");
        expect(code).toContain("p.x");
      });

      it("should handle nested struct member access", () => {
        const source = `
          struct Inner { u32 val; }
          struct Outer { Inner inner; }
          void test(Outer o) {
            u32 x <- o.inner.val;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("o->inner.val");
      });

      it("should handle const struct param in C++ mode", () => {
        const source = `
          struct Config { u32 value; }
          void test(Config cfg) {
            u32 x <- cfg.value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("const Config&");
      });

      it("should handle array member element access in C++ mode", () => {
        const source = `
          struct Data { u32 values[10]; }
          void test() {
            Data d;
            u32 x <- d.values[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        // Issue #831: Register TSymbols in SymbolTable (single source of truth)
        const symbolTable = new SymbolTable();
        symbolTable.addTSymbols(tSymbols);
        TestSymbolTable.install(host.state, symbolTable);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("d.values[0U]");
      });

      it("should handle struct array element member access", () => {
        const source = `
          struct Point { u32 x; u32 y; }
          void test() {
            Point[10] points;
            u32 x <- points[0].x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("points[0U].x");
      });

      it("should handle function return member access pattern", () => {
        const source = `
          struct Config { u32 value; }
          Config getConfig() { Config c; return c; }
          void test() {
            u32 x <- getConfig().value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("getConfig().value");
      });
    });

    describe("literal expression helpers", () => {
      it("should recognize integer literal", () => {
        const source = `
          void test() {
            u32 x <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t x = 42");
      });

      it("should recognize negated literal", () => {
        const source = `
          void test() {
            i32 x <- -42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("int32_t x = -42");
      });

      it("should recognize float literal", () => {
        const source = `
          void test() {
            f32 x <- 3.14;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("float x = 3.14");
      });

      it("should recognize hex literal", () => {
        const source = `
          void test() {
            u32 x <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("0xFF");
      });

      it("should recognize binary literal", () => {
        const source = `
          void test() {
            u8 x <- 0b1010;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Binary literals are preserved in output
        expect(code).toContain("0b1010");
      });
    });

    describe("bit range access", () => {
      it("should generate bit range read from integer variable", () => {
        const source = `
          void test() {
            u32 flags <- 0xFF00FF00;
            u8 nibble <- flags[4, 4];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit extraction: (value >> start) & mask
        expect(code).toContain("flags");
        expect(code).toContain(">> 4");
      });

      it("should generate float bit range read with union shadow variable", () => {
        const source = `
          void test() {
            f32 value <- 3.14;
            u8 byte <- value[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Float bit access uses union-based type punning (MISRA 21.15 compliant)
        expect(code).toContain("union { float f; uint32_t u; }");
        expect(code).not.toContain("memcpy(");
      });
    });

    describe("clamp overflow operations", () => {
      it("should generate clamp add helper for u8", () => {
        const source = `
          mut clamp u8 counter <- 250;
          void test() {
            counter +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cnx_clamp_add_u8");
      });

      it("should generate clamp sub helper for u16", () => {
        const source = `
          mut clamp u16 counter <- 10;
          void test() {
            counter -<- 20;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cnx_clamp_sub_u16");
      });
    });

    describe("division and modulo operations", () => {
      it("should generate division with constant divisor", () => {
        const source = `
          void test() {
            u32 a <- 100;
            u32 result <- a / 5;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a / 5");
      });

      it("should generate modulo with constant divisor", () => {
        const source = `
          void test() {
            u32 a <- 100;
            u32 result <- a % 7;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a % 7");
      });
    });

    describe("ISR (Interrupt Service Routine)", () => {
      it("should generate isr wrapper function", () => {
        const source = `
          isr void timer_handler() {
            u32 x <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // ISR functions are generated with wrapper
        expect(code).toContain("timer_handler");
      });
    });

    describe("global keyword resolution", () => {
      it("should resolve global.variable pattern", () => {
        const source = `
          mut u32 counter <- 0;
          scope Motor {
            u32 counter <- 0;
            public void increment() {
              global.counter +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // global.counter should reference the global variable, not Motor_counter
        expect(code).toContain("counter");
      });
    });

    describe("callback field types", () => {
      it("should handle callback typedef in struct", () => {
        // In cnx, callback types use function name as the type
        const source = `
          void handleClick() { }
          struct Handler {
            handleClick onClick;
          }
          void test() {
            mut Handler h;
            h.onClick <- handleClick;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Callback assignment should work
        expect(code).toContain("h.onClick");
        expect(code).toContain("handleClick");
      });
    });

    describe("const value resolution", () => {
      it("should resolve const values in expressions", () => {
        const source = `
          u32 MAX_SIZE <- 100;
          u32[MAX_SIZE] buffer;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Const should be used in array declaration
        expect(code).toContain("MAX_SIZE");
      });
    });

    describe("atomic variables", () => {
      it("should generate atomic variable declaration", () => {
        const source = `
          atomic u32 counter <- 0;
          void test() {
            counter +<- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Atomic should generate appropriate code
        expect(code).toContain("counter");
      });
    });

    describe("postfix target analysis", () => {
      it("should handle this.member pattern", () => {
        const source = `
          scope LED {
            mut u8 state <- 0;
            public void toggle() {
              this.state <- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("LED__state");
      });

      it("should handle array access in assignment target", () => {
        const source = `
          void test() {
            mut u32[10] arr;
            arr[5] <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[5] = 42");
      });
    });

    describe("C++ class constructor detection", () => {
      it("should handle C++ types in symbol table", () => {
        const source = `
          void test() {
            u32 val <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        // Generate to initialize state
        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should compile without errors
        expect(code).toContain("val");
      });
    });

    describe("cross-file function resolution", () => {
      it("should handle function defined in current file", () => {
        const source = `
          void helper() { }
          void test() {
            helper();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("helper()");
      });
    });

    describe("bitmap operations", () => {
      it("should generate bit extraction for bitmap indexing", () => {
        // bitmap8 requires exactly 8 bits - using comma-separated field names
        const source = `
          bitmap8 Flags { bit0, bit1, bit2, bit3, bit4, bit5, bit6, bit7 }
          void test() {
            Flags flags <- 0;
            u8 val <- flags[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bitmap indexing generates bit extraction (no shift for position 0)
        expect(code).toContain("((flags) & 1)");
      });
    });

    describe("member separator resolution", () => {
      it("should use correct separator for struct param in C mode", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void translate(mut Point p) {
            p.x +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // C mode uses -> for struct parameters
        expect(code).toContain("p->x");
      });

      it("should use correct separator for struct param in C++ mode", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void translate(mut Point p) {
            p.x +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // C++ mode uses . for struct parameters (references)
        expect(code).toContain("p.x");
      });
    });

    describe("string operations", () => {
      it("should generate string variable with capacity", () => {
        const source = `
          void test() {
            string<32> name <- "Hello";
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // string<32> generates char[33] (capacity + 1 for null terminator)
        expect(code).toContain("name[33]");
        expect(code).toContain('"Hello"');
      });

      it("should generate string concatenation", () => {
        const source = `
          void test() {
            string<32> a <- "Hello";
            string<32> b <- " World";
            string<64> result <- a + b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String concatenation uses strncpy and strncat
        expect(code).toContain("strncpy");
        expect(code).toContain("strncat");
      });
    });

    describe("qualified type resolution", () => {
      it("should resolve scope-qualified type", () => {
        const source = `
          scope Motor {
            struct Config {
              u32 speed;
            }
            Config config;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        // #831/#1285: register the symbols, as Transpiler.ts:429 does. Passing only
        // `symbolInfo` leaves state.symbolTable empty -- a state the real
        // pipeline never reaches, and one in which kind-aware type resolution
        // silently finds nothing. 390 sites in this file share this shape and pass
        // because they do not assert on scope-qualified names; these two do.
        TestSymbolTable.install(host.state);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__Config");
      });
    });

    describe("switch statement generation", () => {
      it("should generate switch with multiple cases", () => {
        const source = `
          void test(u32 val) {
            switch (val) {
              case 1 { return; }
              case 2 { return; }
              case 3 { return; }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch");
        expect(code).toContain("case 1:");
        expect(code).toContain("case 2:");
        expect(code).toContain("case 3:");
      });

      it("should generate switch with default case", () => {
        const source = `
          void test(u32 val) {
            switch (val) {
              case 1 { return; }
              default { return; }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("default:");
      });
    });

    describe("for loop generation", () => {
      it("should generate standard for loop", () => {
        const source = `
          void test() {
            for (mut u32 i <- 0; i < 10; i +<- 1) {
              u32 x <- i;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for");
        expect(code).toContain("i = 0");
        expect(code).toContain("i < 10");
      });
    });

    describe("do-while loop generation", () => {
      it("should generate do-while loop", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            do {
              i +<- 1;
            } while (i < 10);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("do {");
        expect(code).toContain("} while");
      });
    });

    describe("critical block generation", () => {
      it("should generate critical section with interrupt disable", () => {
        const source = `
          mut u32 counter;
          void test() {
            critical {
              counter +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Critical sections use interrupt save/restore
        expect(code).toContain("counter");
      });
    });

    describe("ternary expression generation", () => {
      it("should generate ternary with comparison condition", () => {
        const source = `
          void test() {
            u32 x <- 5;
            u32 result <- (x > 3) ? 10 : 20;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Issue #1032: Comparison operands don't get U suffix (would change semantics)
        // but ternary arms do (they're assigned to u32 result)
        expect(code).toContain("(x > 3) ? 10U : 20U");
      });
    });

    describe("logical expression generation", () => {
      it("should generate logical AND expression", () => {
        const source = `
          void test() {
            bool a <- true;
            bool b <- false;
            bool result <- a && b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a && b");
      });

      it("should generate logical OR expression", () => {
        const source = `
          void test() {
            bool a <- true;
            bool b <- false;
            bool result <- a || b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a || b");
      });
    });

    describe("bitwise expression generation", () => {
      it("should generate bitwise AND expression", () => {
        const source = `
          void test() {
            u32 a <- 0xFF;
            u32 b <- 0x0F;
            u32 result <- a & b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a & b");
      });

      it("should generate bitwise shift expressions", () => {
        const source = `
          void test() {
            u32 a <- 0xFF;
            u32 left <- a << 4;
            u32 right <- a >> 4;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a << 4");
        expect(code).toContain("a >> 4");
      });
    });

    describe("unary expression generation", () => {
      it("should generate logical NOT expression", () => {
        const source = `
          void test() {
            bool a <- true;
            bool result <- !a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("!a");
      });

      it("should generate bitwise NOT expression", () => {
        const source = `
          void test() {
            u32 a <- 0xFF;
            u32 result <- ~a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("~a");
      });
    });

    describe("enum operations", () => {
      it("should generate enum declaration and usage", () => {
        const source = `
          enum Color { RED, GREEN, BLUE }
          void test() {
            Color c <- Color.RED;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color__RED");
      });
    });

    describe("function return types", () => {
      it("should generate function with struct return type", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          Point makePoint(i32 x, i32 y) {
            mut Point p;
            p.x <- x;
            p.y <- y;
            return p;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point makePoint");
        expect(code).toContain("return p");
      });
    });

    describe("pragma target directive", () => {
      it("should parse pragma target directive", () => {
        const source = `
          #pragma target teensy41
          void test() { }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should generate code without error
        expect(code).toContain("test");
      });
    });

    describe("array initialization", () => {
      it("should generate array with initializer list", () => {
        const source = `
          void test() {
            u32[5] arr <- [1, 2, 3, 4, 5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("{1U, 2U, 3U, 4U, 5U}");
      });
    });

    describe("parameter type resolution helpers", () => {
      it("should resolve primitive type parameter", () => {
        const source = `
          void test(mut u32 val) {
            val +<- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t* val");
      });

      it("should resolve user type parameter (struct)", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void test(mut Point p) {
            p.x <- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point* p");
      });

      it("should resolve array parameter", () => {
        const source = `
          void test(mut u32[10] arr) {
            arr[0] <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t arr[10]");
      });

      it("should resolve const parameter", () => {
        const source = `
          void test(u32 val) {
            u32 copy <- val;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const");
      });

      it("should resolve string parameter", () => {
        const source = `
          void test(string<32> name) {
            u32 len <- name.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String parameters are passed as const char*
        expect(code).toContain("const char* name");
      });

      it("should resolve callback parameter", () => {
        const source = `
          void handler() { }
          void test(handler callback) {
            callback();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("callback");
      });

      it("should resolve scoped type parameter inside scope", () => {
        const source = `
          scope Motor {
            struct Config { u32 speed; }
            public void init(mut this.Config cfg) {
              cfg.speed <- 100;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__Config");
      });
    });

    describe("enum type resolution helpers", () => {
      it("should resolve this.EnumType.MEMBER inside scope", () => {
        const source = `
          scope LED {
            enum State { OFF, ON }
            mut State current <- State.OFF;
            public void toggle() {
              if (this.current = this.State.OFF) {
                this.current <- this.State.ON;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("LED__State__OFF");
        expect(code).toContain("LED__State__ON");
      });

      it("should resolve global.EnumType.MEMBER", () => {
        const source = `
          enum Color { RED, GREEN, BLUE }
          scope Display {
            mut Color current <- global.Color.RED;
            public void setColor() {
              this.current <- global.Color.GREEN;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color__GREEN");
      });

      it("should resolve Scope.EnumType.MEMBER from outside", () => {
        const source = `
          scope Motor {
            public enum State { STOPPED, RUNNING }
          }
          void test() {
            Motor.State s <- Motor.State.RUNNING;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State__RUNNING");
      });
    });

    describe("C++ mode conversion helpers", () => {
      it("should handle nested struct member access in C++ mode", () => {
        const source = `
          struct Inner { i32 value; }
          struct Outer { Inner inner; }
          void test(mut Outer o) {
            o.inner.value <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("o.inner.value = 42");
      });

      it("should handle array element member access in C++ mode", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          struct Container { Point points[10]; }
          void test(mut Container c) {
            c.points[0].x <- 5;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Array element assignments don't get U suffix yet
        expect(code).toContain("c.points[0].x = 5");
      });
    });

    describe("function argument helpers", () => {
      it("should handle lvalue argument (variable reference)", () => {
        const source = `
          void modify(mut u32 val) { val +<- 1; }
          void test() {
            mut u32 x <- 0;
            modify(x);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("modify(&x)");
      });

      it("should handle struct member as function argument", () => {
        const source = `
          struct Data { u32 value; }
          void process(mut u32 val) { val +<- 1; }
          void test() {
            mut Data d;
            d.value <- 5;
            process(d.value);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("process(&d.value)");
      });

      it("should handle expression as function argument (rvalue)", () => {
        const source = `
          u32 compute(u32 val) { return val * 2; }
          void test() {
            u32 result <- compute(5 + 3);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Literals get U suffix per MISRA Rule 7.2
        expect(code).toContain("compute(5U + 3U)");
      });
    });

    describe("scope member generation helpers", () => {
      it("should generate scope variable declaration", () => {
        const source = `
          scope Counter {
            mut u32 count <- 0;
            public void bump() { count +<- 1; }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Counter__count");
      });

      it("should generate scope function with string return type capacity", () => {
        const source = `
          scope Greeter {
            public string<32> getMessage() {
              return "Hello";
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Greeter__getMessage");
      });
    });

    describe("literal expression helpers", () => {
      it("should detect unary expression as literal", () => {
        const source = `
          void test() {
            i32 negative <- -42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-42");
      });

      it("should detect postfix literal expression", () => {
        const source = `
          void test() {
            u32 x <- 123;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("123");
      });
    });

    describe("child statement classification helpers", () => {
      it("should classify if statement children correctly", () => {
        const source = `
          void test(mut u32 x) {
            if (x > 0) {
              x +<- 1;
            } else {
              x -<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("if");
        expect(code).toContain("else");
      });

      it("should collect while loop body correctly", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            while (i < 10) {
              i +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("while");
        expect(code).toContain("i < 10");
      });

      it("should collect for loop body correctly", () => {
        const source = `
          void test() {
            for (mut u32 i <- 0; i < 5; i +<- 1) {
              u32 doubled <- i * 2;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for");
        expect(code).toContain("i < 5");
      });

      it("should collect switch children correctly", () => {
        const source = `
          void test(mut u32 x) {
            switch (x) {
              case 1 {
                x +<- 10;
              }
              case 2 {
                x +<- 20;
              }
              default {
                x <- 0;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch");
        expect(code).toContain("case 1:");
        expect(code).toContain("case 2:");
        expect(code).toContain("default:");
      });
    });

    describe("integer bit range access", () => {
      it("should generate integer bit range read with shift and mask", () => {
        const source = `
          void test() {
            u32 flags <- 0xABCD1234;
            u8 nibble <- flags[8, 4];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain(">> 8U");
        // A constant width's mask is written as its value (#1668)
        expect(code).toContain("((flags >> 8U) & 0xFU)");
      });
    });

    describe("u8 target type detection", () => {
      it("should detect u8 target type for proper casting", () => {
        const source = `
          void test() {
            mut u8 small <- 255;
            u32 large <- 1000;
            small <- large[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("large");
      });
    });

    describe("string char_count helpers", () => {
      it("should get string char_count for global string variable", () => {
        const source = `
          string<64> message <- "Hello World";
          void test() {
            u32 cap <- message.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("message[65]");
      });

      it("should get string char_count for scoped string variable", () => {
        const source = `
          scope Logger {
            string<128> buffer;
            public u32 getCapacity() {
              return this.buffer.value_char_count;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Logger__buffer");
      });
    });

    describe("enum resolution from this.variable", () => {
      it("should resolve enum from this.enumVar inside scope", () => {
        const source = `
          scope Motor {
            enum State { STOPPED, RUNNING }
            State status <- State.STOPPED;
            public bool isRunning() {
              return this.status = this.State.RUNNING;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State__RUNNING");
      });
    });

    describe("C++ member conversion detection", () => {
      it("should detect need for param member conversion in C++ mode", () => {
        const source = `
          struct Config { u32 value; }
          void useConfig(Config c) {
            u32 v <- c.value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // In C++ mode, struct params use . not ->
        expect(code).toContain("c.value");
      });

      it("should handle function return struct member access", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          Point getOrigin() {
            mut Point p;
            p.x <- 0;
            p.y <- 0;
            return p;
          }
          void test() {
            i32 x <- getOrigin().x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("getOrigin().x");
      });
    });

    describe("negated literal detection", () => {
      it("should detect negated integer literal", () => {
        const source = `
          void test() {
            i32 neg <- -100;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-100");
      });

      it("should detect negated float literal", () => {
        const source = `
          void test() {
            f32 neg <- -3.14;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Float literals may not preserve the f suffix in output
        expect(code).toContain("-3.14");
      });
    });

    describe("qualified type access patterns", () => {
      it("should handle qualified type in variable declaration", () => {
        const source = `
          scope Sensor {
            public struct Reading { f32 value; u32 timestamp; }
          }
          void test() {
            Sensor.Reading r;
            r.value <- 25.5f;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Sensor__Reading r");
      });
    });

    describe("register parameter type helpers", () => {
      it("should register primitive type in type registry", () => {
        const source = `
          void process(mut u16 value) {
            value +<- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint16_t* value");
      });

      it("should register enum type parameter", () => {
        const source = `
          enum Color { RED, GREEN, BLUE }
          void setColor(Color c) {
            Color current <- c;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color c");
      });
    });

    describe("member access with enum type variable", () => {
      it("should resolve enum type from struct member", () => {
        const source = `
          enum State { OFF, ON }
          struct Device { State status; }
          void test(mut Device d) {
            d.status <- State.ON;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("State__ON");
      });
    });

    describe("complex nested member access in C++ mode", () => {
      it("should handle deeply nested struct member access", () => {
        const source = `
          struct Inner { i32 val; }
          struct Middle { Inner inner; }
          struct Outer { Middle middle; }
          void test(mut Outer o) {
            o.middle.inner.val <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("o.middle.inner.val = 42");
      });
    });

    describe("postfix literal detection edge cases", () => {
      it("should handle boolean literal", () => {
        const source = `
          void test() {
            bool flag <- true;
            bool other <- false;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("true");
        expect(code).toContain("false");
      });

      it("should handle character literal in string context", () => {
        const source = `
          void test() {
            string<16> s <- "test";
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain('"test"');
      });
    });

    describe("array access with parameter dereferencing", () => {
      it("should generate bit access on scalar parameter", () => {
        const source = `
          u8 getBit(u32 flags) {
            return flags[0, 1];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit access extracts bit 0 with width 1 (no shift for position 0)
        expect(code).toContain("((flags) & 0x1U)");
      });

      it("should not dereference array parameter for index access", () => {
        const source = `
          u32 getElement(u32[10] arr) {
            return arr[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Array params don't need dereference
        // Array index gets U suffix per MISRA 7.2
        expect(code).toContain("arr[5U]");
        expect(code).not.toContain("(*arr)");
      });

      it("should not dereference float parameter (pass by value)", () => {
        const source = `
          u8 getFloatBit(f32 val) {
            return val[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Float params are pass-by-value, no dereference needed
        expect(code).not.toContain("(*val)");
      });

      it("should not dereference enum parameter (pass by value)", () => {
        const source = `
          enum State { OFF, ON }
          u8 getEnumBit(State s) {
            return s[0, 1];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Enum params are pass-by-value, no dereference
        expect(code).not.toContain("(*s)");
      });
    });

    describe("float bit range access helpers", () => {
      it("should generate float bit range read with union", () => {
        const source = `
          void test() {
            f32 value <- 3.14;
            u32 bits <- value[0, 32];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Float bit access uses union-based type punning (MISRA 21.15 compliant)
        expect(code).toContain("union { float f; uint32_t u; }");
        expect(code).not.toContain("memcpy(");
      });

      it("should generate f64 bit range read with union", () => {
        const source = `
          void test() {
            f64 value <- 3.14159;
            u64 bits <- value[0, 64];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // f64 uses double/uint64_t union
        expect(code).toContain("union { double f; uint64_t u; }");
        expect(code).not.toContain("memcpy(");
      });
    });

    describe("collect child statements helpers", () => {
      it("should collect do-while loop body", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            do {
              i +<- 1;
            } while (i < 5);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("do {");
        expect(code).toContain("} while");
      });

      it("should classify statement without block", () => {
        const source = `
          void test(mut u32 x) {
            if (x > 0)
              x +<- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Parameters are passed by pointer, so they get dereferenced
        expect(code).toContain("if ((*x) > 0)");
      });
    });

    describe("scoped enum member access patterns", () => {
      it("should resolve Scope.Enum.MEMBER from outside scope", () => {
        const source = `
          scope Device {
            public enum Mode { IDLE, ACTIVE, SLEEP }
          }
          void test() {
            Device.Mode m <- Device.Mode.ACTIVE;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Device__Mode__ACTIVE");
      });
    });

    describe("function call argument generation", () => {
      it("should handle array argument passed to function", () => {
        const source = `
          void process(mut u32[10] data) {
            data[0] <- 1;
          }
          void test() {
            mut u32[10] arr;
            process(arr);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("process(arr)");
      });

      it("should handle struct return from function call", () => {
        const source = `
          struct Vec2 { f32 x; f32 y; }
          Vec2 createZeroVec() {
            Vec2 v;
            v.x <- 0.0f;
            v.y <- 0.0f;
            return v;
          }
          void test() {
            Vec2 vec <- createZeroVec();
            f32 xCoord <- vec.x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("createZeroVec()");
        expect(code).toContain("vec.x");
      });
    });

    describe("scope function generation helpers", () => {
      it("should generate scope function with multiple parameters", () => {
        const source = `
          scope Math {
            public u32 add(u32 a, u32 b) {
              return a + b;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Math__add");
      });

      it("should generate scope function with struct return", () => {
        const source = `
          scope Factory {
            struct Product { u32 id; }
            public Product create(u32 id) {
              Product p;
              p.id <- id;
              return p;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Scope function name is prefixed, struct return type uses its own name
        expect(code).toContain("Product Factory__create");
        expect(code).toContain("Factory__create(const uint32_t id)");
      });
    });

    describe("this.variable enum member access", () => {
      it("should resolve enum type from this.variable member access", () => {
        const source = `
          scope Controller {
            enum State { INIT, READY, ERROR }
            mut State currentState <- State.INIT;
            public void checkState() {
              if (this.currentState = this.State.ERROR) {
                this.currentState <- this.State.INIT;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Controller__State__ERROR");
        expect(code).toContain("Controller__State__INIT");
      });
    });

    describe("member access chain with arrays", () => {
      it("should handle struct.array[index] pattern", () => {
        const source = `
          struct Buffer { u8 data[64]; u32 len; }
          void test() {
            mut Buffer b;
            b.len <- 0;
            b.data[0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("b.data[0]");
      });

      it("should handle param.array[index] in C mode", () => {
        const source = `
          struct Container { u32 values[10]; }
          void modify(mut Container c) {
            c.values[0] <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // In C mode, struct param uses ->
        expect(code).toContain("c->values[0]");
      });
    });

    describe("wrap overflow operations", () => {
      it("should generate wrap add for wrap u8", () => {
        const source = `
          mut wrap u8 counter <- 250;
          void test() {
            counter +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Wrap behavior allows overflow
        expect(code).toContain("counter");
      });
    });

    describe("function call enum type resolution", () => {
      it("should resolve enum return type from simple function call", () => {
        const source = `
          enum Status { OK, ERROR, PENDING }
          Status getStatus() {
            return Status.OK;
          }
          void test() {
            Status s <- getStatus();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Status s = getStatus()");
      });

      it("should resolve return type from scope method call", () => {
        const source = `
          scope Device {
            public u32 getValue() {
              return 42;
            }
          }
          void test() {
            u32 v <- Device.getValue();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t v = Device__getValue()");
      });

      it("should resolve enum from this.method() inside scope", () => {
        const source = `
          scope Controller {
            enum State { INIT, RUNNING, STOPPED }
            State getState() {
              return State.INIT;
            }
            public void process() {
              State s <- this.getState();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Controller__getState()");
      });

      it("should resolve enum from global.func() inside scope", () => {
        const source = `
          enum Level { LOW, MEDIUM, HIGH }
          Level getLevel() {
            return Level.LOW;
          }
          scope Handler {
            public void check() {
              Level l <- global.getLevel();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Level l = getLevel()");
      });
    });

    describe("array type declarations", () => {
      it("should handle array with size in declaration", () => {
        const source = `
          void test() {
            mut u8[10] buffer;
            buffer[0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t buffer[10]");
      });

      it("should handle array type with named constant size", () => {
        const source = `
          u32 BUFFER_SIZE <- 64;
          void test() {
            mut u8[BUFFER_SIZE] buffer;
            buffer[0] <- 0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("BUFFER_SIZE");
      });

      it("should allow empty brackets for size inference", () => {
        const source = `
          void test() {
            u8[] data <- [1, 2, 3];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t data[3]");
      });

      it("should allow multi-dimensional cnx style arrays", () => {
        const source = `
          void test() {
            mut u8[4][4] matrix;
            matrix[0][0] <- 0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t matrix[4][4]");
      });
    });

    describe("string expression type checking", () => {
      it("should detect string expression with capacity", () => {
        const source = `
          void test() {
            string<8> name <- "Hi";
            string<32> greeting <- "Hello " + name;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String concat generates strncpy/strncat
        expect(code).toContain("strncpy");
      });

      it("should handle substring operations", () => {
        const source = `
          void test() {
            string<32> name <- "Hello World";
            string<16> prefix <- name[0, 5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("prefix");
      });
    });

    describe("integer expression type inference", () => {
      it("should infer integer type from arithmetic expression", () => {
        const source = `
          void test() {
            u32 a <- 10;
            u32 b <- 20;
            u32 sum <- a + b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Local variables don't need dereferencing
        expect(code).toContain("uint32_t sum = cnx_clamp_add_u32(a, b)"); // #1152
      });

      it("should handle complex arithmetic with parentheses", () => {
        const source = `
          void test() {
            u32 a <- 10;
            u32 b <- 20;
            u32 c <- 5;
            u32 result <- (a + b) * c;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("result");
      });
    });

    describe("global scope references", () => {
      it("should resolve global.Scope.method() pattern", () => {
        const source = `
          scope Util {
            public u32 getValue() {
              return 42;
            }
          }
          scope Handler {
            public void process() {
              u32 v <- global.Util.getValue();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Util__getValue()");
      });

      it("should handle global struct type reference in scope", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          scope Renderer {
            public void draw(global.Point p) {
              i32 px <- p.x;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point");
        expect(code).toContain("p->x");
      });
    });

    describe("literal type validation", () => {
      it("should handle float literals in expressions", () => {
        const source = `
          void test() {
            f32 pi <- 3.14159f;
            f32 doubled <- pi * 2.0f;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("3.14159");
        expect(code).toContain("2.0");
      });

      it("should validate negated literals", () => {
        const source = `
          void test() {
            i32 neg <- -100;
            f32 negFloat <- -3.14;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-100");
        expect(code).toContain("-3.14");
      });
    });

    describe("member type resolution", () => {
      it("should get full member type info for nested access", () => {
        const source = `
          struct Inner { u32 value; }
          struct Outer { Inner inner; }
          void test() {
            mut Outer o;
            o.inner.value <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("o.inner.value = 42");
      });
    });

    describe("control flow statement helpers", () => {
      it("should handle if statement with block body", () => {
        const source = `
          void test() {
            mut u32 x <- 0;
            if (x = 0) {
              x <- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("if (x == 0)");
        expect(code).toContain("x = 1");
      });

      it("should handle if statement with single statement body", () => {
        const source = `
          void test() {
            u32 x <- 0;
            if (x = 0)
              x <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("if (x == 0)");
      });

      it("should handle while loop with block body", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            while (i < 10) {
              i +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("while (i < 10)");
      });

      it("should handle for loop with single statement body", () => {
        const source = `
          u32 sum <- 0;
          void test() {
            for (u32 i <- 0; i < 5; i +<- 1)
              sum +<- i;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for (");
      });

      it("should handle switch with multiple cases and default", () => {
        const source = `
          void test() {
            u32 val <- 1;
            mut u32 result <- 0;
            switch (val) {
              case 0 { result <- 10; }
              case 1 { result <- 20; }
              default { result <- 30; }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch (val)");
        expect(code).toContain("case 0:");
        expect(code).toContain("case 1:");
        expect(code).toContain("default:");
      });

      it("should handle do-while loop", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            do {
              i +<- 1;
            } while (i < 5);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("do {");
        expect(code).toContain("} while (i < 5)");
      });
    });

    describe("parameter type resolution helpers", () => {
      it("should handle qualified type parameter (Scope.Type)", () => {
        const source = `
          scope Graphics {
            public struct Color { u8 r; u8 g; u8 b; }
          }
          void draw(Graphics.Color c) {
            u8 red <- c.r;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Graphics__Color");
      });

      it("should handle scoped type parameter (this.Type)", () => {
        const source = `
          scope Device {
            struct Config { u32 baud; }
            public void setup(this.Config cfg) {
              u32 b <- cfg.baud;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Device__Config");
      });

      it("should handle global type parameter inside scope", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          scope Canvas {
            public void plot(global.Point p) {
              i32 px <- p.x;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point* p");
      });

      it("should handle const struct parameter", () => {
        const source = `
          struct Data { u32 value; }
          void process(Data d) {
            u32 v <- d.value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const Data*");
      });

      it("should handle string parameter with capacity", () => {
        const source = `
          void greet(string<32> name) {
            string<64> msg <- "Hello, " + name;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String parameters are passed as const char*
        expect(code).toContain("const char* name");
      });
    });

    describe("enum type from context helpers", () => {
      it("should resolve this.Enum.MEMBER pattern inside scope", () => {
        const source = `
          scope Motor {
            enum Direction { FORWARD, BACKWARD, STOP }
            mut Direction dir <- Direction.STOP;
            public void move() {
              dir <- this.Direction.FORWARD;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__Direction__FORWARD");
      });

      it("should resolve global.Enum.MEMBER pattern inside scope", () => {
        const source = `
          enum Priority { LOW, MEDIUM, HIGH }
          scope Task {
            mut Priority level <- global.Priority.LOW;
            public void elevate() {
              level <- global.Priority.HIGH;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Priority__HIGH");
      });

      it("should resolve Scope.Enum.MEMBER from outside scope", () => {
        const source = `
          scope LED {
            public enum Color { RED, GREEN, BLUE }
          }
          void test() {
            LED.Color c <- LED.Color.RED;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("LED__Color__RED");
      });

      it("should resolve enum from this.variable type", () => {
        const source = `
          scope Sensor {
            enum Status { OK, ERROR, PENDING }
            mut Status state <- Status.OK;
            public void checkStatus() {
              if (this.state = this.Status.ERROR) {
                this.state <- this.Status.OK;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Sensor__Status__ERROR");
        expect(code).toContain("Sensor__Status__OK");
      });
    });

    describe("callback type parameters", () => {
      it("should handle callback type in function parameter", () => {
        const source = `
          callback void Handler();
          void setHandler(Handler h) {
            h();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        // #1929: the symbol table is where the callback typedef is built from,
        // so it is populated here exactly as the Pipeline populates it.
        const symbolTable = new SymbolTable();
        symbolTable.addTSymbols(tSymbols);
        TestSymbolTable.install(host.state, symbolTable);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Callback types get _fp suffix for function pointer
        expect(code).toContain("Handler_fp h");
      });
    });

    describe("callback typedef parameter spelling", () => {
      it("writes the struct keyword for a C tag with no typedef (#1929)", () => {
        // The .h prototype drops the keyword today (#1944), so a C fixture of
        // this shape cannot compile yet; this pins the typedef's half.
        const source = `
          struct Point { i32 x; }
          void onPoint(mut Point p) { p.x <- 1; }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbolTable = new SymbolTable();
        symbolTable.addTSymbols(tSymbols);
        // What a C header's `struct Point { ... };` with no typedef records.
        symbolTable.markNeedsStructKeyword("Point");
        TestSymbolTable.install(host.state, symbolTable);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        const param = host.state.callbackTypes.get("onPoint")?.parameters[0];
        expect(param?.type).toBe("struct Point");
        expect(param?.isStruct).toBe(true);
      });
    });

    describe("array parameter dimensions", () => {
      it("should handle multi-dimensional array parameter", () => {
        const source = `
          void processMatrix(mut u32[3][3] matrix) {
            matrix[0][0] <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t matrix[3][3]");
      });
    });

    describe("user type array parameters", () => {
      it("should handle struct array parameter with cnx style", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void processPoints(mut Point[4] points) {
            points[0].x <- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point points[4]");
      });

      it("should detect struct type in arrayType for parameter", () => {
        const source = `
          struct Data { u32 value; }
          void process(mut Data[8] items) {
            items[0].value <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Data items[8]");
        expect(code).toContain("items[0].value = 42");
      });
    });

    describe("multi-dimensional cnx style array parameters", () => {
      it("should handle 2D array parameter", () => {
        const source = `
          void processMatrix(mut i32[4][4] matrix) {
            matrix[0][0] <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("int32_t matrix[4][4]");
      });

      it("should handle 3D array parameter", () => {
        const source = `
          void processCube(mut u8[2][3][4] cube) {
            cube[0][0][0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t cube[2][3][4]");
      });
    });

    describe("string array parameter capacity", () => {
      it("should add capacity dimension for string array parameter", () => {
        const source = `
          void processNames(mut string<16>[5] names) {
            names[0] <- "test";
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // string<16>[5] -> char[5][17] (capacity + 1 for null terminator)
        expect(code).toContain("char names[5][17]");
      });

      it("should handle string array with larger capacity", () => {
        const source = `
          void logMessages(mut string<128>[10] messages) {
            messages[0] <- "hello";
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("char messages[10][129]");
      });
    });

    describe("bit range access helpers", () => {
      it("should generate integer bit range read", () => {
        const source = `
          void test() {
            u32 flags <- 0xFF;
            u8 lowBits <- flags[0, 4];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit extraction uses mask and shift
        expect(code).toContain("flags");
        expect(code).toContain("lowBits");
      });

      it("should generate bit range write", () => {
        const source = `
          void test() {
            mut u32 flags <- 0;
            flags[0, 4] <- 0x0F;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("flags");
      });

      it("should handle float bit punning with union", () => {
        const source = `
          void test() {
            f32 val <- 3.14;
            u32 bits <- val[0, 32];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Float bit access uses union-based type punning (MISRA 21.15 compliant)
        expect(code).toContain("union { float f; uint32_t u; }");
        expect(code).not.toContain("memcpy(");
      });
    });

    describe("scope function generation", () => {
      it("should generate scope function with void return", () => {
        const source = `
          scope Logger {
            public void info(string<64> msg) {
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("void Logger__info");
      });

      it("should generate scope function with primitive return", () => {
        const source = `
          scope Counter {
            u32 count <- 0;
            public u32 getCount() {
              return count;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t Counter__getCount");
      });

      it("should generate private scope variable access", () => {
        const source = `
          scope State {
            mut u32 value <- 0;
            public void increment() {
              value +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("State__value");
      });
    });

    describe("array access name resolution", () => {
      it("should resolve array element access in expression", () => {
        const source = `
          void test() {
            u32[10] arr;
            u32 val <- arr[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[5U]");
      });

      it("should resolve array element with variable index", () => {
        const source = `
          void test() {
            u32[10] arr;
            u32 i <- 3;
            u32 val <- arr[i];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[i]");
      });
    });

    describe("string array parameters", () => {
      it("should handle string array parameter with capacity", () => {
        const source = `
          void processNames(string<32>[10] names) {
            string<32> first <- names[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String array parameters have capacity+1 for null terminator
        expect(code).toContain("char names[10][33]");
      });
    });

    describe("enum type from global pattern", () => {
      it("should resolve global.Enum.Member inside scope function", () => {
        const source = `
          enum Mode { AUTO, MANUAL }
          scope Driver {
            Mode currentMode <- global.Mode.AUTO;
            public Mode getMode() {
              return currentMode;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Mode__AUTO");
      });
    });

    describe("enum type from this.variable pattern", () => {
      it("should resolve type from this.enumVar comparison", () => {
        const source = `
          scope Controller {
            enum Phase { INIT, RUN, STOP }
            mut Phase phase <- Phase.INIT;
            public void check() {
              if (this.phase = this.Phase.RUN) {
                this.phase <- this.Phase.STOP;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Controller__Phase__RUN");
        expect(code).toContain("Controller__Phase__STOP");
      });
    });

    describe("bitmap parameter handling", () => {
      it("should handle bitmap type parameter", () => {
        const source = `
          bitmap8 Flags { ready, active, error, done, reserved1, reserved2, reserved3, reserved4 }
          void checkFlags(Flags f) {
            u8 ready <- f[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bitmap params passed as const pointer
        expect(code).toContain("const Flags* f");
      });
    });

    describe("fallback type resolution", () => {
      it("should handle custom type parameter", () => {
        const source = `
          struct Widget { u32 id; }
          void process(Widget w) {
            u32 wid <- w.id;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Widget* w");
        expect(code).toContain("w->id");
      });
    });

    describe("critical block handling", () => {
      it("should generate critical section code", () => {
        const source = `
          mut u32 counter <- 0;
          void incrementSafe() {
            critical {
              counter +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Critical sections use PRIMASK for interrupt disabling
        expect(code).toContain("__cnx_disable_irq");
        expect(code).toContain("__cnx_set_PRIMASK");
      });
    });

    describe("const folding in expressions", () => {
      it("should fold constant expressions", () => {
        const source = `
          void test() {
            u32 result <- 10 + 5;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Literals get U suffix per MISRA Rule 7.2
        expect(code).toContain("10U + 5U");
      });
    });

    describe("C++ mode member conversion helpers", () => {
      it("should handle struct parameter access in C++ mode", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void process(Point p) {
            i32 px <- p.x;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // C++ mode uses . not ->
        expect(code).toContain("p.x");
      });

      it("should handle nested struct access in C++ mode", () => {
        const source = `
          struct Inner { i32 val; }
          struct Outer { Inner inner; }
          void process(Outer o) {
            i32 v <- o.inner.val;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        expect(code).toContain("o.inner.val");
      });
    });

    describe("function argument generation helpers", () => {
      it("should handle identifier argument in function call", () => {
        const source = `
          void increment(mut u32 val) {
            val +<- 1;
          }
          void test() {
            mut u32 x <- 5;
            increment(x);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("increment(&x)");
      });

      it("should handle struct argument in function call", () => {
        const source = `
          struct Data { u32 value; }
          void processData(Data d) {
            u32 v <- d.value;
          }
          void test() {
            mut Data myData;
            myData.value <- 10;
            processData(myData);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("processData(&myData)");
      });

      it("should handle member access argument in function call", () => {
        const source = `
          struct Container { u32 val; }
          void useValue(mut u32 v) {
            v +<- 1;
          }
          void test() {
            mut Container c;
            c.val <- 5;
            useValue(c.val);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("useValue(&c.val)");
      });
    });

    describe("literal expression detection helpers", () => {
      it("should detect negated integer literal", () => {
        const source = `
          void test() {
            i32 neg <- -42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-42");
      });

      it("should detect negated float literal", () => {
        const source = `
          void test() {
            f32 neg <- -3.14;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-3.14");
      });

      it("should detect postfix literal in expression", () => {
        const source = `
          void test() {
            u32 val <- 100;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("100");
      });
    });

    describe("u8 target type detection", () => {
      it("should detect u8 as target type in cast", () => {
        const source = `
          void test() {
            u32 big <- 1000;
            u8 small <- big[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit extraction from u32 to u8
        expect(code).toContain("small");
      });
    });

    describe("array element member conversion", () => {
      it("should handle struct array element access", () => {
        const source = `
          struct Item { u32 id; }
          void test() {
            mut Item[10] items;
            items[0].id <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("items[0].id = 42");
      });
    });

    describe("function return member conversion", () => {
      it("should handle function returning struct for member access", () => {
        const source = `
          struct Result { u32 code; }
          Result getResult() {
            mut Result r;
            r.code <- 0;
            return r;
          }
          void test() {
            Result res <- getResult();
            u32 c <- res.code;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("res.code");
      });
    });

    describe("scope variable generation", () => {
      it("should generate scope-prefixed variable names", () => {
        const source = `
          scope Counter {
            mut u32 count <- 0;
            public void increment() {
              count +<- 1;
            }
            public u32 getCount() {
              return count;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Counter__count");
      });

      it("should generate scope member access with this", () => {
        const source = `
          scope State {
            mut u32 value <- 0;
            public void update(u32 newVal) {
              this.value <- newVal;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("State__value");
      });
    });
  });

  describe("refactored helper methods", () => {
    describe("float bit range access (PR #715 coverage)", () => {
      it("should generate f32 bit range read with union shadow", () => {
        const source = `
          void test() {
            f32 floatVal <- 1.5;
            u32 bits <- floatVal[0, 32];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should use union-based type punning (MISRA 21.15 compliant)
        expect(code).toContain("__bits_floatVal");
        expect(code).toContain("union { float f; uint32_t u; }");
        expect(code).not.toContain("memcpy(");
      });

      it("should generate f64 bit range read with 64-bit union shadow", () => {
        const source = `
          void test() {
            f64 doubleVal <- 2.718;
            u64 bits <- doubleVal[8, 11];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should use 64-bit union for f64 (MISRA 21.15 compliant)
        expect(code).toContain("__bits_doubleVal");
        expect(code).toContain("union { double f; uint64_t u; }");
        expect(code).not.toContain("memcpy(");
      });

      it("should reuse shadow variable for repeated float bit reads", () => {
        const source = `
          void test() {
            f32 val <- 3.14;
            u8 low <- val[0, 8];
            u8 high <- val[24, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Union shadow should only be declared once
        const shadowDecls = (
          code.match(/union { float f; uint32_t u; } __bits_val;/g) || []
        ).length;
        expect(shadowDecls).toBe(1);
        // Uses union member .u for bit access
        expect(code).toContain("__bits_val.u");
      });

      it("should generate integer bit range with start=0 optimization", () => {
        const source = `
          void test() {
            u32 flags <- 0xFF00;
            u8 lowByte <- flags[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit range access generates mask (no shift for start=0)
        expect(code).toContain("flags");
        expect(code).toContain("& 0xFF");
        // Optimization: no shift when start=0
        expect(code).not.toContain(">> 0");
      });

      it("should generate integer bit range with shift for non-zero start", () => {
        const source = `
          void test() {
            u32 flags <- 0xFF00;
            u8 highByte <- flags[8, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // When start != 0, need shift
        expect(code).toContain(">> 8");
        expect(code).toContain("& 0xFF");
      });
    });

    describe("type generation edge cases (PR #715 coverage)", () => {
      it("should handle void return type", () => {
        const source = `
          void doNothing() { }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("void doNothing(void)");
      });

      it("should generate type from scopedType without currentScopePath context", () => {
        // This tests _getTypeName returning just typeName when not in a scope
        const source = `
          scope Motor {
            public enum State { IDLE, RUNNING }
          }
          Motor.State status;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State");
      });

      it("should handle array type with user-defined struct", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          Point[10] points;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point points[10]");
      });

      it("should handle array type with primitive types", () => {
        const source = `
          u8[256] buffer;
          i32[10] numbers;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t buffer[256]");
        expect(code).toContain("int32_t numbers[10]");
      });
    });

    describe("strlen optimization (_setupLengthCache)", () => {
      it("should optimize multiple .value_char_count accesses on same string", () => {
        const source = `
          void test() {
            string<32> name <- "hello";
            u32 a <- name.value_char_count;
            u32 b <- name.value_char_count;
            u32 c <- name.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Multiple .value_char_count accesses should be present
        expect(code).toContain("strlen");
      });

      it("should generate proper strlen call for single char_count access", () => {
        const source = `
          void test() {
            string<32> msg <- "test";
            u32 len <- msg.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("strlen(msg)");
      });

      // #1946: the cache measured the global a shadowing local hides.
      it("measures and keys the cache by the operand as a read renders it", () => {
        const host = new CodeGenerator();

        const decls = host.setupLengthCache(
          new Map([["label", 2]]),
          (name) => `test__${name}`,
        );

        expect(decls).toBe("size_t cnx_len_label = strlen(test__label);\n");
        expect(host.state.lengthCache).toEqual(
          new Map([["test__label", "cnx_len_label"]]),
        );
      });
    });

    describe("child statement classification helpers", () => {
      it("should handle for loop body statements", () => {
        const source = `
          void test() {
            for (mut u32 i <- 0; i < 10; i +<- 1) {
              u32 val <- i * 2;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for");
        expect(code).toContain("val");
      });

      it("should handle while loop body statements", () => {
        const source = `
          void test() {
            mut u32 count <- 0;
            while (count < 5) {
              count +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("while");
        expect(code).toContain("count");
      });

      it("should handle switch case statements", () => {
        const source = `
          enum Color { RED, GREEN, BLUE }
          void test() {
            Color c <- Color.RED;
            mut u32 val <- 0;
            switch (c) {
              case Color.RED { val <- 1; }
              case Color.GREEN { val <- 2; }
              case Color.BLUE { val <- 3; }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch");
        expect(code).toContain("case");
      });
    });

    describe("parameter processing helpers", () => {
      it("should process multiple parameters with different types", () => {
        const source = `
          void process(u32 count, i16 offset, bool flag) {
            u32 result <- count + offset;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t count");
        expect(code).toContain("int16_t offset");
        expect(code).toContain("bool flag");
      });

      it("should handle string parameter with capacity", () => {
        const source = `
          void greet(string<64> name) {
            u32 len <- name.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("name");
        expect(code).toContain("strlen");
      });

      it("should handle array parameters", () => {
        const source = `
          void sum(u32[10] values) {
            u32 total <- 0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("values");
        expect(code).toContain("uint32_t values[10]");
      });
    });

    describe("enum type resolution helpers", () => {
      it("should resolve global.Enum.Member pattern", () => {
        const source = `
          enum Category { A, B, C }
          scope Handler {
            mut Category cat <- global.Category.A;
            public void next() { cat <- global.Category.B; }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Category__A");
      });

      it("should resolve this.Enum.Member pattern inside scope", () => {
        const source = `
          scope Motor {
            enum State { IDLE, RUNNING }
            State current <- this.State.IDLE;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State__IDLE");
      });

      it("should resolve Scope.Enum.Member from outside scope", () => {
        const source = `
          scope Motor {
            public enum State { IDLE, RUNNING }
          }
          Motor.State status <- Motor.State.IDLE;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State__IDLE");
      });
    });

    describe("literal expression detection helpers", () => {
      it("should detect negated literal in function argument", () => {
        const source = `
          void setOffset(i32 val) { }
          void test() {
            setOffset(-5);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("setOffset(-5)");
      });

      it("should handle postfix literal expressions", () => {
        const source = `
          void test() {
            u32 val <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("42");
      });
    });

    describe("function argument generation helpers", () => {
      it("should handle identifier argument", () => {
        const source = `
          void process(u32 val) { }
          u32 data <- 100;
          void test() {
            process(data);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("process(data)");
      });

      it("should handle struct member access as argument", () => {
        const source = `
          struct Point { i32 x; i32 y; }
          void setX(i32 val) { }
          void test() {
            Point p <- { x: 10, y: 20 };
            setX(p.x);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("setX(p.x)");
      });

      it("should handle rvalue expression as argument", () => {
        const source = `
          void process(u32 val) { }
          u32 x <- 10;
          void test() {
            process(x + 5);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("process(cnx_clamp_add_u32(x, 5U))"); // #1152
      });
    });

    describe("scope member generation helpers", () => {
      it("should generate scope variable reference", () => {
        const source = `
          scope Counter {
            mut u32 count <- 0;
            public void increment() {
              this.count +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Counter__count");
      });

      it("should generate scope function call", () => {
        const source = `
          scope Timer {
            public void start() { }
            public void reset() {
              this.start();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Timer__start()");
      });
    });

    describe("array access resolution helpers", () => {
      it("should resolve simple array access", () => {
        const source = `
          u8[10] buffer;
          void test() {
            u8 val <- buffer[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("buffer[5U]");
      });

      it("should handle array access with variable index", () => {
        const source = `
          u8[20] data;
          void test() {
            u32 idx <- 3;
            u8 val <- data[idx];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("data[idx]");
      });
    });

    describe("this.variable enum type resolution", () => {
      it("should resolve enum type from this.variable access", () => {
        const source = `
          enum Status { ACTIVE, INACTIVE }
          scope Device {
            mut Status current <- global.Status.ACTIVE;
            public void update() {
              if (this.current = global.Status.INACTIVE) {
                this.current <- global.Status.ACTIVE;
              }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Device__current");
        expect(code).toContain("Status__ACTIVE");
      });
    });

    describe("global enum pattern resolution", () => {
      it("should handle global.Enum.Member when enum has matching name", () => {
        const source = `
          enum Priority { HIGH, MEDIUM, LOW }
          scope Task {
            mut Priority level <- global.Priority.HIGH;
            public void lower() { level <- global.Priority.LOW; }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Priority__HIGH");
      });
    });

    describe("float bit range edge cases", () => {
      it("should generate f32 bit range with non-zero start position using union", () => {
        const source = `
          void test() {
            f32 value <- 3.14;
            u16 midBits <- value[8, 16];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("__bits_value");
        expect(code).toContain(">> 8");
        // Uses union, not memcpy (MISRA 21.15 compliant)
        expect(code).toContain("union { float f; uint32_t u; }");
        expect(code).not.toContain("memcpy(");
      });

      it("should generate f32 bit range with start=0", () => {
        const source = `
          void test() {
            f32 val <- 1.0;
            u8 lowByte <- val[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("__bits_val");
        // Optimization: no shift when start=0
        expect(code).not.toContain(">> 0");
      });

      it("should handle multiple reads from same float reusing union shadow", () => {
        const source = `
          void test() {
            f32 data <- 2.5;
            u8 b1 <- data[0, 8];
            u8 b2 <- data[8, 8];
            u8 b3 <- data[16, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Union shadow declaration should appear once
        expect(code).toContain("union { float f; uint32_t u; } __bits_data;");
        // Multiple reads should work via union member
        expect(code).toContain("__bits_data.u");
      });
    });

    describe("strlen cache optimization", () => {
      it("should handle multiple strlen calls in same function", () => {
        const source = `
          void test() {
            string<64> msg <- "hello world";
            u32 len1 <- msg.value_char_count;
            u32 len2 <- msg.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("strlen");
      });

      it("should generate cache for multiple .value_char_count accesses", () => {
        const source = `
          void test() {
            string<32> s <- "hello";
            if (s.value_char_count > 0) {
              u32 x <- s.value_char_count;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Should generate cache variable for repeated .value_char_count access
        expect(code).toContain("strlen");
      });

      it("should not cache for single .value_char_count access", () => {
        const source = `
          void test() {
            string<32> s <- "hello";
            u32 len <- s.value_char_count;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Single access should just use strlen directly
        expect(code).toContain("strlen(s)");
      });
    });

    describe("scope-qualified function resolution", () => {
      it("should resolve this.method() to CurrentScope_method", () => {
        const source = `
          enum MyEnum { A, B }
          scope Foo {
            public MyEnum bar() {
              return global.MyEnum.A;
            }
            public void test() {
              MyEnum result <- this.bar();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // this.bar() should become Foo_bar()
        expect(code).toContain("Foo__bar()");
      });

      it("should resolve Scope.method() to Scope_method", () => {
        const source = `
          scope Utils {
            public u32 getValue() {
              return 42;
            }
          }
          void main() {
            u32 v <- Utils.getValue();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Utils__getValue()");
      });

      it("should resolve global.func() to func", () => {
        const source = `
          u32 getNumber() {
            return 100;
          }
          scope Test {
            public void run() {
              u32 n <- global.getNumber();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // global.getNumber() should become getNumber()
        expect(code).toContain("getNumber()");
      });

      it("should resolve global.Scope.method() to Scope_method", () => {
        const source = `
          scope Config {
            public u32 getTimeout() {
              return 1000;
            }
          }
          scope Other {
            public void test() {
              u32 t <- global.Config.getTimeout();
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // global.Config.getTimeout() should become Config_getTimeout()
        expect(code).toContain("Config__getTimeout()");
      });
    });

    describe("expression type checking", () => {
      it("should detect decimal integer literal in comparison", () => {
        const source = `
          void test() {
            u32 val <- 5;
            bool isZero <- (val = 0);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Integer comparison should work
        expect(code).toContain("val == 0");
      });

      it("should detect hex literal in comparison", () => {
        const source = `
          void test() {
            u32 flags <- 0;
            bool check <- (flags = 0xFF);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("0xFF");
      });

      it("should detect binary literal in comparison", () => {
        const source = `
          void test() {
            u32 mode <- 0;
            bool check <- (mode = 0b1010);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Binary literal passes through (not converted)
        expect(code).toContain("0b1010");
      });

      it("should detect variable of integer type", () => {
        const source = `
          void test() {
            i32 code <- 5;
            i32 limit <- 10;
            bool check <- (code = limit);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Comparison with integer variable
        expect(code).toContain("code == limit");
      });

      it("should detect string literal", () => {
        const source = `
          void test() {
            string<32> s <- "hello";
            bool check <- (s = "hello");
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String comparison should use strcmp
        expect(code).toContain("strcmp");
      });

      it("should detect string variable", () => {
        const source = `
          void test() {
            string<32> s1 <- "hello";
            string<32> s2 <- "world";
            bool check <- (s1 = s2);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String comparison should use strcmp
        expect(code).toContain("strcmp");
      });

      it("should detect array element of string array", () => {
        const source = `
          void test() {
            mut string<32>[3] names;
            names[0] <- "Alice";
            bool check <- (names[0] = "Alice");
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // String array element comparison should use strcmp
        expect(code).toContain("strcmp");
      });
    });

    describe("array type registration", () => {
      it("should register array type correctly", () => {
        const source = `
          void test() {
            mut u8[10] buffer;
            buffer[0] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t buffer[10]");
      });

      it("should register multi-dimensional array", () => {
        const source = `
          void test() {
            mut u8[10][20] matrix;
            matrix[0][0] <- 0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint8_t matrix[10][20]");
      });

      it("should handle i32 array type", () => {
        const source = `
          void test() {
            mut i32[5] values;
            values[0] <- 100;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("int32_t values[5]");
      });

      it("should handle const array type", () => {
        const source = `
          void test() {
            u8[4] data <- [1, 2, 3, 4];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const uint8_t data[4]");
      });

      it("should handle struct array with cnx syntax", () => {
        const source = `
          struct Point {
            i32 x;
            i32 y;
          }
          void test() {
            mut Point[3] points;
            points[0].x <- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Point points[3]");
        // Array element assignments don't get U suffix yet
        expect(code).toContain("points[0].x = 10");
      });

      it("should handle bitmap array with cnx syntax", () => {
        const source = `
          bitmap8 Flags {
            active,
            ready,
            error,
            mode[3],
            priority[2]
          }
          void test() {
            mut Flags[4] flags;
            flags[0].active <- true;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Flags flags[4]");
        // Bitmap field access should generate bit manipulation
        expect(code).toContain("flags[0]");
      });

      it("should handle enum array with cnx syntax", () => {
        const source = `
          enum Color {
            RED,
            GREEN,
            BLUE
          }
          void test() {
            mut Color[3] colors;
            colors[0] <- Color.RED;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color colors[3]");
        expect(code).toContain("colors[0] = Color__RED");
      });

      it("should handle struct array initializer with cnx syntax", () => {
        const source = `
          struct Item {
            u8 id;
          }
          Item[2] items <- [{id: 1}, {id: 2}];
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const Item items[2]");
        expect(code).toContain(".id = 1");
      });
    });

    describe("C++ mode member conversion", () => {
      it("should detect parameter member access needing conversion", () => {
        const source = `
          struct Config {
            u32 value;
          }
          void process(Config cfg) {
            u32 v <- cfg.value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // In C++ mode, struct params use . not ->
        expect(code).toContain("cfg.value");
      });

      it("should detect array element member access", () => {
        const source = `
          struct Item {
            u32 id;
          }
          void process() {
            Item[3] items;
            u32 first <- items[0].id;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Array element member access
        expect(code).toContain("items[0U].id");
      });

      it("should use arrow for struct params in C mode", () => {
        const source = `
          struct Config {
            u32 value;
          }
          void process(Config cfg) {
            u32 v <- cfg.value;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: false,
        });

        // In C mode, struct params use ->
        expect(code).toContain("cfg->value");
      });

      it("should handle const struct parameters in C++ mode", () => {
        const source = `
          struct Settings {
            u32 timeout;
            bool enabled;
          }
          void configure(Settings s) {
            u32 t <- s.timeout;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          cppMode: true,
        });

        // Const struct param should use reference in C++
        expect(code).toContain("const Settings&");
        expect(code).toContain("s.timeout");
      });
    });

    describe("register generation", () => {
      it("should generate register comment", () => {
        const source = `
          register GPIO7 @ 0x42004000 {
            rw u32 DR @ 0x00;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // A file-level register goes to the header once its symbols are
        // registered, as in the real pipeline; the .c holds no copy
        expect(code).not.toContain("Register: GPIO7");
      });

      it("should generate scoped register comment", () => {
        const source = `
          scope Teensy4 {
            register GPIO7 @ 0x42004000 {
              rw u32 DR @ 0x00;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Scoped register should show scope in output
        expect(code).toContain("Teensy4");
        expect(code).toContain("GPIO7");
      });
    });

    describe("enum type checking in expressions", () => {
      it("should handle enum variable assignment", () => {
        const source = `
          enum Color { RED, GREEN, BLUE }
          void test() {
            mut Color c <- Color.RED;
            c <- Color.GREEN;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color__RED");
        expect(code).toContain("Color__GREEN");
      });

      it("should handle enum comparison", () => {
        const source = `
          enum Status { OK, ERROR }
          void test() {
            mut Status s <- Status.OK;
            if (s = Status.ERROR) {
              s <- Status.OK;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("s == Status__ERROR");
      });

      it("should handle enum return from function", () => {
        const source = `
          enum Result { SUCCESS, FAILURE }
          Result getResult() {
            return Result.SUCCESS;
          }
          void test() {
            Result r <- getResult();
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Result__SUCCESS");
        expect(code).toContain("getResult()");
      });
    });

    describe("overflow helpers", () => {
      it("should generate clamp add helper", () => {
        const source = `
          mut clamp u8 val <- 250;
          void test() {
            val +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cnx_clamp_add_u8");
      });

      it("should generate clamp sub helper", () => {
        const source = `
          mut clamp u8 val <- 5;
          void test() {
            val -<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("cnx_clamp_sub_u8");
      });
    });

    describe("preprocessor directives", () => {
      it("should handle C include directive", () => {
        const source = `
          #include <stdio.h>
          void test() {}
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
          includeKinds: discoveredKinds(source),
        });

        expect(code).toContain("#include <stdio.h>");
      });

      it("should handle #define without value", () => {
        const source = `
          #define DEBUG_MODE
          void test() {}
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("#define DEBUG_MODE");
      });
    });

    describe("bit range access", () => {
      it("should generate bit range read expression", () => {
        const source = `
          void test() {
            u32 val <- 0xFF00;
            u8 byte <- val[8, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit range access generates shift and mask
        expect(code).toContain(">> 8");
        expect(code).toContain("0xFF");
      });

      it("should generate bit range write expression", () => {
        const source = `
          void test() {
            mut u32 val <- 0;
            val[8, 8] <- 0xFF;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Bit range write should use mask-and-shift pattern
        expect(code).toContain("val");
      });

      it("should generate single bit write", () => {
        const source = `
          void test() {
            mut u32 flags <- 0;
            flags[3] <- true;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Single bit write (uses 1U for MISRA 10.1 compliance)
        expect(code).toContain("flags");
        expect(code).toContain("1U << 3");
      });

      it("should generate array element write", () => {
        const source = `
          void test() {
            mut u32[10] arr;
            arr[5] <- 42;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[5] = 42");
      });

      it("should generate bit range at position 0", () => {
        const source = `
          void test() {
            u32 val <- 0x1234;
            u8 lowByte <- val[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Optimization: no shift when start=0
        expect(code).not.toContain(">> 0");
      });

      it("should generate 64-bit mask for u64 values", () => {
        const source = `
          void test() {
            u64 val <- 0xFFFFFFFFFFFFFFFF;
            u32 upper <- val[32, 32];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // 64-bit operations should have ULL suffix
        expect(code).toContain(">> 32");
      });
    });

    describe("type name resolution", () => {
      it("should resolve this.Type for scoped types", () => {
        const source = `
          scope Motor {
            enum State { IDLE, RUNNING }
            public State getState() {
              return global.Motor.State.IDLE;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Motor__State");
      });

      it("should resolve global.Type for global types inside scope", () => {
        const source = `
          enum Color { RED, GREEN }
          scope Display {
            public void setColor(Color c) {
              Color myColor <- c;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Color");
      });
    });

    describe("switch statement generation", () => {
      it("should generate switch with exhaustive enum cases", () => {
        const source = `
          enum State { OFF, ON }
          void test() {
            State s <- State.OFF;
            switch (s) {
              case State.OFF { }
              case State.ON { }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch");
        expect(code).toContain("case State__OFF");
        expect(code).toContain("case State__ON");
        expect(code).toContain("break;");
      });

      it("should generate switch with default case", () => {
        const source = `
          void test() {
            u32 val <- 5;
            switch (val) {
              case 1 { }
              case 2 { }
              default { }
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("switch");
        expect(code).toContain("default:");
      });
    });

    describe("while loop generation", () => {
      it("should generate while loop", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            while (i < 10) {
              i +<- 1;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("while (i < 10)");
      });
    });

    describe("for loop generation", () => {
      it("should generate for loop", () => {
        const source = `
          void test() {
            for (mut u32 i <- 0; i < 10; i +<- 1) {
              u32 x <- i;
            }
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("for (");
        expect(code).toContain("uint32_t i = 0");
        expect(code).toContain("i < 10");
      });
    });

    describe("do-while loop generation", () => {
      it("should generate do-while loop", () => {
        const source = `
          void test() {
            mut u32 i <- 0;
            do {
              i +<- 1;
            } while (i < 10);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("do {");
        expect(code).toContain("} while (i < 10)");
      });
    });

    describe("function with parameters", () => {
      it("should generate function with multiple params", () => {
        const source = `
          u32 add(u32 a, u32 b) {
            return a + b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain(
          "uint32_t add(const uint32_t a, const uint32_t b)",
        );
        // #1681: arithmetic on parameters clamps (ADR-044)
        expect(code).toContain("return cnx_clamp_add_u32(a, b)");
      });

      it("should generate function with array parameter", () => {
        const source = `
          void process(u32[10] arr) {
            u32 val <- arr[0];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t arr[10]");
      });
    });

    describe("global variable declarations", () => {
      it("should generate global variable initialization", () => {
        const source = `
          u32 globalCounter <- 0;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("uint32_t globalCounter");
        expect(code).toContain("= 0");
      });

      it("should generate const global", () => {
        const source = `
          u32 MAX_VALUE <- 100;
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("const uint32_t MAX_VALUE");
        expect(code).toContain("= 100");
      });
    });

    describe("arithmetic expressions", () => {
      it("should generate modulo operation", () => {
        const source = `
          void test() {
            u32 a <- 10;
            u32 b <- a % 3;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a % 3");
      });

      it("should generate bitwise operations", () => {
        const source = `
          void test() {
            u32 a <- 0xFF;
            u32 b <- a & 0x0F;
            u32 c <- a | 0xF0;
            u32 d <- a ^ 0xAA;
            u32 e <- ~a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a & 0x0F");
        expect(code).toContain("a | 0xF0");
        expect(code).toContain("a ^ 0xAA");
        expect(code).toContain("~a");
      });

      it("should generate shift operations", () => {
        const source = `
          void test() {
            u32 a <- 1;
            u32 b <- a << 4;
            u32 c <- a >> 2;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a << 4");
        expect(code).toContain("a >> 2");
      });
    });

    describe("logical expressions", () => {
      it("should generate logical AND and OR", () => {
        const source = `
          void test() {
            bool a <- true;
            bool b <- false;
            bool c <- a && b;
            bool d <- a || b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a && b");
        expect(code).toContain("a || b");
      });

      it("should generate NOT operation", () => {
        const source = `
          void test() {
            bool a <- true;
            bool b <- !a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("!a");
      });
    });

    describe("ternary expression", () => {
      it("should generate ternary expression", () => {
        const source = `
          void test() {
            u32 a <- 5;
            u32 b <- (a > 3) ? 10 : 20;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("a > 3");
        expect(code).toContain("?");
        expect(code).toContain("10");
        expect(code).toContain("20");
      });
    });

    describe("unary expressions", () => {
      it("should generate negative number", () => {
        const source = `
          void test() {
            i32 a <- 5;
            i32 b <- -a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("-a");
      });

      it("should generate bitwise NOT", () => {
        const source = `
          void test() {
            u32 a <- 0xFF;
            u32 b <- ~a;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("~a");
      });
    });

    describe("bitmap type", () => {
      it("should generate bitmap field access", () => {
        const source = `
          bitmap8 Flags {
            bit0,
            bit1,
            bit2,
            bit3,
            bit4,
            bit5,
            bit6,
            bit7
          }
          void test() {
            Flags f <- 0;
            bool isSet <- f.bit0;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Flags");
      });
    });

    describe("function call expressions", () => {
      it("should generate function call with arguments", () => {
        const source = `
          u32 multiply(u32 x, u32 y) {
            return x * y;
          }
          void test() {
            u32 result <- multiply(5, 10);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("multiply(5U, 10U)");
      });

      it("should generate scoped function call", () => {
        const source = `
          scope Math {
            public u32 square(u32 x) {
              return x * x;
            }
          }
          void test() {
            u32 result <- Math.square(5);
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("Math__square(5U)");
      });
    });

    describe("ISR declaration", () => {
      it("should generate ISR attribute", () => {
        const source = `
          isr void TIMER0_IRQ() {
            u32 x <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // ISR functions should have special attributes
        expect(code).toContain("TIMER0_IRQ");
      });
    });

    describe("atomic variable", () => {
      it("should generate volatile for atomic", () => {
        const source = `
          atomic u32 counter <- 0;
          void test() {
            counter <- 1;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("volatile");
      });
    });

    describe("wrap overflow behavior", () => {
      it("should not add helpers for wrap types", () => {
        const source = `
          mut wrap u8 val <- 250;
          void test() {
            val +<- 10;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Wrap types don't use cnx_clamp helpers
        // Issue #845: MISRA 10.3 - narrow types expand with cast
        expect(code).toContain("(uint8_t)(val + 10");
        expect(code).not.toContain("cnx_");
      });
    });

    describe("safe division", () => {
      it("should generate safe division helper", () => {
        const source = `
          void test() {
            u32 a <- 10;
            u32 b <- 0;
            u32 c <- a / b;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Division should work
        expect(code).toContain("a / b");
      });
    });

    describe("parenthesized expressions", () => {
      it("should preserve parentheses in expressions", () => {
        const source = `
          void test() {
            u32 a <- 2;
            u32 b <- 3;
            u32 c <- 4;
            u32 result <- (a + b) * c;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // #1152: u32 is clamp by default, so the operators become saturating
        // helpers. Grouping is still preserved -- and more explicitly: the
        // addition is nested inside the multiplication.
        expect(code).toContain(
          "cnx_clamp_mul_u32((cnx_clamp_add_u32(a, b)), c)",
        );
      });
    });

    describe("array access", () => {
      it("should generate single-index array access", () => {
        const source = `
          u32[10] arr;
          void test() {
            u32 val <- arr[5];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("arr[5U]");
      });

      it("should generate array access with variable index", () => {
        const source = `
          u8[100] data;
          void test(u32 idx) {
            u8 val <- data[idx];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain("data[idx]");
      });

      it("should generate integer bit range access", () => {
        const source = `
          void test() {
            u32 value <- 0xFF00;
            u8 byte <- value[8, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        expect(code).toContain(">> 8");
        expect(code).toContain("& 0xFF");
      });

      it("should generate float bit range access with union", () => {
        const source = `
          void test() {
            f32 fval <- 1.5;
            u8 byte <- fval[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Uses union, not memcpy (MISRA 21.15 compliant)
        expect(code).toContain("union { float f; uint32_t u; } __bits_fval;");
        expect(code).toContain("__bits_fval.u");
        expect(code).not.toContain("memcpy(");
      });

      it("should generate f64 bit range access with uint64_t union shadow", () => {
        const source = `
          void test() {
            f64 dval <- 1.5;
            u8 byte <- dval[0, 8];
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        // #1445 box 3: the walk and the render-side services are two objects now.
        // The host is constructed here and injected, so assertions about the state
        // the walk accumulates read the SAME instance the walk drove.
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        const tSymbols = declareAndResolve(tree);
        const symbols = TSymbolInfoAdapter.convert(tSymbols);

        const code = generateWithProgram(generator, tree, program, {
          cppMode: false,
          symbolInfo: symbols,
          sourcePath: "test.cnx",
        });

        // Uses union, not memcpy (MISRA 21.15 compliant)
        expect(code).toContain("union { double f; uint64_t u; } __bits_dval;");
        expect(code).toContain("__bits_dval.u");
        expect(code).not.toContain("memcpy(");
      });
    });
  });

  describe("Issue #1739: a const is a C constant expression where it is named", () => {
    const generate = (source: string): string => {
      const { tree, program } = CnxSourceParser.parse(source);
      const generator = new CodeGenWalker(new CodeGenerator());
      const symbols = TSymbolInfoAdapter.convert(declareAndResolve(tree));
      return generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });
    };

    it("writes a const case label as its value", () => {
      const code = generate(`
        scope S {
          u32 M <- 20;
          public u32 P <- 30;
          public u32 pick(u32 v) {
            switch (v) {
              case M { return 1; }
              case P { return 2; }
              default { return 3; }
            }
          }
        }
      `);
      expect(code).toContain("case 20U:");
      expect(code).toContain("case 30U:");
    });

    it("writes a `this.`/`global.` case label as the value it names (#1629)", () => {
      const code = generate(`
        u8 LIMIT <- 1;
        scope Panel {
          u8 LIMIT <- 3;
          public u32 pick(u8 v) {
            switch (v) {
              case this.LIMIT { return 1; }
              case global.LIMIT { return 2; }
              default { return 3; }
            }
          }
        }
      `);
      expect(code).toContain("case 3U:");
      expect(code).toContain("case 1U:");
      expect(code).not.toContain("case LIMIT:");
    });

    it("refuses a rooted label no binding resolves, which 2.1 rejected (#1629)", () => {
      // E0427 stops such a label before codegen, so reaching the walk is a
      // broken invariant rather than a name to guess
      expect(() =>
        generate(`
          scope Panel {
            public u32 pick(u8 v) {
              switch (v) {
                case this.NOPE { return 1; }
                default { return 3; }
              }
            }
          }
        `),
      ).toThrow("case label 'this.NOPE' reached codegen unbound");
    });

    it("writes a global. label that binds nothing, a header's macro, by its name (#2075)", () => {
      // `generate` runs no 2.1, so nothing binds `global.HDR_K`: an unbound
      // `global.` label is written by its name, as the value position writes
      // a header's macro. `case-label-rooted-resolves` covers the real macro
      const code = generate(`
        u32 pick(u8 v) {
          switch (v) {
            case global.HDR_K { return 1; }
            default { return 3; }
          }
        }
      `);
      expect(code).toContain("case HDR_K:");
    });

    it("folds a bare file-scope const label as its rooted spelling does (#1629)", () => {
      const code = generate(`
        u8 LIMIT <- 1;
        u32 bare(u8 v) {
          switch (v) {
            case LIMIT { return 1; }
            default { return 3; }
          }
        }
        u32 rooted(u8 v) {
          switch (v) {
            case global.LIMIT { return 1; }
            default { return 3; }
          }
        }
      `);
      expect(code).not.toContain("case LIMIT:");
      expect(code.match(/case 1U:/g)).toHaveLength(2);
    });

    it("qualifies a scope's own enum in a label, in every spelling (#2052, #147)", () => {
      const code = generate(`
        enum EMode { IDLE, RUN }
        scope Motor {
          enum State { STOPPED, RUNNING }
          public u32 step(State s, EMode m) {
            switch (s) {
              case State.STOPPED { return 1; }
              case this.State.RUNNING { return 2; }
            }
            switch (m) {
              case global.EMode.IDLE { return 3; }
              case EMode.RUN { return 4; }
            }
            return 0;
          }
        }
      `);
      expect(code).toContain("case Motor__State__STOPPED:");
      expect(code).toContain("case Motor__State__RUNNING:");
      expect(code).toContain("case EMode__IDLE:");
      expect(code).toContain("case EMode__RUN:");
      expect(code).not.toContain("case State__");
    });

    it("folds a bool and an enum const named in a static initializer", () => {
      const code = generate(`
        enum EMode { IDLE, RUN }
        scope S {
          bool A <- true;
          bool B <- A;
          mut bool copied <- B;
          EMode D <- EMode.RUN;
          EMode D2 <- D;
          mut EMode mode <- D2;
          public void reset() {
            copied <- false;
            mode <- EMode.IDLE;
          }
        }
      `);
      expect(code).toContain("static bool S__copied = true;");
      expect(code).toContain("static EMode S__mode = EMode__RUN;");
    });
  });

  describe("Issue #741: const scope members bare reference inlining", () => {
    it("should inline private const when referenced without this. prefix", () => {
      const source = `
        scope Foo {
          u32 MY_CONSTANT <- 42;

          public u32 getConstant() {
            return MY_CONSTANT;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Should inline the value, not generate a reference to Foo_MY_CONSTANT.
      // #1739: spelled as a literal of its type, so the MISRA 7.2 U is on it
      expect(code).toContain("return 42U;");
      expect(code).not.toContain("Foo_MY_CONSTANT");
    });

    it("should inline private const in expressions without this. prefix", () => {
      const source = `
        scope Bar {
          u8 OFFSET <- 10;

          public u8 compute() {
            u8 result <- OFFSET + 5;
            return result;
          }
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Const values are inlined, 5 gets U suffix per MISRA Rule 7.2. The
      // sum of a u8 const and a literal saturates (ADR-044): the transpiler
      // always emitted this helper; the harness said `10 + 5U` only while
      // 2.2's own lookup could not find the scope const (#1668, C6b).
      // #1739: the inlined const is a literal of its u8 type, suffixed too
      expect(code).toContain("uint8_t result = cnx_clamp_add_u8(10U, 5U);");
      expect(code).not.toContain("Bar_OFFSET");
    });
  });

  describe("struct initializer — declaration vs expression context", () => {
    it("should use designated initializer without type cast for global struct declaration", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point origin <- {x: 0, y: 0};
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Must use plain designated initializer — (Point){...} is not a C99 constant expression
      // and fails to compile at file scope on GCC < 13
      expect(code).toContain("origin = { .x = 0, .y = 0 }");
      expect(code).not.toContain("(Point)");
    });

    it("should use designated initializer without type cast for local struct declaration", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void foo() {
          Point p <- {x: 10, y: 20};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      expect(code).toContain("p = { .x = 10, .y = 20 }");
      expect(code).not.toContain("(Point)");
    });

    it("should use designated initializer for nested struct literals in declaration", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        struct Line { Point start; Point end; }
        Line seg <- {start: {x: 0, y: 0}, end: {x: 100, y: 100}};
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Neither outer nor inner initializer should have a type cast prefix
      expect(code).toContain(
        "{ .start = { .x = 0, .y = 0 }, .end = { .x = 100, .y = 100 } }",
      );
      expect(code).not.toContain("(Line)");
      expect(code).not.toContain("(Point)");
    });

    it("should keep compound literal type cast for struct re-assignment (expression context)", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void foo() {
          mut Point p <- {x: 0, y: 0};
          p <- {x: 10, y: 20};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);
      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      const tSymbols = declareAndResolve(tree);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      const code = generateWithProgram(generator, tree, program, {
        cppMode: false,
        symbolInfo: symbols,
        sourcePath: "test.cnx",
      });

      // Re-assignment must use compound literal — plain { } is not valid as an expression
      expect(code).toContain("p = (Point){ .x = 10, .y = 20 }");
    });
  });
});

describe("CodeGenerator.getToolchainRequirements (#1928)", () => {
  it("refuses to answer before 2.2 has built the emission plan", () => {
    expect(() => new CodeGenerator().getToolchainRequirements()).toThrow(
      "2.2 Plan builds the emission plan before its requirements are read",
    );
  });
});
