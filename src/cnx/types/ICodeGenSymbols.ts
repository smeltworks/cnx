import type IBitmapFieldLayout from "./IBitmapFieldLayout";
import type TExpression from "./syntax/TExpression";
/**
 * Read-only symbol collections for code generation.
 * Provides generators with access to type declarations without mutation.
 *
 * This interface mirrors the readonly accessors of SymbolCollector,
 * enabling dependency injection and testing.
 */
interface ICodeGenSymbols {
  // === Known Type Names ===

  /**
   * Known scopes, keyed by a scope's IDENTITY -- its `cnxScopedName`, the dotted
   * SOURCE path (`Motor`, `Outer.Inner`), never its leaf (ADR-016).
   *
   * #1295: stated here because the key is a contract, and this is the file a
   * consumer opens to learn it. It was previously the leaf, and the three
   * collections below moved with it. Nothing enforces this -- the key is
   * `string` either way, so `tsc`, `knip` and `depcruise` are all structurally
   * blind to a reader that goes back to passing a leaf. It would simply return
   * `undefined`, which every caller reads as "not a scope member".
   */
  readonly knownScopes: ReadonlySet<string>;

  /** Set of known struct type names */
  readonly knownStructs: ReadonlySet<string>;

  /** Set of known register names (ADR-004) */
  readonly knownRegisters: ReadonlySet<string>;

  /** Set of known enum type names (ADR-017) */
  readonly knownEnums: ReadonlySet<string>;

  /** Set of known bitmap type names (ADR-034) */
  readonly knownBitmaps: ReadonlySet<string>;

  // === Scope Information ===

  /**
   * Members of each scope: scope `cnxScopedName` -> Set of member names.
   *
   * #1295: the key is the scope's whole dotted source path, not its leaf. See
   * `knownScopes` above for why that is stated rather than enforced.
   *
   * Per-file, unlike its two siblings: `VisibleSymbols` merges `knownScopes`
   * and `scopeMemberVisibility` across includes and does NOT merge this one.
   */
  readonly scopeMembers: ReadonlyMap<string, ReadonlySet<string>>;

  /** Visibility of scope members: scope `cnxScopedName` -> (memberName -> visibility) */
  readonly scopeMemberVisibility: ReadonlyMap<
    string,
    ReadonlyMap<string, "public" | "private">
  >;

  // === Struct Information ===

  /** Struct field types: structName -> (fieldName -> typeName) */
  readonly structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Fields that are arrays: structName -> Set of array field names */
  readonly structFieldArrays: ReadonlyMap<string, ReadonlySet<string>>;

  /**
   * ADR-030 / #1744: fields held through a pointer because their type is an
   * opaque C handle -- `IStructFieldSymbol.isOpaqueHandle`, the one decision
   * the `.h`, the `.c` and every argument naming the field read.
   */
  readonly structFieldHandles: ReadonlyMap<string, ReadonlySet<string>>;

  /**
   * Array dimensions for struct fields: structName -> (fieldName -> dimensions)
   *
   * A dimension is a number when it folds at compile time, or a string when it
   * does not -- an enum-qualified count such as `EColor__COUNT`, already
   * resolved to its generated C name. Issue #1127: this was `readonly number[]`
   * and non-numeric dimensions were filtered out, so `u8[EColor.COUNT] slots`
   * reached the header as a scalar.
   */
  readonly structFieldDimensions: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly (number | string)[]>
  >;

  // === Enum Information (ADR-017) ===

  /** Enum members and values: enumName -> (memberName -> value) */
  readonly enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>;

  /**
   * The C name 3-Declare gave each enum and register member:
   * ownerCName -> (memberName -> member's `fullyQualifiedCName`). Rendering
   * reads a member's name here rather than spelling it again (#2116).
   */
  readonly memberCNames: ReadonlyMap<string, ReadonlyMap<string, string>>;

  // === Bitmap Information (ADR-034) ===

  /** Bitmap field info: bitmapName -> (fieldName -> {offset, width}) */
  readonly bitmapFields: ReadonlyMap<
    string,
    ReadonlyMap<string, IBitmapFieldLayout>
  >;

  /** Backing type for each bitmap: bitmapName -> typeName (e.g., "uint8_t") */
  readonly bitmapBackingType: ReadonlyMap<string, string>;

  /** Bit width for each bitmap: bitmapName -> bitWidth (e.g., 8, 16, 24, 32) */
  readonly bitmapBitWidth: ReadonlyMap<string, number>;

  // === Register Information (ADR-004) ===

  /** Scoped registers: "scopeName.registerName" -> address expression */
  readonly scopedRegisters: ReadonlyMap<string, TExpression>;

  /** Register member access patterns: "scope.reg.field" -> access code */
  readonly registerMemberAccess: ReadonlyMap<string, string>;

  // Issue #187: Register address info for width-appropriate memory access
  /** Register base addresses: registerName -> base address expression */
  readonly registerBaseAddresses: ReadonlyMap<string, TExpression>;

  /** Register member offsets: "reg_member" -> offset expression */
  readonly registerMemberOffsets: ReadonlyMap<string, TExpression>;

  /** Register member C types: "reg_member" -> C type (e.g., "uint32_t") */
  readonly registerMemberCTypes: ReadonlyMap<string, string>;

  // === Function Return Types ===

  /**
   * Function return types: "functionName" -> return type string.
   * Used to determine enum types for function call expressions.
   * Keys are full function names (e.g., "Motor_getMode" for scope methods, "getState" for globals).
   */
  readonly functionReturnTypes: ReadonlyMap<string, string>;

  /*
   * `hasPublicInterface` was here, computed by 1.3 Declare (#1515).
   *
   * "Does this file have a public C interface" is a question about symbols, but
   * "must the generated `.c` include its own header" is a decision about
   * EMISSION -- and `TSymbolInfoAdapter` answered the second by putting the
   * first on the per-file view that codegen reads. That made 1.3 Declare the
   * author of an emission decision, and once `PublicInterface` is placed in 2.2
   * Plan it would have been a `PARSE -> TRANSPILE` edge: a layer crossed
   * backwards, not one pass.
   *
   * The rule did not move -- `PublicInterface` still owns it, and is still the
   * only thing that may derive it. What moved is WHERE it is asked, which is
   * now the point of use.
   */
}

export default ICodeGenSymbols;
