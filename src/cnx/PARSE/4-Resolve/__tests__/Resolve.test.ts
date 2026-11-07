/** 1.4 `Resolve`: the program, with 1.3's files carried on to 2.1 (#1991) */
import { describe, expect, it } from "vitest";

import Resolve from "../Resolve";
import Discover from "../../1-Discover/Discover";
import Parse from "../../2-Parse/Parse";
import noHeaderServices from "../../2-Parse/__testUtils__/noHeaderServices";
import Declare from "../../3-Declare/Declare";
import testSourceGraph from "../../1-Discover/__testUtils__/testSourceGraph";

describe("Resolve.program", () => {
  it("resolves the declared files and carries them on", async () => {
    const declared = Declare.sources(
      await Parse.sources(
        testSourceGraph([
          Discover.inMemoryFile("u32 counter <- 0;", "/p/a.cnx"),
        ]),
        noHeaderServices,
      ),
    );
    const resolved = Resolve.program(declared);

    expect(resolved.sources).toBe(declared.declared);
    expect(resolved.discovery).toBe(declared.discovery);
    expect(resolved.program.symbolTable().getSymbol("counter")?.name).toBe(
      "counter",
    );
  });

  it("types each file's header macros from 1.1's dump (#1688)", async () => {
    const graph = {
      ...testSourceGraph([Discover.inMemoryFile("u32 a <- 0;", "/p/a.cnx")]),
      headerMacroDumps: new Map([
        [
          "/p/a.cnx",
          {
            dump: "#define SCALE_F 2.5f",
            visible: new Set(["SCALE_F"]),
            complete: false,
          },
        ],
      ]),
    };
    const parsed = await Parse.sources(graph, noHeaderServices);
    const resolved = Resolve.program(
      Declare.sources({
        ...parsed,
        // #1713: 1.2 takes the dump with the target's compiler
        discovery: {
          ...parsed.discovery,
          headerMacroDumps: graph.headerMacroDumps,
        },
      }),
    );

    expect(resolved.program.headerMacro("/p/a.cnx", "SCALE_F")).not.toBeNull();
    expect(resolved.program.headerMacrosUnread("/p/a.cnx")).toBe(true);
    expect(resolved.program.headerMacrosUnread("/p/b.cnx")).toBe(false);
  });
});
