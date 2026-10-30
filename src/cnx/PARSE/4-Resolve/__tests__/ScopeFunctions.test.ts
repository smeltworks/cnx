import { describe, it, expect } from "vitest";
import ScopeFunctions from "../ScopeFunctions";
import ScopeUtils from "../../../utils/ScopeUtils";
import TTypeUtils from "../../../utils/TTypeUtils";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import UNSET_SOURCE_SPAN from "../../../types/UNSET_SOURCE_SPAN";
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type TSymbol from "../../../types/symbols/TSymbol";

const fn = (name: string, sourceFile = "a.cnx"): IFunctionSymbol => ({
  kind: "function",
  name,
  fullyQualifiedCName: `S__${name}`,
  cnxScopedName: `S.${name}`,
  scopePath: "S",
  sourceFile,
  span: UNSET_SOURCE_SPAN,
  sourceLanguage: ESourceLanguage.Cnx,
  visibility: "public",
  parameters: [],
  returnType: TTypeUtils.createPrimitive("void"),
  returnOverflowBehavior: "clamp",
});

describe("ScopeFunctions.adopt", () => {
  it("puts each rebuilt function in its scope's place, in the same array", () => {
    const scope = ScopeUtils.createScope("S", "");
    const original = fn("f");
    const kept = fn("g");
    const sibling = fn("h", "b.cnx");
    scope.functions.push(original, kept, sibling);
    const functions = scope.functions;
    const rebuilt = { ...original, parameters: [] };
    const memo = new Map<TSymbol, TSymbol>([
      [original, rebuilt],
      [kept, kept],
    ]);

    ScopeFunctions.adopt([scope], memo);

    // The registry's array is the one adopted into, not a copy of it
    expect(scope.functions).toBe(functions);
    expect(scope.functions[0]).toBe(rebuilt);
    // Mapped to itself: left as it is
    expect(scope.functions[1]).toBe(kept);
    // Not in the memo -- a spanned scope's function from another file
    // (#1333): untouched
    expect(scope.functions[2]).toBe(sibling);
  });

  it("leaves symbols that are not scopes alone", () => {
    const original = fn("f");
    const rebuilt = { ...original };
    const memo = new Map<TSymbol, TSymbol>([[original, rebuilt]]);
    const symbols: TSymbol[] = [original];

    ScopeFunctions.adopt(symbols, memo);

    expect(symbols[0]).toBe(original);
  });
});
