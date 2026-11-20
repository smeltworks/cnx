/**
 * A source parsed, declared and built into `state` with real resolved symbols,
 * so an analyzer test sees what the transpiler would rather than a mock
 */
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../../PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../../PARSE/2-Parse/grammar/CnxParser";
import ProgramLowering from "../../../PARSE/2-Parse/ProgramLowering";
import CnxResolver from "../../../PARSE/3-Declare/cnx/index";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnx/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import Program from "../../../PARSE/4-Resolve/Program";
import type TranspileState from "../../TranspileState";
import type TRunTarget from "../../../types/TRunTarget";

function settleSource(
  source: string,
  state: TranspileState,
  target: TRunTarget | null = null,
) {
  const parser = new CnxParser(
    new CommonTokenStream(new CnxLexer(CharStream.fromString(source))),
  );
  const tree = parser.program();
  const registry = new SymbolRegistry();
  const declared = CnxResolver.resolve(
    ProgramLowering.program(tree, null),
    "test.cnx",
    registry,
  );
  state.program = Program.build([declared], {
    registry,
    cppMode: state.cppMode,
    target,
  });
  state.symbols =
    state.program.codeGenSymbolsFor("test.cnx") ??
    TSymbolInfoAdapter.convert(declared.symbols);
  return ProgramLowering.program(tree, null);
}

export default settleSource;
