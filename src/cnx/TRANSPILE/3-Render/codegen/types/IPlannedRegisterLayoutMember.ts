import type TRegisterAccessMode from "../../../../types/TRegisterAccessMode";

/** ADR-072: one member of a register layout, at its offset */
interface IPlannedRegisterLayoutMember {
  readonly name: string;
  readonly cType: string;
  readonly access: TRegisterAccessMode;
  readonly offset: bigint;
  readonly bytes: bigint;
  /** The offset group it shares, or null for a lone member */
  readonly group: number | null;
}

export default IPlannedRegisterLayoutMember;
