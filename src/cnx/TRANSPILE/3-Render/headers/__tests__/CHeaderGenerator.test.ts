/**
 * Unit tests for CHeaderGenerator
 *
 * Tests C header generation with pointer-based pass-by-reference semantics.
 */

import { describe, it, expect } from "vitest";
import CHeaderGenerator from "../CHeaderGenerator";
import IHeaderSymbol from "../types/IHeaderSymbol";

import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import SymbolTable from "../../../../PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";
import HeaderPassing from "./HeaderPassing";

// ============================================================================
// Test Helpers
// ============================================================================

/** Minimal IHeaderTypeInput carrying just a symbol table. */
function typeInputWith(symbolTable: SymbolTable) {
  return {
    symbolTable,
    enumMembers: new Map(),
    memberCNames: new Map(),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    bitmapBackingType: new Map(),
    bitmapFields: new Map(),
  };
}

function createFunctionSymbol(
  name: string,
  returnType: string,
  parameters: IParameterSymbol[] = [],
): IHeaderSymbol {
  return {
    name,
    kind: "function",
    type: returnType,
    parameters,
    sourceFile: "test.cnx",
    sourceLine: 1,
  };
}

function createStructSymbol(name: string): IHeaderSymbol {
  return {
    name,
    kind: "struct",
    type: name,
    sourceFile: "test.cnx",
    sourceLine: 1,
  };
}

function createEnumSymbol(name: string): IHeaderSymbol {
  return {
    name,
    kind: "enum",
    type: name,
    sourceFile: "test.cnx",
    sourceLine: 1,
  };
}

function createVariableSymbol(name: string, type: string): IHeaderSymbol {
  return {
    name,
    kind: "variable",
    type,
    sourceFile: "test.cnx",
    sourceLine: 1,
  };
}

function createParam(
  name: string,
  type: string,
  options: Partial<IParameterSymbol> = {},
): IParameterSymbol {
  return {
    name,
    emittedName: name,
    type,
    isConst: false,
    isArray: false,
    passing: HeaderPassing.of(),
    ...options,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("CHeaderGenerator", () => {
  describe("generate", () => {
    it("generates header with include guard", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("#ifndef CNX_TEST_H");
      expect(result).toContain("#define CNX_TEST_H");
      expect(result).toContain("#endif /* CNX_TEST_H */");
    });

    // Issue #1133: the guard keys on the PATH, so same-basename files in
    // different directories stay distinguishable. The former `guardPrefix`
    // option is gone: CNX_ is now mandatory, and a second, optional prefix
    // mechanism beside it would be a duplicate path to the same decision.
    it("builds the guard from the full relative path", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [];

      const canResult = generator.generate(symbols, "can/config.h", {});
      const uartResult = generator.generate(symbols, "uart/config.h", {});

      expect(canResult).toContain("#ifndef CNX_CAN_CONFIG_H");
      expect(canResult).toContain("#define CNX_CAN_CONFIG_H");
      expect(uartResult).toContain("#ifndef CNX_UART_CONFIG_H");
    });

    it("generates extern C wrapper for C++ compatibility", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("#ifdef __cplusplus");
      expect(result).toContain('extern "C" {');
      expect(result).toContain("#endif");
    });

    it("generates function prototypes", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("doSomething", "void"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void doSomething(void);");
    });
  });

  describe("function prototype generation", () => {
    it("generates void function with no parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createFunctionSymbol("init", "void")];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void init(void);");
    });

    it("generates function with return type", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("getValue", "u32"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("uint32_t getValue(void);");
    });

    it("forces main to return int", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createFunctionSymbol("main", "u32")];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("int main(void);");
    });

    it("generates function with single parameter using pointer (C semantics)", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void process(uint32_t* value);");
    });

    it("generates function with const parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void process(const uint32_t* value);");
    });

    it("generates function with read-only parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("value", "u32", { isConst: true }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void process(const uint32_t* value);");
    });

    it("generates function with multiple parameters", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("add", "u32", [
          createParam("a", "u32"),
          createParam("b", "u32"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("uint32_t add(uint32_t* a, uint32_t* b);");
    });

    it("uses pass-by-value for parameters in passByValueParams", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [createParam("value", "u32")]),
      ];
      const passByValueParams = new Map([["process", new Set(["value"])]]);

      const result = generator.generate(
        HeaderPassing.byValue(symbols, passByValueParams),
        "test.h",
        {},
        undefined,
      );

      expect(result).toContain("void process(uint32_t value);");
    });

    it("uses pass-by-value for a read-only f32", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setFloat", "void", [createParam("value", "f32")]),
      ];

      const result = generator.generate(
        HeaderPassing.byValue(
          symbols,
          new Map([["setFloat", new Set(["value"])]]),
        ),
        "test.h",
        {},
        undefined,
      );

      expect(result).toContain("void setFloat(float value);");
    });

    it("uses pass-by-value for a read-only f64", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setDouble", "void", [
          createParam("value", "f64"),
        ]),
      ];

      const result = generator.generate(
        HeaderPassing.byValue(
          symbols,
          new Map([["setDouble", new Set(["value"])]]),
        ),
        "test.h",
        {},
        undefined,
      );

      expect(result).toContain("void setDouble(double value);");
    });

    it("uses pass-by-value for a read-only enum", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setState", "void", [
          createParam("state", "State"),
        ]),
      ];
      const allKnownEnums = new Set(["State"]);

      const result = generator.generate(
        HeaderPassing.byValue(
          symbols,
          new Map([["setState", new Set(["state"])]]),
        ),
        "test.h",
        {},
        undefined,
        allKnownEnums,
      );

      expect(result).toContain("void setState(State state);");
    });

    it("uses pass-by-value for a read-only ISR (function pointer)", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setHandler", "void", [
          createParam("handler", "ISR"),
        ]),
      ];

      const result = generator.generate(
        HeaderPassing.byValue(
          symbols,
          new Map([["setHandler", new Set(["handler"])]]),
        ),
        "test.h",
        {},
        undefined,
      );

      expect(result).toContain("void setHandler(ISR handler);");
    });

    it("passes a `mut` float or enum by pointer (ADR-071 Q6)", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setFloat", "void", [createParam("value", "f32")]),
        createFunctionSymbol("setState", "void", [
          createParam("state", "State"),
        ]),
      ];

      const result = generator.generate(
        HeaderPassing.byValue(symbols, new Map()),
        "test.h",
        {},
        undefined,
        new Set(["State"]),
      );

      expect(result).toContain("void setFloat(float* value);");
      expect(result).toContain("void setState(State* state);");
    });

    it("generates array parameter with dimensions", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processArray", "void", [
          createParam("data", "u8", { isArray: true, arrayDimensions: ["10"] }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void processArray(uint8_t data[10]);");
    });

    it("generates const array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("readArray", "void", [
          createParam("data", "u8", {
            isConst: true,
            isArray: true,
            arrayDimensions: ["10"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void readArray(const uint8_t data[10]);");
    });

    it("generates read-only array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("readArray", "void", [
          createParam("data", "u8", {
            isConst: true,
            isArray: true,
            arrayDimensions: ["10"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void readArray(const uint8_t data[10]);");
    });

    it("generates string array parameter as char*", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processStrings", "void", [
          createParam("strings", "string", {
            isArray: true,
            arrayDimensions: ["5"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void processStrings(char* strings[5]);");
    });

    it("generates multi-dimensional array parameter", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("processMatrix", "void", [
          createParam("matrix", "u32", {
            isArray: true,
            arrayDimensions: ["3", "4"],
          }),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void processMatrix(uint32_t matrix[3][4]);");
    });

    it("generates function with no return type as void", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        {
          name: "noReturn",
          kind: "function",
          type: undefined,
          sourceFile: "test.cnx",
          sourceLine: 1,
        },
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("void noReturn(void);");
    });
  });

  describe("type mapping", () => {
    it("maps cnx integer types to C types", () => {
      const generator = new CHeaderGenerator();
      const types = [
        { cnx: "u8", c: "uint8_t" },
        { cnx: "u16", c: "uint16_t" },
        { cnx: "u32", c: "uint32_t" },
        { cnx: "u64", c: "uint64_t" },
        { cnx: "i8", c: "int8_t" },
        { cnx: "i16", c: "int16_t" },
        { cnx: "i32", c: "int32_t" },
        { cnx: "i64", c: "int64_t" },
      ];

      for (const { cnx, c } of types) {
        const symbols: IHeaderSymbol[] = [createFunctionSymbol("get", cnx)];
        const result = generator.generate(symbols, "test.h", {});
        expect(result).toContain(`${c} get(void);`);
      }
    });

    it("maps bool type", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("isReady", "bool"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("bool isReady(void);");
    });

    it("maps float types", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("getF32", "f32"),
        createFunctionSymbol("getF64", "f64"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("float getF32(void);");
      expect(result).toContain("double getF64(void);");
    });
  });

  describe("C-compatible filtering", () => {
    it("filters out C++ namespace types from forward declarations", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("result", "MockLib::Parse::ParseResult"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      // Should not generate struct forward declaration for C++ namespace type
      // (the type still appears in function prototype, but not in forward decl)
      expect(result).not.toContain(
        "typedef struct MockLib::Parse::ParseResult",
      );
    });

    it("filters out C++ template types from variables", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createVariableSymbol("myVector", "std::vector<int>"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      // Should not include the variable with C++ template type
      expect(result).not.toContain("std::vector");
    });

    it("generates forward declarations for C-compatible external types", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("getConfig", "void", [
          createParam("config", "ExternalConfig"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("typedef struct ExternalConfig ExternalConfig;");
    });

    it("asserts rather than guessing at a pointer typedef (#1225/#1238)", () => {
      // `typedef struct opaque_t* handle_t` cannot be forward-declared:
      // `typedef struct handle_t handle_t;` is a different, incomplete type,
      // and an object of it cannot be declared at all. Silently omitting the
      // declaration is no safer -- it leaves the type undeclared.
      //
      // #1322 reclassified this from a user diagnostic (E0505, now retired) to
      // an INVARIANT: `cHeadersIncluded` is true whenever any name the
      // header-type enumeration yields is a pointer typedef, and this runs only
      // when that is false over the same symbols -- so reaching it needs a name
      // present in one derivation and absent from the other, which is a
      // transpiler defect rather than a program. This test has to build that
      // contradiction by hand, which is the evidence for the reclassification.
      const symbolTable = new SymbolTable();
      symbolTable.markPointerTypedef("handle_t");

      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("useHandle", "void", [
          createParam("handle", "handle_t"),
        ]),
      ];

      expect(() =>
        generator.generate(symbols, "test.h", {}, typeInputWith(symbolTable)),
      ).toThrow(/Internal:.*handle_t/s);
    });

    it("names the declaration that pulled the type in, and its line (#1225 review)", () => {
      // The error is reported against a generated file the user did not write,
      // so without this the message is a puzzle: which declaration do I look at?
      const symbolTable = new SymbolTable();
      symbolTable.markPointerTypedef("handle_t");

      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        {
          ...createFunctionSymbol("useHandle", "void", [
            createParam("handle", "handle_t"),
          ]),
          sourceFile: "src/driver.cnx",
          sourceLine: 31,
        },
      ];

      let message = "";
      try {
        generator.generate(symbols, "test.h", {}, typeInputWith(symbolTable));
      } catch (error) {
        message = error instanceof Error ? error.message : String(error);
      }

      expect(message).toContain("useHandle");
      expect(message).toContain("Line 31");
    });

    it("forward-declares a pointer typedef's defining header instead, when it is in scope", () => {
      // cHeadersIncluded means Transpiler._needsDefiningHeader propagated the
      // header that really declares handle_t, so nothing needs declaring here.
      const symbolTable = new SymbolTable();
      symbolTable.markPointerTypedef("handle_t");

      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("useHandle", "void", [
          createParam("handle", "handle_t"),
        ]),
      ];

      const result = generator.generate(
        symbols,
        "test.h",
        { cHeadersIncluded: true, userIncludes: ['#include "handles.h"'] },
        typeInputWith(symbolTable),
      );

      expect(result).toContain('#include "handles.h"');
      expect(result).not.toContain("typedef struct handle_t handle_t;");
    });

    it("does not forward-declare locally defined structs", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createStructSymbol("LocalStruct"),
        createFunctionSymbol("getStruct", "void", [
          createParam("s", "LocalStruct"),
        ]),
      ];

      const result = generator.generate(symbols, "test.h", {});

      // LocalStruct should appear in struct definitions, not external dependencies
      expect(result).not.toContain("External type dependencies");
    });

    it("does not forward-declare cross-file enums", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("setState", "void", [
          createParam("state", "CrossFileState"),
        ]),
      ];
      const allKnownEnums = new Set(["CrossFileState"]);

      const result = generator.generate(
        HeaderPassing.byValue(symbols, undefined),
        "test.h",
        {},
        undefined,
        allKnownEnums,
      );

      // Should not generate struct forward declaration for enums
      expect(result).not.toContain(
        "typedef struct CrossFileState CrossFileState;",
      );
    });

    it("filters variables of a C++ namespaced type, spelled as 1.3 stores it", () => {
      const generator = new CHeaderGenerator();
      const symbolTable = new SymbolTable();
      // MyLib is a C++ namespace, so 1.3 stores `MyLib.MyClass` as `MyLib::MyClass`
      symbolTable.addCppSymbol({
        name: "MyLib",
        unqualifiedName: "MyLib",
        kind: "namespace",
        visibility: "public",
        sourceFile: "MyLib.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
      });

      const symbols: IHeaderSymbol[] = [
        createVariableSymbol("instance", "MyLib::MyClass"),
      ];

      const typeInput = {
        symbolTable,
        enumMembers: new Map(),
        memberCNames: new Map(),
        structFields: new Map(),
        structFieldDimensions: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      // A C header cannot declare a variable of a C++ namespaced type
      expect(result).not.toContain("MyLib::MyClass instance");
    });

    it("does not forward-declare a C++ namespaced type, spelled as 1.3 stores it", () => {
      const generator = new CHeaderGenerator();
      const symbolTable = new SymbolTable();
      // Register a C++ namespace symbol
      symbolTable.addCppSymbol({
        name: "LibName",
        unqualifiedName: "LibName",
        kind: "namespace",
        visibility: "public",
        sourceFile: "LibName.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
      });

      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("process", "void", [
          createParam("obj", "LibName::Object"),
        ]),
      ];

      const typeInput = {
        symbolTable,
        enumMembers: new Map(),
        memberCNames: new Map(),
        structFields: new Map(),
        structFieldDimensions: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      // Should not forward-declare C++ namespaced types
      expect(result).not.toContain("typedef struct LibName::Object");
    });

    it("includes external type headers when specified", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createFunctionSymbol("getConfig", "void", [
          createParam("config", "ExternalConfig"),
        ]),
      ];
      const externalTypeHeaders = new Map([
        ["ExternalConfig", '#include "external_config.h"'],
      ]);

      const result = generator.generate(symbols, "test.h", {
        externalTypeHeaders,
      });

      expect(result).toContain('#include "external_config.h"');
      // Should not generate forward declaration since header is included
      expect(result).not.toContain(
        "typedef struct ExternalConfig ExternalConfig;",
      );
    });
  });

  describe("empty inputs", () => {
    it("generates valid header with no functions", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [];

      const result = generator.generate(symbols, "empty.h", {});

      expect(result).toContain("#ifndef CNX_EMPTY_H");
      expect(result).toContain("#define CNX_EMPTY_H");
      expect(result).toContain("#endif /* CNX_EMPTY_H */");
      expect(result).not.toContain("Function prototypes");
    });
  });

  describe("variable declarations", () => {
    it("generates extern variable declarations", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createVariableSymbol("counter", "u32")];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("External variables");
      expect(result).toContain("uint32_t");
      expect(result).toContain("counter");
    });

    it("filters out variables with dot notation types", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [
        createVariableSymbol("instance", "MyModule.Config"),
      ];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).not.toContain("MyModule.Config");
    });
  });

  describe("struct and enum sections", () => {
    it("generates struct section with typeInput", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createStructSymbol("Point")];

      // Create field maps in the correct format
      const pointFieldTypes = new Map<string, string>([
        ["x", "i32"],
        ["y", "i32"],
      ]);

      const typeInput = {
        symbolTable: new SymbolTable(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        structFields: new Map([["Point", pointFieldTypes]]),
        structFieldDimensions: new Map([["Point", new Map()]]),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      };

      const result = generator.generate(symbols, "test.h", {}, typeInput);

      expect(result).toContain("Struct definitions");
      expect(result).toContain("Point");
    });

    it("generates forward declarations without typeInput", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createStructSymbol("Point")];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("typedef struct Point Point;");
    });

    it("generates enum section", () => {
      const generator = new CHeaderGenerator();
      const symbols: IHeaderSymbol[] = [createEnumSymbol("Status")];

      const result = generator.generate(symbols, "test.h", {});

      expect(result).toContain("Enumerations");
      expect(result).toContain("Status");
    });
  });
});
