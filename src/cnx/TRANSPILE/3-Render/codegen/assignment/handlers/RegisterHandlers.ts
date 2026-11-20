/**
 * Register bit assignment handlers (ADR-065).
 *
 * Handles assignments to register bits:
 * - REGISTER_BIT: GPIO7.DR_SET[LED_BIT] <- true
 * - REGISTER_BIT_RANGE: GPIO7.DR_SET[0, 8] <- value
 * - REGISTER_MEMORY_MAPPED: Width-appropriate MMIO access
 *
 * However the register is spelled -- bare, a scope's own bare name, `this.`,
 * `Scope.` or `global.` -- the typer names the member (#2185).
 */
import AssignmentKind from "../../../../../types/AssignmentKind";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import DeclaredTypeFacts from "../../../../../utils/DeclaredTypeFacts";
import TAssignmentHandler from "./TAssignmentHandler";
import RegisterUtils from "./RegisterUtils";
import AssignmentHandlerUtils from "../../../../2-Plan/AssignmentHandlerUtils";
import invariant from "../../../../../utils/invariant";

/**
 * The C type a register member's bits are written in: a bitmap member's
 * backing integer (#2251: a bit of its field is a bit of it), else its own
 */
function storageOf(
  ctx: IAssignmentContext,
  memberName: string,
): string | undefined {
  const symbols = ctx.state.symbols!;
  const bitmap = DeclaredTypeFacts.registerMemberBitmap(symbols, memberName);
  if (bitmap !== null) return symbols.bitmapBackingType.get(bitmap) ?? bitmap;
  return symbols.registerMemberCTypes.get(memberName);
}

/**
 * A bit of a register member. A write-1 member (`wo`, `w1s`, `w1c`) is
 * written without being read, and takes the value it is given: a runtime
 * zero is written as one, which the hardware ignores (#1775).
 */
function writeRegisterBit(ctx: IAssignmentContext, memberName: string): string {
  const accessMod = ctx.state.symbols!.registerMemberAccess.get(memberName);
  const storage = storageOf(ctx, memberName);
  const bitIndex = ctx.renderSubscript(0);
  // ADR-072: `GPIO1__DR` for an instance, `port->DR` through a parameter
  const target = ctx.renderBitTarget();

  if (RegisterUtils.isWriteOnlyRegister(accessMod)) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.foldValue(),
      ctx.generatedValue,
      memberName,
      bitIndex,
    );
    return BitUtils.writeOnlySingleBit(
      target,
      bitIndex,
      ctx.generatedValue,
      storage,
      ctx.foldValue(),
    );
  }

  return BitUtils.singleBitWrite(
    target,
    bitIndex,
    ctx.generatedValue,
    storage,
    ctx.foldValue(),
  );
}

/**
 * A bit range of a register member. A write-1 member takes a plain write,
 * as a byte-aligned memory access when the range allows one.
 *
 * @param regName the register itself, whose base address the memory access uses
 */
function writeRegisterBitRange(
  ctx: IAssignmentContext,
  memberName: string,
  regName: string,
): string {
  const accessMod = ctx.state.symbols!.registerMemberAccess.get(memberName);
  const storage = storageOf(ctx, memberName);
  const start = ctx.renderSubscript(0);
  // With its fold (#1096): a register's `[0, W]` masked a runtime `1U << 32`
  const width = { text: ctx.renderSubscript(1), folded: ctx.foldSubscript(1) };
  const target = ctx.renderBitTarget();

  if (RegisterUtils.isWriteOnlyRegister(accessMod)) {
    AssignmentHandlerUtils.validateWriteOnlyValue(
      ctx.foldValue(),
      ctx.generatedValue,
      memberName,
      `${start}, ${width.text}`,
    );

    const mmio = RegisterUtils.tryGenerateMMIO(
      memberName,
      regName,
      ctx.plannedRegisterAccess,
      ctx.foldSubscript(0),
      ctx.generatedValue,
      ctx.state,
    );
    if (mmio.success) {
      return mmio.statement!;
    }

    return BitUtils.writeOnlyMultiBit(
      target,
      start,
      width,
      ctx.generatedValue,
      storage,
    );
  }

  return BitUtils.multiBitWrite(
    target,
    start,
    width,
    ctx.generatedValue,
    storage,
  );
}

/**
 * The register member the typer names, however the register was spelled --
 * `R.M`, a scope's own bare `R.M`, `this.R.M`, `S.R.M` (#2185)
 */
function memberOf(ctx: IAssignmentContext): string {
  const member = ctx.target.last?.beforeRegisterMember;
  invariant(member, "the classifier routes a register member's bits here");
  return member;
}

/**
 * Handle register single bit: GPIO7.DR_SET[LED_BIT] <- true
 */
function handleRegisterBit(ctx: IAssignmentContext): string {
  return writeRegisterBit(ctx, memberOf(ctx));
}

/**
 * Handle register bit range: GPIO7.DR_SET[0, 8] <- value
 */
function handleRegisterBitRange(ctx: IAssignmentContext): string {
  const register = ctx.target.last?.beforeRegister;
  invariant(register, "the typer names a register member's register");
  return writeRegisterBitRange(ctx, memberOf(ctx), register);
}

/**
 * All register handlers for registration.
 */
const registerHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.REGISTER_BIT, handleRegisterBit],
  [AssignmentKind.REGISTER_BIT_RANGE, handleRegisterBitRange],
];

export default registerHandlers;
