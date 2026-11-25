/**
 * StructCollector - Collects struct and union symbols from C parse trees.
 */

import type TStructLayout from "../../../../types/TStructLayout";
import type ICFieldSyntax from "../../../2-Parse/types/ICFieldSyntax";
import type ICStructSyntax from "../../../2-Parse/types/ICStructSyntax";
import type ICStructSymbol from "../../../../types/symbols/c/ICStructSymbol";
import type ICFieldInfo from "../../../../types/symbols/c/ICFieldInfo";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import DeclaratorTypes from "../../../2-Parse/shared/DeclaratorTypes";
import type ISourceSpan from "../../../../types/ISourceSpan";

/**
 * Options for struct collection.
 * Consolidates optional parameters to avoid exceeding 7-parameter limit.
 */
interface ICollectOptions {
  /** Optional typedef name for anonymous structs */
  typedefName?: string;
  /** Whether this is part of a typedef declaration */
  isTypedef?: boolean;
  /** Array to collect warnings */
  warnings?: string[];
  /** Issue #957: True if typedef has pointer declarator (typedef struct X *Y) */
  isPointerTypedef?: boolean;
}

/** Options for symbol table updates */
interface IUpdateOptions {
  needsStructKeyword: boolean;
  hasBody: boolean;
  isTypedef?: boolean;
  typedefName?: string;
  structTag?: string;
  /** Issue #957: True if typedef has pointer declarator */
  isPointerTypedef?: boolean;
}

class StructCollector {
  /**
   * Collect a struct or union symbol from a specifier context.
   *
   * @param structSpec The struct/union specifier context
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param symbolTable Optional symbol table for field tracking
   * @param options Optional collection options (typedef info, warnings)
   */
  static collect(
    structSpec: ICStructSyntax,
    sourceFile: string,
    span: ISourceSpan,
    symbolTable: SymbolTable | null,
    options: ICollectOptions = {},
  ): ICStructSymbol | null {
    const { typedefName, isTypedef, warnings, isPointerTypedef } = options;
    const tag = structSpec.tag;

    // Use typedef name for anonymous structs (e.g., typedef struct { ... } AppConfig;)
    const name = tag || typedefName;
    if (!name) return null; // Skip if no name available

    const isUnion = structSpec.isUnion;

    // Issue #948: Detect forward declaration (struct with no body)
    const hasBody = structSpec.hasBody;

    // Extract fields if struct has a body
    const fields = StructCollector.collectFields(
      structSpec,
      name,
      sourceFile,
      symbolTable,
      warnings,
    );

    // Mark named structs that are not typedef'd - they need 'struct' keyword
    // Example: "struct NamedPoint { ... };" -> needs "struct NamedPoint var"
    // But "typedef struct { ... } Rectangle;" -> just "Rectangle var"
    const needsStructKeyword = Boolean(tag && !isTypedef);

    if (symbolTable) {
      StructCollector.updateSymbolTable(symbolTable, name, {
        needsStructKeyword,
        hasBody,
        isTypedef,
        typedefName,
        structTag: tag ?? undefined,
        isPointerTypedef,
      });
    }

    return {
      kind: "struct",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      isUnion,
      needsStructKeyword,
      fields: fields.size > 0 ? fields : undefined,
    };
  }

  /**
   * Update symbol table with struct metadata.
   * Extracted to reduce cognitive complexity of collect().
   */
  private static updateSymbolTable(
    symbolTable: SymbolTable,
    name: string,
    options: IUpdateOptions,
  ): void {
    const {
      needsStructKeyword,
      hasBody,
      isTypedef,
      typedefName,
      structTag,
      isPointerTypedef,
    } = options;

    if (needsStructKeyword) {
      symbolTable.markNeedsStructKeyword(name);
    }

    // Issue #957/#1164: a pointer typedef is not opaque, but the header still
    // must not forward-declare it as a struct. Record it rather than only
    // branching on it below.
    if (isTypedef && typedefName && isPointerTypedef) {
      symbolTable.markPointerTypedef(typedefName);
    }

    // Issue #948/#958: a typedef declared against a forward-declared struct
    // -- the one handle mark (ADR-030). Such a type is held through a pointer
    // (ADR-006) unless a body arrives for its tag, which `OpaqueTypeResolution`
    // decides. Inline typedefs with bodies (typedef struct { ... } X;) are
    // concrete value types. Issue #957: a pointer typedef
    // ("typedef struct X *Y") is already a pointer, not a handle.
    if (isTypedef && !hasBody && typedefName && !isPointerTypedef) {
      symbolTable.markOpaqueType(typedefName);
    }

    // #2103: with or without a body, `typedef struct _w {...} w;` names one
    // type twice, and a C pointer argument check compares by that identity
    if (isTypedef && typedefName && structTag && !isPointerTypedef) {
      symbolTable.registerStructTagAlias(structTag, typedefName);
    }

    // Issue #958: Record struct tag body for query-time opaque resolution
    if (hasBody && structTag) {
      symbolTable.markStructTagHasBody(structTag);
    }
  }

  private static collectFields(
    structSpec: ICStructSyntax,
    structName: string,
    sourceFile: string,
    symbolTable: SymbolTable | null,
    warnings?: string[],
  ): ReadonlyMap<string, ICFieldInfo> {
    const fields = new Map<string, ICFieldInfo>();
    for (const field of structSpec.fields) {
      StructCollector.processField(
        field,
        structName,
        sourceFile,
        fields,
        symbolTable,
        warnings,
      );
    }
    const layout = StructCollector.layoutOf(structSpec);
    if (symbolTable && layout !== null) {
      symbolTable.setStructLayout(structName, layout);
    }
    return fields;
  }

  /** Why a struct's fields do not sum to its length, or null when they do */
  private static layoutOf(structSpec: ICStructSyntax): TStructLayout | null {
    if (structSpec.isUnion) return "union";
    if (structSpec.hasBitField) return "bit-packed";
    return structSpec.hasUnnamedMember ? "unrecorded-member" : null;
  }

  private static processField(
    field: ICFieldSyntax,
    structName: string,
    sourceFile: string,
    fields: Map<string, ICFieldInfo>,
    symbolTable: SymbolTable | null,
    warnings?: string[],
  ): void {
    const fieldName = field.declarator.name;
    if (!fieldName) return;
    if (warnings && SymbolUtils.isReservedFieldName(fieldName)) {
      warnings.push(
        SymbolUtils.getReservedFieldWarning("C", structName, fieldName),
      );
    }
    const arrayDimensions = field.declarator.arrayDimensions;
    const declaredType = DeclaratorTypes.declaredType(
      field.type,
      field.declarator,
    );
    const dims = arrayDimensions.length > 0 ? [...arrayDimensions] : undefined;
    const bitWidth = field.declarator.bitWidth;
    fields.set(fieldName, {
      name: fieldName,
      type: declaredType,
      arrayDimensions: dims,
      ...(bitWidth !== undefined && { bitWidth }),
    });
    if (symbolTable) {
      symbolTable.addStructField(
        structName,
        fieldName,
        declaredType,
        dims,
        bitWidth,
        sourceFile,
      );
    }
  }
}

export default StructCollector;
