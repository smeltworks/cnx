/**
 * Unit tests for AtomicGenerator
 *
 * Tests atomic Read-Modify-Write operation generation for embedded platforms.
 */

import { describe, it, expect } from "vitest";
import atomicGenerators from "../../../../../../../../cnx/TRANSPILE/3-Render/codegen/generators/statements/AtomicGenerator";
import type IPlannedAtomic from "../../../../../../../../cnx/TRANSPILE/types/IPlannedAtomic";
import type TAtomicForm from "../../../../../../../../cnx/TRANSPILE/types/TAtomicForm";
import ExclusiveAccess from "../../../../../../../../cnx/TRANSPILE/2-Plan/ExclusiveAccess";
import TYPE_MAP from "../../../../../../../../cnx/TRANSPILE/2-Plan/types/TYPE_MAP";
import TYPE_WIDTH from "../../../../../../../../cnx/types/TYPE_WIDTH";

const {
  generateAtomicRMW,
  generateInnerAtomicOp,
  generateLdrexStrexLoop,
  generatePrimaskWrapper,
} = atomicGenerators;

// ============================================================================
// Test Helpers
// ============================================================================

/** A catalog target with, or without, LDREX/STREX */

// ============================================================================
// Tests - generateInnerAtomicOp
// ============================================================================

describe("AtomicGenerator", () => {
  describe("generateInnerAtomicOp", () => {
    it("generates clamp helper for += with clamp behavior", () => {
      const result = generateInnerAtomicOp("+=", "5", "cnx_clamp_add_u32");

      expect(result.code).toBe("cnx_clamp_add_u32(__old, 5)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates clamp helper for -= with clamp behavior", () => {
      const result = generateInnerAtomicOp("-=", "value", "cnx_clamp_sub_u16");

      expect(result.code).toBe("cnx_clamp_sub_u16(__old, value)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates clamp helper for *= with clamp behavior", () => {
      const result = generateInnerAtomicOp("*=", "2", "cnx_clamp_mul_i8");

      expect(result.code).toBe("cnx_clamp_mul_i8(__old, 2)");
      // 2.2 planned the helper; 2.3 reports nothing (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates natural arithmetic when no clamp helper is chosen", () => {
      const result = generateInnerAtomicOp("+=", "5", null);

      expect(result.code).toBe("__old + 5");
      expect(result.effects).toHaveLength(0);
    });

    it("generates natural arithmetic for non-clamp ops", () => {
      const result = generateInnerAtomicOp("/=", "2", null);

      expect(result.code).toBe("__old / 2");
      expect(result.effects).toHaveLength(0);
    });

    it("generates natural arithmetic for bitwise ops", () => {
      expect(generateInnerAtomicOp("&=", "0xFF", null).code).toBe(
        "__old & 0xFF",
      );
      expect(generateInnerAtomicOp("|=", "0x01", null).code).toBe(
        "__old | 0x01",
      );
      expect(generateInnerAtomicOp("^=", "mask", null).code).toBe(
        "__old ^ mask",
      );
    });

    it("generates natural arithmetic for shift ops", () => {
      expect(generateInnerAtomicOp("<<=", "2", null).code).toBe("__old << 2");
      expect(generateInnerAtomicOp(">>=", "4", null).code).toBe("__old >> 4");
    });

    it("generates natural arithmetic for floats even with clamp", () => {
      const result = generateInnerAtomicOp("+=", "1.0f", null);

      expect(result.code).toBe("__old + 1.0f");
      expect(result.effects).toHaveLength(0);
    });

    it("refuses an operator that is not a compound assignment", () => {
      expect(() => generateInnerAtomicOp("??=", "5", null)).toThrow(
        "an atomic read-modify-write is a compound assignment (got '??=')",
      );
    });
  });

  // ============================================================================
  // Tests - generateLdrexStrexLoop
  // ============================================================================

  describe("generateLdrexStrexLoop", () => {
    // 2.2's plan for an LDREX/STREX loop on a cnx integer
    const exclusivePlan = (typeName: string): IPlannedAtomic => {
      const access = {
        typeName,
        cType: TYPE_MAP[typeName],
        bits: TYPE_WIDTH[typeName] ?? null,
      };
      return {
        ...access,
        form: "ldrex-strex",
        operandCType: access.cType,
        exclusive: ExclusiveAccess.of(access),
      };
    };
    it("generates LDREX/STREX loop for u32", () => {
      const typeInfo = exclusivePlan("u32");
      const result = generateLdrexStrexLoop(
        "counter",
        "1",
        "__old + 1",
        typeInfo,
        [],
      );

      expect(result.code).toContain("do {");
      expect(result.code).toContain("uint32_t __operand = 1;");
      expect(result.code).toContain("uint32_t __old = __LDREXW(&counter)");
      expect(result.code).toContain("uint32_t __new = __old + 1");
      expect(result.code).toContain(
        "if (__STREXW(__new, &counter) == 0) {\n            break;\n        }",
      );
      // MISRA C:2012 Rule 15.6: the if's body is a compound statement. The
      // unbraced form reached every LDREX target's output, hidden from
      // cppcheck by a test stub that declared the intrinsics (#1668)
      expect(result.code).not.toMatch(/\)\s*break;/);
      expect(result.code).toContain("} while (1);");
      // 2.2 requires CMSIS and the loop's C type before 2.3 writes it (#1991)
      expect(result.effects).toEqual([]);
    });

    it("generates LDREX/STREX loop for u16", () => {
      const typeInfo = exclusivePlan("u16");
      const result = generateLdrexStrexLoop(
        "value",
        "1",
        "__old - 1",
        typeInfo,
        [],
      );

      expect(result.code).toContain("uint16_t __old = __LDREXH(&value)");
      expect(result.code).toContain("__STREXH(__new, &value)");
    });

    it("generates LDREX/STREX loop for u8", () => {
      const typeInfo = exclusivePlan("u8");
      const result = generateLdrexStrexLoop(
        "byte",
        "1",
        "__old | 0x80",
        typeInfo,
        [],
      );

      expect(result.code).toContain("uint8_t __old = __LDREXB(&byte)");
      expect(result.code).toContain("__STREXB(__new, &byte)");
    });

    it("generates LDREX/STREX loop for signed types", () => {
      const typeInfo = exclusivePlan("i32");
      const result = generateLdrexStrexLoop(
        "signed_val",
        "1",
        "__old + 5",
        typeInfo,
        [],
      );

      // #2208: CMSIS takes an unsigned pointer of the same width
      expect(result.code).toContain(
        "int32_t __old = (int32_t)__LDREXW((volatile uint32_t *)&signed_val)",
      );
      expect(result.code).toContain("int32_t __new");
      expect(result.code).toContain(
        "__STREXW((uint32_t)__new, (volatile uint32_t *)&signed_val)",
      );
    });

    it("preserves inner effects", () => {
      const typeInfo = exclusivePlan("u32");
      const innerEffects = [
        { type: "set-array-init-count" as const, count: 1 },
      ];
      const result = generateLdrexStrexLoop(
        "counter",
        "1",
        "helper()",
        typeInfo,
        innerEffects,
      );

      expect(result.effects).toContainEqual({
        type: "set-array-init-count",
        count: 1,
      });
    });
  });

  // ============================================================================
  // Tests - generatePrimaskWrapper
  // ============================================================================

  describe("generatePrimaskWrapper", () => {
    it("generates PRIMASK wrapper for simple op", () => {
      const result = generatePrimaskWrapper("counter", "+=", "1", null);

      // #1146: the ADR-050 wrappers a critical block masks through, not raw
      // CMSIS with no platform guard
      expect(result.code).toContain(
        "uint32_t __primask = __cnx_get_PRIMASK();",
      );
      expect(result.code).toContain("__cnx_disable_irq();");
      expect(result.code).toContain("counter += 1;");
      expect(result.code).toContain("__cnx_set_PRIMASK(__primask);");
    });

    it("generates PRIMASK wrapper with clamp helper for +=", () => {
      const result = generatePrimaskWrapper(
        "counter",
        "+=",
        "5",
        "cnx_clamp_add_u32",
      );

      expect(result.code).toContain("counter = cnx_clamp_add_u32(counter, 5);");
    });

    it("generates PRIMASK wrapper with clamp helper for -=", () => {
      const result = generatePrimaskWrapper(
        "value",
        "-=",
        "10",
        "cnx_clamp_sub_u16",
      );

      expect(result.code).toContain("value = cnx_clamp_sub_u16(value, 10);");
    });

    it("generates PRIMASK wrapper with clamp helper for *=", () => {
      const result = generatePrimaskWrapper(
        "factor",
        "*=",
        "2",
        "cnx_clamp_mul_i8",
      );

      expect(result.code).toContain("factor = cnx_clamp_mul_i8(factor, 2);");
    });

    it("generates PRIMASK wrapper without clamp for /=", () => {
      const result = generatePrimaskWrapper("value", "/=", "2", null);

      expect(result.code).toContain("value /= 2;");
    });

    it("generates PRIMASK wrapper without clamp for floats", () => {
      const result = generatePrimaskWrapper("value", "+=", "1.0f", null);

      expect(result.code).toContain("value += 1.0f;");
    });
  });

  // ============================================================================
  // Tests - generateAtomicRMW (integration)
  // ============================================================================

  describe("generateAtomicRMW", () => {
    const planned = (
      typeName: string | null,
      cType: string,
      form: TAtomicForm,
      operandCType: string = cType,
    ): IPlannedAtomic => {
      const access = {
        typeName,
        cType,
        bits: typeName === null ? null : (TYPE_WIDTH[typeName] ?? null),
      };
      return {
        ...access,
        form,
        operandCType,
        exclusive: form === "ldrex-strex" ? ExclusiveAccess.of(access) : null,
      };
    };
    const rmw = (typeName: string, form: TAtomicForm) =>
      generateAtomicRMW(
        "counter",
        "+=",
        "1",
        planned(typeName, typeName === "u64" ? "uint64_t" : "uint32_t", form),
        "cnx_clamp_add_u32",
      );

    it("writes the LDREX/STREX loop 2.2 planned", () => {
      const result = rmw("u32", "ldrex-strex");

      expect(result.code).toContain("__LDREXW");
      expect(result.code).toContain("__STREXW");
    });

    it("writes the masked region 2.2 planned", () => {
      const result = rmw("u32", "interrupt-mask");

      expect(result.code).toContain("__cnx_get_PRIMASK()");
      expect(result.code).toContain("__cnx_disable_irq()");
    });

    it("fails when 2.2 planned a loop for a type with no exclusive access", () => {
      expect(() => rmw("u64", "ldrex-strex")).toThrow(
        /only with its exclusive access \(got uint64_t\)/,
      );
    });

    it("calls the clamp helper 2.2 planned", () => {
      expect(rmw("u32", "ldrex-strex").code).toContain("cnx_clamp_add_u32(");
    });

    // #1807: a failed attempt must not evaluate the value again
    it.each(["ldrex-strex", "compare-exchange"] as const)(
      "evaluates the value once, before the %s loop, in the planned type",
      (form) => {
        const code = generateAtomicRMW(
          "counter",
          "+=",
          "step()",
          planned("u32", "uint32_t", form, "uint64_t"),
          "cnx_clamp_add_u32",
        ).code;
        expect(code.split("step()")).toHaveLength(2);
        expect(code.indexOf("uint64_t __operand = step();")).toBeGreaterThan(
          -1,
        );
        expect(code.indexOf("step()")).toBeLessThan(code.indexOf("do {"));
        expect(code).toContain("cnx_clamp_add_u32(__old, __operand)");
      },
    );

    // #2155 review 8: an atomic of a C header type has no cnx name, and
    // is accessed by its C type
    it("writes a C header type's compare-exchange loop in its C type", () => {
      const code = generateAtomicRMW(
        "f",
        "+=",
        "1",
        planned(null, "int_fast16_t", "compare-exchange"),
        null,
      ).code;
      expect(code).toContain("int_fast16_t __operand = 1;");
      expect(code).toContain("int_fast16_t __old;");
      expect(code).toContain("__new = __old + __operand;");
    });

    it("annotates each retry loop with the ADR that shapes it", () => {
      expect(rmw("u32", "ldrex-strex").code).toContain(
        "/* ADR-049 / Issue #1807: atomic read-modify-write as an LDREX/STREX retry loop.",
      );
      expect(rmw("u32", "compare-exchange").code).toContain(
        "/* ADR-049 / Issue #1789: atomic read-modify-write as a compare-exchange retry loop,",
      );
    });
  });
});
