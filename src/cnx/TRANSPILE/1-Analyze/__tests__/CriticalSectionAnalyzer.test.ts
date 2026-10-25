import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import CriticalSectionAnalyzer from "../CriticalSectionAnalyzer";
import type ITargetDescription from "../../../types/ITargetDescription";

/**
 * #1322. E0853 -- `return` inside a `critical` block leaves interrupts
 * disabled, because the generated C restores `PRIMASK` after the block and a
 * `return` jumps past that restore.
 *
 * The rule was three throws in `TypeValidator`, driven by a hand-rolled
 * recursion that enumerated statement kinds: return, if, while, for, do-while.
 * It missed `switch`, and the miss was not theoretical -- see the regression
 * below. That is the failure mode of enumerating: the walk is correct for every
 * case someone listed, and silently absent for the one nobody did.
 *
 * The walk that replaced it descends through `StatementChildren`, which names
 * every statement kind and stops compiling when one is added.
 */
const target = (name: string, interruptMask: boolean): ITargetDescription =>
  ({ name, interrupt_mask: interruptMask }) as ITargetDescription;

const errors = (
  source: string,
  description: ITargetDescription | null = target("cortex-m7", true),
) => {
  return new CriticalSectionAnalyzer(description).analyze(
    CnxSourceParser.parse(source).program,
  );
};

const inCritical = (body: string): string =>
  `u32 value <- 0;\nu32 f() {\n    critical {\n${body}\n    }\n    return 0;\n}`;

describe("CriticalSectionAnalyzer", () => {
  it("rejects a bare return in a critical block", () => {
    const found = errors(inCritical("        return value;"));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0853");
    expect(found[0].span.line).toBe(4);
  });

  it("rejects a return inside a switch case -- the case the old walk missed", () => {
    // REGRESSION. `switch` was not among the statement kinds
    // `_validateStatementForEarlyExit` recursed into, so this compiled clean
    // and emitted C that returns between `__cnx_disable_irq()` and
    // `__cnx_set_PRIMASK()`. On device, interrupts stay off.
    const found = errors(
      inCritical(
        [
          "        switch (value) {",
          "            case 1 {",
          "                return value;",
          "            }",
          "            default {",
          "                value <- 0;",
          "            }",
          "        }",
        ].join("\n"),
      ),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0853");
  });

  it("rejects a return nested through if and while", () => {
    const found = errors(
      inCritical(
        [
          "        if (value > 0) {",
          "            while (value > 0) {",
          "                return value;",
          "            }",
          "        }",
        ].join("\n"),
      ),
    );
    expect(found).toHaveLength(1);
  });

  it("accepts a return OUTSIDE the critical block", () => {
    // The negative control the rule turns on: the same statement, one block
    // out, is not merely allowed but the normal way to write this.
    expect(errors(inCritical("        value <- 1;"))).toEqual([]);
  });

  it("accepts a critical block that assigns and falls through", () => {
    expect(
      errors(inCritical("        value +<- 1;\n        value <- value;")),
    ).toEqual([]);
  });

  it("reports every offending return, not just the first", () => {
    const found = errors(
      inCritical(
        [
          "        if (value > 0) {",
          "            return value;",
          "        }",
          "        if (value > 1) {",
          "            return value;",
          "        }",
        ].join("\n"),
      ),
    );
    expect(found).toHaveLength(2);
  });

  it("stops applying once the critical block closes", () => {
    // A depth counter that never decremented would report the trailing
    // `return 0;` of every function containing a critical block.
    const found = errors(inCritical("        value <- 1;"));
    expect(found).toEqual([]);
  });

  // #1789 / #1147: a target that cannot mask interrupts has no critical
  // section; its wrappers had only a CMSIS guess, which no host header declares
  it("rejects a critical block on a target that cannot mask interrupts (E0916)", () => {
    const found = errors(
      inCritical("        value <- 1;"),
      target("host", false),
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe("E0916");
    expect(found[0].span.line).toBe(3);
    expect(found[0].message).toBe(
      "target 'host' has no critical section: disabling interrupts there does not shut out every other execution context",
    );
  });

  it("reports both rules where both apply", () => {
    const found = errors(
      inCritical("        return value;"),
      target("esp32", false),
    );
    expect(found.map((error) => error.code)).toEqual(["E0916", "E0853"]);
  });

  it("leaves the target rule to 1.4 when the target was rejected", () => {
    expect(errors(inCritical("        value <- 1;"), null)).toEqual([]);
  });
});
