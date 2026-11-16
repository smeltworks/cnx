/**
 * Issue #1219: which ADRs take part in the matrix.
 *
 * The dangerous case is the ADR that declares a matrix nobody can read. Dropping
 * it removes every obligation it carried while the gate still reports
 * "satisfied", and the staleness diff cannot catch it either -- the report is
 * rendered from occupancy, so it comes out byte-identical.
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AdrDeclarationReader from "../matrix/AdrDeclarationReader";
import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";
import MatrixCell from "../matrix/MatrixCell";

let dir: string;

const writeAdr = (name: string, body: string): void => {
  writeFileSync(join(dir, name), body, "utf-8");
};

const wellFormed = [
  AdrMatrixDeclaration.SEVERITY_MARKER,
  "",
  "| Context | Relationship | Severity |",
  "| ------- | ------------ | -------- |",
  "| top-level function | same file | error |",
].join("\n");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-reader-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("AdrDeclarationReader.read", () => {
  it("returns an empty map for a directory that does not exist", () => {
    expect(AdrDeclarationReader.read(join(dir, "nope")).size).toBe(0);
  });

  it("omits an ADR with no matrix marker", () => {
    writeAdr("adr-099-something.md", "# ADR-099\n\nNo matrix here.\n");
    expect(AdrDeclarationReader.read(dir).size).toBe(0);
  });

  it("reads a well-formed declaration", () => {
    writeAdr("adr-051-division-by-zero.md", wellFormed);
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.get("051")!.severities.size).toBe(1);
    expect(declarations.get("051")!.errors).toEqual([]);
  });

  it("keeps an ADR whose marker is present but whose table is unreadable", () => {
    // Marker present is the statement of intent. Dropping this ADR would take
    // every obligation with it and leave the gate green.
    writeAdr(
      "adr-051-division-by-zero.md",
      [AdrMatrixDeclaration.SEVERITY_MARKER, "", "No table at all.", ""].join(
        "\n",
      ),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.has("051")).toBe(true);
    expect(declarations.get("051")!.errors.join("\n")).toContain(
      "marker present but no cell could be read",
    );
  });

  it("keeps an ADR whose every row is malformed", () => {
    writeAdr(
      "adr-051-division-by-zero.md",
      [
        AdrMatrixDeclaration.SEVERITY_MARKER,
        "",
        "| Context | Severity |",
        "| ------- | -------- |",
        "| top-level function | error |",
      ].join("\n"),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.has("051")).toBe(true);
    expect(declarations.get("051")!.errors.length).toBeGreaterThan(0);
  });

  it("ignores files that are not adr-NNN-*.md", () => {
    writeAdr("README.md", wellFormed);
    writeAdr("adr-template.md", wellFormed);
    expect(AdrDeclarationReader.read(dir).size).toBe(0);
  });

  it("keys a rule's table by ADR and rule (#1731 review)", () => {
    writeAdr(
      "adr-045-string-type.md",
      [
        wellFormed,
        "",
        "<!-- MATRIX-SEVERITY rule: string-copy -->",
        "",
        "| Context | Relationship | Severity |",
        "| ------- | ------------ | -------- |",
        "| scope method | imported direct | error |",
      ].join("\n"),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect([...declarations.keys()].sort()).toEqual(["045", "045 string-copy"]);
    expect(declarations.get("045 string-copy")!.severities.size).toBe(1);
    expect(declarations.get("045")!.severities.size).toBe(1);
  });

  it("keeps a rule whose marker is present but whose table is unreadable", () => {
    writeAdr(
      "adr-045-string-type.md",
      [wellFormed, "", "<!-- MATRIX-SEVERITY rule: string-copy -->", ""].join(
        "\n",
      ),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.get("045 string-copy")!.errors.join("\n")).toContain(
      "marker present but no cell could be read",
    );
  });
});

describe("AdrDeclarationReader.read code tables (#1620)", () => {
  const codeTable = (...codes: string[]): string =>
    [
      "| Code | Rule |",
      "| ---- | ---- |",
      ...codes.map((code) => `| ${code} | r |`),
      "",
    ].join("\n");
  const codeMatrix = (code: string, omit: string[] = []): string =>
    [
      `<!-- MATRIX-SEVERITY code: ${code} -->`,
      "",
      "| Context | Relationship | Severity |",
      "| ------- | ------------ | -------- |",
      ...MatrixCell.CONTEXTS.flatMap((context) =>
        MatrixCell.RELATIONSHIPS.map(
          (relationship) => `${context} / ${relationship}`,
        )
          .filter((cell) => !omit.includes(cell))
          .map((cell) => `| ${cell.replace(" / ", " | ")} | off |`),
      ),
      "",
    ].join("\n");

  it("fails a code table that leaves a derivable cell undeclared", () => {
    writeAdr(
      "adr-029-x.md",
      codeTable("E0879") + codeMatrix("E0879", ["for-header / same-file"]),
    );
    expect(AdrDeclarationReader.read(dir).get("029 E0879")?.errors).toEqual([
      'ADR-029 E0879: leaves "for-header / same-file" undeclared',
    ]);
  });

  it("fails a declared code that has no table of its own", () => {
    writeAdr("adr-029-x.md", codeTable("E0879", "E0880") + codeMatrix("E0880"));
    expect(AdrDeclarationReader.read(dir).get("029 E0879")?.errors).toEqual([
      expect.stringContaining("declares E0879 but has no"),
    ]);
  });

  it("fails a code table for a code the ADR does not declare", () => {
    writeAdr(
      "adr-029-x.md",
      codeTable("E0879") + codeMatrix("E0879") + "\n" + codeMatrix("E0880"),
    );
    expect(
      AdrDeclarationReader.read(dir).get("029 E0880")?.errors,
    ).toContainEqual(
      expect.stringContaining("which its code table does not declare"),
    );
  });

  it("asks no table of a code the registry retires", () => {
    writeAdr("adr-013-x.md", codeTable("E0877", "E0900") + codeMatrix("E0900"));
    const declarations = AdrDeclarationReader.read(dir, new Set(["E0877"]));
    expect(declarations.has("013 E0877")).toBe(false);
    expect(declarations.get("013 E0900")?.errors).toEqual([]);
  });

  it("fails a table for a code the registry retires", () => {
    writeAdr("adr-013-x.md", codeTable("E0877") + codeMatrix("E0877"));
    expect(
      AdrDeclarationReader.read(dir, new Set(["E0877"])).get("013 E0877")
        ?.errors,
    ).toEqual([expect.stringContaining("which docs/error-codes.md retires")]);
  });

  it("names a `code:` marker whose name is not a diagnostic code", () => {
    writeAdr("adr-029-x.md", codeTable("E0879") + codeMatrix("E879"));
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.get("029 E879")?.errors).toEqual([
      "ADR-029: `code: E879` is not a diagnostic code",
    ]);
    expect(declarations.get("029 E0879")?.errors).toEqual([
      expect.stringContaining("declares E0879 but has no"),
    ]);
  });
});
