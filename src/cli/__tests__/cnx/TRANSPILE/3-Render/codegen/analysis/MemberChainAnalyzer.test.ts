/**
 * Unit tests for MemberChainAnalyzer
 *
 * #1668 (C12): whether a chain's final subscript writes a bit is the one
 * operand typer's answer, read off the last step of the target's chain. So
 * each case is a real declared and resolved program, typed as the walk types
 * it, rather than render state set up by hand.
 *
 * The ops' thunks let a test assert that deciding renders nothing: rendering
 * an index queues a pending temp declaration, so a decision that rendered
 * would leak one per chain. The write renders, once (`writeBits`).
 */
import SyntaxLowering from "../../../../../../../cnx/PARSE/2-Parse/SyntaxLowering";
import { describe, it, expect } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CnxListener } from "../../../../../../../cnx/PARSE/2-Parse/grammar/CnxListener";
import * as Parser from "../../../../../../../cnx/PARSE/2-Parse/grammar/CnxParser";
import MemberChainAnalyzer from "../../../../../../../cnx/TRANSPILE/3-Render/codegen/analysis/MemberChainAnalyzer";
import OperandTyper from "../../../../../../../cnx/utils/OperandTyper";
import testAnalysisContextFor from "../../../1-Analyze/testAnalysisContextFor";
import type TPlannedTargetOp from "../../../../../../../cnx/types/TPlannedTargetOp";
import type IBitAccessAnalysis from "../../../../../../../cnx/types/IBitAccessAnalysis";

const DECLARATIONS = `
struct Point {
    u8 flags;
    f32 x;
    u8[4] arr;
}
struct Grid {
    u8[10] items;
}
u8 value;
Point point;
Grid grid;
Point[4] devices;
u8[3][3] matrix;
`;

/**
 * The first assignment in `main`'s body, analyzed as the walk analyzes it:
 * the typer's last step, and the ops planned from the target. `rendered`
 * counts the index thunks that ran.
 */
function analyze(statement: string): {
  result: IBitAccessAnalysis;
  rendered: number;
} {
  const { tree, context } = testAnalysisContextFor(
    `${DECLARATIONS}\nvoid main() {\n    ${statement}\n}`,
    { cppMode: false },
  );
  let target: Parser.AssignmentTargetContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CnxListener {
      override enterAssignmentTarget = (
        ctx: Parser.AssignmentTargetContext,
      ): void => {
        target ??= ctx;
      };
    })(),
    tree,
  );
  expect(target).not.toBeNull();
  const found = target!;
  let rendered = 0;
  const ops: TPlannedTargetOp[] = found.postfixTargetOp().map((op) => {
    const name = op.IDENTIFIER();
    if (name) return { kind: "member", name: name.getText() };
    const indexes = op.expression();
    return {
      kind: "subscript",
      renderIndexes: () => {
        rendered += 1;
        return indexes.map((index) => index.getText());
      },
      foldWidth: () => undefined,
    };
  });
  const result = MemberChainAnalyzer.analyze(
    OperandTyper.chainOf(
      SyntaxLowering.assignmentTarget(found),
      context,
    ).steps.at(-1),
    ops,
  );
  return { result, rendered };
}

describe("MemberChainAnalyzer", () => {
  describe("analyze", () => {
    it("returns isBitAccess false for a chain with no ops", () => {
      expect(MemberChainAnalyzer.analyze(undefined, [])).toEqual({
        isBitAccess: false,
      });
    });

    it.each([
      ["no postfix operations", "value <- 1;"],
      ["a member as the last op", "point.flags <- 1;"],
      ["an element of an array field", "grid.items[0] <- 1;"],
      ["a 2D array element", "matrix[0][1] <- 1;"],
    ])("is not a bit access: %s", (_why, statement) => {
      expect(analyze(statement).result).toEqual({ isBitAccess: false });
    });

    it.each([
      ["a struct member", "point.flags[3] <- true;"],
      ["an array of structs' member", "devices[0].flags[7] <- true;"],
      ["a 2D array element", "matrix[0][1][3] <- true;"],
      // The write path counted an array field's subscripts itself and got
      // this one wrong: `s.arr[1][3] = true;`, which C rejects
      ["an array field's element (#1668, C12)", "point.arr[1][3] <- true;"],
      // #1668 review: a range is bits too, one write for both, so a
      // `global.` chain ending in one is written as bits
      ["a bit range", "point.flags[0, 4] <- 1;"],
      // #1760 review: a float field's bits are ADR-007's too. This row said
      // otherwise, and the write was `point.x[0] = true;`, which C rejects
      ["a float member", "point.x[0] <- true;"],
      ["a float member's bit range", "point.x[0, 8] <- 1;"],
    ])("is a bit access: %s", (_why, statement) => {
      expect(analyze(statement).result).toEqual({ isBitAccess: true });
    });

    it("renders no index for a chain that is not bit access", () => {
      expect(analyze("grid.items[0] <- 1;").rendered).toBe(0);
    });
  });
});
