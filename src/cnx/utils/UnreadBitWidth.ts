import type IUnreadBitWidth from "../types/IUnreadBitWidth";

/**
 * The causes of an unread bit-field width (#2494), each named with what
 * would let cnx read it (#2484 review)
 */
class UnreadBitWidth {
  /** `f : sizeof(uint8_t)`: no form cnx evaluates */
  static unreadable(): IUnreadBitWidth {
    return {
      why: "it is not written as integer literals, arithmetic and bitwise operators, parentheses and macros of them, which cnx reads",
      help: "Write the width in its header as an integer constant cnx reads (ADR-034).",
    };
  }

  /** A macro some header `#undef`s: cnx sees only its last definition */
  static undefinedMacro(name: string): IUnreadBitWidth {
    return {
      why: `it reads ${name}, which a header removes with #undef, and cnx sees only the macro's last definition, not the one C read here`,
      help: `Give the width a macro no header removes with #undef, or write it as an integer constant (ADR-034).`,
    };
  }

  /** A value that depends on the target's `int` width */
  static intWidth(): IUnreadBitWidth {
    return {
      why: "its value depends on the target's int width",
      help: "Write the width so it has one value for a 16-bit and a 32-bit int (ADR-034).",
    };
  }

  /** Two files that include the header give its macros two values */
  static files(
    names: readonly string[],
    first: { readonly file: string; readonly value: number },
    second: { readonly file: string; readonly value: number },
  ): IUnreadBitWidth {
    return {
      why: `${names.join(", ")} gives it ${first.value} in ${UnreadBitWidth.fileName(first.file)} and ${second.value} in ${UnreadBitWidth.fileName(second.file)}`,
      help: "Give the width's macros one value in every file that includes its header (ADR-034).",
    };
  }

  /** A file as a message names it: its last path segment */
  private static fileName(file: string): string {
    return file.split(/[\\/]/).at(-1) ?? file;
  }
}

export default UnreadBitWidth;
