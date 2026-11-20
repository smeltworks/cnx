import type IBaseSymbol from "./IBaseSymbol";
import type TType from "../TType";
import type TOverflowBehavior from "../TOverflowBehavior";
import type TConstExpr from "../TConstExpr";

/**
 * Symbol representing a variable (global, static, or extern).
 */
interface IVariableSymbol extends IBaseSymbol {
  /** Discriminator narrowed to "variable" */
  readonly kind: "variable";

  /** Variable type */
  readonly type: TType;

  /** Whether this variable is const */
  readonly isConst: boolean;

  /** Whether this variable is atomic (volatile in C) */
  readonly isAtomic: boolean;

  /**
   * Whether this variable carries an explicit `volatile` modifier.
   *
   * Resolved here, once, so the `.c` definition and the `.h` declaration cannot
   * disagree: the header used to hardcode this false, which is a "conflicting
   * type qualifiers" error as soon as the `.c` includes its own header.
   */
  readonly isVolatile: boolean;

  /**
   * ADR-044 overflow behavior: `clamp` (the default) or `wrap`.
   *
   * Issue #1303: authored here, once, so the declared behavior travels with
   * the symbol across a file boundary. It previously existed only in codegen's
   * per-file type registry, so an imported `u8` arrived with nothing to say
   * whether it saturated or wrapped -- and codegen emitted plain C arithmetic,
   * silently turning ADR-044's safe default into two's-complement wrap.
   *
   * Required rather than optional on purpose: ADR-044 gives EVERY integer
   * declaration a behavior, so a construction site that cannot name one is a
   * site that has lost the fact, and should not be able to compile.
   */
  readonly overflowBehavior: TOverflowBehavior;

  /** Whether this variable is an array */
  readonly isArray: boolean;

  /** Array dimensions if isArray is true - numbers for resolved, strings for macros */
  readonly arrayDimensions?: ReadonlyArray<number | string>;
  /**
   * #1175: each dimension as written, index-aligned with the dimensions --
   * null where 1.3 already knew the size (a literal, arithmetic over literals,
   * an unsized `[]`). 1.4 Resolve settles the rest from this, never from
   * source text.
   */
  readonly arrayDimensionExprs?: ReadonlyArray<TConstExpr | null>;

  /** Initial value expression (as string) */
  readonly initialValue?: string;
  /**
   * #1175: a const's initializer as written, which its value folds from.
   * The text above is for what reads the spelling; a value is never read
   * from it.
   */
  readonly initialValueExpr?: TConstExpr;

  /** #895: what the initializer calls (`VariableCollector.calleeOf`) */
  readonly initializerCallee?: string | null;

  /**
   * #375: declared by a constructor (`Strip strip(PIN);`), whose form has no
   * `mut` to write or remove (ADR-071 E0899)
   */
  readonly isConstructed?: boolean;

  /**
   * ADR-072 Part 1: a constructor's one argument as a constant expression
   * (`GpioPort GPIO1(GPIO_BASE + 0x4000);`). Whether it is an address -- the
   * type is a register -- is a cross-file fact, so 1.4 decides it and
   * evaluates it there.
   */
  readonly constructedAddress?: TConstExpr;
}

export default IVariableSymbol;
