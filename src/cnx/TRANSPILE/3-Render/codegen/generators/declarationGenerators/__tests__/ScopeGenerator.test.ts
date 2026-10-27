/**
 * Unit tests for ScopeGenerator - ADR-016 Scope Declaration Generation
 *
 * #1445 box 3: this file was ~540 lines of hand-built fake parse nodes --
 * `createMockVisibility`, `createMockArrayType`, `createMockScopeMember` and a
 * dozen more -- before 43 tests, with 12 casts to make TypeScript accept them.
 * The generator takes a plan now, so the builders are plan literals.
 *
 * The split is deliberate: what is asserted HERE is what the generator decides
 * from a rendered type string -- the callback typedef substitution, the opaque
 * pointer, which prefixes go in which order, the order it calls the
 * orchestrator in. What the PLANNER decides from a declaration -- whether a
 * private const scalar is skipped, whether the header already defines a type,
 * which of four kinds a member is -- is asserted in
 * `CodeGenerator.coverage.test.ts`, against real source, because that is the
 * input those decisions are actually made from.
 */

import TestSymbolTable from "../../../../../__tests__/TestSymbolTable";
import { describe, it, expect, vi, beforeEach } from "vitest";
import generateScope from "../ScopeGenerator";
import IGeneratorInput from "../../IGeneratorInput";
import IGeneratorState from "../../IGeneratorState";
import IOrchestrator from "../../IOrchestrator";
import IPlannedScope from "../../../types/IPlannedScope";
import TPlannedScopeMember from "../../../types/TPlannedScopeMember";
import TPlannedScopeVariable from "../../../types/TPlannedScopeVariable";
import TestGeneratorState from "../../__tests__/testGeneratorState";
import AdrProvenance from "../../../../../../instrumentation/AdrProvenance";
import TranspileState from "../../../../../TranspileState";
import createMockSymbols from "../../../../../../types/__testUtils__/codeGenSymbolsHelpers";

/**
 * A stub that answers only what it was given and throws for anything else, so
 * "the generator touches exactly these" is an assertion rather than a comment.
 */
function strictStub<T extends object>(provided: Record<string, unknown>): T {
  return new Proxy(provided, {
    get(target, prop) {
      if (typeof prop === "symbol" || prop === "then") {
        return undefined;
      }
      if (prop in target) {
        return target[prop as string];
      }
      throw new Error(`ScopeGenerator must not read .${String(prop)}`);
    },
  }) as T;
}

const STATE: IGeneratorState = TestGeneratorState.create({});

function createMockInput(withSymbols = false): IGeneratorInput {
  return strictStub<IGeneratorInput>({
    symbols: withSymbols
      ? createMockSymbols({
          enumMembers: new Map([["Driver__EState", new Map([["IDLE", 0]])]]),
          memberCNames: new Map([
            ["Driver__EState", new Map([["IDLE", "Driver__EState__IDLE"]])],
          ]),
          structFields: new Map([
            ["Driver__Config", new Map([["timeout", "u32"]])],
          ]),
        })
      : null,
  });
}

function createMockOrchestrator(options?: {
  callbackTypedef?: string | null;
}): IOrchestrator {
  return strictStub<IOrchestrator>({
    state,
    setCurrentScope: vi.fn(),
    getCallbackTypedefName: vi.fn(() => options?.callbackTypedef ?? null),
    enterFunctionContext: vi.fn(),
    movedParameterComments: vi.fn(() => ""),
    exitFunctionContext: vi.fn(),
    recordCallbackTypedef: vi.fn(),
    applyEffects: vi.fn(),
  });
}

function regular(
  overrides: Partial<Extract<TPlannedScopeVariable, { kind: "regular" }>> = {},
): TPlannedScopeVariable {
  return {
    kind: "regular",
    fullName: "Driver__counter",
    isPrivate: false,
    isConst: false,
    isArray: false,
    isPointer: false,
    declarationLine: 3,
    atomic: "",
    volatile: "",
    renderType: () => "uint32_t",
    renderArrayTypeDimensions: () => "",
    renderCStyleDimensions: null,
    renderStringCapacityDimension: () => "",
    renderInitializer: () => " = 0",
    note: "",
    ...overrides,
  };
}

function member(
  overrides: Partial<TPlannedScopeMember> = {},
): TPlannedScopeMember {
  return {
    kind: "variable",
    adrLine: 3,
    variable: regular(),
    ...overrides,
  } as TPlannedScopeMember;
}

function scope(overrides: Partial<IPlannedScope> = {}): IPlannedScope {
  return {
    name: "Driver",
    declaringScopePath: "Driver",
    typeDefinitions: [],
    members: [],
    ...overrides,
  };
}

/** The declaration lines of a scope's rendered output, blank lines dropped. */
function declarationsOf(code: string): string[] {
  return code.split("\n").filter((line) => line.trim() !== "");
}

let state = new TranspileState();

describe("ScopeGenerator", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  beforeEach(() => {
    AdrProvenance.reset();
    // `record` silently ignores a call with no current file, so the provenance
    // assertions below would pass on an empty list without this.
    AdrProvenance.beginFile("test.cnx");
  });

  describe("basic scope structure", () => {
    it("emits the scope comment and enters then clears the scope", () => {
      const orchestrator = createMockOrchestrator();

      const result = generateScope(
        scope(),
        createMockInput(),
        STATE,
        orchestrator,
      );

      expect(result.code).toContain("/* Scope: Driver */");
      expect(orchestrator.setCurrentScope).toHaveBeenNthCalledWith(1, "Driver");
      expect(orchestrator.setCurrentScope).toHaveBeenNthCalledWith(2, null);
      expect(result.effects).toEqual([]);
    });

    it("emits no type-definition section when the plan names none", () => {
      const result = generateScope(
        scope({ typeDefinitions: [] }),
        createMockInput(true),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toEqual(["/* Scope: Driver */"]);
    });

    it("emits no type definitions when the file has no symbol info", () => {
      const result = generateScope(
        scope({ typeDefinitions: [{ kind: "enum", cName: "Driver__EState" }] }),
        createMockInput(false),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toEqual(["/* Scope: Driver */"]);
    });
  });

  // #1241: ADR-016 fires once per MEMBER. Every member records, including the
  // ones nothing is emitted for -- dropping those would silently un-occupy a
  // cell in the generated scope-context matrix, which no test compares against
  // a previous run.
  describe("ADR-016 provenance", () => {
    it("records one site per member, at the member's own line", () => {
      generateScope(
        scope({
          members: [
            member({ adrLine: 3 }),
            member({ kind: "other", adrLine: 7 } as TPlannedScopeMember),
            member({
              kind: "variable",
              adrLine: 11,
              variable: { kind: "skipped" },
            } as TPlannedScopeMember),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      const lines = AdrProvenance.collect()
        .filter((site) => site.adr === "016")
        .map((site) => site.line);
      expect(lines).toEqual([3, 7, 11]);
    });
  });

  describe("variable declarations", () => {
    it("emits a public variable with no static prefix", () => {
      const result = generateScope(
        scope({ members: [member()] }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "uint32_t Driver__counter = 0;",
      );
    });

    it("emits a private variable as static", () => {
      const result = generateScope(
        scope({
          members: [member({ variable: regular({ isPrivate: true }) })],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "static uint32_t Driver__counter = 0;",
      );
    });

    it.each([
      ["atomic", { atomic: "volatile " }],
      ["volatile", { volatile: "volatile " }],
    ])("carries the %s modifier before the type (Issue #998)", (_l, mods) => {
      const result = generateScope(
        scope({ members: [member({ variable: regular(mods) })] }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "volatile uint32_t Driver__counter = 0;",
      );
    });

    it("orders the prefixes static, volatile, const", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({
                isPrivate: true,
                isConst: true,
                atomic: "volatile ",
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "static volatile const uint32_t Driver__counter = 0;",
      );
    });

    it("emits nothing at all for a skipped variable (Issue #282)", () => {
      const result = generateScope(
        scope({
          members: [member({ variable: { kind: "skipped" } })],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toEqual(["/* Scope: Driver */"]);
    });

    it("appends array-type, C-style and string-capacity dimensions in order", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({
                isArray: true,
                renderArrayTypeDimensions: () => "[4]",
                renderCStyleDimensions: () => "[2]",
                renderStringCapacityDimension: () => "[33]",
                renderInitializer: () => " = {0}",
                note: "",
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "uint32_t Driver__counter[4][2][33] = {0};",
      );
    });

    it("omits the C-style dimensions the plan says are absent", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({ renderCStyleDimensions: null }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code).not.toContain("[");
    });

    // Issue #1200: without this the raw function name was emitted as the type,
    // colliding with the function of the same name.
    it("renders a callback-typed member as its _fp typedef", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({ renderType: () => "onTick" }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator({ callbackTypedef: "onTick_fp" }),
      );

      expect(declarationsOf(result.code)).toContain(
        "onTick_fp Driver__counter = 0;",
      );
    });

    it("leaves a non-callback type untouched", () => {
      const result = generateScope(
        scope({ members: [member()] }),
        createMockInput(),
        STATE,
        createMockOrchestrator({ callbackTypedef: null }),
      );

      expect(declarationsOf(result.code)).toContain(
        "uint32_t Driver__counter = 0;",
      );
    });

    // Issues #948 and #958: a handle is declared as a pointer. #1610: the `*`
    // follows the plan's `isPointer`, the declaration's `DeclaredPointer`
    // answer, which 2.2's null initializer is planned from too
    it("writes the `*` of a member the plan declares as a pointer", () => {
      const orchestrator = createMockOrchestrator();

      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({
                renderType: () => "Handle",
                isPointer: true,
                renderInitializer: () => " = NULL",
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        orchestrator,
      );

      expect(declarationsOf(result.code)).toContain(
        "Handle* Driver__counter = NULL;",
      );
    });

    // The control: a type C already spells as a pointer (ADR-046's `cstring`)
    // gains no second `*`
    it("writes no second `*` for a type that is already a pointer", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({
                renderType: () => "char*",
                isPointer: true,
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "char* Driver__counter = 0;",
      );
      expect(
        AdrProvenance.collect().filter((site) => site.adr === "030"),
      ).toEqual([]);
    });

    // Issue #996: an array of handles is an array of pointers; which zero it
    // takes is 2.2's (`nullInitialized` holds no array)
    it("writes the `*` of each element of an array of handles", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({
                isArray: true,
                isPointer: true,
                renderType: () => "Handle",
                renderArrayTypeDimensions: () => "[4]",
                renderInitializer: () => " = {0}",
                note: "",
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(
        "Handle* Driver__counter[4] = {0};",
      );
    });

    it("records ADR-030 at the declaration's line for an opaque handle", () => {
      generateScope(
        scope({
          members: [
            member({
              variable: regular({
                declarationLine: 42,
                renderType: () => "Handle",
                isPointer: true,
              }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(
        AdrProvenance.collect()
          .filter((site) => site.adr === "030")
          .map((site) => site.line),
      ).toEqual([42]);
    });

    it("records no ADR-030 site for a complete type", () => {
      // The control: a type with a body is not a handle, so it is declared as
      // its value and the matrix is credited with nothing
      generateScope(
        scope({
          members: [
            member({ variable: regular({ renderType: () => "Handle" }) }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(
        AdrProvenance.collect().filter((site) => site.adr === "030"),
      ).toEqual([]);
    });
  });

  describe("constructor syntax (Issue #375)", () => {
    it.each([
      ["public", false, "Motor Driver__m(Driver__a, Driver__b);"],
      ["private", true, "static Motor Driver__m(Driver__a, Driver__b);"],
    ])("emits a %s constructor declaration", (_l, isPrivate, expected) => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: {
                kind: "constructor",
                fullName: "Driver__m",
                isPrivate,
                args: ["Driver__a", "Driver__b"],
                renderType: () => "Motor",
              },
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(expected);
    });
  });

  describe("function declarations", () => {
    function functionMember(
      isPrivate = false,
    ): Extract<TPlannedScopeMember, { kind: "function" }> {
      return {
        kind: "function",
        adrLine: 5,
        fullName: "Driver__init",
        isPrivate,
        renderReturnType: () => "void",
        planParameters: () => null,
        renderBody: () => "{ }",
        renderParameterList: () => "void",
      };
    }

    it.each([
      ["public", false, "void Driver__init(void) { }"],
      ["private", true, "static void Driver__init(void) { }"],
    ])("emits a %s function", (_l, isPrivate, expected) => {
      const result = generateScope(
        scope({ members: [functionMember(isPrivate)] }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toContain(expected);
    });

    // Issue #281: the body renders FIRST so parameter modifications are tracked,
    // then auto-const is applied, then the parameter list is rendered from it.
    it("renders the body before the parameter list, with auto-const between", () => {
      const orchestrator = createMockOrchestrator();
      const order: string[] = [];
      const note = (label: string, value: string) => () => {
        order.push(label);
        return value;
      };

      generateScope(
        scope({
          members: [
            {
              ...functionMember(),
              renderReturnType: note("returnType", "void"),
              renderBody: note("body", "{ }"),
              renderParameterList: note("params", "void"),
            },
          ],
        }),
        createMockInput(),
        STATE,
        orchestrator,
      );

      expect(order).toEqual(["returnType", "body", "params"]);
      expect(orchestrator.enterFunctionContext).toHaveBeenCalledWith(
        "Driver__init",
        null,
      );
      expect(orchestrator.exitFunctionContext).toHaveBeenCalledTimes(1);
      expect(orchestrator.recordCallbackTypedef).toHaveBeenCalledWith(
        "Driver__init",
      );
    });

    it("hands the planned parameters to enterFunctionContext", () => {
      const orchestrator = createMockOrchestrator();
      const parameters = [{ name: "n" }] as never;

      generateScope(
        scope({
          members: [{ ...functionMember(), planParameters: () => parameters }],
        }),
        createMockInput(),
        STATE,
        orchestrator,
      );

      expect(orchestrator.enterFunctionContext).toHaveBeenCalledWith(
        "Driver__init",
        parameters,
      );
    });
  });

  describe("type definitions (#1300)", () => {
    it("emits each planned definition through its kind's emitter, in plan order", () => {
      const symbolTable = TestSymbolTable.of(state);
      const result = generateScope(
        scope({
          typeDefinitions: [
            { kind: "enum", cName: "Driver__EState" },
            { kind: "struct", cName: "Driver__Config" },
          ],
        }),
        createMockInput(true),
        STATE,
        createMockOrchestrator(),
      );

      const enumAt = result.code.indexOf("Driver__EState");
      const structAt = result.code.indexOf("Driver__Config");
      expect(enumAt).toBeGreaterThan(-1);
      expect(structAt).toBeGreaterThan(-1);
      expect(enumAt).toBeLessThan(structAt);
      // The generator reads the table off TranspileState rather than the plan.
      expect(state.symbolTable).toBe(symbolTable);
    });
  });

  describe("members that emit nothing", () => {
    it("contributes no lines for an `other` member", () => {
      const result = generateScope(
        scope({
          members: [
            member({ kind: "other", adrLine: 2 } as TPlannedScopeMember),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(declarationsOf(result.code)).toEqual(["/* Scope: Driver */"]);
    });
  });

  describe("multiple members", () => {
    it("emits members in plan order", () => {
      const result = generateScope(
        scope({
          members: [
            member({
              variable: regular({ fullName: "Driver__first" }),
            }),
            member({
              variable: regular({ fullName: "Driver__second" }),
            }),
          ],
        }),
        createMockInput(),
        STATE,
        createMockOrchestrator(),
      );

      expect(result.code.indexOf("Driver__first")).toBeLessThan(
        result.code.indexOf("Driver__second"),
      );
    });
  });
});
