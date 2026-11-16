/**
 * Read-only input built before generation begins.
 * Contains all the context a generator needs to produce code.
 * Immutable - generators cannot modify this.
 */
import IFunctionSignature from "../../../../types/IFunctionSignature";
import ICallbackTypeInfo from "../../../../types/ICallbackTypeInfo";
import type IResolvedSymbols from "../../../../types/IResolvedSymbols";
import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import type IProgram from "../../../../types/IProgram";

interface IGeneratorInput {
  /** Symbol table from parsed C/C++ headers (may be null for single-file transpilation) */
  readonly symbolTable: IResolvedSymbols | null;

  /** cnx symbols collected from the parse tree (enums, structs, scopes, etc.) */
  readonly symbols: ICodeGenSymbols | null;

  /** Variable type information indexed by scoped name */

  /** Function signatures for parameter validation */
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;

  /** Set of cnx defined function names */
  readonly knownFunctions: ReadonlySet<string>;

  /** Set of known struct type names */
  readonly knownStructs: ReadonlySet<string>;

  /** Callback/function-as-type definitions */
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;

  /** The program's declarations, by C name -- a struct's fields (#1535) */
  readonly program: IProgram | null;
}

export default IGeneratorInput;
