import type EFileType from "../../PARSE/1-Discover/types/EFileType";
import type ICallbackTypeInfo from "../../types/ICallbackTypeInfo";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type IDeclarationPlan from "../../types/IDeclarationPlan";
import type IFunctionSignature from "../../types/IFunctionSignature";
import type IProgram from "../../types/IProgram";
import type ITargetDescription from "../../types/ITargetDescription";
import type TParameterInfo from "../../types/TParameterInfo";

/**
 * What 2.2 Plan established for one file before planning it, carried in the
 * plan so 2.3 Render starts from it and from nothing 2.2 left behind (#1991).
 */
interface IFileSetup {
  readonly program: IProgram;
  readonly symbols: ICodeGenSymbols;
  readonly sourcePath: string;
  readonly debugMode: boolean;
  readonly cppMode: boolean;
  readonly targetDescription: ITargetDescription;
  readonly includeRewrites: ReadonlyMap<string, string>;
  readonly includeKinds: ReadonlyMap<string, EFileType>;
  readonly selfIncludeAdded: boolean;
  readonly needsISR: boolean;
  readonly declarationPlan: IDeclarationPlan;
  readonly knownFunctions: ReadonlySet<string>;
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;
  readonly callbackTypeReferences: ReadonlySet<string>;
  readonly publicCallbackTypeReferences: ReadonlySet<string>;
  readonly scopeMembers: ReadonlyMap<string, ReadonlySet<string>>;
  /** 2.2's answer for every parameter of the file, by `TranspileState.parameterKey` */
  readonly parameters: ReadonlyMap<string, TParameterInfo>;
}

export default IFileSetup;
