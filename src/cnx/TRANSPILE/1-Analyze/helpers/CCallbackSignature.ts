/**
 * #1619, ADR-029: whether a function a C header declares matches a cnx
 * callback type, by C type identity under the run's own header compiler.
 *
 * `unsigned long millis(void)` matches `u32 tickSource()` where the compiler
 * makes `uint32_t` an `unsigned long` (arm-none-eabi-gcc, avr-gcc), and does
 * not where it makes it an `unsigned int` (x86-64 gcc): two C types of one
 * width are still two types (C11 6.2.7), and a call through a pointer of the
 * other is undefined (C11 6.3.2.3p8).
 *
 * The cnx side is the callback type's `_fp` typedef as 2.2 writes it:
 * `CallbackParameterShape` decides it and `CallbackTypedefFormatter` spells
 * it, for 2.2's typedef and for this comparison alike.
 *
 * A header parameter its lowering does not fully carry -- a pointer to a
 * function or to an array, a function-pointer or array typedef, an inner
 * array dimension that is not a literal, a typedef the run never saw declared
 * (a system header's `time_t`), C's unprototyped `f()` -- is "unknown", never
 * a mismatch. A cnx function is held to the same rule (`compareCnx`).
 */
import type ICallbackTypedefParameter from "../../../types/ICallbackTypedefParameter";
import type IFunctionSymbol from "../../../types/symbols/IFunctionSymbol";
import type ICFunctionSymbol from "../../../types/symbols/c/ICFunctionSymbol";
import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type TExpression from "../../../types/syntax/TExpression";
import CallbackParameterShape from "../../../utils/CallbackParameterShape";
import CallbackTypedefFormatter from "../../../utils/CallbackTypedefFormatter";
import DeclaredTypeFacts from "../../../utils/DeclaredTypeFacts";
import ScopeUtils from "../../../utils/ScopeUtils";
import CNX_TO_C_TYPE_MAP from "../../../utils/constants/TypeMappings";
import type ICallbackShapeFacts from "../../../utils/types/ICallbackShapeFacts";
import type IAnalysisContext from "../types/IAnalysisContext";

/** The words C's integer type spellings are made of, in any order */
const INTEGER_WORDS = new Set([
  "signed",
  "unsigned",
  "char",
  "short",
  "int",
  "long",
]);

/** One C type as the compiler tells types apart */
interface ICType {
  readonly base: string;
  /** `*` per pointer level, then `&` for a C++ reference */
  readonly indirection: string;
  /** Whether what the pointer points at is const; meaningless with none */
  readonly pointeeConst: boolean;
  /** Whether what the pointer points at is volatile; meaningless with none */
  readonly pointeeVolatile: boolean;
  /** The base's own qualifiers where there is no pointer: a typedef's `const` */
  readonly baseConst: boolean;
  readonly baseVolatile: boolean;
}

/** Base type names C itself spells, beyond the integer words */
const BUILTIN_BASES = new Set(["void", "float", "double", "long double"]);

type TSignatureMatch = "match" | "mismatch" | "unknown";

class CCallbackSignature {
  /**
   * The C function a callback value names: a bare name, or `global.name`,
   * that binds to nothing of cnx's own and that a C header declares.
   */
  static foreignFunction(
    value: TExpression,
    context: IAnalysisContext,
  ): ICFunctionSymbol | null {
    const named = CCallbackSignature.namedValue(value);
    if (named === null) return null;
    const binding = context.program.bindValue(
      context.sourceFile,
      named.root,
      named.name,
      value.span,
    );
    if (binding?.kind !== "foreign") return null;
    const symbol = context.symbolTable
      .getCOverloads(named.name)
      .find((candidate) => candidate.kind === "function");
    return symbol?.kind === "function" ? symbol : null;
  }

  /** A definite mismatch anywhere wins; otherwise any unknown part is unknown */
  static compare(
    expected: IFunctionSymbol,
    actual: ICFunctionSymbol,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (actual.isVariadic === true) return "mismatch";
    const returned = CCallbackSignature.sameReturn(
      expected,
      actual.type,
      context,
    );
    // C's `f()` declares no prototype: its parameters are not known
    if (actual.isUnprototyped === true && !context.program.cppMode()) {
      return returned === "mismatch" ? "mismatch" : "unknown";
    }
    return CCallbackSignature.compareParameters(
      expected,
      returned,
      actual.parameters ?? [],
      context,
    );
  }

  /**
   * A cnx function by the same rule, from its own `_fp` shape: C type
   * identity and every inner array dimension. The cnx type names, which tell
   * apart what C does not (`string<8>` and `string<16>`), are the caller's.
   */
  static compareCnx(
    expected: IFunctionSymbol,
    actual: IFunctionSymbol,
    context: IAnalysisContext,
  ): TSignatureMatch {
    const facts = CCallbackSignature.facts(context);
    const isCppMode = context.program.cppMode();
    const actualParameters = CallbackParameterShape.parameters(
      actual.fullyQualifiedCName,
      actual,
      facts,
    ).map(
      (parameter, index): ICParameterInfo => ({
        name: "",
        type: CCallbackSignature.typedefText(parameter, isCppMode),
        isConst: false,
        isArray: parameter.isArray,
        arrayDimensions: (actual.parameters[index].arrayDimensions ?? []).map(
          String,
        ),
      }),
    );
    return CCallbackSignature.compareParameters(
      expected,
      CCallbackSignature.sameReturn(
        expected,
        CallbackParameterShape.returnType(actual, facts),
        context,
      ),
      actualParameters,
      context,
    );
  }

  private static facts(context: IAnalysisContext): ICallbackShapeFacts {
    return {
      program: context.program,
      symbols: context.symbols,
      symbolTable: context.symbolTable,
    };
  }

  private static sameReturn(
    expected: IFunctionSymbol,
    actualType: string,
    context: IAnalysisContext,
  ): TSignatureMatch {
    return CCallbackSignature.same(
      CCallbackSignature.parse(
        CallbackParameterShape.returnType(
          expected,
          CCallbackSignature.facts(context),
        ),
        false,
        false,
      ),
      CCallbackSignature.parse(actualType, false, false),
      context,
    );
  }

  private static compareParameters(
    expected: IFunctionSymbol,
    returned: TSignatureMatch,
    actualParameters: readonly ICParameterInfo[],
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (actualParameters.length !== expected.parameters.length) {
      return "mismatch";
    }
    const facts = CCallbackSignature.facts(context);
    const isCppMode = context.program.cppMode();
    const verdicts = [
      returned,
      ...CallbackParameterShape.parameters(
        ScopeUtils.getTranspiledCName(expected),
        expected,
        facts,
      ).map((parameter, index) =>
        CCallbackSignature.compareParameter(
          parameter,
          (expected.parameters[index].arrayDimensions ?? []).map(String),
          actualParameters[index],
          isCppMode,
          context,
        ),
      ),
    ];
    if (verdicts.includes("mismatch")) return "mismatch";
    return verdicts.includes("unknown") ? "unknown" : "match";
  }

  private static compareParameter(
    parameter: Required<ICallbackTypedefParameter>,
    slotDimensions: readonly string[],
    cParameter: ICParameterInfo,
    isCppMode: boolean,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (cParameter.isNestedDeclarator === true) return "unknown";
    // An array typedef's own `[N]` is not among the declarator's dimensions
    // (`const mac_t m[2]` is `const uint8_t (*)[6]`), so they cannot be
    // counted until the base resolves
    const element = CCallbackSignature.parse(
      cParameter.type,
      cParameter.isConst,
      false,
    );
    if (CCallbackSignature.resolve(element, context) === null) return "unknown";
    const dimensions = CCallbackSignature.innerDimensions(
      slotDimensions,
      cParameter.arrayDimensions ?? [],
    );
    if (dimensions !== "match") return dimensions;
    return CCallbackSignature.same(
      CCallbackSignature.parse(
        CCallbackSignature.typedefText(parameter, isCppMode),
        false,
        parameter.isArray,
      ),
      CCallbackSignature.parse(
        cParameter.type,
        cParameter.isConst,
        cParameter.isArray,
        cParameter.isVolatile === true,
      ),
      context,
    );
  }

  /**
   * The typedef's own spelling of a parameter, unnamed and with its
   * dimensions apart: an array parameter is a pointer to its element.
   */
  private static typedefText(
    parameter: Required<ICallbackTypedefParameter>,
    isCppMode: boolean,
  ): string {
    return CallbackTypedefFormatter.formatParameterList(
      [{ ...parameter, name: "", arrayDims: "" }],
      isCppMode,
    );
  }

  /**
   * Every dimension of an array parameter but the first, which decays, is
   * part of its type: `uint8_t g[4][8]` is `const uint8_t (*)[8]`.
   */
  private static innerDimensions(
    slot: readonly string[],
    header: readonly string[],
  ): TSignatureMatch {
    const slotInner = slot.slice(1);
    const headerInner = header.slice(1);
    if (slotInner.length !== headerInner.length) return "mismatch";
    let result: TSignatureMatch = "match";
    slotInner.forEach((dimension, index) => {
      const other = headerInner[index].trim();
      if (dimension.trim() === other) return;
      if (/^\d+$/.test(dimension.trim()) && /^\d+$/.test(other)) {
        result = "mismatch";
      } else if (result === "match") {
        result = "unknown";
      }
    });
    return result;
  }

  private static namedValue(
    value: TExpression,
  ): { root: "global" | null; name: string } | null {
    if (value.kind === "identifier") return { root: null, name: value.name };
    if (
      value.kind === "postfix" &&
      value.primary.kind === "root" &&
      value.primary.root === "global" &&
      value.ops.length === 1 &&
      value.ops[0].kind === "member"
    ) {
      return { root: "global", name: value.ops[0].name };
    }
    return null;
  }

  /**
   * A C type as a header or the `_fp` typedef spells it: `const Reading*`,
   * `const Reading&`, or a parameter's `Reading*` with its pointee's `const`
   * and its array-ness given apart
   */
  private static parse(
    text: string,
    isConst: boolean,
    isArray: boolean,
    isVolatile = false,
  ): ICType {
    const stars = (text.match(/\*/g) ?? []).length + (isArray ? 1 : 0);
    const indirection = "*".repeat(stars) + (text.includes("&") ? "&" : "");
    const words = text.replaceAll(/[*&]/g, " ").split(/\s+/).filter(Boolean);
    const qualified = words.includes("const") || isConst;
    const volatileQualified = words.includes("volatile") || isVolatile;
    const base = words
      .filter((word) => word !== "const" && word !== "volatile")
      .join(" ");
    const pointed = indirection !== "";
    return {
      base,
      indirection,
      pointeeConst: pointed && qualified,
      pointeeVolatile: pointed && volatileQualified,
      baseConst: !pointed && qualified,
      baseVolatile: !pointed && volatileQualified,
    };
  }

  private static same(
    a: ICType,
    b: ICType,
    context: IAnalysisContext,
  ): TSignatureMatch {
    if (CCallbackSignature.equal(a, b, context)) return "match";
    const resolvedA = CCallbackSignature.resolve(a, context);
    const resolvedB = CCallbackSignature.resolve(b, context);
    if (resolvedA === null || resolvedB === null) return "unknown";
    return CCallbackSignature.equal(resolvedA, resolvedB, context)
      ? "match"
      : "mismatch";
  }

  private static equal(a: ICType, b: ICType, context: IAnalysisContext) {
    if (a.indirection !== b.indirection) return false;
    if (
      a.indirection !== "" &&
      (a.pointeeConst !== b.pointeeConst ||
        a.pointeeVolatile !== b.pointeeVolatile)
    ) {
      return false;
    }
    return (
      CCallbackSignature.identity(a.base, context) ===
      CCallbackSignature.identity(b.base, context)
    );
  }

  /**
   * A header typedef followed until its base names none, its own `*`s and
   * qualifiers counted: `SampleRef` (`typedef Sample *SampleRef`) is
   * `Sample*`, and `CByte *` (`typedef const uint8_t CByte`) is
   * `const uint8_t*`. Null for a typedef of a function pointer or an array,
   * and for a base the run cannot name, whose shape it does not know.
   */
  private static resolve(
    type: ICType,
    context: IAnalysisContext,
  ): ICType | null {
    const seen = new Set<string>();
    let current = type;
    for (;;) {
      const name = CCallbackSignature.untagged(current.base);
      if (seen.has(name)) return current;
      seen.add(name);
      const typedef = context.symbolTable.getCSymbol(name);
      if (typedef?.kind !== "type") {
        return CCallbackSignature.isKnownBase(name, context) ? current : null;
      }
      if (typedef.type.includes("(") || typedef.arrayDimensions?.length) {
        return null;
      }
      current = CCallbackSignature.through(
        current,
        CCallbackSignature.parse(typedef.type, typedef.isConst === true, false),
      );
    }
  }

  /** `use` spelled with a typedef whose own type is `inner` */
  private static through(use: ICType, inner: ICType): ICType {
    const viaUse = use.indirection !== "";
    const innerPointer = inner.indirection !== "";
    // `const SampleRef` is `Sample * const`: the const is the pointer's
    const pointee = (
      useQualified: boolean,
      innerPointee: boolean,
      innerBase: boolean,
    ): boolean => {
      if (innerPointer) return viaUse ? useQualified : innerPointee;
      return viaUse && (useQualified || innerBase);
    };
    return {
      base: inner.base,
      indirection: inner.indirection + use.indirection,
      pointeeConst: pointee(
        use.pointeeConst,
        inner.pointeeConst,
        inner.baseConst,
      ),
      pointeeVolatile: pointee(
        use.pointeeVolatile,
        inner.pointeeVolatile,
        inner.baseVolatile,
      ),
      baseConst: !viaUse && !innerPointer && (use.baseConst || inner.baseConst),
      baseVolatile:
        !viaUse && !innerPointer && (use.baseVolatile || inner.baseVolatile),
    };
  }

  /**
   * A base the run can name: C's own spellings, a `<stdint.h>`-family name
   * the compiler's macros define or cnx's own primitives spell, a C symbol a
   * lowered header declares, or a cnx type. Anything else came from a header the run did not lower.
   */
  private static isKnownBase(name: string, context: IAnalysisContext) {
    if (name.split(/\s+/).every((word) => INTEGER_WORDS.has(word))) {
      return true;
    }
    if (BUILTIN_BASES.has(name) || name === "bool" || name === "_Bool") {
      return true;
    }
    if (Object.values(CNX_TO_C_TYPE_MAP).includes(name)) return true;
    const { program, symbolTable, symbols } = context;
    if (program.headerIntegerType(name) !== null) return true;
    if (symbolTable.getCSymbol(name) != null) return true;
    if (DeclaredTypeFacts.isStruct(symbols, symbolTable, name)) return true;
    if (program.knownEnums().has(name)) return true;
    const functionName = CallbackParameterShape.functionOfTypedef(name);
    return (
      functionName !== null &&
      program.symbolByCName(functionName)?.kind === "function"
    );
  }

  /**
   * The type a base type name denotes: a `<stdint.h>`/`<stddef.h>` integer
   * name as the compiler's predefined macros define it, and C's integer
   * spellings in one word order (`long unsigned int` is `unsigned long`).
   */
  private static identity(text: string, context: IAnalysisContext): string {
    const untagged = CCallbackSignature.untagged(text);
    const name = context.program.headerIntegerType(untagged) ?? untagged;
    const words = name.split(/\s+/);
    if (words.every((word) => INTEGER_WORDS.has(word))) {
      return CCallbackSignature.integer(words);
    }
    if (name === "bool" || name === "_Bool") return "_Bool";
    return name;
  }

  private static untagged(text: string): string {
    return text.replace(/^(?:struct|enum|union)\s+/, "").trim();
  }

  private static integer(words: readonly string[]): string {
    const unsigned = words.includes("unsigned");
    if (words.includes("char")) {
      if (unsigned) return "unsigned char";
      return words.includes("signed") ? "signed char" : "char";
    }
    const longs = words.filter((word) => word === "long").length;
    let size = "int";
    if (words.includes("short")) size = "short";
    else if (longs === 2) size = "long long";
    else if (longs === 1) size = "long";
    return unsigned ? `unsigned ${size}` : size;
  }
}

export default CCallbackSignature;
