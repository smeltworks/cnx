import type TMemberStep from "./TMemberStep";
/**
 * Dependencies needed for postfix chain building
 */
interface IPostfixChainDeps {
  /** Generate an expression to a string */
  // #1652: `generateExpression(expr: unknown)` stood here and was the door the
  // parse nodes came through. `IPostfixOperation` carries a render thunk now,
  // so the builder never sees an expression at all and this dep has no reader.

  /** Get separator for member access */
  /**
   * How the member at the end of `identifierChain` joins `owner`, the C the
   * chain has rendered so far (#2116)
   */
  memberStep(
    isFirstOp: boolean,
    identifierChain: string[],
    owner: string,
  ): TMemberStep;
}

export default IPostfixChainDeps;
