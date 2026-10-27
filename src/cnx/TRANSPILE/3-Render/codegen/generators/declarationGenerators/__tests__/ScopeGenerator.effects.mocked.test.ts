/**
 * #1445 review: the scope-member path FORWARDS a generator's effects.
 *
 * `processScopeMember`'s register arm calls the same generator the file-scope
 * caller reaches through `CodeGenWalker.invokeGenerator`, which applies its
 * effects. The arm used to return only `["", result.code]`, so one function had
 * two callers honoring opposite halves of its contract -- safe solely because
 * `RegisterGenerator` hardcodes `effects: []` today.
 *
 * That "safe solely because" is what makes the fix untestable against the real
 * generator: with `effects` always empty, no assertion can tell applying them
 * from dropping them, and the regression would return silently. So the
 * generator is MOCKED to return a non-empty effect -- the test is about the
 * wiring, not about which effects a register happens to raise.
 *
 * Isolated in a `.mocked.test.ts` because `vi.mock` is hoisted and would
 * otherwise replace `RegisterGenerator` for every case in the sibling file.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

import AdrProvenance from "../../../../../../instrumentation/AdrProvenance";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import IPlannedRegister from "../../../types/IPlannedRegister";
import TGeneratorEffect from "../../TGeneratorEffect";
import TestGeneratorState from "../../__tests__/testGeneratorState";

const REGISTER_EFFECTS: readonly TGeneratorEffect[] = [
  { type: "set-array-init-count", count: 1 },
];

vi.mock("../RegisterGenerator", () => ({
  default: () => ({
    code: "volatile uint32_t *const Chip__CR = (uint32_t *)0x4000;",
    effects: REGISTER_EFFECTS,
  }),
}));

// Imported AFTER the mock declaration for readability only -- `vi.mock` is
// hoisted above both by the transform, so the order here does not decide it.
const generateScope = (await import("../ScopeGenerator")).default;

const STATE: IGeneratorState = TestGeneratorState.create({});

function orchestrator(): IOrchestrator {
  return {
    setCurrentScope: vi.fn(),
    applyEffects: vi.fn(),
  } as unknown as IOrchestrator;
}

describe("ScopeGenerator forwards a scope member's effects", () => {
  beforeEach(() => {
    AdrProvenance.reset();
    AdrProvenance.beginFile("test.cnx");
  });

  it("applies the effects a register member's generator returns", () => {
    const host = orchestrator();

    const result = generateScope(
      {
        name: "Chip",
        declaringScopePath: "Chip",
        typeDefinitions: [],
        members: [
          {
            kind: "register",
            adrLine: 4,
            planRegister: () => ({}) as IPlannedRegister,
          },
        ],
      },
      { symbols: null } as unknown as IGeneratorInput,
      STATE,
      host,
    );

    // The wiring under test. Dropping `orchestrator.applyEffects(...)` from the
    // register arm reddens exactly this.
    expect(host.applyEffects).toHaveBeenCalledWith(REGISTER_EFFECTS);

    // NEGATIVE CONTROL. "applyEffects was called" would also hold if the arm
    // applied some unrelated constant, and "the code rendered" proves the arm
    // ran at all -- without it a generator that threw before reaching the call
    // would look the same as one that never had effects to forward.
    expect(result.code).toContain("Chip__CR");
  });
});
