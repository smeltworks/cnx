/**
 * #1449: 2.2 decides, 2.3 formats -- asserted, not remembered.
 *
 * `docs/architecture/README.md` §1 gives 2.2 Plan the question "does this file
 * need `<stdint.h>`?" and gives 2.3 Render only the text. Nothing enforced it:
 * the answer crossed the boundary as `CodeGenState.needsStdint`, and a flag is a QUESTION,
 * so every reader answered it again. `addAutoIncludes` answered "emit it if the
 * flag is set" while `HeaderGeneratorUtils` answered "emit it always" -- one
 * question, two derivations, agreeing only on files where both happened to be
 * true.
 *
 * The fix is not "read the flag in fewer places", it is that a renderer must
 * not read the flag AT ALL: it reads `IEmissionPlan`, which holds the strings
 * to emit. So the property with teeth is about WHERE a `needs*` flag may be
 * read, and there are exactly two such places -- the captures that freeze the
 * questions for the plan to answer, one per emitted artifact.
 *
 * This is the `layer-rules.test.ts` shape: a claim a comment cannot hold,
 * because the next person to add an include flag will reach for the pattern
 * they find, and what they find is what this file constrains.
 *
 * ## Why this file covers five categories and not one
 *
 * #1449's definition of done says every "does this file need X?" decision is
 * made in 2.2 Plan exactly once, and names five: includes, helpers, MISRA
 * annotations, declaration order, and toolchain requirements. That box sat
 * unchecked with the reason on it -- "**exactly once** is a completeness claim
 * over all of `output/`, and nothing gates it yet".
 *
 * - **Scope.** The scan root was the render pass, so the `needsISR`
 *   read in `HeaderEmissionCapture.capture` (then the orchestrator's) -- a legitimate capture,
 *   but the SECOND one -- was outside the guard's view entirely. The root is
 *   now `src/`, and both captures are named.
 * - **Toolchain requirements** need no separate assertion: `needsISR`,
 *   `needsIrqWrappers` and `needsFloatStaticAssert` ARE `needs*` flags, so the
 *   widened read rule is what covers them. Recorded here because "it is already
 *   covered" is exactly the claim a later reader would otherwise re-derive.
 * - **MISRA annotations** and **declaration order** get one check each, below.
 *
 * ## The two shapes, and why each category gets the one it does (#1583 review)
 *
 * The first version of this file had them backwards, and both errors were
 * demonstrated rather than argued:
 *
 * - Annotations were keyed on the standard's NAME (`MISRA|DO-178C?|…`, or an
 *   interpolation spelled `STANDARD`). A second author defeated that by
 *   renaming one constant -- `const spec = "MISRA C:2012"` in a template
 *   literal passed all six assertions. Name-keyed is not rename-proof, and the
 *   mutation that "proved" it wrote the standard LITERALLY, which is the one
 *   case the regex did catch. The mutation was too easy and the table read
 *   stronger than the guard.
 * - Declaration order was a substring match over whole file contents, so a
 *   COMMENT mentioning `TDeclarationKind` reddened it -- contradicting both
 *   this file's own "a mention inside a comment is documentation, not a read"
 *   and the claim that it gated the import.
 *
 * So: declaration order is import-shaped, and annotations get BOTH shapes,
 * because neither alone is sufficient. The import check is rename-proof but
 * blind to a fully hand-rolled string; the form check catches the hand-rolled
 * string but must be kept off the wrong population -- `1-Analyze/` writes
 * "(MISRA C:2012 Rule 3.1)" into DIAGNOSTIC text, which is not an emitted
 * annotation and never reaches generated C, because that layer generates none.
 */

import { readFileSync } from "node:fs";
import { join, sep } from "node:path";

import SourceScan from "./SourceScan";

const rootDir = join(__dirname, "..", "..");

/**
 * The methods allowed to read the flags, and the reason each exists.
 *
 * One, for the `.h`: it freezes the warm per-file state at the one moment it
 * is correct for that file (#1323), and everything downstream reads the
 * captured `IHeaderEmissionFacts`. The `.c`'s facts are planned by 2.2 (#1991)
 * and arrive in `IEmissionPlan`, so no render state is read for them.
 */
const CAPTURES = [
  // #1991: the `.c` capture stood here (`planEmissionFacts`). 2.2 now builds
  // the `.c`'s emission facts from its own `PlannedRequirements` before 2.3
  // runs, so it reads no flag off the render state and is not a capture.
  {
    // #1443 moved the header capture out of the orchestrator, beside the
    // header adapter it reads. Still one capture for the `.h`.
    file: join(
      "src",
      "cnx",
      "TRANSPILE",
      "3-Render",
      "headers",
      "HeaderEmissionCapture.ts",
    ),
    needle: "static capture(",
  },
] as const;

/**
 * A decision read off the render state: an include flag, or a helper-op set.
 *
 * `usedSafeDivOps` is here because the plan carries it too, and for a while
 * the renderer took it from the state anyway -- the fact
 * in two places with the renderer using the other one. Nothing behavioral
 * could catch that: the plan is BUILT from the state, so both hold the same
 * values and a test asserting the output cannot tell which was read. The claim
 * is structural, so the check is.
 *
 * #1452 moved these onto `TranspileState`, an instance the walker reaches as
 * `this.host.state`, `CodeGenerator` as `this.state`, and the orchestrator
 * through `CodeGenWalker.transpileState`, so the selector names all four
 * spellings. Adding a spelling is how this guard stays honest across a move:
 * the alternative is dropping the file from the expectation, which would hide
 * a read rather than track it. It keyed on `CodeGenState.` alone and went to zero when
 * the members moved -- caught by the population control below, which is what
 * it is for.
 *
 * `.add(` is excluded, not exempted: `applyEffects` mutating the set while
 * declarations are generated is the accumulate phase, which is what produces
 * the questions the plan answers. Reading one at emission time is the defect.
 */
const FLAG_READ =
  /(?:\bstate|\w+\.state|\w+\.transpileState)\.(?:needs[A-Z]\w*|usedSafeDivOps)(?!\.add\()/g;

/**
 * #1927: `<stdint.h>` / `<stdbool.h>` are decided by ONE predicate, which both
 * the `.c` and the `.h` ask. Two shapes, as for annotations: the spelling has
 * one owner, and the targets are taken from that owner by one decider -- so a
 * second predicate has to either hand-roll the string or import the target,
 * and each is caught by one of the two checks.
 */
const STD_HEADER_SPELLING = /<std(?:int|bool)\.h>/g;
const STD_HEADER_TARGET = /SYSTEM_INCLUDE_TARGETS\.(?:stdint|stdbool)\b/g;
const STD_HEADER_SPELLER = join(
  "src",
  "cnx",
  "TRANSPILE",
  "2-Plan",
  "SYSTEM_INCLUDE_TARGETS.ts",
);
const STD_HEADER_DECIDER = join(
  "src",
  "cnx",
  "TRANSPILE",
  "2-Plan",
  "CTypeIncludes.ts",
);

/**
 * The house form of a compliance annotation, keyed on its SHAPE: a C comment
 * opener and a citation (a rule, a C11 clause, or the owner's `.citation`). Deliberately not keyed on the standard's name --
 * see the header. `[^*\n]` stops the match at the comment's own `*\/`, so this
 * cannot span two unrelated comments on one line.
 */
const ANNOTATION_FORM = /\/\*[^*\n]{0,80}(?:\bRule\b|\bC11\b|\.citation\b)/g;

/**
 * An import of a named module, however its path is spelled.
 *
 * Anchored at the path segment (#1589 review): `[^"]*` absorbs a leading `I`,
 * so the unanchored form matched the TYPE `IDeclarationPlan` as well as the
 * DECISION `DeclarationPlan` -- and `src/cnx/types/IDeclarationPlan.ts`
 * exists. The census is exact-equality, so that is a false positive waiting to
 * happen: a render module typing a parameter with `IDeclarationPlan` is
 * decision-free, and would have reddened the census under a message naming the
 * wrong problem.
 */
const importOf = (name: string): RegExp =>
  new RegExp(`from\\s+"[^"]*(?:^|/)${name}"`, "g");

/**
 * Diagnostic text cites rules too, and is not an emitted annotation.
 *
 * `1-Analyze` reports problems; it generates no C, so a rule citation there
 * cannot reach the certification artifact. This is the population the header
 * warns about, and the reason the form check is scoped rather than the reason
 * it is name-keyed.
 */
const DIAGNOSTIC_LAYER = join("src", "cnx", "TRANSPILE", "1-Analyze") + sep;

const ANNOTATION_OWNER = join(
  "src",
  "cnx",
  "TRANSPILE",
  "2-Plan",
  "ComplianceAnnotations.ts",
);
const ORDER_DECIDER = join(
  "src",
  "cnx",
  "TRANSPILE",
  "2-Plan",
  "DeclarationPlan.ts",
);
// #1445 box 3: `declarationKindOf` reasons about which grammar alternative a
// declaration matched. #1991 moved 2.2's planning out of the walker, so it
// lives with the rest of 2.2 in `FilePlanner`.
const ORDER_CLASSIFIER = join(
  "src",
  "cnx",
  "TRANSPILE",
  "2-Plan",
  "FilePlanner.ts",
);

/**
 * A predicate that DECIDES, keyed on the verb in its name.
 *
 * `isIntegerType` REPORTS; `needsCast` DECIDES. That distinction is the whole
 * of #1450 box 4, and it is carried in the name because it is carried nowhere
 * else -- both spellings are `(...) => boolean` and no type can tell them
 * apart. `shouldBe`/`mustBe` are included because they are the same verb in
 * other clothes: `TypedefParamParser.shouldBePointer` READ a parsed typedef and
 * was renamed `isParamPointer` under this check, which is the outcome this
 * shape is for -- either the name is wrong or the module is in the wrong pass,
 * and both are worth a reviewer's minute.
 *
 * ## Match the DECLARATION, not the keyword in front of it (#1589 review)
 *
 * The first spelling required a literal `static ` or `function ` immediately
 * before the verb. It reported **zero** while `CodeGenerator` -- the render
 * pass's largest file -- declared three private instance methods under exactly
 * this verb, and a leading `_` defeated it a second way. `module-destinations.md`
 * (deleted by #1443) published "zero of the 131 expose a classification predicate" from that
 * count, so the blind spot propagated into prose.
 *
 * The selector guard below could not catch it either: it filters to
 * `PLAN_PASS`, and 2.2 Plan is static-class style by CLAUDE.md convention -- so
 * it proved the regex worked on a population with a DIFFERENT shape from the
 * one the assertion covers. A non-empty selector is not a correct selector.
 *
 * Anchoring to line start is what keeps CALL SITES out, and that matters here:
 * render modules legitimately call Plan decisions, so an unanchored match on
 * `CastRequirement.requiresClamping(...)` would redden the assertion for every
 * one of them.
 */
const DECISION_FORM =
  /^[ \t]*(?:export )?(?:private |public |protected )?(?:static |function |const |readonly )*_?(?:needs|requires|shouldBe|mustBe|willNeed)[A-Za-z0-9_]*\s*(?:\(|=\s*(?:async\s*)?\()/gm;

const RENDER_PASS = join("src", "cnx", "TRANSPILE", "3-Render") + sep;
const PLAN_PASS = join("src", "cnx", "TRANSPILE", "2-Plan") + sep;

/**
 * Every decision 2.2 Plan owns, and the exact render-pass modules that consult
 * it -- pinned, not counted.
 *
 * A count is not enough, and that is measured rather than assumed: the mutation
 * this table exists to catch re-derived the narrowing decision inside
 * `NarrowingCastHelper` and dropped its `CastRequirement` import, while
 * `CodeGenerator` kept its own. An "at least one importer" census stays green
 * through that; the pinned set does not.
 *
 * Yes, a legitimate new call site edits this table. That is the feature -- the
 * edit is the moment a reviewer sees a render module start or stop consulting
 * the plan, which is precisely the event nothing else in the suite can observe.
 */
const PLAN_DECISIONS: Readonly<Record<string, readonly string[]>> = {
  AssignmentClassifier: [
    // #1445 box 3: `codegen/CodeGenerator.ts` stood here and is gone. The
    // consultation did not disappear -- it moved to `TRANSPILE/CodeGenWalker.ts`
    // with the walk, which is outside the render pass, so it is no longer a
    // RENDER site consulting a plan. That is precisely the transition this
    // roster exists to make visible in a diff.
    //
    // #1668: the atomic and overflow-clamp handlers re-derived the target's
    // type and whether a compound saturates, and `AtomicGenerator` decided the
    // latter a third time from its own operator map. They ask the classifier
    // for both now, and the atomic generator is handed the answer -- a
    // decision moving toward the planner.
    "codegen/assignment/handlers/SpecialHandlers.ts",
  ],
  CastRequirement: [
    // #1445 box 3 slice 38: `CodeGenerator` consulted this inline while
    // walking a cast; the render half moved to `CastExprGenerator` and the
    // consultation went with it. #1668 (C5) then moved the decision itself
    // into the plan: `IPlannedCast.clampForm` says whether and how a cast
    // saturates, so `CastExprGenerator` reads the plan and consults nothing.
    // #1991: `codegen/helpers/NarrowingCastHelper.ts` stood here and is
    // deleted: 2.2 plans each narrowing (`IFilePlan.narrowings`) and 2.3
    // writes the planned one.
  ],
  ComplianceAnnotations: [
    "codegen/assignment/handlers/ArrayHandlers.ts",
    "codegen/assignment/handlers/StringHandlers.ts",
    "codegen/generators/statements/ControlFlowGenerator.ts",
    // #2207: the MISRA 19.1 comment above the emitted `cnx_string_copy`
    "codegen/generators/support/HelperGenerator.ts",
    // #1760 review: the float bits union, which carried no citation
    "codegen/helpers/FloatBitHelper.ts",
    // #1643 review: a moved parameter's C11 6.2.1 comment, at the definition
    "codegen/helpers/FunctionContextManager.ts",
    "codegen/helpers/StructInitFunction.ts",
  ],
  CppMemberHelper: [
    // #1445 box 3: `codegen/CodeGenerator.ts` stood here and is gone. The
    // consultation did not disappear -- it moved to `TRANSPILE/CodeGenWalker.ts`
    // with the walk, which is outside the render pass, so it is no longer a
    // RENDER site consulting a plan. That is precisely the transition this
    // roster exists to make visible in a diff.
  ],
  DeclarationPlan: [
    // #1445 box 3: `codegen/CodeGenerator.ts` stood here and is gone. The
    // consultation did not disappear -- it moved to `TRANSPILE/CodeGenWalker.ts`
    // with the walk, which is outside the render pass, so it is no longer a
    // RENDER site consulting a plan. That is precisely the transition this
    // roster exists to make visible in a diff.
  ],
  MisraSuppressions: ["MisraSuppressionUtils.ts"],
  // #1639: decided once in 2.2. `HeaderEmissionCapture` stamps the answer
  // on each prototype's parameters for the header renderer to read; no
  // render module decides passing for itself.
  ParameterPassing: [
    // #1619: `codegen/helpers/FunctionContextManager.ts` stood here, reading
    // only a parameter's settled emitted name. It reads that from
    // `utils/ParameterByValue.settledParameters` now, which is not a Plan
    // decision, so it left this roster without deciding anything itself.
    "headers/HeaderEmissionCapture.ts",
  ],
  PublicInterface: [
    // #1445 box 3: `ScopeGenerator` used to ask this while walking its own
    // members. It renders a plan now, so "does the header already define this
    // type?" is answered once by `CodeGenerator.planScope` and arrives as the
    // list of names the `.c` still owes -- which is the direction this guard
    // exists to push, a decision moving toward the planner rather than away.
    // #1445 box 3: `codegen/CodeGenerator.ts` stood here and is gone. The
    // consultation did not disappear -- it moved to `TRANSPILE/CodeGenWalker.ts`
    // with the walk, which is outside the render pass, so it is no longer a
    // RENDER site consulting a plan. That is precisely the transition this
    // roster exists to make visible in a diff.
    "codegen/generators/declarationGenerators/RegisterBlockPlacement.ts",
    // #1443: the header capture moved here from the orchestrator, which was
    // outside every pass. It reads "does this file have a public interface?"
    // to decide nothing of its own -- it records the answer in the facts.
    "headers/HeaderEmissionCapture.ts",
  ],
  SubscriptClassifier: [
    // #1668 (S25): `PostfixExpressionGenerator` classified a subscript here
    // from the type registry, which holds no C header variable. It reads the
    // kind the plan carries now -- the one operand typer's, the answer 2.1's
    // bit-access rules read -- so the consultation left render.
  ],
  SubscriptDepthValidator: [
    // #1114 review: `PostfixExpressionGenerator` stood here, asserting the
    // depth of the root's leading run from the rendered base's type info. The
    // invariant now asserts every run off the typer's steps, which the walk's
    // postfix plan (`TRANSPILE/CodeGenWalker.ts`) and 2.2's target declaration
    // already hold, so the consultation left render -- the transition this
    // roster exists to make visible in a diff.
  ],
};

/** The distinct files a pattern matches in, sorted. */
const filesMatching = (pattern: RegExp): string[] =>
  [...new Set(SourceScan.scan(pattern).map((hit) => hit.file))].sort();

/** Render-pass files matching `pattern`, as `/`-separated paths below the pass. */
const inRenderPass = (pattern: RegExp): string[] =>
  filesMatching(pattern)
    .filter((file) => file.startsWith(RENDER_PASS))
    .map((file) => file.slice(RENDER_PASS.length).split(sep).join("/"));

/** Byte range of one permitted capture method. */
function captureRange(
  source: string,
  needle: string,
): { start: number; end: number } {
  const start = source.indexOf(needle);
  if (start === -1) {
    throw new Error(
      `${needle} not found -- if the capture was renamed, rename it here too ` +
        `rather than deleting this guard, which would pass over everything.`,
    );
  }
  let depth = 0;
  let i = source.indexOf("{", start);
  for (;;) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") depth -= 1;
    if (depth === 0) return { start, end: i };
    i += 1;
  }
}

describe("2.3 Render decides nothing (#1449)", () => {
  it("finds the reads at all", () => {
    // Guards the selector. If the regex stops matching, every assertion below
    // passes over an empty list -- #1297's shape, one level up.
    expect(SourceScan.scan(FLAG_READ).length).toBeGreaterThan(0);
  });

  it.each([
    ["a bare parameter", "  const x = state.needsString;"],
    ["the orchestrator's", "  const x = orchestrator.state.needsString;"],
    ["a handler context's", "  const x = ctx.state.needsString;"],
    ["the walker's getter", "  const x = this.transpileState.needsString;"],
  ])("selects a flag read through %s receiver", (_label, line) => {
    // POPULATION CONTROL per receiver, not one `length > 0` for the lot.
    //
    // #1452 made the state an INSTANCE, so a flag read is spelled after whoever
    // holds it: `IOrchestrator.state` in a generator, `IAssignmentContext.state`
    // in a handler, a bare `state` parameter in a static helper. The selector
    // named `CodeGenState` -- the only spelling a static could have -- plus two
    // `this.` forms, so all three of the spellings CLAUDE.md now prescribes
    // passed. Verified by mutation: an `orchestrator.state.needsString` at an
    // emission site left this file 9/9 green.
    //
    // A `length > 0` control cannot catch that: the two capture files still
    // matched through `this.host.state`, so the population was never empty and
    // the guard looked healthy while three spellings walked past it. One case
    // per receiver is what makes a dropped arm visible.
    expect(new RegExp(FLAG_READ.source).test(line)).toBe(true);
  });

  it("reads a decision off the render state only in the .h capture", () => {
    expect(filesMatching(FLAG_READ)).toEqual(
      CAPTURES.map((capture) => capture.file).sort(),
    );
  });

  it("reads them only inside a capture, never at an emission site", () => {
    // One shared list the two captures filter, rather than each scanning all
    // of `src/` (#1583 review).
    const reads = SourceScan.scan(FLAG_READ);
    const outside: string[] = [];

    for (const capture of CAPTURES) {
      const source = readFileSync(join(rootDir, capture.file), "utf-8");
      const { start, end } = captureRange(source, capture.needle);

      outside.push(
        ...reads
          .filter((hit) => hit.file === capture.file)
          .filter((hit) => hit.offset < start || hit.offset > end)
          .map((hit) => `${hit.file}: ${hit.text}`),
      );
    }

    expect(outside).toEqual([]);
  });

  it("spells <stdint.h> and <stdbool.h> in one table (#1927)", () => {
    expect(filesMatching(STD_HEADER_SPELLING)).toEqual([STD_HEADER_SPELLER]);
  });

  it("decides <stdint.h> and <stdbool.h> in one predicate for the .c and the .h (#1927)", () => {
    expect(filesMatching(STD_HEADER_TARGET)).toEqual([STD_HEADER_DECIDER]);
  });

  it("has one author for the compliance-annotation TYPE", () => {
    // Rename-proof: a second author building on the shape has to obtain an
    // `IComplianceAnnotation`, whatever it or the standard gets renamed to.
    expect(filesMatching(importOf("IComplianceAnnotation"))).toEqual([
      ANNOTATION_OWNER,
    ]);
  });

  it("has one author for the compliance-annotation FORM", () => {
    // Catches the hand-rolled string the type check cannot see. Empty would
    // fail this too, so the selector cannot go vacuous.
    expect(
      filesMatching(ANNOTATION_FORM).filter(
        (file) => !file.startsWith(DIAGNOSTIC_LAYER),
      ),
    ).toEqual([ANNOTATION_OWNER]);
  });

  it("finds the decision-predicate population at all", () => {
    // Guards the selector for the two assertions below, which both expect a
    // SHORTER list. A regex that stopped matching would make them pass over
    // nothing -- #1297's shape, and the reason this file already carries one
    // selector guard. The live population sits in 2.2 Plan, which is the claim.
    expect(
      filesMatching(DECISION_FORM).filter((file) => file.startsWith(PLAN_PASS))
        .length,
    ).toBeGreaterThan(0);
  });

  it("declares no decision predicate inside the render pass", () => {
    // The complement of the guard above: the same verbs, the other pass.
    // Mutation-checked by re-deriving a decision render-side and confirming
    // this goes red -- a FIXTURE cannot, because the Plan/Render split was
    // behavior-preserving by construction and output is identical either way.
    expect(inRenderPass(DECISION_FORM)).toEqual([]);
  });

  it("keeps every Plan decision consulted from the render sites that act on it", () => {
    // Import-shaped, so it catches the case the form check cannot see: a render
    // module that inlines a decision it used to import, under no new name.
    const consulted = Object.fromEntries(
      Object.keys(PLAN_DECISIONS).map((decision) => [
        decision,
        inRenderPass(importOf(decision)),
      ]),
    );

    expect(consulted).toEqual(PLAN_DECISIONS);
  });

  it("reasons about declaration kinds only in the decider and the classifier", () => {
    // Import-shaped, so documenting the Plan/Render split in a third module is
    // not reported as adding a second decider (#1583 review).
    expect(filesMatching(importOf("TDeclarationKind"))).toEqual(
      [ORDER_DECIDER, ORDER_CLASSIFIER].sort(),
    );
  });
});
