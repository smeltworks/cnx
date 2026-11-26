/**
 * Issue #1164 follow-through: the generated `.h` must agree with the generated
 * `.c`.
 *
 * While the `.c` did not include its own header, every disagreement between the
 * two was invisible — no compiler ever saw both. Making the `.c` self-include
 * turned that class of defect into compile errors, and these are the cases it
 * exposed. Each one is a declaration in the header that contradicts the
 * definition in the implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Transpiler from "../Transpiler";
import ITranspilerConfig from "../../cnx/types/ITranspilerConfig";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("Header/implementation agreement (#1164)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-agree-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function transpileSource(
    source: string,
  ): Promise<{ code: string; headerCode: string }> {
    const sourcePath = join(tempDir, "sample.cnx");
    writeFileSync(sourcePath, source);
    const config: ITranspilerConfig = {
      input: sourcePath,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
      target: "host",
    };
    const result = await new Transpiler(
      config,
      NodeFileSystem.instance,
    ).transpile({
      kind: "source",
      source,
      workingDir: tempDir,
      sourcePath,
    });
    expect(result.success).toBe(true);
    return {
      code: result.files[0].code,
      headerCode: result.files[0].headerCode ?? "",
    };
  }

  it("carries volatile onto the header declaration", async () => {
    const { code, headerCode } = await transpileSource(`
volatile u32 statusFlag <- 0;
u32 readFlag() { return statusFlag; }
`);
    // The .c defines it volatile; a declaration that drops the qualifier is a
    // "conflicting type qualifiers" error once the .c includes the header.
    expect(code).toContain("volatile uint32_t statusFlag");
    expect(headerCode).toContain("volatile");
  });

  it("declares a string constant with its C type, not the cnx type", async () => {
    const { code, headerCode } = await transpileSource(`
string VERSION <- "1.0.0";
u8 firstChar() { return (u8)VERSION[0]; }
`);
    expect(code).toContain("char VERSION");
    // ADR-045 infers the capacity from the literal. The .c resolves it to
    // char[6]; the header must resolve it the same way — `string` is not a C
    // type, so a header that emits it does not compile.
    expect(headerCode).not.toContain("string VERSION");
    expect(headerCode).toContain("char VERSION");
  });

  // Review of #1206: the .c stops emitting the ISR typedef once it includes the
  // header, so the header must carry it whenever the FILE needs the type --
  // not merely when the public interface names it.
  it.each([
    {
      name: "an ISR local to a function body",
      source: `
void handlerA() { }
u32 doWork() {
    ISR handler <- handlerA;
    handler();
    return 1;
}
`,
    },
    {
      name: "an ISR used by a private scope member",
      source: `
scope Timer {
    private void tick() { }
    public void arm() { ISR handler <- this.tick; handler(); }
}
`,
    },
  ])("emits the ISR typedef exactly once for $name", async ({ source }) => {
    const { code, headerCode } = await transpileSource(source);
    const isrTypedef = /typedef void \(\*ISR\)\(void\);/g;
    expect(`${code}${headerCode}`.match(isrTypedef)).toHaveLength(1);
    // The body that uses the type is in the .c, so the .c must see it.
    expect(code).toContain('#include "sample.h"');
    expect(headerCode).toContain("typedef void (*ISR)(void);");
  });

  // Review of #1206: whether the capacity dimension is present is structural.
  // A guard comparing the trailing dimension to capacity + 1 misfires for any
  // string<N>[N+1] and declares a different type than the .c defines.
  it.each([
    {
      name: "string<32>[5] (capacity differs from the outer dimension)",
      declaration: "string<32>[5]",
      expected: "char names[5][33]",
    },
    {
      name: "string<4>[5] (capacity equals the outer dimension)",
      declaration: "string<4>[5]",
      expected: "char names[5][5]",
    },
    {
      name: "string<9>[10] (capacity equals the outer dimension)",
      declaration: "string<9>[10]",
      expected: "char names[10][10]",
    },
  ])(
    "declares $name identically in both files",
    async ({ declaration, expected }) => {
      const { code, headerCode } = await transpileSource(`
u32 count(${declaration} names) { return 1; }
`);
      expect(code).toContain(expected);
      expect(headerCode).toContain(expected);
    },
  );

  it("emits the typedef for a callback used only as a parameter", async () => {
    const { headerCode } = await transpileSource(`
struct Message { u32 id; }
void onReceive(Message message) { }
void setHandler(onReceive handler) { handler; }
`);
    expect(headerCode).toContain(
      "typedef void (*onReceive_fp)(const Message*);",
    );
    // Forward-declaring a function pointer as a struct describes it as an
    // incomplete type, and the prototype using it then does not compile.
    expect(headerCode).not.toContain("typedef struct onReceive_fp");
    expect(headerCode).toContain("void setHandler(onReceive_fp handler);");
  });

  it("declares the ISR typedef it uses (ADR-040)", async () => {
    const { headerCode } = await transpileSource(`
mut ISR globalHandler;
void install(ISR handler) { globalHandler <- handler; }
`);
    // The header references ISR in a declaration, so it must define the type.
    expect(headerCode).toContain("typedef void (*ISR)(void);");
  });
});
