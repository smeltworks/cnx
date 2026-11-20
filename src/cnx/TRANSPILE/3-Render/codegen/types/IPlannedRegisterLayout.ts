import type IPlannedRegisterLayoutMember from "./IPlannedRegisterLayoutMember";

/** ADR-072: a register type written as the C struct a parameter points to */
interface IPlannedRegisterLayout {
  readonly name: string;
  readonly members: readonly IPlannedRegisterLayoutMember[];
}

export default IPlannedRegisterLayout;
