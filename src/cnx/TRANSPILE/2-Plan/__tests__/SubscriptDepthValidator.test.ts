/**
 * Unit tests for SubscriptDepthValidator (Issue #1106).
 */
import { describe, it, expect } from "vitest";
import SubscriptDepthValidator from "../SubscriptDepthValidator";
import TTypeInfo from "../../../types/TTypeInfo";

const scalar = (baseType: string): TTypeInfo => ({
  baseType,
  bitWidth: 8,
  isArray: false,
  isConst: false,
});

const array = (baseType: string, dims: number[]): TTypeInfo => ({
  baseType,
  bitWidth: 8,
  isArray: true,
  arrayDimensions: dims,
  isConst: false,
});

/**
 * Minimal stand-in for a postfix op. Only `expression()` matters: a subscript
 * has 1 (`[i]`) or 2 (`[start, width]`) expressions, a member access or call
 * has none.
 */
// #1445 review: planned ops, which STATE their kind. These used to mock the
// raw-node shape (`expression(): unknown[]`) while the write path passed
// planned ops, so the validator had to choose between two representations with
// a `"kind" in op` probe -- in the one module that exists so the two paths
// cannot disagree. `expressionCount` is kept on the subscript arm because the
// bit-range case below is about ONE op with two expressions, which is a real
// distinction the count must not conflate.
const subscriptOp = (expressionCount = 1) =>
  ({ kind: "subscript", indexCount: expressionCount }) as const;
const nonSubscriptOp = () => ({ kind: "member" }) as const;

describe("SubscriptDepthValidator.countLeadingSubscripts", () => {
  it("counts a run of subscript ops", () => {
    expect(
      SubscriptDepthValidator.countLeadingSubscripts([
        subscriptOp(),
        subscriptOp(),
      ]),
    ).toBe(2);
  });

  it("counts a bit range as ONE op despite its two expressions", () => {
    // flags[4, 3] must not be conflated with the chain flags[4][3].
    expect(
      SubscriptDepthValidator.countLeadingSubscripts([subscriptOp(2)]),
    ).toBe(1);
  });

  it("stops at the first non-subscript op (member access or call)", () => {
    // arr[i].field[j] — only the leading [i] applies to the base.
    expect(
      SubscriptDepthValidator.countLeadingSubscripts([
        subscriptOp(),
        nonSubscriptOp(),
        subscriptOp(),
      ]),
    ).toBe(1);
  });

  it("skips ops consumed identifying the base via startIndex", () => {
    // Read path `this.flags[4][3]` parses as `this` + [.flags, [4], [3]].
    expect(
      SubscriptDepthValidator.countLeadingSubscripts(
        [nonSubscriptOp(), subscriptOp(), subscriptOp()],
        1,
      ),
    ).toBe(2);
  });

  it("returns 0 when the base takes no subscripts at all", () => {
    expect(SubscriptDepthValidator.countLeadingSubscripts([])).toBe(0);
    expect(
      SubscriptDepthValidator.countLeadingSubscripts([nonSubscriptOp()]),
    ).toBe(0);
  });
});

describe("SubscriptDepthValidator", () => {
  it("allows a single subscript (bit index) on a scalar integer", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("u8"), 1, "flags"),
    ).not.toThrow();
  });

  it("rejects a second subscript on a scalar integer", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("u8"), 2, "flags"),
    ).toThrow("E0856 rejects this in pass 2.1");
  });

  it("names E0856 in the invariant so the assertion stays traceable", () => {
    // #1322: the user-facing diagnostic is E0856 in pass 2.1. What survives
    // here is the assertion that it ran, and it names the code for the same
    // reason the throw did -- a reader hitting it needs to know which rule was
    // supposed to have caught this.
    expect(() =>
      SubscriptDepthValidator.validate(scalar("u8"), 2, "flags"),
    ).toThrow("E0856 rejects this in pass 2.1");
  });

  it("rejects an over-deep chain on a scalar float", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("f32"), 2, "value"),
    ).toThrow("E0856 rejects this in pass 2.1");
  });

  it("allows arrayDimensions + 1 subscripts (element bit index)", () => {
    expect(() =>
      SubscriptDepthValidator.validate(array("u8", [16]), 2, "buffer"),
    ).not.toThrow();
  });

  it("allows a bool array one subscript per dimension and no bit index (#2354)", () => {
    expect(() =>
      SubscriptDepthValidator.validate(array("bool", [4]), 1, "ready"),
    ).not.toThrow();
    expect(() =>
      SubscriptDepthValidator.validate(array("bool", [4]), 2, "ready"),
    ).toThrow("E0856 rejects this in pass 2.1");
    expect(() =>
      SubscriptDepthValidator.validate(scalar("bool"), 1, "done"),
    ).toThrow("E0856 rejects this in pass 2.1");
  });

  it("rejects more than arrayDimensions + 1 subscripts", () => {
    expect(() =>
      SubscriptDepthValidator.validate(array("u8", [16]), 3, "buffer"),
    ).toThrow("E0856 rejects this in pass 2.1");
  });

  it("does not validate an unknown (undefined) type", () => {
    expect(() =>
      SubscriptDepthValidator.validate(undefined, 5, "x"),
    ).not.toThrow();
  });

  it("does not validate string types (own semantics)", () => {
    const str: TTypeInfo = {
      baseType: "char",
      bitWidth: 8,
      isArray: false,
      isConst: false,
      isString: true,
      stringCapacity: 32,
    };
    expect(() =>
      SubscriptDepthValidator.validate(str, 3, "name"),
    ).not.toThrow();
  });

  it("does not validate bitmap types (bracket indexing rejected elsewhere)", () => {
    const bitmap: TTypeInfo = {
      baseType: "u8",
      bitWidth: 8,
      isArray: false,
      isConst: false,
      isBitmap: true,
      bitmapTypeName: "Flags",
    };
    expect(() =>
      SubscriptDepthValidator.validate(bitmap, 3, "f"),
    ).not.toThrow();
  });

  it("does not validate non-bit-indexable base types (e.g. structs)", () => {
    expect(() =>
      SubscriptDepthValidator.validate(scalar("Point"), 3, "p"),
    ).not.toThrow();
  });
});
