/**
 * Unit tests for ArgumentGenerator
 * Issue #794: Extract Argument Generator from CodeGenerator
 */

import ArgumentForm from "../../../../2-Plan/ArgumentForm";
import { describe, it, expect, beforeEach } from "vitest";
import ArgumentGenerator from "../ArgumentGenerator";
import TranspileState from "../../../../TranspileState";
import IArgumentGeneratorCallbacks from "../../../../2-Plan/types/IArgumentGeneratorCallbacks";
import type TRenderedStringPart from "../../../../../types/TRenderedStringPart";
import type TTypeInfo from "../../../../../types/TTypeInfo";

let state = new TranspileState();

/** #1668 (C7): what each case declares, by name -- a call passes it in */
const declared = new Map<string, TTypeInfo>();
function declare(name: string, info: TTypeInfo): void {
  declared.set(name, info);
}

describe("ArgumentGenerator", () => {
  // #1445: the callbacks are thunks and `generateArg` takes no node, so the 22
  // `null as never` placeholders these tests passed as `ctx` are gone. One of
  // them carried the comment "ctx not used in this path" -- which was true of
  // every path, and is why this module left the parse-tree population.
  // Mock callbacks that return predictable values
  const createMockCallbacks = (
    overrides: Partial<IArgumentGeneratorCallbacks> = {},
  ): IArgumentGeneratorCallbacks & {
    readonly renderStringParts: () => readonly TRenderedStringPart[];
  } => ({
    renderStringParts: () => [],
    getLvalueType: () => null,
    getMemberAccessArrayStatus: () => "not-array",
    isCppMemberConversionRequired: () => false,
    isStringSubscriptAccess: () => false,
    isCompoundLiteral: () => false,
    generateExpression: () => "expr",
    ...overrides,
  });

  beforeEach(() => {
    declared.clear();
    state = new TranspileState();
  });

  describe("handleIdentifierArg", () => {
    describe("parameters", () => {
      it("returns parameter name unchanged (already pointers)", () => {
        state.currentParameters.set("cfg", {
          name: "cfg",
          baseType: "Config",
          isArray: false,
          isStruct: true,
          isConst: false,
          isCallback: false,
          isString: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg(
          "cfg",
          state.currentParameters.get("cfg"),
          declared.get("cfg"),
          state,
        );
        expect(result).toBe("cfg");
      });
    });

    describe("local arrays", () => {
      it("returns array name unchanged (decay to pointers)", () => {
        declare("buffer", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg(
          "buffer",
          state.currentParameters.get("buffer"),
          declared.get("buffer"),
          state,
        );
        expect(result).toBe("buffer");
      });
    });

    describe("global arrays", () => {
      it("returns global array name unchanged", () => {
        declare("globalArr", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg(
          "globalArr",
          state.currentParameters.get("globalArr"),
          declared.get("globalArr"),
          state,
        );
        expect(result).toBe("globalArr");
      });

      // #1450: this asserted `&name`, and `&name` on a `char[N]` is
      // `char (*)[N]` -- not the `char*` a `string<N>` parameter is generated
      // as. gcc: "passing argument 1 from incompatible pointer type". The test
      // pinned the defect rather than the behavior, which is how five
      // committed snapshots came to hold it too; `&x` and `x` share a value, so
      // execution tests passed and only `-Werror` could tell.
      it("lets a global string decay, like any other array", () => {
        state.cppMode = false;
        declare("name", {
          baseType: "char",
          bitWidth: 8,
          isArray: true,
          isConst: false,
          isString: true,
        });

        const result = ArgumentGenerator.handleIdentifierArg(
          "name",
          state.currentParameters.get("name"),
          declared.get("name"),
          state,
        );
        expect(result).toBe("name");
      });
    });

    describe("scope members", () => {
      // #1760 review: the qualified name is the binder's answer, which the
      // walker passes as `emitted`; this no longer consults scope members
      it("adds & to the bound scope member in C mode", () => {
        state.cppMode = false;

        const result = ArgumentGenerator.handleIdentifierArg(
          "LED__brightness",
          state.currentParameters.get("brightness"),
          declared.get("brightness"),
          state,
        );
        expect(result).toBe("&LED__brightness");
      });

      it("passes the bound scope member without & in C++ mode", () => {
        state.cppMode = true;

        const result = ArgumentGenerator.handleIdentifierArg(
          "LED__brightness",
          state.currentParameters.get("brightness"),
          declared.get("brightness"),
          state,
        );
        expect(result).toBe("LED__brightness");
      });
    });

    describe("shadowing locals", () => {
      it("passes a shadowing local's own name, not the global's", () => {
        state.cppMode = false;

        const result = ArgumentGenerator.handleIdentifierArg(
          "g__x",
          state.currentParameters.get("x"),
          declared.get("x"),
          state,
        );
        expect(result).toBe("&g__x");
      });

      it("passes a shadowing local array by its own name", () => {
        declare("buf", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });

        const result = ArgumentGenerator.handleIdentifierArg(
          "main__buf",
          state.currentParameters.get("buf"),
          declared.get("buf"),
          state,
        );
        expect(result).toBe("main__buf");
      });
    });

    describe("local variables", () => {
      it("adds & for local variable in C mode", () => {
        state.cppMode = false;

        const result = ArgumentGenerator.handleIdentifierArg(
          "value",
          state.currentParameters.get("value"),
          declared.get("value"),
          state,
        );
        expect(result).toBe("&value");
      });

      it("returns local variable unchanged in C++ mode", () => {
        state.cppMode = true;

        const result = ArgumentGenerator.handleIdentifierArg(
          "value",
          state.currentParameters.get("value"),
          declared.get("value"),
          state,
        );
        expect(result).toBe("value");
      });
    });
  });

  describe("formOf", () => {
    it("is identifier for a bare name", () => {
      expect(
        ArgumentForm.of(true, "u8", createMockCallbacks(), false, true),
      ).toEqual({ kind: "identifier" });
    });

    it.each([
      ["no target type", undefined, false, null],
      ["a void target type", "void", false, null],
      ["C++, where an rvalue binds to const T&", "u8", true, null],
      ["C, a compound literal of the parameter's type", "u8", false, "uint8_t"],
      ["C, an i32 parameter", "i32", false, "int32_t"],
    ])("rvalue: %s", (_label, target, cppMode, compoundLiteral) => {
      expect(
        ArgumentForm.of(false, target, createMockCallbacks(), cppMode, true),
      ).toEqual({ kind: "rvalue", compoundLiteral });
    });

    it.each([
      [
        "C, by its compound literal's address",
        false,
        true,
        { kind: "literal-address" },
      ],
      [
        "C++, where it binds to const T&",
        true,
        true,
        { kind: "rvalue", compoundLiteral: null },
      ],
      [
        "C, to a mut parameter, by value so gcc rejects it (#1203)",
        false,
        false,
        { kind: "rvalue", compoundLiteral: null },
      ],
    ] as const)("struct literal: %s", (_label, cppMode, paramIsConst, form) => {
      const shape = createMockCallbacks({ isCompoundLiteral: () => true });
      expect(
        ArgumentForm.of(false, "Point", shape, cppMode, paramIsConst),
      ).toEqual(form);
    });

    it("is array for a member that is an array", () => {
      const shape = createMockCallbacks({
        getLvalueType: () => "member",
        getMemberAccessArrayStatus: () => "array",
      });
      expect(ArgumentForm.of(false, "u8", shape, false, true)).toEqual({
        kind: "array",
      });
    });

    it.each([
      ["a C++ conversion", "not-array", true, "i16", "member-temp"],
      ["no conversion", "not-array", false, "u8", "lvalue"],
      ["an unknown array status", "unknown", true, "u8", "lvalue"],
    ] as const)(
      "member with %s",
      (_label, arrayStatus, converts, target, kind) => {
        const shape = createMockCallbacks({
          getLvalueType: () => "member",
          getMemberAccessArrayStatus: () => arrayStatus,
          isCppMemberConversionRequired: () => converts,
        });
        expect(ArgumentForm.of(false, target, shape, true, true)).toEqual(
          kind === "member-temp"
            ? { kind, cType: "int16_t" }
            : { kind, cast: null },
        );
      },
    );

    it.each([
      ["a string's element to a u8 pointer", true, "u8", "uint8_t"],
      ["no target type", true, undefined, null],
      ["an element that is not a string's", false, "u8", null],
      ["a float parameter", true, "f32", null],
      ["a bool parameter", true, "bool", null],
    ])("array element: %s", (_label, isString, target, cast) => {
      const shape = createMockCallbacks({
        getLvalueType: () => "array",
        isStringSubscriptAccess: () => isString,
      });
      expect(ArgumentForm.of(false, target, shape, false, true)).toEqual({
        kind: "lvalue",
        cast,
      });
    });
  });

  describe("cTypeOf", () => {
    it.each([
      [{ kind: "identifier" }, null],
      [{ kind: "array" }, null],
      [{ kind: "member-temp", cType: "uint8_t" }, "uint8_t"],
      [{ kind: "lvalue", cast: "uint16_t" }, "uint16_t"],
      [{ kind: "lvalue", cast: null }, null],
      [{ kind: "rvalue", compoundLiteral: "int32_t" }, "int32_t"],
      [{ kind: "rvalue", compoundLiteral: null }, null],
      [{ kind: "literal-address" }, null],
    ] as const)("%o writes %s", (form, cType) => {
      expect(ArgumentForm.cTypeOf(form)).toBe(cType);
    });
  });

  describe("handleRvalueArg", () => {
    it("returns the value when there is no compound literal", () => {
      const callbacks = createMockCallbacks({ generateExpression: () => "42" });
      expect(ArgumentGenerator.handleRvalueArg(null, callbacks)).toBe("42");
    });

    it("wraps the value in its compound literal", () => {
      const callbacks = createMockCallbacks({
        generateExpression: () => "1000",
      });
      expect(ArgumentGenerator.handleRvalueArg("int32_t", callbacks)).toBe(
        "&(int32_t){1000}",
      );
    });
  });

  describe("createCppMemberConversionTemp", () => {
    it("creates temp variable with static_cast in C++ mode", () => {
      state.cppMode = true;
      const callbacks = createMockCallbacks({
        generateExpression: () => "cfg.value",
      });

      const result = ArgumentGenerator.createCppMemberConversionTemp(
        "uint8_t",
        callbacks,
        state,
      );

      expect(result).toBe("cnx_tmp0");
      expect(state.pendingTempDeclarations).toContain(
        "uint8_t cnx_tmp0 = static_cast<uint8_t>(cfg.value);",
      );
      expect(state.getNextTempVarName()).toBe("cnx_tmp1");
    });

    it("increments temp counter for multiple temps", () => {
      state.cppMode = true;
      for (let i = 0; i < 5; i++) state.getNextTempVarName();
      const callbacks = createMockCallbacks({
        generateExpression: () => "x",
      });

      const result = ArgumentGenerator.createCppMemberConversionTemp(
        "int16_t",
        callbacks,
        state,
      );

      expect(result).toBe("cnx_tmp5");
      expect(state.getNextTempVarName()).toBe("cnx_tmp6");
    });
  });

  describe("handleLvalueArg", () => {
    it.each([
      ["by address with no cast", false, null, "&buf[0]"],
      ["cast in C", false, "uint8_t", "(uint8_t*)&buf[0]"],
      [
        "cast with reinterpret_cast in C++",
        true,
        "uint8_t",
        "reinterpret_cast<uint8_t*>(buf[0])",
      ],
    ])("writes the lvalue %s", (_label, cppMode, cast, expected) => {
      state.cppMode = cppMode;
      const callbacks = createMockCallbacks({
        generateExpression: () => "buf[0]",
      });
      expect(ArgumentGenerator.handleLvalueArg(cast, callbacks, state)).toBe(
        expected,
      );
    });
  });

  describe("generateArg (main dispatcher)", () => {
    it("handles simple identifier", () => {
      state.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
      });

      const result = ArgumentGenerator.generateArg(
        {
          emitted: "value",
          parameter: state.currentParameters.get("value"),
        },
        declared.get("value"),
        { kind: "identifier" },
        callbacks,
        state,
      );
      expect(result).toBe("&value");
    });

    it("handles parameter identifier", () => {
      state.currentParameters.set("cfg", {
        name: "cfg",
        baseType: "Config",
        isArray: false,
        isStruct: true,
        isConst: false,
        isCallback: false,
        isString: false,
      });
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
      });

      const result = ArgumentGenerator.generateArg(
        {
          emitted: "cfg",
          parameter: state.currentParameters.get("cfg"),
        },
        declared.get("cfg"),
        { kind: "identifier" },
        callbacks,
        state,
      );
      expect(result).toBe("cfg");
    });

    it("handles lvalue expressions", () => {
      state.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => "member",
        getMemberAccessArrayStatus: () => "not-array",
        isCppMemberConversionRequired: () => false,
        generateExpression: () => "obj.field",
      });

      const result = ArgumentGenerator.generateArg(
        null,
        undefined,
        // no simple identifier
        { kind: "lvalue", cast: null },
        callbacks,
        state,
      );
      expect(result).toBe("&obj.field");
    });

    it("handles rvalue expressions", () => {
      state.cppMode = false;
      const callbacks = createMockCallbacks({
        getLvalueType: () => null,
        generateExpression: () => "42",
      });

      const result = ArgumentGenerator.generateArg(
        null,
        undefined,
        // no simple identifier
        { kind: "rvalue", compoundLiteral: "uint8_t" },
        callbacks,
        state,
      );
      expect(result).toBe("&(uint8_t){42}");
    });

    it("handles a struct literal by its compound literal's address", () => {
      const callbacks = createMockCallbacks({
        generateExpression: () => "(Point){ .x = 1U }",
      });

      const result = ArgumentGenerator.generateArg(
        null,
        undefined,
        { kind: "literal-address" },
        callbacks,
        state,
      );
      expect(result).toBe("&(Point){ .x = 1U }");
    });

    it("builds a string argument into a temporary before the statement (#2239)", () => {
      const callbacks = createMockCallbacks({
        generateExpression: () => {
          throw new Error("a built argument is not rendered whole");
        },
      });
      const result = ArgumentGenerator.generateArg(
        null,
        undefined,
        { kind: "string-built", capacity: 8 },
        {
          ...callbacks,
          renderStringParts: () => [
            { kind: "whole", code: "a" },
            { kind: "whole", code: "b" },
          ],
        },
        state,
      );
      expect(result).toBe("cnx_tmp0");
      expect(state.pendingTempDeclarations).toEqual([
        "/* ADR-045 / Issue #2239: a concatenation or a substring argument is built into a string<N> before the call. */",
        'char cnx_tmp0[9] = "";',
        "cnx_string_copy(cnx_tmp0, a, 8U);",
        "(void) strncat(cnx_tmp0, b, 8 - strlen(cnx_tmp0));",
      ]);
    });
  });
});
