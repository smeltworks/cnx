/**
 * ADR-072 Part 1: what a register type and its instances must be.
 *
 * - E0931: an instance's address is not a compile-time constant
 * - E0932: a register member's offset is not a compile-time constant
 * - E0934: a register instance is declared inside a function
 * - E0938: two register members overlap outside an offset group
 * - E0939: a register member's offset is not a multiple of its size
 *
 * 1.4 Resolve folded every address and offset once; this reads the result.
 *
 * E0933 is retired: a register parameter is supported now, bound to an
 * instance at each call (ADR-072).
 */
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";
import SourceOrder from "../../utils/SourceOrder";
import RegisterAddress from "../../utils/RegisterAddress";
import RegisterInstance from "../../utils/RegisterInstance";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import TYPE_FORMING_KINDS from "../../PARSE/3-Declare/TYPE_FORMING_KINDS";
import RegisterLayout from "../../utils/RegisterLayout";
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
        const unbound = this.unboundSoleName(declaration);
        if (unbound !== null) {
          found.push(unbound);
          continue;
        }
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
      found.push(...this.layoutOf(declaration, symbol));
    }
    return found.sort(SourceOrder.bySpan);
  }

  /**
   * E0938/E0939: a register's members match the hardware's map, so a member
   * is aligned to its size and overlaps another only inside an offset group
   */
  private layoutOf(
    declaration: {
      readonly members: ReadonlyArray<{
        readonly name: string;
        readonly group: number | null;
        readonly span: IBaseAnalysisError["span"];
      }>;
    },
    register: IRegisterSymbol,
  ): IBaseAnalysisError[] {
    const found: IBaseAnalysisError[] = [];
    const placed: Array<{
      readonly name: string;
      readonly group: number | null;
      readonly start: bigint;
      readonly end: bigint;
      readonly declared: string;
    }> = [];
    for (const syntax of declaration.members) {
      const member = register.members.get(syntax.name);
      const start = member?.offsetValue ?? null;
      if (member === undefined || start === null || start < 0n) continue;
      const bytes = member.bytes;
      if (bytes === null) continue;
      const end = start + bytes;
      const misaligned = this.misaligned(syntax, member, start, bytes);
      if (misaligned !== null) found.push(misaligned);
      const other = placed.find(
        (prior) =>
          (syntax.group === null || prior.group !== syntax.group) &&
          prior.start < end &&
          start < prior.end,
      );
      const declared = `${member.access} ${RegisterLayout.typeNameOf(member)} ${syntax.name}`;
      if (other !== undefined) {
        found.push(this.overlap(syntax, start, declared, other));
      }
      placed.push({
        name: syntax.name,
        group: syntax.group,
        start,
        end,
        declared,
      });
    }
    return found;
  }

  private overlap(
    member: {
      readonly name: string;
      readonly span: IBaseAnalysisError["span"];
    },
    start: bigint,
    declared: string,
    other: {
      readonly name: string;
      readonly start: bigint;
      readonly declared: string;
    },
  ): IBaseAnalysisError {
    const offset = RegisterAddress.hex(start);
    return {
      aboutItsPosition: true,
      code: "E0938",
      span: member.span,
      message: `register member '${member.name}' at ${offset} overlaps '${other.name}' at ${RegisterAddress.hex(other.start)}`,
      helpText:
        other.start === start
          ? `Members the hardware reaches through one offset are written as one group (ADR-072): \`${offset} { ${other.declared}, ${declared}, }\`. Otherwise check the offsets against the datasheet.`
          : "Every member of a group starts at the group's offset, and no other members overlap (ADR-072). Check the offsets against the datasheet.",
    };
  }

  /** E0939: on Cortex-M an unaligned access to device memory faults */
  private misaligned(
    syntax: {
      readonly name: string;
      readonly span: IBaseAnalysisError["span"];
    },
    member: IRegisterMemberSymbol,
    start: bigint,
    bytes: bigint,
  ): IBaseAnalysisError | null {
    // a size that is not a power of two has no natural alignment
    if ((bytes & (bytes - 1n)) !== 0n || start % bytes === 0n) return null;
    const type = RegisterLayout.typeNameOf(member);
    const next = RegisterAddress.hex(start + bytes - (start % bytes));
    return {
      aboutItsPosition: true,
      code: "E0939",
      span: syntax.span,
      message: `register member '${syntax.name}' is a ${type} at ${RegisterAddress.hex(start)}, which is not a multiple of ${bytes}`,
      helpText: `A register member is aligned to its size (ADR-072); an unaligned access to device memory faults. Move it to ${next} if the datasheet says so, or declare the narrower parts the hardware reaches.`,
    };
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
        instance.baseAddress + member.offsetValue + member.bytes! - 1n;
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

  /**
   * `GpioPort G(MISSING);` names its address with one bare name, which 1.2
   * lowers as a constructor argument, not an expression, so no value walk
   * sees it. A name that binds nothing there is what `G(MISSING + 0)`
   * reports: E0427, not E0931's "not a compile-time constant".
   */
  private unboundSoleName(declaration: {
    readonly arguments: ReadonlyArray<{
      readonly name: string;
      readonly span: IBaseAnalysisError["span"];
    }>;
  }): IBaseAnalysisError | null {
    if (declaration.arguments.length !== 1) return null;
    const [argument] = declaration.arguments;
    const at = { line: argument.span.line, column: argument.span.column };
    if (
      new UndeclaredValueAnalyzer(this.context).isVisible(
        argument.name,
        null,
        at,
      )
    ) {
      return null;
    }
    return {
      aboutItsPosition: true,
      code: "E0427",
      span: argument.span,
      message: `'${argument.name}' is not defined`,
    };
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
