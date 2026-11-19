import TSymbolKindCnx from "../../types/symbol-kinds/TSymbolKindCnx";

/**
 * The symbol kinds whose declaration introduces a TYPE NAME.
 *
 * ADR-057 qualifies a bare type name against the enclosing scope only when the
 * name actually names a type -- a scope variable called `Config` must not
 * capture a global `struct Config` at a type position. That decision
 * was previously spread across four parallel `known*` sets, and #1281 proposed
 * adding a fifth (`knownCallbackTypes`) for the one kind the other four had
 * missed. A fifth set is the same bug again: the question "does this name form
 * a type" has one answer, and it belongs on the symbol's own kind.
 *
 * `function` is a member because ADR-029 makes a function definition create a
 * callback type. `variable` is excluded because ADR-057 says so, and
 * `enum_member`/`bitmap_field`/`register_member` are values inside a type, not
 * types.
 *
 * `register` is NOT a member. It reads like a type kind, but a register
 * declares a variable at an address; `CodeGenState.isScopeType` is measurably
 * `knownEnums | knownStructs | knownBitmaps` and has never included registers.
 * Adding it here would qualify a bare name matching a register declaration --
 * a cnx behavior change. ADR-072 would make a register a type, but it is
 * `Research`, so ADR-004 remains in force and this exclusion stands. Revisit
 * when ADR-072 is implemented, not when it is merely Accepted.
 */
const TYPE_FORMING_KINDS: ReadonlySet<TSymbolKindCnx> = new Set<TSymbolKindCnx>(
  ["enum", "struct", "bitmap", "function"],
);

export default TYPE_FORMING_KINDS;
