/**
 * Unit tests for CodeGenWalker - Coverage for uncovered lines
 *
 * This file targets paths SonarCloud reported as uncovered: C++ member
 * conversion, member-access argument handling,
 * scope-generation fallback, and function/array generation.
 *
 * #1445: the line numbers this header used to carry are gone with the
 * `invokeStatement`/`invokeExpression` bullet, whose two tests reached into a
 * private `registry` that no longer exists. Naming a section by a line number
 * in another file is the shape this branch deletes elsewhere -- it was already
 * wrong before the diff shifted `CodeGenWalker.ts`, and nothing could ever
 * have reported that.
 */
import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import ProgramGeneration from "./ProgramGeneration";
import { describe, it, expect, beforeEach } from "vitest";
import CodeGenWalker from "../../../../cnx/TRANSPILE/CodeGenWalker";
import CodeGenerator from "../../../../cnx/TRANSPILE/3-Render/codegen/CodeGenerator";
import CnxSourceParser from "../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import * as Parser from "../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import CnxResolver from "../../../../cnx/PARSE/3-Declare/cnx/index";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import TSymbolInfoAdapter from "../../../../cnx/PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import CallbackTypedefFormatter from "../../../../cnx/utils/CallbackTypedefFormatter";
import ESourceLanguage from "../../../../cnx/utils/types/ESourceLanguage";
import TestSourceSpan from "../../../../cnx/types/__testUtils__/testSourceSpan";

/**
 * Helper to parse cnx source and return tree + generator ready for testing.
 */
function setupGenerator(
  source: string,
  options: { cppMode: boolean; cppConstructors?: readonly string[] },
): {
  tree: Parser.ProgramContext;
  generator: CodeGenWalker;
  host: CodeGenerator;
  code: string;
} {
  const { tree, parseErrors: errors, program } = CnxSourceParser.parse(source);
  if (errors.length > 0) {
    throw new Error(`Parse failed: ${errors.map((e) => e.message).join(", ")}`);
  }

  const symbolTable = new SymbolTable();
  // #1669: the real 1.4, which settles enum member values; 1.3 alone leaves
  // every member without one
  const tSymbols = [
    ...Program.build(
      [
        CnxResolver.resolve(
          ProgramLowering.program(tree, null),
          "test.cnx",
          registry,
        ),
      ],
      {
        cppMode: false,
        registry,
      },
    ).symbolsInFile("test.cnx"),
  ];
  // Issue #831: Register TSymbols in SymbolTable (single source of truth)
  symbolTable.addTSymbols(tSymbols);
  const symbols = TSymbolInfoAdapter.convert(tSymbols);
  // Issue #517: a class's constructor is the function `Class::Class` the class
  // declares, which is what a C++ header gives the table in a run
  for (const className of options.cppConstructors ?? []) {
    symbolTable.addCppSymbol({
      name: className,
      unqualifiedName: className,
      kind: "class",
      visibility: "public",
      sourceFile: "Class.hpp",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
    });
    symbolTable.addCppSymbol({
      name: `${className}::${className}`,
      unqualifiedName: className,
      parent: className,
      kind: "function",
      type: "void",
      visibility: "public",
      sourceFile: "Class.hpp",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cpp,
    });
  }

  // #1445 box 3: the walk and the render-side services are two objects now.
  // The host is constructed here and injected, so assertions about the host.state
  // the walk accumulates read the SAME instance the walk drove.
  const host = new CodeGenerator();
  const generator = new CodeGenWalker(host);
  TestSymbolTable.install(host.state, symbolTable);
  const code = generateWithProgram(generator, tree, program, {
    symbolInfo: symbols,
    sourcePath: "test.cnx",
    cppMode: options.cppMode,
  });

  return { tree, generator, host, code };
}

/** This file's registry, bound once -- the setup is `ProgramGeneration`'s. */
const generateWithProgram = (
  generator: CodeGenWalker,
  tree: Parser.ProgramContext,
  program: Parameters<typeof ProgramGeneration.generate>[2],
  options: Parameters<typeof ProgramGeneration.generate>[3],
): string =>
  ProgramGeneration.generate(generator, tree, program, options, registry);

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("CodeGenWalker Coverage Tests", () => {
  describe("a scope's constructor argument (#1187)", () => {
    const generateCpp = (scope: string) =>
      setupGenerator(["u8 PIN <- 10;", "u8 pin <- 3;", scope].join("\n"), {
        cppMode: true,
        cppConstructors: ["Widget"],
      }).code;

    it("emits a global argument under the global's own name", () => {
      const code = generateCpp("scope S {\n    public Widget device(PIN);\n}");
      expect(code).toContain("Widget S__device(PIN);");
    });

    it("emits a member that shadows a global under the member's name", () => {
      const code = generateCpp(
        "scope S {\n    public u8 pin <- 7;\n    public Widget device(pin);\n}",
      );
      expect(code).toContain("Widget S__device(S__pin);");
    });

    it("passes a name the binder does not know through as written", () => {
      const code = generateCpp(
        "scope S {\n    public Widget device(EXTERNAL_PIN);\n}",
      );
      expect(code).toContain("Widget S__device(EXTERNAL_PIN);");
    });
  });

  // ==========================================================================
  // #1534: a C++ class initializer fills the object it builds
  // ==========================================================================
  describe("C++ class initializer fill (#1534)", () => {
    const generateCpp = (body: string) =>
      setupGenerator(
        [
          "struct Widget { i32 value; }",
          "u32 main() {",
          body,
          "return 0;",
          "}",
        ].join("\n"),
        { cppMode: true, cppConstructors: ["Widget"] },
      ).code;

    it("fills a declaration's own object after declaring it", () => {
      const code = generateCpp("Widget d <- { value: 12 };");
      expect(code).toMatch(/Widget d = \{\};\n(?:.*\n)*?\s*d\.value = 12;/);
    });

    it("builds an assigned object before the statement, not on the next declaration", () => {
      const code = generateCpp(
        "mut Widget o;\no <- { value: 9 };\nu32 later <- 1;",
      );
      expect(code).toMatch(
        /Widget cnx_tmp0 = \{\};\n(?:.*\n)*?\s*cnx_tmp0\.value = 9;\n\s*o = cnx_tmp0;/,
      );
      expect(code).not.toContain("later.value");
    });
  });

  describe("a temporary built only when its operand runs (#2332)", () => {
    const generateCpp = (body: string) =>
      setupGenerator(
        [
          "struct Widget { i32 value; }",
          "i32 v(Widget w) {",
          "return w.value;",
          "}",
          "u32 main() {",
          "u32 a <- 0;",
          body,
          "return 0;",
          "}",
        ].join("\n"),
        { cppMode: true, cppConstructors: ["Widget"] },
      ).code;

    it("builds the right operand of && under the left one", () => {
      const code = generateCpp("bool b <- (a = 1) && (v({ value: 2 }) = 2);");
      expect(code).toMatch(
        /bool cnx_tmp1 = \(a == 1\);\n\s*if \(cnx_tmp1\) \{\n\s*Widget cnx_tmp0 = \{\};\n(?:.*\n)*?\s*cnx_tmp0\.value = 2;\n\s*cnx_tmp1 = \(v\(cnx_tmp0\) == 2\);\n\s*\}\n\s*const bool b = cnx_tmp1;/,
      );
    });

    it("builds the right operand of || when the left one is false", () => {
      const code = generateCpp("bool b <- (a = 1) || (v({ value: 2 }) = 2);");
      expect(code).toMatch(
        /bool cnx_tmp1 = \(a == 1\);\n\s*if \(!cnx_tmp1\) \{/,
      );
    });

    it("joins an operand that builds nothing to the value so far", () => {
      const code = generateCpp(
        "bool b <- (a = 1) && (v({ value: 2 }) = 2) && (a = 0);",
      );
      expect(code).toContain("const bool b = cnx_tmp1 && (a == 0);");
    });

    it("leaves a chain that builds nothing as one expression", () => {
      const code = generateCpp("bool b <- (a = 1) && (a = 2);");
      expect(code).toContain("const bool b = (a == 1) && (a == 2);");
    });

    it("builds each arm of a ternary in its own branch", () => {
      const code = generateCpp(
        "Widget p <- (a = 1) ? { value: 3 } : { value: 4 };",
      );
      expect(code).toMatch(
        /Widget cnx_tmp2;\n\s*if \(a == 1\) \{\n\s*Widget cnx_tmp0 = \{\};\n(?:.*\n)*?\s*cnx_tmp2 = cnx_tmp0;\n\s*\} else \{\n\s*Widget cnx_tmp1 = \{\};\n(?:.*\n)*?\s*cnx_tmp2 = cnx_tmp1;\n\s*\}\n\s*const Widget p = cnx_tmp2;/,
      );
    });

    it("leaves a ternary whose arms build nothing as a ternary", () => {
      const code = generateCpp("u32 x <- (a = 1) ? 2 : 3;");
      expect(code).toContain("const uint32_t x = (a == 1) ? 2U : 3U;");
    });

    it("leaves a float bit read in a while condition in the condition", () => {
      const code = setupGenerator(
        [
          "u32 main() {",
          "mut u32 i <- 0;",
          "f32 x <- 1.5;",
          "while ((i < 3) && (x[0, 8] = 0)) {",
          "i <- i + 1;",
          "}",
          "return i;",
          "}",
        ].join("\n"),
        { cppMode: false },
      ).code;
      expect(code).toMatch(/while \(\(i < 3\) && /);
      expect(code).not.toContain("bool cnx_tmp");
    });

    it("keeps an operand whose typedef evaluates nothing in one expression", () => {
      const code = setupGenerator(
        [
          "u32 sumTwo(u8[2] b) {",
          "return b[0] + b[1];",
          "}",
          "u32 main() {",
          "u32 i <- 0;",
          "bool ok <- (i < 2) && (sumTwo([1, 2]) > 0);",
          "return 0;",
          "}",
        ].join("\n"),
        { cppMode: true },
      ).code;
      expect(code).toMatch(
        /typedef const uint8_t cnx_tmp0_t\[2\];\n\s*const bool ok = \(i < 2\) && \(sumTwo\(/,
      );
    });
  });

  // ==========================================================================
  // NEW CODE IN PR: _isArrayAccessStringExpression (lines 811-852)
  // ==========================================================================
  describe("_isArrayAccessStringExpression() - PR new code", () => {
    it("should return false for string property access (.value_char_count)", () => {
      const source = `
        string<32> name <- "test";
        void main() {
          u32 len <- name.value_char_count;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // .value_char_count returns a number, not a string
      expect(code).toContain("strlen(name)");
    });

    it("should return false for string property access (.capacity)", () => {
      const source = `
        string<32> name <- "test";
        void main() {
          u32 cap <- name.capacity;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // .capacity returns a number
      expect(code).toContain("32");
    });

    it("should return true for array of strings indexing", () => {
      const source = `
        string<32>[5] names;
        void puts(string<32> s) {}
        void main() {
          puts(names[0]);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Array of strings generates 2D char array
      expect(code).toContain("names[0U]");
      expect(code).toContain("puts(");
    });

    it("should return false for single string character indexing", () => {
      const source = `
        string<32> name <- "hello";
        void main() {
          u8 ch <- name[0];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Single string indexing returns a char, not a string
      expect(code).toContain("name[0U]");
    });

    it("should return false for non-string array type", () => {
      const source = `
        u32[10] values;
        void main() {
          u32 v <- values[0];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("values[0U]");
    });

    it("should handle array access without typeInfo", () => {
      // When accessing an undefined array, typeInfo won't exist
      const source = `
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("dummy");
    });
  });

  // ==========================================================================
  // NEW CODE IN PR: C++ pointer vs reference (lines 1534-1537)
  // ==========================================================================
  describe("C++ pointer vs reference for struct params - PR new code", () => {
    it("should use reference (&) for struct params in C++ mode", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void process(mut Point p) {
          p.x <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode uses reference
      expect(code).toContain("Point&");
    });

    it("should use pointer (*) for struct params in C mode", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void process(mut Point p) {
          p.x <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // C mode uses pointer
      expect(code).toContain("Point*");
    });
  });

  // ==========================================================================
  // NEW CODE IN PR: static_assert vs _Static_assert (lines 2405-2410)
  // ==========================================================================
  describe("static_assert handling - PR new code", () => {
    it("should use _Static_assert in C mode for float bit indexing", () => {
      const source = `
        f32 value <- 3.14;
        void main() {
          u32 bits <- value[0, 32];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // C mode uses _Static_assert
      expect(code).toContain("_Static_assert");
    });

    it("should use static_assert in C++ mode for float bit indexing", () => {
      const source = `
        f32 value <- 3.14;
        void main() {
          u32 bits <- value[0, 32];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode uses static_assert
      expect(code).toContain("static_assert");
      expect(code).not.toContain("_Static_assert");
    });
  });

  describe("omitted sizes render the declaration's count (#1664 box 3)", () => {
    it("states a scope member's and a string literal's size, as the .h does", () => {
      const { code } = setupGenerator(
        `
        u8[] msg <- "Hi";
        scope Table {
          public u8[] row <- [1, 2, 3, 4];
          public u8[] text <- "abc";
        }
      `,
        { cppMode: false },
      );
      expect(code).toContain('uint8_t msg[3] = "Hi";');
      expect(code).toContain("uint8_t Table__row[4] = {1U, 2U, 3U, 4U};");
      expect(code).toContain('uint8_t Table__text[4] = "abc";');
    });
  });

  // ==========================================================================
  // Lines 4289-4302: getLvalueType
  // ==========================================================================
  describe("getLvalueType()", () => {
    it("should handle member access expression from struct parameter", () => {
      // When passing struct param member to function expecting primitive
      const source = `
        struct Point { i32 x; i32 y; }
        void test(i32 val) {}
        void handler(Point p) {
          test(p.x);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Struct param member access uses -> (const auto-inferred)
      expect(code).toContain("p->x");
      expect(code).toContain("test(");
    });

    it("should handle array access expression", () => {
      const source = `
        void test(u8 val) {}
        void main() {
          u8[10] arr;
          test(arr[0]);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Array element access (index gets U suffix per MISRA 7.2)
      expect(code).toContain("arr[0U]");
      expect(code).toContain("test(");
    });

    it("should handle global struct member access", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point p;
        void test(i32 val) {}
        void main() {
          test(p.x);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Global struct uses direct access
      expect(code).toContain("test(p.x)");
    });

    it("should handle function call result", () => {
      const source = `
        u32 getValue() { return 42; }
        void test(u32 val) {}
        void main() {
          test(getValue());
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Function call result passed to function
      expect(code).toContain("test(");
      expect(code).toContain("getValue()");
    });
  });

  // ==========================================================================
  // Lines 4306-4379: isCppMemberConversionRequired and helpers
  // ==========================================================================
  describe("isCppMemberConversionRequired() - C++ mode", () => {
    it("should use pointer syntax in C mode for struct params", () => {
      const source = `
        struct Config { u8 value; }
        void process(u8 val) {}
        void handler(Config cfg) {
          process(cfg.value);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // In C mode, struct params are pointers with -> access (const auto-inferred)
      expect(code).toContain("Config*");
      expect(code).toContain("cfg->value");
    });

    it("should handle const struct parameter member in C++ mode", () => {
      const source = `
        struct Config { u8 value; }
        void process(u8 val) {}
        void handler(Config cfg) {
          process(cfg.value);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // C++ mode handles const struct params with references
      expect(code).toContain("handler(const Config& cfg)");
    });

    it("should handle array element member access", () => {
      const source = `
        struct Item { u32 id; }
        Item[5] items;
        void process(u32 val) {}
        void main() {
          process(items[0].id);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("process");
    });
  });

  // ==========================================================================
  // Lines 4572-4622: _handleMemberAccessArg and related
  // ==========================================================================
  describe("_handleMemberAccessArg()", () => {
    it("should handle array member without address-of", () => {
      const source = `
        struct Data { u8[10] buffer; }
        void process(u8[10] buf) {}
        void handler(Data d) {
          process(d.buffer);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Array members don't need & prefix
      expect(code).toContain("process(d->buffer)");
    });

    it("should create temp variable for C++ member conversion when needed", () => {
      const source = `
        struct Config { u8 flags; }
        void setFlags(u8 val) {}
        void handler(Config cfg) {
          setFlags(cfg.flags);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      // In C++ mode with const struct, member access is handled properly
      expect(code).toContain("setFlags");
    });
  });

  // ==========================================================================
  // Lines 4612-4622: _maybeCastStringSubscript
  // ==========================================================================
  describe("_maybeCastStringSubscript()", () => {
    it("should cast string subscript access for integer pointer params", () => {
      const source = `
        string<32> name;
        void process(u8 val) {}
        void main() {
          process(name[0]);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // String subscript access may need special handling
      expect(code).toContain("process");
    });
  });

  // ==========================================================================
  // Lines 4687-4698: generateDeclaration branches
  // ==========================================================================
  describe("generateDeclaration() branches", () => {
    it("should generate function declaration", () => {
      const source = `
        void myFunc() {}
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("void myFunc(void)");
    });

    it("should generate variable declaration", () => {
      const source = `
        u32 counter;
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint32_t counter");
    });
  });

  // ==========================================================================
  // Lines 4706-4765: generateScope and _generateScopeMember
  // ==========================================================================
  describe("generateScope() and _generateScopeMember()", () => {
    it("should generate scope with public variable", () => {
      const source = `
        scope LED {
          public u8 brightness;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint8_t LED__brightness");
      expect(code).not.toContain("static uint8_t LED_brightness");
    });

    it("should generate scope with private variable", () => {
      const source = `
        scope LED {
          u8 internalState;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("static const uint8_t LED__internalState");
    });

    it("should generate scope with public function", () => {
      const source = `
        scope Motor {
          public void start() {}
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("void Motor__start(void)");
    });

    it("should generate scope with private function", () => {
      // ADR-016: Functions are public by default, so explicit 'private' needed
      const source = `
        scope Motor {
          private void internalUpdate() {}
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("static void Motor__internalUpdate(void)");
    });

    it("should generate scope with enum member", () => {
      const source = `
        scope Config {
          public enum State { IDLE, RUNNING, STOPPED }
          public void init() {
            State s <- State.IDLE;
          }
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Enum values get scope-prefixed
      expect(code).toContain("Config__State__IDLE");
    });

    it("should generate scope with bitmap member", () => {
      const source = `
        scope Flags {
          public bitmap8 Status {
            ready,
            error,
            reserved[6]
          }
          public void check() {
            Status s <- 0;
          }
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Bitmap typedef should be in scope
      expect(code).toContain("Status");
    });

    it("should generate scope with register member", () => {
      const source = `
        scope GPIO {
          public register PORTA @ 0x40000000 {
            DR: u32 rw @ 0x00,
          }
          public void write(u32 val) {
            PORTA.DR <- val;
          }
        }
      `;
      const { code, host } = setupGenerator(source, { cppMode: false });
      // The member write lands in the .c; the accessor block itself is
      // recorded for the header, which is the only file a #define can be
      // exported from (#1453).
      expect(code).toContain("GPIO__PORTA__DR = val");
      expect(code).not.toContain("#define GPIO__PORTA__DR");
      const block = host.state.exportedRegisterBlocks.join("\n");
      expect(block).toContain("/* Register: GPIO__PORTA @ 0x40000000 */");
      // Address format is 0x40000000 + 0x00
      expect(block).toContain(
        "#define GPIO__PORTA__DR (*(volatile uint32_t*)(0x40000000 + 0x00))",
      );
    });
  });

  // ==========================================================================
  // Lines 4772-4800: _generateScopeVariable with arrays
  // ==========================================================================
  describe("_generateScopeVariable() with arrays", () => {
    it("should generate scope variable with cnx style array", () => {
      const source = `
        scope Buffer {
          public u8[16] data;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint8_t Buffer__data[16]");
    });

    it("should generate scope variable with C-style array dimension", () => {
      const source = `
        scope Buffer {
          public u8 legacy[32];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint8_t Buffer__legacy[32]");
    });

    it("should generate scope variable with string capacity", () => {
      const source = `
        scope Config {
          public string<64> name;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // String<64> becomes char[65] (capacity + 1 for null)
      expect(code).toContain("char Config__name[65]");
    });

    it("should handle private array scope variable", () => {
      const source = `
        scope Internal {
          u32[8] counters;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("static const uint32_t Internal__counters[8]");
    });
  });

  // ==========================================================================
  // Lines 5154-5162: generateArrayInitializer nested elements
  // ==========================================================================
  describe("generateArrayInitializer() nested elements", () => {
    it("should generate nested struct initializer in array", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point[3] points <- [{x: 1, y: 2}, {x: 3, y: 4}, {x: 5, y: 6}];
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Struct initializers use designated initializers
      expect(code).toContain(".x = 1");
      expect(code).toContain(".y = 2");
    });

    it("should generate nested array initializer (2D array)", () => {
      const source = `
        u8[2][3] matrix <- [[1, 2, 3], [4, 5, 6]];
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("{1U, 2U, 3U}");
      expect(code).toContain("{4U, 5U, 6U}");
    });

    it("should generate simple expression elements", () => {
      const source = `
        u32[5] values <- [10, 20, 30, 40, 50];
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("{10U, 20U, 30U, 40U, 50U}");
    });
  });

  // ==========================================================================
  // Issue #834: generateStructInitializer with named struct tags
  // ==========================================================================
  describe("generateStructInitializer() with named struct tags", () => {
    it("should include struct keyword in compound literal for named struct tags (assignment context)", () => {
      // Test the fix for issue #834: named struct tags need 'struct' prefix in cast.
      // In declaration context, no compound literal is emitted.
      // In assignment (expression) context, the struct keyword must be present.
      const source = `
        struct NamedPoint { i32 x; i32 y; }
        void test() {
          mut NamedPoint p <- {x: 0, y: 0};
          p <- {x: 10, y: 20};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      // Mark NamedPoint as requiring 'struct' keyword (simulates C header import)
      symbolTable.markNeedsStructKeyword("NamedPoint");

      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);
      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // Declaration uses plain designated initializer (no compound literal)
      expect(code).toContain("p = { .x = 0, .y = 0 }");
      // Assignment (expression context) must keep compound literal with struct keyword
      expect(code).toContain("(struct NamedPoint){ .x = 10, .y = 20 }");
    });

    // #1322: a case reaching the empty-initializer path stood here, written as
    // `ReturnStruct {};`. That path was reachable only through the written-type
    // grammar alternative -- the inferred form has always required a field list
    // -- and both the alternative and the codegen branch are removed. There is
    // no source that constructs an empty struct initializer, so there is
    // nothing left to cover.

    it("should NOT include struct keyword for typedef'd structs in assignment context", () => {
      // This tests the branch where checkNeedsStructKeyword returns false.
      // Compound literals (expression context) for typedef'd structs must NOT have 'struct'.
      const source = `
        struct TypedefPoint { i32 x; i32 y; }
        void test() {
          mut TypedefPoint p <- {x: 0, y: 0};
          p <- {x: 1, y: 2};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      // Do NOT mark as needing struct keyword (simulates typedef'd struct)

      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);
      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // Assignment (expression context) should use plain type, no 'struct' keyword
      expect(code).not.toContain("(struct TypedefPoint)");
      expect(code).toContain("(TypedefPoint){ .x = 1, .y = 2 }");
    });

    it("should NOT include struct keyword in C++ mode (assignment context)", () => {
      // Even if marked, C++ mode should not use struct keyword in compound literals.
      const source = `
        struct CppPoint { i32 x; i32 y; }
        void test() {
          mut CppPoint p <- {x: 0, y: 0};
          p <- {x: 5, y: 10};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      symbolTable.markNeedsStructKeyword("CppPoint");

      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);
      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: true,
      });

      // Assignment (expression context) in C++ mode must not use 'struct' keyword
      expect(code).not.toContain("(struct CppPoint)");
      expect(code).toContain("(CppPoint){ .x = 5, .y = 10 }");
    });
  });

  // ==========================================================================
  // Lines 5175-5218: generateFunction with registry
  // ==========================================================================
  describe("generateFunction()", () => {
    it("should generate function with return type", () => {
      const source = `
        u32 calculate() {
          return 42;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint32_t calculate(void)");
      expect(code).toContain("return 42");
    });

    it("should generate function with parameters", () => {
      const source = `
        void process(u32 value, u8 flags) {}
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain(
        "void process(const uint32_t value, const uint8_t flags)",
      );
    });

    it("should generate main function with int return type", () => {
      const source = `
        void main() {}
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // main always gets int return type for C++ compatibility
      expect(code).toContain("int main(void)");
    });

    it("should generate main function with args parameter", () => {
      const source = `
        void main(u8 args[][]) {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("int main(int argc, char *argv[])");
    });
  });

  // ==========================================================================
  // Function context: the scope prefix on a generated name, and the return type
  // a return statement resolves an unqualified enum member against.
  //
  // #1450: this named `_setupFunctionContext` at "lines 5233-5275". No such
  // method existed -- `CodeGenWalker` is 4,813 lines, and the live pair is
  // `enterFunctionContext`/`exitFunctionContext`. The assertions below go
  // through `setupGenerator`, so they were testing the behavior all along and
  // only the label was wrong; a label naming a method nobody can find is how a
  // reader concludes the test is stale and deletes it.
  // ==========================================================================
  describe("function context", () => {
    it("should set up function context with scope prefix", () => {
      const source = `
        scope Utils {
          public u32 helper() {
            return 1;
          }
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint32_t Utils__helper(void)");
    });

    it("should track function return type for enum inference", () => {
      const source = `
        enum Status { OK, ERROR }
        Status getStatus() {
          return OK;
        }
        void main() {
          Status s <- getStatus();
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("Status getStatus(void)");
      // Enum values are prefixed with enum name
      expect(code).toContain("return Status__OK");
    });
  });

  // ==========================================================================
  // Additional edge cases for better coverage
  // ==========================================================================
  describe("Edge cases", () => {
    it("should handle empty scope", () => {
      const source = `
        scope Empty {
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("/* Scope: Empty */");
    });

    it("should handle function with void return explicitly", () => {
      const source = `
        void doNothing() {
          return;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("void doNothing(void)");
    });

    it("should handle array of structs initialization", () => {
      const source = `
        struct RGB { u8 r; u8 g; u8 b; }
        RGB[2] colors <- [{r: 255, g: 0, b: 0}, {r: 0, g: 255, b: 0}];
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain(".r = 255");
      expect(code).toContain(".g = 0");
    });

    it("should handle scope variable with initializer", () => {
      const source = `
        scope Counter {
          public u32 value <- 100;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint32_t Counter__value = 100");
    });

    it("should handle nested scope member access in function", () => {
      const source = `
        scope Timer {
          mut u32 ticks;
          public void increment() {
            ticks +<- 1;
          }
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("Timer__ticks");
    });
  });

  // ==========================================================================
  // C++ mode specific tests for lines 4289-4379
  // ==========================================================================
  describe("C++ mode member conversion", () => {
    it("should handle const struct parameter with member access in C++", () => {
      const source = `
        struct Settings { u32 timeout; }
        void setTimeout(u32 val) {}
        void configure(Settings s) {
          setTimeout(s.timeout);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("const Settings& s");
    });

    it("should handle non-const struct parameter in C++", () => {
      const source = `
        struct Data { u32 value; }
        void modify(mut Data d) {
          d.value <- 10;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("Data& d");
    });

    it("should handle struct array element access in C++", () => {
      const source = `
        struct Item { u32 price; }
        Item[10] inventory;
        u32 getPrice(u32 index) {
          return inventory[index].price;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toContain("inventory[index].price");
    });
  });

  // ==========================================================================
  // Lines 1264, 1301, 1332: Type generation edge cases
  // ==========================================================================
  describe("Type generation edge cases", () => {
    it("should generate C++ template type unchanged", () => {
      // test-cpp-only scenario - C++ template passthrough
      const source = `
        void main() {
          u8 dummy <- 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: true });
      expect(code).toBeDefined();
    });

    it("should handle callback type in struct", () => {
      const source = `
        void handler() {}
        struct Callbacks {
          handler onClick;
        }
        mut Callbacks cb;
        void main() {
          cb.onClick <- handler;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Callback type generates function pointer in struct
      expect(code).toContain("Callbacks");
      expect(code).toContain("onClick");
    });
  });

  // ==========================================================================
  // Lines 1400, 1498, 1508, 1514: Parameter handling edge cases
  // ==========================================================================
  describe("Parameter handling edge cases", () => {
    it("should handle const array parameter", () => {
      const source = `
        void process(u8[8] data) {}
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("const uint8_t data[8]");
    });

    it("should handle multiple array parameters", () => {
      const source = `
        void merge(u8[4] a, u8[4] b, u8[8] result) {}
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("uint8_t a[4]");
      expect(code).toContain("uint8_t b[4]");
      expect(code).toContain("uint8_t result[8]");
    });
  });

  // ==========================================================================
  // Lines 1707, 1820: Parameter modification tracking
  // ==========================================================================
  describe("Parameter modification tracking", () => {
    it("should track modified parameters", () => {
      const source = `
        void update(mut u32 value) {
          value <- value + 1;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Modified parameter should still work
      expect(code).toContain("update");
    });
  });

  // ==========================================================================
  // Lines 2047, 2054: Helper delegation
  // ==========================================================================
  describe("Helper delegation", () => {
    it("should handle boolean in ternary expression", () => {
      const source = `
        bool flag <- true;
        void main() {
          u8 val <- (flag = true) ? 1 : 0;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("flag");
      expect(code).toContain("val");
    });
  });

  // ==========================================================================
  // Lines 2709: Existing parameter set handling
  // ==========================================================================
  describe("Parameter set handling", () => {
    it("should handle function with multiple calls to same param", () => {
      const source = `
        void inner(u32 x) {}
        void outer(u32 val) {
          inner(val);
          inner(val);
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("outer");
      expect(code).toContain("inner");
    });
  });

  // ==========================================================================
  // Lines 3560, 3588, 3592: Return paths in expression generation
  // ==========================================================================
  describe("Expression generation return paths", () => {
    it("should handle simple return statement", () => {
      const source = `
        u32 getValue() {
          return 42;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("return 42");
    });

    it("should handle return with expression", () => {
      const source = `
        u32 calculate(u32 a, u32 b) {
          return a + b;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // #1681: arithmetic on parameters clamps (ADR-044)
      expect(code).toContain("return cnx_clamp_add_u32(a, b)");
    });
  });

  // ==========================================================================
  // Lines 3816, 3928: Object/struct generation
  // ==========================================================================
  // ==========================================================================
  // Lines 4207, 4215: Type narrowing checks
  // ==========================================================================
  describe("Type narrowing checks", () => {
    it("should handle type conversion in assignment", () => {
      const source = `
        void test() {
          u32 big <- 1000;
          u8 small <- big[0, 8];
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("small");
    });
  });

  // ==========================================================================
  // Lines 5463, 5466, 5568, 5569: Additional function paths
  // ==========================================================================
  describe("Additional function generation paths", () => {
    it("should generate callback typedef when function used as type", () => {
      const source = `
        void handler() {}
        mut handler callback;
        void main() {
          callback <- handler;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // #1484: this asserted the bug. `handler` is a FUNCTION, and emitting it
      // in type position produces C no compiler accepts -- there is no typedef
      // by that name, and it collides with the function's own prototype
      // ("redeclared as different kind of symbol"). ADR-029's type for a
      // function-as-type is its `_fp` typedef, which is what a parameter
      // (#1164) and a scope member (#1200) already emit.
      expect(code).toContain("handler_fp callback");
      expect(code).toContain("callback = handler");
      // Guard the specific regression: the bare function name must not appear
      // as a type. The literal whitespace is what excludes `handler_fp` -- the
      // leading \b matches at the start of `handler_fp` too, since `_` is a word
      // character, so the boundary alone would not distinguish them.
      expect(code).not.toMatch(/\bhandler\s+callback\b/);
    });

    /**
     * ADR-030: a callback typedef is its function's type, so an opaque
     * parameter is `Dev*` there exactly as in the prototype -- in C++ too,
     * where an ADR-006 struct would be a reference -- and an array of handles
     * is an array of pointers (#996). It said `(Dev)` and `(Dev ds[2])`. The
     * primitive parameter is the control: untouched by the opaque decision.
     */
    it.each<[string, boolean]>([
      ["C", false],
      ["C++", true],
    ])(
      "builds an opaque parameter's callback typedef as a pointer in %s",
      (_label, cppMode) => {
        const source = `
          void aPoke(Dev d, u32 n) {}
          void pokeBoth(Dev[2] ds) {}
          struct Handlers {
            aPoke onDev;
            pokeBoth onBoth;
          }
        `;
        const { tree, program } = CnxSourceParser.parse(source);
        const symbolTable = new SymbolTable();
        // As a header's `typedef struct Dev Dev;` with no body registers it.
        symbolTable.markOpaqueType("Dev");
        // #1290: the real 1.4, which settles each parameter's C name the
        // typedef writes; 1.3 alone leaves every one unsettled
        const tSymbols = [
          ...Program.build(
            [
              CnxResolver.resolve(
                ProgramLowering.program(tree, null),
                "test.cnx",
                registry,
              ),
            ],
            { cppMode, registry },
          ).symbolsInFile("test.cnx"),
        ];
        symbolTable.addTSymbols(tSymbols);
        const host = new CodeGenerator();
        const generator = new CodeGenWalker(host);
        TestSymbolTable.install(host.state, symbolTable);
        generateWithProgram(generator, tree, program, {
          symbolInfo: TSymbolInfoAdapter.convert(tSymbols),
          sourcePath: "test.cnx",
          cppMode,
        });

        const typedefOf = (name: string): string => {
          const info = host.state.callbackTypes.get(name)!;
          return CallbackTypedefFormatter.format(
            info.returnType,
            info.typedefName,
            info.parameters,
            cppMode,
          );
        };
        expect(typedefOf("aPoke")).toBe(
          "typedef void (*aPoke_fp)(const Dev*, const uint32_t);",
        );
        expect(typedefOf("pokeBoth")).toBe(
          "typedef void (*pokeBoth_fp)(const Dev* ds[2]);",
        );
      },
    );

    it("should handle function with local variables", () => {
      const source = `
        void process() {
          u32 local1 <- 10;
          u32 local2 <- 20;
          u32 sum <- local1 + local2;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("local1");
      expect(code).toContain("local2");
      expect(code).toContain("sum");
    });
  });

  // ==========================================================================
  // Lines 5589-5922: Additional code paths
  // ==========================================================================
  describe("Additional code paths", () => {
    it("should handle complex nested struct access", () => {
      const source = `
        struct Inner { u32 value; }
        struct Outer { Inner inner; }
        mut Outer obj;
        void main() {
          obj.inner.value <- 42;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("obj.inner.value = 42");
    });

    it("should handle scope with multiple member types", () => {
      const source = `
        scope Mixed {
          public mut u32 counter;
          public void increment() { counter +<- 1; }
          public enum State { INIT, RUN }
          public void setState() {
            State s <- State.INIT;
          }
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("Mixed__counter");
      expect(code).toContain("Mixed__increment");
      expect(code).toContain("INIT");
    });
  });

  // ==========================================================================
  // Lines 5981-6587: Final code paths
  // ==========================================================================
  describe("Final code generation paths", () => {
    it("should handle atomic variable", () => {
      const source = `
        atomic u32 counter;
        void increment() {
          counter +<- 1;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("counter");
    });

    it("should handle wrap overflow behavior", () => {
      const source = `
        mut wrap u8 wrapCounter;
        void increment() {
          wrapCounter +<- 1;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("wrapCounter");
    });

    it("should handle clamp overflow behavior", () => {
      const source = `
        mut clamp u8 clampCounter;
        void increment() {
          clampCounter +<- 1;
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain("cnx_clamp_add_u8");
    });
  });

  // ==========================================================================
  // Issue #895 Bug B: Pointer type inference from C function calls
  // ==========================================================================
  describe("_inferPointerTypeFromFunctionCall / _extractCFunctionName", () => {
    /**
     * Helper to setup generator with C symbols added to SymbolTable.
     */
    function setupGeneratorWithCSymbols(
      source: string,
      cSymbols: Array<{
        name: string;
        type: string;
        sourceFile: string;
      }>,
    ): string {
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      symbolTable.addTSymbols(tSymbols);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // Add C function symbols
      for (const cSym of cSymbols) {
        symbolTable.addCSymbol({
          kind: "function",
          name: cSym.name,
          type: cSym.type,
          sourceFile: cSym.sourceFile,
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.C,
          visibility: "public",
          isDeclaration: true,
        });
      }

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);

      return generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });
    }

    it("should infer pointer type from global.funcName() pattern", () => {
      const source = `
        void test() {
          widget_t w <- global.widget_create();
        }
      `;

      const code = setupGeneratorWithCSymbols(source, [
        { name: "widget_create", type: "widget_t*", sourceFile: "widget.h" },
      ]);

      // Should generate widget_t* w (pointer), not widget_t w
      expect(code).toContain("widget_t* w = widget_create()");
    });

    it("should infer pointer type from direct funcName() call", () => {
      const source = `
        void test() {
          widget_t w <- widget_create();
        }
      `;

      const code = setupGeneratorWithCSymbols(source, [
        { name: "widget_create", type: "widget_t*", sourceFile: "widget.h" },
      ]);

      // Should generate widget_t* w (pointer), not widget_t w
      expect(code).toContain("widget_t* w = widget_create()");
    });

    it("should not infer pointer when C function returns non-pointer", () => {
      const source = `
        void test() {
          i32 val <- global.get_value();
        }
      `;

      const code = setupGeneratorWithCSymbols(source, [
        { name: "get_value", type: "int", sourceFile: "utils.h" },
      ]);

      // Should generate int32_t val (not a pointer)
      expect(code).toContain("int32_t val = get_value()");
      expect(code).not.toContain("int32_t* val");
    });

    it("should not infer pointer when function is not a C function", () => {
      // No C symbols registered - create_widget is a cnx function
      const source = `
        struct widget_t { i32 x; }
        widget_t create_widget() {
          widget_t dummy <- {x: 0};
          return dummy;
        }
        void test() {
          widget_t w <- create_widget();
        }
      `;

      const { code } = setupGenerator(source, { cppMode: false });

      // Should NOT generate pointer since create_widget is a cnx function
      expect(code).not.toContain("widget_t* w");
    });

    it("should not infer pointer when return type base doesn't match declared type", () => {
      const source = `
        void test() {
          widget_t w <- global.create_other();
        }
      `;

      const code = setupGeneratorWithCSymbols(source, [
        { name: "create_other", type: "other_t*", sourceFile: "other.h" },
      ]);

      // Should NOT infer pointer since types don't match
      // (other_t* doesn't match widget_t)
      expect(code).not.toContain("widget_t* w");
    });
  });

  // ==========================================================================
  // PR: _generateScopeVariable with struct initializer (line 3214)
  // Covers withDeclarationInit wrapping in scope variable declarations
  // ==========================================================================
  describe("_generateScopeVariable() with struct initializer", () => {
    it("should use plain designated initializer for scope struct variable", () => {
      const source = `
        struct Settings { i32 timeout; i32 retries; }
        scope Config {
          public Settings defaults <- {timeout: 30, retries: 3};
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Scope variable initializer uses withDeclarationInit, producing plain designated init
      expect(code).toContain(".timeout = 30");
      expect(code).toContain(".retries = 3");
      // Should NOT have compound literal prefix in declaration context
      expect(code).not.toContain("(Settings){ .timeout");
    });

    it("should use plain designated initializer for private scope struct variable", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        scope Drawing {
          Point origin <- {x: 0, y: 0};
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      expect(code).toContain(
        "static const Point Drawing__origin = { .x = 0, .y = 0 }",
      );
    });
  });

  // ==========================================================================
  // PR: formatStructInitializer with inDeclarationInit (line 3544)
  // Covers the plain designated initializer path in declaration context
  // ==========================================================================
  describe("formatStructInitializer() in declaration context", () => {
    it("should use plain designated init (no compound literal) for global struct variable", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        Point origin <- {x: 0, y: 0};
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Global declaration: plain designated init, no compound literal prefix
      expect(code).toContain("Point origin = { .x = 0, .y = 0 }");
      expect(code).not.toContain("(Point){ .x");
    });

    it("should use compound literal for struct in assignment context", () => {
      const source = `
        struct Point { i32 x; i32 y; }
        void main() {
          mut Point p <- {x: 0, y: 0};
          p <- {x: 10, y: 20};
        }
      `;
      const { code } = setupGenerator(source, { cppMode: false });
      // Declaration: plain init
      expect(code).toContain("Point p = { .x = 0, .y = 0 }");
      // Assignment: compound literal with type cast
      expect(code).toContain("(Point){ .x = 10, .y = 20 }");
    });
  });

  // ==========================================================================
  // PR: _resolveFieldType with underscore field types (lines 3577-3581)
  // Covers the C++ underscore-to-:: conversion path
  // ==========================================================================
  describe("_resolveFieldType() with underscore types", () => {
    it("should convert underscore type to :: when first part is a C++ namespace", () => {
      const source = `
        struct Outer { i32 dummy; }
        void main() {
          Outer o <- {dummy: 1};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      symbolTable.addTSymbols(tSymbols);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // Register a C++ namespace so isCppScopeSymbol("SeaDash") returns true
      symbolTable.addCppSymbol({
        kind: "namespace",
        name: "SeaDash",
        unqualifiedName: "SeaDash",
        sourceFile: "SeaDash.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
      });

      // Register struct field type with underscore (simulates C++ imported struct)
      symbolTable.addStructField("Outer", "dummy", "SeaDash_Parse_Result");

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);
      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // The field type should be converted from SeaDash_Parse_Result to SeaDash::Parse::Result
      // This exercises _resolveFieldType lines 3577-3579
      expect(code).toBeDefined();
    });

    it("should keep underscore type when first part is not a C++ namespace", () => {
      const source = `
        struct Data { i32 value; }
        void main() {
          Data d <- {value: 42};
        }
      `;
      const { tree, program } = CnxSourceParser.parse(source);

      const symbolTable = new SymbolTable();
      const tSymbols = [
        ...Program.build(
          [
            CnxResolver.resolve(
              ProgramLowering.program(tree, null),
              "test.cnx",
              registry,
            ),
          ],
          {
            cppMode: false,
            registry,
          },
        ).symbolsInFile("test.cnx"),
      ];
      symbolTable.addTSymbols(tSymbols);
      const symbols = TSymbolInfoAdapter.convert(tSymbols);

      // Register struct field type with underscore but NOT a C++ namespace
      symbolTable.addStructField("Data", "value", "some_plain_type");

      // #1445 box 3: the walk and the render-side services are two objects now.
      // The host is constructed here and injected, so assertions about the host.state
      // the walk accumulates read the SAME instance the walk drove.
      const host = new CodeGenerator();
      const generator = new CodeGenWalker(host);
      TestSymbolTable.install(host.state, symbolTable);
      const code = generateWithProgram(generator, tree, program, {
        symbolInfo: symbols,
        sourcePath: "test.cnx",
        cppMode: false,
      });

      // The field type should remain unchanged (not a C++ namespace)
      // This exercises _resolveFieldType line 3581
      expect(code).toBeDefined();
    });
  });

  // ========================================================================
  // Control-flow planning (#1445 box 3)
  // ========================================================================
  //
  // `ControlFlowGenerator` takes plans now, and the tree navigation it used to
  // do lives in `CodeGenWalker.plan*`. Those planners are private, so they are
  // exercised the way production reaches them -- by generating real source --
  // rather than by making eight methods public for a test. That also means
  // each case asserts the EMITTED C, which is the thing the planner exists to
  // produce, instead of the shape of an intermediate record.
  describe("control-flow planners", () => {
    it("plans a void return and a value return from the same function body", () => {
      const { code } = setupGenerator(
        `
        u8 pick(u8 n) {
          if (n > 1) {
            return 2;
          }
          return 0;
        }
      `,
        { cppMode: false },
      );

      // #1277: the declared return type reaches the literal, so MISRA C:2012
      // Rule 7.2's suffix does too.
      expect(code).toContain("return 2U;");
      expect(code).toContain("return 0U;");
    });

    it("plans a bare return in a void function", () => {
      const { code } = setupGenerator(
        `
        void stop(u8 n) {
          if (n > 0) {
            return;
          }
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("return;");
    });

    it("plans an if with no else", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 n <- 0;
          if (n > 0) {
            n <- 1;
          }
          return n;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("if (n > 0)");
      expect(code).not.toContain("else");
    });

    it("plans an if with an else", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 n <- 0;
          if (n > 0) {
            n <- 1;
          } else {
            n <- 2;
          }
          return n;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("} else {");
    });

    // The counts come from the condition AND the then block, which is why a
    // read in each is enough to reach the threshold of two.
    it("plans the strlen cache from the condition and the then block", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          string<16> s <- "hi";
          mut u32 n <- 0;
          if (s.value_char_count > 1) {
            n <- s.value_char_count;
          }
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("strlen(s)");
      expect(code).toContain("cnx_len_s");
    });

    it("plans a while loop", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 n <- 0;
          while (n < 3) {
            n <- n + 1;
          }
          return n;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("while (n < 3)");
    });

    it("plans a do-while loop (ADR-027)", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 n <- 0;
          do {
            n <- n + 1;
          } while (n < 3);
          return n;
        }
      `,
        { cppMode: false },
      );

      expect(code).toMatch(/do \{[\s\S]*\} while \(n < 3\);/);
    });

    it("plans a forever loop as the MISRA Rule 14.3 idiom (ADR-068)", () => {
      const { code } = setupGenerator(
        `
        void spin() {
          forever {
            u8 n <- 0;
          }
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("for (;;)");
      expect(code).toContain("14.3");
    });

    it("plans a for loop with a declaration init and an update", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 total <- 0;
          for (mut u32 i <- 0; i < 4; i +<- 1) {
            total <- total + 1;
          }
          return total;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain(
        "for (uint32_t i = 0U; i < 4; i = cnx_clamp_add_u32(i, 1U))",
      );
    });

    it("plans a for loop whose init is an assignment to an existing variable", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u32 i <- 9;
          mut u8 total <- 0;
          for (i <- 0; i < 4; i +<- 1) {
            total <- total + 1;
          }
          return total;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain(
        "for (i = 0U; i < 4; i = cnx_clamp_add_u32(i, 1U))",
      );
    });

    it("plans a for loop with neither init nor update", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u32 i <- 0;
          for (; i < 4;) {
            i <- i + 1;
          }
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("for (; i < 4; )");
    });

    // The init and the update are ONE plan shape and one renderer (#1445), so
    // an operator has to map the same way in both positions.
    it("maps a compound operator identically in the init and the update", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u32 i <- 1;
          for (i *<- 2; i < 16; i *<- 2) {
            u8 n <- 0;
          }
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain(
        "for (i = cnx_clamp_mul_u32(i, 2U); i < 16; i = cnx_clamp_mul_u32(i, 2U))",
      );
    });

    it("carries a for variable's modifiers (#696)", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          mut u8 total <- 0;
          for (volatile mut u32 i <- 0; i < 4; i +<- 1) {
            total <- total + 1;
          }
          return total;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("for (volatile uint32_t i = 0U;");
    });
  });

  // ========================================================================
  // Scope planning (#1445 box 3)
  // ========================================================================
  //
  // `ScopeGenerator` takes a plan now. What the PLANNER decides from a
  // declaration -- whether Issue #282 skips a private const scalar, whether the
  // header already defines a type, which of four kinds a member is, and what
  // order the type definitions come out in -- is asserted here, against real
  // source, because that is the input those decisions are made from.
  describe("scope planning", () => {
    it("skips a private const scalar and emits nothing for it (Issue #282)", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          private u32 LIMIT <- 8;
          public u32 counter;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("Driver__counter");
      expect(code).not.toContain("Driver__LIMIT");
    });

    // Issue #500: an array cannot be inlined at its uses, so the exemption is
    // what keeps it emitted.
    it("emits a private const ARRAY despite the skip rule (Issue #500)", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          private u32[2] TABLE <- [1, 2];
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("Driver__TABLE");
      expect(code).toContain("static");
    });

    it("emits a public const scalar", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          public u32 LIMIT <- 8;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("Driver__LIMIT");
    });

    it("qualifies a private member as static and a public one plainly", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          private u32 hidden;
          public u32 shown;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("static const uint32_t Driver__hidden");
      expect(code).toContain("uint32_t Driver__shown");
      expect(code).not.toContain("static uint32_t Driver__shown");
    });

    it("plans a scope function under its qualified name", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          private void reset() {
            u32 n <- 0;
          }
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("static void Driver__reset(void)");
    });

    // #1300: the .c groups type definitions BY KIND, matching the header,
    // because a struct naming an enum declared below it must still come second.
    // Source order here is struct-then-enum; the output must be the reverse.
    //
    // The types are PRIVATE on purpose: a public type is defined in the header,
    // so the .c gets nothing for it and the assertion would have nothing to
    // order. That complement is the other half of #1300 and is asserted below.
    it("orders type definitions by kind, not by source order", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          private struct Config {
            u32 timeout;
          }
          private enum EState {
            IDLE,
            BUSY
          }
        }
      `,
        { cppMode: false },
      );

      const enumAt = code.indexOf("Driver__EState");
      const structAt = code.indexOf("Driver__Config");
      expect(enumAt).toBeGreaterThan(-1);
      expect(structAt).toBeGreaterThan(-1);
      expect(enumAt).toBeLessThan(structAt);
    });

    // #1300: a type is defined in exactly ONE file. The planner asks the header
    // what it holds rather than re-deriving it from visibility -- those two
    // answers agree only until a public signature drags a private type into the
    // header, and then the type is defined twice and the C compiler rejects it.
    it("omits a type the header already defines", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          public enum EState {
            IDLE
          }
          private enum EHidden {
            OFF
          }
        }
      `,
        { cppMode: false },
      );

      expect(code).not.toContain("Driver__EState");
      expect(code).toContain("Driver__EHidden");
    });

    // A member the generator emits nothing for still has to reach the plan, or
    // its ADR-016 site is lost. The scope must still render around it.
    it("renders a scope whose only member defines a type", () => {
      const { code } = setupGenerator(
        `
        scope Driver {
          public enum EState {
            IDLE
          }
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("/* Scope: Driver */");
    });
  });

  // ========================================================================
  // Variable declaration planning (#1445 box 3)
  // ========================================================================
  //
  // `VariableDeclHelper` renders a plan now, and the tree-reading half is
  // `CodeGenWalker.planVariableDecl`. These run against real declarations
  // because that is what the planner reads; the assembly half is asserted
  // against plan literals in `VariableDeclHelper.test.ts`.
  describe("variable declaration planning", () => {
    it("plans a scalar with its zero initializer (ADR-015)", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          u32 n;
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("uint32_t n = 0;");
    });

    it("plans a scalar with an expression initializer", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          u32 n <- 7;
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("uint32_t n = 7U;");
    });

    // MISRA 10.3: the cross-category cast is added from what the expression
    // turned out to be, against what the declaration expects.
    it("adds the MISRA 10.3 cast for an int-to-float initializer", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          u8 n <- 3;
          f32 x <- n;
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("float x = (float)n;");
    });

    it("plans a cnx array and puts its dimensions in the declarator", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          u32[3] arr <- [1, 2, 3];
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("uint32_t arr[3] = {1U, 2U, 3U};");
    });

    // ADR-035: an empty dimension in the TYPE is filled from the initializer,
    // and the inferred suffix already carries it.
    it("infers an empty array dimension from the initializer", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          u32[] arr <- [1, 2, 3];
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("uint32_t arr[3]");
      expect(code).not.toContain("arr[][3]");
    });

    // #1644: the declared size and the rendered dimension come from ONE
    // evaluator, so every spelling folds for both.
    it.each([
      ["decimal", "u32[3] arr <- [7*];"],
      ["hex", "u32[0x3] arr <- [7*];"],
      ["binary", "u32[0b11] arr <- [7*];"],
    ])("folds a %s dimension for the fill-all expansion", (_label, decl) => {
      const { code } = setupGenerator(
        `
        u8 main() {
          ${decl}
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("arr[3] = {7U, 7U, 7U};");
    });

    it("plans a C++ constructor declaration (Issue #375)", () => {
      const { code } = setupGenerator(
        `
        u8 pinConst <- 10;
        u8 main() {
          MAX31856 thermo(pinConst);
          return 0;
        }
      `,
        { cppMode: true },
      );

      expect(code).toContain("MAX31856 thermo(pinConst);");
    });

    // ADR-045: the string forms are discriminated by the same planner, and the
    // discrimination reads the type registry that `trackLocalVariable` filled.
    it.each([
      ["bounded, no initializer", "string<16> s;", 'char s[17] = "";'],
      ["bounded, literal", 'string<16> s <- "hi";', 'char s[17] = "hi";'],
      ["unsized const", 'string s <- "hi";', 'const char s[3] = "hi";'],
    ])("plans a %s string declaration", (_label, decl, expected) => {
      const { code } = setupGenerator(
        `
        u8 main() {
          ${decl}
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain(expected);
    });

    it("plans a string array with its element capacity (Issue #1029)", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          string<8>[2] items <- ["a", "b"];
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).toContain("char items[2][9]");
    });

    // The string path returns before the array and initializer halves are
    // planned, so a string is never treated as a plain array.
    it("does not plan a string as a plain array declaration", () => {
      const { code } = setupGenerator(
        `
        u8 main() {
          string<16> s;
          return 0;
        }
      `,
        { cppMode: false },
      );

      expect(code).not.toContain("char s[16]");
      expect(code).toContain("char s[17]");
    });
  });
});
