/**
 * Unit tests for ParameterSignatureBuilder
 *
 * Tests the stateless builder that generates C/C++ parameter signatures
 * from normalized IParameterInput.
 */

import { describe, it, expect } from "vitest";
import ParameterSignatureBuilder from "../ParameterSignatureBuilder";
import IParameterInput from "../../types/IParameterInput";

/**
 * Helper to create a minimal IParameterInput with defaults
 */
function createInput(overrides: Partial<IParameterInput>): IParameterInput {
  return {
    name: "param",
    baseType: "u32",
    mappedType: "uint32_t",
    isConst: false,
    isArray: false,
    isCallback: false,
    isString: false,
    isPassByValue: false,
    isPassByReference: true,
    ...overrides,
  };
}

describe("ParameterSignatureBuilder", () => {
  describe("callback parameters", () => {
    it("generates callback typedef name", () => {
      const input = createInput({
        name: "onClick",
        baseType: "handleClick",
        isCallback: true,
        callbackTypedefName: "HandleClickCallback",
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("HandleClickCallback onClick");
    });
  });

  describe("array parameters", () => {
    it("generates const array for a read-only parameter", () => {
      const input = createInput({
        name: "arr",
        baseType: "u32",
        mappedType: "uint32_t",
        isArray: true,
        arrayDimensions: ["10"],
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint32_t arr[10]");
    });

    it("generates multi-dimensional array", () => {
      const input = createInput({
        name: "matrix",
        baseType: "u8",
        mappedType: "uint8_t",
        isArray: true,
        arrayDimensions: ["4", "4"],
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint8_t matrix[4][4]");
    });

    it("generates bounded string array with capacity dimension", () => {
      const input = createInput({
        name: "names",
        baseType: "string<32>",
        mappedType: "char",
        isArray: true,
        arrayDimensions: ["5", "33"],
        isString: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char names[5][33]");
    });

    it("generates unbounded string array with char*", () => {
      const input = createInput({
        name: "strings",
        baseType: "string",
        mappedType: "char",
        isArray: true,
        arrayDimensions: ["5"],
        isString: true,
        isUnboundedString: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char* strings[5]");
    });

    it("emits no const for a mut array parameter", () => {
      const input = createInput({
        name: "arr",
        baseType: "u32",
        mappedType: "uint32_t",
        isArray: true,
        arrayDimensions: ["10"],
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("uint32_t arr[10]");
    });
  });

  describe("pass-by-value parameters", () => {
    it("generates ISR parameter", () => {
      const input = createInput({
        name: "handler",
        baseType: "ISR",
        mappedType: "ISR",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("ISR handler");
    });

    it("generates float parameter", () => {
      const input = createInput({
        name: "value",
        baseType: "f32",
        mappedType: "float",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("float value");
    });

    it("writes a read-only ISR without const, like a callback (ADR-071)", () => {
      const readOnly = (baseType: string, mappedType: string) =>
        ParameterSignatureBuilder.build(
          createInput({
            name: "p",
            baseType,
            mappedType,
            isConst: true,
            isPassByValue: true,
          }),
          "*",
        );

      expect(readOnly("ISR", "ISR")).toBe("ISR p");
      expect(readOnly("f32", "float")).toBe("const float p");
    });

    it("generates enum parameter", () => {
      const input = createInput({
        name: "status",
        baseType: "Status",
        mappedType: "Status",
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("Status status");
    });

    it("preserves explicit const on pass-by-value", () => {
      const input = createInput({
        name: "value",
        baseType: "f32",
        mappedType: "float",
        isConst: true,
        isPassByValue: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const float value");
    });
  });

  describe("non-array string parameters", () => {
    it("generates string parameter as char*", () => {
      const input = createInput({
        name: "name",
        baseType: "string<32>",
        mappedType: "char",
        isString: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const char* name");
    });

    it("emits no const for a mut string parameter", () => {
      const input = createInput({
        name: "buffer",
        baseType: "string<64>",
        mappedType: "char",
        isString: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("char* buffer");
    });
  });

  describe("pass-by-reference parameters", () => {
    it("generates struct parameter with pointer in C mode", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Point* point");
    });

    it("generates struct parameter with reference in C++ mode", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      expect(result).toBe("const Point& point");
    });

    it("emits no const for a mut struct parameter", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isPassByReference: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("Point* point");
    });

    it("generates primitive parameter with pointer", () => {
      const input = createInput({
        name: "value",
        baseType: "u32",
        mappedType: "uint32_t",
        isPassByReference: true,
        isConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const uint32_t* value");
    });

    it("preserves const on a read-only parameter", () => {
      const input = createInput({
        name: "point",
        baseType: "Point",
        mappedType: "Point",
        isConst: true,
        isPassByReference: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Point* point");
    });
  });

  describe("unknown type parameters", () => {
    it("generates unknown type as pass-by-value", () => {
      const input = createInput({
        name: "data",
        baseType: "UnknownType",
        mappedType: "UnknownType",
        isPassByReference: false,
        isPassByValue: false,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("UnknownType data");
    });

    it("preserves const on unknown type", () => {
      const input = createInput({
        name: "data",
        baseType: "UnknownType",
        mappedType: "UnknownType",
        isConst: true,
        isPassByReference: false,
        isPassByValue: false,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const UnknownType data");
    });
  });

  describe("opaque handle parameters (Issue #995)", () => {
    it("uses pointer syntax for opaque handles in C++ mode", () => {
      // Opaque handles must use pointer syntax even in C++ mode
      // because C APIs expect pointers to incomplete struct types
      const input = createInput({
        name: "w",
        baseType: "widget_t",
        mappedType: "widget_t",
        isPassByReference: true,
        isOpaqueHandle: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer (not reference) in C++ mode
      expect(result).toBe("widget_t* w");
    });

    it("routes opaque handles through pass-by-reference path", () => {
      // Even if isPassByReference is false, opaque handles should
      // still generate pointer syntax
      const input = createInput({
        name: "ctx",
        baseType: "context_t",
        mappedType: "context_t",
        isPassByReference: false, // Not explicitly set
        isPassByValue: false, // Not explicitly set
        isOpaqueHandle: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      // Should still get pointer syntax from opaque handle routing
      expect(result).toBe("context_t* ctx");
    });

    it("preserves explicit const on opaque handles", () => {
      // If the user explicitly marks it const, that should be preserved
      const input = createInput({
        name: "widget",
        baseType: "widget_t",
        mappedType: "widget_t",
        isConst: true, // Explicit const
        isOpaqueHandle: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const widget_t* widget");
    });

    it("isOpaqueHandle overrides forcePointerSyntax check", () => {
      // isOpaqueHandle should force pointer even without forcePointerSyntax
      const input = createInput({
        name: "widget",
        baseType: "widget_t",
        mappedType: "widget_t",
        isPassByReference: true,
        forcePointerSyntax: false, // Not set
        isOpaqueHandle: true, // But opaque overrides
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer (not reference) due to isOpaqueHandle
      expect(result).toBe("widget_t* widget");
    });

    /**
     * ADR-030 / #996: an array of handles is an array of pointers, in both
     * modes -- `widget_t widgets[3]` is an array of an incomplete type. The
     * last row is the control: the same array without the flag is unchanged.
     */
    it.each<[string, string, boolean, boolean, string]>([
      ["in C", "*", false, true, "widget_t* widgets[3]"],
      ["in C++", "&", false, true, "widget_t* widgets[3]"],
      ["with explicit const", "*", true, true, "const widget_t* widgets[3]"],
      ["without the flag", "*", false, false, "widget_t widgets[3]"],
    ])(
      "spells an array of opaque handles %s",
      (_label, refSuffix, isConst, isOpaqueHandle, expected) => {
        const input = createInput({
          name: "widgets",
          baseType: "widget_t",
          mappedType: "widget_t",
          isArray: true,
          arrayDimensions: ["3"],
          isPassByReference: false,
          isConst,
          isOpaqueHandle,
        });

        expect(ParameterSignatureBuilder.build(input, refSuffix)).toBe(
          expected,
        );
      },
    );
  });

  describe("callback-compatible parameters (Issue #895)", () => {
    it("forceConst adds const from typedef signature", () => {
      const input = createInput({
        name: "area",
        baseType: "rect_t",
        mappedType: "rect_t",
        isPassByReference: true,
        forcePointerSyntax: true,
        forceConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer (not reference) and add const from typedef
      expect(result).toBe("const rect_t* area");
    });

    it("forcePointerSyntax uses pointer in C++ mode", () => {
      const input = createInput({
        name: "w",
        baseType: "widget_t",
        mappedType: "widget_t",
        isPassByReference: true,
        forcePointerSyntax: true,
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // Should use pointer even in C++ mode (& suffix)
      expect(result).toBe("widget_t* w");
    });

    it("forceConst without forcePointerSyntax still adds const", () => {
      const input = createInput({
        name: "data",
        baseType: "Data",
        mappedType: "Data",
        isPassByReference: true,
        forceConst: true,
      });

      const result = ParameterSignatureBuilder.build(input, "*");

      expect(result).toBe("const Data* data");
    });

    it("forceConst combines with forcePointerSyntax in C++ mode", () => {
      const input = createInput({
        name: "buf",
        baseType: "uint8_t",
        mappedType: "uint8_t",
        isPassByReference: true,
        forcePointerSyntax: true,
        forceConst: false, // typedef doesn't have const
      });

      const result = ParameterSignatureBuilder.build(input, "&");

      // No const, but still uses pointer
      expect(result).toBe("uint8_t* buf");
    });
  });

  describe("cstring parameters (#2311)", () => {
    it("adds no second const to a read-only cstring", () => {
      const input = createInput({
        name: "c_s",
        baseType: "cstring",
        mappedType: "const char*",
        isConst: true,
      });

      expect(ParameterSignatureBuilder.build(input, "*")).toBe(
        "const char** c_s",
      );
    });

    it("adds no second const to a cstring passed by value", () => {
      const input = createInput({
        name: "c_s",
        baseType: "cstring",
        mappedType: "const char*",
        isConst: true,
        isPassByValue: true,
        isPassByReference: false,
      });

      expect(ParameterSignatureBuilder.build(input, "&")).toBe(
        "const char* c_s",
      );
    });
  });
});
