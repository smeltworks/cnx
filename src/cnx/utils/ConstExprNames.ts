import type TConstExpr from "../types/TConstExpr";

/** A name a constant expression reads */
type TConstName = Extract<TConstExpr, { kind: "name" }>;

/** The names a constant expression reads, in the order it is written */
class ConstExprNames {
  static of(expr: TConstExpr): TConstName[] {
    switch (expr.kind) {
      case "name":
        return [expr];
      case "cast":
      case "unary":
        return ConstExprNames.of(expr.operand);
      case "binary":
        return [
          ...ConstExprNames.of(expr.left),
          ...ConstExprNames.of(expr.right),
        ];
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].flatMap(
          ConstExprNames.of,
        );
      default:
        return [];
    }
  }

  /** Each bare name it reads (`N`, not `this.N` or `S.N`) */
  static bare(expr: TConstExpr): TConstName[] {
    return ConstExprNames.of(expr).filter(
      (name) => name.root === null && name.path.length === 1,
    );
  }
}

export default ConstExprNames;
