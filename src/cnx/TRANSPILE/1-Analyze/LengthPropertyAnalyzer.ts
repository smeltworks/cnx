/**
 * ADR-058 explicit length properties: E0867.
 *
 * #1322. Seventeen throws in `PostfixExpressionGenerator`, all reaching the
 * user as `1:0`, and ONE fixture in the whole corpus -- which was about the
 * removed `.length`, not about any of these. Seventeen rejections enforced by
 * code nothing exercised.
 *
 * ## Four of them were not diagnostics at all
 *
 * `Cannot determine .X for '<name>' - type not found in registry` appears four
 * times, once per property. The audit read them as user-facing; they are not.
 * An undeclared name is rejected by E0427 in this same pass, before codegen
 * runs -- probed: `undeclaredName.type_bit_length` reports E0427 at a real position.
 * What is left is a name that IS declared and whose type codegen cannot find,
 * which is the transpiler being wrong rather than the program. They are
 * `invariant()` calls now, not relocations.
 *
 * ## What the rule is
 *
 * A length property names its kind and unit (#1975 review 2), and asks it of
 * the subject it is applied to. `LengthProperty.rule` decides whether the
 * subject can answer -- `.value_*` needs a value, `_element_count` an array or
 * struct, `.memory_char_count` a string -- and a logical bit or byte length
 * still needs a type whose width is known, which this pass checks.
 * The question is asked of the chain WITHOUT the property step -- for
 * `frame.data[0].type_element_count` the subject is `frame.data[0]` -- which is the
 * one operand typer's chain step before the property (#1668), not a second
 * walk of this analyzer's own.
 *
 * ## Structs (#1535)
 *
 * A struct answers `.type_element_count` with its field count, and `.type_bit_length` /
 * `.type_byte_length` with its fields' sizes together, without C padding -- the
 * owner's ruling, ADR-058 resolved question 7. `LengthProperty` decides the
 * number, for this pass, render and 1.4's constants alike.
 */

import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import LengthProperty from "../../utils/LengthProperty";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import LengthSubject from "../../utils/LengthSubject";
import type IChainStep from "../../types/IChainStep";
import PROPERTY_NAMES from "../../utils/constants/PROPERTY_NAMES";
import ILengthPropertyError from "./types/ILengthPropertyError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TExpression from "../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type TMemberDeclaration from "../../types/syntax/TMemberDeclaration";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IOperandType from "../../types/IOperandType";

/** The CLI argument vector, which answers only `.type_element_count`. */
const ARGS_PARAMETER = "args";

class LengthPropertyCheck {
  private readonly found: ILengthPropertyError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): ILengthPropertyError[] {
    return this.found;
  }

  /** `inFunction`: only a function body runs, so only there can a length be read at runtime */
  public expression(chain: TExpression, inFunction: boolean): void {
    if (chain.kind !== "postfix") return;
    const ops = chain.ops;
    const last = ops.at(-1);
    if (last?.kind !== "member") return;
    // Only a property's name can read one; the rest need no typing
    const name = last.name;
    if (!PROPERTY_NAMES.has(name)) return;
    // #1976: a literal has no fields, so the name reads the property, and a
    // length property measures a declared value -- owner ruling: never a
    // literal. The typer leaves a string literal untyped, so without this the
    // chain had no subject and its C was `"Hello".value_char_count`.
    if (LengthPropertyCheck.rootsAtLiteral(chain)) {
      if (name === "length") {
        this.reportDeprecatedLength(last);
      } else {
        this.found.push({
          code: "E0867",
          span: last.span,
          message: `.${name} is not available on a literal`,
          helpText:
            "A length property measures a declared value; declare one and ask it (ADR-058).",
        });
      }
      return;
    }
    // #1760 review: whether the name reads the property or a field named
    // like it is the typer's, on the step (ADR-058: a field is a field)
    const step = OperandTyper.chainOf(chain, this.context).steps.at(-1);
    const property = step?.property ?? null;
    if (property === null) return;

    // ADR-058 (#1975 review 2): the unprefixed lengths are removed, each
    // named one kind of length without saying which
    const replacement = LengthProperty.removedHelp(property);
    if (replacement !== null) {
      this.found.push({
        code: "E0886",
        span: last.span,
        message: `'.${property}' is removed`,
        helpText: replacement,
      });
      return;
    }

    if (LengthPropertyCheck.subjectIsArgs(chain)) {
      if (LengthProperty.parse(property)?.unit !== "element_count") {
        this.found.push({
          code: "E0867",
          span: last.span,
          message: `.${property} is not available on 'args'`,
          helpText: "Use .type_element_count for the argument count.",
        });
      }
      return;
    }

    // The subject is the chain WITHOUT the property step: the typer's last
    // step is the property, and what it applies to is that step's `before`.
    // A scope variable may be called `length` (#212): `this.length` binds
    // the member at the chain's root, so there is no property step and no
    // subject, and no property rule applies.
    if (step?.before == null) return; // unresolved -- another diagnostic's to report

    this.check(last, property, step, inFunction);
  }

  private check(
    at: TPostfixOpSyntax,
    property: string,
    step: IChainStep,
    inFunction: boolean,
  ): void {
    const typed = step.before!;
    const subject = LengthSubject.spelling(typed);
    // `string<N>` and the unsized `const string`, whose capacity is inferred.
    const isString = OperandTyper.isString(typed);

    // ADR-058 deprecated `.length` outright: it named a different thing on a
    // string, an array and a scalar, and the four shape properties exist to
    // say which was meant. Rejected wherever it appears, so there is no
    // subject to judge.
    if (property === "length") {
      this.reportDeprecatedLength(at);
      return;
    }

    // ADR-045's storage properties describe a string's buffer: `.capacity` is
    // the declared `N`, `.size` that plus the null terminator. Nothing else
    // has a buffer.
    if (property === "capacity" || property === "size") {
      if (!isString) {
        this.found.push({
          code: "E0887",
          span: at.span,
          message: `.${property} is only available on strings, not on '${subject}'`,
          helpText:
            "Use .type_element_count for an array's length, or .type_byte_length for a value's size in bytes (ADR-045).",
        });
      }
      return;
    }

    const name = LengthProperty.parse(property);
    if (name === null) return;
    const lookup = (cName: string) => this.context.program.symbolByCName(cName);
    const rule = LengthProperty.rule(
      name,
      LengthSubject.of(
        step,
        LengthSubject.structTest(lookup, this.context.symbolTable),
      )!,
    );
    if (rule.kind === "error") {
      this.found.push({
        code: "E0867",
        span: at.span,
        message: rule.message,
        helpText: rule.helpText,
      });
      return;
    }
    // C initializes a file-scope object with a constant, and a value's
    // length now is not one: the C was `uint32_t n = strlen(s);`, which gcc
    // rejects
    if (!inFunction && LengthProperty.readsAtRuntime(rule)) {
      this.found.push({
        code: "E0867",
        span: at.span,
        message: `.${property} is read at runtime, and a file-scope initializer must be constant`,
        helpText:
          "Read it inside a function, or use the .type_ length, which is constant (ADR-058).",
      });
      return;
    }
    // A logical bit or byte length needs a width: a string, a struct whose
    // fields all have one, and an array of either have one
    if (rule.kind === "logical" && name.unit !== "element_count" && !isString) {
      this.checkWidth(
        at,
        property,
        typed,
        LengthProperty.struct(typed.typeName ?? "", lookup),
        lookup,
      );
    }
  }

  private checkWidth(
    at: TPostfixOpSyntax,
    property: string,
    typed: IOperandType,
    struct: ReturnType<typeof LengthProperty.struct>,
    lookup: Parameters<typeof LengthProperty.struct>[1],
  ): void {
    const subject = LengthSubject.spelling(typed);
    const element = typed.typeName ?? "";
    // #1975 (owner ruling): a cnx struct and a header's are each their
    // fields' sizes together, one rule, a header struct's field too; a
    // pointer field has none -- cnx has no pointers
    const headerBits = ForeignTypeFacts.headerBits(
      this.context.symbolTable,
      OperandTyper.target(this.context),
    );
    const isHeaderStruct =
      this.context.symbolTable.getStructFields(element) !== undefined;
    if (struct !== undefined || isHeaderStruct) {
      const bits =
        struct === undefined
          ? headerBits(element)
          : LengthProperty.structBits(struct, lookup, headerBits);
      if (bits === null) {
        this.found.push({
          code: "E0867",
          span: at.span,
          message: `Cannot determine .${property} for type '${subject}'`,
          helpText:
            "A struct's length is its fields' sizes together; a pointer field, a field of a type cnx does not read, a union's shared fields, a bit-field, an unnamed member, and a C++ base or vtable have no size cnx fixes.",
        });
      }
      return;
    }
    // An enum and a bitmap both have a fixed width; only a type nothing sizes
    // -- a struct, or a name this pass cannot see -- has none.
    if (
      TYPE_WIDTH[element] === undefined &&
      typed.enumTypeName === null &&
      typed.bitmapTypeName === null
    ) {
      this.found.push({
        code: "E0867",
        span: at.span,
        message: `Cannot determine .${property} for type '${subject}'`,
        helpText:
          typed.typeName === null && typed.cType !== null
            ? "cnx has no pointers, so a header's pointer, or a type cnx does not read, has no size."
            : "A length in bits is only defined for a primitive, a string, or an array of them.",
      });
    }
  }

  private reportDeprecatedLength(at: TPostfixOpSyntax): void {
    this.found.push({
      code: "E0886",
      span: at.span,
      message: `'.length' is deprecated`,
      helpText:
        "Use .value_char_count for a string's length, .type_element_count for an array's, or .type_bit_length / .type_byte_length for a width (ADR-058).",
    });
  }

  /** `"Hello"`, `(true)`, `"Hello"[0]`: a chain whose root is a literal */
  private static rootsAtLiteral(chain: TExpression): boolean {
    return (
      ExpressionShape.unparenthesized(
        chain.kind === "postfix" ? chain.primary : chain,
      ).kind === "literal"
    );
  }

  /** `args` is a parameter, not a declaration this pass records. */
  private static subjectIsArgs(
    chain: Extract<TExpression, { kind: "postfix" }>,
  ): boolean {
    return (
      chain.ops.length === 1 &&
      chain.primary.kind === "identifier" &&
      chain.primary.name === ARGS_PARAMETER
    );
  }

  /**
   * The chains a value is written to. The property rules ask about a value
   * read, and a written chain was never one of their subjects.
   */
  public static targetsIn(
    declaration: TMemberDeclaration,
  ): ReadonlySet<TExpression> {
    if (declaration.kind !== "function") return new Set();
    return new Set(
      StatementNodes.of(declaration.body.statements).flatMap((statement) => {
        if (statement.kind === "assignment") return [statement.target];
        if (statement.kind === "for" && statement.update !== null) {
          return [statement.update.target];
        }
        return [];
      }),
    );
  }
}

class LengthPropertyAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain 1.2 returned that is read, not written (#1991) */
  public analyze(program: IProgramSyntax): ILengthPropertyError[] {
    const check = new LengthPropertyCheck(this.context);
    // only a function body is inside a function -- a scope's members are at
    // file scope
    const visit = (declaration: TMemberDeclaration): void => {
      const targets = LengthPropertyCheck.targetsIn(declaration);
      const inFunction = declaration.kind === "function";
      for (const part of DeclarationParts.of(declaration)) {
        for (const expr of ExpressionNodes.of(part)) {
          if (!targets.has(expr)) check.expression(expr, inFunction);
        }
      }
    };
    for (const member of program.members) visit(member.declaration);
    return check.errors();
  }
}

export default LengthPropertyAnalyzer;
