/**
 * Control Flow Statement Generators
 *
 * Generates C code for control flow statements:
 * - return statements
 * - if/else statements
 * - while loops
 * - do-while loops
 * - for loops
 *
 * ## It renders plans; it does not read a tree (#1445 box 3)
 *
 * Every question these eight used to ask of a parse node -- does this `return`
 * carry an expression, does this `if` have an else, is this `for` init a
 * declaration or an assignment -- is answered by a `plan*` method on
 * `CodeGenerator` and arrives as a record.
 *
 * ## What did NOT move, and why: the flush points
 *
 * Almost every field on these plans is a THUNK, and the reason is Issue #250
 * rather than conditionality. Rendering a clause can queue a temp declaration
 * into `pendingTempDeclarations`, and these generators hoist those temps out in
 * front of the statement by flushing BETWEEN clauses: a `for` flushes after its
 * init, after its condition and after its update, so each clause's temps land in
 * the right group and none of them lands inside the loop body where the header
 * that reads it cannot see it.
 *
 * Rendering a clause at plan time would collapse those flush points into one --
 * the first flush would return everything. So the interleaving stays here, in
 * the generator, where the statement's shape is legible, and the planner hands
 * over unevaluated renders rather than strings.
 *
 * The one eager field is `IPlannedIf.lengthCounts`: counting repeated
 * `.value_char_count` reads walks the tree and emits nothing, so asking at plan time
 * costs what asking at render time cost.
 */
import ReturnBuffer from "../../../../../utils/ReturnBuffer";
import ComplianceAnnotations from "../../../../2-Plan/ComplianceAnnotations";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import IPlannedFor from "../../types/IPlannedFor";
import IPlannedForAssignment from "../../types/IPlannedForAssignment";
import IPlannedForVarDecl from "../../types/IPlannedForVarDecl";
import IPlannedForever from "../../types/IPlannedForever";
import IPlannedIf from "../../types/IPlannedIf";
import IPlannedLoop from "../../types/IPlannedLoop";
import TPlannedReturn from "../../types/TPlannedReturn";

/**
 * Generate C code for a return statement.
 * Issue #477: Uses function return type as expected type for enum inference.
 */
const generateReturn = (
  plan: TPlannedReturn,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  if (plan.kind === "void") {
    return { code: "return;", effects };
  }

  // #1209: a `string<N>` or array is written into the caller's buffer
  if (plan.kind === "buffer") {
    return {
      code: [
        ReturnBuffer.RETURN_COMMENT,
        ...plan.renderWrite(),
        "return;",
      ].join("\n"),
      effects,
    };
  }

  // Issue #477 / #1277: a `return` expression is written against the
  // function's declared return type, for EVERY return, not only an enum one.
  // 2.2 planned it (#1991), so `return { x: 1, y: 2 };` takes its struct and
  // `return 1;` from a `u8` function gets MISRA C:2012 Rule 7.2's suffix.
  const expr = plan.render();

  return { code: `return ${expr};`, effects };
};

/**
 * Generate C code for an if statement.
 * Includes strlen optimization for repeated .value_char_count accesses.
 */
const generateIf = (
  plan: IPlannedIf,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Set up cache and generate declarations
  const cacheDecls = orchestrator.setupLengthCache(
    plan.lengthCounts,
    plan.renderLengthOperand,
  );

  // Generate with cache enabled
  const condition = plan.renderCondition();

  // Issue #250: Flush any temp vars from condition BEFORE generating branches
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const thenBranch = plan.renderThen();

  let result = `if (${condition}) ${thenBranch}`;

  if (plan.renderElse) {
    result += ` else ${plan.renderElse()}`;
  }

  // Clear cache after generating.
  //
  // #1645: this nulls the cache unconditionally while `setupLengthCache` only
  // WRITES it when it emitted a declaration, so a nested statement clears its
  // parent's cache on the way out and one expression renders two ways in one
  // block. Pre-existing, output-visible, and deliberately preserved here --
  // fixing it changes emitted C, and this slice's oracle is a byte-identical
  // corpus.
  orchestrator.clearLengthCache();

  // Prepend condition temps and cache declarations
  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }
  if (cacheDecls) {
    result = cacheDecls + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a while statement.
 */
const generateWhile = (
  plan: IPlannedLoop,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: E0701/E0702 and the always-true check (E0707) are authored in
  // pass 2.1, which halts before this runs.

  const condition = plan.renderCondition();

  // Issue #250: Flush any temp vars from condition BEFORE generating body
  // Otherwise they end up inside the loop body, causing "not declared" errors
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  const body = plan.renderBody();
  let result = `while (${condition}) ${body}`;

  // Prepend condition temps before the while statement
  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a do-while statement (ADR-027).
 *
 * The body renders FIRST -- the same two thunks as `while`, called in the
 * other order, because that is the order the source reads.
 */
const generateDoWhile = (
  plan: IPlannedLoop,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const body = plan.renderBody();
  const condition = plan.renderCondition();

  // Issue #250: Flush any temp vars from condition
  // For do-while, condition is evaluated after body, but temps must be declared before
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  let result = `do ${body} while (${condition});`;

  if (conditionTemps) {
    result = conditionTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate variable declaration for for loop init (no trailing semicolon).
 */
const generateForVarDecl = (
  plan: IPlannedForVarDecl,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // ADR-057: a `for` variable that shadows a file-scope name is emitted under
  // 1.4's distinct name (#1934), so `global.x` inside the loop body still
  // reaches the global rather than the counter.
  const name = plan.emittedName;

  let result = `${plan.const}${plan.atomic}${plan.volatile}${plan.typeName} ${name}`;

  // Handle initialization
  if (plan.renderInitializer) {
    // #1277: a `for` header declares a variable like any other, so its
    // initializer is typed by the declared type through the same mechanism a
    // block-level declaration uses. Without it a struct literal here was
    // rejected as "Cannot infer struct type".
    result += ` = ${plan.renderInitializer()}`;
  }

  return { code: result, effects };
};

/**
 * Generate an assignment in a `for` header, for the init and the update alike.
 *
 * #1647: the plan renders through the statement assignment path, so the
 * header gets the same classification, ADR-044 lowering and Rule 7.2 suffix a
 * statement does. Nothing is mapped or concatenated here.
 */
const generateForAssignment = (
  plan: IPlannedForAssignment,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => ({ code: plan.render(), effects: [] });

/**
 * Generate C code for a for statement.
 *
 * Note: Issue #250 - temps from condition/update are hoisted before the for loop.
 * This means the expression is evaluated once, not on each iteration.
 * This is a known limitation; if the value changes inside the loop,
 * the user should capture it in a variable explicitly.
 */
const generateFor = (
  plan: IPlannedFor,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: `for (;;)` and an always-true condition are E0707 in pass 2.1
  // (ADR-068). A header with no condition never reaches this generator, which
  // is why `renderCondition` is not nullable.

  let init = "";
  if (plan.init) {
    const result =
      plan.init.kind === "varDecl"
        ? generateForVarDecl(plan.init.plan, input, state, orchestrator)
        : generateForAssignment(plan.init.plan, input, state, orchestrator);
    init = result.code;
    effects.push(...result.effects);
  }

  // Issue #250: Flush temps from init before generating condition
  const initTemps = orchestrator.flushPendingTempDeclarations();

  const condition = plan.renderCondition();

  // Issue #250: Flush temps from condition before generating update
  const conditionTemps = orchestrator.flushPendingTempDeclarations();

  let update = "";
  if (plan.update) {
    const result = generateForAssignment(
      plan.update,
      input,
      state,
      orchestrator,
    );
    update = result.code;
    effects.push(...result.effects);
  }

  // Issue #250: Flush temps from update before generating body
  const updateTemps = orchestrator.flushPendingTempDeclarations();

  const body = plan.renderBody();

  let result = `for (${init}; ${condition}; ${update}) ${body}`;
  if (plan.init?.kind === "varDecl") {
    result = plan.init.plan.nameMoveComments + result;
  }

  // Prepend all temps before the for statement
  const allTemps = [initTemps, conditionTemps, updateTemps]
    .filter(Boolean)
    .join("\n");
  if (allTemps) {
    result = allTemps + "\n" + result;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a forever statement (ADR-068).
 *
 * Lowers to the MISRA C:2012 Rule 14.3-compliant infinite-loop idiom `for (;;)`
 * (the carve-out that rule explicitly permits — no controlling expression to be
 * flagged as invariant). A `forever` loop may appear only in a void function
 * (E0705): a value-returning function can never honor its return type if it
 * loops forever.
 */
const generateForever = (
  plan: IPlannedForever,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // #1322: `forever` in a non-void function is E0705 in pass 2.1 (ADR-068).

  const body = plan.renderBody();
  const comment = ComplianceAnnotations.render(
    ComplianceAnnotations.FOREVER_LOOP,
  );

  return { code: `${comment}\nfor (;;) ${body}`, effects };
};

// Export all control flow generators
const controlFlowGenerators = {
  generateReturn,
  generateIf,
  generateWhile,
  generateDoWhile,
  generateFor,
  generateForever,
  generateForVarDecl,
  generateForAssignment,
};

export default controlFlowGenerators;
