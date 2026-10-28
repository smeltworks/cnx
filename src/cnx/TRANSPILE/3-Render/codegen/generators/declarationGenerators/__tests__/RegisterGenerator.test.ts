/**
 * Unit tests for the ADR-004 register generator.
 *
 * #1445 merged `generateRegister` and `generateScopedRegister` into one
 * register generator; this file merges the two suites that tested
 * them. They had drifted into ~100 lines of duplicated scaffolding and two
 * copies of the access-modifier and effects assertions, differing only in the
 * macro prefix -- the S5976 cluster CLAUDE.md says to convert in the PR that
 * creates it, and, against one implementation, the same two-places-to-edit
 * shape the merge removed from the source.
 *
 * Everything that is one decision at both scopes runs under `describe.each`.
 * What stays separate is what is genuinely scope-specific: the #1472 guards
 * that nothing below the TypeNameLadder ladder re-qualifies a resolved name.
 *
 * #1445 box 3: the generator takes `IPlannedRegister`, so these build plans.
 * The `cType` is the value `orchestrator.generateType` returned -- which is
 * what the ADR-057 guards below are ABOUT, and stating it directly is a
 * sharper test than routing it through a mock type map that had to be read
 * backwards to see what was being asserted.
 */
import { describe, it, expect, beforeEach } from "vitest";
import TranspileState from "../../../../../TranspileState";
import generateRegister from "../RegisterGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import type IPlannedRegister from "../../../types/IPlannedRegister";
import type IPlannedRegisterMember from "../../../types/IPlannedRegisterMember";

// ========================================================================
// Test Helpers
// ========================================================================

/** The C types the type ladder resolves the primitives to. */
const C_TYPES: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
};

/** A member as written, before 3-Declare names it. */
type TMemberSpec = Omit<IPlannedRegisterMember, "cName"> & {
  readonly name: string;
};

/** A register as written, before 3-Declare names it. */
interface IRegisterSpec {
  readonly name: string;
  readonly baseAddress: string;
  readonly members: readonly TMemberSpec[];
}

/** A member, with the C type the ladder resolved unless one is given. */
function member(
  name: string,
  type: string,
  access: IPlannedRegisterMember["access"],
  offset: string,
  cType: string = C_TYPES[type] ?? type,
): TMemberSpec {
  return { name, cType, access, offset };
}

/** A register. */
function planned(
  name: string,
  baseAddress: string,
  members: TMemberSpec[],
): IRegisterSpec {
  return { name, baseAddress, members };
}

/**
 * Create minimal mock input.
 *
 * Empty on purpose: this generator takes `_input`. The scoped suite used to
 * build a twenty-field `symbols` object here, including a `knownBitmaps` set
 * whose contents nothing could read -- scaffolding that looked like it was
 * setting up the bitmap cases when the orchestrator's type map is what
 * decided them.
 */
function createMockInput(): IGeneratorInput {
  return {} as unknown as IGeneratorInput;
}

/** Create minimal mock state (this generator takes `_state`). */
function createMockState(): IGeneratorState {
  return TestGeneratorState.create();
}

/**
 * #1452: the generator reads 2.3's per-file state off the orchestrator, to
 * decide whether the accessor block belongs in the header or the `.c`. That is
 * the only member it touches, so the mock carries it and nothing else.
 */
function createMockOrchestrator(): IOrchestrator {
  return { state } as unknown as IOrchestrator;
}

let state = new TranspileState();

beforeEach(() => {
  state = new TranspileState();
});

/** Run the generator on the plan, named as 3-Declare names it under `prefix` (#2116). */
function generate(prefix: string, register: IRegisterSpec) {
  const name = `${prefix}${register.name}`;
  const plan: IPlannedRegister = {
    name,
    baseAddress: register.baseAddress,
    members: register.members.map(({ name: memberName, ...rest }) => ({
      ...rest,
      cName: `${name}__${memberName}`,
    })),
  };
  return generateRegister(
    plan,
    createMockInput(),
    createMockState(),
    createMockOrchestrator(),
  );
}

// ========================================================================
// Tests — identical at file scope and inside a scope, modulo the prefix
// ========================================================================

describe.each([
  ["file scope", "", ""],
  ["inside a scope", "Teensy4", "Teensy4__"],
])("RegisterGenerator (%s)", (_label, _scopePath, prefix) => {
  describe("basic register generation", () => {
    it("generates register with single rw member", () => {
      const result = generate(
        prefix,
        planned("GPIO7", "0x42004000", [member("DR", "u32", "rw", "0x00")]),
      );

      expect(result.code).toBe(
        `/* Register: ${prefix}GPIO7 @ 0x42004000 */
#define ${prefix}GPIO7__DR (*(volatile uint32_t*)(0x42004000 + 0x00))
`,
      );
      expect(result.effects).toEqual([]);
    });

    it("generates register with multiple members", () => {
      const result = generate(
        prefix,
        planned("TIMER", "0x40000000", [
          member("CTRL", "u32", "rw", "0x00"),
          member("COUNT", "u32", "ro", "0x04"),
          member("LOAD", "u32", "rw", "0x08"),
        ]),
      );

      expect(result.code).toContain(
        `/* Register: ${prefix}TIMER @ 0x40000000 */`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__CTRL (*(volatile uint32_t*)(0x40000000 + 0x00))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__COUNT (*(volatile uint32_t const *)(0x40000000 + 0x04))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}TIMER__LOAD (*(volatile uint32_t*)(0x40000000 + 0x08))`,
      );
    });
  });

  describe("access modifiers (ADR-004)", () => {
    it.each([
      ["read-only member gets a const qualifier", "ro", "uint8_t const *"],
      ["write-only member does not", "wo", "uint8_t*"],
      ["read-write member does not", "rw", "uint8_t*"],
    ])("%s", (_case, access, cast) => {
      const result = generate(
        prefix,
        planned("STATUS", "0x50000000", [
          member(
            "FLAGS",
            "u8",
            access as IPlannedRegisterMember["access"],
            "0x00",
          ),
        ]),
      );

      expect(result.code).toContain(
        `#define ${prefix}STATUS__FLAGS (*(volatile ${cast})(0x50000000 + 0x00))`,
      );
    });
  });

  describe("various type widths", () => {
    it.each([
      ["8-bit", "u8", "uint8_t"],
      ["16-bit", "u16", "uint16_t"],
      ["32-bit", "u32", "uint32_t"],
      ["64-bit", "u64", "uint64_t"],
    ])("generates %s register members", (_case, cnxType, cType) => {
      const result = generate(
        prefix,
        planned("REG", "0x40000000", [member("DATA", cnxType, "rw", "0x00")]),
      );

      expect(result.code).toContain(`volatile ${cType}*`);
    });
  });

  describe("non-contiguous register layouts", () => {
    it("handles gaps in register offsets (like i.MX RT1062)", () => {
      const result = generate(
        prefix,
        planned("GPIO", "0x401B8000", [
          member("DR", "u32", "rw", "0x00"),
          member("GDIR", "u32", "rw", "0x04"),
          member("PSR", "u32", "ro", "0x08"),
          member("ICR1", "u32", "rw", "0x0C"),
          member("ICR2", "u32", "rw", "0x10"),
          // Gap at 0x14
          member("IMR", "u32", "rw", "0x14"),
          member("ISR", "u32", "rw", "0x18"),
          // Large gap
          member("DR_SET", "u32", "wo", "0x84"),
          member("DR_CLEAR", "u32", "wo", "0x88"),
          member("DR_TOGGLE", "u32", "wo", "0x8C"),
        ]),
      );

      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR (*(volatile uint32_t*)(0x401B8000 + 0x00))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_SET (*(volatile uint32_t*)(0x401B8000 + 0x84))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_CLEAR (*(volatile uint32_t*)(0x401B8000 + 0x88))`,
      );
      expect(result.code).toContain(
        `#define ${prefix}GPIO__DR_TOGGLE (*(volatile uint32_t*)(0x401B8000 + 0x8C))`,
      );
    });
  });

  describe("effects", () => {
    it("returns empty effects array", () => {
      expect(
        generate(
          prefix,
          planned("TEST", "0x40000000", [member("DATA", "u32", "rw", "0x00")]),
        ).effects,
      ).toEqual([]);
    });
  });
});

// ========================================================================
// Tests — scope-specific: the ADR-057 resolution point is upstream
// ========================================================================

describe("RegisterGenerator (scoped bitmap type resolution)", () => {
  it("emits the name the ladder resolved, without re-deriving it", () => {
    // ADR-057 qualification belongs to `orchestrator.generateType`, which is
    // the single resolution point. This generator is transparent to it: a
    // bare `GPIO7Pins` inside `scope Teensy4` arrives ALREADY qualified.
    // The ladder qualified it -- that is what production hands over.
    const result = generate(
      "Teensy4__",
      planned("GPIO7", "0x42004000", [
        member("PINS", "GPIO7Pins", "rw", "0x00", "Teensy4__GPIO7Pins"),
      ]),
    );

    expect(result.code).toContain("volatile Teensy4__GPIO7Pins*");
  });

  it("does not re-qualify a resolved name, so an explicit global. survives", () => {
    // The regression guard for #1472. `global.GPIO7Pins` opts out of scope
    // resolution, so the ladder hands over the BARE name -- while a
    // same-named scoped bitmap also exists. The generator used to re-qualify
    // that resolved name and probe the scoped key first, binding
    // `Teensy4__GPIO7Pins` and typing the register with a bitmap whose bit
    // names differ. By this point the two forms are byte-identical, which is
    // exactly why nothing below the ladder may qualify.
    // The `global.` branch returns the bare identifier.
    const result = generate(
      "Teensy4__",
      planned("GPIO7", "0x42004000", [
        member("PINS", "GPIO7Pins", "rw", "0x00", "GPIO7Pins"),
      ]),
    );

    expect(result.code).toContain("volatile GPIO7Pins*");
    expect(result.code).not.toContain("Teensy4__GPIO7Pins");
  });

  it("keeps original type when scoped bitmap does not exist", () => {
    const result = generate(
      "Teensy4__",
      planned("GPIO7", "0x42004000", [member("DATA", "u32", "rw", "0x00")]),
    );

    expect(result.code).toContain("volatile uint32_t*");
    expect(result.code).not.toContain("Teensy4__u32");
  });
});
