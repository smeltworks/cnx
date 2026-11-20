/**
 * ADR-072 ruling 2 (#2029): every cnx reserved word may name a member. The
 * grammar lists them by hand in `memberName`, so this keeps the list in step
 * with the lexer: a keyword added there without its `memberName` line fails.
 */

import { describe, expect, it } from "vitest";
import { CnxLexer } from "../grammar/CnxLexer";
import CnxSourceParser from "../CnxSourceParser";

const KEYWORDS = CnxLexer.literalNames
  .filter((literal): literal is string => literal !== null)
  .map((literal) => literal.slice(1, -1))
  .filter((word) => /^[A-Za-z_]\w*$/.test(word));

describe("memberName", () => {
  it("finds the lexer's keywords", () => {
    expect(KEYWORDS).toContain("ISR");
  });

  it.each(KEYWORDS)("'%s' parses as a struct field and after '.'", (word) => {
    const source = `struct S { u8 ${word}; }\nvoid f(S s) { u8 x <- s.${word}; }`;
    expect(CnxSourceParser.parse(source).parseErrors).toEqual([]);
  });
});
