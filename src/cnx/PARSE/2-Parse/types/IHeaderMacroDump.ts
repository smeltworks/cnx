/**
 * #1688: the preprocessor's macro dump of one cnx file's own C includes.
 * `dump` is null when nothing could be preprocessed; `complete` is false when
 * any include was left out, so a name the file uses may be an unread macro.
 */
interface IHeaderMacroDump {
  readonly dump: string | null;
  /**
   * #1881: every header the file's own C includes brought in, nested ones
   * included, as resolved paths: the headers whose names the file sees.
   */
  readonly headerFiles: ReadonlySet<string>;
  readonly complete: boolean;
}

export default IHeaderMacroDump;
