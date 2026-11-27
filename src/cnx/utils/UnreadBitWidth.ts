import type IUnreadBitWidth from "../types/IUnreadBitWidth";

/**
 * The causes of an unread bit-field width (#2494), each named with what
 * would let cnx read it (#2484 review)
 */
class UnreadBitWidth {
  /** `f : sizeof(uint8_t)`: no form cnx evaluates */
  static unreadable(): IUnreadBitWidth {
    return {
      why: "it is not written as integer literals, arithmetic, bitwise and logical operators, parentheses and macros of them, which cnx reads",
      help: "Write the width in its header as an integer constant cnx reads (ADR-034).",
    };
  }

  /** #2484 review: no file that includes its header had its macros read */
  static unreadMacros(names: readonly string[]): IUnreadBitWidth {
    return {
      why: `it reads ${names.join(", ")}, and cnx read no macros of the files that include its header`,
      help: "Include the header from a file cnx transpiles, or write the width as an integer constant (ADR-034).",
    };
  }

  /** A macro some header `#undef`s: cnx sees only its last definition */
  static undefinedMacro(name: string): IUnreadBitWidth {
    return {
      why: `it reads ${name}, which a header removes with #undef, and cnx sees only the macro's last definition, not the one C read here`,
      help: `Give the width a macro no header removes with #undef, or write it as an integer constant (ADR-034).`,
    };
  }

  /**
   * #2510 review: a macro named like a header declaration -- C reads the
   * declaration where the macro is defined later, and the dump holds the macro
   */
  static declaredMacro(name: string): IUnreadBitWidth {
    return {
      why: `it reads ${name}, which a header both declares and defines as a macro, and cnx cannot tell which one C read here`,
      help: `Give the macro a name no header declares, or write the width as an integer constant (ADR-034).`,
    };
  }

  /**
   * #2510 review: a macro a header defines again to another body without an
   * `#undef` -- C reads the first body before the second, the dump only the
   * second
   */
  /** #2510 review: a header array's macro count C has no array of */
  static notPositiveCount(count: number): IUnreadBitWidth {
    return {
      why: `it is ${count}, and a C array has one element or more (C99 6.7.5.2)`,
      help: "Give the header's array a dimension of 1 or more (ADR-036).",
    };
  }

  static redefinedMacro(name: string): IUnreadBitWidth {
    return {
      why: `it reads ${name}, which a header defines again to another value, and cnx sees only the macro's last definition, not the one C read here`,
      help: `Give the width a macro defined once, or write it as an integer constant (ADR-034).`,
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
