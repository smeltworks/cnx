import { describe, expect, it } from "vitest";

import CnxSourceParser from "../../../../../cnx/PARSE/2-Parse/CnxSourceParser";
import IncludeResolver from "../../../../../cnx/PARSE/1-Discover/IncludeResolver";
import MockFileSystem from "../../../MockFileSystem";
import IncludeDirectiveAnalyzer from "../../../../../cnx/TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer";
import EFileType from "../../../../../cnx/PARSE/1-Discover/types/EFileType";

/**
 * #1322. ADR-010's include rules -- E0503 (an implementation file), E0504 (a
 * `.cnx` sits where the header does), E0506 (an included `.cnx` is not there)
 * -- replacing three codegen throws that all reported `1:0`, two of them with
 * the real line appended to the message as `Line N` and the third with no code
 * at all.
 *
 * The 23 cases these replace were handed a directive's TEXT and a line NUMBER,
 * which is precisely why the position defect was invisible to them: there was
 * no position to get wrong. These parse a directive and assert where it is.
 *
 * #1672: the analyzer reports 1.1 Discover's answer, so a test builds that
 * answer the way the run does -- with the real `IncludeResolver`, over an
 * in-memory file system holding the files the test says exist. Each case
 * asserts 1.1's decision and 2.1's report of it together.
 */
const analyze = (
  source: string,
  present: readonly string[] = [],
  searchPaths: readonly string[] = [],
) => {
  const fs = new MockFileSystem();
  for (const path of present) fs.addFile(path, "");
  const discovered = new IncludeResolver(
    [...searchPaths],
    fs,
    "/project/src",
  ).resolve(source);
  return new IncludeDirectiveAnalyzer().analyze(
    CnxSourceParser.parse(source).program,
    discovered,
  );
};

describe("IncludeDirectiveAnalyzer (E0503)", () => {
  it("rejects an implementation file at the directive, not 1:0", () => {
    const [found] = analyze(
      '#include <stdint.h>\n#include "helper.c"\n\nu8 main() {\n    return 0;\n}',
    );
    expect([found.code, found.span.line, found.span.column]).toEqual([
      "E0503",
      2,
      0,
    ]);
    expect(found.message).toBe(
      "Cannot #include implementation file 'helper.c'. Only header files (.h, .hpp) are allowed.",
    );
  });

  // #1840: one row per extension, so removing one from 1.1's classification
  // reddens exactly its row. `.c++` is C++ source by owner ruling 4 on #1444.
  it.each([
    ['#include "a.c"'],
    ["#include <b.cpp>"],
    ['#include "c.CC"'],
    ["#include <d.cxx>"],
    ['#include "e.c++"'],
  ])("rejects %s, an implementation file", (directive) => {
    expect(
      analyze(`${directive}\n\nu8 main() {\n    return 0;\n}`).map(
        (e) => e.code,
      ),
    ).toEqual(["E0503"]);
  });

  it("accepts headers and cnx sources", () => {
    const source = [
      "#include <stdint.h>",
      '#include "sensors/imu.hpp"',
      '#include "helper.cnx"',
      "",
      "u8 main() {",
      "    return 0;",
      "}",
    ].join("\n");
    expect(analyze(source, ["/project/src/helper.cnx"])).toEqual([]);
  });
});

describe("IncludeDirectiveAnalyzer (E0506)", () => {
  it("rejects a quoted cnx include that is not there", () => {
    const [found] = analyze(
      '#include "missing.cnx"\n\nu8 main() {\n    return 0;\n}',
    );
    expect([found.code, found.span.line]).toEqual(["E0506", 1]);
    expect(found.message).toBe("Included cnx file not found: missing.cnx");
    // No absolute path in the help: it would differ on every checkout, and the
    // first fixture written for this rule embedded one in an `.expected.error`.
    expect(found.helpText).not.toMatch(/\//);
  });

  it("resolves relative to the including file, not the working directory", () => {
    expect(
      analyze('#include "../lib/utils.cnx"\n\nu8 main() {\n    return 0;\n}', [
        "/project/lib/utils.cnx",
      ]),
    ).toEqual([]);
  });

  it("stays silent on an angle cnx include, whose search is discovery's", () => {
    expect(
      analyze("#include <missing.cnx>\n\nu8 main() {\n    return 0;\n}"),
    ).toEqual([]);
  });
});

describe("IncludeDirectiveAnalyzer (E0504)", () => {
  it("names the quoted cnx twin beside the including file", () => {
    const [found] = analyze(
      '#include <stdint.h>\n#include "helper.h"\n\nu8 main() {\n    return 0;\n}',
      ["/project/src/helper.cnx"],
    );
    expect([found.code, found.span.line]).toEqual(["E0504", 2]);
    expect(found.message).toContain(
      "Found #include \"helper.h\" but 'helper.cnx' exists at the same location.",
    );
    expect(found.message).toContain('Use #include "helper.cnx" instead');
  });

  it("searches an angle include along the run's paths, in priority order", () => {
    const [found] = analyze(
      "#include <ext.h>\n\nu8 main() {\n    return 0;\n}",
      ["/project/vendor/ext.cnx"],
      ["/project/src", "/project/vendor"],
    );
    expect(found.code).toBe("E0504");
    expect(found.message).toContain("Use #include <ext.cnx> instead");
  });

  it("finds a twin reachable only through an --include directory", () => {
    // The hole this closes: codegen re-derived the search path from the source
    // file's own directory, so a twin that only `--include` made reachable was
    // invisible and the file transpiled at exit 0.
    expect(
      analyze(
        "#include <ext.h>\n\nu8 main() {\n    return 0;\n}",
        ["/elsewhere/inc/ext.cnx"],
        ["/elsewhere/inc"],
      ).map((e) => e.code),
    ).toEqual(["E0504"]);
  });

  it("stays silent when no twin exists, and on a .cnx include itself", () => {
    const source = [
      "#include <stdint.h>",
      '#include "helper.h"',
      '#include "other.cnx"',
      "",
      "u8 main() {",
      "    return 0;",
      "}",
    ].join("\n");
    expect(
      analyze(source, ["/project/src/other.cnx"], ["/project/src"]),
    ).toEqual([]);
  });

  it("finds a twin beside a header named by its absolute path", () => {
    // 1.1 resolves an absolute angle include by its path. 2.1 joined it onto
    // each search directory, so this was silent while discovery would have
    // found `/vendor/ext.cnx` (#1672).
    const [found] = analyze(
      "#include </vendor/ext.h>\n\nu8 main() {\n    return 0;\n}",
      ["/vendor/ext.cnx"],
      ["/project/src"],
    );
    expect(found.code).toBe("E0504");
    expect(found.message).toContain("Use #include </vendor/ext.cnx> instead");
  });

  it("reports the implementation-file rule first, and only it", () => {
    // `helper.c` is an implementation file AND has a `.cnx` beside it. One
    // diagnostic, naming the thing the author must fix first.
    expect(
      analyze('#include "helper.c"\n\nu8 main() {\n    return 0;\n}', [
        "/project/src/helper.cnx",
      ]).map((e) => e.code),
    ).toEqual(["E0503"]);
  });
});

describe("IncludeDirectiveAnalyzer (1.1's answer)", () => {
  it("never decides a directive discovery did not resolve", () => {
    // An answer missing here means 1.1 and 1.2 disagree on which lines are
    // directives (#1745). Re-deriving it would hide that behind a second
    // decision, which is what #1672 removed.
    const { program } = CnxSourceParser.parse(
      '#include "helper.h"\n\nu8 main() {\n    return 0;\n}',
    );
    expect(() =>
      new IncludeDirectiveAnalyzer().analyze(program, {
        resolutions: new Map(),
        cnxAlternatives: new Map(),
        kinds: new Map([['#include "helper.h"', EFileType.CHeader]]),
      }),
    ).toThrow("1.1 Discover resolved every directive 1.2 parsed");
  });

  it("never classifies a directive discovery did not classify (#1444)", () => {
    const { program } = CnxSourceParser.parse(
      '#include "helper.h"\n\nu8 main() {\n    return 0;\n}',
    );
    expect(() =>
      new IncludeDirectiveAnalyzer().analyze(program, {
        resolutions: new Map([['#include "helper.h"', null]]),
        cnxAlternatives: new Map(),
        kinds: new Map(),
      }),
    ).toThrow("1.1 Discover classified every directive 1.2 parsed");
  });

  // Owner ruling 1 on #1444: E0506 and E0503 read 1.1's kind. These hand the
  // analyzer a kind its extension would not give, so an analyzer that
  // classified the spelling itself goes red.
  const answer = (directive: string, kind: EFileType) => ({
    resolutions: new Map([[directive, null]]),
    cnxAlternatives: new Map<string, string>(),
    kinds: new Map([[directive, kind]]),
  });
  const reported = (directive: string, kind: EFileType): string[] =>
    new IncludeDirectiveAnalyzer()
      .analyze(
        CnxSourceParser.parse(`${directive}\n\nu8 main() {\n    return 0;\n}`)
          .program,
        answer(directive, kind),
      )
      .map((e) => e.code);

  it("reports E0506 for a missing quoted include 1.1 classified as cnx", () => {
    expect(reported('#include "Gen.CNX"', EFileType.Cnx)).toEqual(["E0506"]);
  });

  it("does not report E0506 when 1.1 did not classify the spelling as cnx", () => {
    expect(reported('#include "gen.cnx"', EFileType.CHeader)).toEqual([]);
  });

  it("reports E0503 for what 1.1 classified as source, whatever the spelling", () => {
    expect(reported('#include "weird.inc"', EFileType.CSource)).toEqual([
      "E0503",
    ]);
  });
});
