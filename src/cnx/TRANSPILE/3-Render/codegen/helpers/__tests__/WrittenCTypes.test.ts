import { describe, expect, it } from "vitest";
import WrittenCTypes from "../WrittenCTypes";

describe("WrittenCTypes", () => {
  it("finds the fixed-width and bool types the C spells", () => {
    const code = "uint8_t a = (uint32_t)b;\nbool ok = true;\nint32_t c;";
    expect([...WrittenCTypes.of(code)].sort()).toEqual([
      "bool",
      "int32_t",
      "uint32_t",
      "uint8_t",
    ]);
  });

  it("leaves out a member named like a type (ADR-072 ruling 2)", () => {
    expect([...WrittenCTypes.of("x = m.true + p->uint8_t;")]).toEqual([]);
  });

  it("counts a bool literal as bool", () => {
    expect([...WrittenCTypes.of("x = false;")]).toEqual(["bool"]);
  });

  it("leaves out comments and string and character literals", () => {
    const code = [
      "// uint8_t in a line comment",
      "/* uint16_t in a",
      "   block comment */ int x;",
      'const char* s = "uint32_t bool";',
      "char c = 'b';",
    ].join("\n");
    expect([...WrittenCTypes.of(code)]).toEqual([]);
  });

  it("leaves out preprocessor directives, continuation lines included", () => {
    const code = [
      "#include <stdint.h>",
      "#define WIDE ((uint64_t)1 << \\",
      "    (uint32_t)40)",
      "int16_t y;",
    ].join("\n");
    expect([...WrittenCTypes.of(code)]).toEqual(["int16_t"]);
  });

  it("does not match a longer name that contains a type", () => {
    expect([...WrittenCTypes.of("my_uint8_t z; boolean b;")]).toEqual([]);
  });
});
