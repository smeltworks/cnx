/**
 * BitmapGenerator - ADR-034 Bitmap Declaration Generation
 *
 * Generates C typedef declarations from cnx bitmap syntax.
 * Bitmaps are fixed-width integers with named bit fields.
 *
 * Example:
 *   bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
 *   ->
 *   // Bitmap: MotorFlags
 *   // Fields:
 *   //   Running: bit 0 (1 bit)
 *   //   Direction: bit 1 (1 bit)
 *   //   Mode: bits 2-4 (3 bits)
 *   //   Reserved: bits 5-6 (2 bits)
 *   typedef uint8_t MotorFlags;
 */
import invariant from "../../../../../utils/invariant";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";
import BitmapCommentUtils from "./BitmapCommentUtils";

/**
 * Generate a C typedef from a cnx bitmap declaration.
 *
 * ADR-034: Bitmaps provide type-safe bit field access.
 * The backing type (uint8_t, uint16_t, uint32_t) depends on the bitmap size.
 *
 * #1445 box 3: takes the declared NAME, not the declaration node -- since
 * #2116 the C name 3-Declare gave it, so render reads that decision. The backing
 * type and the field layout both come from `input.symbols`, filled by 1.3
 * Declare; the node was read once, for `.IDENTIFIER().getText()`.
 */
const generateBitmap: TGeneratorFn<string> = (
  fullName: string,
  input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Look up backing type from symbols (collected by SymbolCollector)
  const backingType = input.symbols?.bitmapBackingType.get(fullName);
  invariant(
    backingType,
    `every bitmap declaration codegen visits was collected by the resolver, so its qualified name is in bitmapBackingType (missing '${fullName}')`,
  );

  const lines: string[] = [];

  // Generate comment with field layout
  lines.push(`/* Bitmap: ${fullName} */`);

  // Issue #707: Use shared utility for bitmap field comments
  const fields = input.symbols?.bitmapFields.get(fullName);
  if (fields) {
    lines.push(...BitmapCommentUtils.generateBitmapFieldComments(fields));
  }

  lines.push(`typedef ${backingType} ${fullName};`, "");

  return {
    code: lines.join("\n"),
    effects,
  };
};

export default generateBitmap;
