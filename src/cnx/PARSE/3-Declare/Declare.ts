/**
 * 1.3 Declare over 1.2's artifact (#1991): each parsed cnx file's symbols,
 * with its syntax carried forward for 1.4 and 2.1.
 */
import type IParsedSources from "../2-Parse/types/IParsedSources";
import type ITranspileError from "../../types/ITranspileError";
import CaughtError from "../../utils/CaughtError";
import CnxResolver from "./cnx/index";
import CppNamespaceUtils from "../../utils/CppNamespaceUtils";
import HeaderDeclarationRecord from "./HeaderDeclarationRecord";
import HeaderDeclarations from "./HeaderDeclarations";
import SymbolRegistry from "./SymbolRegistry";
import SymbolTable from "./SymbolTable";
import type IParsedRecovery from "../2-Parse/types/IParsedRecovery";
import type TParsedHeaderEntry from "../2-Parse/types/TParsedHeaderEntry";
import type IDeclaredHeaders from "./types/IDeclaredHeaders";
import type IDeclaredSource from "./types/IDeclaredSource";
import type IDeclaredSources from "./types/IDeclaredSources";

class Declare {
  /** Each file 1.3 declared, the errors of any it could not, and 1.2's carried facts */
  static sources(parsed: IParsedSources): IDeclaredSources {
    const symbolTable = new SymbolTable();
    const headers = Declare._headers(
      parsed.headers,
      parsed.headerReader,
      symbolTable,
    );
    Declare._recover(parsed.recovered, symbolTable);
    HeaderDeclarations.aliasTypedefChains(symbolTable);
    const registry = new SymbolRegistry();
    const declared: IDeclaredSource[] = [];
    const errors: ITranspileError[] = [];
    for (const { file, syntax } of parsed.sources) {
      try {
        declared.push({
          file,
          fileSymbols: CnxResolver.resolve(
            syntax.program,
            file.path,
            registry,
            (name) => CppNamespaceUtils.isCppNamespace(name, symbolTable),
          ),
          syntax,
        });
      } catch (err) {
        errors.push(CaughtError.asTranspileError(err));
      }
    }
    return {
      declared,
      errors,
      target: parsed.target,
      discovery: parsed.discovery,
      symbolTable,
      registry,
      headers,
    };
  }

  /**
   * The C/C++ headers, in header order, because what the table holds depends
   * on it (#1817). #1319: a header that will not parse degrades to a warning,
   * since tolerating third-party headers is a real need; a cnx diagnostic
   * is a rejection made on purpose, so it propagates.
   */
  private static _headers(
    entries: readonly TParsedHeaderEntry[],
    reader: string,
    table: SymbolTable,
  ): IDeclaredHeaders {
    const declared: IDeclaredHeaders["declared"][number][] = [];
    const warnings: string[] = [];
    let processed = 0;
    for (const entry of entries) {
      try {
        if (entry.kind === "failed") throw entry.error;
        if (entry.kind === "cached") {
          HeaderDeclarationRecord.restore(entry.record, table);
        } else {
          HeaderDeclarations.declare(entry.parsed, entry.file.path, table);
          declared.push({
            path: entry.file.path,
            language: entry.language,
            record: HeaderDeclarationRecord.of(entry.file.path, table),
          });
        }
        processed++;
      } catch (err) {
        if (CaughtError.isDiagnostic(err)) {
          throw err;
        }
        warnings.push(`Failed to process header ${entry.file.path}: ${err}`);
      }
    }
    return { declared, warnings, processed, reader };
  }

  /**
   * Issue #985 recovery: the framework declarations standalone header
   * preprocessing missed, from each slice 1.1 preprocessed as a translation
   * unit, then the phantom struct bodies its clean re-parse disproves.
   */
  private static _recover(
    recovered: IParsedRecovery | null,
    table: SymbolTable,
  ): void {
    if (recovered === null) return;
    const cleanState = new SymbolTable();
    for (const slice of recovered.slices) {
      HeaderDeclarations.recoverSlice(
        slice.path,
        slice.parsed,
        slice.asC,
        table,
        cleanState,
      );
    }
    HeaderDeclarations.clearPhantomStructBodies(cleanState, table);
    if (recovered.macroNames.size > 0) {
      table.addExternalDeclarationNames(recovered.macroNames);
    }
  }
}

export default Declare;
