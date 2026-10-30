/**
 * Unit tests for HeaderSymbolAdapter
 * ADR-055 Phase 5/7: Converts TSymbol to IHeaderSymbol (ISymbol methods removed in Phase 7)
 */
import SymbolTable from "../../../../../PARSE/3-Declare/SymbolTable";
import TestSymbolTable from "../../../../__tests__/TestSymbolTable";
import { describe, it, expect } from "vitest";
import TranspileState from "../../../../TranspileState";
import HeaderSymbolAdapter from "../HeaderSymbolAdapter";
import IVariableSymbol from "../../../../../types/symbols/IVariableSymbol";
import IFunctionSymbol from "../../../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../../../types/symbols/IStructSymbol";
import IEnumSymbol from "../../../../../types/symbols/IEnumSymbol";
import IBitmapSymbol from "../../../../../types/symbols/IBitmapSymbol";
import IRegisterSymbol from "../../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../../types/symbols/IScopeSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TTypeUtils from "../../../../../utils/TTypeUtils";
import TestSymbolUtils from "../../../../../PARSE/3-Declare/cnx/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../../../types/__testUtils__/testSourceSpan";
import TestEnumMembers from "../../../../../types/__testUtils__/testEnumMembers";
import TestMembers from "../../../../../types/__testUtils__/testMembers";
import type IProgram from "../../../../../types/IProgram";
import TestExpression from "../../../../../types/__testUtils__/testExpression";

let state = new TranspileState();

describe("HeaderSymbolAdapter", () => {
  beforeEach(() => {
    state = new TranspileState();
    TestSymbolTable.install(state);
  });

  // ========================================================================
  // fromTSymbol - TSymbol to IHeaderSymbol Conversion
  // ========================================================================

  describe("fromTSymbol - variable", () => {
    it("should convert global variable TSymbol", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "counter",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("counter");
      expect(result.kind).toBe("variable");
      expect(result.type).toBe("u32");
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped variable with transpiled C name", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "speed",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("f32"),
        isConst: false,
        isAtomic: true,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor__speed");
      expect(result.type).toBe("f32");
      expect(result.isAtomic).toBe(true);
      expect(result.parent).toBe("Motor");
    });

    it("should convert array variable with dimensions", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "buffer",
          scopePath: "",
          sourceFile: "data.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [256, 4],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.isArray).toBe(true);
      expect(result.arrayDimensions).toEqual(["256", "4"]);
    });

    it("should convert const variable", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "MAX_SIZE",
          scopePath: "",
          sourceFile: "config.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: false,
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.isConst).toBe(true);
    });

    /**
     * ADR-030: the header's `extern` reads the decision the definition was
     * made from -- it declared `extern Dev device;` against `Dev* device`. The
     * complete type is the control: its variable is declared as its value.
     * The decision is the declaration's `DeclaredPointer` answer, whose handle
     * arm asks the symbol table (`DeclaredPointer.isHandleType`).
     */
    it.each<[string, string, boolean]>([
      ["an opaque type", "Dev", true],
      ["a complete type", "Full", false],
    ])(
      "marks a variable of %s by whether it is held through a pointer",
      (_label, typeName, expected) => {
        TestSymbolTable.of(state).markOpaqueType("Dev");
        const tSymbol: IVariableSymbol = {
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "device",
            scopePath: "",
            sourceFile: "handles.cnx",
            span: TestSourceSpan.at(1),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          type: TTypeUtils.createExternal(typeName),
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
          isArray: false,
        };

        const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

        expect(result.type).toBe(typeName);
        expect(result.isPointer).toBe(expected);
      },
    );
  });

  describe("fromTSymbol - function", () => {
    it("should convert global function TSymbol", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "init",
          scopePath: "",
          sourceFile: "main.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        visibility: "public",
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("init");
      expect(result.kind).toBe("function");
      expect(result.type).toBe("void");
      expect(result.parameters).toEqual([]);
      expect(result.signature).toBe("void init()");
    });

    it("should convert scoped function with parameters", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "setSpeed",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        parameters: [
          {
            name: "value",
            emittedName: "value",
            type: TTypeUtils.createPrimitive("f32"),
            isConst: false,
            isArray: false,
          },
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        visibility: "public",
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor__setSpeed");
      expect(result.type).toBe("void");
      expect(result.parameters).toHaveLength(1);
      expect(result.parameters?.[0].name).toBe("value");
      expect(result.parameters?.[0].type).toBe("f32");
      expect(result.signature).toBe("void Motor__setSpeed(f32)");
      expect(result.parent).toBe("Motor");
    });

    it("should convert function with array parameter", () => {
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "process",
          scopePath: "",
          sourceFile: "process.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        parameters: [
          {
            name: "data",
            emittedName: "data",
            type: TTypeUtils.createPrimitive("u8"),
            isConst: true,
            isArray: true,
            arrayDimensions: [256],
          },
        ],
        returnType: TTypeUtils.createPrimitive("i32"),
        returnOverflowBehavior: "clamp",
        visibility: "public",
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.parameters?.[0].isArray).toBe(true);
      expect(result.parameters?.[0].isConst).toBe(true);
      expect(result.parameters?.[0].arrayDimensions).toEqual(["256"]);
    });

    /**
     * ADR-030 / #1722: every parameter carries the stamp 1.4 set on it -- the
     * decision its `.c` prototype is spelled from too -- a scalar handle and an
     * array of them (#996) alike, so the header's callback-compatible path,
     * which sets nothing else about opacity, still declares `Dev* pair[2]`. The
     * adapter reads the stamp and asks no predicate: the program here says
     * NOTHING is opaque, so a stamp that were re-derived would come out false.
     * The complete type is the control.
     */
    it("marks each parameter by the opaque-handle stamp it was settled with", () => {
      state.program = {
        symbolTable: () => new SymbolTable(),
        isOpaqueType: () => false,
      } as unknown as IProgram;
      const tSymbol: IFunctionSymbol = {
        ...TestSymbolUtils.base({
          kind: "function",
          name: "onPair",
          scopePath: "",
          sourceFile: "pair.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        parameters: [
          {
            name: "d",
            emittedName: "d",
            type: TTypeUtils.createExternal("Dev"),
            isConst: false,
            isArray: false,
            isOpaqueHandle: true,
          },
          {
            name: "pair",
            emittedName: "pair",
            type: TTypeUtils.createExternal("Dev"),
            isConst: false,
            isArray: true,
            arrayDimensions: [2],
            isOpaqueHandle: true,
          },
          {
            name: "f",
            emittedName: "f",
            type: TTypeUtils.createExternal("Full"),
            isConst: false,
            isArray: false,
          },
        ],
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        visibility: "public",
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.parameters?.map((p) => p.isOpaqueHandle)).toEqual([
        true,
        true,
        undefined,
      ]);
    });
  });

  describe("fromTSymbol - struct", () => {
    it("should convert global struct TSymbol", () => {
      const tSymbol: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Point",
          scopePath: "",
          sourceFile: "geometry.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: TestMembers.asStructFields(
          "Point",
          new Map([
            [
              "x",
              {
                name: "x",
                type: TTypeUtils.createPrimitive("i32"),
                isConst: false,
                isAtomic: false,
                isVolatile: false,
                overflowBehavior: "clamp",
                isArray: false,
              },
            ],
          ]),
        ),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Point");
      expect(result.kind).toBe("struct");
      expect(result.parent).toBeUndefined();
    });

    it("should convert scoped struct with transpiled C name", () => {
      const tSymbol: IStructSymbol = {
        ...TestSymbolUtils.base({
          kind: "struct",
          name: "Vector",
          scopePath: "Geometry",
          sourceFile: "geometry.cnx",
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Geometry__Vector");
      expect(result.parent).toBe("Geometry");
    });
  });

  describe("fromTSymbol - enum", () => {
    it("should convert global enum TSymbol", () => {
      const tSymbol: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "EColor",
          scopePath: "",
          sourceFile: "colors.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: TestEnumMembers.of("EColor", { RED: 0, GREEN: 1, BLUE: 2 }),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("EColor");
      expect(result.kind).toBe("enum");
    });

    it("should convert scoped enum with transpiled C name", () => {
      const tSymbol: IEnumSymbol = {
        ...TestSymbolUtils.base({
          kind: "enum",
          name: "EMode",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: TestEnumMembers.of("EMode", { OFF: 0, ON: 1 }),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor__EMode");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - bitmap", () => {
    it("should convert bitmap TSymbol", () => {
      const tSymbol: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Flags",
          scopePath: "",
          sourceFile: "flags.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "u8",
        bitWidth: 8,
        fields: TestMembers.asBitmapFields(
          "Flags",
          new Map([
            ["enabled", { offset: 0, width: 1 }],
            ["ready", { offset: 1, width: 1 }],
          ]),
        ),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Flags");
      expect(result.kind).toBe("bitmap");
      expect(result.type).toBe("u8");
    });

    it("should convert scoped bitmap with transpiled C name", () => {
      const tSymbol: IBitmapSymbol = {
        ...TestSymbolUtils.base({
          kind: "bitmap",
          name: "Status",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        backingType: "u16",
        bitWidth: 16,
        fields: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor__Status");
      expect(result.type).toBe("u16");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - register", () => {
    it("should convert register TSymbol", () => {
      const tSymbol: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "GPIO",
          scopePath: "",
          sourceFile: "gpio.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x40000000"),
        members: TestMembers.asRegisterMembers(
          "GPIO",
          new Map([
            [
              "DATA",
              {
                type: TTypeUtils.createPrimitive("u32"),
                offset: TestExpression.hex("0x00"),
                access: "rw" as const,
              },
            ],
            [
              "DIR",
              {
                type: TTypeUtils.createPrimitive("u32"),
                offset: TestExpression.hex("0x04"),
                access: "rw" as const,
              },
            ],
          ]),
        ),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("GPIO");
      expect(result.kind).toBe("register");
    });

    it("should convert scoped register with transpiled C name", () => {
      const tSymbol: IRegisterSymbol = {
        ...TestSymbolUtils.base({
          kind: "register",
          name: "CTRL",
          scopePath: "Motor",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(20),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        baseAddress: TestExpression.hex("0x50000000"),
        members: new Map(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor__CTRL");
      expect(result.parent).toBe("Motor");
    });
  });

  describe("fromTSymbol - scope", () => {
    it("should convert scope TSymbol", () => {
      const tSymbol: IScopeSymbol = {
        ...TestSymbolUtils.base({
          kind: "scope",
          name: "Motor",
          scopePath: "",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: ["init", "setSpeed"],
        functions: [],
        variables: [],
        memberVisibility: new Map(),
        declarationSites: new Set<string>(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Motor");
      expect(result.kind).toBe("scope");
      // #1298 DoD: a top-level scope has no container, so `parent` is absent --
      // as opposed to being omitted whatever the scope's position, which is what
      // this converter used to do for every scope alike.
      expect(result.parent).toBeUndefined();
    });

    it("states the container of a NESTED scope", () => {
      // The half the previous case cannot distinguish: before #1298 this
      // converter omitted `parent` unconditionally, so a nested scope and a
      // top-level one produced the same header symbol.
      const tSymbol: IScopeSymbol = {
        ...TestSymbolUtils.base({
          kind: "scope",
          name: "Inner",
          scopePath: "Outer",
          sourceFile: "motor.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        members: [],
        functions: [],
        variables: [],
        memberVisibility: new Map(),
        declarationSites: new Set<string>(),
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.name).toBe("Inner");
      expect(result.parent).toBe("Outer");
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe("edge cases", () => {
    it("should handle string dimensions in arrays", () => {
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "macroArray",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: ["DEVICE_COUNT"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.arrayDimensions).toEqual(["DEVICE_COUNT"]);
    });

    it("writes each settled dimension as it is: a value, or a header macro's C (#1175)", () => {
      // 1.4 settles every dimension to its value, or -- for one only C can
      // evaluate -- to C written from its structure. Nothing is left for the
      // header to resolve, so it rewrites nothing: it used to rewrite source
      // text such as `EColor.COUNT`, which no longer reaches it.
      const tSymbol: IVariableSymbol = {
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "DATA",
          scopePath: "",
          sourceFile: "test.cnx",
        }),
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cnx,
        visibility: "public",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: true,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [3, "BUF_SIZE + 1"],
      };

      const result = HeaderSymbolAdapter.fromTSymbol(tSymbol, state);

      expect(result.arrayDimensions).toEqual(["3", "BUF_SIZE + 1"]);
    });

    // #1117 review: a dimension used to arrive as cnx SOURCE, resolved here
    // with the .c path's scope awareness. #1175: 1.4 settles it once for both
    // files, so what remains is a value or C, written as given.
    describe("scope-aware array dimensions", () => {
      const makeArrayVar = (
        scopePath: string,
        dim: string,
      ): IVariableSymbol => ({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "counters",
          scopePath,
          sourceFile: "test.cnx",
        }),
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cnx,
        visibility: "public",
        type: TTypeUtils.createPrimitive("u8"),
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
        isArray: true,
        arrayDimensions: [dim],
      });

      it("leaves a non-qualified dimension untouched", () => {
        const result = HeaderSymbolAdapter.fromTSymbol(
          makeArrayVar("Motor", "DEVICE_COUNT"),
          state,
        );

        expect(result.arrayDimensions).toEqual(["DEVICE_COUNT"]);
      });
    });
  });
});
