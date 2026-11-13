/**
 * #1449: 2.2 Plan decides; 2.3 Render formats.
 *
 * The assertions here are about DECISIONS, not text. What the float assert
 * renders as is Render's business; that the keyword and the requirement key it
 * costs are one record is this pass's, and it is the property #1143 and #1449
 * were in apparent conflict over.
 */

import EmissionPlan from "../EmissionPlan";
import type IEmissionFacts from "../../../types/IEmissionFacts";

const NOTHING: IEmissionFacts = {
  cppMode: false,
  cTypes: new Set<string>(),
  needsString: false,
  needsCMSIS: false,
  needsLimits: false,
  needsStddef: false,
  needsFloatStaticAssert: false,
  needsIrqWrappers: false,
  needsISR: false,
  selfIncludeAdded: false,
  existingIncludeTargets: [],
  overflowHelpers: new Map(),
  stringCopyHelper: false,
  castHelpers: new Set<string>(),
  lengthHelpers: new Set<string>(),
  safeDivOps: new Map(),
  floatAssertSites: [],
  irqWrapperSites: [],
  debugMode: false,
  emittedDesignatedInitializer: false,
  emittedCompoundLiteral: false,
  emittedLdrexStrexLoop: false,
  ldrexStrexSites: [],
  emittedCompareExchangeLoop: false,
  emittedWideCompareExchangeLoop: false,
  wideCompareExchangeSites: [],
  compareExchangeSites: [],
};

const facts = (over: Partial<IEmissionFacts>): IEmissionFacts => ({
  ...NOTHING,
  ...over,
});

describe("EmissionPlan (2.2 Plan)", () => {
  describe("system includes", () => {
    it.each([
      ["needsString", "<string.h>"],
      ["needsCMSIS", "<cmsis_gcc.h>"],
      ["needsLimits", "<limits.h>"],
      ["needsStddef", "<stddef.h>"],
    ] as const)("%s decides %s", (flag, target) => {
      const plan = EmissionPlan.build(facts({ [flag]: true }));

      expect(plan.systemIncludes).toEqual([target]);
    });

    // #1927: decided from the emitted C type by `CTypeIncludes`, the same
    // predicate the header asks -- so `float` costs nothing.
    it.each([
      ["uint8_t", ["<stdint.h>"]],
      ["bool", ["<stdbool.h>"]],
      ["float", []],
      ["char*", []],
    ] as const)("an emitted %s decides %j", (cType, expected) => {
      const plan = EmissionPlan.build(facts({ cTypes: new Set([cType]) }));

      expect(plan.systemIncludes).toEqual(expected);
    });

    it("emits nothing when nothing asked", () => {
      expect(EmissionPlan.build(NOTHING).systemIncludes).toEqual([]);
    });

    // Order is data (SYSTEM_INCLUDES), not the order somebody wrote branches.
    //
    // Asks for ALL SIX deliberately. An earlier version of this test set three
    // of them and asserted their order, which reads as an order assertion and
    // is not one: transposing two headers it did not ask for changed nothing,
    // and the mutation that swapped `<stdint.h>` with `<stdbool.h>` passed it.
    // A permutation is only observable when every element is present.
    it("keeps a fixed emission order", () => {
      const plan = EmissionPlan.build(
        facts({
          cTypes: new Set(["bool", "uint32_t"]),
          needsString: true,
          needsCMSIS: true,
          needsLimits: true,
          needsStddef: true,
        }),
      );

      expect(plan.systemIncludes).toEqual([
        "<stdint.h>",
        "<stdbool.h>",
        "<string.h>",
        "<cmsis_gcc.h>",
        "<limits.h>",
        "<stddef.h>",
      ]);
    });

    // #1108's dedup, decided rather than recovered from emitted text.
    it("does not re-emit a header the source already includes", () => {
      const plan = EmissionPlan.build(
        facts({
          cTypes: new Set(["uint32_t"]),
          needsString: true,
          existingIncludeTargets: ["<stdint.h>"],
        }),
      );

      expect(plan.systemIncludes).toEqual(["<string.h>"]);
    });
  });

  describe("float static assert -- keyword and cost are one record", () => {
    it.each([
      [false, "_Static_assert", "float-assert-c11"],
      [true, "static_assert", "float-assert-cpp11"],
    ] as const)(
      "cppMode=%s decides %s costing %s",
      (cppMode, keyword, requirement) => {
        const plan = EmissionPlan.build(
          facts({ cppMode, needsFloatStaticAssert: true }),
        );

        expect(plan.floatStaticAssert).toEqual({
          keyword,
          requirements: [requirement],
          sites: [],
        });
      },
    );

    it("is absent when no float bit indexing occurred", () => {
      expect(EmissionPlan.build(NOTHING).floatStaticAssert).toBeNull();
    });

    it("carries the sites that asked, for attribution", () => {
      const sites = [{ sourcePath: "main.cnx", line: 12 }];
      const plan = EmissionPlan.build(
        facts({ needsFloatStaticAssert: true, floatAssertSites: sites }),
      );

      expect(plan.floatStaticAssert?.sites).toEqual(sites);
    });
  });

  describe("IRQ wrappers", () => {
    // All four arms, never one: which applies is the compiler's decision.
    it("carries every platform arm's requirement", () => {
      const plan = EmissionPlan.build(facts({ needsIrqWrappers: true }));

      expect(plan.irqWrappers?.requirements).toEqual([
        "critical-arm-gnu",
        "critical-arduino",
        "critical-avr-libc",
      ]);
    });

    it("is absent when no critical section was opened", () => {
      expect(EmissionPlan.build(NOTHING).irqWrappers).toBeNull();
    });
  });

  describe("requirements -- read off the blocks, never copied (#1928)", () => {
    it("lists every planned block's keys with that block's sites", () => {
      const site = { sourcePath: "a.cnx", line: 3 };
      const plan = EmissionPlan.build(
        facts({
          needsFloatStaticAssert: true,
          needsIrqWrappers: true,
          floatAssertSites: [site],
        }),
      );

      expect(EmissionPlan.requirements(plan)).toEqual([
        { key: "baseline-c", sites: [] },
        { key: "float-assert-c11", sites: [site] },
        { key: "critical-arm-gnu", sites: [] },
        { key: "critical-arduino", sites: [] },
        { key: "critical-avr-libc", sites: [] },
      ]);
    });

    // `takeDeferredSites` hands the facts `PlannedRequirements`'s
    // own arrays without copying them, so they can still grow after
    // `build()`; a site noted after the decision must not join a block it did
    // not cause.
    it("keeps the sites as decided when the facts' lists grow later", () => {
      const early = { sourcePath: "a.cnx", line: 3 };
      const late = { sourcePath: "a.cnx", line: 9 };
      const irqWrapperSites = [early];
      const floatAssertSites = [early];
      const ldrexStrexSites = [early];
      const plan = EmissionPlan.build(
        facts({
          needsIrqWrappers: true,
          irqWrapperSites,
          needsFloatStaticAssert: true,
          floatAssertSites,
          emittedLdrexStrexLoop: true,
          ldrexStrexSites,
        }),
      );

      irqWrapperSites.push(late);
      floatAssertSites.push(late);
      ldrexStrexSites.push(late);

      expect(EmissionPlan.requirements(plan)).toEqual([
        { key: "baseline-c", sites: [] },
        { key: "atomic-ldrex-cmsis", sites: [early] },
        { key: "float-assert-c11", sites: [early] },
        { key: "critical-arm-gnu", sites: [early] },
        { key: "critical-arduino", sites: [early] },
        { key: "critical-avr-libc", sites: [early] },
      ]);
    });

    // The banner and ITranspilerResult both read this list, and freezing the
    // plan is shallow; one reader editing it must not change what the next
    // one sees, nor one IRQ key's sites another's.
    it("hands out copies, so one reader cannot edit what the next sees", () => {
      const site = { sourcePath: "a.cnx", line: 3 };
      const forged = { sourcePath: "forged.cnx", line: 99 };
      const plan = EmissionPlan.build(
        facts({
          needsIrqWrappers: true,
          irqWrapperSites: [site],
          emittedLdrexStrexLoop: true,
          ldrexStrexSites: [site],
        }),
      );
      type Site = { sourcePath: string; line: number | null };
      const sitesIn = (
        list: ReturnType<typeof EmissionPlan.requirements>,
        key: string,
      ): Site[] => {
        const entry = list.find((candidate) => candidate.key === key);
        if (entry === undefined) throw new Error(`no ${key} requirement`);
        return entry.sites as Site[];
      };
      const sitesOf = (key: string) =>
        sitesIn(EmissionPlan.requirements(plan), key);

      sitesOf("atomic-ldrex-cmsis").push(forged);
      const first = EmissionPlan.requirements(plan);
      sitesIn(first, "critical-arm-gnu").push(forged);

      expect(sitesOf("atomic-ldrex-cmsis")).toEqual([site]);
      expect(sitesIn(first, "critical-arduino")).toEqual([site]);
      expect(sitesOf("critical-arm-gnu")).toEqual([site]);
    });

    it("is the mode baseline alone when nothing else costs anything", () => {
      expect(EmissionPlan.requirements(EmissionPlan.build(NOTHING))).toEqual([
        { key: "baseline-c", sites: [] },
      ]);
    });
  });

  // #1997: Render reports the form it emitted; the plan decides its cost.
  describe("form requirements -- decided here, not by Render (#1997)", () => {
    const keys = (over: Partial<IEmissionFacts>): string[] =>
      EmissionPlan.build(facts(over)).formRequirements.map((r) => r.key);

    it.each([
      [false, ["baseline-c"]],
      [true, ["baseline-cpp"]],
    ] as const)("cppMode=%s decides the baseline %j", (cppMode, expected) => {
      expect(keys({ cppMode })).toEqual(expected);
    });

    it.each([
      ["emittedDesignatedInitializer", "cpp-designated-initializer"],
      ["emittedCompoundLiteral", "cpp-compound-literal"],
    ] as const)("%s costs %s in C++ only", (fact, key) => {
      expect(keys({ cppMode: true, [fact]: true })).toEqual([
        "baseline-cpp",
        key,
      ]);
      // Control: the same form is C99 in C, so the baseline already covers it.
      expect(keys({ cppMode: false, [fact]: true })).toEqual(["baseline-c"]);
    });

    it("an LDREX/STREX loop costs CMSIS, attributed to its sites", () => {
      const site = { sourcePath: "a.cnx", line: null };
      const plan = EmissionPlan.build(
        facts({ emittedLdrexStrexLoop: true, ldrexStrexSites: [site] }),
      );

      expect(plan.formRequirements).toEqual([
        { key: "baseline-c", sites: [] },
        { key: "atomic-ldrex-cmsis", sites: [site] },
      ]);
    });

    // README §1: no decision consults instrumentation. Losing the sites loses
    // attribution, never the key; sites without the form decide nothing.
    it("decides the LDREX key from the form, never from its sites", () => {
      expect(keys({ emittedLdrexStrexLoop: true })).toEqual([
        "baseline-c",
        "atomic-ldrex-cmsis",
      ]);
      expect(
        keys({ ldrexStrexSites: [{ sourcePath: "a.cnx", line: null }] }),
      ).toEqual(["baseline-c"]);
    });
  });

  // #1997: one decision -- Render picks the panic templates from this block,
  // and the block carries what they cost.
  describe("panicking overflow helpers", () => {
    const addU8 = {
      name: "cnx_clamp_add_u8",
      behavior: "clamp" as const,
      operation: "add",
      cnxType: "u8",
    };
    const overflowHelpers = new Map([[addU8.name, addU8]]);

    it("cost a hosted libc, as a planned block", () => {
      const plan = EmissionPlan.build(
        facts({ debugMode: true, overflowHelpers }),
      );

      expect(plan.panicOverflowHelpers).toEqual({
        keyword: null,
        requirements: ["overflow-panic-hosted-libc"],
        sites: [],
      });
      expect(EmissionPlan.requirements(plan).map((r) => r.key)).toEqual([
        "baseline-c",
        "overflow-panic-hosted-libc",
      ]);
      expect(plan.formRequirements.map((r) => r.key)).toEqual(["baseline-c"]);
    });

    it.each([
      [
        "clamping helpers outside debug mode",
        { debugMode: false, overflowHelpers },
      ],
      ["debug mode with no helper emitted", { debugMode: true }],
    ] as const)("are absent for %s", (_label, over) => {
      expect(EmissionPlan.build(facts(over)).panicOverflowHelpers).toBeNull();
    });
  });

  describe("ISR typedef", () => {
    it.each([
      [false, true],
      [true, false],
    ] as const)(
      "selfIncludeAdded=%s -> emits typedef %s",
      (selfIncludeAdded, expected) => {
        const plan = EmissionPlan.build(
          facts({ needsISR: true, selfIncludeAdded }),
        );

        expect(plan.isrTypedef).toBe(expected);
      },
    );
  });

  describe("the artifact itself", () => {
    it("is frozen, so no consumer can decide anything afterwards", () => {
      const plan = EmissionPlan.build(NOTHING);

      expect(Object.isFrozen(plan)).toBe(true);
    });

    it("carries helper keys as decided lists", () => {
      const safeDivU32 = {
        name: "cnx_safe_div_u32",
        operation: "div" as const,
        cnxType: "u32",
        inner: null,
      };
      const wrapDivI32 = {
        name: "cnx_wrap_div_i32",
        behavior: "wrap" as const,
        operation: "div",
        cnxType: "i32",
      };
      const plan = EmissionPlan.build(
        facts({
          overflowHelpers: new Map([[wrapDivI32.name, wrapDivI32]]),
          safeDivOps: new Map([["cnx_safe_div_u32", safeDivU32]]),
        }),
      );

      expect(plan.overflowHelpers).toEqual([wrapDivI32]);
      expect(plan.safeDivOps).toEqual([safeDivU32]);
    });
  });
});
