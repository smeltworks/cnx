/**
 * Unit tests for DependencyGraph
 */

import { describe, it, expect, beforeEach } from "vitest";
import DependencyGraph from "../DependencyGraph";

describe("resolveToposortReverse", () => {
  const mockFn = () => [new Set(["a"])];

  it("should use direct export when available (vitest case)", () => {
    const mod = { toposortReverse: mockFn };
    expect(DependencyGraph.resolveToposortReverse(mod)).toBe(mockFn);
  });

  it("should fall back to default export (tsx case)", () => {
    const mod = { default: { toposortReverse: mockFn } };
    expect(DependencyGraph.resolveToposortReverse(mod)).toBe(mockFn);
  });
});

describe("DependencyGraph", () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe("addFile", () => {
    it("should add a file to the graph", () => {
      graph.addFile("a.cnx");
      expect(graph.getSortedFiles()).toHaveLength(1);
    });

    it("should not duplicate files", () => {
      graph.addFile("a.cnx");
      graph.addFile("a.cnx");
      expect(graph.getSortedFiles()).toHaveLength(1);
    });
  });

  describe("addDependency", () => {
    it("should add both files to the graph", () => {
      graph.addDependency("a.cnx", "b.cnx");
      expect(graph.getSortedFiles()).toHaveLength(2);
    });

    it("should handle multiple dependencies", () => {
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("a.cnx", "c.cnx");
      expect(graph.getSortedFiles()).toHaveLength(3);
    });
  });

  describe("getSortedFiles", () => {
    it("should return empty array for empty graph", () => {
      expect(graph.getSortedFiles()).toEqual([]);
    });

    it("should return single file for single node", () => {
      graph.addFile("a.cnx");
      expect(graph.getSortedFiles()).toEqual(["a.cnx"]);
    });

    it("should sort dependency before dependent", () => {
      // a depends on b, so b should come first
      graph.addDependency("a.cnx", "b.cnx");
      const sorted = graph.getSortedFiles();

      const bIndex = sorted.indexOf("b.cnx");
      const aIndex = sorted.indexOf("a.cnx");
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("should handle chain of dependencies", () => {
      // a -> b -> c (a depends on b, b depends on c)
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("b.cnx", "c.cnx");

      const sorted = graph.getSortedFiles();

      const cIndex = sorted.indexOf("c.cnx");
      const bIndex = sorted.indexOf("b.cnx");
      const aIndex = sorted.indexOf("a.cnx");

      expect(cIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("should handle diamond dependencies", () => {
      // a -> b, a -> c, b -> d, c -> d
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("a.cnx", "c.cnx");
      graph.addDependency("b.cnx", "d.cnx");
      graph.addDependency("c.cnx", "d.cnx");

      const sorted = graph.getSortedFiles();

      const dIndex = sorted.indexOf("d.cnx");
      const bIndex = sorted.indexOf("b.cnx");
      const cIndex = sorted.indexOf("c.cnx");
      const aIndex = sorted.indexOf("a.cnx");

      // d must come before b and c
      expect(dIndex).toBeLessThan(bIndex);
      expect(dIndex).toBeLessThan(cIndex);
      // b and c must come before a
      expect(bIndex).toBeLessThan(aIndex);
      expect(cIndex).toBeLessThan(aIndex);
    });

    it("should handle independent files", () => {
      graph.addFile("a.cnx");
      graph.addFile("b.cnx");
      graph.addFile("c.cnx");

      const sorted = graph.getSortedFiles();
      expect(sorted).toHaveLength(3);
      expect(sorted).toContain("a.cnx");
      expect(sorted).toContain("b.cnx");
      expect(sorted).toContain("c.cnx");
    });

    it("should handle cycle and add warning", () => {
      // a -> b -> a (cycle)
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("b.cnx", "a.cnx");

      const sorted = graph.getSortedFiles();

      // Should still return files (not throw)
      expect(sorted).toHaveLength(2);
      expect(sorted).toContain("a.cnx");
      expect(sorted).toContain("b.cnx");

      // Should have a warning
      const warnings = graph.getWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("Circular dependency");
    });
  });
});
