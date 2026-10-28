/**
 * Header Generator Utilities
 *
 * Pure utility functions for header generation, shared by both
 * CHeaderGenerator and CppHeaderGenerator.
 */

import DeclaredPointer from "../../../utils/DeclaredPointer";
import IHeaderSymbol from "./types/IHeaderSymbol";
import GeneratedBanner from "../../../utils/GeneratedBanner";
import typeUtils from "../../../utils/mapType";
import IGroupedSymbols from "./types/IGroupedSymbols";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import generateEnumHeader from "./generators/generateEnumHeader";
import generateStructHeader from "./generators/generateStructHeader";
import generateBitmapHeader from "./generators/generateBitmapHeader";
import VariableDeclarationFormatter from "../codegen/helpers/VariableDeclarationFormatter";
import type IVariableFormatInput from "../codegen/types/IVariableFormatInput";
import MisraSuppressionUtils from "../MisraSuppressionUtils";
import CallbackTypedefFormatter from "../../../utils/CallbackTypedefFormatter";

const { mapType, isBuiltInType } = typeUtils;

/**
 * Static utility class with pure functions for header generation
 */
class HeaderGeneratorUtils {
  /**
   * Create an include guard macro from a source path (ADR-063, issue #1133).
   *
   * The identity is the path RELATIVE TO THE PROJECT ROOT, not the basename.
   * Keying on the basename made can/config.cnx and uart/config.cnx share
   * CONFIG_H, so a translation unit including both had the second silently
   * skipped by the preprocessor — one warning, wrong runtime value, exit 0.
   * The caller supplies that path; see IncludeGuards.identity, which anchors
   * on the project root so the guard does not depend on which entry point
   * pulled the file in.
   *
   * The CNX_ prefix is the reserved transpiler namespace (ADR-063 part 2), which
   * is what stops a user constant whose name happens to equal a guard from
   * erasing it.
   *
   * NOTE: this is deliberately NOT injective. Conversion to upper case is a
   * lossy map, so `mod-a.cnx` and `mod_a.cnx` both land on CNX_MOD_A_H, as do
   * filenames differing only by case. ADR-063 handles that residue with the
   * E0203 diagnostic rather than appending a hash or escape-encoding the path,
   * both of which would trade away the readability of the generated artifact.
   * Callers MUST run the collision check — see
   * IncludeGuards.collisions.
   *
   * @param sourcePath - Path relative to the project root, e.g. "src/can/config.cnx"
   * @returns The include guard macro, e.g. "CNX_SRC_CAN_CONFIG_H"
   */
  static makeGuard(sourcePath: string): string {
    const normalized = sourcePath.replaceAll("\\", "/").replace(/^\.\//, "");
    const withoutExtension = normalized.replace(/\.[^./]+$/, "");
    const sanitized = withoutExtension
      .toUpperCase()
      .replaceAll(/[^A-Z0-9]/g, "_");

    return `CNX_${sanitized}_H`;
  }

  /**
   * Group symbols by their kind for organized header output
   */
  static groupSymbolsByKind(symbols: IHeaderSymbol[]): IGroupedSymbols {
    return {
      structs: symbols.filter((s) => s.kind === "struct"),
      classes: symbols.filter((s) => s.kind === "class"),
      functions: symbols.filter((s) => s.kind === "function"),
      variables: symbols.filter((s) => s.kind === "variable"),
      enums: symbols.filter((s) => s.kind === "enum"),
      types: symbols.filter((s) => s.kind === "type"),
      bitmaps: symbols.filter((s) => s.kind === "bitmap"),
    };
  }

  /**
   * Extract the base type from a type string, removing pointers, arrays, and const
   */
  static extractBaseType(type: string): string {
    // Remove pointer suffix
    // Scanned rather than /\*+$/, which backtracks super-linearly on a long
    // run of '*' (S8786).
    let end = type.length;
    while (end > 0 && type[end - 1] === "*") {
      end -= 1;
    }
    let baseType = type.slice(0, end).trim();

    // Remove array brackets
    baseType = baseType.replace(/\[\d*\]$/, "").trim();

    // Handle const prefix
    baseType = baseType.replace(/^const\s+/, "").trim();

    return baseType;
  }

  /**
   * Check if a type is a C++ template type (excluding cnx string<N>)
   */
  static isCppTemplateType(type: string | undefined): boolean {
    if (!type) return false;
    // cnx string<N> types are allowed (string followed by <digits>)
    if (/^string<\d+>$/.test(type)) return false;
    // Any other <> is a C++ template
    return type.includes("<") || type.includes(">");
  }

  /**
   * Collect external type dependencies from function signatures and variables
   * Returns types that are:
   * - Not primitive types (not in TYPE_MAP)
   * - Not locally defined structs, enums, bitmaps, or type aliases
   * - Not cross-file enums (which can't be forward-declared as structs)
   */
  static collectExternalTypes(
    functions: IHeaderSymbol[],
    variables: IHeaderSymbol[],
    localStructs: Set<string>,
    localEnums: Set<string>,
    localTypes: Set<string>,
    localBitmaps: Set<string>,
    allKnownEnums?: ReadonlySet<string>,
  ): Set<string> {
    const externalTypes = new Set<string>();

    // Combine all local types for efficient lookup
    const localTypeSets = [localStructs, localEnums, localTypes, localBitmaps];

    const isLocalType = (name: string): boolean =>
      localTypeSets.some((set) => set.has(name));

    const isExternalType = (typeName: string): boolean => {
      // Skip empty, pointer markers, built-ins, and namespaced types
      if (!typeName || typeName === "*" || isBuiltInType(typeName)) {
        return false;
      }
      if (typeName.includes("::")) {
        return false;
      }
      // Skip locally defined types and cross-file enums
      if (isLocalType(typeName) || allKnownEnums?.has(typeName)) {
        return false;
      }
      return true;
    };

    const addIfExternal = (type: string | undefined): void => {
      if (!type) return;
      const baseType = HeaderGeneratorUtils.extractBaseType(type);
      if (isExternalType(baseType)) {
        externalTypes.add(baseType);
      }
    };

    // Check function return types and parameters
    for (const fn of functions) {
      addIfExternal(fn.type);
      for (const param of fn.parameters ?? []) {
        addIfExternal(param.type);
      }
    }

    // Check variable types
    for (const v of variables) {
      addIfExternal(v.type);
    }

    return externalTypes;
  }

  /**
   * Filter external types to those that are C-compatible (can be forward-declared)
   * Excludes C++ templates and namespaced types. A C++ namespaced type arrives
   * as `Ns::T`, the spelling 1.3 stored (#2116).
   */
  static filterCCompatibleTypes(
    externalTypes: Set<string>,
    typesWithHeaders: Set<string>,
  ): string[] {
    return [...externalTypes].filter(
      (t) =>
        !typesWithHeaders.has(t) &&
        !t.includes("<") &&
        !t.includes(">") &&
        !t.includes("::") &&
        !t.includes("."),
    );
  }

  /**
   * Filter variables to those that are C-compatible
   * Excludes C++ templates and namespaced types, which arrive as `Ns::T` (#2116)
   */
  static filterCCompatibleVariables(
    variables: IHeaderSymbol[],
  ): IHeaderSymbol[] {
    return variables.filter(
      (v) =>
        !v.type?.includes("::") &&
        !v.type?.includes(".") &&
        !HeaderGeneratorUtils.isCppTemplateType(v.type),
    );
  }

  /**
   * Build headers to include from external type header mappings
   */
  static buildExternalTypeIncludes(
    externalTypes: Set<string>,
    externalTypeHeaders?: ReadonlyMap<string, string>,
  ): { typesWithHeaders: Set<string>; headersToInclude: Set<string> } {
    const typesWithHeaders = new Set<string>();
    const headersToInclude = new Set<string>();

    if (externalTypeHeaders) {
      for (const typeName of externalTypes) {
        const directive = externalTypeHeaders.get(typeName);
        if (directive) {
          typesWithHeaders.add(typeName);
          headersToInclude.add(directive);
        }
      }
    }

    return { typesWithHeaders, headersToInclude };
  }

  /**
   * Get local type names from grouped symbols
   */
  static getLocalTypeNames(groups: IGroupedSymbols): {
    localStructNames: Set<string>;
    localEnumNames: Set<string>;
    localTypeNames: Set<string>;
    localBitmapNames: Set<string>;
  } {
    return {
      localStructNames: new Set(groups.structs.map((s) => s.name)),
      localEnumNames: new Set(groups.enums.map((s) => s.name)),
      localTypeNames: new Set(groups.types.map((s) => s.name)),
      localBitmapNames: new Set(groups.bitmaps.map((s) => s.name)),
    };
  }

  // =========================================================================
  // Section Generators - Extract complexity from CHeaderGenerator/CppHeaderGenerator
  // =========================================================================

  /**
   * Generate header guard opening and file comment
   */
  static generateHeaderStart(guard: string, sourcePath?: string): string[] {
    return [
      `#ifndef ${guard}`,
      `#define ${guard}`,
      "",
      "/**",
      GeneratedBanner.line(sourcePath),
      " * Header file for cross-language interoperability",
      " */",
      "",
    ];
  }

  /**
   * The header a directive names, for deduplication: the path inside the
   * delimiters, without leading `./` or `../` segments and without a `.h` or
   * `.hpp` extension. E.g., '#include "../foo/bar.hpp"' -> 'foo/bar'.
   *
   * The directories stay (#1435). Keyed on the basename, `<driver/uart.h>`
   * was the generated "uart.h" of uart.cnx and was dropped, taking the only
   * definition of the vendor types a signature named with it.
   * SonarCloud S8786: Avoid backtracking by using separate patterns.
   */
  private static extractIncludeStem(include: string): string {
    // Try angle brackets first, then quotes - avoids backtracking regex
    const target =
      /<([^<>]+)>/.exec(include)?.[1] ?? /"([^"]+)"/.exec(include)?.[1];
    if (target === undefined) {
      return include;
    }
    return target.replace(/^(?:\.\.?\/)+/, "").replace(/\.(?:h|hpp)$/, "");
  }

  /**
   * Add user includes with MISRA suppression comments.
   * SonarCloud S3776: Extracted from generateIncludes.
   */
  private static addUserIncludes(
    lines: string[],
    userIncludes: string[] | undefined,
  ): void {
    if (!userIncludes || userIncludes.length === 0) return;
    for (const include of userIncludes) {
      // Issue #850: Add MISRA suppression for banned headers
      const suppression =
        MisraSuppressionUtils.getMisraSuppressionComment(include);
      if (suppression) {
        lines.push(suppression);
      }
      lines.push(include);
    }
  }

  /**
   * Add external type headers, deduplicating against user includes.
   * SonarCloud S3776: Extracted from generateIncludes.
   */
  private static addExternalTypeHeaders(
    lines: string[],
    headersToInclude: Set<string>,
    userIncludes: string[] | undefined,
  ): void {
    const userIncludeSet = new Set(userIncludes ?? []);
    const userIncludeStems = new Set(
      (userIncludes ?? []).map(HeaderGeneratorUtils.extractIncludeStem),
    );
    for (const directive of headersToInclude) {
      if (userIncludeSet.has(directive)) continue;
      const stem = HeaderGeneratorUtils.extractIncludeStem(directive);
      if (stem && userIncludeStems.has(stem)) continue;
      lines.push(directive);
    }
  }

  /**
   * Generate all include directives (system, user, and external type headers)
   */

  static generateIncludes(
    options: IHeaderOptions,
    headersToInclude: Set<string>,
    systemIncludes: readonly string[],
  ): string[] {
    const lines: string[] = [];

    // System includes, as decided by decideSystemIncludes above.
    if (options.includeSystemHeaders !== false) {
      lines.push(...systemIncludes.map((target) => `#include ${target}`));
    }

    // User includes (already rendered with the run's extension by 1.1 Discover)
    HeaderGeneratorUtils.addUserIncludes(lines, options.userIncludes);

    // External type header includes (skip duplicates of user includes)
    // Dedup by the included path, less leading ./ and ../ and the extension,
    // to handle different path styles (e.g. <AppConfig.hpp> vs
    // "../AppConfig.hpp") -- never by basename alone (#1435).
    //
    // It also used to absorb a .h/.hpp mismatch: IncludeResolver ran before
    // cppDetected was raised and IncludeExtractor after, so the two disagreed
    // about the extension. #1319 made the mode declared, so both read the same
    // value and that cause is gone; #1444 then made them one resolver. The path-style case is not, so the dedup
    // stays -- but it is no longer covering for a timing bug.
    HeaderGeneratorUtils.addExternalTypeHeaders(
      lines,
      headersToInclude,
      options.userIncludes,
    );

    // Add blank line if any includes were added
    // A header that needs no system include and has no user include emits no
    // blank line either -- the separator belonged to includes that were always
    // there, and 332 headers had it for two includes they never used.
    const hasIncludes =
      (options.includeSystemHeaders !== false && systemIncludes.length > 0) ||
      (options.userIncludes && options.userIncludes.length > 0) ||
      headersToInclude.size > 0;
    if (hasIncludes) {
      lines.push("");
    }

    return lines;
  }

  /**
   * Generate C++ extern "C" wrapper opening
   */
  static generateCppWrapperStart(): string[] {
    return ["#ifdef __cplusplus", 'extern "C" {', "#endif", ""];
  }

  /**
   * Generate forward declarations for external types
   */
  static generateForwardDeclarations(cCompatibleTypes: string[]): string[] {
    if (cCompatibleTypes.length === 0) {
      return [];
    }

    const lines: string[] = [
      "/* External type dependencies - include appropriate headers */",
    ];
    for (const typeName of cCompatibleTypes) {
      lines.push(`typedef struct ${typeName} ${typeName};`);
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate enum section
   */
  static generateEnumSection(
    enums: IHeaderSymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (enums.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Enumerations */"];
    for (const sym of enums) {
      if (typeInput) {
        lines.push(generateEnumHeader(sym.name, typeInput));
      } else {
        lines.push(`/* Enum: ${sym.name} (see implementation for values) */`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate bitmap section
   */
  static generateBitmapSection(
    bitmaps: IHeaderSymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (bitmaps.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Bitmaps */"];
    for (const sym of bitmaps) {
      if (typeInput) {
        lines.push(generateBitmapHeader(sym.name, typeInput));
      } else {
        lines.push(`/* Bitmap: ${sym.name} (see implementation for layout) */`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate type alias section
   */
  static generateTypeAliasSection(types: IHeaderSymbol[]): string[] {
    if (types.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Type aliases */"];
    for (const sym of types) {
      if (sym.type) {
        const cType = mapType(sym.type);
        lines.push(`typedef ${cType} ${sym.name};`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * ADR-029: Generate forward declarations for structs used in callback typedefs.
   * This ensures struct types can be used in callback parameter types before
   * the full struct definition.
   */
  static generateCallbackStructForwardDecls(
    structs: IHeaderSymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (!typeInput?.callbackTypes || typeInput.callbackTypes.size === 0) {
      return [];
    }

    // Collect struct types that are used in callback parameters
    const usedStructTypes = new Set<string>();
    for (const [, cbInfo] of typeInput.callbackTypes) {
      for (const p of cbInfo.parameters) {
        if (p.isStruct) {
          usedStructTypes.add(p.type);
        }
      }
    }

    if (usedStructTypes.size === 0) {
      return [];
    }

    // Get local struct names to only forward-declare those
    const localStructNames = new Set(structs.map((s) => s.name));

    const lines: string[] = [];
    for (const structType of usedStructTypes) {
      if (localStructNames.has(structType)) {
        lines.push(`typedef struct ${structType} ${structType};`);
      }
    }

    return lines.length > 0 ? [...lines, ""] : [];
  }

  /**
   * ADR-029: Generate callback typedef section
   * Generates function pointer typedefs for callbacks used as struct field types
   */
  static generateCallbackTypedefSection(
    typeInput: IHeaderTypeInput | undefined,
    isCppMode: boolean,
  ): string[] {
    if (!typeInput?.callbackTypes || typeInput.callbackTypes.size === 0) {
      return [];
    }

    const lines: string[] = ["/* Callback typedefs */"];
    for (const [, cbInfo] of typeInput.callbackTypes) {
      // #1164: formatted by the same code as the .c, so the two declarations of
      // one typedef cannot drift apart.
      lines.push(
        CallbackTypedefFormatter.format(
          cbInfo.returnType,
          cbInfo.typedefName,
          cbInfo.parameters,
          isCppMode,
        ),
      );
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate struct and class definitions section
   */
  static generateStructSection(
    structs: IHeaderSymbol[],
    classes: IHeaderSymbol[],
    typeInput?: IHeaderTypeInput,
  ): string[] {
    if (structs.length === 0 && classes.length === 0) {
      return [];
    }

    const lines: string[] = [];

    if (typeInput) {
      lines.push("/* Struct definitions */");
      for (const sym of structs) {
        lines.push(generateStructHeader(sym.name, typeInput));
      }
      for (const sym of classes) {
        lines.push(generateStructHeader(sym.name, typeInput));
      }
    } else {
      lines.push("/* Forward declarations */");
      for (const sym of structs) {
        lines.push(`typedef struct ${sym.name} ${sym.name};`);
      }
      for (const sym of classes) {
        lines.push(`typedef struct ${sym.name} ${sym.name};`);
      }
    }
    lines.push("");
    return lines;
  }

  /**
   * ADR-040: emit the ISR function-pointer typedef when this translation unit
   * uses the type.
   *
   * Keyed on the same fact the .c uses to decide it must NOT emit a second
   * copy. Scanning only the header's own declarations missed an `ISR` used
   * inside a function body, and the type was then emitted nowhere.
   */
  static generateIsrTypedefSection(needsIsrTypedef: boolean): string[] {
    if (!needsIsrTypedef) {
      return [];
    }
    return [
      "/* ADR-040: ISR function pointer type */",
      "typedef void (*ISR)(void);",
      "",
    ];
  }

  /**
   * #1453 / ADR-004: register accessor section.
   *
   * The blocks arrive rendered -- the type qualification and address
   * expressions they carry are codegen's, and a header-side renderer would be
   * a second copy of that resolution. A `#define` needs nothing declared before
   * it, so the section's position is for the reader, beside the types.
   */
  static generateRegisterSection(blocks: readonly string[]): string[] {
    if (blocks.length === 0) {
      return [];
    }
    return ["/* Registers (ADR-004) */", ...blocks];
  }

  /**
   * Generate extern variable declarations section
   *
   * Uses VariableDeclarationFormatter for consistent formatting with CodeGenerator.
   */
  static generateVariableSection(variables: IHeaderSymbol[]): string[] {
    if (variables.length === 0) {
      return [];
    }

    const lines: string[] = ["/* External variables */"];
    for (const sym of variables) {
      // Build normalized input for the unified formatter
      const input: IVariableFormatInput = {
        name: sym.name,
        cnxType: sym.type || "int",
        mappedType: DeclaredPointer.spell(
          mapType(sym.type || "int"),
          sym.isPointer ?? false,
        ),
        modifiers: {
          isConst: sym.isConst ?? false,
          isAtomic: sym.isAtomic ?? false,
          isVolatile: sym.isVolatile ?? false,
          isExtern: true, // Headers always use extern
        },
        arrayDimensions:
          sym.isArray && sym.arrayDimensions ? sym.arrayDimensions : undefined,
      };

      const declaration = VariableDeclarationFormatter.format(input);
      lines.push(`${declaration};`);
    }
    lines.push("");
    return lines;
  }

  /**
   * Generate C++ extern "C" wrapper closing and header guard end
   */
  static generateHeaderEnd(guard: string): string[] {
    return [
      "#ifdef __cplusplus",
      "}",
      "#endif",
      "",
      `#endif /* ${guard} */`,
      "",
    ];
  }
}

export default HeaderGeneratorUtils;
