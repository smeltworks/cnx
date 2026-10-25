import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../PARSE/2-Parse/CnxSourceParser";
import SizeofAnalyzer from "../SizeofAnalyzer";

/**
 * ADR-023 / #1975: cnx has no `sizeof`; a size is ADR-058's
 * `.type_byte_length`. Every `sizeof` is E0603, wherever it is written.
 */
const errors = (source: string) => {
  return new SizeofAnalyzer().analyze(CnxSourceParser.parse(source).program);
};

describe("SizeofAnalyzer (E0603)", () => {
  it("rejects sizeof of a type and of a value, each where it is written", () => {
    const found = errors(
      "u32 a <- 3;\nvoid f() {\n    u32 n <- sizeof(u32);\n    u32 m <- sizeof(a);\n}",
    );
    expect(found.map((e) => [e.code, e.span.line, e.span.column])).toEqual([
      ["E0603", 3, 13],
      ["E0603", 4, 13],
    ]);
    expect(found[0].helpText).toContain(".type_byte_length");
  });

  it("rejects sizeof in a dimension and inside a scope", () => {
    const found = errors(
      "u8[sizeof(u32)] buf;\nscope S {\n    u32 n <- sizeof(buf);\n}",
    );
    expect(found.map((e) => [e.code, e.span.line])).toEqual([
      ["E0603", 1],
      ["E0603", 3],
    ]);
  });

  it("accepts .type_byte_length, the spelling that replaces it", () => {
    expect(
      errors("u8[4] buf;\nvoid f() {\n    u32 n <- buf.type_byte_length;\n}"),
    ).toEqual([]);
  });
});
