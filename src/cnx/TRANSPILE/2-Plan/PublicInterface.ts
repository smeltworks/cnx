import RegisterInstance from "../../utils/RegisterInstance";
import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type TSymbol from "../../types/symbols/TSymbol";
import type TType from "../../types/TType";
import ScopeUtils from "../../utils/ScopeUtils";
import invariant from "../../utils/invariant";

/**
 * Issues #1161 and #1164 — the single answer to "which symbols form this
 * file's public C interface?"
 *
 * Two predicates used to answer that question and disagreed. One decided
 * whether a `.h` was written (`isExported`, counting functions, structs, enums,
 * bitmaps and consts); the other decided whether the generated `.c` included it
 * (scope-member visibility, which nothing declared at top level can satisfy).
 * When they disagreed a header was written that nothing included, so every
 * external-linkage definition in that `.c` lost its visible declaration
 * (MISRA C:2012 Rule 8.4) and the `.c` redefined inline the very types the
 * header already declared.
 *
 * Both decisions now resolve here. Callers must ask this class rather than
 * re-derive the answer — two callers that merely agree today are a latent
 * divergence, which is what the two issues above were.
 */
class PublicInterface {
  /**
   * The symbols that make up this file's generated header, in collection order.
   */
  static forFile(symbolTable: IResolvedSymbols, sourcePath: string): TSymbol[] {
    const fileSymbols = symbolTable.getTSymbolsByFile(sourcePath);
    const reachable = PublicInterface.typeClosure(fileSymbols);

    return fileSymbols.filter(
      (symbol) =>
        PublicInterface.isHeaderVisible(symbol) ||
        reachable.has(symbol.fullyQualifiedCName),
    );
  }

  /**
   * Whether this file's generated header DEFINES the given type, named by its
   * transpiled C name.
   *
   * #1300: codegen emits a scope type into the `.c` exactly when this is false.
   * The two placements are complements of ONE decision, so codegen asks here
   * rather than re-deriving "is it private" -- those two answers agree only
   * until a public signature drags a private type into the header, and then the
   * type is defined in BOTH files and the C compiler rejects the redefinition.
   */
  static definesTypeInHeader(
    symbolTable: IResolvedSymbols,
    sourcePath: string,
    transpiledCName: string,
  ): boolean {
    return PublicInterface.forFile(symbolTable, sourcePath).some(
      (symbol) => symbol.fullyQualifiedCName === transpiledCName,
    );
  }

  /**
   * Whether these symbols form a public C interface: a header will be
   * generated, and the generated `.c` must include it.
   *
   * Takes the file's symbols rather than reading global state, so the `.c` and
   * its header cannot be decided from two different snapshots.
   */
  static existsIn(symbols: readonly TSymbol[]): boolean {
    return symbols.some((symbol) => PublicInterface.isHeaderVisible(symbol));
  }

  /**
   * Whether this symbol contributes a declaration to the generated header on
   * its own account, before the types it makes reachable are added.
   */
  private static isHeaderVisible(symbol: TSymbol): boolean {
    // #1300: `visibility` is the declared fact, on every kind. Four kinds used
    // to carry none, so their collectors hardcoded an exported flag and every
    // `private` struct, enum and bitmap reached the public header.
    if (symbol.visibility !== "public") {
      return false;
    }

    // Kinds no header path emits a declaration for. Counting one produces a
    // header holding only include guards — and, once the `.c` includes whatever
    // header exists, a self-include of that empty file.
    //
    // "scope" because a scope is a container, not a declaration: its members
    // are collected as symbols in their own right.
    //
    // A register IS part of the interface (#1453): its accessor `#define`s are
    // rendered into the header, which is the only file a `#define` can be
    // exported from. Before #1453 this line excluded registers because no
    // header path emitted one, so a board file declaring the hardware wrote an
    // empty header and every consumer's `HW.CTRL` reached the C compiler as an
    // undeclared name -- while E0427 reported "'HW' is not defined" for the
    // file that had declared it one include away.
    if (symbol.kind === "scope") {
      return false;
    }

    return !PublicInterface.isTopLevelMain(symbol);
  }

  /**
   * ADR-030: `main` has external linkage but is called by the C runtime, never
   * by another translation unit, so a prototype serves no consumer. MISRA
   * C:2012 Rule 8.4 exempts it for that reason while requiring a visible
   * declaration for every other external-linkage definition.
   *
   * Scoped members are not exempt: a `main` inside `scope Sample` transpiles to
   * `Sample__main`, which is an ordinary cross-file callee.
   */
  private static isTopLevelMain(symbol: TSymbol): boolean {
    return (
      symbol.kind === "function" &&
      symbol.name === "main" &&
      ScopeUtils.isGlobalScopePath(symbol.scopePath)
    );
  }

  /**
   * #1300: the private types a header-visible declaration forces into the
   * header, transitively.
   *
   * Not a privacy exception. C requires a COMPLETE type wherever a value of it
   * is declared, returned or passed, so a private type named by a public
   * signature has to be defined in the header or no caller can compile:
   *
   *     public Secret expose()      ->  Internal__Secret Internal__expose(void);
   *     public struct W { Secret s; }
   *     public Secret shared <- ...
   *
   * The type stays unnameable from outside -- cnx rejects `Internal.Secret`
   * in another scope either way -- so what reaches the header is completeness,
   * not access. Putting a type in a public signature opts it into the ABI, and
   * that is the author's decision to make.
   *
   * Without this the transpiler exits 0 and emits a header carrying only the
   * incomplete `typedef struct Internal__Secret Internal__Secret;`, which any
   * caller that touches the value fails to compile -- cnx green, cc red.
   */
  private static typeClosure(symbols: readonly TSymbol[]): Set<string> {
    // What a name can resolve to. Only type-forming kinds can be pulled in --
    // a header defines types, and a private function or variable is `static`
    // in the `.c` by design (ADR-016).
    //
    // Enum MEMBERS used to be indexed too, because an array dimension crossed
    // the header boundary as a member's NAME: `extern u8 v[Motor__State__COUNT]`
    // needed the enum defined though no declaration named `Motor__State`.
    // #1175: a dimension crosses as its value now (`extern u8 v[3]`), folded
    // once by 1.4 Resolve, so it names nothing this header must define.
    const definedBy = new Map<string, TSymbol>();
    for (const symbol of symbols) {
      // ADR-072: a register type a public signature takes is its layout
      if (
        symbol.kind === "struct" ||
        symbol.kind === "enum" ||
        symbol.kind === "bitmap" ||
        RegisterInstance.isType(symbol)
      ) {
        definedBy.set(symbol.fullyQualifiedCName, symbol);
      }
    }

    const reached = new Set<string>();
    const queue = symbols.filter((symbol) =>
      PublicInterface.isHeaderVisible(symbol),
    );

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const name of PublicInterface.namesReferencedBy(current)) {
        // Absent means it is not this file's to define -- a primitive, or a
        // type from an include, which the header already handles as an
        // external dependency.
        const definer = definedBy.get(name);
        if (definer === undefined || reached.has(definer.fullyQualifiedCName)) {
          continue;
        }
        reached.add(definer.fullyQualifiedCName);
        queue.push(definer);
      }
    }

    return reached;
  }

  /** Every name this symbol requires the header to declare: the types it names */
  private static namesReferencedBy(symbol: TSymbol): string[] {
    const names: string[] = [];
    const collect = (type: TType): void =>
      PublicInterface.collectTypeNames(type, names);

    if (symbol.kind === "function") {
      collect(symbol.returnType);
      for (const parameter of symbol.parameters) {
        collect(parameter.type);
      }
    } else if (symbol.kind === "variable") {
      collect(symbol.type);
    } else if (symbol.kind === "struct") {
      for (const field of symbol.fields.values()) {
        // `field.type` is the ELEMENT type. A field's dimensions used to be
        // walked too, for an enum member naming its bound -- the header wrote
        // `uint8_t data[Internal__Size__COUNT]`. #1175: it writes the value.
        collect(field.type);
      }
    } else if (symbol.kind === "register") {
      // #1453: a register's accessor casts to its member's type, so a type a
      // public register names must be defined by the header that exports the
      // register -- collected as a variable's is (#1514: whether or not this
      // file could tell it was a bitmap).
      for (const member of symbol.members.values()) {
        collect(member.type);
      }
    }

    return names;
  }

  /**
   * Flatten a TType to the names it depends on.
   *
   * An array needs its ELEMENT type complete; its dimensions are values, not
   * names (#1175). Primitives and strings name nothing -- a cnx string is
   * a fixed-capacity char array.
   */
  private static collectTypeNames(type: TType, into: string[]): void {
    if (type.kind === "array") {
      PublicInterface.collectTypeNames(type.elementType, into);
      return;
    }
    if (type.kind === "primitive" || type.kind === "string") {
      return;
    }
    // Named explicitly, because the fall-through below would otherwise ACCEPT
    // a deferred type: it carries a `name` field, so it matches structurally
    // and TypeScript cannot object. It would contribute the UNQUALIFIED name to
    // the public-interface closure, and this walk's failure mode is silence --
    // an unrecognized name is read as "not mine to define", so the header omits
    // a typedef and the generated C does not compile while the transpiler
    // exits 0.
    invariant(
      type.kind !== "deferred",
      "1.4 Resolve settles every deferred type before the public interface is walked",
    );
    into.push(type.name);
  }
}

export default PublicInterface;
