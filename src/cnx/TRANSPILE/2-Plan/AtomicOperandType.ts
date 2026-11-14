import type IAtomicAccess from "../../types/IAtomicAccess";
import type IOperandType from "../../types/IOperandType";
import invariant from "../../utils/invariant";
import ClampTypes from "./ClampTypes";
import FloatBitType from "./FloatBitType";
import TYPE_MAP from "./types/TYPE_MAP";

/**
 * ADR-049 (#1807, #2155 review 8): the C type a retry loop holds an atomic
 * write's value in (`__operand`), decided once in 2.2 for every atomic write,
 * so hoisting the value narrows nothing the inline form would not (#2120
 * review 2).
 */
class AtomicOperandType {
  /**
   * A bit, bit-range or bitmap-field write: one bit is a `bool`; a float's
   * bits are its bits' unsigned integer; wider bits keep the value's own C
   * type, as the inline form does (`valueCType`), or the atomic's when the
   * value has none.
   */
  static ofBits(
    access: IAtomicAccess,
    oneBit: boolean,
    floating: boolean,
    valueCType: string | null,
  ): string {
    if (oneBit) return "bool";
    if (floating) {
      invariant(access.typeName !== null, "a float is a cnx type");
      return FloatBitType.of(access.typeName);
    }
    return valueCType ?? access.cType;
  }

  /**
   * A compound write: an overflow helper's `b` is its type's wider type
   * (`ClampTypes`, #94: `cnx_clamp_add_u8(0, 256)` must give 255), for every
   * helper `OverflowHelperTemplates` writes, clamp or wrap, `+` to `%` (#1790
   * review); any other value is held
   * in the type the inline form computes it in (`valueCType`), as `v %<- d`
   * divides by all of `d` and `f32 +<- d * 2.0` keeps the double (#2250,
   * #2155 review 9) -- or the atomic's when the value has none.
   */
  static ofCompound(
    access: IAtomicAccess,
    helperType: string | null,
    valueCType: string | null,
  ): string {
    if (helperType !== null) {
      return ClampTypes.resolve(helperType)?.widerType ?? access.cType;
    }
    return valueCType ?? access.cType;
  }

  /**
   * The C type the inline form computes a written value in: its typed C
   * type; a constant the typer gives none (`200`) in the unsigned type that
   * holds it, no narrower than the atomic -- never a signed atomic's type
   * (`int8_t __operand = 200U` is implementation-defined, C11 6.3.1.3p3); a
   * negative constant in the atomic's type. Null when nothing gives it one.
   */
  static valueCTypeOf(
    value: IOperandType | null,
    folded: number | undefined,
    access: IAtomicAccess,
  ): string | null {
    const typed =
      value?.typeName === null || value?.typeName === undefined
        ? undefined
        : TYPE_MAP[value.typeName];
    const literal = value?.form.kind === "literal";
    if (typed !== undefined && (!literal || value?.category === "floating")) {
      return typed;
    }
    if (folded !== undefined && Number.isInteger(folded)) {
      if (folded < 0) return access.cType;
      const least = Math.max(
        AtomicOperandType.bitsFor(folded),
        access.bits ?? 8,
      );
      const unsigned = [8, 16, 32, 64].find((bits) => bits >= least) ?? 64;
      return TYPE_MAP[`u${unsigned}`];
    }
    return typed ?? value?.cType ?? null;
  }

  private static bitsFor(n: number): number {
    return n === 0 ? 1 : Math.floor(Math.log2(n)) + 1;
  }
}

export default AtomicOperandType;
