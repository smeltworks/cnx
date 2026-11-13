/**
 * Unit tests for ParameterInputAdapter
 *
 * Tests the adapter that normalizes planned-AST and symbol data into
 * IParameterInput.
 *
 * #1445: `fromAST` takes an `IPlannedParameter` now, so the AST half builds
 * plans instead of parsing source. The `typeName`/`mappedType` values below
 * are what the old mocks produced for the same sources -- `getTypeName` was
 * `type.getText()`, so an array parameter's type name carries its dimensions,
 * and `generateType` stripped them before the map lookup.
 *
 * What moved out with the contexts is `CodeGenerator.planParameter`: the
 * mapping from a parameter context to this record, exercised by the 1254
 * integration fixtures.
 */

import { describe, it, expect } from "vitest";
import ParameterInputAdapter from "../ParameterInputAdapter";
import IParameterSymbol from "../../../../../utils/types/IParameterSymbol";
import ICallbackTypeInfo from "../../../../../types/ICallbackTypeInfo";
import type IPlannedParameter from "../../types/IPlannedParameter";
import type IParameterPassing from "../../../../../types/IParameterPassing";

const TYPE_MAP: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i32: "int32_t",
  f32: "float",
  f64: "double",
  bool: "bool",
};

/** What the old `generateType` mock did: strip dimensions, then map. */
function mapTypeName(typeName: string): string {
  const base = typeName.replace(/\[.*$/, "");
  return TYPE_MAP[base] ?? base;
}

/** A planned parameter, with everything absent unless a test fills it in. */
function planned(
  overrides: Partial<IPlannedParameter> & { name: string; typeName: string },
): IPlannedParameter {
  return {
    isConst: false,
    mappedType: mapTypeName(overrides.typeName),
    renderDimensions: null,
    isString: false,
    stringCapacity: undefined,
    line: 1,
    stringTypeLine: 1,
    arrayTypeLine: 1,
    ...overrides,
  };
}

/** Dimensions a test supplies, wrapped as the thunk the plan carries. */
function dimensions(...dims: string[]): () => readonly string[] {
  return () => dims;
}

/**
 * Build default IFromASTDeps for testing.
 */
/** A 2.2 passing decision, by reference unless a test says otherwise */
function passing(
  byValue = false,
  typedefPointer = false,
  typedefConst = false,
): IParameterPassing {
  return {
    byValue,
    typedefPointer,
    typedefConst,
    argument: byValue ? "value" : "reference",
  };
}

function createDefaultASTDeps(overrides?: {
  isModified?: boolean;
  passing?: IParameterPassing;
  isOpaqueHandle?: boolean;
  callbackTypes?: ReadonlyMap<string, ICallbackTypeInfo>;
}) {
  return {
    callbackTypes:
      overrides?.callbackTypes ?? new Map<string, ICallbackTypeInfo>(),
    isModified: overrides?.isModified ?? false,
    passing: overrides?.passing ?? passing(),
    isOpaqueHandle: overrides?.isOpaqueHandle ?? false,
  };
}

describe("ParameterInputAdapter", () => {
  describe("fromSymbol", () => {
    const defaultDeps = {
      mapType: (t: string) => {
        const map: Record<string, string> = {
          u8: "uint8_t",
          u16: "uint16_t",
          u32: "uint32_t",
          u64: "uint64_t",
          i32: "int32_t",
          f32: "float",
          f64: "double",
          bool: "bool",
          ISR: "ISR",
        };
        return map[t] ?? t;
      },
      isPassByValue: false,
    };

    it("converts basic primitive parameter", () => {
      const param: IParameterSymbol = {
        name: "value",
        emittedName: "value",
        type: "u32",
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.name).toBe("value");
      expect(result.baseType).toBe("u32");
      expect(result.mappedType).toBe("uint32_t");
      expect(result.isConst).toBe(false);
      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(false);
      expect(result.isPassByValue).toBe(false);
    });

    it("converts array parameter", () => {
      const param: IParameterSymbol = {
        name: "arr",
        emittedName: "arr",
        type: "u32",
        isConst: false,
        isArray: true,
        arrayDimensions: ["10"],
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["10"]);
      expect(result.isString).toBe(false);
    });

    it("converts multi-dimensional array parameter", () => {
      const param: IParameterSymbol = {
        name: "matrix",
        emittedName: "matrix",
        type: "u8",
        isConst: false,
        isArray: true,
        arrayDimensions: ["4", "4"],
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["4", "4"]);
    });

    it("converts unbounded string array with isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "strings",
        emittedName: "strings",
        type: "string",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5"],
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(true);
      expect(result.arrayDimensions).toEqual(["5"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts bounded string array without isUnboundedString flag", () => {
      const param: IParameterSymbol = {
        name: "names",
        emittedName: "names",
        type: "string<32>",
        isConst: false,
        isArray: true,
        arrayDimensions: ["5", "33"],
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      expect(result.isUnboundedString).toBe(false);
      expect(result.arrayDimensions).toEqual(["5", "33"]);
      expect(result.mappedType).toBe("char");
    });

    it("converts non-array string parameter", () => {
      const param: IParameterSymbol = {
        name: "name",
        emittedName: "name",
        type: "string<32>",
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(true);
      expect(result.mappedType).toBe("char");
    });

    it.each([
      ["uses pass-by-value from deps for ISR", "handler", "ISR"],
      ["uses pass-by-value from deps for float types", "value", "f32"],
      ["uses pass-by-value from deps for enums", "status", "Status"],
    ])("%s", (_label, source, source2) => {
      const param: IParameterSymbol = {
        name: source,
        emittedName: source,
        type: source2,
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(
        { ...param, passing: passing(true) },
        defaultDeps,
      );

      expect(result.isPassByValue).toBe(true);
      expect(result.isPassByReference).toBe(false);
    });

    it("sets isPassByReference when not pass-by-value", () => {
      const param: IParameterSymbol = {
        name: "count",
        emittedName: "count",
        type: "u32",
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
    });

    it("preserves const modifier", () => {
      const param: IParameterSymbol = {
        name: "value",
        emittedName: "value",
        type: "u32",
        isConst: true,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isConst).toBe(true);
    });

    it("forces pointer when the typedef takes a pointer (Issue #914)", () => {
      const param: IParameterSymbol = {
        name: "buf",
        emittedName: "buf",
        type: "u8",
        isConst: false,
        isArray: false,
        passing: passing(false, true),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
      expect(result.forcePointerSyntax).toBe(true);
    });

    it("forces const when the typedef says const (Issue #914)", () => {
      const param: IParameterSymbol = {
        name: "area",
        emittedName: "area",
        type: "rect_t",
        isConst: false,
        isArray: false,
        passing: passing(false, true, true),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forceConst).toBe(true);
      expect(result.forcePointerSyntax).toBe(true);
    });

    it("does not force pointer when no typedef asks for one", () => {
      const param: IParameterSymbol = {
        name: "value",
        emittedName: "value",
        type: "u32",
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forcePointerSyntax).toBeUndefined();
      expect(result.forceConst).toBeUndefined();
    });

    // Issue #995: Opaque handle support in fromSymbol
    it("passes through isOpaqueHandle when set (Issue #995)", () => {
      // The adapter passes through isOpaqueHandle; ParameterSignatureBuilder
      // applies the rule (suppress auto-const, force pointer syntax)
      const param: IParameterSymbol = {
        name: "widget",
        emittedName: "widget",
        type: "widget_t",
        isConst: false,
        isArray: false,
        isOpaqueHandle: true,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.isOpaqueHandle).toBe(true);
    });

    it("does not force pointer when isOpaqueHandle is not set", () => {
      const param: IParameterSymbol = {
        name: "point",
        emittedName: "point",
        type: "Point",
        isConst: false,
        isArray: false,
        passing: passing(),
      };

      const result = ParameterInputAdapter.fromSymbol(param, defaultDeps);

      expect(result.forcePointerSyntax).toBeUndefined();
    });
  });

  describe("fromAST", () => {
    it("converts basic primitive parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "value", typeName: "u32" }),
        createDefaultASTDeps(),
      );

      expect(result.name).toBe("value");
      expect(result.baseType).toBe("u32");
      expect(result.mappedType).toBe("uint32_t");
      expect(result.isConst).toBe(false);
      expect(result.isArray).toBe(false);
      expect(result.isString).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(true);
    });

    it("converts const parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "value", typeName: "u32", isConst: true }),
        createDefaultASTDeps(),
      );

      expect(result.isConst).toBe(true);
    });

    it("converts array parameter with dimension", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "arr",
          typeName: "u32[10]",
          renderDimensions: dimensions("10"),
        }),
        createDefaultASTDeps(),
      );

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["10"]);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(false);
    });

    it("converts multi-dimensional array parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "matrix",
          typeName: "u8[4][4]",
          renderDimensions: dimensions("4", "4"),
        }),
        createDefaultASTDeps(),
      );

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["4", "4"]);
    });

    // Issue #986: ADR-006 says arrays are mutable by default.
    // Arrays should never get auto-const, even when unmodified.
    it("converts an unmodified array parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "data",
          typeName: "u8[8]",
          renderDimensions: dimensions("8"),
        }),
        createDefaultASTDeps({ isModified: false }),
      );

      expect(result.isArray).toBe(true);
    });

    /**
     * The dimensions are a thunk, and a callback parameter returns before any
     * of them is needed. Rendering one is not free -- a non-constant dimension
     * goes through expression generation, which can queue a pending temp
     * declaration -- so a rendered-then-discarded dimension leaks it.
     */
    it("renders no dimension for a parameter whose type is a callback", () => {
      let rendered = 0;
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "handleClick",
          {
            functionName: "handleClick",
            returnType: "void",
            parameters: [],
            typedefName: "handleClick_fp",
            returnBuffer: null,
          },
        ],
      ]);

      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "onClick",
          typeName: "handleClick",
          renderDimensions: () => {
            rendered += 1;
            return ["4"];
          },
        }),
        createDefaultASTDeps({ callbackTypes }),
      );

      expect(result.isCallback).toBe(true);
      expect(rendered).toBe(0);
    });

    it("converts non-array string parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "name",
          typeName: "string<32>",
          isString: true,
          stringCapacity: 32,
        }),
        createDefaultASTDeps(),
      );

      expect(result.isString).toBe(true);
      expect(result.isArray).toBe(false);
      expect(result.mappedType).toBe("char");
      expect(result.stringCapacity).toBe(32);
      expect(result.isPassByValue).toBe(false);
      expect(result.isPassByReference).toBe(false);
    });

    it("converts callback parameter", () => {
      const callbackTypes = new Map<string, ICallbackTypeInfo>([
        [
          "handleClick",
          {
            functionName: "handleClick",
            returnType: "void",
            parameters: [],
            typedefName: "handleClick_fp",
            returnBuffer: null,
          },
        ],
      ]);

      const result = ParameterInputAdapter.fromAST(
        planned({ name: "onClick", typeName: "handleClick" }),
        createDefaultASTDeps({ callbackTypes }),
      );

      expect(result.isCallback).toBe(true);
      expect(result.callbackTypedefName).toBe("handleClick_fp");
      expect(result.isPassByValue).toBe(true);
      expect(result.isPassByReference).toBe(false);
    });

    it("sets isPassByReference for known struct", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "p", typeName: "Point" }),
        createDefaultASTDeps(),
      );

      expect(result.isPassByReference).toBe(true);
      expect(result.isPassByValue).toBe(false);
    });

    it("sets isPassByValue when pre-computed", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "value", typeName: "f32" }),
        createDefaultASTDeps({ passing: passing(true) }),
      );

      expect(result.isPassByValue).toBe(true);
    });

    it("converts string array with capacity (string<N>[M])", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "names",
          typeName: "string<32>[5]",
          renderDimensions: dimensions("5"),
          isString: true,
          stringCapacity: 32,
        }),
        createDefaultASTDeps(),
      );

      expect(result.isArray).toBe(true);
      expect(result.isString).toBe(true);
      // Capacity + 1 for null terminator appended as extra dimension
      expect(result.arrayDimensions).toEqual(["5", "33"]);
      expect(result.isPassByReference).toBe(false);
    });

    it("takes forceConst from the passing decision (Issue #895)", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "area", typeName: "Point" }),
        createDefaultASTDeps({ passing: passing(false, false, true) }),
      );

      expect(result.forceConst).toBe(true);
    });

    it("takes a typedef pointer and const together", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "area", typeName: "Point" }),
        createDefaultASTDeps({ passing: passing(false, true, true) }),
      );

      expect(result.forcePointerSyntax).toBe(true);
      expect(result.forceConst).toBe(true);
      expect(result.isPassByReference).toBe(true);
    });

    it("forceConst defaults to undefined when not provided", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "area", typeName: "Point" }),
        createDefaultASTDeps(),
      );

      expect(result.forceConst).toBeUndefined();
    });

    // Issue #995: Opaque handles pass through isOpaqueHandle; builder applies rule
    it("passes through isOpaqueHandle for opaque type parameter", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "w", typeName: "widget_t" }),
        createDefaultASTDeps({ isOpaqueHandle: true }),
      );

      // Adapter still passes the registry's decision through; the builder
      // still applies its own guard as a backstop.
      expect(result.isOpaqueHandle).toBe(true);
      //
      // Behavior-preserving at the output: the builder zeroed this value
      // anyway, so no generated C changes. Verified by the integration suite
      // regenerating no snapshots.
    });

    // #1722: an opaque handle is decided once (1.4's stamp) and handed in as
    // `isOpaqueHandle`; #958's "typedef struct needs pointer semantics" reads
    // that same answer. This case used to hand in `isOpaqueHandle: true`
    // beside `isTypedefStructType: () => false` and expect no
    // forcePointerSyntax -- a combination StructCollector cannot produce, since
    // it marks an opaque type and a typedef struct under one condition. In a
    // real run an opaque parameter always took forcePointerSyntax.
    it("gives an opaque handle pointer semantics from the one decision it is handed", () => {
      const result = ParameterInputAdapter.fromAST(
        planned({ name: "w", typeName: "widget_t" }),
        {
          ...createDefaultASTDeps({ isOpaqueHandle: true }),
        },
      );

      expect(result.forcePointerSyntax).toBe(true);
      expect(result.isOpaqueHandle).toBe(true);
    });
  });

  /**
   * ADR-030 / #996: an array of opaque handles is an array of pointers, so both
   * array branches -- the `.c`'s and the header's -- carry the flag the builder
   * spells `T*` elements from. Each dropped it, and `Dev[2] arr` became
   * `Dev arr[2]`, an array of an incomplete type, in both files.
   */
  describe("array of opaque handles (#996)", () => {
    it.each<[string, boolean, boolean | undefined]>([
      ["the parse-tree adapter", true, true],
      ["the parse-tree adapter, not a handle", false, undefined],
    ])("%s carries the element flag", (_label, isOpaqueHandle, expected) => {
      const result = ParameterInputAdapter.fromAST(
        planned({
          name: "arr",
          typeName: "Dev",
          renderDimensions: dimensions("2"),
        }),
        createDefaultASTDeps({ isOpaqueHandle }),
      );

      expect(result.isArray).toBe(true);
      expect(result.isOpaqueHandle).toBe(expected);
    });

    it.each<[string, boolean | undefined, boolean | undefined]>([
      ["the header adapter", true, true],
      ["the header adapter, not a handle", undefined, undefined],
    ])("%s carries the element flag", (_label, isOpaqueHandle, expected) => {
      const result = ParameterInputAdapter.fromSymbol(
        {
          name: "arr",
          emittedName: "arr",
          type: "Dev",
          isConst: false,
          isArray: true,
          arrayDimensions: ["2"],
          isOpaqueHandle,
          passing: passing(),
        },
        { mapType: (t: string) => t },
      );

      expect(result.isArray).toBe(true);
      expect(result.isOpaqueHandle).toBe(expected);
    });
  });
});
