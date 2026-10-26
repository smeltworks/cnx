import { describe, it, expect } from "vitest";
import FormatUtils from "../FormatUtils";

// ========================================================================
// indent
// ========================================================================
describe("FormatUtils.indent", () => {
  it("returns empty string for level 0", () => {
    expect(FormatUtils.indent(0)).toBe("");
  });

  it("returns 4 spaces for level 1", () => {
    expect(FormatUtils.indent(1)).toBe("    ");
  });

  it("returns 8 spaces for level 2", () => {
    expect(FormatUtils.indent(2)).toBe("        ");
  });

  it("returns 12 spaces for level 3", () => {
    expect(FormatUtils.indent(3)).toBe("            ");
  });
});

// ========================================================================
// indentAllLines
// ========================================================================
describe("FormatUtils.indentAllLines", () => {
  it("indents single line", () => {
    expect(FormatUtils.indentAllLines("code;", 1)).toBe("    code;");
  });

  it("indents multiple lines", () => {
    expect(FormatUtils.indentAllLines("line1;\nline2;", 1)).toBe(
      "    line1;\n    line2;",
    );
  });

  it("indents empty lines (unlike indentLines)", () => {
    expect(FormatUtils.indentAllLines("line1;\n\nline2;", 1)).toBe(
      "    line1;\n    \n    line2;",
    );
  });

  it("handles level 0 (no indent)", () => {
    expect(FormatUtils.indentAllLines("code;", 0)).toBe("code;");
  });

  it("handles deeper indentation", () => {
    expect(FormatUtils.indentAllLines("x = 1;", 2)).toBe("        x = 1;");
  });
});

// ========================================================================
// INDENT constant
// ========================================================================
describe("FormatUtils.INDENT", () => {
  it("is 4 spaces", () => {
    expect(FormatUtils.INDENT).toBe("    ");
    expect(FormatUtils.INDENT).toHaveLength(4);
  });
});

