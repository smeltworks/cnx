/**
 * Switch Statement Generator (ADR-025)
 *
 * Generates C switch statements from cnx switch syntax, expanding `||`
 * labels into consecutive C case labels and guaranteeing a `default`.
 *
 * #1445 box 3: takes `IPlannedSwitch`, not the node. The six-way case-label
 * discrimination is a question about which grammar alternative matched, so it
 * is `TPlannedCaseLabel` and the planner answers it. What is left here is the
 * rendering -- which label opens the brace, how deep each line indents, and
 * Issue #855's Rule 16.4 default.
 *
 * Three exported functions went with the nodes. `generateSwitchCase`,
 * `generateDefaultCase` and `generateCaseLabel` were `TGeneratorFn`-shaped
 * only so they could take a context, and each returned an `effects` array
 * that was ALWAYS empty -- the label path pushed nothing and the two case
 * paths only forwarded what the labels did not produce. Label rendering is a
 * pure function of the plan now, so the plumbing is gone rather than carried.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import type IPlannedSwitch from "../../types/IPlannedSwitch";
import type IPlannedSwitchCase from "../../types/IPlannedSwitchCase";
import type TPlannedCaseLabel from "../../types/TPlannedCaseLabel";

/**
 * Issue #471: resolve an unqualified identifier as a member of the switch's
 * enum. Returns the prefixed member, or null when it is not one.
 */
function tryResolveEnumMember(
  id: string,
  switchEnumType: string,
  symbols: IGeneratorInput["symbols"],
): string | null {
  if (!symbols) return null;
  const members = symbols.enumMembers.get(switchEnumType);
  return members?.has(id)
    ? QualifiedCName.fromSourceName([switchEnumType, id])
    : null;
}

/**
 * Render a binary literal as hex, for cleaner C output.
 *
 * Issue #114: through `BigInt`, which handles the `0b` prefix natively and
 * keeps precision above 2^53. A value beyond 32 bits takes a `ULL` suffix.
 */
function renderBinaryLiteral(text: string, negative: boolean): string {
  const value = BigInt(text);
  const hex = value.toString(16).toUpperCase();
  const suffix = value > 0xffffffffn ? "ULL" : "";
  return `${negative ? "-" : ""}0x${hex}${suffix}`;
}

/**
 * Render one case label.
 *
 * A pure function of the plan and the symbols -- no orchestrator, no effects.
 */
function renderCaseLabel(
  label: TPlannedCaseLabel,
  subjectEnumType: string | undefined,
  input: IGeneratorInput,
): string {
  switch (label.kind) {
    case "qualified":
      return QualifiedCName.fromSourceName(label.parts);
    case "identifier":
      // Issue #471: an unqualified member of the switch's enum takes its
      // type prefix. #1322: a bare member the enum does NOT declare is E0424
      // in pass 2.1 (ADR-017); what reaches here otherwise is a const label.
      // #1739: a const label is written as any use of the const is
      return (
        (subjectEnumType
          ? tryResolveEnumMember(label.name, subjectEnumType, input.symbols)
          : null) ??
        label.resolved ??
        label.name
      );
    case "rooted":
      return label.code;
    case "numeric":
      return label.negative ? `-${label.text}` : label.text;
    case "binary":
      return renderBinaryLiteral(label.text, label.negative);
    case "char":
      return label.text;
    case "none":
      return "";
  }
}

/**
 * Render a case or default body: its statements, then `break;` and the brace.
 *
 * A statement that renders to nothing contributes no line.
 */
function renderBlockBody(
  renderBody: () => readonly string[],
  lines: string[],
  orchestrator: IOrchestrator,
): void {
  for (const statement of renderBody()) {
    if (statement) {
      lines.push(orchestrator.indent(orchestrator.indent(statement)));
    }
  }

  lines.push(
    orchestrator.indent(orchestrator.indent("break;")),
    orchestrator.indent("}"),
  );
}

/**
 * Render one case, expanding `||` into consecutive C labels.
 *
 * Only the LAST label opens the brace; the ones before it fall through.
 */
function renderCase(
  planned: IPlannedSwitchCase,
  subjectEnumType: string | undefined,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string {
  const lines: string[] = [];

  planned.labels.forEach((label, index) => {
    const code = renderCaseLabel(label, subjectEnumType, input);
    const isLast = index === planned.labels.length - 1;
    lines.push(orchestrator.indent(`case ${code}:${isLast ? " {" : ""}`));
  });

  renderBlockBody(planned.renderBody, lines, orchestrator);

  return lines.join("\n");
}

/**
 * Generate C code for a switch statement (ADR-025).
 *
 * #1322: ADR-025's semantic validation is E0711-E0714 in pass 2.1.
 */
const generateSwitch: TGeneratorFn<IPlannedSwitch> = (
  planned: IPlannedSwitch,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const lines: string[] = [`switch (${planned.subject}) {`];

  for (const switchCase of planned.cases) {
    lines.push(
      renderCase(switchCase, planned.subjectEnumType, input, orchestrator),
    );
  }

  if (planned.renderDefaultBody) {
    // Note: default(n) count is for compile-time validation only,
    // not included in generated C
    lines.push(orchestrator.indent("default: {"));
    renderBlockBody(planned.renderDefaultBody, lines, orchestrator);
  } else {
    // Issue #855: MISRA C:2012 Rule 16.4 -- every switch shall have a default
    lines.push(
      orchestrator.indent("default: {"),
      orchestrator.indent(orchestrator.indent("break;")),
      orchestrator.indent("}"),
    );
  }

  lines.push("}");

  return { code: lines.join("\n"), effects: [] };
};

export default generateSwitch;
