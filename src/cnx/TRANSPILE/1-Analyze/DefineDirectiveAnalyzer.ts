/**
 * ADR-037 `#define` shape: E0501, E0502.
 *
 * #1322. Two throws in `IncludeGenerator.processDefineDirective`, both
 * reporting `1:0` after computing the real line and spending it on prose --
 * `… Use inline functions instead. Line 7`. A file whose offending directive
 * sits on line 7 reported position 1:0 and said "Line 7" in its message, which
 * is the exact shape this card exists to remove.
 *
 * ## The plan said these needed the preprocessor artifact. They do not.
 *
 * #1322's definition of done groups E0501/E0502 with "the six include
 * diagnostics (E0501-E0506), which need the preprocessor artifact rather than
 * a tree walk". That is false, and it is worth writing down why, because the
 * sentence reads plausible: a `#define` inside an INCLUDED C HEADER genuinely
 * is not in the cnx parse tree -- but it never reached these throws either.
 * C headers are lexed by the C grammar, whose directive rule sends every
 * `#`-line to ANTLR's hidden channel before parsing, so a header holding
 * `#define SQUARE(x) ((x) * (x))` transpiles at exit 0 today and always did.
 * The throws' own parameter type is the proof: `DefineDirectiveContext` is a
 * cnx grammar node, and the C grammar has no such rule to produce one.
 *
 * What the rule actually sees is `defineDirective`, whose three alternatives
 * ARE the three cases the throw discriminated (`DEFINE_FLAG`,
 * `DEFINE_WITH_VALUE`, `DEFINE_FUNCTION`), reached from `program`'s directive
 * children. There is nowhere else in a `.cnx` file a `#define` can parse: after
 * a declaration, inside a `scope`, or inside a function body it is a syntax
 * error, so this walk is exhaustive by construction rather than by search.
 *
 * A `#define` in an included `.cnx` is still rejected, because that file is
 * itself a pipeline file whose own tree is analyzed -- and it is attributed to
 * the included file, as it was before.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import invariant from "../../utils/invariant";
import IDefineDirectiveError from "./types/IDefineDirectiveError";

const nameOf = (text: string): string => {
  const match = /#\s*define\s+([a-zA-Z_]\w*)/.exec(text);
  invariant(match !== null, "a defineDirective token always carries a name");
  return match[1];
};

class DefineDirectiveAnalyzer {
  public analyze(program: IProgramSyntax): IDefineDirectiveError[] {
    const found: IDefineDirectiveError[] = [];
    for (const directive of program.directives) {
      if (directive.kind === "define-function") {
        const name = nameOf(directive.text);
        found.push({
          code: "E0501",
          span: directive.span,
          message: `Function-like macro '${name}' is not allowed. Use inline functions instead.`,
          helpText:
            "A macro is textual substitution, so its arguments are evaluated wherever they appear and its operators bind by text (ADR-037); write an `inline` function instead.",
        });
      } else if (directive.kind === "define-value") {
        const name = nameOf(directive.text);
        found.push({
          code: "E0502",
          span: directive.span,
          message: `#define with value '${name}' is not allowed. Use a read-only binding instead: u32 ${name} <- value;`,
          helpText:
            "A `#define` has no type and no scope, so the compiler cannot check its use (ADR-037); a read-only binding has both.",
        });
      }
    }
    return found;
  }
}

export default DefineDirectiveAnalyzer;
