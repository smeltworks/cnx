import { describe, it, expect, beforeEach } from "vitest";

import AdrProvenance from "../AdrProvenance";

describe("AdrProvenance", () => {
  beforeEach(() => {
    AdrProvenance.reset();
  });

  it("records a site against the current file", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("057", 12);

    expect(AdrProvenance.collect()).toEqual([
      { adr: "057", sourcePath: "a.cnx", line: 12 },
    ]);
  });

  it("attributes each site to the file current when it was recorded", () => {
    // #1241: provenance is read once at the end of a run, but recorded per
    // file. Holding only the LAST file would credit every fixture's cells to
    // whichever file happened to be transpiled last.
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("057", 3);
    AdrProvenance.beginFile("b.cnx");
    AdrProvenance.record("057", 4);

    expect(AdrProvenance.collect()).toEqual([
      { adr: "057", sourcePath: "a.cnx", line: 3 },
      { adr: "057", sourcePath: "b.cnx", line: 4 },
    ]);
  });

  it("deduplicates a rule that fires repeatedly at one position", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("057", 9);
    AdrProvenance.record("057", 9);

    expect(AdrProvenance.collect()).toHaveLength(1);
  });

  it("keeps two declarations a rule fired about on one line apart (#1402)", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("045", 9, undefined, {
      sourcePath: "a.cnx",
      line: 2,
      column: 0,
    });
    AdrProvenance.record("045", 9, undefined, {
      sourcePath: "lib.cnx",
      line: 4,
      column: 0,
    });

    expect(AdrProvenance.collect()).toHaveLength(2);
  });

  it("keeps the same line for different ADRs apart", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("016", 9);
    AdrProvenance.record("057", 9);

    expect(AdrProvenance.collect()).toHaveLength(2);
  });

  it("drops a record with no current file", () => {
    // Never call beginFile: a site with no file cannot be resolved to a cell,
    // and guessing one would manufacture occupancy.
    AdrProvenance.record("057", 12);

    expect(AdrProvenance.collect()).toEqual([]);
  });

  it("drops a non-positive or missing line", () => {
    // The same reason FixtureContext refuses the synthetic 1:0 placeholder:
    // an unresolvable position must not become occupancy for whatever
    // declaration happens to start the file.
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("057", 0);
    AdrProvenance.record("057", -1);
    AdrProvenance.record("057", null);
    AdrProvenance.record("057", undefined);

    expect(AdrProvenance.collect()).toEqual([]);
  });

  it("clears the current file on reset, so a later record is dropped", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("057", 12);
    AdrProvenance.reset();
    AdrProvenance.record("057", 12);

    expect(AdrProvenance.collect()).toEqual([]);
  });

  it("keeps the rule a site was recorded for, apart from the ADR's own (#1731 review)", () => {
    AdrProvenance.beginFile("a.cnx");
    AdrProvenance.record("045", 9);
    AdrProvenance.record("045", 9, "string-copy");
    AdrProvenance.record("045", 9, "string-copy");

    expect(AdrProvenance.collect()).toEqual([
      { adr: "045", sourcePath: "a.cnx", line: 9 },
      { adr: "045", sourcePath: "a.cnx", line: 9, rule: "string-copy" },
    ]);
  });
});
