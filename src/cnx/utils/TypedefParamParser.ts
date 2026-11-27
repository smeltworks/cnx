/**
 * TypedefParamParser - Parses C function pointer typedef signatures
 *
 * Extracts parameter types from typedef strings like:
 *   "void (*)(widget_t *, const rect_t *, uint8_t *)"
 *   "void (*)(Point p)"
 *
 * Used by Issue #895 to determine if callback params should be pointers or values.
 */

/**
 * Parsed parameter info from a typedef.
 */
interface ITypedefParam {
  /** Full type string (e.g., "widget_t *", "const rect_t *", "uint8_t *") */
  type: string;
  /** Whether this is a pointer type */
  isPointer: boolean;
  /** Whether this has const qualifier */
  isConst: boolean;
  /** Base type without pointer/const (e.g., "widget_t", "rect_t", "uint8_t") */
  baseType: string;
}

/**
 * Parse result for a typedef signature.
 */
interface ITypedefParseResult {
  /** Return type */
  returnType: string;
  /** Parsed parameters */
  params: ITypedefParam[];
  /** Declared `()`: C takes any arguments, where `(void)` takes none */
  isUnprototyped?: boolean;
}

/**
 * C type keywords that can trail a multi-word type. A parameter name can never
 * be one of these, so a trailing word from this set belongs to the type.
 */
const TRAILING_TYPE_KEYWORDS = new Set([
  "int",
  "long",
  "short",
  "char",
  "float",
  "double",
  "signed",
  "unsigned",
]);

/**
 * Drop a trailing space-separated parameter name, as /\s+\w+$/ did -- except
 * for a trailing type keyword, which belongs to the type (#1189).
 *
 * Scanned from the end rather than matched, avoiding the super-linear
 * backtracking of /\s+\w+$/ (S8786).
 *
 * The word-character check is load-bearing: \w+ does not match a final token
 * containing anything else, so "int (fn)(void)" -- what a function-pointer
 * parameter looks like once the stars are stripped -- is left alone. Cutting
 * at the last space unconditionally would reduce it to "int".
 */
function stripTrailingIdentifier(text: string): string {
  let start = text.length;
  while (start > 0 && /\w/.test(text[start - 1])) {
    start -= 1;
  }
  if (start === text.length) {
    return text; // no trailing identifier
  }
  // Issue #1189: an unnamed multi-word type ends in a type keyword, not a
  // parameter name -- `unsigned int` must not become `unsigned`.
  if (TRAILING_TYPE_KEYWORDS.has(text.slice(start))) {
    return text;
  }

  // Consume the whole whitespace run, not just the last space. The caller
  // normalizes runs to a single space today, but depending on that would make
  // this correct only by coincidence.
  let cut = start;
  while (cut > 0 && /\s/.test(text[cut - 1])) {
    cut -= 1;
  }
  return cut === start ? text : text.slice(0, cut);
}

class TypedefParamParser {
  /**
   * Parse a function pointer typedef type string.
   *
   * @param typedefType - The type string, e.g., "void (*)(widget_t *, const rect_t *, uint8_t *)"
   * @returns Parsed result with return type and parameters, or null if parsing fails
   */
  static parse(typedefType: string): ITypedefParseResult | null {
    // Expected format: "return_type (*)(param1, param2, ...)"
    // Find the (*) marker first
    const funcPtrIndex = typedefType.indexOf("(*)");
    if (funcPtrIndex === -1) {
      return null;
    }

    const returnType = typedefType.substring(0, funcPtrIndex).trim();

    // Find the opening paren after (*)
    const afterFuncPtr = typedefType.substring(funcPtrIndex + 3).trim();
    if (!afterFuncPtr.startsWith("(")) {
      return null;
    }

    // Extract params by finding the matching closing paren
    const paramsStr = TypedefParamParser.extractParenContent(afterFuncPtr);
    if (paramsStr === null) {
      return null;
    }

    // Handle void or empty params
    if (!paramsStr || paramsStr === "void") {
      return { returnType, params: [], isUnprototyped: !paramsStr };
    }

    // Split by comma, handling nested parentheses
    const paramStrings = TypedefParamParser.splitParams(paramsStr);
    const params = paramStrings.map((p) => TypedefParamParser.parseParam(p));

    return { returnType, params };
  }

  /**
   * Extract content between matching parentheses, handling arbitrary nesting.
   * @param str - String starting with '('
   * @returns Content between outer parens, or null if no match
   */
  private static extractParenContent(str: string): string | null {
    if (!str.startsWith("(")) {
      return null;
    }

    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === "(") {
        depth++;
      } else if (str[i] === ")") {
        depth--;
        if (depth === 0) {
          // Found matching close paren - return content between
          return str.substring(1, i);
        }
      }
    }

    // No matching close paren found
    return null;
  }

  /**
   * Split parameter string by commas, respecting nested parentheses.
   */
  private static splitParams(paramsStr: string): string[] {
    const params: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramsStr) {
      if (char === "(") {
        depth++;
        current += char;
      } else if (char === ")") {
        depth--;
        current += char;
      } else if (char === "," && depth === 0) {
        params.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      params.push(current.trim());
    }

    return params;
  }

  /**
   * Parse a single parameter type string.
   */
  private static parseParam(paramStr: string): ITypedefParam {
    const trimmed = paramStr.trim();

    // Check for pointer
    const isPointer = trimmed.includes("*");

    // Check for const - handles both "const " (with space) and merged forms
    // C grammar getText() strips spaces, so "const rect_t*" may appear merged.
    // A pointer's is the pointee's, before its first `*`: `uint8_t* const
    // buf` is a const pointer to writable bytes (#2348 review).
    const pointee = isPointer
      ? trimmed.slice(0, trimmed.indexOf("*"))
      : trimmed;
    const isConst = /\bconst\b/.test(pointee) || pointee.startsWith("const");

    // Extract base type (remove const, *, and param name if present)
    let baseType = trimmed
      .replaceAll(/\bconst\b/g, "") // Remove const (with word boundary)
      .replace(/^const/, "") // Remove const at start (no space case) - only once
      .replaceAll("*", "") // Remove pointers
      .replaceAll(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Remove trailing param name if present (e.g., "rect_t area" -> "rect_t")
    // Only remove if there are multiple words (space-separated)
    if (baseType.includes(" ")) {
      baseType = stripTrailingIdentifier(baseType);
    }

    // Handle struct keyword
    if (baseType.startsWith("struct ")) {
      baseType = baseType.substring(7);
    }

    return {
      type: trimmed,
      isPointer,
      isConst,
      baseType,
    };
  }

  /**
   * Get the parameter info at a given index, or null if not found.
   */
  private static getParamAt(
    typedefType: string,
    paramIndex: number,
  ): ITypedefParam | null {
    const parsed = TypedefParamParser.parse(typedefType);
    if (!parsed || paramIndex >= parsed.params.length) {
      return null;
    }
    return parsed.params[paramIndex];
  }

  /**
   * Does the typedef DECLARE this parameter as a pointer?
   *
   * #1450: a fact read off a parsed typedef, not a choice -- which is why the
   * name is `isParamPointer` and not `shouldBePointer`. The old spelling read as
   * a decision the render pass was making, and the whole point of the box-4 scan
   * is that a `needs`/`should` name is where a decision hides. This one answers
   * from the C header's own text; nothing here elects anything.
   *
   * @param typedefType - The typedef type string
   * @param paramIndex - The parameter index (0-based)
   * @returns true for a pointer, false for a value, null when the typedef is
   *   silent -- tri-state, because "the typedef does not say" is not "no"
   */
  static isParamPointer(
    typedefType: string,
    paramIndex: number,
  ): boolean | null {
    return (
      TypedefParamParser.getParamAt(typedefType, paramIndex)?.isPointer ?? null
    );
  }

  /**
   * Does the typedef DECLARE this parameter const?
   *
   * The `const` counterpart of `isParamPointer`, and a fact for the same
   * reason -- see its note on the rename.
   *
   * @param typedefType - The typedef type string
   * @param paramIndex - The parameter index (0-based)
   * @returns true for const, false otherwise, null when the typedef is silent
   */
  static isParamConst(typedefType: string, paramIndex: number): boolean | null {
    return (
      TypedefParamParser.getParamAt(typedefType, paramIndex)?.isConst ?? null
    );
  }
}

export default TypedefParamParser;
