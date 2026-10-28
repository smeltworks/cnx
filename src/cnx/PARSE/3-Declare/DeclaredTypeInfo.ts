/**
 * #1668 (C7): a binding's declared type in the shape 2.2 and render read,
 * `TTypeInfo` -- the one projection from what the program declares to the
 * type facts the per-file registry used to hold.
 *
 * The registry was written by declaration walks and read by name, so a
 * function's locals shared one flat key space: an inner block's `x` and its
 * sibling's `x` were one entry, a `for` variable was never entered, and a
 * string global read as a C buffer in its own file and as a scalar in the
 * next. A binding is already the answer to "which declaration does this name
 * mean here", so this only says what that declaration's type looks like --
 * the same way for a local, a global, and a global read from another file.
 */
import DeclaredPointer from "../../utils/DeclaredPointer";
import DeclaredTypeFacts from "../../utils/DeclaredTypeFacts";
import ForeignTypeFacts from "../../utils/ForeignTypeFacts";
import TypeResolver from "../../utils/TypeResolver";
import TypeMapping from "../../utils/mapType";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import ArrayDimensionText from "../../utils/ArrayDimensionText";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type TOverflowBehavior from "../../types/TOverflowBehavior";
import type TTypeInfo from "../../types/TTypeInfo";
import type TType from "../../types/TType";
import type TValueBinding from "../../types/TValueBinding";
import type IChainTyping from "../../types/IChainTyping";
import type IChainBase from "../../types/IChainBase";
import type ITargetDescription from "../../types/ITargetDescription";

/** What a local declaration and a variable symbol both say */
interface IDeclared {
  readonly name: string;
  readonly type: TType;
  readonly arrayDimensions: ReadonlyArray<number | string>;
  readonly isConst: boolean;
  readonly isAtomic: boolean;
  readonly overflowBehavior: TOverflowBehavior;
  readonly initialValue: string | null;
  readonly initializerCallee: string | null;
}

class DeclaredTypeInfo {
  /**
   * @param target the run's target, whose data model types a header
   *   variable (a `double` is f32 on AVR)
   */
  static of(
    binding: TValueBinding | null,
    symbols: ICodeGenSymbols | null,
    symbolTable: IResolvedSymbols,
    target: ITargetDescription | null,
  ): TTypeInfo | undefined {
    switch (binding?.kind) {
      case "local": {
        const declaration = binding.declaration;
        if (declaration.kind === "parameter") {
          return DeclaredTypeInfo.parameter(declaration, symbols, symbolTable);
        }
        return DeclaredTypeInfo.declared(declaration, symbols, symbolTable);
      }
      case "variable": {
        const symbol = binding.symbol;
        return DeclaredTypeInfo.declared(
          {
            ...symbol,
            arrayDimensions: symbol.arrayDimensions ?? [],
            initialValue: symbol.initialValue ?? null,
            initializerCallee: symbol.initializerCallee ?? null,
          },
          symbols,
          symbolTable,
        );
      }
      case "foreign":
        return ForeignTypeFacts.variableTypeInfo(
          symbolTable,
          binding.name,
          target,
        );
      default:
        return undefined;
    }
  }

  /**
   * What an assignment target writes, from the typer's chain of it: its root
   * as the spelling binds at the target (`this.`/`global.` included), and the
   * declared type of the variable written -- the root, or for `Scope.member`
   * the member.
   */
  static ofChain(
    chain: IChainTyping,
    symbols: ICodeGenSymbols | null,
    symbolTable: IResolvedSymbols,
    target: ITargetDescription | null,
  ): IChainBase {
    const rootTypeInfo = DeclaredTypeInfo.of(
      chain.root,
      symbols,
      symbolTable,
      target,
    );
    const last = chain.steps.at(-1);
    if (DeclaredTypeInfo.nameSteps(chain) === 0) {
      return { root: chain.root, rootTypeInfo, typeInfo: rootTypeInfo, last };
    }
    const member = chain.steps[0]?.after?.binding ?? null;
    return {
      root: chain.root,
      rootTypeInfo,
      typeInfo: DeclaredTypeInfo.of(member, symbols, symbolTable, target),
      last,
    };
  }

  /**
   * How many of a chain's steps belong to the variable's NAME: a scope's
   * member (`Scope.member`) is one; `x`, `this.x` and `global.x` bind in the
   * root, so none. The steps after them are operations on the variable. The
   * one answer `ofChain` and every reader of "is this a name, and what
   * follows it" share (#1668: it was spelled twice, and a third copy missed
   * `Scope.arr[i]`).
   */
  static nameSteps(chain: IChainTyping): number {
    return chain.root?.kind === "scope" ? 1 : 0;
  }

  /** A local or a global: what its declaration says, as C will hold it */
  private static declared(
    d: IDeclared,
    symbols: ICodeGenSymbols | null,
    symbolTable: IResolvedSymbols,
  ): TTypeInfo {
    const dimensions = ArrayDimensionText.numeric(d.arrayDimensions);
    if (d.type.kind === "string") {
      // ADR-045: a string is its C buffer, one wider than its capacity
      return {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        arrayDimensions: [...dimensions, d.type.capacity + 1],
        isConst: d.isConst,
        isString: true,
        stringCapacity: d.type.capacity,
        overflowBehavior: d.overflowBehavior,
        isAtomic: d.isAtomic,
      };
    }
    const baseType = TypeResolver.getTypeName(d.type);
    const isArray = dimensions.length > 0;
    return {
      baseType,
      isArray,
      arrayDimensions: isArray ? dimensions : undefined,
      isConst: d.isConst,
      overflowBehavior: d.overflowBehavior,
      isAtomic: d.isAtomic,
      ...DeclaredTypeFacts.of(baseType, symbols, TYPE_WIDTH[baseType] || 0),
      isPointer: DeclaredPointer.of(
        {
          cType: TypeMapping.mapType(baseType),
          name: d.name,
          initializerCallee: d.initializerCallee,
          initialValue: d.initialValue,
        },
        symbolTable,
      ),
    };
  }

  /**
   * A parameter, as its function's context holds it: a scalar string is
   * `string`, an array of strings carries the buffer dimension, and a C
   * typedef struct is reached through a pointer (#958). Parameters have no
   * ADR-044 behavior of their own (#1681).
   */
  private static parameter(
    d: IDeclared,
    symbols: ICodeGenSymbols | null,
    symbolTable: IResolvedSymbols,
  ): TTypeInfo {
    const dimensions = ArrayDimensionText.numeric(d.arrayDimensions);
    const isArray = dimensions.length > 0;
    const capacity = d.type.kind === "string" ? d.type.capacity : undefined;
    // The bare `string` keyword resolves as a struct named `string`
    const isString =
      d.type.kind === "string" ||
      (d.type.kind === "struct" && d.type.name === "string");
    let baseType = TypeResolver.getTypeName(d.type);
    if (isString && !isArray) baseType = "string";
    if (capacity !== undefined && isArray) dimensions.push(capacity + 1);
    return {
      baseType,
      isArray,
      arrayDimensions: dimensions.length > 0 ? dimensions : undefined,
      isConst: d.isConst,
      // #1681: a compound assignment to a parameter clamps like any target
      overflowBehavior: d.overflowBehavior,
      ...DeclaredTypeFacts.of(baseType, symbols, TYPE_WIDTH[baseType] || 0),
      isString,
      stringCapacity: isString ? capacity : undefined,
      // #958, ADR-030: a handle is held through a pointer -- the one predicate
      ...(DeclaredPointer.isHandleType(baseType, symbolTable) && {
        isPointer: true,
      }),
    };
  }
}

export default DeclaredTypeInfo;
