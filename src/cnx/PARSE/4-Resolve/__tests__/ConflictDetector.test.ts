/**
 * Unit tests for ConflictDetector.
 *
 * Moved from `SymbolTable.test.ts` with #1511, following the derivation they
 * exercise. The table accumulated symbols and answered this question from
 * whatever it held; the detector is handed the symbols instead, so these build
 * three arrays where they used to fill a table. `addTSymbol` appended to a
 * by-name index that `getAllTSymbols` flattened, and the detector re-indexes by
 * name, so push order and grouped order produce the same report -- the move is
 * order-preserving rather than merely order-compatible.
 */
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import { describe, it, expect, beforeEach } from "vitest";
import ConflictDetector from "../ConflictDetector";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import TSymbol from "../../../types/symbols/TSymbol";
import IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import TTypeUtils from "../../../utils/TTypeUtils";
import TCSymbol from "../../../types/symbols/c/TCSymbol";
import TCppSymbol from "../../../types/symbols/cpp/TCppSymbol";
import TestSymbolUtils from "../../3-Declare/cnx/__tests__/testSymbolUtils";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";

const registry = new SymbolRegistry();

describe("ConflictDetector", () => {
  let cnx: TSymbol[];
  let c: TCSymbol[];
  let cpp: TCppSymbol[];

  beforeEach(() => {
    cnx = [];
    c = [];
    cpp = [];
  });

  /**
   * Whether `name` is in conflict, asked through `detect` — the one entry point
   * production uses.
   *
   * A local helper rather than a method on the detector: nothing in production
   * asks about a single name, and a production API reached only from tests is
   * the #1418 shape this card already recorded evidence for. Routing through
   * `detect` also means a break in it reddens these tests; when this wrapped a
   * separate entry point, a mutation to `detect` left 12 of 13 green.
   *
   * Matches either side because a cnx duplicate is reported under its
   * `cnxScopedName` (`Lib.useIt`), not the bare name a caller asks about.
   */
  const hasConflict = (name: string): boolean =>
    ConflictDetector.detect(registry, cnx, c, cpp).some(
      (conflict) =>
        conflict.symbolName === name ||
        conflict.definitions.some((definition) => definition.name === name),
    );

  describe("hasConflict", () => {
    it("should detect cross-language conflicts between cnx and C", () => {
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "conflictFunc",
          scopePath: "",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      c.push({
        kind: "function",
        name: "conflictFunc",
        sourceFile: "test.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "void",
        parameters: [],
      });

      expect(hasConflict("conflictFunc")).toBe(true);
    });

    it("should not detect conflict for C++ function overloads with different signatures", () => {
      cpp.push({
        kind: "function",
        name: "overloaded",
        unqualifiedName: "overloaded",
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        type: "void",
        parameters: [],
      });

      cpp.push({
        kind: "function",
        name: "overloaded",
        unqualifiedName: "overloaded",
        sourceFile: "test.hpp",
        span: TestSourceSpan.at(5),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        type: "void",
        parameters: [
          { name: "x", type: "int", isConst: false, isArray: false },
        ],
      });

      expect(hasConflict("overloaded")).toBe(false);
    });

    // The same symbol declared in both a C header and a C++ header is normally the
    // SAME symbol seen twice, not a conflict. Covered here because extracting
    // detectCnxDuplicate moved this branch, and a moved line is attributed to
    // the mover.
    it("should NOT detect conflict for the same symbol in C and C++ headers", () => {
      c.push({
        kind: "function",
        name: "shared_api",
        sourceFile: "api.h",
        span: TestSourceSpan.at(3),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "int",
        parameters: [],
      });

      cpp.push({
        kind: "function",
        name: "shared_api",
        sourceFile: "api.hpp",
        span: TestSourceSpan.at(4),
        sourceLanguage: ESourceLanguage.Cpp,
        visibility: "public",
        type: "int",
        parameters: [],
      } as unknown as TCppSymbol);

      expect(hasConflict("shared_api")).toBe(false);
    });

    // Issue #1333: a scope may be REOPENED. Two `scope Lib` declarations are the
    // same scope gaining members, not two definitions of one name.
    //
    // The integration fixtures under tests/bugs/issue-1333-scope-reopening/ cover
    // the behavior end-to-end, but they do not feed the coverage metric, so the
    // `continue` implementing this rule measured 0 hits on new code. This is the
    // unit-level seam for it.
    it("should NOT detect conflict for a scope declared twice (reopened)", () => {
      for (const line of [1, 10]) {
        cnx.push({
          ...TestSymbolUtils.base({
            kind: "scope",
            name: "Lib",
            scopePath: "",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(line),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          members: [],
        } as unknown as TSymbol);
      }

      expect(hasConflict("Lib")).toBe(false);
    });

    // The negative control: reopening composes a scope, it does not relax member
    // uniqueness. Two definitions of the same member collide whichever block they
    // were written in, because members group by the scope's own identity.
    it("should STILL detect conflict for a duplicated member of a reopened scope", () => {
      for (const line of [2, 11]) {
        cnx.push({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "count",
            scopePath: "Lib",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(line),
            sourceLanguage: ESourceLanguage.Cnx,
            visibility: "public",
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      expect(hasConflict("count")).toBe(true);
    });

    // Issue #817: Scope-private members should NOT conflict across scopes
    it("should NOT detect conflict for same-named members in different scopes", () => {
      // Create two different named scopes

      // Add 'enabled' variable in scope Foo
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(2),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "private",
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Add 'enabled' variable in scope Bar
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "enabled",
          scopePath: "Bar",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(10),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "private",
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // These are NOT conflicts - they generate Foo_enabled and Bar_enabled
      expect(hasConflict("enabled")).toBe(false);
    });

    // Issue #817: Same-named functions in different scopes are not conflicts
    it("should NOT detect conflict for same-named functions in different scopes", () => {
      // Add 'initialize' function in scope Foo
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "initialize",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(4),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      // Add 'initialize' function in scope Bar
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "initialize",
          scopePath: "Bar",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(12),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("void"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      // These generate Foo_initialize and Bar_initialize - no conflict
      expect(hasConflict("initialize")).toBe(false);
    });

    // True conflicts: same name in same scope should still be detected
    it("should detect conflict for same-named symbols in same scope", () => {
      // Add 'duplicate' variable in scope Foo twice
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(2),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "private",
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "duplicate",
          scopePath: "Foo",
          sourceFile: "test.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "private",
        }),
        type: TTypeUtils.createPrimitive("bool"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Same name in SAME scope IS a conflict
      expect(hasConflict("duplicate")).toBe(true);
    });

    // #1285: the conflict grouping key must be the scope's IDENTITY, not its
    // leaf name. Two distinct scopes can share a leaf, and the #817 tests above
    // cannot see the difference because they use depth-one scopes, where a
    // scope's name and its qualified name are the same string.
    //
    // Nested scopes are unreachable from .cnx source (grammar/Cnx.g4:81-89),
    // so this has to be built through the scope factory. That is the point: the
    // property is real in the symbol model before the grammar admits it.
    it("should NOT detect conflict for members of distinct scopes sharing a leaf name", () => {
      // Outer.Inner.tick and Other.Inner.tick -- different symbols, and they
      // generate different C names, so they do not compete.
      for (const [scopePath, line] of [
        ["Outer.Inner", 2],
        ["Other.Inner", 20],
      ] as const) {
        cnx.push({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scopePath,
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(line),
            visibility: "private",
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      // Keying on the leaf groups both under "Inner:variable" and reports a
      // conflict between symbols that never shared a scope.
      expect(hasConflict("tick")).toBe(false);
    });

    // #1285: the conflict message must name the symbol the way the author wrote
    // it. Nothing asserted this, so dropping the scope from the message entirely
    // left the whole suite green.
    it("names a conflicting symbol by its full source path", () => {
      for (const line of [2, 5]) {
        cnx.push({
          ...TestSymbolUtils.base({
            kind: "variable",
            name: "tick",
            scopePath: "Outer.Inner",
            sourceFile: "test.cnx",
            span: TestSourceSpan.at(line),
            visibility: "private",
          }),
          type: TTypeUtils.createPrimitive("u32"),
          isArray: false,
          isConst: false,
          isAtomic: false,
          isVolatile: false,
          overflowBehavior: "clamp",
        });
      }

      const conflicts = ConflictDetector.detect(registry, cnx, c, cpp);

      expect(conflicts).toHaveLength(1);
      // Not "tick" (no scope at all) and not "Inner.tick" (the leaf only, which
      // is what building this by hand from scope.name produced).
      expect(conflicts[0].symbolName).toBe("Outer.Inner.tick");
    });

    // Global scope conflicts should still be detected
    it("should detect conflict for same-named globals", () => {
      // Add two global variables with same name
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scopePath: "",
          sourceFile: "first.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      cnx.push({
        ...TestSymbolUtils.base({
          kind: "variable",
          name: "globalVar",
          scopePath: "",
          sourceFile: "second.cnx",
          span: TestSourceSpan.at(1),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        type: TTypeUtils.createPrimitive("u32"),
        isArray: false,
        isConst: false,
        isAtomic: false,
        isVolatile: false,
        overflowBehavior: "clamp",
      });

      // Two globals with same name IS a conflict
      expect(hasConflict("globalVar")).toBe(true);
    });

    // Issue #967: Scoped cnx symbols live in a namespace and don't conflict
    // with C's global symbols. Only global-scope cnx symbols can conflict.
    it("should NOT detect conflict for scoped cnx method vs C function with same bare name", () => {
      // Add cnx scoped function 'read' in scope 'Touch'
      // This transpiles to Touch_read()
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scopePath: "Touch",
          sourceFile: "touch.cnx",
          span: TestSourceSpan.at(28),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("u8"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      // Add C function 'read' from POSIX headers
      // This stays as read()
      c.push({
        kind: "function",
        name: "read",
        sourceFile: "lv_pthread.h",
        span: TestSourceSpan.at(80),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "ssize_t",
        parameters: [
          { name: "fd", type: "int", isConst: false, isArray: false },
          { name: "buf", type: "void*", isConst: false, isArray: false },
          { name: "count", type: "size_t", isConst: false, isArray: false },
        ],
      });

      // Touch.read() is in a namespace — does NOT conflict with C's global read()
      expect(hasConflict("read")).toBe(false);
    });

    // Issue #967: Global cnx functions SHOULD still conflict with C functions
    it("should detect conflict for global cnx function vs C function", () => {
      // Add global cnx function 'read'
      cnx.push({
        ...TestSymbolUtils.base({
          kind: "function",
          name: "read",
          scopePath: "",
          sourceFile: "utils.cnx",
          span: TestSourceSpan.at(5),
          sourceLanguage: ESourceLanguage.Cnx,
          visibility: "public",
        }),
        returnType: TTypeUtils.createPrimitive("u8"),
        returnOverflowBehavior: "clamp",
        parameters: [],
        visibility: "public",
      } as IFunctionSymbol);

      // Add C function 'read'
      c.push({
        kind: "function",
        name: "read",
        sourceFile: "unistd.h",
        span: TestSourceSpan.at(100),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "ssize_t",
        parameters: [],
      });

      // Global cnx read() DOES conflict with C's read()
      expect(hasConflict("read")).toBe(true);
    });
  });
});
