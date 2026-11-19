import type IProgram from "../types/IProgram";
import type IRegisterSymbol from "../types/symbols/IRegisterSymbol";

/**
 * ADR-072 Part 1: the register instance 1.4 bound a declaration to, if any.
 * 1.4 decides it (`RegisterInstances`); this only reads the stored symbol.
 */
class RegisterInstance {
  /** By the scope path the declaration is a member of ("" is global) */
  static atPath(
    program: IProgram | null | undefined,
    scopePath: string,
    name: string,
  ): IRegisterSymbol | null {
    const symbol = program?.memberOf(scopePath, name);
    return symbol?.kind === "register" && symbol.registerType !== null
      ? symbol
      : null;
  }

  /** By the scope name a program member records (null is global) */
  static inScope(
    program: IProgram | null | undefined,
    scope: string | null,
    name: string,
  ): IRegisterSymbol | null {
    return RegisterInstance.atPath(
      program,
      RegisterInstance.scopePathOf(program, scope),
      name,
    );
  }

  /** The path of the scope a program member records (null is global) */
  static scopePathOf(
    program: IProgram | null | undefined,
    scope: string | null,
  ): string {
    return scope === null ? "" : (program?.scopePathOf(scope) ?? scope);
  }
}

export default RegisterInstance;
