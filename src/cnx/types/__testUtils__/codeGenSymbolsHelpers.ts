import ICodeGenSymbols from "../ICodeGenSymbols";

/**
 * A complete, empty `ICodeGenSymbols` for unit tests, with overrides applied.
 *
 * #1285: this existed as EIGHT independent copies, one per test file, plus a
 * ninth complete factory (`handlerTestUtils.createDefaultMockSymbols`) that this
 * one now backs. Adding a field to the interface meant that many edits, all of
 * which had to agree.
 *
 * **No `as ICodeGenSymbols` cast.** The cast is what would make this helper unable
 * to detect the drift it exists to prevent: with it, a literal missing a field
 * still compiles, and every future gap is silenced along with it. Without the cast,
 * adding a required field to the interface makes `tsc` name this file. Three of the
 * copies replaced here omitted the cast and did enforce that; the first version of
 * this helper used one, and so enforced nothing.
 *
 * It is deliberately PURE: it returns a value and touches no global state, so a
 * caller assigning it to `CodeGenState.symbols` is doing something visible at the
 * call site. To install both `CodeGenState.symbols` and the matching
 * `CodeGenState.symbolTable`, use `installMockSymbols`.
 */
function createMockSymbols(
  overrides?: Partial<ICodeGenSymbols>,
): ICodeGenSymbols {
  return {
    // Known type names
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),

    // Scope information
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),

    // Struct information
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),

    // Enum information
    enumMembers: new Map(),
    memberCNames: new Map(),

    // Bitmap information
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),

    // Register information
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),

    // Function return types
    functionReturnTypes: new Map(),

    ...overrides,
  };
}

export default createMockSymbols;
