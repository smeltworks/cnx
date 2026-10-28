/**
 * Enum Header Generator
 *
 * Generates C typedef enum declarations from symbol information.
 * Used by HeaderGenerator to emit full enum definitions in headers.
 */

import IHeaderTypeInput from "./IHeaderTypeInput";
import invariant from "../../../../utils/invariant";

/**
 * Generate a C typedef enum declaration for the given enum name.
 *
 * Output format:
 * ```c
 * typedef enum {
 *     EnumName_MEMBER1 = 0,
 *     EnumName_MEMBER2 = 1
 * } EnumName;
 * ```
 *
 * @param name - The enum type name
 * @param input - Symbol information containing enum members
 * @returns C typedef enum declaration, or comment if enum data unavailable
 */
function generateEnumHeader(name: string, input: IHeaderTypeInput): string {
  const members = input.enumMembers.get(name);

  // Graceful fallback if enum data not available
  if (!members || members.size === 0) {
    return `/* Enum: ${name} (see implementation for values) */`;
  }

  const lines: string[] = [];
  lines.push("typedef enum {");

  // Convert members to sorted array for consistent output
  const memberEntries = Array.from(members.entries()).sort(
    ([, a], [, b]) => a - b,
  );

  memberEntries.forEach(([memberName, value], index) => {
    const prefixedName = input.memberCNames.get(name)?.get(memberName);
    invariant(
      prefixedName !== undefined,
      `3-Declare names every member of '${name}' (missing '${memberName}')`,
    );
    const comma = index < memberEntries.length - 1 ? "," : "";
    lines.push(`    ${prefixedName} = ${value}${comma}`);
  });

  lines.push(`} ${name};`);

  return lines.join("\n");
}

export default generateEnumHeader;
