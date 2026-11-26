/**
 * Why cnx cannot read a header bit-field's width, and what would let it
 * (#2494, #2484 review): the clause E0946's message ends with, and its help
 */
interface IUnreadBitWidth {
  readonly why: string;
  readonly help: string;
}

export default IUnreadBitWidth;
