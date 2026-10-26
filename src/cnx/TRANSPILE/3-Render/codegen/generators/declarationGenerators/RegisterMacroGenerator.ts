/**
 * RegisterMacroGenerator - the `#define` text for a register block (ADR-004).
 *
 * A pure function of `IPlannedRegisterMember[]`: it formats, it does not
 * decide. #1445 box 3 -- it used to take `RegisterMemberContext[]` and an
 * orchestrator and do both, which put the grammar in the render layer to
 * obtain four strings per member.
 */
import IPlannedRegisterMember from "../../types/IPlannedRegisterMember";
import QualifiedCName from "../../../../../utils/QualifiedCName";

/**
 * Generate #define macros for register members.
 *
 * @param members - The planned members, in declaration order
 * @param prefix - Prefix for macro names (e.g., "GPIO7" or "Teensy4_GPIO7")
 * @param baseAddress - Base address expression string
 * @returns Array of #define lines
 */
function generateRegisterMacros(
  members: readonly IPlannedRegisterMember[],
  prefix: string,
  baseAddress: string,
): string[] {
  return members.map((member) => {
    // Determine qualifiers based on access mode
    const cast =
      member.access === "ro"
        ? `volatile ${member.cType} const *`
        : `volatile ${member.cType}*`;

    // Generate: #define PREFIX_REGNAME (*(volatile type*)(base + offset))
    return `#define ${QualifiedCName.fromSourceName([prefix, member.name])} (*(${cast})(${baseAddress} + ${member.offset}))`;
  });
}

export default generateRegisterMacros;
