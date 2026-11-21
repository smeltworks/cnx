/**
 * ADR-072: a register type a parameter takes, written as the C struct its
 * instances are reached through. Each member sits at its declared offset: a
 * gap is a reserved byte array, and an offset group is one union.
 */
import RegisterLayout from "../../../../../utils/RegisterLayout";
import type IPlannedRegisterLayout from "../../types/IPlannedRegisterLayout";
import type IPlannedRegisterLayoutMember from "../../types/IPlannedRegisterLayoutMember";

function field(member: IPlannedRegisterLayoutMember): string {
  const qualifier = member.access === "ro" ? "volatile const" : "volatile";
  return `${qualifier} ${member.cType} ${member.name};`;
}

/** The members at one offset: a lone member, or a group's union */
function slot(members: readonly IPlannedRegisterLayoutMember[]): string[] {
  const union = members[0].union;
  if (union === null) {
    return [`    ${field(members[0])}`];
  }
  return [
    "    union {",
    ...members.map((member) => `        ${field(member)}`),
    `    } ${union};`,
  ];
}

function renderRegisterLayout(planned: IPlannedRegisterLayout): string {
  const byOffset = new Map<bigint, IPlannedRegisterLayoutMember[]>();
  for (const member of planned.members) {
    const at = byOffset.get(member.offset) ?? [];
    at.push(member);
    byOffset.set(member.offset, at);
  }
  const offsets = [...byOffset.keys()].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const lines = [`typedef struct ${planned.name} {`];
  let next = 0n;
  for (const offset of offsets) {
    const members = byOffset.get(offset)!;
    if (offset > next) {
      lines.push(
        `    uint8_t ${RegisterLayout.reservedName(next)}[${offset - next}];`,
      );
    }
    lines.push(...slot(members));
    const end = members.reduce(
      (widest, member) =>
        offset + member.bytes > widest ? offset + member.bytes : widest,
      offset,
    );
    next = end > next ? end : next;
  }
  lines.push(`} ${planned.name};`, "");
  return lines.join("\n");
}

export default renderRegisterLayout;
