/**
 * HeaderParser
 * Parses C and C++ header files for symbol extraction.
 *
 * Encapsulates ANTLR lexer/parser setup for header files,
 * providing a clean interface for the Transpiler to use.
 */

import { CharStream, CommonTokenStream } from "antlr4ng";

import { CLexer } from "./c/grammar/CLexer";
import { CParser } from "./c/grammar/CParser";
import type { CompilationUnitContext } from "./c/grammar/CParser";
import CHeaderLowering from "./c/CHeaderLowering";
import CppHeaderLowering from "./cpp/CppHeaderLowering";
import type ICppHeaderSyntax from "./types/ICppHeaderSyntax";
import type ICHeaderSyntax from "./types/ICHeaderSyntax";
import { CPP14Lexer } from "./cpp/grammar/CPP14Lexer";
import { CPP14Parser } from "./cpp/grammar/CPP14Parser";
import EHeaderLanguage from "../1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../1-Discover/types/IHeaderSource";
import type TParsedHeader from "./types/TParsedHeader";

/** A `#undef NAME` line (#2494 review) */
const UNDEF_DIRECTIVE = /^[ \t]*#[ \t]*undef[ \t]+([A-Za-z_]\w*)/gm;

/**
 * Result of parsing a C header
 */
interface ICParseResult {
  /** The header lowered to plain data, or null if parsing failed (#1991) */
  syntax: ICHeaderSyntax | null;
}

/**
 * Result of parsing a C++ header
 */
interface ICppParseResult {
  /** The header lowered to plain data, or null if parsing failed (#1991) */
  syntax: ICppHeaderSyntax | null;
}

/**
 * Parses C and C++ header files
 */
class HeaderParser {
  /**
   * One header, as 1.1 handed it over: its text, parsed by the parser its
   * language names (#208, #1844). Nothing here judges the text again.
   */
  static parse(source: IHeaderSource): TParsedHeader {
    switch (source.language) {
      case EHeaderLanguage.Assembler:
        return { language: EHeaderLanguage.Assembler };
      case EHeaderLanguage.Cpp:
        return {
          language: EHeaderLanguage.Cpp,
          syntax: HeaderParser.parseCpp(source.text).syntax,
        };
      case EHeaderLanguage.C:
        return {
          language: EHeaderLanguage.C,
          syntax: HeaderParser.parseC(source.text).syntax,
        };
    }
  }

  /**
   * Parse a C header file
   *
   * THE C-header parse for the whole project -- the transpiler and the IDE
   * symbol API both come through here. `src/lib/parseCHeader` used to rebuild
   * this pipeline itself, and the copies had already drifted: it silenced the
   * LEXER as well, so `int f(void);` next to an `@` printed two
   * `token recognition error` lines to stderr on the transpiler path and
   * nothing on the IDE path (#1306 review). One path, so there is nothing to
   * keep in step.
   *
   * Error listeners are removed DELIBERATELY, and the reason is measurable
   * rather than a guess about "unsupported constructs" (#1306).
   *
   * This parser reads the header as written. It does not preprocess, so it sees
   * every branch including the ones a C compiler never would. The dominant case is
   * the C++ interop guard that cnx itself emits into every header:
   *
   *     #ifdef __cplusplus
   *     extern "C" {
   *     #endif
   *
   * `extern "C"` is C++, not C, so the C grammar has no alternative for it and the
   * parse errors -- on a line that is switched off in the very build that would use
   * this parser. Surfacing them would reject about nine headers in ten for code
   * that never compiles.
   *
   * The measurement carries its command, because the counts drift with every
   * fixture added -- they moved 1698/1444/1522 -> 1700/1444/1524 inside one
   * session -- and a number nobody can re-take can only be trusted or ignored
   * (#1306 review):
   *
   *     npm run measure:header-parse-errors
   *
   * On 2026-09-05 that reported 1700 C headers, 1444 carrying the guard, and
   * 1524 (89.6%) producing at least one syntax error.
   *
   * Surfacing them correctly requires preprocessing first. In production,
   * `getHeaderContent` invokes `logic/preprocessor` only when
   * `needsConditionalPreprocessing` finds an #if/#elif expression that needs
   * evaluation; plain #ifdef/#ifndef guards still reach this parser raw. A second
   * route, the #985 external-declaration recovery pass, feeds preprocessed slices
   * back through `parseC` after standalone preprocessing has failed. Making
   * preprocessing unconditional at this boundary would therefore add a system
   * compiler dependency rather than remaining a listener-only change.
   *
   * A null result, not a silent empty one, is what a caller sees when the parse
   * cannot proceed at all.
   *
   * @param content - The header file content
   * @returns The header lowered to plain data (null if parsing failed)
   */
  static parseC(content: string): ICParseResult {
    let unit: CompilationUnitContext;
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CParser(tokenStream);

      // Suppressed by measurement, not assumption -- see the doc comment. BOTH,
      // because an unpreprocessed header reaches the lexer with the same
      // switched-off branches it reaches the parser with.
      lexer.removeErrorListeners();
      parser.removeErrorListeners();
      unit = parser.compilationUnit();
    } catch {
      return { syntax: null };
    }
    // Outside the catch: a lowering bug reaches 1.3's header warning, and is
    // not read as a parse that failed
    return {
      syntax: {
        ...CHeaderLowering.header(unit),
        undefinedMacros: HeaderParser.undefinedMacros(content),
      },
    };
  }

  /**
   * Parse a C++ header file
   *
   * Suppressed for the same structural reason as `parseC`: the header is read
   * unpreprocessed, so conditional branches meant for other compilers or other
   * language modes are parsed as if they were live. The `extern "C"` count above
   * was measured on the C path specifically; the C++ grammar accepts that
   * construct, so the mix differs even though the cause does not.
   *
   * @param content - The header file content
   * @returns The header lowered to plain data (null if parsing failed)
   */
  static parseCpp(content: string): ICppParseResult {
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CPP14Lexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CPP14Parser(tokenStream);

      // Suppressed by measurement, not assumption -- see the doc comment.
      lexer.removeErrorListeners();
      parser.removeErrorListeners();

      return {
        syntax: {
          ...CppHeaderLowering.header(parser.translationUnit()),
          undefinedMacros: HeaderParser.undefinedMacros(content),
        },
      };
    } catch {
      // Return null on parse failure
      return { syntax: null };
    }
  }

  /** #2494 review: each name a `#undef` line of `content` names */
  private static undefinedMacros(content: string): string[] {
    return [...content.matchAll(UNDEF_DIRECTIVE)].map((match) => match[1]);
  }
}

export default HeaderParser;
