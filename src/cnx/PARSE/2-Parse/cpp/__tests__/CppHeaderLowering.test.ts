/**
 * #2473 review: 1.2 records a class's member templates by the arguments they
 * take, so a call one of them can take is left unchecked.
 */
import { describe, it, expect } from "vitest";
import HeaderParser from "../../HeaderParser";
import type ICppClassSyntax from "../../types/ICppClassSyntax";

function classOf(source: string): ICppClassSyntax {
  const syntax = HeaderParser.parseCpp(source).syntax;
  expect(syntax).not.toBeNull();
  const found: ICppClassSyntax[] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== "object") return;
    if ("templateMembers" in node) found.push(node as ICppClassSyntax);
    for (const value of Object.values(node)) walk(value);
  };
  walk(syntax);
  expect(found).toHaveLength(1);
  return found[0];
}

describe("CppHeaderLowering member templates", () => {
  it("records each parameter and its default", () => {
    const cls = classOf(
      "class W { public: template <typename T> void op(T a, int b = 0); };",
    );
    expect(cls.templateMembers).toEqual([
      { name: "op", parameters: [{}, { hasDefault: true }], isVariadic: false },
    ]);
  });

  it("records a template defined in the class", () => {
    const cls = classOf(
      "class W { public: template <typename T> void def(T a) { } };",
    );
    expect(cls.templateMembers).toEqual([
      { name: "def", parameters: [{}], isVariadic: false },
    ]);
  });

  it("reads a parameter pack as taking any call", () => {
    const cls = classOf(
      "class W { public: template <typename... Ts> void any(Ts... xs); };",
    );
    expect(cls.templateMembers).toEqual([
      { name: "any", parameters: [], isVariadic: true },
    ]);
  });

  it("reads a trailing return type as taking any call", () => {
    const cls = classOf(
      "class W { public: template <typename T> auto tr(T a) -> void; };",
    );
    expect(cls.templateMembers).toEqual([
      { name: "tr", parameters: [], isVariadic: true },
    ]);
  });

  it("records no member template for a plain method", () => {
    expect(
      classOf("class W { public: void op(int a); };").templateMembers,
    ).toEqual([]);
  });
});
