/**
 * The targets every fixture runs under (#1668 box 15).
 *
 * A fixture whose program names no target of its own runs for the host, where
 * it is compiled and executed, and is also compiled for a Cortex-M (ILP32) and
 * an AVR (16-bit `int`). Each is compiled against its real C library (box 13):
 * newlib and its C++ headers for Cortex-M, avr-libc for AVR, and the vendored
 * CMSIS-Core header for the Cortex intrinsics.
 *
 * A fixture whose program names a target runs for that target alone. Which
 * target a program names is the transpiler's answer, read from its report,
 * never re-derived here: a `#pragma target`, a helper's pragma, an inline
 * description and `platformio.ini` all arrive the same way.
 *
 * Each target's compiler comes from the catalog the compiler reads, through
 * `TargetToolchain`. The owner ruled on 2026-09-27 that the matrix drives the
 * GCC family; #1761 tracks other compilers.
 */
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import TargetResolver from "../src/cli/TargetResolver";
import TargetToolchain from "../src/cnx/utils/TargetToolchain";
import TargetCatalogFile from "../src/cli/TargetCatalogFile";
import RunTarget from "../src/cnx/PARSE/2-Parse/RunTarget";
import TargetDescriptions from "../src/cnx/PARSE/2-Parse/TargetDescriptions";
import CnxSourceParser from "../src/cnx/PARSE/2-Parse/CnxSourceParser";
import type IGccToolchain from "../src/cnx/utils/types/IGccToolchain";
import type ITargetDescription from "../src/cnx/types/ITargetDescription";
import type IValidationResult from "./types/IValidationResult";
import type TTestMode from "./types/TTestMode";
import NodeFileSystem from "../src/cnx/PARSE/1-Discover/NodeFileSystem";
import InterruptMask from "../src/cnx/TRANSPILE/3-Render/codegen/helpers/InterruptMask";

class TargetMatrix {
  /** The build machine: the one target a fixture is executed on */
  static readonly HOST = "host";

  /**
   * The compile-checked targets a fixture with no target of its own also runs
   * for: a Cortex-M (ILP32) and an AVR (16-bit `int`). The Cortex member is
   * the M7, as the design chose (#1668's addendum, A6.1); the M4 measured the
   * same.
   */
  static readonly CROSS: readonly string[] = ["cortex-m7", "atmega328p"];

  /**
   * The command that installs every cross compiler and real library the
   * matrix needs. The package list is `cross-toolchain-packages.txt`, which CI
   * installs from too, so the two cannot drift.
   */
  static installCommand(rootDir: string): string {
    const packages = readFileSync(
      join(rootDir, "scripts", "cross-toolchain-packages.txt"),
      "utf-8",
    )
      .split("\n")
      .filter((line) => line.trim() !== "");
    return `sudo apt-get install ${packages.join(" ")}`;
  }

  /**
   * The GCC toolchain for a target the transpiler reported, or why there is
   * none. `inline` (an inline description) is not a catalog name; see
   * `toolchainForInline`.
   */
  static toolchainFor(target: string): IGccToolchain | string {
    const description = TargetResolver.byName(target, NodeFileSystem.instance);
    if (description === undefined) {
      return `'${target}' is not a catalog target, so no toolchain is known for it`;
    }
    return TargetToolchain.gccFor(description);
  }

  /**
   * The toolchain for a program described inline: the one the catalog row
   * with the same platform facts names (owner ruling, 2026-09-28, #1760
   * review: "Derive a toolchain"). An inline description cannot name a
   * toolchain (E0512), so its cells had never compiled. The description is
   * read by the transpiler's parser and settled by 1.4's resolver, over the
   * helpers and the entry in pipeline order, never re-derived here. Why none
   * is known, when no row with a toolchain shares its facts.
   */
  static toolchainForInline(
    files: readonly { readonly sourcePath: string; readonly source: string }[],
  ): IGccToolchain | string {
    const catalog = TargetCatalogFile.targets(NodeFileSystem.instance);
    const target = RunTarget.resolve({
      catalog,
      files: files.map((file) => ({
        sourcePath: file.sourcePath,
        directives: CnxSourceParser.parse(file.source).targetDirectives,
      })),
    });
    if (target.kind !== "resolved") {
      return "the program's inline description does not resolve";
    }
    for (const row of new Set(catalog.values())) {
      if (!TargetDescriptions.equal(row, target.description)) continue;
      const toolchain = TargetToolchain.gccFor(row);
      if (typeof toolchain !== "string") return toolchain;
    }
    return "no catalog row with a toolchain has the inline description's platform facts";
  }

  /** The build machine's toolchain; the catalog's host row always has one */
  static hostToolchain(): IGccToolchain {
    const toolchain = TargetMatrix.toolchainFor(TargetMatrix.HOST);
    if (typeof toolchain === "string") {
      throw new TypeError(
        `the catalog's host row has no toolchain: ${toolchain}`,
      );
    }
    return toolchain;
  }

  /** The directory holding the vendored `cmsis_gcc.h` */
  static cmsisIncludeDir(rootDir: string): string {
    return join(rootDir, "vendor", "cmsis-core");
  }

  /**
   * A copy of `tests/` for each cross target, which that target's transpiles
   * write into. The CLI writes every helper's output beside the helper, so a
   * cross run inside `tests/` would overwrite the host's generated files.
   *
   * Each mirror's root carries a `package.json`, a project-root marker. ADR-063
   * names a generated include guard from the file's path relative to the
   * project root, found by walking up for such a marker. Without one, the guard
   * falls back to the input directory, so a regenerated header's guard would
   * differ from its committed twin's. A fixture that includes both a module's
   * `.h` and its `.hpp` then defines its types twice.
   */
  static createMirrors(rootDir: string): Record<string, string> {
    const mirrors: Record<string, string> = {};
    for (const target of TargetMatrix.CROSS) {
      const root = mkdtempSync(join(tmpdir(), "cnx-matrix-"));
      writeFileSync(join(root, "package.json"), "{}\n");
      const tests = join(root, "tests");
      cpSync(join(rootDir, "tests"), tests, { recursive: true });
      mirrors[target] = tests;
    }
    return mirrors;
  }

  /** Remove what `createMirrors` made */
  static removeMirrors(mirrors: Record<string, string>): void {
    for (const tests of Object.values(mirrors)) {
      rmSync(join(tests, ".."), { recursive: true, force: true });
    }
  }

  /**
   * Box 13: every cross target's compiler and real library must be present.
   * Compiles a probe for each cross target in each mode, with that cell's own
   * compile, before any fixture runs. A missing toolchain then fails the run
   * once, loudly, rather than failing every fixture or skipping its cell.
   *
   * `compile` is the harness's one way to compile a translation unit, passed
   * in so the probe is compiled exactly as a fixture is.
   */
  static preflight(
    compile: (
      translationUnit: string,
      mode: TTestMode,
      toolchain: IGccToolchain,
    ) => IValidationResult,
  ): string[] {
    const problems: string[] = [];
    const dir = mkdtempSync(join(tmpdir(), "cnx-matrix-probe-"));
    try {
      for (const target of TargetMatrix.CROSS) {
        const toolchain = TargetMatrix.toolchainFor(target);
        if (typeof toolchain === "string") {
          problems.push(`${target}: ${toolchain}`);
          continue;
        }
        for (const mode of ["c", "cpp"] as const) {
          const probe = join(dir, `${target}-probe.${mode}`);
          writeFileSync(probe, TargetMatrix.probeSource(toolchain));
          const result = compile(probe, mode, toolchain);
          if (!result.valid) {
            problems.push(`${target} (${mode}): ${result.message}`);
          }
        }
      }
      for (const row of TargetMatrix.catalogRows()) {
        const toolchain = TargetToolchain.gccFor(row);
        if (typeof toolchain === "string") {
          continue;
        }
        const probe = join(dir, `model-${row.name.replace(/\W/g, "_")}.c`);
        writeFileSync(probe, TargetMatrix.modelProbeSource(row));
        const result = compile(probe, "c", toolchain);
        if (!result.valid) {
          problems.push(
            `catalog row '${row.name}' disagrees with its compiler: ${result.message}`,
          );
        }
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    return problems;
  }

  /**
   * Every catalog row that names a toolchain, once each: an alias resolves to
   * the row it names
   */
  static catalogRows(): ITargetDescription[] {
    const rows = new Map<string, ITargetDescription>();
    for (const name of TargetResolver.names(NodeFileSystem.instance)) {
      const description = TargetResolver.byName(name, NodeFileSystem.instance);
      if (
        description !== undefined &&
        typeof TargetToolchain.gccFor(description) !== "string"
      ) {
        rows.set(description.name, description);
      }
    }
    return [...rows.values()];
  }

  /**
   * A C translation unit that compiles only if a catalog row's facts are what
   * its compiler says: every width, `char`'s signedness, the byte order, and
   * whether the architecture has LDREX/STREX and BASEPRI. A row that says
   * `interrupt_mask: true` also compiles the real IRQ wrappers, so a compiler
   * they have no arm for stops at their `#error` (#1789). A false fact in the
   * catalog is a static assertion that fails, so no program is transpiled
   * against it (#1668's addendum, "startup model probe").
   */
  static modelProbeSource(row: ITargetDescription): string {
    const width = (type: string, bits: number, fact: string): string =>
      `_Static_assert(sizeof(${type}) * CHAR_BIT == ${bits}, "${fact}");`;
    return [
      "#include <limits.h>",
      "#include <stddef.h>",
      "#if defined(__ARM_FEATURE_LDREX)",
      "#define CNX_LDREX 1",
      "#else",
      "#define CNX_LDREX 0",
      "#endif",
      "#if defined(__ARM_ARCH_7M__) || defined(__ARM_ARCH_7EM__) || defined(__ARM_ARCH_8M_MAIN__)",
      "#define CNX_BASEPRI 1",
      "#else",
      "#define CNX_BASEPRI 0",
      "#endif",
      `_Static_assert(CHAR_BIT == ${row.char_bits}, "char_bits");`,
      `_Static_assert(((char)-1 < 0) == ${row.char_signed ? 1 : 0}, "char_signed");`,
      width("short", row.short_bits, "short_bits"),
      width("int", row.int_bits, "int_bits"),
      width("long", row.long_bits, "long_bits"),
      width("long long", row.long_long_bits, "long_long_bits"),
      width("size_t", row.size_t_bits, "size_t_bits"),
      width("void *", row.pointer_bits, "pointer_bits"),
      width("float", row.float_bits, "float_bits"),
      width("double", row.double_bits, "double_bits"),
      width("long double", row.long_double_bits, "long_double_bits"),
      `_Static_assert((__BYTE_ORDER__ == __ORDER_BIG_ENDIAN__) == ${row.big_endian ? 1 : 0}, "big_endian");`,
      `_Static_assert(CNX_LDREX == ${row.ldrex_strex ? 1 : 0}, "ldrex_strex");`,
      `_Static_assert(CNX_BASEPRI == ${row.basepri ? 1 : 0}, "basepri");`,
      "enum cnx__probe { CNX__PROBE_ONLY };",
      `_Static_assert((sizeof(enum cnx__probe) == 1) == ${row.short_enums ? 1 : 0}, "short_enums");`,
      ...(row.interrupt_mask
        ? ["#include <stdint.h>", ...InterruptMask.wrappers()]
        : []),
      "",
    ].join("\n");
  }

  /**
   * Every C library header generated code includes, and the CMSIS-Core
   * header where the architecture needs it
   */
  private static probeSource(toolchain: IGccToolchain): string {
    const headers = ["stdint.h", "stdbool.h", "stddef.h", "limits.h"];
    headers.push("string.h", "stdio.h");
    if (toolchain.cmsisCore) {
      headers.push("cmsis_gcc.h");
    }
    return (
      headers.map((header) => `#include <${header}>`).join("\n") +
      "\nint probe(void) { return (int)INT8_MAX; }\n"
    );
  }
}

export default TargetMatrix;
