/**
 * CResolver - Orchestrates C symbol collection using composable collectors.
 *
 * This resolver collects symbols from C header parse trees and returns
 * typed TCSymbol[] discriminated unions.
 */

import type ICHeaderSyntax from "../../2-Parse/types/ICHeaderSyntax";
import type IHeaderDeclaratorSyntax from "../../2-Parse/types/IHeaderDeclaratorSyntax";
import type ICEnumSyntax from "../../2-Parse/types/ICEnumSyntax";
import type ICStructSyntax from "../../2-Parse/types/ICStructSyntax";
import type TCExternalDeclarationSyntax from "../../2-Parse/types/TCExternalDeclarationSyntax";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import SymbolTable from "../SymbolTable";
import DeclaratorTypes from "../../2-Parse/shared/DeclaratorTypes";
import StructCollector from "./collectors/StructCollector";
import EnumCollector from "./collectors/EnumCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import TypedefCollector from "./collectors/TypedefCollector";
import VariableCollector from "./collectors/VariableCollector";
import type ISourceSpan from "../../../types/ISourceSpan";

/**
 * Result of resolving C symbols.
 */
type TCDeclarationSyntax = Extract<
  TCExternalDeclarationSyntax,
  { kind: "declaration" }
>;

interface ICResolverResult {
  /** Collected symbols */
  readonly symbols: TCSymbol[];

  /** Warnings generated during collection */
  readonly warnings: string[];
}

/**
 * Internal context for declaration processing.
 */
interface IDeclarationContext {
  readonly sourceFile: string;
  readonly span: ISourceSpan;
  readonly isTypedef: boolean;
  readonly isExtern: boolean;
  /** A variable's or typedef's spelling keeps it, as a field's does */
  readonly isVolatile: boolean;
  readonly isConst?: boolean;
  readonly symbols: TCSymbol[];
}

class CResolver {
  /**
   * Resolve a C header's symbols from 1.2's plain-data header (#1991).
   *
   * @param header - 1.2's lowered header
   * @param sourceFile - Source file path
   * @param symbolTable - Optional symbol table for struct field tracking
   */
  static resolve(
    header: ICHeaderSyntax,
    sourceFile: string,
    symbolTable?: SymbolTable | null,
  ): ICResolverResult {
    const symbols: TCSymbol[] = [];
    const warnings: string[] = [];
    for (const decl of header.declarations) {
      if (decl.kind === "functionDefinition") {
        const funcSymbol = FunctionCollector.collectFromDefinition(
          decl,
          sourceFile,
        );
        if (funcSymbol) symbols.push(funcSymbol);
        continue;
      }
      CResolver.collectDeclaration(
        decl,
        sourceFile,
        symbolTable ?? null,
        symbols,
        warnings,
      );
    }
    return { symbols, warnings };
  }

  private static collectDeclaration(
    decl: TCDeclarationSyntax,
    sourceFile: string,
    symbolTable: SymbolTable | null,
    symbols: TCSymbol[],
    warnings: string[],
  ): void {
    const ctx: IDeclarationContext = {
      sourceFile,
      span: decl.span,
      isTypedef: decl.isTypedef,
      isExtern: decl.isExtern,
      isVolatile: decl.isVolatile,
      isConst: decl.isConst,
      symbols,
    };
    if (decl.struct) {
      CResolver.collectStructSymbol(
        decl,
        decl.struct,
        ctx,
        symbolTable,
        warnings,
      );
    }
    if (decl.enum) {
      CResolver.collectEnumSymbols(decl.enum, ctx);
    }
    if (decl.declarators) {
      CResolver.collectDeclarators(
        decl.declarators,
        DeclaratorTypes.baseType(decl.typeSpecifiers),
        ctx,
      );
    } else {
      CResolver.collectFromDeclSpecsTypedefName(decl, ctx);
    }
  }

  private static collectStructSymbol(
    decl: TCDeclarationSyntax,
    struct: ICStructSyntax,
    ctx: IDeclarationContext,
    symbolTable: SymbolTable | null,
    warnings: string[],
  ): void {
    const structSymbol = StructCollector.collect(
      struct,
      ctx.sourceFile,
      ctx.span,
      symbolTable,
      {
        typedefName: ctx.isTypedef
          ? CResolver.extractTypedefName(decl)
          : undefined,
        isTypedef: ctx.isTypedef,
        warnings,
        isPointerTypedef:
          ctx.isTypedef && (decl.declarators?.[0]?.hasPointer ?? false),
      },
    );
    if (structSymbol) ctx.symbols.push(structSymbol);
  }

  /** The first declarator's name, else the first typedef name in the specifiers */
  private static extractTypedefName(
    decl: TCDeclarationSyntax,
  ): string | undefined {
    const first = decl.declarators?.[0]?.name;
    if (first) return first;
    return (
      decl.typeSpecifiers.find((spec) => spec.typedefName !== null)
        ?.typedefName ?? undefined
    );
  }

  private static collectEnumSymbols(
    enumSyntax: ICEnumSyntax,
    ctx: IDeclarationContext,
  ): void {
    const enumResult = EnumCollector.collect(
      enumSyntax,
      ctx.sourceFile,
      ctx.span,
    );
    if (enumResult.enum !== null) ctx.symbols.push(enumResult.enum);
    ctx.symbols.push(...enumResult.members);
  }

  private static collectDeclarators(
    declarators: readonly IHeaderDeclaratorSyntax[],
    baseType: string,
    ctx: IDeclarationContext,
  ): void {
    for (const declarator of declarators) {
      const name = declarator.name;
      if (!name) continue;
      if (ctx.isTypedef) {
        const spelled = CResolver.qualified(baseType, ctx);
        const typedefType = DeclaratorTypes.declaredType(spelled, declarator);
        ctx.symbols.push(
          TypedefCollector.collect(
            name,
            typedefType,
            ctx.sourceFile,
            ctx.span,
            typedefType === spelled ? [...declarator.arrayDimensions] : [],
            ctx.isConst === true,
          ),
        );
      } else if (declarator.isFunction) {
        ctx.symbols.push(
          FunctionCollector.collectFromDeclaration(
            name,
            baseType,
            declarator,
            ctx.sourceFile,
            ctx.span,
          ),
        );
      } else {
        ctx.symbols.push(
          VariableCollector.collect(
            name,
            CResolver.qualified(baseType, ctx),
            declarator,
            ctx.sourceFile,
            ctx.span,
            ctx.isExtern,
          ),
        );
      }
    }
  }

  /**
   * A declaration with no declarator list whose last type specifier is a
   * typedef name (`typedef unsigned int my_uint;` read as specifiers alone).
   */
  private static collectFromDeclSpecsTypedefName(
    decl: TCDeclarationSyntax,
    ctx: IDeclarationContext,
  ): void {
    let lastIndex = -1;
    decl.typeSpecifiers.forEach((spec, index) => {
      if (spec.typedefName !== null) lastIndex = index;
    });
    if (lastIndex < 0) return;
    const name = decl.typeSpecifiers[lastIndex].typedefName;
    if (!name) return;
    // A declaration that defines the tag repeats it (`struct P { ... } P;`);
    // `extern struct tm tm;` is a variable named as its tag is, which C keeps
    // apart (#1975 review)
    if (
      !ctx.isTypedef &&
      ((decl.struct?.tag === name && decl.struct.hasBody) ||
        decl.enum?.name === name)
    ) {
      return;
    }
    const baseType = CResolver.qualified(
      DeclaratorTypes.baseType(decl.typeSpecifiers, lastIndex),
      ctx,
    );
    ctx.symbols.push(
      ctx.isTypedef
        ? TypedefCollector.collect(
            name,
            baseType,
            ctx.sourceFile,
            ctx.span,
            [],
            ctx.isConst === true,
          )
        : VariableCollector.collectFromDeclSpecs(
            name,
            baseType,
            ctx.sourceFile,
            ctx.span,
            ctx.isExtern,
          ),
    );
  }

  private static qualified(baseType: string, ctx: IDeclarationContext): string {
    return ctx.isVolatile ? `volatile ${baseType}` : baseType;
  }
}

export default CResolver;
