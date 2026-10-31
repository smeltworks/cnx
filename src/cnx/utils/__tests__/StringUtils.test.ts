import { describe, it, expect } from "vitest";
import StringUtils from "../StringUtils";

// ========================================================================
// copy
// ========================================================================
describe("StringUtils.copy", () => {
  it("calls the copy helper with an unsigned capacity", () => {
    expect(StringUtils.copy("str", '"hello"', 64)).toBe(
      'cnx_string_copy(str, "hello", 64U);',
    );
  });

  it("copies into a rendered target as given", () => {
    expect(StringUtils.copy("config->name", "value", 32)).toBe(
      "cnx_string_copy(config->name, value, 32U);",
    );
  });
});

// ========================================================================
// build
// ========================================================================
describe("StringUtils.build", () => {
  it("copies the first part and appends the second, then terminates", () => {
    expect(
      StringUtils.build("result", 64, [
        { kind: "whole", code: '"Hello"' },
        { kind: "whole", code: '" World"' },
      ]),
    ).toEqual([
      '(void) strncpy(result, "Hello", 64);',
      '(void) strncat(result, " World", 64 - strlen(result));',
      "result[64] = '\\0';",
    ]);
  });

  it("appends every later part of a longer concatenation (#1954)", () => {
    expect(
      StringUtils.build("buf", 12, [
        { kind: "whole", code: "a" },
        { kind: "whole", code: "b" },
        { kind: "whole", code: "c" },
      ]),
    ).toEqual([
      "(void) strncpy(buf, a, 12);",
      "(void) strncat(buf, b, 12 - strlen(buf));",
      "(void) strncat(buf, c, 12 - strlen(buf));",
      "buf[12] = '\\0';",
    ]);
  });

  it("extracts a lone substring", () => {
    expect(
      StringUtils.build("t", 8, [
        { kind: "substring", source: "s", start: "1", length: 2 },
      ]),
    ).toEqual(["cnx_string_copy(t, s + 1, 2U);"]);
  });

  it("appends a substring part by its length, bounded by the space left", () => {
    expect(
      StringUtils.build("t", 8, [
        { kind: "substring", source: "a", start: "0", length: 2 },
        { kind: "substring", source: "b", start: "1", length: 1 },
      ]),
    ).toEqual([
      "cnx_string_copy(t, a + 0, 2U);",
      "{",
      "    const uint32_t cnx_used = (uint32_t) strlen(t);",
      "    cnx_string_copy(t + cnx_used, b + 1, ((8U - cnx_used) < 1U) ? (8U - cnx_used) : 1U);",
      "}",
      "t[8] = '\\0';",
    ]);
  });
});

// ========================================================================
// substring
// ========================================================================
describe("StringUtils.substring", () => {
  it("copies a literal count of characters from the start offset", () => {
    expect(StringUtils.substring("part", "source", "5", 10)).toEqual([
      "cnx_string_copy(part, source + 5, 10U);",
    ]);
  });
});

// ========================================================================
// literalLength
// ========================================================================
describe("StringUtils.literalLength", () => {
  it("counts simple string without escapes", () => {
    expect(StringUtils.literalLength('"hello"')).toBe(5);
  });

  it("counts empty string", () => {
    expect(StringUtils.literalLength('""')).toBe(0);
  });

  it("counts newline escape as 1 character", () => {
    expect(StringUtils.literalLength('"hello\\n"')).toBe(6);
  });

  it("counts tab escape as 1 character", () => {
    expect(StringUtils.literalLength('"a\\tb"')).toBe(3);
  });

  it("counts backslash escape as 1 character", () => {
    expect(StringUtils.literalLength('"a\\\\b"')).toBe(3);
  });

  it("counts quote escape as 1 character", () => {
    expect(StringUtils.literalLength('"say \\"hi\\""')).toBe(8);
  });

  it("counts multiple escapes correctly", () => {
    expect(StringUtils.literalLength('"\\n\\t\\r"')).toBe(3);
  });

  it("handles mixed content", () => {
    expect(StringUtils.literalLength('"line1\\nline2"')).toBe(11);
  });
});

describe("StringUtils.firstCharacter", () => {
  it("is the C character literal of a one-character string literal", () => {
    expect(StringUtils.firstCharacter('"x"')).toBe("'x'");
    expect(StringUtils.firstCharacter('"\\n"')).toBe("'\\n'");
    expect(StringUtils.firstCharacter('"\\""')).toBe("'\\\"'");
  });

  it("escapes a single quote", () => {
    expect(StringUtils.firstCharacter('"\'"')).toBe("'\\''");
  });

  it("is the terminator for an empty literal", () => {
    expect(StringUtils.firstCharacter('""')).toBe("'\\0'");
  });
});

describe("StringUtils.characterAt", () => {
  it("is each character of a literal, an escape counted as one", () => {
    expect(StringUtils.characterAt('"AB"', 1)).toBe("'B'");
    expect(StringUtils.characterAt('"a\\nb"', 1)).toBe("'\\n'");
    expect(StringUtils.characterAt('"a\\nb"', 2)).toBe("'b'");
  });

  it("is the terminator past the literal's end", () => {
    expect(StringUtils.characterAt('"A"', 1)).toBe("'\\0'");
  });
});
