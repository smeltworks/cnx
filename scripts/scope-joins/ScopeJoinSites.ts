/**
 * Issues #1357 and #2116: the committed inventory of every place a qualified C
 * name is built.
 *
 * A qualified C name has exactly two sources. A symbol's own name comes from
 * its declaring scope's whole PATH, through the encoders in `ScopeUtils`, and
 * is materialized on the symbol (`fullyQualifiedCName`). A name the author
 * wrote in full -- `Motor.State.IDLE` -- is spelled for C by
 * `QualifiedCName.fromSourceName`. ADR-016 makes scopes flat -- they never nest
 * -- so a scope's name IS its path, and what a hand join gets wrong is not the
 * name but where it is decided: `Scope__member` spelled outside the encoders is
 * a second decider of the same spelling (#1285, #1357, #2116).
 *
 * #1357's version of this gate counted only `fromParts` calls whose first
 * element READ as a scope, by a name pattern, and let the other 32 through
 * never judged. It also could not see a join spelled as a template string, which is
 * how three render sites built names (#2116). So nothing here filters by name:
 * every builder call, every use of the separator and every `${...}__` template
 * is a site, and every site needs a reviewed judgement in `ADJUDICATIONS`.
 * A new site -- a scope join in any pass -- has none, and `check` exits 1.
 *
 * Keyed on a per-file COUNT of each distinct expression rather than `file:line`.
 * An eleven-site change once silently invalidated eighteen `file:line` citations
 * in `throw-classification.md` through pure line drift, and #1374 records that
 * a citation gate cannot detect two rows trading sites. A count cannot rot when
 * code moves and still fails the moment a file gains a site.
 */

import type ICheckOutcome from "../types/ICheckOutcome";

/** One distinct site expression in one file, and how many times it occurs there. */
interface ISite {
  readonly file: string;
  readonly element: string;
  readonly count: number;
}

/**
 * Why a site is not a scope join. An ORDERED partition: a site takes the FIRST
 * kind that applies, in the order declared here. Nothing computes the kind --
 * it is an argument made by whoever writes the row, which is why each row
 * carries a `why`. `TKind` and the document's bullets both derive from this
 * array, so they cannot disagree about the order.
 */
const KIND_SECTIONS = [
  {
    kind: "encoder",
    lines: [
      "- **encoder** -- the definition of the operation every other row is",
      "  judged against: `QualifiedCName`'s own separator, and the `ScopeUtils`",
      "  encoders that take a symbol's whole enclosing PATH.",
    ],
  },
  {
    kind: "written-name",
    lines: [
      "- **written-name** -- a name the author wrote in full, such as",
      "  `Motor.State.IDLE`, spelled for C component by component. Nothing is",
      "  resolved against an enclosing scope, so no scope spelling is decided here.",
    ],
  },
  {
    kind: "scope-path",
    lines: [
      "- **scope-path** -- handed the enclosing scope's PATH",
      "  (`currentScopePath`) and asks `QualifiedCName` for its prefix, so the",
      "  prefix is spelled by the separator's owner.",
    ],
  },
  {
    kind: "owner-c-name",
    lines: [
      "- **owner-c-name** -- a member of an entity whose C name is already",
      "  materialized from its path: an enum or register member, or a local",
      "  renamed under its function's C name. The encoders already spelled the",
      "  owner; this only appends the member, as ADR-016 and ADR-017 define.",
    ],
  },
  {
    kind: "recompute",
    lines: [
      "- **recompute** -- calls an encoder after the pass that owns the name",
      "  stored it. 3-Declare materializes every symbol's `fullyQualifiedCName`",
      "  and `cnxScopedName` (`ScopeUtils.identityOf`), so this decides again what",
      "  is already decided (cnx-way: compute once, then read). Each row is",
      "  converted to read the field, one commit per site, until none remain.",
    ],
  },
] as const;

type TKind = (typeof KIND_SECTIONS)[number]["kind"];

/** A reviewed judgement about one site expression. */
interface IAdjudication {
  readonly file: string;
  readonly element: string;
  readonly kind: TKind;
  readonly why: string;
}

class ScopeJoinSites {
  /**
   * The public `QualifiedCName` operations that build a qualified name, or a
   * scope's prefix, from text. `isInScope` builds `prefixFor` internally, so it
   * spells a scope prefix just as `fromSourceName` spells a name -- and was
   * invisible to #1357's scan (#2116). `MemberSeparatorResolver.join` is the
   * member access chain's one join, and a caller handing it a scope's name with
   * a register step would spell `Scope__member` outside the encoder.
   */
  private static readonly BUILDERS: readonly string[] = [
    "QualifiedCName.fromSourceName",
    "QualifiedCName.isInScope",
    "QualifiedCName.prefixFor",
    "MemberSeparatorResolver.join",
    "ScopeUtils.getTranspiledCName",
    "ScopeUtils.getCnxScopedName",
    "ScopeUtils.identityOf",
    "ScopeUtils.qualifyInScope",
    "ScopeUtils.qualifyPathInScope",
  ];

  /** The separator, wherever it is spelled by name. */
  private static readonly SEPARATOR = /\bQualifiedCName\.SEPARATOR\b/g;

  /**
   * The separator spelled as text: a template interpolation followed by `__`,
   * or a `"__"` literal joined or concatenated. `__bits_${name}` and
   * `startsWith("__")` are not joins and do not match.
   */
  private static readonly SPELLED_SEPARATOR =
    /\$\{[^{}`]*\}__|\.join\(\s*["']__["']\s*\)|\+\s*["']__["']|["']__["']\s*\+/g;

  /**
   * The reviewed judgement for every site the scan finds.
   *
   * Keyed on (file, element) rather than `file:line`, for the reason the module
   * docblock gives. An element moves WITH its expression, and when the
   * expression changes the site becomes unadjudicated and the gate says so: the
   * judgement was made about a specific expression.
   *
   * `check` fails on a site with no entry here and on an entry matching no
   * site, so this list can neither miss a site nor keep a stale judgement.
   */
  /** The one reason every `recompute` row shares, until the row is converted. */
  private static readonly RECOMPUTE =
    "calls an encoder outside 3-Declare; the name is already on the symbol, so this converts to reading it (#2116)";

  private static readonly ADJUDICATIONS: readonly IAdjudication[] = [
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/BitmapCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/CallbackUseCollector.ts",
      element: "qualifyInScope(members[0], scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/CallbackUseCollector.ts",
      element: "qualifyInScope(named, scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/CallbackUseCollector.ts",
      element: 'qualifyPathInScope([primary.name, ...members], "")',
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/CallbackUseCollector.ts",
      element: 'qualifyPathInScope(members, "")',
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/CallbackUseCollector.ts",
      element: 'qualifyPathInScope(path, "")',
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/EnumCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/FunctionCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/LexicalScopeCollector.ts",
      element: "getTranspiledCName({ name: fn.name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/ParameterListCollector.ts",
      element: "qualifyInScope(inner.declaration.name, scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/RegisterCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/StructCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/collectors/VariableCollector.ts",
      element: "identityOf({ name, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/index.ts",
      element: "qualifyInScope(typeName, scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/PARSE/3-Declare/cnx/utils/MemberSymbolBase.ts",
      element:
        "identityOf({ name: input.name, scopePath: input.parentScopedName, })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/TRANSPILE/1-Analyze/helpers/CalleeNameResolver.ts",
      element: "qualifyInScope(memberName, currentScopePath)",
      kind: "recompute",
      why: ScopeJoinSites.RECOMPUTE,
    },
    {
      file: "src/cnx/TRANSPILE/1-Analyze/helpers/CalleeNameResolver.ts",
      element: "qualifyInScope(memberName, resolvedName)",
      kind: "recompute",
      why: ScopeJoinSites.RECOMPUTE,
    },
    {
      file: "src/cnx/utils/QualifiedNameGenerator.ts",
      element: "getTranspiledCName(func)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/QualifiedNameGenerator.ts",
      element: "qualifyInScope(funcName, scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "getCnxScopedName(symbol)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "getTranspiledCName({ name: head, scopePath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "getTranspiledCName({ name: typeName, scopePath, })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "getTranspiledCName(symbol)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "identityOf({ name, scopePath: parentPath })",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "qualifyPathInScope([name], scopePath)",
      kind: "encoder",
      why: "the owning code: an encoder defined in terms of another, or 3-Declare materializing the name it stores on the symbol",
    },
    {
      file: "src/cnx/utils/TypeNameLadder.ts",
      element: "qualifyInScope(type.name, scopePath)",
      kind: "encoder",
      why: "3-Declare deciding a `this.T` type reference's C name as it builds the symbols; every later pass passes `memberCName` and reads the declared type's fullyQualifiedCName (#2116)",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/ConstantNames.ts",
      element: "fromSourceName(current.type.name)",
      kind: "written-name",
      why: "a resolved type's dotted name (`Motor.Config`) as its C struct key; the type carries its whole qualified name",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/ConstantNames.ts",
      element: "fromSourceName(parts.slice(1))",
      kind: "written-name",
      why: "`global.A.B`: everything after `global.` is the path as the author wrote it",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/ConstantNames.ts",
      element: "fromSourceName(qualified)",
      kind: "written-name",
      why: "a dotted type name as written; a bare one is first qualified from the enclosing PATH by `ScopeUtils.qualifyScopeType`",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/ConstantNames.ts",
      element: "fromSourceName(type.name)",
      kind: "written-name",
      why: "a resolved type's dotted name as its C lookup key",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/LexicalFrames.ts",
      element:
        "fromSourceName([functionCName, name, suffix === 1 ? null : String(suffix)])",
      kind: "owner-c-name",
      why: "a local renamed under its function's materialized C name when it hides a file-scope name, with a uniqueness suffix",
    },
    {
      file: "src/cnx/PARSE/4-Resolve/LexicalFrames.ts",
      element: "fromSourceName([functionCName, name])",
      kind: "owner-c-name",
      why: "a local renamed under its function's materialized C name when it hides a file-scope name",
    },
    {
      file: "src/cnx/TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts",
      element: "fromSourceName([head, ...label.path.slice(1)])",
      kind: "owner-c-name",
      why: "`head` is the label's first component resolved by `ScopeUtils.typeHeadCName`; the rest is what the author wrote",
    },
    {
      file: "src/cnx/TRANSPILE/1-Analyze/helpers/FunctionReference.ts",
      element: "fromSourceName(text)",
      kind: "written-name",
      why: "a dotted callback type name as written; `this.` goes through `ScopeUtils.qualifyInScope` instead",
    },
    {
      file: "src/cnx/TRANSPILE/2-Plan/FilePlanner.ts",
      element: "fromSourceName(identifiers)",
      kind: "written-name",
      why: "a qualified type's identifier chain as written",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/generators/declarationGenerators/EnumGenerator.ts",
      element: "fromSourceName([fullName, memberName])",
      kind: "owner-c-name",
      why: "ADR-017 member of the enum whose `fullyQualifiedCName` 3-Declare stored",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/generators/declarationGenerators/RegisterMacroGenerator.ts",
      element: "fromSourceName([prefix, member.name])",
      kind: "owner-c-name",
      why: "register member macro; `prefix` is the register's C name, built from its declaring PATH by `RegisterGenerator`",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/generators/expressions/PostfixExpressionGenerator.ts",
      element: "fromSourceName([ctx.result, ctx.memberName])",
      kind: "owner-c-name",
      why: "member of a register (`knownRegisters`) or an enum (`knownEnums`), each keyed by its materialized C name; a scope member reads its symbol's `fullyQualifiedCName` instead",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/generators/statements/SwitchGenerator.ts",
      element: "fromSourceName([switchEnumType, id])",
      kind: "owner-c-name",
      why: "a bare case label that is a member of the subject's enum, whose C name `enumTypeOf` materialized",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/generators/statements/SwitchGenerator.ts",
      element: "fromSourceName(label.parts)",
      kind: "written-name",
      why: "a qualified case label as written (`Motor.State.IDLE`)",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/helpers/PostfixChainBuilder.ts",
      element: "join(result, step, memberName)",
      kind: "owner-c-name",
      why: "an assignment target's member step; `MemberSeparatorResolver.step` decided it, so a scope member's step carries its `fullyQualifiedCName` and a register member joins its owner's C name",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/helpers/MemberSeparatorResolver.ts",
      element: "fromSourceName(identifierChain.slice(0, -1))",
      kind: "written-name",
      why: "the access chain as written, as a register lookup key",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/codegen/helpers/MemberSeparatorResolver.ts",
      element: "QualifiedCName.SEPARATOR",
      kind: "owner-c-name",
      why: "`join`'s register step: a register member joined to its owner's C name. A scope member's step carries its `fullyQualifiedCName` instead, and no method hands `__` out as a value (#2116)",
    },
    {
      file: "src/cnx/TRANSPILE/3-Render/headers/generators/generateEnumHeader.ts",
      element: "fromSourceName([name, memberName])",
      kind: "owner-c-name",
      why: "ADR-017 member of the header symbol's enum, whose `name` is its materialized C name",
    },
    {
      file: "src/cnx/TRANSPILE/CodeGenWalker.ts",
      element: "fromSourceName([this.host.state.expectedType, id])",
      kind: "owner-c-name",
      why: "a bare member of the expected enum, whose C name keys `knownEnums`",
    },
    {
      file: "src/cnx/TRANSPILE/2-Plan/TypeValidator.ts",
      element: "isInScope(identifier, currentScopePath)",
      kind: "scope-path",
      why: "is a known function declared in the current scope? Handed `currentScopePath`, so the prefix is spelled by `QualifiedCName.prefixFor`",
    },
    {
      file: "src/cnx/utils/EnumZeroValue.ts",
      element: "fromSourceName([enumName, member])",
      kind: "owner-c-name",
      why: "ADR-017 zero member of the enum whose C name `enumName` is (`knownEnums` is keyed by C name); a C++ namespace enum joins with `::` instead",
    },
    {
      file: "src/cnx/utils/LengthProperty.ts",
      element: "fromSourceName(type.name)",
      kind: "written-name",
      why: "a resolved type's dotted name as its C lookup key",
    },
    {
      file: "src/cnx/utils/OperandTyper.ts",
      element: "fromSourceName(sourceName)",
      kind: "written-name",
      why: "a dotted source name as written, as its C lookup key",
    },
    {
      file: "src/cnx/utils/QualifiedCName.ts",
      element: "QualifiedCName.SEPARATOR",
      kind: "encoder",
      why: "the ADR-063 separator's owner: its declaration, the one join, the split and the prefix test",
    },
    {
      file: "src/cnx/utils/QualifiedCName.ts",
      element: "prefixFor(scopePath)",
      kind: "encoder",
      why: "`isInScope` asking the prefix builder for the path it was handed",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "fromSourceName([scopePath, ...path])",
      kind: "encoder",
      why: "`qualifyPathInScope` -- the one implementation the scope-qualifying callers route to; its parameter IS the enclosing path",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "fromSourceName([symbol.scopePath, symbol.name])",
      kind: "encoder",
      why: "`getTranspiledCName` -- the single encoder. The symbol carries its whole enclosing path (#1298)",
    },
    {
      file: "src/cnx/utils/ScopeUtils.ts",
      element: "fromSourceName(qualified)",
      kind: "encoder",
      why: "`typeHeadCName` -- `qualifyScopeType` has already qualified the head from the enclosing PATH",
    },
    {
      file: "src/cnx/utils/TypeNameLadder.ts",
      element: "fromSourceName(type.path)",
      kind: "written-name",
      why: "a qualified type's path as written, when no resolver is supplied",
    },
  ];

  /**
   * The adjudication for a site, or undefined when it has not been reviewed.
   *
   * `verdicts` defaults to the committed table and is injectable so the unit
   * tests exercise the MECHANISM rather than today's sites.
   */
  private static adjudicationFor(
    file: string,
    element: string,
    verdicts: readonly IAdjudication[],
  ): IAdjudication | undefined {
    return verdicts.find((row) => row.file === file && row.element === element);
  }

  /**
   * `source` with comments removed.
   *
   * The scan is a text search, and the text it looks for appears in JSDoc
   * constantly -- these builders are what the prose is ABOUT. Counting a
   * sentence produces a row for a file with no such site, and the only way to
   * green that is to record the phantom permanently.
   *
   * String literals are the other theoretical vector; no builder is spelled
   * inside one today, so they are deliberately not handled.
   */
  private static withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  /**
   * Each `<builder>(...)` call in `source`, as `<method>(<argument>)`.
   *
   * Scans for the matching delimiter rather than matching a regex: these calls
   * span lines and contain nested calls and arrays with their own commas.
   */
  private static builderCalls(
    source: string,
    builder: string,
  ): readonly string[] {
    const marker = `${builder}(`;
    const method = builder.slice(builder.lastIndexOf(".") + 1);
    const found: string[] = [];
    let from = 0;
    for (;;) {
      const at = source.indexOf(marker, from);
      if (at < 0) {
        return found;
      }
      let depth = 0;
      let i = at + marker.length;
      const start = i;
      for (; i < source.length; i++) {
        const c = source[i];
        if ("([{".includes(c)) {
          depth++;
        } else if (")]}".includes(c)) {
          if (depth === 0) {
            break;
          }
          depth--;
        }
      }
      const argument = source
        .slice(start, i)
        .trim()
        .replace(/\s+/g, " ")
        .replace(/,\s*([)\]])/g, "$1")
        .replace(/,$/, "")
        .replace(/\[ /g, "[")
        .replace(/ \]/g, "]");
      found.push(`${method}(${argument})`);
      from = i + 1;
    }
  }

  /**
   * Every site in `source`, as element texts: each builder call,
   * each named use of the separator, and each separator spelled as text.
   * @public test seam: scope-join-sites.test.ts pins the scanner through it
   */
  static elements(rawSource: string): readonly string[] {
    const source = ScopeJoinSites.withoutComments(rawSource);
    // A backtick would end the element's code span in the document's table.
    return ScopeJoinSites.found(source).map((element) =>
      element.replace(/`/g, "'"),
    );
  }

  private static found(source: string): readonly string[] {
    return [
      ...ScopeJoinSites.BUILDERS.flatMap((builder) =>
        ScopeJoinSites.builderCalls(source, builder),
      ),
      ...[...source.matchAll(ScopeJoinSites.SEPARATOR)].map(
        () => "QualifiedCName.SEPARATOR",
      ),
      ...[...source.matchAll(ScopeJoinSites.SPELLED_SEPARATOR)].map((match) =>
        match[0].replace(/\s+/g, " "),
      ),
    ];
  }

  /**
   * Distinct (file, element) sites with their occurrence counts.
   *
   * Identical text in one file collapses to one row on purpose: an adjudication
   * is about what the expression IS. A row's count still fails the gate if it
   * grows, so the collapse cannot hide a new site.
   */
  static sites(sources: ReadonlyMap<string, string>): readonly ISite[] {
    const rows: ISite[] = [];
    for (const [file, source] of sources) {
      const tally = new Map<string, number>();
      for (const element of ScopeJoinSites.elements(source)) {
        tally.set(element, (tally.get(element) ?? 0) + 1);
      }
      for (const [element, count] of tally) {
        rows.push({ file, element, count });
      }
    }
    return rows.sort(
      (a, b) =>
        a.file.localeCompare(b.file) || a.element.localeCompare(b.element),
    );
  }

  /**
   * The totals both `render` and `check` report.
   *
   * Shared rather than computed twice: the two must agree, and jscpd caught the
   * copy the moment it existed.
   */
  private static summarize(sites: readonly ISite[]): {
    total: number;
    files: number;
  } {
    return {
      total: sites.reduce((sum, row) => sum + row.count, 0),
      files: new Set(sites.map((row) => row.file)).size,
    };
  }

  /** The committed document body. No timestamp: it would churn every run. */
  static render(
    sites: readonly ISite[],
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): string {
    const { total, files } = ScopeJoinSites.summarize(sites);
    const lines = [
      "# Qualified C name construction sites",
      "",
      "<!-- Generated by `npm run scope-joins`. Do not edit by hand. -->",
      "",
      "Issues #1357 and #2116. Each row is one expression in one file that builds",
      "a qualified C name: a `QualifiedCName.fromSourceName` call, a use of",
      "`QualifiedCName.SEPARATOR`, or the separator spelled as text.",
      "",
      "A qualified name comes from a symbol's declaring scope's whole PATH",
      "(`ScopeUtils`, materialized as `fullyQualifiedCName`), or from a name the",
      "author wrote in full. Scopes are flat (ADR-016), so a scope's name is its",
      "path; a hand join of one to a member is wrong because it decides the",
      "`Scope__member` spelling a second time. Every row below carries the",
      "judgement that it is not that join:",
      "",
      ...KIND_SECTIONS.flatMap((section) => section.lines),
      "",
      "A site takes the FIRST kind above that applies. **Nothing computes this.**",
      "The order is an instruction to whoever writes the row.",
      "",
      "No row is excluded by how its expression is spelled. `npm run",
      "scope-joins:check` fails on a file that gains a site, on an expression",
      "nobody has adjudicated, and on a judgement that no longer matches any site,",
      "so a scope join added in any pass is red until someone argues it is not",
      "one -- in source, in `ScopeJoinSites.ADJUDICATIONS`.",
      "",
      "| File | Expression | Sites | Kind |",
      "| --- | --- | --- | --- |",
      ...sites.map((row) => {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        );
        const kind = verdict?.kind ?? "**UNADJUDICATED**";
        return `| \`${row.file}\` | \`${row.element.replace(/\|/g, "\\|")}\` | ${row.count} | ${kind} |`;
      }),
      `| **total** | | **${total}** | |`,
      "",
      `${total} site(s) across ${files} file(s).`,
      "",
      "## Why each site is not a scope join",
      "",
      ...sites.flatMap((row) => {
        const verdict = ScopeJoinSites.adjudicationFor(
          row.file,
          row.element,
          verdicts,
        );
        return verdict
          ? [`- \`${row.file}\` \`${row.element}\`: ${verdict.why}`]
          : [];
      }),
      "",
    ];
    return lines.join("\n");
  }

  /**
   * Everything `check` mode concluded, as a value.
   *
   * Was `check(committed, sites, verdicts)` with the missing-file branch and the
   * stale-vs-errors ordering left in the CLI's `main()`, where no test could
   * reach either. `diagnostic-manifest.ts` had already settled the shape --
   * "both modes decide in DiagnosticManifest and only print here, so the
   * ordering ... is reachable from a test rather than buried in a CLI entry
   * point" -- and #1317 copied THIS script instead, reproducing the gap and then
   * diverging from it: the two spelled the ordering opposite ways and both
   * exited 1, so nothing could fail on the difference. Brought onto the sibling's
   * shape so there is one generator pattern rather than two.
   *
   * `committedDocument` is nullable: a missing document is a decision here, not
   * an `existsSync` branch in the CLI.
   *
   * Behavior is unchanged -- same three outcomes, same messages, same exit
   * codes. `verdicts` stays injectable so the existing tests exercise the
   * MECHANISM rather than today's twelve sites.
   */
  static checkOutcome(
    committedDocument: string | null,
    sites: readonly ISite[],
    freshDocument: string,
    verdicts: readonly IAdjudication[] = ScopeJoinSites.ADJUDICATIONS,
  ): ICheckOutcome {
    const siteErrors: string[] = [];

    if (committedDocument === null) {
      return {
        ok: false,
        errors: [
          "docs/architecture/scope-join-sites.md is missing. Run `npm run scope-joins`.",
        ],
        info: [],
      };
    }
    const committed = committedDocument;

    // Tolerant of padding: the committed document is Prettier-formatted, which
    // pads table cells to a common width. A parser requiring single spaces
    // fails against the very file the generator just wrote.
    const expected = new Map<string, number>();
    for (const match of committed.matchAll(
      /^\|\s*`([^`]+)`\s*\|\s*`((?:[^`\\]|\\.)+)`\s*\|\s*(\d+)\s*\|/gm,
    )) {
      expected.set(
        `${match[1]}\u0000${match[2].replace(/\\\|/g, "|")}`,
        Number(match[3]),
      );
    }
    const actual = new Map(
      sites.map((row) => [`${row.file}\u0000${row.element}`, row.count]),
    );

    for (const [key, n] of actual) {
      const [file, element] = key.split("\u0000");
      const was = expected.get(key);
      if (was === undefined) {
        siteErrors.push(
          `${file}: new qualified-name site \`${element}\` (${n} site(s))`,
        );
      } else if (n > was) {
        siteErrors.push(
          `${file}: \`${element}\` grew from ${was} to ${n} site(s)`,
        );
      }
    }
    for (const [key, was] of expected) {
      const [file, element] = key.split("\u0000");
      const now = actual.get(key) ?? 0;
      if (now < was) {
        siteErrors.push(
          `${file}: \`${element}\` down from ${was} to ${now} -- run ` +
            "`npm run scope-joins` AND update its `ADJUDICATIONS` entry: drop " +
            "it if the site is gone, re-key it if the expression was renamed. " +
            "Regenerating alone cannot green this -- the entry is source code",
        );
      }
    }

    // A site nobody has judged, and a judgement about code that is gone. The
    // first is the point of the table; the second keeps it from rotting into
    // the prose promise it replaced.
    for (const row of sites) {
      if (!ScopeJoinSites.adjudicationFor(row.file, row.element, verdicts)) {
        siteErrors.push(
          `${row.file}: \`${row.element}\` has no adjudication -- add one to ` +
            "`ScopeJoinSites.ADJUDICATIONS` saying which kind it is and why",
        );
      }
    }
    for (const verdict of verdicts) {
      const stillThere = sites.some(
        (row) => row.file === verdict.file && row.element === verdict.element,
      );
      if (!stillThere) {
        siteErrors.push(
          `${verdict.file}: adjudication for \`${verdict.element}\` matches no ` +
            "site -- remove it, the judgement outlived its code",
        );
      }
    }

    // Staleness is an INDEPENDENT defect only when the counts agree: a moved
    // population makes the document stale as a consequence, and "edited by hand"
    // would name the wrong cause there. That conditional lived in `main()`, was
    // unreachable from a test, and had already been spelled the opposite way
    // round in the script that copied this one -- both exiting 1, so nothing
    // could fail on the difference.
    //
    // The rows are not the whole document. Comparing only what the parser can
    // read leaves the preamble, the header comment and the total row free to
    // drift with the gate still green -- `diagnostic-manifest.ts` compares in
    // full for that reason. `render` emits no timestamp and Prettier is
    // deterministic, so equality holds.
    //
    // Framed here rather than in the CLI so the printed text is a property of
    // the decision and stays byte-identical to what `main()` used to emit.
    const errors: string[] = [];
    if (siteErrors.length > 0) {
      errors.push(
        "docs/architecture/scope-join-sites.md is out of date:\n" +
          siteErrors.map((error) => `  ${error}`).join("\n"),
      );
    } else if (freshDocument !== committed) {
      errors.push(
        `docs/architecture/scope-join-sites.md does not match what the ` +
          "generator produces, though the counts agree -- prose or the total " +
          "row was edited by hand. Run `npm run scope-joins`.",
      );
    }

    const { total, files } = ScopeJoinSites.summarize(sites);
    return {
      ok: errors.length === 0,
      errors,
      info: [`${total} qualified-name site(s) across ${files} file(s).`],
    };
  }
}

export default ScopeJoinSites;
