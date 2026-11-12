import type TExpression from "../types/syntax/TExpression";
import type TScanfWrites from "../types/TScanfWrites";

/** Where each C standard scanf-family function takes its format */
const FORMAT_INDEX: ReadonlyMap<string, number> = new Map([
  ["scanf", 0],
  ["wscanf", 0],
  ["fscanf", 1],
  ["fwscanf", 1],
  ["sscanf", 1],
  ["swscanf", 1],
]);

const LENGTH_MODIFIERS = new Set(["h", "l", "j", "z", "t", "L"]);

/**
 * Which arguments a call to a C standard scanf-family function writes, read
 * from its literal format (#2117, owner ruling 2026-11-12). Past the format,
 * C declares only `...`, so the format is the one place that says it: each
 * conversion fills the next argument, except `%%` and an assignment-suppressed
 * `%*d`, which fill none (C11 7.21.6.2). A format that is not a string
 * literal says nothing cnx can read.
 *
 * The one reader of a format: 2.1's write tracking (E0899, E0900), its E0929,
 * and 2.2's `&` for an argument a conversion fills all read this answer.
 */
class ScanfFormat {
  static writesOf(name: string, args: readonly TExpression[]): TScanfWrites {
    const index = FORMAT_INDEX.get(name);
    if (index === undefined) return { kind: "not-scanf" };
    const format = args[index];
    if (format?.kind !== "literal" || format.literalKind !== "string") {
      return format === undefined
        ? { kind: "literal", written: new Set() }
        : { kind: "format-not-literal", format };
    }
    const count = ScanfFormat.conversionCount(format.text.slice(1, -1));
    const written = new Set<number>();
    for (let n = 1; n <= count; n++) written.add(index + n);
    return { kind: "literal", written };
  }

  /** How many arguments a format's conversions fill */
  private static conversionCount(format: string): number {
    let count = 0;
    let at = 0;
    while (at < format.length) {
      if (format[at] !== "%") {
        at++;
        continue;
      }
      at++;
      if (format[at] === "%") {
        at++;
        continue;
      }
      const suppressed = format[at] === "*";
      if (suppressed) at++;
      while (at < format.length && /\d/.test(format[at])) at++;
      while (at < format.length && LENGTH_MODIFIERS.has(format[at])) at++;
      if (at >= format.length) break;
      at = format[at] === "[" ? ScanfFormat.afterScanset(format, at) : at + 1;
      if (!suppressed) count++;
    }
    return count;
  }

  /** Past a `%[...]` scanset, whose first `]` (after any `^`) is a member */
  private static afterScanset(format: string, open: number): number {
    let at = open + 1;
    if (format[at] === "^") at++;
    if (format[at] === "]") at++;
    const close = format.indexOf("]", at);
    return close === -1 ? format.length : close + 1;
  }
}

export default ScanfFormat;
