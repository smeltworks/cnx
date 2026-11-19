/**
 * Issue #579: Subscript classification result
 *
 * Discriminates between array access and bit manipulation operations.
 * Used by both assignment and expression paths to ensure consistent behavior.
 */
type TSubscriptKind =
  | "array_element" // An element: arr[i], which is arr[i, 1]
  | "array_slice" // A sub-array: arr[start, n], n elements (ADR-007, #1757)
  | "bit_range"; // Bits: value[start, length]; value[start] is value[start, 1] (ADR-007 §1)

export default TSubscriptKind;
