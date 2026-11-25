import EFileType from "./EFileType";

/**
 * Discovered source file
 */
interface IDiscoveredFile {
  /** Absolute path to the file */
  readonly path: string;

  /** File type */
  readonly type: EFileType;
}

export default IDiscoveredFile;
