/**
 * Unit tests for FunctionContextManager
 *
 * Issue #793: Tests for the extracted function context manager.
 *
 * #1445: the manager reads planned parameters, so these build values rather
 * than mock parse contexts cast `as never` -- a cast that made the whole
 * surface invisible to the type checker, the same hole slices 12, 14 and 15
 * found elsewhere.
 *
 * Two describes went with the methods they covered. `getStringCapacity` and
 * `extractParamArrayDimensions` read a `TypeContext` and a `ParameterContext`
 * and nothing else; their work is `CodeGenerator.planFunctionParameter`'s now,
 * and the 1259 integration fixtures exercise it. `resolveParameterTypeInfo`'s
 * qualified/scoped/global cases are likewise `TypeNameLadder`'s answer, supplied
 * here as the classification rather than re-derived.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import FunctionContextManager from "../FunctionContextManager";
import ParameterInfoPlanner from "../../../../2-Plan/ParameterInfoPlanner";
import IFunctionContextCallbacks from "../../../../2-Plan/types/IFunctionContextCallbacks";
import TranspileState from "../../../../TranspileState";
import type IPlannedType from "../../../../2-Plan/types/IPlannedType";
import type IPlannedFunctionParameter from "../../../../2-Plan/types/IPlannedFunctionParameter";
import type INamedTypeResolution from "../../../../../types/INamedTypeResolution";
import type IProgram from "../../../../../types/IProgram";
import installMockSymbols from "../../../../__tests__/installMockSymbols";

/**
 * Installs a complete, empty mock symbol world in `state.symbols` and the
 * matching `state.symbolTable` entries.
 */
function setupSymbols(): void {
  installMockSymbols(state);
}

/**
 * Default callbacks for testing.
 */
function createMockCallbacks(): IFunctionContextCallbacks {
  return {
    isKnownStruct: vi.fn(() => false),
  };
}

/** A planned type with every alternative absent unless a test fills one in. */
function plannedType(overrides: Partial<IPlannedType> = {}): IPlannedType {
  return {
    named: null,
    isCallback: false,
    isString: false,
    stringTypeText: undefined,
    primitiveName: null,
    isArray: false,
    userTypeLine: undefined,
    text: "",
    writtenName: "",
    ...overrides,
  };
}

/** A named-type branch as `TypeNameLadder` reports it. */
function named(
  branch: INamedTypeResolution["branch"],
  written: string,
  name: string = written,
): INamedTypeResolution {
  return { branch, written, name };
}

/** A planned parameter, with the type's alternatives already classified. */
function plannedParam(
  name: string,
  type: IPlannedType,
  overrides: Partial<IPlannedFunctionParameter> = {},
): IPlannedFunctionParameter {
  nextColumn += 1;
  return {
    name,
    nameSpan: {
      line: 1,
      column: nextColumn,
      endLine: 1,
      endColumn: nextColumn,
    },
    isConst: false,
    isArray: false,
    arrayDimensions: [],
    stringCapacity: undefined,
    type,
    typeName: type.text,
    ...overrides,
  };
}

let state = new TranspileState();
let nextColumn = 0;

/** 2.2 plans the parameter of the function being generated; 2.3 enters it */
function processParameter(
  param: IPlannedFunctionParameter,
  callbacks: IFunctionContextCallbacks,
  paramIndex: number,
  into: TranspileState,
): void {
  into.currentParameters.set(
    param.name,
    ParameterInfoPlanner.infoOf(
      param,
      paramIndex,
      into.currentFunctionName ?? "use",
      callbacks,
      into,
    ),
  );
}

/** 2.2 plans `params`, then 2.3 enters the function with them (#1991) */
function enterParameters(
  params: readonly IPlannedFunctionParameter[] | null,
  callbacks: IFunctionContextCallbacks,
): void {
  state.plannedParameters = new Map(
    (params ?? []).map((param, index) => [
      TranspileState.parameterKey(param.nameSpan),
      ParameterInfoPlanner.infoOf(param, index, "use", callbacks, state),
    ]),
  );
  FunctionContextManager.processParameterList(params, state);
}

/**
 * #1639: one settled parameter per position a case registers, so
 * `ParameterPassing` has each one's declaration; the stamped ones first, in
 * order. The rest are read-write `u32`s, which no case's assertions turn on.
 */
function settledParameters(stamps: Record<string, boolean>): unknown[] {
  const stamped = Object.entries(stamps);
  return Array.from({ length: 8 }, (_, i) => ({
    name: stamped[i]?.[0] ?? `p${i}`,
    type: { kind: "primitive", primitive: "u32" },
    isConst: false,
    isArray: false,
    isOpaqueHandle: stamped[i]?.[1] || undefined,
  }));
}

/**
 * #1722: registering a parameter reads its opaque-handle stamp from the settled
 * symbol of the function being generated, as a real run does -- a parameter is
 * only ever registered inside one. `stamps` names the parameters 1.4 marked.
 */
function generatingFunction(stamps: Record<string, boolean> = {}): void {
  state.currentFunctionName = "use";
  state.program = {
    symbolByCName: (name: string) =>
      name === "use"
        ? {
            kind: "function",
            name: "use",
            parameters: settledParameters(stamps),
          }
        : undefined,
    callbackCompatibleFunctions: () => new Map<string, string>(),
    passByValueParams: () => new Map<string, ReadonlySet<string>>(),
    knownEnums: () => new Set<string>(),
    symbolTable: () => ({ getStructFields: () => undefined }),
  } as unknown as IProgram;
}

describe("FunctionContextManager", () => {
  beforeEach(() => {
    state = new TranspileState();
    setupSymbols();
  });

  describe("resolveReturnTypeAndParams", () => {
    it("returns int for main with args, and records the args name", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        true,
        "args",
        state,
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("int argc, char *argv[]");
      expect(state.mainArgsName).toBe("args");
    });

    it("returns int for main without args", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "main",
        "void",
        false,
        undefined,
        state,
      );

      expect(result.actualReturnType).toBe("int");
      expect(result.initialParams).toBe("");
    });

    it("preserves return type for non-main functions", () => {
      const result = FunctionContextManager.resolveReturnTypeAndParams(
        "myFunc",
        "u32",
        false,
        undefined,
        state,
      );

      expect(result.actualReturnType).toBe("u32");
      expect(result.initialParams).toBe("");
    });
  });

  describe("processParameterList", () => {
    beforeEach(() => generatingFunction());

    it("clears existing parameters", () => {
      state.currentParameters.set("existing", {
        name: "existing",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });
      const callbacks = createMockCallbacks();

      enterParameters(null, callbacks);

      expect(state.currentParameters.size).toBe(0);
    });

    it("processes multiple parameters", () => {
      const callbacks = createMockCallbacks();

      enterParameters(
        [
          plannedParam("x", plannedType({ primitiveName: "u32" })),
          plannedParam("y", plannedType({ primitiveName: "i32" })),
        ],
        callbacks,
      );

      expect(state.currentParameters.size).toBe(2);
      expect(state.currentParameters.has("x")).toBe(true);
      expect(state.currentParameters.has("y")).toBe(true);
    });
  });

  describe("processParameter", () => {
    beforeEach(() => generatingFunction());

    it("registers primitive parameter", () => {
      const callbacks = createMockCallbacks();

      processParameter(
        plannedParam("x", plannedType({ primitiveName: "u32" })),
        callbacks,
        0,
        state,
      );

      const paramInfo = state.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.baseType).toBe("u32");
      expect(paramInfo!.isArray).toBe(false);
      expect(paramInfo!.isStruct).toBe(false);
    });

    it("registers array parameter", () => {
      const callbacks = createMockCallbacks();

      processParameter(
        plannedParam(
          "arr",
          plannedType({ primitiveName: "u8", isArray: true }),
          {
            isArray: true,
            arrayDimensions: [8],
          },
        ),
        callbacks,
        0,
        state,
      );

      const paramInfo = state.currentParameters.get("arr");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isArray).toBe(true);
    });

    it("registers const parameter", () => {
      const callbacks = createMockCallbacks();

      processParameter(
        plannedParam("x", plannedType({ primitiveName: "u32" }), {
          isConst: true,
        }),
        callbacks,
        0,
        state,
      );

      const paramInfo = state.currentParameters.get("x");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isConst).toBe(true);
    });

    it("registers struct parameter using callback", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isKnownStruct as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      processParameter(
        plannedParam("point", plannedType({ named: named("bare", "Point") })),
        callbacks,
        0,
        state,
      );

      const paramInfo = state.currentParameters.get("point");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isStruct).toBe(true);
      expect(callbacks.isKnownStruct).toHaveBeenCalledWith("Point");
    });

    it("registers string parameter", () => {
      const callbacks = createMockCallbacks();

      processParameter(
        plannedParam(
          "name",
          plannedType({ isString: true, stringTypeText: "string<32>" }),
          { stringCapacity: 32 },
        ),
        callbacks,
        0,
        state,
      );

      const paramInfo = state.currentParameters.get("name");
      expect(paramInfo).toBeDefined();
      expect(paramInfo!.isString).toBe(true);
    });

    /**
     * ADR-030 / #1722: the one opaque-handle decision, READ at registration.
     *
     * 1.4 Resolve stamps the settled parameter (`IParameterInfo.isOpaqueHandle`);
     * registration reads that stamp through the function's settled symbol and
     * asks no predicate of its own, so the `.h` prototype -- which reads the
     * same stamp -- cannot disagree. Each row therefore supplies what a real run
     * has: the function being generated, and its settled symbol.
     *
     * Every row registers `isStruct` -- the opaque ones through the stamp, the
     * complete struct through its known fields -- which is exactly why
     * `isStruct` could not carry this: the two look the same through it. The
     * complete struct is the row that must NOT be a handle.
     *
     * An array of handles IS one, element-wise: #996 decided an array of them
     * is an array of pointers, and this row used to pin the opposite, which is
     * what left `Dev[2] arr` as `Dev arr[2]`. The registry's `isPointer` -- what
     * a call site reads to skip `&` -- is asserted beside it, because it is the
     * same decision and used to be read from a second predicate.
     */
    it.each<[string, string, boolean, boolean, boolean]>([
      ["an opaque handle", "Dev", true, false, true],
      ["a complete typedef'd struct", "Full", false, false, false],
      ["an array of opaque handles", "Dev", true, true, true],
    ])(
      "registers %s with the matching isOpaqueHandle",
      (_label, typeName, isOpaque, isArray, expected) => {
        generatingFunction({ p: isOpaque });
        // A struct with a body is a known struct; a forward-declared typedef
        // is not -- the stamp is what makes it one.
        const callbacks: IFunctionContextCallbacks = {
          isKnownStruct: vi.fn(() => !isOpaque),
        };

        processParameter(
          plannedParam(
            "p",
            plannedType({ named: named("bare", typeName), isArray }),
            { isArray },
          ),
          callbacks,
          0,
          state,
        );

        const paramInfo = state.currentParameters.get("p");
        expect(paramInfo!.isStruct).toBe(true);
        expect(paramInfo!.isOpaqueHandle).toBe(expected);
        // #1668: the call site's pointer-ness is the parameter's declared
        // type (`DeclaredTypeInfo`), not a registry entry written here; its
        // handle case is asserted in DeclaredTypeInfo.test.ts
      },
    );
  });

  describe("resolveParameterTypeInfo", () => {
    it("resolves primitive type", () => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({ primitiveName: "u32", text: "u32" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("u32");
      expect(result.isStruct).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isString).toBe(false);
    });

    it("resolves user type and checks struct", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isKnownStruct as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({ named: named("bare", "Point"), text: "Point" }),
        callbacks,
      );

      expect(result.typeName).toBe("Point");
      expect(result.isStruct).toBe(true);
    });

    /**
     * The four named branches arrive already resolved -- `TypeNameLadder` decided
     * them, and what it decided is its own test's business. What THIS module
     * decides is the consequence: struct-ness, callback-ness, and that the
     * name is used verbatim.
     */
    it.each<[string, INamedTypeResolution, string]>([
      [
        "a qualified type",
        named("qualified", "Scope.Type", "Scope__Type"),
        "Scope__Type",
      ],
      [
        "a scoped type",
        named("this", "LocalType", "MyScope__LocalType"),
        "MyScope__LocalType",
      ],
      ["a global type", named("global", "GlobalType"), "GlobalType"],
    ])("uses the resolved name for %s", (_label, resolution, expected) => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({ named: resolution, text: resolution.written }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe(expected);
    });

    it("resolves a top-level string to the bare name", () => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({
          isString: true,
          stringTypeText: "string<32>",
          text: "string<32>",
        }),
        createMockCallbacks(),
      );

      // The capacity travels separately, through stringCapacities.
      expect(result.typeName).toBe("string");
      expect(result.isString).toBe(true);
    });

    it("keeps the written text for a string ARRAY element", () => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({
          isString: true,
          isArray: true,
          stringTypeText: "string<32>",
          text: "string<32>[5]",
        }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("string<32>");
      expect(result.isString).toBe(true);
    });

    it("resolves an array of primitives to the element type", () => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({ primitiveName: "u8", isArray: true, text: "u8[10]" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("u8");
      expect(result.isStruct).toBe(false);
    });

    it("resolves an array of user types to the element type", () => {
      const callbacks = createMockCallbacks();
      (callbacks.isKnownStruct as ReturnType<typeof vi.fn>).mockReturnValue(
        true,
      );

      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({
          named: named("bare", "Point"),
          isArray: true,
          text: "Point[5]",
        }),
        callbacks,
      );

      expect(result.typeName).toBe("Point");
      expect(result.isStruct).toBe(true);
    });

    it("returns fallback for unknown type", () => {
      const result = ParameterInfoPlanner.resolveParameterTypeInfo(
        plannedType({ text: "SomeUnknownType" }),
        createMockCallbacks(),
      );

      expect(result.typeName).toBe("SomeUnknownType");
      expect(result.isStruct).toBe(false);
      expect(result.isCallback).toBe(false);
      expect(result.isString).toBe(false);
    });
  });

  describe("parameterEmittedName (#1290)", () => {
    // The body reads the C name 1.4 settled on the function's symbol; one it
    // never settled is a pipeline bug, not a parameter to spell as written.
    const settledAs = (emittedName: string | null): void => {
      state.currentFunctionName = "use";
      state.program = {
        symbolByCName: (name: string) =>
          name === "use"
            ? {
                kind: "function",
                name: "use",
                parameters: [{ name: "total", emittedName }],
              }
            : undefined,
      } as unknown as IProgram;
    };

    it("reads the settled C name", () => {
      settledAs("use__total");
      expect(FunctionContextManager.parameterEmittedName(0, state)).toBe(
        "use__total",
      );
    });

    it("is an internal error for a parameter 1.4 did not settle", () => {
      settledAs(null);
      expect(() =>
        FunctionContextManager.parameterEmittedName(0, state),
      ).toThrow("1.4 settled the C name of parameter 0 of use");
    });

    it("is an internal error for a parameter the symbol does not have", () => {
      settledAs("use__total");
      expect(() =>
        FunctionContextManager.parameterEmittedName(1, state),
      ).toThrow("1.4 settled the C name of parameter 1 of use");
    });
  });

  describe("clearParameters", () => {
    it("clears currentParameters map", () => {
      state.currentParameters.set("x", {
        name: "x",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      FunctionContextManager.clearParameters(state);

      expect(state.currentParameters.size).toBe(0);
    });
  });

  describe("enterFunctionBody", () => {
    it("sets inFunctionBody to true", () => {
      state.inFunctionBody = false;

      FunctionContextManager.enterFunctionBody(state);

      expect(state.inFunctionBody).toBe(true);
    });

    it("clears float bit shadows", () => {
      state.floatBitShadows.add("shadow");

      FunctionContextManager.enterFunctionBody(state);

      expect(state.floatBitShadows.size).toBe(0);
    });
  });

  describe("exitFunctionBody", () => {
    it("sets inFunctionBody to false", () => {
      state.inFunctionBody = true;

      FunctionContextManager.exitFunctionBody(state);

      expect(state.inFunctionBody).toBe(false);
    });

    it("clears mainArgsName", () => {
      state.mainArgsName = "args";

      FunctionContextManager.exitFunctionBody(state);

      expect(state.mainArgsName).toBeNull();
    });
  });
});
