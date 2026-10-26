/**
 * What a name in a constant expression is worth (#1175, #1669): one walk of
 * its chain, from the binder's answer for its head.
 *
 * - a local, or a const declared at file or scope level, is worth its folded
 *   value, typed by its declaration (ADR-044's arithmetic needs the width) --
 *   an integer's or a float's, settled once by 1.4 (#1268 review);
 * - a scope's member (`Scope.N`) or an enum's (`EColor.COUNT`, `this.EMode.X`,
 *   `Motor.EMode.X`) is found by C name, as everything is (ADR-063);
 * - a name an included header defines is C's to evaluate;
 * - anything else -- a variable, a parameter, a function -- has no value, and
 *   the reason says which, for the diagnostic.
 *
 * 1.4 Resolve asks this while the program's consts and enum values settle,
 * and every later pass asks it through the settled `Program`, with the same
 * facts. That is what makes `u8[N]` one size in the .c and the .h.
 */
import QualifiedCName from "../../utils/QualifiedCName";
import CNX_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import ScopeUtils from "../../utils/ScopeUtils";
import LengthProperty from "../../utils/LengthProperty";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import type ILengthSubject from "../../utils/types/ILengthSubject";
import type TEssentialCategory from "../../types/TEssentialCategory";
import TypeHead from "../../utils/TypeHead";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import type TSymbol from "../../types/symbols/TSymbol";
import type TType from "../../types/TType";
import type IConstantNameFacts from "./types/IConstantNameFacts";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import ELEMENT_STEP from "../../types/ELEMENT_STEP";
import type TChainRoot from "../../types/TChainRoot";
import type TValueBinding from "../../types/TValueBinding";
import type IConstTarget from "../../types/IConstTarget";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import ConstantFold from "../../utils/ConstantFold";
import type TSettledConst from "../../types/TSettledConst";

type TConstName = Extract<TConstExpr, { kind: "name" }>;
type TReason = Extract<TConstResult, { kind: "notConstant" }>["reason"];

/** A value a property measures: its type and its settled dimensions */
interface IMeasured {
  readonly type: TType;
  readonly dimensions: ReadonlyArray<number | string>;
  /** A header bit-field's declared width, `ForeignTypeFacts.bitFieldWidth` */
  readonly bitField?: number | null;
}

/** Where the walk is, for a reason's message */
interface IWalk {
  readonly spelling: string;
  readonly at: ISourcePosition;
  readonly facts: IConstantNameFacts;
}

/** What declares a type; a function too, as its callback type (ADR-029) */
const TYPE_KINDS: ReadonlySet<string> = new Set([
  "struct",
  "enum",
  "bitmap",
  "scope",
  "function",
]);

class ConstantNames {
  static valueOf(name: TConstName, facts: IConstantNameFacts): TConstResult {
    const walk: IWalk = {
      spelling: ConstantNames.spell(name),
      at: name.at,
      facts,
    };
    const head = name.path[0];
    if (head === undefined) return ConstantNames.without("unknown", walk);
    const target = ConstantNames.target(name, facts);
    return target === null
      ? ConstantNames.ofTypeHead(name.root, head, name.path.slice(1), walk)
      : ConstantNames.ofBound(target.binding, target.rest, walk);
  }

  /**
   * What the name reads, by the binder's answer for its head: through a scope
   * to the member variable it names (`Scope.N`), or null when the head binds
   * no value (a type's name). The walk `valueOf` folds, and the one a pass
   * asks which binding a name reads (#1735 review).
   */
  static target(
    name: TConstName,
    facts: IConstantNameFacts,
  ): IConstTarget | null {
    const head = name.path[0];
    if (head === undefined) return null;
    const binding = facts.bind(name.root, head, name.at);
    if (binding === null) return null;
    const rest = name.path.slice(1);
    const member = rest[0];
    if (binding.kind === "scope" && member !== undefined) {
      const symbol = facts.visibleSymbol(
        ScopeUtils.getTranspiledCName({
          name: member,
          scopePath: binding.scopePath,
        }),
      );
      if (symbol?.kind === "variable") {
        return { binding: { kind: "variable", symbol }, rest: rest.slice(1) };
      }
    }
    return { binding, rest };
  }

  /**
   * What a name the binder has already bound is worth, by itself --
   * `program.constantOf`'s answer, from the same walk
   */
  static ofBinding(
    binding: TValueBinding,
    spelling: string,
    at: ISourcePosition,
    facts: IConstantNameFacts,
  ): TConstResult {
    return ConstantNames.ofBound(binding, [], { spelling, at, facts });
  }

  private static ofBound(
    binding: TValueBinding,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    switch (binding.kind) {
      case "local":
        return ConstantNames.ofLocal(binding.declaration, rest, walk);
      case "variable":
        return ConstantNames.ofVariable(binding.symbol, rest, walk);
      case "function":
        return ConstantNames.without("function", walk);
      case "scope":
        return ConstantNames.ofScopeMember(binding.scopePath, rest, walk);
      case "foreign":
        return ConstantNames.ofForeign(binding.name, rest, walk);
    }
  }

  /**
   * #1863 review: a cnx type name as C spells it where it is written -- a
   * primitive's C type, or the scope type ADR-057 qualifies a bare name to
   * (`(P)x` inside scope S is `(S__P)x`). Through
   * `ScopeUtils.qualifyScopeType`, the rule every type position uses.
   */
  static cTypeName(
    typeName: string,
    at: ISourcePosition,
    facts: IConstantNameFacts,
  ): string {
    const primitive = CNX_TO_C_TYPE_MAP[typeName];
    if (primitive !== undefined) return primitive;
    const scopePath = facts.scopePathAt(at);
    const parts = typeName.split(".");
    if (parts[0] === "this") {
      return ScopeUtils.getTranspiledCName({
        name: parts.slice(1).join("."),
        scopePath,
      });
    }
    if (parts[0] === "global") return QualifiedCName.fromSourceName(parts.slice(1));
    const qualified =
      parts.length === 1
        ? ScopeUtils.qualifyScopeType(typeName, scopePath, (name) =>
            facts.isScopeTypeVisible(name),
          )
        : typeName;
    return QualifiedCName.fromSourceName(qualified);
  }

  /**
   * Whether a type name that is not a primitive denotes a type where it is
   * written: a cnx type this file can see, or -- in a file that reaches a
   * C or C++ header, which is not parsed for every name -- any name at all.
   * The same answer E0426 gives (`UndeclaredTypeAnalyzer.knowsEveryName`).
   */
  static isTypeName(
    typeName: string,
    at: ISourcePosition,
    facts: IConstantNameFacts,
  ): boolean {
    const cName = ConstantNames.cTypeName(typeName, at, facts);
    const symbol = facts.visibleSymbol(cName);
    if (symbol === undefined) return facts.reachesForeignHeader;
    return TYPE_KINDS.has(symbol.kind);
  }

  /** `this.N`, `global.N`, `Scope.N`, `m[].type_element_count` */
  static spell(name: TConstName): string {
    return [...(name.root === null ? [] : [name.root]), ...name.path]
      .join(".")
      .replaceAll(`.${ELEMENT_STEP}`, ELEMENT_STEP);
  }

  private static ofLocal(
    declaration: ILocalDeclaration,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const settled = walk.facts.settledLocal(declaration);
    if (rest.length > 0) {
      const measured = settled ?? declaration;
      return ConstantNames.ofMember(
        { type: measured.type, dimensions: measured.arrayDimensions },
        rest,
        walk,
      );
    }
    // A parameter is read-only (ADR-071) but its value is the caller's
    if (declaration.kind === "parameter") {
      return ConstantNames.without("parameter", walk);
    }
    if (ConstantFold.hasCompileTimeValue(declaration)) {
      return ConstantNames.ofSettled(settled?.constValue ?? undefined, walk);
    }
    return ConstantNames.without("variable", walk);
  }

  private static ofVariable(
    symbol: IVariableSymbol,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (rest.length > 0) {
      return ConstantNames.ofMember(
        { type: symbol.type, dimensions: symbol.arrayDimensions ?? [] },
        rest,
        walk,
      );
    }
    if (!ConstantFold.hasCompileTimeValue(symbol)) {
      return ConstantNames.without("variable", walk);
    }
    return ConstantNames.ofSettled(walk.facts.constValue(symbol), walk);
  }

  /**
   * A const, by what 1.4 settled it to: its value, or no value -- with its
   * own initializer's cause, so a use can say why (#1863 review)
   */
  private static ofSettled(
    settled: TSettledConst | undefined,
    walk: IWalk,
  ): TConstResult {
    if (settled?.kind === "value") {
      return {
        kind: "value",
        value: BigInt(settled.digits),
        typeName: settled.typeName,
      };
    }
    // #1739: a bool const is worth what its literal is, an enum const what
    // its member is
    if (settled?.kind === "bool") {
      return {
        kind: "value",
        value: settled.value ? 1n : 0n,
        typeName: "bool",
      };
    }
    if (
      settled?.kind === "named" &&
      walk.facts.visibleSymbol(settled.typeName)?.kind === "enum"
    ) {
      return { kind: "value", value: BigInt(settled.digits), typeName: null };
    }
    if (settled?.kind === "float") {
      return {
        kind: "float",
        value: Number(settled.digits),
        typeName: settled.typeName,
        spelling: walk.spelling,
        at: walk.at,
      };
    }
    return {
      ...ConstantNames.without("unfolded", walk),
      ...(settled === undefined || settled.kind === "named"
        ? {}
        : { because: settled }),
    };
  }

  /**
   * #1175: ADR-058's length properties are constants -- `src.type_element_count`,
   * `cfg.data.type_bit_length` -- worth what `LengthProperty` says of the measured
   * value's settled dimensions and element width, reached through struct
   * fields. Render reads the same rule, so a dimension sized by a property is
   * the number the property reads as. Any other member has no value.
   */
  private static ofMember(
    measured: IMeasured,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    let current: IMeasured | null = measured;
    for (const step of rest.slice(0, -1)) {
      current = current && ConstantNames.stepInto(current, step, walk);
    }
    const property = rest.at(-1)!;
    const name = LengthProperty.parse(property);
    if (current === null || name === null) {
      return ConstantNames.without(
        current !== null && LengthProperty.isLength(property)
          ? "unfolded"
          : "member",
        walk,
      );
    }
    // ADR-058: only a logical length is cnx's to fold; a runtime one and
    // C's memory are written for the program and the C compiler to answer
    const rule = LengthProperty.rule(name, ConstantNames.subjectOf(current));
    if (rule.kind === "memory") {
      const element = ConstantNames.memoryElementC(current, walk);
      return element === null
        ? ConstantNames.without("unfolded", walk)
        : {
            kind: "foreign",
            spelling: walk.spelling,
            why: "target",
            c: LengthProperty.memoryC(
              element,
              current.dimensions,
              name.unit === "bit_length",
            ),
          };
    }
    if (rule.kind === "error") return ConstantNames.without("lengthRule", walk);
    if (rule.kind !== "logical") return ConstantNames.without("unfolded", walk);
    const lookup = (cName: string) => walk.facts.visibleSymbol(cName);
    const struct =
      current.type.kind === "struct"
        ? LengthProperty.struct(
            QualifiedCName.fromSourceName(current.type.name),
            lookup,
          )
        : undefined;
    const header = ConstantNames.headerType(current.type, walk);
    const element = ConstantNames.elementBits(current, header, walk);
    const value = LengthProperty.of(
      name.unit,
      current.dimensions,
      element,
      struct?.fields.size ??
        (header === null ? null : walk.facts.headerFieldCount(header)),
    );
    return value === null
      ? ConstantNames.without("unfolded", walk)
      : { kind: "value", value: BigInt(value), typeName: null };
  }

  /**
   * A name a header declares. A variable -- even an `extern const` -- or a
   * function is not a constant expression in C, so it has no value, and as a
   * dimension it would be a VLA (#1768, #1863 review); a length property of an
   * array is measured from its declared dimensions (`cArr.type_element_count`)
   * and its element's width on the run's target. A header's struct type is
   * measured as its values are (#2076): `Cfg.type_byte_length`, `Cfg.a.type_bit_length`.
   * Anything else bare -- a C enum constant -- is C's to evaluate as written;
   * C has no spelling of `X.y` cnx could write for the rest.
   */
  private static ofForeign(
    name: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const value = walk.facts.foreignValue(name);
    if (value?.kind === "function") {
      return ConstantNames.without("function", walk);
    }
    if (value === null) {
      if (rest.length === 0) {
        return { kind: "foreign", spelling: walk.spelling, why: "header" };
      }
      const type = walk.facts.headerTypeHead(name);
      return type === null
        ? ConstantNames.without("member", walk)
        : ConstantNames.ofMember({ type, dimensions: [] }, rest, walk);
    }
    if (rest.length === 0) return ConstantNames.without("variable", walk);
    return ConstantNames.ofMember(
      {
        type: { kind: "external", name: value.type },
        dimensions: value.dimensions,
      },
      rest,
      walk,
    );
  }

  /** One element's memory as C measures it; null for a type cnx cannot name */
  private static memoryElementC(
    current: IMeasured,
    walk: IWalk,
  ): string | null {
    const type = current.type;
    switch (type.kind) {
      case "string":
        return `${LengthProperty.stringBufferChars(type.capacity)}U`;
      case "primitive": {
        const cType = CNX_TO_C_TYPE_MAP[type.primitive];
        return cType === undefined ? null : `sizeof(${cType})`;
      }
      case "struct":
      case "enum":
      case "bitmap": {
        const cName = QualifiedCName.fromSourceName(type.name);
        const tag = walk.facts.headerNeedsStructKeyword(cName) ? "struct " : "";
        return `sizeof(${tag}${cName})`;
      }
      case "external": {
        const tag = walk.facts.headerNeedsStructKeyword(type.name)
          ? "struct "
          : "";
        return `sizeof(${tag}${type.name})`;
      }
      default:
        return null;
    }
  }

  /** A measured value as ADR-058's length rule asks about it */
  private static subjectOf(current: IMeasured): ILengthSubject {
    const type = current.type;
    const primitive = type.kind === "primitive" ? type.primitive : "";
    let category: TEssentialCategory = "none";
    if (TypeCheckUtils.isUnsigned(primitive)) category = "unsigned";
    else if (TypeCheckUtils.isSigned(primitive)) category = "signed";
    else if (TypeCheckUtils.isFloat(primitive)) category = "floating";
    else if (primitive === "bool") category = "boolean";
    else if (type.kind === "enum") category = "enum";
    return {
      namesType: false,
      category,
      isString: type.kind === "string" && current.dimensions.length === 0,
      isArray: current.dimensions.length > 0,
      isStruct: type.kind === "struct",
      isBitField: current.bitField !== undefined,
      spelling: "",
    };
  }

  /** One element's bits of a measured value; null when not known here */
  private static elementBits(
    current: IMeasured,
    header: string | null,
    walk: IWalk,
  ): number | null {
    if (current.bitField !== undefined) return current.bitField;
    // #2076: a header's type is measured as render measures it
    if (header !== null) return walk.facts.headerTypeBits(header);
    return LengthProperty.elementBitsOfType(
      current.type,
      (cName) => walk.facts.visibleSymbol(cName),
      (name) => walk.facts.headerTypeBits(name),
    );
  }

  /**
   * The C type a header gave a measured value; null for a cnx type. 1.3
   * types a name it does not know as a struct (`Cfg c;`), a header's too.
   */
  private static headerType(type: TType, walk: IWalk): string | null {
    if (type.kind === "external") return type.name;
    if (type.kind !== "struct") return null;
    const isCnx =
      walk.facts.visibleSymbol(
        QualifiedCName.fromSourceName(type.name),
      ) !== undefined;
    return !isCnx && walk.facts.headerStructFields(type.name) !== undefined
      ? type.name
      : null;
  }

  /** One step of a measured walk: into an element, or into a field */
  private static stepInto(
    current: IMeasured,
    step: string,
    walk: IWalk,
  ): IMeasured | null {
    if (step !== ELEMENT_STEP)
      return ConstantNames.fieldOf(current, step, walk);
    return current.dimensions.length > 0
      ? { type: current.type, dimensions: current.dimensions.slice(1) }
      : null;
  }

  /** A field of a struct value, measured as declared; null for anything else */
  private static fieldOf(
    current: IMeasured,
    field: string,
    walk: IWalk,
  ): IMeasured | null {
    if (current.dimensions.length > 0) return null;
    const headerType = ConstantNames.headerType(current.type, walk);
    if (headerType !== null) {
      const header = walk.facts.headerStructFields(headerType)?.get(field);
      if (!header) return null;
      const bitField = ForeignTypeFacts.bitFieldWidth(header);
      return {
        type: { kind: "external", name: header.type },
        dimensions: header.arrayDimensions ?? [],
        ...(bitField !== undefined && { bitField }),
      };
    }
    if (current.type.kind !== "struct") return null;
    const struct = walk.facts.visibleSymbol(
      QualifiedCName.fromSourceName(current.type.name),
    );
    const info =
      struct?.kind === "struct" ? struct.fields.get(field) : undefined;
    return info
      ? {
          type: info.type,
          dimensions: LengthProperty.fieldDimensions(
            info.type,
            info.dimensions ?? [],
          ),
        }
      : null;
  }

  /** `Scope.member`, and `Scope.EMode.MEMBER` */
  private static ofScopeMember(
    scopePath: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const member = rest[0];
    const more = rest.slice(1);
    if (member === undefined) return ConstantNames.without("scope", walk);
    const cName = ScopeUtils.getTranspiledCName({ name: member, scopePath });
    const symbol = walk.facts.visibleSymbol(cName);
    // A member variable is `target`'s, which reads it as its own binding
    if (symbol?.kind === "enum" && ConstantNames.namesMember(symbol, more)) {
      return walk.facts.enumMember(cName, more[0], walk.spelling, walk.at);
    }
    if (symbol === undefined) {
      return ConstantNames.without("undeclaredMember", walk);
    }
    // #1975 review: `Geo.Box.type_byte_length`, as a bare `Point.type_byte_length`
    const type = more.length === 0 ? null : TypeHead.ofSymbol(symbol, cName);
    if (type !== null) {
      return ConstantNames.ofMember({ type, dimensions: [] }, more, walk);
    }
    // A function or a type the scope declares has no value
    return ConstantNames.without(
      symbol.kind === "function" ? "function" : "member",
      walk,
    );
  }

  /**
   * A head the binder binds to no value names a type, if anything: an enum's
   * member is `EColor.COUNT`, qualified by ADR-057 as a type is, so a scope's
   * own enum shadows a global one of the name.
   */
  private static ofTypeHead(
    root: TChainRoot,
    head: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (rest.length === 0) return ConstantNames.unbound(root, head, rest, walk);
    const cName = ScopeUtils.typeHeadCName(
      root,
      head,
      walk.facts.scopePathAt(walk.at),
      (name) => walk.facts.isScopeTypeVisible(name),
    );
    const symbol = walk.facts.visibleSymbol(cName);
    if (symbol?.kind === "enum" && ConstantNames.namesMember(symbol, rest)) {
      return walk.facts.enumMember(cName, rest[0], walk.spelling, walk.at);
    }
    // #1975: a type answers the length properties its values do --
    // `u32.type_byte_length`, `Point.y.type_byte_length`, `EMode.type_bit_length`, and
    // `this.P.type_byte_length`, `global.Point.type_byte_length` (#1975 review)
    const type = ConstantNames.typeNamed(root, head, cName, symbol, walk);
    return type === null
      ? ConstantNames.unbound(root, head, rest, walk)
      : ConstantNames.ofMember({ type, dimensions: [] }, rest, walk);
  }

  /** `EMode.RUN`: one name after the enum, a member and not a length of it */
  private static namesMember(
    symbol: TSymbol & { kind: "enum" },
    rest: ReadonlyArray<string>,
  ): boolean {
    return (
      rest.length === 1 &&
      !(LengthProperty.isLength(rest[0]) && !symbol.members.has(rest[0]))
    );
  }

  /** The type a chain's head names, a header's struct too; null for none */
  private static typeNamed(
    root: TChainRoot,
    head: string,
    cName: string,
    symbol: TSymbol | undefined,
    walk: IWalk,
  ): TType | null {
    const named =
      (root === null ? TypeHead.primitive(head) : null) ??
      TypeHead.ofSymbol(symbol, cName);
    if (named !== null) return named;
    // #2076: a header's type, which no cnx symbol names
    return root !== "this" && symbol === undefined
      ? walk.facts.headerTypeHead(head)
      : null;
  }

  /**
   * A name nothing binds. A `#define` never reaches the symbol model, so one
   * no declaration of the file would bind, in a file that includes a header,
   * may be a macro -- C's to evaluate, as E0427 leaves it (#1175). Elsewhere it is
   * undeclared, which E0427 reports.
   */
  private static unbound(
    root: TChainRoot,
    head: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (!walk.facts.mayBeHeaderName(root, head, walk.at)) {
      return ConstantNames.without("unknown", walk);
    }
    // A macro is a bare name: C has no spelling for `X.y` that cnx could
    // write for it
    return rest.length === 0
      ? { kind: "foreign", spelling: walk.spelling, why: "maybeHeader" }
      : ConstantNames.without("member", walk);
  }

  private static without(reason: TReason, walk: IWalk): TConstResult {
    return {
      kind: "notConstant",
      reason,
      spelling: walk.spelling,
      at: walk.at,
    };
  }
}

export default ConstantNames;
