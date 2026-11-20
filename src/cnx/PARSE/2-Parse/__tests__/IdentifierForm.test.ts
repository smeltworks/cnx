/**
 * Unit tests for IdentifierForm
 * ADR-063 / Issue #1117: declared identifiers may not end with `_` or contain `__`
 */
import { describe, it, expect } from "vitest";
import CnxSourceParser from "../CnxSourceParser";

const VIOLATIONS: ReadonlyArray<[string, string]> = [
  ["cannot begin with", "reserved-prefix"],
  ["consecutive underscores", "consecutive"],
  ["cannot end with an underscore", "trailing"],
];

/**
 * E0201/E0202 as 1.2 reports them, with the code, name and violation read
 * back off the message the user sees (#1991).
 */
function analyze(source: string) {
  return CnxSourceParser.parse(source)
    .formErrors.filter((e) => /^error\[E020[12]\]/.test(e.message))
    .map((e) => ({
      ...e,
      code: /E020[12]/.exec(e.message)![0],
      identifierName: /Identifier '([^']+)'/.exec(e.message)![1],
      violation: VIOLATIONS.find((v) => e.message.includes(v[0]))![1],
    }));
}

describe("IdentifierForm (E0201, E0202)", () => {
  // ==========================================================================
  // Trailing underscore
  // ==========================================================================

  describe("trailing underscore", () => {
    it("rejects a global ending with an underscore", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0201");
      expect(errors[0].identifierName).toBe("value_");
      expect(errors[0].violation).toBe("trailing");
    });

    it("suggests the name without the trailing underscore", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors[0].helpText).toContain("'value'");
    });

    it("reports the identifier's own position, not the declaration's", () => {
      const errors = analyze(`u8 value_ <- 1;`);

      expect(errors[0].line).toBe(1);
      // "u8 " is 3 characters, so the identifier starts at column 3 (0-based)
      expect(errors[0].column).toBe(3);
    });
  });

  // ==========================================================================
  // Consecutive underscores
  // ==========================================================================

  describe("consecutive underscores", () => {
    it("rejects a global containing a double underscore", () => {
      const errors = analyze(`u8 my__value <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0201");
      expect(errors[0].violation).toBe("consecutive");
    });

    it("collapses the run when suggesting a replacement", () => {
      const errors = analyze(`u8 my___value <- 1;`);

      expect(errors[0].helpText).toContain("'my_value'");
    });

    it.each([
      [`u8 my__value_ <- 1;`, "my_value"],
      [`u8 a__b_ <- 1;`, "a_b"],
    ])(
      "suggests a name that itself satisfies the rule for %s",
      (code, expected) => {
        // An identifier can break both clauses at once. classifyIdentifier
        // reports "consecutive" first, so fixing only that would suggest a name
        // E0201 still rejects (e.g. 'my_value_').
        const errors = analyze(code);

        expect(errors[0].helpText).toContain(`'${expected}'`);
        expect(errors[0].helpText).not.toContain(`'${expected}_'`);
        // and the suggestion must be legal under the analyzer's own rule
        expect(analyze(`u8 ${expected} <- 1;`)).toHaveLength(0);
      },
    );

    it("classifies as consecutive when both rules are broken", () => {
      const errors = analyze(`u8 my__value_ <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].violation).toBe("consecutive");
    });
  });

  // ==========================================================================
  // Leading underscore stays legal (ADR-063)
  // ==========================================================================

  describe("leading underscore", () => {
    it("accepts a struct member with a leading underscore", () => {
      const errors = analyze(`
        struct Controller {
          u8 _handler;
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it("accepts a leading underscore on a global", () => {
      expect(analyze(`u8 _value <- 1;`)).toHaveLength(0);
    });

    it("still rejects a leading double underscore", () => {
      const errors = analyze(`u8 __value <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].violation).toBe("consecutive");
    });
  });

  // ==========================================================================
  // Legal identifiers
  // ==========================================================================

  describe("legal identifiers", () => {
    it.each([
      ["camelCase", `u8 tickCount <- 1;`],
      ["snake_case", `u8 tick_count <- 1;`],
      ["SCREAMING_SNAKE", `u8 CONTROL_REG <- 1;`],
      ["mixed with digits", `u8 uart2_baud1 <- 1;`],
      ["CMSIS handler name", `void SysTick_Handler() { }`],
    ])("accepts %s", (_label, code) => {
      expect(analyze(code)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Declaration coverage
  // ==========================================================================

  describe("declaration contexts", () => {
    it.each([
      ["scope name", `scope Bad_ { }`],
      ["function name", `void fn_() { }`],
      ["parameter", `void fn(u8 param_) { }`],
      ["local variable", `void fn() { u8 local_ <- 1; }`],
      [
        "for-loop variable",
        `void fn() { for (u8 i_ <- 0; i_ < 3; i_ +<- 1) { } }`,
      ],
      ["struct name", `struct Bad_ { u8 a; }`],
      ["struct member", `struct Good { u8 field_; }`],
      ["enum name", `enum Bad_ { A }`],
      ["enum member", `enum Good { A_ }`],
      ["bitmap name", `bitmap8 Bad_ { a[8] }`],
      ["bitmap member", `bitmap8 Good { a_[8] }`],
      [
        "register name",
        `register Bad_Layout { 0x00 rw u32 A, } Bad_Layout Bad_(0x1000);`,
      ],
      [
        "register member",
        `register GoodLayout { 0x00 rw u32 a_, } GoodLayout Good(0x1000);`,
      ],
    ])("flags a trailing underscore on a %s", (_label, code) => {
      const errors = analyze(code);

      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].code).toBe("E0201");
    });
  });

  // ==========================================================================
  // References are not checked (the C-interop carve-out)
  // ==========================================================================

  describe("references", () => {
    it("does not flag a call to an external symbol containing '__'", () => {
      const errors = analyze(`
        void fn() {
          __disable_irq();
        }
      `);

      expect(errors).toHaveLength(0);
    });

    it("does not flag a read of an external symbol containing '__'", () => {
      const errors = analyze(`
        void fn() {
          u8 x <- __builtin_value;
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Multiple violations
  // ==========================================================================

  describe("multiple violations", () => {
    it("reports every offending declaration", () => {
      const errors = analyze(`
        u8 first_ <- 1;
        u8 second__value <- 2;
        u8 fine <- 3;
      `);

      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.identifierName)).toEqual([
        "first_",
        "second__value",
      ]);
    });
  });

  // ==========================================================================
  // Reserved transpiler prefix (ADR-063 part 2, E0202)
  // ==========================================================================

  describe("reserved cnx_ prefix", () => {
    it("rejects a declaration carrying the prefix", () => {
      const errors = analyze(`u8 cnx_counter <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0202");
      expect(errors[0].identifierName).toBe("cnx_counter");
      expect(errors[0].violation).toBe("reserved-prefix");
    });

    // Include guards are uppercase by C convention while identifiers are not,
    // so one case-insensitive rule has to cover both spellings.
    it("is case-insensitive", () => {
      for (const name of ["CNX_LIMIT", "Cnx_state", "cNx_value"]) {
        const errors = analyze(`u8 ${name} <- 1;`);

        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe("E0202");
        expect(errors[0].identifierName).toBe(name);
      }
    });

    it("explains which prefix is reserved and why", () => {
      const errors = analyze(`u8 cnx_buffer <- 1;`);

      expect(errors[0].message).toContain("cannot begin with 'cnx_'");
      expect(errors[0].message).toContain("case-insensitively");
    });

    it("suggests the name with the reserved prefix removed", () => {
      const errors = analyze(`u8 cnx_buffer <- 1;`);

      expect(errors[0].helpText).toContain("buffer");
      expect(errors[0].helpText).not.toContain("cnx_buffer");
    });

    // Prefix-only: a prefix is all that is needed to keep the transpiler's
    // namespace and the user's disjoint, so that is all the rule constrains.
    it("allows the sequence anywhere but the start", () => {
      expect(analyze(`u8 my_cnx_buffer <- 1;`)).toHaveLength(0);
      expect(analyze(`u8 buffer_cnx <- 1;`)).toHaveLength(0);
    });

    it("allows an identifier that merely starts with the letters", () => {
      expect(analyze(`u8 cnxState <- 1;`)).toHaveLength(0);
    });

    // A name can break both rules at once. The reserved prefix is reported
    // because it is the more specific diagnosis, and the suggestion has to
    // repair BOTH — stripping only the prefix would leave `value_`, which
    // E0201 then rejects.
    it("reports the prefix first and still suggests a fully legal name", () => {
      const errors = analyze(`u8 cnx_value_ <- 1;`);

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0202");
      expect(errors[0].helpText).toContain("value");
      expect(errors[0].helpText).not.toMatch(/value_'/);
    });

    // References are deliberately unchecked, which is what lets a cnx file
    // call an external C symbol that happens to use the prefix (ADR-010).
    it("does not check references", () => {
      const errors = analyze(`
        u8 caller() {
            return cnx_external_thing();
        }
      `);

      expect(errors).toHaveLength(0);
    });
  });

  // #1991: a recovery tree can hold a declaration with no name, and its
  // spelling is not the source's, so form is not checked on it.
  describe("recovered trees", () => {
    it.each([
      `void f(u8 a_, ) { }`,
      `scope { }`,
      `struct S { u8 ; }`,
      `u8 f( { }`,
    ])("reports the parse error, not a crash, for %s", (code) => {
      const parsed = CnxSourceParser.parse(code);
      expect(parsed.parseErrors.length).toBeGreaterThan(0);
      expect(parsed.formErrors).toEqual([]);
    });
  });

  // #1991: the tree is sound, so the formatter (which reads parseErrors) must
  // still accept the file. The form errors come in source order (#2020
  // review): `value_` at 1:3 before `010` at 1:13.
  it("keeps form errors out of parseErrors", () => {
    const parsed = CnxSourceParser.parse(`u8 value_ <- 010;`);
    expect(parsed.parseErrors).toEqual([]);
    expect(parsed.formErrors.map((e) => e.message.slice(0, 11))).toEqual([
      "error[E0201",
      "error[E0912",
    ]);
  });
});
