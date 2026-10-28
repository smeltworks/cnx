/**
 * #1668 / #1664: 1.4 Resolve's half of the lexical frames, and the questions
 * later passes ask of them.
 *
 * 1.3 recorded what each frame declares from one file's tree. Settling needs
 * the whole program: a bare type may name a scope type another file declares
 * (ADR-057), and a const local folds with whatever its names bind to. After
 * this, a frame is frozen and every pass reads the same one.
 *
 * Positions compare as `(line, column)`. Stage 4d and Stage 5 reuse Stage 3's
 * parse, so a node's position is the same in every pass.
 */
import ConstantFold from "../../utils/ConstantFold";
import DefinitionPoint from "../../utils/DefinitionPoint";
import DeferredTypes from "./DeferredTypes";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";
import type TDefinedAt from "../../utils/types/TDefinedAt";
import QualifiedCName from "../../utils/QualifiedCName";
import type TNameMove from "../../types/TNameMove";
import SourceOrder from "../../utils/SourceOrder";

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

/**
 * What a name in a constant expression is worth where it is written, as the
 * program's binder decides it (#1175: the whole chain, not a bare name).
 * `settled` answers for a local the binder returns: the frames the binder
 * walks are the unsettled ones, and a local's value is known once its own
 * declaration has been settled, which source order guarantees for every
 * local a use can bind.
 */
type TValueOf = (
  name: Extract<TConstExpr, { kind: "name" }>,
  settled: (declaration: ILocalDeclaration) => ILocalDeclaration | undefined,
) => TConstResult;

/** What settling a frame reads, the same for every frame of a file */
interface ISettleFacts {
  readonly scopeTypeCName: (
    scopePath: string,
    name: string,
  ) => string | undefined;
  readonly isFileScopeName: (cName: string) => boolean;
  readonly env: IConstantEnvironment;
  readonly settledOf: Map<ILocalDeclaration, ILocalDeclaration>;
  /** The file's unsettled frames, which the binder walks */
  readonly root: ILexicalFrame;
}

class LexicalFrames {
  /**
   * The settled, frozen copy of a file's frames.
   *
   * @param scopeTypeCName the whole program's ADR-057 answer, by identity
   * @param valueOf a name's value where it is written, from the one binder
   */
  static settle(
    frame: ILexicalFrame,
    scopeTypeCName: (scopePath: string, name: string) => string | undefined,
    valueOf: TValueOf,
    /** A type name as C spells it where it is written (ADR-057) */
    cTypeName: IConstantEnvironment["cTypeName"],
    /** Whether a type name denotes a type where it is written */
    isTypeName: IConstantEnvironment["isTypeName"],
    /** Whether a C identifier is a file-scope symbol's, in any file or header */
    isFileScopeName: (cName: string) => boolean,
    /**
     * Filled with each declaration's settled copy, for a caller that must read
     * the same answer -- a function's parameters, which the header writes
     * (#1863 review: settled twice, `b[4]` in the .c was `b[0]` in the .h)
     */
    settledOf: Map<ILocalDeclaration, ILocalDeclaration> = new Map(),
  ): ILexicalFrame {
    const env: IConstantEnvironment = {
      valueOf: (name) =>
        valueOf(name, (declaration) => settledOf.get(declaration)),
      cTypeName,
      isTypeName,
    };
    return LexicalFrames.settleFrame(frame, null, {
      scopeTypeCName,
      isFileScopeName,
      env,
      settledOf,
      root: frame,
    });
  }

  /** The innermost frame containing `at`; the file frame if none does */
  static frameAt(root: ILexicalFrame, at: TPosition): ILexicalFrame {
    return LexicalFrames.pathTo(root, at).at(-1) ?? root;
  }

  /**
   * The declaration `name` binds to at `at`: in each frame from the innermost
   * outward, the last declaration of `name` that has closed by `at`. A later
   * declaration in the same block does not bind an earlier use (#1702), nor
   * does a declaration bind a use in its own initializer (#1643), and a
   * sibling block's declaration is never visible (#1666).
   */
  static declarationAt(
    root: ILexicalFrame,
    name: string,
    at: TPosition,
    isDefinedAt: TDefinedAt = DefinitionPoint.isDefinedAt,
  ): ILocalDeclaration | null {
    const path = LexicalFrames.pathTo(root, at);
    for (let i = path.length - 1; i >= 0; i--) {
      // The LAST matching declaration: a redeclaration in the same frame wins
      const declarations = path[i].declarations;
      let found: ILocalDeclaration | undefined;
      for (const declaration of declarations) {
        if (declaration.name === name && isDefinedAt(declaration, at)) {
          found = declaration;
        }
      }
      if (found) {
        return found;
      }
    }
    return null;
  }

  /**
   * #1643 review: the declaration whose declarator IDENTIFIER is at `at` --
   * found by identity, for a site holding the declaration itself
   */
  static declarationDeclaredAt(
    root: ILexicalFrame,
    at: TPosition,
  ): ILocalDeclaration | null {
    for (const frame of LexicalFrames.pathTo(root, at)) {
      for (const declaration of frame.declarations) {
        if (
          declaration.span.line === at.line &&
          declaration.span.column === at.column
        ) {
          return declaration;
        }
      }
    }
    return null;
  }

  /** The frames containing `at`, outermost first */
  private static pathTo(root: ILexicalFrame, at: TPosition): ILexicalFrame[] {
    const path = [root];
    let current = root;
    for (;;) {
      const child = LexicalFrames.childAt(current, at);
      if (!child) {
        return path;
      }
      path.push(child);
      current = child;
    }
  }

  /**
   * The child frame containing `at`, if one does. Children are in source
   * order and never overlap, so the only candidate is the last that starts
   * at or before `at`, found by binary search. #1760 second review: a
   * linear scan here ran for every binding, so a file of N functions took
   * O(N^2) -- 2000 functions compiled in 15s against main's 5s.
   */
  private static childAt(
    frame: ILexicalFrame,
    at: TPosition,
  ): ILexicalFrame | undefined {
    const children = frame.children;
    let low = 0;
    let high = children.length - 1;
    let candidate: ILexicalFrame | undefined;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (SourceOrder.compare(children[middle].span, at) <= 0) {
        candidate = children[middle];
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return candidate !== undefined && LexicalFrames.contains(candidate.span, at)
      ? candidate
      : undefined;
  }

  private static settleFrame(
    frame: ILexicalFrame,
    enclosingFunction: string | null,
    facts: ISettleFacts,
  ): ILexicalFrame {
    const functionCName = frame.functionCName ?? enclosingFunction;
    // Declarations and child frames in source order, so each local is
    // settled before any use that can bind it.
    const declarations: ILocalDeclaration[] = [];
    const children: ILexicalFrame[] = [];
    const items = [
      ...frame.declarations.map((d) => ({ span: d.span, declaration: d })),
      ...frame.children.map((f) => ({ span: f.span, child: f })),
    ].sort((a, b) => SourceOrder.compare(a.span, b.span));

    for (const item of items) {
      if ("child" in item) {
        children.push(
          LexicalFrames.settleFrame(item.child, functionCName, facts),
        );
        continue;
      }
      const settled = LexicalFrames.settleDeclaration(
        item.declaration,
        functionCName,
        facts,
        LexicalFrames.ownNameBinds(item.declaration, facts),
      );
      facts.settledOf.set(item.declaration, settled);
      declarations.push(settled);
    }

    return Object.freeze({
      ...frame,
      declarations: Object.freeze(declarations),
      children: Object.freeze(children),
    });
  }

  /**
   * #1643 review: the settled local a declaration's own name, spelled inside
   * it, binds to -- the binder's answer where the declaration starts. Nothing
   * new has closed there, so it is the answer at every point inside it.
   */
  private static ownNameBinds(
    declaration: ILocalDeclaration,
    facts: ISettleFacts,
  ): ILocalDeclaration | undefined {
    const bound = LexicalFrames.declarationAt(
      facts.root,
      declaration.name,
      declaration.extent,
    );
    return bound ? facts.settledOf.get(bound) : undefined;
  }

  /**
   * #1760 review: a declaration's own dimensions come before its name, so
   * they see the enclosing binding (`u8[N] N`). #1643: its initializer comes
   * before the declaration closes, so it does not see the new one either --
   * `const u16 N <- N + 1` names the enclosing `N`, or nothing (E0427).
   *
   * #1175: each name in a dimension or an initializer carries its own
   * position, and binds there -- which is that rule, with nothing to pick.
   */
  private static settleDeclaration(
    declaration: ILocalDeclaration,
    functionCName: string | null,
    { scopeTypeCName, env, isFileScopeName }: ISettleFacts,
    /** The settled local its own name binds to inside it, if any */
    shadowed: ILocalDeclaration | undefined,
  ): ILocalDeclaration {
    const arrayDimensions = declaration.arrayDimensions.map((dimension, i) => {
      const expr = declaration.arrayDimensionExprs[i];
      return expr ? ConstantFold.dimension(expr, env) : dimension;
    });
    const type = DeferredTypes.settleType(declaration.type, scopeTypeCName);
    const constValue =
      ConstantFold.hasCompileTimeValue(declaration) &&
      declaration.initialValueExpr !== null &&
      arrayDimensions.length === 0
        ? ConstantFold.constValue(declaration.initialValueExpr, env, type)
        : null;
    return Object.freeze({
      ...declaration,
      type,
      arrayDimensions: Object.freeze(arrayDimensions),
      constValue,
      ...LexicalFrames.emittedName(
        declaration,
        functionCName,
        isFileScopeName,
        declaration.spellsOwnName ? (shadowed?.emittedName ?? null) : null,
      ),
    });
  }

  /**
   * ADR-057: a local that shadows a file-scope name moves to
   * `<function>__<name>`. C has no `::`, so emitted as plain `name` it would
   * make the outer one unreachable and `global.name` would bind the local.
   * A parameter is no exception (#1290): its moved name is the one the `.c`
   * signature, the `.h` prototype and every use in the body read.
   * `__` cannot be written in a cnx identifier (E0201), so the moved name
   * collides with nothing the source declares.
   *
   * #1643: an initializer that names the enclosing local it shadows reads that
   * one, but C scopes the new name from its declarator, before the
   * initializer. So the new one moves off the enclosing one's C name too --
   * `<function>__<name>`, then `<function>__<name>__2`, and so on.
   */
  private static emittedName(
    declaration: ILocalDeclaration,
    functionCName: string | null,
    isFileScopeName: (cName: string) => boolean,
    /** The C name of the enclosing local its initializer reads, if any */
    readsEmitted: string | null,
  ): { emittedName: string; nameMoves: ReadonlyArray<TNameMove> } {
    const { name } = declaration;
    if (functionCName === null) {
      return { emittedName: name, nameMoves: [] };
    }
    const nameMoves: TNameMove[] = [];
    if (isFileScopeName(name)) {
      nameMoves.push("hidesFileScope");
    }
    let emitted =
      nameMoves.length > 0
        ? QualifiedCName.movedLocal(functionCName, name, 1)
        : name;
    if (emitted === readsEmitted) {
      nameMoves.push("readsEnclosing");
    }
    let suffix = 1;
    while (emitted === readsEmitted) {
      emitted = QualifiedCName.movedLocal(functionCName, name, suffix);
      suffix++;
    }
    return {
      emittedName: emitted,
      nameMoves: Object.freeze(nameMoves),
    };
  }

  /** Whether a position lies in a span, whose end is exclusive (ISourceSpan) */
  private static contains(span: ISourceSpan, at: TPosition): boolean {
    return (
      SourceOrder.compare(span, at) <= 0 &&
      SourceOrder.compare(at, {
        line: span.endLine,
        column: span.endColumn,
      }) < 0
    );
  }
}

export default LexicalFrames;
