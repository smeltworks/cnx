/**
 * Unit tests for StringDeclHelper
 *
 * Issue #644: Tests for the extracted string declaration helper.
 * Migrated to use TranspileState instead of constructor DI.
 *
 * #1445 box 3: these took hand-built parse nodes -- `{ stringType: () => ({
 * INTEGER_LITERAL: () => ({ getText: () => "64" }) }) } as never` -- one per
 * case, 56 of them. The cast was load-bearing: it silenced the compiler about
 * a shape that was not a `TypeContext`, which also silenced it about the
 * helper's signature changing underneath. They are plain `TPlannedStringDecl`
 * values now, checked by the compiler, and the tree navigation they were
 * imitating is tested in VariableDeclHelper.test.ts where it now lives.
 */

import type TTypeInfo from "../../../../../types/TTypeInfo";
import { describe, it, expect, beforeEach, vi } from "vitest";
import StringDeclHelper from "../StringDeclHelper";
import TranspileState from "../../../../TranspileState";
import type IPlannedStringInit from "../../types/IPlannedStringInit";
import type IRenderedModifiers from "../../types/IRenderedModifiers";
import type TPlannedStringDecl from "../../types/TPlannedStringDecl";

const NO_MODS: IRenderedModifiers = {
  extern: "",
  const: "",
  atomic: "",
  volatile: "",
};

/**
 * A bounded string's initializer, defaulting every arm to "declines".
 * Each case overrides only the arm it is about, so a test that says nothing
 * about substrings cannot accidentally take that branch.
 */
function init(overrides: Partial<IPlannedStringInit> = {}): IPlannedStringInit {
  return {
    form: "literal",
    text: '""',
    render: () => '""',
    renderParts: () => [],
    ...overrides,
  };
}

/** The strings each case declares as initializer sources, by name */
const sourcesDeclared = new Map<string, TTypeInfo>();

function bounded(
  capacity: number,
  initializer: IPlannedStringInit | null = null,
): TPlannedStringDecl {
  return { kind: "bounded", capacity, init: initializer };
}

// #1322: the `asserts the invariant ...` cases below assert INVARIANTS, not
// diagnostics. ADR-045's declaration rules are E0862-E0866 in pass 2.1, which
// halts before codegen runs, so a declaration reaching this helper has already
// been checked. The assertion is the safety net for a DIVERGENCE between the
// two -- 2.1 accepting something this code cannot emit -- and these cases are
// what prove the net is there. Kept and re-aimed rather than deleted: they
// were the only coverage of these conditions, and an assertion nothing
// exercises is the guard-that-cannot-fail shape.
let state = new TranspileState();

describe("StringDeclHelper", () => {
  beforeEach(() => {
    sourcesDeclared.clear();
    state = new TranspileState();
    state.inFunctionBody = true;
    vi.clearAllMocks();
  });

  describe("bounded strings", () => {
    it("generates bounded string with literal initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(64, init({ text: '"Hello"', render: () => '"Hello"' })),
        "greeting",
        NO_MODS,
        false,
        state,
      );

      expect(code).toBe('char greeting[65] = "Hello";');
    });

    it("generates empty bounded string without initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(32),
        "buffer",
        NO_MODS,
        false,
        state,
      );

      expect(code).toBe('char buffer[33] = "";');
    });

    it("generates const bounded string", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, init({ text: '"Test"', render: () => '"Test"' })),
        "label",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toBe('const char label[11] = "Test";');
    });

    it("generates extern bounded string", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(16),
        "shared",
        { ...NO_MODS, extern: "extern " },
        false,
        state,
      );

      expect(code).toBe('extern char shared[17] = "";');
    });

    it("asserts the invariant for string literal exceeding capacity", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(5, init({ text: '"This is way too long"' })),
          "small",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string literal fits its declared capacity");
    });
  });

  // #1642: a bounded string WITH an initializer dropped atomic/volatile while
  // the header kept them -- `conflicting types`, in C and C++, exit 0. The
  // qualifiers have to reach every arm, so every arm is asserted rather than
  // the one that was reported.
  describe("atomic/volatile reach every bounded arm (#1164, #1642)", () => {
    const ATOMIC: IRenderedModifiers = { ...NO_MODS, atomic: "volatile " };

    it("carries them with no initializer", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          bounded(16),
          "s",
          ATOMIC,
          false,
          state,
        ),
      ).toBe('volatile char s[17] = "";');
    });

    it("carries them on the literal arm", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          bounded(16, init({ text: '"a"', render: () => '"a"' })),
          "s",
          ATOMIC,
          false,
          state,
        ),
      ).toBe('volatile char s[17] = "a";');
    });

    it("carries them on the copy arm", () => {
      sourcesDeclared.set("src", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        isString: true,
        stringCapacity: 8,
      });

      const code = StringDeclHelper.generateStringDecl(
        bounded(16, init({ form: "copy", text: "src", render: () => "src" })),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });

    it("never makes a read-only copy a C const array (ADR-071)", () => {
      sourcesDeclared.set("src", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        isString: true,
        stringCapacity: 8,
      });

      const code = StringDeclHelper.generateStringDecl(
        bounded(16, init({ form: "copy", text: "src", render: () => "src" })),
        "s",
        { ...NO_MODS, const: "const " },
        false,
        state,
      );

      // the copy fills it, so a `const` here does not compile.
      expect(code.split("\n")[0]).toBe('char s[17] = "";');
    });

    it("carries them on the concat arm", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            form: "concat",
            renderParts: () => [
              { kind: "whole", code: "a" },
              { kind: "whole", code: "b" },
            ],
          }),
        ),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });

    it("carries them on the substring arm", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            form: "substring",
            renderParts: () => [
              { kind: "substring", source: "src", start: "0", length: 3 },
            ],
          }),
        ),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });
  });

  // 2.2 planned the form (#1257). Rendering costs something -- either thunk
  // can request an include or queue a C++ temp into the enclosing block -- so
  // the arm not taken must raise no effect at all: these assert that its
  // thunk is never called, not merely that the right code comes out.
  describe("renders only the planned form", () => {
    it("does not render the initializer whole when it is a concatenation", () => {
      const render = vi.fn(() => "unused");

      StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            form: "concat",
            renderParts: () => [
              { kind: "whole", code: "a" },
              { kind: "whole", code: "b" },
            ],
            render,
          }),
        ),
        "s",
        NO_MODS,
        false,
        state,
      );

      expect(render).not.toHaveBeenCalled();
    });

    it("does not render parts when it is a literal", () => {
      const renderParts = vi.fn(() => []);

      StringDeclHelper.generateStringDecl(
        bounded(16, init({ text: '"x"', render: () => '"x"', renderParts })),
        "s",
        NO_MODS,
        false,
        state,
      );

      expect(renderParts).not.toHaveBeenCalled();
    });
  });

  describe("string variable assignment validation", () => {
    function declareSource(name: string, capacity: number): void {
      sourcesDeclared.set(name, {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        isString: true,
        stringCapacity: capacity,
      });
    }

    it("allows assignment when source capacity fits", () => {
      declareSource("src", 20);

      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ form: "copy", text: "src", render: () => "src" })),
        "dest",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain("char dest[51]");
      expect(code).toContain("cnx_string_copy(dest, src, 50U);");
    });

    it("does not indent continuation lines (the block emitter owns indentation) — Issue #1037", () => {
      declareSource("src", 20);

      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ form: "copy", text: "src", render: () => "src" })),
        "dest",
        NO_MODS,
        false,
        state,
      );

      for (const line of code.split("\n").slice(1)) {
        expect(line.startsWith(" ")).toBe(false);
      }
    });

    it("asserts the invariant for string variable initialization at global scope", () => {
      state.inFunctionBody = false;
      declareSource("src", 20);

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(50, init({ form: "copy", text: "src", render: () => "src" })),
          "dest",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });
  });

  describe("string concatenation", () => {
    const CONCAT: Partial<IPlannedStringInit> = {
      form: "concat",
      renderParts: () => [
        { kind: "whole", code: "first" },
        { kind: "whole", code: "second" },
      ],
    };

    it("generates concatenation code in function body", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init(CONCAT)),
        "full",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char full[51] = "";');
      expect(code).toContain("cnx_string_copy(full, first, 50U);");
      expect(code).toContain("strncat");
    });

    it("asserts the invariant for concatenation at global scope", () => {
      state.inFunctionBody = false;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(50, init(CONCAT)),
          "full",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });

    it("never makes a read-only concatenation a C const array (ADR-071)", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init(CONCAT)),
        "full",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      // strncpy/strncat fill it, so a `const` here does not compile.
      expect(code.split("\n")[0]).toBe('char full[51] = "";');
    });
  });

  describe("substring extraction", () => {
    function substring(
      overrides: Partial<{
        source: string;
        start: string;
        length: number;
      }> = {},
    ): IPlannedStringInit {
      const part = {
        source: "source",
        start: "0",
        length: 5,
        ...overrides,
      };
      return init({
        form: "substring",
        renderParts: () => [
          {
            kind: "substring",
            source: part.source,
            start: part.start,
            length: part.length,
          },
        ],
      });
    }

    it("generates substring extraction code in function body", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, substring()),
        "part",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char part[11] = "";');
      expect(code).toContain("cnx_string_copy(part, source + 0, 5U);");
    });

    it("asserts the invariant for substring at global scope", () => {
      state.inFunctionBody = false;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(10, substring()),
          "part",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });

    it("skips bounds check when start is not numeric", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, substring({ start: "offset", length: 10 })),
        "part",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char part[51] = "";');
    });

    it("never makes a read-only substring a C const array (ADR-071)", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, substring()),
        "part",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code.split("\n")[0]).toBe('char part[11] = "";');
    });
  });

  describe("unsized const strings", () => {
    it("generates unsized const string with literal initializer", () => {
      // #1642: `NO_MODS` cannot reach this arm -- an unsized string is read-only,
      // which E0862 enforces in 2.1 -- and passing it here is what let the arm
      // hardcode `const ` and drop `atomic`/`volatile` for years without a
      // test noticing. The realistic input carries the const the caller
      // resolved.
      const code = StringDeclHelper.generateStringDecl(
        { kind: "unsized", initText: '"Hello World"', declaredCapacity: 11 },
        "message",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toBe('const char message[12] = "Hello World";');
    });

    it("carries atomic and volatile onto the unsized arm (#1642)", () => {
      const code = StringDeclHelper.generateStringDecl(
        { kind: "unsized", initText: '"v"', declaredCapacity: 1 },
        "flag",
        { extern: "", const: "const ", atomic: "", volatile: "volatile " },
        true,
        state,
      );

      // The header derives the qualifier from the SYMBOL, so a definition
      // without it is `conflicting types` at the first translation unit that
      // includes its own header.
      expect(code).toBe('const volatile char flag[2] = "v";');
    });

    it("refuses a `mut` unsized string rather than emitting one", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: '"x"', declaredCapacity: 1 },
          "loose",
          NO_MODS,
          true,
          state,
        ),
      ).toThrow(/unsized string is read-only/);
    });

    it("asserts the invariant for a `mut` unsized string", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: '"x"', declaredCapacity: 1 },
          "bad",
          { ...NO_MODS, const: "const " },
          false,
          state,
        ),
      ).toThrow("a `mut` string states its capacity");
    });

    it("takes the capacity from the declaration, and asserts the literal agrees (#1664 box 3)", () => {
      // The `.h` is written from the capacity 1.3 counted; render counting
      // the literal again was a second derivation of the same fact.
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: '"abc"', declaredCapacity: 5 },
          "s",
          { ...NO_MODS, const: "const " },
          true,
          state,
        ),
      ).toThrow("1.3 counted 5 for 's' but the literal has 3 character(s)");
    });

    it("asserts the invariant for unsized const string without initializer", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: null, declaredCapacity: null },
          "bad",
          { ...NO_MODS, const: "const " },
          true,
          state,
        ),
      ).toThrow("an unsized const string has an initializer to infer from");
    });

    it("asserts the invariant for unsized const string with non-literal", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: "someVar", declaredCapacity: null },
          "bad",
          { ...NO_MODS, const: "const " },
          true,
          state,
        ),
      ).toThrow("an unsized const string infers from a LITERAL");
    });
  });

  describe("string arrays (Issue #1029)", () => {
    function array(
      overrides: Partial<Extract<TPlannedStringDecl, { kind: "array" }>> = {},
    ): TPlannedStringDecl {
      return {
        kind: "array",
        elementCapacity: 32,
        dimensions: "[4]",
        declaredSize: 4,
        renderInit: null,
        ...overrides,
      };
    }

    it("generates string array without initializer", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          array(),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toBe("char items[4][33] = {0};");
    });

    it("generates string array with initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 10,
          dimensions: "[2]",
          declaredSize: 2,
          renderInit: () => {
            state.lastArrayInitCount = 2;
            state.lastArrayFillValue = undefined;
            return '{"One", "Two"}';
          },
        }),
        "labels",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain("char labels[2][11]");
      expect(code).toContain('{"One", "Two"}');
    });

    it("carries trailing dimensions the planner already rendered", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          array({ elementCapacity: 10, dimensions: "[2][3]", declaredSize: 2 }),
          "matrix",
          NO_MODS,
          false,
          state,
        ),
      ).toBe("char matrix[2][3][11] = {0};");
    });

    it("validates element count matches declared size", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          array({
            elementCapacity: 10,
            declaredSize: 4,
            renderInit: () => {
              state.lastArrayInitCount = 2;
              state.lastArrayFillValue = undefined;
              return '{"One", "Two"}';
            },
          }),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow(
        "a string array initializer matches its declared size -- E0866 rejects [4] against 2 element(s)",
      );
    });

    it("asserts the invariant when the initializer is not a list", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          array({ renderInit: () => "other" }),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string array is initialized from literals");
    });

    // #2110: the walker expands a fill-all (ArrayInitHelper.fillAll); the
    // declaration emits the list as rendered.
    it("emits a fill-all's list as rendered", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 8,
          dimensions: "[3]",
          declaredSize: 3,
          renderInit: () => {
            state.lastArrayInitCount = 0;
            state.lastArrayFillValue = '"ab"';
            return '{"ab", "ab", "ab"}';
          },
        }),
        "filled",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('{"ab", "ab", "ab"}');
    });

    it("generates string array with modifiers", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({ elementCapacity: 8, dimensions: "[2]", declaredSize: 2 }),
        "data",
        {
          extern: "extern ",
          const: "const ",
          atomic: "",
          volatile: "volatile ",
        },
        true,
        state,
      );

      expect(code).toContain("extern const volatile char data[2][9]");
    });
  });
});
