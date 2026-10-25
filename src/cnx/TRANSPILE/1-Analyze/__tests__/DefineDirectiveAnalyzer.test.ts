import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import DefineDirectiveAnalyzer from "../DefineDirectiveAnalyzer";

/**
 * #1322. ADR-037's `#define` shape (E0501 function-like, E0502 with a value),
 * replacing two codegen throws that reported `1:0` and carried the real line
 * as prose in the message.
 *
 * These parse real source. The tests they replace built `DefineDirectiveContext`
 * objects by hand, so they could assert the message text and nothing about
 * which source the rule actually fires on -- the position defect they were
 * written beside was invisible to them for that reason.
 */
const errors = (source: string) => {
  return new DefineDirectiveAnalyzer().analyze(
    CnxSourceParser.parse(source).program,
  );
};

describe("DefineDirectiveAnalyzer", () => {
  it("rejects a function-like macro at its own position, not 1:0", () => {
    const [found] = errors(
      "#define FLAG_A\n#define ADD(a, b) ((a) + (b))\n\nu8 main() {\n    return 0;\n}",
    );
    expect(found.code).toBe("E0501");
    expect(found.span.line).toBe(2);
    expect(found.message).toBe(
      "Function-like macro 'ADD' is not allowed. Use inline functions instead.",
    );
  });

  it("rejects a #define with a value and names the const to write", () => {
    const [found] = errors(
      "#define FLAG_A\n#define FLAG_B\n#define BUFFER_SIZE 256\n\nu8 main() {\n    return 0;\n}",
    );
    expect(found.code).toBe("E0502");
    expect(found.span.line).toBe(3);
    expect(found.message).toBe(
      "#define with value 'BUFFER_SIZE' is not allowed. Use a read-only binding instead: u32 BUFFER_SIZE <- value;",
    );
  });

  it("reports a real column for an indented directive", () => {
    // Every fixture in the corpus sits at column 0, which is indistinguishable
    // from a hard-coded 0 -- the defect being removed. This one is not.
    const [found] = errors("  #define SIZE 8\n\nu8 main() {\n    return 0;\n}");
    expect([found.span.line, found.span.column]).toEqual([1, 2]);
  });

  it("reports every offending directive, where a throw stopped at the first", () => {
    expect(
      errors(
        "#define A 1\n#define B(x) (x)\n#define C 3\n\nu8 main() {\n    return 0;\n}",
      ).map((e) => [e.code, e.span.line]),
    ).toEqual([
      ["E0502", 1],
      ["E0501", 2],
      ["E0502", 3],
    ]);
  });

  it("stays silent on flag-only defines and on conditional directives", () => {
    expect(
      errors(
        [
          "#define PLATFORM",
          "#  define SPACED",
          "#define _GUARD_H",
          "#define VERSION_2",
          "#ifdef PLATFORM",
          "#endif",
          "",
          "u8 main() {",
          "    return 0;",
          "}",
        ].join("\n"),
      ),
    ).toEqual([]);
  });
});
