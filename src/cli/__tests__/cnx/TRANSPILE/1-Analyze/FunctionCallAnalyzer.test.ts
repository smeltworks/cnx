/**
 * Unit tests for FunctionCallAnalyzer
 * Tests define-before-use enforcement for functions (ADR-030)
 */
import { describe, it, expect } from "vitest";
import FunctionCallAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/FunctionCallAnalyzer";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";
import TTypeUtils from "../../../../../cnx/utils/TTypeUtils";
import type IFunctionSymbol from "../../../../../cnx/types/symbols/IFunctionSymbol";
import TestSymbolUtils from "../../../../../cnx/PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * The analyzer over `source`, with the real 2.1 context production builds for
 * it (#1866). Production never constructs one without a context, so a test
 * that did was asserting behavior the transpiler cannot have.
 */
function analyzerFor(source: string, symbolTable?: SymbolTable) {
  const analysis = testAnalysisContextFor(source, {
    symbolTable,
    cppMode: false,
  });
  return {
    syntax: analysis.syntax,
    analyzer: new FunctionCallAnalyzer(analysis.context),
  };
}

describe("FunctionCallAnalyzer", () => {
  // #1991: the walk reads 1.2's syntax, so each place a call can stand is
  // listed here rather than found by a tree walk that visits them all.
  describe("every position 1.2 records, in source order", () => {
    function calls(code: string) {
      const { syntax, analyzer } = analyzerFor(code);
      return analyzer
        .analyze(syntax)
        .map((e) => [e.code, e.functionName, e.span.line]);
    }

    it("checks a call nested in a statement's body", () => {
      expect(
        calls(
          `void main() {\n  if (true) {\n    later();\n  }\n}\nvoid later() { }`,
        ),
      ).toEqual([["E0422", "later", 3]]);
    });

    it("makes a for-loop variable of a callable type callable in the loop", () => {
      expect(
        calls(
          `void tick() { }\nvoid main() {\n  for (ISR cb <- tick; false; cb <- tick) {\n    cb();\n  }\n}`,
        ),
      ).toEqual([]);
    });

    it("checks a call outside any function, in an enum value", () => {
      expect(
        calls(`enum EMode { A <- later() }\nu32 later() { return 0; }`),
      ).toEqual([["E0422", "later", 1]]);
    });
  });

  // ========================================================================
  // Define Before Use
  // ========================================================================

  describe("define before use", () => {
    it("should allow calling defined before use", () => {
      const code = `
        void helper() {
          u32 x <- 5;
        }
        void main() {
          helper();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should detect called before definition", () => {
      const code = `
        void main() {
          helper();
        }
        void helper() {
          u32 x <- 5;
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
    });

    it("should detect undefined", () => {
      const code = `
        void main() {
          unknownFunc();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
    });
  });

  // ========================================================================
  // Self-Recursion Detection (MISRA C:2012 Rule 17.2)
  // ========================================================================

  describe("self-recursion detection", () => {
    it("should detect direct self-recursion", () => {
      const code = `
        void factorial(u32 n) {
          factorial(n - 1);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0423");
      expect(errors[0].message).toContain("recursive call");
      expect(errors[0].message).toContain("MISRA");
    });

    it("should allow calling other procedures with similar names", () => {
      const code = `
        void helper() {
          u32 x <- 5;
        }
        void process() {
          helper();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Scope Handling
  // ========================================================================

  describe("scope handling", () => {
    it("should resolve scope member calls", () => {
      const code = `
        scope LED {
          public void on() {
            u32 x <- 1;
          }
        }
        void main() {
          LED.on();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should detect undefined scope member", () => {
      const code = `
        scope LED {
          public void on() {
            u32 x <- 1;
          }
        }
        void main() {
          LED.off();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
    });

    it("should allow this.name() qualified calls within scope", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsHelper() {
            this.helper();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should detect undefined method via this.methodName()", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsUndefined() {
            this.undefinedMethod();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
    });

    // ADR-057: With implicit scope resolution, bare function calls to scope functions
    // are now allowed (resolve automatically). This test verifies no error is thrown.
    it("should allow unqualified scope function calls (ADR-057 implicit resolution)", () => {
      const code = `
        scope Test {
          void helper() {
            u32 x <- 1;
          }

          public void callsHelper() {
            helper();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      // ADR-057: Implicit resolution allows bare scope function calls
      expect(errors).toHaveLength(0);
    });

    it("should not suggest this. for truly undefined in scope", () => {
      const code = `
        scope Test {
          public void callsUnknown() {
            unknownFunc();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
      expect(errors[0].message).not.toContain("this.");
    });

    it("should not suggest this. for calls outside scope", () => {
      const code = `
        scope Test {
          public void helper() {
            u32 x <- 1;
          }
        }

        void main() {
          helper();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain("called before definition");
      expect(errors[0].message).not.toContain("this.");
    });
  });

  // ========================================================================
  // Built-in Procedures
  // ========================================================================

  describe("built-in procedures", () => {
    it("should allow safe_div built-in", () => {
      const code = `
        void main() {
          u32 result;
          safe_div(result, 10, 0, 0);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow safe_mod built-in", () => {
      const code = `
        void main() {
          u32 result;
          safe_mod(result, 10, 0, 0);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Standard Library
  // ========================================================================

  describe("standard library", () => {
    it("should allow printf with stdio.h included", () => {
      const code = `
        #include <stdio.h>
        void main() {
          printf("Hello");
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should detect printf without stdio.h", () => {
      const code = `
        void main() {
          printf("Hello");
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
    });

    it("should allow strlen with string.h included", () => {
      const code = `
        #include <string.h>
        void main() {
          u32 len <- strlen("test");
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow math operations with math.h included", () => {
      const code = `
        #include <math.h>
        void main() {
          f64 x <- sin(3.14);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // External C/C++ (Symbol Table)
  // ========================================================================

  describe("external via symbol table", () => {
    it("should allow external C from symbol table", () => {
      const code = `
        void main() {
          myExternalFunc();
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "myExternalFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "external.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow external C++ from symbol table", () => {
      const code = `
        void main() {
          cppHelper();
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCppSymbol({
        name: "cppHelper",
        unqualifiedName: "cppHelper",
        kind: "function",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "helper.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // ISR and Callback Variables (ADR-040)
  // ========================================================================

  describe("ISR and callback variables", () => {
    it("should allow invoking ISR-typed variable", () => {
      const code = `
        void myHandler() {
          u32 x <- 1;
        }
        void main() {
          ISR handler <- myHandler;
          handler();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow invoking ISR-typed parameter", () => {
      const code = `
        void myHandler() {
          u32 x <- 1;
        }
        void execute(ISR callback) {
          callback();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Multiple Errors
  // ========================================================================

  describe("multiple errors", () => {
    it("should detect multiple undefined", () => {
      const code = `
        void main() {
          foo();
          bar();
          baz();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(3);
    });
  });

  // ========================================================================
  // Error Details
  // ========================================================================

  describe("error details", () => {
    it("should report correct line and column", () => {
      const code = `void main() {
  unknownFunc();
}`;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors[0].span.line).toBe(2);
      expect(errors[0].span.column).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Global Prefix Hints (Issue #787)
  // ========================================================================

  describe("global prefix hints", () => {
    it("should suggest global. for stdlib function without direct include", () => {
      // isnan is in math.h but header not included - suggest global.isnan()
      const code = `
        void main() {
          f32 x <- 1.0;
          bool result <- isnan(x);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("global.isnan()");
    });

    it("should suggest global. for external func in symbol table", () => {
      // External func exists in symbol table but not directly accessible
      const code = `
        void main() {
          customExternalFunc();
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCppSymbol({
        name: "customExternalFunc",
        unqualifiedName: "customExternalFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.Cpp,
        sourceFile: "custom.hpp",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      // Pass symbolTable but func requires global. prefix
      const errors = analyzer.analyze(syntax);

      // With symbol table, external funcs are allowed (no error)
      // This test documents current behavior - external funcs work without global.
      expect(errors).toHaveLength(0);
    });

    it("should not suggest global. for truly unknown functions", () => {
      const code = `
        void main() {
          completelyUnknownFunc();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).not.toContain("global.");
    });

    it("should mention header name when stdlib function found", () => {
      const code = `
        void main() {
          f64 x <- sqrt(4.0);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("math.h");
      expect(errors[0].message).toContain("global.sqrt()");
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle empty program", () => {
      const code = ``;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should handle program with only declarations", () => {
      const code = `
        u32 globalVar <- 5;
        void helper() {
          u32 x <- globalVar;
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should ignore non-scope member access calls", () => {
      const code = `
        struct Obj {
          u32 value;
        }
        void main() {
          Obj myObj;
          myObj.doSomething();
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      // myObj is not a scope, so myObj.doSomething() is treated as
      // object method access and skipped - no E0422 for doSomething
      const doSomethingErrors = errors.filter(
        (e) => e.functionName === "doSomething",
      );
      expect(doSomethingErrors).toHaveLength(0);
    });

    it("should detect C function pointer typedef variable as callable", () => {
      const code = `
        void myHandler() {
          u32 x <- 1;
        }
        void main() {
          PointCallback cb <- myHandler;
          cb();
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "PointCallback",
        kind: "type",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "callback_types.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void (*)(Point)",
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      // cb should be recognized as callable (no E0422 for cb())
      expect(errors).toHaveLength(0);
    });

    it("allows cross-file cnx functions from SymbolTable (Issue #786)", () => {
      const code = `
        void main() {
          cnxFunc();
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addTSymbol({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "cnxFunc",
          scopePath: "",
          sourceFile: "module.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      // Issue #786: Cross-file cnx functions from includes are now allowed
      // without E0422 since they're defined in an included file
      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // Callback Compatibility Detection
  // ========================================================================

  // #1825: callback RECOGNITION moved to 1.4 (`CallbackCompatibility.test`).
  // The analyzer still asks whether a typedef is a function pointer, for
  // ADR-040's callable variables, and asks the symbol table that owns the rule.
  describe("C function pointer typedefs", () => {
    it("isCFunctionPointerTypedef returns false for a name no table declares", () => {
      const { analyzer } = analyzerFor("");
      expect(analyzer.isCFunctionPointerTypedef("PointCallback")).toBe(false);
    });

    it("isCFunctionPointerTypedef returns false for non-type symbols", () => {
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "myFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "funcs.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
      });

      const { analyzer } = analyzerFor("", symbolTable);

      expect(analyzer.isCFunctionPointerTypedef("myFunc")).toBe(false);
    });

    it("isCFunctionPointerTypedef returns true for function pointer typedef", () => {
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "Callback",
        kind: "type",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "types.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void (*)(int)",
      });

      const { analyzer } = analyzerFor("", symbolTable);

      expect(analyzer.isCFunctionPointerTypedef("Callback")).toBe(true);
    });
  });

  // ========================================================================
  // Issue #985: global. prefix function call validation
  // ========================================================================

  describe("global prefix function calls (Issue #985)", () => {
    it("should detect undeclared global.func() call", () => {
      const code = `
        scope Test {
          void run() {
            u32 now <- global.millis();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("'millis'");
      expect(errors[0].message).toContain(
        "not declared in any included header",
      );
      expect(errors[0].message).toContain("#include <Arduino.h>");
    });

    it("should detect undeclared global.func() with unknown function", () => {
      const code = `
        scope Test {
          void run() {
            u32 result <- global.unknownFunc();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("'unknownFunc'");
      expect(errors[0].message).toContain(
        "not declared in any included header",
      );
      expect(errors[0].message).not.toContain("#include");
    });

    it("should allow global.func() when function is defined", () => {
      const code = `
        void helper() {
          u32 x <- 5;
        }
        scope Test {
          void run() {
            global.helper();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow global.func() when header is included", () => {
      const code = `
        #include <Arduino.h>
        scope Test {
          void run() {
            u32 now <- global.millis();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should allow global.Scope.method() when scope is defined", () => {
      const code = `
        scope Motor {
          public void start() {
            u32 x <- 5;
          }
        }
        scope Controller {
          void run() {
            global.Motor.start();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("should detect undeclared global.Scope.method() call", () => {
      const code = `
        scope Motor {
          public void start() {
            u32 x <- 5;
          }
        }
        scope Controller {
          void run() {
            global.Motor.undefinedMethod();
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].functionName).toBe("global.Motor.undefinedMethod");
      expect(errors[0].message).toContain(
        "function 'global.Motor.undefinedMethod' called before definition",
      );
      expect(errors[0].message).not.toContain(
        "not declared in any included header",
      );
    });

    it("should NOT resolve global.helper() to scope method Test_helper", () => {
      const code = `
        scope Test {
          void helper() {
          }
          void run() {
            global.helper();
          }
        }
      `;
      const symbolTable = new SymbolTable();

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].functionName).toBe("helper");
    });

    it("should say 'called before definition' for global.func() on local function", () => {
      const code = `
        scope Test {
          void run() {
            global.helper();
          }
        }
        void helper() {
        }
      `;
      const symbolTable = new SymbolTable();

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0422");
      expect(errors[0].message).toContain("called before definition");
      expect(errors[0].message).not.toContain(
        "not declared in any included header",
      );
    });

    it("should allow global.func() for external C function", () => {
      const code = `
        scope Test {
          void run() {
            global.externalFunc();
          }
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "externalFunc",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "external.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "void",
        parameters: [],
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });
  });

  // ========================================================================
  // E0902: dynamic memory imported from C/C++ (ADR-003)
  //
  // Decided here, and only here, because ADR-003 forbids the IMPORT: answering
  // it needs to know whether the callee resolved to a cnx definition, a
  // header symbol, or nothing. NullCheckAnalyzer used to answer it too, from a
  // listener that sees only the name -- which is how `pool_free` came to be
  // told it was imported from C/C++ (#1306 review).
  // ========================================================================

  describe("E0902 - dynamic memory from C/C++", () => {
    it.each(["malloc", "calloc", "realloc", "free"])(
      "reports %s when stdlib.h resolves it",
      (name) => {
        const code = `
        #include <stdlib.h>
        void main() {
          ${name}(1);
        }
      `;
        const { syntax, analyzer } = analyzerFor(code);
        const errors = analyzer.analyze(syntax);

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe("E0902");
        expect(errors[0].functionName).toBe(name);
      },
    );

    it("reports the same code and sentence with no include at all", () => {
      const code = `
        void main() {
          malloc(1);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0902");
      expect(errors[0].message).toBe(
        "Importing dynamic memory function 'malloc' from C/C++ is forbidden",
      );
      // NOT E0422's hint, which would send the author to write the include the
      // transpiler then rejects them for.
      expect(errors[0].message).not.toContain("stdlib.h");
      expect(errors[0].helpText).toContain("ADR-003");
    });

    it("reports a declaration initializer exactly once", () => {
      const code = `
        #include <stdlib.h>
        void main() {
          cstring c_ptr <- malloc(100);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors.filter((e) => e.code === "E0902")).toHaveLength(1);
    });

    it("matches a vendor allocator through the underscore rule", () => {
      const code = `
        void main() {
          heap_caps_malloc(1);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0902");
    });

    // The regression this block exists for. Both names match the underscore
    // rule and both are written in cnx, so neither was imported from
    // anywhere -- and a static pool with a `pool_free` is what ADR-003's own
    // Memory Pools section points authors toward.
    it.each([
      ["a pool release function", "pool_free"],
      ["a predicate that releases nothing", "slot_is_free"],
    ])("does not report %s defined in cnx", (_label, name) => {
      const code = `
        u32 ${name}(u32 slot) {
          return slot;
        }
        void main() {
          u32 r <- ${name}(1);
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    it("does not report a scope member reached without this.", () => {
      const code = `
        scope Pool {
          private u32 pool_free(u32 slot) {
            return slot;
          }
          public u32 release(u32 slot) {
            return pool_free(slot);
          }
        }
      `;
      const { syntax, analyzer } = analyzerFor(code);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(0);
    });

    // Documented consequence of the maintainer's "exact, or after an
    // underscore" rule, pinned so it is a decision and not a surprise: a name
    // rule cannot tell releasing memory from releasing a bus, and an external
    // `_free` IS imported from C/C++, so the message stays true. An author who
    // needs `spi_bus_free` calls it from their C or C++ code.
    it("reports an external _free even though it frees no memory", () => {
      const code = `
        void main() {
          spi_bus_free(1);
        }
      `;
      const symbolTable = new SymbolTable();
      symbolTable.addCSymbol({
        name: "spi_bus_free",
        kind: "function",
        sourceLanguage: ESourceLanguage.C,
        sourceFile: "driver/spi_common.h",
        span: TestSourceSpan.at(1),
        visibility: "public",
        type: "int",
        parameters: [],
      });

      const { syntax, analyzer } = analyzerFor(code, symbolTable);
      const errors = analyzer.analyze(syntax);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0902");
    });
  });
});
