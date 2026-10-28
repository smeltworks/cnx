import type IPlannedRegisterMember from "./IPlannedRegisterMember";

/**
 * An ADR-004 register binding, decided.
 *
 * #1445 box 3: `RegisterGenerator` read its node for three things -- the
 * register's written name, its base address, and its members -- and every one
 * of them reduces to a string or a list of them. `IPlannedRegisterMember`
 * already named what a member reduces to (slice 3); this names the block.
 *
 * ## Why the planner is on the orchestrator
 *
 * There are TWO dispatchers: a register at file scope reaches the generator
 * through `CodeGenerator.invokeGenerator`, and one inside a scope reaches it
 * from `ScopeGenerator`. Both hold the tree, so either could plan -- and that
 * is exactly the trap. Two planners is the duplicate derivation CLAUDE.md
 * forbids, and this pair of call sites has already had one: until #1445 the
 * scope branch returned only `code` and dropped the generator's `effects`,
 * which was safe solely because `effects` is hardcoded empty today.
 *
 * So the plan is built once, by the orchestrator both dispatchers already
 * hold.
 */
interface IPlannedRegister {
  /**
   * The C name 3-Declare gave the register: `GPIO7` at file scope,
   * `Teensy4__GPIO7` inside `scope Teensy4` (#2116).
   */
  readonly name: string;

  /**
   * The rendered base address, e.g. `0x42004000`.
   *
   * Rendered by the caller and in this ORDER: the address is generated before
   * the members are, because generating either registers effects on
   * `CodeGenState` and reordering them is not a cosmetic change.
   */
  readonly baseAddress: string;

  /** Each member's `#define`, decided. */
  readonly members: readonly IPlannedRegisterMember[];
}

export default IPlannedRegister;
