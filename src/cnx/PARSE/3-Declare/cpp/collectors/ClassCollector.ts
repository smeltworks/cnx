/**
 * ClassCollector - C++ class/struct symbols from 1.2's lowered header (#1991).
 *
 * Handles class members including data fields and member functions.
 * Produces ICppClassSymbol instances with optional field information.
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppClassSymbol from "../../../../types/symbols/cpp/ICppClassSymbol";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppVariableSymbol from "../../../../types/symbols/cpp/ICppVariableSymbol";
import type TStructLayout from "../../../../types/TStructLayout";
import ICppFieldInfo from "../../../../types/symbols/cpp/ICppFieldInfo";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import DeclaratorTypes from "../../../2-Parse/shared/DeclaratorTypes";
import FunctionCollector from "./FunctionCollector";
import type ISourceSpan from "../../../../types/ISourceSpan";
import type ICppClassSyntax from "../../../2-Parse/types/ICppClassSyntax";
import type ICppFunctionDefinitionSyntax from "../../../2-Parse/types/ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type TCppMemberSyntax from "../../../2-Parse/types/TCppMemberSyntax";

/**
 * Result of collecting a class, including the class symbol and any member function symbols.
 */
interface IClassCollectorResult {
  classSymbol: ICppClassSymbol;
  memberFunctions: ICppFunctionSymbol[];
  /** #1975 review: `static` data members, values rather than fields */
  staticMembers: ICppVariableSymbol[];
  warnings: string[];
}

/**
 * Internal context for member collection.
 */
interface IMemberCollectionContext {
  readonly className: string;
  readonly sourceFile: string;
  readonly symbolTable: SymbolTable | null;
  readonly fields: Map<string, ICppFieldInfo> | undefined;
  readonly memberFunctions: ICppFunctionSymbol[];
  readonly staticMembers: ICppVariableSymbol[];
  readonly warnings: string[];
}

class ClassCollector {
  /**
   * Collect a class specifier and return an ICppClassSymbol with member functions.
   *
   * @param classSyntax The class 1.2 lowered
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param currentNamespace Optional current namespace
   * @param symbolTable Optional symbol table for storing field info
   * @returns The class symbol with member functions, or null if no name
   */
  static collect(
    classSyntax: ICppClassSyntax,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
    symbolTable?: SymbolTable | null,
  ): IClassCollectorResult | null {
    const name = classSyntax.name;
    if (!name) return null;

    const fullName = CppNamespaceUtils.qualify(currentNamespace, name);

    const memberFunctions: ICppFunctionSymbol[] = [];
    const staticMembers: ICppVariableSymbol[] = [];
    const warnings: string[] = [];
    const fields: Map<string, ICppFieldInfo> | undefined = symbolTable
      ? new Map()
      : undefined;

    // Extract class members
    const members = classSyntax.members;
    if (members) {
      const ctx: IMemberCollectionContext = {
        className: fullName,
        sourceFile,
        symbolTable: symbolTable ?? null,
        fields,
        memberFunctions,
        staticMembers,
        warnings,
      };
      ClassCollector._collectClassMembers(ctx, members);
    }
    ClassCollector._recordLayout(fullName, classSyntax, symbolTable ?? null);

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: fullName,
      unqualifiedName: name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      fields: fields && fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, staticMembers, warnings };
  }

  /**
   * Collect an anonymous class from a typedef.
   *
   * @param classSyntax The anonymous class 1.2 lowered
   * @param typedefName The typedef name to use as the class name
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param symbolTable Symbol table for storing field info
   * @returns The class symbol result, or null on error
   */
  static collectAnonymousTypedef(
    classSyntax: ICppClassSyntax,
    unqualifiedName: string,
    typedefName: string,
    currentNamespace: string | undefined,
    sourceFile: string,
    span: ISourceSpan,
    symbolTable: SymbolTable,
  ): IClassCollectorResult | null {
    const members = classSyntax.members;
    if (!members) return null;

    const memberFunctions: ICppFunctionSymbol[] = [];
    const staticMembers: ICppVariableSymbol[] = [];
    const warnings: string[] = [];
    const fields = new Map<string, ICppFieldInfo>();

    const ctx: IMemberCollectionContext = {
      className: typedefName,
      sourceFile,
      symbolTable,
      fields,
      memberFunctions,
      staticMembers,
      warnings,
    };
    ClassCollector._collectClassMembers(ctx, members);
    ClassCollector._recordLayout(typedefName, classSyntax, symbolTable);

    const classSymbol: ICppClassSymbol = {
      kind: "class",
      name: typedefName,
      unqualifiedName,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      fields: fields.size > 0 ? fields : undefined,
    };

    return { classSymbol, memberFunctions, staticMembers, warnings };
  }

  /** #1975 review: why a class's fields do not sum to its length, if so */
  private static _recordLayout(
    className: string,
    classSyntax: ICppClassSyntax,
    symbolTable: SymbolTable | null,
  ): void {
    const layout = ClassCollector._layoutOf(classSyntax);
    if (symbolTable && layout !== null) {
      symbolTable.setStructLayout(className, layout);
    }
  }

  private static _layoutOf(classSyntax: ICppClassSyntax): TStructLayout | null {
    if (classSyntax.isUnion) return "union";
    if (classSyntax.hasBitField) return "bit-packed";
    if (classSyntax.hasBase) return "derived";
    if (classSyntax.hasVirtual) return "virtual";
    return classSyntax.hasUnnamedMember ? "unrecorded-member" : null;
  }

  /**
   * Collect class members (data fields and member functions). 1.2 does not
   * lower access labels, so every member is recorded "public" (#1475).
   */
  private static _collectClassMembers(
    ctx: IMemberCollectionContext,
    members: readonly TCppMemberSyntax[],
  ): void {
    for (const member of members) {
      if (member.kind === "functionDefinition") {
        ClassCollector._collectInlineFunctionDef(member, ctx);
        continue;
      }
      for (const declarator of member.declarators) {
        ClassCollector._collectMemberDeclarator(declarator, member, ctx);
      }
    }
  }

  /**
   * Collect an inline function definition within a class.
   */
  private static _collectInlineFunctionDef(
    funcDef: ICppFunctionDefinitionSyntax,
    ctx: IMemberCollectionContext,
  ): void {
    const funcName = funcDef.declarator.name;
    if (!funcName) return;
    ctx.memberFunctions.push(
      FunctionCollector.collectMemberFunction(
        ctx.className,
        funcName,
        funcDef.declarator,
        funcDef.returnType,
        ctx.sourceFile,
        funcDef.span,
        false, // not a declaration, it's a definition
      ),
    );
  }

  /**
   * Collect a single member declarator (function or data field).
   */
  private static _collectMemberDeclarator(
    declarator: IHeaderDeclaratorSyntax,
    member: Extract<TCppMemberSyntax, { kind: "declaration" }>,
    ctx: IMemberCollectionContext,
  ): void {
    const fieldName = declarator.name;
    if (!fieldName) return;
    const fieldType = member.fieldType;
    const span = member.span;

    // Check if this is a member function -- a pointer to one is a data
    // member, as a C struct's function-pointer field is (#1760 review)
    if (declarator.isFunction && declarator.functionPointerParams === null) {
      ctx.memberFunctions.push(
        FunctionCollector.collectMemberFunction(
          ctx.className,
          fieldName,
          declarator,
          fieldType,
          ctx.sourceFile,
          span,
          true, // declaration
        ),
      );
      return;
    }

    if (member.isStatic) {
      ctx.staticMembers.push(
        ClassCollector._staticMember(fieldName, declarator, member, ctx),
      );
      return;
    }

    ClassCollector._collectDataField(fieldName, declarator, fieldType, ctx);
  }

  /** A `static` data member: one value the class holds, `Dev::LIMIT` */
  private static _staticMember(
    name: string,
    declarator: IHeaderDeclaratorSyntax,
    member: Extract<TCppMemberSyntax, { kind: "declaration" }>,
    ctx: IMemberCollectionContext,
  ): ICppVariableSymbol {
    const dimensions = declarator.arrayDimensions;
    return {
      kind: "variable",
      name: CppNamespaceUtils.qualify(ctx.className, name),
      unqualifiedName: name,
      sourceFile: ctx.sourceFile,
      span: member.span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: ctx.className,
      type: DeclaratorTypes.declaredType(member.fieldType, declarator),
      ...(dimensions.length > 0 && {
        isArray: true,
        arrayDimensions: [...dimensions],
      }),
    };
  }

  /**
   * Collect a data field declaration.
   */
  private static _collectDataField(
    fieldName: string,
    declarator: IHeaderDeclaratorSyntax,
    fieldType: string,
    ctx: IMemberCollectionContext,
  ): void {
    // Warn if field name conflicts with cnx reserved property names
    if (SymbolUtils.isReservedFieldName(fieldName)) {
      ctx.warnings.push(
        SymbolUtils.getReservedFieldWarning("C++", ctx.className, fieldName),
      );
    }

    // Extract array dimensions if any
    const arrayDimensions = [...declarator.arrayDimensions];
    // The declarator's indirection, recorded as the C side records it
    const declaredType = DeclaratorTypes.declaredType(fieldType, declarator);

    // Add to SymbolTable if provided
    if (ctx.symbolTable) {
      ctx.symbolTable.addStructField(
        ctx.className,
        fieldName,
        declaredType,
        arrayDimensions.length > 0 ? arrayDimensions : undefined,
        declarator.bitWidth,
      );
    }

    // Add to fields map if provided
    if (ctx.fields) {
      const fieldInfo: ICppFieldInfo = {
        name: fieldName,
        type: declaredType,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
        ...(declarator.bitWidth !== undefined && {
          bitWidth: declarator.bitWidth,
        }),
      };
      ctx.fields.set(fieldName, fieldInfo);
    }
  }
}

export default ClassCollector;
