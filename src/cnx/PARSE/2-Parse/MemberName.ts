/**
 * ADR-072 ruling 2 (#2449): a member's name is `memberName`, an identifier or
 * any reserved word, so it is one token of whichever kind. This hands back
 * that token as the TerminalNode an IDENTIFIER() accessor used to.
 */
import { TerminalNode } from "antlr4ng";
import * as Parser from "./grammar/CnxParser";

class MemberName {
  /** The name's token; null when recovery left the name out */
  static terminal(ctx: Parser.MemberNameContext | null): TerminalNode | null {
    const token = ctx?.getChild(0);
    return token instanceof TerminalNode ? token : null;
  }

  /** The name's token, for contexts the grammar requires a name on */
  static required(ctx: Parser.MemberNameContext): TerminalNode {
    const token = MemberName.terminal(ctx);
    if (token === null) {
      throw new Error(`member name has no token: '${ctx.getText()}'`);
    }
    return token;
  }
}

export default MemberName;
