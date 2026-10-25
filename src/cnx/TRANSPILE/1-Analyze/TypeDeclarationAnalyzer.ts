/**
 * A declared type whose own shape is invalid: E0893 (ADR-034), and an enum
 * member's value that is negative (E0894), has no value (E0909), overflows
 * (E0910) or leaves `i32` (E0911) -- ADR-017 "Member Values", #1669.
 *
 * #1531. Both rules were throws in 1.3 Declare's collectors, so each reached
 * the user as `1:0 Code generation failed: Error: ...` -- no code, no
 * position, and a prefix naming a pass that never saw the declaration. A
 * throw also stopped the run at the first offender, so a file declaring three
 * bad bitmaps reported one.
 *
 * 1.3 still records the facts: each field's width beside the bitmap's size,
 * and each member's value. This asks the one question of them, so a width or
 * a value is derived once, by its collector, and judged once, here.
 *
 * The declarations are read from the symbol table rather than the tree. That
 * is what makes a scope-declared bitmap or enum one of them with nothing
 * extra: 1.3 registers it under the file like any other.
 */

import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import type IBitmapSymbol from "../../types/symbols/IBitmapSymbol";
import type IEnumMemberSymbol from "../../types/symbols/IEnumMemberSymbol";
import type IEnumSymbol from "../../types/symbols/IEnumSymbol";
import type TEnumMemberValue from "../../types/TEnumMemberValue";
import type IAnalysisContext from "./types/IAnalysisContext";
import type ITypeDeclarationError from "./types/ITypeDeclarationError";
import SourceOrder from "../../utils/SourceOrder";

class TypeDeclarationAnalyzer {
  public constructor(private readonly context: IAnalysisContext) {}

  public analyze(): ITypeDeclarationError[] {
    const found: ITypeDeclarationError[] = [];
    const declared = this.context.symbolTable.getTSymbolsByFile(
      this.context.sourceFile,
    );
    for (const symbol of declared) {
      if (symbol.kind === "bitmap") {
        found.push(...TypeDeclarationAnalyzer.bitmapWidth(symbol));
      } else if (symbol.kind === "enum") {
        found.push(...this.enumValues(symbol));
      }
    }
    // The table's order is registration order, not the source's.
    return found.sort(SourceOrder.bySpan);
  }

  private static bitmapWidth(bitmap: IBitmapSymbol): ITypeDeclarationError[] {
    let totalBits = 0;
    for (const field of bitmap.fields.values()) {
      totalBits += field.width;
    }
    if (totalBits === bitmap.bitWidth) {
      return [];
    }
    // `bitmap${N}` is the keyword itself, not a guess at it: ADR-034 names
    // each bitmap type by the number of bits it holds.
    return [
      {
        code: "E0893",
        span: bitmap.span,
        message: `Bitmap '${bitmap.cnxScopedName}' has ${totalBits} bits but bitmap${bitmap.bitWidth} requires exactly ${bitmap.bitWidth} bits`,
        helpText:
          "A bitmap's field widths must add up to its size (ADR-034). Resize a field, or declare the bitmap with the size its fields add up to",
      },
    ];
  }

  /**
   * #1669: each member's value as 1.4 Resolve settled it (ADR-017 "Member
   * Values") -- the symbol table holds what 1.3 recorded, which is the value
   * as written, not its number.
   */
  private enumValues(enumSymbol: IEnumSymbol): ITypeDeclarationError[] {
    const settled = this.context.program.enumMemberValues(
      enumSymbol.fullyQualifiedCName,
    );
    return [...enumSymbol.members.values()].flatMap((member, index) => {
      const error = TypeDeclarationAnalyzer.memberError(
        enumSymbol,
        member,
        settled[index],
      );
      return error === null ? [] : [error];
    });
  }

  private static memberError(
    enumSymbol: IEnumSymbol,
    member: IEnumMemberSymbol,
    settled: TEnumMemberValue | undefined,
  ): ITypeDeclarationError | null {
    const named = `${enumSymbol.cnxScopedName}.${member.name}`;
    switch (settled?.kind) {
      case "value":
        return settled.value >= 0n
          ? null
          : {
              code: "E0894",
              span: member.span,
              message: `Negative values not allowed in enum (found ${settled.value} in ${named})`,
              helpText:
                "An enum member's value is 0 or more (ADR-017). Use a non-negative value",
            };
      case "notConstant":
      case "foreign": {
        const why = ConstantDiagnostics.why(settled);
        return why === null
          ? null
          : {
              code: "E0909",
              span: member.span,
              message: `Enum member value must be known at compile time (${named}): ${why}`,
              helpText:
                "A member's value is built from literals, read-only bindings, length properties, casts and the members of its enum declared above it (ADR-017)",
            };
      }
      case "overflow":
        return {
          code: "E0910",
          span: member.span,
          message: `Enum member value overflows ${settled.typeName} at compile time (${named}): the arithmetic would clamp or wrap (ADR-044)`,
          helpText: ConstantDiagnostics.OVERFLOW_HELP,
        };
      case "outOfRange":
        return {
          code: "E0911",
          span: member.span,
          message: `Enum member value does not fit i32 (found ${settled.value} in ${named})`,
          helpText:
            "A member's value is an i32 (ADR-017). Use a value of at most 2147483647",
        };
      default:
        // `follows`: its value is the member above's, reported there
        return null;
    }
  }
}

export default TypeDeclarationAnalyzer;
