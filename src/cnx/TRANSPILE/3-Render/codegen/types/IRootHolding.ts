/** How a chain's root is held, as both member-access paths read it */
interface IRootHolding {
  /** A struct parameter (ADR-006): `->` in C, `.` in C++, `(*p)` whole */
  readonly isStructParam: boolean;
  /** A pointer in C++ too: a callback-promoted parameter (#895) */
  readonly forcePointerSemantics: boolean;
  /**
   * A local #895 made a pointer to a struct: its members take `->` in C and
   * C++. Its whole value is the pointer, which the argument path reads from
   * its type info, so it is not wrapped the way a parameter is.
   */
  readonly isPointerLocal: boolean;
  /** ADR-072: the register type a register parameter points to, else null */
  readonly registerLayout: string | null;
}

export default IRootHolding;
