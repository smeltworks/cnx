/**
 * #1688: the preprocessor's macro dump of one cnx file's own C includes.
 * `dump` is null when nothing could be preprocessed; `complete` is false when
 * any include was left out, so a name the file uses may be an unread macro.
 */
interface IHeaderMacroDump {
  readonly dump: string | null;
  /**
   * #1881: the dump's macros the file may name -- those its own includes
   * define themselves, or `-D` defines; a header's own includes' are not.
   */
  readonly visible: ReadonlySet<string>;
  readonly complete: boolean;
}

export default IHeaderMacroDump;
