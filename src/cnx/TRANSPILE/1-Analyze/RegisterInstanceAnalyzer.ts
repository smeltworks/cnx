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
import RegisterAddress from "../../utils/RegisterAddress";
import RegisterInstance from "../../utils/RegisterInstance";
import TYPE_FORMING_KINDS from "../../PARSE/3-Declare/TYPE_FORMING_KINDS";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import type IRegisterSymbol from "../../types/symbols/IRegisterSymbol";
import type IRegisterMemberSymbol from "../../types/symbols/IRegisterMemberSymbol";
import StatementNodes from "../../utils/StatementNodes";

class RegisterInstanceAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IBaseAnalysisError[] {
    const found: IBaseAnalysisError[] = [];
    for (const { declaration, scope } of program.members) {
      const scopePath = RegisterInstance.scopePathOf(
        this.context.program,
        scope,
      );
      if (declaration.kind === "function") {
        for (const parameter of declaration.parameters ?? []) {
          if (!this.isRegisterType(parameter.type, scopePath)) continue;
          found.push({
            aboutItsPosition: true,
            code: "E0933",
            span: parameter.span,
            message: `parameter '${parameter.name}' is a register; register parameters are not supported yet (ADR-072)`,
            helpText:
              "Access the register instance directly (`GPIO1.DR`). ADR-072 resolves a register parameter per instance at compile time; until that is implemented it is rejected rather than passed as a runtime pointer.",
          });
        }
        for (const statement of StatementNodes.in(declaration)) {
          if (statement.kind !== "constructorDeclaration") continue;
          if (!this.isRegisterType(statement.type, scopePath)) {
            if (statement.address !== null && statement.arguments.length === 0)
              found.push(this.notRegister(statement));
            continue;
          }
          found.push({
            aboutItsPosition: true,
            code: "E0934",
            span: statement.span,
            message: `register instance '${statement.name}' must be declared at file or scope level`,
            helpText:
              "A register instance names hardware at a fixed address for the whole program (ADR-072), so it is not a local. Declare it beside the register type or as a scope member.",
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
      const symbol = this.context.program.memberOf(scopePath, declaration.name);
      if (symbol?.kind !== "register") {
        if (
          declaration.kind === "constructorDeclaration" &&
          !this.isRegisterType(declaration.type, scopePath) &&
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
            aboutItsPosition: true,
            code: "E0931",
            span: declaration.span,
            message:
              symbol.baseAddress === null
                ? `the address of register '${declaration.name}' is not a compile-time constant`
                : `the address of register '${declaration.name}' is negative`,
            helpText:
              "A register instance's address is resolved at compile time (ADR-072). Use a literal, a const, or arithmetic over them.",
          });
        } else {
          found.push(...this.beyondPointers(declaration, symbol));
        }
        continue;
      }
      for (const member of declaration.members) {
        const offset = symbol.members.get(member.name)?.offsetValue ?? null;
        if (offset !== null && offset >= 0n) continue;
        found.push({
          aboutItsPosition: true,
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

  /**
   * E0931: a member whose last byte lies past the target's pointer range. The
   * address is folded here, so C would otherwise wrap it silently.
   */
  private beyondPointers(
    declaration: {
      readonly name: string;
      readonly span: IBaseAnalysisError["span"];
    },
    instance: IRegisterSymbol,
  ): IBaseAnalysisError[] {
    const target = this.context.program.target();
    if (target.kind !== "resolved" || instance.baseAddress === null) return [];
    const bits = target.description.pointer_bits;
    const limit = 1n << BigInt(bits);
    const found: IBaseAnalysisError[] = [];
    for (const member of instance.members.values()) {
      if (member.offsetValue === null || member.offsetValue < 0n) continue;
      const last =
        instance.baseAddress +
        member.offsetValue +
        this.bytesOf(member, bits) -
        1n;
      if (last < limit) continue;
      found.push({
        aboutItsPosition: true,
        code: "E0931",
        span: declaration.span,
        message: `register member '${declaration.name}.${member.name}' ends at ${RegisterAddress.hex(last)}, past the target's ${bits}-bit address range`,
        helpText:
          "Every byte of a register member must be addressable on the target (ADR-072). Check the instance's address against the datasheet.",
      });
    }
    return found;
  }

  private bytesOf(member: IRegisterMemberSymbol, pointerBits: number): bigint {
    const type = member.type;
    const name =
      type.kind === "primitive"
        ? type.primitive
        : "name" in type
          ? String(type.name)
          : "";
    // an ISR slot is a function pointer, as wide as the target's pointers
    const bits =
      name === "ISR"
        ? pointerBits
        : (TYPE_WIDTH[name] ??
          this.context.symbols.bitmapBitWidth.get(name) ??
          8);
    return BigInt(Math.ceil(bits / 8));
  }

  /** `Type name(expr);` whose type is not a register: a C++ constructor (#375) */
  private notRegister(declaration: {
    readonly name: string;
    readonly span: IBaseAnalysisError["span"];
  }): IBaseAnalysisError {
    return {
      aboutItsPosition: true,
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
    // the nearest TYPE wins: a scoped struct shadows a global register type,
    // a scoped variable or instance of the same name does not
    for (const [path, name] of candidates) {
      const symbol = program.memberOf(path, name);
      if (symbol === undefined || symbol === null) continue;
      if (symbol.kind === "register") {
        if (symbol.registerType === null) return true;
        continue;
      }
      if (TYPE_FORMING_KINDS.has(symbol.kind)) return false;
    }
    return false;
  }
}

export default RegisterInstanceAnalyzer;
