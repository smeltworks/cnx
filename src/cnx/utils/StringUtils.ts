/**
 * String utilities for C code generation.
 * Pure functions that generate C code strings for string operations.
 *
 * Extracted from CodeGenerator.ts as part of ADR-065 decomposition.
 */
/**
 * MISRA C:2012 Rule 17.7 (ADR-070 Case 1): every `strncpy`/`strncat` below is a
 * call the TRANSPILER emits to lower a cnx string operation -- the author
 * never wrote it, so its discarded return is cast to `(void)` here rather than
 * being reported to the author. Author-written discards are Case 2 (E0708).
 *
 * This class is the single source of truth for that lowering; callers must not
 * build these calls themselves, or the cast would have to be repeated.
 */
/** C null terminator character literal for generated code */
import type TRenderedStringPart from "../types/TRenderedStringPart";
import type TStringValueForm from "../types/TStringValueForm";

const C_NULL_CHAR = String.raw`'\0'`;

class StringUtils {
  /** #2207: the copy a string written from another string goes through */
  static readonly COPY_HELPER = "cnx_string_copy";

  /**
   * #1731: one whole string copied into `string<capacity>`, assigned or
   * declared -- the one form of ADR-045's copy (#2207)
   */
  static copy(target: string, value: string, capacity: number): string {
    return `${StringUtils.COPY_HELPER}(${target}, ${value}, ${capacity}U);`;
  }

  /**
   * ADR-045: the lines that build a string into `buffer` from its parts --
   * one substring, or a concatenation of two or more parts, each a whole
   * string or a substring (#1954). A concatenation copies its first part,
   * appends each later one bounded by what is left, then terminates at the
   * capacity. The `(void)` casts are MISRA 17.7's (ADR-070 Case 1).
   */
  static build(
    buffer: string,
    capacity: number,
    parts: readonly TRenderedStringPart[],
  ): string[] {
    const [first, ...rest] = parts;
    const lines =
      first.kind === "substring"
        ? StringUtils.substring(buffer, first.source, first.start, first.length)
        : [`(void) strncpy(${buffer}, ${first.code}, ${capacity});`];
    if (rest.length === 0 && first.kind === "substring") return lines;
    for (const part of rest) {
      if (part.kind === "substring") {
        lines.push(...StringUtils.appendSubstring(buffer, capacity, part));
      } else {
        lines.push(
          `(void) strncat(${buffer}, ${part.code}, ${capacity} - strlen(${buffer}));`,
        );
      }
    }
    lines.push(`${buffer}[${capacity}] = ${C_NULL_CHAR};`);
    return lines;
  }

  /**
   * A substring appended to what is built, bounded by the space left as
   * `strncat` bounds a whole part: a part before it may be a C string or an
   * unsized `string`, whose length 2.1 cannot measure (#2160 review)
   */
  private static appendSubstring(
    buffer: string,
    capacity: number,
    part: Extract<TRenderedStringPart, { kind: "substring" }>,
  ): string[] {
    const count = StringUtils.count(part.length);
    const left = `(${capacity}U - cnx_used)`;
    return [
      "{",
      `    const uint32_t cnx_used = (uint32_t) strlen(${buffer});`,
      `    ${StringUtils.COPY_HELPER}(${buffer} + cnx_used, ${part.source} + ${part.start}, (${left} < ${count}) ? ${left} : ${count});`,
      "}",
    ];
  }

  private static count(length: number): string {
    return `${length}U`;
  }

  /**
   * Generate substring extraction: `result <- source[start, length]` is
   * `cnx_string_copy(result, source + start, length)`, which copies at most
   * `length` characters, zero-fills to it and terminates there, as `strncpy`
   * and a terminator did, without gcc's `-Wstringop-truncation` on a source
   * longer than the count (#2160 review).
   */
  static substring(
    target: string,
    source: string,
    start: string,
    length: number,
  ): string[] {
    const count = StringUtils.count(length);
    return [
      `${StringUtils.COPY_HELPER}(${target}, ${source} + ${start}, ${count});`,
    ];
  }

  /**
   * Whether `build` calls `cnx_string_copy`, so 2.2 decides the helper by
   * the rule that emits it: a copy does, and so does every substring, a
   * concatenation's parts among them (an appended one is copied in at the
   * end of what is built, without `strncat`'s `-Wstringop-truncation`)
   */
  static usesCopyHelper(form: TStringValueForm): boolean {
    if (form.kind === "copy" || form.kind === "substring") return true;
    return (
      form.kind === "concat" &&
      form.parts.some((part) => part.kind === "substring")
    );
  }

  /**
   * Get the actual character length of a string literal,
   * accounting for escape sequences like \n, \t, \\, etc.
   *
   * @param literal - The string literal including quotes (e.g., "hello\n")
   * @returns The character count (escape sequences count as 1)
   */
  /**
   * #1748: the C character literal for the one character a string literal
   * holds -- `"x"` is `'x'`, `"\n"` is `'\n'`, and `""` is its terminator.
   */
  static firstCharacter(literal: string): string {
    return StringUtils.characterAt(literal, 0);
  }

  /**
   * #2373: the C character literal for a string literal's character `k`,
   * an escape sequence counted as one; past its end, the terminator
   */
  static characterAt(literal: string, k: number): string {
    const content = literal.slice(literal.indexOf('"') + 1, -1);
    const characters: string[] = [];
    let i = 0;
    while (i < content.length) {
      const width = content[i] === "\\" && i + 1 < content.length ? 2 : 1;
      characters.push(content.slice(i, i + width));
      i += width;
    }
    const character = characters[k];
    if (character === undefined) return String.raw`'\0'`;
    return character === "'" ? String.raw`'\''` : `'${character}'`;
  }

  static literalLength(literal: string): number {
    // Remove surrounding quotes
    const content = literal.slice(1, -1);

    let length = 0;
    let i = 0;
    while (i < content.length) {
      if (content[i] === "\\" && i + 1 < content.length) {
        // Escape sequence counts as 1 character
        i += 2;
      } else {
        i += 1;
      }
      length += 1;
    }
    return length;
  }
}

export default StringUtils;
