/**
 * ADR-072 Part 1: what a register type and its instances must be.
 *
 * - E0931: an instance's address is not a compile-time constant
 * - E0932: a register member's offset is not a compile-time constant
 * - E0933: a function parameter is a register (ADR-072 specializes it per
 *   instance; until that lands it is rejected, not passed as a pointer)
 * - E0934: a register instance is declared inside a function
 *
 * 1.4 Resolve folded every address and offset once; this reads the result.
 */
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";
import StatementNodes from "../../utils/StatementNodes";

class RegisterInstanceAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IBaseAnalysisError[] {
    const found: IBaseAnalysisError[] = [];
    for (const { declaration, scope } of program.members) {
      const scopePath =
        scope === null
          ? ""
          : (this.context.program.scopePathOf(scope) ?? scope);
      if (declaration.kind === "function") {
        for (const parameter of declaration.parameters ?? []) {
          if (!this.isRegisterType(parameter.type, scopePath)) continue;
          found.push({
            code: "E0933",
            span: parameter.span,
            message: `parameter '${parameter.name}' is a register; register parameters are not supported yet (ADR-072)`,
            helpText:
              "Access the register instance directly (`GPIO1.DR`). ADR-072 resolves a register parameter per instance at compile time; until that is implemented it is rejected rather than passed as a runtime pointer.",
          });
        }
        if (this.isRegisterType(declaration.returnType, scopePath)) {
          found.push(this.notInstance(declaration.name, declaration.span));
        }
        for (const statement of StatementNodes.in(declaration)) {
          if (
            statement.kind === "variableDeclaration" &&
            this.isRegisterType(statement.type, scopePath)
          ) {
            found.push(this.notInstance(statement.name, statement.span));
            continue;
          }
          if (statement.kind !== "constructorDeclaration") continue;
          if (!this.isRegisterType(statement.type, scopePath)) {
            if (statement.address !== null && statement.arguments.length === 0)
              found.push(this.notRegister(statement));
            continue;
          }
          found.push({
            code: "E0934",
            span: statement.span,
            message: `register instance '${statement.name}' must be declared at file or scope level`,
            helpText:
              "A register instance names hardware at a fixed address for the whole program (ADR-072), so it is not a local. Declare it beside the register type or as a scope member.",
          });
        }
        continue;
      }
      if (declaration.kind === "struct") {
        for (const field of declaration.fields) {
          if (this.isRegisterType(field.type, scopePath)) {
            found.push(this.notInstance(field.name, field.span));
          }
        }
        continue;
      }
      if (
        declaration.kind === "variableDeclaration" &&
        this.isRegisterType(declaration.type, scopePath)
      ) {
        found.push(this.notInstance(declaration.name, declaration.span));
        continue;
      }
      if (
        declaration.kind !== "register" &&
        declaration.kind !== "constructorDeclaration"
      ) {
        continue;
      }
      const symbol = this.context.program.memberOf(scopePath, declaration.name);
      if (symbol?.kind !== "register") {
        if (
          declaration.kind === "constructorDeclaration" &&
          this.isRegisterType(declaration.type, scopePath)
        ) {
          found.push(this.notInstance(declaration.name, declaration.span));
        } else if (
          declaration.kind === "constructorDeclaration" &&
          declaration.address !== null &&
          declaration.arguments.length === 0
        ) {
          found.push(this.notRegister(declaration));
        }
        continue;
      }
      if (declaration.kind === "constructorDeclaration") {
        if (symbol.baseAddress === null || symbol.baseAddress < 0n) {
          found.push({
            code: "E0931",
            span: declaration.span,
            message:
              symbol.baseAddress === null
                ? `the address of register '${declaration.name}' is not a compile-time constant`
                : `the address of register '${declaration.name}' is negative`,
            helpText:
              "A register instance's address is resolved at compile time (ADR-072). Use a literal, a const, or arithmetic over them.",
          });
        }
        continue;
      }
      for (const member of declaration.members) {
        const offset = symbol.members.get(member.name)?.offsetValue ?? null;
        if (offset !== null && offset >= 0n) continue;
        found.push({
          code: "E0932",
          span: member.span,
          message:
            offset === null
              ? `the offset of register member '${member.name}' is not a compile-time constant`
              : `the offset of register member '${member.name}' is negative`,
          helpText:
            "A register member's offset is resolved at compile time (ADR-072). Use a literal, a const, or arithmetic over them.",
        });
      }
    }
    return found.sort(SourceOrder.bySpan);
  }

  /** E0936: a register type anywhere but a one-address instance */
  private notInstance(
    name: string,
    span: IBaseAnalysisError["span"],
  ): IBaseAnalysisError {
    return {
      code: "E0936",
      span,
      message: `'${name}' has a register type; a register type only declares a fixed-address instance (ADR-072)`,
      helpText:
        "Declare an instance at file or scope level with one address, `GpioPort GPIO1(0x401B8000);`. A register as a variable, array element, struct field or return value is a data register (ADR-072 Part 4), which is not supported yet.",
    };
  }

  /** `Type name(expr);` whose type is not a register: a C++ constructor (#375) */
  private notRegister(declaration: {
    readonly name: string;
    readonly span: IBaseAnalysisError["span"];
  }): IBaseAnalysisError {
    return {
      code: "E0935",
      span: declaration.span,
      message: `'${declaration.name}' is constructed from an expression, but its type is not a register type`,
      helpText:
        "Only a register instance takes an address expression (ADR-072). A C++ constructor's arguments are named constants (#375): declare the value as a const and pass its name.",
    };
  }

  /** The register type a written type names, in the scope it is written in */
  private isRegisterType(type: TTypeSyntax, scopePath: string): boolean {
    if (type.kind === "array")
      return this.isRegisterType(type.element, scopePath);
    const program = this.context.program;
    const candidates: Array<[string, string]> =
      type.kind === "user"
        ? [
            [scopePath, type.name],
            ["", type.name],
          ]
        : type.kind === "scoped"
          ? [[scopePath, type.name]]
          : type.kind === "global"
            ? [["", type.name]]
            : type.kind === "qualified"
              ? [[type.path.slice(0, -1).join("."), type.path.at(-1)!]]
              : [];
    return candidates.some(([path, name]) => {
      const symbol = program.memberOf(path, name);
      return symbol?.kind === "register" && symbol.registerType === null;
    });
  }
}

export default RegisterInstanceAnalyzer;
