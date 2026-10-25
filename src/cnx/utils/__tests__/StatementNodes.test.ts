import { describe, expect, it } from "vitest";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import StatementNodes from "../StatementNodes";

const kinds = (source: string): string[] =>
  CnxSourceParser.parse(source).program.members.flatMap((member) =>
    StatementNodes.in(member.declaration).map((s) => s.kind),
  );

describe("StatementNodes", () => {
  it("lists every assignment site, a for loop's init and update included", () => {
    const sites = CnxSourceParser.parse(
      `void f() { mut u8 a <- 0; for (a <- 1; a < 3; a +<- 1) { a -<- 0; } }`,
    ).program.members.flatMap((member) =>
      StatementNodes.assignments(member.declaration).map((s) => s.operator),
    );
    expect(sites).toEqual(["<-", "+<-", "-<-"]);
  });

  it("reaches nested statements in source order", () => {
    expect(
      kinds(
        `void f() { mut u8 a <- 1; if (a = 1) { a <- 2; } while (a < 3) { a +<- 1; } }`,
      ),
    ).toEqual([
      "variableDeclaration",
      "if",
      "block",
      "assignment",
      "while",
      "block",
      "assignment",
    ]);
  });

  it("includes a for loop's init", () => {
    expect(
      kinds(`void f() { for (mut u8 i <- 0; i < 3; i +<- 1) { } }`),
    ).toEqual(["for", "variableDeclaration", "block"]);
  });

  it("reaches functions inside a scope, and nothing outside a body", () => {
    expect(
      kinds(
        `mut u8 g <- 1; scope S { u8 m <- 2; public void f() { g <- 3; } }`,
      ),
    ).toEqual(["assignment"]);
  });

  it("lists every case label, a nested switch's and a scope member's too", () => {
    const labels = CnxSourceParser.parse(
      `scope S { public void f(u8 a) { switch (a) { case 1 || 2 { if (a = 1) { switch (a) { case 3 { a <- 0; } default { } } } } default { } } } }`,
    ).program.members.flatMap((member) =>
      StatementNodes.caseLabels(member.declaration).map((label) =>
        label.kind === "integer" ? label.text : label.kind,
      ),
    );
    expect(labels).toEqual(["1", "2", "3"]);
  });
});
