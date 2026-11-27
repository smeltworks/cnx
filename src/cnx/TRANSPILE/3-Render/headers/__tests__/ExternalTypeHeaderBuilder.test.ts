/**
 * Unit tests for ExternalTypeHeaderBuilder
 */

import { describe, it, expect } from "vitest";
import ExternalTypeHeaderBuilder from "../ExternalTypeHeaderBuilder";

/**
 * Stands in for `Program`, which answers which type names a file declares.
 *
 * #1511: this used to hand over whole symbols and the builder filtered them by
 * kind. That filter is authored in `Program` now, so which kinds form a type is
 * asserted in `Program.test.ts` — a mock here that re-applied it would be a
 * second copy of the rule, and would pass whether or not production agreed.
 */
class MockTypeSource {
  private typesByFile: Map<string, Set<string>> = new Map();

  private readHeaders: Map<string, string> = new Map();

  addTypes(filePath: string, typeNames: string[]): void {
    this.typesByFile.set(filePath, new Set(typeNames));
  }

  readsFrom(typeName: string, filePath: string): void {
    this.readHeaders.set(typeName, filePath);
  }

  typesDeclaredIn(filePath: string): ReadonlySet<string> {
    return this.typesByFile.get(filePath) ?? new Set<string>();
  }

  declaringHeader(typeName: string): string | undefined {
    return this.readHeaders.get(typeName);
  }
}

describe("ExternalTypeHeaderBuilder", () => {
  describe("build", () => {
    it("#2474: includes a type from the header the file reads, not the first", () => {
      const source = new MockTypeSource();
      source.addTypes("/lib/a-types.h", ["sample_t"]);
      source.addTypes("/lib/b-types.h", ["sample_t"]);
      source.readsFrom("sample_t", "/lib/b-types.h");

      const headerDirectives = new Map([
        ["/lib/a-types.h", '#include "a-types.h"'],
        ["/lib/b-types.h", '#include "b-types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("sample_t")).toBe('#include "b-types.h"');
    });

    it("maps struct types to their include directives", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/types.h", ["MyStruct"]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("MyStruct")).toBe('#include "types.h"');
    });

    it("maps enum types to their include directives", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/enums.h", ["Status"]);

      const headerDirectives = new Map([
        ["/path/to/enums.h", '#include "enums.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("Status")).toBe('#include "enums.h"');
    });

    it("maps typedef types to their include directives", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/types.h", ["size_t"]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("size_t")).toBe('#include "types.h"');
    });

    it("maps class types to their include directives", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/serial.hpp", ["Serial"]);

      const headerDirectives = new Map([
        ["/path/to/serial.hpp", '#include "serial.hpp"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("Serial")).toBe('#include "serial.hpp"');
    });

    it("first include wins for duplicate type names", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/first.h", ["DuplicateType"]);
      source.addTypes("/path/to/second.h", ["DuplicateType"]);

      const headerDirectives = new Map([
        ["/path/to/first.h", '#include "first.h"'],
        ["/path/to/second.h", '#include "second.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("DuplicateType")).toBe('#include "first.h"');
    });

    it("handles multiple types from same header", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/types.h", ["StructA", "EnumB", "TypeC"]);

      const headerDirectives = new Map([
        ["/path/to/types.h", '#include "types.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("StructA")).toBe('#include "types.h"');
      expect(result.get("EnumB")).toBe('#include "types.h"');
      expect(result.get("TypeC")).toBe('#include "types.h"');
    });

    it("handles multiple headers", () => {
      const source = new MockTypeSource();
      source.addTypes("/path/to/a.h", ["TypeA"]);
      source.addTypes("/path/to/b.h", ["TypeB"]);

      const headerDirectives = new Map([
        ["/path/to/a.h", '#include "a.h"'],
        ["/path/to/b.h", '#include "b.h"'],
      ]);

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.get("TypeA")).toBe('#include "a.h"');
      expect(result.get("TypeB")).toBe('#include "b.h"');
    });

    it("returns empty map when no headers", () => {
      const source = new MockTypeSource();
      const headerDirectives = new Map<string, string>();

      const result = ExternalTypeHeaderBuilder.build(headerDirectives, source);

      expect(result.size).toBe(0);
    });
  });
});
