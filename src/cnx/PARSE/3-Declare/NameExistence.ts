/**
 * NameExistence — one answer to "does this name denote anything visible HERE?"
 *
 * `TypeNameLadder` maps a written type to a C name; it never asks whether the name
 * denotes a type, and its `null` means "no grammar alternative matched", not
 * "not found". So every position that consumes a name fell back to emitting the
 * raw source text: `CodeGenerator.getTypeName` via `resolved ?? ctx.getText()`
 * (#1312) and `TypeValidator.resolveBareIdentifier` via a `null` that conflates
 * "emit unchanged, it is fine" with "no idea what this is" (#1353). Both exited
 * 0 and emitted C that the C compiler rejects.
 *
 * ## Why two sources of truth, and which one answers which question
 *
 * The two available symbol views disagree, and the disagreement IS #1312:
 *
 * | view                              | scope     | sibling case says |
 * | --------------------------------- | --------- | ----------------- |
 * | `ICodeGenSymbols` `known*` sets    | per FILE  | `Mode` unknown    |
 * | `IResolvedSymbols.getOverloadsByCName`  | whole RUN | `Mode` known      |
 *
 * `ICodeGenSymbols` is built by 1.4's `Program.deriveVisibleSymbols`, over the
 * include graph discovery resolved, so it holds exactly what this file can see
 * (#1435; it cited a `_declareFile` signature #1472 removed). The
 * `IResolvedSymbols` accumulates every file in the run and is cleared once, so a
 * sibling that was never included is still in it. Asking the run-wide table
 * whether a cnx type exists would answer "yes" in the file that cannot see
 * it, and the diagnostic would never fire where it is needed -- the trap #1312
 * names explicitly.
 *
 * So the two questions are routed to the view that can answer them:
 *
 *   - a **cnx** name is checked against the per-file sets, because cnx
 *     visibility is what the include graph governs;
 *   - a **C/C++** name is checked against the run-wide table, because external
 *     types arrive through header includes that are already resolved per file,
 *     and because the failure directions are not symmetric. Missing an external
 *     type means a diagnostic does not fire (the status quo). Wrongly rejecting
 *     one means valid code stops compiling. Only the second is a regression, so
 *     the external side is deliberately permissive.
 *
 * `IProgram.scopeTypeOf()` cannot serve here either: it answers only
 * for a type declared inside a SCOPE that the file being generated can see
 * (#1724), so it says nothing about a file-scope cnx type or a C/C++ one.
 */

import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type IResolvedSymbols from "../../types/IResolvedSymbols";

class NameExistence {
  /**
   * Whether a bare type name denotes a type this file can see.
   *
   * `TranspileState.callbackTypes` is deliberately NOT consulted. It is codegen
   * state -- planned by `FilePlanner.planCallbackTypes` and replaced at the
   * start of each file's 2.2 Plan, both of which run after the analyzers -- so at
   * analysis time it is empty for the first file and holds file N-1's function
   * names for every file after. Reading it made E0426 order-dependent: the same
   * two files with their `#include` lines swapped either diagnosed the undefined
   * type or emitted C the compiler rejects at exit 0. `_isKnownCnxType` already asks
   * `symbols.functionReturnTypes`, which is the per-file view of the same
   * ADR-029 fact and is correct here.
   *
   * Only the bare `userType()` branch belongs here. `this.T`, `global.T` and
   * `Scope.T` state their scope in the syntax and are resolved by their own
   * branches; once a name is a string those answers are indistinguishable from
   * a bare one, which is the same reason `TypeNameLadder` keeps them separate.
   *
   * ## A register is not a type (#1336)
   *
   * `symbols.knownRegisters` is deliberately NOT consulted. `TYPE_FORMING_KINDS`
   * already owns "does this kind introduce a type name" and already excludes
   * `register` for this reason; this predicate answers the same question from
   * the per-file name sets, and used to disagree with that owner. The
   * disagreement WAS the bug: E0426 asks whether a name is a type, the register
   * set answered "yes", and `Control c;` reached codegen with no typedef behind
   * it -- exit 0, then `unknown type name 'Control'` from the C compiler.
   *
   * ADR-004 is what makes the exclusion correct today: a register declares a
   * variable at an address, not a type. ADR-111 would make a register name a
   * type, but it is `Research`, and its own header states that while it is
   * Research "a register is still not a type".
   *
   * ADR-111: when it is IMPLEMENTED (not merely Accepted), add `knownRegisters`
   * back here, drop `isValueName` and `isRegisterName`, and retire E0429.
   */
  static isTypeName(
    typeName: string,
    symbols: ICodeGenSymbols,
    symbolTable: IResolvedSymbols,
  ): boolean {
    return (
      NameExistence._isKnownCnxType(typeName, symbols, symbolTable) ||
      NameExistence._isKnownForeignName(typeName, symbolTable)
    );
  }

  /**
   * Whether a bare name denotes anything other than a variable that is usable
   * in a VALUE position.
   *
   * This is `isTypeName` plus registers, and the difference is the whole point
   * of the split (#1336). A type answers here because it is the base of
   * `Type.MEMBER`; a register answers here because `GPIO.DR` reads a value at
   * an address. One predicate served both positions and so had to say "yes" to
   * a register, which suppressed the type-position diagnostic and let
   * `Control c;` reach codegen with no type behind it.
   *
   * ## Why no variable term (#1643)
   *
   * A variable is `Program.bindValue`'s, the one place a spelling becomes a
   * declaration (#1668). It binds one only from a file this one can see
   * (#1398) and only once its declaration closes (ADR-030). The per-file
   * `knownVariables` set this read had no position, so a second answer here
   * accepted `u32 a <- b + 1` above `b` while binding found nothing.
   *
   * ADR-111: if a register becomes a type, this collapses into `isTypeName`.
   */
  static isValueName(
    name: string,
    symbols: ICodeGenSymbols,
    symbolTable: IResolvedSymbols,
  ): boolean {
    return (
      NameExistence.isTypeName(name, symbols, symbolTable) ||
      NameExistence.isRegisterName(name, symbols)
    );
  }

  /**
   * Whether a bare name denotes a register (ADR-004).
   *
   * Separate from the two position predicates because the type position needs
   * to tell "this name is a register" apart from "this name is nothing at all"
   * -- E0429 against E0426. Answering "not a type" is enough to reject; naming
   * *why* is what makes the diagnostic worth reading, since the register is
   * declared right there in the file.
   *
   * ADR-111: retire this along with E0429 when a register becomes a type.
   */
  static isRegisterName(name: string, symbols: ICodeGenSymbols): boolean {
    return symbols.knownRegisters.has(name);
  }

  /**
   * ADR-017: an enum member may be written bare where the expected type makes
   * it unambiguous -- a variable declaration, a struct field initializer, a
   * switch case, a return statement, a ternary arm. It is a value, but it is
   * neither a variable nor a type, so neither of the other lookups sees it.
   */
  static isKnownEnumMember(name: string, symbols: ICodeGenSymbols): boolean {
    for (const members of symbols.enumMembers.values()) {
      if (members.has(name)) {
        return true;
      }
    }
    return false;
  }

  private static _isKnownCnxType(
    typeName: string,
    symbols: ICodeGenSymbols,
    symbolTable: IResolvedSymbols,
  ): boolean {
    return (
      symbols.knownEnums.has(typeName) ||
      symbols.knownStructs.has(typeName) ||
      symbols.knownBitmaps.has(typeName) ||
      symbols.knownScopes.has(typeName) ||
      // #1511: from the table, which shares `OpaqueTypeResolution` with the
      // artifact. `ICodeGenSymbols` carried a merged copy of this set purely so
      // this line could read it per file; one decision, asked where it lives.
      symbolTable.isOpaqueType(typeName) ||
      // ADR-029: a function definition creates a callback type, so every
      // function name is also a type name. `TranspileState.callbackTypes` is
      // filled during codegen, which is after this runs, so the per-file
      // function map is the view that has the answer at analysis time.
      symbols.functionReturnTypes.has(typeName)
    );
  }

  /**
   * A name declared by an included C or C++ header. Checked against the
   * run-wide table on purpose -- see the class comment on why the external side
   * is permissive.
   */
  private static _isKnownForeignName(
    name: string,
    symbolTable: IResolvedSymbols,
  ): boolean {
    return symbolTable
      .getOverloadsByCName(name)
      .some((symbol) => symbol.sourceLanguage !== ESourceLanguage.Cnx);
  }
}

export default NameExistence;
