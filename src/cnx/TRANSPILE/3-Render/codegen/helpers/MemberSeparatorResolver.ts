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
 * The decision is a `TMemberStep`, not a separator string. A scope or register
 * member's step carries the C name 3-Declare gave it, so nothing here spells
 * `__` (#2116).
 *
 * Issue #387, #409, ADR-016
 */

import ISeparatorContext from "../types/ISeparatorContext";
import IMemberSeparatorDeps from "../types/IMemberSeparatorDeps";
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
    owner: string,
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
        ? MemberSeparatorResolver.registerMember(owner, identifierChain, deps)
        : MemberSeparatorResolver.scopeMember(identifierChain, deps);
    }

    // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
    if (deps.isKnownRegister(identifierChain[0])) {
      // #1322: the shadowed-register check that stood here is E0437 in pass
      // 2.1 (ADR-016); codegen only spells the C name.
      return MemberSeparatorResolver.registerMember(
        owner,
        identifierChain,
        deps,
      );
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
      return MemberSeparatorResolver.registerMember(
        owner,
        identifierChain,
        deps,
      );
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

  /** `owner.member` as the C name 3-Declare gave the register member (#2116) */
  private static registerMember(
    owner: string,
    identifierChain: string[],
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    const member = identifierChain.at(-1)!;
    const cName = deps.registerMemberCName(owner, member);
    invariant(
      cName !== undefined,
      `2.1 rejects a member register '${owner}' lacks (missing '${member}')`,
    );
    return { kind: "register-member", cName };
  }

  /**
   * How each member access operation after the first joins. Only a member of
   * a register joins into one identifier; `owner` is already the register's C
   * name (`Motor__CTRL`), so nothing rebuilds it from the chain. A field of a
   * register member (`UART.CTRL.Enable`) is a bitmap field, not a register
   * member.
   */
  static subsequentStep(
    identifierChain: string[],
    owner: string,
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    return deps.isKnownRegister(owner)
      ? MemberSeparatorResolver.registerMember(owner, identifierChain, deps)
      : MemberSeparatorResolver.ACCESS_DOT;
  }

  /**
   * How a member access operation joins, by its position in the chain
   */
  static step(
    isFirstOp: boolean,
    identifierChain: string[],
    owner: string,
    ctx: ISeparatorContext,
    deps: IMemberSeparatorDeps,
  ): TMemberStep {
    if (isFirstOp) {
      return MemberSeparatorResolver.firstStep(
        identifierChain,
        owner,
        ctx,
        deps,
      );
    }
    return MemberSeparatorResolver.subsequentStep(identifierChain, owner, deps);
  }

  /**
   * `result` with `member` joined by `step`. A scope or register member is
   * the C name its step carries (ADR-016); any other step keeps its C
   * operator between the two.
   */
  /** `result::member`, a C++ access chain's next step, spelled by `join` */
  static cppAccess(result: string, member: string): string {
    return MemberSeparatorResolver.join(
      result,
      MemberSeparatorResolver.ACCESS_CPP,
      member,
    );
  }

  static join(result: string, step: TMemberStep, member: string): string {
    switch (step.kind) {
      case "scope-member":
      case "register-member":
        return step.cName;
      case "access":
        return `${result}${step.separator}${member}`;
    }
  }
}

export default MemberSeparatorResolver;
