import type TPostfixOpSyntax from "./syntax/TPostfixOpSyntax";

/**
 * #2483: what 2.2 knows of the bits a `<-` bit write stores, so the write
 * masks them once
 */
type TPlannedBitValue =
  /** A bit range no wider than the target: the write masks it, at `width` */
  | {
      readonly kind: "range";
      readonly op: TPostfixOpSyntax;
      readonly width: number;
    }
  /** An integer literal the target holds: written as it is */
  | { readonly kind: "fits" };

export default TPlannedBitValue;
