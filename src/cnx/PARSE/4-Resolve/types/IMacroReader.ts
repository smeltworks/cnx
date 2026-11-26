/** One file's object-like macros, by name to body, as its C includes define them */
interface IMacroReader {
  /** The file whose `-dM` dump these are */
  readonly file: string;
  readonly bodies: ReadonlyMap<string, string>;
}

export default IMacroReader;
