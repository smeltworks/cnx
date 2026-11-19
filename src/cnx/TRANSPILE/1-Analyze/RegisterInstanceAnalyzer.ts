/**
 * ADR-072 Part 1: what a register type and its instances must be.
 *
 * - E0931: an instance's address is not a compile-time constant
 * - E0932: a register member's offset is not a compile-time constant
 * - E0933: a function parameter is a register (ADR-072 specializes it per
 *   instance; until that lands it is rejected, not passed as a pointer)
 *
 * 1.4 Resolve folded every address and offset once; this reads the result.
 */
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";

class RegisterInstanceAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IBaseAnalysisError[] {
    const found: IBaseAnalysisError[] = [];
    for (const { declaration, scope } of program.members) {
      if (declaration.kind === "function") {
        for (const parameter of declaration.parameters ?? []) {
          if (!this.isRegisterType(parameter.type)) continue;
          found.push({
            code: "E0933",
            span: parameter.span,
            message: `parameter '${parameter.name}' is a register; register parameters are not supported yet (ADR-072)`,
            helpText:
              "Access the register instance directly (`GPIO1.DR`). ADR-072 resolves a register parameter per instance at compile time; until that is implemented it is rejected rather than passed as a runtime pointer.",
          });
        }
        continue;
      }
      if (
        declaration.kind !== "register" &&
        declaration.kind !== "constructorDeclaration"
      ) {
        continue;
      }
      const scopePath =
        scope === null
          ? ""
          : (this.context.program.scopePathOf(scope) ?? scope);
      const symbol = this.context.program.memberOf(scopePath, declaration.name);
      if (symbol?.kind !== "register") continue;
      if (declaration.kind === "constructorDeclaration") {
        if (symbol.baseAddress === null) {
          found.push({
            code: "E0931",
            span: declaration.span,
            message: `the address of register '${declaration.name}' is not a compile-time constant`,
            helpText:
              "A register instance's address is resolved at compile time (ADR-072). Use a literal, a const, or arithmetic over them.",
          });
        }
        continue;
      }
      for (const member of declaration.members) {
        if (symbol.members.get(member.name)?.offsetValue !== null) continue;
        found.push({
          code: "E0932",
          span: member.span,
          message: `the offset of register member '${member.name}' is not a compile-time constant`,
          helpText:
            "A register member's offset is resolved at compile time (ADR-072). Use a literal, a const, or arithmetic over them.",
        });
      }
    }
    return found.sort(SourceOrder.bySpan);
  }

  /** Whether a written type names a register type the file can see */
  private isRegisterType(type: TTypeSyntax): boolean {
    return (
      (type.kind === "user" || type.kind === "global") &&
      this.context.symbols.knownRegisterTypes.has(type.name)
    );
  }
}

export default RegisterInstanceAnalyzer;
