import { describe, expect, it } from "vitest";
import createMockSymbols from "../../../types/__testUtils__/codeGenSymbolsHelpers";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import NameExistence from "../NameExistence";
import SymbolTable from "../SymbolTable";

/**
 * A SymbolTable stub answering only `getOverloadsByCName`, which is the single
 * method NameExistence uses. Typed through the real class so a signature change
 * fails here rather than being absorbed by a cast.
 */
function tableWith(
  entries: ReadonlyArray<{ name: string; language: ESourceLanguage }>,
  opaque: ReadonlyArray<string> = [],
): SymbolTable {
  return {
    getOverloadsByCName: (name: string) =>
      entries
        .filter((e) => e.name === name)
        .map((e) => ({ sourceLanguage: e.language })),
    // #1511: opacity is asked of the table now, not of the per-file view --
    // `ICodeGenSymbols` carried a merged copy of the set only so this could be
    // read per file, and the merge is gone.
    isOpaqueType: (name: string) => opaque.includes(name),
  } as unknown as SymbolTable;
}

const EMPTY_TABLE = tableWith([]);
const SEES_ALL = (): boolean => true;

describe("NameExistence.isTypeName", () => {
  it("accepts an opaque type, which the table answers for", () => {
    // #1511: this used to be one row of the parameterized set above, reading
    // `ICodeGenSymbols.opaqueTypes`. That field was a per-file copy of a
    // whole-program fact, merged in by `mergeOpaqueTypes`; both are gone, and
    // the question is asked where the answer is derived.
    expect(
      NameExistence.isTypeName(
        "widget_t",
        createMockSymbols(),
        tableWith([], ["widget_t"]),
        SEES_ALL,
      ),
    ).toBe(true);
  });
  it.each([
    ["knownEnums", "EColor"],
    ["knownStructs", "Point"],
    ["knownBitmaps", "Flags"],
    ["knownScopes", "Motor"],
  ] as const)("accepts a name present in %s", (field, name) => {
    const symbols = createMockSymbols({ [field]: new Set([name]) });
    expect(NameExistence.isTypeName(name, symbols, EMPTY_TABLE, SEES_ALL)).toBe(
      true,
    );
  });

  it("accepts a function name, because ADR-029 makes it a callback type", () => {
    const symbols = createMockSymbols({
      functionReturnTypes: new Map([["onReceive", "void"]]),
    });
    expect(
      NameExistence.isTypeName("onReceive", symbols, EMPTY_TABLE, SEES_ALL),
    ).toBe(true);
  });

  it("rejects a name that is nowhere", () => {
    expect(
      NameExistence.isTypeName(
        "Mode",
        createMockSymbols(),
        EMPTY_TABLE,
        SEES_ALL,
      ),
    ).toBe(false);
  });

  describe("the cnx / foreign split (#1312)", () => {
    it("accepts a C symbol from the run-wide table", () => {
      const table = tableWith([{ name: "FILE", language: ESourceLanguage.C }]);
      expect(
        NameExistence.isTypeName("FILE", createMockSymbols(), table, SEES_ALL),
      ).toBe(true);
    });

    it("accepts a C++ symbol from the run-wide table", () => {
      const table = tableWith([
        { name: "Adafruit_MAX31856", language: ESourceLanguage.Cpp },
      ]);
      expect(
        NameExistence.isTypeName(
          "Adafruit_MAX31856",
          createMockSymbols(),
          table,
          SEES_ALL,
        ),
      ).toBe(true);
    });

    it("does NOT accept a cnx symbol from the run-wide table", () => {
      // The whole point of #1312: a sibling that was never included is still in
      // the run-wide table. Consulting it for a cnx name would answer "yes"
      // in the file that cannot see it, and the diagnostic would never fire.
      const table = tableWith([
        { name: "Mode", language: ESourceLanguage.Cnx },
      ]);
      expect(
        NameExistence.isTypeName("Mode", createMockSymbols(), table, SEES_ALL),
      ).toBe(false);
    });
  });
});

describe("the type / value position split (#1336)", () => {
  const withRegister = () =>
    createMockSymbols({ knownRegisters: new Set(["GPIO"]) });

  /**
   * The tripwire for ADR-111. While that ADR is `Research`, ADR-004 governs and
   * a register is not a type: `TYPE_FORMING_KINDS` excludes the `register` kind
   * for this reason, and `isTypeName` is the per-file view of the same
   * decision. It once disagreed, which is exactly how `Control c;` reached
   * codegen with no typedef behind it and the C compiler rejected the output at
   * exit 0.
   *
   * If ADR-111 is IMPLEMENTED this expectation inverts -- deliberately, in that
   * ADR's own work, together with E0429's retirement. It failing for any other
   * reason means the two answers have drifted apart again.
   */
  it("does NOT accept a register in a type position", () => {
    expect(
      NameExistence.isTypeName("GPIO", withRegister(), EMPTY_TABLE, SEES_ALL),
    ).toBe(false);
  });

  it("DOES accept a register in a value position", () => {
    // `GPIO.DR` reads a value at an address (ADR-004). The single predicate
    // that served both positions had to say yes here, and so wrongly said yes
    // above; removing registers outright instead broke ten register fixtures
    // with E0427.
    expect(
      NameExistence.isValueName("GPIO", withRegister(), EMPTY_TABLE, SEES_ALL),
    ).toBe(true);
  });

  it("accepts a type in a value position, as the base of Type.MEMBER", () => {
    const symbols = createMockSymbols({ knownEnums: new Set(["EColor"]) });
    expect(
      NameExistence.isValueName("EColor", symbols, EMPTY_TABLE, SEES_ALL),
    ).toBe(true);
  });

  it("rejects a name that is neither, in either position", () => {
    expect(
      NameExistence.isTypeName(
        "Nowhere",
        createMockSymbols(),
        EMPTY_TABLE,
        SEES_ALL,
      ),
    ).toBe(false);
    expect(
      NameExistence.isValueName(
        "Nowhere",
        createMockSymbols(),
        EMPTY_TABLE,
        SEES_ALL,
      ),
    ).toBe(false);
  });

  it("identifies a register by name", () => {
    expect(NameExistence.isRegisterName("GPIO", withRegister())).toBe(true);
    expect(NameExistence.isRegisterName("GPIO", createMockSymbols())).toBe(
      false,
    );
  });
});

describe("NameExistence.isKnownEnumMember", () => {
  it("finds a member of any known enum (ADR-017 bare member)", () => {
    const symbols = createMockSymbols({
      enumMembers: new Map([
        ["EStatus", new Map([["STATUS_IDLE", 0]])],
        ["EColor", new Map([["RED", 1]])],
      ]),
    });
    expect(NameExistence.isKnownEnumMember("RED", symbols)).toBe(true);
    expect(NameExistence.isKnownEnumMember("STATUS_IDLE", symbols)).toBe(true);
  });

  it("rejects a name that is no enum's member", () => {
    const symbols = createMockSymbols({
      enumMembers: new Map([["EColor", new Map([["RED", 1]])]]),
    });
    expect(NameExistence.isKnownEnumMember("BLUE", symbols)).toBe(false);
  });

  it("rejects when there are no enums at all", () => {
    expect(NameExistence.isKnownEnumMember("RED", createMockSymbols())).toBe(
      false,
    );
  });
});

describe("NameExistence: a header's names are the including file's (#1881)", () => {
  const table = tableWith([{ name: "dev_t", language: ESourceLanguage.C }]);

  it("accepts a C name the file sees", () => {
    expect(
      NameExistence.isTypeName("dev_t", createMockSymbols(), table, SEES_ALL),
    ).toBe(true);
  });

  it("rejects a C name whose header the file does not include itself", () => {
    expect(
      NameExistence.isTypeName(
        "dev_t",
        createMockSymbols(),
        table,
        () => false,
      ),
    ).toBe(false);
  });
});
