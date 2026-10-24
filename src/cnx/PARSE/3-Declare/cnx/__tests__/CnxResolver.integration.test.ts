import ProgramLowering from "../../../2-Parse/ProgramLowering";
import { beforeEach, describe, expect, it } from "vitest";
import parse from "./testHelpers";
import CnxResolver from "../index";
import Program from "../../../4-Resolve/Program";
import SymbolGuards from "../../../../types/symbols/SymbolGuards";
import SymbolRegistry from "../../SymbolRegistry";
import TypeResolver from "../../../../utils/TypeResolver";
import ConstExprShape from "../../../../utils/__testUtils__/ConstExprShape";
import UNRESOLVED_DIMENSION from "../../../../types/UNRESOLVED_DIMENSION";

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("CnxResolver Integration", () => {
  // CLAUDE.md, "Test isolation": CnxResolver writes to the SymbolRegistry, so
  // without this every test in this file inherits the scopes the previous one
  // registered.

  describe("single declaration types", () => {
    it("resolves top-level struct", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isStruct(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("Point");
    });

    it("resolves top-level enum", () => {
      const code = `
        enum Color {
          Red,
          Green,
          Blue
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isEnum(symbols[0])).toBe(true);
    });

    it("resolves top-level function", () => {
      const code = `
        void main() {
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isFunction(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("main");
    });

    it("resolves top-level variable", () => {
      const code = `
        u32 counter <- 0;
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isVariable(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("counter");
    });

    it("resolves a top-level constructor declaration as a variable", () => {
      const code = `
        u8 pin <- 10;
        Sensor probe(pin);
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols.map((symbol) => [symbol.kind, symbol.name])).toEqual([
        ["variable", "pin"],
        ["variable", "probe"],
      ]);
    });

    it("resolves top-level bitmap", () => {
      const code = `
        bitmap8 Flags {
          enabled,
          ready,
          error,
          reserved[5]
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isBitmap(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("Flags");
    });

    it("resolves top-level register", () => {
      const code = `
        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(1);
      expect(SymbolGuards.isRegister(symbols[0])).toBe(true);
      expect(symbols[0].name).toBe("GPIO");
    });
  });

  describe("scope handling", () => {
    it("resolves scope with members", () => {
      // ADR-016: Functions are public by default, variables are private by default
      const code = `
        scope Motor {
          u32 position;

          void init() {
          }

          private void update() {
          }
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Scope + 3 members
      expect(symbols).toHaveLength(4);

      const scope = symbols.find((s) => s.name === "Motor");
      expect(scope).toBeDefined();
      expect(SymbolGuards.isScope(scope!)).toBe(true);

      // Members now have bare names with scope references
      const positionVar = symbols.find((s) => s.name === "position");
      expect(positionVar).toBeDefined();
      expect(SymbolGuards.isVariable(positionVar!)).toBe(true);
      expect(positionVar!.scopePath).toBe("Motor");

      // init() is public by default (no modifier needed)
      const initFunc = symbols.find((s) => s.name === "init");
      expect(initFunc).toBeDefined();
      if (SymbolGuards.isFunction(initFunc!)) {
        expect(initFunc.visibility).toBe("public");
        expect(initFunc.scopePath).toBe("Motor");
      }

      // update() has explicit 'private' keyword
      const updateFunc = symbols.find((s) => s.name === "update");
      expect(updateFunc).toBeDefined();
      if (SymbolGuards.isFunction(updateFunc!)) {
        expect(updateFunc.visibility).toBe("private");
        expect(updateFunc.scopePath).toBe("Motor");
      }
    });

    it("resolves scope with nested types", () => {
      const code = `
        scope Motor {
          enum State {
            Off,
            On
          }

          struct Config {
            u32 maxSpeed;
          }
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Scope + enum + struct
      expect(symbols).toHaveLength(3);

      // Nested types have bare names with scope references
      const enumSym = symbols.find((s) => s.name === "State");
      expect(enumSym).toBeDefined();
      expect(SymbolGuards.isEnum(enumSym!)).toBe(true);
      expect(enumSym!.scopePath).toBe("Motor");

      const structSym = symbols.find((s) => s.name === "Config");
      expect(structSym).toBeDefined();
      expect(SymbolGuards.isStruct(structSym!)).toBe(true);
      expect(structSym!.scopePath).toBe("Motor");
    });
  });

  describe("bitmaps and registers", () => {
    it("collects bitmaps before registers reference them", () => {
      const code = `
        bitmap8 StatusFlags {
          enabled,
          running,
          error,
          reserved[5]
        }

        register GPIO @ 0x40000000 {
          STATUS: StatusFlags rw @ 0x00,
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toHaveLength(2);

      const regSymbol = symbols.find((s) => s.name === "GPIO");
      expect(regSymbol).toBeDefined();
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(
          TypeResolver.getTypeName(regSymbol.members.get("STATUS")!.type),
        ).toBe("StatusFlags");
      }
    });

    it("handles scoped bitmaps referenced by scoped registers", () => {
      const code = `
        scope Motor {
          bitmap8 CtrlFlags {
            enabled,
            running,
            error,
            reserved[5]
          }

          register CTRL @ 0x40001000 {
            FLAGS: CtrlFlags rw @ 0x00,
          }
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Scope + bitmap + register
      expect(symbols).toHaveLength(3);

      // Both bitmap and register have bare names with scope references
      const regSymbol = symbols.find((s) => s.name === "CTRL");
      expect(regSymbol).toBeDefined();
      expect(regSymbol!.scopePath).toBe("Motor");
      if (SymbolGuards.isRegister(regSymbol!)) {
        expect(
          TypeResolver.getTypeName(regSymbol.members.get("FLAGS")!.type),
        ).toBe("Motor__CtrlFlags");
      }
    });
  });

  describe("source order (#1332)", () => {
    // The header defines structs in the order their symbols come out here, so
    // that order must be the source order: ADR-030 (define before use) makes it
    // the one order in which every struct follows the types its fields name.
    it("returns scope structs and top-level structs in source order", () => {
      const code = `
        struct Config {
          u32 x;
        }
        scope S {
          public struct Holder {
            Config c;
          }
        }
        struct Top {
          S.Holder h;
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      const structNames = symbols
        .filter((s) => SymbolGuards.isStruct(s))
        .map((s) => s.cnxScopedName);
      expect(structNames).toEqual(["Config", "S.Holder", "Top"]);
    });
  });

  describe("complex programs", () => {
    it("resolves a complete embedded program", () => {
      const code = `
        struct Point {
          i32 x;
          i32 y;
        }

        enum Direction {
          North,
          East,
          South,
          West
        }

        bitmap8 Status {
          active,
          error,
          reserved[6]
        }

        register GPIO @ 0x40000000 {
          DATA: u32 rw @ 0x00,
          DIR:  u32 rw @ 0x04,
        }

        scope Motor {
          u32 position;
          Direction direction;

          public void init() {
          }

          public void move(i32 distance) {
          }
        }

        void main() {
          Motor.init();
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Count symbols:
      // 1 struct (Point)
      // 1 enum (Direction)
      // 1 bitmap (Status)
      // 1 register (GPIO)
      // 1 scope (Motor)
      // 2 scope variables (position, direction)
      // 2 scope functions (init, move)
      // 1 top-level function (main)
      // Total: 10
      expect(symbols).toHaveLength(10);

      // Verify each type is present
      const structSymbols = symbols.filter((s) => s.kind === "struct");
      expect(structSymbols).toHaveLength(1);

      const enumSymbols = symbols.filter((s) => s.kind === "enum");
      expect(enumSymbols).toHaveLength(1);

      const bitmapSymbols = symbols.filter((s) => s.kind === "bitmap");
      expect(bitmapSymbols).toHaveLength(1);

      const registerSymbols = symbols.filter((s) => s.kind === "register");
      expect(registerSymbols).toHaveLength(1);

      const scopeSymbols = symbols.filter((s) => s.kind === "scope");
      expect(scopeSymbols).toHaveLength(1);

      const functionSymbols = symbols.filter((s) => s.kind === "function");
      expect(functionSymbols).toHaveLength(3);

      const variableSymbols = symbols.filter((s) => s.kind === "variable");
      expect(variableSymbols).toHaveLength(2);
    });

    it("resolves multiple scopes", () => {
      const code = `
        scope LED {
          public void on() {
          }

          public void off() {
          }
        }

        scope Motor {
          public void start() {
          }

          public void stop() {
          }
        }
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // 2 scopes + 2 functions each = 6
      expect(symbols).toHaveLength(6);

      const ledScope = symbols.find((s) => s.name === "LED");
      const motorScope = symbols.find((s) => s.name === "Motor");
      expect(ledScope).toBeDefined();
      expect(motorScope).toBeDefined();

      // Functions have bare names with scope references
      const onFunc = symbols.find((s) => s.name === "on");
      expect(onFunc).toBeDefined();
      expect(onFunc!.scopePath).toBe("LED");

      const offFunc = symbols.find((s) => s.name === "off");
      expect(offFunc).toBeDefined();
      expect(offFunc!.scopePath).toBe("LED");

      const startFunc = symbols.find((s) => s.name === "start");
      expect(startFunc).toBeDefined();
      expect(startFunc!.scopePath).toBe("Motor");

      const stopFunc = symbols.find((s) => s.name === "stop");
      expect(stopFunc).toBeDefined();
      expect(stopFunc!.scopePath).toBe("Motor");
    });
  });

  describe("empty program", () => {
    it("returns empty array for empty program", () => {
      const code = ``;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      expect(symbols).toEqual([]);
    });
  });

  describe("const value collection (Issue #455)", () => {
    // #1664 box 7: 1.3 keeps a const-named dimension as text; 1.4 folds it
    // where the declaration is written, which these read back
    const settled = (tree: ReturnType<typeof parse>) =>
      Program.build(
        [
          CnxResolver.resolve(
            ProgramLowering.program(tree, null),
            "test.cnx",
            registry,
          ),
        ],
        {
          cppMode: false,
        },
      ).symbolsInFile("test.cnx");

    it("resolves array dimensions from top-level const", () => {
      const code = `
        u8 SIZE <- 4;
        bool arr[SIZE];
      `;
      const tree = parse(code);
      const symbols = settled(tree);

      expect(symbols).toHaveLength(2);

      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual([4]);
      }
    });

    it("resolves array dimensions from scoped const", () => {
      const code = `
        scope Device {
          u8 BUF_SIZE <- 8;
          public u8 buffer[BUF_SIZE];
        }
      `;
      const tree = parse(code);
      const symbols = settled(tree);

      // Find buffer by bare name with scope reference
      const bufferSymbol = symbols.find(
        (s) => s.name === "buffer" && s.scopePath === "Device",
      );
      expect(bufferSymbol).toBeDefined();
      if (SymbolGuards.isVariable(bufferSymbol!)) {
        expect(bufferSymbol.isArray).toBe(true);
        expect(bufferSymbol.arrayDimensions).toEqual([8]);
      }
    });

    it("resolves hex constant array dimensions", () => {
      const code = `
        u8 HEX_SIZE <- 0x10;
        bool hex_arr[HEX_SIZE];
      `;
      const tree = parse(code);
      const symbols = settled(tree);

      const arrSymbol = symbols.find((s) => s.name === "hex_arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.arrayDimensions).toEqual([16]);
      }
    });

    it("resolves binary constant array dimensions", () => {
      const code = `
        u8 BIN_SIZE <- 0b1010;
        i16 bin_arr[BIN_SIZE];
      `;
      const tree = parse(code);
      const symbols = settled(tree);

      const arrSymbol = symbols.find((s) => s.name === "bin_arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.arrayDimensions).toEqual([10]);
      }
    });

    it("ignores non-integer const values", () => {
      const code = `
        u8 STR_VAL <- "hello";
        bool arr[4];
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Should still parse without error
      expect(symbols).toHaveLength(2);
    });

    it("keeps an unresolved identifier (a C macro) as written, for 1.4", () => {
      const code = `
        bool arr[DEVICE_COUNT];
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Issue #455: Unresolved identifiers (like C macros) should pass through
      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        expect(arrSymbol.arrayDimensions).toEqual([UNRESOLVED_DIMENSION]);
        expect(ConstExprShape.list(arrSymbol.arrayDimensionExprs)).toEqual([
          "DEVICE_COUNT",
        ]);
      }
    });

    it("keeps an expression in an array dimension as written, for 1.4", () => {
      const code = `
        u8 SIZE <- 4;
        bool arr[SIZE * 2];
      `;
      const tree = parse(code);
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(tree, null),
        "test.cnx",
        registry,
      ).symbols;

      // Issue #455: Complex expressions should pass through as strings
      const arrSymbol = symbols.find((s) => s.name === "arr");
      expect(arrSymbol).toBeDefined();
      if (SymbolGuards.isVariable(arrSymbol!)) {
        expect(arrSymbol.isArray).toBe(true);
        // #1175: as written, not as joined text
        expect(arrSymbol.arrayDimensions).toEqual([UNRESOLVED_DIMENSION]);
        expect(ConstExprShape.list(arrSymbol.arrayDimensionExprs)).toEqual([
          "(SIZE * 2)",
        ]);
      }
    });
  });
  describe("IFileSymbols: the per-file artifact (#1472)", () => {
    it("declaredScopeTypes holds a scope function, which forms a callback type (ADR-029)", () => {
      const code = `
        scope Local {
          public void tick() { }
        }
      `;
      const declared = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      expect([...declared.declaredScopeTypes]).toEqual(["Local__tick"]);
    });

    it("declaredScopeTypes holds what THIS file declares, and only that", () => {
      // `Top` and `GPIO` are the artifact's own negative controls. Its contract
      // is types declared INSIDE A SCOPE, registers excluded -- a register
      // declares a variable at an address, not a type. Both exclusions lived
      // only in the doc comment: widening pass 0b to add top-level names makes
      // `declaredScopeTypes` come back as ["Local__S", "Top"] with every other
      // test here still green, because `qualifyScopeType` only ever probes
      // `Scope__T` and a leaked bare name is inert for resolution. Inert is not
      // absent -- the artifact would carry names its own contract forbids.
      const code = `
        struct Top { u8 a; }
        scope Local {
          public struct S { u8 a; }
          public enum E { x, y }
          public register GPIO @ 0x40000000 {
            DATA: u32 rw @ 0x00,
          }
        }
      `;
      const declared = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      expect(declared.sourceFile).toBe("test.cnx");
      expect([...declared.declaredScopeTypes].sort()).toEqual([
        "Local__E",
        "Local__S",
      ]);
    });

    it("defers a bare type this file does not declare, instead of guessing", () => {
      // The replacement for the seed's negative control, and the same argument
      // one layer down. Declare is no longer told what other files declare, so
      // for `Point` it has NO answer -- and "no answer" must not be spelled as
      // the bare name, because a bare `Point` and `global.Point` are the same
      // string by then and ADR-057 cannot be applied afterwards. Spelling it as
      // the bare name is exactly the guess the seed existed to prevent; this
      // asserts the deferral instead, including the two things 1.4 needs and a
      // resolved name cannot carry: the identifier AS WRITTEN and the scope it
      // was written in.
      const code = `
        scope Spanned {
          public Point origin() { return this.stored; }
        }
      `;
      const declared = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );
      const origin = declared.symbols.find((sym) => sym.name === "origin");

      expect(origin && SymbolGuards.isFunction(origin)).toBe(true);
      if (origin && SymbolGuards.isFunction(origin)) {
        expect(origin.returnType).toEqual({
          kind: "deferred",
          name: "Point",
          scopePath: "Spanned",
        });
      }
    });
  });

  describe("ADR-057 scope type qualification (#1130)", () => {
    const typeOf = (
      declared: ReturnType<typeof CnxResolver.resolve>,
      name: string,
    ) => declared.symbols.find((sym) => sym.name === name);

    it("qualifies a bare scope-local type at a parameter and return position", () => {
      const code = `
        scope A {
          public enum B { c, d }
          public B pick(B value) { return value; }
        }
      `;
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      const pick = typeOf(symbols, "pick");
      expect(pick && SymbolGuards.isFunction(pick)).toBe(true);
      if (pick && SymbolGuards.isFunction(pick)) {
        expect(TypeResolver.getTypeName(pick.returnType)).toBe("A__B");
        expect(TypeResolver.getTypeName(pick.parameters[0].type)).toBe("A__B");
      }
    });

    it("qualifies the same way when the type is declared BELOW its use", () => {
      // The pre-pass exists so this answer cannot depend on declaration order.
      const code = `
        scope A {
          public B pick(B value) { return value; }
          public enum B { c, d }
        }
      `;
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      const pick = typeOf(symbols, "pick");
      if (pick && SymbolGuards.isFunction(pick)) {
        expect(TypeResolver.getTypeName(pick.returnType)).toBe("A__B");
        expect(TypeResolver.getTypeName(pick.parameters[0].type)).toBe("A__B");
      }
    });

    it("qualifies a bare scope-local type on a struct field", () => {
      const code = `
        scope A {
          public enum B { c, d }
          public struct S { u8 x; B kind; }
        }
      `;
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      const structSymbol = typeOf(symbols, "S");
      expect(structSymbol && SymbolGuards.isStruct(structSymbol)).toBe(true);
      if (structSymbol && SymbolGuards.isStruct(structSymbol)) {
        const kind = structSymbol.fields.get("kind");
        expect(kind && TypeResolver.getTypeName(kind.type)).toBe("A__B");
      }
    });

    it("leaves an explicit global.Type field UNqualified even when the scope shadows it", () => {
      // Regression guard: a post-pass over resolved names cannot tell
      // `global.Mode` from a bare `Mode`, and rewrote both.
      const code = `
        enum Mode { idle, busy }
        scope A {
          public enum Mode { off, on }
          public struct W { global.Mode mode; u8 v; }
        }
      `;
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      const structSymbol = typeOf(symbols, "W");
      if (structSymbol && SymbolGuards.isStruct(structSymbol)) {
        const mode = structSymbol.fields.get("mode");
        expect(mode && TypeResolver.getTypeName(mode.type)).toBe("Mode");
      }
    });

    it("does not let a non-type scope member capture a same-named global type", () => {
      const code = `
        struct Config { u8 x; }
        scope A {
          private u8 Config <- 3;
          public void use(Config cfg) { }
        }
      `;
      // Runs both passes, because that is where the answer now lives: Declare
      // cannot settle a bare `Config` -- pass 0b collects TYPE-forming members
      // only, so `A__Config` is not a scope type and the name might still name
      // one from an included file. It defers, and 1.4 settles against the
      // program-wide set, which has no `A__Config` either. The rule under test
      // is unchanged: a scope member that is not a type must not capture a
      // same-named global one.
      const declared = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );
      // 1.4's own settling (#2036), not a predicate written here to stand in
      // for it: the answer under test is whatever 1.4 decides.
      const symbols = Program.settleFiles([declared], {
        registry,
      }).symbolsByFile.get("test.cnx");
      expect(symbols).toBeDefined();

      const use = symbols!.find((sym) => sym.name === "use");
      expect(use && SymbolGuards.isFunction(use)).toBe(true);
      if (use && SymbolGuards.isFunction(use)) {
        expect(TypeResolver.getTypeName(use.parameters[0].type)).toBe("Config");
      }
    });

    it("leaves a bare global type name alone at top level", () => {
      const code = `
        struct Point { i32 x; }
        void move(Point p) { }
      `;
      const symbols = CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "test.cnx",
        registry,
      );

      const move = typeOf(symbols, "move");
      if (move && SymbolGuards.isFunction(move)) {
        expect(TypeResolver.getTypeName(move.parameters[0].type)).toBe("Point");
      }
    });
  });

  // #1358 DoD: the declare step must be idempotent. This is the shape the real
  // pipeline runs -- Transpiler stages 3 and 5 both resolve every file, and
  // The registry is built once per RUN, not between files (#1301) -- which is
  // why it is one instance threaded rather than one per file (#1452 box 3).
  describe("idempotence of the declare step", () => {
    // Snapshots EVERY mutable collection on IScopeSymbol, not just the one this
    // PR guarded. "Declare runs twice over the same tree" is compensated
    // separately in three places -- `declarationSites` by Set semantics,
    // `members` by the includes-check `ScopeCollector` added for #1334, and
    // `functions` by `SymbolRegistry.isAlreadyRegistered` -- each with only a
    // local test. Nothing asserted the STEP was idempotent, so a collection
    // added without a guard would duplicate silently. `variables` is exactly
    // that shape today: declared on IScopeSymbol and never written.
    const snapshotMotor = () => {
      const scope = registry.getScope("Motor")!;
      return {
        functions: scope.functions.map((f) => f.fullyQualifiedCName),
        members: [...scope.members],
        variables: [...scope.variables],
        declarationSites: [...scope.declarationSites].sort(),
        memberVisibility: [...scope.memberVisibility.entries()].sort(),
      };
    };

    it("resolving the same tree twice leaves registry state unchanged", () => {
      const code = `scope Motor {
        void start() { }
        void stop() { }
      }`;

      // Re-parsed each time, as stage 5 does -- distinct trees, distinct symbol
      // objects. An identity-based guard would not catch the duplication.
      CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "motor.cnx",
        registry,
      );
      const afterFirst = snapshotMotor();

      // Absolute assertion first: before/after equality alone cannot tell
      // "idempotent" from "consistently wrong on both passes".
      expect(afterFirst.functions).toEqual(["Motor__start", "Motor__stop"]);
      expect(afterFirst.members).toEqual(["start", "stop"]);

      CnxResolver.resolve(
        ProgramLowering.program(parse(code), null),
        "motor.cnx",
        registry,
      );

      expect(snapshotMotor()).toEqual(afterFirst);
    });

    // NEGATIVE CONTROL. A scope spanned across two files must still merge
    // (#1333) -- suppressing registration for an already-seen scope would pass
    // the assertion above and break this.
    it("still merges a scope genuinely spanned across two different files", () => {
      CnxResolver.resolve(
        ProgramLowering.program(
          parse(`scope Motor { void start() { } }`),
          null,
        ),
        "a.cnx",
        registry,
      );
      CnxResolver.resolve(
        ProgramLowering.program(parse(`scope Motor { void stop() { } }`), null),
        "b.cnx",
        registry,
      );

      expect(registry.getScope("Motor")?.functions.map((f) => f.name)).toEqual([
        "start",
        "stop",
      ]);
    });
  });
});
