import type IComplianceAnnotation from "./types/IComplianceAnnotation";
import type TNameMove from "../../types/TNameMove";

/**
 * 2.2 Plan -- which safety-standard rule shaped a construct, and how that is
 * said in the generated C.
 *
 * CLAUDE.md makes this a cnx standard, not a nicety:
 *
 *   Whenever codegen emits code whose shape is dictated by a safety standard
 *   ... rather than by the obvious/naive translation, it MUST emit an
 *   explanatory comment directly above the generated construct. ... The
 *   comment names the standard + specific rule and gives a short WHY (what the
 *   naive form would have done and which rule it violates).
 *
 * The generated C is the certification artifact, so an auditor has to be able
 * to trace each non-obvious construct back to the rule that shaped it -- and,
 * separately, to enumerate every rule the transpiler cites at all. Three sites
 * used to build these strings by hand, and one of them had drifted off the
 * house form: no trailing period, and a parenthetical naming the cnx
 * construct rather than what the naive C would have done. Nothing could have
 * noticed, because the form was a convention in prose and the text was a string
 * literal three files apart.
 *
 * So the form is `render`'s, the rules are this table, and
 * `__tests__/ComplianceAnnotations.test.ts` holds both to CLAUDE.md's shape.
 *
 * Distinct from `MisraSuppressionUtils`, which emits `cppcheck-suppress`
 * directives -- a suppression tells a TOOL to stop reporting; an annotation
 * tells a READER why the code looks like this.
 * Adding a rule means adding a row; it cannot be added off-form.
 */

class ComplianceAnnotations {
  private static readonly MISRA = "MISRA C:2012 Rule";

  /** ADR-026 `forever` lowers to `for (;;)`. */
  static readonly FOREVER_LOOP: IComplianceAnnotation = {
    citation: `${ComplianceAnnotations.MISRA} 14.3`,
    what: "infinite loop written as `for (;;)` for cnx `forever`",
    why: "`while (1)` has a controlling expression with an invariant value, which the rule forbids",
  };

  /** ADR-029's generated init function needs a declaration before its definition. */
  static readonly INIT_PROTOTYPE: IComplianceAnnotation = {
    citation: `${ComplianceAnnotations.MISRA} 8.4`,
    what: "declaration for the ADR-029 generated init function",
    why: "the definition has external linkage and would otherwise be undeclared",
  };

  /**
   * #2207: a string written from another string is copied by
   * `cnx_string_copy`, a character at a time, because the source can be the
   * target (`names[i] <- names[j]` with `i == j`).
   */
  static readonly STRING_SELF_COPY: IComplianceAnnotation = {
    citation: `${ComplianceAnnotations.MISRA} 19.1`,
    what: "string copied a character at a time by `cnx_string_copy`",
    why: "`strncpy` would be passed overlapping arguments when a string is written from itself",
  };

  /**
   * #1257: an assignment's concatenation or substring is built in a
   * temporary and then copied in, because a part can read the string written
   * (`s <- s[0, 2] + "z"`).
   */
  static readonly STRING_BUILT_APART: IComplianceAnnotation = {
    citation: `${ComplianceAnnotations.MISRA} 19.1`,
    what: "string built in a temporary, then copied in by `cnx_string_copy`",
    why: "`strncpy` and `strncat` would be passed overlapping arguments when a part reads the string written",
  };

  /**
   * #1610: a scalar pointer declared without a value starts as `NULL`, not
   * ADR-015's `{0}` (owner ruling: MISRA rules always win in generated C).
   */
  static readonly NULL_POINTER: IComplianceAnnotation = {
    citation: `${ComplianceAnnotations.MISRA} 11.9`,
    what: "pointer declared without a value initialized to `NULL`",
    why: "ADR-015's `{0}` would use the integer constant `0` as a null pointer constant, and the rule permits only `NULL`",
  };

  /**
   * #2332: a temporary the right of `&&` builds is built under a test of the
   * left side, because building it before the statement would run it always.
   */
  static readonly AND_OPERAND: IComplianceAnnotation = {
    citation: "C11 6.5.13p4, C++ [expr.log.and]",
    what: "right operand of `&&` built under a test of the left one",
    why: "building its temporary before the statement would evaluate the operand's calls even when the left side is false",
  };

  /** #2332: `||`'s right operand, the same as `AND_OPERAND` with the test negated. */
  static readonly OR_OPERAND: IComplianceAnnotation = {
    citation: "C11 6.5.14p4, C++ [expr.log.or]",
    what: "right operand of `||` built under a test of the left one",
    why: "building its temporary before the statement would evaluate the operand's calls even when the left side is true",
  };

  /** #2332: each arm of `?:` that builds a temporary is built in its own branch. */
  static readonly TERNARY_ARM: IComplianceAnnotation = {
    citation: "C11 6.5.15p4, C++ [expr.cond]",
    what: "each arm of `?:` built in its own branch",
    why: "building both arms' temporaries before the statement would evaluate the calls of the arm that is not chosen",
  };

  /**
   * #1735, #1765: a value in a file-scope or scope variable's initializer
   * that reads a name, written as the value cnx folded it to.
   */
  static readonly STATIC_VALUE: IComplianceAnnotation = {
    citation: "C11 6.7.9p4",
    what: "static-storage initializer written as its folded value",
    why: "C requires a constant expression there, and neither a read of a variable, even a `const` one, nor an ADR-044 clamp helper call is one",
  };

  /**
   * A slice copy unrolled to per-element writes.
   *
   * Only cited when an equivalent `memcpy` would genuinely violate the rule --
   * the source type is known and differs from the destination element type, so
   * the two pointer arguments would be incompatible. Matching types, an unknown
   * source type, or a single element cite nothing (#1081).
   */
  static sliceUnroll(
    destCType: string,
    srcCType: string,
  ): IComplianceAnnotation {
    return {
      citation: `${ComplianceAnnotations.MISRA} 21.15`,
      what: "slice copy unrolled to per-element writes",
      why: `memcpy would pass incompatible pointer types: ${destCType}* vs ${srcCType}*`,
    };
  }

  /**
   * A float's bits reached through a union (ADR-007). Copying them into an
   * integer with `memcpy` would pass a float pointer beside an integer one,
   * which the rule forbids (#1760 review: the union carried no citation).
   */
  static floatBitsUnion(
    floatCType: string,
    bitsCType: string,
  ): IComplianceAnnotation {
    return {
      citation: `${ComplianceAnnotations.MISRA} 21.15`,
      what: "float bits accessed through a union",
      why: `memcpy would pass incompatible pointer types: ${floatCType}* vs ${bitsCType}*`,
    };
  }

  /**
   * ADR-057 / #1643: a local or parameter emitted under a moved C name. C
   * has no `::`, and a name's scope starts right after its declarator, so the
   * plain name is wrong in each case the move records.
   */
  static movedName(
    move: TNameMove,
    name: string,
    emittedName: string,
  ): IComplianceAnnotation {
    const what = `\`${name}\` emitted as \`${emittedName}\``;
    if (move === "hidesFileScope") {
      return {
        citation: "C11 6.2.1p4, C++ [basic.scope.hiding]",
        what,
        why: `a plain \`${name}\` would hide the file-scope \`${name}\` for the rest of its scope, so \`global.${name}\` would reach the local`,
      };
    }
    return {
      citation: "C11 6.2.1p7, C++ [basic.scope.pdecl]",
      what,
      why: `a plain \`${name}\` is in scope from its declarator, so its initializer would read the new, uninitialized \`${name}\` instead of the enclosing one`,
    };
  }

  /**
   * The one rendering of the house form,
   * `/* <citation>: <what> (<why>). *\/`, the citation a standard's rule
   * (`MISRA C:2012 Rule <N>`, `C11 6.2.1p7, C++ [basic.scope.pdecl]`).
   */
  static render(annotation: IComplianceAnnotation): string {
    return `/* ${annotation.citation}: ${annotation.what} (${annotation.why}). */`;
  }

  /** `render` for each of a declaration's moves, one line each, above it */
  static renderMoves(
    moves: ReadonlyArray<TNameMove>,
    name: string,
    emittedName: string,
  ): string {
    return moves
      .map(
        (move) =>
          ComplianceAnnotations.render(
            ComplianceAnnotations.movedName(move, name, emittedName),
          ) + "\n",
      )
      .join("");
  }

  /**
   * Every annotation this transpiler can emit.
   *
   * ## Its only caller is a test, deliberately
   *
   * That is the #1418 shape -- "a test-only caller counts as usage, so knip
   * reports clean on a method whose last production caller is gone" -- and this
   * branch deleted six methods that had it. So the difference is stated rather
   * than left for someone to rediscover: those six were duplicates of a live
   * sink, and deleting them removed a second way to do one thing. This one has
   * no production caller because enumerating the set is not something the
   * transpiler does while transpiling; it is what the tests hold to the house
   * form, and what answers "which rules does our codegen cite?" for someone
   * auditing the generated C.
   *
   * Without it the test would hardcode the list, and there would be two lists.
   * If a sweep proposes deleting this, the question to ask is whether the
   * assertion in `__tests__/ComplianceAnnotations.test.ts` still has a set to
   * assert over.
   * @public the set ComplianceAnnotations.test.ts enumerates; a hand-listed copy would be a second list
   */
  static all(): readonly IComplianceAnnotation[] {
    return [
      ComplianceAnnotations.FOREVER_LOOP,
      ComplianceAnnotations.INIT_PROTOTYPE,
      ComplianceAnnotations.STRING_SELF_COPY,
      ComplianceAnnotations.STRING_BUILT_APART,
      ComplianceAnnotations.AND_OPERAND,
      ComplianceAnnotations.OR_OPERAND,
      ComplianceAnnotations.TERNARY_ARM,
      ComplianceAnnotations.STATIC_VALUE,
      ComplianceAnnotations.NULL_POINTER,
      ComplianceAnnotations.sliceUnroll("uint8_t", "uint32_t"),
      ComplianceAnnotations.floatBitsUnion("float", "uint32_t"),
      ComplianceAnnotations.movedName("hidesFileScope", "g", "f__g"),
      ComplianceAnnotations.movedName("readsEnclosing", "p", "f__p"),
    ];
  }
}

export default ComplianceAnnotations;
