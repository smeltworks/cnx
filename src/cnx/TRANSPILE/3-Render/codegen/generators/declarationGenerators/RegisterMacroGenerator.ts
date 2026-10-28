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
 * @param baseAddress - Base address expression string
 * @returns Array of #define lines
 */
function generateRegisterMacros(
  members: readonly IPlannedRegisterMember[],
  baseAddress: string,
): string[] {
  return members.map((member) => {
    // Determine qualifiers based on access mode
    const cast =
      member.access === "ro"
        ? `volatile ${member.cType} const *`
        : `volatile ${member.cType}*`;

    // Generate: #define PREFIX_REGNAME (*(volatile type*)(base + offset))
    return `#define ${member.cName} (*(${cast})(${baseAddress} + ${member.offset}))`;
  });
}

export default generateRegisterMacros;
