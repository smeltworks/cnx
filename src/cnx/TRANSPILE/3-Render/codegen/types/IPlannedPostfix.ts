import type TPlannedPostfixOp from "./TPlannedPostfixOp";
import type IChainBase from "../../../../types/IChainBase";
import type TParameterInfo from "../../../../types/TParameterInfo";

/**
 * A postfix expression: a primary, and the operations applied to it.
 *
 * #1445 box 3: what the generator read off the tree was the op KINDS. They
 * are here, and the renders that used to be reached through the node are
 * thunks.
 */
interface IPlannedPostfix {
  /**
   * The primary's identifier, when it is one.
   *
   * Drives struct-parameter detection and the type-registry lookup, so it is
   * the source spelling rather than anything emitted.
   */
  readonly rootIdentifier: string | undefined;

  /** #1969: the parameter `rootIdentifier` binds to where it is written */
  readonly rootParameter: TParameterInfo | undefined;

  /**
   * The primary, unevaluated.
   *
   * Rendering it resolves a parameter dereference (Issue #1100) and can queue
   * a temp, so it happens where it happened before: after the plan is in hand,
   * before the depth check, and before any operation renders.
   */
  readonly renderPrimary: () => string;

  readonly ops: readonly TPlannedPostfixOp[];

  /**
   * #1668 (C7): what the chain's leading names bind -- the root, and the
   * variable its leading part reaches -- by the one operand typer
   */
  readonly base: IChainBase;
}

export default IPlannedPostfix;
