import { describe, it, expect } from "vitest";
import ScopeUtils from "../ScopeUtils";

describe("IScopeSymbol", () => {
  describe("createGlobalScope", () => {
    it("creates the global scope with an empty name and empty path", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(global.kind).toBe("scope");
      expect(global.name).toBe("");
      expect(global.scopePath).toBe("");
      expect(global.functions).toEqual([]);
      expect(global.variables).toEqual([]);
    });

    it("does not reference itself (#1298)", () => {
      // The self-reference is what made the symbol graph cyclic. Asserted as an
      // absence rather than as "the guard catches it": a guard that catches a
      // cycle is evidence the shape still admits one.
      const global = ScopeUtils.createGlobalScope();
      expect(Object.values(global)).not.toContain(global);
    });

    it("computes its identity through the same encoder as every other symbol", () => {
      const global = ScopeUtils.createGlobalScope();
      expect(global.fullyQualifiedCName).toBe("");
      expect(global.cnxScopedName).toBe("");
    });
  });

  describe("createScope", () => {
    it("creates a named scope carrying its enclosing path", () => {
      const test = ScopeUtils.createScope("Test", "");
      expect(test.kind).toBe("scope");
      expect(test.name).toBe("Test");
      expect(test.scopePath).toBe("");
      expect(ScopeUtils.pathOf(test)).toBe("Test");
    });

    it("supports nested scopes", () => {
      const outer = ScopeUtils.createScope("Outer", "");
      const inner = ScopeUtils.createScope("Inner", ScopeUtils.pathOf(outer));
      expect(inner.scopePath).toBe("Outer");
      expect(ScopeUtils.pathOf(inner)).toBe("Outer.Inner");
      expect(inner.fullyQualifiedCName).toBe("Outer__Inner");
    });

    it("initializes empty functions and variables arrays", () => {
      const scope = ScopeUtils.createScope("Test", "");
      expect(scope.functions).toEqual([]);
      expect(scope.variables).toEqual([]);
    });
  });

  describe("isGlobalScope", () => {
    it("returns true for global scope", () => {
      expect(ScopeUtils.isGlobalScope(ScopeUtils.createGlobalScope())).toBe(
        true,
      );
    });

    it("returns false for named scope", () => {
      expect(ScopeUtils.isGlobalScope(ScopeUtils.createScope("Test", ""))).toBe(
        false,
      );
    });
  });

  describe("isGlobalScopePath", () => {
    it("reads the empty path as file scope", () => {
      expect(ScopeUtils.isGlobalScopePath("")).toBe(true);
      expect(ScopeUtils.isGlobalScopePath("Test")).toBe(false);
      expect(ScopeUtils.isGlobalScopePath("Outer.Inner")).toBe(false);
    });
  });

  describe("leafOf / parentOf", () => {
    it("splits a path into its leaf and its enclosing path", () => {
      expect(ScopeUtils.leafOf("Outer.Inner")).toBe("Inner");
      expect(ScopeUtils.parentOf("Outer.Inner")).toBe("Outer");
      expect(ScopeUtils.leafOf("Motor")).toBe("Motor");
      expect(ScopeUtils.parentOf("Motor")).toBe("");
      expect(ScopeUtils.leafOf("")).toBe("");
      expect(ScopeUtils.parentOf("")).toBe("");
    });
  });

  describe("no scope cycle is representable (#1298)", () => {
    // These replace the "getScopePath cycle detection" suite. That suite proved
    // a guard fired on a hand-built cycle; the guard was identity-based, so it
    // could not fire on a proxy chain -- and the hang it existed to prevent was
    // reachable with the suite green. There is now nothing to guard: a scope
    // names its container with a string, and a string cannot point back.

    it("a scope reaches its whole path without walking anything", () => {
      const leaf = ScopeUtils.createScope("Leaf", "Outer.Inner");
      expect(ScopeUtils.pathOf(leaf)).toBe("Outer.Inner.Leaf");
      expect(leaf.fullyQualifiedCName).toBe("Outer__Inner__Leaf");
    });

    it("carries no field that could hold another scope", () => {
      // The structural claim the two deleted tests were approximating. A scope
      // whose every value is a string, number, boolean or empty collection
      // cannot participate in a cycle, whatever a caller does to it.
      const scope = ScopeUtils.createScope("Motor", "");
      for (const value of Object.values(scope)) {
        if (Array.isArray(value)) {
          expect(value).toEqual([]);
          continue;
        }
        if (value instanceof Map || value instanceof Set) {
          expect(value.size).toBe(0);
          continue;
        }
        if (typeof value === "object" && value !== null) {
          // #1318: a span is the one object a scope carries, and it is admitted
          // by SHAPE rather than by name -- every own value must be a number.
          // Widening this to `typeof value === "object"` would have retired the
          // guard instead of extending it: a parent-scope reference is an object
          // too, and would have passed silently. A scope holds strings, arrays
          // and Maps, so it still fails here.
          expect(Object.values(value).every((v) => typeof v === "number")).toBe(
            true,
          );
          continue;
        }
        expect(["string", "number", "boolean"]).toContain(typeof value);
      }
    });

    it("a self-named path is inert rather than non-terminating", () => {
      // The shape the old suite hand-built as `cyclic.parent = cyclic`. Naming
      // yourself as your own container is now just an odd string: it produces an
      // odd name and terminates, instead of hanging the transpile.
      const odd = ScopeUtils.createScope("Loop", "Loop");
      expect(ScopeUtils.pathOf(odd)).toBe("Loop.Loop");
      expect(odd.fullyQualifiedCName).toBe("Loop__Loop");
    });
  });

  describe("getDefaultVisibility", () => {
    it("returns 'public' for functions (API surface)", () => {
      expect(ScopeUtils.getDefaultVisibility(true)).toBe("public");
    });

    it("returns 'private' for non-functions (internal state)", () => {
      expect(ScopeUtils.getDefaultVisibility(false)).toBe("private");
    });
  });

  describe("getTranspiledCName", () => {
    it("returns the bare name for a global symbol", () => {
      expect(
        ScopeUtils.getTranspiledCName({ name: "main", scopePath: "" }),
      ).toBe("main");
    });

    it("returns a scope-prefixed name for a scoped symbol", () => {
      expect(
        ScopeUtils.getTranspiledCName({ name: "fillData", scopePath: "Test" }),
      ).toBe("Test__fillData");
    });

    it("keeps every outer component for a nested scope", () => {
      // Regression guard: reading scope.name alone yields "Inner__process" and
      // drops the outer scope. Two encoders disagreed exactly here, and agreed
      // elsewhere only because the grammar admits no nested scopes today.
      expect(
        ScopeUtils.getTranspiledCName({
          name: "process",
          scopePath: "Outer.Inner",
        }),
      ).toBe("Outer__Inner__process");
    });
  });

  describe("identityOf (#1285)", () => {
    it("gives a global symbol its bare name in both namespaces", () => {
      expect(ScopeUtils.identityOf({ name: "counter", scopePath: "" })).toEqual(
        {
          fullyQualifiedCName: "counter",
          cnxScopedName: "counter",
        },
      );
    });

    it("qualifies a scope member in both namespaces", () => {
      expect(
        ScopeUtils.identityOf({ name: "init", scopePath: "Motor" }),
      ).toEqual({
        fullyQualifiedCName: "Motor__init",
        cnxScopedName: "Motor.init",
      });
    });

    it("keeps every outer component at depth 2", () => {
      // The property this whole change exists to establish. Reading `scope.name`
      // alone yields "Inner__tick"/"Inner.tick" and drops the outer scope --
      // which is what the leaf-only encoders did, agreeing with the chain-walking
      // one only because the grammar admits no nested scopes today.
      //
      // Nested scopes are unreachable from .cnx source (grammar/Cnx.g4:81-89),
      // so this unit test is the ONLY thing that can hold the property. It must
      // not be deleted as "testing an impossible case".

      expect(
        ScopeUtils.identityOf({ name: "tick", scopePath: "Outer.Inner" }),
      ).toEqual({
        fullyQualifiedCName: "Outer__Inner__tick",
        cnxScopedName: "Outer.Inner.tick",
      });
    });

    it("gives a nested scope its own identity from its enclosing path", () => {
      const outer = ScopeUtils.createScope("Outer", "");
      const leaf = ScopeUtils.createScope("Leaf", "Outer.Inner");

      // Depth THREE on purpose. At depth two a scope's leaf name happens to be
      // its whole path, so a leaf-only encoder is accidentally right and a
      // depth-two assertion here cannot fail. Verified: mutating the encoder to
      // join only the leaf leaves `outer` correct and breaks only `leaf`.
      expect(leaf.fullyQualifiedCName).toBe("Outer__Inner__Leaf");
      expect(leaf.cnxScopedName).toBe("Outer.Inner.Leaf");
      expect(outer.fullyQualifiedCName).toBe("Outer");
    });

    it("gives the global scope an empty identity", () => {
      // Computed through the same encoder as every other symbol rather than
      // hardcoded -- the global scope must not become the one symbol whose
      // identity was derived a second way. #1298 removed the self-references it
      // used to need patching in first.
      const global = ScopeUtils.createGlobalScope();

      expect(global.fullyQualifiedCName).toBe("");
      expect(global.cnxScopedName).toBe("");
    });

    it("qualifyInScope keeps every outer component at depth 2", () => {
      // The drop-in for `QualifiedCName.fromSourceName([currentScopeName, name])`. The
      // string version produced "Inner__tick" here, dropping `Outer`.

      expect(ScopeUtils.qualifyInScope("tick", "Outer.Inner")).toBe(
        "Outer__Inner__tick",
      );
    });

    it("qualifyInScope leaves a name alone at file scope", () => {
      // A global symbol keeps its bare name, which is what makes `global.x`
      // reachable at all. #1298 collapsed the two former spellings of "no scope"
      // (`null` and the global scope object) into the empty path, so the second
      // case is now a real one rather than a repeat of the first.
      expect(ScopeUtils.qualifyInScope("tick", "")).toBe("tick");
      expect(ScopeUtils.qualifyInScope("tick", "Motor")).toBe("Motor__tick");
    });

    it("qualifyScopeType asks about the CHAIN-qualified name", () => {
      const asked: string[] = [];
      const known = new Set(["Outer__Inner__Config"]);

      const result = ScopeUtils.qualifyScopeType(
        "Config",
        "Outer.Inner",
        (q) => {
          asked.push(q);
          return known.has(q);
        },
      );

      // The leaf-only version asked about "Inner__Config", got no, and fell
      // through to the bare name -- the #1200 failure shape.
      expect(asked).toEqual(["Outer__Inner__Config"]);
      expect(result).toBe("Outer__Inner__Config");
    });

    it("qualifyScopeType falls through to the bare name when unknown", () => {
      // Negative control: a scope member that is NOT a type must not capture
      // the name, so a global type of the same name stays reachable.
      expect(ScopeUtils.qualifyScopeType("Config", "Motor", () => false)).toBe(
        "Config",
      );
    });

    it("qualifyScopeType does not qualify when a DIFFERENT scope declares the type", () => {
      // Ported from the deleted QualifiedCName.qualifyScopeType suite. Being
      // inside scope Z does not let you reach A's type by its bare name.
      const known = new Set(["A__B"]);

      expect(ScopeUtils.qualifyScopeType("B", "Z", (q) => known.has(q))).toBe(
        "B",
      );
    });

    it("keeps the two namespaces distinct but describing the same path", () => {
      // `Outer.Inner.tick` is not derivable from `Outer__Inner__tick` at a call
      // site without knowing which one it already holds, which is why both are
      // stored rather than one being converted into the other on demand.
      //
      // They must still describe the SAME path. This is the cross-check that
      // catches one namespace being computed a different way from the other:
      // under a leaf-only C encoder the names come back as `Inner__tick` and
      // `Outer.Inner.tick`, which disagree about how deep the symbol sits.
      const identity = ScopeUtils.identityOf({
        name: "tick",
        scopePath: "Outer.Inner",
      });

      expect(identity.fullyQualifiedCName).not.toBe(identity.cnxScopedName);
      expect(identity.fullyQualifiedCName.split("__")).toHaveLength(
        identity.cnxScopedName.split(".").length,
      );
    });
  });
});
