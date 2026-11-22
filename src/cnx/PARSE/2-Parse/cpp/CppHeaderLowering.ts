/**
 * CppHeaderLowering - 1.2's plain-data form of a C++ header (#1991).
 *
 * Reads what 1.3's CppResolver declares off the tree while 1.2 still holds
 * it, so no later pass needs the tree. A template declaration is not
 * lowered: 1.3 declares nothing from one.
 */

import type {
  AbstractDeclaratorContext,
  ClassSpecifierContext,
  DeclarationContext,
  DeclaratorContext,
  DeclSpecifierSeqContext,
  EnumSpecifierContext,
  FunctionDefinitionContext,
  MemberdeclarationContext,
  NamespaceDefinitionContext,
  NoPointerDeclaratorContext,
  ParameterDeclarationContext,
  ParametersAndQualifiersContext,
  PointerDeclaratorContext,
  PointerOperatorContext,
  SimpleDeclarationContext,
  TranslationUnitContext,
} from "./grammar/CPP14Parser";
import type ICppHeaderSyntax from "../types/ICppHeaderSyntax";
import type ICppClassSyntax from "../types/ICppClassSyntax";
import type ICppEnumSyntax from "../types/ICppEnumSyntax";
import type ICppFunctionDefinitionSyntax from "../types/ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "../types/IHeaderDeclaratorSyntax";
import type TCppDeclarationSyntax from "../types/TCppDeclarationSyntax";
import type TCppMemberSyntax from "../types/TCppMemberSyntax";
import type TCppTypeSpecifierSyntax from "../types/TCppTypeSpecifierSyntax";
import type IExtractedParameter from "../shared/IExtractedParameter";
import type ISourceSpan from "../../../types/ISourceSpan";
import DeclaratorTypes from "../shared/DeclaratorTypes";
import ParameterExtractorUtils from "../shared/ParameterExtractorUtils";
import ArrayDimensionText from "../../../utils/ArrayDimensionText";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";

class CppHeaderLowering {
  static header(
    tree: TranslationUnitContext,
  ): Omit<ICppHeaderSyntax, "undefinedMacros"> {
    return {
      declarations: CppHeaderLowering.declarations(
        tree.declarationseq()?.declaration() ?? [],
      ),
    };
  }

  private static declarations(
    decls: DeclarationContext[],
  ): TCppDeclarationSyntax[] {
    const lowered: TCppDeclarationSyntax[] = [];
    for (const decl of decls) {
      const one = CppHeaderLowering.declaration(decl);
      if (one) lowered.push(one);
    }
    return lowered;
  }

  private static declaration(
    decl: DeclarationContext,
  ): TCppDeclarationSyntax | null {
    const span = ParserUtils.getSpan(decl);
    const funcDef = decl.functionDefinition();
    if (funcDef) return CppHeaderLowering.functionDefinition(funcDef, span);
    const namespaceDefinition = decl.namespaceDefinition();
    if (namespaceDefinition)
      return CppHeaderLowering.namespace(namespaceDefinition, span);
    const block = decl.blockDeclaration();
    const alias = block?.aliasDeclaration();
    if (alias) {
      return { kind: "alias", span, name: alias.Identifier().getText() };
    }
    const simple = block?.simpleDeclaration();
    return simple ? CppHeaderLowering.simpleDeclaration(simple, span) : null;
  }

  private static functionDefinition(
    funcDef: FunctionDefinitionContext,
    span: ISourceSpan,
  ): ICppFunctionDefinitionSyntax {
    const declSpecSeq = funcDef.declSpecifierSeq();
    return {
      kind: "functionDefinition",
      span,
      returnType: declSpecSeq
        ? CppHeaderLowering.baseType(declSpecSeq)
        : "void",
      declarator: CppHeaderLowering.declarator(funcDef.declarator()),
    };
  }

  private static namespace(
    namespaceDefinition: NamespaceDefinitionContext,
    span: ISourceSpan,
  ): TCppDeclarationSyntax {
    return {
      kind: "namespace",
      span,
      name:
        namespaceDefinition.Identifier()?.getText() ??
        namespaceDefinition.originalNamespaceName()?.getText() ??
        null,
      declarations: CppHeaderLowering.declarations(
        namespaceDefinition.declarationseq()?.declaration() ?? [],
      ),
    };
  }

  private static simpleDeclaration(
    simple: SimpleDeclarationContext,
    span: ISourceSpan,
  ): TCppDeclarationSyntax | null {
    const declSpecSeq = simple.declSpecifierSeq();
    if (!declSpecSeq) return null;
    return {
      kind: "simple",
      span,
      baseType: CppHeaderLowering.baseType(declSpecSeq),
      isTypedef: declSpecSeq
        .declSpecifier()
        .some((spec) => spec.getText() === "typedef"),
      isVolatile: CppHeaderLowering.hasQualifier(declSpecSeq, "volatile"),
      typeSpecifiers: CppHeaderLowering.typeSpecifiers(declSpecSeq),
      declarators:
        simple
          .initDeclaratorList()
          ?.initDeclarator()
          .map((init) => CppHeaderLowering.declarator(init.declarator())) ??
        null,
    };
  }

  private static typeSpecifiers(
    declSpecSeq: DeclSpecifierSeqContext,
  ): TCppTypeSpecifierSyntax[] {
    const specs: TCppTypeSpecifierSyntax[] = [];
    for (const spec of declSpecSeq.declSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      const classSpec = typeSpec?.classSpecifier();
      if (classSpec) {
        specs.push({
          kind: "class",
          class: CppHeaderLowering.classSpecifier(classSpec),
        });
      }
      const enumSpec = typeSpec?.enumSpecifier();
      if (enumSpec) {
        specs.push({
          kind: "enum",
          enum: CppHeaderLowering.enumSpecifier(enumSpec),
        });
      }
    }
    return specs;
  }

  private static classSpecifier(
    classSpec: ClassSpecifierContext,
  ): ICppClassSyntax {
    const memberSpec = classSpec.memberSpecification();
    const head = classSpec.classHead();
    const decls = memberSpec?.memberdeclaration() ?? [];
    return {
      name: head.classHeadName()?.className().Identifier()?.getText() ?? null,
      members: memberSpec ? CppHeaderLowering.members(decls) : null,
      isUnion: head.Union() !== null,
      hasBase: head.baseClause() !== null,
      hasVirtual: decls.some(
        (decl) =>
          CppHeaderLowering.isVirtual(decl.declSpecifierSeq()) ||
          CppHeaderLowering.isVirtual(
            decl.functionDefinition()?.declSpecifierSeq() ?? null,
          ),
      ),
      hasBitField: decls.some((decl) =>
        (decl.memberDeclaratorList()?.memberDeclarator() ?? []).some(
          (member) => member.Colon() !== null,
        ),
      ),
      hasUnnamedMember: decls.some(
        (decl) =>
          decl.memberDeclaratorList() === null &&
          (decl.declSpecifierSeq()?.declSpecifier() ?? []).some(
            (spec) => spec.typeSpecifier()?.classSpecifier() != null,
          ),
      ),
    };
  }

  /** #1975 review: `uint32_t a : 3;`, whose name and width the class records */
  private static bitFieldDeclarator(
    name: string,
    width: string,
  ): IHeaderDeclaratorSyntax {
    return {
      name,
      isFunction: false,
      isVariadic: false,
      isConstMember: false,
      hasPointer: false,
      pointerDepth: 0,
      functionPointerParams: null,
      parameters: [],
      arrayDimensions: [],
      bitWidth: LiteralUtils.exactIntegerLiteral(width) ?? width,
    };
  }

  private static isVirtual(
    declSpecSeq: DeclSpecifierSeqContext | null,
  ): boolean {
    return (declSpecSeq?.declSpecifier() ?? []).some(
      (spec) => spec.functionSpecifier()?.Virtual() != null,
    );
  }

  private static isStatic(declSpecSeq: DeclSpecifierSeqContext): boolean {
    return declSpecSeq
      .declSpecifier()
      .some((spec) => spec.storageClassSpecifier()?.Static() != null);
  }

  /**
   * `memberSpecification` is `(memberdeclaration | accessSpecifier ':')+`;
   * the access labels are not lowered, so 1.3 records every member "public"
   * (#1475).
   */
  private static members(
    memberDecls: MemberdeclarationContext[],
  ): TCppMemberSyntax[] {
    const members: TCppMemberSyntax[] = [];
    for (const memberDecl of memberDecls) {
      const span = ParserUtils.getSpan(memberDecl);
      const funcDef = memberDecl.functionDefinition();
      if (funcDef) {
        members.push(CppHeaderLowering.functionDefinition(funcDef, span));
        continue;
      }
      const declSpecSeq = memberDecl.declSpecifierSeq();
      const list = memberDecl.memberDeclaratorList();
      if (!declSpecSeq || !list) continue;
      const declarators: IHeaderDeclaratorSyntax[] = [];
      for (const member of list.memberDeclarator()) {
        const declarator = member.declarator();
        const bitFieldName = member.Identifier()?.getText() ?? null;
        if (declarator) {
          declarators.push(CppHeaderLowering.declarator(declarator));
        } else if (bitFieldName !== null) {
          declarators.push(
            CppHeaderLowering.bitFieldDeclarator(
              bitFieldName,
              member.constantExpression()?.getText() ?? "",
            ),
          );
        }
      }
      members.push({
        kind: "declaration",
        span,
        fieldType: CppHeaderLowering.baseType(declSpecSeq),
        isStatic: CppHeaderLowering.isStatic(declSpecSeq),
        declarators,
      });
    }
    return members;
  }

  private static enumSpecifier(enumSpec: EnumSpecifierContext): ICppEnumSyntax {
    const head = enumSpec.enumHead();
    return {
      name: head.Identifier()?.getText() ?? null,
      baseType: head.enumbase()?.typeSpecifierSeq().getText() ?? null,
    };
  }

  private static declarator(
    declarator: DeclaratorContext,
  ): IHeaderDeclaratorSyntax {
    const pointer = declarator.pointerDeclarator();
    const noPointer = CppHeaderLowering.noPointer(declarator);
    const paramsAndQuals = noPointer?.parametersAndQualifiers() ?? null;
    return {
      name: noPointer ? CppHeaderLowering.noPointerName(noPointer) : null,
      isFunction: paramsAndQuals !== null,
      hasPointer: CppHeaderLowering.hasPointer(pointer),
      pointerDepth: pointer
        ? CppHeaderLowering.starCount(pointer.pointerOperator())
        : 0,
      functionPointerParams:
        paramsAndQuals && CppHeaderLowering.isFunctionPointer(declarator)
          ? paramsAndQuals.getText().slice(1, -1)
          : null,
      parameters: CppHeaderLowering.parameters(paramsAndQuals),
      isVariadic:
        (paramsAndQuals?.parameterDeclarationClause()?.Ellipsis() ?? null) !==
        null,
      isConstMember:
        paramsAndQuals?.cvqualifierseq()?.getText().includes("const") ?? false,
      arrayDimensions: noPointer
        ? ArrayDimensionText.parse(noPointer.getText())
        : [],
    };
  }

  private static noPointer(
    declarator: DeclaratorContext,
  ): NoPointerDeclaratorContext | null {
    return (
      declarator.pointerDeclarator()?.noPointerDeclarator() ??
      declarator.noPointerDeclarator()
    );
  }

  private static declaratorName(declarator: DeclaratorContext): string | null {
    const noPointer = CppHeaderLowering.noPointer(declarator);
    return noPointer ? CppHeaderLowering.noPointerName(noPointer) : null;
  }

  /**
   * A parenthesized pointer declarator, `(*readLevel)` in
   * `float (*readLevel)()`, holds its name inside it (#1760 review).
   */
  private static noPointerName(
    noPointer: NoPointerDeclaratorContext,
  ): string | null {
    const identifier = noPointer
      .declaratorid()
      ?.idExpression()
      .unqualifiedId()
      ?.Identifier();
    if (identifier) return identifier.getText();
    const inner = noPointer.noPointerDeclarator();
    if (inner) return CppHeaderLowering.noPointerName(inner);
    const innerPointer = noPointer.pointerDeclarator();
    return innerPointer
      ? CppHeaderLowering.noPointerName(innerPointer.noPointerDeclarator())
      : null;
  }

  private static hasPointer(pointer: PointerDeclaratorContext | null): boolean {
    return (
      pointer !== null &&
      (pointer.pointerOperator().length > 0 || pointer.getText().includes("*"))
    );
  }

  /**
   * A pointer to a function, `(*readLevel)()`: its parameters apply to a
   * parenthesized pointer declarator, where a function's apply to its name
   * (#1760 review).
   */
  private static isFunctionPointer(declarator: DeclaratorContext): boolean {
    const outer = declarator.pointerDeclarator()?.noPointerDeclarator();
    const inner = outer?.noPointerDeclarator()?.pointerDeclarator();
    return (
      outer?.parametersAndQualifiers() != null &&
      inner != null &&
      CppHeaderLowering.starCount(inner.pointerOperator()) > 0
    );
  }

  /** How many of a declarator's pointer operators are `*`, not `&` */
  private static starCount(operators: PointerOperatorContext[]): number {
    return operators.filter((op) => op.getText().startsWith("*")).length;
  }

  private static parameters(
    paramsAndQuals: ParametersAndQualifiersContext | null,
  ): IExtractedParameter[] {
    const clause = paramsAndQuals?.parameterDeclarationClause();
    if (!clause) return [];
    return ParameterExtractorUtils.processParameterList(
      clause.parameterDeclarationList(),
      (paramDecl: ParameterDeclarationContext) =>
        CppHeaderLowering.parameter(paramDecl),
    );
  }

  /**
   * As many `*`s as the declarator spells, as the C lowering keeps (#2058).
   * A reference adds none (#2062): its argument is passed as itself, where a
   * pointer takes its address. A pointer only the text shows is one.
   */
  private static parameter(
    parameterDeclaration: ParameterDeclarationContext,
  ): IExtractedParameter {
    const declarationSpecifiers = parameterDeclaration.declSpecifierSeq();
    const baseType = CppHeaderLowering.baseType(declarationSpecifiers);
    const declarator = parameterDeclaration.declarator();
    const abstractDeclarator = parameterDeclaration.abstractDeclarator();
    const operators =
      declarator?.pointerDeclarator()?.pointerOperator() ??
      abstractDeclarator?.pointerAbstractDeclarator()?.pointerOperator() ??
      [];
    const isReference = operators.some((operator) =>
      operator.getText().startsWith("&"),
    );
    const isPointer =
      (declarator !== null &&
        CppHeaderLowering.hasPointer(declarator.pointerDeclarator())) ||
      (abstractDeclarator !== null &&
        CppHeaderLowering.abstractHasPointer(abstractDeclarator));
    const depth = Math.max(
      CppHeaderLowering.starCount(operators),
      isPointer && !isReference ? 1 : 0,
    );
    const parameter = ParameterExtractorUtils.buildParameterInfo(
      declarator,
      DeclaratorTypes.withPointers(baseType, depth),
      CppHeaderLowering.hasQualifier(declarationSpecifiers, "const"),
      false,
      (candidate: DeclaratorContext) =>
        CppHeaderLowering.declaratorName(candidate),
    );
    return isReference ? { ...parameter, isReference } : parameter;
  }

  private static abstractHasPointer(
    abstractDecl: AbstractDeclaratorContext,
  ): boolean {
    return (
      (abstractDecl.pointerAbstractDeclarator()?.pointerOperator().length ??
        0) > 0 || abstractDecl.getText().includes("*")
    );
  }

  /**
   * Whether a cv-qualifier token is among the specifiers. The base type keeps
   * simple type specifiers alone, so it drops `volatile` (#1760 review), and
   * `getText()` joins tokens with no separator, so a substring test would read
   * `constants_t` as `const` (#1377).
   */
  private static hasQualifier(
    declSpecSeq: DeclSpecifierSeqContext,
    qualifier: "const" | "volatile",
  ): boolean {
    return declSpecSeq
      .declSpecifier()
      .some(
        (spec) =>
          spec
            .typeSpecifier()
            ?.trailingTypeSpecifier()
            ?.cvQualifier()
            ?.getText() === qualifier,
      );
  }

  private static baseType(declSpecSeq: DeclSpecifierSeqContext): string {
    const parts: string[] = [];
    for (const spec of declSpecSeq.declSpecifier()) {
      const simple = spec
        .typeSpecifier()
        ?.trailingTypeSpecifier()
        ?.simpleTypeSpecifier();
      if (simple) parts.push(simple.getText());
    }
    return parts.join(" ") || "int";
  }
}

export default CppHeaderLowering;
