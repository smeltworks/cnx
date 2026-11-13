/**
 * A whole array assigned its list (ADR-035, #1782): `a <- [1, 2, 3, 4]`.
 *
 * C has no array assignment, so `a = {1U, 2U, 3U, 4U};` does not compile. The
 * list initializes a temporary of the target's own type -- the declaration's
 * form, so a fill-all, a string or a struct element is written as it is
 * there -- and the temporary is copied element by element. Every element is
 * read before any is written, so `pair <- [pair[1], pair[0]]` swaps.
 */
import invariant from "../../../../../utils/invariant";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import ArrayInitHelper from "../../helpers/ArrayInitHelper";

const COPY_COMMENT =
  "/* ADR-035 / Issue #1782: C has no array assignment, so the list fills a temporary that is copied element by element. */";

function handleWholeArray(ctx: IAssignmentContext): string {
  const plan = ctx.plannedWholeArray;
  invariant(plan !== null, "2.2 planned this whole-array write");
  const state = ctx.state;
  const shape = plan.dimensions.map((size) => `[${size}]`).join("");
  // #1209: another array is read straight from; a list fills a temporary
  const temp = plan.fromArray
    ? null
    : ArrayInitHelper.temporaryArray(plan, ctx.generatedValue, state);
  const lines =
    temp === null
      ? [ArrayInitHelper.ARRAY_COPY_COMMENT]
      : [COPY_COMMENT, temp.declaration];

  let target = ctx.renderTarget();
  if (ctx.targetIndexHasSideEffect) {
    // The target's subscripts are evaluated once, as a plain write's are;
    // the pointer keeps a volatile target's qualifier, so each write is one
    const pointer = state.getNextTempVarName();
    const qualifier = plan.volatileTarget ? "volatile " : "";
    lines.push(
      `${qualifier}${plan.elementCType} (*const ${pointer})${shape} = &${target};`,
    );
    target = `(*${pointer})`;
  }

  lines.push(
    ...ArrayInitHelper.elementCopy(
      target,
      temp === null ? ctx.generatedValue : temp.name,
      plan.dimensions,
      state,
    ),
  );
  return lines.join("\n");
}

export default handleWholeArray;
