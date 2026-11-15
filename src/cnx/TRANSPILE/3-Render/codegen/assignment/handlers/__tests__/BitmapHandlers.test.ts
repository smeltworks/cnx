/**
 * Unit tests for BitmapHandlers.
 * Tests bitmap field assignment handler functions.
 */

import { beforeEach, describe, expect, it } from "vitest";

import bitmapHandlers from "../BitmapHandlers";
import AssignmentKind from "../../../../../../types/AssignmentKind";
import type IBitmapFieldLayout from "../../../../../../types/IBitmapFieldLayout";
import IAssignmentContext from "../../../../../2-Plan/types/IAssignmentContext";
import TranspileState from "../../../../../TranspileState";
import HandlerTestUtils from "./handlerTestUtils";

/**
 * Create mock context for testing.
 */
function createMockContext(
  overrides: Partial<IAssignmentContext> = {},
): IAssignmentContext {
  // Default resolved values based on first identifier
  const identifiers = overrides.identifiers ?? ["flags", "Running"];
  const resolvedTarget = overrides.resolvedTarget ?? identifiers[0];
  const resolvedBaseIdentifier =
    overrides.resolvedBaseIdentifier ?? identifiers[0];

  const ctx = {
    identifiers,
    ...HandlerTestUtils.subscriptsOf([]),
    isCompound: false,
    cnxOp: "<-",
    cOp: "=",
    generatedValue: "true",
    // #1445: renders, not nodes -- each delegates to the mocked generator the
    // cases already configure, so a case that overrides
    // `generateAssignmentTarget` or `analyzeMemberChainForBitAccess` still
    // controls what this returns.
    renderTarget: () =>
      HandlerTestUtils.planner().generateAssignmentTarget(null as never),
    analyzeTargetForBitAccess: () =>
      HandlerTestUtils.planner().analyzeMemberChainForBitAccess(null as never),
    targetLine: 1,
    hasValue: true,
    floatBits: null,
    valueExpressionType: () => null,
    valueIntegerType: () => null,
    valueHasFloatingOperand: () => false,
    bitmapField: null,
    atomic: null,
    foldValue: () =>
      HandlerTestUtils.planner().tryEvaluateConstant(null as never),
    postfixOps: [],
    hasThis: false,
    hasGlobal: false,
    hasMemberAccess: true,
    hasArrayAccess: false,
    postfixOpsCount: 1,
    memberAccessDepth: 1,
    subscriptDepth: 0,
    isSimpleIdentifier: false,
    isSimpleThisAccess: false,
    isSimpleGlobalAccess: false,
    resolvedTarget,
    resolvedBaseIdentifier,
    // #1452 box 4: a handler reaches 2.3's per-file state through the context
    // it is handed, so the mock context carries the same instance the test
    // set its facts up on.
    state,
    ...overrides,
  } as IAssignmentContext;
  // #1668 (C7): what the target writes, as the binder would bind it
  return {
    ...ctx,
    target: overrides.target ?? HandlerTestUtils.targetOf(state, ctx),
  };
}

let state = new TranspileState();

describe("BitmapHandlers", () => {
  beforeEach(() => {
    state = new TranspileState();
    HandlerTestUtils.setupMockGenerator(state);
    HandlerTestUtils.setupMockSymbols(state);
  });

  describe("handler registration", () => {
    it("registers all expected bitmap assignment kinds", () => {
      const kinds = bitmapHandlers.map(([kind]) => kind);

      expect(kinds).toContain(AssignmentKind.BITMAP_FIELD);
      expect(kinds).toContain(AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD);
    });

    it("exports exactly 2 handlers", () => {
      expect(bitmapHandlers).toHaveLength(2);
    });
  });

  describe("handleBitmapField (a field of a bitmap value)", () => {
    const handlerFor = (kind: AssignmentKind) =>
      bitmapHandlers.find(([k]) => k === kind)![1];
    const write = (ctx: IAssignmentContext) =>
      handlerFor(AssignmentKind.BITMAP_FIELD)(
        HandlerTestUtils.withPlannedBitmapField(state, ctx),
      );

    /** A field write as the planner renders its target and the typer types it */
    const fieldWrite = (
      rendered: string,
      bitmapType: string,
      identifiers: string[],
      generatedValue = "true",
    ): IAssignmentContext => {
      const ctx = createMockContext({ identifiers, generatedValue });
      const before = {
        ...HandlerTestUtils.operandOf("u8", false, false),
        bitmapTypeName: bitmapType,
      };
      return {
        ...ctx,
        renderBitTarget: () => rendered,
        target: {
          ...ctx.target,
          last: {
            before,
            subscript: null,
            property: null,
            after: null,
            callee: null,
            beforeNamesType: false,
            beforeIsBitField: false,
            fieldBits: null,
            beforeRegisterMember: null,
            beforeRegister: null,
            register: null,
            registerMember: null,
            member: identifiers.at(-1)!,
          },
        },
      };
    };

    const declareBitmap = (
      bitmapType: string,
      storage: string,
      fields: [string, IBitmapFieldLayout][],
    ) =>
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([[bitmapType, storage]]),
        bitmapFields: new Map([[bitmapType, new Map(fields)]]),
      });

    // #1760 second review: the target was rebuilt from the source spelling,
    // so `fl.C` in a function with a local `fl` wrote the global `fl`
    it("writes the rendered target, not the spelling", () => {
      declareBitmap("Sm", "uint8_t", [["C", { offset: 4, width: 4 }]]);
      const ctx = fieldWrite("main__fl", "Sm", ["fl", "C"], "5U");

      expect(write(ctx)).toBe(
        "main__fl = (uint8_t)((main__fl & ~(0xFU << 4)) | ((5U & 0xFU) << 4));",
      );
    });

    it("writes through a parameter as it renders", () => {
      declareBitmap("Sm", "uint8_t", [["A", { offset: 0, width: 1 }]]);

      expect(write(fieldWrite("(*s)", "Sm", ["s", "A"]))).toBe(
        "(*s) = (uint8_t)(((*s) & ~(1U << 0)) | (1U << 0));",
      );
    });

    it("shifts a single bit to its offset", () => {
      declareBitmap("StatusFlags", "uint8_t", [
        ["Active", { offset: 3, width: 1 }],
      ]);

      expect(
        write(fieldWrite("flags", "StatusFlags", ["flags", "Active"])),
      ).toContain("<< 3");
    });

    it("throws on unknown bitmap field", () => {
      declareBitmap("StatusFlags", "uint8_t", []);

      expect(() =>
        write(fieldWrite("flags", "StatusFlags", ["flags", "Unknown"])),
      ).toThrow("the classifier routes a planned bitmap field here");
    });

    it("masks a multi-bit field", () => {
      declareBitmap("StatusFlags", "uint8_t", [
        ["Mode", { offset: 4, width: 3 }],
      ]);

      const result = write(
        fieldWrite("flags", "StatusFlags", ["flags", "Mode"], "3"),
      );

      expect(result).toContain("& ~(0x7U << 4)");
      expect(result).toContain("(3 & 0x7U)");
    });

    it("shifts in 32 bits when the bitmap is backed by 32 (#1668)", () => {
      declareBitmap("Rgb", "uint32_t", [["Red", { offset: 16, width: 8 }]]);

      expect(write(fieldWrite("color", "Rgb", ["color", "Red"], "64"))).toBe(
        "color = (color & ~((uint32_t)0xFFU << 16)) | ((64 & (uint32_t)0xFFU) << 16);",
      );
    });

    // A compound operator on a bitmap field is E0857 in pass 2.1 (#2159), and
    // ADR-034's overflow rule is E0881 there too; the pipeline halts before
    // these handlers run. Covered by `CompoundAssignmentAnalyzer.test.ts` and
    // `BitmapAccessAnalyzer`'s tests.
  });

  describe("handleRegisterMemberBitmapField (REGISTER_MEMBER_BITMAP_FIELD)", () => {
    const write = (ctx: IAssignmentContext) =>
      bitmapHandlers.find(
        ([kind]) => kind === AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD,
      )![1](HandlerTestUtils.withPlannedBitmapField(state, ctx));

    /** A field of a register member, as the typer names the member */
    const memberWrite = (
      member: string,
      identifiers: string[],
      overrides: Partial<IAssignmentContext> = {},
    ): IAssignmentContext => {
      const ctx = createMockContext({ identifiers, ...overrides });
      return {
        ...ctx,
        target: {
          ...ctx.target,
          // The typer types a bitmap-typed member as its bitmap
          last: {
            before: {
              ...HandlerTestUtils.operandOf("u8", false, false),
              bitmapTypeName: "Bits",
            },
            subscript: null,
            property: null,
            after: null,
            callee: null,
            beforeNamesType: false,
            beforeIsBitField: false,
            fieldBits: null,
            beforeRegisterMember: member,
            beforeRegister: null,
            register: null,
            registerMember: null,
            member: identifiers.at(-1)!,
          },
        },
      };
    };

    const declareMember = (
      member: string,
      field: [string, IBitmapFieldLayout],
      access?: string,
    ) =>
      HandlerTestUtils.setupMockSymbols(state, {
        bitmapBackingType: new Map([["Bits", "uint8_t"]]),
        bitmapFields: new Map([["Bits", new Map([field])]]),
        knownBitmaps: new Set(["Bits"]),
        registerMemberCTypes: new Map([[member, "Bits"]]),
        registerMemberAccess: new Map(
          access === undefined ? [] : [[member, access]],
        ),
      });

    it("read-modify-writes a readable member", () => {
      declareMember("MOTOR__CTRL", ["Running", { offset: 0, width: 1 }]);

      expect(
        write(memberWrite("MOTOR__CTRL", ["MOTOR", "CTRL", "Running"])),
      ).toBe(
        "MOTOR__CTRL = (uint8_t)((MOTOR__CTRL & ~(1U << 0)) | (1U << 0));",
      );
    });

    it("writes a write-only member without reading it (#1776)", () => {
      declareMember("MOTOR__CTRL", ["Running", { offset: 0, width: 1 }], "wo");

      expect(
        write(memberWrite("MOTOR__CTRL", ["MOTOR", "CTRL", "Running"])),
      ).toBe("MOTOR__CTRL = (uint8_t)(1U << 0);");
    });

    // #2158: a scope's own register by its bare name -- the member the typer
    // names, not the spelling's first word, is the one written
    it("writes the member the typer names, whatever spelled the register", () => {
      declareMember(
        "Drive__PWM__FLAGS",
        ["Enable", { offset: 0, width: 1 }],
        "w1c",
      );

      expect(
        write(memberWrite("Drive__PWM__FLAGS", ["PWM", "FLAGS", "Enable"])),
      ).toBe("Drive__PWM__FLAGS = (uint8_t)(1U << 0);");
    });

    it.each([
      ["wo", 0],
      ["w1s", 3],
      ["w1c", 5],
    ])("writes a %s member without reading it", (access, offset) => {
      declareMember("Motor__GPIO7__SET", ["LED", { offset, width: 1 }], access);

      const result = write(
        memberWrite("Motor__GPIO7__SET", ["GPIO7", "SET", "LED"], {
          hasThis: true,
        }),
      );

      expect(result).not.toContain("& ~");
      expect(result).toBe(`Motor__GPIO7__SET = (uint8_t)(1U << ${offset});`);
    });

    it("writes a multi-bit field's value at its offset", () => {
      declareMember("Motor__GPIO7__ICR1", ["LED", { offset: 6, width: 2 }]);

      const result = write(
        memberWrite("Motor__GPIO7__ICR1", ["Motor", "GPIO7", "ICR1", "LED"], {
          generatedValue: "value",
        }),
      );

      // A read-modify-write of the field's two bits at offset 6: a plain
      // write of the value would pass the old `toContain(" =")` check
      expect(result).toMatch(
        /^Motor__GPIO7__ICR1 = .*\(Motor__GPIO7__ICR1 & ~\(.*0x3U.* << 6\)\) \| \(\(value & .*0x3U.*\) << 6\)/,
      );
    });

    // Review of #2155: E0872 rejects a zero on a write-1 member's field in
    // 2.1; 2.3 asserts it, as it does for the member's bit, so a zero that
    // got past 2.1 is a crash rather than a write the hardware ignores
    it.each([
      ["a single-bit field", { offset: 0, width: 1 }, "0"],
      ["a multi-bit field", { offset: 2, width: 3 }, "2, 3"],
    ])(
      "asserts a zero never reaches %s of a write-1 member",
      (_, layout, bits) => {
        declareMember("MOTOR__FLAGS", ["Field", layout], "w1c");

        expect(() =>
          write(
            memberWrite("MOTOR__FLAGS", ["MOTOR", "FLAGS", "Field"], {
              generatedValue: "0U",
              foldValue: () => 0,
            }),
          ),
        ).toThrow(`E0872 rejects '0U' on MOTOR__FLAGS[${bits}]`);
      },
    );
  });
});
