import type IPlannedRegister from "./IPlannedRegister";
import type IPlannedFunctionParameter from "../../../2-Plan/types/IPlannedFunctionParameter";
import type TPlannedScopeVariable from "./TPlannedScopeVariable";

/**
 * One member of an ADR-016 scope.
 *
 * ## Every member gets an entry, including the ones that emit nothing
 *
 * `adrLine` is recorded for each member before anything is rendered -- that is
 * ADR-016's own decision point, and #1241 puts it at the MEMBER's position so a
 * variable member and a function member land in different matrix contexts
 * rather than both crediting whichever line the `scope` keyword sits on.
 *
 * So a member the generator has nothing to emit for still appears here, as
 * `other`. Dropping it would silently un-occupy a scope-context cell in
 * `docs/scope-context-matrix.md`, which is a generated artifact no test
 * compares against a previous run -- the failure would be invisible.
 *
 * ## Why the renders are thunks
 *
 * The generator calls `setCurrentScope(name)` before it renders anything, and
 * every type name below resolves against that path: a bare `Flags` inside
 * `scope Chip` is `Chip__Flags`. A value rendered at plan time resolves against
 * the OUTER path instead and emits the wrong name, silently. That applies to
 * `planParameters` and `planRegister` as much as to the obvious ones -- they
 * resolve type names too.
 */
type TPlannedScopeMember = {
  readonly adrLine: number | undefined;
} & (
  | { readonly kind: "variable"; readonly variable: TPlannedScopeVariable }
  | {
      readonly kind: "function";
      readonly fullName: string;
      readonly isPrivate: boolean;
      readonly renderReturnType: () => string;
      /** #1209: the buffer a `string<N>` or array return fills, or null */
      readonly renderReturnBuffer: () => string | null;
      /** Null when the declaration takes no parameters -- what `enterFunctionContext` expects. */
      readonly planParameters: () =>
        | readonly IPlannedFunctionParameter[]
        | null;
      readonly renderBody: () => string;
      /** `"void"` when the declaration takes no parameters. */
      readonly renderParameterList: () => string;
    }
  | { readonly kind: "register"; readonly planRegister: () => IPlannedRegister }
  /** A member this generator emits nothing for -- a type declaration, say. */
  | { readonly kind: "other" }
);

export default TPlannedScopeMember;
