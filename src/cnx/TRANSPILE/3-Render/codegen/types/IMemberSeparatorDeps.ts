import type IRootHolding from "./IRootHolding";

/**
 * Dependencies needed for separator resolution
 */
interface IMemberSeparatorDeps {
  /** Check if an identifier is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if an identifier is a known register */
  isKnownRegister(name: string): boolean;

  /**
   * The separator a held root's first member takes, from the C/C++ mode and
   * how the root is held (`memberAccessChain.rootMemberSeparator`)
   */
  rootMemberSeparator(holding: IRootHolding): "." | "->";
}

export default IMemberSeparatorDeps;
