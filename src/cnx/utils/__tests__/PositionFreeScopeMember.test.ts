/**
 * #1643 review: a scope member is left to its position-free C name only when
 * its symbol is a type or a register -- a missing symbol, a variable or a
 * function is not one.
 */

import PositionFreeScopeMember from "../PositionFreeScopeMember";
import type IProgram from "../../types/IProgram";
import type TSymbol from "../../types/symbols/TSymbol";

const programWith = (
  kinds: Record<string, string>,
): Pick<IProgram, "memberOf"> => ({
  memberOf: (scopePath, name) => {
    const kind = scopePath === "S" ? kinds[name] : undefined;
    return kind === undefined ? undefined : ({ kind } as unknown as TSymbol);
  },
});

describe("PositionFreeScopeMember.is", () => {
  const members = new Set(["Point", "Mode", "Flags", "Port", "x", "f", "gone"]);
  const program = programWith({
    Point: "struct",
    Mode: "enum",
    Flags: "bitmap",
    Port: "register",
    x: "variable",
    f: "function",
  });

  it.each(["Point", "Mode", "Flags", "Port"])(
    "%s has no position to bind by",
    (name) => {
      expect(PositionFreeScopeMember.is(members, "S", name, program)).toBe(
        true,
      );
    },
  );

  it.each(["x", "f"])("%s is the binder's, by position", (name) => {
    expect(PositionFreeScopeMember.is(members, "S", name, program)).toBe(false);
  });

  it("fails closed on a member with no symbol", () => {
    expect(PositionFreeScopeMember.is(members, "S", "gone", program)).toBe(
      false,
    );
  });

  it("is false for a name the scope does not have", () => {
    expect(PositionFreeScopeMember.is(members, "S", "Other", program)).toBe(
      false,
    );
    expect(PositionFreeScopeMember.is(undefined, "S", "Point", program)).toBe(
      false,
    );
  });
});
