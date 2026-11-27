/**
 * Unit tests for TypeGenerationHelper
 * Tests for C type generation from a planned cnx type
 *
 * #1445: the helper takes an `IPlannedType` now, so these build plans instead
 * of parsing source. What moved OUT of this file with the parse contexts is
 * the mapping from a type context to that plan -- `CodeGenerator.planType`,
 * which delegates the named branches to `TypeNameLadder` and is exercised by the
 * 1254 integration fixtures rather than here.
 *
 * Three methods moved out with it: `generateScopedType`, `generateGlobalType`
 * and `generateQualifiedType` had no caller but this file, so their tests were
 * the only thing keeping knip quiet about them (#1418). Those decisions are
 * `TypeNameLadder`'s.
 */

import { describe, it, expect } from "vitest";
import TypeGenerationHelper from "../TypeGenerationHelper";
import type IPlannedType from "../types/IPlannedType";
import type INamedTypeResolution from "../../../types/INamedTypeResolution";

describe("TypeGenerationHelper", () => {
  /** A plan with every alternative absent, for a test to fill one in. */
  function plan(overrides: Partial<IPlannedType> = {}): IPlannedType {
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

  describe("generatePrimitiveType", () => {
    it.each([
      // #1927: `<stdint.h>` / `<stdbool.h>` are decided by the plan from the
      // C type, so the primitive asks for neither -- only `ISR` asks for its
      // deferred typedef.
      ["maps bool type", "bool", "bool", null],
      ["maps ISR type and requires isr include", "ISR", "ISR", "isr"],
      ["maps u8 to uint8_t", "u8", "uint8_t", null],
      ["maps i32 to int32_t", "i32", "int32_t", null],
      ["maps u64 to uint64_t", "u64", "uint64_t", null],
      ["maps f32 to float", "f32", "float", null],
      ["maps f64 to double", "f64", "double", null],
    ])("%s", (_label, source, argument2, expected) => {
      const result = TypeGenerationHelper.generatePrimitiveType(source);
      expect(result.cType).toBe(argument2);
      expect(result.include).toBe(expected);
    });

    it("returns void unchanged with no include", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("void");
      expect(result.cType).toBe("void");
      expect(result.include).toBeNull();
    });

    it("returns unknown type unchanged", () => {
      const result = TypeGenerationHelper.generatePrimitiveType("CustomType");
      expect(result.cType).toBe("CustomType");
      expect(result.include).toBeNull();
    });
  });

  describe("generateStringType", () => {
    it("returns char for bounded strings", () => {
      const result = TypeGenerationHelper.generateStringType();
      expect(result).toBe("char");
    });
  });

  describe("generate", () => {
    const defaultDeps = {
      checkNeedsStructKeyword: () => false,
      isCrossFileDeclaration: () => false,
      declarationOf: () => undefined,
    };

    it.each([
      [
        "a primitive through TYPE_MAP",
        plan({ primitiveName: "u32" }),
        "uint32_t",
      ],
      ["a primitive with no mapping", plan({ primitiveName: "bool" }), "bool"],
      [
        "a bounded string as char",
        plan({ isString: true, text: "string<32>" }),
        "char",
      ],
      [
        "this.T, qualified by TypeNameLadder",
        plan({ named: named("this", "State", "Motor__State") }),
        "Motor__State",
      ],
      [
        "global.T, left bare",
        plan({ named: named("global", "Config") }),
        "Config",
      ],
      [
        "Scope.T, through the caller's resolver",
        plan({ named: named("qualified", "Motor.State", "Motor__State") }),
        "Motor__State",
      ],
      [
        "a C++ namespace type, through the same resolver",
        plan({ named: named("qualified", "Lib.Type", "Lib::Type") }),
        "Lib::Type",
      ],
      [
        "a bare user type",
        plan({ named: named("bare", "MyStruct") }),
        "MyStruct",
      ],
      [
        "cstring as const char*",
        plan({ named: named("bare", "cstring") }),
        "const char*",
      ],
      [
        "an unrecognized alternative, as its own text",
        plan({ text: "FlexCAN_T4<CAN1>" }),
        "FlexCAN_T4<CAN1>",
      ],
      // `void` needs no branch of its own: its source text IS "void".
      ["void, as its own text", plan({ text: "void" }), "void"],
    ])("generates %s", (_label, planned, expected) => {
      expect(TypeGenerationHelper.generate(planned, defaultDeps)).toBe(
        expected,
      );
    });

    it("adds the struct keyword when C needs it for a tag", () => {
      expect(
        TypeGenerationHelper.generate(
          plan({ named: named("bare", "CStruct") }),
          {
            ...defaultDeps,
            checkNeedsStructKeyword: (name) => name === "CStruct",
          },
        ),
      ).toBe("struct CStruct");
    });

    it("emits the qualified name when ADR-057 captured a bare one", () => {
      expect(
        TypeGenerationHelper.generate(
          plan({ named: named("bare", "State", "Motor__State") }),
          defaultDeps,
        ),
      ).toBe("Motor__State");
    });

    /**
     * The struct keyword is asked about the WRITTEN name, and only when the
     * name was not captured. A qualified name is a cnx scope type, which is
     * always a typedef -- asking would be asking about the wrong identifier.
     */
    it("does not ask about the struct keyword for a captured name", () => {
      const asked: string[] = [];

      TypeGenerationHelper.generate(
        plan({ named: named("bare", "State", "Motor__State") }),
        {
          ...defaultDeps,
          checkNeedsStructKeyword: (name) => {
            asked.push(name);
            return false;
          },
        },
      );

      expect(asked).toEqual([]);
    });

    it("prefers a string over a named branch, as the old ladder did", () => {
      expect(
        TypeGenerationHelper.generate(
          plan({ isString: true, named: named("bare", "unused") }),
          defaultDeps,
        ),
      ).toBe("char");
    });
  });

  describe("getRequiredInclude", () => {
    it.each([
      ["isr for ISR", plan({ primitiveName: "ISR" }), "isr"],
      ["nothing for an integer (#1927)", plan({ primitiveName: "u32" }), null],
      ["string for a bounded string", plan({ isString: true }), "string"],
    ])("returns %s", (_label, planned, expected) => {
      expect(TypeGenerationHelper.getRequiredInclude(planned)).toBe(expected);
    });

    it("returns null for a user type", () => {
      expect(
        TypeGenerationHelper.getRequiredInclude(
          plan({ named: named("bare", "MyStruct") }),
        ),
      ).toBeNull();
    });

    /**
     * #1569: a `string<N>[M]` struct field has no other route to
     * `<string.h>`, so an array of strings requires it here as one string does.
     */
    it("requires string for an ARRAY of strings too (#1569)", () => {
      expect(
        TypeGenerationHelper.getRequiredInclude(
          plan({ isString: true, isArray: true }),
        ),
      ).toBe("string");
    });

    it("returns the element's include for an array of primitives", () => {
      expect(
        TypeGenerationHelper.getRequiredInclude(
          plan({ primitiveName: "ISR", isArray: true }),
        ),
      ).toBe("isr");
    });
  });
});
