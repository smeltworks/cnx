/**
 * #1668 (T4): the target matrix's rules, each with the case that must stay
 * silent beside the one that must fire.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import TargetMatrix from "../TargetMatrix";
import TestUtils from "../test-utils";
import type IGccToolchain from "../../src/cnx/utils/types/IGccToolchain";

const gccAvailable = spawnSync("gcc", ["--version"]).status === 0;

describe("TargetMatrix.toolchainFor", () => {
  it("gives each cross target its GCC", () => {
    expect(TargetMatrix.toolchainFor("cortex-m4")).toMatchObject({
      driverPrefix: "arm-none-eabi-",
    });
    expect(TargetMatrix.toolchainFor("atmega328p")).toMatchObject({
      driverPrefix: "avr-",
    });
  });

  it("names why an inline description has no toolchain", () => {
    // The transpiler reports an inline description as `inline`, which is not
    // a catalog name, so nothing here can know its compiler
    expect(TargetMatrix.toolchainFor("inline")).toBe(
      "'inline' is not a catalog target, so no toolchain is known for it",
    );
  });
});

// #1760 review ruling, 2026-09-28: "Derive a toolchain" -- an inline
// description compiles with the toolchain of the catalog row sharing its
// platform facts, read by the transpiler's own resolver
describe("TargetMatrix.toolchainForInline", () => {
  const FACTS = [
    "#pragma word_size 32",
    "#pragma basepri false",
    "#pragma interrupt_mask true",
    "#pragma char_bits 8",
    "#pragma char_signed false",
    "#pragma short_bits 16",
    "#pragma int_bits 32",
    "#pragma long_bits 32",
    "#pragma long_long_bits 64",
    "#pragma size_t_bits 32",
    "#pragma pointer_bits 32",
    "#pragma float_bits 32",
    "#pragma double_bits 64",
    "#pragma long_double_bits 64",
    "#pragma big_endian false",
    "#pragma short_enums true",
    "#pragma external_identifier_chars 31",
    "#pragma internal_identifier_chars 63",
  ];
  const described = (ldrex: boolean) => [
    {
      sourcePath: "main.cnx",
      source: [...FACTS, `#pragma ldrex_strex ${ldrex}`, ""].join("\n"),
    },
  ];

  it("takes the toolchain of the catalog row with the same facts", () => {
    // An ARMv6-M description: the cortex-m0 rows
    const toolchain = TargetMatrix.toolchainForInline(described(false));
    expect(typeof toolchain).not.toBe("string");
    expect((toolchain as IGccToolchain).driverPrefix).toBe("arm-none-eabi-");
  });

  it("names none when no catalog row shares the facts", () => {
    // LDREX without BASEPRI: an ARMv8-M Baseline core, which no row describes
    expect(TargetMatrix.toolchainForInline(described(true))).toBe(
      "no catalog row with a toolchain has the inline description's platform facts",
    );
  });

  it("names none when the description does not resolve", () => {
    expect(
      TargetMatrix.toolchainForInline([
        { sourcePath: "main.cnx", source: "#pragma word_size 32\n" },
      ]),
    ).toBe("the program's inline description does not resolve");
  });
});

describe("TargetMatrix.preflight", () => {
  it("probes each cross target's library in both modes, and every catalog row's model", () => {
    const libraries: string[] = [];
    const models: string[] = [];
    const problems = TargetMatrix.preflight((unit, mode, toolchain) => {
      const probe = `${toolchain.driverPrefix}${mode}`;
      (basename(unit).startsWith("model-") ? models : libraries).push(probe);
      return { valid: true };
    });
    expect(problems).toEqual([]);
    expect(libraries.sort()).toEqual([
      "arm-none-eabi-c",
      "arm-none-eabi-cpp",
      "avr-c",
      "avr-cpp",
    ]);
    // one C probe per row that names a toolchain
    expect(models).toHaveLength(TargetMatrix.catalogRows().length);
  });

  it("reports each probe whose compile fails, by target and mode", () => {
    const problems = TargetMatrix.preflight(
      (_unit, _mode, toolchain: IGccToolchain) =>
        toolchain.driverPrefix === "avr-"
          ? { valid: false, message: "avr-gcc: not found" }
          : { valid: true },
    );
    expect(problems).toEqual([
      "atmega328p (c): avr-gcc: not found",
      "atmega328p (cpp): avr-gcc: not found",
      "catalog row 'atmega328p' disagrees with its compiler: avr-gcc: not found",
    ]);
  });
});

describe("TargetMatrix.catalogRows", () => {
  it("lists each row with a toolchain once, and skips one without", () => {
    const names = TargetMatrix.catalogRows().map((row) => row.name);
    expect(names).toContain("host");
    expect(names).toContain("cortex-m0+");
    expect(names).toContain("atmega328p");
    // `avr` and `arduino-uno` are aliases of the atmega328p row
    expect(names.filter((name) => name === "atmega328p")).toHaveLength(1);
    expect(names).not.toContain("esp32");
  });
});

describe.skipIf(!gccAvailable)("TargetMatrix.modelProbeSource", () => {
  function compilesOnHost(source: string): boolean {
    const dir = mkdtempSync(join(tmpdir(), "cnx-model-"));
    try {
      const probe = join(dir, "model.c");
      writeFileSync(probe, source);
      return TestUtils.compileTranslationUnit(
        probe,
        dir,
        process.cwd(),
        "c",
        TargetMatrix.hostToolchain(),
        false,
      ).valid;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  const host = TargetMatrix.catalogRows().find((row) => row.name === "host");

  it("compiles for the host row, whose facts are this machine's", () => {
    expect(compilesOnHost(TargetMatrix.modelProbeSource(host!))).toBe(true);
  });

  it("fails for a host row that claims an interrupt mask (#1789)", () => {
    expect(
      compilesOnHost(
        TargetMatrix.modelProbeSource({ ...host!, interrupt_mask: true }),
      ),
    ).toBe(false);
  });

  it("fails for a host row that claims a 32-bit long", () => {
    expect(
      compilesOnHost(
        TargetMatrix.modelProbeSource({ ...host!, long_bits: 32 }),
      ),
    ).toBe(false);
  });
});

describe("TestUtils.targetXfails", () => {
  it("reads a marker's target, resolving an alias, and its issue", () => {
    expect(
      TestUtils.targetXfails(
        "// test-execution\n// test-target-xfail: avr #1147\nu8 x <- 1;\n",
      ),
    ).toEqual([{ target: "atmega328p", issue: 1147 }]);
  });

  it("reads nothing from a fixture with no marker", () => {
    expect(TestUtils.targetXfails("// test-execution\nu8 x <- 1;\n")).toEqual(
      [],
    );
  });

  it("reads several targets, one mode, and the issue", () => {
    expect(
      TestUtils.targetXfails(
        "// test-target-xfail: host cortex-m4 cpp #1062\n",
      ),
    ).toEqual([
      { target: "host", mode: "cpp", issue: 1062 },
      { target: "cortex-m4", mode: "cpp", issue: 1062 },
    ]);
  });

  it.each([
    ["avr", "no issue"],
    ["#1147", "no target"],
    ["avr c cpp #1147", "two modes"],
    ["cpp #1147", "a mode and no target"],
  ])("rejects `%s` (%s)", (argument) => {
    expect(TestUtils.targetXfails(`// test-target-xfail: ${argument}\n`)).toBe(
      `\`// test-target-xfail: ${argument}\` must name targets, an optional mode, an issue and an optional quoted failure text, e.g. \`// test-target-xfail: avr cpp #1234 "shift count"\``,
    );
  });

  // #1760 second review: a quoted text is the failure the cell must show
  it("reads a quoted failure text after the issue", () => {
    expect(
      TestUtils.targetXfails(
        '// test-target-xfail: host cortex-m7 #1062 "integer constant is so large"\n',
      ),
    ).toEqual([
      {
        target: "host",
        mode: undefined,
        issue: 1062,
        expect: "integer constant is so large",
      },
      {
        target: "cortex-m7",
        mode: undefined,
        issue: 1062,
        expect: "integer constant is so large",
      },
    ]);
  });

  it("rejects a marker naming a target the catalog does not have", () => {
    expect(TestUtils.targetXfails("// test-target-xfail: z80 #1\n")).toBe(
      "`// test-target-xfail: z80 #1` names 'z80', which is not a catalog target",
    );
  });
});

describe("TestUtils.settleCell", () => {
  const avr = [{ target: "atmega328p", issue: 1147 }];

  // #1760 second review: an expected failure absorbed ANY failure
  it("takes a quoted failure as expected only when the cell shows it", () => {
    const quoted = [
      { target: "atmega328p", issue: 1147, expect: "SREG undeclared" },
    ];
    expect(
      TestUtils.settleCell(
        "atmega328p",
        "c",
        "error: SREG undeclared here",
        "compiled",
        quoted,
      ).outcome,
    ).toBe("xfail");
    expect(
      TestUtils.settleCell(
        "atmega328p",
        "c",
        "transpile crashed",
        "compiled",
        quoted,
      ),
    ).toEqual({
      target: "atmega328p",
      mode: "c",
      outcome: "failed",
      detail:
        '`// test-target-xfail` expects atmega328p to fail with "SREG undeclared" (#1147), and it failed otherwise: transpile crashed',
    });
  });

  it("passes an unmarked cell that compiled", () => {
    expect(
      TestUtils.settleCell("cortex-m4", "c", null, "compiled", avr),
    ).toEqual({ target: "cortex-m4", mode: "c", outcome: "compiled" });
  });

  it("fails an unmarked cell that did not compile", () => {
    expect(
      TestUtils.settleCell("cortex-m4", "c", "it broke", "compiled", avr),
    ).toEqual({
      target: "cortex-m4",
      mode: "c",
      outcome: "failed",
      detail: "it broke",
    });
  });

  it("expects a marked cell to fail, naming its issue", () => {
    expect(
      TestUtils.settleCell(
        "atmega328p",
        "c",
        "SREG undeclared",
        "compiled",
        avr,
      ),
    ).toEqual({
      target: "atmega328p",
      mode: "c",
      outcome: "xfail",
      detail: "#1147: SREG undeclared",
    });
  });

  it("applies a mode-qualified marker to that mode's cell alone", () => {
    const cppOnly = [
      { target: "atmega328p", mode: "cpp" as const, issue: 1710 },
    ];
    expect(
      TestUtils.settleCell(
        "atmega328p",
        "cpp",
        "narrowing",
        "compiled",
        cppOnly,
      ).outcome,
    ).toBe("xfail");
    expect(
      TestUtils.settleCell("atmega328p", "c", "narrowing", "compiled", cppOnly)
        .outcome,
    ).toBe("failed");
  });

  it("fails a marked cell that passed, so a marker cannot outlive its bug", () => {
    expect(
      TestUtils.settleCell("atmega328p", "cpp", null, "compiled", avr),
    ).toMatchObject({ outcome: "failed" });
  });
});

describe("TestUtils.targetProblem", () => {
  const pinned = "#pragma target cortex-m7\nvoid main() {}\n";

  it("reports a run named other than the fixture's pin, even its alias", () => {
    // teensy41 is an alias of cortex-m7: comparing catalog rows called them
    // one target, while the run printed a name the fixture never asked for
    expect(
      TestUtils.targetProblem(pinned, { name: "teensy41", source: "pragma" }),
    ).toBe(
      "ran for target 'teensy41' (pragma), but the fixture pins 'cortex-m7'",
    );
  });

  it("accepts a run named as the fixture pins it", () => {
    expect(
      TestUtils.targetProblem(pinned, { name: "cortex-m7", source: "pragma" }),
    ).toBeNull();
  });
});
