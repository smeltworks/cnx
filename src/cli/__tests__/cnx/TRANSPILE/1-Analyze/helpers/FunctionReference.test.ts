/**
 * #2473 review: `FunctionReference.callsIn`, the one walk that decides each
 * call of a chain -- where it is, the cnx function it reaches, how a
 * diagnostic names it, and the C callee it reaches -- through a real declared
 * and resolved program.
 */
import { describe, it, expect } from "vitest";
import FunctionReference from "../../../../../../cnx/TRANSPILE/1-Analyze/helpers/FunctionReference";
import StatementNodes from "../../../../../../cnx/utils/StatementNodes";
import HeaderParser from "../../../../../../cnx/PARSE/2-Parse/HeaderParser";
import CResolver from "../../../../../../cnx/PARSE/3-Declare/c/index";
import SymbolTable from "../../../../../../cnx/PARSE/3-Declare/SymbolTable";
import type TExpressionOf from "../../../../../../cnx/types/syntax/TExpressionOf";
import testAnalysisContextFor from "../testAnalysisContextFor";

const SOURCE = `
u32 bump(mut u32 n) {
    n <- n + 1;
    return n;
}

struct Ops {
    bump op;
}

Ops make() {
    Ops o <- { op: bump };
    return o;
}

void main() {
    mut u32 v <- 4;
    Ops o <- make();
    bump(v);
    o.op(v);
    make().op(v);
    c_fill(v);
}
`;

/** A C header, resolved as Stage 2 does */
function header(source: string): SymbolTable {
  const table = new SymbolTable();
  const tree = HeaderParser.parseC(source).syntax;
  table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
  return table;
}

/** Each call of each bare call statement in `main`, as `callsIn` answers */
function callsOfStatements() {
  const { syntax, context } = testAnalysisContextFor(SOURCE, {
    cppMode: false,
    symbolTable: header("#include <stdint.h>\nvoid c_fill(uint32_t* p);"),
  });
  const calls = [];
  for (const { declaration, scope } of syntax.members) {
    for (const statement of StatementNodes.in(declaration)) {
      if (statement.kind !== "expression") continue;
      const expression = statement.expression;
      if (expression.kind !== "postfix") continue;
      calls.push(
        FunctionReference.callsIn(
          expression as TExpressionOf<"postfix">,
          scope ?? "",
          context,
        ).map((call) => ({
          callAt: call.callAt,
          callee: call.callee?.name ?? null,
          calledAs: call.calledAs,
          cCallee: call.cCallee?.name ?? null,
        })),
      );
    }
  }
  return calls;
}

describe("FunctionReference.callsIn (#2473)", () => {
  const [named, throughValue, chained, cCall] = callsOfStatements();

  it("names a named call by the function it names", () => {
    expect(named).toEqual([
      { callAt: 0, callee: "bump", calledAs: "bump", cCallee: null },
    ]);
  });

  it("names a call through a value by the chain as written", () => {
    expect(throughValue).toEqual([
      { callAt: 1, callee: "bump", calledAs: "o.op", cCallee: null },
    ]);
  });

  it("gives each call of a chain its own callee", () => {
    expect(chained).toEqual([
      { callAt: 0, callee: "make", calledAs: "make", cCallee: null },
      { callAt: 2, callee: "bump", calledAs: "make().op", cCallee: null },
    ]);
  });

  it("gives a C function no cnx callee, and its C callee", () => {
    expect(cCall).toEqual([
      { callAt: 0, callee: null, calledAs: "c_fill", cCallee: "c_fill" },
    ]);
  });
});
