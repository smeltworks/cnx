/**
 * The literal a value fixed at compile time is written as, and the type it is
 * held at; `verbatim` is C's own spelling, written as it stands (#1739, #1735)
 */
interface IConstSpelling {
  readonly text: string;
  readonly typeName: string | null;
  readonly verbatim: boolean;
  /** The C types of the casts written on it, outermost first (#2372) */
  readonly casts: readonly string[];
}

export default IConstSpelling;
