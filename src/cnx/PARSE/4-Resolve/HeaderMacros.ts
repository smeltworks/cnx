/**
 * #1688: the object-like macros a file sees, each typed from its replacement
 * tokens (ADR-024). A `#define` never reaches the symbol model -- a header is
 * parsed raw or preprocessed, and either way its directives are gone -- so a
 * macro operand had no type, and `u32 i * SCALE_F` was routed into the
 * integer clamp helper.
 *
 * Read from the preprocessor's macro dump (`-dM`) of the file's C includes,
 * which has already applied comments, line splicing, `#if`, `#undef`, system
 * headers and the compiler's builtins: one definition per name, the one C
 * sees.
 */
import UnreadBitWidth from "../../utils/UnreadBitWidth";
import type IUnreadBitWidth from "../../types/IUnreadBitWidth";
import type IMacroReader from "./types/IMacroReader";
import LiteralUtils from "../../utils/LiteralUtils";
import TARGET_DESCRIPTION_FIELDS from "../2-Parse/TARGET_DESCRIPTION_FIELDS";
import type THeaderMacro from "../../types/THeaderMacro";

type TFloatingTypeName = "f32" | "f64" | null;

type TMacroToken =
  | { readonly kind: "floating"; readonly typeName: TFloatingTypeName }
  | { readonly kind: "integer"; readonly text: string }
  | { readonly kind: "character" }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "paren"; readonly text: string }
  | { readonly kind: "operator"; readonly text: string }
  | { readonly kind: "other" };

/** #1881: `#define NAME`, of either kind */
const ANY_DEFINE = /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)/gm;

/** `#define NAME body`; a function-like macro's `(` follows its name directly */
const OBJECT_LIKE_DEFINE =
  /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)(?:[ \t](.*))?$/gm;

const FLOATING_LITERAL = String.raw`0[xX][0-9a-fA-F]*\.?[0-9a-fA-F]*[pP][+-]?\d+[fFlL]?|(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?[fFlL]?|\d+[eE][+-]?\d+[fFlL]?`;
const INTEGER_LITERAL = String.raw`0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|\d+[uUlL]*`;
/** The operators an integer expansion may hold: arithmetic and bitwise */
const INTEGER_OPERATOR = "<<|>>|[-+*/%&|^~]";
/** A character constant, `'A'` or `'\\n'`; a prefixed one (`L'A'`) is not read */
const CHARACTER_LITERAL = String.raw`'(?:\\.|[^'\\])+'`;

/** One token per match; `other` takes any character no other group does */
const MACRO_TOKEN = new RegExp(
  String.raw`\s+|(${FLOATING_LITERAL})|(${INTEGER_LITERAL})|([A-Za-z_]\w*)|(${INTEGER_OPERATOR})|([()])|(${CHARACTER_LITERAL})|(.)`,
  "g",
);

/** C's binary operators an integer expansion may hold, loosest first */
const BINARY_PRECEDENCE: readonly (readonly string[])[] = [
  ["|"],
  ["^"],
  ["&"],
  ["<<", ">>"],
  ["+", "-"],
  ["*", "/", "%"],
];
/**
 * Each `int` width a target may have (#1283 review): a value is read once per
 * width, since a step past the target's `INT_MAX` is what its C gets wrong.
 */
const INT_BITS: readonly number[] = TARGET_DESCRIPTION_FIELDS.int_bits.allowed!;

/** The most tokens a macro's expansion is read to (#2494 review) */
const MAX_EXPANSION = 4096;

const UNREADABLE: THeaderMacro = { kind: "unreadable" };
const CHARACTER: THeaderMacro = { kind: "character" };

/** A read through one expansion's tokens */
interface IValueReader {
  readonly tokens: readonly TMacroToken[];
  next: number;
  /** The target `int`'s largest value: `int`, `unsigned` and `long` agree up to it */
  readonly intMax: number;
  readonly macroValue: (name: string) => number | null;
}

class HeaderMacros {
  /**
   * #1619: the C type the compiler gives each `<stdint.h>`/`<stddef.h>`
   * integer name its predefined macros define: `uint32_t` is
   * `long unsigned int` under arm-none-eabi-gcc and `unsigned int` under
   * x86-64 gcc.
   */
  static integerTypes(dump: string): ReadonlyMap<string, string> {
    const types = new Map<string, string>();
    for (const line of dump.split("\n")) {
      if (!line.startsWith("#define __")) continue;
      const space = line.indexOf(" ", 8);
      if (space < 0) continue;
      const macro = line.slice(8, space);
      if (!macro.startsWith("__") || !macro.endsWith("_TYPE__")) continue;
      const typedefName = HeaderMacros.integerTypedefName(macro.slice(2, -7));
      if (typedefName !== null) {
        types.set(typedefName, line.slice(space + 1).trim());
      }
    }
    return types;
  }

  /**
   * The `<stdint.h>`/`<stddef.h>` name a `__<STEM>_TYPE__` macro is the C
   * type of: `UINT32` is `uint32_t`, `INT_LEAST8` is `int_least8_t`, `SIZE`
   * is `size_t`; null for a stem no such name has (`CHAR16`, `WCHAR`).
   */
  private static integerTypedefName(stem: string): string | null {
    if (stem === "SIZE") return "size_t";
    if (stem === "PTRDIFF") return "ptrdiff_t";
    const unsigned = stem.startsWith("U");
    const rest = unsigned ? stem.slice(1) : stem;
    if (!rest.startsWith("INT")) return null;
    const kind = rest.slice(3);
    const prefix = unsigned ? "uint" : "int";
    if (kind === "PTR" || kind === "MAX")
      return `${prefix}${kind.toLowerCase()}_t`;
    for (const family of ["", "_LEAST", "_FAST"]) {
      const width = kind.startsWith(family) ? kind.slice(family.length) : null;
      if (width !== null && ["8", "16", "32", "64"].includes(width)) {
        return `${prefix}${family.toLowerCase()}${width}_t`;
      }
    }
    return null;
  }

  /** #1881: every macro a dump defines, object-like or function-like */
  static names(dump: string): string[] {
    return [...dump.matchAll(ANY_DEFINE)].map((match) => match[1]);
  }

  /**
   * #2494: a C integer constant expression's value -- a bit-field's width,
   * `1 + 2` or `MODE_BITS` -- read as C reads it, its macros expanded as
   * text through the bodies each file's C includes define. Null where cnx
   * cannot read it, where two files' macros give it two values, or where its
   * value depends on the target's `int` width -- or where it reads a macro a
   * header `#undef`s, whose final body may not be the one C read here.
   */
  static integerValue(
    text: string,
    bodiesByFile: Iterable<ReadonlyMap<string, string>>,
    undefinedNames: ReadonlySet<string>,
  ): number | null {
    const width = HeaderMacros.width(
      text,
      [...bodiesByFile].map((bodies) => ({ file: "", bodies })),
      undefinedNames,
    );
    return typeof width === "number" ? width : null;
  }

  /**
   * #2484 review: `integerValue`, read through the macros of each file that
   * defines every macro the text names, and where it cannot be read, why
   */
  static width(
    text: string,
    readers: readonly IMacroReader[],
    undefinedNames: ReadonlySet<string>,
  ): number | IUnreadBitWidth {
    const tokens = HeaderMacros.tokens(text);
    const names = tokens.flatMap((token) =>
      token.kind === "name" ? [token.name] : [],
    );
    // A file whose includes define none of its macros does not read it
    const files =
      names.length === 0
        ? [{ file: "", bodies: new Map<string, string>() }]
        : readers.filter((reader) =>
            names.every((name) => reader.bodies.has(name)),
          );
    const readings: { file: string; value: number }[] = [];
    for (const reader of files) {
      const failure = { undefinedName: null as string | null };
      const expanded = HeaderMacros.expanded(
        tokens,
        reader.bodies,
        new Set(),
        undefinedNames,
        failure,
      );
      if (failure.undefinedName !== null) {
        return UnreadBitWidth.undefinedMacro(failure.undefinedName);
      }
      const values = INT_BITS.map((bits) =>
        expanded === null
          ? null
          : HeaderMacros.valueOf(expanded, 2 ** (bits - 1) - 1, () => null),
      );
      const value = values[0];
      if (values.every((each) => each === null)) {
        return UnreadBitWidth.unreadable();
      }
      if (value === null || values.some((each) => each !== value)) {
        return UnreadBitWidth.intWidth();
      }
      readings.push({ file: reader.file, value });
    }
    if (readings.length === 0) return UnreadBitWidth.unreadable();
    const other = readings.find(
      (reading) => reading.value !== readings[0].value,
    );
    return other === undefined
      ? readings[0].value
      : UnreadBitWidth.files(names, readings[0], other);
  }

  /**
   * #2494 review: tokens with each macro replaced by its body, as the
   * preprocessor substitutes text -- so `W * 2` with `#define W 1 + 2` is
   * `1 + 2 * 2`, 5, as C reads it, not 6. Null for a cycle, or an expansion
   * past `MAX_EXPANSION` tokens, or a name in `undefinedNames`; a name no macro
   * defines stays a name.
   */
  private static expanded(
    tokens: readonly TMacroToken[],
    bodies: ReadonlyMap<string, string>,
    expanding: ReadonlySet<string>,
    undefinedNames: ReadonlySet<string> = new Set(),
    failure: { undefinedName: string | null } = { undefinedName: null },
  ): TMacroToken[] | null {
    const out: TMacroToken[] = [];
    for (const token of tokens) {
      if (token.kind === "name" && undefinedNames.has(token.name)) {
        failure.undefinedName = token.name;
        return null;
      }
      const body = token.kind === "name" ? bodies.get(token.name) : undefined;
      if (token.kind !== "name" || body === undefined) {
        out.push(token);
        continue;
      }
      if (expanding.has(token.name)) return null;
      const inner = HeaderMacros.expanded(
        HeaderMacros.tokens(body),
        bodies,
        new Set([...expanding, token.name]),
        undefinedNames,
        failure,
      );
      if (inner === null) return null;
      out.push(...inner);
      if (out.length > MAX_EXPANSION) return null;
    }
    return out;
  }

  /** Every object-like macro a `-dM` dump defines, by name, to its body */
  static bodies(dump: string): ReadonlyMap<string, string> {
    const bodies = new Map<string, string>();
    for (const match of dump.matchAll(OBJECT_LIKE_DEFINE)) {
      bodies.set(match[1], (match[2] ?? "").trim());
    }
    return bodies;
  }

  /** Every object-like macro a `-dM` dump defines, by name */
  static collect(dump: string): ReadonlyMap<string, THeaderMacro> {
    const bodies = HeaderMacros.bodies(dump);
    const typed = new Map<string, THeaderMacro>();
    for (const name of bodies.keys()) {
      HeaderMacros.typeOf(name, bodies, typed, new Set());
    }
    return typed;
  }

  /**
   * A macro's type, following the macros its expansion names. A cycle --
   * `#define stdin stdin` -- expands to a name no macro defines, so it is
   * unreadable, as is every macro on it.
   */
  private static typeOf(
    name: string,
    bodies: ReadonlyMap<string, string>,
    typed: Map<string, THeaderMacro>,
    expanding: Set<string>,
  ): THeaderMacro {
    const known = typed.get(name);
    if (known !== undefined) return known;
    const body = bodies.get(name);
    if (body === undefined || expanding.has(name)) return UNREADABLE;
    expanding.add(name);
    const result = HeaderMacros.typeOfBody(body, bodies, typed, expanding);
    expanding.delete(name);
    typed.set(name, result);
    return result;
  }

  private static typeOfBody(
    body: string,
    bodies: ReadonlyMap<string, string>,
    typed: Map<string, THeaderMacro>,
    expanding: Set<string>,
  ): THeaderMacro {
    const tokens = HeaderMacros.tokens(body);
    const kinds = tokens
      .filter((token) => token.kind !== "paren")
      .map((token) =>
        token.kind === "name"
          ? HeaderMacros.typeOf(token.name, bodies, typed, expanding)
          : token,
      );
    // A cast or call decides the type whatever it holds, so a floating
    // literal inside one does not make the expansion floating (#1688 review)
    const unreadable = kinds.some(
      (kind) => kind.kind === "unreadable" || kind.kind === "other",
    );
    if (unreadable || kinds.length === 0) return UNREADABLE;
    // A character constant alone, parenthesized or not, is one as written
    // inline; mixed with anything else, its type is not read (#1688 review)
    if (kinds.some((kind) => kind.kind === "character")) {
      return kinds.length === 1 ? CHARACTER : UNREADABLE;
    }
    const floating = kinds.flatMap((kind) =>
      kind.kind === "floating" ? [kind.typeName] : [],
    );
    if (floating.length > 0) {
      return {
        kind: "floating",
        typeName: HeaderMacros.usualFloating(floating),
      };
    }
    // #2494 review: its macros as text, so precedence is the expansion's
    const expanded = HeaderMacros.expanded(tokens, bodies, new Set());
    return {
      kind: "integer",
      valueByIntBits: new Map(
        INT_BITS.map((bits) => [
          bits,
          expanded === null
            ? null
            : HeaderMacros.valueOf(expanded, 2 ** (bits - 1) - 1, () => null),
        ]),
      ),
    };
  }

  /**
   * #1283 review: an integer expansion's value, read the way C reads it, or
   * null. Every operand and every step must stay in `0..intMax`, the target
   * `int`'s largest value: there `int`, `unsigned` and `long` arithmetic all
   * give the exact result, so the value does not depend on which of them C
   * picks. The names it holds are macros
   * already typed (`typeOf` follows them first).
   */
  private static valueOf(
    tokens: readonly TMacroToken[],
    intMax: number,
    macroValue: (name: string) => number | null,
  ): number | null {
    const reader = { tokens, next: 0, intMax, macroValue };
    const value = HeaderMacros.binary(reader, 0);
    return reader.next === tokens.length ? value : null;
  }

  private static binary(reader: IValueReader, level: number): number | null {
    if (level === BINARY_PRECEDENCE.length) {
      return HeaderMacros.unary(reader);
    }
    let left = HeaderMacros.binary(reader, level + 1);
    for (;;) {
      const token = reader.tokens[reader.next];
      if (
        token?.kind !== "operator" ||
        !BINARY_PRECEDENCE[level].includes(token.text)
      ) {
        return left;
      }
      reader.next++;
      const right = HeaderMacros.binary(reader, level + 1);
      left =
        left === null || right === null
          ? null
          : HeaderMacros.inRange(
              HeaderMacros.apply(token.text, left, right),
              reader.intMax,
            );
    }
  }

  private static unary(reader: IValueReader): number | null {
    const token = reader.tokens[reader.next++];
    switch (token?.kind) {
      case "integer":
        return HeaderMacros.inRange(
          HeaderMacros.literalValue(token.text),
          reader.intMax,
        );
      case "name":
        return reader.macroValue(token.name);
      case "operator": {
        const operand = HeaderMacros.unary(reader);
        if (operand === null) return null;
        if (token.text === "+") return operand;
        // `-x` and `~x` leave the range for every x but `-0`
        return token.text === "-"
          ? HeaderMacros.inRange(-operand, reader.intMax)
          : null;
      }
      case "paren": {
        if (token.text !== "(") return null;
        const inner = HeaderMacros.binary(reader, 0);
        const close = reader.tokens[reader.next++];
        return close?.kind === "paren" && close.text === ")" ? inner : null;
      }
      default:
        return null;
    }
  }

  private static apply(operator: string, left: number, right: number): number {
    switch (operator) {
      case "|":
        return left | right;
      case "^":
        return left ^ right;
      case "&":
        return left & right;
      case "<<":
        return right < 31 ? left * 2 ** right : Number.NaN;
      case ">>":
        return right < 31 ? Math.floor(left / 2 ** right) : Number.NaN;
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? Number.NaN : Math.trunc(left / right);
      default:
        return right === 0 ? Number.NaN : left % right;
    }
  }

  private static inRange(value: number, intMax: number): number | null {
    return Number.isInteger(value) && value >= 0 && value <= intMax
      ? value
      : null;
  }

  /** An integer literal's value as C reads it; NaN for one it cannot read */
  private static literalValue(literal: string): number {
    return LiteralUtils.cIntegerLiteral(literal) ?? Number.NaN;
  }

  private static tokens(body: string): TMacroToken[] {
    const tokens: TMacroToken[] = [];
    for (const match of body.matchAll(MACRO_TOKEN)) {
      if (match[1] !== undefined) {
        tokens.push({
          kind: "floating",
          typeName: HeaderMacros.literalType(match[1]),
        });
      } else if (match[2] !== undefined) {
        tokens.push({ kind: "integer", text: match[2] });
      } else if (match[3] !== undefined) {
        tokens.push({ kind: "name", name: match[3] });
      } else if (match[4] !== undefined) {
        tokens.push({ kind: "operator", text: match[4] });
      } else if (match[5] !== undefined) {
        tokens.push({ kind: "paren", text: match[5] });
      } else if (match[6] !== undefined) {
        tokens.push({ kind: "character" });
      } else if (match[7] !== undefined) {
        tokens.push({ kind: "other" });
      }
    }
    return tokens;
  }

  /** A floating literal's C type: `f` is float, `l` long double, none double */
  private static literalType(literal: string): TFloatingTypeName {
    const suffix = literal.at(-1)?.toLowerCase();
    // A hex literal's digits include `f`; only one with an exponent is floating
    if (suffix === "f" && !/[xX]/.test(literal)) return "f32";
    if (suffix === "f" && /[pP][+-]?\d+[fF]$/.test(literal)) return "f32";
    if (suffix === "l") return null;
    return "f64";
  }

  /** C's usual arithmetic conversions over the floating leaves */
  private static usualFloating(
    leaves: readonly TFloatingTypeName[],
  ): TFloatingTypeName {
    if (leaves.includes(null)) return null;
    return leaves.includes("f64") ? "f64" : "f32";
  }
}

export default HeaderMacros;
