/**
 * Unit tests for ExternalDeclarationOracle.
 *
 * cnx collects header symbols by preprocessing each header standalone, which
 * fails for include-order-dependent framework headers (e.g. FreeRTOS task.h's
 * `#ifndef INC_FREERTOS_H / #error`). The oracle recovers by preprocessing a
 * header set AS A TRANSLATION UNIT (in order, keeping `#line` directives), then
 * splitting the output back into per-file slices (for the caller to parse into
 * full symbols) plus the names of function-like macros (no declaration to parse).
 */
import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExternalDeclarationOracle from "../ExternalDeclarationOracle";
import testPreprocessor from "./testPreprocessor";

const currentDir = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(currentDir, "fixtures", "oracle");

function allContent(perFile: Map<string, string>): string {
  return [...perFile.values()].join("\n");
}

describe("ExternalDeclarationOracle", () => {
  it("recovers a declaration only valid after its predecessor header", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return; // no toolchain in this env

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"', '"dependent.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    // dependent.h's #error passes only because predecessor.h ran first in the
    // TU; oracle_fn is emitted (by a predecessor-defined macro) into its slice.
    expect(recovery).not.toBeNull();
    expect(allContent(recovery!.perFileContent)).toContain("oracle_fn");
  });

  it("buckets each header's declarations under its own path", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"', '"dependent.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    const dependentKey = [...recovery!.perFileContent.keys()].find((k) =>
      k.endsWith("dependent.h"),
    );
    expect(dependentKey).toBeDefined();
    expect(recovery!.perFileContent.get(dependentKey!)).toContain("oracle_fn");
  });

  it("collects function-like macro names consumed by a normal preprocess", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(recovery!.macroNames.has("ORACLE_TICKS")).toBe(true);
  });

  it("does not surface names that are not declared anywhere", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(allContent(recovery!.perFileContent)).not.toContain(
      "totally_undeclared_symbol",
    );
    expect(recovery!.macroNames.has("totally_undeclared_symbol")).toBe(false);
  });

  it("drops a header that cannot preprocess and keeps the rest", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      // the middle include does not exist; it must be dropped, not fatal
      [
        '"predecessor.h"',
        "<this_header_does_not_exist_xyzzy.h>",
        '"dependent.h"',
      ],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(allContent(recovery!.perFileContent)).toContain("oracle_fn");
    expect(recovery!.macroNames.has("ORACLE_TICKS")).toBe(true);
  });

  it("keeps searching after dropping more than half the includes", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    // Three of five includes are individually unpreprocessable. Dropping them
    // one per iteration (>half) must not exhaust the loop before the two good
    // includes are tried together. Regression for the aliased loop bound that
    // re-read the shrinking directive count and bailed once >half were dropped.
    const recovery = await ExternalDeclarationOracle.recover(
      [
        "<cnx_no_such_header_a.h>",
        "<cnx_no_such_header_b.h>",
        "<cnx_no_such_header_c.h>",
        '"predecessor.h"',
        '"dependent.h"',
      ],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(recovery).not.toBeNull();
    expect(allContent(recovery!.perFileContent)).toContain("oracle_fn");
  });

  it("returns null for no includes", async () => {
    const preprocessor = testPreprocessor();
    const recovery = await ExternalDeclarationOracle.recover(
      [],
      preprocessor,
      {},
    );
    expect(recovery).toBeNull();
  });

  it("returns null when no header can preprocess", async () => {
    const preprocessor = testPreprocessor();
    if (!preprocessor.isAvailable()) return;

    // The only include does not exist; after it is dropped nothing remains, so
    // the largest-working-TU search exhausts and recovery yields null.
    const recovery = await ExternalDeclarationOracle.recover(
      ["<cnx_no_such_header_xyzzy.h>"],
      preprocessor,
      { includePaths: [FIXTURES] },
    );
    expect(recovery).toBeNull();
  });
});

describe("ExternalDeclarationOracle.definitionsByFile (#1881)", () => {
  const dump = [
    '# 0 "unit.c"',
    '# 0 "<built-in>"',
    "#define __GNUC__ 11",
    '# 0 "<command-line>"',
    "#define FROM_FLAG 1",
    '# 1 "/usr/include/stdc-predef.h" 1 3 4',
    "#define _STDC_PREDEF_H 1",
    '# 0 "<command-line>" 2',
    '# 1 "unit.c"',
    '# 1 "/p/board.h" 1',
    '# 1 "/p/pins.h" 1',
    "#define PIN 3",
    '# 2 "/p/board.h" 2',
    '# 9 "/p/board.h"',
    "#define LED 13",
    "#define GONE 1",
    "#undef GONE",
    '# 2 "unit.c" 2',
  ].join("\n");
  const read = ExternalDeclarationOracle.definitionsByFile(dump);

  it("sees a macro the included header defines itself, and a -D", () => {
    expect([...read.visible].sort()).toEqual(["FROM_FLAG", "LED"]);
  });

  it("hides a nested header's macro, builtins, and stdc-predef's", () => {
    for (const name of ["PIN", "__GNUC__", "_STDC_PREDEF_H"]) {
      expect(read.visible.has(name)).toBe(false);
    }
  });

  it("lists every macro still defined at the end, as -dM would", () => {
    expect(read.dump.split("\n").map((line) => line.split(" ")[1])).toEqual([
      "__GNUC__",
      "FROM_FLAG",
      "_STDC_PREDEF_H",
      "PIN",
      "LED",
    ]);
  });
});
