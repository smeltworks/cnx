/**
 * #1402: the relationship axis.
 *
 * Hops decide which matrix column a position occupies, so a wrong answer here
 * silently credits coverage to the wrong cell. These pin what distinguishes a
 * nearest-path walk from a plausible one: diamonds, cycles, and files the run
 * never reached.
 */

import IncludeHops from "../matrix/IncludeHops";
import MatrixCell from "../matrix/MatrixCell";

const graph = (
  edges: Record<string, string[]>,
): ReadonlyMap<string, readonly string[]> => new Map(Object.entries(edges));

describe("IncludeHops.from", () => {
  it("puts the fixture itself at 0", () => {
    expect(IncludeHops.from("f.cnx", graph({})).get("f.cnx")).toBe(0);
  });

  it("counts a direct include as 1 and its include as 2", () => {
    const hops = IncludeHops.from(
      "f.cnx",
      graph({ "f.cnx": ["a.cnx"], "a.cnx": ["b.h"] }),
    );
    expect(hops.get("a.cnx")).toBe(1);
    expect(hops.get("b.h")).toBe(2);
  });

  it("takes the SHORTER path through a diamond, whichever is walked first", () => {
    const hops = IncludeHops.from(
      "f.cnx",
      graph({
        "f.cnx": ["middle.cnx", "provider.cnx"],
        "middle.cnx": ["provider.cnx"],
      }),
    );
    expect(hops.get("provider.cnx")).toBe(1);
  });

  it("terminates on a cycle", () => {
    const hops = IncludeHops.from(
      "f.cnx",
      graph({ "f.cnx": ["a.cnx"], "a.cnx": ["f.cnx"] }),
    );
    expect([...hops]).toEqual([
      ["f.cnx", 0],
      ["a.cnx", 1],
    ]);
  });

  it("gives no distance to a file the fixture does not reach", () => {
    const hops = IncludeHops.from(
      "f.cnx",
      graph({ "other.test.cnx": ["a.cnx"] }),
    );
    expect(hops.has("a.cnx")).toBe(false);
  });
});

describe("MatrixCell.relationshipFor", () => {
  it.each([
    ["consumer", 0, "same-file"],
    ["consumer", 1, "imported-direct"],
    ["consumer", 2, "imported-transitive"],
    ["consumer", 5, "imported-transitive"],
    ["provider", 1, "exercised-from-one-away"],
    ["provider", 2, "exercised-through-chain"],
    ["provider", 5, "exercised-through-chain"],
  ] as const)("maps %s at %i hops to %s", (side, hops, expected) => {
    expect(MatrixCell.relationshipFor(side, hops)).toBe(expected);
  });
});
