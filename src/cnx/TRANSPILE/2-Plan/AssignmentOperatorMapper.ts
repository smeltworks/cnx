/**
 * ADR-001: the one place a cnx assignment operator becomes its C form.
 *
 * #1322 unified the TABLE -- a byte-identical `ASSIGNMENT_OPERATOR_MAP` had
 * stood in `CodeGenerator` beside the shared one. What stayed duplicated was
 * the DECISION: `getText()`, the lookup, and the `|| "="` fallback were
 * rewritten at three call sites (`AssignmentContextBuilder`, and both the
 * `forAssignment` and `forUpdate` paths in `ControlFlowGenerator`). CLAUDE.md
 * counts that separately from the data -- "single source of truth means the
 * _decision_" -- and three copies of a fallback diverge silently.
 *
 * #1585 is what forced it: ADR-001 needs a provenance site for its assignment
 * half, and adding one to each of three sites would have been a fourth thing
 * to keep in step. One decision, one recording.
 *
 * #1588: a lookup miss is an INVARIANT, not a fallback. `|| "="` returned a
 * wrong answer rather than a missing one -- `i +<- 1` became `i = 1`, which in
 * a `for` update is an infinite loop in generated firmware, emitted at exit 0
 * with no diagnostic.
 *
 * It is `invariant()` and not `throw new`, per #1322b: the map and the grammar
 * are two halves of one fact, so a miss means the transpiler is wrong, not the
 * author's program. A `throw new` here would also rejoin the `output/` corpus
 * that #1322 emptied -- bucket 2 of `throw-classification.md` is exactly
 * this shape, and all sixteen of its sites became assertions for that reason.
 * `scripts/__tests__/assignment-operator-parity.test.ts` catches the divergence
 * at its source; this catches it at the point of use.
 */
import AdrProvenance from "../../instrumentation/AdrProvenance";
import ASSIGNMENT_OPERATOR_MAP from "../../utils/constants/OperatorMappings";
import invariant from "../../utils/invariant";

class AssignmentOperatorMapper {
  /**
   * The C operator for `cnxOp`, recording that ADR-001's rule fired at
   * `line` so the scope-context matrix can derive which cell it occupied.
   *
   * Takes the operator's TEXT and LINE rather than its parse context on
   * purpose. Accepting the context reads better at the three call sites, and
   * `npm run parse-tree:check` rejected it: #1317 gates the population of
   * modules holding a parse tree and forbids it growing, and this one has no
   * question for the tree that a string and a number cannot answer.
   */
  static toCOperator(cnxOp: string, line: number | undefined): string {
    AdrProvenance.record("001", line, undefined, "its-position");
    const cOp = ASSIGNMENT_OPERATOR_MAP[cnxOp];
    invariant(
      cOp !== undefined,
      `every assignmentOperator alternative in the grammar has an ASSIGNMENT_OPERATOR_MAP entry (missing '${cnxOp}')`,
    );
    return cOp;
  }
}

export default AssignmentOperatorMapper;
