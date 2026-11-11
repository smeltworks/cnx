/**
 * Binary Expression Generator
 *
 * Renders the binary precedence ladder:
 * - Logical: || (or), && (and)
 * - Equality: = (becomes ==), != with ADR-017 enum safety and ADR-045 string strcmp
 * - Relational: <, >, <=, >=
 * - Bitwise: |, ^, &
 * - Shift: <<, >> with validation
 * - Arithmetic: +, -, *, /, %
 *
 * Issue #235: Includes constant folding for compile-time constant expressions.
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * This was ten generators, one per grammar precedence level, recursing into
 * each other. They reduce to FOUR renderings plus a leaf: the levels differ in
 * which separator, which default operator and which extra rule applies, not in
 * what they do. `CodeGenerator.planBinaryExpr` walks the ladder and collapses
 * the single-child pass-through levels -- which is most levels of most expressions --
 * so a plan is only as deep as the expression's real operator nesting.
 *
 * ## Each operand is a thunk the planner did not evaluate
 *
 * 2.2 plans a comparison's operands, at any depth under it, with no expected
 * type, and each operand is written against its plan when it renders (#1991).
 * Issue #1032 is the cost of getting it wrong: `i32 < 0` emitting
 * `signedIdx < 0U`, promoted to unsigned by C's usual arithmetic conversions.
 */
import AdrProvenance from "../../../../../instrumentation/AdrProvenance";
import BinaryExprUtils from "./BinaryExprUtils";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorOutput from "../IGeneratorOutput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import TGeneratorEffect from "../TGeneratorEffect";
import TPlannedBinaryExpr from "../../types/TPlannedBinaryExpr";
import invariant from "../../../../../utils/invariant";

/**
 * Render every operand, collecting their effects.
 */
const renderOperands = (
  operands: readonly (() => IGeneratorOutput)[],
  effects: TGeneratorEffect[],
): string[] =>
  operands.map((render) => {
    const result = render();
    effects.push(...result.effects);
    return result.code;
  });

/**
 * Join operand codes with the operator between each pair.
 *
 * `defaultOperator` fills a gap in `operators`, which the parse tree can leave
 * shorter than the operand list. Pre-existing and unexercised -- a probe on the
 * fallback never fires while one on the surrounding loop fires -- and kept
 * rather than dropped, because removing a defense because no fixture reaches it
 * is the argument #1143 records against.
 */
const joinWithOperators = (
  operandCodes: readonly string[],
  operators: readonly string[],
  defaultOperator: string,
  mapOperator: ((operator: string) => string) | null,
): string => {
  let result = operandCodes[0];
  for (let index = 1; index < operandCodes.length; index++) {
    const raw = operators[index - 1] || defaultOperator;
    const operator = mapOperator ? mapOperator(raw) : raw;
    result += ` ${operator} ${operandCodes[index]}`;
  }
  return result;
};

/**
 * Issue #1152: Fold a chain of operands into saturating helper calls when the
 * expression's operands are of a `clamp` integer type.
 *
 * `clamp` is cnx's default overflow behavior (ADR-044), but it used to apply
 * only to compound assignment (`+<-`), so `c <- a + b` wrapped while
 * `c +<- b` saturated -- and `wrap` was indistinguishable from `clamp` in every
 * expression. Routing here makes the modifier mean the same thing wherever the
 * arithmetic is written, which is what lets a bounds guard built from
 * saturating values be trusted (#231).
 *
 * Returns null when the expression should be emitted as plain C: a float or
 * other natively-handled type, a `wrap` type, or operands whose type cannot be
 * resolved.
 */
const tryClampOperands = (
  plan: Extract<TPlannedBinaryExpr, { kind: "arithmetic" }>,
  operandCodes: readonly string[],
): string | null => {
  const clamp = plan.clamp;
  if (clamp === null) return null;
  invariant(
    clamp.operations.length === operandCodes.length - 1,
    "2.2 planned one clamp helper per operator",
  );

  // #1241: ADR-044's rule -- a `clamp` integer expression is lowered to
  // saturating helper calls rather than plain C arithmetic -- fired in 2.2,
  // which decided this chain's helpers.
  AdrProvenance.record("044", plan.adrLine);

  let code = operandCodes[0];
  clamp.operations.forEach((operation, index) => {
    code = `cnx_clamp_${operation}_${clamp.cnxType}(${code}, ${operandCodes[index + 1]})`;
  });
  return code;
};

/**
 * Fold, clamp, or join an arithmetic chain.
 *
 * #1450: `analyze:duplication` reported the additive and multiplicative tails
 * as a nine-line clone. One arm serves both now, differing only in the
 * `defaultOperator` the plan carries.
 */
const renderArithmetic = (
  plan: Extract<TPlannedBinaryExpr, { kind: "arithmetic" }>,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const operandCodes = renderOperands(plan.renderOperands, effects);

  // Issue #235 / #1175: a constant chain is written as its value, which 2.2
  // decided by the one evaluator. Where any operand rendered as anything but a
  // plain integer -- a name, or a literal the context gave a `U` suffix -- the
  // chain is written as it always was.
  if (
    plan.constantValue !== null &&
    operandCodes.every(
      (code) => BinaryExprUtils.tryParseNumericLiteral(code) !== undefined,
    )
  ) {
    invariant(
      plan.clamp === null,
      `2.2 planned no clamp helper for a chain 2.3 folds (line ${plan.adrLine})`,
    );
    return { code: plan.constantValue, effects };
  }

  // Issue #1152: saturate when the operands are of a clamp integer type
  const clamped = tryClampOperands(plan, operandCodes);
  if (clamped !== null) {
    return { code: clamped, effects };
  }

  return {
    code: joinWithOperators(
      operandCodes,
      plan.operators,
      plan.defaultOperator,
      null,
    ),
    effects,
  };
};

/**
 * Render an equality or relational comparison.
 */
const renderComparison = (
  plan: Extract<TPlannedBinaryExpr, { kind: "comparison" }>,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // ADR-001 (#1585): `=` means equality -- the decision this ADR exists for.
  // Recorded once, ABOVE the string/non-string split, because both branches
  // below render that one decision: `strcmp(...) == 0` and `==`. `!=` is
  // unchanged from C and is not ADR-001's doing, so the planner leaves
  // `adrLine` undefined for a comparison that uses only `!=` -- occupancy must
  // not be invented for a cell where this ADR's rule never fired.
  AdrProvenance.record("001", plan.adrLine);

  if (plan.strcmp) {
    // ADR-045: string comparison lowers to strcmp. 2.2 required <string.h>
    // when it planned the comparison, which 2.3 then renders (#1991).
    // #1373: `a = b = c` is `(a = b) = c`. 2.1 rejects a string past the
    // first pair (E0929), so what follows it is a bool, compared with the
    // strcmp before it
    const operandCodes = renderOperands(plan.renderOperands, effects);
    let code = BinaryExprUtils.generateStrcmpCode(
      operandCodes[0],
      operandCodes[1],
      plan.strcmp.isNotEqual,
    );
    for (let i = 2; i < operandCodes.length; i += 1) {
      const operator = plan.operators[i - 1];
      code = `(${code}) ${plan.mapOperator?.(operator) ?? operator} ${operandCodes[i]}`;
    }

    return { code, effects };
  }

  // Issue #1032: 2.2 plans the operands with no expected type (#1991). MISRA 7.2's U
  // suffix applies to assignments, not comparisons -- `i32 < 0` becoming
  // `signedIdx < 0U` changes semantics under C's integer promotion.
  const operandCodes = renderOperands(plan.renderOperands, effects);

  return {
    code: joinWithOperators(
      operandCodes,
      plan.operators,
      plan.defaultOperator,
      plan.mapOperator,
    ),
    effects,
  };
};

/**
 * Render the binary expression a plan describes.
 */
const generateBinaryExpr = (
  plan: TPlannedBinaryExpr,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  switch (plan.kind) {
    case "leaf":
      return { code: plan.render(), effects: [] };

    case "join": {
      const effects: TGeneratorEffect[] = [];
      const operandCodes = renderOperands(plan.renderOperands, effects);
      return { code: operandCodes.join(plan.separator), effects };
    }

    case "comparison":
      return renderComparison(plan);

    case "shift": {
      // #1322: the shift amount (MISRA 12.2, E0873) is checked in pass 2.1.
      const effects: TGeneratorEffect[] = [];
      const operandCodes = renderOperands(plan.renderOperands, effects);
      return {
        code: joinWithOperators(operandCodes, plan.operators, "<<", null),
        effects,
      };
    }

    case "arithmetic":
      return renderArithmetic(plan);
  }
};

export default generateBinaryExpr;
