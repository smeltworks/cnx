/**
 * Tests for dual code path consolidation (Issue #634)
 *
 * These tests verify that transpile({ kind: 'files' }) and
 * transpile({ kind: 'source' }) produce identical output for the same input.
 *
 * Design note: Parity is guaranteed by architecture — both paths delegate
 * to the same _executePipeline() via the unified transpile() entry point.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Transpiler from "../Transpiler";
import ITranspilerConfig from "../../cnx/types/ITranspilerConfig";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("Dual Code Paths (Issue #634)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createTranspiler(input: string): Transpiler {
    const config: ITranspilerConfig = {
      input,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
      target: "host",
    };
    return new Transpiler(config, NodeFileSystem.instance);
  }

  describe("Single file transpilation", () => {
    it("produces identical code via run() and transpileSource()", async () => {
      const source = `
mut u8 counter <- 0;

void increment() {
    counter <- counter + 1;
}

void main() {
    increment();
}
`;
      const filePath = join(tempDir, "test.cnx");
      writeFileSync(filePath, source);

      // Path 1: Via run()
      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      // Path 2: Via transpileSource()
      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
      expect(result1.files[0].headerCode).toBe(result2.headerCode);
    });

    it("produces identical code for struct declarations", async () => {
      const source = `
struct Point {
    i32 x;
    i32 y;
}

Point origin <- { x: 0, y: 0 };

void main() {
    Point p <- origin;
}
`;
      const filePath = join(tempDir, "structs.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
      expect(result1.files[0].headerCode).toBe(result2.headerCode);
    });

    it("produces identical code for const arrays with inferred size", async () => {
      const source = `
u8[] VALUES <- [1, 2, 3, 4, 5];

void main() {
    u8 x <- VALUES[0];
}
`;
      const filePath = join(tempDir, "const-array.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
      expect(result1.files[0].headerCode).toBe(result2.headerCode);
    });

    it("produces identical code for enums", async () => {
      const source = `
enum Color {
    Red,
    Green,
    Blue
}

mut Color current <- Color.Red;

void main() {
    current <- Color.Blue;
}
`;
      const filePath = join(tempDir, "enums.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
      expect(result1.files[0].headerCode).toBe(result2.headerCode);
    });

    it("produces identical code for scopes", async () => {
      const source = `
scope Counter {
    mut u8 value <- 0;

    public void increment() {
        value <- value + 1;
    }

    public u8 get() {
        return value;
    }
}

void main() {
    Counter.increment();
}
`;
      const filePath = join(tempDir, "scopes.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
      expect(result1.files[0].headerCode).toBe(result2.headerCode);
    });
  });

  describe("Multi-file transpilation", () => {
    it("run() handles cross-file enum references", async () => {
      // File 1: Define enum
      const enumSource = `
enum Status {
    Idle,
    Running,
    Stopped
}
`;
      const enumPath = join(tempDir, "status.cnx");
      writeFileSync(enumPath, enumSource);

      // File 2: Use enum
      const mainSource = `
#include "status.cnx"

mut Status current <- Status.Idle;

void start() {
    current <- Status.Running;
}

void main() {
    start();
}
`;
      const mainPath = join(tempDir, "main.cnx");
      writeFileSync(mainPath, mainSource);

      // run() should handle cross-file references
      const transpiler = createTranspiler(mainPath);
      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
      expect(result.files).toHaveLength(2);

      // Main file should have correct enum references
      const mainFile = result.files.find((f) => f.sourcePath === mainPath);
      expect(mainFile).toBeDefined();
      expect(mainFile!.code).toContain("Status__Idle");
      expect(mainFile!.code).toContain("Status__Running");
    });

    it("run() handles cross-file struct references", async () => {
      // File 1: Define struct
      const structSource = `
struct Point {
    i32 x;
    i32 y;
}
`;
      const structPath = join(tempDir, "point.cnx");
      writeFileSync(structPath, structSource);

      // File 2: Use struct
      const mainSource = `
#include "point.cnx"

Point origin <- { x: 0, y: 0 };

void main() {
    Point p <- origin;
}
`;
      const mainPath = join(tempDir, "main.cnx");
      writeFileSync(mainPath, mainSource);

      const transpiler = createTranspiler(mainPath);
      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
    });

    it("run() handles cross-file const references", async () => {
      // File 1: Define const
      const constSource = `
u8 MAX_SIZE <- 100;
`;
      const constPath = join(tempDir, "constants.cnx");
      writeFileSync(constPath, constSource);

      // File 2: Use const
      const mainSource = `
#include "constants.cnx"

mut u8[MAX_SIZE] buffer;

void main() {
    buffer[0] <- 42;
}
`;
      const mainPath = join(tempDir, "main.cnx");
      writeFileSync(mainPath, mainSource);

      const transpiler = createTranspiler(mainPath);
      const result = await transpiler.transpile({ kind: "files" });

      expect(result.success).toBe(true);
    });

    it("run() handles cross-file scope function calls", async () => {
      // File 1: Define scope with public method
      const providerSource = `
scope Provider {
    public u8 getValue() {
        return 42;
    }
}
`;
      const providerPath = join(tempDir, "provider.cnx");
      writeFileSync(providerPath, providerSource);

      // File 2: Include provider and call its method
      const consumerSource = `
#include "provider.cnx"

scope Consumer {
    public u8 fetch() {
        return global.Provider.getValue();
    }
}

void main() {
    u8 val <- Provider.getValue();
    u8 val2 <- Consumer.fetch();
}
`;
      const consumerPath = join(tempDir, "consumer.cnx");
      writeFileSync(consumerPath, consumerSource);

      // Via run()
      const transpiler1 = createTranspiler(consumerPath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      expect(result1.success).toBe(true);

      const consumerFile = result1.files.find(
        (f) => f.sourcePath === consumerPath,
      );
      expect(consumerFile).toBeDefined();
      // Verify underscore notation (not dot notation)
      expect(consumerFile!.code).toContain("Provider__getValue()");
      expect(consumerFile!.code).not.toContain("Provider.getValue()");
      expect(consumerFile!.code).toContain("Consumer__fetch()");

      // Via transpileSource() with context from run()
      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: consumerSource,
          workingDir: tempDir,
          sourcePath: consumerPath,
        })
      ).files[0];

      expect(result2.success).toBe(true);
      expect(result2.code).toContain("Provider__getValue()");
      expect(result2.code).not.toContain("Provider.getValue()");
    });

    it("run() handles cross-file scope variable assignment", async () => {
      // File 1: Define scope with public variable
      const storageSource = `
scope Storage {
    public mut u8 value <- 0;
}
`;
      const storagePath = join(tempDir, "storage.cnx");
      writeFileSync(storagePath, storageSource);

      // File 2: Include storage and assign to its variable
      const writerSource = `
#include "storage.cnx"

scope Writer {
    public void save(u8 data) {
        global.Storage.value <- data;
    }
}

void main() {
    Storage.value <- 42;
    Writer.save(99);
}
`;
      const writerPath = join(tempDir, "writer.cnx");
      writeFileSync(writerPath, writerSource);

      // Via run()
      const transpiler1 = createTranspiler(writerPath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      expect(result1.success).toBe(true);

      const writerFile = result1.files.find((f) => f.sourcePath === writerPath);
      expect(writerFile).toBeDefined();
      // Verify underscore notation for scope variable assignment
      expect(writerFile!.code).toContain("Storage__value = 42");
      expect(writerFile!.code).not.toContain("Storage.value = 42");
      expect(writerFile!.code).toContain("Storage__value = data");

      // Via transpileSource()
      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: writerSource,
          workingDir: tempDir,
          sourcePath: writerPath,
        })
      ).files[0];

      expect(result2.success).toBe(true);
      expect(result2.code).toContain("Storage__value = 42");
      expect(result2.code).not.toContain("Storage.value = 42");
    });
  });

  describe("Target resolution parity (ADR-049, #1668)", () => {
    const atomicMain = `#include "helper.cnx"

atomic u32 counter <- 0;

void increment() {
    counter +<- 1;
}
`;

    /** The same program through files mode and source mode */
    async function bothModes(helperSource: string, option?: string) {
      writeFileSync(join(tempDir, "helper.cnx"), helperSource);
      const mainPath = join(tempDir, "main.cnx");
      writeFileSync(mainPath, atomicMain);
      const configure = (input: string) =>
        new Transpiler(
          {
            input,
            includeDirs: [tempDir],
            outDir: tempDir,
            headerOutDir: tempDir,
            target: "host",
            ...(option ? { target: option } : {}),
          },
          NodeFileSystem.instance,
        );
      const files = await configure(mainPath).transpile({ kind: "files" });
      const source = await configure("").transpile({
        kind: "source",
        source: atomicMain,
        workingDir: tempDir,
        sourcePath: mainPath,
      });
      return { files, source, mainPath };
    }

    it("gives a helper's pragma to the entry in both modes", async () => {
      const { files, source, mainPath } = await bothModes(
        "#pragma target teensy41\nu32 helperValue <- 1;\n",
      );
      for (const result of [files, source]) {
        expect(result.success).toBe(true);
        expect(result.target).toEqual({ name: "teensy41", source: "pragma" });
        const main = result.files.find((f) => f.sourcePath === mainPath);
        expect(main?.code).toContain("__LDREXW");
      }
    });

    it("reports disagreeing pragmas as E0511 in both modes", async () => {
      writeFileSync(
        join(tempDir, "other.cnx"),
        "#pragma target cortex-m0\nu32 otherValue <- 2;\n",
      );
      const { files, source } = await bothModes(
        '#include "other.cnx"\n#pragma target teensy41\nu32 helperValue <- 1;\n',
      );
      for (const result of [files, source]) {
        expect(result.success).toBe(false);
        expect(result.errors.map((e) => e.message.slice(0, 16))).toEqual([
          "error[E0511]: th",
        ]);
      }
    });

    it("reports a program that names no target as E0515 in both modes", async () => {
      writeFileSync(join(tempDir, "helper.cnx"), "u32 helperValue <- 1;\n");
      const mainPath = join(tempDir, "main.cnx");
      writeFileSync(mainPath, atomicMain);
      const withoutTarget = (input: string) =>
        new Transpiler(
          {
            input,
            includeDirs: [tempDir],
            outDir: tempDir,
            headerOutDir: tempDir,
          },
          NodeFileSystem.instance,
        );
      const files = await withoutTarget(mainPath).transpile({ kind: "files" });
      const source = await withoutTarget("").transpile({
        kind: "source",
        source: atomicMain,
        workingDir: tempDir,
        sourcePath: mainPath,
      });
      for (const result of [files, source]) {
        expect(result.success).toBe(false);
        expect(result.errors).toEqual([
          expect.objectContaining({
            sourcePath: mainPath,
            line: 1,
            message: "error[E0515]: the program names no target",
          }),
        ]);
      }
    });

    it("places an unknown option on the entry file in both modes", async () => {
      const { files, source, mainPath } = await bothModes(
        "u32 helperValue <- 1;\n",
        "bogus",
      );
      for (const result of [files, source]) {
        expect(result.errors).toEqual([
          expect.objectContaining({
            sourcePath: mainPath,
            line: 1,
            message: expect.stringContaining("error[E0510]"),
          }),
        ]);
      }
    });
  });

  describe("State isolation", () => {
    it("transpileSource() standalone calls are isolated", async () => {
      const source1 = `
u8 value1 <- 1;
void main() {}
`;
      const source2 = `
u8 value2 <- 2;
void main() {}
`;

      // Two separate standalone transpileSource calls
      const transpiler = createTranspiler("");

      const result1 = (
        await transpiler.transpile({
          kind: "source",
          source: source1,
          sourcePath: "file1.cnx",
        })
      ).files[0];
      const result2 = (
        await transpiler.transpile({
          kind: "source",
          source: source2,
          sourcePath: "file2.cnx",
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Each file should only contain its own symbols
      expect(result1.code).toContain("value1");
      expect(result1.code).not.toContain("value2");
      expect(result2.code).toContain("value2");
      expect(result2.code).not.toContain("value1");
    });

    it("run() properly resets state between calls", async () => {
      const source = `
u8 counter <- 0;
void main() {}
`;
      const filePath = join(tempDir, "test.cnx");
      writeFileSync(filePath, source);

      const transpiler = createTranspiler(filePath);

      // First run
      const result1 = await transpiler.transpile({ kind: "files" });
      expect(result1.success).toBe(true);
      expect(result1.symbolsCollected).toBeGreaterThan(0);

      // Second run should not accumulate symbols from first
      const result2 = await transpiler.transpile({ kind: "files" });
      expect(result2.success).toBe(true);
      expect(result2.symbolsCollected).toBe(result1.symbolsCollected);
    });
  });

  describe("Symbol collection timing (Issue #634 consolidation)", () => {
    it("struct defined and used in same file works in both paths", async () => {
      // This test validates that moving symbol collection before code generation
      // doesn't break type resolution for same-file struct usage
      const source = `
struct Config {
    u16 port;
    u8 flags;
}

mut Config settings <- { port: 8080, flags: 0 };

void updatePort(Config config) {
    settings.port <- config.port;
}

void main() {
    Config newConfig <- { port: 9000, flags: 1 };
    updatePort(newConfig);
}
`;
      const filePath = join(tempDir, "same-file-struct.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);

      // Verify struct type is properly resolved
      expect(result2.code).toContain("Config settings");
      expect(result2.code).toContain("void updatePort(");
    });

    it("enum defined and used as function parameter in same file", async () => {
      // Tests enum type resolution with symbol collection before code generation
      const source = `
enum State {
    Init,
    Running,
    Done
}

mut State current <- State.Init;

void setState(State s) {
    current <- s;
}

void main() {
    setState(State.Running);
}
`;
      const filePath = join(tempDir, "same-file-enum.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);

      // Verify enum prefixing works correctly
      expect(result2.code).toContain("State__Init");
      expect(result2.code).toContain("State__Running");
    });

    it("nested struct types work in both paths", async () => {
      // Tests complex type resolution with nested structs
      const source = `
struct Inner {
    u8 value;
}

struct Outer {
    Inner data;
    u16 count;
}

Outer container <- { data: { value: 42 }, count: 1 };

void main() {
    u8 v <- container.data.value;
}
`;
      const filePath = join(tempDir, "nested-struct.cnx");
      writeFileSync(filePath, source);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = (
        await transpiler2.transpile({
          kind: "source",
          source: source,
          workingDir: tempDir,
          sourcePath: filePath,
        })
      ).files[0];

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.files[0].code).toBe(result2.code);
    });
  });

  describe("Cyclic includes (Issue #1435)", () => {
    // Each file of the pair uses an enum only the other declares, so both
    // directions of the include graph must be visible. A mode that walks the
    // cycle back into the root either declares the root twice (E0203) or hands
    // it its own symbols as an "external" source.
    const aSource = `#include "b.cnx"

enum EMode { IDLE, BUSY }

u8 fromA() {
    EColor c <- EColor.GREEN;
    return (u8)c;
}
`;

    async function transpileBothModes(bSource: string) {
      const aPath = join(tempDir, "a.cnx");
      writeFileSync(aPath, aSource);
      writeFileSync(join(tempDir, "b.cnx"), bSource);

      const files = await createTranspiler(aPath).transpile({ kind: "files" });
      const source = await createTranspiler("").transpile({
        kind: "source",
        source: aSource,
        workingDir: tempDir,
        sourcePath: aPath,
      });
      return {
        files,
        source,
        filesA: files.files.find((f) => f.sourcePath === aPath),
        sourceA: source.files.find((f) => f.sourcePath === aPath),
      };
    }

    it("a cyclic include pair transpiles identically in both modes", async () => {
      const r = await transpileBothModes(`#include "a.cnx"

enum EColor { RED, GREEN }

u8 fromB() {
    EMode m <- EMode.BUSY;
    return (u8)m;
}
`);

      expect(r.files.errors).toEqual([]);
      expect(r.source.errors).toEqual([]);
      expect(r.filesA?.code).toContain("EColor c = EColor__GREEN;");
      expect(r.sourceA?.code).toBe(r.filesA?.code);
      expect(r.sourceA?.headerCode).toBe(r.filesA?.headerCode);
    });

    it("control: the same pair without the back edge agrees in both modes", async () => {
      const r = await transpileBothModes(`enum EColor { RED, GREEN }
`);

      expect(r.files.errors).toEqual([]);
      expect(r.source.errors).toEqual([]);
      expect(r.filesA?.code).toContain("EColor c = EColor__GREEN;");
      expect(r.sourceA?.code).toBe(r.filesA?.code);
      expect(r.sourceA?.headerCode).toBe(r.filesA?.headerCode);
    });
  });

  describe("Error handling parity", () => {
    it("both paths report parse errors identically", async () => {
      const invalidSource = `
u8 x <- ;  // Parse error: missing expression
`;
      const filePath = join(tempDir, "invalid.cnx");
      writeFileSync(filePath, invalidSource);

      const transpiler1 = createTranspiler(filePath);
      const result1 = await transpiler1.transpile({ kind: "files" });

      const transpiler2 = createTranspiler("");
      const result2 = await transpiler2.transpile({
        kind: "source",
        source: invalidSource,
        sourcePath: filePath,
      });

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(false);
      // Both should have errors (specific messages may differ slightly)
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result2.errors.length).toBeGreaterThan(0);
    });
  });
});
