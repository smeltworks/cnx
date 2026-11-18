import type IChainStep from "../types/IChainStep";
import type IChainHead from "../types/IChainHead";
import invariant from "./invariant";

/**
 * ADR-007: whether a subscript reaches a float's bits, which C
 * cannot shift or mask, so they go through a union. Asked of the value the
 * subscript applies to -- the typer's step -- never of the chain's root, which
 * a field, an element or a `this.`/`global.` member is not (#2057, #1099). 2.1's
 * E0888 and 2.2's float-bit and narrowing plans ask this one function.
 */
class FloatBits {
  /** The float's cnx type, or null when the step reads no float's bits */
  static typeOf(step: IChainStep | undefined): string | null {
    if (step?.subscript !== "bit_range") return null;
    if (step.before?.category !== "floating") return null;
    invariant(step.before.typeName !== null, "the typer names a float's type");
    return step.before.typeName;
  }

  /**
   * Whether the bits at `head.ops[index]` go through the variable's shadow
   * union, shared by its every bit read and write and invalidated by a write
   * of the whole variable -- a write that names it the same way. Only a bare
   * variable has one: a `this.`/`global.` member is written under another
   * name, so its shadow went stale (#2057), and a field or element has no
   * name of its own. Any other float is copied into a union of its own.
   */
  static sharesShadow(head: IChainHead, index: number): boolean {
    return head.root === null && head.identifier !== null && index === 0;
  }
}

export default FloatBits;
