import { TerminalNode } from "antlr4ng";
import type { ParseTree } from "antlr4ng";

/**
 * A rule's text with its words kept apart. `getText()` joins the tokens with
 * nothing between, so `char const*` reads as `charconst*`, which is also how a
 * type or macro named `charconst` reads (#2348 review). A space goes only
 * between two tokens that would otherwise run into one word.
 */
class SpacedText {
  static of(tree: ParseTree): string {
    const tokens: string[] = [];
    SpacedText.collect(tree, tokens);
    return tokens.reduce(
      (text, token) =>
        /\w$/.test(text) && /^\w/.test(token)
          ? `${text} ${token}`
          : text + token,
      "",
    );
  }

  private static collect(tree: ParseTree, tokens: string[]): void {
    if (tree instanceof TerminalNode) {
      tokens.push(tree.getText());
      return;
    }
    for (let index = 0; index < tree.getChildCount(); index++) {
      const child = tree.getChild(index);
      if (child !== null) SpacedText.collect(child, tokens);
    }
  }
}

export default SpacedText;
