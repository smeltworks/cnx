/**
 * #1402: how many includes away each file is from a fixture.
 *
 * Measured over the graph 1.1 Discover resolved for the fixture's run
 * (`ITranspilerResult.includes`), `.cnx` files and C/C++ headers alike, so
 * the matrix resolves no include itself. Breadth-first, so a file reached
 * along two paths is as near as its shortest one: a provider gaining an
 * include of its own moves nothing the fixture uses from it.
 *
 * A header that another header includes is one hop further again
 * (`ISourceGraph.headerEdges`), so a C++ class reached through a relay header
 * is two hops away (#1523).
 */

function from(
  fixture: string,
  includes: ReadonlyMap<string, readonly string[]>,
): ReadonlyMap<string, number> {
  const hops = new Map<string, number>([[fixture, 0]]);
  const queue = [fixture];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    const distance = hops.get(next)! + 1;
    for (const included of includes.get(next) ?? []) {
      if (hops.has(included)) continue;
      hops.set(included, distance);
      queue.push(included);
    }
  }
  return hops;
}

class IncludeHops {
  static from = from;
}

export default IncludeHops;
