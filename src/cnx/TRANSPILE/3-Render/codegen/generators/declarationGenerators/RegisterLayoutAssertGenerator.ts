import RegisterAddress from "../../../../../utils/RegisterAddress";
import type IPlannedRegisterLayout from "../../types/IPlannedRegisterLayout";

/**
 * The asserts that C lays the struct out as cnx declared it: each slot at its
 * offset and each member at its width. A compiler that sizes a member
 * differently (a short enum, a 32-bit `double`) fails here rather than
 * reaching the wrong address at runtime.
 */
function renderRegisterLayoutAsserts(
  planned: IPlannedRegisterLayout,
  keyword: string,
): string {
  const name = planned.name;
  const lines: string[] = [
    `/* ADR-072: ${name} must sit at the offsets and widths its register declares */`,
  ];
  const slots = new Set<string>();
  for (const member of planned.members) {
    const slotName = member.union ?? member.name;
    if (!slots.has(slotName)) {
      slots.add(slotName);
      lines.push(
        `${keyword}(offsetof(${name}, ${slotName}) == ${RegisterAddress.hex(member.offset)}U, "${name}.${slotName} is at ${RegisterAddress.hex(member.offset)}");`,
      );
    }
    const path =
      member.union === null ? member.name : `${member.union}.${member.name}`;
    lines.push(
      `${keyword}(sizeof(((${name}*)0)->${path}) == ${member.bytes}U, "${name}.${member.name} is ${member.bytes} byte(s)");`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

export default renderRegisterLayoutAsserts;
