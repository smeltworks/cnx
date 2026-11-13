/**
 * FunctionGenerator - Function Declaration Generation
 *
 * Generates C function declarations from cnx function syntax.
 *
 * Example:
 *   fn add(i32 a, i32 b) -> i32 { return a + b; }
 *   ->
 *   int32_t add(int32_t* a, int32_t* b) { return *a + *b; }
 *
 * ADR-006: Pass-by-reference semantics for non-array, non-float parameters.
 * ADR-029: Callback typedef generation for functions used as types.
 *
 * #1445 box 3: takes `IPlannedFunction`, not the node. What this generator
 * does is SEQUENCE -- enter, body, auto-const, signature, exit -- and it read
 * the node only to hand each piece straight to the orchestrator.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import FunctionContextManager from "../../helpers/FunctionContextManager";
import type IPlannedFunction from "../../types/IPlannedFunction";
import ReturnBuffer from "../../../../../utils/ReturnBuffer";

/**
 * Generate a C function from a cnx function declaration.
 *
 * Handles:
 * - Return type generation
 * - Parameter generation with ADR-006 pointer semantics
 * - Main function special cases (args parameter, int return type)
 * - Callback typedef generation (ADR-029)
 */
const generateFunction: TGeneratorFn<IPlannedFunction> = (
  planned: IPlannedFunction,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const { name, isMainWithArgs } = planned;

  // Issue #269, ADR-016: name for pass-by-value lookup, parameters for ADR-006
  // pointer semantics, and the fresh local registers -- one call, shared with
  // ScopeGenerator.
  orchestrator.enterFunctionContext(name, planned.parameters);

  // #1445: this decision was written out here AND in
  // `FunctionContextManager.resolveReturnTypeAndParams`, byte-identical. That
  // method had no caller at all -- not production, not even inside its own
  // file -- so knip could not report it: its three TEST callers count as usage
  // (#1418). One copy was live and inline, the other dead and named. Unified
  // onto the named one, which is the half that has a unit test.
  const { actualReturnType, initialParams } =
    FunctionContextManager.resolveReturnTypeAndParams(
      name,
      planned.returnType,
      isMainWithArgs,
      planned.firstParameterName,
      orchestrator.state,
    );
  let params: string = initialParams;

  // Issue #268: render the body FIRST, so the parameter list can see which
  // parameters it modified. That ordering is this generator's whole job,
  // which is why the two renders arrive as thunks rather than as strings.
  //
  // #1641: ADR-071 retired what this ordering fed -- a parameter's `mut`
  // decides its signature, not what the body writes. Kept unchanged: other
  // state codegen writes while it renders may still read it, and deleting a
  // constraint on the strength of fixtures that cannot observe it is the
  // reasoning presence-is-not-proof warns about. Filed, not acted on.
  const body = planned.renderBody();

  // Now generate parameter list
  if (!isMainWithArgs) {
    params = planned.renderParameterList
      ? planned.renderParameterList()
      : "void";
  }

  const moveComments = orchestrator.movedParameterComments();
  orchestrator.exitFunctionContext();

  // #1209: a `string<N>` or array return fills the caller's buffer
  const signature = ReturnBuffer.signature(
    actualReturnType,
    params,
    planned.returnBuffer,
  );
  const lowered =
    planned.returnBuffer === null ? "" : `${ReturnBuffer.SIGNATURE_COMMENT}\n`;
  const functionCode = `${moveComments}${lowered}${signature.returnType} ${name}(${signature.params}) ${body}\n`;

  orchestrator.recordCallbackTypedef(name);

  return {
    code: functionCode,
    effects: [],
  };
};

export default generateFunction;
