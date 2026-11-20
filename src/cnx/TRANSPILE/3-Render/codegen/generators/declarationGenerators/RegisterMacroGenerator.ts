/**
 * RegisterMacroGenerator - the `#define` text for a register block (ADR-004).
 *
 * A pure function of `IPlannedRegisterMember[]`: it formats, it does not
 * decide. #1445 box 3 -- it used to take `RegisterMemberContext[]` and an
 * orchestrator and do both, which put the grammar in the render layer to
 * obtain four strings per member.
 */
import IPlannedRegisterMember from "../../types/IPlannedRegisterMember";

/**
 * Generate #define macros for register members.
 *
 * @param members - The planned members, in declaration order
 * @returns Array of #define lines
 */
function generateRegisterMacros(
  members: readonly IPlannedRegisterMember[],
): string[] {
  return members.map((member) => {
    // Determine qualifiers based on access mode
    const cast =
      member.access === "ro"
        ? `volatile ${member.cType} const *`
        : `volatile ${member.cType}*`;

    // ADR-072: one folded address, so the C does no address arithmetic
    return `#define ${member.cName} (*(${cast})(${member.address}))`;
  });
}

export default generateRegisterMacros;
