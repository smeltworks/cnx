/**
 * Issues #1161 and #1164 — one decision: "does this file have a public C interface?"
 *
 * Two predicates used to answer it and disagreed:
 *   - whether a .h is written      (the header-facts capture, on an `isExported`
 *                                   flag the symbol carried)
 *   - whether the .c includes it   (CodeGenerator, on scope-member visibility only)
 *
 * #1161: top-level functions were collected as private, so they never reached
 *        the header and cross-file callers hit implicit declarations.
 * #1164: a file with no public scope member got a header nothing included, and
 *        redefined its types inline instead — a duplicate definition of the
 *        same type from one source, and MISRA C:2012 Rule 8.4 violations for
 *        every external-linkage definition in the file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Transpiler from "../Transpiler";
import ITranspilerConfig from "../../cnx/types/ITranspilerConfig";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

describe("Header emission decision (#1161, #1164)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-header-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function transpileSource(
    source: string,
    name = "sample.cnx",
  ): Promise<{ code: string; headerCode: string | undefined }> {
    const sourcePath = join(tempDir, name);
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
      headerCode: result.files[0].headerCode,
    };
  }

  describe("#1300: visibility decides WHERE a type is defined, not whether", () => {
    // ADR-016 makes a scope-declared type private by default. Four collectors
    // hardcoded an exported flag, so every private struct, enum and bitmap was
    // emitted into the public header -- an ABI leak: downstream C could
    // construct a type the author declared internal.
    it("keeps private struct/enum/bitmap out of the header, keeps the public twins in", async () => {
      const { headerCode } = await transpileSource(`
scope S {
    private struct Hidden { u32 a; }
    public struct Shown { u32 b; }
    private enum HiddenMode { OFF, ON }
    public enum ShownMode { LOW, HIGH }
    public u32 use() {
        Hidden h <- {a: 1};
        HiddenMode m <- HiddenMode.ON;
        if (m = HiddenMode.ON) { return h.a; }
        return 0;
    }
}
`);
      expect(headerCode).not.toContain("S__Hidden ");
      expect(headerCode).not.toContain("S__HiddenMode");
      // Negative control: over-suppression is as wrong as under-suppression.
      expect(headerCode).toContain("S__Shown");
      expect(headerCode).toContain("S__ShownMode");
    });

    // The other half of the same decision. A private type that leaves the
    // header must be defined in the `.c`, or the `.c` no longer compiles --
    // the definition lived ONLY in the header before this fix.
    it("defines the private type in the .c, exactly once, and not the public one", async () => {
      const { code, headerCode } = await transpileSource(`
scope S {
    private struct Hidden { u32 a; }
    public struct Shown { u32 b; }
    public u32 use() {
        Hidden h <- {a: 1};
        return h.a;
    }
}
`);
      expect(code.match(/typedef struct S__Hidden/g)).toHaveLength(1);
      // A public type is defined by the header the .c includes. Defining it
      // here too is a C redefinition error, which is what happens if the two
      // placements are decided independently instead of as complements.
      expect(code).not.toContain("typedef struct S__Shown");
      expect(headerCode).toContain("typedef struct S__Shown");
    });

    // Not a privacy exception: C needs a COMPLETE type wherever a value of it
    // is returned, so a private type named by a public signature has to be in
    // the header or no caller compiles. cnx still rejects `S.Hidden` from
    // outside, so the type remains unnameable -- only complete.
    it("promotes a private type named by a public signature, and then does NOT define it in the .c", async () => {
      const { code, headerCode } = await transpileSource(`
scope S {
    private struct Hidden { u32 a; }
    public Hidden expose() {
        Hidden h <- {a: 1};
        return h;
    }
}
`);
      expect(headerCode).toContain("typedef struct S__Hidden");
      expect(code).not.toContain("typedef struct S__Hidden");
    });

    // The worklist re-push is the only reason the closure is transitive. A
    // 1-hop promotion passes even if the loop is a single pass, so this walks
    // TWO hops: public signature -> private Outer -> Outer's field names
    // private Inner. A missing hop emits a header defining Outer with an
    // undeclared member type, which is the exact failure this closure exists
    // to prevent.
    it("promotes a private type reached only through ANOTHER private type (2 hops)", async () => {
      const { code, headerCode } = await transpileSource(`
scope S {
    private struct Inner { u32 deep; }
    private struct Outer { Inner i; u32 v; }
    public Outer make() {
        Outer o <- {i: {deep: 1}, v: 2};
        return o;
    }
}
`);
      expect(headerCode).toContain("typedef struct S__Outer");
      expect(headerCode).toContain("typedef struct S__Inner");
      // Inner must precede Outer, or the header does not compile.
      expect(headerCode!.indexOf("} S__Inner;")).toBeLessThan(
        headerCode!.indexOf("} S__Outer;"),
      );
      // And neither is defined twice.
      expect(code).not.toContain("typedef struct S__Inner");
      expect(code).not.toContain("typedef struct S__Outer");
    });

    // An array dimension crosses the header boundary as a VALUE, not a type:
    // `extern u8 v[S__State__COUNT]` needs the enum even though no declaration
    // names `S__State`. Walking types alone left four corpus headers
    // referencing an undeclared constant.
    it("keeps private an enum that a public variable names only as an array dimension", async () => {
      // The header used to write `S__table[S__State__COUNT]`, so the private
      // enum had to be promoted into it. #1175: the size is folded once, by
      // 1.4, and the header writes the value -- which names nothing private.
      const { headerCode } = await transpileSource(`
scope S {
    enum State { IDLE, RUN, COUNT }
    public u8[State.COUNT] table;
}
`);
      expect(headerCode).toContain("S__table[2]");
      expect(headerCode).not.toContain("S__State");
    });

    // A register never reaches the header in either case, so its visibility is
    // observable only here: it decides whether the file has a public interface
    // at all. Before the fix this wrote a header holding nothing but include
    // guards, which the .c then included.
    it("writes no header for a file whose only scope member is a private register", async () => {
      const { code, headerCode } = await transpileSource(`
scope S {
    private register Peripheral {
        0x00 rw u32 DR,
    }
    private Peripheral R(0x40000000);
}
`);
      expect(headerCode).toBeUndefined();
      expect(code).not.toContain('#include "sample.h"');
    });
  });

  describe("#1161: top-level functions are public (ADR-016)", () => {
    it("emits a prototype for a top-level function taking a struct", async () => {
      const { headerCode } = await transpileSource(`
struct Point { u8 v; }
u8 readGlobal(Point p) { return p.v; }
`);
      expect(headerCode).toContain("readGlobal");
    });

    it("emits a prototype for a top-level function taking a primitive", async () => {
      const { headerCode } = await transpileSource(`
u8 addOne(u8 x) { return x + 1; }
`);
      expect(headerCode).toContain("addOne");
    });

    // Neither `public` nor `private` parses at top level, so a top-level
    // function has no opt-out: privacy is what `scope` is for (ADR-016).
    it("keeps a private scope member out of the header", async () => {
      const { headerCode } = await transpileSource(`
u8 exposed(u8 x) { return x + 1; }
scope Sample { private u8 hidden() { return 2; } }
`);
      expect(headerCode).toContain("exposed");
      expect(headerCode).not.toContain("hidden");
    });

    it("never emits a prototype for main — the C runtime calls it, not another translation unit", async () => {
      const { headerCode } = await transpileSource(`
u8 addOne(u8 x) { return x + 1; }
u32 main() { return 0; }
`);
      expect(headerCode).toContain("addOne");
      expect(headerCode).not.toContain("main");
    });

    it("generates no header for a scope whose members are all private", async () => {
      const { headerCode } = await transpileSource(`
scope Sample { private u8 hidden() { return 1; } }
`);
      expect(headerCode).toBeUndefined();
    });

    it("generates no header at all for a file whose only function is main", async () => {
      const { headerCode } = await transpileSource(`
u32 main() { return 0; }
`);
      expect(headerCode).toBeUndefined();
    });
  });

  describe("#1164: the .c includes the header whenever one is generated", () => {
    it("self-includes for a file exporting only a struct and a const", async () => {
      const { code } = await transpileSource(
        `
struct Point { i32 x; }
Point ORIGIN <- {x: 0};
`,
        "consts.cnx",
      );
      expect(code).toContain('#include "consts.h"');
    });

    it("does not redefine a type the header already defines", async () => {
      const { code } = await transpileSource(
        `
struct Point { i32 x; }
Point ORIGIN <- {x: 0};
`,
        "consts.cnx",
      );
      // A struct tag redefinition is an error in every C standard, so the
      // self-include and an inline typedef cannot both be present.
      expect(code).not.toContain("typedef struct Point");
    });
  });

  // Replaces the per-shape CodeGenerator tests that asserted the .c contained
  // `typedef struct` / `typedef enum` / `typedef uint8_t`. Those asserted the
  // duplicate definition this issue removes: the type is emitted once, in the
  // header, and the .c includes it. Parameterized rather than repeated per
  // shape (SonarCloud S5976).
  describe("#1164: a type is defined once, in the header", () => {
    const shapes: ReadonlyArray<{
      name: string;
      source: string;
      definition: string;
    }> = [
      {
        name: "struct",
        source: "struct Point { i32 x; i32 y; }",
        definition: "typedef struct Point",
      },
      {
        name: "struct with an array field",
        source: "struct Buffer { u8[4] data; }",
        definition: "typedef struct Buffer",
      },
      {
        name: "struct with a bool field",
        source: "struct Flag { bool enabled; }",
        definition: "typedef struct Flag",
      },
      {
        name: "nested struct",
        source: "struct Inner { u8 v; }\nstruct Outer { Inner inner; }",
        definition: "typedef struct Outer",
      },
      {
        name: "enum",
        source: "enum Color { RED, GREEN, BLUE }",
        definition: "typedef enum",
      },
      {
        name: "enum with explicit values",
        source: "enum Status { OK <- 1, ERROR <- 255 }",
        definition: "typedef enum",
      },
      {
        name: "bitmap",
        source: "bitmap8 Flags { enabled, active, reserved[6] }",
        definition: "typedef uint8_t Flags;",
      },
    ];

    it.each(shapes)(
      "$name: defined in the header, not repeated in the .c",
      async ({ source, definition }) => {
        const { code, headerCode } = await transpileSource(source, "shape.cnx");
        expect(headerCode).toContain(definition);
        // A repeat would be a redefinition error: the .c includes the header.
        expect(code).not.toContain(definition);
        expect(code).toContain('#include "shape.h"');
      },
    );
  });

  describe("one decision, not two", () => {
    // Each source is a shape that previously made the two predicates disagree.
    const shapes: ReadonlyArray<{ name: string; source: string }> = [
      {
        name: "top-level function only",
        source: "u8 addOne(u8 x) { return x + 1; }",
      },
      {
        name: "struct and const, no scope",
        source: "struct Point { i32 x; }\nPoint ORIGIN <- {x: 0};",
      },
      { name: "enum only", source: "enum EColor { RED, GREEN }" },
      {
        name: "public scope member",
        source: "scope Sample { public u8 get() { return 1; } }",
      },
      {
        name: "private scope member only",
        source: "scope Sample { private u8 get() { return 1; } }",
      },
      { name: "main only", source: "u32 main() { return 0; }" },
    ];

    it.each(shapes)(
      "$name: a header is generated exactly when the .c includes one",
      async ({ source }) => {
        const { code, headerCode } = await transpileSource(source, "unit.cnx");
        const headerGenerated = headerCode !== undefined;
        const selfIncluded = code.includes('#include "unit.h"');
        expect(selfIncluded).toBe(headerGenerated);
      },
    );
  });
});
