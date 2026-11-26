import EFileType from "./EFileType";

/**
 * Discovered source file
 */
interface IDiscoveredFile {
  /** Absolute path to the file */
  readonly path: string;

  /** File type */
  readonly type: EFileType;

  /**
   * #1881: the file a header path names, symlinks followed. Two spellings
   * the compiler opens (`include/board.h`, `vendor/sdk/board.h`) are one
   * file's lines. Recorded for the headers 1.1 resolves; absent for others.
   */
  readonly realPath?: string;
}

export default IDiscoveredFile;
