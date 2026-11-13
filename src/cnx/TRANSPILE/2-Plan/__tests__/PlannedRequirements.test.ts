/**
 * #1991: what 2.2 decides one file requires. These cases came from
 * `TranspileState`'s include funnel and `ToolchainRequirements`, which held
 * this as shared state until 2.2 made it a value of its own; the negative
 * controls came with them -- one header per request, not a blanket, and only
 * the two headers whose plan blocks carry sites record one.
 */
import { describe, it, expect } from "vitest";
import PlannedRequirements from "../PlannedRequirements";
import type TDeferredSiteKey from "../../../types/TDeferredSiteKey";
import type TIncludeHeader from "../../../types/TIncludeHeader";

const HEADERS: readonly TIncludeHeader[] = [
  "string",
  "cmsis",
  "limits",
  "isr",
  "float_static_assert",
  "irq_wrappers",
];

const DEFERRED_KEYS: readonly TDeferredSiteKey[] = [
  "irq_wrappers",
  "float_static_assert",
  "ldrex_strex_loop",
];

describe("PlannedRequirements", () => {
  it.each(HEADERS)("%s requires that header and no other", (header) => {
    const requirements = new PlannedRequirements("a.cnx");
    requirements.require(header);
    expect(HEADERS.filter((h) => requirements.requires(h))).toEqual([header]);
  });

  it.each([
    ["float_static_assert", ["float_static_assert"]],
    ["irq_wrappers", ["irq_wrappers"]],
    ["isr", []],
    ["string", []],
  ] as const)("%s defers a site under: %j", (header, deferred) => {
    const requirements = new PlannedRequirements("a.cnx");
    requirements.require(header, 42);
    expect(
      DEFERRED_KEYS.filter((key) => requirements.sitesOf(key).length > 0),
    ).toEqual(deferred);
  });

  // #1452: a site that loses its path still counts as a site, so the path is
  // asserted, not just that a site exists.
  it("records the file the requirement came from, not just that it came", () => {
    const requirements = new PlannedRequirements("a.cnx");
    requirements.require("float_static_assert", 7);
    expect(requirements.sitesOf("float_static_assert")).toEqual([
      { sourcePath: "a.cnx", line: 7 },
    ]);
  });

  it("records a place once, however often it asks", () => {
    const requirements = new PlannedRequirements("a.cnx");
    requirements.require("irq_wrappers", 12);
    requirements.require("irq_wrappers", 12);
    expect(requirements.sitesOf("irq_wrappers")).toEqual([
      { sourcePath: "a.cnx", line: 12 },
    ]);
  });

  it("keys a cast helper by its types, and needs <limits.h> for it", () => {
    const requirements = new PlannedRequirements("a.cnx");
    expect(requirements.requires("limits")).toBe(false);
    requirements.castHelper("f32", "u8");
    expect([...requirements.castHelpers]).toEqual(["f32_u8"]);
    expect(requirements.requires("limits")).toBe(true);
  });

  it("keys a safe division by its name", () => {
    const requirements = new PlannedRequirements("a.cnx");
    const helper = {
      name: "cnx_safe_mod_i16",
      operation: "mod" as const,
      cnxType: "i16",
      inner: "cnx_clamp_mod_i16",
    };
    requirements.safeDivision(helper);
    expect([...requirements.safeDivisions.values()]).toEqual([helper]);
  });

  it("keys an overflow helper within its family (#1790)", () => {
    const requirements = new PlannedRequirements("a.cnx");
    requirements.overflowHelper({
      name: "cnx_clamp_mul_u8",
      behavior: "clamp",
      operation: "mul",
      cnxType: "u8",
    });
    requirements.overflowHelper({
      name: "cnx_wrap_div_i32",
      behavior: "wrap",
      operation: "div",
      cnxType: "i32",
    });
    expect([...requirements.clampHelpers]).toEqual(["mul_u8"]);
    expect([...requirements.wrapHelpers]).toEqual(["div_i32"]);
  });

  it("notes the LDREX/STREX loop and its site", () => {
    const requirements = new PlannedRequirements("a.cnx");
    expect(requirements.emitsLdrexStrexLoop).toBe(false);
    requirements.noteLdrexStrexLoop();
    expect(requirements.emitsLdrexStrexLoop).toBe(true);
    expect(requirements.sitesOf("ldrex_strex_loop")).toEqual([
      { sourcePath: "a.cnx", line: null },
    ]);
  });
});
