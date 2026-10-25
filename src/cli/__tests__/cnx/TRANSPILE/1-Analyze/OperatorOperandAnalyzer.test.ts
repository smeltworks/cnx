/**
 * Unit tests for OperatorOperandAnalyzer
 * Tests detection of arithmetic, bitwise, shift and relational operators
 * applied to an essentially Boolean operand
 * (MISRA C:2012 Rule 10.1, Issue #1183).
 */
import { describe, it, expect } from "vitest";
import OperatorOperandAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/OperatorOperandAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import TestSourceSpan from "../../../../../cnx/types/__testUtils__/testSourceSpan";
import ESourceLanguage from "../../../../../cnx/utils/types/ESourceLanguage";

function analyze(source: string) {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new OperatorOperandAnalyzer(context).analyze(syntax);
}

/** Wrap a statement in a function with two bool locals and an integer local. */
function inMain(statement: string) {
  return `
    void main() {
      bool a <- true;
      bool b <- false;
      u8 n <- 1;
      ${statement}
    }
  `;
}

describe("OperatorOperandAnalyzer", () => {
  describe("bool operands of guarded operators (rejected)", () => {
    it.each([
      ["+", "bool c <- a + b;"],
      ["-", "bool c <- a - b;"],
      ["*", "bool c <- a * b;"],
      ["/", "bool c <- a / b;"],
      ["%", "bool c <- a % b;"],
    ])("rejects arithmetic operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
      expect(errors[0].message).toBe(
        `Operator '${operator}' is not valid on a bool operand`,
      );
    });

    it.each([
      ["&", "bool c <- a & b;"],
      ["|", "bool c <- a | b;"],
      ["^", "bool c <- a ^ b;"],
    ])("rejects bitwise operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    it.each([
      ["<<", "u8 c <- a << 1;"],
      [">>", "u8 c <- a >> 1;"],
    ])("rejects shift operator %s on a bool", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    // Boolean values are not ordered, so relational comparison is meaningless.
    it.each([
      ["<", "bool c <- (a < b);"],
      [">", "bool c <- (a > b);"],
      ["<=", "bool c <- (a <= b);"],
      [">=", "bool c <- (a >= b);"],
    ])("rejects relational operator %s on two bools", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    it.each([
      ["-", "i8 c <- -a;"],
      ["~", "bool c <- ~a;"],
    ])("rejects prefix operator %s on a bool", (operator, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain(`Operator '${operator}'`);
    });

    // Every shape a Boolean operand can take, each reported exactly once: the
    // count also pins that a two-bool operator reports per operator, not per
    // operand.
    it.each([
      ["a bool mixed with an integer operand", "u8 c <- a + n;"],
      ["a bool on the right-hand side of an integer", "u8 c <- n * a;"],
      ["true/false literal operands", "bool c <- true + false;"],
      ["a negation result used as an operand", "u8 c <- !a + n;"],
      ["a parenthesised bool operand", "u8 c <- (a) + n;"],
      ["both operands bool, reported once", "bool c <- a / b;"],
    ])("rejects %s", (_label, statement) => {
      const errors = analyze(inMain(statement));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    // Issue #1183 review: a comparison or logical result is a bool that no
    // declaration names. It is well-formed on its own, so the parent arithmetic
    // operator is the only place its misuse can be reported. `n / (a && b)`
    // reached the binary and died with SIGFPE.
    it.each([
      ["logical and", "u8 c <- n / (a && b);"],
      ["logical or", "u8 c <- n / (a || b);"],
      ["equality", "u8 c <- n / (a = b);"],
      ["relational", "u8 c <- n / (n < 2);"],
      ["negation", "u8 c <- n / !a;"],
      ["comparison as a left operand", "u8 c <- (n < 2) + n;"],
    ])(
      "rejects a bool-valued %s expression as an operand",
      (_label, statement) => {
        const errors = analyze(inMain(statement));
        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe("E0807");
      },
    );

    it("reports each offending operator in a chain", () => {
      const errors = analyze(inMain("bool c <- a + b + a;"));
      expect(errors).toHaveLength(2);
    });

    it("reports the position of the offending operand", () => {
      const errors = analyze(inMain("bool c <- a / b;"));
      expect(errors[0].span.line).toBeGreaterThan(0);
      expect(errors[0].span.column).toBeGreaterThanOrEqual(0);
    });

    it("carries help text naming the rule and the valid operators", () => {
      const errors = analyze(inMain("bool c <- a + b;"));
      expect(errors[0].helpText).toContain("Rule 10.1");
      expect(errors[0].helpText).toContain("&&");
    });
  });

  describe("operators that remain valid on a bool (accepted)", () => {
    it.each([
      ["logical and", "bool c <- a && b;"],
      ["logical or", "bool c <- a || b;"],
      ["negation", "bool c <- !a;"],
      ["equality", "bool c <- (a = b);"],
      ["inequality", "bool c <- (a != b);"],
      ["plain assignment", "a <- b;"],
      ["negating assignment", "a <- !a;"],
    ])("accepts %s", (_label, statement) => {
      expect(analyze(inMain(statement))).toHaveLength(0);
    });

    it("accepts a bool comparison as a controlling expression", () => {
      expect(analyze(inMain("if (a = true) { n <- 2; }"))).toHaveLength(0);
    });

    // The same shapes as a bool VALUE remain legal -- the operand position is
    // what is forbidden, not the expression itself.
    it.each([
      ["logical and", "bool c <- a && b;"],
      ["logical or", "bool c <- a || b;"],
      ["equality", "bool c <- (a = b);"],
      ["relational on integers", "bool c <- (n < 2);"],
      ["negation", "bool c <- !a;"],
    ])(
      "accepts a bool-valued %s expression as a value",
      (_label, statement) => {
        expect(analyze(inMain(statement))).toHaveLength(0);
      },
    );

    it("accepts arithmetic on integers", () => {
      expect(analyze(inMain("u8 c <- n + n;"))).toHaveLength(0);
    });

    it("accepts arithmetic on integers compared with a relational operator", () => {
      expect(analyze(inMain("bool c <- (n < 2);"))).toHaveLength(0);
    });
  });

  // Issue #1183 review: a compound assignment applies an operator the
  // expression grammar never expresses as a level, so neither the operator
  // levels nor a target-only check saw both halves.
  describe("compound assignment (Issue #1183 review)", () => {
    it("rejects a compound assignment to a bool target", () => {
      const errors = analyze(inMain("a +<- true;"));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0806");
      expect(errors[0].message).toContain("bool 'a'");
    });

    it.each(["+<-", "-<-", "*<-", "/<-", "&<-", "|<-", "^<-"])(
      "rejects compound operator %s on a bool target",
      (operator) => {
        const errors = analyze(inMain(`a ${operator} true;`));
        expect(errors).toHaveLength(1);
        expect(errors[0].code).toBe("E0806");
      },
    );

    it("rejects a bool on the right-hand side of a compound assignment", () => {
      const errors = analyze(inMain("n +<- a;"));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
      expect(errors[0].message).toContain("'+<-'");
    });

    it("matches the binary form it is equivalent to", () => {
      const compound = analyze(inMain("n +<- a;"));
      const binary = analyze(inMain("n <- n + a;"));
      expect(compound).toHaveLength(1);
      expect(binary).toHaveLength(1);
      expect(compound[0].code).toBe(binary[0].code);
    });

    it("accepts plain assignment to a bool", () => {
      expect(analyze(inMain("a <- true;"))).toHaveLength(0);
    });

    it("accepts a compound assignment between integers", () => {
      expect(analyze(inMain("n +<- 1;"))).toHaveLength(0);
    });

    it("names an array element target as written, so the fix can be pasted back", () => {
      const errors = analyze(`
        bool[2] flags;
        void main() { flags[0] +<- true; }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0806");
      expect(errors[0].message).toContain("'flags[0]'");
      expect(errors[0].helpText).toContain("flags[0] <- !flags[0]");
    });
  });

  // Issue #1183 review: an operand carrying a postfix op used to be classified
  // as not-Boolean, leaving the divide-by-zero hazard reachable.
  describe("postfix operands", () => {
    it("rejects arithmetic on a bool array element", () => {
      const errors = analyze(`
        bool[2] flags;
        void main() { u8 c <- flags[0] / flags[1]; }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("rejects arithmetic on a scope member reached through this", () => {
      const errors = analyze(`
        scope S {
          bool ready <- true;
          public u8 go() { return this.ready + 1; }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("treats this.member and the bare member the same way", () => {
      const qualified = analyze(`
        scope S {
          bool ready <- true;
          public u8 go() { return this.ready + 1; }
        }
      `);
      const bare = analyze(`
        scope S {
          bool ready <- true;
          public u8 go() { return ready + 1; }
        }
      `);
      expect(qualified).toHaveLength(bare.length);
    });

    // Audit: stripping every dimension at once is correct only for
    // a 1-D array. Each subscript must remove exactly one dimension.
    it.each([
      [
        "2-D fully indexed",
        "bool[2][3] flags;",
        "u8 c <- flags[0][1] / flags[1][2];",
      ],
      [
        "3-D fully indexed",
        "bool[2][3][4] flags;",
        "u8 c <- flags[0][1][2] + flags[1][2][3];",
      ],
    ])("rejects arithmetic on %s bool elements", (_label, decl, statement) => {
      const errors = analyze(`${decl}\nvoid main() { ${statement} }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("rejects a compound assignment to a 2-D bool element, naming it", () => {
      const errors = analyze(`
        bool[2][3] flags;
        void main() { flags[0][1] +<- true; }
      `);
      expect(errors[0].code).toBe("E0806");
      expect(errors[0].message).toContain("'flags[0][1]'");
    });

    it("reports a partially indexed bool array as an array, not a bool", () => {
      // flags[0] on a bool[2][3] is bool[3] -- an array, not a bool (#1191)
      const errors = analyze(`
        bool[2][3] flags;
        void main() { u8 c <- flags[0] / flags[1]; }
      `);
      expect(errors.map((e) => [e.code, e.message])).toEqual([
        ["E0925", "Operator '/' is not valid on an array operand"],
      ]);
    });

    it("does not flag an integer array element", () => {
      const errors = analyze(`
        u8[2] values;
        void main() { u8 c <- values[0] + values[1]; }
      `);
      expect(errors).toHaveLength(0);
    });

    it("rejects a compound assignment through this.member", () => {
      const errors = analyze(`
        scope S {
          bool ready <- true;
          public void go() { this.ready +<- true; }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0806");
    });

    it("rejects arithmetic on a global.member bool", () => {
      const errors = analyze(`
        bool ready <- true;
        scope S {
          public u8 go() { return global.ready + 1; }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("does not flag a subscript into a non-array bool", () => {
      // `flag[0]` is a bit index, not an element of a declared array type.
      const errors = analyze(inMain("u8 c <- a[0] + n;"));
      expect(errors).toHaveLength(0);
    });

    it("does not flag a member of an unknown struct type", () => {
      const errors = analyze(`
        void main() { u8 c <- unknown.field + 1; }
      `);
      expect(errors).toHaveLength(0);
    });

    it("rejects a ternary whose arms are bool", () => {
      const errors = analyze(inMain("u8 c <- n / ((n < 2) ? a : b);"));
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("accepts a ternary with integer arms", () => {
      expect(analyze(inMain("u8 c <- n / ((n < 5) ? 2 : 3);"))).toHaveLength(0);
    });

    it("does not flag a call whose return type is not bool", () => {
      const errors = analyze(`
        u8 get() { return 1; }
        void main() { u8 c <- get() + 1; }
      `);
      expect(errors).toHaveLength(0);
    });

    it("does not flag a call to an unknown function", () => {
      // Unresolvable stays permitted: rejecting what cannot be proven bool
      // would fail valid code that calls into C.
      const errors = analyze("void main() { u8 c <- unknownFn() + 1; }");
      expect(errors).toHaveLength(0);
    });
  });

  describe("scope resolution", () => {
    it("does not flag a same-named integer in another function", () => {
      const errors = analyze(`
        void first() {
          bool value <- true;
          bool other <- false;
          bool c <- value && other;
        }
        void second() {
          u8 value <- 1;
          u8 c <- value + 1;
        }
      `);
      expect(errors).toHaveLength(0);
    });

    it("resolves a bool shadowing an outer integer of the same name", () => {
      const errors = analyze(`
        void main() {
          u8 value <- 1;
          {
            bool value <- true;
            u8 c <- value + 1;
          }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0807");
    });

    it("flags a bool parameter used in arithmetic", () => {
      const errors = analyze(`
        void go(bool flag) {
          u8 c <- flag + 1;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("flags a global bool used in arithmetic inside a function", () => {
      const errors = analyze(`
        bool ready <- false;
        void main() {
          u8 c <- ready + 1;
        }
      `);
      expect(errors).toHaveLength(1);
    });

    it("returns no errors for a program with no bool operands", () => {
      expect(analyze("void main() { u8 c <- 1 + 2; }")).toHaveLength(0);
    });
  });
});

// #1991: read off 1.2's syntax, so which operand a report names is asserted
// by where it lands.
describe("OperatorOperandAnalyzer -- reports the bool operand", () => {
  const where = (line: string) => {
    const { syntax, context } = testAnalysisContextFor(
      `void main() {\n    bool f <- true;\n    u8 n <- 1;\n${line}\n}`,
      { cppMode: false },
    );
    return new OperatorOperandAnalyzer(context)
      .analyze(syntax)
      .map((e) => [e.code, e.span.line, e.span.column]);
  };

  it.each([
    ["on the left", "    u8 r <- f + n;", 12],
    ["on the right", "    u8 r <- n + f;", 16],
  ])("names the bool %s", (_side, line, column) => {
    expect(where(line)).toEqual([["E0807", 4, column]]);
  });
});

// #1191: each operator takes a set of operand types; anything else is E0925
describe("OperatorOperandAnalyzer -- operands outside the operator's set", () => {
  const PRELUDE = `
    enum EMode { IDLE, RUN }
    struct Point { u8 x; }
    bitmap8 Flags { a, b, c, d, e, f, g, h }
    Flags fl;
    u8[3] row;
    u8[2][3] grid;
    Point p;
    string<4> s <- "ab";
  `;
  const run = (body: string) =>
    analyze(
      `${PRELUDE} void main() { f32 k <- 1.5; EMode m <- EMode.RUN; u8 n <- 1; mut u8 t <- 0; ${body} }`,
    ).map((e) => [e.code, e.message]);

  it.each([
    ["a whole array", "u8 r <- row + 1;", "+", "an array operand"],
    [
      "a partly indexed array",
      "u8 r <- grid[0] + grid[1];",
      "+",
      "an array operand",
    ],
    ["a struct", "u8 r <- p + 1;", "+", "a struct operand"],
    ["a string under <", "bool r <- s < s;", "<", "a string operand"],
    ["a float under <<", "u32 r <- k << 1;", "<<", "a float operand"],
    ["a float under &", "u32 r <- k & 1;", "&", "a float operand"],
    ["a float under unary ~", "u32 r <- ~k;", "~", "a float operand"],
    ["a float as a shift amount", "u32 r <- 1 << k;", "<<", "a float operand"],
    ["an enum under +", "u8 r <- m + 1;", "+", "an enum operand"],
    ["a char literal under *", "u8 r <- n * 'A';", "*", "a char operand"],
    ["an array in a compound value", "t +<- row;", "+<-", "an array operand"],
  ])("rejects %s", (_label, body, operator, noun) => {
    expect(run(body)).toEqual([
      ["E0925", `Operator '${operator}' is not valid on ${noun}`],
    ]);
  });

  it.each([
    ["an element", "u8 r <- grid[0][1] + row[2];"],
    ["a field", "u8 r <- p.x + 1;"],
    ["a whole bitmap (ADR-034)", "u8 r <- fl + 1;"],
    ["string concatenation", "string<8> r <- s + s;"],
    ["float arithmetic", "f32 r <- k * 2.0;"],
    ["float comparison", "bool r <- k < 2.0;"],
    ["enum comparison", "bool r <- m < EMode.RUN;"],
    ["char plus an integer", "u8 r <- 'A' + n;"],
    ["a bit range", "u8 r <- n[0, 4] + 1;"],
    ["unsuffixed literals", "u8 r <- ~5 + (3 << 1);"],
  ])("takes %s", (_label, body) => {
    expect(run(body)).toEqual([]);
  });

  it("leaves a whole-array compound target to E0857", () => {
    expect(run("row +<- 1;")).toEqual([]);
  });

  it("takes an unsized string parameter under +, not under <", () => {
    const codes = (body: string) =>
      analyze(`void g(string p) { ${body} }`).map((e) => [e.code, e.message]);
    expect(codes('string<8> r <- p + "a";')).toEqual([]);
    expect(codes("bool r <- p < p;")).toEqual([
      ["E0925", "Operator '<' is not valid on a string operand"],
    ]);
  });

  it("leaves a cstring operand as it was (#2348)", () => {
    const errors = analyze(
      'mut string<8> h <- "ab"; void g() { cstring c <- h; cstring d <- c + 1; }',
    );
    expect(errors).toEqual([]);
  });

  it("reads a member of the enum being declared as an i32 (ADR-017)", () => {
    const errors = analyze(
      "enum EPerm { READ <- 1, WRITE <- 2, RW <- EPerm.READ | EPerm.WRITE }",
    );
    expect(errors).toEqual([]);
  });

  it.each([
    ["by its name", "RW <- Perm.READ | Perm.WRITE"],
    ["through this", "RW <- this.Perm.READ | this.Perm.WRITE"],
  ])(
    "reads a member of a scope's enum being declared as an i32, %s",
    (_label, member) => {
      const errors = analyze(
        `scope Motor { public enum Perm { READ <- 1, WRITE <- 2, ${member} } }`,
      );
      expect(errors).toEqual([]);
    },
  );

  it("leaves a C header enum as it was (#2352)", () => {
    const symbolTable = new SymbolTable();
    const at = {
      sourceFile: "api.h",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
    } as const;
    symbolTable.addCSymbol({
      kind: "type",
      name: "perm_t",
      type: "enum {P_READ,P_WRITE}",
      ...at,
    });
    symbolTable.addCSymbol({
      kind: "variable",
      name: "p",
      type: "perm_t",
      ...at,
    });
    const { syntax, context } = testAnalysisContextFor(
      "void main() { u32 a <- 1; u32 r <- a + p; u32 m <- p | 1; }",
      { cppMode: false, symbolTable },
    );
    expect(new OperatorOperandAnalyzer(context).analyze(syntax)).toEqual([]);
  });

  it.each([
    [
      "a ternary's array arm",
      "u8 r <- ((n = 1) ? row : row) + 1;",
      "+",
      "an array operand",
    ],
    [
      "a string literal under <",
      'bool r <- "ab" < "cd";',
      "<",
      "a string operand",
    ],
    [
      "a concatenation under <",
      "bool r <- (s + s) < s;",
      "<",
      "a string operand",
    ],
    [
      "an enum composite under +",
      "u8 r <- (m | m) + 1;",
      "|",
      "an enum operand",
    ],
  ])("rejects %s once (#2347 review)", (_label, body, operator, noun) => {
    expect(run(body)).toEqual([
      ["E0925", `Operator '${operator}' is not valid on ${noun}`],
    ]);
  });

  it.each([
    ["-row + 1", "u8 r <- -row + 1;"],
    ["~k & 1", "u32 r <- ~k & 1;"],
    ["n + row + n", "u8 r <- n + row + n;"],
  ])("reports %s once: one mistake, one place", (_label, body) => {
    expect(run(body)).toHaveLength(1);
  });

  it.each([
    ["a ternary's number arms", "u8 r <- ((n = 1) ? n : 2) + 1;"],
    ["a number composite", "u8 r <- (n + 1) * 2;"],
    ["concatenated literals", 'string<8> r <- "ab" + "cd";'],
    ["an enum compound target (#2264)", "mut EMode e <- EMode.IDLE; e +<- 1;"],
  ])("takes %s", (_label, body) => {
    expect(run(body)).toEqual([]);
  });

  it("reports a bool inside a composite once, as E0807", () => {
    const errors = analyze(
      inMain("u8 r <- (a + 1) * 2; mut u8 t <- 0; t +<- (a + 1);"),
    );
    expect(errors.map((e) => e.code)).toEqual(["E0807", "E0807"]);
  });

  it("judges a compound value before its target, as main does", () => {
    const errors = analyze(
      "enum EMode { IDLE } void main() { bool f <- true; mut EMode m <- EMode.IDLE; m +<- f; }",
    );
    expect(errors.map((e) => e.code)).toEqual(["E0807"]);
  });

  it("takes a combination of the enum being declared's members (ADR-017)", () => {
    const errors = analyze(
      "enum EPerm { READ <- 1, WRITE <- 2, ALL <- (EPerm.READ | EPerm.WRITE) + 1 }",
    );
    expect(errors).toEqual([]);
  });

  it("does not carry the enum being declared past it, with it declared last", () => {
    const errors = analyze(
      "void main() { mut u8 n <- 0; n +<- Perm.READ; } enum Perm { READ <- 1 }",
    );
    expect(errors.map((e) => e.code)).toEqual(["E0925"]);
  });

  it("still rejects another enum's member in a member value", () => {
    const errors = analyze(
      "enum EMode { IDLE, RUN } enum EPerm { READ <- 1, RW <- EMode.RUN | 2 }",
    );
    expect(errors.map((e) => e.code)).toEqual(["E0925"]);
  });
});
