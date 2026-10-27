/**
 * RegisterGenerator - ADR-004 Register Binding Generation
 *
 * Generates C #define macros from cnx register declarations, at file scope
 * or inside a scope.
 *
 * Example:
 *   register GPIO7 @ 0x42004000 {
 *     ro u32 DR @ 0x00;
 *     wo u32 DR_SET @ 0x04;
 *   }
 *   ->
 *   // Register: GPIO7 @ 0x42004000
 *   #define GPIO7_DR (*(volatile uint32_t const *)(0x42004000 + 0x00))
 *   #define GPIO7_DR_SET (*(volatile uint32_t*)(0x42004000 + 0x04))
 *
 * ## One generator, at file scope and inside a scope
 *
 * #1445: there were two, `generateRegister` and `generateScopedRegister`, and
 * they were the same function. The only difference was the prefix, so the
 * file-scope case IS the scoped case with an empty path. Two spellings of one
 * decision that had to be kept in step by hand is the duplicate-path shape
 * CLAUDE.md names.
 *
 * #2116: the prefix is not applied here at all. 3-Declare decided the
 * register's C name once, and the plan carries it (`IPlannedRegister.name`),
 * so this generator reads that decision rather than making it again.
 *
 * ## It takes a plan, not a node
 *
 * #1445 box 3: the three things it read off the node -- the written name, the
 * base address, the members -- are all strings, and `IPlannedRegister` names
 * them. The ADR-057 note below is why the members' `cType` arrives rendered,
 * and it is why this module must not re-derive anything.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import generateRegisterMacros from "./RegisterMacroGenerator";
import RegisterBlockPlacement from "./RegisterBlockPlacement";
import type IPlannedRegister from "../../types/IPlannedRegister";

/*
 * No scoped-bitmap resolver on the planning side, deliberately.
 * `orchestrator.generateType` already applies ADR-057 qualification through
 * the one TypeNameLadder ladder, so a bare `Flags` inside `scope Chip` arrives as
 * `Chip__Flags` and an explicit `global.Flags` arrives as `Flags`.
 *
 * A resolver on the scoped path used to re-qualify that ALREADY-resolved name
 * and probe the re-qualified key first, which is the post-pass ADR-057
 * forbids: by then `global.Flags` and a bare `Flags` are byte-identical, so a
 * scope-local `Chip__Flags` captured the global reference and the register was
 * typed with a bitmap whose bit names differ. It was deleted before the plan
 * existed (#1472); the note stays because "do not re-qualify" is the rule this
 * generator has to keep, not a change it made.
 */

/**
 * Generate C #define macros from a planned register declaration.
 *
 * ADR-004: Registers provide hardware abstraction with access control.
 * Access modifiers: ro (read-only), wo (write-only), rw (read-write default)
 */
const generateRegister: TGeneratorFn<IPlannedRegister> = (
  planned: IPlannedRegister,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const fullName = planned.name;

  const lines: string[] = [
    `/* Register: ${fullName} @ ${planned.baseAddress} */`,
    ...generateRegisterMacros(planned.members, fullName, planned.baseAddress),
    "",
  ];

  return {
    code: RegisterBlockPlacement.place(
      fullName,
      lines.join("\n"),
      orchestrator.state,
    ),
    effects: [],
  };
};

export default generateRegister;
