/**
 * Assignment kinds for classification-based dispatch (ADR-065).
 *
 * The classifier checks conditions in priority order - earlier kinds
 * take precedence when multiple could match. This ordering matches
 * the original generateAssignment() method's if-else chain.
 */
enum AssignmentKind {
  // === Bitmap operations (check first - specific patterns) ===

  /** flags.Mode <- 3, gss[1].fl.Mode <- 3, this.fl.A <- true (a field of a bitmap value) */
  BITMAP_FIELD,

  /** MOTOR.CTRL.Running <- true, Scope.GPIO7.ICR1.LED <- v, this.PWM.CTRL.Enable <- true (a field of a register member) */
  REGISTER_MEMBER_BITMAP_FIELD,

  // === Register bit operations ===

  /** GPIO7.DR_SET[LED_BIT] <- true (single bit) */
  REGISTER_BIT,

  /** GPIO7.DR_SET[0, 8] <- value (bit range, includes MMIO optimization) */
  REGISTER_BIT_RANGE,

  // === Integer bit operations ===

  /** flags[3] <- true (single bit on integer variable) */
  INTEGER_BIT,

  /** flags[0, 3] <- 5 (bit range on integer variable) */
  INTEGER_BIT_RANGE,

  /** devices[0].control[0, 4] <- 15 (bit range through struct chain) */
  STRUCT_CHAIN_BIT_RANGE,

  /** matrix[i][j][FIELD_BIT] <- false (bit on multi-dim array element) */
  ARRAY_ELEMENT_BIT,

  /** row[i][0, 4] <- 6 (bit range on an array element, #1668) */
  ARRAY_ELEMENT_BIT_RANGE,

  // === String operations ===

  /**
   * One string<N> written whole -- `s`, `this.name`, `Scope.cfg.name`,
   * `o.inner.name`, `parr[1].name`, `g.cells[1][2]`: a bounded copy into the
   * rendered target (#1731)
   */
  STRING_COPY,

  // === Array operations ===

  /** arr[i] <- value (normal array element) */
  ARRAY_ELEMENT,

  /** matrix[i][j] <- value (multi-dimensional array element) */
  MULTI_DIM_ARRAY_ELEMENT,

  /** buffer[0, 10] <- source (slice assignment: per-element little-endian writes, ADR-007/#1081) */
  ARRAY_SLICE,

  /** buf <- [1, 2, 3, 4] (a whole array given its list: a temporary, copied, #1782) */
  WHOLE_ARRAY,

  // === Special operations ===

  /** atomic counter +<- 1 (atomic read-modify-write) */
  ATOMIC_RMW,

  /** clamp u8 saturated +<- 200, wrap i32 w /<- d: an ADR-044 overflow helper */
  OVERFLOW_HELPER,

  // === Access patterns (global/this prefix) ===

  /** global.Scope.member <- value (cross-scope access) */
  GLOBAL_MEMBER,

  /** global.arr[i] <- value (global array element) */
  /**
   * global.obj.field[i] <- value (member chain behind a global prefix).
   *
   * Issue #1115: a subscript on a plain global VARIABLE (`global.x[i]`, or
   * `global.Scope.member[i]`) no longer lands here -- it classifies as the
   * general kinds so it behaves like bare `x[i]`. This kind now covers only
   * genuine member chains, where the subscript applies to a struct field
   * rather than to the named variable.
   */
  GLOBAL_ARRAY,

  /** this.member <- value (scoped member) */
  THIS_MEMBER,

  /*
   * Issue #1115: THIS_ARRAY / THIS_BIT / THIS_BIT_RANGE removed. Subscripted
   * `this.` targets now classify as the general kinds (ARRAY_ELEMENT,
   * INTEGER_BIT, ARRAY_SLICE, ...). They were aliases: `resolvedTarget` and
   * `resolvedBaseIdentifier` already carry the scope prefix, so the handlers
   * were literally the same functions. Keeping the aliases required a second
   * classifier switch, which drifted and lost four branches for `this.`.
   */

  // === Complex access patterns ===

  /** struct.field.subfield <- value (member chain) */
  MEMBER_CHAIN,

  // === Base case ===

  /** x <- 5 (simple variable assignment) */
  SIMPLE,
}

export default AssignmentKind;
