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
 * `register` is a member: ADR-072 Part 1 makes `register GpioPort { ... }`
 * a type, whose instances (`GpioPort GPIO1(0x401B8000);`) are fixed at an
 * address (#2449).
 */
const TYPE_FORMING_KINDS: ReadonlySet<TSymbolKindCnx> = new Set<TSymbolKindCnx>(
  ["enum", "struct", "bitmap", "function", "register"],
);

export default TYPE_FORMING_KINDS;
