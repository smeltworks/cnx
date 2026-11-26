import { describe, expect, it } from "vitest";
import MacroIncludes from "../MacroIncludes";

describe("MacroIncludes", () => {
  it("learns a quoted and an angled file macro from header text", () => {
    const spellings = MacroIncludes.spellings(
      ['#define BOARD "board.h"\n  #  define SYS <sys/io.h>\n#define N 3'],
      {},
    );
    expect([...spellings]).toEqual([
      ["BOARD", [{ path: "board.h", isLocal: true }]],
      ["SYS", [{ path: "sys/io.h", isLocal: false }]],
    ]);
  });

  it("learns a -D value that names a file, and not one that does not", () => {
    const spellings = MacroIncludes.spellings([], {
      BOARD: '"cfg/board.h"',
      WIDE: true,
      COUNT: "3",
    });
    expect([...spellings]).toEqual([
      ["BOARD", [{ path: "cfg/board.h", isLocal: true }]],
    ]);
  });

  it("keeps every branch's spelling once", () => {
    const spellings = MacroIncludes.spellings(
      [
        '#ifdef A\n#define IMPL "a.h"\n#else\n#define IMPL "b.h"\n#endif',
        '#define IMPL "a.h"',
      ],
      {},
    );
    expect(spellings.get("IMPL")).toEqual([
      { path: "a.h", isLocal: true },
      { path: "b.h", isLocal: true },
    ]);
    expect(MacroIncludes.count(spellings)).toBe(2);
  });

  it("gives each file a macro-named include can open", () => {
    const spellings = MacroIncludes.spellings(['#define IMPL "impl.h"'], {});
    expect(
      MacroIncludes.directivesOf(
        '#include IMPL\n#include "literal.h"\n#include UNKNOWN\n# include  IMPL ',
        spellings,
      ),
    ).toEqual([
      { path: "impl.h", isLocal: true },
      { path: "impl.h", isLocal: true },
    ]);
  });

  it("names no file for a computed include", () => {
    const spellings = MacroIncludes.spellings(
      ["#define STR(x) #x\n#define IMPL STR(impl.h)"],
      {},
    );
    expect(spellings.size).toBe(0);
    expect(
      MacroIncludes.directivesOf("#include STR(impl.h)", spellings),
    ).toEqual([]);
  });
});
