import { describe, expect, it, beforeEach } from "vitest";
import parse from "./testHelpers";
import TestScopeUtils from "./testUtils";
import RegisterCollector from "../collectors/RegisterCollector";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import TypeResolver from "../../../../utils/TypeResolver";
import FirstDeclaration from "./FirstDeclaration";
import QualifiedTypeNames from "../QualifiedTypeNames";

const NONE_WRITTEN = new Map<string, string>();

describe("RegisterCollector", () => {
  beforeEach(() => {
    TestScopeUtils.resetGlobalScope();
  });

  describe("basic register extraction", () => {
    it("collects a simple register with primitive members", () => {
      const code = `
        register GpioPort {
          0x00 rw u32 DATA,
          0x04 rw u32 DIR,
        }
        GpioPort GPIO(0x40000000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.kind).toBe("register");
      expect(symbol.name).toBe("GpioPort");
      // ADR-072: a register type has no address; its instance carries one
      expect(symbol.registerType).toBeNull();
      expect(symbol.baseAddress).toBeNull();
      expect(symbol.sourceFile).toBe("test.cnx");
      expect(symbol.sourceLanguage).toBe(ESourceLanguage.Cnx);
      expect(symbol.visibility).toBe("public");
      expect(symbol.scopePath).toBe("");

      expect(symbol.members.size).toBe(2);
      expect(symbol.members.get("DATA")).toMatchObject({
        offset: { kind: "literal", text: "0x00" },
        type: TypeResolver.resolve("u32"),
        access: "rw",
      });
      expect(symbol.members.get("DIR")).toMatchObject({
        offset: { kind: "literal", text: "0x04" },
        type: TypeResolver.resolve("u32"),
        access: "rw",
      });
    });

    it("handles different access modes", () => {
      const code = `
        register UartPort {
          0x00 ro u8 RX,
          0x04 wo u8 TX,
          0x08 rw u16 CTRL,
          0x0C w1c u8 FLAGS,
          0x10 w1s u8 SET,
        }
        UartPort UART(0x40001000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.members.get("RX")?.access).toBe("ro");
      expect(symbol.members.get("TX")?.access).toBe("wo");
      expect(symbol.members.get("CTRL")?.access).toBe("rw");
      expect(symbol.members.get("FLAGS")?.access).toBe("w1c");
      expect(symbol.members.get("SET")?.access).toBe("w1s");
    });

    it("converts cnx types to C types", () => {
      const code = `
        register TIMERSLayout {
          0x00 rw u8 COUNT8,
          0x04 rw u16 COUNT16,
          0x08 rw u32 COUNT32,
          0x10 rw u64 COUNT64,
          0x18 rw i32 SIGNED,
        }
        TIMERSLayout TIMERS(0x40002000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(TypeResolver.getTypeName(symbol.members.get("COUNT8")!.type)).toBe(
        "u8",
      );
      expect(
        TypeResolver.getTypeName(symbol.members.get("COUNT16")!.type),
      ).toBe("u16");
      expect(
        TypeResolver.getTypeName(symbol.members.get("COUNT32")!.type),
      ).toBe("u32");
      expect(
        TypeResolver.getTypeName(symbol.members.get("COUNT64")!.type),
      ).toBe("u64");
      expect(TypeResolver.getTypeName(symbol.members.get("SIGNED")!.type)).toBe(
        "i32",
      );
    });
  });

  describe("bitmap type references", () => {
    it("records a named member's type without judging whether it is a bitmap (#1514)", () => {
      const code = `
        register StatusBlock {
          0x00 rw StatusFlags FLAGS,
        }
        StatusBlock STATUS(0x40003000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      const member = symbol.members.get("FLAGS");
      expect(TypeResolver.getTypeName(member!.type)).toBe("StatusFlags");
    });

    it("records a primitive member's type as written", () => {
      const code = `
        register DATALayout {
          0x00 rw u32 VALUE,
        }
        DATALayout DATA(0x40004000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(TypeResolver.getTypeName(symbol.members.get("VALUE")!.type)).toBe(
        "u32",
      );
    });
  });

  describe("scoped registers", () => {
    it("uses scope reference properly", () => {
      const code = `
        register ControlBlock {
          0x00 rw u32 STATUS,
        }
        ControlBlock CTRL(0x40005000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        "Motor",
        "public",
      );

      expect(symbol.name).toBe("ControlBlock");
      expect(symbol.scopePath).toBe("Motor");
      expect(symbol.scopePath).toBe("Motor");
    });

    it("resolves a bare bitmap type through the ADR-057 ladder", () => {
      const code = `
        register ControlBlock {
          0x00 rw MotorFlags FLAGS,
        }
        ControlBlock CTRL(0x40005000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      // Bitmap would be collected as Motor__MotorFlags in a scope
      const knownBitmaps = new Set(["Motor__MotorFlags"]);
      // Production ALWAYS supplies this predicate -- CnxResolver builds it
      // from pass 0b -- so passing it is what makes this test model production.
      // The collector does not qualify names itself; it reads what the one
      // TypeNameLadder resolved. The version of this test that omitted the
      // predicate passed only because the collector re-qualified the result,
      // which is precisely the capture #1472 removed.
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        "Motor",
        "public",
        {
          isScopeType,
          qualifiedTypeName: (written) =>
            QualifiedTypeNames.read(NONE_WRITTEN, written),
        },
      );

      expect(TypeResolver.getTypeName(symbol.members.get("FLAGS")!.type)).toBe(
        "Motor__MotorFlags",
      );
    });

    it("does not let a scope-local bitmap capture an explicit global. type", () => {
      const code = `
        register ControlBlock {
          0x00 rw global.MotorFlags FLAGS,
        }
        ControlBlock CTRL(0x40005000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      // BOTH names exist -- a global bitmap and a same-named one in the scope.
      // That collision is the whole point: ADR-057 says `global.` opts out, so
      // the member must bind the global one even though the scoped name is a
      // known bitmap and would match if anything re-qualified the result.
      const knownBitmaps = new Set(["Motor__MotorFlags", "MotorFlags"]);
      const isScopeType = (qualifiedName: string): boolean =>
        knownBitmaps.has(qualifiedName);
      const symbol = RegisterCollector.collect(
        regCtx,
        "motor.cnx",
        "Motor",
        "public",
        {
          isScopeType,
          qualifiedTypeName: (written) =>
            QualifiedTypeNames.read(NONE_WRITTEN, written),
        },
      );

      expect(TypeResolver.getTypeName(symbol.members.get("FLAGS")!.type)).toBe(
        "MotorFlags",
      );
    });
  });

  describe("base address expressions", () => {
    it("captures complex base address expressions", () => {
      const code = `
        register DMALayout {
          0x00 rw u32 CTRL,
        }
        DMALayout DMA(BASE_ADDR);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      // ADR-072: a register type has no address; its instance carries one
      expect(symbol.registerType).toBeNull();
      expect(symbol.baseAddress).toBeNull();
    });
  });

  describe("source line tracking", () => {
    it("captures the source line number", () => {
      const code = `

        register OnLine3Layout {
          0x00 rw u32 DATA,
        }
        OnLine3Layout OnLine3(0x40000000);
      `;
      const tree = parse(code);
      const regCtx = FirstDeclaration.register(tree);
      const symbol = RegisterCollector.collect(
        regCtx,
        "test.cnx",
        "",
        "public",
      );

      expect(symbol.span.line).toBe(3);
    });
  });

  // #1300 review: every other test in this file passes "public", so the defect
  // class this parameter exists for -- a collector reporting a private
  // declaration as public -- was invisible at the unit level.
  describe("visibility (#1300)", () => {
    it("records a private declaration as private", () => {
      const tree = parse(`
        register HiddenLayout {
          0x00 rw u32 DR,
        }
        HiddenLayout Hidden(0x40000000);
      `);
      const symbol = RegisterCollector.collect(
        FirstDeclaration.register(tree),
        "test.cnx",
        "",
        "private",
      );

      expect(symbol.visibility).toBe("private");
    });
  });

  describe("members carry their own position and identity (#1318)", () => {
    const collect = (code: string, scopePath = "", visibility = "public") =>
      RegisterCollector.collect(
        FirstDeclaration.register(parse(code)),
        "test.cnx",
        scopePath,
        visibility as "public" | "private",
      );

    it("gives each member a DISTINCT line, not the register's", () => {
      const symbol = collect(`
        register GpioPort {
          0x00 rw u32 DATA,
          0x04 rw u32 DIR,
          0x08 rw u32 MASK,
        }
        GpioPort GPIO(0x40000000);
      `);
      const lines = [...symbol.members.values()].map((m) => m.span.line);
      expect(new Set(lines).size).toBe(3);
      expect(lines).not.toContain(symbol.span.line);
    });

    it("keys a member by its owner, and inherits the owner's visibility", () => {
      const global = collect(
        `register GpioPort { 0x00 rw u32 DATA, } GpioPort GPIO(0x40000000);`,
      );
      expect(global.members.get("DATA")!.fullyQualifiedCName).toBe(
        "GpioPort__DATA",
      );
      expect(global.members.get("DATA")!.name).toBe("DATA");

      const scoped = collect(
        `register GpioPort { 0x00 rw u32 DATA, } GpioPort GPIO(0x40000000);`,
        "Board",
        "private",
      );
      expect(scoped.members.get("DATA")!.fullyQualifiedCName).toBe(
        "Board__GpioPort__DATA",
      );
      expect(scoped.members.get("DATA")!.visibility).toBe("private");
    });
  });
});
