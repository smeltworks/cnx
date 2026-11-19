/**
 * The `<stdint.h>`/`<stdbool.h>` type names a file's C spells (#1991). 2.3
 * checks them against the C types 2.2 planned the file's headers from, so a
 * spelling changed in 2.3 alone cannot silently drop a header.
 *
 * Comments, string and character literals, and preprocessor directives are
 * left out: none of them are C types 2.3 writes.
 */
class WrittenCTypes {
  private static readonly TYPE_NAME =
    // a word after `.` or `->` is a member name, not a type (ADR-072 ruling 2)
    /(?<!(?:\.|->)\s*)\b(?:u?int(?:8|16|32|64|ptr|max)_t|bool|true|false)\b/g;

  private static readonly NOT_CODE =
    /\/\*[\s\S]*?\*\/|\/\/.*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g;

  /** Each type name `code` spells; `true`/`false` spell `bool` */
  static of(code: string): ReadonlySet<string> {
    const found = new Set<string>();
    for (const line of WrittenCTypes.codeLines(code)) {
      for (const match of line.matchAll(WrittenCTypes.TYPE_NAME)) {
        found.add(
          match[0] === "true" || match[0] === "false" ? "bool" : match[0],
        );
      }
    }
    return found;
  }

  /** The lines of `code` that are C, with comments and literals blanked */
  private static codeLines(code: string): string[] {
    const blanked = code.replaceAll(WrittenCTypes.NOT_CODE, (text) =>
      text.replaceAll(/[^\n]/g, " "),
    );
    const lines: string[] = [];
    let inDirective = false;
    for (const line of blanked.split("\n")) {
      const directive: boolean =
        inDirective || line.trimStart().startsWith("#");
      inDirective = directive && line.trimEnd().endsWith("\\");
      if (!directive) lines.push(line);
    }
    return lines;
  }
}

export default WrittenCTypes;
