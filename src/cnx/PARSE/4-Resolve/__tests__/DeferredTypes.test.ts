/**
 * `DeferredTypes.settle` over Declare's real output, with the scope-type
 * predicate injected so each case says exactly which answer it hands in.
 *
 * Moved from 1.3's integration test (#2036): it exercises a 4-Resolve module,
 * and 1.3's tests now settle through `Program.settleFiles` like every other
 * caller outside 1.4.
 */
import ProgramLowering from "../../2-Parse/ProgramLowering";
import { beforeEach, describe, expect, it } from "vitest";
import parse from "../../3-Declare/cnx/__tests__/testHelpers";
import CnxResolver from "../../3-Declare/cnx/index";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import DeferredTypes from "../DeferredTypes";
import SymbolGuards from "../../../types/symbols/SymbolGuards";
import TypeResolver from "../../../utils/TypeResolver";

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

describe("DeferredTypes.settle", () => {
  it("settles a deferred type against the whole-program set, and only that", () => {
    // The positive half. Deferring is only correct if something settles it,
    // so this runs 1.4's settlement over Declare's artifact -- and pairs it
    // with a negative control on the same symbols. Without the control, a
    // settlement that qualified unconditionally would pass the first
    // assertion and be wrong: `global.Point` inside `scope Spanned` must
    // stay `Point`, and that case is byte-identical here.
    const code = `scope Spanned { public Point origin() { return this.stored; } }`;
    const declared = CnxResolver.resolve(
      ProgramLowering.program(parse(code), null),
      "test.cnx",
      registry,
    );

    const settled = DeferredTypes.settle(
      declared.symbols,
      (scopePath, name) =>
        scopePath === "Spanned" && name === "Point"
          ? "Spanned__Point"
          : undefined,
      () => false, // no headers: nothing is opaque (#1722)
      () => false,
    );
    const origin = settled.find((sym) => sym.name === "origin");
    expect(origin && SymbolGuards.isFunction(origin)).toBe(true);
    if (origin && SymbolGuards.isFunction(origin)) {
      expect(TypeResolver.getTypeName(origin.returnType)).toBe(
        "Spanned__Point",
      );
    }

    const unqualified = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      () => false,
      () => false,
    );
    const bare = unqualified.find((sym) => sym.name === "origin");
    if (bare && SymbolGuards.isFunction(bare)) {
      expect(TypeResolver.getTypeName(bare.returnType)).toBe("Point");
    }

    // And nothing deferred survives either settlement.
    expect(DeferredTypes.hasUnsettled(settled)).toBe(false);
    expect(DeferredTypes.hasUnsettled(unqualified)).toBe(false);
  });

  it("stamps a struct field of an opaque type, and only that field (#1744)", () => {
    const code = `struct Motor { Dev d; u32 speed; }`;
    const declared = CnxResolver.resolve(
      ProgramLowering.program(parse(code), null),
      "test.cnx",
      registry,
    );

    const settled = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      (typeName) => typeName === "Dev",
      () => false,
    );
    const motor = settled.find((sym) => sym.name === "Motor");
    expect(motor?.kind).toBe("struct");
    if (motor?.kind === "struct") {
      expect(motor.fields.get("d")?.isOpaqueHandle).toBe(true);
      expect(motor.fields.get("speed")?.isOpaqueHandle).toBeUndefined();
    }

    // The negative control: with nothing opaque, nothing is stamped.
    const plain = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      () => false,
      () => false,
    );
    const unstamped = plain.find((sym) => sym.name === "Motor");
    if (unstamped?.kind === "struct") {
      expect(unstamped.fields.get("d")?.isOpaqueHandle).toBeUndefined();
    }
  });
  it("types an E-prefixed function's name used as a type as a callback (#1984)", () => {
    const code = `u32 ETick() { return 1; }\nstruct Clock { ETick handler; }`;
    const declared = CnxResolver.resolve(
      ProgramLowering.program(parse(code), null),
      "test.cnx",
      registry,
    );

    const settled = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      () => false,
      (cName) => cName === "ETick",
    );
    const clock = settled.find((sym) => sym.name === "Clock");
    expect(clock?.kind).toBe("struct");
    if (clock?.kind === "struct") {
      expect(clock.fields.get("handler")?.type).toEqual({
        kind: "callback",
        name: "ETick",
      });
    }
  });

  it("types a function's name used as a type as a callback (#1984)", () => {
    const code = `u32 tick() { return 1; }\nstruct Clock { tick handler; tick[2] spares; }`;
    const declared = CnxResolver.resolve(
      ProgramLowering.program(parse(code), null),
      "test.cnx",
      registry,
    );

    const settled = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      () => false,
      (cName) => cName === "tick",
    );
    const clock = settled.find((sym) => sym.name === "Clock");
    expect(clock?.kind).toBe("struct");
    if (clock?.kind === "struct") {
      expect(clock.fields.get("handler")?.type).toEqual({
        kind: "callback",
        name: "tick",
      });
      expect(clock.fields.get("spares")?.type).toEqual({
        kind: "callback",
        name: "tick",
      });
    }

    // The negative control: a name that is not a function stays a struct.
    const plain = DeferredTypes.settle(
      declared.symbols,
      () => undefined,
      () => false,
      () => false,
    );
    const unsettled = plain.find((sym) => sym.name === "Clock");
    if (unsettled?.kind === "struct") {
      expect(unsettled.fields.get("handler")?.type.kind).toBe("struct");
    }
  });
});
