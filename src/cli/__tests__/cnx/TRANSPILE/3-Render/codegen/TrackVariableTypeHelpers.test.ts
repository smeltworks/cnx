/**
 * Unit tests for trackVariableTypeWithName helper methods.
 * Tests the extracted helpers: extractArrayDimensionsSimple, tryRegisterStringType,
 * and resolveBaseTypeFromContext.
 */

import { describe, expect, it } from "vitest";
import Transpiler from "../../../../../Transpiler";
import NodeFileSystem from "../../../../../../cnx/PARSE/1-Discover/NodeFileSystem";

/**
 * Helper to transpile cnx source and return the C output
 */
async function transpileSource(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", target: "host" },
    NodeFileSystem.instance,
  );
  const result = (
    await transpiler.transpile({ kind: "source", source: source })
  ).files[0];
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Transpile failed: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return result.code;
}

describe("trackVariableTypeWithName helpers", () => {
  describe("extractArrayDimensionsSimple", () => {
    it("handles string array with single dimension", async () => {
      const source = `
        mut string<32>[4] messages;
        void main() {
          messages[0] <- "Hello";
        }
      `;
      const code = await transpileSource(source);
      // String array should be declared with both array and string dimensions
      expect(code).toContain("char messages[4][33]");
    });

    it("handles string array with multiple dimensions", async () => {
      const source = `
        mut string<16>[2][3] grid;
        void main() {
          grid[0][0] <- "test";
        }
      `;
      const code = await transpileSource(source);
      // Multi-dimensional string array
      expect(code).toContain("char grid[2][3][17]");
    });

    it("handles string without array dimensions", async () => {
      const source = `
        mut string<64> message;
        void main() {
          message <- "Hello";
        }
      `;
      const code = await transpileSource(source);
      // Simple string should just have capacity + 1 for null terminator
      expect(code).toContain("char message[65]");
    });
  });

  describe("tryRegisterStringType", () => {
    it("registers string type with correct capacity", async () => {
      const source = `
        mut string<100> buffer;
        void main() {
          buffer <- "test";
        }
      `;
      const code = await transpileSource(source);
      // String capacity 100 + 1 for null terminator
      expect(code).toContain("char buffer[101]");
    });

    it("registers const string type", async () => {
      const source = `
        string<32> greeting <- "Hello";
        void main() {
          return;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("const char greeting[33]");
    });

    it("enables string helpers when string type is used", async () => {
      const source = `
        mut string<32> a;
        mut string<32> b;
        void main() {
          a <- "Hello";
          b <- a;
        }
      `;
      const code = await transpileSource(source);
      // #2207: a string assignment is one bounded, terminated helper copy
      expect(code).toContain("cnx_string_copy(b, a, 32U);");
      expect(code).toContain("target[capacity] = '\\0';");
    });
  });

  describe("resolveBaseTypeFromContext", () => {
    it("resolves primitive types", async () => {
      const source = `
        mut u32 counter;
        void main() {
          counter <- 42;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("uint32_t counter");
    });

    it("resolves scoped types (this.Type)", async () => {
      const source = `
        scope Motor {
          enum State { OFF, ON }
          mut this.State currentState;

          public void setState(this.State newState) {
            currentState <- newState;
          }
        }

        void main() {
          Motor.setState(Motor__State.ON);
        }
      `;
      const code = await transpileSource(source);
      // Scoped type should be transpiled to Motor__State
      expect(code).toContain("Motor__State");
    });

    it("resolves global types (global.Type)", async () => {
      const source = `
        enum Status { OK, ERROR }

        scope Handler {
          mut global.Status result;

          public void setResult(global.Status s) {
            result <- s;
          }
        }

        void main() {
          Handler.setResult(Status.OK);
        }
      `;
      const code = await transpileSource(source);
      // Global type should resolve to just Status
      expect(code).toContain("Status Handler__result");
    });

    it("resolves qualified types (Scope.Type)", async () => {
      const source = `
        scope Motor {
          public enum State { OFF, ON }
        }

        mut Motor.State globalMotorState;

        void main() {
          globalMotorState <- Motor__State.OFF;
        }
      `;
      const code = await transpileSource(source);
      // Qualified type should resolve to Motor__State
      expect(code).toContain("Motor__State globalMotorState");
    });

    it("resolves user-defined struct types", async () => {
      const source = `
        struct Point {
          i32 x;
          i32 y;
        }

        mut Point origin;

        void main() {
          origin.x <- 0;
          origin.y <- 0;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("Point origin");
    });
  });

  describe("trackVariableTypeWithName integration", () => {
    it("handles array type syntax", async () => {
      const source = `
        mut u8[10] buffer;
        void main() {
          buffer[0] <- 255;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("uint8_t buffer[10]");
    });

    it("handles enum type registration", async () => {
      const source = `
        enum Color { RED, GREEN, BLUE }
        mut Color selected;

        void main() {
          selected <- Color.GREEN;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("Color selected");
      expect(code).toContain("selected = Color__GREEN");
    });

    it("handles bitmap type registration", async () => {
      const source = `
        bitmap8 Flags {
          enabled,
          visible,
          active,
          reserved0,
          reserved1,
          reserved2,
          reserved3,
          reserved4
        }
        mut Flags settings;

        void main() {
          settings.enabled <- true;
        }
      `;
      const code = await transpileSource(source);
      expect(code).toContain("Flags settings");
    });

    it("handles atomic string type", async () => {
      const source = `
        atomic string<64> sharedMessage;

        void main() {
          sharedMessage <- "Hello";
        }
      `;
      const code = await transpileSource(source);
      // Atomic modifier should be preserved (though string atomicity is limited)
      expect(code).toContain("char sharedMessage[65]");
    });

    it("handles wrap overflow behavior", async () => {
      const source = `
        mut wrap u8 counter;

        void main() {
          counter <- 255;
          counter <- counter + 1;
        }
      `;
      const code = await transpileSource(source);
      // Wrap behavior means no overflow check
      expect(code).toContain("uint8_t counter");
    });

    it("issue #665: scope array with enum size recognized for return", async () => {
      // When array size is an unresolvable enum member (e.g., global.EIndex.COUNT),
      // the array should still be recognized as an array type for return statements.
      // Previously, the isArray flag depended on successfully resolving dimensions,
      // which failed for enum members, causing bit extraction instead of array access.
      const source = `
        enum EIndex { FIRST, SECOND, COUNT }

        scope Test {
          i32 values[global.EIndex.COUNT];

          public i32 get(u8 idx) {
            return this.values[idx];
          }
        }

        void main() {
          i32 val <- Test.get(0);
        }
      `;
      const code = await transpileSource(source);
      // Should generate array access, NOT bit extraction
      expect(code).toContain("return Test__values[idx]");
      // Should NOT contain bit extraction pattern
      expect(code).not.toContain(">> idx");
      expect(code).not.toContain("& 1");
    });
  });
});
