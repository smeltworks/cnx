/**
 * Issue #1881 review: a header's names are visible only in a file whose own
 * includes bring that header in, and the check compares header paths. One
 * header reached under two spellings that are the same file only once
 * symlinks are resolved (a vendored SDK's `include/` linked into `vendor/`)
 * is still visible in each file that includes it, under either spelling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("a header reached under a symlinked spelling (#1881)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnx-1881-symlink-"));
    const sdk = join(project, "vendor", "sdk");
    mkdirSync(sdk, { recursive: true });
    symlinkSync(sdk, join(project, "include"), "dir");
    writeFileSync(
      join(sdk, "board.h"),
      '#ifndef BOARD_H\n#define BOARD_H\n#include "pins.h"\n#define LED 13\nvoid hw(void);\n#endif\n',
    );
    writeFileSync(
      join(sdk, "pins.h"),
      "#ifndef PINS_H\n#define PINS_H\n#define PIN 3\ntypedef unsigned int pin_t;\nvoid pinInit(void);\n#endif\n",
    );
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  it("sees the header's names in a file under each spelling", async () => {
    writeFileSync(
      join(project, "linked.cnx"),
      '#include "include/board.h"\n\nvoid viaLink() {\n    pin_t p <- PIN;\n    u32 led <- LED;\n    pinInit();\n    hw();\n}\n',
    );
    const main = join(project, "main.cnx");
    writeFileSync(
      main,
      '#pragma target host\n#include "vendor/sdk/board.h"\n#include "linked.cnx"\n\nvoid main() {\n    pin_t p <- PIN;\n    u32 led <- LED;\n    pinInit();\n    hw();\n    viaLink();\n}\n',
    );

    const result = await new Transpiler(
      { input: main, outDir: join(project, "build"), noCache: true },
      NodeFileSystem.instance,
    ).transpile({ kind: "files" });

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });
});
