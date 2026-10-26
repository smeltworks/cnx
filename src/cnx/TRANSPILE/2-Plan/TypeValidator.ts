/**
 * TypeValidator - Handles compile-time validation of types, assignments, and control flow
 * Static class using CodeGenState for all state access.
 * Issue #63: Validation logic separated for independent testing
 */
import OperandTyper from "../../utils/OperandTyper";
import type TValueBinding from "../../types/TValueBinding";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import AdrProvenance from "../../instrumentation/AdrProvenance";
// SonarCloud S3776: Extracted literal parsing to reduce complexity
import QualifiedCName from "../../utils/QualifiedCName";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";
import PositionFreeScopeMember from "../../utils/PositionFreeScopeMember";
import type TranspileState from "../TranspileState";

/**
 * TypeValidator class - validates types, assignments, and control flow at compile time.
 * All methods are static - uses CodeGenState for state access.
 */
class TypeValidator {
  // ========================================================================
  // Include Validation (ADR-010) -- relocated to pass 2.1 (#1322)
  // ========================================================================
  //
  // `validateIncludeNotImplementationFile` (E0503) and
  // `validateIncludeNoCnxAlternative` (E0504, both its quoted and its angle
  // branch) stood here, reached from `CodeGenerator.processIncludeDirectives`
  // with a line number threaded in as a NUMBER, spent on `Line N` prose while
  // the diagnostic itself reported `1:0`. `IncludeDirectiveAnalyzer` decides
  // both at the directive's own position.
  //
  // The angle branch also took its search path from
  // `IncludeDiscovery.discoverIncludePaths`, a SECOND derivation of a list
  // discovery had already built with the `--include` directories in it. The
  // two agreed only where `--include` was unused; 2.1 reads discovery's own
  // list, so there is one derivation.

  // #1322: ADR-034's literal-overflow check is E0881 in pass 2.1.
  //
  // `validateBitmapFieldLiteral` stood here and was reached only from the
  // bitmap assignment handler, which had already resolved the field. The rule
  // is about the VALUE and the field's width, both of which the parse tree and
  // the per-file bitmap layouts carry, so it needs no handler to have run
  // first -- and asking it there meant it could never see a write reached by
  // any other path.

  // ========================================================================
  // Array Bounds Validation (ADR-036)
  // ========================================================================

  // #1322: ADR-036's constant index bounds check (E0854) is in pass 2.1,
  // asked at every subscript of an expression or a target through one prefix
  // walk. It was reached from three codegen paths that each resolved the
  // array's name their own way, and a struct field's dimensions were never
  // among them.
  // #1322: ADR-029's callback rules are E0879 and E0880 in pass 2.1.
  //
  // `validateCallbackAssignment` and `callbackSignaturesMatch` stood here and
  // compared `ICallbackTypeInfo`, whose `isConst` is `declared || inferred`.
  // The inferred half is #268 auto-const -- a 2.2 Plan fact about whether a
  // BODY modifies a parameter -- so the check could not move as written, and
  // it protected nothing: it read `getUnmodifiedParameters()` before
  // `modifiedParameters` was filled, so both sides came back "unmodified" and
  // the const comparison was vacuous. 2.1 compares the DECLARED signature,
  // which 1.4 Resolve settles onto the symbol.

  // ========================================================================
  // Const Assignment Validation (ADR-013)
  // ========================================================================

  // #1322: ADR-013's `checkConstAssignment` and `isConstValue` are E0900
  // in pass 2.1, decided once from the frames and the program's symbols
  // rather than from `currentParameters` and the type registry.
  /**
   * The C name a bare identifier emits under, or null to leave it as written.
   *
   * #1668 (C7): which declaration a value name means is the binder's -- local,
   * then scope, then global (ADR-057) -- at the reference's position. This
   * used to take a per-function set of local names, which could not tell a
   * block's local from its sibling block's, and ask a registry keyed by
   * spelling whether a global existed. Function, enum, struct and register
   * names are not value bindings and keep their own checks below.
   *
   * @param at Position of the reference. Its line also records #1241
   *   provenance: an ADR-057 resolution is invisible to the scope-context
   *   matrix otherwise, because a successful resolution emits no diagnostic
   *   to take one from. Recorded HERE rather than at the three callers,
   *   which are required not to re-derive this decision.
   */
  static resolveBareIdentifier(
    identifier: string,
    at: ISourcePosition,
    isKnownStruct: (name: string) => boolean,
    state: TranspileState,
  ): string | null {
    return TypeValidator.resolveBoundIdentifier(
      identifier,
      state.bindingAt(null, identifier, at),
      at,
      isKnownStruct,
      state,
    );
  }

  /**
   * `resolveBareIdentifier`'s decision for a caller that already holds the
   * binding at `at` and asks it something else too (#1967): the
   * same C name, from the same binding, without binding the name twice.
   */
  static resolveBoundIdentifier(
    identifier: string,
    binding: TValueBinding | null,
    at: ISourcePosition,
    isKnownStruct: (name: string) => boolean,
    state: TranspileState,
  ): string | null {
    if (binding?.kind === "local") {
      // ADR-057: a local normally emits under its own name (null = "leave it
      // alone"). One that shadows a file-scope symbol, or whose initializer
      // reads the enclosing local it shadows (#1643), was given a distinct C
      // identifier at its declaration, and every reference must follow it.
      const emitted = state.localCName(binding.declaration, at);
      return emitted === identifier ? null : emitted;
    }

    // A scope member, by the binder's middle tier: a variable, or a function
    // named as a value (#1760 review)
    if (
      (binding?.kind === "variable" || binding?.kind === "function") &&
      binding.symbol.scopePath !== ""
    ) {
      AdrProvenance.record("057", at.line);
      return binding.symbol.fullyQualifiedCName;
    }

    // #1991 review: the scope enclosing the reference, from Program's lexical
    // frames -- not the scope 2.3 is writing, which 2.2 never has
    const currentScopePath = OperandTyper.scopePathAt(
      at,
      state.typingContext(),
    );

    if (currentScopePath) {
      const scopeResolved = TypeValidator._resolveScopeMember(
        identifier,
        currentScopePath,
        state,
      );
      if (scopeResolved) {
        AdrProvenance.record("057", at.line);
        return scopeResolved;
      }
    }

    const isGlobalValue =
      binding?.kind === "variable" ||
      binding?.kind === "function" ||
      binding?.kind === "foreign";
    if (
      isGlobalValue ||
      TypeValidator._isKnownGlobalIdentifier(
        identifier,
        currentScopePath,
        isKnownStruct,
        state,
      )
    ) {
      return currentScopePath ? identifier : null;
    }

    return null;
  }

  private static _resolveScopeMember(
    identifier: string,
    currentScopePath: string,
    state: TranspileState,
  ): string | null {
    // #1295: getScopeMembers is keyed by the scope's dotted source path.
    // Its variables and functions were answered above, from the binding
    // (#1760 review); one the binder skipped is not there yet (#1643).
    if (
      PositionFreeScopeMember.is(
        state.getScopeMembers(currentScopePath),
        currentScopePath,
        identifier,
        state.typingContext().program,
      )
    ) {
      return QualifiedNameGenerator.forMember(currentScopePath, identifier);
    }
    return null;
  }

  private static _isKnownGlobalIdentifier(
    identifier: string,
    currentScopePath: string,
    isKnownStruct: (name: string) => boolean,
    state: TranspileState,
  ): boolean {
    if (
      state.knownFunctions.has(identifier) &&
      // #1295: pass the PATH, not its leaf. `isInScope` needs no help encoding
      // it -- `prefixFor` runs the path through `toParts`, which splits on the
      // source separator, so `Outer.Inner` becomes the prefix `Outer__Inner__`
      // where `leafOf` gave `Inner__`. File scope is handled before that, by
      // `isInScope`'s own `if (!scopeName) return false`: `prefixFor("")` would
      // otherwise return the bogus `"__"`.
      //
      // #2116: `scope-joins:check` now counts every `isInScope` call by its
      // whole argument text, so re-inlining a leaf here is an unadjudicated
      // site and fails the check.
      !QualifiedCName.isInScope(identifier, currentScopePath)
    ) {
      return true;
    }

    return (
      state.symbols!.knownEnums.has(identifier) ||
      isKnownStruct(identifier) ||
      state.symbols!.knownRegisters.has(identifier)
    );
  }

  // ========================================================================
  // Critical Section Validation (ADR-050)
  // ========================================================================

  // #1322: `validateNoEarlyExits` and its four private helpers are gone. The
  // rule is E0853 in pass 2.1, where a tree walk reaches every statement the
  // grammar can nest inside a `critical` block.
  //
  // The recursion here ENUMERATED the kinds it descended into -- return, if,
  // while, for, do-while -- and omitted `switch`, so a `return` in a switch
  // case compiled clean and emitted C that returns between
  // `__cnx_disable_irq()` and `__cnx_set_PRIMASK()`. On device, interrupts stay
  // off. A walk does not enumerate, so it cannot have that hole.

  // ========================================================================
  // Switch Statement Validation (ADR-025)
  // ========================================================================

  // #1322: ADR-025's switch rules are E0711-E0714 in pass 2.1 --
  // `validateSwitchStatement` and the three helpers only it used are gone.
  // All five throws reached the user as `1:0`, which seven fixtures under
  // `tests/switch/` asserted verbatim. Nothing here needed a fact the
  // analyzers could not already see: `knownEnums` and `enumMembers` are on the
  // per-file symbol view, and the clause count, the labels and `default(N)`
  // are in the parse tree. They lived here because this is where the switch
  // was being WRITTEN, not because this is where the facts were.

  // #1322: `validateNoNestedTernary` is gone. ADR-022's rule is E0710 in pass
  // 2.1, asked of the parse tree.
  //
  // What stood here was a SUBSTRING TEST on the branch's source text --
  // `text.includes("?") && text.includes(":")` -- which rejected
  // `(n = 1) ? "a?b:c" : "plain"`, a legal ternary whose true branch is a
  // string literal containing both characters. A rule about syntax asking
  // about characters.

  // #1322: ADR-022's controlling-expression rule is E0701/E0702 in pass 2.1.
  // Eight methods stood here -- the boolean check, its three-level decomposition
  // of `||`/`&&`, the help-text builder, and the two function-call checks. The
  // rule is purely SYNTACTIC, so none of it needed anything codegen had; only
  // the help text asked a type question, and 2.1 asks it of the lexical frames,
  // which honour shadowing where a flat registry lookup does not.

  // #1322: ADR-068's always-true loop condition (E0707) is in pass 2.1, with
  // `for (;;)` and E0705 beside it. Five methods stood here -- the literal
  // slice's comparison reader, its number parser and the verdict -- all facts
  // of the parse tree that never needed codegen.

  // #1322: MISRA 12.2's shift-amount rule (E0873) is in pass 2.1, beside the
  // Rule 10.1 signed-operand rule it always belonged with. Five methods stood
  // here -- the width table, the literal amount evaluator and the two throws --
  // and the compound forms (`<<<-`, `>><-`) never reached them.

  // #1322: `validateIntegerAssignment` stood here -- ADR-024's literal-range,
  // narrowing and sign-change rules, reached through `AssignmentValidator`,
  // which caught the throw and prefixed `${line}:${col}` onto it. E0868/E0869
  // in pass 2.1 now.
}

export default TypeValidator;
