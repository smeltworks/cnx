/**
 * Unit tests for detectCppSyntax
 * Issue #208: Detect C++ syntax requiring C++14 parser
 */
import { describe, it, expect } from "vitest";
import detectCppSyntax from "../detectCppSyntax";

describe("detectCppSyntax", () => {
  describe("C++ indicators - should return true", () => {
    it("should detect typed enums (C++14)", () => {
      expect(
        detectCppSyntax("enum Color : uint8_t { RED, GREEN, BLUE };"),
      ).toBe(true);
      expect(detectCppSyntax("enum Status:int{OK,ERROR};")).toBe(true);
      expect(
        detectCppSyntax(`
        enum EPressureType : uint8_t {
          GAUGE = 0,
          ABSOLUTE = 1
        };
      `),
      ).toBe(true);
    });

    it("should detect class inheritance", () => {
      expect(detectCppSyntax("class Derived : public Base {};")).toBe(true);
      expect(detectCppSyntax("class Foo : private Bar {};")).toBe(true);
      expect(detectCppSyntax("class Foo : protected Bar {};")).toBe(true);
    });

    it("should detect struct inheritance", () => {
      expect(detectCppSyntax("struct Derived : public Base {};")).toBe(true);
    });

    it("should detect namespaces", () => {
      expect(detectCppSyntax("namespace MyLib { int foo(); }")).toBe(true);
      expect(
        detectCppSyntax(`
        namespace sensors {
          void init();
        }
      `),
      ).toBe(true);
    });

    it("should detect templates", () => {
      expect(detectCppSyntax("template<typename T> class Container {};")).toBe(
        true,
      );
      expect(detectCppSyntax("template <class T> T max(T a, T b);")).toBe(true);
      expect(detectCppSyntax("template< int N > struct Array {};")).toBe(true);
    });

    it("should detect access specifiers", () => {
      expect(
        detectCppSyntax(`
        class Foo {
        public:
          int x;
        };
      `),
      ).toBe(true);
      expect(
        detectCppSyntax(`
        class Bar {
        private:
          int y;
        };
      `),
      ).toBe(true);
      expect(
        detectCppSyntax(`
        class Baz {
        protected:
          int z;
        };
      `),
      ).toBe(true);
    });
  });

  describe("Pure C - should return false", () => {
    it("should return false for simple C structs", () => {
      expect(
        detectCppSyntax(`
        struct Point {
          int x;
          int y;
        };
      `),
      ).toBe(false);
    });

    it("should return false for C enums without type annotation", () => {
      expect(detectCppSyntax("enum Color { RED, GREEN, BLUE };")).toBe(false);
      expect(
        detectCppSyntax(`
        typedef enum {
          STATE_IDLE,
          STATE_RUNNING
        } State;
      `),
      ).toBe(false);
    });

    it("should return false for C functions", () => {
      expect(detectCppSyntax("int add(int a, int b);")).toBe(false);
      expect(detectCppSyntax("void* malloc(size_t size);")).toBe(false);
    });

    it("should return false for C typedefs", () => {
      expect(detectCppSyntax("typedef unsigned char uint8_t;")).toBe(false);
      expect(detectCppSyntax("typedef struct Node* NodePtr;")).toBe(false);
    });

    it("should return false for empty content", () => {
      expect(detectCppSyntax("")).toBe(false);
    });

    it("should return false for C comments and preprocessor", () => {
      expect(
        detectCppSyntax(`
        /* This is a C header */
        #ifndef HEADER_H
        #define HEADER_H

        int value;

        #endif
      `),
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should not false-positive on 'public' in comments", () => {
      // The regex requires 'public:' at line start with possible whitespace
      expect(
        detectCppSyntax(`
        // This struct is public
        struct Foo { int x; };
      `),
      ).toBe(false);
    });

    it("should not false-positive on variable names containing keywords", () => {
      expect(detectCppSyntax("int namespace_count;")).toBe(false);
      expect(detectCppSyntax("int template_id;")).toBe(false);
    });
  });

  describe("one-line class bodies (#2504 review)", () => {
    it.each([
      ["a class body", "class Counter { public: uint8_t data[4]; };"],
      ["a final class body", "class Leaf final { int x; };"],
      [
        "a struct body that opens with a label",
        "struct S { private: int y; };",
      ],
    ])("detects %s", (_label, source) => {
      expect(detectCppSyntax(source)).toBe(true);
    });

    it.each([
      ["a C struct body", "struct S { int public_x; };"],
      ["class as a C identifier", "int class; struct K { int class; };"],
    ])("does not detect %s", (_label, source) => {
      expect(detectCppSyntax(source)).toBe(false);
    });
  });

  describe("access specifier labels (S8786 scan)", () => {
    // These rows are the corpus the scan was checked against when it replaced
    // /^\s*(public|private|protected)\s*:/m. Kept as tests so the equivalence
    // is permanent rather than a one-off check.
    it.each([
      ["a bare label", "public:", true],
      ["an indented label", "  private :", true],
      ["a tab-indented label", "\n\tprotected:\n", true],
      ["a colon on the following line", "public\n:", true],
      ["a blank line before the colon", "private\n\n  :", true],
    ])("detects %s", (_label, source, expected) => {
      expect(detectCppSyntax(source)).toBe(expected);
    });

    it.each([
      ["a keyword that is only a suffix", "my_public:"],
      ["a keyword followed by more identifier", "public_x:"],
      ["a keyword with a word suffix", "publicly:"],
      ["a label with code before it on the line", "x = public:"],
      ["a keyword with no colon", "public"],
      ["a bare colon", ":"],
      // A label needs its own line: only whitespace may precede it, so a C
      // goto label after a statement is not one.
      [
        "a C label after a statement",
        "void f(void) { goto public; ; public: return; }",
      ],
      ["a label inside a string literal", 'const char *s = "{ public: }";'],
      ["empty input", ""],
    ])("does not treat %s as an access specifier", (_label, source) => {
      expect(detectCppSyntax(source)).toBe(false);
    });
  });
});
