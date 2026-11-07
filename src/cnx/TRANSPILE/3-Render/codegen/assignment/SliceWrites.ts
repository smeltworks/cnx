/**
 * ADR-007's slice write (#1081): an integer source split into the elements
 * of a buffer, one little-endian element at a time. An array's slice and the
 * characters of a `string<N>` (#2385) are both written here, so the split
 * is one rule however the buffer is spelled.
 */
import ComplianceAnnotations from "../../../2-Plan/ComplianceAnnotations";
import SliceSource from "../../../2-Plan/SliceSource";
import type IPlannedSliceSource from "../../../2-Plan/types/IPlannedSliceSource";
import type TranspileState from "../../../TranspileState";

/** What one destination element is: its stride, its C type, and the cast each chunk takes */
interface ISliceElement {
  readonly bytes: number;
  readonly cType: string;
  readonly wrap: (chunk: string) => string;
}

class SliceWrites {
  /** A string buffer is `char[]`; each byte is cast through uint8_t (MISRA 10.8) */
  static readonly STRING_ELEMENT: ISliceElement = {
    bytes: 1,
    cType: "char",
    wrap: (chunk) => `(char)(uint8_t)${chunk}`,
  };

  /**
   * The writes of `elementCount` elements, element `k` at `at(k)`. The
   * source is materialized into a single unsigned temp first when it feeds
   * more than one element or is a composite, so it is read once and every
   * shift has a known width (MISRA 10.1, #1085 review); a composite signed
   * source binds to its own type before its unsigned cast (MISRA 10.8).
   */
  static render(input: {
    readonly element: ISliceElement;
    readonly source: IPlannedSliceSource;
    readonly value: string;
    readonly lengthValue: number;
    readonly elementCount: number;
    readonly state: TranspileState;
    readonly at: (k: number) => string;
  }): string[] {
    const { element, source, elementCount } = input;
    const writes: string[] = [];
    // Cite Rule 21.15 only when an equivalent memcpy would have passed
    // incompatible pointers: a known source type unlike the element's, over
    // a real unroll (#1085 review)
    if (
      source.cType !== null &&
      source.cType !== element.cType &&
      elementCount > 1
    ) {
      writes.push(
        ComplianceAnnotations.render(
          ComplianceAnnotations.sliceUnroll(element.cType, source.cType),
        ),
      );
    }
    let sourceExpr = input.value;
    if (SliceSource.materializes(source, elementCount)) {
      sourceExpr = SliceWrites.materialize(writes, input);
    }
    for (let k = 0; k < elementCount; k += 1) {
      const shiftBits = k * element.bytes * 8;
      const chunk =
        shiftBits === 0
          ? `(${sourceExpr})`
          : `(${sourceExpr} >> ${shiftBits}U)`;
      writes.push(`${input.at(k)} = ${element.wrap(chunk)};`);
    }
    return writes;
  }

  private static materialize(
    writes: string[],
    input: {
      readonly source: IPlannedSliceSource;
      readonly value: string;
      readonly lengthValue: number;
      readonly state: TranspileState;
    },
  ): string {
    const { source, state } = input;
    if (SliceSource.splits(source)) {
      const signedName = state.getNextTempVarName();
      writes.push(`const ${source.cType} ${signedName} = ${input.value};`);
      const unsignedName = state.getNextTempVarName();
      writes.push(
        `const ${source.unsignedCType} ${unsignedName} = (${source.unsignedCType})${signedName};`,
      );
      return unsignedName;
    }
    const tempType = SliceSource.tempTypeOf(source, input.lengthValue);
    const tempName = state.getNextTempVarName();
    writes.push(
      `const ${tempType} ${tempName} = (${tempType})(${input.value});`,
    );
    return tempName;
  }
}

export default SliceWrites;
