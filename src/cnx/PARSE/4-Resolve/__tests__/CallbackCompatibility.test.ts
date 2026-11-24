/**
 * ADR-029 callback recognition (#895, #1544), decided by 1.4 over what 1.3
 * recorded (#1825).
 *
 * Each case runs the real 1.3 resolver, so the uses `CallbackUseCollector`
 * records and the rule `CallbackCompatibility` applies are tested together, as
 * production runs them.
 */
import ProgramLowering from "../../2-Parse/ProgramLowering";
import { describe, it, expect } from "vitest";
import CnxSourceParser from "../../2-Parse/CnxSourceParser";
import CnxResolver from "../../3-Declare/cnx/index";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import SymbolTable from "../../3-Declare/SymbolTable";
import CallbackCompatibility from "../CallbackCompatibility";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";

/** The callbacks one program uses, its files given in declaration order. */
function callbacksIn(
  sources: ReadonlyArray<string>,
  symbolTable: SymbolTable,
): ReadonlyMap<string, string> {
  const registry = new SymbolRegistry();
  const files = sources.map((source, index) =>
    CnxResolver.resolve(
      ProgramLowering.program(CnxSourceParser.parse(source).tree, null),
      `file${index}.cnx`,
      registry,
    ),
  );
  return CallbackCompatibility.derive(files, () => symbolTable);
}

/** A C typedef, of a function pointer or not. */
function addCTypedef(symbolTable: SymbolTable, name: string, type: string) {
  symbolTable.addCSymbol({
    name,
    kind: "type",
    sourceLanguage: ESourceLanguage.C,
    sourceFile: "callback_types.h",
    span: TestSourceSpan.at(1),
    visibility: "public",
    type,
  });
}

/**
 * Issue #895: `widget_set_flush_cb`, whose second parameter is a function
 * pointer typedef.
 */
function addWidgetCallbackSymbols(symbolTable: SymbolTable): void {
  symbolTable.addCSymbol({
    name: "widget_set_flush_cb",
    kind: "function",
    sourceLanguage: ESourceLanguage.C,
    sourceFile: "widget.h",
    span: TestSourceSpan.at(1),
    visibility: "public",
    type: "void",
    parameters: [
      { name: "w", type: "widget_t*", isConst: false, isArray: false },
      { name: "cb", type: "flush_cb_t", isConst: false, isArray: false },
    ],
  });
  addCTypedef(
    symbolTable,
    "flush_cb_t",
    "void (*)(widget_t*, const rect_t*, uint8_t*)",
  );
}

/** A table declaring `PointCallback`, a function pointer typedef. */
function pointCallbackTable(): SymbolTable {
  const symbolTable = new SymbolTable();
  addCTypedef(symbolTable, "PointCallback", "void (*)(uint32_t)");
  return symbolTable;
}

describe("CallbackCompatibility", () => {
  it("recognizes a function assigned to a C function pointer typedef", () => {
    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
        void main() {
          PointCallback cb <- my_handler;
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.get("my_handler")).toBe("PointCallback");
  });

  it("does not recognize one assigned to a typedef of a plain value", () => {
    const symbolTable = new SymbolTable();
    addCTypedef(symbolTable, "MyType", "uint32_t");

    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
        void main() {
          MyType cb <- my_handler;
        }
      `,
      ],
      symbolTable,
    );

    expect(callbacks.has("my_handler")).toBe(false);
  });

  it("does not recognize a call as a reference to the function called", () => {
    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
        void main() {
          u32 result <- my_handler(5);
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.has("my_handler")).toBe(false);
  });

  it("does not recognize a name no file declares as a function", () => {
    // The negative control for #1544's program-wide set: the typedef gate
    // passes, and the name is a variable.
    const callbacks = callbacksIn(
      [
        `
        u32 not_a_function <- 0;
        void main() {
          PointCallback cb <- not_a_function;
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.has("not_a_function")).toBe(false);
  });

  it.each([
    [
      "if",
      `u32 flag <- 1;
          if (flag = 1) {
            PointCallback cb <- my_handler;
          }`,
    ],
    [
      "else",
      `u32 flag <- 0;
          if (flag = 1) {
            u32 x <- 1;
          } else {
            PointCallback cb <- my_handler;
          }`,
    ],
    [
      "while",
      `u32 running <- 1;
          while (running = 1) {
            PointCallback cb <- my_handler;
            running <- 0;
          }`,
    ],
    [
      "for",
      `for (u32 i <- 0; i < 1; i <- i + 1) {
            PointCallback cb <- my_handler;
          }`,
    ],
  ])("finds the assignment inside a %s block", (_kind, body) => {
    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
        void main() {
          ${body}
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.get("my_handler")).toBe("PointCallback");
  });

  it("keys a scope-qualified function by its transpiled C name", () => {
    const callbacks = callbacksIn(
      [
        `
        scope Handlers {
          public void on_point(u32 x) {
            u32 y <- x;
          }
        }
        void main() {
          PointCallback cb <- Handlers.on_point;
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.get("Handlers__on_point")).toBe("PointCallback");
  });

  it("recognizes a function passed to a C function pointer parameter (Issue #895)", () => {
    const symbolTable = new SymbolTable();
    addWidgetCallbackSymbols(symbolTable);

    const callbacks = callbacksIn(
      [
        `
        void my_flush(u32 w) {
          u32 x <- w;
        }
        void main() {
          u32 w <- 0;
          global.widget_set_flush_cb(w, my_flush);
        }
      `,
      ],
      symbolTable,
    );

    expect(callbacks.get("my_flush")).toBe("flush_cb_t");
    // The argument in the first position is not a callback position.
    expect(callbacks.has("w")).toBe(false);
  });

  it("resolves this.member to the enclosing scope (Issue #895 Bug A)", () => {
    const symbolTable = new SymbolTable();
    addWidgetCallbackSymbols(symbolTable);

    const callbacks = callbacksIn(
      [
        `
        scope ScopeAP {
          public void cb(u32 w) {
            u32 x <- w;
          }

          public void register_it() {
            u32 w <- 0;
            global.widget_set_flush_cb(w, this.cb);
          }
        }
      `,
      ],
      symbolTable,
    );

    expect(callbacks.get("ScopeAP__cb")).toBe("flush_cb_t");
  });

  it("resolves global.Scope.member (Issue #895 Bug A)", () => {
    const symbolTable = new SymbolTable();
    addWidgetCallbackSymbols(symbolTable);

    const callbacks = callbacksIn(
      [
        `
        scope ScopeAP {
          public void cb(u32 w) {
            u32 x <- w;
          }
        }

        void register_from_global() {
          u32 w <- 0;
          global.widget_set_flush_cb(w, global.ScopeAP.cb);
        }
      `,
      ],
      symbolTable,
    );

    expect(callbacks.get("ScopeAP__cb")).toBe("flush_cb_t");
  });

  it("recognizes a function wired in a file other than the one declaring it (#1544)", () => {
    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
      `,
        `
        void main() {
          PointCallback cb <- my_handler;
        }
      `,
      ],
      pointCallbackTable(),
    );

    expect(callbacks.get("my_handler")).toBe("PointCallback");
  });

  it("lets a later use of a function win the typedef an earlier one recorded", () => {
    const symbolTable = pointCallbackTable();
    addCTypedef(symbolTable, "OtherCallback", "void (*)(uint32_t)");

    const callbacks = callbacksIn(
      [
        `
        void my_handler(u32 x) {
          u32 y <- x;
        }
        void first() {
          PointCallback a <- my_handler;
        }
      `,
        `
        void second() {
          OtherCallback b <- my_handler;
        }
      `,
      ],
      symbolTable,
    );

    expect(callbacks.get("my_handler")).toBe("OtherCallback");
  });
});
