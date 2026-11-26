import EHeaderLanguage from "../1-Discover/types/EHeaderLanguage";
import type ICHeaderSyntax from "../2-Parse/types/ICHeaderSyntax";
import type TParsedHeader from "../2-Parse/types/TParsedHeader";
import CaughtError from "../../utils/CaughtError";
import CResolver from "./c/index";
import CppResolver from "./cpp/index";
import type ICTypedefSymbol from "../../types/symbols/c/ICTypedefSymbol";
import SymbolTable from "./SymbolTable";

/**
 * 1.3 Declare for C and C++ headers: one header's 1.2 syntax, and its symbols
 * written to the table.
 *
 * Moved out of the orchestrator by #1443. Everything here needs one header's
 * lowered syntax and nothing else, which is `IFileSymbols`' admission test for 1.3. It
 * takes no text: 1.2 parses, so nothing here can parse again (#1932).
 */
class HeaderDeclarations {
  /**
   * Issue #208: one parser per header, the one its language names. #1844:
   * the language is 1.1's answer, and 1.2 parsed with it.
   */
  static declare(
    parsed: TParsedHeader,
    filePath: string,
    symbolTable: SymbolTable,
  ): void {
    switch (parsed.language) {
      case EHeaderLanguage.Assembler:
        return;
      case EHeaderLanguage.Cpp:
        // C++14 parser for typed enums, classes, namespaces, templates
        if (parsed.syntax) {
          symbolTable.markUndefinedMacros(
            filePath,
            parsed.syntax.undefinedMacros,
          );
          // ADR-055 Phase 7: Store TCppSymbol directly
          symbolTable.addCppSymbols(
            CppResolver.resolve(parsed.syntax, filePath, symbolTable).symbols,
          );
        }
        return;
      case EHeaderLanguage.C:
        if (parsed.syntax) {
          symbolTable.markUndefinedMacros(
            filePath,
            parsed.syntax.undefinedMacros,
          );
          // ADR-055 Phase 7: Store TCSymbol directly
          symbolTable.addCSymbols(
            CResolver.resolve(parsed.syntax, filePath, symbolTable).symbols,
          );
        }
        return;
    }
  }

  /**
   * One recovered slice (#1279) declared into the run's table, and its clean
   * C parse resolved into `cleanState` for `clearPhantomStructBodies`.
   *
   * The clean pass reads each slice as C on its own: only its opaque/body
   * verdict is consulted (opaque struct typedefs are a C concern), and it
   * tolerates slices it cannot resolve -- except a deliberate diagnostic,
   * which propagates.
   */
  static recoverSlice(
    path: string,
    parsed: TParsedHeader,
    asC: ICHeaderSyntax | null,
    symbolTable: SymbolTable,
    cleanState: SymbolTable,
  ): void {
    try {
      HeaderDeclarations.declare(parsed, path, symbolTable);
    } catch (err) {
      // #1319: same decision as the sibling catch in the host's header loop:
      // swallowing a diagnostic here would produce the `Compiled N files` /
      // exit 0 shape diagnostics exist to remove -- so "is this a deliberate
      // diagnostic?" is answered in both places or in neither.
      if (CaughtError.isDiagnostic(err)) {
        throw err;
      }
      // A slice that won't parse leaves the (already-collected) symbols as they
      // were — skip it rather than fail the build.
    }
    if (!asC) return;
    try {
      CResolver.resolve(asC, path, cleanState);
    } catch {
      /* isolated best-effort — only its opaque/body verdict is consulted */
    }
  }

  /**
   * #1755: `typedef __FILE FILE;` names the struct `typedef struct __sFILE
   * __FILE;` does, so FILE shares its tag. Newlib declares the two in different
   * headers, read in either order, so this runs once every header is declared.
   */
  static aliasTypedefChains(symbolTable: SymbolTable): void {
    const typedefs = symbolTable
      .getAllCSymbols()
      .filter(
        (symbol): symbol is ICTypedefSymbol =>
          symbol.kind === "type" && symbol.arrayDimensions === undefined,
      );
    let aliased = true;
    while (aliased) {
      aliased = false;
      for (const typedef of typedefs) {
        const tag = symbolTable.getStructTagForTypedef(typedef.type);
        if (
          tag !== undefined &&
          symbolTable.getStructTagForTypedef(typedef.name) === undefined
        ) {
          symbolTable.registerStructTagAlias(tag, typedef.name);
          aliased = true;
        }
      }
    }
  }

  /**
   * Undo PHANTOM struct bodies: when the normal pass parsed a header's huge
   * preprocessed blob, ANTLR error-recovery could fabricate a `struct X { ... }`
   * that was never really there (e.g. lvgl `struct _lv_obj_t`), which makes an
   * opaque typedef look complete and defeats pointer codegen. The clean per-file
   * re-parse (`cleanState`) is authoritative, so for every type it proves opaque,
   * clear any body its tag does NOT actually have.
   */
  static clearPhantomStructBodies(
    cleanState: SymbolTable,
    symbolTable: SymbolTable,
  ): void {
    const cleanBodies = new Set(cleanState.getAllStructTagsWithBodies());
    for (const typedefName of cleanState.getAllOpaqueTypes()) {
      if (!cleanState.isOpaqueType(typedefName)) continue;
      const tag = symbolTable.getStructTagForTypedef(typedefName);
      if (tag && !cleanBodies.has(tag)) {
        symbolTable.clearStructTagHasBody(tag);
      }
    }
  }
}

export default HeaderDeclarations;
