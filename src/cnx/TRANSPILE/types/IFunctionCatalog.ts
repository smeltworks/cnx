import type IFunctionSignature from "../../types/IFunctionSignature";

/**
 * #1991: what 2.2's pre-pass learns about a file's functions and the callback
 * types it names. `IFileSetup` carries the same fields to 2.3.
 */
interface IFunctionCatalog {
  readonly knownFunctions: ReadonlySet<string>;
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;
  readonly callbackTypeReferences: ReadonlySet<string>;
  readonly publicCallbackTypeReferences: ReadonlySet<string>;
}

export default IFunctionCatalog;
