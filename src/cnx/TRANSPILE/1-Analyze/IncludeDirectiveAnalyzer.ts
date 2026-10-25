/**
 * ADR-010 include directives: E0503, E0504, E0506.
 *
 * #1322. Three throws -- two in `TypeValidator` and one in `IncludeGenerator`
 * -- all reported as `1:0` with the real line appended to the message as
 * `Line N`, and the third with no error code at all.
 *
 * ## What this pass reads: discovery's answer, not discovery's inputs
 *
 * Whether an include resolves, and whether a header's cnx source is where
 * the same include would find it, are decided once, by 1.1 Discover, while it
 * resolves the file's includes. This pass reads that answer per directive and
 * asks the file system nothing (#1672).
 *
 * #1322 and #1435 handed it discovery's INPUTS instead -- the search path and
 * the quoted-include directory -- because re-deriving them here had already
 * gone wrong twice: codegen's search path lacked the `--include` directories,
 * and its quoted directory started from `dirname(sourcePath)` where discovery
 * started from `workingDir`. With the inputs in hand this pass still made its
 * own decision, along its own branch between the two forms and its own copy
 * of the cnx extensions. It joined an absolute angle include onto each
 * search directory, where discovery resolves it by its path, so E0504 missed
 * a header whose cnx source sat beside it; and it asked the file system a
 * second time, so a file that appeared between the two asks was accepted
 * while the run never discovered it.
 *
 * ## E0506 was uncoded
 *
 * `Error: Included cnx file not found` was a bare `throw new Error`, so it
 * reached the user as `1:0 Code generation failed: Error: …` with no code to
 * look up. It is the code the #1321 audit reserved for it. Discovery already
 * WARNS about the same missing file; the warning is not a diagnostic and the
 * run would exit 0 without this rule, which is why it is relocated rather than
 * deleted as subsumed.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type ISyntaxNode from "../../types/syntax/ISyntaxNode";
import invariant from "../../utils/invariant";
import IncludeDirectiveText from "../../utils/IncludeDirectiveText";
import EFileType from "../../PARSE/1-Discover/types/EFileType";
import IncludeDirective from "./helpers/IncludeDirective";
import IIncludeContext from "./types/IIncludeContext";
import IIncludeDirectiveError from "./types/IIncludeDirectiveError";
import CnxSourcePath from "../../utils/CnxSourcePath";

/**
 * Files that carry definitions; including one duplicates every symbol in it.
 *
 * #1840: kinds, not extensions. This was a list of its own (`.c`, `.cpp`,
 * `.cc`, `.cxx`, `.c++`) beside discovery's, and the two had diverged on
 * `.c++`. 1.1 Discover classifies every directive, and this reads its answer.
 */
const IMPLEMENTATION_KINDS: ReadonlySet<EFileType> = new Set([
  EFileType.CSource,
  EFileType.CppSource,
]);

class IncludeDirectiveChecks {
  private readonly found: IIncludeDirectiveError[] = [];

  public constructor(private readonly context: IIncludeContext) {}

  public errors(): IIncludeDirectiveError[] {
    return this.found;
  }

  public check(ctx: ISyntaxNode): void {
    const spec = IncludeDirective.of(ctx);
    if (spec === null) return;

    const directive = IncludeDirectiveText.join(spec);
    const kind = this.kindOf(directive);
    if (this.checkRejectedCnxFile(ctx, spec, kind)) return;
    if (this.checkImplementationFile(ctx, spec, kind)) return;
    if (
      this.checkMissingCnxFile(ctx, spec, kind, this.resolutionOf(directive))
    ) {
      return;
    }
    this.checkCnxAlternative(
      ctx,
      spec,
      this.context.cnxAlternatives.get(directive),
    );
  }

  /**
   * Discovery's answer for this directive. It reads a `.cnx` file's
   * directives with the grammar's own lexer (#1745), so every directive the
   * parser found has one.
   */
  private kindOf(directive: string): EFileType {
    const kind = this.context.kinds.get(directive);
    invariant(
      kind !== undefined,
      `1.1 Discover classified every directive 1.2 parsed (missing ${directive})`,
    );
    return kind;
  }

  /** Discovery's resolution of this directive (see `kindOf`). */
  private resolutionOf(directive: string): string | null {
    const resolved = this.context.resolutions.get(directive);
    invariant(
      resolved !== undefined,
      `1.1 Discover resolved every directive 1.2 parsed (missing ${directive})`,
    );
    return resolved;
  }

  /**
   * E0518: `#include "Colors.CNX"`. Only a lowercase `.cnx` is cnx source
   * (#1833 owner ruling), in either form of include.
   */
  private checkRejectedCnxFile(
    ctx: ISyntaxNode,
    spec: { path: string; isLocal: boolean },
    kind: EFileType,
  ): boolean {
    if (kind !== EFileType.RejectedCnx) return false;
    const rejection = CnxSourcePath.rejection(
      spec.path,
      "rename the file and this include.",
    );
    invariant(rejection !== null, `${spec.path} is a rejected cnx path`);
    this.found.push({
      code: rejection.code,
      span: ctx.span,
      message: rejection.message,
      helpText: rejection.helpText,
    });
    return true;
  }

  /** E0503: `#include "helper.c"` -- a definition, not an interface. */
  private checkImplementationFile(
    ctx: ISyntaxNode,
    spec: { path: string; isLocal: boolean },
    kind: EFileType,
  ): boolean {
    if (!IMPLEMENTATION_KINDS.has(kind)) return false;
    this.found.push({
      code: "E0503",
      span: ctx.span,
      message: `Cannot #include implementation file '${spec.path}'. Only header files (.h, .hpp) are allowed.`,
      helpText:
        "An implementation file defines its symbols, so including it defines them again in every includer (ADR-010); include the header instead.",
    });
    return true;
  }

  /**
   * E0506: `#include "helper.cnx"` naming a file that is not there.
   *
   * Quoted only, and resolved relative to the including file, because that is
   * what ADR-010 says a quoted include means. An angle include is searched
   * along the run's paths and its absence is discovery's warning to give.
   */
  private checkMissingCnxFile(
    ctx: ISyntaxNode,
    spec: { path: string; isLocal: boolean },
    kind: EFileType,
    resolved: string | null,
  ): boolean {
    if (!spec.isLocal || kind !== EFileType.Cnx) return false;
    if (resolved !== null) return false;
    // The help names no absolute path on purpose. The throw this replaces put
    // the resolved path in its message; it had no fixture, and the first one
    // written for it embedded this machine's checkout directory in an
    // `.expected.error`. A quoted include resolves relative to the including
    // file, so the spelling IS the relative answer and the directory is the
    // one the reader already has open.
    this.found.push({
      code: "E0506",
      span: ctx.span,
      message: `Included cnx file not found: ${spec.path}`,
      helpText:
        "A quoted include is resolved relative to the file it appears in (ADR-010); check the spelling and the path from this file's own directory.",
    });
    return true;
  }

  /**
   * E0504: a header is included where its cnx source sits beside it.
   *
   * The generated header and the `.cnx` describe the same interface, but only
   * the `.cnx` carries what the transpiler needs to check the call.
   */
  private checkCnxAlternative(
    ctx: ISyntaxNode,
    spec: { path: string; isLocal: boolean },
    cnxPath: string | undefined,
  ): void {
    if (cnxPath === undefined) return;

    const instead = IncludeDirectiveText.join({
      path: cnxPath,
      isLocal: spec.isLocal,
    });
    this.found.push({
      code: "E0504",
      span: ctx.span,
      message: `Found ${IncludeDirectiveText.join(spec)} but '${cnxPath}' exists at the same location.\n       Use ${instead} instead to use the cnx version.`,
      helpText:
        "The generated header describes the interface; the cnx source is what the transpiler can check calls against (ADR-010).",
    });
  }
}

class IncludeDirectiveAnalyzer {
  public analyze(
    program: IProgramSyntax,
    context: IIncludeContext,
  ): IIncludeDirectiveError[] {
    const checks = new IncludeDirectiveChecks(context);
    for (const include of program.includes) checks.check(include);
    return checks.errors();
  }
}

export default IncludeDirectiveAnalyzer;
