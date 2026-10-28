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
    );
    const bare = unqualified.find((sym) => sym.name === "origin");
    if (bare && SymbolGuards.isFunction(bare)) {
      expect(TypeResolver.getTypeName(bare.returnType)).toBe("Point");
    }

    // And nothing deferred survives either settlement.
    expect(DeferredTypes.hasUnsettled(settled)).toBe(false);
    expect(DeferredTypes.hasUnsettled(unqualified)).toBe(false);
  });
});
