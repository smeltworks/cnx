/**
 * Which functions are used as ADR-029 callbacks, across the whole program.
 *
 * A function assigned to a callback typedef must keep the typedef's parameter
 * shape, so it may not take #268 auto-const or ADR-006 pass-by-value. That makes
 * "is this function used as a callback?" a fact the generated signature depends
 * on — and the use can be in a different file from the declaration, so it is a
 * cross-file fact.
 *
 * It was accumulated instead. `FunctionCallAnalyzer` recorded it as a side
 * effect while analyzing each file during rendering, into a mutable static that
 * `CodeGenState.reset()` deliberately skipped so the entries would survive —
 * which means a file rendered early saw fewer callbacks than one rendered late,
 * and its signatures were decided on a partial answer. #1511 derived it over
 * every tree before anything renders, and #1452 removed the static.
 *
 * #1825: what remained was running that analyzer over every tree, diagnostics
 * discarded, for the map it filled as a side effect -- from the orchestration
 * layer, because `PARSE/` may not import `TRANSPILE/`. 1.3 now records where
 * each file names what may be a function (`CallbackUseCollector`), and the rule
 * that decides which of those uses is a callback is here, its one owner.
 *
 * #1544: a function is recognized wherever it is declared. Both recognition
 * rules once gated on the functions the USING file declares, so a callback
 * target in another file was missed and took ordinary parameter rules --
 * emitting a signature that no longer matched the typedef it was assigned to,
 * at transpile exit 0.
 */

import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type IFileSymbols from "../../types/IFileSymbols";
import type TCallbackUse from "../../types/TCallbackUse";

class CallbackCompatibility {
  /**
   * @param files every file's `IFileSymbols`, in declaration order
   * @param symbolTableFor the C and C++ header symbols as a file reads them,
   *   for the typedefs (#2474)
   * @returns function name to the callback typedef it is used as
   */
  static derive(
    files: ReadonlyArray<IFileSymbols>,
    symbolTableFor: (sourceFile: string) => IResolvedSymbols,
  ): ReadonlyMap<string, string> {
    const programFunctions = CallbackCompatibility.programFunctions(files);

    // In declaration order and source order: a later use of a function wins
    // the typedef an earlier one recorded.
    const callbacks = new Map<string, string>();
    for (const file of files) {
      for (const use of file.callbackUses) {
        const typedef = CallbackCompatibility.callbackTypedefOf(
          use,
          symbolTableFor(file.sourceFile),
        );
        if (typedef !== null && programFunctions.has(use.functionName)) {
          callbacks.set(use.functionName, typedef);
        }
      }
    }
    return callbacks;
  }

  /**
   * ADR-071: every cnx function used as a callback at all -- named as a
   * type, or placed as a value by an initializer, an argument or an
   * assignment. Its parameters' `mut` is part of a callback type, so E0899
   * does not require them to be written.
   */
  static usedAsCallback(
    files: ReadonlyArray<IFileSymbols>,
  ): ReadonlySet<string> {
    const programFunctions = CallbackCompatibility.programFunctions(files);
    const used = new Set<string>();
    for (const file of files) {
      for (const use of file.callbackUses) {
        if (programFunctions.has(use.functionName)) {
          used.add(use.functionName);
        }
      }
    }
    return used;
  }

  /**
   * #1544: what the PROGRAM declares. The map decides a generated signature
   * and the wiring may sit in any file, so recognition needs the same
   * whole-program scope the fact has. Read from the symbols, which carry the
   * one encoding of a function's name.
   */
  private static programFunctions(
    files: ReadonlyArray<IFileSymbols>,
  ): Set<string> {
    const programFunctions = new Set<string>();
    for (const file of files) {
      for (const symbol of file.symbols) {
        if (symbol.kind === "function") {
          programFunctions.add(symbol.fullyQualifiedCName);
        }
      }
    }
    return programFunctions;
  }

  /**
   * The C function-pointer typedef a use assigns its function to, or null
   * when the use is not a callback position.
   */
  private static callbackTypedefOf(
    use: TCallbackUse,
    symbolTable: IResolvedSymbols,
  ): string | null {
    // ADR-071's uses say only that a function is a callback, not which typedef
    if (use.kind === "assignment" || use.kind === "type") return null;
    if (use.kind === "initializer") {
      return symbolTable.isCFunctionPointerTypedef(use.typeName)
        ? use.typeName
        : null;
    }

    // Issue #895: an argument to a C function whose parameter at that
    // position is a function pointer typedef.
    const cFunc = symbolTable.getCSymbol(use.callee);
    if (cFunc?.kind !== "function" || !cFunc.parameters) return null;
    const param = cFunc.parameters[use.argIndex];
    if (!param) return null;
    return symbolTable.isCFunctionPointerTypedef(param.type)
      ? param.type
      : null;
  }
}

export default CallbackCompatibility;
