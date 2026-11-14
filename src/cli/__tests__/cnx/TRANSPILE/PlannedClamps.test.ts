/**
 * #1991: 2.2 decides which `clamp` integer writes saturate and through which
 * helpers (ADR-044). These run the whole transpile, so they fail if 2.2 skips
 * a chain or a compound write, or plans a helper 2.3 never calls.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true, target: "host" },
    NodeFileSystem.instance,
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.2 plans every clamp helper 2.3 calls", () => {
  it("a clamp chain calls one helper per operator, in order", async () => {
    const code = await generate(
      "clamp u8 a <- 1;\nclamp u8 b <- 2;\nmut clamp u8 r;\nvoid f() { r <- a + b - a; }\n",
    );
    expect(code).toContain("r = cnx_clamp_sub_u8(cnx_clamp_add_u8(a, b), a);");
    expect(code).toContain("static inline uint8_t cnx_clamp_add_u8(");
    expect(code).toContain("static inline uint8_t cnx_clamp_sub_u8(");
  });

  it("an operator with no helper stays plain C where it stands (#1790)", async () => {
    const code = await generate(
      "clamp u8 a <- 1;\nclamp u8 b <- 2;\nmut clamp u8 r;\nvoid f() { r <- a * b / a; }\n",
    );
    expect(code).toContain("r = cnx_clamp_mul_u8(a, b) / a;");
    expect(code).not.toContain("cnx_clamp_div_");
  });

  it("a signed division calls its helper under either modifier (#1790)", async () => {
    const code = await generate(
      "i32 q(i32 n, i32 d) { return n / d; }\ni32 w(i32 n, i32 d) { wrap i32 wn <- n; wrap i32 wd <- d; return wn % wd; }\n",
    );
    expect(code).toContain("return cnx_clamp_div_i32(n, d);");
    expect(code).toContain("return cnx_wrap_mod_i32(wn, wd);");
    expect(code).toContain("static inline int32_t cnx_clamp_div_i32(");
    expect(code).toContain("static inline int32_t cnx_wrap_mod_i32(");
  });

  it("a compound division of a wrap target calls its helper (#1790)", async () => {
    const code = await generate(
      "mut wrap i32 c <- 0;\nvoid f(i32 d) { c /<- d; }\n",
    );
    expect(code).toContain("c = cnx_wrap_div_i32(c, d);");
  });

  it("a compound write to a clamp target calls its helper", async () => {
    const code = await generate(
      "mut clamp u16 c <- 0;\nvoid f() { c *<- 3; }\n",
    );
    expect(code).toContain("c = cnx_clamp_mul_u16(c, 3");
    expect(code).toContain("static inline uint16_t cnx_clamp_mul_u16(");
  });

  it("a compound write to a struct field calls its helper", async () => {
    const code = await generate(
      "struct S { clamp i16 v; }\nmut S s;\nvoid f() { s.v -<- 3; }\n",
    );
    expect(code).toContain("s.v = cnx_clamp_sub_i16(s.v, 3");
    expect(code).toContain("static inline int16_t cnx_clamp_sub_i16(");
  });

  it("a wrap target calls no helper", async () => {
    const code = await generate(
      "mut wrap u8 c <- 0;\nmut wrap u8 d <- 0;\nvoid f() { c +<- 1; d <- c + d; }\n",
    );
    expect(code).not.toContain("cnx_clamp_");
    expect(code).not.toContain("cnx_wrap_");
  });
});
