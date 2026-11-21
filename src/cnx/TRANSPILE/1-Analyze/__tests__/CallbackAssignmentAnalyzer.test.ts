/**
 * Unit tests for CallbackAssignmentAnalyzer's register-parameter rule
 * (E0940, ADR-072): a register parameter takes an instance of its register
 * type, or a parameter of that type passed on.
 */
import { describe, it, expect } from "vitest";
import TranspileState from "../../TranspileState";
import type ITargetDescription from "../../../types/ITargetDescription";
import CallbackAssignmentAnalyzer from "../CallbackAssignmentAnalyzer";
import ValuePositions from "../helpers/ValuePositions";
import settleSource from "./settleSource";
import testAnalysisContext from "./testAnalysisContext";

const REGISTERS = `
register GpioPort {
    0x00 rw u32 DR,
}
register Uart {
    0x00 rw u8 DATA,
}
GpioPort GPIO1(0x401B8000);
Uart UART0(0x40001000);
void setHigh(GpioPort port) {
    port.DR <- 1;
}
`;

function analyze(body: string) {
  const state = new TranspileState();
  const program = settleSource(
    `${REGISTERS}\nvoid main() {\n${body}\n}\n`,
    state,
    {
      kind: "resolved",
      name: "cortex-m7",
      source: "pragma",
      description: { pointer_bits: 32, int_bits: 32 } as ITargetDescription,
    },
  );
  const context = testAnalysisContext(state);
  return new CallbackAssignmentAnalyzer(context).analyze(
    program,
    ValuePositions.of(program, context).positions,
  );
}

describe("CallbackAssignmentAnalyzer register parameters (E0940, ADR-072)", () => {
  it("accepts an instance of the parameter's register type", () => {
    expect(analyze("setHigh(GPIO1);")).toEqual([]);
  });

  it("rejects an instance of another register type", () => {
    const errors = analyze("setHigh(UART0);");
    expect(errors.map((e) => e.code)).toEqual(["E0940"]);
    expect(errors[0].message).toBe(
      "'UART0' is a register of type 'Uart'; parameter 'port' of function 'setHigh' takes a 'GpioPort'",
    );
  });

  it("rejects a value that is not a register", () => {
    const errors = analyze("setHigh(5);");
    expect(errors[0].message).toContain("'5' is not a register instance");
  });
});
