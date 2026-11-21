/**
 * Unit tests for RegisterInstanceAnalyzer's layout rules (ADR-072): E0938 for
 * members that overlap outside an offset group, E0939 for a misaligned member.
 * The `test-error` fixtures stop at the first analyzer that reports, so these
 * reach each help text directly.
 */
import { describe, it, expect } from "vitest";
import TranspileState from "../../TranspileState";
import type ITargetDescription from "../../../types/ITargetDescription";
import RegisterInstanceAnalyzer from "../RegisterInstanceAnalyzer";
import settleSource from "./settleSource";
import testAnalysisContext from "./testAnalysisContext";

function analyze(members: string) {
  const state = new TranspileState();
  const program = settleSource(
    `#pragma target cortex-m7\nregister Block {\n${members}\n}\nBlock B(0x40000000);\n`,
    state,
    {
      kind: "resolved",
      name: "cortex-m7",
      source: "pragma",
      description: { pointer_bits: 32, int_bits: 32 } as ITargetDescription,
    },
  );
  return new RegisterInstanceAnalyzer(testAnalysisContext(state)).analyze(
    program,
  );
}

describe("RegisterInstanceAnalyzer layout (ADR-072)", () => {
  it("points two members at one offset to the group form (E0938)", () => {
    const errors = analyze("0x14 rw u32 CMP,\n0x14 rw u32 CNT,");
    expect(errors.map((e) => e.code)).toEqual(["E0938"]);
    expect(errors[0].message).toBe(
      "register member 'CNT' at 0x14 overlaps 'CMP' at 0x14",
    );
    expect(errors[0].helpText).toContain("`0x14 { rw u32 CMP, rw u32 CNT, }`");
  });

  it("rejects a partial overlap without offering a group (E0938)", () => {
    const errors = analyze("0x00 rw u32 WORD,\n0x02 rw u8 BYTE,");
    expect(errors.map((e) => e.code)).toEqual(["E0938"]);
    expect(errors[0].helpText).toContain("Every member of a group starts");
  });

  it("accepts members that share an offset inside a group", () => {
    expect(
      analyze("0x00 {\n ro u8 RBR,\n wo u8 THR,\n},\n0x05 ro u8 LSR,"),
    ).toEqual([]);
  });

  it("rejects a member off its size's alignment (E0939)", () => {
    const errors = analyze("0x00 rw u8 CTRL,\n0x02 rw u32 DATA,");
    expect(errors.map((e) => e.code)).toEqual(["E0939"]);
  });
});
