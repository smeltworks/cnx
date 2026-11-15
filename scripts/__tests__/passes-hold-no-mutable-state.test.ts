/**
 * #1452 box 4: no module under the pass roots holds mutable state.
 *
 * The box reads *"no module reachable from the pipeline holds mutable cross-pass
 * state"*. It had been argued on the card and never measured, which is the whole
 * problem: the obvious way to satisfy box 1 (`src/transpiler/state/` does not
 * exist) is to relocate `CodeGenState.ts` into a pass directory, and that would
 * place 64 mutable statics INSIDE a pass root while box 1 ticked and nothing in
 * the repository noticed. depcruise cannot see it -- it keys on paths, not on
 * whether a module holds state -- so the property has no guard at all.
 *
 * That is the inverse of the shape this repo keeps meeting. #1143, #1297 and
 * #1556 are guards that could not fail; this is a property with nothing even
 * claiming to watch it. The card is about to move 3,880 lines, and the failure
 * it must not have is the state arriving somewhere else intact.
 *
 * ## What it measures, and what it deliberately does not
 *
 * A mutable static class member is the shape `CodeGenState` is built from, and
 * a module-scope `let` is the same thing without a class around it. Both are
 * caught. Three shapes are NOT, each for a reason:
 *
 * - **`static readonly`** -- a binding that cannot be reassigned. Excluded by
 *   the pattern, and asserted below.
 * - **Module-scope `const` bound to a container** (`const FLOAT_TYPES = new
 *   Set([...])`). Measured before excluding: 20 of them exist under the pass
 *   roots today and every one is a constant lookup table built from literals at
 *   module load -- `VOID_RETURNING`, `NULLABLE_C_FUNCTIONS`, `RESERVED_FIELD_NAMES`,
 *   most already typed `ReadonlySet`. None is written by one pass and read by
 *   another, which is what box 4 forbids. Catching them would be
 *   over-enforcement, and the card would have to argue its way past its own guard.
 * - **State reached through an instance** a module happens to hold. That is the
 *   transitive shape, and `scripts/__tests__/artifact-lifetime.test.ts` is where
 *   it is pinned. This file is name-keyed, like its neighbors, and catches the
 *   declaration rather than the capability.
 *
 * ## Why the generated grammar is excluded
 *
 * Six real mutable statics exist under the pass roots and all six are
 * `private static __ATN: antlr.ATN` in ANTLR-generated lexers and parsers -- a
 * per-class ATN cache the tool emits, regenerated wholesale by `npm run antlr`
 * and not editable. The exclusion is narrow (generated grammar directories
 * only) and, per the #1556 lesson, its POPULATION IS ASSERTED: an `ignore` that
 * quietly stops matching invents a clean result rather than hiding a dirty one.
 * If the grammar moves again -- it moved to `PARSE/2-Parse/` in #1445 -- the
 * control below fails and says so, instead of the exclusion covering nothing.
 *
 * Measured on `19bbc516`: 364 files scanned, 6 hits, all of them `__ATN`.
 * Outside the generated grammar the population is zero, and this file is what
 * keeps it there while #1452 finds homes for the other 3,880 lines.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The pass roots, and deliberately NOT `layer-rules.test.ts`'s `LAYER_ROOTS`.
 *
 * That list includes `^src/cnx/types/` and `^src/cnx/instrumentation/`, because a
 * depcruise layering claim can be made about a shared root. Box 4 is a claim
 * about the PASSES -- and instrumentation is scanned below with its holders
 * named -- so sharing one list would be false sharing, not deduplication.
 *
 * The `WRITE/` layer joined with #1443: 3.1 Write had existed since #1653 and is a
 * pass, but this list predated it, so a mutable static in `Write` was outside
 * every root this guard scans.
 */
const PASS_ROOTS = ["src/cnx/PARSE", "src/cnx/TRANSPILE", "src/cnx/WRITE"];

/**
 * Scanned alongside the pass roots, with its three holders listed below.
 *
 * The `instrumentation/` root did not exist when this file was written, and #1452
 * created it -- so the four mutable statics this card RELOCATED there sat
 * outside every root this guard scans. The box-4 guard could not fail on the
 * state the box is about, which is the shape the header above spends its length
 * arguing against, arriving through a new directory rather than a new field.
 *
 * Adding the root does not forbid them: `docs/architecture/README.md` admits
 * instrumentation as the one root that may hold mutable state, and that
 * decision stands. It makes the exemption a LIST rather than a geography. A
 * comment in `ToolchainRequirements` (deleted under #1991, its sites now a
 * 2.2 value) already said "do not read its presence in
 * this root as a precedent"; a comment is not a gate, and a fifth static added
 * here now fails this file instead of relying on the next reader having read
 * that sentence.
 */
const INSTRUMENTATION_ROOT = "src/cnx/instrumentation";

/**
 * The four, each named with what it accumulates.
 *
 * An observation OF the run, which nothing downstream branches on -- that is
 * the admission test for this root. A holder that fails it does not belong here
 * whatever directory it sits in, and the list is where that gets argued.
 */
const INSTRUMENTATION_HOLDERS = [
  "src/cnx/instrumentation/AdrProvenance.ts:59",
  "src/cnx/instrumentation/AdrProvenance.ts:60",
];

/**
 * A mutable static class member.
 *
 * Anchored on the member name so a method cannot match: `static foo()` and the
 * generic `static of<K extends T>(` are both followed by `(` or `<`, never by
 * `:` or `=`. An earlier hand-rolled probe for this card got that wrong twice --
 * it required a two-space indent, so it missed all six four-space `__ATN`
 * declarations and reported zero, and when widened it piped through a bare
 * `[:=]` match that fired on the `:` inside `<K extends TSymbolKindCnx>` and
 * reported nineteen. Neither number was real. The anchoring is the fix.
 */
const MUTABLE_STATIC =
  /^\s*(?:public|private|protected)?\s*static\s+(?!readonly\b)(?:#?[A-Za-z_$][\w$]*)\s*[:=]/;

/**
 * `static readonly` bound to a MUTABLE container -- the binding cannot be
 * reassigned, and `.set()` on it is still process-global state.
 *
 * `readonly` is exempted above on the grounds that the slot cannot change, and
 * for a scalar that is the whole story. For a `Map` it is not: `private static
 * readonly cache = new Map()` written with `.set()` is the same shape as the 92
 * statics #1452 removed, and the exemption waved it through. Verified: adding
 * that line to an analyzer passed 9/9, and the same line without `readonly`
 * failed.
 *
 * A `Readonly*` annotation is accepted, because the compiler then refuses the
 * write -- which is the property `readonly` was being credited with.
 *
 * The lookahead is `(?!\s*Readonly)` rather than `\s*(?!Readonly)`: with the
 * whitespace outside it, backtracking matched `\s*` as ZERO characters and
 * tested the lookahead against `" ReadonlyMap"`, which does not start with
 * `Readonly`, so the annotation that makes the container safe was what let it
 * through. Both directions are pinned below.
 */
const MUTABLE_READONLY_CONTAINER =
  /^\s*(?:public|private|protected)?\s*static\s+readonly\s+(?:#?[A-Za-z_$][\w$]*)\s*(?::(?!\s*Readonly)[^=]*)?=\s*new\s+(?:Map|Set|WeakMap|WeakSet|Array)\b/;

/**
 * The two that exist today, both filled once at module load and never written
 * again. Named rather than pattern-exempted: a third one should have to be
 * argued for here.
 */
const CONTAINER_HOLDERS = [
  "src/cnx/TRANSPILE/3-Render/codegen/assignment/handlers/index.ts",
];

/** A module-scope `let` -- the same mutable slot without a class around it. */
const MODULE_LET = /^let\s+[A-Za-z_$]/;

/** Generated by `npm run antlr`; regenerated wholesale, never hand-edited. */
const GENERATED_GRAMMAR = /\/grammar\//;

/**
 * Creating a scope in the run's registry. 1.3 Declare authors the scope graph;
 * every later pass reads it.
 */
const SCOPE_CREATION = /\.getOrCreateScope\s*\(/;

/** The pass that authors the scope graph, and the only one that may grow it. */
const DECLARE_PASS = "src/cnx/PARSE/3-Declare/";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") found.push(...sourceFiles(full));
    } else if (entry.name.endsWith(".ts")) {
      found.push(full);
    }
  }
  return found;
}

/** Every `path:line` under the pass roots whose line declares mutable state. */
function holders(includeGenerated: boolean): string[] {
  const found: string[] = [];
  for (const root of [...PASS_ROOTS, INSTRUMENTATION_ROOT]) {
    for (const path of sourceFiles(join(rootDir, root))) {
      const relative = path.slice(rootDir.length + 1);
      if (!includeGenerated && GENERATED_GRAMMAR.test(relative)) continue;

      readFileSync(path, "utf-8")
        .split("\n")
        .forEach((line, index) => {
          const container =
            MUTABLE_READONLY_CONTAINER.test(line) &&
            !CONTAINER_HOLDERS.includes(relative);
          if (MUTABLE_STATIC.test(line) || MODULE_LET.test(line) || container) {
            found.push(`${relative}:${index + 1}`);
          }
        });
    }
  }
  return found;
}

/**
 * Every `path:line` under the pass roots that CREATES a scope in the run's
 * registry, outside the pass that authors it.
 *
 * Name-keyed like the helpers above, and for the same reason: the shape is a
 * declaration, not a capability.
 */
function scopeCreators(): string[] {
  const found: string[] = [];
  for (const root of PASS_ROOTS) {
    for (const path of sourceFiles(join(rootDir, root))) {
      const relative = path.slice(rootDir.length + 1);
      if (relative.startsWith(DECLARE_PASS)) continue;

      readFileSync(path, "utf-8")
        .split("\n")
        .forEach((line, index) => {
          if (SCOPE_CREATION.test(line)) {
            found.push(`${relative}:${index + 1}`);
          }
        });
    }
  }
  return found;
}

describe("the passes hold no mutable state (#1452 box 4)", () => {
  it("names no module under a pass root that holds mutable state", () => {
    expect(holders(false)).toEqual(INSTRUMENTATION_HOLDERS);
  });

  it("still reaches the instrumentation holders it exempts", () => {
    // Population control for the exemption itself. An allowlist that stops
    // matching reads exactly like a clean tree -- it would make the assertion
    // above pass for the wrong reason, which is the defect this arm was added
    // to fix rather than to repeat one level down.
    expect(
      holders(false).filter((site) => site.startsWith(INSTRUMENTATION_ROOT)),
    ).toEqual(INSTRUMENTATION_HOLDERS);
  });

  it("scans the pass roots at all", () => {
    // Population control. An empty scan satisfies the assertion above and reads
    // exactly like a clean tree -- the failure `unknown-carriers.test.ts`
    // shipped with, where a live population on one arm of a disjunction
    // satisfied the control while the arm that mattered matched nothing.
    const scanned = PASS_ROOTS.flatMap((root) =>
      sourceFiles(join(rootDir, root)),
    );

    expect(scanned.length).toBeGreaterThan(100);
  });

  it("still has something to exclude in the generated grammar", () => {
    // The exclusion's own control. Six `private static __ATN` declarations sit
    // in the generated lexers and parsers; if the grammar moves again and
    // `GENERATED_GRAMMAR` stops matching, THIS fails rather than the exclusion
    // silently covering nothing. #1556: an `ignore` pointing at a path that no
    // longer exists removes files from the graph and invents a clean result.
    const generatedOnly = holders(true).filter((entry) =>
      GENERATED_GRAMMAR.test(entry),
    );

    expect(generatedOnly.length).toBeGreaterThan(0);
  });

  it("detects a mutable static, in each spelling it can wear", () => {
    // Per-arm control. `MUTABLE_STATIC` is the arm with no live site once the
    // generated grammar is excluded, so without this it is asserted by nothing.
    expect(MUTABLE_STATIC.test("  static cache = new Map();")).toBe(true);
    // Per-direction control for the container arm: a mutable container is
    // flagged, a `Readonly*`-annotated one is not, and a readonly SCALAR is not.
    expect(
      MUTABLE_READONLY_CONTAINER.test(
        "  private static readonly cache: Map<string, string> = new Map();",
      ),
    ).toBe(true);
    expect(
      MUTABLE_READONLY_CONTAINER.test(
        "  private static readonly B: ReadonlyMap<string, string> = new Map(",
      ),
    ).toBe(false);
    expect(
      MUTABLE_READONLY_CONTAINER.test("  private static readonly N = 5;"),
    ).toBe(false);
    expect(
      MUTABLE_STATIC.test("  private static cache: Map<string, string>;"),
    ).toBe(true);
    expect(MUTABLE_STATIC.test("    private static __ATN: antlr.ATN;")).toBe(
      true,
    );
    expect(MUTABLE_STATIC.test("  public static count = 0;")).toBe(true);
  });

  it("no pass after 1.3 Declare creates a scope", () => {
    // #1452: `getOrCreateScope` warns in its own docblock that read-only
    // lookups must use `getScope`, and two callers ignored it -- 2.1 Analyze
    // and 2.2 Plan each turned a scope NAME into a PATH by creating the scope
    // and reading `pathOf` off the result.
    //
    // It gave the right answer: a name the registry has not seen produces a
    // scope whose `cnxScopedName` is that name, so the orphan equalled the
    // fallback. What it cost was that "a later pass never mutates 1.3's
    // artifact" held by measurement -- 120 fixtures, zero creations -- rather
    // than by construction. `SymbolRegistry.scopePathOf` is the read, and this
    // is what keeps the two from growing back.
    expect(scopeCreators()).toEqual([]);
  });

  it("finds the creations 1.3 Declare itself makes", () => {
    // Population control. Without it, a renamed method or a registry that
    // stopped offering creation at all would leave the assertion above passing
    // on an empty search -- the #1556 shape, a guard that cannot fail.
    const declarePath = join(rootDir, DECLARE_PASS);
    const creations = sourceFiles(declarePath).filter((path) =>
      readFileSync(path, "utf-8")
        .split("\n")
        .some((line) => SCOPE_CREATION.test(line)),
    );

    expect(creations.length).toBeGreaterThan(0);
  });

  it("detects a module-scope let", () => {
    expect(MODULE_LET.test("let current = null;")).toBe(true);
  });

  it("ignores what is not a mutable slot", () => {
    // The over-enforcement control. Each of these exists under the pass roots
    // today, and flagging any one of them would make this guard unsatisfiable.
    expect(MUTABLE_STATIC.test("  static readonly NAMES = new Set();")).toBe(
      false,
    );
    expect(MUTABLE_STATIC.test("  private cache = new Map();")).toBe(false);
    expect(MUTABLE_STATIC.test("  static resolve(tree: Tree): void {")).toBe(
      false,
    );
    expect(MUTABLE_STATIC.test("  static of<K extends TSymbolKindCnx>(")).toBe(
      false,
    );
    expect(MUTABLE_STATIC.test("  public static get _ATN(): antlr.ATN {")).toBe(
      false,
    );
    expect(MODULE_LET.test('const FLOAT_TYPES = new Set(["f32"]);')).toBe(
      false,
    );
  });
});
