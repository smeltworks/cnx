import StructInitializerType from "./StructInitializerType";
import ValuePositions from "./ValuePositions";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import type IValuePositions from "../../../types/IValuePositions";
import type TExpression from "../../../types/syntax/TExpression";

/** Where a value is written into a `string<N>` other than by `<-` or a declaration */
type TStringWrite = "argument" | "field" | "return";

/**
 * ADR-045: each argument, struct-initializer field value and returned value
 * that lands in a `string<N>`, and its capacity, read from where the value
 * stands (#2236, #2239, #1209: a return fills the caller's buffer). 2.1's E0864 and 2.2's lowering both iterate this, so the capacity
 * a value is checked against is the one it is built at (#2160 review).
 */
class StringWriteSites {
  static *of(positions: IValuePositions): Generator<{
    readonly value: TExpression;
    readonly write: TStringWrite;
    readonly capacity: number;
  }> {
    for (const [value, at] of positions.sites) {
      const write = StringWriteSites.writeAt(value, at.site);
      if (write === null) continue;
      const position = ValuePositions.at(positions.positions, value);
      if (position.inList) continue;
      const target = StructInitializerType.valueTypeAt(position);
      const capacity =
        target === null ? null : TypeCheckUtils.sizedStringCapacity(target);
      if (capacity !== null) yield { value, write, capacity };
    }
  }

  /** The kind of write `value` is at its own site, or null */
  private static writeAt(
    value: TExpression,
    site: IValuePositions["sites"] extends ReadonlyMap<TExpression, infer S>
      ? S extends { readonly site: infer T }
        ? T
        : never
      : never,
  ): TStringWrite | null {
    if (site.kind === "field") {
      return site.initializer.fields.some(
        (field) => field.name === site.field && field.value === value,
      )
        ? "field"
        : null;
    }
    if (site.kind === "return") return "return";
    if (site.kind !== "argument") return null;
    const call = site.call.ops[site.op];
    return call?.kind === "call" && call.arguments[site.argument] === value
      ? "argument"
      : null;
  }
}

export default StringWriteSites;
