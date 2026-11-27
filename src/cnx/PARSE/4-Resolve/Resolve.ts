/**
 * 1.4 Resolve over 1.3's artifact (#1991): the whole program, built once every
 * file is declared, with the declared files carried forward for 2.1.
 *
 * What 1.4 reads off each declared file -- whether it reaches a foreign header,
 * its cnx includes, its target directives -- is taken here, from 1.3's
 * artifact, not handed in by the host.
 */
import type IMacroReader from "./types/IMacroReader";
import type IUnreadBitWidth from "../../types/IUnreadBitWidth";
import UnreadBitWidth from "../../utils/UnreadBitWidth";
import type IDeclaredSources from "../3-Declare/types/IDeclaredSources";
import HeaderMacros from "./HeaderMacros";
import Program from "./Program";
import type THeaderMacro from "../../types/THeaderMacro";
import type IResolvedProgram from "./types/IResolvedProgram";

class Resolve {
  static program(input: IDeclaredSources): IResolvedProgram {
    const declared = input.declared;
    const table = input.symbolTable;
    // #1688: each file's header macros, typed (ADR-024) from the macro dump
    // 1.1 took of that file's own C includes. Unread is not "no macros".
    const macros = new Map<string, ReadonlyMap<string, THeaderMacro>>();
    const macrosUnread = new Set<string>();
    // #1881: each file's macros, of either kind, and every macro any file's
    // C includes define
    const visibleMacros = new Map<string, ReadonlySet<string>>();
    const macroNames = new Set<string>();
    // #1619: one compiler reads every file's headers, so its predefined
    // `<stdint.h>` types are the same in each dump
    const integerTypes = new Map<string, string>();
    const macroBodies: ReadonlyMap<string, string>[] = [];
    const macroReaders: (IMacroReader & {
      readonly headerFiles: ReadonlySet<string>;
    })[] = [];
    for (const [path, read] of input.discovery.headerMacroDumps) {
      if (!read.complete) macrosUnread.add(path);
      if (read.dump === null) continue;
      macros.set(path, HeaderMacros.collect(read.dump));
      macroBodies.push(HeaderMacros.bodies(read.dump));
      macroReaders.push({
        file: path,
        bodies: macroBodies.at(-1)!,
        redefinedNames: read.redefinedNames,
        headerFiles: new Set(read.headerFiles),
      });
      const names = HeaderMacros.names(read.dump);
      visibleMacros.set(path, new Set(names));
      for (const name of names) macroNames.add(name);
      for (const [name, type] of HeaderMacros.integerTypes(read.dump)) {
        integerTypes.set(name, type);
      }
    }
    // #2494: a bit-field's width is read once, as C reads it, before any
    // field is typed from the table -- through the macros of the files that
    // include the struct's header, which are the files whose C reads it
    // #2510 review: every name a header declares that a bound can read -- an
    // enumerator, a variable, a function, whose address a C++ constant
    // expression tests, or a typedef, which a bound reads as a cast
    // (`[(word_t)+3]` is 3) -- which a macro of the same name may not stand
    // for. A tag or a namespace names nothing an expression reads.
    const tagOnly = new Set(["struct", "enum", "class", "namespace"]);
    const declaredBy = new Map<string, string[]>();
    const declare = (header: string, name: string): void => {
      const names = declaredBy.get(header);
      if (names === undefined) declaredBy.set(header, [name]);
      else names.push(name);
    };
    for (const symbol of table.getAllCSymbols()) {
      if (!tagOnly.has(symbol.kind)) declare(symbol.sourceFile, symbol.name);
    }
    for (const symbol of table.getAllCppSymbols()) {
      if (!tagOnly.has(symbol.kind)) {
        declare(symbol.sourceFile, symbol.unqualifiedName);
      }
    }
    // A name stops a reading only in a translation unit that holds it. A
    // header only OTHER files' compiles opened is another unit's: C never
    // reads its declarations or its `#undef`s here. A header no compile is
    // known to have opened still counts, since cnx cannot place it.
    const opened = new Set(
      macroReaders.flatMap((reader) => [...reader.headerFiles]),
    );
    const unreadNames = new Map<
      string,
      {
        readonly undefinedNames: ReadonlySet<string>;
        readonly declaredNames: ReadonlySet<string>;
      }
    >();
    const read = (
      text: string,
      header: string | undefined,
      structName?: string,
    ): number | IUnreadBitWidth => {
      const including = macroReaders.filter(
        (reader) => header !== undefined && reader.headerFiles.has(header),
      );
      const key = including.map((reader) => reader.file).join("\n");
      let names = unreadNames.get(key);
      if (names === undefined) {
        const own = new Set(
          including.flatMap((reader) => [...reader.headerFiles]),
        );
        const inUnit = (path: string): boolean =>
          own.has(path) || !opened.has(path);
        names = {
          undefinedNames: table.undefinedMacros(inUnit),
          declaredNames: new Set(
            [...declaredBy].flatMap(([path, declared]) =>
              inUnit(path) ? declared : [],
            ),
          ),
        };
        unreadNames.set(key, names);
      }
      // A C++ struct's own enum constants it alone reads, `data[N]` in
      // `struct P { enum { N = 3 } kind; uint8_t data[N]; };`, its bases'
      // among them. A base cnx cannot see may declare any name the text reads.
      const scoped =
        structName === undefined || header === undefined
          ? []
          : (table.getStructScopedNames(structName, header) ??
            text.match(/[A-Za-z_]\w*/g) ??
            []);
      return HeaderMacros.width(
        text,
        including,
        names.undefinedNames,
        scoped.length === 0
          ? names.declaredNames
          : new Set([...names.declaredNames, ...scoped]),
      );
    };
    table.settleBitFieldWidths((text, structName, declaredIn) =>
      read(
        text,
        declaredIn ??
          table.getCSymbol(structName)?.sourceFile ??
          table.getCppSymbol(structName)?.sourceFile,
        structName,
      ),
    );
    // A header array's macro dimension, `table[SENSOR_COUNT]`, is read the
    // same way, as C reads it: through the macros of the files that include
    // the array's header, and not at all from a macro one of their headers
    // `#undef`s
    table.settleArrayDimensions((text, header, structName) => {
      const count = read(text, header, structName);
      return typeof count === "number" && count <= 0
        ? UnreadBitWidth.notPositiveCount(count)
        : count;
    });
    const program = Program.build(
      declared.map((entry) => entry.fileSymbols),
      {
        // #1511: everything the C/C++ headers contributed, from 1.3's table.
        // The opacity inputs are the raw bookkeeping, not the verdict --
        // `Program` resolves which typedefs never received a body. #985's
        // phantom-body recovery ran in 1.3, so the state is final: a struct
        // known only through it has its fields here, and a read before 1.3
        // would drop it from `externalStructFields`, exempting it from
        // ADR-016's init-completeness check, the fact's one consumer.
        headerStructFields: table.getAllStructFields(),
        foreign: {
          c: table.getAllCSymbols(),
          cpp: table.getAllCppSymbols(),
          opaqueTypedefs: new Set(table.getAllOpaqueTypes()),
          typedefToTag: new Map(table.getAllTypedefToTag()),
          structTagsWithBodies: new Set(table.getAllStructTagsWithBodies()),
          macros,
          macrosUnread,
          visibleMacros,
          macroNames,
          integerTypes,
          disputedHeaders: table.getDisputedHeaders(),
          unreadDimensions: table.getUnreadDimensions(),
        },
        // #1825: ADR-006's and ADR-029's derivations look callees and typedefs
        // up in it. 1.4 completes it with every file's resolved symbols and
        // hands it on as `program.symbolTable()` (#1991).
        symbolTable: table,
        registry: input.registry,
        // #1428: 1.1's one answer, which every pass after 1.4 reads from here
        cppMode: input.discovery.cppMode,
        // #1175: where a name nothing binds may be a macro -- discovery's
        // one answer, the same 2.1's E0427 reads
        filesIncludingForeignHeaders: new Set(
          declared
            .filter((entry) => entry.file.includesForeignHeader)
            .map((entry) => entry.fileSymbols.sourceFile),
        ),
        // #1881: the headers each file's own C includes bring in, the only
        // ones whose names it sees: the walk's, and the preprocessor's
        headerPathsByFile: new Map(
          [...input.discovery.includes].map(([path, own]) => [
            path,
            new Set([
              ...own.cHeaderPaths,
              ...(input.discovery.headerMacroDumps.get(path)?.headerFiles ??
                []),
            ]),
          ]),
        ),
        visibility: {
          cnxIncludesByFile: new Map(
            declared.map((entry) => [entry.file.path, entry.file.cnxIncludes]),
          ),
        },
        // #1713: ADR-049's one target, which 1.2 chose
        target: input.target,
      },
    );
    return { program, sources: declared, discovery: input.discovery };
  }
}

export default Resolve;
