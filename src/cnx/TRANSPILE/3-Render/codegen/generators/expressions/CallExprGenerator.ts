/**
 * Function Call Expression Generator
 *
 * Generates C code for function calls:
 * - safe_div/safe_mod built-in functions (ADR-051)
 * - cnx function calls with pass-by-reference semantics
 * - C function calls with pass-by-value semantics
 * - Const-to-non-const validation (ADR-013)
 *
 * #1445 box 3: takes `IPlannedCallArgument[]`, not nodes. It asked an argument
 * node four things -- is it a bare identifier, what type is it, render it,
 * render it by reference -- and three of those are deferred because exactly
 * ONE render may happen per argument. See `IPlannedCallArgument`.
 */
import invariant from "../../../../../utils/invariant";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorState from "../IGeneratorState";
import type IPlannedCallArgument from "../../types/IPlannedCallArgument";

/**
 * Issue #304: Wrap argument with static_cast if it's a C++ enum class
 * being passed to an integer parameter.
 *
 * @param argCode - The generated argument code
 * @param arg - The planned argument, which carries 2.2's cast (#1991)
 * @returns The argument code, possibly wrapped with static_cast
 */
const wrapWithCppEnumCast = (
  argCode: string,
  arg: IPlannedCallArgument,
): string => {
  const cType = arg.planned.enumCast;
  if (cType === null) return argCode;
  return `static_cast<${cType}>(${argCode})`;
};

/**
 * Write an argument to a C or C++ function the way 2.2 planned it (#1991):
 * a callback-promoted parameter as its name (#937), else as it renders, with
 * `&` where the pointer parameter takes its address (#322, #832, #895)
 */
const _generateCFunctionArg = (arg: IPlannedCallArgument): string => {
  const cForm = arg.planned.cForm;
  invariant(
    cForm !== null,
    "2.2 planned how 2.3 writes every argument to a C function",
  );
  if (cForm === "promoted-handle") {
    invariant(arg.simpleIdentifier !== null, "a promoted handle is a name");
    return wrapWithCppEnumCast(arg.simpleIdentifier, arg);
  }
  const code = arg.render();
  return wrapWithCppEnumCast(cForm === "address-of" ? `&${code}` : code, arg);
};

/**
 * Generate C code for a function call.
 *
 * @param funcExpr - The function name or expression being called
 * @param args - The planned arguments (null when the call declares none)
 * @param _state - Generator state (unused but part of signature)
 * @returns Generated code and effects
 */
const generateFunctionCall = (
  funcExpr: string,
  args: readonly IPlannedCallArgument[] | null,
  _state: IGeneratorState,
  safeDivisionHelper: string | null = null,
  returnBuffer: string | null = null,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  // #1209: the buffer a `string<N>` or array return fills comes first
  const lead = returnBuffer === null ? [] : [returnBuffer];

  // Empty function call. This test stays FIRST: a `safe_div` written with no
  // argument list emits `safe_div()` here, BEFORE the four-argument invariant
  // below can fire.
  if (!args) {
    return { code: `${funcExpr}(${lead.join(", ")})`, effects };
  }

  // ADR-051: 2.2 planned this call as a safe_div()/safe_mod() helper
  if (safeDivisionHelper !== null) {
    return generateSafeDivMod(funcExpr, safeDivisionHelper, args, effects);
  }

  // Regular function call handling
  // #1322: a read-only argument to a `mut` parameter is E0900 in pass 2.1.
  // Get function signature once for all arguments

  // Issue #992: 2.2 plans a struct initializer in an argument as a compound
  // literal (#1991).
  const rendered = args.map((arg) => {
    // 2.2 decided how the argument binds and is passed (#1991)
    const passing = arg.planned.passing;

    // C/C++ function: use pass-by-value semantics
    if (passing.mode === "c") {
      return _generateCFunctionArg(arg);
    }

    // cnx function: check if target parameter should be passed by value
    if (passing.mode === "value") {
      // Issue #872: 2.2 plans it against the parameter's type, with bare
      // enum resolution suppressed (#1991)
      const argCode = arg.render();
      return wrapWithCppEnumCast(argCode, arg);
    }

    // Target parameter is pass-by-reference: use & logic
    return arg.renderByReference();
  });
  return { code: `${funcExpr}(${[...lead, ...rendered].join(", ")})`, effects };
};

/**
 * Generate code for safe_div() or safe_mod() built-in functions (ADR-051).
 *
 * These functions take 4 arguments:
 * - output: Variable to store result (passed by reference)
 * - numerator: The dividend
 * - divisor: The divisor
 * - defaultValue: Value to use if divisor is 0
 */
const generateSafeDivMod = (
  funcName: string,
  helperName: string,
  args: readonly IPlannedCallArgument[],
  effects: TGeneratorEffect[],
): IGeneratorOutput => {
  // #1322: ADR-051's call shape is E0884 (four arguments) and E0885 (the first
  // is a variable to receive the result) in pass 2.1, and a read-only output is
  // E0900 there -- that last one was accepted here and emitted `&K` into a
  // non-const pointer parameter.
  invariant(
    args.length === 4,
    `${funcName} takes four arguments -- E0884 rejects this in pass 2.1, before this runs`,
  );

  // Generate arguments: &output, numerator, divisor, defaultValue
  const outputArg = `&${args[0].render()}`;
  const numeratorArg = args[1].render();
  const divisorArg = args[2].render();
  const defaultArg = args[3].render();

  return {
    code: `${helperName}(${outputArg}, ${numeratorArg}, ${divisorArg}, ${defaultArg})`,
    effects,
  };
};

export default generateFunctionCall;
