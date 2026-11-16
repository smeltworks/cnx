/**
 * Issue #1219: reads every ADR's declared matrix from a decisions directory.
 *
 * Separate from the CLI so the drop/keep decision is testable. That decision is
 * load-bearing: an ADR silently dropped here takes every obligation it declared
 * with it, and the gate still reports "satisfied".
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";
import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import MatrixCell from "./MatrixCell";
import MatrixRule from "./MatrixRule";
import IMatrixDeclaration from "../types/IMatrixDeclaration";

const ADR_FILENAME = /^adr-(\d{3})-.*\.md$/;

/**
 * Parse the matrix declaration out of every `adr-NNN-*.md` in `decisionsDir`,
 * keyed by MatrixRule id: the ADR's own table, and one per rule or code table.
 * `retired` holds the codes the error registry retires (ErrorCodeRegistry).
 *
 * An ADR with no `MATRIX-SEVERITY` marker takes no part and is omitted. An ADR
 * that HAS the marker is always included, even when nothing could be read from
 * it -- "declares a matrix I could not parse" and "declares no matrix" are
 * different facts, and only the first is a fault. Collapsing them is how a
 * malformed table removes every obligation without a word.
 */
/**
 * #1620 review: a code table declares every cell. A cell left out
 * reads as `off` with no note, which is how a context added later (`for
 * header`, #1646) went unexamined in 67 tables.
 */
function undeclaredCells(table: IMatrixDeclaration): string[] {
  return MatrixCell.all()
    .filter(
      ({ context, relationship }) =>
        !table.severities.has(MatrixCell.key(context, relationship)),
    )
    .map(
      ({ context, relationship }) =>
        `ADR-${table.adr}: leaves "${context} / ${relationship}" undeclared`,
    );
}

/** The one walk: each `adr-NNN-*.md` in `decisionsDir`, in name order */
function adrFiles(decisionsDir: string): { adr: string; markdown: string }[] {
  if (!existsSync(decisionsDir)) return [];
  return readdirSync(decisionsDir)
    .sort()
    .flatMap((entry) => {
      const match = ADR_FILENAME.exec(entry);
      return match === null
        ? []
        : [
            {
              adr: match[1],
              markdown: readFileSync(join(decisionsDir, entry), "utf-8"),
            },
          ];
    });
}

/** The one message for a table whose code gates nothing */
function undeclaredTable(
  adr: string,
  table: string,
  code: string,
  cause: string,
): string {
  return `ADR-${adr}: has ${table} for ${code}, ${cause}`;
}

const UNDECLARED = "which its code table does not declare";

function read(
  decisionsDir: string,
  retired: ReadonlySet<string> = new Set(),
): Map<string, IMatrixDeclaration> {
  const declarations = new Map<string, IMatrixDeclaration>();

  for (const { adr, markdown } of adrFiles(decisionsDir)) {
    const tables = AdrMatrixDeclaration.tablesIn(markdown);
    for (const table of tables) {
      const ruleId = MatrixRule.id(adr, table.name);
      if (table.kind === "code" && !DiagnosticManifest.isCode(table.name)) {
        declarations.set(ruleId, {
          adr: ruleId,
          severities: new Map(),
          errors: [
            `ADR-${adr}: \`code: ${table.name}\` is not a diagnostic code`,
          ],
        });
        continue;
      }
      const parsed = AdrMatrixDeclaration.parse(markdown, ruleId, table);
      const ruleTable =
        table.kind === "code" && parsed.severities.size > 0
          ? {
              ...parsed,
              errors: [...parsed.errors, ...undeclaredCells(parsed)],
            }
          : parsed;
      declarations.set(
        ruleId,
        ruleTable.severities.size > 0 || ruleTable.errors.length > 0
          ? ruleTable
          : {
              ...ruleTable,
              errors: [
                `ADR-${ruleId}: MATRIX-SEVERITY marker present but no cell could be read`,
              ],
            },
      );
    }

    // #1620: every code the ADR declares needs its own table, and every code
    // table must name a code the ADR declares. Without the first, a code with
    // no table would be gated by nothing; without the second, a typo'd code
    // table would gate a code no fixture of this ADR can assert. A retired
    // code is declared by nothing: nothing emits it, so a table would be dead.
    if (markdown.includes(AdrMatrixDeclaration.ANY_MARKER)) {
      const declared = AdrMatrixDeclaration.codesIn(markdown, retired);
      const codeTables = tables
        .filter((t) => t.kind === "code" && DiagnosticManifest.isCode(t.name))
        .map((t) => t.name);
      for (const code of declared) {
        if (codeTables.includes(code)) continue;
        const codeId = MatrixRule.id(adr, code);
        declarations.set(codeId, {
          adr: codeId,
          severities: new Map(),
          errors: [
            `ADR-${adr}: declares ${code} but has no <!-- MATRIX-SEVERITY code: ${code} --> table`,
          ],
        });
      }
      for (const code of codeTables) {
        if (declared.includes(code)) continue;
        const codeId = MatrixRule.id(adr, code);
        const existing = declarations.get(codeId)!;
        const cause = retired.has(code)
          ? "which docs/error-codes.md retires"
          : UNDECLARED;
        declarations.set(codeId, {
          ...existing,
          errors: [
            ...existing.errors,
            undeclaredTable(adr, "a table", code, cause),
          ],
        });
      }
    }

    const declaration = AdrMatrixDeclaration.parse(markdown, adr);

    if (declaration.severities.size > 0 || declaration.errors.length > 0) {
      declarations.set(adr, declaration);
      continue;
    }

    if (!markdown.includes(AdrMatrixDeclaration.SEVERITY_MARKER)) continue;

    declarations.set(adr, {
      ...declaration,
      errors: [
        `ADR-${adr}: MATRIX-SEVERITY marker present but no cell could be read`,
      ],
    });
  }

  return declarations;
}

/**
 * #1618: every ADR's position tables, keyed by MatrixRule id ("024 E0869").
 * A table for a code its ADR does not declare would gate nothing, so it is an
 * error like a code table's.
 */
function readPositions(decisionsDir: string): Map<string, IMatrixDeclaration> {
  const declarations = new Map<string, IMatrixDeclaration>();

  for (const { adr, markdown } of adrFiles(decisionsDir)) {
    const declared = AdrMatrixDeclaration.codesIn(markdown);
    const codes = AdrMatrixDeclaration.positionCodesIn(markdown);
    for (const code of codes) {
      const id = MatrixRule.id(adr, code);
      if (declarations.has(id)) continue;
      const read = AdrMatrixDeclaration.parsePositions(markdown, id, code);
      const parsed =
        codes.filter((c) => c === code).length > 1
          ? {
              ...read,
              errors: [
                ...read.errors,
                `ADR-${adr}: declares more than one position table for ${code}`,
              ],
            }
          : read;
      declarations.set(
        id,
        declared.includes(code)
          ? parsed
          : {
              ...parsed,
              errors: [
                ...parsed.errors,
                undeclaredTable(adr, "a position table", code, UNDECLARED),
              ],
            },
      );
    }
  }
  return declarations;
}

class AdrDeclarationReader {
  static read = read;
  static readPositions = readPositions;
}

export default AdrDeclarationReader;
