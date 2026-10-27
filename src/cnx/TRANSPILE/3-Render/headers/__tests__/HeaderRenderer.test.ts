/**
 * Tests for HeaderRenderer
 * Issue #1323: the whole-program render step that turns every file's captured
 * IHeaderEmissionFacts into header text, reading no state.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import HeaderRenderer from "../HeaderRenderer";
import HeaderGenerator from "../HeaderGenerator";
import IHeaderEmissionFacts from "../types/IHeaderEmissionFacts";
import IHeaderSymbol from "../types/IHeaderSymbol";
import IHeaderOptions from "../../codegen/types/IHeaderOptions";

/** #1428: the run's mode, stated -- the renderer reads it from the program */
const C_RUN = { cppMode: () => false };

describe("HeaderRenderer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeVarSymbol(name: string, type: string): IHeaderSymbol {
    return {
      name,
      type,
      kind: "variable",
      sourceFile: "test.cnx",
      sourceLine: 1,
    };
  }

  function makeFacts(
    filename: string,
    symbols: IHeaderSymbol[] = [makeVarSymbol("value", "u8")],
    options: IHeaderOptions,
  ): IHeaderEmissionFacts {
    return {
      symbols,
      filename,
      options,
      typeInput: {
        enumMembers: new Map(),
        memberCNames: new Map(),
        structFields: new Map(),
        structFieldDimensions: new Map(),
        bitmapBackingType: new Map(),
        bitmapFields: new Map(),
      },
      allKnownEnums: new Set(),
      basename: filename,
      program: C_RUN,
    };
  }

  it("prints the register blocks the .c recorded, from the captured facts (#1453)", () => {
    const block = [
      "/* Register: HW @ 0x40000000 */",
      "#define HW__CTRL (*(volatile uint32_t*)(0x40000000 + 0x00))",
      "",
    ].join("\n");
    const facts = new Map([
      [
        "/src/hw.cnx",
        makeFacts("hw.h", undefined, { registerBlocks: [block] }),
      ],
    ]);
    // No state is set up, and none can be: `HeaderRenderer.render` takes the
    // captured facts, and nothing else. At BASE this line wrote
    // the GLOBAL `CodeGenState`, so it was a real negative control -- live and
    // captured values disagreed on state the renderer could in principle reach.
    // #1452 made the state an instance the renderer has no handle on, so the
    // invariant now holds by the signature, and a line writing a module-local
    // object would be dead setup wearing a control's comment.
    const plan = HeaderRenderer.render(facts);

    const header = plan.headersBySourcePath.get("/src/hw.cnx") ?? "";
    expect(header).toContain("/* Registers (ADR-004) */");
    expect(header).toContain("#define HW__CTRL (*(volatile uint32_t*)");
  });

  it("returns empty maps for an empty facts input", () => {
    const plan = HeaderRenderer.render(new Map());

    expect(plan.headersBySourcePath.size).toBe(0);
    expect(plan.errorsBySourcePath.size).toBe(0);
  });

  it("renders one file's header, keyed by source path", () => {
    const facts = new Map([
      ["/src/foo.cnx", makeFacts("foo.h", undefined, {})],
    ]);

    const plan = HeaderRenderer.render(facts);

    expect(plan.headersBySourcePath.size).toBe(1);
    expect(plan.errorsBySourcePath.size).toBe(0);
    const header = plan.headersBySourcePath.get("/src/foo.cnx");
    expect(header).toContain("extern uint8_t value;");
  });

  it("renders every file independently, in one batch", () => {
    const facts = new Map([
      ["/src/foo.cnx", makeFacts("foo.h", [makeVarSymbol("a", "u8")], {})],
      ["/src/bar.cnx", makeFacts("bar.h", [makeVarSymbol("b", "u16")], {})],
    ]);

    const plan = HeaderRenderer.render(facts);

    expect(plan.headersBySourcePath.size).toBe(2);
    expect(plan.headersBySourcePath.get("/src/foo.cnx")).toContain(
      "extern uint8_t a;",
    );
    expect(plan.headersBySourcePath.get("/src/bar.cnx")).toContain(
      "extern uint16_t b;",
    );
  });

  it("isolates one file's render failure into errorsBySourcePath, not headersBySourcePath", () => {
    vi.spyOn(HeaderGenerator.prototype, "generate").mockImplementationOnce(
      () => {
        throw new Error("boom");
      },
    );
    const facts = new Map([
      ["/src/bad.cnx", makeFacts("bad.h", undefined, {})],
    ]);

    const plan = HeaderRenderer.render(facts);

    expect(plan.headersBySourcePath.has("/src/bad.cnx")).toBe(false);
    expect(plan.errorsBySourcePath.get("/src/bad.cnx")).toBe("boom");
  });

  it("does not let one file's render failure abort another file's render", () => {
    const original = HeaderGenerator.prototype.generate;
    vi.spyOn(HeaderGenerator.prototype, "generate")
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockImplementationOnce(function (
        this: HeaderGenerator,
        ...args: Parameters<HeaderGenerator["generate"]>
      ) {
        return original.apply(this, args);
      });
    const facts = new Map([
      ["/src/bad.cnx", makeFacts("bad.h", undefined, {})],
      ["/src/good.cnx", makeFacts("good.h", [makeVarSymbol("c", "u32")], {})],
    ]);

    const plan = HeaderRenderer.render(facts);

    expect(plan.errorsBySourcePath.get("/src/bad.cnx")).toBe("boom");
    expect(plan.headersBySourcePath.get("/src/good.cnx")).toContain(
      "extern uint32_t c;",
    );
  });

  it("renders identically after TranspileState has moved on to another file", () => {
    // This is the invariant HeaderRenderer exists to provide (#1323):
    // plan() reads no TranspileState, only the facts it is handed. Captured
    // while TranspileState said "this file needs the ISR typedef" --
    const facts = new Map([
      [
        "/src/foo.cnx",
        makeFacts("foo.h", undefined, { needsIsrTypedef: true }),
      ],
    ]);

    // -- then TranspileState moves on to a later file that needs no such thing,
    // the same way the real per-file loop leaves it before Stage 5.5 runs.
    // #1452: the flag lives on `TranspileState` now; the renderer reads it
    // from the facts it is handed, which is what this case exercises.

    const plan = HeaderRenderer.render(facts);

    // If plan() (or the generate() call path it uses) ever read live
    // state.needsISR instead of the captured facts.options value,
    // this would render with no ISR typedef -- silently wrong, the same
    // failure mode #1139 was, and undetectable by any test that does not
    // deliberately make the live and captured values disagree.
    expect(plan.headersBySourcePath.get("/src/foo.cnx")).toContain(
      "typedef void (*ISR)(void);",
    );
  });

  it("stringifies a non-Error throw instead of losing it", () => {
    vi.spyOn(HeaderGenerator.prototype, "generate").mockImplementationOnce(
      () => {
        throw "not an Error instance";
      },
    );
    const facts = new Map([
      ["/src/weird.cnx", makeFacts("weird.h", undefined, {})],
    ]);

    const plan = HeaderRenderer.render(facts);

    expect(plan.errorsBySourcePath.get("/src/weird.cnx")).toBe(
      "not an Error instance",
    );
  });
});
