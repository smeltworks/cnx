import type TMemberDeclaration from "./TMemberDeclaration";

/**
 * One declaration in a file, a scope's members included, in source order
 * (#2115). 1.2 decides which scope each one belongs to, so no later pass
 * recurses into a scope to find them.
 */
interface IProgramMember {
  readonly declaration: TMemberDeclaration;
  /** The scope it is declared in, or null for a file-level declaration */
  readonly scope: string | null;
}

export default IProgramMember;
