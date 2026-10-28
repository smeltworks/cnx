/**
 * Unit tests for ForeignTypeFacts -- what cnx may read of a C or C++
 * header symbol's type (#978, #1668).
 */
import { describe, it, expect, beforeEach } from "vitest";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../cnx/types/__testUtils__/testSourceSpan";
import ForeignTypeFacts from "../../../../cnx/utils/ForeignTypeFacts";
import TargetCatalogFile from "../../../TargetCatalogFile";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

const C_HEADER = {
  sourceFile: "api.h",
  span: TestSourceSpan.at(1),
  sourceLanguage: ESourceLanguage.C,
  visibility: "public",
} as const;

let symbolTable: SymbolTable;

function cVariable(name: string, type: string, isArray = false): void {
  symbolTable.addCSymbol({
    ...C_HEADER,
    kind: "variable",
    name,
    type,
    isArray,
  });
}

describe("ForeignTypeFacts", () => {
  beforeEach(() => {
    symbolTable = new SymbolTable();
    symbolTable.addCSymbol({
      ...C_HEADER,
      kind: "type",
      name: "float32_t",
      type: "float",
    });
    symbolTable.addCSymbol({
      ...C_HEADER,
      kind: "type",
      name: "scale_t",
      type: "float32_t",
    });
    symbolTable.addStructField("ApiSample", "v", "float");
    symbolTable.addStructField("ApiSample", "count", "uint32_t");
    symbolTable.addStructField("ApiSample", "samples", "float", [4]);
  });

  // #1760 review: the spelling a write casts back to, where the typer has no
  // cnx name for the type
  describe("operandType's cType", () => {
    it.each([
      ["an integer of unfixed width", "int_fast16_t", "int_fast16_t", null],
      ["a typedef of a float, at its element", "scale_t", "float", "f32"],
      // A fixed width is said by `typeName` the same way on every target
      ["a fixed-width integer", "uint32_t", null, "u32"],
      ["a target-sized integer, with no target", "size_t", "size_t", null],
    ])("spells %s", (_label, type, cType, typeName) => {
      expect(
        ForeignTypeFacts.operandType(type as string, symbolTable, null),
      ).toMatchObject({ cType, typeName });
    });
  });

  describe("variableType", () => {
    it.each([
      ["a float", "float", false, "f32"],
      ["a double", "double", false, "f64"],
      ["a const float", "const float", false, "f32"],
      ["a typedef of float", "float32_t", false, "f32"],
      ["a typedef of a typedef of float", "scale_t", false, "f32"],
      ["a struct global", "ApiSample", false, "ApiSample"],
      ["a struct array", "ApiSample", true, "ApiSample"],
      ["an integer", "uint32_t", false, null],
      ["a float array", "float", true, null],
      ["a float pointer", "float*", false, null],
    ])("types %s as %s", (_label, type, isArray, expected) => {
      cVariable("probe", type as string, isArray as boolean);
      expect(ForeignTypeFacts.variableType(symbolTable, "probe", null)).toBe(
        expected,
      );
    });

    it("types a C++ header variable when no C symbol has the name", () => {
      symbolTable.addCppSymbol({
        sourceFile: "api.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        kind: "variable",
        name: "cppScale",
        unqualifiedName: "cppScale",
        type: "float",
      });
      expect(ForeignTypeFacts.variableType(symbolTable, "cppScale", null)).toBe(
        "f32",
      );
    });

    // #1760 review: one answer for a header value's floating type, the typer's
    it("types a double by the target's data model", () => {
      cVariable("probe", "double");
      const avr = TargetCatalogFile.targets(NodeFileSystem.instance).get(
        "atmega328p",
      )!;
      expect(ForeignTypeFacts.variableType(symbolTable, "probe", avr)).toBe(
        "f32",
      );
    });

    it("answers null for a name no header declares", () => {
      expect(
        ForeignTypeFacts.variableType(symbolTable, "nowhere", null),
      ).toBeNull();
    });
  });

  describe("variableTypeInfo", () => {
    it("types a C header's floating global", () => {
      cVariable("probe", "float");
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "probe", null),
      ).toMatchObject({ baseType: "f32", isArray: false, isPointer: false });
    });

    // #1760 review: the reader this replaced asked C alone
    it("types a C++ header's variable too", () => {
      symbolTable.addCppSymbol({
        sourceFile: "api.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        kind: "variable",
        name: "cppLevel",
        unqualifiedName: "cppLevel",
        type: "double",
      });
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "cppLevel", null),
      ).toMatchObject({ baseType: "f64" });
    });

    it("gives an integer global no type info", () => {
      cVariable("probe", "uint32_t");
      expect(
        ForeignTypeFacts.variableTypeInfo(symbolTable, "probe", null),
      ).toBeUndefined();
    });
  });

  describe("structBits (#1975)", () => {
    beforeEach(() => {
      symbolTable.addStructField("Cfg", "a", "uint32_t");
      symbolTable.addStructField("Cfg", "b", "uint8_t");
      symbolTable.addStructField("Outer", "inner", "Cfg");
      symbolTable.addStructField("Outer", "arr", "uint16_t", [3]);
      symbolTable.addStructField("Odd", "i", "int32_t");
      symbolTable.addStructField("Odd", "p", "char*");
      symbolTable.addStructField("Holder", "odd", "Odd");
      symbolTable.addStructField("Un", "a", "uint32_t");
      symbolTable.addStructField("Un", "b", "uint8_t", [2]);
      symbolTable.setStructLayout("Un", "union");
      symbolTable.addStructField("BF", "a", "uint32_t");
      symbolTable.setStructLayout("BF", "bit-packed");
      symbolTable.addStructField("Loop", "inner", "Loop");
      symbolTable.addStructField("Loop", "z", "uint8_t");
    });

    it("counts a header struct's fields as element_count (#1975 review)", () => {
      expect(ForeignTypeFacts.fieldCount("Cfg", symbolTable)).toBe(2);
      expect(ForeignTypeFacts.fieldCount("Un", symbolTable)).toBeNull();
      expect(ForeignTypeFacts.fieldCount("Nope", symbolTable)).toBeNull();
    });

    it("sums the fields' sizes, without C padding", () => {
      expect(ForeignTypeFacts.structBits("Cfg", symbolTable, null)).toBe(40);
    });

    it("measures a nested header struct and an array field", () => {
      expect(ForeignTypeFacts.structBits("Outer", symbolTable, null)).toBe(
        40 + 48,
      );
    });

    it("has no size for a pointer field, or a struct holding one", () => {
      expect(ForeignTypeFacts.structBits("Odd", symbolTable, null)).toBeNull();
      expect(
        ForeignTypeFacts.structBits("Holder", symbolTable, null),
      ).toBeNull();
    });

    // #1975 review: `Un` was summed to 48 bits, where C stores 32
    it("has no size for a union or a struct C packs bit-fields into", () => {
      expect(ForeignTypeFacts.structBits("Un", symbolTable, null)).toBeNull();
      expect(ForeignTypeFacts.structBits("BF", symbolTable, null)).toBeNull();
    });

    // #1975 review (owner ruling): a bit-field is its declared width, as a
    // cnx bitmap field is -- it was its storage type's 32
    it("types a bit-field by its declared width", () => {
      symbolTable.addStructField("Bits", "a", "uint32_t", undefined, 3);
      symbolTable.addStructField("Bits", "m", "uint32_t", undefined, "W");
      expect(
        ForeignTypeFacts.fieldOperand("Bits", "a", symbolTable, null)?.bitWidth,
      ).toBe(3);
      expect(
        ForeignTypeFacts.fieldOperand("Bits", "m", symbolTable, null),
      ).toBeNull();
      // NEGATIVE CONTROL: a field that is no bit-field keeps its type's width
      expect(
        ForeignTypeFacts.fieldOperand("Cfg", "a", symbolTable, null)?.bitWidth,
      ).toBe(32);
    });

    // #1975 review: `struct bar { bar inner; }` overflowed the stack
    it("has no size for a struct that holds itself", () => {
      expect(ForeignTypeFacts.structBits("Loop", symbolTable, null)).toBeNull();
    });

    it("has no size for a struct it was not given", () => {
      expect(
        ForeignTypeFacts.structBits("Missing", symbolTable, null),
      ).toBeNull();
    });
  });
});
