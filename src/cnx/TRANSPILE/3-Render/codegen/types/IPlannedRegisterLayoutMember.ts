import type TRegisterAccessMode from "../../../../types/TRegisterAccessMode";

/** ADR-072: one member of a register layout, at its offset */
interface IPlannedRegisterLayoutMember {
  /** Its field name in the struct (`layoutField`) */
  readonly name: string;
  readonly cType: string;
  readonly access: TRegisterAccessMode;
  readonly offset: bigint;
  readonly bytes: bigint;
  /** The union its offset group is written as (`layoutUnion`), or null */
  readonly union: string | null;
}

export default IPlannedRegisterLayoutMember;
