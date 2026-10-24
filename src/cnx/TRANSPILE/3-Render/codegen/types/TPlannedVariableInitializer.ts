/**
 * How a variable's initializer is rendered.
 *
 * ADR-015 zero-initializes a variable that declares none, so the two arms are
 * genuinely different renderings rather than one with a null.
 *
 * ## The order inside the `expression` arm is load-bearing
 *
 * `resolveExpressionType` runs AFTER `renderExpression`: MISRA C:2012
 * Rule 10.3's cross-category check compares what the expression turned out to
 * be against what the declaration expects, so asking before the render would
 * ask about an expression that had not been typed yet.
 */
type TPlannedVariableInitializer =
  /** ADR-015: no initializer, so the type's zero value. */
  | { readonly kind: "zero"; readonly render: (isArray: boolean) => string }
  | {
      readonly kind: "expression";
      readonly renderTypeName: () => string;
      readonly renderExpression: () => string;
      readonly resolveExpressionType: () => string | null;
    }
  /**
   * Issue #517 / #1534: a C++ class with a constructor is not an aggregate, so
   * the declaration constructs its own object and the fields are assigned to
   * it after, by name.
   */
  | {
      readonly kind: "cppClass";
      readonly renderFill: (target: string) => readonly string[];
    };

export default TPlannedVariableInitializer;
