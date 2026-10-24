/**
 * #1735: a value in a static-storage initializer that cnx cannot fix at
 * compile time (E0909), or whose arithmetic would clamp or wrap there
 * (E0910, ADR-044 "Values fixed at compile time"). A file-scope or scope
 * variable's initializer is such a value, in C++ as in C: cnx settles it
 * before the program runs. C would reject one it could not settle (C11
 * 6.7.9p4); C++ would initialize it at run time.
 */
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IValuePositions from "../../types/IValuePositions";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import StaticInitializers from "./helpers/StaticInitializers";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IStaticInitializerError from "./types/IStaticInitializerError";

class StaticInitializerAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
  ): IStaticInitializerError[] {
    const errors: IStaticInitializerError[] = [];
    const { program: resolved, sourceFile } = this.context;
    for (const value of StaticInitializers.values(
      program,
      valuePositions.positions,
    )) {
      const settled = StaticInitializers.check(value, resolved, sourceFile);
      if (settled?.kind === "overflow") {
        const form = StaticInitializers.formOf(value);
        errors.push({
          code: "E0910",
          span: value.value.span,
          message: `Static initializer overflows ${settled.typeName} at compile time: ${StaticInitializerAnalyzer.overflowCause(form, settled.typeName)}`,
          helpText:
            form === "cast" || form === "name"
              ? "Write a value the type holds, or cast to a type wide enough for it"
              : ConstantDiagnostics.OVERFLOW_HELP,
        });
      } else if (
        settled?.kind === "foreign" &&
        settled.why !== "target" &&
        StaticInitializers.wraps(value)
      ) {
        errors.push({
          code: "E0909",
          span: value.value.span,
          message: `Static initializer must be known at compile time: ${ConstantDiagnostics.why(settled)}, and cnx cannot read its value to check the arithmetic does not clamp or wrap (ADR-044)`,
          helpText:
            "Declare the value in cnx, or #define it as an integer literal cnx can read",
        });
      } else if (
        settled !== null &&
        settled.kind === "notConstant" &&
        StaticInitializers.lacksValue(value, settled)
      ) {
        const why = ConstantDiagnostics.why(settled);
        if (why === null) continue;
        errors.push({
          code: "E0909",
          span: value.value.span,
          message: `Static initializer must be known at compile time: ${why}`,
          helpText:
            "A file-scope or scope variable's initializer is a value fixed at compile time (ADR-044), in C++ as in C: literals, read-only bindings that are not `volatile` (ADR-064), length properties (.type_byte_length) and casts",
        });
      }
    }
    return errors;
  }

  private static overflowCause(form: string, typeName: string): string {
    if (form === "cast") {
      return `the value cast to ${typeName} does not fit it (ADR-024, ADR-044)`;
    }
    if (form === "name") return "the value does not fit it (ADR-044)";
    return TypeCheckUtils.isFloat(typeName)
      ? "the arithmetic is past its finite range (ADR-044)"
      : ConstantDiagnostics.OVERFLOW_CAUSE;
  }
}

export default StaticInitializerAnalyzer;
