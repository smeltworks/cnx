import ProgramLowering from "../../2-Parse/ProgramLowering";
import { beforeEach, describe, expect, it } from "vitest";
import parse from "../../3-Declare/cnx/__tests__/testHelpers";
import CnxResolver from "../../3-Declare/cnx/index";
import Program from "../Program";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ELEMENT_STEP from "../../../types/ELEMENT_STEP";
import type IProgram from "../../../types/IProgram";
import type TConstResult from "../../../types/TConstResult";
import type ICVariableSymbol from "../../../types/symbols/c/ICVariableSymbol";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";

/**
 * #1175: what a name in a constant expression is worth, asked as every pass
 * after 1.4 asks it -- `program.constantValueOf` -- of programs built from real
 * Declare output. One walk answers a scope's member, an enum's, a length
 * property through struct fields, and a name only a header may define.
 */

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

const FILE = "a.cnx";
/** At file scope, after every declaration a source here makes (#1643) */
const TOP = { line: 1000, column: 0, endLine: 1000, endColumn: 0 };

function build(
  source: string,
  reachesHeader = false,
  header: ReadonlyArray<TCSymbol> = [],
): IProgram {
  return Program.build(
    [
      CnxResolver.resolve(
        ProgramLowering.program(parse(source), null),
        FILE,
        registry,
      ),
    ],
    {
      cppMode: false,
      filesReachingForeignHeaders: new Set(reachesHeader ? [FILE] : []),
      // Scope bindings are the registry's, as in a real run
      registry,
      foreign: {
        c: header,
        cpp: [],
        opaqueTypedefs: new Set(),
        typedefToTag: new Map(),
        macros: new Map(),
        macrosUnread: new Set<string>(),
        integerTypes: new Map<string, string>(),
        structTagsWithBodies: new Set(),
      },
    },
  );
}

/** A variable a C header declares: `extern <type> <name><dims>;` */
function cVariable(
  name: string,
  type: string,
  arrayDimensions?: ReadonlyArray<number | string>,
): ICVariableSymbol {
  return {
    kind: "variable",
    name,
    type,
    sourceFile: "header.h",
    span: { line: 1, column: 0, endLine: 1, endColumn: 0 },
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    isArray: arrayDimensions !== undefined,
    arrayDimensions,
  };
}

function ask(
  program: IProgram,
  path: string[],
  options: { at?: { line: number; column: number }; root?: "this" } = {},
): TConstResult {
  return program.constantValueOf(FILE, {
    kind: "name",
    root: options.root ?? null,
    path,
    at: options.at
      ? {
          ...options.at,
          endLine: options.at.line,
          endColumn: options.at.column,
        }
      : TOP,
  });
}

/** A value as a number, or the reason there is none */
function answer(result: TConstResult): number | string {
  switch (result.kind) {
    case "value":
      return Number(result.value);
    case "notConstant":
      return result.reason;
    default:
      return result.kind;
  }
}

describe("ConstantNames, through program.constantValueOf (#1175)", () => {
  describe("a scope's member, named from outside it", () => {
    const SCOPE = `
scope Motor {
    public u8 MAX <- 4;
    public enum EMode { SLOW, FAST }
    public u8 speed() { return 1; }
}
u8 after;`;
    /** Where `after` is declared, below the scope: the scope is in view */
    const BELOW = { line: 7, column: 0 };

    it.each([
      ["a const", ["Motor", "MAX"], 4],
      ["an enum's member", ["Motor", "EMode", "FAST"], 1],
      ["a function, which has no value", ["Motor", "speed"], "function"],
      ["nothing the scope declares", ["Motor", "NOPE"], "undeclaredMember"],
      ["the scope itself", ["Motor"], "scope"],
    ])("answers %s", (_label, path, expected) => {
      expect(answer(ask(build(SCOPE), path, { at: BELOW }))).toBe(expected);
    });

    it("answers `this.EMode.M` inside the scope, as its own enum", () => {
      const program = build(`
scope Motor {
    enum EMode { SLOW, FAST }
    u8[4] buf;
}`);
      const inside = { line: 4, column: 4 };
      expect(
        answer(ask(program, ["EMode", "FAST"], { root: "this", at: inside })),
      ).toBe(1);
    });
  });

  describe("a length property (ADR-058), through struct fields", () => {
    const SOURCE = `
struct Packet {
    u8[6] data;
    u8 flag;
}
Packet pkt;
u16[3] words;
u8 lone;`;

    it.each([
      [
        "an array variable's type_element_count",
        ["words", "type_element_count"],
        3,
      ],
      ["an array variable's type_bit_length", ["words", "type_bit_length"], 48],
      [
        "a struct field's type_element_count",
        ["pkt", "data", "type_element_count"],
        6,
      ],
      [
        "a property of a field of an array",
        ["words", "data", "type_element_count"],
        "member",
      ],
      [
        "a field of a scalar field",
        ["pkt", "flag", "x", "type_element_count"],
        "member",
      ],
      [
        "a field the struct does not have",
        ["pkt", "nope", "type_element_count"],
        "member",
      ],
      ["a member that is not a length property", ["pkt", "data"], "member"],
    ])("answers %s", (_label, path, expected) => {
      expect(answer(ask(build(SOURCE), path))).toBe(expected);
    });

    it("answers a local array's element_count where the local is in view", () => {
      const program = build(`
void f() {
    mut u8[5] local;
    local[0] <- 1;
}`);
      const inFunction = { line: 4, column: 4 };
      expect(
        answer(
          ask(program, ["local", "type_element_count"], { at: inFunction }),
        ),
      ).toBe(5);
    });

    it.each([
      [
        "a struct's",
        ["pkt", "memory_byte_length"],
        "((uint32_t)sizeof(Packet))",
      ],
      [
        "a field's",
        ["pkt", "data", "memory_byte_length"],
        "((uint32_t)sizeof(uint8_t) * 6U)",
      ],
      [
        "an array's, in bits",
        ["words", "memory_bit_length"],
        "((uint32_t)sizeof(uint16_t) * 3U * 8U)",
      ],
      [
        "a primitive's",
        ["lone", "memory_byte_length"],
        "((uint32_t)sizeof(uint8_t))",
      ],
      [
        "a string buffer's, its \\0 included",
        ["names", "memory_byte_length"],
        "((uint32_t)9U * 2U)",
      ],
    ])(
      "leaves %s memory to the C compiler, as sizeof (ADR-058)",
      (_label, path, c) => {
        const result = ask(build(`${SOURCE}\nstring<8>[2] names;`), path);
        expect(result).toEqual({
          kind: "foreign",
          spelling: path.join("."),
          why: "target",
          c,
        });
      },
    );

    it.each([
      ["chars of a u8's memory", ["lone", "memory_char_count"]],
      ["elements of a u8", ["lone", "type_element_count"]],
    ])("leaves %s, which has no length, to E0867", (_label, path) => {
      const program = build(SOURCE);
      expect(answer(ask(program, path))).toBe("lengthRule");
    });

    it("has no value for an array a header macro sizes, which C alone knows", () => {
      const program = build(`u8[SOME_MACRO] buf;`, true);
      expect(answer(ask(program, ["buf", "type_element_count"]))).toBe(
        "unfolded",
      );
    });
  });

  describe("a type name as C spells it where it is written (#1863 review)", () => {
    const SOURCE = `
scope Motor {
    struct Config {
        u32 a;
    }
    u8[4] buf;
}
Motor.Config after;`;
    const INSIDE = { line: 6, column: 4 };
    const OUTSIDE = { line: 8, column: 0 };

    it.each([
      ["a primitive", "u32", INSIDE, "uint32_t"],
      // ADR-057: a bare name means the scope's own type inside the scope
      ["a scope's type, bare, inside it", "Config", INSIDE, "Motor__Config"],
      ["the same bare name outside it", "Config", OUTSIDE, "Config"],
      ["a `this.` type", "this.Config", INSIDE, "Motor__Config"],
      // #2116: the spelling 1.3 gave the `Motor.Config` the file writes
      ["a qualified type", "Motor.Config", OUTSIDE, "Motor__Config"],
      ["a `global.` type", "global.Config", INSIDE, "Config"],
    ])("names %s", (_label, typeName, at, expected) => {
      expect(build(SOURCE).cTypeNameAt(FILE, typeName, at)).toBe(expected);
    });
  });

  describe("a name a C header declares", () => {
    const HEADER: TCSymbol[] = [
      cVariable("table", "uint8_t", [10, 4]),
      cVariable("runtime_count", "uint32_t"),
      cVariable("macroSized", "uint8_t", ["N_ITEMS"]),
      {
        kind: "function",
        name: "get_count",
        type: "uint32_t",
        parameters: [],
        sourceFile: "header.h",
        span: { line: 1, column: 0, endLine: 1, endColumn: 0 },
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      },
      {
        kind: "enum_member",
        name: "COUNT",
        parent: "EColor",
        sourceFile: "header.h",
        span: { line: 1, column: 0, endLine: 1, endColumn: 0 },
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
      },
    ];
    const program = () => build("u8 x;", true, HEADER);

    it("is C's to evaluate as written, when it is a C enum constant", () => {
      expect(ask(program(), ["COUNT"])).toEqual({
        kind: "foreign",
        spelling: "COUNT",
        why: "header",
      });
    });

    // #1768, #1863 review: neither is a constant expression in C, so as a
    // dimension each would be a VLA
    it.each([
      ["a header variable", ["runtime_count"], "variable"],
      ["a header function", ["get_count"], "function"],
    ])("has no value for %s", (_label, path, expected) => {
      expect(answer(ask(program(), path))).toBe(expected);
    });

    it.each([
      ["an array's type_element_count", ["table", "type_element_count"], 10],
      [
        "an element's element_count",
        ["table", ELEMENT_STEP, "type_element_count"],
        4,
      ],
      [
        "a property a header macro sizes",
        ["macroSized", "type_element_count"],
        "unfolded",
      ],
      // The element's width is the target's to decide
      ["an array's type_bit_length", ["table", "type_bit_length"], "unfolded"],
      [
        "a header scalar's element_count",
        ["runtime_count", "type_element_count"],
        "lengthRule",
      ],
    ])("measures %s from its declared dimensions", (_label, path, expected) => {
      expect(answer(ask(program(), path))).toBe(expected);
    });
  });

  describe("a name nothing cnx declares", () => {
    it("may be a header macro in a file that includes a header", () => {
      const program = build(`u8 x;`, true);
      expect(ask(program, ["BUF_SIZE"])).toEqual({
        kind: "foreign",
        spelling: "BUF_SIZE",
        why: "maybeHeader",
      });
      // A macro is a bare name: C has no spelling of `X.y` to write for it
      expect(answer(ask(program, ["NotAnEnum", "MEMBER"]))).toBe("member");
    });

    it("is undeclared in a file that includes none, which E0427 reports", () => {
      const program = build(`u8 x;`);
      expect(answer(ask(program, ["BUF_SIZE"]))).toBe("unknown");
      expect(answer(ask(program, ["NotAnEnum", "MEMBER"]))).toBe("unknown");
    });

    it("is unknown for an empty path, which no source spells", () => {
      expect(answer(ask(build(`u8 x;`), []))).toBe("unknown");
    });
  });
});
