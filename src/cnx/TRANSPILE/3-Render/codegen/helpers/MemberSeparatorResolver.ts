/**
 * Member Separator Resolver
 *
 * Decides how each member step of an access chain joins, and spells it:
 * - scope member access joins into one identifier through the encoder
 *   (Motor.speed -> Motor__speed, ADR-016)
 * - register field access joins into one identifier
 *   (GPIO7.DR_SET -> GPIO7__DR_SET)
 * - `.` for struct member access (point.x -> point.x)
 * - `->` for struct parameter member access in C mode
 * - `::` for C++ namespace/class access
 *
 * The decision is a `TMemberStep`, not a separator string, so `__` is spelled
 * only in `join` (#2116).
 *
 * Issue #387, #409, ADR-016
 */

import ISeparatorContext from "../types/ISeparatorContext";
import IMemberSeparatorDeps from "../types/IMemberSeparatorDeps";
import QualifiedCName from "../../../../utils/QualifiedCName";
import invariant from "../../../../utils/invariant";
import type IRootHolding from "../types/IRootHolding";
import type TMemberStep from "../types/TMemberStep";

/**
 * Input parameters for building a separator context
 */
interface IBuildContextInput {
  firstId: string;
  hasGlobal: boolean;
  hasThis: boolean;
  currentScopePath: string;
  /** How the root is held (`memberAccessChain.rootHolding`) */
  holding: IRootHolding;
  isCppAccess: boolean;
}

/**
 * Static utility for resolving member access separators
 */
class MemberSeparatorResolver {
  private static readonly REGISTER_MEMBER: TMemberStep = {
    kind: "register-member",
  };
  private static readonly ACCESS_DOT: TMemberStep = {
    kind: "access",
    separator: ".",
  };
  private static readonly ACCESS_CPP: TMemberStep = {
    kind: "access",
    separator: "::",
  };

  /**
   * Build the separator context for a member access chain
   */
  static buildContext(
    input: IBuildContextInput,
    deps: IMemberSeparatorDeps,
  ): ISeparatorContext {
    const {
      firstId,
      hasGlobal,
      hasThis,
      currentScopePath,
      holding,
      isCppAccess,
    } = input;
    const isCrossScope =
      hasGlobal &&
      (deps.isKnownScope(firstId) || deps.isKnownRegister(firstId));

    const scopedRegName =
      hasThis && currentScopePath
        ? (deps.memberCName(currentScopePath, firstId) ?? null)
        : null;

    const isScopedRegister =
      scopedRegName !== null && deps.isKnownRegister(scopedRegName);

    return {
      isCrossScope,
      holding,
      isCppAccess,
      scopedRegName,
      isScopedRegister,
    };
  }

  /**
   * How the first member access operation joins
   */
  static firstStep(
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    // C++ namespace/class access
    if (ctx.isCppAccess) {
      return MemberSeparatorResolver.ACCESS_CPP;
    }

    // A struct parameter uses -> in C mode, . in C++ mode, and a callback-
    // promoted parameter or a local #895 made a pointer takes -> in both --
    // decided by the one helper the read path asks too (#1760 review)
    if (ctx.holding.isStructParam || ctx.holding.isPointerLocal) {
      return {
        kind: "access",
        separator: deps.rootMemberSeparator(ctx.holding),
      };
    }

    // Cross-scope access (global.Scope.member or global.Register.member)
    if (ctx.isCrossScope) {
      return deps.isKnownRegister(identifierChain[0])
        ? MemberSeparatorResolver.REGISTER_MEMBER
        : MemberSeparatorResolver.scopeMember(identifierChain, deps);
    }

    // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
    if (deps.isKnownRegister(identifierChain[0])) {
      // #1322: the shadowed-register check that stood here is E0437 in pass
      // 2.1 (ADR-016); codegen only spells the C name.
      return MemberSeparatorResolver.REGISTER_MEMBER;
    }

    // Scope member access: Sensor.buffer -> Sensor_buffer
    // Works with or without global. prefix (both are valid syntax)
    if (deps.isKnownScope(identifierChain[0])) {
      // #1322: the cross-scope visibility check that stood here -- with its
      // #779 exemption for a scoped register -- is E0435/E0436 in pass 2.1,
      // where the same exemption is stated once for all three positions.
      return MemberSeparatorResolver.scopeMember(identifierChain, deps);
    }

    // Scoped register: this.MOTOR_REG.SPEED -> Scope_MOTOR_REG_SPEED
    if (ctx.isScopedRegister) {
      return MemberSeparatorResolver.REGISTER_MEMBER;
    }

    // Default: struct field access
    return MemberSeparatorResolver.ACCESS_DOT;
  }

  /** `Scope.member` as the C name 3-Declare gave the member (#2116) */
  private static scopeMember(
    identifierChain: string[],
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    const cName = deps.memberCName(identifierChain[0], identifierChain[1]);
    invariant(cName !== undefined, "2.1 rejects a member its scope lacks");
    return { kind: "scope-member", cName };
  }

  /**
   * How each member access operation after the first joins
   */
  static subsequentStep(
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    // Check for register chains
    const chainSoFar = QualifiedCName.fromSourceName(
      identifierChain.slice(0, -1),
    );
    const isRegisterChain =
      deps.isKnownRegister(identifierChain[0]) ||
      deps.isKnownRegister(chainSoFar) ||
      (ctx.scopedRegName !== null && deps.isKnownRegister(ctx.scopedRegName));

    return isRegisterChain
      ? MemberSeparatorResolver.REGISTER_MEMBER
      : MemberSeparatorResolver.ACCESS_DOT;
  }

  /**
   * How a member access operation joins, by its position in the chain
   */
  static step(
    isFirstOp: boolean,
    identifierChain: string[],
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    if (isFirstOp) {
      return MemberSeparatorResolver.firstStep(identifierChain, ctx, deps);
    }
    return MemberSeparatorResolver.subsequentStep(identifierChain, ctx, deps);
  }

  /**
   * `result` with `member` joined by `step`: the one place a member access
   * chain spells a qualified C name. A scope member is the C name its step
   * carries; a register member joins its owner's C name (ADR-016).
   */
  static join(result: string, step: TMemberStep, member: string): string {
    switch (step.kind) {
      case "scope-member":
        return step.cName;
      case "register-member":
        return `${result}${QualifiedCName.SEPARATOR}${member}`;
      case "access":
        return `${result}${step.separator}${member}`;
    }
  }
}

export default MemberSeparatorResolver;
