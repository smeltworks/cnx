/**
 * Unit tests for SubscriptDepth (Issue #1114): the limit of each run of
 * subscripts, measured against the value the run indexes.
 */
import { describe, it, expect } from "vitest";
import SubscriptDepth from "../SubscriptDepth";
import type IChainStep from "../../types/IChainStep";
import type IOperandType from "../../types/IOperandType";
import type TEssentialCategory from "../../types/TEssentialCategory";

const value = (
  typeName: string | null,
  options: {
    dimensions?: number[];
    bitWidth?: number | null;
    category?: TEssentialCategory;
  } = {},
): IOperandType => ({
  typeName,
  cType: null,
  dimensions: options.dimensions ?? [],
  category: options.category ?? "unsigned",
  bitWidth: options.bitWidth ?? null,
  stringCapacity: null,
  enumTypeName: null,
  bitmapTypeName: null,
  overflow: null,
  hasSideEffect: false,
  form: { kind: "declared" },
  binding: null,
});

const step = (
  before: IOperandType | null,
  beforeIsBitField = false,
): IChainStep => ({
  before,
  subscript: null,
  after: null,
  property: null,
  callee: null,
  member: null,
  beforeNamesType: false,
  beforeIsBitField,
  fieldBits: null,
  beforeRegisterMember: null,
  beforeRegister: null,
  registerMember: null,
});

const ops = (...kinds: string[]) => kinds.map((kind) => ({ kind }));

describe("SubscriptDepth.limitOf", () => {
  it.each([
    ["a scalar u8", step(value("u8")), 1],
    ["a u8[4]", step(value("u8", { dimensions: [4] })), 2],
    ["a scalar bool", step(value("bool", { category: "boolean" })), 0],
    ["a scalar char", step(value("char", { category: "character" })), 0],
    ["a char[4]", step(value("char", { dimensions: [4] })), 1],
    [
      "a 1-bit bitmap field (typed bool, no width)",
      step(value("bool"), true),
      0,
    ],
    ["a 1-bit C bit-field", step(value("u32", { bitWidth: 1 }), true), 0],
    ["a 3-bit field", step(value("u8", { bitWidth: 3 }), true), 1],
  ])("%s takes %i", (_what, at, allowed) => {
    expect(SubscriptDepth.limitOf(at)?.allowed).toBe(allowed);
  });

  it("names a bit-field's declared width, and no width otherwise", () => {
    expect(SubscriptDepth.limitOf(step(value("bool"), true))?.fieldWidth).toBe(
      1,
    );
    expect(
      SubscriptDepth.limitOf(step(value("u32", { bitWidth: 3 }), true))
        ?.fieldWidth,
    ).toBe(3);
    expect(SubscriptDepth.limitOf(step(value("u8")))?.fieldWidth).toBeNull();
  });

  it.each([
    ["an untyped value (a C pointer)", step(value(null))],
    ["a struct", step(value("Point"))],
    ["no value", step(null)],
  ])("does not measure %s", (_what, at) => {
    expect(SubscriptDepth.limitOf(at)).toBeNull();
  });
});

describe("SubscriptDepth.overIndexed", () => {
  it("measures each run against the value it indexes", () => {
    const runs = SubscriptDepth.overIndexed(
      ops("subscript", "member", "subscript", "subscript"),
      [
        step(value("Packet", { dimensions: [2] })),
        step(value("Packet")),
        step(value("u8")),
        step(null),
      ],
    );
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ start: 2, count: 2, allowed: 1 });
  });

  it("counts ops from the first typed step: a head's ops are not a run", () => {
    // `this.flags[4][3]`: `.flags` names the head, so the typer starts at `[4]`
    const runs = SubscriptDepth.overIndexed(
      ops("member", "subscript", "subscript"),
      [step(value("u8")), step(null)],
    );
    expect(runs).toMatchObject([{ start: 1, count: 2, allowed: 1 }]);
  });

  it("finds nothing in a chain within every limit", () => {
    expect(
      SubscriptDepth.overIndexed(ops("subscript", "subscript"), [
        step(value("u8", { dimensions: [4] })),
        step(value("u8")),
      ]),
    ).toEqual([]);
  });
});
