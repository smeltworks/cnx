/**
 * Tests for test-utils.ts shared module
 *
 * This test file is written BEFORE test-utils.ts exists (TDD approach).
 * It verifies the public API contract for the shared test utilities.
 */

import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import TestUtils from "./test-utils";
import TargetMatrix from "./TargetMatrix";

// Import shared types
import ITools from "./types/ITools";
import ITestResult from "./types/ITestResult";
import IValidationResult from "./types/IValidationResult";
import TestMarkers from "./TestMarkers";

describe("test-utils exports", () => {
  it("should export ITools interface", () => {
    // TypeScript compile-time check - just verify we can use the type
    // `cppcheck`, `clangTidy` and `misra` were removed from ITools when static
    // analysis moved to the `npm run validate:c` batch step. This literal kept
    // naming them, and the assertion is a compile-time one -- so it was silently
    // wrong for as long as `scripts/` sat outside tsconfig's `include` (#1489).
    const tools: ITools = {
      gcc: true,
    };
    expect(tools.gcc).toBe(true);
  });

  it("should export ITestResult interface", () => {
    const result: ITestResult = {
      passed: true,
      message: "Test message",
    };
    expect(result.passed).toBe(true);
  });

  it("should export IValidationResult interface", () => {
    const result: IValidationResult = {
      valid: true,
      message: "Validation passed",
    };
    expect(result.valid).toBe(true);
  });
});

describe("TestUtils.nullPointerConstantFlags (#1610)", () => {
  const host = { driverPrefix: "", archFlags: [], cmsisCore: false };
  const avr = { driverPrefix: "avr-", archFlags: [], cmsisCore: false };
  const arm = {
    driverPrefix: "arm-none-eabi-",
    archFlags: [],
    cmsisCore: true,
  };

  it("rejects a literal 0 used as a null pointer in host C++", () => {
    expect(TestUtils.nullPointerConstantFlags("g++", host)).toEqual([
      "-Wzero-as-null-pointer-constant",
    ]);
  });

  it("asks nothing of C, where the flag does not exist", () => {
    expect(TestUtils.nullPointerConstantFlags("gcc", host)).toEqual([]);
  });

  it("rejects it in Cortex-M C++ too", () => {
    expect(TestUtils.nullPointerConstantFlags("g++", arm)).toEqual([
      "-Wzero-as-null-pointer-constant",
    ]);
  });

  it("asks nothing of the AVR driver (avr-g++ 7.3 misfires, #2327)", () => {
    expect(TestUtils.nullPointerConstantFlags("g++", avr)).toEqual([]);
  });
});

describe("normalize", () => {
  it("should trim trailing whitespace from each line", () => {
    const input = "line1   \nline2  \nline3";
    const expected = "line1\nline2\nline3";
    expect(TestUtils.normalize(input)).toBe(expected);
  });

  it("should normalize line endings", () => {
    const input = "line1\r\nline2\nline3\r\n";
    // After split on \n, \r remains at end of lines, trimEnd removes it
    const result = TestUtils.normalize(input);
    expect(result).not.toContain("\r");
  });

  it("should trim leading and trailing whitespace from the whole string", () => {
    const input = "  \n  content  \n  ";
    const result = TestUtils.normalize(input);
    expect(result).toBe("content");
  });

  it("should handle empty string", () => {
    expect(TestUtils.normalize("")).toBe("");
  });

  it("should handle single line", () => {
    expect(TestUtils.normalize("hello world  ")).toBe("hello world");
  });
});

describe("hasNoWarningsMarker", () => {
  it("should return true for source with // test-no-warnings marker", () => {
    const source = "// test-no-warnings\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should return true with extra whitespace in marker", () => {
    const source = "//   test-no-warnings   \nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should return true when the marker is indented", () => {
    const source = "code();\n    // test-no-warnings\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(true);
  });

  it("should be case sensitive, and say so loudly (#1555 review)", () => {
    // Reversed deliberately. Seven marker rows carried `i` and
    // `test-execution` did not, so `// TEST-ERROR` was a valid marker while
    // `// TEST-EXECUTION` was a hard error -- two spelling policies in a table
    // promising one spelling each. Settled strict: that is what the promise
    // means, and it is free, since all 1492 marker lines in the corpus are
    // lowercase.
    const source = "// TEST-NO-WARNINGS\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);

    // Not ignored, though -- which is the half that matters. `MARKER_SHAPED`
    // keeps its `i`, so the wrong case is caught as an ATTEMPT at a marker and
    // reported, rather than silently doing nothing. Without this the change
    // above would trade one silence for another.
    expect(TestMarkers.findUnrecognizedSpellings(source)).toEqual([
      { marker: "test-no-warnings", line: 1, text: "// TEST-NO-WARNINGS" },
    ]);
  });

  it("should return false for source without marker", () => {
    const source = "void main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);
  });

  it("should return false for the block form (#1555)", () => {
    // Reversed deliberately. The block form was the ONLY spelling read, which
    // predates #239's extraction and was pinned afterwards by a
    // characterization test of what that extraction found -- never a decision.
    // Every other marker is a line comment, and the corpus had settled it 954
    // to 17, so the line form is canonical and this spelling is now rejected.
    // A fixture still carrying it is caught by marker-spellings.test.ts, not
    // ignored.
    const source = "/* test-no-warnings */\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);
  });

  it("should return false for prose that merely mentions the marker", () => {
    // Negative control. The check above catches under-recognition; this one
    // catches over-recognition, which a looser regex would have introduced --
    // three of the guard's first six hits were prose exactly like this.
    const source =
      "// This fixture is test-no-warnings rather than test-execution\nvoid main() {}";
    expect(TestUtils.hasNoWarningsMarker(source)).toBe(false);
  });
});

describe("TestUtils.requiresCpp14", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-cpp14-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should be a function", () => {
    expect(typeof TestUtils.requiresCpp14).toBe("function");
  });

  it("should detect C++ class keyword in included header", () => {
    const headerContent = `#ifndef TEST_H\n#define TEST_H\nclass MyClass {\npublic:\n    int value;\n};\n#endif\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should detect namespace keyword in included header", () => {
    const headerContent = `namespace utils {\n    void helper();\n}\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should detect access specifiers in included header", () => {
    const headerContent = `struct Foo {\npublic:\n    int x;\n};\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should detect typed enum in included header", () => {
    const headerContent = `enum Color : uint8_t { RED, GREEN, BLUE };\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should detect template declaration in included header", () => {
    const headerContent = `template<typename T>\nT max(T a, T b) { return a > b ? a : b; }\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should return false for plain C header", () => {
    const headerContent = `#ifndef TEST_H\n#define TEST_H\ntypedef struct { int x; int y; } Point;\n#endif\n`;
    writeFileSync(join(tempDir, "test.h"), headerContent);
    const cContent = `#include "test.h"\nint main(void) { return 0; }\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(false);
  });

  it("should detect C++ features in inline code without headers", () => {
    const cContent = `static_cast<int>(x);\n`;
    const cFile = join(tempDir, "test.c");
    writeFileSync(cFile, cContent);
    expect(TestUtils.requiresCpp14(cFile)).toBe(true);
  });

  it("should return false when file does not exist", () => {
    expect(TestUtils.requiresCpp14(join(tempDir, "nonexistent.c"))).toBe(false);
  });
});

describe("TestUtils.hasCppFeatures", () => {
  // Issue #267: C++ casts
  describe("C++ casts", () => {
    it("should detect static_cast", () => {
      expect(TestUtils.hasCppFeatures("static_cast<int>(x)")).toBe(true);
    });

    it("should detect reinterpret_cast", () => {
      expect(TestUtils.hasCppFeatures("reinterpret_cast<char*>(p)")).toBe(true);
    });

    it("should detect const_cast", () => {
      expect(TestUtils.hasCppFeatures("const_cast<int*>(p)")).toBe(true);
    });

    it("should detect dynamic_cast", () => {
      expect(TestUtils.hasCppFeatures("dynamic_cast<Derived*>(base)")).toBe(
        true,
      );
    });
  });

  // Issue #291: C++ template types
  describe("C++ template types", () => {
    it("should detect template types", () => {
      expect(TestUtils.hasCppFeatures("vector<int> v;")).toBe(true);
    });

    it("should detect nested templates", () => {
      expect(TestUtils.hasCppFeatures("map<string, int> m;")).toBe(true);
    });

    it("should NOT detect string<N> (cnx bounded string)", () => {
      expect(TestUtils.hasCppFeatures("string<64> name;")).toBe(false);
    });

    it("should NOT detect comparison operators", () => {
      expect(TestUtils.hasCppFeatures("if (x < y) { }")).toBe(false);
    });
  });

  // Issue #322: Scope resolution operator
  describe("scope resolution operator", () => {
    it("should detect namespace access", () => {
      expect(TestUtils.hasCppFeatures("std::cout << x;")).toBe(true);
    });

    it("should detect static method calls", () => {
      expect(TestUtils.hasCppFeatures("MyClass::staticMethod();")).toBe(true);
    });
  });

  // Issue #375: C++ constructor syntax
  describe("C++ constructor syntax", () => {
    it("should detect single-arg constructor", () => {
      expect(
        TestUtils.hasCppFeatures("Adafruit_MAX31856 thermocouple(pin);"),
      ).toBe(true);
    });

    it("should detect multi-arg constructor", () => {
      expect(TestUtils.hasCppFeatures("MyClass obj(arg1, arg2, arg3);")).toBe(
        true,
      );
    });

    it("should detect constructor at start of line with indent", () => {
      expect(TestUtils.hasCppFeatures("    SomeClass instance(value);")).toBe(
        true,
      );
    });

    // Regression tests - these should NOT be detected as constructors
    it("should NOT detect return statements as constructors", () => {
      expect(TestUtils.hasCppFeatures("return strlen(s);")).toBe(false);
    });

    it("should NOT detect return with function call", () => {
      expect(TestUtils.hasCppFeatures("    return getValue(x);")).toBe(false);
    });

    it("should NOT detect if statements", () => {
      expect(TestUtils.hasCppFeatures("if (condition) { }")).toBe(false);
    });

    it("should NOT detect while loops", () => {
      expect(TestUtils.hasCppFeatures("while (running) { }")).toBe(false);
    });

    it("should NOT detect for loops", () => {
      expect(TestUtils.hasCppFeatures("for (i) { }")).toBe(false);
    });

    it("should NOT detect switch statements", () => {
      expect(TestUtils.hasCppFeatures("switch (x) { }")).toBe(false);
    });

    it("should NOT detect sizeof expressions", () => {
      expect(TestUtils.hasCppFeatures("sizeof (int);")).toBe(false);
    });

    it("should NOT detect standalone function calls", () => {
      // Function calls don't have a type before them
      expect(TestUtils.hasCppFeatures("printf(msg);")).toBe(false);
    });
  });

  // Function prototypes should not trigger C++ detection
  describe("function prototypes", () => {
    it("should NOT detect void function prototype", () => {
      expect(TestUtils.hasCppFeatures("void foo(int x);")).toBe(false);
    });

    it("should NOT detect int function prototype", () => {
      expect(TestUtils.hasCppFeatures("int getValue(void);")).toBe(false);
    });

    it("should NOT detect uint32_t function prototype", () => {
      expect(TestUtils.hasCppFeatures("uint32_t getCount(void);")).toBe(false);
    });

    it("should NOT detect bool function prototype", () => {
      expect(TestUtils.hasCppFeatures("bool isReady(void);")).toBe(false);
    });

    it("should NOT detect static function prototype", () => {
      expect(TestUtils.hasCppFeatures("static init(void);")).toBe(false);
    });

    it("should NOT detect enum return type prototype", () => {
      expect(TestUtils.hasCppFeatures("enum getState(void);")).toBe(false);
    });

    it("should NOT detect struct return type prototype", () => {
      expect(TestUtils.hasCppFeatures("struct getConfig(void);")).toBe(false);
    });

    it("should NOT detect custom type return with typed args", () => {
      expect(TestUtils.hasCppFeatures("Motor_EMode Motor_getMode(void);")).toBe(
        false,
      );
    });

    it("should NOT detect custom type return with const param", () => {
      expect(
        TestUtils.hasCppFeatures(
          "void DeviceManager_configure(const DeviceConfig* newConfig);",
        ),
      ).toBe(false);
    });
  });

  // Plain C code should not trigger C++ detection
  describe("plain C code", () => {
    it("should NOT detect plain C functions", () => {
      expect(TestUtils.hasCppFeatures("int main(void) { return 0; }")).toBe(
        false,
      );
    });

    it("should NOT detect C variable declarations", () => {
      expect(TestUtils.hasCppFeatures("int x = 5;")).toBe(false);
    });

    it("should NOT detect C array declarations", () => {
      expect(TestUtils.hasCppFeatures("char buffer[64];")).toBe(false);
    });
  });
});

describe("getExecutablePath", () => {
  it("should return a path in the temp directory", () => {
    const result = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    expect(result).toContain("cnx-test-");
    expect(result).toContain("test");
  });

  it("should generate unique paths for the same input", () => {
    const path1 = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    const path2 = TestUtils.getExecutablePath("/path/to/test.test.cnx");
    expect(path1).not.toBe(path2);
  });
});

/**
 * Regression test: transpile-only tests must still validate .expected.h files
 *
 * Issue: PR #524 broke header validation for transpile-only tests because the
 * condition `!isTranspileOnly` caused header validation to be skipped even when
 * .expected.h files existed. This allowed stale .expected.h files to go undetected.
 *
 * This test ensures the fix remains in place by verifying that a transpile-only
 * test with a mismatched .expected.h file correctly FAILS.
 */
describe("runTest header validation", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-regression-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should validate .expected.h even for c-only tests (regression)", async () => {
    // Create a minimal c-only test
    const cnxContent = `// test-c-only
u32 testVar;
`;
    const cnxFile = join(tempDir, "hdrchk.test.cnx");
    writeFileSync(cnxFile, cnxContent);

    // Create matching .expected.c (exact format from transpiler)
    const expectedC = `/**
 * generated by cnx from: hdrchk.test.cnx
 * A safer C for embedded systems
 */

#include "hdrchk.test.h"

#include <stdint.h>

// test-c-only
const uint32_t testVar = 0;
`;
    writeFileSync(join(tempDir, "hdrchk.expected.c"), expectedC);

    // Create MISMATCHED .expected.h (intentionally wrong - has WRONG_VAR)
    // #1517: no `<stdbool.h>` -- this header declares no `bool`, so the
    // transpiler no longer emits one. Leaving it here would make the
    // fixture differ for TWO reasons and pass even if the variable name
    // it exists to catch were corrected.
    const wrongExpectedH = `#ifndef HDRCHK_TEST_H
#define HDRCHK_TEST_H

/**
 * generated by cnx from: hdrchk.test.cnx
 * Header file for cross-language interoperability
 */

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* External variables */
extern uint32_t WRONG_VAR_NAME;

#ifdef __cplusplus
}
#endif

#endif /* HDRCHK_TEST_H */
`;
    writeFileSync(join(tempDir, "hdrchk.expected.h"), wrongExpectedH);

    // Run the test - it should FAIL due to header mismatch
    // runTest(cnxFile, updateMode, tools, rootDir)
    const tools: ITools = { gcc: false }; // Skip GCC for speed
    const result = await TestUtils.runTest(cnxFile, false, tools, tempDir);

    // The test MUST fail with header mismatch. The message now also names the
    // first differing line (issue #1471) rather than just "C header mismatch"
    // -- exact guard-name formatting isn't this test's concern, so assert the
    // substance and leave the precise wording to TestUtils.firstDifference's
    // own tests.
    expect(result.passed).toBe(false);
    expect(result.message).toContain("C header mismatch");
    expect(result.message).toContain("First difference at line 1");
  });

  it("fails a C-mode run whose .hpp include forces C++ output (#1314)", async () => {
    // #1319 removed the CAUSE this guard was written for. A .hpp include used to
    // silently switch the run to C++, leaving a c-only fixture comparing against
    // a `.c` the transpiler never wrote -- 44 fixtures stayed green that way.
    // A C-mode run now says so (`--no-cpp`), and C++ met there is E0507
    // (#1844), so the run fails before any snapshot is read. The guard itself is kept: it still
    // covers a C-mode run producing no `.c` for any other reason.
    writeFileSync(
      join(tempDir, "thing.hpp"),
      "#pragma once\nnamespace Thing { struct Config { int v; }; }\n",
    );
    const cnxFile = join(tempDir, "forced.test.cnx");
    writeFileSync(
      cnxFile,
      '// test-c-only\n#include "thing.hpp"\n\nu32 main() { return 0; }\n',
    );

    const tools: ITools = { gcc: false };
    const result = await TestUtils.runTest(cnxFile, false, tools, tempDir);

    expect(result.passed).toBe(false);
    expect(result.message).toContain("E0507");
  });

  it("should pass when .expected.h matches for c-only tests", async () => {
    // Create a minimal c-only test
    const cnxContent = `// test-c-only
u32 goodVar;
`;
    const cnxFile = join(tempDir, "hdrmatch.test.cnx");
    writeFileSync(cnxFile, cnxContent);

    // Create matching .expected.c (exact format from transpiler)
    const expectedC = `/**
 * generated by cnx from: hdrmatch.test.cnx
 * A safer C for embedded systems
 */

#include "hdrmatch.test.h"

#include <stdint.h>

// test-c-only
const uint32_t goodVar = 0;
`;
    writeFileSync(join(tempDir, "hdrmatch.expected.c"), expectedC);

    // Create CORRECT .expected.h (exact format from transpiler)
    const correctExpectedH = `#ifndef CNX_HDRMATCH_TEST_H
#define CNX_HDRMATCH_TEST_H

/**
 * generated by cnx from: hdrmatch.test.cnx
 * Header file for cross-language interoperability
 */

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* External variables */
extern const uint32_t goodVar;

#ifdef __cplusplus
}
#endif

#endif /* CNX_HDRMATCH_TEST_H */
`;
    writeFileSync(join(tempDir, "hdrmatch.expected.h"), correctExpectedH);

    // Run the test - it should PASS
    // runTest(cnxFile, updateMode, tools, rootDir)
    const tools: ITools = { gcc: false };
    const result = await TestUtils.runTest(cnxFile, false, tools, tempDir);

    expect(result.passed).toBe(true);
  });
});

describe("checkForStaleErrorTestArtifacts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-stale-artifacts-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return null when no stale artifacts exist", () => {
    const basePath = join(tempDir, "test-error");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).toBeNull();
  });

  it("should detect stale .test.c file", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.c`, "// stale artifact\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.message).toContain("stale generated artifacts");
    expect(result?.message).toContain("test-error.test.c");
  });

  it("should detect stale .test.cpp file", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.cpp`, "// stale artifact\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.message).toContain("test-error.test.cpp");
  });

  it("should detect stale .test.h file", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.h`, "// stale artifact\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.message).toContain("test-error.test.h");
  });

  it("should detect stale .test.hpp file", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.hpp`, "// stale artifact\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.message).toContain("test-error.test.hpp");
  });

  it("should detect multiple stale artifacts", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.c`, "// stale C\n");
    writeFileSync(`${basePath}.test.h`, "// stale H\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.passed).toBe(false);
    expect(result?.message).toContain("test-error.test.c");
    expect(result?.message).toContain("test-error.test.h");
  });

  it("should include git rm command in error message", () => {
    const basePath = join(tempDir, "test-error");
    writeFileSync(`${basePath}.test.c`, "// stale artifact\n");

    const result = TestUtils.checkForStaleErrorTestArtifacts(basePath);
    expect(result).not.toBeNull();
    expect(result?.actual).toContain("git rm");
  });
});

describe("TestUtils.parseGeneratedImplPaths", () => {
  // Issue #1314: the harness must learn the output path from the CLI rather than
  // guessing it from the mode it asked for. A stale file on disk answers an
  // existence check just as convincingly as a fresh one, which is how seven dead
  // snapshots stayed green.
  const cppOnlyBlock = [
    "Compiled 2 files",
    "Generated 2 output files:",
    "  /repo/tests/x.test.cpp",
    "  /repo/tests/x.test.hpp",
    "",
  ].join("\n");

  it.each([
    {
      name: "returns the .cpp when C mode auto-detected C++",
      stdout: cppOnlyBlock,
      expected: ["/repo/tests/x.test.cpp"],
    },
    {
      name: "returns the .c for an ordinary C-mode run",
      stdout:
        "Generated 2 output files:\n  /repo/tests/y.test.c\n  /repo/tests/y.test.h\n",
      expected: ["/repo/tests/y.test.c"],
    },
    {
      // The CLI fills outputFiles impl-by-impl across the whole pipeline and
      // appends headers afterwards, so every impl precedes every header. Verified
      // against this branch's CLI: `dep.c, main.test.c, dep.h`. An interleaved
      // `a.c, a.h, b.c` cannot occur, so the parser does not tolerate it.
      name: "returns every implementation file for a multi-file run",
      stdout:
        "Generated 3 output files:\n  /repo/dep.c\n  /repo/main.test.c\n  /repo/dep.h\n",
      expected: ["/repo/dep.c", "/repo/main.test.c"],
    },
    {
      name: "ends the block at the first header line",
      stdout:
        "Generated 3 output files:\n  /repo/a.c\n  /repo/a.h\n  /repo/b.c\n",
      expected: ["/repo/a.c"],
    },
    {
      name: "handles the singular 'output file' wording",
      stdout: "Generated 1 output file:\n  /repo/solo.c\n",
      expected: ["/repo/solo.c"],
    },
    {
      name: "returns nothing when the CLI printed no block",
      stdout: "Compiled 1 files\nCollected 3 symbols\n",
      expected: [],
    },
    {
      // Indented, so it only matches if the block regex loses its `^` anchor.
      // The previous version put the decoy before an unindented header line and
      // passed with or without the anchor -- it tested nothing.
      name: "ignores an indented line that merely mentions the block header",
      stdout:
        "  Generated 1 output file: (nested)\n  /repo/decoy.c\n" +
        "Generated 1 output file:\n  /repo/real.c\n",
      expected: ["/repo/real.c"],
    },
    {
      name: "stops at the first non-output line after the block",
      stdout:
        "Generated 1 output file:\n  /repo/real.c\n\nToolchain requirements:\n  /repo/not-output.c\n",
      expected: ["/repo/real.c"],
    },
  ])("$name", ({ stdout, expected }) => {
    expect(TestUtils.parseGeneratedImplPaths(stdout)).toEqual(expected);
  });
});

describe("runTest on an error fixture that stopped erroring (#1316)", () => {
  // A test-error fixture asserts that a diagnostic fires. Under --update, a
  // fixture that transpiles cleanly had its .expected.error unlinked and was
  // rewritten as a .expected.c, reported as `passed: true`. A change that LOSES
  // a diagnostic is indistinguishable from one that fixes a bug, and the update
  // resolves the ambiguity by discarding the assertion. The next `npm test` is
  // green with nothing left to fail. Restore that branch and this goes red.
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-lost-diagnostic-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("does not report success under --update", async () => {
    const cnxFile = join(tempDir, "lost.test.cnx");
    // #1379: the marker is read now, so a fixture asserting a diagnostic must
    // declare itself one. Without it these reach the "has a .expected.error but
    // does not declare // test-error" branch and never exercise #1316 at all --
    // two of these four were passing on that instead of on what they assert.
    writeFileSync(cnxFile, "// test-error\nu32 testVar;\n");
    writeFileSync(
      join(tempDir, "lost.expected.error"),
      "1:0 E0001 a diagnostic this fixture exists to assert\n",
    );

    const tools: ITools = { gcc: false };
    const result = await TestUtils.runTest(cnxFile, true, tools, tempDir);

    expect(result.passed).toBe(false);
  });

  it("keeps the .expected.error under --update", async () => {
    const cnxFile = join(tempDir, "lost.test.cnx");
    // #1379: the marker is read now, so a fixture asserting a diagnostic must
    // declare itself one. Without it these reach the "has a .expected.error but
    // does not declare // test-error" branch and never exercise #1316 at all --
    // two of these four were passing on that instead of on what they assert.
    writeFileSync(cnxFile, "// test-error\nu32 testVar;\n");
    const expectedErrorFile = join(tempDir, "lost.expected.error");
    writeFileSync(
      expectedErrorFile,
      "1:0 E0001 a diagnostic this fixture exists to assert\n",
    );

    const tools: ITools = { gcc: false };
    await TestUtils.runTest(cnxFile, true, tools, tempDir);

    expect(existsSync(expectedErrorFile)).toBe(true);
  });

  it("writes the .expected.c for inspection under --update", async () => {
    // Control for the fix above: the run must fail, but the author who meant to
    // remove the diagnostic still needs to see what the fixture now generates.
    // A fix that simply stopped writing anything would pass the two tests above.
    const cnxFile = join(tempDir, "lost.test.cnx");
    // #1379: the marker is read now, so a fixture asserting a diagnostic must
    // declare itself one. Without it these reach the "has a .expected.error but
    // does not declare // test-error" branch and never exercise #1316 at all --
    // two of these four were passing on that instead of on what they assert.
    writeFileSync(cnxFile, "// test-error\nu32 testVar;\n");
    writeFileSync(
      join(tempDir, "lost.expected.error"),
      "1:0 E0001 a diagnostic this fixture exists to assert\n",
    );

    const tools: ITools = { gcc: false };
    await TestUtils.runTest(cnxFile, true, tools, tempDir);

    expect(existsSync(join(tempDir, "lost.expected.c"))).toBe(true);
  });

  it("reports the same failure on a second --update run", async () => {
    // Keeping the .expected.error leaves this run's own .test.c/.test.h on disk,
    // so checkForStaleErrorTestArtifacts fires first next time and replaces the
    // message with "stale generated artifacts" -- telling the author to `git rm`
    // files this run just wrote, instead of that a diagnostic went missing.
    // Re-running to confirm a failure is the first thing anyone does.
    const cnxFile = join(tempDir, "lost.test.cnx");
    // #1379: the marker is read now, so a fixture asserting a diagnostic must
    // declare itself one. Without it these reach the "has a .expected.error but
    // does not declare // test-error" branch and never exercise #1316 at all --
    // two of these four were passing on that instead of on what they assert.
    writeFileSync(cnxFile, "// test-error\nu32 testVar;\n");
    writeFileSync(
      join(tempDir, "lost.expected.error"),
      "1:0 E0001 a diagnostic this fixture exists to assert\n",
    );

    const tools: ITools = { gcc: false };
    const first = await TestUtils.runTest(cnxFile, true, tools, tempDir);
    const second = await TestUtils.runTest(cnxFile, true, tools, tempDir);

    expect(second.passed).toBe(false);
    expect(second.message).toBe(first.message);
    expect(second.message).not.toContain("stale generated artifacts");
  });

  it("still updates the snapshot of a fixture that keeps erroring", async () => {
    // Negative control: --update must stay useful for a fixture whose diagnostic
    // still fires, or the fix above passes by disabling error-snapshot updates.
    const cnxFile = join(tempDir, "kept.test.cnx");
    writeFileSync(
      cnxFile,
      "// test-error\nvoid shiftTooFar() {\n  mut u8 value <- 1;\n  value <- value << 8;\n}\n",
    );
    const expectedErrorFile = join(tempDir, "kept.expected.error");
    writeFileSync(expectedErrorFile, "0:0 stale text to be refreshed\n");

    const tools: ITools = { gcc: false };
    const result = await TestUtils.runTest(cnxFile, true, tools, tempDir);

    expect(result.passed).toBe(true);
    expect(result.updated).toBe(true);
    expect(existsSync(expectedErrorFile)).toBe(true);
  });
});

/**
 * Issue #1557: the no-warnings check ran in C mode only, and chose its compiler
 * by sniffing the translation unit's contents while the harness already knew the
 * mode. Two derivations of one fact -- the ordinary compile at the mode-aware
 * site treats `mode === "cpp"` as authoritative and falls back to sniffing, the
 * no-warnings compile sniffed and ignored the mode entirely.
 *
 * Measured before the fix: 11 of the 17 marker-carrying fixtures generate a
 * `.cpp` that trips none of the sniffer's patterns, so each would have been
 * handed to `gcc -std=c99` -- which rejects the option outright for a C++ file.
 */
describe("getCompilerConfig is the one language decision (#1557)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-1557-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("is what the no-warnings compile asks, rather than sniffing itself", () => {
    // This used to assert only that the function EXISTS, which passes unchanged
    // if both compile sites revert to their own inline
    // `mode === "cpp" || requiresCpp14(...)` -- the state this fix exists to
    // end. A guard that cannot fail on the property its name claims is
    // decoration; assert the call instead.
    const spy = vi.spyOn(TestUtils, "getCompilerConfig");
    const tuFile = join(tempDir, "plain.test.c");
    writeFileSync(tuFile, "int main(void) { return 0; }\n");

    TestUtils.compileTranslationUnit(
      tuFile,
      dirname(tuFile),
      tempDir,
      "c",
      TargetMatrix.hostToolchain(),
      true,
    );

    expect(spy).toHaveBeenCalledWith("c", tuFile);
    spy.mockRestore();
  });

  it("treats cpp mode as authoritative when the file sniffs as C", () => {
    // Function overloading: valid C++, invalid C99, and trips none of the
    // sniffer's patterns (no ::, no casts, no templates, no reference params).
    const tuFile = join(tempDir, "overload.test.cpp");
    writeFileSync(
      tuFile,
      "int twice(int value) { return value * 2; }\n" +
        "long twice(long value) { return value * 2L; }\n" +
        "int main(void) { return twice(1) == 2 ? 0 : 1; }\n",
    );

    expect(TestUtils.requiresCpp14(tuFile)).toBe(false);
    expect(TestUtils.getCompilerConfig("cpp", tuFile)).toEqual({
      compiler: "g++",
      stdFlag: "-std=c++14",
    });
  });

  it("falls back to sniffing in c mode, so C++ interop keeps its g++", () => {
    const tuFile = join(tempDir, "interop.test.c");
    writeFileSync(tuFile, "int value = static_cast<int>(0);\n");

    expect(TestUtils.getCompilerConfig("c", tuFile)).toEqual({
      compiler: "g++",
      stdFlag: "-std=c++14",
    });
  });

  it("chooses gcc for a plain C translation unit in c mode", () => {
    const tuFile = join(tempDir, "plain.test.c");
    writeFileSync(tuFile, "int main(void) { return 0; }\n");

    expect(TestUtils.getCompilerConfig("c", tuFile)).toEqual({
      compiler: "gcc",
      stdFlag: "-std=c99",
    });
  });
});

describe("no-warnings check honours the harness mode (#1557)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-1557-nw-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("compiles a C++-only translation unit as C++ in cpp mode", () => {
    const tuFile = join(tempDir, "overload.test.cpp");
    writeFileSync(
      tuFile,
      "int twice(int value) { return value * 2; }\n" +
        "long twice(long value) { return value * 2L; }\n" +
        "int main(void) { return twice(1) == 2 ? 0 : 1; }\n",
    );

    const result: IValidationResult = TestUtils.compileTranslationUnit(
      tuFile,
      dirname(tuFile),
      tempDir,
      "cpp",
      TargetMatrix.hostToolchain(),
      true,
    );

    expect(result.valid).toBe(true);
  });

  it("still reports a genuine C++ warning in cpp mode", () => {
    // Negative control: the check above must not pass by compiling nothing.
    //
    // It asserts the MESSAGE, not just `valid === false`. Before the fix this
    // compile failed for an unrelated reason -- `gcc` rejecting `-std=c99` for a
    // C++ file -- so a bare `valid === false` passed while nothing was being
    // warning-checked, which is the #1143 shape this issue is one more case of.
    //
    const tuFile = join(tempDir, "warns.test.cpp");
    writeFileSync(
      tuFile,
      "int helper(int used, int ignored) { return used; }\n" +
        "int main(void) { return helper(0, 1); }\n",
    );

    const result: IValidationResult = TestUtils.compileTranslationUnit(
      tuFile,
      dirname(tuFile),
      tempDir,
      "cpp",
      TargetMatrix.hostToolchain(),
      true,
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("unused parameter");
    // ...and for THIS reason alone. Before the fix `gcc` was handed the `.cpp`,
    // and `cc1plus` reported the rejected `-std=c99` alongside the real warning
    // -- so asserting only the warning passed while the language was still being
    // re-derived from the file's contents.
    expect(result.message).not.toContain("-std=c99");
  });
});

describe("no-warnings check reports an unused local (#1791)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-1791-nw-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const compile = (strict: boolean): IValidationResult => {
    const tuFile = join(tempDir, "unused.test.c");
    writeFileSync(
      tuFile,
      "int main(void) {\n    const int width = 32;\n    return 0;\n}\n",
    );
    return TestUtils.compileTranslationUnit(
      tuFile,
      dirname(tuFile),
      tempDir,
      "c",
      TargetMatrix.hostToolchain(),
      strict,
    );
  };

  it("fails a test-no-warnings fixture that declares a local it never reads", () => {
    const result = compile(true);

    expect(result.valid).toBe(false);
    expect(result.message).toContain("unused variable");
  });

  it("leaves the same unit valid when the fixture is not test-no-warnings", () => {
    expect(compile(false).valid).toBe(true);
  });
});
