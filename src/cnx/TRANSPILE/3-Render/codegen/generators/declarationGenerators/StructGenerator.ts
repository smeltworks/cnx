/**
 * StructGenerator - Struct Declaration Generation
 *
 * Generates C typedef struct declarations from cnx struct syntax.
 *
 * Example:
 *   struct Point { i32 x; i32 y; }
 *   ->
 *   typedef struct {
 *       int32_t x;
 *       int32_t y;
 *   } Point;
 *
 * ADR-029: Structs with callback fields get an auto-generated init function.
 * ADR-036: Multi-dimensional array support in struct fields.
 *
 * #1445 box 3: takes `IPlannedStruct`, not the node. What is left here is what
 * this generator should decide -- which fields are callbacks, which need an
 * explicit zero, and whether tracked dimensions override the written ones --
 * none of which is a question about the tree.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import TGeneratorEffect from "../TGeneratorEffect";
import DeclaredPointer from "../../../../../utils/DeclaredPointer";
import ICodeGenSymbols from "../../../../../types/ICodeGenSymbols";
import StructInitFunction from "../../helpers/StructInitFunction";
import type IPlannedStruct from "../../types/IPlannedStruct";
import type IPlannedStructField from "../../types/IPlannedStructField";

/**
 * Generate a callback field declaration for a struct.
 */
function generateCallbackField(
  field: IPlannedStructField,
  callbackInfo: { typedefName: string },
): string {
  if (field.hasNameDimensions) {
    return `    ${callbackInfo.typedefName} ${field.name}${field.renderNameDimensions()};`;
  }
  return `    ${callbackInfo.typedefName} ${field.name};`;
}

/**
 * Generate a regular (non-callback) field declaration for a struct.
 */
function generateRegularField(
  field: IPlannedStructField,
  structName: string,
  input: IGeneratorInput,
): string {
  // #1744: a field of an opaque C type holds the handle, as the `.h` says
  const type = DeclaredPointer.spell(
    field.renderCType(),
    input.symbols?.structFieldHandles.get(structName)?.has(field.name) ?? false,
  );

  // Check if we have tracked dimensions for this field (includes string capacity for string arrays)
  const fieldDims = getTrackedFieldDimensions(
    input.symbols,
    structName,
    field.name,
  );

  if (fieldDims !== undefined) {
    // Use tracked dimensions (includes string capacity for string arrays).
    // Neither dimension render runs on this branch, which is why both arrive
    // as thunks: rendering them here would register effects for dimensions
    // this field does not emit.
    const dimsStr = fieldDims.map((d) => `[${d}]`).join("");
    return `    ${type} ${field.name}${dimsStr};`;
  }

  if (field.hasTypeDimensions || field.hasNameDimensions) {
    // Combine arrayType dimension (if any) with arrayDimension dimensions
    return `    ${type} ${field.name}${field.renderTypeDimensions()}${field.renderNameDimensions()};`;
  }

  return `    ${type} ${field.name};`;
}

/**
 * Get tracked field dimensions from symbols if available.
 */
function getTrackedFieldDimensions(
  symbols: ICodeGenSymbols | null,
  structName: string,
  fieldName: string,
): readonly (number | string)[] | undefined {
  if (!symbols) {
    return undefined;
  }
  const trackedDimensions = symbols.structFieldDimensions.get(structName);
  const fieldDims = trackedDimensions?.get(fieldName);
  return fieldDims && fieldDims.length > 0 ? fieldDims : undefined;
}

/**
 * Generate a C typedef struct from a cnx struct declaration.
 *
 * Handles:
 * - Regular fields with primitive types
 * - Callback function pointer fields (ADR-029)
 * - Array fields with tracked dimensions (ADR-036)
 * - String array fields with capacity tracking
 */
const generateStruct: TGeneratorFn<IPlannedStruct> = (
  planned: IPlannedStruct,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const { name } = planned;
  const lines: string[] = [];
  // Issue #296: Use named struct for forward declaration compatibility
  lines.push(`typedef struct ${name} {`);

  for (const field of planned.fields) {
    const typeName = field.typeName;

    // ADR-029: Check if this is a callback type field
    if (field.isCallback) {
      const callbackInfo = input.callbackTypes.get(typeName)!;
      lines.push(generateCallbackField(field, callbackInfo));
    } else {
      // Regular field handling
      lines.push(generateRegularField(field, name, input));
    }
  }

  lines.push(`} ${name};`, "");

  // Issues #369/#1164: when the .c includes its own header, the header owns the
  // *type*. The ADR-029 init function is a definition, not a type — it has
  // external linkage and no other home, so it is still emitted here. Suppressing
  // the whole generator (rather than just the typedef) silently dropped it.
  const typeDefinition = state.headerOwnsTypeDefinitions ? [] : lines;

  // #1205: the init function is emitted here and declared in the header. The
  // header is told which structs got one rather than working it out again --
  // see StructInitFunction for why re-deriving it there is wrong.
  // #1283/#1570: a struct gets one exactly when its default is not all zero,
  // which includes a struct whose only callback is in a nested struct field.
  const initFunction: string[] = [];
  const defaultBrace = orchestrator.renderStructDefault(name, []);
  if (defaultBrace !== null) {
    initFunction.push(StructInitFunction.definition(name, defaultBrace));
    effects.push({ type: "register-struct-init", structName: name });
  }

  return {
    code: [...typeDefinition, ...initFunction].join("\n"),
    effects,
  };
};

export default generateStruct;
