/**
 * What a value fixed at compile time is told when it has none (#1175, #1669):
 * the wording for E0909 and E0910, once, for an enum member's value and an
 * array dimension alike.
 */
import type TConstResult from "../../../types/TConstResult";

type TWithoutValue = Extract<
  TConstResult,
  { kind: "notConstant" } | { kind: "foreign" }
>;

/** Each reason's sentence, after the offending part's spelling */
const REASON: Readonly<
  Record<
    Exclude<
      Extract<TConstResult, { kind: "notConstant" }>["reason"],
      "unknown" | "sizeofExpression" | "lengthRule"
    >,
    string
  >
> = {
  variable: "is a variable",
  parameter: "is a parameter",
  function: "is a function",
  call: "is a function call",
  scope: "is a scope",
  unfolded: "has no value known at compile time",
  laterMember: "is declared below it",
  selfMember: "is the member itself",
  subscript: "is an array element",
  float: "is a floating-point value",
  string: "is a string",
  character: "is a character",
  initializer: "is an initializer",
  address: "is an address",
  member: "is a member access",
  undeclaredMember: "is not declared",
  leadingZero:
    "is a leading-zero literal, which has no value: cnx has no octal literal (E0912)",
  divisionByZero: "divides by zero",
  negativeShift:
    "shifts by a negative amount, or shifts a negative value right",
  disputed:
    "is declared in a header the .cnx files that include it read differently, so cnx cannot tell which size the compiler reads (#2514)",
};

class ConstantDiagnostics {
  /**
   * Why `result` has no value, as E0909 says it; null when another code owns
   * the reason -- a division by zero is E0800's, an undeclared name E0427's,
   * a `sizeof` E0603's, a length property its subject has not E0867's -- so
   * a program is told once.
   */
  static why(result: TWithoutValue): string | null {
    if (result.kind === "foreign") {
      return {
        header: `'${result.spelling}' is defined by a C or C++ header`,
        maybeHeader: `'${result.spelling}' is not declared in cnx, so only an included C or C++ header can define it`,
        target: `'${result.spelling}' is a memory size, which the C compiler decides for the target`,
      }[result.why];
    }
    // A bare name nothing declares is E0427's, and a compile-time zero
    // divisor E0800's, which run first (#1268 review). A member a scope or an
    // enum does not have is reported by nothing else (#1863 review), so E0909
    // says it
    if (
      result.reason === "unknown" ||
      result.reason === "sizeofExpression" ||
      result.reason === "lengthRule"
    ) {
      return null;
    }
    const subject = result.spelling === "" ? "it" : `'${result.spelling}'`;
    if (result.reason === "unfolded" && result.because) {
      return `${subject} has no value known at compile time: ${ConstantDiagnostics.cause(result.because)}`;
    }
    return `${subject} ${REASON[result.reason]}`;
  }

  /** Why a const's own initializer has no value, said at a use of the const */
  private static cause(
    because: Exclude<TConstResult, { readonly kind: "value" | "float" }>,
  ): string {
    if (because.kind === "overflow") {
      return `its initializer overflows ${because.typeName} (ADR-044)`;
    }
    const inner = ConstantDiagnostics.why(because);
    return inner === null
      ? "its initializer names something not declared"
      : `in its initializer, ${inner}`;
  }

  /** E0910's cause for integer arithmetic, wherever the value lands */
  static readonly OVERFLOW_CAUSE =
    "the arithmetic would clamp or wrap (ADR-044)";

  /** E0910's help: the fix ADR-044 offers */
  static readonly OVERFLOW_HELP =
    "Do the arithmetic at a width that holds the result, for example by casting the operands to a wider type";
}

export default ConstantDiagnostics;
