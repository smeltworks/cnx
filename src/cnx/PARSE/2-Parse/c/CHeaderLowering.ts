/**
 * 1.2: a C header's tree, turned into the plain data 1.3 declares from
 * (#1991: the tree never leaves 1.2).
 */
import type {
  CompilationUnitContext,
  DeclarationContext,
  DeclarationSpecifiersContext,
  DeclaratorContext,
  EnumSpecifierContext,
  FunctionDefinitionContext,
  ParameterDeclarationContext,
  SpecifierQualifierListContext,
  StructDeclarationContext,
  StructDeclaratorContext,
  StructOrUnionSpecifierContext,
  TypeSpecifierContext,
} from "./grammar/CParser";
import { DirectDeclaratorContext } from "./grammar/CParser";
import type ICHeaderSyntax from "../types/ICHeaderSyntax";
import type IHeaderDeclaratorSyntax from "../types/IHeaderDeclaratorSyntax";
import type ICEnumSyntax from "../types/ICEnumSyntax";
import type ICFieldSyntax from "../types/ICFieldSyntax";
import type ICStructSyntax from "../types/ICStructSyntax";
import type ICTypeSpecifierSyntax from "../types/ICTypeSpecifierSyntax";
import type TCExternalDeclarationSyntax from "../types/TCExternalDeclarationSyntax";
import type IExtractedParameter from "../shared/IExtractedParameter";
import ParameterExtractorUtils from "../shared/ParameterExtractorUtils";
import DeclaratorTypes from "../shared/DeclaratorTypes";
import ArrayDimensionText from "../../../utils/ArrayDimensionText";
import LiteralUtils from "../../../utils/LiteralUtils";
import ParserUtils from "../../../utils/ParserUtils";

/** `DeclarationSpecifiersContext` and `DeclarationSpecifiers2Context` alike */
interface IQualifiedSpecifiers {
  declarationSpecifier(): ReadonlyArray<{
    typeQualifier(): { getText(): string } | null;
  }>;
}

class CHeaderLowering {
  static header(
    tree: CompilationUnitContext,
  ): Omit<ICHeaderSyntax, "undefinedMacros"> {
    const declarations: TCExternalDeclarationSyntax[] = [];
    for (const externalDeclaration of tree
      .translationUnit()
      ?.externalDeclaration() ?? []) {
      const functionDefinition = externalDeclaration.functionDefinition();
      if (functionDefinition) {
        declarations.push(
          CHeaderLowering.functionDefinition(functionDefinition),
        );
        continue;
      }
      const decl = externalDeclaration.declaration();
      const lowered = decl ? CHeaderLowering.declaration(decl) : null;
      if (lowered) declarations.push(lowered);
    }
    return { declarations };
  }

  private static functionDefinition(
    functionDefinition: FunctionDefinitionContext,
  ): TCExternalDeclarationSyntax {
    const declarationSpecifiers = functionDefinition.declarationSpecifiers();
    const declarator = functionDefinition.declarator();
    return {
      kind: "functionDefinition",
      span: ParserUtils.getSpan(functionDefinition),
      typeSpecifiers: declarationSpecifiers
        ? CHeaderLowering.typeSpecifiers(declarationSpecifiers)
        : [],
      declarator: declarator ? CHeaderLowering.declarator(declarator) : null,
    };
  }

  private static declaration(
    decl: DeclarationContext,
  ): TCExternalDeclarationSyntax | null {
    const declarationSpecifiers = decl.declarationSpecifiers();
    if (!declarationSpecifiers) return null;
    const specs = declarationSpecifiers.declarationSpecifier();
    const typeSpecs = specs.flatMap((spec) => spec.typeSpecifier() ?? []);
    const structSpec = typeSpecs
      .find((t) => t.structOrUnionSpecifier())
      ?.structOrUnionSpecifier();
    const enumSpec = typeSpecs.find((t) => t.enumSpecifier())?.enumSpecifier();
    const span = ParserUtils.getSpan(decl);
    const initDeclaratorList = decl.initDeclaratorList();
    return {
      kind: "declaration",
      span,
      isTypedef: CHeaderLowering.hasStorageClass(
        declarationSpecifiers,
        "typedef",
      ),
      isExtern: CHeaderLowering.hasStorageClass(
        declarationSpecifiers,
        "extern",
      ),
      isVolatile: CHeaderLowering.hasQualifier(
        declarationSpecifiers,
        "volatile",
      ),
      isConst: CHeaderLowering.hasQualifier(declarationSpecifiers, "const"),
      typeSpecifiers: CHeaderLowering.typeSpecifiers(declarationSpecifiers),
      struct: structSpec ? CHeaderLowering.struct(structSpec) : null,
      enum: enumSpec ? CHeaderLowering.enum(enumSpec) : null,
      declarators: initDeclaratorList
        ? initDeclaratorList.initDeclarator().flatMap((initDeclarator) => {
            const declarator = initDeclarator.declarator();
            const lowered = declarator
              ? CHeaderLowering.declarator(declarator)
              : null;
            return lowered ? [lowered] : [];
          })
        : null,
    };
  }

  /**
   * Whether a type qualifier token is among the specifiers. `getText()` joins
   * tokens with no separator, so a substring test would read `constraint_t`
   * as `const` and `nonvolatile_cfg_t` as `volatile`.
   */
  private static hasQualifier(
    specifiers: IQualifiedSpecifiers,
    qualifier: string,
  ): boolean {
    return specifiers
      .declarationSpecifier()
      .some((spec) => spec.typeQualifier()?.getText() === qualifier);
  }

  private static hasStorageClass(
    declarationSpecifiers: DeclarationSpecifiersContext,
    storage: string,
  ): boolean {
    return declarationSpecifiers
      .declarationSpecifier()
      .some((spec) => spec.storageClassSpecifier()?.getText() === storage);
  }

  private static typeSpecifiers(
    declarationSpecifiers: Pick<
      DeclarationSpecifiersContext,
      "declarationSpecifier"
    >,
  ): ICTypeSpecifierSyntax[] {
    return declarationSpecifiers.declarationSpecifier().flatMap((spec) => {
      const typeSpec = spec.typeSpecifier();
      if (!typeSpec) return [];
      return [
        {
          text: CHeaderLowering.typeSpecifierText(typeSpec),
          typedefName: typeSpec.typedefName()?.getText() ?? null,
        },
      ];
    });
  }

  /**
   * A declarator, or null for one error recovery left without its direct
   * declarator (an unpreprocessed `#ifdef` branch's `int a, 8[2];`): only that
   * declarator is skipped, not the header
   */
  private static declarator(
    declarator: DeclaratorContext,
  ): IHeaderDeclaratorSyntax | null {
    const directDeclarator = CHeaderLowering.directDeclaratorOf(declarator);
    if (directDeclarator === null) return null;
    const hasParams =
      directDeclarator.parameterTypeList() !== null ||
      directDeclarator.LeftParen() !== null;
    const isFunctionPointer =
      hasParams &&
      (directDeclarator.directDeclarator()?.declarator()?.pointer() ?? null) !==
        null;
    return {
      name: CHeaderLowering.declaratorName(declarator),
      isFunction: hasParams,
      hasPointer: declarator.pointer() !== null,
      pointerDepth: CHeaderLowering.pointerDepth(declarator),
      functionPointerParams: isFunctionPointer
        ? (directDeclarator.parameterTypeList()?.getText() ?? "")
        : null,
      parameters: CHeaderLowering.parameters(declarator),
      // `parameterList ',' '...'`: the ellipsis has no accessor of its own
      isVariadic:
        (directDeclarator.parameterTypeList()?.getChildCount() ?? 0) > 1,
      ...(hasParams &&
        directDeclarator.parameterTypeList() === null && {
          isUnprototyped: true,
        }),
      isConstMember: false,
      arrayDimensions: ArrayDimensionText.parse(directDeclarator.getText()),
    };
  }

  /** The generated accessor claims non-null; a recovery tree breaks that */
  private static directDeclaratorOf(
    declarator: DeclaratorContext | null,
  ): DirectDeclaratorContext | null {
    return declarator?.getRuleContext(0, DirectDeclaratorContext) ?? null;
  }

  /** The `*`s a declarator's pointer spells */
  private static pointerDepth(declarator: DeclaratorContext | null): number {
    return (declarator?.pointer()?.getText() ?? "").split("*").length - 1;
  }

  private static declaratorName(
    declarator: DeclaratorContext | null,
  ): string | null {
    let directDeclarator = declarator?.directDeclarator() ?? null;
    while (directDeclarator) {
      const identifier = directDeclarator.Identifier();
      if (identifier) return identifier.getText();
      const nested = directDeclarator.declarator();
      if (nested) return CHeaderLowering.declaratorName(nested);
      directDeclarator = directDeclarator.directDeclarator();
    }
    return null;
  }

  private static parameters(
    declarator: DeclaratorContext,
  ): IExtractedParameter[] {
    const parameterList = CHeaderLowering.directDeclaratorOf(declarator)
      ?.parameterTypeList()
      ?.parameterList();
    if (!parameterList) return [];
    return ParameterExtractorUtils.processParameterList(
      parameterList,
      CHeaderLowering.parameter,
    );
  }

  private static parameter(
    parameterDeclaration: ParameterDeclarationContext,
  ): IExtractedParameter | null {
    const declarationSpecifiers = parameterDeclaration.declarationSpecifiers();
    if (!declarationSpecifiers) {
      return CHeaderLowering.unnamedParameter(parameterDeclaration);
    }
    const declarator = parameterDeclaration.declarator();
    const directText =
      CHeaderLowering.directDeclaratorOf(declarator)?.getText() ?? "";
    return {
      ...ParameterExtractorUtils.buildParameterInfo(
        declarator,
        ...CHeaderLowering.parameterShape(
          declarationSpecifiers,
          CHeaderLowering.typeSpecifiers(declarationSpecifiers),
          declarator?.pointer() ?? null,
          directText,
        ),
        CHeaderLowering.declaratorName,
      ),
      ...CHeaderLowering.declaratorExtras(
        CHeaderLowering.hasQualifier(declarationSpecifiers, "volatile"),
        directText,
      ),
    };
  }

  /**
   * `char *fgets(char *restrict, int, FILE *restrict)`: a parameter with no name
   * (newlib spells its prototypes that way) is still a parameter. `(void)` is none.
   */
  private static unnamedParameter(
    parameterDeclaration: ParameterDeclarationContext,
  ): IExtractedParameter | null {
    const specifiers = parameterDeclaration.declarationSpecifiers2();
    if (!specifiers) return null;
    const abstract = parameterDeclaration.abstractDeclarator();
    const typeSpecifiers = CHeaderLowering.typeSpecifiers(specifiers);
    if (
      abstract === null &&
      DeclaratorTypes.baseType(typeSpecifiers) === "void"
    ) {
      return null;
    }
    const directText = abstract?.directAbstractDeclarator()?.getText() ?? "";
    const shape = CHeaderLowering.parameterShape(
      specifiers,
      typeSpecifiers,
      abstract?.pointer() ?? null,
      directText,
    );
    return {
      name: "",
      type: shape[0],
      isConst: shape[1],
      isArray: shape[2],
      ...CHeaderLowering.declaratorExtras(
        CHeaderLowering.hasQualifier(specifiers, "volatile"),
        directText,
      ),
    };
  }

  /**
   * A parameter's type, constness and array-ness, named or not (#2103
   * review): the `*`s of its own pointer -- not a nested one, which makes it
   * a pointer to a function or an array -- and a `[...]` after it. One
   * lowering, so `T (*rows)[4]` and `T (*)[4]` lower alike.
   */
  private static parameterShape(
    specifiers: IQualifiedSpecifiers,
    typeSpecifiers: readonly ICTypeSpecifierSyntax[],
    pointer: { getText(): string } | null,
    directText: string,
  ): [type: string, isConst: boolean, isArray: boolean] {
    return [
      DeclaratorTypes.withPointers(
        DeclaratorTypes.baseType(typeSpecifiers),
        (pointer?.getText() ?? "").split("*").length - 1,
      ),
      CHeaderLowering.hasQualifier(specifiers, "const"),
      directText.includes("[") && directText.includes("]"),
    ];
  }

  /**
   * #1619: what a parameter's type string cannot carry -- a `volatile`
   * pointee, each `[...]` of an array, and whether the declarator nests (`(*f)(void)`, `(*rows)[4]`,
   * `f(void)`), which makes it a pointer to a function or to an array.
   */
  private static declaratorExtras(
    isVolatile: boolean,
    directText: string,
  ): {
    arrayDimensions?: string[];
    isNestedDeclarator?: true;
    isVolatile?: true;
  } {
    const qualifiers = isVolatile ? { isVolatile: true as const } : {};
    if (directText.includes("(")) {
      return { ...qualifiers, isNestedDeclarator: true };
    }
    const open = directText.indexOf("[");
    if (open < 0) return qualifiers;
    // `[4][8]` splits on `]` to `[4`, `[8`, and a trailing empty part
    const dimensions = directText
      .slice(open)
      .split("]")
      .filter((part) => part.startsWith("["))
      .map((part) => part.slice(1));
    return { ...qualifiers, arrayDimensions: dimensions };
  }

  private static struct(
    structSpec: StructOrUnionSpecifierContext,
  ): ICStructSyntax {
    const declList = structSpec.structDeclarationList();
    const decls = declList?.structDeclaration() ?? [];
    return {
      tag: structSpec.Identifier()?.getText() ?? null,
      isUnion: structSpec.structOrUnion()?.getText() === "union",
      hasBody: declList !== null,
      hasBitField: decls.some((decl) =>
        (decl.structDeclaratorList()?.structDeclarator() ?? []).some(
          (structDecl) => structDecl.Colon() !== null,
        ),
      ),
      hasUnnamedMember: decls.some(CHeaderLowering.isUnnamedMember),
      fields: decls.flatMap((decl) => CHeaderLowering.fields(decl)),
    };
  }

  private static fields(decl: StructDeclarationContext): ICFieldSyntax[] {
    const specifierQualifierList = decl.specifierQualifierList();
    const declaratorList = decl.structDeclaratorList();
    if (!specifierQualifierList || !declaratorList) return [];
    const misread = CHeaderLowering.misreadFieldName(specifierQualifierList);
    const type = CHeaderLowering.specifierQualifierText(
      specifierQualifierList,
      misread !== null,
    );
    return declaratorList.structDeclarator().flatMap((structDecl) => {
      const declarator = structDecl.declarator();
      let lowered = declarator ? CHeaderLowering.declarator(declarator) : null;
      if (lowered === null && misread !== null) {
        lowered = CHeaderLowering.nameDeclarator(misread);
      }
      const width = structDecl.constantExpression()?.getText();
      if (lowered && width !== undefined) {
        lowered = {
          ...lowered,
          bitWidth: LiteralUtils.cIntegerLiteral(width) ?? width,
        };
      }
      return lowered ? [{ type, declarator: lowered }] : [];
    });
  }

  /** #1975 review: `union { ... };`, a member with no declarator */
  private static isUnnamedMember(decl: StructDeclarationContext): boolean {
    if (decl.structDeclaratorList() !== null) return false;
    let current = decl.specifierQualifierList();
    while (current) {
      if (current.typeSpecifier()?.structOrUnionSpecifier()) return true;
      current = current.specifierQualifierList();
    }
    return false;
  }

  /**
   * #1975 review: in `uint32_t a : 3;` the grammar reads `a` as a second type
   * (a typedef name) and the bit-field as unnamed. A typedef name is the only
   * type specifier a declaration may have (C11 6.7.2), so one that follows
   * another names the field.
   */
  private static misreadFieldName(
    list: SpecifierQualifierListContext,
  ): string | null {
    const types: TypeSpecifierContext[] = [];
    let current: SpecifierQualifierListContext | null = list;
    while (current) {
      const typeSpec = current.typeSpecifier();
      if (typeSpec) types.push(typeSpec);
      current = current.specifierQualifierList();
    }
    const last = types.at(-1)?.typedefName() ?? null;
    return types.length > 1 && last !== null ? last.getText() : null;
  }

  private static nameDeclarator(name: string): IHeaderDeclaratorSyntax {
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
    };
  }

  private static enum(enumSpec: EnumSpecifierContext): ICEnumSyntax {
    return {
      name: enumSpec.Identifier()?.getText() ?? null,
      members: (enumSpec.enumeratorList()?.enumerator() ?? []).flatMap(
        (enumerator) => {
          const name = enumerator
            .enumerationConstant()
            ?.Identifier()
            ?.getText();
          return name ? [{ name, span: ParserUtils.getSpan(enumerator) }] : [];
        },
      ),
    };
  }

  /** A type specifier as C reads it; an anonymous struct is rebuilt spaced */
  private static typeSpecifierText(typeSpec: TypeSpecifierContext): string {
    const structSpec = typeSpec.structOrUnionSpecifier();
    if (structSpec) {
      const identifier = structSpec.Identifier();
      return identifier
        ? identifier.getText()
        : CHeaderLowering.anonymousStructText(structSpec);
    }
    const enumSpec = typeSpec.enumSpecifier();
    if (enumSpec) {
      const identifier = enumSpec.Identifier();
      return identifier
        ? `enum ${identifier.getText()}`
        : `enum ${enumSpec.getText().replace(/^enum/, "")}`;
    }
    return typeSpec.getText();
  }

  private static specifierQualifierText(
    specifierQualifierList: SpecifierQualifierListContext,
    dropLastType = false,
  ): string {
    const parts: string[] = [];
    let current: SpecifierQualifierListContext | null = specifierQualifierList;
    while (current) {
      const typeSpec = current.typeSpecifier();
      const isLastType =
        dropLastType &&
        typeSpec !== null &&
        !CHeaderLowering.hasLaterType(current.specifierQualifierList());
      if (typeSpec && !isLastType) {
        parts.push(CHeaderLowering.typeSpecifierText(typeSpec));
      }
      const typeQualifier = current.typeQualifier();
      if (typeQualifier) parts.push(typeQualifier.getText());
      current = current.specifierQualifierList();
    }
    return parts.join(" ") || "int";
  }

  private static hasLaterType(
    list: SpecifierQualifierListContext | null,
  ): boolean {
    for (let at = list; at; at = at.specifierQualifierList()) {
      if (at.typeSpecifier()) return true;
    }
    return false;
  }

  private static anonymousStructText(
    structSpec: StructOrUnionSpecifierContext,
  ): string {
    const keyword = structSpec.structOrUnion().Struct() ? "struct" : "union";
    const declList = structSpec.structDeclarationList();
    if (!declList) return `${keyword} { }`;
    const fields = declList
      .structDeclaration()
      .flatMap((decl) => CHeaderLowering.anonymousFieldText(decl) ?? [])
      .join(" ");
    return `${keyword} { ${fields} }`;
  }

  private static anonymousFieldText(
    decl: StructDeclarationContext,
  ): string | null {
    const specifierQualifierList = decl.specifierQualifierList();
    if (!specifierQualifierList) return null;
    const baseType = CHeaderLowering.specifierQualifierText(
      specifierQualifierList,
    );
    const declarators = (
      decl.structDeclaratorList()?.structDeclarator() ?? []
    ).flatMap(
      (structDecl) => CHeaderLowering.anonymousDeclaratorText(structDecl) ?? [],
    );
    return declarators.length === 0
      ? `${baseType};`
      : `${baseType} ${declarators.join(", ")};`;
  }

  private static anonymousDeclaratorText(
    structDecl: StructDeclaratorContext,
  ): string | null {
    const name = CHeaderLowering.declaratorName(structDecl.declarator()) ?? "";
    const width = structDecl.constantExpression();
    if (structDecl.Colon() !== null && width) {
      return `${name}: ${width.getText()}`;
    }
    return name || null;
  }
}

export default CHeaderLowering;
