import type IBitmapFieldLayout from "../IBitmapFieldLayout";
import type IBitmapFieldSymbol from "../symbols/IBitmapFieldSymbol";
import type IRegisterMemberSymbol from "../symbols/IRegisterMemberSymbol";
import type IEnumMemberSymbol from "../symbols/IEnumMemberSymbol";
import type IStructFieldSymbol from "../symbols/IStructFieldSymbol";
import type TSymbolKindCnx from "../symbol-kinds/TSymbolKindCnx";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ScopeUtils from "../../utils/ScopeUtils";
import TestSourceSpan from "./testSourceSpan";

/**
 * Lifts the plain member records mocks used to write into member SYMBOLS.
 *
 * Struct fields, bitmap fields and register members became symbols in #1318,
 * so each one a mock builds now needs nine more fields. These helpers WRAP the
 * existing literal rather than replacing it, so a test that was about header
 * emission stays about header emission instead of turning into a test about
 * symbol identity.
 *
 * Identity comes from `ScopeUtils.identityOf` -- the same encoder
 * `MemberSymbolBase` uses in production -- so a mock cannot assert a key the
 * real collector would never produce. Spans are distinct per member, so a test
 * claiming a member reports its OWN position cannot pass by coincidence.
 */
class TestMembers {
  /**
   * The nine `IBaseSymbol` fields a member mock needs.
   *
   * Public because `testEnumMembers` builds the same nine and used to hand-copy
   * them (#1318 review) -- the duplication `MemberSymbolBase` exists to prevent
   * on the production side, reintroduced on the mock side, where a tenth field
   * on `IBaseSymbol` would have meant editing both and the two would have
   * drifted silently because different tests exercise each.
   */
  static base(
    kind: TSymbolKindCnx,
    name: string,
    ownerScopedName: string,
    line: number,
  ) {
    return {
      kind,
      name,
      scopePath: ownerScopedName,
      ...ScopeUtils.identityOf({ name, scopePath: ownerScopedName }),
      sourceFile: "test.cnx",
      span: TestSourceSpan.at(line),
      sourceLanguage: ESourceLanguage.Cnx,
      visibility: "public" as const,
    };
  }

  static asEnumMembers(
    enumScopedName: string,
    values: Readonly<Record<string, number>>,
    sourceFile = "test.cnx",
  ): Map<string, IEnumMemberSymbol> {
    const members = new Map<string, IEnumMemberSymbol>();
    let line = 1;
    for (const [name, value] of Object.entries(values)) {
      line += 1;
      members.set(name, {
        ...TestMembers.base("enum_member", name, enumScopedName, line),
        sourceFile,
        kind: "enum_member",
        // A test states the settled value; the value as written is not its subject
        valueExpr: null,
        value,
      });
    }
    return members;
  }

  static asStructFields(
    ownerScopedName: string,
    fields: ReadonlyMap<
      string,
      Omit<IStructFieldSymbol, keyof ReturnType<typeof TestMembers.base>>
    >,
  ): Map<string, IStructFieldSymbol> {
    const out = new Map<string, IStructFieldSymbol>();
    let line = 1;
    for (const [name, rest] of fields) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("struct_field", name, ownerScopedName, line),
        ...rest,
        kind: "struct_field",
      });
    }
    return out;
  }

  static asBitmapFields(
    ownerScopedName: string,
    fields: ReadonlyMap<string, IBitmapFieldLayout>,
  ): Map<string, IBitmapFieldSymbol> {
    const out = new Map<string, IBitmapFieldSymbol>();
    let line = 1;
    for (const [name, rest] of fields) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("bitmap_field", name, ownerScopedName, line),
        ...rest,
        kind: "bitmap_field",
      });
    }
    return out;
  }

  static asRegisterMembers(
    ownerScopedName: string,
    members: ReadonlyMap<
      string,
      Omit<
        IRegisterMemberSymbol,
        | keyof ReturnType<typeof TestMembers.base>
        | "group"
        | "layoutField"
        | "layoutUnion"
        | "bytes"
      > & {
        readonly group?: number | null;
        readonly layoutField?: string;
        readonly layoutUnion?: string | null;
        readonly bytes?: bigint | null;
      }
    >,
  ): Map<string, IRegisterMemberSymbol> {
    const out = new Map<string, IRegisterMemberSymbol>();
    let line = 1;
    for (const [name, rest] of members) {
      line += 1;
      out.set(name, {
        ...TestMembers.base("register_member", name, ownerScopedName, line),
        group: null,
        layoutField: name,
        layoutUnion: null,
        bytes: null,
        ...rest,
        kind: "register_member",
      });
    }
    return out;
  }
}

export default TestMembers;
