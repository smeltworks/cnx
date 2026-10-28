/**
 * Base Header Generator
 *
 * Abstract base class for C and C++ header generators.
 * Uses Template Method pattern - subclasses implement emitsCpp(), which
 * decides pointer (*) vs reference (&) semantics among the rest.
 */

import invariant from "../../../utils/invariant";
import headerCType from "../../../utils/headerCType";
import IHeaderSymbol from "./types/IHeaderSymbol";
import IParameterSymbol from "../../../utils/types/IParameterSymbol";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import HeaderGeneratorUtils from "./HeaderGeneratorUtils";
import type IResolvedSymbols from "../../../types/IResolvedSymbols";
// Unified parameter generation (Phase 1)
import ParameterInputAdapter from "../codegen/helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "../codegen/helpers/ParameterSignatureBuilder";
import StructInitFunction from "../codegen/helpers/StructInitFunction";

/**
 * Abstract base class for header file generation
 *
 * Generates header files (.h) from cnx symbols. Subclasses implement
 * emitsCpp(), which also decides pass-by-reference semantics:
 * - CHeaderGenerator writes C, so "*" for pointer-based semantics
 * - CppHeaderGenerator writes C++, so "&" for reference-based semantics
 */
abstract class BaseHeaderGenerator {
  /**
   * Reject an external type this header cannot correctly declare.
   *
   * Issue #1225/#1238: `typedef struct X X;` is a guess that only holds when X
   * really is an opaque struct. For a pointer typedef it declares a different
   * type -- and an object of it cannot be declared at all, so a header carrying
   * `extern handle_t h;` against it is not valid C or C++.
   *
   * The previous code filtered pointer typedefs out of the list silently, which
   * swapped a contradictory declaration for a missing one. Neither is a safe
   * degradation, so report it: reaching here means the type's defining header
   * was not propagated into this header, and that is a transpiler defect the
   * generated code should not paper over.
   *
   * Returns void rather than a filtered list on purpose -- an earlier version
   * looked like a filter and was not one, which invites the next reader to
   * preserve filtering that never existed.
   *
   * #1322 classifies this as an INVARIANT rather than a diagnostic, and the
   * argument is a subset one rather than "I could not reach it":
   * `cHeadersIncluded` is true whenever any name in `HeaderTypeNames.collect`
   * satisfies `_needsDefiningHeader`, whose first clause is
   * `isPointerTypedef`. This runs only when that is false, and looks for a
   * pointer typedef among the external types of the SAME symbols. For it to
   * find one, a name would have to be in the header's external types and
   * absent from the enumeration those types are collected by -- which is a
   * transpiler defect, not a program a user can write. It carried E0505; the
   * code is retired rather than reassigned, because a number in
   * `docs/error-codes.md` is a promise that a user can be shown it.
   */
  private static assertNoPointerTypedefs(
    externalTypes: string[],
    symbolTable: IResolvedSymbols | undefined,
    headerName: string,
    symbols: IHeaderSymbol[],
  ): void {
    const pointerTypedef = externalTypes.find((typeName) =>
      symbolTable?.isPointerTypedef(typeName),
    );

    if (pointerTypedef === undefined) {
      return;
    }

    // The declaration that pulled the type in. This fires on a file the user
    // did not write, so naming the cnx declaration is the difference
    // between an actionable error and a puzzle.
    const origin = BaseHeaderGenerator.findDeclaringSymbol(
      symbols,
      pointerTypedef,
    );
    const declaredBy =
      origin === undefined ? "" : ` It is named by '${origin.name}'.`;
    const location =
      origin?.sourceLine === undefined ? "" : ` Line ${origin.sourceLine}`;

    invariant(
      false,
      `'${pointerTypedef}' is a typedef of a pointer declared in another ` +
        `header, and generated header '${headerName}' does not include that ` +
        `header.${declaredBy} A forward declaration cannot express a pointer ` +
        `typedef -- 'typedef struct ${pointerTypedef} ${pointerTypedef};' would ` +
        `declare a different, incomplete type. The include should have been ` +
        `propagated by the header-needs-user-C-headers derivation.${location}`,
    );
  }

  /** The exported symbol whose type pulled `typeName` into this header. */
  private static findDeclaringSymbol(
    symbols: IHeaderSymbol[],
    typeName: string,
  ): IHeaderSymbol | undefined {
    return symbols.find(
      (symbol) =>
        HeaderGeneratorUtils.extractBaseType(symbol.type ?? "") === typeName ||
        (symbol.parameters ?? []).some(
          (parameter) =>
            HeaderGeneratorUtils.extractBaseType(parameter.type) === typeName,
        ),
    );
  }

  /**
   * Get the suffix for pass-by-reference parameters
   * @returns "*" for C pointer semantics, "&" for C++ reference semantics
   */
  private getRefSuffix(): string {
    return this.emitsCpp() ? "&" : "*";
  }

  /**
   * #1428: whether this generator writes a C++ header. Each subclass IS one
   * mode, so the answer is its own; an options field could disagree with it.
   */
  protected abstract emitsCpp(): boolean;

  /**
   * Generate a header file from symbols
   *
   * @param symbols - Array of symbols to include in header
   * @param filename - Output filename (used for include guard)
   * @param options - Header generation options
   * @param typeInput - Optional type information for full definitions
   * @param allKnownEnums - All known enum names from entire compilation
   * @param sourcePath - Optional source file path for header comment
   */
  generate(
    symbols: IHeaderSymbol[],
    filename: string,
    options: IHeaderOptions,
    typeInput?: IHeaderTypeInput,
    allKnownEnums?: ReadonlySet<string>,
    sourcePath?: string,
  ): string {
    const guard = HeaderGeneratorUtils.makeGuard(filename);

    // #1300: NO filter here. `PublicInterface` already decided which symbols
    // form this file's header, including the private types a public signature
    // makes reachable -- a second predicate over the same set could only
    // disagree with the first, and did: it dropped every closure type, because
    // it re-read the declared visibility instead of carrying the decision.
    const groups = HeaderGeneratorUtils.groupSymbolsByKind(symbols);

    // Get local type names for external type detection
    const localTypes = HeaderGeneratorUtils.getLocalTypeNames(groups);

    // Collect external type dependencies
    // #1164: typedefs this header emits itself are local. Without this the
    // header forward-declares its own callback typedef as an unknown struct.
    const localTypeNamesWithCallbacks = new Set(localTypes.localTypeNames);
    for (const [, cbInfo] of typeInput?.callbackTypes ?? []) {
      localTypeNamesWithCallbacks.add(cbInfo.typedefName);
    }

    const externalTypes = HeaderGeneratorUtils.collectExternalTypes(
      groups.functions,
      groups.variables,
      localTypes.localStructNames,
      localTypes.localEnumNames,
      localTypeNamesWithCallbacks,
      localTypes.localBitmapNames,
      allKnownEnums,
      [...groups.structs, ...groups.classes].flatMap((struct) => [
        ...(typeInput?.structFields.get(struct.name)?.values() ?? []),
      ]),
    );

    // Build external type header includes
    const { typesWithHeaders, headersToInclude } =
      HeaderGeneratorUtils.buildExternalTypeIncludes(
        externalTypes,
        options.externalTypeHeaders,
      );

    // Get symbol table for C++ namespace detection
    const symbolTable = typeInput?.symbolTable;

    // Filter to C-compatible external types
    //
    // Issue #1200: a callback type (ADR-029) is not an external struct. It is
    // emitted as a function-pointer typedef by generateCallbackTypedefSection
    // below, so forward-declaring it as `typedef struct X X;` here produces two
    // conflicting declarations of the same name -- and the name also belongs to
    // the function the type was defined from.
    const cCompatibleExternalTypes =
      HeaderGeneratorUtils.filterCCompatibleTypes(
        externalTypes,
        typesWithHeaders,
      ).filter((typeName) => !typeInput?.callbackTypes?.has(typeName));

    // Filter to C-compatible variables
    const cCompatibleVariables =
      HeaderGeneratorUtils.filterCCompatibleVariables(groups.variables);

    if (!options.cHeadersIncluded) {
      BaseHeaderGenerator.assertNoPointerTypedefs(
        cCompatibleExternalTypes,
        symbolTable,
        filename,
        symbols,
      );
    }

    // #1517: the declarations are built FIRST, because the includes depend on
    // what they say. `CodeGenerator.assembleGeneratedOutput` does the same with
    // its banner, and for the same reason -- "none of the requirement state
    // exists until generateAllDeclarations() above has run". A header emitting
    // `<stdint.h>` before knowing whether it declares a `uint32_t` can only
    // ever guess, and it guessed the same way every time.
    const body: string[] = [
      ...HeaderGeneratorUtils.generateCppWrapperStart(),
      ...HeaderGeneratorUtils.generateForwardDeclarations(
        // #1164: `typedef struct opaque_t* handle_t` is a different type from
        // `struct handle_t`, so the usual forward declaration contradicts the
        // real definition. Its defining header is included instead, which is
        // what cHeadersIncluded means; assertNoPointerTypedefs above has
        // already rejected the case where it was not.
        options.cHeadersIncluded ? [] : cCompatibleExternalTypes,
      ),
      ...HeaderGeneratorUtils.generateIsrTypedefSection(
        options.needsIsrTypedef ?? false,
      ),
      ...HeaderGeneratorUtils.generateEnumSection(groups.enums, typeInput),
      ...HeaderGeneratorUtils.generateBitmapSection(groups.bitmaps, typeInput),
      ...HeaderGeneratorUtils.generateTypeAliasSection(groups.types),
      ...HeaderGeneratorUtils.generateCallbackStructForwardDecls(
        groups.structs,
        typeInput,
      ),
      ...HeaderGeneratorUtils.generateCallbackTypedefSection(
        typeInput,
        this.emitsCpp(),
      ),
      ...HeaderGeneratorUtils.generateStructSection(
        groups.structs,
        groups.classes,
        typeInput,
      ),
      ...HeaderGeneratorUtils.generateRegisterSection(
        options.registerBlocks ?? [],
      ),
      ...HeaderGeneratorUtils.generateVariableSection(cCompatibleVariables),
      ...this.generateFunctionSection(
        groups.functions,
        options.generatedStructInits,
      ),
      ...HeaderGeneratorUtils.generateHeaderEnd(guard),
    ];

    const lines: string[] = [
      ...HeaderGeneratorUtils.generateHeaderStart(guard, sourcePath),
      // #1517: printed from the plan's decision, not worked out from the text
      // just rendered. `body` no longer has any say in what precedes it.
      ...HeaderGeneratorUtils.generateIncludes(
        options,
        headersToInclude,
        options.systemIncludes ?? [],
      ),
      ...body,
    ];

    return lines.join("\n");
  }

  /**
   * Generate function prototypes section
   */
  private generateFunctionSection(
    functions: IHeaderSymbol[],
    generatedStructInits?: ReadonlySet<string>,
  ): string[] {
    // #1205: the ADR-029 init functions are declarations too, so the section
    // exists when there is either kind. Keying the early return on `functions`
    // alone would drop the init prototypes for a file whose only external
    // definitions are generated ones.
    const initPrototypes = StructInitFunction.prototypeLines([
      ...(generatedStructInits ?? []),
    ]);
    if (functions.length === 0 && initPrototypes.length === 0) {
      return [];
    }

    const lines: string[] = ["/* Function prototypes */"];
    for (const sym of functions) {
      const proto = this.generateFunctionPrototype(sym);
      if (proto) {
        lines.push(proto);
      }
    }
    lines.push(...initPrototypes, "");
    return lines;
  }

  /**
   * Generate a function prototype
   */
  private generateFunctionPrototype(sym: IHeaderSymbol): string | null {
    // Map return type (main() always returns int). `headerCType`, the same
    // mapping a struct field uses, so a return type and a field cannot name
    // one type two ways (#1520).
    const mappedType = sym.type ? headerCType(sym.type) : "void";
    const returnType = sym.name === "main" ? "int" : mappedType;

    // Get pass-by-value parameter names for this function

    // Build parameter list
    let params = "void";

    if (sym.parameters && sym.parameters.length > 0) {
      const translatedParams = sym.parameters.map((p) =>
        this.generateParameter(p),
      );
      params = translatedParams.join(", ");
    }

    return `${returnType} ${sym.name}(${params});`;
  }

  /**
   * Generate a single parameter with appropriate semantics
   */
  private generateParameter(p: IParameterSymbol): string {
    const input = ParameterInputAdapter.fromSymbol(p, {
      mapType: headerCType,
    });

    return ParameterSignatureBuilder.build(input, this.getRefSuffix());
  }
}

export default BaseHeaderGenerator;
