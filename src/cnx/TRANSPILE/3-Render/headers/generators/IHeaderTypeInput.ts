import type IBitmapFieldLayout from "../../../../types/IBitmapFieldLayout";
import type IResolvedSymbols from "../../../../types/IResolvedSymbols";
import IHeaderCallbackType from "../../../../types/IHeaderCallbackType";

/**
 * Input interface for header type generators.
 * Provides read-only access to symbol data needed for generating
 * type definitions in C headers.
 *
 * This interface is a subset of ISymbolInfo, containing only
 * the data needed for generating enums, structs, and bitmaps.
 */
interface IHeaderTypeInput {
  /** Issue #502: Optional IResolvedSymbols for C++ type detection */
  readonly symbolTable?: IResolvedSymbols;
  /** Enum members and values: enumName -> (memberName -> value) */
  readonly enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>;

  /** Each enum member's 3-Declare C name (`ICodeGenSymbols.memberCNames`) */
  readonly memberCNames: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** Struct field types: structName -> (fieldName -> typeName) */
  readonly structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;

  /** #1744: fields held through a pointer (`ICodeGenSymbols.structFieldHandles`) */
  readonly structFieldHandles?: ReadonlyMap<string, ReadonlySet<string>>;

  /** Array dimensions for struct fields: structName -> (fieldName -> dimensions) */
  readonly structFieldDimensions: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly (number | string)[]>
  >;

  /** Backing type for each bitmap: bitmapName -> typeName (e.g., "uint8_t") */
  readonly bitmapBackingType: ReadonlyMap<string, string>;

  /** Bitmap field info: bitmapName -> (fieldName -> {offset, width}) */
  readonly bitmapFields: ReadonlyMap<
    string,
    ReadonlyMap<string, IBitmapFieldLayout>
  >;

  /** Callback types: functionName -> typedef info for header generation */
  readonly callbackTypes?: ReadonlyMap<string, IHeaderCallbackType>;
}

export default IHeaderTypeInput;
