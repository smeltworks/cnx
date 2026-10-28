/**
 * CppResolver - Orchestrates symbol collection from 1.2's lowered C++ header.
 *
 * Uses composable collectors to extract symbols from different C++ constructs.
 * Produces TCppSymbol instances (discriminated union of C++ symbol types). It
 * reads plain data, never the tree, which stays in 1.2 (#1991).
 */

import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import CppNamespaceUtils from "../../../utils/CppNamespaceUtils";
import SymbolTable from "../SymbolTable";
import NamespaceCollector from "./collectors/NamespaceCollector";
import EnumCollector from "./collectors/EnumCollector";
import TypeAliasCollector from "./collectors/TypeAliasCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import ClassCollector from "./collectors/ClassCollector";
import VariableCollector from "./collectors/VariableCollector";
import type ICppHeaderSyntax from "../../2-Parse/types/ICppHeaderSyntax";
import type ICppClassSyntax from "../../2-Parse/types/ICppClassSyntax";
import type IHeaderDeclaratorSyntax from "../../2-Parse/types/IHeaderDeclaratorSyntax";
import type TCppDeclarationSyntax from "../../2-Parse/types/TCppDeclarationSyntax";
import type ISourceSpan from "../../../types/ISourceSpan";

type TCppSimpleDeclarationSyntax = Extract<
  TCppDeclarationSyntax,
  { kind: "simple" }
>;

/**
 * Result of resolving C++ symbols.
 */
interface ICppResolverResult {
  symbols: TCppSymbol[];
  warnings: string[];
}

/**
 * Internal context for declaration processing.
 */
interface ICppDeclarationContext {
  readonly sourceFile: string;
  readonly currentNamespace: string | undefined;
  readonly symbolTable: SymbolTable | undefined;
  readonly symbols: TCppSymbol[];
  readonly warnings: string[];
}

class CppResolver {
  /**
   * Resolve all symbols from a C++ header.
   *
   * @param header 1.2's lowered header
   * @param sourceFile Source file path
   * @param symbolTable Optional symbol table for storing struct fields, enum bit widths
   * @returns Result containing symbols and warnings
   */
  static resolve(
    header: ICppHeaderSyntax,
    sourceFile: string,
    symbolTable?: SymbolTable,
  ): ICppResolverResult {
    const symbols: TCppSymbol[] = [];
    const warnings: string[] = [];
    const ctx: ICppDeclarationContext = {
      sourceFile,
      currentNamespace: undefined,
      symbolTable,
      symbols,
      warnings,
    };
    for (const decl of header.declarations) {
      CppResolver._collectDeclaration(decl, ctx);
    }
    return { symbols, warnings };
  }

  private static _collectDeclaration(
    decl: TCppDeclarationSyntax,
    ctx: ICppDeclarationContext,
  ): void {
    switch (decl.kind) {
      case "functionDefinition": {
        const symbol = FunctionCollector.collectDefinition(
          decl,
          ctx.sourceFile,
          ctx.currentNamespace,
        );
        if (symbol) ctx.symbols.push(symbol);
        return;
      }
      case "namespace": {
        const nsSymbol = NamespaceCollector.collect(
          decl.name,
          ctx.sourceFile,
          decl.span,
          ctx.currentNamespace,
        );
        if (nsSymbol) ctx.symbols.push(nsSymbol);
        const nestedCtx: ICppDeclarationContext = {
          ...ctx,
          currentNamespace: NamespaceCollector.getFullNamespaceName(
            decl.name,
            ctx.currentNamespace,
          ),
        };
        for (const nested of decl.declarations) {
          CppResolver._collectDeclaration(nested, nestedCtx);
        }
        return;
      }
      case "alias":
        ctx.symbols.push(
          TypeAliasCollector.collect(
            decl.name,
            ctx.sourceFile,
            decl.span,
            ctx.currentNamespace,
          ),
        );
        return;
      case "simple":
        CppResolver._collectSimpleDeclaration(decl, ctx);
    }
  }

  private static _collectSimpleDeclaration(
    decl: TCppSimpleDeclarationSyntax,
    ctx: ICppDeclarationContext,
  ): void {
    const anonymousClass = CppResolver._processTypeSpecifiers(decl, ctx);
    if (!decl.declarators) return;

    for (const declarator of decl.declarators) {
      // Issue #1164: `typedef struct opaque_t* handle_t;` is a type, not a
      // variable. Recorded so the header includes the defining file rather
      // than forward-declaring a struct of the same name, which is a
      // different type entirely.
      if (decl.isTypedef && declarator.hasPointer) {
        if (declarator.name) {
          ctx.symbolTable?.markPointerTypedef(declarator.name);
        }
        continue;
      }

      // A NON-pointer typedef (`typedef unsigned char byte_t;`) is still
      // collected as a variable, which is wrong -- but downstream code depends
      // on the symbol existing, and simply skipping it changes generated C for
      // any file including such a header. Registering it as a type instead is
      // tracked as #1213.
      CppResolver._collectDeclarator(
        declarator,
        decl.baseType,
        decl.span,
        ctx,
        anonymousClass,
        decl.isVolatile,
      );
    }
  }

  /**
   * Collect the classes and enums a declaration's specifiers define.
   * Returns the anonymous class, if any, for typedef handling.
   */
  private static _processTypeSpecifiers(
    decl: TCppSimpleDeclarationSyntax,
    ctx: ICppDeclarationContext,
  ): ICppClassSyntax | null {
    let anonymousClass: ICppClassSyntax | null = null;
    for (const spec of decl.typeSpecifiers) {
      if (spec.kind === "enum") {
        const enumSymbol = EnumCollector.collect(
          spec.enum,
          ctx.sourceFile,
          decl.span,
          ctx.currentNamespace,
          ctx.symbolTable,
        );
        if (enumSymbol) ctx.symbols.push(enumSymbol);
        continue;
      }
      if (!spec.class.name) {
        anonymousClass = spec.class;
        continue;
      }
      const result = ClassCollector.collect(
        spec.class,
        ctx.sourceFile,
        decl.span,
        ctx.currentNamespace,
        ctx.symbolTable,
      );
      if (result) {
        ctx.symbols.push(
          result.classSymbol,
          ...result.memberFunctions,
          ...result.staticMembers,
        );
        ctx.warnings.push(...result.warnings);
      }
    }
    return anonymousClass;
  }

  /**
   * Process a single declarator (variable or function).
   */
  private static _collectDeclarator(
    declarator: IHeaderDeclaratorSyntax,
    baseType: string,
    span: ISourceSpan,
    ctx: ICppDeclarationContext,
    anonymousClass: ICppClassSyntax | null,
    isVolatile: boolean,
  ): void {
    const name = declarator.name;
    if (!name) return;

    const fullName = CppNamespaceUtils.qualify(ctx.currentNamespace, name);

    // Handle anonymous struct typedef
    if (anonymousClass && ctx.symbolTable) {
      const result = ClassCollector.collectAnonymousTypedef(
        anonymousClass,
        name,
        fullName,
        ctx.currentNamespace,
        ctx.sourceFile,
        span,
        ctx.symbolTable,
      );
      if (result) {
        ctx.symbols.push(
          result.classSymbol,
          ...result.memberFunctions,
          ...result.staticMembers,
        );
        ctx.warnings.push(...result.warnings);
        return;
      }
    }

    // A variable's spelling keeps `volatile`, as a C one's does (#1760 review)
    const variableType = isVolatile ? `volatile ${baseType}` : baseType;
    const symbol = declarator.isFunction
      ? FunctionCollector.collectDeclaration(
          declarator,
          baseType,
          ctx.sourceFile,
          span,
          ctx.currentNamespace,
        )
      : VariableCollector.collect(
          declarator,
          variableType,
          ctx.sourceFile,
          span,
          ctx.currentNamespace,
        );
    if (symbol) ctx.symbols.push(symbol);
  }
}

export default CppResolver;
