/**
 * ADR-058's length properties, decided once (#1175, #1975 review 2): each
 * names its kind -- a value's (`value_`), a type's declared width (`type_`),
 * or C's memory (`memory_`) -- and its unit. `rule` decides how one is
 * answered for its subject; `of` gives the logical answers.
 *
 * Render writes them into expressions and the constant evaluator folds them
 * into dimensions; both ask here, so `u8[src.type_element_count]` sizes an array
 * by the number `src.type_element_count` reads as. Render alone adds a C header
 * type's width, from a table 1.4 may not read; for one of those a property is
 * not a constant.
 */
import type TConstExpr from "../types/TConstExpr";
import type TCaseLabelSyntax from "../types/syntax/TCaseLabelSyntax";
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import QualifiedCName from "./QualifiedCName";
import type IStructSymbol from "../types/symbols/IStructSymbol";
import type TSymbol from "../types/symbols/TSymbol";
import type IElementWidthFacts from "./types/IElementWidthFacts";
import type ILengthSubject from "./types/ILengthSubject";
import type TLengthRule from "./types/TLengthRule";
import type ILengthName from "./types/ILengthName";
import type TLengthKind from "./types/TLengthKind";
import type TLengthUnit from "./types/TLengthUnit";
import type TType from "../types/TType";

/** ADR-058 (#1975 review 2): a bool is one bit wide; its memory is C's */
const BOOL_BITS = 1;

/** A cnx declaration by C name -- Program's, or what a file can see */
type TSymbolLookup = (cName: string) => TSymbol | undefined;
/** #1975 review: a header type's width, for a cnx field of one; null for none */
type THeaderBits = (typeName: string) => number | null;

const KINDS: ReadonlyArray<TLengthKind> = ["value", "type", "memory"];
const UNITS: ReadonlyArray<TLengthUnit> = [
  "bit_length",
  "byte_length",
  "char_count",
  "element_count",
];

/** ADR-058 (#1975 review 2): the removed names, each to its replacement */
const REMOVED: ReadonlyMap<string, string> = new Map([
  ["bit_length", "type_bit_length"],
  ["byte_length", "type_byte_length"],
  ["char_count", "value_char_count"],
  ["element_count", "type_element_count"],
]);

const LOGICAL: TLengthRule = { kind: "logical" };

/** A string value, as `readsStringNow` asks the rule about one */
const STRING_SUBJECT: ILengthSubject = {
  namesType: false,
  category: "none",
  isString: true,
  isArray: false,
  isStruct: false,
  isBitField: false,
  spelling: "string",
};

class LengthProperty {
  /** The C type an unfolded length's product is taken in (#1760) */
  static readonly PRODUCT_C_TYPE = "uint32_t";

  /** The C helpers a runtime integer length is written with (`HelperGenerator`) */
  static readonly VALUE_BIT_LENGTH = "cnx_value_bit_length";
  static readonly VALUE_CHAR_COUNT = "cnx_value_char_count";
  static readonly VALUE_CHAR_COUNT_SIGNED = "cnx_value_char_count_signed";

  /** The helper a runtime integer length needs, if any: 2.2 plans it, 2.3 emits it */
  /**
   * ADR-058: C's memory of `dimensions` elements, each `element` -- a
   * `sizeof`, or a string buffer's chars -- in uint32_t, for the C compiler
   * to answer for its target. The one C a read (3 Render) and a dimension
   * (`ConstantNames`) write.
   */
  static memoryC(
    element: string,
    dimensions: ReadonlyArray<number | string>,
    bits: boolean,
  ): string {
    const factors = dimensions.map((dim) =>
      typeof dim === "number" ? `${dim}U` : `(${dim})`,
    );
    const product = [element, ...factors, ...(bits ? ["8U"] : [])].join(" * ");
    return `((${LengthProperty.PRODUCT_C_TYPE})${product})`;
  }

  /** A string buffer's chars, its `\0` included (ADR-045 `.size`) */
  static stringBufferChars(capacity: number): number {
    return capacity + 1;
  }

  /** A value's length now: a helper's or strlen's, so no constant */
  static readsAtRuntime(rule: TLengthRule): boolean {
    return (
      rule.kind === "bits" || rule.kind === "decimal" || rule.kind === "string"
    );
  }

  static helperOf(rule: TLengthRule): string | null {
    if (rule.kind === "bits") return LengthProperty.VALUE_BIT_LENGTH;
    if (rule.kind !== "decimal") return null;
    return rule.signed
      ? LengthProperty.VALUE_CHAR_COUNT_SIGNED
      : LengthProperty.VALUE_CHAR_COUNT;
  }

  /**
   * A case label that reads a length, `case Point.type_byte_length`, as the name a
   * constant fold asks about; null for any other label. 2.1 judges it and 2.3
   * writes it by the one fold (#1975 review: it reached the C as
   * `case Point__byte_length:`).
   */
  static labelName(
    label: TCaseLabelSyntax,
  ): Extract<TConstExpr, { kind: "name" }> | null {
    if (label.kind !== "qualified") return null;
    if (!LengthProperty.isLength(label.path.at(-1) ?? "")) return null;
    return {
      kind: "name",
      root: label.root,
      path: label.path,
      at: label.headSpan,
    };
  }

  /** Every kind-named length property, `value_bit_length` to `memory_element_count` */
  static readonly NAMES: ReadonlyArray<string> = KINDS.flatMap((kind) =>
    UNITS.map((unit) => `${kind}_${unit}`),
  );

  /** The removed unprefixed names, each to the property that replaces it */
  static readonly REMOVED = REMOVED;

  /** A kind-named length property's kind and unit; null for any other name */
  static parse(property: string): ILengthName | null {
    for (const kind of KINDS) {
      const unit = property.slice(kind.length + 1);
      if (
        property.startsWith(`${kind}_`) &&
        (UNITS as ReadonlyArray<string>).includes(unit)
      ) {
        return { kind, unit: unit as TLengthUnit };
      }
    }
    return null;
  }

  /** Bits rounded up to the whole bytes that hold them (ADR-058) */
  static bytesFor(bits: number): number {
    return Math.ceil(bits / 8);
  }

  /** Whether a member name reads a length property: a kind-named one, or a removed one */
  static isLength(property: string): boolean {
    return LengthProperty.parse(property) !== null || REMOVED.has(property);
  }

  /**
   * ADR-058's Decision: how `name` is answered for `subject`, or why it
   * cannot be. Analysis reports the errors, 1.4 folds the logical answers,
   * 2.2 plans the runtime ones and 2.3 writes them all, from this one table.
   */
  static rule(name: ILengthName, subject: ILengthSubject): TLengthRule {
    const { kind, unit } = name;
    const property = `.${kind}_${unit}`;
    const on = subject.spelling;
    if (kind === "value" && subject.namesType) {
      return LengthProperty.error(
        `${property} measures a value, and '${on}' is a type`,
        `Use .type_${unit} for the type's length.`,
      );
    }
    if (unit === "element_count") {
      return subject.isArray || subject.isStruct
        ? LOGICAL
        : LengthProperty.error(
            `${property} is only available on arrays and structs, not on '${on}'`,
            "A scalar has one value; use .type_bit_length or .type_byte_length for its width, or .value_char_count for a string's characters.",
          );
    }
    const scalar = !subject.isArray;
    if (unit === "char_count") return LengthProperty.charRule(kind, subject);
    if (kind === "memory") {
      return subject.isBitField
        ? LengthProperty.error(
            `${property} is not available on the bit-field '${on}'`,
            "A bit-field shares its storage with its neighbors, so it has no memory of its own; ask the struct or bitmap that holds it.",
          )
        : { kind: "memory" };
    }
    if (kind === "type" || !scalar) return LOGICAL;
    if (subject.isString) return { kind: "string" };
    if (subject.category === "signed") {
      return LengthProperty.error(
        `${property} is not available on the signed '${on}'`,
        `A signed value's top bit is its sign; cast it to an unsigned type first, e.g. ((u32)x)${property}.`,
      );
    }
    return subject.category === "unsigned" ? { kind: "bits" } : LOGICAL;
  }

  /** The `_char_count` column of `rule` */
  private static charRule(
    kind: TLengthKind,
    subject: ILengthSubject,
  ): TLengthRule {
    const scalar = !subject.isArray;
    if (kind === "type") return { kind: "spelling" };
    if (kind === "memory") {
      return scalar && subject.isString
        ? { kind: "stringBuffer" }
        : LengthProperty.error(
            `.memory_char_count is only available on strings, not on '${subject.spelling}'`,
            "Use .memory_byte_length for the memory a value takes.",
          );
    }
    if (!scalar) return { kind: "spelling" };
    if (subject.isString) return { kind: "string" };
    if (subject.category === "floating") {
      return LengthProperty.error(
        `.value_char_count is not available on the float '${subject.spelling}'`,
        "A float prints in more than one correct way (0.1, 0.100000), and cnx fixes no format, so it has no character count.",
      );
    }
    if (subject.category === "signed" || subject.category === "unsigned") {
      return { kind: "decimal", signed: subject.category === "signed" };
    }
    return { kind: "spelling" };
  }

  private static error(message: string, helpText: string): TLengthRule {
    return { kind: "error", message, helpText };
  }

  /**
   * Whether the property reads a string's characters now -- `strlen`, the
   * read 2.2 caches -- by `rule`'s own answer for a string
   */
  static readsStringNow(property: string): boolean {
    const name = LengthProperty.parse(property);
    return (
      name !== null &&
      LengthProperty.rule(name, STRING_SUBJECT).kind === "string"
    );
  }

  /** The removed name's error help: `.bit_length` is `.type_bit_length` now */
  static removedHelp(property: string): string | null {
    const replacement = REMOVED.get(property);
    return replacement === undefined
      ? null
      : `Use .${replacement} (ADR-058: each length names its kind -- value_, type_ or memory_).`;
  }

  /** The fewest bits that hold every member of an enum; null if one is not known */
  static enumBits(values: Iterable<number | null>): number | null {
    let max = 0;
    for (const value of values) {
      if (value === null || value < 0) return null;
      max = Math.max(max, value);
    }
    return Math.max(1, max.toString(2).length);
  }

  /**
   * The property's value for a value with `dimensions` whose element is
   * `elementBits` wide; null when a dimension or the width is not known here.
   * `_element_count` is the first dimension -- or, of a struct that is not
   * an array, its `fields` count (#1535); the lengths are every element's
   * bits together, and `_byte_length` rounds them up to whole bytes.
   */
  static of(
    unit: TLengthUnit,
    dimensions: ReadonlyArray<number | string>,
    elementBits: number | null,
    fields: number | null = null,
  ): number | null {
    if (unit === "char_count") return null;
    if (unit === "element_count") {
      if (dimensions.length === 0) return fields;
      const first = dimensions[0];
      return typeof first === "number" && first > 0 ? first : null;
    }
    if (elementBits === null || elementBits <= 0) return null;
    let elements = 1;
    for (const dimension of dimensions) {
      if (typeof dimension !== "number" || dimension <= 0) return null;
      elements *= dimension;
    }
    const bits = elements * elementBits;
    return unit === "bit_length" ? bits : LengthProperty.bytesFor(bits);
  }

  /** ADR-058: a `string<N>` is N characters wide; its `\0` is memory */
  static stringElementBits(capacity: number): number {
    return capacity * 8;
  }

  /**
   * A cnx declared type's element width in bits -- the same answer
   * `elementBits` gives render for the type's name; null for a type whose
   * width cnx does not fix (a C header type)
   */
  static elementBitsOfType(
    type: TType,
    lookup: TSymbolLookup,
    headerBits?: THeaderBits,
  ): number | null {
    switch (type.kind) {
      case "struct": {
        const struct = LengthProperty.struct(
          QualifiedCName.fromSourceName(type.name),
          lookup,
        );
        if (struct)
          return LengthProperty.structBits(struct, lookup, headerBits);
        // A header's struct, which a cnx field names as a struct (#1975)
        return headerBits?.(type.name) ?? null;
      }
      case "external":
        // A header's type, measured as the header's own struct is (#1975)
        return headerBits?.(type.name) ?? null;
      case "primitive":
        return type.primitive === "bool"
          ? BOOL_BITS
          : (TYPE_WIDTH[type.primitive] ?? null);
      case "enum": {
        const symbol = lookup(QualifiedCName.fromSourceName(type.name));
        return symbol?.kind === "enum"
          ? LengthProperty.enumBits(
              [...symbol.members.values()].map((member) => member.value),
            )
          : null;
      }
      case "bitmap":
        return type.bitWidth;
      case "string":
        return LengthProperty.stringElementBits(type.capacity);
      default:
        return null;
    }
  }

  /**
   * A field's dimensions as the program subscripts them. A string field's
   * symbol carries its C buffer, capacity + 1, as its LAST dimension
   * (`char name[33]`), which a `string<32>` variable's type does not; the
   * buffer is the string's own, typed by its capacity, so it is left off.
   * The typer, 1.4's constants and a struct's length all read fields so.
   */
  static fieldDimensions(
    type: TType,
    dimensions: ReadonlyArray<number | string>,
  ): ReadonlyArray<number | string> {
    if (type.kind !== "string" || dimensions.length === 0) return dimensions;
    return dimensions.at(-1) === type.capacity + 1
      ? dimensions.slice(0, -1)
      : dimensions;
  }

  /** A cnx struct by C name; undefined for any other name */
  static struct(
    cName: string,
    lookup: TSymbolLookup,
  ): IStructSymbol | undefined {
    const symbol = lookup(cName);
    return symbol?.kind === "struct" ? symbol : undefined;
  }

  /**
   * ADR-058 resolved question 7 (#1535): a struct's fields' bits together,
   * without C padding -- `struct P { u32 x; u8 y; }` is 40 bits where C
   * stores 64. Null when a field's width is not cnx's to fix.
   */
  static structBits(
    struct: IStructSymbol,
    lookup: TSymbolLookup,
    headerBits?: THeaderBits,
  ): number | null {
    let bits = 0;
    for (const field of struct.fields.values()) {
      const fieldBits = LengthProperty.of(
        "bit_length",
        LengthProperty.fieldDimensions(field.type, field.dimensions ?? []),
        LengthProperty.elementBitsOfType(field.type, lookup, headerBits),
      );
      if (fieldBits === null) return null;
      bits += fieldBits;
    }
    return bits;
  }

  /** An element type's width in bits, from cnx's own types; null if unknown */
  static elementBits(
    typeName: string,
    facts: IElementWidthFacts,
  ): number | null {
    if (typeName === "bool") return BOOL_BITS;
    return (
      TYPE_WIDTH[typeName] ??
      facts.enumBitWidth(typeName) ??
      facts.enumBits(typeName) ??
      facts.bitmapBitWidth(typeName)
    );
  }
}

export default LengthProperty;
