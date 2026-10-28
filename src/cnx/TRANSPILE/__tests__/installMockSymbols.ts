import TranspileState from "../TranspileState";
import TestSymbolTable from "./TestSymbolTable";
import QualifiedCName from "../../utils/QualifiedCName";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import createMockSymbols from "../../types/__testUtils__/codeGenSymbolsHelpers";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type TSymbol from "../../types/symbols/TSymbol";
import type TVisibility from "../../types/TVisibility";
import TestSourceSpan from "../../types/__testUtils__/testSourceSpan";
import type ISourceSpan from "../../types/ISourceSpan";

/**
 * Build a mock symbol world and install BOTH of its representations.
 *
 * #1285: `state.symbols` (the `known*` string sets) and
 * `state.symbolTable` describe the same symbols, and production fills them
 * from one resolve pass -- `Transpiler.ts:429` is the only place that fills them. A test that
 * sets only the sets is in a state the transpiler never reaches, which stayed
 * invisible while `isScopeType` asked the sets and became visible the moment it
 * asked the symbol's `kind` instead.
 *
 * Assigning `state.symbols` yourself is what leaves the table empty. Call
 * this instead, so the two cannot disagree.
 */
function installMockSymbols(
  state: TranspileState,
  overrides?: Partial<ICodeGenSymbols>,
): ICodeGenSymbols {
  const symbols = createMockSymbols(overrides);
  state.symbols = symbols;

  register(state, symbols.knownEnums, (base) => ({
    ...base,
    kind: "enum",
    members: new Map(),
  }));
  register(state, symbols.knownStructs, (base) => ({
    ...base,
    kind: "struct",
    fields: new Map(),
  }));
  register(state, symbols.knownBitmaps, (base) => ({
    ...base,
    kind: "bitmap",
    backingType: "uint8_t",
    bitWidth: 8,
    fields: new Map(),
  }));

  return symbols;
}

/**
 * The identity a mock type symbol carries.
 *
 * `fullyQualifiedCName` is the set entry verbatim -- the set already holds the
 * generated C name, and that is the key `SymbolTable` indexes by. The leaf and the
 * cnx name are derived from it so a diagnostic reading `cnxScopedName` gets
 * something an author could have written.
 */
function register(
  state: TranspileState,
  names: ReadonlySet<string>,
  build: (base: {
    name: string;
    fullyQualifiedCName: string;
    cnxScopedName: string;
    scopePath: string;
    sourceFile: string;
    span: ISourceSpan;
    sourceLanguage: ESourceLanguage;
    visibility: TVisibility;
  }) => TSymbol,
): void {
  for (const qualifiedName of names) {
    // a fixture decoding its own mock C name; no pass reads a C name back
    const parts = qualifiedName.split(QualifiedCName.SEPARATOR);
    const base = {
      name: parts.at(-1)!,
      fullyQualifiedCName: qualifiedName,
      cnxScopedName: parts.join(QualifiedCName.SOURCE_SEPARATOR),
      // #1298: the enclosing PATH, not a scope object. These mocks are all
      // file-scope, and the deleted `scope` field made every symbol installed
      // here carry a live scope object while `scopePath` was undefined -- which
      // `build: => unknown` plus `as TSymbol` hid from tsc.
      scopePath: "",
      sourceFile: "mock.cnx",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public" as TVisibility,
    };
    TestSymbolTable.of(state).addTSymbol(build(base));
  }
}

export default installMockSymbols;
