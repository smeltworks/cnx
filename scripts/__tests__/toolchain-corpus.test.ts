/**
 * Issue #1143: Corpus guard -- every requirement-bearing construct in committed
 * generated output must be explained by the requirements registry.
 *
 * This is Direction B of the invariant applied to the whole shipped corpus
 * rather than to a handful of snippets. It fails when someone adds a construct
 * that costs the user something (an extension, a newer standard, a platform
 * library) without declaring that cost -- which is how the documentation
 * drifted away from codegen in the first place.
 *
 * Orphaned snapshots are excluded: a `.expected.cpp` belonging to a
 * `test-c-only` fixture is never regenerated or compared, so it preserves
 * codegen shapes that no longer exist (#1149).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import TOOLCHAIN_REQUIREMENTS from "../../src/cnx/utils/constants/TOOLCHAIN_REQUIREMENTS";
import type TOutputMode from "../../src/cnx/types/TOutputMode";
import type TRequirementKey from "../../src/cnx/types/TRequirementKey";
import FileScanner from "../utils/FileScanner";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const testsDir = join(repoRoot, "tests");

/**
 * Tokens that betray a toolchain cost, mapped to the requirement that accounts
 * for them. A token seen in live output with no accounting requirement is the
 * failure this guard exists to catch.
 */
const ACCOUNTED_TOKENS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly keys: readonly TRequirementKey[];
  /**
   * Modes in which the token implies a cost. Omitted means every mode.
   *
   * Needed because a construct can be free in one mode and not the other:
   * `{ .field = value }` is baseline C99 in C output and C++20-or-an-extension
   * in C++ output, spelled identically.
   */
  readonly modes?: readonly TOutputMode[];
}> = [
  { pattern: /\b__asm\b/, keys: ["critical-arm-gnu"] },
  { pattern: /\b__attribute__\b/, keys: ["critical-arm-gnu"] },
  {
    pattern: /\b_Static_assert\b/,
    keys: ["float-assert-c11", "register-layout-assert-c11"],
  },
  {
    pattern: /\bstatic_assert\b/,
    keys: ["float-assert-cpp11", "register-layout-assert-cpp11"],
  },
  { pattern: /\b__LDREX[BHW]?\b/, keys: ["atomic-ldrex-cmsis"] },
  { pattern: /\b__STREX[BHW]?\b/, keys: ["atomic-ldrex-cmsis"] },
  { pattern: /\bSREG\b/, keys: ["critical-avr-libc"] },
  { pattern: /\bnoInterrupts\b/, keys: ["critical-arduino"] },
  {
    pattern: /\b__atomic_compare_exchange\b/,
    keys: ["atomic-gnu-builtins"],
  },
  { pattern: /\bfprintf\b/, keys: ["overflow-panic-hosted-libc"] },
  {
    // C99 spells designated initializers identically and pays nothing for
    // them, so this only implies a cost in C++ output.
    pattern: /\{\s*\.[A-Za-z_]\w*\s*=/,
    keys: ["cpp-designated-initializer"],
    modes: ["cpp"],
  },
];

/**
 * Constructs that must not appear in generated output at all. Each entry
 * records why, so re-introducing one is a deliberate decision with a place to
 * state its cost.
 */
const FORBIDDEN_TOKENS: ReadonlyArray<{
  readonly pattern: RegExp;
  readonly why: string;
}> = [
  {
    pattern: /\b__builtin_(?:add|sub|mul)_overflow\b/,
    why: "removed in #1143 as unreachable; re-adding imposes a GCC 5+ / Clang 3.8+ floor",
  },
  { pattern: /\b_Generic\b/, why: "C11; no requirement declares it" },
  { pattern: /\b_Noreturn\b/, why: "C11; no requirement declares it" },
  { pattern: /\b_Atomic\b/, why: "C11; no requirement declares it" },
  {
    pattern: /\b__typeof__\b/,
    why: "GNU extension; no requirement declares it",
  },
];

/** A snapshot whose fixture never runs that output mode is dead (#1149). */
function isOrphan(snapshot: string): boolean {
  const source = snapshot.replace(/\.expected\.(c|cpp|h|hpp)$/, ".test.cnx");
  if (!existsSync(source)) return true;
  const marker = readFileSync(source, "utf-8");
  const isCpp = snapshot.endsWith(".cpp") || snapshot.endsWith(".hpp");
  if (isCpp && /\/\/\s*test-c-only/.test(marker)) return true;
  if (!isCpp && /\/\/\s*test-cpp-only/.test(marker)) return true;
  return false;
}

function modeOf(snapshot: string): TOutputMode {
  return snapshot.endsWith(".cpp") || snapshot.endsWith(".hpp") ? "cpp" : "c";
}

const snapshots = [
  ...FileScanner.findFiles(testsDir, ".expected.c"),
  ...FileScanner.findFiles(testsDir, ".expected.cpp"),
  ...FileScanner.findFiles(testsDir, ".expected.h"),
  ...FileScanner.findFiles(testsDir, ".expected.hpp"),
].filter((file) => !isOrphan(file));

describe("committed generated output vs the requirements registry", () => {
  it("has a corpus to check", () => {
    expect(snapshots.length).toBeGreaterThan(500);
  });

  it("accounts for every requirement-bearing construct it contains", () => {
    const unaccounted: string[] = [];

    for (const snapshot of snapshots) {
      const text = readFileSync(snapshot, "utf-8");
      const mode = modeOf(snapshot);

      for (const token of ACCOUNTED_TOKENS) {
        if (token.modes !== undefined && !token.modes.includes(mode)) continue;
        if (!token.pattern.test(text)) continue;
        const explained = token.keys.some((key) => {
          const requirement = TOOLCHAIN_REQUIREMENTS[key];
          return (
            requirement.modes.includes(mode) &&
            requirement.probe !== null &&
            requirement.probe.test(text)
          );
        });
        if (!explained) {
          unaccounted.push(
            `${snapshot}: contains ${token.pattern} but no requirement among ` +
              `[${token.keys.join(", ")}] matches it in ${mode} mode`,
          );
        }
      }
    }

    expect(unaccounted).toEqual([]);
  });

  it("contains no construct the registry does not model", () => {
    const forbidden: string[] = [];

    for (const snapshot of snapshots) {
      const text = readFileSync(snapshot, "utf-8");
      for (const token of FORBIDDEN_TOKENS) {
        if (token.pattern.test(text)) {
          forbidden.push(`${snapshot}: ${token.pattern} -- ${token.why}`);
        }
      }
    }

    expect(forbidden).toEqual([]);
  });
});
