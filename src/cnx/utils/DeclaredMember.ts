import type IProgram from "../types/IProgram";
import invariant from "./invariant";

/**
 * The C name 3-Declare gave the member `name` of `scopePath` ("" for file
 * scope), read off its symbol and never re-encoded (#2116). One reader for
 * every pass that holds a declaration's scope and name.
 */
class DeclaredMember {
  static cNameOf(
    program: Pick<IProgram, "memberOf"> | null,
    scopePath: string,
    name: string,
  ): string {
    const declared = program?.memberOf(scopePath, name);
    invariant(
      declared !== undefined,
      `3-Declare declares every member ('${name}' in '${scopePath}')`,
    );
    return declared.fullyQualifiedCName;
  }
}

export default DeclaredMember;
