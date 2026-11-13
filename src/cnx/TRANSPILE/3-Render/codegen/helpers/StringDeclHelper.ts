/**
 * StringDeclHelper - Generates string variable declarations
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Migrated to use CodeGenState instead of constructor DI.
 *
 * Handles all string-related declaration patterns (ADR-045):
 * - Bounded strings: string<64> name
 * - String arrays: string<64>[4] items
 * - String concatenation: string<64> result <- str1 + str2
 * - Substring extraction: string<64> sub <- str[0, 5]
 * - Unsized const strings: const string name <- "literal"
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * Every question this file used to ask of a parse node -- which of the three
 * string forms is this, what capacity does it declare, is the initializer a
 * concatenation -- is answered by `VariableDeclHelper._planStringDecl` and
 * arrives as `TPlannedStringDecl`. What is left here is the part that is
 * genuinely rendering: the NUL-terminated `[capacity + 1]` convention, the
 * bounded copy sequences, and the capacity diagnostics.
 *
 * The plan is built at the call site rather than in `CodeGenerator`, where
 * every other planner on this branch sits. That placement once carried an
 * ordering contract with a per-file type registry the render walk filled as
 * it went; #1668 (C8) deleted the registry. A name binds through the lexical
 * frames 1.4 settled before rendering, so `string<32> s <- s + "x"` reads
 * `s`'s own declaration -- detected as a concatenation and rejected with
 * E0864 for "capacity 33" -- wherever the plan is built. (That the name
 * resolves at all is a separate defect, filed as #1643; this comment records
 * why the placement cannot be changed while it holds.)
 */

import ArrayInitHelper from "./ArrayInitHelper";
import IPlannedStringInit from "../types/IPlannedStringInit";
import VariableModifierBuilder from "./VariableModifierBuilder";
import IRenderedModifiers from "../types/IRenderedModifiers";
import type TRenderedStringPart from "../../../../types/TRenderedStringPart";
import TPlannedStringDecl from "../types/TPlannedStringDecl";
import StringUtils from "../../../../utils/StringUtils";
import invariant from "../../../../utils/invariant";
import type TranspileState from "../../../TranspileState";

/**
 * Generates string variable declarations in C.
 */
class StringDeclHelper {
  /**
   * Generate the declaration a string plan describes.
   *
   * @param name - the EMITTED identifier (ADR-057), not the source spelling
   * @param isConst - whether the declaration carries `const`, which only the
   *   unsized form consults: it is the difference between an inferred capacity
   *   and E0862
   */
  static generateStringDecl(
    plan: TPlannedStringDecl,
    name: string,
    modifiers: IRenderedModifiers,
    isConst: boolean,
    state: TranspileState,
  ): string {
    switch (plan.kind) {
      case "array":
        return StringDeclHelper._generateStringArray(
          plan,
          name,
          modifiers,
          state,
        );
      case "bounded":
        return StringDeclHelper._generateBoundedStringDecl(
          plan.capacity,
          plan.init,
          name,
          modifiers,
          state,
        );
      case "unsized":
        return StringDeclHelper._generateUnsizedStringDecl(
          plan.initText,
          plan.declaredCapacity,
          name,
          modifiers,
          isConst,
        );
    }
  }

  /**
   * Issue #1029: Generate string array declaration.
   * Handles: string<32>[4] items -> char items[4][33] = {0};
   */
  private static _generateStringArray(
    plan: Extract<TPlannedStringDecl, { kind: "array" }>,
    name: string,
    modifiers: IRenderedModifiers,
    state: TranspileState,
  ): string {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;

    const shape = `${plan.dimensions}[${plan.elementCapacity + 1}]`;
    // #1209: one copied into is written after it is declared
    if (plan.copy) {
      return [
        `${extern}${atomic}${volatileMod}char ${name}${shape} = {0};`,
        ...ArrayInitHelper.elementCopy(
          name,
          plan.copy.renderSource(),
          plan.copy.dimensions,
          state,
        ),
      ].join("\n");
    }
    const decl = `${extern}${constMod}${atomic}${volatileMod}char ${name}${shape}`;

    // No initializer - zero-initialize
    if (!plan.renderInit) {
      return `${decl} = {0};`;
    }

    // The array-initializer bookkeeping is written BY the render below and read
    // immediately after, so the reset, the render and the reads are one window.
    state.resetArrayInitTracking();
    const initValue = plan.renderInit();

    // Check if it was an array initializer
    if (!state.wasArrayInit()) {
      invariant(
        false,
        `a string array is initialized from literals -- E0866 rejects a variable initializer in pass 1.2`,
      );
    }

    // Validate element count if declared size is available
    if (plan.declaredSize !== null) {
      const isFillAll = state.lastArrayFillValue !== undefined;
      const elementCount = state.lastArrayInitCount;

      if (!isFillAll && elementCount !== plan.declaredSize) {
        invariant(
          false,
          `a string array initializer matches its declared size -- E0866 rejects [${plan.declaredSize}] against ${elementCount} element(s) in pass 2.1`,
        );
      }
    }

    // MISRA C:2012 Rules 9.3/9.4 - String literals don't fill all inner array bytes,
    // but C standard guarantees zero-initialization of remaining elements
    const suppression =
      "// cppcheck-suppress misra-c2012-9.3\n// cppcheck-suppress misra-c2012-9.4\n";
    return `${suppression}${decl} = ${initValue};`;
  }

  /**
   * Generate bounded string declaration (string<N>).
   */
  private static _generateBoundedStringDecl(
    capacity: number,
    init: IPlannedStringInit | null,
    name: string,
    modifiers: IRenderedModifiers,
    state: TranspileState,
  ): string {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;
    // #1164 / #1642: `atomic`/`volatile` belong on EVERY bounded arm. They were
    // dropped on the no-initializer arm first and on the with-initializer arms
    // second, each time producing a definition that conflicted with its own
    // header while the transpiler exited 0.
    const qualifiers = `${atomic}${volatileMod}`;

    // Simple bounded string without initializer
    if (!init) {
      return `${extern}${constMod}${qualifiers}char ${name}[${capacity + 1}] = "";`;
    }

    // #1257: 2.2 planned the initializer's form, by an assignment's rule
    switch (init.form) {
      case "copy":
        return StringDeclHelper._generateCopyDecl(
          name,
          capacity,
          init.render(),
          qualifiers,
          state,
        );
      case "concat":
      case "substring":
        return StringDeclHelper._generateBuiltDecl(
          name,
          capacity,
          init.renderParts(),
          qualifiers,
          state,
        );
      case "literal":
        StringDeclHelper._validateLiteral(init.text, capacity);
        return `${extern}${constMod}${qualifiers}char ${name}[${capacity + 1}] = ${init.render()};`;
    }
  }

  /**
   * Issue #1030: a string initialized from another string. C cannot
   * initialize an array from one, so it is declared empty and copied into.
   * The copy writes the buffer, so it is never a C `const` array, here or in
   * the concatenation and substring arms; cnx still rejects a write to it
   * (ADR-071). Issue #1044: the bounded copy an assignment makes, not an
   * unbounded strcpy, which flawfinder flags as CWE-120.
   */
  private static _generateCopyDecl(
    name: string,
    capacity: number,
    source: string,
    qualifiers: string,
    state: TranspileState,
  ): string {
    invariant(
      state.inFunctionBody,
      "a string at file scope is initialized by a literal -- E0863 rejects a copy from a variable in pass 1.2",
    );
    // Issue #1037: continuation lines carry no indent of their own — the block
    // emitter (CodeGenerator.generateBlock) prefixes every line.
    return [
      `${qualifiers}char ${name}[${capacity + 1}] = "";`,
      StringUtils.copy(name, source, capacity),
    ].join("\n");
  }

  /** A literal initializer: 2.1 has rejected one that does not fit (E0864) */
  private static _validateLiteral(text: string, capacity: number): void {
    invariant(
      text.startsWith('"') && text.endsWith('"'),
      "a string<N> initializer 2.2 planned as a literal is one",
    );
    const content = StringUtils.literalLength(text);
    invariant(
      content <= capacity,
      `a string literal fits its declared capacity -- E0864 rejects ${content} chars in string<${capacity}> in pass 2.1`,
    );
  }

  /**
   * A concatenation or a substring, built into the string it declares
   * (#1257, #1954). The string cannot be one of its own parts: it is defined
   * once its declaration closes (ADR-030, #1643).
   */
  private static _generateBuiltDecl(
    name: string,
    capacity: number,
    parts: readonly TRenderedStringPart[],
    qualifiers: string,
    state: TranspileState,
  ): string {
    // The copy and append calls cannot run at global scope in C
    invariant(
      state.inFunctionBody,
      "a string at file scope is initialized by a literal -- E0863 rejects a concatenation and a substring in pass 1.2",
    );
    // Issue #1037: continuation lines carry no indent of their own -- the
    // block emitter prefixes every line. The sequence is StringUtils.build's.
    return [
      `${qualifiers}char ${name}[${capacity + 1}] = "";`,
      ...StringUtils.build(name, capacity, parts),
    ].join("\n");
  }

  /**
   * Generate unsized const string declaration.
   */
  private static _generateUnsizedStringDecl(
    initText: string | null,
    declaredCapacity: number | null,
    name: string,
    modifiers: IRenderedModifiers,
    isConst: boolean,
  ): string {
    if (!isConst) {
      invariant(
        false,
        "a `mut` string states its capacity -- E0862 rejects an unsized one in pass 1.2",
      );
    }

    if (initText === null) {
      invariant(
        false,
        "an unsized const string has an initializer to infer from -- E0862 rejects one without in pass 1.2",
      );
    }

    if (!initText.startsWith('"') || !initText.endsWith('"')) {
      invariant(
        false,
        "an unsized const string infers from a LITERAL -- E0862 rejects any other initializer in pass 1.2",
      );
    }

    // #1664 box 3: the capacity is the declaration's -- 1.3 counted it from
    // this literal and the `.h` states it. Counting the literal again here was
    // a second derivation; it survives as the check that the two agree.
    const literalLength = StringUtils.literalLength(initText);
    invariant(
      declaredCapacity === literalLength,
      `an unsized string's capacity is its declaration's -- 1.3 counted ` +
        `${declaredCapacity} for '${name}' but the literal has ${literalLength} character(s)`,
    );

    // #1642's open box. This arm hand-assembled `${extern}const `, dropping
    // `atomic`/`volatile` and hardcoding the `const` rather than reading the
    // one the caller resolved -- so the `.h`, which derives the qualifier from
    // the SYMBOL, emitted `extern volatile const char x[2];` against this
    // file's `const char x[2] = "v";` and the translation unit did not
    // compile. It was unreachable until the E0862 predicate beside it started
    // asking the grammar instead of the declaration's text, which is why the
    // bounded arms were fixed in #1642 and this one was not.
    //
    // `toPrefix` is the single encoder the bounded arms above spell out by
    // hand; using it here is what makes a fifth arm impossible to forget.
    //
    // The hardcoded `const` was also STATING an invariant -- an unsized string
    // is const, which E0862 enforces in 2.1 -- so dropping it silently would
    // have traded one masked bug for another. Asserted instead, which is the
    // same fact without the mask: if the invariant ever breaks, this says so
    // rather than quietly emitting a non-const definition against a `const`
    // declaration in the header.
    invariant(
      modifiers.const !== "",
      "an unsized string is read-only -- E0862 rejects a `mut` one in pass 1.2, before this runs",
    );

    const prefix = VariableModifierBuilder.toPrefix(modifiers);
    return `${prefix}char ${name}[${declaredCapacity + 1}] = ${initText};`;
  }
}

export default StringDeclHelper;
