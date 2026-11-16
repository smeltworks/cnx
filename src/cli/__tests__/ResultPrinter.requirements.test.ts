/**
 * Issue #1143: The transpile-time toolchain requirements report.
 *
 * The report answers "what does MY project need?" rather than "what might
 * cnx need?", so the cases that matter most are the ones where it must stay
 * silent (a plain C99 project owes nothing) and the ones where a cost is
 * conditional (a critical section needs one of four platform libraries,
 * decided by the compiler, not all four).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import ResultPrinter from "../ResultPrinter";
import type ITranspilerResult from "../types/ITranspilerResult";
import type IRecordedRequirement from "../../cnx/types/IRecordedRequirement";

function createResult(
  requirements: readonly IRecordedRequirement[],
): ITranspilerResult {
  return {
    success: true,
    files: [],
    filesProcessed: 1,
    symbolsCollected: 0,
    errors: [],
    warnings: [],
    outputFiles: [],
    requirements,
  };
}

describe("ResultPrinter toolchain requirements", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let lines: string[];
  let output: string;

  beforeEach(() => {
    lines = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      lines.push(String(msg ?? ""));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function print(requirements: readonly IRecordedRequirement[]): string {
    ResultPrinter.print(createResult(requirements));
    return lines.join("\n");
  }

  it("prints nothing extra for a project that only needs the C baseline", () => {
    output = print([{ key: "baseline-c", sites: [] }]);
    expect(output).not.toContain("Toolchain requirements");
  });

  it("prints nothing extra for a project that only needs the C++ baseline", () => {
    output = print([{ key: "baseline-cpp", sites: [] }]);
    expect(output).not.toContain("Toolchain requirements");
  });

  it("reports a C11 cost with the source site that incurred it", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      {
        key: "float-assert-c11",
        sites: [{ sourcePath: "sensors.cnx", line: 12 }],
      },
    ]);
    expect(output).toContain("Toolchain requirements for this project:");
    expect(output).toContain("C99");
    expect(output).toContain("C11");
    expect(output).toContain("_Static_assert");
    expect(output).toContain("sensors.cnx:12");
  });

  it("reports the four critical-section arms as alternatives, not four costs", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      { key: "critical-arm-gnu", sites: [{ sourcePath: "irq.cnx", line: 11 }] },
      { key: "critical-arduino", sites: [{ sourcePath: "irq.cnx", line: 11 }] },
      {
        key: "critical-avr-libc",
        sites: [{ sourcePath: "irq.cnx", line: 11 }],
      },
    ]);
    expect(output).toContain("one of, by target");
    expect(output).toContain("ARMv7-M core");
    expect(output).toContain("avr-libc");
    expect(output).toContain("Arduino core");
    expect(output).toContain("when defined(__AVR__)");
    // The ARM arm needs inline asm; the AVR arm does not. Marking the whole
    // feature as needing GNU extensions would misinform an AVR user.
    expect(output).toContain("[GNU/Clang extension]");
  });

  it("names both the standard and the extension fallback for C++ designated initializers", () => {
    output = print([
      { key: "baseline-cpp", sites: [] },
      { key: "cpp-designated-initializer", sites: [] },
    ]);
    expect(output).toContain("C++20");
    expect(output).toContain("or a GNU/Clang extension below C++20");
  });

  it("reports a construct no standard provides under Compiler", () => {
    // Compound literals are not ISO C++ at any version, so there is no
    // "upgrade your standard" answer -- only an extension.
    output = print([
      { key: "baseline-cpp", sites: [] },
      { key: "cpp-compound-literal", sites: [] },
    ]);
    expect(output).toContain("Compiler");
    expect(output).toContain("GNU/Clang extension");
    expect(output).not.toContain("or a GNU/Clang extension below");
  });

  it("explains a site-less requirement instead of showing nothing", () => {
    // Some requirements are file-scoped rather than sited: --debug plus any
    // clamp type, or a whole transpile mode. Reported in review of #1153 --
    // the report named the cost but never said what incurred it.
    output = print([
      { key: "baseline-c", sites: [] },
      { key: "overflow-panic-hosted-libc", sites: [] },
    ]);
    expect(output).toContain(
      "from transpiling with --debug and using clamp or wrap integer arithmetic",
    );
  });

  it("prefers real sites over the explanation when it has them", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      {
        key: "float-assert-c11",
        sites: [{ sourcePath: "sensors.cnx", line: 12 }],
      },
    ]);
    expect(output).toContain("sensors.cnx:12");
    expect(output).not.toContain("from reading or writing a bit range");
  });

  it("ignores site entries that carry no path", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      { key: "float-assert-c11", sites: [{ sourcePath: "", line: null }] },
    ]);
    expect(output).toContain("from reading or writing a bit range");
  });

  it("collapses more than three sites to a count", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      {
        key: "float-assert-c11",
        sites: [1, 2, 3, 4, 5].map((line) => ({ sourcePath: "a.cnx", line })),
      },
    ]);
    expect(output).toContain("(+2 more)");
  });

  it("prints an atomic read-modify-write's LDREX path as one requirement", () => {
    // #1146: the masked path is the ADR-050 wrappers' now, whose arms are the
    // critical section's alternatives, so LDREX/STREX has no alternative of
    // its own feature to be listed beside
    output = print([
      { key: "baseline-c", sites: [] },
      { key: "atomic-ldrex-cmsis", sites: [] },
    ]);
    expect(output).not.toContain("one of, by target");
    expect(output).toContain("CMSIS + ARMv7-M");
  });

  it("shows a bare path when a site has no line", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      {
        key: "float-assert-c11",
        sites: [{ sourcePath: "sensors.cnx", line: null }],
      },
    ]);
    expect(output).toContain("sensors.cnx");
    expect(output).not.toContain("sensors.cnx:");
  });

  it("points at the generated matrix for the full picture", () => {
    output = print([
      { key: "baseline-c", sites: [] },
      { key: "float-assert-c11", sites: [] },
    ]);
    expect(output).toContain("docs/compatibility.md");
  });
});
