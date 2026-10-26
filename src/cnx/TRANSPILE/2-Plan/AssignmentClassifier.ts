/**
 * Assignment classifier for dispatch-based code generation (ADR-065).
 *
 * Analyzes an assignment context and determines which AssignmentKind it is.
 */
import AssignmentKind from "../../types/AssignmentKind";
import IAssignmentContext from "./types/IAssignmentContext";
import invariant from "../../utils/invariant";
import TTypeInfo from "../../types/TTypeInfo";
import type TOverflowBehavior from "../../types/TOverflowBehavior";
import type IOperandType from "../../types/IOperandType";
import OperandTyper from "../../utils/OperandTyper";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import CompoundOperator from "../../utils/CompoundOperator";
import CLAMP_HELPER_FOR_OPERATOR from "../../types/CLAMP_HELPER_FOR_OPERATOR";

/**
 * Classifies assignment statements by analyzing their structure. What is
 * asked first is `classify()`'s numbered priorities, in one place.
 */
class AssignmentClassifier {
  /**
   * Classify an assignment context into an AssignmentKind.
   */
  static classify(ctx: IAssignmentContext): AssignmentKind {
    // #1782: a whole array given its list, whatever the target's shape
    if (ctx.plannedWholeArray !== null) {
      return AssignmentKind.WHOLE_ARRAY;
    }

    // === Priority 0: Atomic/overflow compound assignments ===
    // #1411/#1887: asked before any shape, because a field or an element
    // saturates like a variable does; the shape kinds below write `+=`.
    const specialKind = AssignmentClassifier.classifySpecialCompound(ctx);
    if (specialKind !== null) {
      return specialKind;
    }

    // === Priority 1: A write of one string<N> is a bounded copy (#1731) ===
    // Asked before any shape: what decides it is the type the target writes,
    // and the shape rules below would claim `this.cfg.name` or
    // `parr[1].name` first. 2.2 planned it (`OperandTyper.stringCopyCapacity`).
    if (ctx.plannedStringCapacity !== null) {
      return AssignmentKind.STRING_COPY;
    }

    // === Priority 2: Bitmap field assignments ===
    const bitmapKind = AssignmentClassifier.classifyBitmapField(ctx);
    if (bitmapKind !== null) {
      return bitmapKind;
    }

    // === Priority 1b: A register member's bit or bit range ===
    const registerBitKind = AssignmentClassifier.classifyRegisterBit(ctx);
    if (registerBitKind !== null) {
      return registerBitKind;
    }

    // === Priority 3: Member access with subscripts (arrays) ===
    const memberSubscriptKind =
      AssignmentClassifier.classifyMemberWithSubscript(ctx);
    if (memberSubscriptKind !== null) {
      return memberSubscriptKind;
    }

    // === Priority 4: Global/this prefix patterns ===
    const prefixKind = AssignmentClassifier.classifyPrefixPattern(ctx);
    if (prefixKind !== null) {
      return prefixKind;
    }

    // === Priority 5: Simple array/bit access ===
    const arrayBitKind = AssignmentClassifier.classifyArrayOrBitAccess(ctx);
    if (arrayBitKind !== null) {
      return arrayBitKind;
    }

    // === Priority 6: Member chain fallback ===
    // Any member access with subscripts that didn't match a more specific pattern
    if (ctx.hasMemberAccess && ctx.hasArrayAccess) {
      return AssignmentKind.MEMBER_CHAIN;
    }

    // === Fallback: Simple assignment ===
    return AssignmentKind.SIMPLE;
  }

  /**
   * #1749: a field of a bitmap -- `flags.A`, `gss[1].fl.Mode`, `Sc.ps.fls[1].A`,
   * `this.fl.A`, `MOTOR.CTRL.Mode` -- is the typer's answer for the chain's last
   * step, whatever spells its prefix. A register member only changes which
   * handler writes it: ADR-004 writes a member per its access, not by a
   * read-modify-write (#2158), and the typer names the member.
   */
  private static classifyBitmapField(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (ctx.bitmapField === null) {
      return null;
    }
    return ctx.target.last!.beforeRegisterMember === null
      ? AssignmentKind.BITMAP_FIELD
      : AssignmentKind.REGISTER_MEMBER_BITMAP_FIELD;
  }

  /**
   * Classify member access with subscripts.
   * Patterns: arr[i][j], struct.arr[i], matrix[i][j][bit]
   */
  private static classifyMemberWithSubscript(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Need subscripts through memberAccess pattern
    if (!ctx.hasMemberAccess || ctx.subscriptCount === 0) {
      return null;
    }

    // Skip this.* and global.* patterns - they're handled by classifyPrefixPattern
    if (ctx.hasThis || ctx.hasGlobal) {
      return null;
    }

    const ids = ctx.identifiers;
    const typeInfo = ctx.target.rootTypeInfo;

    // A register's bits were classified before this, by `classifyRegisterBit`:
    // a bit range is two expressions in ONE op, so the struct-chain branch
    // below would claim `REG.MEMBER[start, width]` (#1244, #1052).

    // Bare `Scope.member[...]`: the fourth ADR-016 spelling (#1116). A bare
    // name resolves through ADR-057's tiers, so `resolvesBareName` is true.
    const scopeQualifiedKind =
      AssignmentClassifier.classifyScopeQualifiedSubscript(ctx, true);
    if (scopeQualifiedKind !== null) {
      return scopeQualifiedKind;
    }

    // Check for bit range through struct chain: devices[0].control[0, 4]
    // Detected by last subscript having 2 expressions (start, width)
    if (ctx.lastSubscriptExprCount === 2) {
      return AssignmentKind.STRUCT_CHAIN_BIT_RANGE;
    }

    // Multi-dimensional array element: arr[i][j] (1 identifier, multiple subscripts)
    if (ids.length === 1) {
      return AssignmentClassifier.classifyMultiDimArrayAccess(
        typeInfo,
        ctx.subscriptCount,
      );
    }

    return null;
  }

  /**
   * Classify multi-dimensional array access: arr[i][j] or arr[i][j][bit]
   */
  private static classifyMultiDimArrayAccess(
    typeInfo: TTypeInfo | undefined,
    subscriptCount: number,
  ): AssignmentKind | null {
    if (!typeInfo?.isArray || !typeInfo.arrayDimensions) {
      return null;
    }

    const numDims = typeInfo.arrayDimensions.length;

    // Check for bit indexing on array element
    if (
      subscriptCount === numDims + 1 &&
      TypeCheckUtils.isInteger(typeInfo.baseType)
    ) {
      return AssignmentKind.ARRAY_ELEMENT_BIT;
    }

    return AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;
  }

  /**
   * ADR-004: a bit or bit range of a register member -- `R.M[b]`, a scope's
   * own bare `R.M[b]`, `this.R.M[b]`, `S.R.M[b]`, `global.R.M[b]` -- is the
   * typer's answer for the chain's last step: a subscript whose prefix is a
   * register member. The member's access decides the write, so how the
   * register was spelled must not (#2185: a bare in-scope `PWM.FLAGS[0]` on a
   * `w1c` member was read-modify-written).
   */
  private static classifyRegisterBit(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    const step = ctx.target.last;
    if (!step?.beforeRegisterMember) {
      return null;
    }
    switch (step.subscript) {
      case "bit_single":
        return AssignmentKind.REGISTER_BIT;
      case "bit_range":
        return AssignmentKind.REGISTER_BIT_RANGE;
      default:
        return null;
    }
  }

  /**
   * Classify global.* and this.* prefix patterns.
   */
  private static classifyPrefixPattern(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.hasGlobal && !ctx.hasThis) {
      return null;
    }

    if (ctx.hasGlobal && ctx.postfixOpsCount > 0) {
      return AssignmentClassifier.classifyGlobalPrefix(ctx);
    }

    if (ctx.hasThis && ctx.postfixOpsCount > 0) {
      return AssignmentClassifier.classifyThisPrefix(ctx);
    }

    return null;
  }

  /**
   * Classify global.* patterns: global.reg[bit], global.arr[i], global.member
   */
  private static classifyGlobalPrefix(ctx: IAssignmentContext): AssignmentKind {
    if (ctx.hasArrayAccess) {
      // A register's bits (`global.REG.MEMBER[bit]`) were classified before
      // this, by the one rule every spelling takes (#1244, #2185).

      // Scope-qualified variable: global.Scope.member[...]. Shared with the
      // bare spelling — see classifyScopeQualifiedSubscript.
      const scopeQualifiedKind =
        AssignmentClassifier.classifyScopeQualifiedSubscript(ctx, false);
      if (scopeQualifiedKind !== null) {
        return scopeQualifiedKind;
      }

      // Issue #1115: when the subscript applies to the named VARIABLE,
      // `global.x[...]` means exactly what `x[...]` means, so it makes the same
      // decision. This branch used to return GLOBAL_ARRAY for every non-register
      // target without consulting SubscriptClassifier at all, which emitted the
      // raw subscript chain and broke every operation:
      //   global.buf[3][1] <- true  ->  buf[3][1] = true      (indexes a u8)
      //   global.s[0, 4] <- magic   ->  s[0, 4] = magic       (C comma operator)
      //   global.f[4, 3] <- 5       ->  f[4, 3] = 5           (C comma operator)
      // Cross-scope visibility is still enforced: the check runs during
      // `generateAssignmentTarget` (MemberSeparatorResolver), not in the
      // GLOBAL_ARRAY handler, so it applies to the delegated kinds too.
      if (ctx.identifiers.length === 1) {
        return AssignmentClassifier.classifySubscriptAccess(ctx);
      }

      // Member chain (`global.config.items[0].assigned`): the subscript applies
      // to a struct field, not to `config`, so the general variable-subscript
      // classification does not apply. Handled as a chain.
      return AssignmentKind.GLOBAL_ARRAY;
    }

    return AssignmentKind.GLOBAL_MEMBER;
  }

  /**
   * Decide a subscript chain whose base name is scope-qualified:
   * `Scope.member[...]`. A register's bits were classified before this, by
   * the typer's step (#2185).
   *
   * Issue #1244: the `global.` prefix is a grammar token, not an identifier, so
   * `global.Other.buffer[3]` and the bare `Other.buffer[3]` arrive with
   * identical `ctx.identifiers` and mean the same thing. They are therefore ONE
   * decision, made here for both spellings.
   *
   * The bare spelling used to reach none of this. It landed in
   * `classifyMemberWithSubscript`, which had no scope-resolution step at all,
   * so the struct-chain branch claimed every bit range before the register or
   * the variable was ever recognized — emitting `Hw_GPIO_Mode.GPIO.Mode`
   * (#1244), `Other_flags.flags` on a scalar (#1116), and a 4-byte slice copy
   * silently rewritten as a 4-bit mask/shift.
   *
   * The ADR-057 precondition lives HERE rather than in each caller. When it sat
   * in the callers, the bare one gated on a lookup that silently covered only
   * two of the three tiers, and the `global.` one gated on nothing — the two
   * spellings shared the mechanism while each derived its own entry condition,
   * which is the divergence this method exists to remove.
   *
   * @param resolvesBareName Whether the base name goes through ADR-057's
   *        local -> scope -> global order. False for `global.`, which names the
   *        global tier outright and must not be shadowed by a nearer variable.
   * @returns null when the base is not a scope-qualified name, leaving the
   *          caller's remaining cases (member chains, plain globals) untouched
   */
  private static classifyScopeQualifiedSubscript(
    ctx: IAssignmentContext,
    resolvesBareName: boolean,
  ): AssignmentKind | null {
    const ids = ctx.identifiers;
    const scopeName = ids[0];
    if (!ctx.state.isKnownScope(scopeName)) {
      return null;
    }

    // ADR-057: a variable of that name at any tier wins, so the target is a
    // struct chain rather than a scope reference -- the binder's local ->
    // scope -> global order, applied where the target is (#1668)
    if (resolvesBareName && ctx.target.rootTypeInfo !== undefined) {
      return null;
    }

    // Only the variable case remains: registers are decided by
    // classifyRegisterBit, which `classify` asks before this method.
    // Once `Scope.member` resolves, this is exactly the decision the bare
    // `member[...]` spelling makes, so it delegates rather than re-deriving it.
    if (ids.length === 2) {
      return AssignmentClassifier.classifySubscriptAccess(ctx);
    }

    return null;
  }

  /**
   * Classify this.* patterns: this.arr[i], this.flags[bit], this.member. A
   * register's bits and a bitmap's fields were classified before this.
   */
  private static classifyThisPrefix(ctx: IAssignmentContext): AssignmentKind {
    if (ctx.scopePath && ctx.hasArrayAccess) {
      return AssignmentClassifier.classifyThisWithArrayAccess(ctx);
    }
    return AssignmentKind.THIS_MEMBER;
  }

  /**
   * Classify this.reg[bit] / this.arr[i] / this.flags[3] patterns with array access.
   * Issue #954: array vs bit access is the typer's subscript kind (#1668, C12).
   *
   * Issue #1115: this is the same decision the bare path makes, so it
   * delegates rather than re-deriving it — this method used to carry a
   * truncated copy of that switch, which silently lost ARRAY_ELEMENT_BIT,
   * ARRAY_SLICE, MULTI_DIM_ARRAY_ELEMENT and string element writes for `this.`
   * targets. A scope's register is no longer `this.`-specific either (#2185).
   */
  private static classifyThisWithArrayAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind {
    return AssignmentClassifier.classifySubscriptAccess(ctx);
  }

  /**
   * Classify simple array/bit access (no prefix, no member access).
   * Pattern: arr[i] or flags[bit]
   *
   * Issue #579: the subscript's kind is the typer's, the same one the
   * expression path reads (#1668, C12).
   */
  private static classifyArrayOrBitAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    // Must have arrayAccess without memberAccess or prefix
    if (ctx.hasGlobal || ctx.hasThis || ctx.hasMemberAccess) {
      return null;
    }

    if (!ctx.hasArrayAccess || ctx.subscriptCount === 0) {
      return null;
    }

    return AssignmentClassifier.classifySubscriptAccess(ctx);
  }

  /**
   * Decide what a subscript chain on a single variable means.
   *
   * Issue #1115: the SINGLE source of truth for that decision. `arr[i]` and
   * `this.arr[i]` differ only in how the base name resolves — once resolved,
   * the type lookup, depth validation and array-vs-bit classification are
   * identical, and the handlers already share generation (THIS_BIT and
   * INTEGER_BIT both map to `handleIntegerBit`, since `resolvedTarget` and
   * `resolvedBaseIdentifier` already carry the scope prefix). Keeping two
   * copies of this switch is what let the `this.` form diverge.
   *
   * #1668 (C7): the variable is the target's binding, so its spelling no
   * longer matters here -- only the diagnostic's.
   */
  private static classifySubscriptAccess(
    ctx: IAssignmentContext,
  ): AssignmentKind {
    // A chain that ends in a member (`this.buffer[i].value`) writes that
    // member, and its subscripts index on the way there -- a member chain, as
    // the bare spelling `buffer[i].value` is. The rules below are about a
    // FINAL subscript; this reached them and was classified by the
    // classifier's default for an unknown type, whose handler wrote the right
    // text by coincidence (#1668 review).
    const last = ctx.target.last;
    if (last?.subscript === null) {
      return AssignmentKind.MEMBER_CHAIN;
    }

    // #1668 (C12): what the final subscript reads, and so whether it is an
    // element, a slice, a bit or a bit range, is the one operand typer's
    // answer -- the one 2.1 already checked. Classifying from the ROOT's type
    // called `row[2][0, 4]` a slice of `row`, and a valid program failed with
    // an internal error. The typer types every subscript it walks, an
    // untyped value's included (the classifier's default for an unknown type).
    const subscriptKind = last?.subscript ?? null;
    invariant(
      subscriptKind !== null,
      "the typer typed this target's final subscript",
    );
    // The subscripts are flattened, so anything before the final op's own
    // expressions indexed an array element first
    const indexesAnElement = ctx.subscriptCount > ctx.lastSubscriptExprCount;

    switch (subscriptKind) {
      case "bit_single":
        if (!indexesAnElement) return AssignmentKind.INTEGER_BIT;
        // e.g. matrix[i][j][bit] on an integer array's element
        return OperandTyper.hasWritableBits(last?.before ?? null)
          ? AssignmentKind.ARRAY_ELEMENT_BIT
          : AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;

      case "bit_range":
        return indexesAnElement
          ? AssignmentKind.ARRAY_ELEMENT_BIT_RANGE
          : AssignmentKind.INTEGER_BIT_RANGE;

      case "array_element":
        // Multi-dimensional array: matrix[i][j] has multiple subscript operations
        // but each with 1 expression (vs slice [0, 5] with 2 expressions in 1 op)
        if (ctx.subscriptCount > 1) {
          return AssignmentKind.MULTI_DIM_ARRAY_ELEMENT;
        }
        return AssignmentKind.ARRAY_ELEMENT;

      case "array_slice":
        return AssignmentKind.ARRAY_SLICE;
    }
  }

  /**
   * Classify atomic and overflow-clamped compound assignments. Atomics are
   * the writes 2.2 planned atomic, however the target spells them (#1179); a
   * clamp is any target that writes a `clamp` integer.
   */
  private static classifySpecialCompound(
    ctx: IAssignmentContext,
  ): AssignmentKind | null {
    if (!ctx.isCompound) {
      return null;
    }

    // ADR-049: 2.2 planned which writes are atomic read-modify-writes
    if (ctx.atomic !== null) {
      return AssignmentKind.ATOMIC_RMW;
    }

    if (AssignmentClassifier.compoundClamp(ctx) !== null) {
      return AssignmentKind.OVERFLOW_CLAMP;
    }

    return null;
  }

  /**
   * ADR-044: the saturating helper operation (`add`, `sub`, `mul`) that a
   * compound assignment lowers to, or null when it is plain C arithmetic.
   *
   * Only a `clamp` integer target qualifies, and only for the arithmetic
   * operators that can overflow; a bitwise compound cannot, so it stays plain.
   * This is the one decision: the classifier asks it to pick OVERFLOW_CLAMP,
   * the overflow handler asks it for the helper, and the atomic handler asks it
   * for the inner operation of its read-modify-write. The atomic generator used
   * to decide the same thing from its own operator map and its own integer test.
   *
   * #1668: null when the value has a floating operand. `y *<- 2.5` is
   * `y <- y * 2.5`, and routing it into `cnx_clamp_mul_u32` truncated the 2.5
   * to 2 before multiplying.
   *
   * `cnxType` is the type the helper saturates at: the written value's.
   */
  static compoundClamp(
    ctx: IAssignmentContext,
  ): { operation: string; cnxType: string } | null {
    return ctx.plannedClamp;
  }

  /**
   * 2.2's one decision behind `compoundClamp`: the helper a compound `cOp`
   * write calls, from the type the write stores -- the typer's
   * `OperandTyper.writtenType`, which the string copy reads too (#1731 review).
   * A field (`p.x`) or an element (`levels[1]`) carries its own overflow
   * behavior (#1411, #1887), and a whole array is no integer the clamp
   * can saturate.
   */
  static clampOfWrite(
    written: IOperandType | null,
    cnxOp: string,
    hasFloatingOperand: () => boolean,
  ): { operation: string; cnxType: string } | null {
    if (written?.typeName == null || written.dimensions.length > 0) {
      return null;
    }
    return AssignmentClassifier.clampOf(
      written.typeName,
      written.overflow,
      cnxOp,
      hasFloatingOperand,
    );
  }

  /** ADR-044: the clamp helper a compound `cnxOp` write of this type calls, or null */
  static clampOf(
    baseType: string,
    overflowBehavior: TOverflowBehavior | null,
    cnxOp: string,
    hasFloatingOperand: () => boolean,
  ): { operation: string; cnxType: string } | null {
    if (overflowBehavior !== "clamp") return null;
    if (!TypeCheckUtils.isInteger(baseType)) return null;
    if (hasFloatingOperand()) return null;
    const operator = CompoundOperator.binaryOf(cnxOp);
    const operation =
      operator === null ? undefined : CLAMP_HELPER_FOR_OPERATOR[operator];
    return operation ? { operation, cnxType: baseType } : null;
  }
}

export default AssignmentClassifier;
