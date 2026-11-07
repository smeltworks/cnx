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
            headerFiles: new Set<string>(),
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

  it("gives each file only its own C includes' macros (#1881)", async () => {
    const own = (dump: string) => ({
      dump,
      headerFiles: new Set<string>(),
      complete: true,
    });
    const headerMacroDumps = new Map([
      ["/p/a.cnx", own("#define OWN 1\n#define NESTED 2")],
      ["/p/b.cnx", own("#define OTHER 3")],
    ]);
    const graph = {
      ...testSourceGraph([
        Discover.inMemoryFile("u32 a <- 0;", "/p/a.cnx"),
        Discover.inMemoryFile("u32 b <- 0;", "/p/b.cnx"),
      ]),
      headerMacroDumps,
    };
    const parsed = await Parse.sources(graph, noHeaderServices);
    const { program } = Resolve.program(
      Declare.sources({
        ...parsed,
        discovery: { ...parsed.discovery, headerMacroDumps },
      }),
    );

    expect(program.headerMacro("/p/a.cnx", "NESTED")).not.toBeNull();
    expect(program.seesHeaderMacro("/p/a.cnx", "OWN")).toBe(true);
    expect(program.seesHeaderMacro("/p/a.cnx", "OTHER")).toBe(false);
    expect(program.hidesHeaderName("/p/a.cnx", "OTHER")).toBe(true);
    expect(program.hidesHeaderName("/p/b.cnx", "OTHER")).toBe(false);
  });
});
