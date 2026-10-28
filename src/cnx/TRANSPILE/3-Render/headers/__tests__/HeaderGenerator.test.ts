/**
 * Tests for HeaderGenerator
 * Issue #427: Tests for string<N> type handling in header generation
 * Issue #522: Tests for C++ namespace type filtering
 */

import { describe, it, expect } from "vitest";
import HeaderGenerator from "../HeaderGenerator";

import IHeaderSymbol from "../types/IHeaderSymbol";
import SymbolTable from "../../../../PARSE/3-Declare/SymbolTable";
import IHeaderTypeInput from "../generators/IHeaderTypeInput";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";
import HeaderPassing from "./HeaderPassing";

/** #1428: the run's mode, stated -- the facade reads it from the program */
const C_RUN = { cppMode: () => false };

describe("HeaderGenerator", () => {
  const generator = new HeaderGenerator(C_RUN);

  // Helper to create a variable symbol
  function makeVarSymbol(
    name: string,
    type: string,
    options: {
      isArray?: boolean;
      arrayDimensions?: string[];
      isConst?: boolean;
    } = {},
  ): IHeaderSymbol {
    return {
      name,
      type,
      kind: "variable",
      sourceFile: "test.cnx",
      sourceLine: 1,
      isArray: options.isArray,
      arrayDimensions: options.arrayDimensions,
      isConst: options.isConst,
    };
  }

  describe("the program's mode picks the generator (#1428)", () => {
    const process: IHeaderSymbol = {
      name: "process",
      type: "void",
      kind: "function",
      sourceFile: "test.cnx",
      sourceLine: 1,
      parameters: [
        {
          name: "value",
          emittedName: "value",
          passing: HeaderPassing.of(),
          type: "u32",
          isConst: false,
          isArray: false,
        },
      ],
    };

    it("renders C for a program that emits C", () => {
      const header = generator.generate([process], "test.h", {});

      expect(header).toContain("void process(uint32_t* value);");
    });

    it("renders C++ for a program that emits C++", () => {
      const cppRun = new HeaderGenerator({ cppMode: () => true });
      const header = cppRun.generate([process], "test.h", {});

      expect(header).toContain("void process(uint32_t& value);");
    });
  });

  describe("string<N> type handling in extern declarations", () => {
    it("should generate char[N+1] for string<N> variables", () => {
      const symbols = [makeVarSymbol("greeting", "string<32>")];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern char greeting[33];");
      expect(header).not.toContain("string<32>");
    });

    it("should generate char[N+1] for const string<N> variables", () => {
      const symbols = [
        makeVarSymbol("message", "string<16>", { isConst: true }),
      ];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern const char message[17];");
    });

    it("should handle string<N> arrays with correct dimension order", () => {
      // string<16> labels[3] -> char labels[3][17]
      const symbols = [
        makeVarSymbol("labels", "string<16>", {
          isArray: true,
          arrayDimensions: ["3"],
        }),
      ];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern char labels[3][17];");
    });

    it("should handle const string<N> arrays", () => {
      const symbols = [
        makeVarSymbol("names", "string<64>", {
          isArray: true,
          arrayDimensions: ["5"],
          isConst: true,
        }),
      ];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern const char names[5][65];");
    });

    it("should handle multi-dimensional string arrays", () => {
      // string<8> matrix[2][3] -> char matrix[2][3][9]
      const symbols = [
        makeVarSymbol("matrix", "string<8>", {
          isArray: true,
          arrayDimensions: ["2", "3"],
        }),
      ];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern char matrix[2][3][9];");
    });

    it("should not generate typedef for string<N> types", () => {
      const symbols = [makeVarSymbol("buffer", "string<128>")];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).not.toContain("typedef struct string");
      expect(header).not.toContain("External type dependencies");
    });
  });

  describe("Issue #449: declaration ordering", () => {
    // Helper to create an enum symbol
    function makeEnumSymbol(name: string): IHeaderSymbol {
      return {
        name,
        kind: "enum",
        sourceFile: "test.cnx",
        sourceLine: 1,
      };
    }

    // Helper to create a struct symbol
    function makeStructSymbol(name: string): IHeaderSymbol {
      return {
        name,
        kind: "struct",
        sourceFile: "test.cnx",
        sourceLine: 1,
      };
    }

    it("should output enums before structs (forward declarations)", () => {
      // Symbols in any order - generator should reorder them
      // Without typeInput, structs become forward declarations
      const symbols = [makeStructSymbol("MyStruct"), makeEnumSymbol("MyEnum")];
      const header = generator.generate(symbols, "test.h", {});

      const enumIndex = header.indexOf("/* Enumerations */");
      // Without typeInput, structs are output as "Forward declarations"
      const structIndex = header.indexOf("/* Forward declarations */");

      expect(enumIndex).toBeGreaterThan(-1);
      expect(structIndex).toBeGreaterThan(-1);
      expect(enumIndex).toBeLessThan(structIndex);
    });

    it("should output enums before structs even when struct is defined first", () => {
      // Struct defined before enum in source - still should output enum first
      const symbols = [
        makeStructSymbol("TPressureInputConfig"),
        makeEnumSymbol("EPressureType"),
        makeStructSymbol("TDeviceStatus"),
        makeEnumSymbol("EDeviceState"),
      ];
      const header = generator.generate(symbols, "test.h", {});

      const enumIndex = header.indexOf("/* Enumerations */");
      const structIndex = header.indexOf("/* Forward declarations */");

      expect(enumIndex).toBeGreaterThan(-1);
      expect(structIndex).toBeGreaterThan(-1);
      expect(enumIndex).toBeLessThan(structIndex);
    });
  });

  describe("regular type handling (non-string)", () => {
    it("should handle primitive types normally", () => {
      const symbols = [makeVarSymbol("count", "u32")];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern uint32_t count;");
    });

    it("should handle primitive arrays normally", () => {
      const symbols = [
        makeVarSymbol("data", "u8", {
          isArray: true,
          arrayDimensions: ["256"],
        }),
      ];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern uint8_t data[256];");
    });

    it("should handle user-defined types", () => {
      const symbols = [makeVarSymbol("config", "Configuration")];
      const header = generator.generate(symbols, "test.h", {});

      expect(header).toContain("extern Configuration config;");
    });
  });

  // ============================================================================
  // Issue #522: C++ namespace type filtering
  // ============================================================================

  describe("Issue #522: C++ namespace type filtering", () => {
    // Helper to create typeInput with a SymbolTable containing C++ namespace
    function makeTypeInputWithCppNamespace(
      namespaceName: string,
    ): IHeaderTypeInput {
      const symbolTable = new SymbolTable();
      symbolTable.addCppSymbol({
        name: namespaceName,
        unqualifiedName: namespaceName,
        kind: "namespace",
        sourceFile: `${namespaceName}.hpp`,
        span: TestSourceSpan.at(1),
        visibility: "public",
        sourceLanguage: ESourceLanguage.Cpp,
      });
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

    describe("extern variable filtering", () => {
      it("should filter out variables with :: namespace types", () => {
        const symbols = [makeVarSymbol("data", "Lib::Sub::Data")];
        const header = generator.generate(symbols, "test.h", {});

        // Should not have any extern variable declarations (extern "C" is OK)
        expect(header).not.toContain("External variables");
        expect(header).not.toContain("extern Lib::Sub::Data");
        expect(header).not.toContain("extern Lib_Sub_Data");
      });

      it("should filter out variables with dot-notation namespace types", () => {
        const symbols = [makeVarSymbol("data", "Lib.Sub.Data")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).not.toContain("External variables");
        expect(header).not.toContain("extern Lib.Sub.Data");
      });

      it("should filter out variables of a C++ namespaced type, spelled as 1.3 stores it", () => {
        const symbols = [makeVarSymbol("data", "SeaDash::Parse::Result")];
        const typeInput = makeTypeInputWithCppNamespace("SeaDash");
        const header = generator.generate(symbols, "test.h", {}, typeInput);

        expect(header).not.toContain("External variables");
        expect(header).not.toContain("extern SeaDash::Parse::Result");
      });

      it("should NOT filter snake_case types that are not C++ namespaces", () => {
        const symbols = [makeVarSymbol("config", "my_config_struct")];
        const typeInput = makeTypeInputWithCppNamespace("SomeOtherNamespace");
        const header = generator.generate(symbols, "test.h", {}, typeInput);

        expect(header).toContain("extern my_config_struct config;");
      });

      it("should keep regular C types even when symbolTable is provided", () => {
        const symbols = [makeVarSymbol("count", "u32")];
        const typeInput = makeTypeInputWithCppNamespace("SeaDash");
        const header = generator.generate(symbols, "test.h", {}, typeInput);

        expect(header).toContain("extern uint32_t count;");
      });
    });

    describe("forward declaration filtering", () => {
      // Helper to create a function symbol that references an external type
      function makeFuncSymbol(name: string, paramType: string): IHeaderSymbol {
        return {
          name,
          type: "void",
          kind: "function",
          sourceFile: "test.cnx",
          sourceLine: 1,
          parameters: [
            {
              name: "param",
              emittedName: "param",
              passing: HeaderPassing.of(),
              type: paramType,
              isConst: false,
              isArray: false,
            },
          ],
        };
      }

      it("should filter out forward declarations for :: namespace types", () => {
        const symbols = [makeFuncSymbol("process", "Lib::Sub::Data")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).not.toContain("typedef struct Lib::Sub::Data");
        expect(header).not.toContain("typedef struct Lib_Sub_Data");
        expect(header).not.toContain("External type dependencies");
      });

      it("should filter out forward declarations for dot-notation types", () => {
        const symbols = [makeFuncSymbol("process", "Lib.Sub.Data")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).not.toContain("typedef struct Lib.Sub.Data");
        expect(header).not.toContain("External type dependencies");
      });

      it("should filter out forward declarations for a C++ namespaced type, spelled as 1.3 stores it", () => {
        const symbols = [makeFuncSymbol("process", "SeaDash::Parse::Result")];
        const typeInput = makeTypeInputWithCppNamespace("SeaDash");
        const header = generator.generate(symbols, "test.h", {}, typeInput);

        expect(header).not.toContain("typedef struct SeaDash::Parse::Result");
        expect(header).not.toContain("External type dependencies");
      });

      it("should keep forward declarations for regular external types", () => {
        const symbols = [makeFuncSymbol("process", "ExternalConfig")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).toContain(
          "typedef struct ExternalConfig ExternalConfig;",
        );
        expect(header).toContain("External type dependencies");
      });
    });

    describe("edge cases", () => {
      it("should handle C++ template types (filter them out)", () => {
        const symbols = [makeVarSymbol("vec", "std::vector<int>")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).not.toContain("External variables");
        expect(header).not.toContain("extern std::vector");
        expect(header).not.toContain("vector<int>");
      });

      it("should allow cnx string<N> types (not C++ templates)", () => {
        const symbols = [makeVarSymbol("name", "string<32>")];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).toContain("extern char name[33];");
      });

      it("should handle mixed C++ and regular types correctly", () => {
        const symbols = [
          makeVarSymbol("cppData", "Lib::Data"),
          makeVarSymbol("regularData", "MyStruct"),
          makeVarSymbol("count", "u32"),
        ];
        const header = generator.generate(symbols, "test.h", {});

        expect(header).not.toContain("Lib::Data");
        expect(header).toContain("extern MyStruct regularData;");
        expect(header).toContain("extern uint32_t count;");
      });
    });
  });

  // ============================================================================
  // Coverage tests for generateFromSymbolTable and generateCnxHeader
  // ============================================================================
});
