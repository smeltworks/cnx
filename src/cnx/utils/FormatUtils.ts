/**
 * Code formatting utilities for C code generation.
 * Pure functions for text formatting and indentation.
 *
 * Extracted from CodeGenerator.ts as part of ADR-065 decomposition.
 */

class FormatUtils {
  /** Default indentation string (4 spaces) */
  static readonly INDENT = "    ";

  /**
   * Generate indentation string for the given level.
   * Uses 4 spaces per level, matching cnx coding style.
   *
   * @param level - The indentation level (0 = no indent)
   * @returns String of spaces for indentation
   */
  static indent(level: number): string {
    return FormatUtils.INDENT.repeat(level);
  }

  /**
   * Indent ALL lines of a multi-line string (including empty lines).
   *
   * @param text - The text to indent (may contain newlines)
   * @param level - The indentation level
   * @returns Text with every line indented
   */
  static indentAllLines(text: string, level: number): string {
    const prefix = FormatUtils.indent(level);
    return text
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  }
}

export default FormatUtils;
