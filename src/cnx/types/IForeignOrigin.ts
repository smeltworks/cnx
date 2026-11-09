import type ESourceLanguage from "../utils/types/ESourceLanguage";

/**
 * #1881: where a symbol was declared -- the file and its language -- which
 * is what decides whether a cnx file sees it.
 */
interface IForeignOrigin {
  readonly sourceFile: string;
  readonly sourceLanguage: ESourceLanguage;
}

export default IForeignOrigin;
