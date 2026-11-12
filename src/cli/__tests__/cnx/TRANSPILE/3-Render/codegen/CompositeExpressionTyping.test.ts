/**
 * Issue #1152: Conversion rules must apply to composite expressions.
 *
 * `TypeResolver.getExpressionType` returns null for any composite (`a + b`),
 * so every conversion rule keyed on the source type silently did nothing on
 * exactly the expressions MISRA C:2012 Rule 10.8 is about. Narrowing and
 * sign-change were enforced for a plain variable and invisible for a sum of
 * two -- the cases where truncation is *more* likely, not less.
 *
 * The composite resolver already existed (written for slice assignment, and
 * citing Rule 10.8); the assignment path simply never used it.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../../../Transpiler";
import MockFileSystem from "../../../../MockFileSystem";

async function transpile(source: string) {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true, target: "host" },
    new MockFileSystem(),
  );
  return transpiler.transpile({ kind: "source", source });
}

async function errorsFor(source: string): Promise<string> {
  const result = await transpile(source);
  return result.errors.map((e) => e.message).join("\n");
}

describe("conversion rules on composite expressions", () => {
  describe("previously invisible, now rejected", () => {
    it("rejects narrowing a sum", async () => {
      const errors = await errorsFor(
        `u32 main() { u16 w <- 300; u16 v <- 300; u8 c <- w + v; return 0; }`,
      );
      expect(errors).toContain("Cannot assign u16 to u8 (narrowing)");
    });

    it("rejects narrowing a product", async () => {
      const errors = await errorsFor(
        `u32 main() { u32 a <- 5; u32 b <- 5; u16 c <- a * b; return 0; }`,
      );
      expect(errors).toContain("Cannot assign u32 to u16 (narrowing)");
    });

    it("rejects a sign change on a sum", async () => {
      const errors = await errorsFor(
        `u32 main() { i16 a <- 5; i16 b <- 5; u16 c <- a + b; return 0; }`,
      );
      expect(errors).toContain("Cannot assign i16 to u16 (sign change)");
    });
  });

  describe("must remain accepted", () => {
    it("accepts bit extraction, which ADR-024 defines as the explicit reinterpret", async () => {
      // Typing this as a plain u32 would make the sanctioned escape hatch fail
      // the very check it exists to satisfy.
      const result = await transpile(
        `u32 main() { u32 u <- 5; i32 s <- u[0, 32]; return 0; }`,
      );
      expect(result.errors).toEqual([]);
    });

    it("types a ternary by its arms, not its condition", async () => {
      // The condition is parenthesised, so it is child index 1, not 0 --
      // counting it types `(val > 0) ? 1 : -1` by `val` and reports i32 as u32.
      const result = await transpile(
        `u32 main() { u32 val <- 5; i32 s <- (val > 0) ? 1 : -1; return 0; }`,
      );
      expect(result.errors).toEqual([]);
    });

    it("accepts a same-width composite", async () => {
      const result = await transpile(
        `u8 f(u8 a, u8 b) { u8 c <- a + b; return c; } u32 main() { return 0; }`,
      );
      expect(result.errors).toEqual([]);
    });

    it("accepts widening a plain value, per ADR-024", async () => {
      const result = await transpile(
        `u32 main() { u8 b <- 255; u16 w <- b; return 0; }`,
      );
      expect(result.errors).toEqual([]);
    });
  });
});
