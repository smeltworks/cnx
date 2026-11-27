/**
 * 1.2's C header lowering (#1991): what 1.3 reads instead of the tree.
 */
import { describe, it, expect } from "vitest";
import HeaderParser from "../../HeaderParser";
import type ICStructSyntax from "../../types/ICStructSyntax";
import type TCExternalDeclarationSyntax from "../../types/TCExternalDeclarationSyntax";

function declarations(source: string): readonly TCExternalDeclarationSyntax[] {
  const syntax = HeaderParser.parseC(source).syntax;
  expect(syntax).not.toBeNull();
  return syntax!.declarations;
}

function struct(source: string): ICStructSyntax {
  const decl = declarations(source)[0];
  if (decl.kind !== "declaration" || !decl.struct) {
    throw new Error("expected a struct declaration");
  }
  return decl.struct;
}

describe("CHeaderLowering", () => {
  describe("field types", () => {
    it("lowers a simple field type", () => {
      expect(struct(`struct Test { int value; };`).fields[0].type).toBe("int");
    });

    it("joins a multi-word field type with spaces", () => {
      expect(
        struct(`struct Test { unsigned int count; };`).fields[0].type,
      ).toBe("unsigned int");
    });

    it("rebuilds an anonymous struct field type with spacing (#875)", () => {
      const type = struct(`typedef struct {
        int value;
        struct {
            unsigned int flag_a: 1;
            unsigned int flag_b: 1;
        } flags;
      } config_t;`).fields[1].type;
      expect(type).toContain("struct {");
      expect(type).toContain("unsigned int flag_a : 1;");
      expect(type).toContain("unsigned int flag_b : 1;");
    });

    it("rebuilds an anonymous union field type with the union keyword", () => {
      const type = struct(`typedef struct {
        union {
            int as_int;
            float as_float;
        } value;
      } variant_t;`).fields[0].type;
      expect(type).toContain("union {");
      expect(type).toContain("int as_int;");
      expect(type).toContain("float as_float;");
    });
  });

  describe("bit-fields (#1975 review)", () => {
    it("names a bit-field the grammar reads as a second type", () => {
      const fields = struct(
        `typedef struct { uint32_t a : 3, b : 5; } BF;`,
      ).fields;
      expect(fields.map((f) => [f.declarator.name, f.type])).toEqual([
        ["a", "uint32_t"],
        ["b", "uint32_t"],
      ]);
    });

    // #1975 review (owner ruling): `.type_bit_length` is the declared width
    it("records a bit-field's declared width, or its text", () => {
      const fields = struct(
        `typedef struct { uint32_t a : 3, b : W; uint8_t c; } BF;`,
      ).fields;
      expect(fields.map((f) => f.declarator.bitWidth)).toEqual([
        3,
        "W",
        undefined,
      ]);
    });

    it("marks a struct that has a bit-field, named or not", () => {
      expect(struct(`struct S { uint8_t x; uint8_t : 3; };`).hasBitField).toBe(
        true,
      );
      expect(struct(`struct S { uint8_t x; uint8_t y; };`).hasBitField).toBe(
        false,
      );
    });

    // NEGATIVE CONTROL: a lone typedef name is the field's type, not its name
    it("keeps a field's typedef name as its type", () => {
      const field = struct(`struct S { uint32_t a; };`).fields[0];
      expect([field.declarator.name, field.type]).toEqual(["a", "uint32_t"]);
    });
  });

  describe("declarators", () => {
    it("counts pointer depth and keeps the name", () => {
      const decl = declarations(`int **pp;`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0],
      ).toMatchObject({
        name: "pp",
        hasPointer: true,
        pointerDepth: 2,
        isFunction: false,
        functionPointerParams: null,
      });
    });

    it("records a function pointer's parameter list as written", () => {
      const decl = declarations(`typedef void (*cb_t)(int, char *);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0],
      ).toMatchObject({
        name: "cb_t",
        isFunction: true,
        functionPointerParams: "int,char*",
      });
    });

    it("keeps a function pointer's parameter words apart", () => {
      // #2348 review: `charconst` would read as a type of that name
      const decl = declarations(`void (*g)(char const *text);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0],
      ).toMatchObject({ functionPointerParams: "char const*text" });
    });

    it("lowers a prototype's parameters", () => {
      const decl = declarations(`int add(const int a, int b[]);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0]?.parameters,
      ).toEqual([
        { name: "a", type: "int", isConst: true, isArray: false },
        {
          name: "b",
          type: "int",
          isConst: false,
          isArray: true,
          arrayDimensions: [""],
        },
      ]);
    });

    it("keeps each array dimension and marks a nested declarator (#1619)", () => {
      const lowered = declarations(
        `void grid(const unsigned char g[4][8], int (*f)(void), int (*)[4], int[2][3]);`,
      )[0];
      expect(
        lowered.kind === "declaration" &&
          lowered.declarators?.[0]?.parameters?.map((p) => [
            p.arrayDimensions,
            p.isNestedDeclarator,
          ]),
      ).toEqual([
        [["4", "8"], undefined],
        [undefined, true],
        [undefined, true],
        [["2", "3"], undefined],
      ]);
    });

    it("lowers a prototype's unnamed parameters, as newlib spells fgets", () => {
      const decl = declarations(
        `typedef struct F FILE;\nchar *fgets(char *restrict, int, FILE *restrict);\nint sum(const int[], int);`,
      );
      const parametersOf = (index: number) => {
        const entry = decl[index];
        return (
          entry.kind === "declaration" && entry.declarators?.[0]?.parameters
        );
      };
      expect(parametersOf(1)).toEqual([
        { name: "", type: "char*", isConst: false, isArray: false },
        { name: "", type: "int", isConst: false, isArray: false },
        { name: "", type: "FILE*", isConst: false, isArray: false },
      ]);
      expect(parametersOf(2)).toEqual([
        {
          name: "",
          type: "int",
          isConst: true,
          isArray: true,
          arrayDimensions: [""],
        },
        { name: "", type: "int", isConst: false, isArray: false },
      ]);
    });

    it("lowers `(void)` as no parameters", () => {
      const decl = declarations(`int tick(void);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0]?.parameters,
      ).toEqual([]);
    });

    it("marks only a parameter list with no parameter types as unprototyped (#1619)", () => {
      const unprototyped = declarations(
        `void a();\nvoid b(void);\nvoid c(int x);\nint (*d)();\n`,
      ).map(
        (decl) =>
          decl.kind === "declaration" &&
          decl.declarators?.[0]?.isUnprototyped === true,
      );
      expect(unprototyped).toEqual([true, false, false, true]);
    });

    it("skips only a declarator error recovery left without its direct declarator", () => {
      const lowered = declarations(`void good(int a);\nint a, 8[2];\n`);
      const good = lowered[0];
      expect(good.kind === "declaration" && good.declarators?.[0]?.name).toBe(
        "good",
      );
    });

    it("leaves declarators null when the declaration has none", () => {
      const decl = declarations(`struct Point { int x; };`)[0];
      expect(decl.kind === "declaration" && decl.declarators).toBeNull();
    });
  });

  it("gives each enum member its own span", () => {
    const decl = declarations(`enum Color {\n  RED,\n  GREEN\n};`)[0];
    if (decl.kind !== "declaration" || !decl.enum) throw new Error("no enum");
    expect(decl.enum.members.map((m) => [m.name, m.span.line])).toEqual([
      ["RED", 2],
      ["GREEN", 3],
    ]);
  });
});
