import { describe, it, expect } from "vitest";
import ForeignRedeclaration from "../ForeignRedeclaration";

describe("ForeignRedeclaration (#2474)", () => {
  describe("pool", () => {
    it("keeps the declarations the reader sees, in order", () => {
      expect(
        ForeignRedeclaration.pool(["a", "b", "c"], (e) => e !== "b"),
      ).toEqual(["a", "c"]);
    });

    it("falls back to every declaration when the reader sees none", () => {
      expect(ForeignRedeclaration.pool(["a", "b"], () => false)).toEqual([
        "a",
        "b",
      ]);
    });
  });

  describe("dimensions", () => {
    it("takes an unsized dimension's bound from a redeclaration", () => {
      expect(ForeignRedeclaration.dimensions([""], [[""], [4]])).toEqual([4]);
    });

    it("keeps a sized first declaration's bound", () => {
      expect(ForeignRedeclaration.dimensions([4], [[4], [""]])).toEqual([4]);
    });

    it("ignores a redeclaration of a different rank", () => {
      expect(ForeignRedeclaration.dimensions(["", 2], [[8], [3, 2]])).toEqual([
        3, 2,
      ]);
    });

    it("leaves a dimension no declaration sizes unsized", () => {
      expect(ForeignRedeclaration.dimensions([""], [[""]])).toEqual([""]);
    });
  });
});
