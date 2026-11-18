/**
 * Postfix Chain Builder
 *
 * Processes postfix operations (member access, array subscript, bit range)
 * in assignment target chains.
 *
 * Extracted from CodeGenerator.doGenerateAssignmentTarget to reduce
 * cognitive complexity.
 */

import IPostfixChainDeps from "../types/IPostfixChainDeps";
import IPostfixOperation from "../types/IPostfixOperation";
import MemberSeparatorResolver from "./MemberSeparatorResolver";

/**
 * Static utility for building postfix operation chains
 */
class PostfixChainBuilder {
  /**
   * Process a chain of postfix operations and build the result string
   *
   * @param baseResult The starting string (base identifier)
   * @param firstId The first identifier in the chain (for register detection)
   * @param operations Array of postfix operations to process
   * @param deps Dependencies for expression generation and separator resolution
   * @returns The complete result string with all postfix operations applied
   */
  static build(
    baseResult: string,
    firstId: string,
    operations: IPostfixOperation[],
    deps: IPostfixChainDeps,
  ): string {
    let result = baseResult;
    const identifierChain: string[] = [firstId];

    for (const op of operations) {
      if (op.memberName) {
        result = PostfixChainBuilder.processMemberAccess(
          result,
          op.memberName,
          identifierChain,
          op.appliesToRoot,
          deps,
        );
        identifierChain.push(op.memberName);
      } else {
        result = PostfixChainBuilder.processSubscript(result, op);
      }
    }

    return result;
  }

  /**
   * Process a member access operation (.identifier)
   */
  private static processMemberAccess(
    result: string,
    memberName: string,
    identifierChain: string[],
    isFirstOp: boolean,
    deps: IPostfixChainDeps,
  ): string {
    const chainWithMember = [...identifierChain, memberName];
    const step = deps.memberStep(isFirstOp, chainWithMember, result);
    return MemberSeparatorResolver.join(result, step, memberName);
  }

  /**
   * Process a subscript: the target names an element, `arr[i]`. Its bits or
   * a slice of it are written by their own handler (ADR-007 §1).
   */
  private static processSubscript(
    result: string,
    op: IPostfixOperation,
  ): string {
    // #1652: rendered here, behind the member/subscript branch -- rendering an
    // index queues a pending temp declaration
    const [index] = op.renderIndexes();
    return index === undefined ? result : `${result}[${index}]`;
  }
}

export default PostfixChainBuilder;
