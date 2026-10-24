import { describe, expect, it } from "vitest";

import CResolver from "../../../../../cnx/PARSE/3-Declare/c/index";
import HeaderParser from "../../../../../cnx/PARSE/2-Parse/HeaderParser";
import SymbolTable from "../../../../../cnx/PARSE/3-Declare/SymbolTable";
import TypeNameValueAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/TypeNameValueAnalyzer";
import testAnalysisContextFor from "./testAnalysisContextFor";

/**
 * #1975 review, #2078: a chain that names a type answers ADR-058's length
 * properties of it and of its fields' types, and names no value -- E0897.
 */
const errors = (source: string) => {
  const { syntax, context } = testAnalysisContextFor(source, {
    cppMode: false,
  });
  return new TypeNameValueAnalyzer(context).analyze(syntax);
};

const DECLS = "struct Point { u32 x; u8 y; }\nstruct A { u8[3] d; }\nPoint p;";

const inMain = (expr: string): string =>
  `${DECLS}\nu32 main() {\n    u32 n <- ${expr};\n    return n;\n}`;

describe("TypeNameValueAnalyzer", () => {
  it("accepts a type's lengths and a value's fields", () => {
    for (const expr of [
      "u32.type_byte_length",
      "Point.type_byte_length",
      "Point.y.type_bit_length",
      "A.d.type_element_count",
      "p.x",
      "p.y.type_byte_length",
    ]) {
      expect(errors(inMain(expr))).toEqual([]);
    }
  });

  it("rejects a member that is neither a field nor a length", () => {
    for (const [expr, message] of [
      ["u32.foo", "Type 'u32' has no field or length property 'foo'"],
      [
        "Point.z.type_byte_length",
        "Type 'Point' has no field or length property 'z'",
      ],
      ["Point.y.foo", "Type 'Point.y' has no field or length property 'foo'"],
    ]) {
      const found = errors(inMain(expr));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0897");
      expect(found[0].message).toBe(message);
      expect(found[0].span.line).toBe(5);
    }
  });

  it("rejects a type's field read or written as a value", () => {
    expect(errors(inMain("Point.x"))[0]?.message).toBe(
      "'Point.x' is a field of type 'Point', not a value",
    );
    expect(errors(inMain("A.d[0].type_byte_length"))[0]?.message).toBe(
      "'A.d' names a type, not a value",
    );
    const write = `${DECLS}\nvoid main() {\n    Point.x <- 5;\n}`;
    expect(errors(write).map((e) => e.code)).toEqual(["E0897"]);
  });

  it("names a scope's type, this. and global. heads as a bare one", () => {
    const source = `scope Geo {
    public struct Box { u8 w; }
    public u32 own() {
        return this.Box.type_byte_length + global.Point.type_byte_length;
    }
}
${DECLS}
u32 main() {
    u32 a <- Geo.Box.w.type_byte_length;
    u32 b <- Geo.Box.zz;
    return a + b;
}`;
    const found = errors(source);
    expect(found.map((e) => e.message)).toEqual([
      "Type 'Geo.Box' has no field or length property 'zz'",
    ]);
  });

  it("names a scope's function, not a global type it shadows (ADR-057)", () => {
    const source = `struct Config { u32 x; }
scope Shadow {
    public u32 Config() {
        return 9;
    }
    public struct Wrapper {
        Config c;
    }
    public u32 run() {
        mut Wrapper w;
        w.c <- Config;
        return w.c();
    }
}`;
    expect(errors(source)).toEqual([]);
  });

  it("reads a header enum's member as a value, as a cnx enum's", () => {
    const symbolTable = new SymbolTable();
    const tree = HeaderParser.parseC("typedef enum { HA, HB } HE;\n").syntax;
    symbolTable.addCSymbols(
      CResolver.resolve(tree!, "shapes.h", symbolTable).symbols,
    );
    const headerErrors = (expr: string) => {
      const { syntax, context } = testAnalysisContextFor(inMain(expr), {
        cppMode: false,
        symbolTable,
      });
      return new TypeNameValueAnalyzer(context).analyze(syntax);
    };
    expect(headerErrors("HE.HB")).toEqual([]);
    expect(headerErrors("HE.type_byte_length")).toEqual([]);
  });
});
