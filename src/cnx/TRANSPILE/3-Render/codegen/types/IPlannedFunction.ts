import type IPlannedFunctionParameter from "../../../2-Plan/types/IPlannedFunctionParameter";

/**
 * A cnx function declaration, decided.
 *
 * #1445 box 3: `FunctionGenerator`'s job is a SEQUENCE, not an inspection --
 * enter the context, render the body, update auto-const, render the signature,
 * leave the context -- and Issue #268 is why that order is load-bearing: the
 * body has to run first so the parameter list can see which parameters it
 * modified. Everything the generator read off the node it handed straight to
 * the orchestrator.
 *
 * So the values come over as values, and the two steps whose TIMING the
 * generator owns come over as thunks. A thunk here is not a node in disguise:
 * the generator cannot look inside one, which is the point -- it can only
 * decide when to run it.
 */
interface IPlannedFunction {
  readonly name: string;

  /** The rendered C return type. */
  readonly returnType: string;

  /**
   * #1209: the buffer parameter a `string<N>` or array return fills, which
   * makes the C function `void` -- or null when it returns by value
   */
  readonly returnBuffer: string | null;

  /** ADR-016: `main(u8 args[][])` or `main(string args[])`. */
  readonly isMainWithArgs: boolean;

  /**
   * The first parameter's name, which the main-with-args form records as the
   * name its body refers to `argv` by.
   */
  readonly firstParameterName: string | undefined;

  /** The parameters the context registers, or null when there are none. */
  readonly parameters: readonly IPlannedFunctionParameter[] | null;

  /**
   * Render the body. Runs INSIDE the context, and before the signature --
   * Issue #268.
   */
  readonly renderBody: () => string;

  /**
   * Render the parameter list, or null when the function declares none (which
   * renders as `void`).
   */
  readonly renderParameterList: (() => string) | null;
}

export default IPlannedFunction;
