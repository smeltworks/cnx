import { describe, expect, it } from "vitest";
import CaseLabelSymbol from "../CaseLabelSymbol";
import type IProgram from "../../types/IProgram";
import type TSymbol from "../../types/symbols/TSymbol";

const IDLE = { kind: "enum_member", fullyQualifiedCName: "Panel__State__IDLE" };
const PANEL_STATE = {
  kind: "enum",
  fullyQualifiedCName: "Panel__State",
  members: new Map([["IDLE", IDLE]]),
};
const EMODE = {
  kind: "enum",
  fullyQualifiedCName: "EMode",
  members: new Map([
    ["RUN", { kind: "enum_member", fullyQualifiedCName: "EMode__RUN" }],
  ]),
};
const PANEL = {
  kind: "scope",
  cnxScopedName: "Panel",
  fullyQualifiedCName: "Panel",
};
const LIMIT = { kind: "variable", fullyQualifiedCName: "Panel_LIMIT" };

const byCName = new Map<string, unknown>([
  ["EMode", EMODE],
  ["Panel", PANEL],
  ["Panel__State", PANEL_STATE],
]);
const byIdentity = new Map<string, unknown>([
  ["Panel\u0000State", PANEL_STATE],
  ["Panel\u0000LIMIT", LIMIT],
]);

const program: Pick<IProgram, "symbolByCName" | "memberOf"> = {
  symbolByCName: (cName) => byCName.get(cName) as TSymbol | undefined,
  memberOf: (scopePath, name) =>
    byIdentity.get(`${scopePath}\u0000${name}`) as TSymbol | undefined,
};

describe("CaseLabelSymbol", () => {
  it("finds an enum's member by name: EMode.RUN", () => {
    expect(
      CaseLabelSymbol.of(program, "EMode", ["RUN"])?.fullyQualifiedCName,
    ).toBe("EMode__RUN");
  });

  it("finds a scope's member by the scope's path: Panel.LIMIT", () => {
    // The stored name is read, so a spelling no join would produce survives
    expect(
      CaseLabelSymbol.of(program, "Panel", ["LIMIT"])?.fullyQualifiedCName,
    ).toBe("Panel_LIMIT");
  });

  it("walks a scope's enum to its member: Panel.State.IDLE", () => {
    expect(CaseLabelSymbol.of(program, "Panel", ["State", "IDLE"])).toBe(IDLE);
  });

  it("starts from a head already qualified: this.State.IDLE", () => {
    expect(CaseLabelSymbol.of(program, "Panel__State", ["IDLE"])).toBe(IDLE);
  });

  it("names nothing for a member the enum lacks", () => {
    expect(CaseLabelSymbol.of(program, "EMode", ["STOP"])).toBeUndefined();
  });

  it("names nothing through a symbol with no members: Panel.LIMIT.x", () => {
    expect(
      CaseLabelSymbol.of(program, "Panel", ["LIMIT", "x"]),
    ).toBeUndefined();
  });

  it("names nothing for an unknown head", () => {
    expect(CaseLabelSymbol.of(program, "Nope", ["IDLE"])).toBeUndefined();
  });
});
