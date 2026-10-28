/**
 * Unit tests for HeaderGeneratorUtils
 */

import { describe, it, expect } from "vitest";
import HeaderGeneratorUtils from "../HeaderGeneratorUtils";

import IHeaderSymbol from "../types/IHeaderSymbol";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import TSymbolKind from "../../../../types/symbol-kinds/TSymbolKind";

/**
 * Helper to create test symbols with required properties
 */
function makeSymbol(
  partial: Partial<IHeaderSymbol> & { name: string; kind: TSymbolKind },
): IHeaderSymbol {
  return {
    sourceFile: "test.cnx",
    sourceLine: 1,
    ...partial,
  };
}

/**
 * Helper to create test parameter symbols
 */
function makeParam(
  partial: Partial<IParameterSymbol> & { name: string; type: string },
): IParameterSymbol {
  return {
    emittedName: partial.name,
    isConst: false,
    isArray: false,
    ...partial,
  };
}

describe("HeaderGeneratorUtils", () => {
  describe("makeGuard", () => {
    it("creates guard from simple filename", () => {
      expect(HeaderGeneratorUtils.makeGuard("test.h")).toBe("CNX_TEST_H");
    });

    // Issue #1133: the guard must key on the PATH, not the basename. Keying on
    // the basename made can/config.cnx and uart/config.cnx share CONFIG_H, so a
    // translation unit including both had the second silently skipped.
    it("distinguishes same-basename files in different directories", () => {
      expect(HeaderGeneratorUtils.makeGuard("can/config.cnx")).toBe(
        "CNX_CAN_CONFIG_H",
      );
      expect(HeaderGeneratorUtils.makeGuard("uart/config.cnx")).toBe(
        "CNX_UART_CONFIG_H",
      );
    });

    it("preserves nested directory structure in the guard", () => {
      expect(HeaderGeneratorUtils.makeGuard("Display/Utils.cnx")).toBe(
        "CNX_DISPLAY_UTILS_H",
      );
    });

    // ADR-063 part 2: every generated name carries the reserved prefix, so a
    // user constant whose name equals a guard can no longer erase it.
    it("carries the reserved CNX_ prefix", () => {
      expect(HeaderGeneratorUtils.makeGuard("settings.cnx")).toBe(
        "CNX_SETTINGS_H",
      );
    });

    it("replaces non-alphanumeric characters with underscores", () => {
      expect(HeaderGeneratorUtils.makeGuard("my-test-file.h")).toBe(
        "CNX_MY_TEST_FILE_H",
      );
    });

    it("handles windows-style paths", () => {
      expect(HeaderGeneratorUtils.makeGuard("path\\to\\test.h")).toBe(
        "CNX_PATH_TO_TEST_H",
      );
    });

    it("strips a leading ./ so it does not become a stray underscore", () => {
      expect(HeaderGeneratorUtils.makeGuard("./test.cnx")).toBe("CNX_TEST_H");
    });

    // Conversion to upper case is lossy, so makeGuard alone is NOT injective. These
    // two collide by design; ADR-063 diagnoses the residue with E0203 rather
    // than complicating the mapping with a hash or an escape encoding.
    it("collapses `-` and `_`, which is the residue E0203 covers", () => {
      expect(HeaderGeneratorUtils.makeGuard("mod-a.cnx")).toBe(
        HeaderGeneratorUtils.makeGuard("mod_a.cnx"),
      );
    });
  });

  describe("groupSymbolsByKind", () => {
    it("groups symbols correctly", () => {
      const symbols: IHeaderSymbol[] = [
        makeSymbol({ name: "MyStruct", kind: "struct" }),
        makeSymbol({ name: "MyEnum", kind: "enum" }),
        makeSymbol({ name: "myFunc", kind: "function" }),
        makeSymbol({ name: "myVar", kind: "variable" }),
        makeSymbol({ name: "MyClass", kind: "class" }),
        makeSymbol({ name: "MyType", kind: "type" }),
        makeSymbol({ name: "MyBitmap", kind: "bitmap" }),
      ];

      const groups = HeaderGeneratorUtils.groupSymbolsByKind(symbols);

      expect(groups.structs).toHaveLength(1);
      expect(groups.structs[0].name).toBe("MyStruct");
      expect(groups.enums).toHaveLength(1);
      expect(groups.enums[0].name).toBe("MyEnum");
      expect(groups.functions).toHaveLength(1);
      expect(groups.functions[0].name).toBe("myFunc");
      expect(groups.variables).toHaveLength(1);
      expect(groups.variables[0].name).toBe("myVar");
      expect(groups.classes).toHaveLength(1);
      expect(groups.classes[0].name).toBe("MyClass");
      expect(groups.types).toHaveLength(1);
      expect(groups.types[0].name).toBe("MyType");
      expect(groups.bitmaps).toHaveLength(1);
      expect(groups.bitmaps[0].name).toBe("MyBitmap");
    });

    it("handles empty symbols array", () => {
      const groups = HeaderGeneratorUtils.groupSymbolsByKind([]);

      expect(groups.structs).toHaveLength(0);
      expect(groups.enums).toHaveLength(0);
      expect(groups.functions).toHaveLength(0);
      expect(groups.variables).toHaveLength(0);
      expect(groups.classes).toHaveLength(0);
      expect(groups.types).toHaveLength(0);
      expect(groups.bitmaps).toHaveLength(0);
    });
  });

  describe("extractBaseType", () => {
    it("extracts base type from simple type", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int")).toBe("int");
    });

    it("removes pointer suffix", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int*")).toBe("int");
      expect(HeaderGeneratorUtils.extractBaseType("int**")).toBe("int");
    });

    it("removes array brackets", () => {
      expect(HeaderGeneratorUtils.extractBaseType("int[10]")).toBe("int");
      expect(HeaderGeneratorUtils.extractBaseType("int[]")).toBe("int");
    });

    it("removes const prefix", () => {
      expect(HeaderGeneratorUtils.extractBaseType("const int")).toBe("int");
    });

    it("handles combined modifiers", () => {
      expect(HeaderGeneratorUtils.extractBaseType("const int*")).toBe("int");
    });
  });

  describe("isCppTemplateType", () => {
    it("returns false for undefined", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType(undefined)).toBe(false);
    });

    it("returns false for cnx string<N> types", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("string<32>")).toBe(false);
      expect(HeaderGeneratorUtils.isCppTemplateType("string<1>")).toBe(false);
      expect(HeaderGeneratorUtils.isCppTemplateType("string<256>")).toBe(false);
    });

    it("returns true for C++ template types", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("vector<int>")).toBe(true);
      expect(HeaderGeneratorUtils.isCppTemplateType("map<string, int>")).toBe(
        true,
      );
      expect(HeaderGeneratorUtils.isCppTemplateType("std::vector<int>")).toBe(
        true,
      );
    });

    it("returns true for types with angle brackets", () => {
      expect(HeaderGeneratorUtils.isCppTemplateType("Foo<Bar>")).toBe(true);
    });
  });

  describe("getLocalTypeNames", () => {
    it("extracts local type names from grouped symbols", () => {
      const groups = {
        structs: [
          makeSymbol({ name: "Point", kind: "struct" }),
          makeSymbol({ name: "Rect", kind: "struct" }),
        ],
        classes: [] as IHeaderSymbol[],
        functions: [] as IHeaderSymbol[],
        variables: [] as IHeaderSymbol[],
        enums: [makeSymbol({ name: "Color", kind: "enum" })],
        types: [makeSymbol({ name: "Size", kind: "type" })],
        bitmaps: [makeSymbol({ name: "Flags", kind: "bitmap" })],
      };

      const localTypes = HeaderGeneratorUtils.getLocalTypeNames(groups);

      expect(localTypes.localStructNames.has("Point")).toBe(true);
      expect(localTypes.localStructNames.has("Rect")).toBe(true);
      expect(localTypes.localEnumNames.has("Color")).toBe(true);
      expect(localTypes.localTypeNames.has("Size")).toBe(true);
      expect(localTypes.localBitmapNames.has("Flags")).toBe(true);
    });
  });

  describe("buildExternalTypeIncludes", () => {
    it("returns empty sets when no external type headers", () => {
      const externalTypes = new Set(["MyType"]);
      const result = HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        undefined,
      );

      expect(result.typesWithHeaders.size).toBe(0);
      expect(result.headersToInclude.size).toBe(0);
    });

    it("maps external types to their headers", () => {
      const externalTypes = new Set(["TypeA", "TypeB", "TypeC"]);
      const externalTypeHeaders = new Map([
        ["TypeA", '#include "a.h"'],
        ["TypeB", '#include "b.h"'],
      ]);

      const result = HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        externalTypeHeaders,
      );

      expect(result.typesWithHeaders.has("TypeA")).toBe(true);
      expect(result.typesWithHeaders.has("TypeB")).toBe(true);
      expect(result.typesWithHeaders.has("TypeC")).toBe(false);
      expect(result.headersToInclude.has('#include "a.h"')).toBe(true);
      expect(result.headersToInclude.has('#include "b.h"')).toBe(true);
    });
  });

  describe("collectExternalTypes", () => {
    it("collects types from struct fields (#1744)", () => {
      const result = HeaderGeneratorUtils.collectExternalTypes(
        [],
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        undefined,
        ["Dev", "u32"],
      );

      expect(result.has("Dev")).toBe(true);
      expect(result.has("u32")).toBe(false);
    });

    it("collects types from function return types", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "getConfig",
          kind: "function",
          type: "Config",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("Config")).toBe(true);
    });

    it("collects types from function parameters", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "process",
          kind: "function",
          parameters: [makeParam({ name: "data", type: "DataPacket" })],
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("DataPacket")).toBe(true);
    });

    it("collects types from variables", () => {
      const variables: IHeaderSymbol[] = [
        makeSymbol({
          name: "state",
          kind: "variable",
          type: "SystemState",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        [],
        variables,
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("SystemState")).toBe(true);
    });

    it("excludes local structs", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "getPoint",
          kind: "function",
          type: "Point",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(["Point"]),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("Point")).toBe(false);
    });

    it("excludes built-in types", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "getValue",
          kind: "function",
          type: "u32",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("u32")).toBe(false);
    });

    it("excludes C++ namespace types", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "parse",
          kind: "function",
          type: "std::string",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
      );

      expect(result.has("std::string")).toBe(false);
    });

    it("excludes known enums", () => {
      const functions: IHeaderSymbol[] = [
        makeSymbol({
          name: "getColor",
          kind: "function",
          type: "Color",
        }),
      ];

      const result = HeaderGeneratorUtils.collectExternalTypes(
        functions,
        [],
        new Set(),
        new Set(),
        new Set(),
        new Set(),
        new Set(["Color"]),
      );

      expect(result.has("Color")).toBe(false);
    });
  });

  describe("filterCCompatibleTypes", () => {
    it("excludes types with known headers", () => {
      const externalTypes = new Set(["TypeA", "TypeB"]);
      const typesWithHeaders = new Set(["TypeA"]);

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("TypeB");
      expect(result).not.toContain("TypeA");
    });

    it.each([
      ["excludes C++ template types", "vector<int>", "vector<int>"],
      ["excludes namespace types with ::", "std::string", "std::string"],
      [
        "excludes dot-notation namespace types",
        "Lib.Module.Type",
        "Lib.Module.Type",
      ],
    ])("%s", (_label, source, source2) => {
      const externalTypes = new Set([source, "MyType"]);
      const typesWithHeaders = new Set<string>();

      const result = HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      );

      expect(result).toContain("MyType");
      expect(result).not.toContain(source2);
    });
  });

  describe("filterCCompatibleVariables", () => {
    it("filters out C++ namespace types", () => {
      const variables: IHeaderSymbol[] = [
        makeSymbol({
          name: "a",
          kind: "variable",
          type: "std::string",
        }),
        makeSymbol({ name: "b", kind: "variable", type: "int" }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("b");
    });

    it("filters out C++ template types", () => {
      const variables: IHeaderSymbol[] = [
        makeSymbol({
          name: "a",
          kind: "variable",
          type: "vector<int>",
        }),
        makeSymbol({ name: "b", kind: "variable", type: "u32" }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("b");
    });

    it("keeps cnx string<N> types", () => {
      const variables: IHeaderSymbol[] = [
        makeSymbol({
          name: "name",
          kind: "variable",
          type: "string<32>",
        }),
      ];

      const result = HeaderGeneratorUtils.filterCCompatibleVariables(variables);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("name");
    });
  });

  // =========================================================================
  // Section Generator Tests
  // =========================================================================

  describe("generateHeaderStart", () => {
    it("generates header guard and comment", () => {
      const lines = HeaderGeneratorUtils.generateHeaderStart("MY_FILE_H");

      expect(lines).toContain("#ifndef MY_FILE_H");
      expect(lines).toContain("#define MY_FILE_H");
      expect(lines.some((l) => l.includes("generated by cnx"))).toBe(true);
    });

    it("should include source path in generation comment when provided", () => {
      const lines = HeaderGeneratorUtils.generateHeaderStart(
        "TEST_H",
        "led.cnx",
      );
      expect(lines.join("\n")).toContain("generated by cnx from: led.cnx");
    });

    it("should use default comment when no source path provided", () => {
      const lines = HeaderGeneratorUtils.generateHeaderStart("TEST_H");
      expect(lines.join("\n")).toContain("generated by cnx");
      expect(lines.join("\n")).not.toContain("from:");
    });
  });

  describe("generateIncludes", () => {
    // #1517: no longer "by default" -- what is decided is what is emitted.
    it("emits exactly the system includes it was given", () => {
      const lines = HeaderGeneratorUtils.generateIncludes({}, new Set(), [
        "<stdint.h>",
        "<stdbool.h>",
      ]);

      expect(lines).toContain("#include <stdint.h>");
      expect(lines).toContain("#include <stdbool.h>");
    });

    it("emits no system include when the declarations need none", () => {
      const lines = HeaderGeneratorUtils.generateIncludes({}, new Set(), []);

      expect(lines).toEqual([]);
    });

    it("skips system includes when disabled", () => {
      const lines = HeaderGeneratorUtils.generateIncludes(
        { includeSystemHeaders: false },
        new Set(),
        ["<stdint.h>"],
      );

      expect(lines).not.toContain("#include <stdint.h>");
    });

    it("includes user includes", () => {
      const lines = HeaderGeneratorUtils.generateIncludes(
        { userIncludes: ['#include "custom.h"'] },
        new Set(),
        [],
      );

      expect(lines).toContain('#include "custom.h"');
    });

    it("includes external type headers", () => {
      const headers = new Set(['#include "external.h"']);
      const lines = HeaderGeneratorUtils.generateIncludes({}, headers, []);

      expect(lines).toContain('#include "external.h"');
    });

    it("adds blank line after includes", () => {
      const lines = HeaderGeneratorUtils.generateIncludes({}, new Set(), [
        "<stdint.h>",
      ]);

      expect(lines[lines.length - 1]).toBe("");
    });

    it("passes through userIncludes as-is (1.1 Discover already rendered their extension)", () => {
      const lines = HeaderGeneratorUtils.generateIncludes(
        {
          userIncludes: ['#include "types.hpp"'],
        },
        new Set(),
        [],
      );

      expect(lines).toContain('#include "types.hpp"');
    });

    it("deduplicates headersToInclude against userIncludes across path styles in C++ mode", () => {
      const result = HeaderGeneratorUtils.generateIncludes(
        {
          userIncludes: ["#include <AppConfig.hpp>"],
        },
        new Set(['#include "../AppConfig.hpp"']),
        [],
      );
      // Should NOT have duplicate - different path styles for same file should dedup
      const configIncludes = result.filter((l) => l.includes("AppConfig"));
      expect(configIncludes).toEqual(["#include <AppConfig.hpp>"]);
    });

    it("deduplicates a .h vs .hpp extension mismatch", () => {
      // #1319: the timing difference that produced this mismatch is gone --
      // 1.1 settles the mode once (#1844), so both producers read the same value. Kept as a
      // direct test of the dedup itself, which still guards path-style
      // differences and would be the only thing standing if they diverged again.
      const result = HeaderGeneratorUtils.generateIncludes(
        {
          userIncludes: ["#include <Display/AppData.hpp>"],
        },
        new Set(["#include <Display/AppData.h>"]),
        [],
      );
      const appDataIncludes = result.filter((l) => l.includes("AppData"));
      expect(appDataIncludes).toEqual(["#include <Display/AppData.hpp>"]);
    });

    // #1435: a basename is not an identity. `<driver/uart.h>` is not the
    // generated "uart.h" of uart.cnx, and dropping it removed the only
    // definition of the vendor types the header's signatures name.
    it.each([
      ['#include "uart.h"', "#include <driver/uart.h>"],
      ["#include <a/config.h>", "#include <b/config.h>"],
    ])("keeps %s and %s apart", (userInclude, external) => {
      const result = HeaderGeneratorUtils.generateIncludes(
        { userIncludes: [userInclude] },
        new Set([external]),
        [],
      );

      expect(result).toContain(userInclude);
      expect(result).toContain(external);
    });
  });

  describe("generateCppWrapperStart", () => {
    it("generates extern C wrapper", () => {
      const lines = HeaderGeneratorUtils.generateCppWrapperStart();

      expect(lines).toContain("#ifdef __cplusplus");
      expect(lines).toContain('extern "C" {');
      expect(lines).toContain("#endif");
    });
  });

  describe("generateForwardDeclarations", () => {
    it("returns empty array for no types", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations([]);

      expect(lines).toHaveLength(0);
    });

    it("generates typedef struct for each type", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations([
        "TypeA",
        "TypeB",
      ]);

      expect(lines).toContain("typedef struct TypeA TypeA;");
      expect(lines).toContain("typedef struct TypeB TypeB;");
    });

    it("includes comment header", () => {
      const lines = HeaderGeneratorUtils.generateForwardDeclarations(["TypeA"]);

      expect(lines.some((l) => l.includes("External type dependencies"))).toBe(
        true,
      );
    });
  });

  describe("generateEnumSection", () => {
    it("returns empty array for no enums", () => {
      const lines = HeaderGeneratorUtils.generateEnumSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates placeholder when no typeInput", () => {
      const enums = [makeSymbol({ name: "Color", kind: "enum" })];
      const lines = HeaderGeneratorUtils.generateEnumSection(enums);

      expect(lines.some((l) => l.includes("/* Enum: Color"))).toBe(true);
    });

    it("includes section comment", () => {
      const enums = [makeSymbol({ name: "Color", kind: "enum" })];
      const lines = HeaderGeneratorUtils.generateEnumSection(enums);

      expect(lines).toContain("/* Enumerations */");
    });
  });

  describe("generateBitmapSection", () => {
    it("returns empty array for no bitmaps", () => {
      const lines = HeaderGeneratorUtils.generateBitmapSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates placeholder when no typeInput", () => {
      const bitmaps = [makeSymbol({ name: "Flags", kind: "bitmap" })];
      const lines = HeaderGeneratorUtils.generateBitmapSection(bitmaps);

      expect(lines.some((l) => l.includes("/* Bitmap: Flags"))).toBe(true);
    });

    it("includes section comment", () => {
      const bitmaps = [makeSymbol({ name: "Flags", kind: "bitmap" })];
      const lines = HeaderGeneratorUtils.generateBitmapSection(bitmaps);

      expect(lines).toContain("/* Bitmaps */");
    });
  });

  describe("generateTypeAliasSection", () => {
    it("returns empty array for no types", () => {
      const lines = HeaderGeneratorUtils.generateTypeAliasSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates typedef for each type alias", () => {
      const types = [
        makeSymbol({ name: "Size", kind: "type", type: "u32" }),
        makeSymbol({ name: "Handle", kind: "type", type: "u64" }),
      ];
      const lines = HeaderGeneratorUtils.generateTypeAliasSection(types);

      expect(lines).toContain("typedef uint32_t Size;");
      expect(lines).toContain("typedef uint64_t Handle;");
    });

    it("skips types without type property", () => {
      const types = [
        makeSymbol({ name: "NoType", kind: "type" }),
        makeSymbol({ name: "WithType", kind: "type", type: "i32" }),
      ];
      const lines = HeaderGeneratorUtils.generateTypeAliasSection(types);

      expect(lines.some((l) => l.includes("NoType"))).toBe(false);
      expect(lines).toContain("typedef int32_t WithType;");
    });
  });

  describe("generateStructSection", () => {
    it("returns empty array for no structs or classes", () => {
      const lines = HeaderGeneratorUtils.generateStructSection([], []);

      expect(lines).toHaveLength(0);
    });

    it("generates forward declarations when no typeInput", () => {
      const structs = [makeSymbol({ name: "Point", kind: "struct" })];
      const classes = [makeSymbol({ name: "Shape", kind: "class" })];
      const lines = HeaderGeneratorUtils.generateStructSection(
        structs,
        classes,
      );

      expect(lines).toContain("typedef struct Point Point;");
      expect(lines).toContain("typedef struct Shape Shape;");
      expect(lines).toContain("/* Forward declarations */");
    });
  });

  describe("generateVariableSection", () => {
    it("returns empty array for no variables", () => {
      const lines = HeaderGeneratorUtils.generateVariableSection([]);

      expect(lines).toHaveLength(0);
    });

    it("generates extern declarations", () => {
      const variables = [
        makeSymbol({
          name: "counter",
          kind: "variable",
          type: "u32",
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern uint32_t counter;");
    });

    it("includes const modifier", () => {
      const variables = [
        makeSymbol({
          name: "VERSION",
          kind: "variable",
          type: "u32",
          isConst: true,
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern const uint32_t VERSION;");
    });

    it("includes volatile modifier for atomic", () => {
      const variables = [
        makeSymbol({
          name: "flag",
          kind: "variable",
          type: "bool",
          isAtomic: true,
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern volatile bool flag;");
    });

    it("includes array dimensions", () => {
      const variables = [
        makeSymbol({
          name: "buffer",
          kind: "variable",
          type: "u8",
          isArray: true,
          arrayDimensions: ["64"],
        }),
      ];
      const lines = HeaderGeneratorUtils.generateVariableSection(variables);

      expect(lines).toContain("extern uint8_t buffer[64];");
    });

    // ADR-030: a handle is declared as the pointer its definition is -- and an
    // array of them as an array of pointers (#996).
    it.each<[string, boolean, string[] | undefined, string]>([
      ["a handle", false, undefined, "extern Dev* device;"],
      ["an array of handles", true, ["2"], "extern Dev* device[2];"],
    ])("declares %s as a pointer", (_label, isArray, dims, expected) => {
      const variables = [
        makeSymbol({
          name: "device",
          kind: "variable",
          type: "Dev",
          isArray,
          arrayDimensions: dims,
          isPointer: true,
        }),
      ];

      expect(HeaderGeneratorUtils.generateVariableSection(variables)).toContain(
        expected,
      );
    });
  });

  describe("generateHeaderEnd", () => {
    it("generates closing wrapper and guard", () => {
      const lines = HeaderGeneratorUtils.generateHeaderEnd("MY_FILE_H");

      expect(lines).toContain("#ifdef __cplusplus");
      expect(lines).toContain("}");
      expect(lines).toContain("#endif");
      expect(lines).toContain("#endif /* MY_FILE_H */");
    });
  });

  describe("generateCallbackStructForwardDecls", () => {
    it("returns empty array when no callback types provided", () => {
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        [],
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when callback types is undefined", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: undefined,
      };
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        [],
        input,
      );
      expect(result).toEqual([]);
    });

    it("generates forward declarations for struct parameters", () => {
      const structs = [makeSymbol({ name: "DataStruct", kind: "struct" })];
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "processData",
            {
              typedefName: "processData_t",
              returnType: "void",
              parameters: [
                { type: "DataStruct", isStruct: true },
                { type: "uint32_t", isStruct: false },
              ],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        structs,
        input,
      );
      expect(result).toContain("typedef struct DataStruct DataStruct;");
    });

    it("deduplicates struct forward declarations", () => {
      const structs = [makeSymbol({ name: "MyStruct", kind: "struct" })];
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "handler1",
            {
              typedefName: "handler1_t",
              returnType: "void",
              parameters: [{ type: "MyStruct", isStruct: true }],
            },
          ],
          [
            "handler2",
            {
              typedefName: "handler2_t",
              returnType: "void",
              parameters: [{ type: "MyStruct", isStruct: true }],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        structs,
        input,
      );
      const myStructDecls = result.filter((l) => l.includes("MyStruct"));
      expect(myStructDecls).toHaveLength(1);
    });

    it("ignores non-struct parameters", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "handler",
            {
              typedefName: "handler_t",
              returnType: "uint32_t",
              parameters: [
                { type: "uint32_t", isStruct: false },
                { type: "bool", isStruct: false },
              ],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        [],
        input,
      );
      expect(result).toEqual([]);
    });

    it("only includes local structs in forward declarations", () => {
      // ExternalStruct is not in the local structs list
      const structs = [makeSymbol({ name: "LocalStruct", kind: "struct" })];
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "handler",
            {
              typedefName: "handler_t",
              returnType: "void",
              parameters: [
                { type: "LocalStruct", isStruct: true },
                { type: "ExternalStruct", isStruct: true },
              ],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        structs,
        input,
      );
      expect(result).toContain("typedef struct LocalStruct LocalStruct;");
      expect(result).not.toContain("ExternalStruct");
    });
  });

  describe("generateCallbackTypedefSection", () => {
    it("returns empty array when no callback types provided", () => {
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        undefined,
        false,
      );
      expect(result).toEqual([]);
    });

    it("returns empty array when callback types is undefined", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: undefined,
      };
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        input,
        false,
      );
      expect(result).toEqual([]);
    });

    it("generates C-style function pointer typedef", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "processU32",
            {
              typedefName: "processU32_t",
              returnType: "uint32_t",
              parameters: [{ type: "uint32_t", isStruct: false }],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        input,
        false,
      );
      expect(result.join("\n")).toContain(
        "typedef uint32_t (*processU32_t)(uint32_t);",
      );
    });

    it("generates C++ reference for struct parameters", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "processPoint",
            {
              typedefName: "processPoint_t",
              returnType: "uint32_t",
              parameters: [{ type: "Point", isStruct: true }],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        input,
        true,
      );
      expect(result.join("\n")).toContain("Point&");
    });

    it("generates C pointer for struct parameters", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "processPoint",
            {
              typedefName: "processPoint_t",
              returnType: "uint32_t",
              parameters: [{ type: "Point", isStruct: true }],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        input,
        false,
      );
      expect(result.join("\n")).toContain("Point*");
    });

    it("handles multiple parameters", () => {
      const input = {
        structFields: new Map(),
        structFieldDimensions: new Map(),
        enumMembers: new Map(),
        memberCNames: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
        callbackTypes: new Map([
          [
            "multiParam",
            {
              typedefName: "multiParam_t",
              returnType: "void",
              parameters: [
                { type: "uint32_t", isStruct: false },
                { type: "Point", isStruct: true },
                { type: "bool", isStruct: false },
              ],
            },
          ],
        ]),
      };
      const result = HeaderGeneratorUtils.generateCallbackTypedefSection(
        input,
        false,
      );
      const typedef = result.find((l) => l.includes("multiParam_t"));
      expect(typedef).toContain("uint32_t");
      expect(typedef).toContain("Point*");
      expect(typedef).toContain("bool");
    });
  });
});
