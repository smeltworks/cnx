/**
 * EnumGenerator - ADR-017 Enum Declaration Generation
 *
 * Generates C typedef enum declarations from cnx enum syntax.
 *
 * Example:
 *   enum State { IDLE, RUNNING, ERROR <- 255 }
 *   ->
 *   typedef enum {
 *       State_IDLE = 0,
 *       State_RUNNING = 1,
 *       State_ERROR = 255
 *   } State;
 */
import invariant from "../../../../../utils/invariant";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";

/**
 * Generate a C typedef enum from a cnx enum declaration.
 *
 * ADR-017: Enums are strongly-typed with explicit integer backing.
 * Members are prefixed with the enum name to avoid C namespace collisions.
 *
 * #1445 box 3: takes the declared NAME, not the declaration node. The node was
 * read once, for `.IDENTIFIER().getText()`; the members and their values come
 * from `input.symbols.enumMembers`, which 1.3 Declare filled. Rendering an
 * enum never needed the tree -- it needed a name to look the enum up by.
 */
const generateEnum: TGeneratorFn<string> = (
  name: string,
  input: IGeneratorInput,
  state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  // ADR-016: Apply scope prefix if inside a scope
  const fullName = QualifiedNameGenerator.forMember(
    state.currentScopePath,
    name,
  );

  const lines: string[] = [];
  lines.push(`typedef enum {`);

  // Look up enum members from symbols (collected by SymbolCollector)
  const members = input.symbols?.enumMembers.get(fullName);
  invariant(
    members,
    `every enum declaration codegen visits was collected by the resolver, so its qualified name is in enumMembers (missing '${fullName}')`,
  );

  const memberEntries = Array.from(members.entries());

  for (let i = 0; i < memberEntries.length; i++) {
    const [memberName, value] = memberEntries[i];
    // Prefix member names to avoid C namespace collisions
    const fullMemberName = QualifiedCName.fromSourceName([fullName, memberName]);
    const comma = i < memberEntries.length - 1 ? "," : "";
    lines.push(`    ${fullMemberName} = ${value}${comma}`);
  }

  lines.push(`} ${fullName};`, "");

  // No side effects needed for enum generation
  return {
    code: lines.join("\n"),
    effects: [],
  };
};

export default generateEnum;
