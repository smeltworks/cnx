import RequirementSites from "../../utils/RequirementSites";
import type IRequirementSite from "../../types/IRequirementSite";
import type TDeferredSiteKey from "../../types/TDeferredSiteKey";
import type TIncludeHeader from "../../types/TIncludeHeader";
import type IPlannedSafeDivision from "../../types/IPlannedSafeDivision";
import type IPlannedOverflowHelper from "./types/IPlannedOverflowHelper";

/**
 * #1991: what one file's plan requires -- its headers, helpers and deferred
 * forms, with the sites that asked (#1143) -- collected while 2.2 plans the
 * file and read once, to build its emission plan. `planFile` makes one per
 * file, so 2.2 writes no shared state for it and nothing outlives the file.
 *
 * The sites are attribution only: the banner and the file result list them,
 * and no decision reads one (#1928, #1997).
 */
class PlannedRequirements {
  private readonly headers = new Set<TIncludeHeader>();
  private readonly sites = new Map<TDeferredSiteKey, IRequirementSite[]>();
  private readonly castHelperKeys = new Set<string>();
  private readonly safeDivisionHelpers = new Map<
    string,
    IPlannedSafeDivision
  >();
  private readonly clampHelperKeys = new Set<string>();
  private readonly wrapHelperKeys = new Set<string>();
  private readonly lengthHelperNames = new Set<string>();
  private ldrexStrexLoop = false;
  private compareExchangeLoop = false;
  private wideCompareExchangeLoop = false;
  private readonly sourcePath: string;

  constructor(sourcePath: string) {
    this.sourcePath = sourcePath;
  }

  /**
   * The one sink for a header or deferred emission the plan needs. Only the
   * two whose plan blocks carry sites record one: "isr" carries none.
   */
  require(header: TIncludeHeader, line: number | null = null): void {
    if (header === "irq_wrappers" || header === "float_static_assert") {
      this.noteSite(header, line);
    }
    this.headers.add(header);
  }

  requires(header: TIncludeHeader): boolean {
    return this.headers.has(header);
  }

  /**
   * #1668: a single-evaluation saturating cast's helper. It uses the limit
   * macros, so it needs `<limits.h>` exactly as the inline form does.
   */
  castHelper(sourceType: string, targetType: string): void {
    this.castHelperKeys.add(`${sourceType}_${targetType}`);
    this.require("limits");
  }

  /** ADR-051: a safe_div/safe_mod helper, keyed by its name */
  safeDivision(helper: IPlannedSafeDivision): void {
    this.safeDivisionHelpers.set(helper.name, helper);
  }

  /** ADR-044: an overflow helper, keyed as `"add_u32"` within its family */
  overflowHelper(helper: IPlannedOverflowHelper): void {
    const keys =
      helper.behavior === "clamp" ? this.clampHelperKeys : this.wrapHelperKeys;
    keys.add(`${helper.operation}_${helper.cnxType}`);
  }

  /** ADR-058: a runtime integer length's helper, `"cnx_value_bit_length"` */
  lengthHelper(name: string): void {
    this.lengthHelperNames.add(name);
  }

  /** #1997: an LDREX/STREX loop, whose site the requirement carries */
  noteLdrexStrexLoop(): void {
    this.ldrexStrexLoop = true;
    this.noteSite("ldrex_strex_loop", null);
  }

  /**
   * #1789: a GNU `__atomic` compare-exchange loop, whose site the requirement
   * carries. `wide`: its type is wider than the target's word, so the
   * compiler calls libatomic for it.
   */
  noteCompareExchangeLoop(wide: boolean): void {
    this.compareExchangeLoop = true;
    this.noteSite("compare_exchange_loop", null);
    if (wide) {
      this.wideCompareExchangeLoop = true;
      this.noteSite("wide_compare_exchange_loop", null);
    }
  }

  get castHelpers(): ReadonlySet<string> {
    return this.castHelperKeys;
  }

  get lengthHelpers(): ReadonlySet<string> {
    return this.lengthHelperNames;
  }

  get safeDivisions(): ReadonlyMap<string, IPlannedSafeDivision> {
    return this.safeDivisionHelpers;
  }

  get clampHelpers(): ReadonlySet<string> {
    return this.clampHelperKeys;
  }

  get wrapHelpers(): ReadonlySet<string> {
    return this.wrapHelperKeys;
  }

  get emitsCompareExchangeLoop(): boolean {
    return this.compareExchangeLoop;
  }

  get emitsWideCompareExchangeLoop(): boolean {
    return this.wideCompareExchangeLoop;
  }

  get emitsLdrexStrexLoop(): boolean {
    return this.ldrexStrexLoop;
  }

  sitesOf(key: TDeferredSiteKey): readonly IRequirementSite[] {
    return this.sites.get(key) ?? [];
  }

  private noteSite(key: TDeferredSiteKey, line: number | null): void {
    RequirementSites.accumulate(this.sites, key, [
      { sourcePath: this.sourcePath, line },
    ]);
  }
}

export default PlannedRequirements;
