/**
 * FunctionContextManager - Manages function context lifecycle and parameter processing
 *
 * Issue #793: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Function context setup/cleanup lifecycle
 * - Parameter type resolution and registration
 * - Return type resolution (including main() special case)
 * - Function body enter/exit coordination
 *
 * ## It reads planned parameters, not parse nodes (#1445)
 *
 * It asked a `ParameterContext` three questions -- the name, whether it is an
 * array, what its type is -- and everything after that comes from
 * `CodeGenState` and the callback typedef. Those three answers arrive as
 * `IPlannedFunctionParameter` now, and the type's alternatives come already
 * classified by `TypeNameLadder`, the one ladder, rather than from a
 * fourth walk here.
 */

import ParameterByValue from "../../../../utils/ParameterByValue";
import invariant from "../../../../utils/invariant";
import ComplianceAnnotations from "../../../2-Plan/ComplianceAnnotations";
import type IParameterInfo from "../../../../types/symbols/IParameterInfo";
import type IPlannedFunctionParameter from "../../../2-Plan/types/IPlannedFunctionParameter";
import type TranspileState from "../../../TranspileState";

/**
 * Result from resolving return type and params for a function.
 */
interface IReturnTypeAndParams {
  actualReturnType: string;
  initialParams: string;
}

/**
 * Manages function context lifecycle and parameter processing.
 */
class FunctionContextManager {
  /**
   * Resolve return type and initial params for function.
   * Handles main() special cases:
   * - main(u8 args[][]) -> int main(int argc, char *argv[])
   * - main() -> int main() (for C++ compatibility)
   */
  static resolveReturnTypeAndParams(
    name: string,
    returnType: string,
    isMainWithArgs: boolean,
    firstParameterName: string | undefined,
    state: TranspileState,
  ): IReturnTypeAndParams {
    if (isMainWithArgs) {
      // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
      state.mainArgsName = firstParameterName ?? null;
      return {
        actualReturnType: "int",
        initialParams: "int argc, char *argv[]",
      };
    }

    // For main() without args, always use int return type for C++ compatibility
    const actualReturnType = name === "main" ? "int" : returnType;
    return { actualReturnType, initialParams: "" };
  }

  /**
   * Enter the parameters 2.2 planned for the function being rendered (#1991).
   */
  static processParameterList(
    params: readonly IPlannedFunctionParameter[] | null,
    state: TranspileState,
  ): void {
    state.currentParameters.clear();
    if (!params) return;

    for (const param of params) {
      state.currentParameters.set(
        param.name,
        state.plannedParameterAt(param.nameSpan),
      );
    }
  }

  /**
   * #1290: the C name of the current function's parameter at `paramIndex`, as
   * 1.4 settled it on the function's symbol (ADR-057) -- the stamp the `.h`
   * prototype reads, and the one every use in the body binds to.
   */
  static parameterEmittedName(
    paramIndex: number,
    state: TranspileState,
  ): string {
    const emittedName =
      FunctionContextManager.settledParameters(state)[paramIndex]?.emittedName;
    invariant(
      emittedName !== undefined && emittedName !== null,
      `1.4 settled the C name of parameter ${paramIndex} of ${state.currentFunctionName}`,
    );
    return emittedName;
  }

  /**
   * #1643 review: the comment lines citing why each of the current function's
   * moved parameters moved, for above its definition. A parameter has no
   * initializer, so ADR-057's file-scope name is the one thing that moves it.
   */
  static movedParameterComments(state: TranspileState): string {
    return FunctionContextManager.settledParameters(state)
      .map((parameter) =>
        parameter.emittedName === null ||
        parameter.emittedName === parameter.name
          ? ""
          : ComplianceAnnotations.renderMoves(
              ["hidesFileScope"],
              parameter.name,
              parameter.emittedName,
            ),
      )
      .join("");
  }

  /** The current function's parameters, as 1.4 settled them */
  private static settledParameters(
    state: TranspileState,
  ): ReadonlyArray<IParameterInfo> {
    return ParameterByValue.settledParameters(state.currentFunctionName, state);
  }

  /**
   * Clear parameter tracking when leaving a function.
   */
  static clearParameters(state: TranspileState): void {
    state.currentParameters.clear();
  }

  /**
   * Enter function body - clears local variables and sets inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static enterFunctionBody(state: TranspileState): void {
    state.enterFunctionBody();
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static exitFunctionBody(state: TranspileState): void {
    state.mainArgsName = null;
    state.exitFunctionBody();
  }
}

export default FunctionContextManager;
