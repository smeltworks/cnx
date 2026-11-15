import BindingSite from "../../utils/BindingSite";
import type IConflict from "../../types/IConflict";
import type IProgram from "../../types/IProgram";
import type ITargetDescription from "../../types/ITargetDescription";
import type ITranspileError from "../../types/ITranspileError";
import CodedErrorText from "../../utils/CodedErrorText";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import IRunTargetCheck from "./types/IRunTargetCheck";

/**
 * The whole-program checks 1.4 Resolve settles before any file is analyzed:
 * the run's target, symbol conflicts, and external-identifier significance.
 * Each needs every file, which is why it is 1.4's (#1443 moved them out of the
 * orchestrator, which now only orders them and records what they return).
 */
class ProgramChecks {
  /**
   * The run's target, or why it has none (ADR-049).
   *
   * 1.4 settled it with the program; this only reports. An error with no
   * position is about the target option rather than a line of source, and is
   * placed on the entry file -- the last file in pipeline order, which lists
   * dependencies first. A parse-only run needs no target, so only an absent
   * one is excused there.
   */
  static runTarget(
    program: IProgram,
    parseOnly: boolean,
    entryPath: string | undefined,
  ): IRunTargetCheck {
    const target = program.target();
    if (target.kind === "resolved") {
      return {
        proceed: true,
        target: { name: target.name, source: target.source },
        errors: [],
      };
    }
    // ADR-049: a parse-only run needs no target, so an ABSENT one (E0515) is
    // no error there -- but every name the program gives must still be a
    // known target (#1760 second review: `--parse` accepted
    // `#pragma target bogus`, an unknown pragma and two conflicting ones)
    if (parseOnly && target.absent) {
      return { proceed: true, target: null, errors: [] };
    }
    return {
      proceed: false,
      target: null,
      errors: target.errors.map((error) =>
        error.sourcePath === undefined && entryPath !== undefined
          ? { ...error, sourcePath: entryPath }
          : error,
      ),
    };
  }

  /**
   * Symbol conflicts, one error per conflict.
   *
   * #1511: read from the artifact, not re-derived from the table.
   *
   * #1334: a conflict is an ordinary diagnostic. It used to reach the user
   * through a SECOND channel -- `result.conflicts`, printed by ResultPrinter
   * with a `Conflict:` prefix that duplicated the message's own `Symbol
   * conflict:` prefix -- plus ONE companion error with no position hardcoded at
   * 1:0. Two outputs for one problem, and the only diagnostic path in the
   * transpiler with no error code. Now: one error per conflict, at the
   * offending definition, coded like every other diagnostic. The channel is
   * retired whole: `ITranspilerResult.conflicts` is gone along with its reader,
   * so a conflict has ONE representation in the result. `IConflict.severity` is
   * `"error"`, so every conflict fails the run by construction.
   */
  static conflicts(program: IProgram): ITranspileError[] {
    return program.conflicts().map(ProgramChecks.conflictToError);
  }

  /**
   * External identifiers that are not distinct within the target's
   * significant-character limit (MISRA C:2012 Rule 5.1, issue #1307).
   *
   * A sibling of the conflict check rather than part of it: a symbol
   * *conflict* is two declarations competing for one name, which is a fact
   * about the symbol table. This is a fact about the C target -- the same two
   * declarations are fine at 63 significant characters and wrong at 31 -- so
   * it is reported as a coded diagnostic against a source line, the way E0203
   * is.
   *
   * `targetDescription` is the BUILD's, which 1.4 settled once -- not
   * `TranspileState.targetDescription`, which codegen assigns per file after
   * this runs, so it holds nothing on a fresh process and the previous file's
   * target in a long-lived one (#1307 review).
   */
  static externalIdentifiers(
    symbolTable: IResolvedSymbols,
    targetDescription: ITargetDescription,
  ): ITranspileError[] {
    return symbolTable
      .detectMISRA51Conflicts(targetDescription)
      .map(ProgramChecks.conflictToError);
  }

  /**
   * The one rendering of a conflict as a diagnostic.
   *
   * Both conflict checks used to do this themselves and disagreed on both halves:
   * one read `conflict.line`, the other re-derived it from `definitions[0]`; one
   * hardcoded `error[E0425]`, the other embedded `error[E0204]` in the message
   * text. They were written against different bases and merged into `main`
   * without either CI run seeing the other (#1339 + #1342), which is how `main`
   * came to fail `tsc`.
   *
   * Anchored to a file even in single-file builds: the message runs to several
   * lines, and the CLI's reader only accumulates continuation lines under a
   * `path:line:col` header -- without a sourcePath the colliding names are
   * printed and then dropped on the way to a snapshot.
   */
  private static conflictToError(conflict: IConflict): ITranspileError {
    // #1402: the clash is about the definition in another file, if any
    const other = conflict.definitions.find(
      (definition) => definition.sourceFile !== conflict.sourceFile,
    );
    return {
      declaredAt: other && BindingSite.ofSymbol(other),
      line: conflict.line,
      column: conflict.column,
      sourcePath: conflict.sourceFile,
      message: CodedErrorText.of(conflict.code, conflict.message),
      severity: conflict.severity,
    };
  }
}

export default ProgramChecks;
