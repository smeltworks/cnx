import type IOperandType from "./IOperandType";
import type TSubscriptKind from "./TSubscriptKind";
import type IFieldBits from "./IFieldBits";

/** One postfix operation of a chain, with the types on either side of it */
interface IChainStep {
  /** The prefix the operation applies to */
  readonly before: IOperandType | null;
  /** For a subscript, what it is (element, slice, bit, bit range) */
  readonly subscript: TSubscriptKind | null;
  /**
   * For a `.name` step that reads an ADR-058/ADR-045 property, its name;
   * null for a field -- one named like a property included -- and for any
   * other step. The typer decides it, once (#1760 review).
   */
  readonly property: string | null;
  /**
   * For a `.name` step, the name it reads -- a field, a member, a property;
   * null for a subscript or a call. The typer records it, so a rule asking
   * which field a step writes reads it here, not from the source's spelling.
   */
  readonly member: string | null;
  /** ADR-058: the prefix names a type (`u32`, `Point`), not a value */
  readonly beforeNamesType: boolean;
  /** ADR-058: the prefix is a bitmap field or a header bit-field, with no storage of its own */
  readonly beforeIsBitField: boolean;
  /**
   * For a bit or bit range of a bitmap field (`p.Mode[1]`), the bitmap whose
   * bits it is and the field's offset (#2251); null for any other step. Its
   * `beforeRegisterMember` is then the bitmap's: the bits are the member's.
   */
  readonly fieldBits: IFieldBits | null;
  /**
   * ADR-004: the prefix is a register member -- its C name, however the
   * register was spelled (`R`, a scope's own bare `R`, `this.R`, `S.R`) -- so
   * a field of it is written per the member's access. Null otherwise.
   */
  readonly beforeRegisterMember: string | null;
  /** The register `beforeRegisterMember` is a member of, by its C name (`Drive__PWM`) */
  readonly beforeRegister: string | null;
  /**
   * ADR-004: for a `.name` step that reads a register member, the member's C
   * name, however the register was spelled; null for any other step. The rule
   * on a member's access (E0870/E0871) asks the typer which member a chain
   * names, as the renderer does, rather than resolving the spelling again.
   */
  readonly registerMember: string | null;
  /** The C name of the register `registerMember` belongs to */
  readonly register: string | null;
  readonly after: IOperandType | null;
  /** A call's: the C name of the function it calls, when the chain names one (#1991) */
  readonly callee: string | null;
}

export default IChainStep;
