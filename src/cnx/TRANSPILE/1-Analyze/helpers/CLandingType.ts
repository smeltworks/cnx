/**
 * #2348 review: the C type of the place a value lands in -- a declaration, an
 * element of an initializer, a field, an element, a parameter, an
 * assignment's target of any shape, or a return -- one element of it. A
 * `cstring` is `const char*` (ADR-046), so whether it may land there is a
 * question about that type, not about how the write is spelled: E0900 for a
 * `char*` C may write through, E0879 for a function returning one.
 */
import type IValuePositions from "../../../types/IValuePositions";
import type TExpression from "../../../types/syntax/TExpression";
import type TExpressionOf from "../../../types/syntax/TExpressionOf";
import type TValueSite from "../../../types/TValueSite";
import OperandTyper from "../../../utils/OperandTyper";
import TypeText from "../../../utils/TypeText";
import CStringArgument from "../../../utils/CStringArgument";
import TypedefParamParser from "../../../utils/TypedefParamParser";
import CCallee from "./CCallee";
import FunctionReference from "./FunctionReference";
import StructInitializerType from "./StructInitializerType";
import ValuePositions from "./ValuePositions";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICCallee from "../types/ICCallee";
import type ICParameterInfo from "../../../types/symbols/c/ICParameterInfo";
import type ICppParameterInfo from "../../../types/symbols/cpp/ICppParameterInfo";

/** The place, as C declares it */
interface IPlace {
  readonly type: string;
  /** A function-pointer parameter whose nested declarator `type` does not spell: `type` is its return */
  readonly returnsType: boolean;
}

class CLandingType {
  /** The sites a value lands in; a comparison, an index or a target is none */
  static isLanding(site: TValueSite): boolean {
    return (
      site.kind === "declaration" ||
      site.kind === "assignment" ||
      site.kind === "return" ||
      site.kind === "field" ||
      site.kind === "argument"
    );
  }

  /** The C type of the place `value` lands in, one element of it; null where none is known */
  static of(
    value: TExpression,
    positions: IValuePositions,
    context: IAnalysisContext,
  ): string | null {
    return CLandingType.preferred(
      CLandingType.placesOf(value, positions, context)
        .filter((place) => !place.returnsType)
        .map((place) => place.type),
      context,
    );
  }

  /**
   * What a function landing at `value`'s place must return: a function
   * pointer's return, through a typedef of one or written inline; null where
   * the place is not a function pointer C declares
   */
  static returnOf(
    value: TExpression,
    positions: IValuePositions,
    context: IAnalysisContext,
  ): string | null {
    return CLandingType.preferred(
      CLandingType.placesOf(value, positions, context)
        .map((place) => CLandingType.returnOfPlace(place, context))
        .filter((returned) => returned !== null),
      context,
    );
  }

  /**
   * Of the types a value may land in -- one per C++ overload the call can
   * reach -- the one C++ calls with a `cstring` or a function returning one:
   * a type that is not a writable `char*`, where there is one (#2348 review)
   */
  private static preferred(
    types: readonly string[],
    context: IAnalysisContext,
  ): string | null {
    return (
      types.find(
        (type) =>
          !CStringArgument.isWritableCharPointer(type, context.symbolTable),
      ) ??
      types[0] ??
      null
    );
  }

  /** A function-pointer place's return; null for any other place */
  private static returnOfPlace(
    place: IPlace,
    context: IAnalysisContext,
  ): string | null {
    if (place.returnsType) return place.type;
    const symbols = context.symbolTable;
    const typedef = symbols.getCSymbol(place.type);
    const functionType =
      typedef?.kind === "type" && symbols.isCFunctionPointerTypedef(place.type)
        ? `${typedef.isConst === true ? "const " : ""}${typedef.type}`
        : place.type;
    return TypedefParamParser.parse(functionType)?.returnType ?? null;
  }

  /** The C callee and argument index `value` is passed as, when it is one */
  static cArgumentOf(
    value: TExpression,
    positions: IValuePositions,
    context: IAnalysisContext,
  ): { readonly callee: ICCallee; readonly index: number } | null {
    const site = positions.sites.get(value)?.site;
    if (site?.kind !== "argument") return null;
    const callee = CLandingType.cCalleeOf(site.call, site.op, context);
    return callee === null ? null : { callee, index: site.argument };
  }

  /** Each place `value` may land in: one, or a C++ overload set's parameters */
  private static placesOf(
    value: TExpression,
    positions: IValuePositions,
    context: IAnalysisContext,
  ): IPlace[] {
    const site = positions.sites.get(value)?.site;
    const type = (text: string | null | undefined): IPlace[] =>
      text === null || text === undefined
        ? []
        : [{ type: TypeText.withoutDimensions(text), returnsType: false }];
    switch (site?.kind) {
      case "declaration":
        return type(site.declaration.type.text);
      case "return":
        return type(site.function.returnType.text);
      case "assignment":
        return type(CLandingType.targetOf(site.assignment.target, context));
      case "field":
        return type(
          CLandingType.fieldOf(
            StructInitializerType.valueTypeAt(
              ValuePositions.at(positions.positions, site.initializer),
            ),
            site.field,
            context,
          ),
        );
      case "argument": {
        // A C callee's parameters as its header writes them; a cnx one's from the walk
        const parameters = CLandingType.cParametersOf(
          site.call,
          site.op,
          site.argument,
          context,
        );
        return parameters.length > 0
          ? parameters
          : type(ValuePositions.at(positions.positions, value).typeText);
      }
      default:
        return [];
    }
  }

  /** An assignment target's: the last field it names, or the variable */
  private static targetOf(
    target: TExpression,
    context: IAnalysisContext,
  ): string | null {
    const chain = OperandTyper.chainOf(target, context);
    const field = chain.steps.filter((step) => step.member !== null).at(-1);
    if (field !== undefined) {
      return CLandingType.fieldOf(
        field.before?.typeName ?? null,
        field.member,
        context,
      );
    }
    if (chain.root?.kind === "foreign") {
      const symbol = context.symbolTable.getCSymbol(chain.root.name);
      return symbol?.kind === "variable" ? symbol.type : null;
    }
    return OperandTyper.typeOfTarget(target, context)?.typeName ?? null;
  }

  /** A field of a struct a header or the program declares */
  private static fieldOf(
    structType: string | null,
    field: string | null,
    context: IAnalysisContext,
  ): string | null {
    if (structType === null || field === null) return null;
    return (
      context.symbolTable.getStructFieldTypes(structType)?.get(field) ??
      context.symbols.structFields.get(structType)?.get(field) ??
      null
    );
  }

  /** A C parameter in every overload the call can reach; an array one is C's pointer */
  private static cParametersOf(
    call: TExpressionOf<"postfix">,
    op: number,
    index: number,
    context: IAnalysisContext,
  ): IPlace[] {
    const callee = CLandingType.cCalleeOf(call, op, context);
    return (callee === null ? [] : CCallee.reachable(callee))
      .map((signature) => signature.parameters[index])
      .filter((parameter) => parameter !== undefined)
      .map(CLandingType.parameterPlace);
  }

  private static parameterPlace(
    parameter: ICParameterInfo | ICppParameterInfo,
  ): IPlace {
    // `const char*` lowers to `char*` with `isConst`, which the type then spells
    const constness = parameter.isConst ? "const " : "";
    if ("isFunctionPointer" in parameter && parameter.isFunctionPointer) {
      return { type: `${constness}${parameter.type}`, returnsType: true };
    }
    const type =
      parameter.isArray === true ? `${parameter.type}*` : parameter.type;
    return { type: `${constness}${type}`, returnsType: false };
  }

  private static cCalleeOf(
    call: TExpressionOf<"postfix">,
    op: number,
    context: IAnalysisContext,
  ): ICCallee | null {
    return (
      FunctionReference.callsIn(
        call,
        OperandTyper.scopePathAt(call.span, context),
        context,
      ).find((chainCall) => chainCall.callAt === op)?.cCallee ?? null
    );
  }
}

export default CLandingType;
