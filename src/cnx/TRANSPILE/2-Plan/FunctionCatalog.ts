import type IFunctionSignature from "../../types/IFunctionSignature";
import type IFunctionCatalog from "../types/IFunctionCatalog";

/**
 * #1991: 2.2's pre-pass builds this value, one per file, rather than writing
 * each function and callback reference onto TranspileState as it finds it.
 */
class FunctionCatalog implements IFunctionCatalog {
  private readonly known = new Set<string>();
  private readonly signatures = new Map<string, IFunctionSignature>();
  private readonly references = new Set<string>();
  private readonly publicReferences = new Set<string>();

  addFunction(name: string, signature: IFunctionSignature): void {
    this.known.add(name);
    this.signatures.set(name, signature);
  }

  /** A callback type named inside a function body */
  noteReference(typeName: string): void {
    this.references.add(typeName);
  }

  /** A callback type named by a declaration another file can see */
  notePublicReference(typeName: string): void {
    this.references.add(typeName);
    this.publicReferences.add(typeName);
  }

  get knownFunctions(): ReadonlySet<string> {
    return this.known;
  }

  get functionSignatures(): ReadonlyMap<string, IFunctionSignature> {
    return this.signatures;
  }

  get callbackTypeReferences(): ReadonlySet<string> {
    return this.references;
  }

  get publicCallbackTypeReferences(): ReadonlySet<string> {
    return this.publicReferences;
  }
}

export default FunctionCatalog;
