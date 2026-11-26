/**
 * #1844: a header's language is decided once, by 1.1 Discover, on the text a C
 * compile meets, and every later stage reads that answer.
 *
 * Owner rulings: a run's C/C++ mode is detected, not declared -- any C++ header
 * makes the whole run C++ (#1428) -- except that a config which says
 * `cppRequired: false` asked for C, and C++ met there is still E0507 (#1844).
 * The text judged is the C-preprocessed one (#1542, ruling 4).
 *
 * Every test runs twice against the same cache: the second, warm, run is where
 * #1851 lived -- it re-sniffed the RAW text a cold run had preprocessed away.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdirSync,
  readFileSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import Preprocessor from "../../cnx/PARSE/2-Parse/preprocessor/Preprocessor";
import ToolchainDetector from "../../cnx/PARSE/2-Parse/preprocessor/ToolchainDetector";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";
import type ITranspilerResult from "../types/ITranspilerResult";

/** C++ that exists only in the raw text: the preprocessor removes it. */
const CPP_PREPROCESSED_AWAY = `#define FEATURE 0
#if FEATURE != 0
namespace Hidden { int x; }
#endif
int helper(void);
`;

/**
 * C++ that exists only in the preprocessed text: `name##space` is no C++ token
 * until it is pasted, so the raw text reads as C.
 */
const CPP_ONLY_AFTER_PREPROCESSING = `#define USE_SCOPE 1
#define PASTE(a, b) a##b
#if USE_SCOPE
PASTE(name, space) Shown { int y; }
#endif
int helper(void);
`;

/**
 * #985: extra.h is reached only through the unit. broken.h needs prior.h
 * first, so it fails alone; sinker.h refuses to follow prior.h, so the retry
 * with the headers before broken.h fails too; the unit drops sinker.h and
 * settles broken.h, entering extra.h, which a macro names, so the include walk
 * never finds it.
 */
const RECOVERED_ONLY = (extra: string): Record<string, string> => ({
  "prior.h": '#define PRIOR_LEVEL 2\n#define EXTRA_HEADER "extra.h"\n',
  "sinker.h": '#ifdef PRIOR_LEVEL\n#error "include sinker.h first"\n#endif\n',
  "broken.h":
    '#ifndef PRIOR_LEVEL\n#error "include prior.h first"\n#endif\n' +
    "#include EXTRA_HEADER\nint broken_fn(void);\n",
  "extra.h": extra,
});

const RECOVERED_MAIN =
  '#include "prior.h"\n#include "sinker.h"\n#include "broken.h"\n\nvoid main() { }\n';

const errorsOf = (result: ITranspilerResult): string =>
  result.errors.map((e) => e.message).join("\n");

const emitted = (result: ITranspilerResult, ext: ".c" | ".cpp"): boolean =>
  result.outputFiles.some((f) => f.endsWith(ext));

describe("a header's language is decided once, in 1.1 (#1844)", () => {
  let dir: string;
  const preprocessorAvailable =
    ToolchainDetector.fromPath("gcc", NodeFileSystem.instance) !== null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-header-language-"));
    // A project root, so the cache is on and the second run is warm.
    writeFileSync(join(dir, "cnx.config.json"), "{}");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Write the headers, include `entry` from main.cnx, and run cold then warm. */
  const coldThenWarm = (
    headers: Record<string, string>,
    entry: string,
    cppRequired?: boolean,
  ): Promise<readonly [ITranspilerResult, ITranspilerResult]> =>
    coldThenWarmMain(
      headers,
      `#include "${entry}"\n\nvoid main() { }\n`,
      cppRequired,
    );

  /** Write the headers and main.cnx, and run cold then warm. */
  const coldThenWarmMain = async (
    headers: Record<string, string>,
    main: string,
    cppRequired?: boolean,
  ): Promise<readonly [ITranspilerResult, ITranspilerResult]> => {
    for (const [name, text] of Object.entries(headers)) {
      writeFileSync(join(dir, name), text);
    }
    writeFileSync(join(dir, "main.cnx"), main);
    const run = runner(cppRequired);
    const cold = await run();
    const warm = await run();
    return [cold, warm] as const;
  };

  /** A run of main.cnx in `dir`, with the cache on */
  const runner = (cppRequired?: boolean) => {
    const config = {
      input: join(dir, "main.cnx"),
      includeDirs: [dir],
      outDir: dir,
      headerOutDir: dir,
      noCache: false,
      target: "host",
      ...(cppRequired === undefined ? {} : { cppRequired }),
    };
    return () =>
      new Transpiler(config, NodeFileSystem.instance).transpile({
        kind: "files",
      });
  };

  /** Each error, as `line:column code path-tail` */
  const sitesOf = (result: ITranspilerResult): string[] =>
    result.errors.map(
      (e) =>
        `${e.line}:${e.column} ${e.message.slice(6, 11)} ${/'[^']*\/([^/']+)'/.exec(e.message)?.[1] ?? ""}`,
    );

  describe("a run that does not say", () => {
    it("is C++ when it includes a .hpp", async () => {
      const runs = await coldThenWarm(
        { "utils.hpp": "int helper();" },
        "utils.hpp",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
        expect(emitted(result, ".c")).toBe(false);
      }
    });

    it("is C++ when a .h holds C++", async () => {
      const runs = await coldThenWarm(
        { "types.h": "enum Status : uint8_t { OK, ERR };" },
        "types.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    it("is C++ when the C++ is reached through a C header", async () => {
      const runs = await coldThenWarm(
        {
          "outer.h": '#include "inner.hpp"\nint outer(void);\n',
          "inner.hpp": "int inner();",
        },
        "outer.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    // #2504 review: a file only preprocessing opens decides the mode before
    // any reading is chosen, so a .h is read as the C++ compile reads it
    const AUTO_CPP = (impl: string): Record<string, string> => ({
      "impl.hpp": impl,
      "cfg.h": '#define IMPL_HEADER "impl.hpp"\n#include IMPL_HEADER\n',
      "api.h":
        "#include <stdint.h>\n#ifdef __cplusplus\n" +
        "extern uint8_t buffer[4];\n#else\nextern uint8_t buffer[2];\n#endif\n",
    });
    const AUTO_MAIN =
      '#include "cfg.h"\n#include "api.h"\n\n' +
      "u32 count() {\n    return buffer.type_element_count;\n}\n\n" +
      "void main() {\n    (void)count();\n}\n";

    it("reads a .h as C++ when only a macro-named .hpp include makes the run C++, cold and warm", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarmMain(
        AUTO_CPP("namespace Impl { int impl_v; }\n"),
        AUTO_MAIN,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
        expect(readFileSync(join(dir, "main.cpp"), "utf8")).toContain(
          "return 4;",
        );
      }
    });

    it("control: without the .hpp include the run is C, and reads the C branch", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarmMain(
        { ...AUTO_CPP(""), "cfg.h": "#define IMPL_IS_C 1\n" },
        AUTO_MAIN,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
        expect(readFileSync(join(dir, "main.c"), "utf8")).toContain(
          "return 2;",
        );
      }
    });

    // #2504 review: a header the walk reached is judged on the text C meets,
    // and that one judgement is the run's mode
    const LIB = join(
      process.cwd(),
      "tests/bugs/issue-header-earlier-include-macro/lib",
    );
    const fromLib = (...names: string[]): Record<string, string> =>
      Object.fromEntries(
        names.map((name) => [name, readFileSync(join(LIB, name), "utf8")]),
      );
    const including = (...names: string[]): string =>
      `${names.map((name) => `#include "${name}"`).join("\n")}\n\nvoid main() { }\n`;

    it("is C when an earlier include hides a header's class from C alone", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();
      const names = ["c-only-api-config.h", "cpp-api-in-cpp.h"];

      const runs = await coldThenWarmMain(
        fromLib(...names),
        including(...names),
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
        expect(emitted(result, ".cpp")).toBe(false);
      }
    });

    it("is C++ when an earlier include hides a header's class from C++ alone", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();
      const names = ["cpp-only-hide-config.h", "shown-in-c.h"];

      const runs = await coldThenWarmMain(
        fromLib(...names),
        including(...names),
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
        expect(emitted(result, ".c")).toBe(false);
      }
    });

    // #2504 review: one file under two spellings is one header, but each
    // spelling keeps what its own spelling means
    it("is C++ when a macro-named include opens a walked .h through a .hpp symlink", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();
      writeFileSync(join(dir, "api.h"), "int api_v;\n");
      symlinkSync("api.h", join(dir, "api-link.hpp"));

      const runs = await coldThenWarmMain(
        { "cfg.h": '#define API_HEADER "api-link.hpp"\n#include API_HEADER\n' },
        '#include "api.h"\n#include "cfg.h"\n\nvoid main() { }\n',
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    it("is C when only an unopened symlink spelling's sibling include is C++", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();
      mkdirSync(join(dir, "real"));
      mkdirSync(join(dir, "link"));
      writeFileSync(join(dir, "real", "dep.h"), "int dep_v;\n");
      writeFileSync(
        join(dir, "link", "dep.h"),
        "class Dep { public: int x; };\n",
      );
      writeFileSync(join(dir, "real", "a.h"), '#include "dep.h"\n');
      symlinkSync(join("..", "real", "a.h"), join(dir, "link", "a.h"));

      const runs = await coldThenWarmMain(
        {
          "wrap.h": '#ifdef NEVER\n#include "link/a.h"\n#endif\nint wrap_v;\n',
        },
        '#include "real/a.h"\n#include "wrap.h"\n\nvoid main() { }\n',
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
        expect(emitted(result, ".cpp")).toBe(false);
      }
    });

    it("is C when every header is C (negative control)", async () => {
      const runs = await coldThenWarm(
        { "plain.h": "typedef int MyInt;" },
        "plain.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
        expect(emitted(result, ".cpp")).toBe(false);
      }
    });

    it("judges the preprocessed text: C++ removed by #if is C, cold and warm (#1851)", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "cfg.h": CPP_PREPROCESSED_AWAY },
        "cfg.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });

    it("judges the preprocessed text: C++ made by the preprocessor is C++", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "paste.h": CPP_ONLY_AFTER_PREPROCESSING },
        "paste.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });
  });

  describe("a run whose config says cppRequired: false", () => {
    it("rejects a .hpp with E0507, cold and warm", async () => {
      const runs = await coldThenWarm(
        { "utils.hpp": "int helper();" },
        "utils.hpp",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("error[E0507]: C++ header");
        expect(errorsOf(result)).toContain("utils.hpp");
      }
    });

    it("rejects C++ reached through a C header with E0507", async () => {
      const runs = await coldThenWarm(
        {
          "outer.h": '#include "inner.hpp"\nint outer(void);\n',
          "inner.hpp": "int inner();",
        },
        "outer.h",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("inner.hpp");
        // #1542 owner ruling: at main.cnx's own include of the C header
        expect(result.errors[0]).toMatchObject({
          sourcePath: join(dir, "main.cnx"),
          line: 1,
          column: 0,
        });
      }
    });

    it("rejects C++ the preprocessor makes, with E0507", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "paste.h": CPP_ONLY_AFTER_PREPROCESSING },
        "paste.h",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("error[E0507]: C++ syntax");
      }
    });

    it("accepts C++ the preprocessor removes, cold and warm (#1851)", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "cfg.h": CPP_PREPROCESSED_AWAY },
        "cfg.h",
        false,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });
  });

  describe("only a header a C compile opens counts (#1914)", () => {
    const DUAL = (guarded: boolean): Record<string, string> => ({
      "dual.h": guarded
        ? '#ifdef __cplusplus\n#include "extras.hpp"\n#endif\nint dual(void);\n'
        : '#include "extras.hpp"\nint dual(void);\n',
      "extras.hpp": "namespace Extras { int e; }\n",
    });

    it("judges no C++ header that only C++ would include, cold and warm", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      // The include walk finds extras.hpp; a C compile of dual.h never opens it
      const runs = await coldThenWarm(DUAL(true), "dual.h", false);

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });

    it("control: the same C++ header included unguarded is E0507", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(DUAL(false), "dual.h", false);

      for (const result of runs) {
        expect(sitesOf(result)).toEqual(["1:0 E0507 extras.hpp"]);
      }
    });

    const INACTIVE = (enabled: 0 | 1): Record<string, string> => ({
      "lib.h": `#define USE_IMPL ${enabled}\n#if USE_IMPL\n#include "impl.h"\n#endif\nint lib(void);\n`,
      "impl.h": "#include <cnx_no_such_header_zzz.h>\n",
    });

    it("settles no header behind a false #if, so one that cannot preprocess is no error", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(INACTIVE(0), "lib.h");

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
      }
    });

    it("control: the same header behind a true #if is E0517", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(INACTIVE(1), "lib.h");

      for (const result of runs) {
        expect(sitesOf(result)).toEqual(["1:0 E0517 lib.h"]);
      }
    });
  });

  describe("what a C compile opens decides it (#1914 review, round 2)", () => {
    it("reports C++ at no include whose compile never opens it", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      // x.hpp is counted through line 2; c.h opens it only for C++
      const runs = await coldThenWarmMain(
        {
          "c.h": '#ifdef __cplusplus\n#include "x.hpp"\n#endif\nint c(void);\n',
          "x.hpp": "namespace X { int x; }\n",
        },
        '#include "c.h"\n#include "x.hpp"\n\nvoid main() { }\n',
        false,
      );

      for (const result of runs) {
        expect(sitesOf(result)).toEqual(["2:0 E0507 x.hpp"]);
      }
    });

    it("reports a header that cannot preprocess at no include whose compile never opens it", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarmMain(
        {
          "c.h": '#if 0\n#include "bad.h"\n#endif\nint c(void);\n',
          "bad.h": "#include <cnx_no_such_header_zzz.h>\n",
        },
        '#include "c.h"\n#include "bad.h"\n\nvoid main() { }\n',
      );

      for (const result of runs) {
        expect(sitesOf(result)).toEqual(["2:0 E0517 bad.h"]);
      }
    });

    /** extra.h is named by a macro, so the walk never finds it */
    const MACRO_NAMED = (extra: string): Record<string, string> => ({
      "a.h":
        '#define EXTRA_HEADER "extra.h"\n#include EXTRA_HEADER\nint a(void);\n',
      "extra.h": extra,
    });

    it("judges a file only a macro-named include opens, with no header failing", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const cpp = MACRO_NAMED("namespace Extra { int extra_v; }\n");
      for (const result of await coldThenWarm(cpp, "a.h", false)) {
        expect(sitesOf(result)).toEqual(["1:0 E0507 extra.h"]);
      }
      for (const result of await coldThenWarm(cpp, "a.h")) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    it("control: the same file in C is C", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(MACRO_NAMED("int extra_v;\n"), "a.h");

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });

    it("a warm run sees a header added ahead of one on the search path", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const [d1, d2] = [join(dir, "d1"), join(dir, "d2")];
      mkdirSync(d1);
      mkdirSync(d2);
      writeFileSync(
        join(d2, "outer.h"),
        "#include <inner.h>\nint outer(void);\n",
      );
      writeFileSync(join(d2, "inner.h"), "int inner(void);\n");
      writeFileSync(
        join(dir, "main.cnx"),
        '#include "outer.h"\n\nvoid main() { }\n',
      );
      const run = () =>
        new Transpiler(
          {
            input: join(dir, "main.cnx"),
            includeDirs: [d1, d2],
            outDir: dir,
            headerOutDir: dir,
            noCache: false,
            target: "host",
          },
          NodeFileSystem.instance,
        ).transpile({ kind: "files" });

      const cold = await run();
      expect(errorsOf(cold)).toBe("");
      expect(emitted(cold, ".c")).toBe(true);

      // Nothing outer.h's compile read changes; d1 now comes first
      writeFileSync(join(d1, "inner.h"), "namespace Shadow { int w; }\n");
      const warm = await run();
      expect(errorsOf(warm)).toBe("");
      expect(emitted(warm, ".cpp")).toBe(true);
    });

    it("prints no #pragma once warning, cold or warm", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();
      const warn = vi.spyOn(console, "warn");

      const runs = await coldThenWarm(
        { "once.h": "#pragma once\nint once(void);\n" },
        "once.h",
      );

      for (const result of runs) expect(errorsOf(result)).toBe("");
      const printed = warn.mock.calls.map((call) => call.join(" ")).join("\n");
      warn.mockRestore();
      expect(printed).not.toContain("pragma once");
    });
  });

  describe("every header is judged on its preprocessed text (#1852)", () => {
    it("is C when its only C++ is under #ifdef __cplusplus, cold and warm", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      // No #if: the header needs the preprocessor for nothing but its language.
      // C either way: detected, and asked for.
      for (const cppRequired of [undefined, false]) {
        const runs = await coldThenWarm(
          {
            "dual.h":
              "#ifdef __cplusplus\nnamespace Dual { int x; }\n#endif\nint dual(void);\n",
          },
          "dual.h",
          cppRequired,
        );

        for (const result of runs) {
          expect(errorsOf(result)).toBe("");
          expect(emitted(result, ".c")).toBe(true);
          expect(emitted(result, ".cpp")).toBe(false);
        }
      }
    });

    it("control: the same C++ outside the #ifdef is C++", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "dual.h": "namespace Dual { int x; }\nint dual(void);\n" },
        "dual.h",
        false,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toContain("error[E0507]: C++ syntax");
      }
    });
  });

  describe("E0507 at every include that meets C++ (#1844 review)", () => {
    it("reports each include once, at its first occurrence, in source order", async () => {
      const runs = await coldThenWarmMain(
        {
          "a.hpp": "int a_fn();\n",
          "b.hpp": "int b_fn();\n",
          "c.h": '#include "b.hpp"\nint c_fn(void);\n',
          "plain.h": "int plain_fn(void);\n",
        },
        '#include "a.hpp"\n#include "c.h"\n#include "plain.h"\n' +
          '#include "b.hpp"\n#include "a.hpp"\n\nvoid main() { }\n',
        false,
      );

      for (const result of runs) {
        // a.hpp directly; b.hpp through c.h and directly; plain.h is C; a.hpp's
        // second include is the same include as its first
        expect(sitesOf(result)).toEqual([
          "1:0 E0507 a.hpp",
          "2:0 E0507 b.hpp",
          "4:0 E0507 b.hpp",
        ]);
      }
    });

    it("reports a C++ header only the unit's preprocessor reaches (#985)", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarmMain(
        RECOVERED_ONLY("namespace Extra { int extra_v; }\n"),
        RECOVERED_MAIN,
        false,
      );

      for (const result of runs) {
        // extra.h is named by a macro, so the walk never finds it; the unit
        // enters it through broken.h's include, which is line 3
        expect(sitesOf(result)).toEqual(["3:0 E0507 extra.h"]);
        expect(result.errors[0].sourcePath).toBe(join(dir, "main.cnx"));
      }
    });

    it("control: the same header in C is no error", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarmMain(
        RECOVERED_ONLY("int extra_v;\n"),
        RECOVERED_MAIN,
        false,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
      }
    });
  });

  describe("a warm run (#1844 review)", () => {
    const execs = () =>
      vi.spyOn(
        Preprocessor.prototype as unknown as {
          exec: (...args: unknown[]) => Promise<unknown>;
        },
        "exec",
      );

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("starts no preprocessor, and one whose header's include changed does", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      // The walk cannot follow `#include INNER`, so inner.h is on outer.h's
      // dependency list only, and only that list can say outer.h changed
      writeFileSync(
        join(dir, "outer.h"),
        '#define INNER "inner.h"\n#include INNER\n#if USE_NS\nnamespace Outer { int v; }\n#endif\nint outer(void);\n',
      );
      writeFileSync(join(dir, "inner.h"), "#define USE_NS 0\n");
      writeFileSync(
        join(dir, "main.cnx"),
        '#include "outer.h"\n\nvoid main() { }\n',
      );
      const run = runner();
      const exec = execs();

      const cold = await run();
      expect(errorsOf(cold)).toBe("");
      expect(emitted(cold, ".c")).toBe(true);
      // Control: the cold run does start the preprocessor
      expect(exec.mock.calls.length).toBeGreaterThan(0);

      exec.mockClear();
      const warm = await run();
      expect(errorsOf(warm)).toBe("");
      expect(exec).not.toHaveBeenCalled();

      // Only the header outer.h includes changes, so outer.h's own mtime does
      // not; inner.h's macro turns outer.h into C++, so it is settled again.
      writeFileSync(join(dir, "inner.h"), "#define USE_NS 1\n");
      const later = new Date(Date.now() + 5000);
      utimesSync(join(dir, "inner.h"), later, later);
      exec.mockClear();
      const changed = await run();
      expect(exec.mock.calls.length).toBeGreaterThan(0);
      expect(emitted(changed, ".cpp")).toBe(true);
    });
  });

  it("a run that says cppRequired: true is C++ with only C headers", async () => {
    const runs = await coldThenWarm(
      { "plain.h": "typedef int MyInt;" },
      "plain.h",
      true,
    );

    for (const result of runs) {
      expect(errorsOf(result)).toBe("");
      expect(emitted(result, ".cpp")).toBe(true);
    }
  });
});
