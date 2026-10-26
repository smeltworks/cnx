/**
 * Unit tests for SubscriptDepthValidator (Issue #1106, #1114): codegen's
 * invariant reads each run of subscripts off the typer's steps.
 */
import { describe, it, expect } from "vitest";
import SubscriptDepthValidator from "../SubscriptDepthValidator";
import type IChainStep from "../../../types/IChainStep";
import type IOperandType from "../../../types/IOperandType";
import type TExpression from "../../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";

const value = (typeName: string, dimensions: number[] = []): IOperandType => ({
  typeName,
  cType: null,
  dimensions,
  category: "unsigned",
  bitWidth: 8,
  stringCapacity: null,
  enumTypeName: null,
  bitmapTypeName: null,
  overflow: null,
  hasSideEffect: false,
  form: { kind: "declared" },
  binding: null,
});

const step = (before: IOperandType | null): IChainStep => ({
  before,
  subscript: null,
  after: null,
  property: null,
  callee: null,
  member: null,
  beforeNamesType: false,
  beforeIsBitField: false,
  fieldBits: null,
  beforeRegisterMember: null,
  beforeRegister: null,
  registerMember: null,
});

const chain = (written: string, kinds: string[]): TExpression =>
  ({
    kind: "postfix",
    written,
    ops: kinds.map((kind) => ({ kind }) as unknown as TPostfixOpSyntax),
  }) as unknown as TExpression;

describe("SubscriptDepthValidator.validate", () => {
  it("accepts one bit index on a scalar u8", () => {
    expect(() =>
      SubscriptDepthValidator.validate(chain("flags[4]", ["subscript"]), [
        step(value("u8")),
      ]),
    ).not.toThrow();
  });

  it("asserts on a second subscript on a scalar u8", () => {
    expect(() =>
      SubscriptDepthValidator.validate(
        chain("flags[4][3]", ["subscript", "subscript"]),
        [step(value("u8")), step(null)],
      ),
    ).toThrow(
      /'flags\[4\]\[3\]' is subscripted no deeper than its shape allows/,
    );
  });

  it("measures a struct field's run by the field's own type (#1114)", () => {
    const steps = [step(value("Packet")), step(value("u8")), step(null)];
    expect(() =>
      SubscriptDepthValidator.validate(
        chain("p.header[4][3]", ["member", "subscript", "subscript"]),
        steps,
      ),
    ).toThrow(/E0856 rejects this in pass 2\.1/);
    expect(() =>
      SubscriptDepthValidator.validate(
        chain("p.header[4]", ["member", "subscript"]),
        steps.slice(0, 2),
      ),
    ).not.toThrow();
  });

  it("does not measure a value the limit does not cover", () => {
    expect(() =>
      SubscriptDepthValidator.validate(
        chain("p[1][2][3]", ["subscript", "subscript", "subscript"]),
        [step(value("Point")), step(null), step(null)],
      ),
    ).not.toThrow();
  });

  it("ignores an expression that is not a chain", () => {
    expect(() =>
      SubscriptDepthValidator.validate(
        { kind: "identifier", name: "x" } as unknown as TExpression,
        [],
      ),
    ).not.toThrow();
  });
});
