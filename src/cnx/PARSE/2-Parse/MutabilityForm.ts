/**
 * ADR-071: every binding is read-only unless declared `mut`, so a written
 * `const` says nothing and is E0898. It reads only how a declaration is
 * written, so 1.2 reports it. Beside `atomic`, which makes a binding writable
 * (#2233), `const` asks for a read-only atomic, which protects nothing: the
 * fix is to remove `atomic` (#2155 review 8).
 */
import { ParseTreeWalker } from "antlr4ng";
import FormError from "./FormError";
import { CnxListener } from "./grammar/CnxListener";
import * as Parser from "./grammar/CnxParser";
import ParserUtils from "../../utils/ParserUtils";
import type ITranspileError from "../../types/ITranspileError";

class MutabilityFormListener extends CnxListener {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  override enterConstModifier = (ctx: Parser.ConstModifierContext): void => {
    const position = ParserUtils.getPosition(ctx);
    const declaration = ctx.parent;
    if (
      declaration instanceof Parser.VariableDeclarationContext &&
      declaration.atomicModifier() !== null
    ) {
      this.found.push(
        FormError.at(
          position,
          "E0898",
          "a read-only `atomic` protects nothing; remove `atomic`",
          "A binding is read-only unless declared `mut` or `atomic` (ADR-071), and only a value something writes needs a read or write that cannot be torn (ADR-049). Remove `atomic` and `const` for a read-only value, or `const` for a written one.",
        ),
      );
      return;
    }
    this.found.push(
      FormError.at(
        position,
        "E0898",
        "`const` is the default; remove it",
        "Every binding is read-only unless declared `mut` (ADR-071); delete `const`.",
      ),
    );
  };
}

class MutabilityForm {
  /** Every `const` written on a declaration in a tree that parsed */
  static errorsIn(tree: Parser.ProgramContext): ITranspileError[] {
    const listener = new MutabilityFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default MutabilityForm;
