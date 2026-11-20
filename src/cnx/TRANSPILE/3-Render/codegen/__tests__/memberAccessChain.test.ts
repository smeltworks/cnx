/**
 * Tests for memberAccessChain helper module.
 *
 * #1445: `determineSeparator` and `buildMemberAccessChain` were deleted as
 * dead code -- 0 production callers between them, 31 test callers here. These
 * tests went with them; that is not a coverage regression because they covered
 * nothing reachable, but the count is stated on the PR rather than left to be
 * discovered in the Sonar diff.
 */

import memberAccessChain from "../memberAccessChain";

const { getStructParamSeparator, wholeParamValue } = memberAccessChain;

/**
 * Both helpers read ONE decision -- is this struct parameter a pointer here, or
 * a C++ reference -- so each is one table over the same two inputs. The C++
 * callback-promoted row is the one Issue #895 decided for the separator while
 * the wrap still asked the mode alone: `f->pokes` beside `Full copy = f;`.
 */
describe("getStructParamSeparator", () => {
  it.each<[string, boolean, boolean, string]>([
    ["C", false, false, "->"],
    ["C++", true, false, "."],
    ["C, callback-promoted", false, true, "->"],
    ["C++, callback-promoted", true, true, "->"],
  ])(
    "separates a struct parameter in %s",
    (_label, cppMode, forcePointerSemantics, expected) => {
      expect(getStructParamSeparator({ cppMode, forcePointerSemantics })).toBe(
        expected,
      );
    },
  );
});

describe("wholeParamValue", () => {
  const struct = {
    isStruct: true,
    isArray: false,
    isOpaqueHandle: false,
    forcePointerSemantics: false,
  };

  it.each<[string, boolean, boolean, string]>([
    ["C", false, false, "(*config)"],
    ["C++", true, false, "config"],
    ["C, callback-promoted", false, true, "(*config)"],
    ["C++, callback-promoted", true, true, "(*config)"],
  ])(
    "wraps a whole-value struct parameter in %s",
    (_label, cppMode, forcePointerSemantics, expected) => {
      expect(
        wholeParamValue(
          "config",
          { ...struct, forcePointerSemantics },
          cppMode,
        ),
      ).toBe(expected);
    },
  );

  // ADR-030 / #1722: the handle's value IS the pointer; an array parameter
  // is the pointer C passes; anything else resolved as it stands
  it.each<[string, Parameters<typeof wholeParamValue>[1]]>([
    ["an opaque handle", { ...struct, isOpaqueHandle: true }],
    ["an array parameter", { ...struct, isArray: true }],
    ["a scalar parameter", { ...struct, isStruct: false }],
    ["no parameter", undefined],
  ])("leaves %s unwrapped", (_label, paramInfo) => {
    expect(wholeParamValue("p", paramInfo, false)).toBe("p");
  });
});

// #1760 review: how a root is held, decided once for both member-access paths
describe("memberAccessChain.rootHolding", () => {
  const facts = {
    isKnownStruct: (name: string) => name === "widget_t" || name === "Dev",
    isHeldThroughPointer: (name: string) => name === "Dev",
  };
  const local = (baseType: string, isPointer: boolean) => ({
    baseType,
    bitWidth: 0,
    isArray: false,
    isConst: false,
    isPointer,
  });

  it("answers a parameter from the parameter", () => {
    expect(
      memberAccessChain.rootHolding(
        { isStruct: true, forcePointerSemantics: true },
        local("widget_t", true),
        facts,
      ),
    ).toEqual({
      isStructParam: true,
      forcePointerSemantics: true,
      isPointerLocal: false,
      registerLayout: null,
    });
  });

  it("holds a local #895 made a pointer to a struct through the pointer", () => {
    expect(
      memberAccessChain.rootHolding(undefined, local("widget_t", true), facts)
        .isPointerLocal,
    ).toBe(true);
  });

  it.each([
    ["a struct held by value", local("widget_t", false)],
    ["an opaque handle", local("Dev", true)],
    ["a pointer to a non-struct", local("char", true)],
    ["an untyped root", undefined],
  ])("holds %s by nothing", (_label, rootTypeInfo) => {
    expect(
      memberAccessChain.rootHolding(undefined, rootTypeInfo, facts),
    ).toEqual({
      isStructParam: false,
      forcePointerSemantics: false,
      isPointerLocal: false,
      registerLayout: null,
    });
  });

  it("gives a pointer local -> in C++ too, and a C++ reference .", () => {
    const pointer = memberAccessChain.rootHolding(
      undefined,
      local("widget_t", true),
      facts,
    );
    expect(memberAccessChain.rootMemberSeparator(pointer, true)).toBe("->");
    const reference = memberAccessChain.rootHolding(
      { isStruct: true, forcePointerSemantics: false },
      undefined,
      facts,
    );
    expect(memberAccessChain.rootMemberSeparator(reference, true)).toBe(".");
    expect(memberAccessChain.rootMemberSeparator(reference, false)).toBe("->");
  });
});
