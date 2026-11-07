/**
 * #1445 box 2: no artifact a pass hands forward reaches a parse node.
 *
 * `docs/architecture/README.md` makes the AST Tier 1 with a short lifetime, and
 * rests the whole lifetime axis on one rule:
 *
 * > Pass 1.3 consumes `ParsedFile` and does not re-export it. That single rule
 * > is what makes the lifetime axis enforceable -- the tree is not reachable
 * > from any artifact a downstream pass holds, so a dependency rule is a
 * > backstop rather than the primary guard.
 *
 * `parse-tree:check` is that backstop. It counts modules that NAME a parse
 * type, which is a different property: a module is free to receive a tree,
 * walk it and drop it, and 2.1 Analyze must. What this file asserts is the
 * primary guard -- that the values passes hand each other do not CARRY one, so
 * a later pass cannot reach the tree by holding the previous pass's output.
 *
 * The violation this was written against was `IDeclaredFile`, which looked like
 * 1.3's artifact and was `{ parsed: IParsedFile; symbols: readonly TSymbol[] }`.
 * Anything holding it reached the tree in one property access. Its `symbols`
 * half had no reader at all, so the bundle existed to carry the re-export.
 *
 * ## Why this is a type walk and not a grep
 *
 * The carrier is reachability, not spelling. `IDeclaredFile` never wrote
 * `Parser.ProgramContext`; it wrote `IParsedFile`. A grep for the grammar finds
 * neither, and that is the whole failure mode -- the depcruise rule had to name
 * `IParsedFile` in its `to:` list for exactly this reason.
 */
import { describe, it, expect } from "vitest";
import {
  Node,
  Project,
  SyntaxKind,
  type ClassDeclaration,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type Type,
} from "ts-morph";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const project = new Project({
  tsConfigFilePath: join(repoRoot, "tsconfig.json"),
});

/** A type declared by the generated grammar or by the antlr4ng runtime. */
function isParseType(type: Type): boolean {
  try {
    const symbol = type.getSymbol();
    if (!symbol) return false;
    return symbol
      .getDeclarations()
      .some((d) =>
        /CnxParser\.ts$|antlr4ng/.test(d.getSourceFile().getFilePath()),
      );
  } catch {
    return false;
  }
}

/**
 * Whether a parse node is reachable from `type` by any chain of properties,
 * generic arguments, array elements or union members.
 *
 * **The generic arguments are not optional.** `Map<string, IParsedFile>` exposes
 * `size`, `get` and `set` through `getProperties()` and never its value type, so
 * a walk over properties alone reports a clean result for the one field in this
 * repository that genuinely holds every retained tree. The first version of this
 * scan did exactly that and returned 0 for its own control.
 */
/**
 * The text `reachesParseNode` keys its `seen` set on, printed once per type
 * (#2094): printing a type is the walk's main cost, and the walk meets the
 * same few thousand types again and again.
 */
const typeKeys = new Map<Type["compilerType"], string>();
function typeKey(type: Type): string {
  let key = typeKeys.get(type.compilerType);
  if (key === undefined) {
    key = type.getText().slice(0, 140);
    typeKeys.set(type.compilerType, key);
  }
  return key;
}

function reachesParseNode(
  type: Type,
  depth = 0,
  seen = new Set<string>(),
): boolean {
  if (depth > 5) return false;
  const key = `${typeKey(type)}|${depth}`;
  if (seen.has(key)) return false;
  seen.add(key);

  if (isParseType(type)) return true;

  try {
    for (const arg of type.getTypeArguments())
      if (reachesParseNode(arg, depth + 1, seen)) return true;
  } catch {
    /* not generic */
  }
  try {
    const element = type.getArrayElementType();
    if (element && reachesParseNode(element, depth + 1, seen)) return true;
  } catch {
    /* not an array */
  }
  try {
    for (const member of type.getUnionTypes())
      if (reachesParseNode(member, depth + 1, seen)) return true;
  } catch {
    /* not a union */
  }

  // What a callable HANDS BACK. This is the difference between a thunk and a
  // re-export. A closure's captures are invisible to the type checker, so what
  // this can check is the return type: a callable returning `string`,
  // `IBitAccessAnalysis` or `number | undefined` hands back a value, never a
  // node, so no later pass can OBTAIN a parse node from it and walk it. Since
  // #1950 the closures in `IAssignmentContext` capture plain `TExpression`s, not
  // parser contexts; this is what catches one that starts returning a node.
  try {
    for (const sig of type.getCallSignatures())
      if (reachesParseNode(sig.getReturnType(), depth + 1, seen)) return true;
  } catch {
    /* not callable */
  }

  for (const prop of type.getProperties()) {
    const decl = prop.getDeclarations()[0];
    if (!decl) continue;
    try {
      if (reachesParseNode(prop.getTypeAtLocation(decl), depth + 1, seen))
        return true;
    } catch {
      /* unresolvable property */
    }
  }
  return false;
}

function namedType(file: string, name: string): Type {
  const sf = project.getSourceFileOrThrow(join(repoRoot, file));
  const decl =
    sf.getInterface(name) ?? sf.getTypeAlias(name) ?? sf.getClass(name);
  if (!decl) throw new Error(`${name} not found in ${file}`);
  return decl.getType();
}

/**
 * The values that cross a pass boundary: what a pass emits and a later pass
 * holds. A parameter a pass receives and drops is deliberately NOT here --
 * 2.1 Analyze is handed the tree and must be.
 */
const ARTIFACTS: ReadonlyArray<readonly [string, string]> = [
  ["src/cnx/types/IFileSymbols.ts", "IFileSymbols"],
  // #1668: named directly, so a later field of node type fails on the frame
  // itself rather than only through IFileSymbols.
  ["src/cnx/types/ILexicalFrame.ts", "ILexicalFrame"],
  ["src/cnx/types/ILocalDeclaration.ts", "ILocalDeclaration"],
  ["src/cnx/types/ICodeGenSymbols.ts", "ICodeGenSymbols"],
  ["src/cnx/TRANSPILE/types/ICodeGenApi.ts", "ICodeGenApi"],
  ["src/cnx/types/symbols/TSymbol.ts", "TSymbol"],
  ["src/cnx/PARSE/4-Resolve/Program.ts", "Program"],
  ["src/cnx/PARSE/4-Resolve/VisibleSymbols.ts", "VisibleSymbols"],
  ["src/cnx/PARSE/3-Declare/SymbolTable.ts", "SymbolTable"],
  ["src/cnx/PARSE/3-Declare/SymbolRegistry.ts", "SymbolRegistry"],
  // The two artifacts built of closures -- included so the return-type check
  // above runs on real function-valued fields. Their closures capture plain
  // `TExpression`s since #1950; a parse node handed back would turn this red.
  [
    "src/cnx/TRANSPILE/2-Plan/types/IAssignmentContext.ts",
    "IAssignmentContext",
  ],
  ["src/cnx/types/TPlannedTargetOp.ts", "TPlannedTargetOp"],
];

/** Every class field under a directory whose type reaches a parse node. */
/**
 * Every own property a class declares -- fields AND constructor parameter
 * properties.
 *
 * `constructor(private readonly file: IParsedFile) {}` declares a property
 * exactly as a field does, but the node is a `Parameter` under the
 * `Constructor`, so `getProperties()` never reaches it. This guard shipped
 * without that and was **unable to fail on the shape it was written against**:
 * adding that exact constructor to a 2-Plan module left all six assertions
 * green, and only `parse-tree:check` -- which the header above calls the
 * backstop -- caught it. That inverted the claim this file makes about itself.
 *
 * Its sibling `bitmap-field-layout.test.ts` had already recorded the same hole
 * and closed it the same way, noting that 17 non-test files declare one. Found
 * by review, not by the guard.
 *
 * `getModifiers().length` is what separates a parameter property from a plain
 * constructor parameter, which declares nothing.
 */
function declaredProperties(
  cls: ClassDeclaration,
): (PropertyDeclaration | ParameterDeclaration)[] {
  const fields: (PropertyDeclaration | ParameterDeclaration)[] = [
    ...cls.getProperties(),
  ];
  for (const ctor of cls.getConstructors())
    for (const parameter of ctor.getParameters())
      if (parameter.getModifiers().length) fields.push(parameter);
  return fields;
}

/**
 * The modules a `storedParseNodes` pattern actually reaches.
 *
 * So an emptiness claim can state its population instead of assuming one. A
 * pattern naming a path that no longer exists returns `[]` from
 * `storedParseNodes` whatever the code does, which is how the `no shared state
 * holds one` arm came to pass vacuously after #1452 moved its three subjects.
 */
function matchingModules(pattern: RegExp): string[] {
  return project
    .getSourceFiles()
    .map((sf) => sf.getFilePath())
    .filter((path) => !path.includes("__tests__") && pattern.test(path))
    .map((path) => relative(repoRoot, path));
}

/**
 * `reachesParseNode` for a field's type, answered once per type (#2094): the
 * fields under `src/` share a few hundred types, and walking each field's type
 * afresh took the all-of-`src/` assertion past its timeout under coverage.
 */
const fieldTypeCache = new Map<Type["compilerType"], boolean>();
function fieldTypeReaches(type: Type): boolean {
  let reaches = fieldTypeCache.get(type.compilerType);
  if (reaches === undefined) {
    reaches = reachesParseNode(type);
    fieldTypeCache.set(type.compilerType, reaches);
  }
  return reaches;
}

function storedParseNodes(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath();
    if (path.includes("__tests__") || !pattern.test(path)) continue;
    for (const cls of sf.getClasses())
      for (const prop of declaredProperties(cls)) {
        try {
          if (fieldTypeReaches(prop.getType()))
            found.push(
              `${relative(repoRoot, path)}:${prop.getStartLineNumber()} ${cls.getName()}.${prop.getName()}`,
            );
        } catch {
          /* unresolvable field */
        }
      }
  }
  return found;
}

/**
 * Every parameter, field and property signature under `pattern` that would
 * accept a real parse context.
 *
 * #1932 box 1: a pass can take a parse node without naming a parse type, by
 * declaring a structural copy of the part it reads -- `IModifierContext`
 * (`atomicModifier(): unknown`) and `CommentUtils`' `{ start?: { tokenIndex:
 * number } }` both did, and `parse-tree-confined-to-parser`, which matches
 * import paths, could see neither. So the question is asked of the TYPE
 * CHECKER: is a generated context assignable here? Top types (`unknown`,
 * `any`, `object`, `{}`, an unconstrained type parameter) accept anything and
 * say nothing about parse nodes, so they are skipped.
 */
function parseNodeAcceptors(pattern: RegExp): string[] {
  const grammar = project.getSourceFileOrThrow(
    join(repoRoot, "src/cnx/PARSE/2-Parse/grammar/CnxParser.ts"),
  );
  // Every generated context, not a sample: a stand-in copies the shape of the
  // ONE context its pass reads (`IModifierContext` was a variable
  // declaration's), so a sample of four would miss most of them.
  const contexts = grammar
    .getClasses()
    .filter((c) => c.getName()?.endsWith("Context"))
    .map((c) => c.getType());
  const isTop = (t: Type): boolean =>
    t.isAny() ||
    t.isUnknown() ||
    t.isTypeParameter() ||
    ["object", "{}"].includes(t.getText());

  const found: string[] = [];
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath();
    if (path.includes("__tests__") || !pattern.test(path)) continue;
    const nodes = [
      ...sf.getDescendantsOfKind(SyntaxKind.Parameter),
      ...sf.getDescendantsOfKind(SyntaxKind.PropertyDeclaration),
      ...sf.getDescendantsOfKind(SyntaxKind.PropertySignature),
    ];
    for (const node of nodes) {
      const type = node.getType();
      if ((type.isUnion() ? type.getUnionTypes() : [type]).some(isTop))
        continue;
      // `Map<string, Ctx>`, `ReadonlyArray<Ctx>`, `Ctx[]`, and containers of
      // containers: a context held inside one is held all the same.
      const targets = containedTypes(type).filter((t) => !isTop(t));
      if (contexts.some((c) => targets.some((t) => c.isAssignableTo(t))))
        found.push(
          `${relative(repoRoot, path)} ${node.getText().split(":")[0].trim()}`,
        );
    }
  }
  return found;
}

/** `type` and every type argument and array element inside it, recursively */
function containedTypes(type: Type, depth = 0): Type[] {
  if (depth > 3) return [type];
  const element = type.getArrayElementType();
  const inner = [...type.getTypeArguments(), ...(element ? [element] : [])];
  return [type, ...inner.flatMap((t) => containedTypes(t, depth + 1))];
}

/** Whether `type`, a union member, or anything it contains is a parse type */
const containsCache = new Map<Type["compilerType"], boolean>();
function containsParseType(type: Type): boolean {
  let contains = containsCache.get(type.compilerType);
  if (contains === undefined) {
    const members = type.isUnion() ? type.getUnionTypes() : [type];
    contains = members.some((member) =>
      containedTypes(member).some(isParseType),
    );
    containsCache.set(type.compilerType, contains);
  }
  return contains;
}

/**
 * `reachesParseNode` for a call's result, answered once per type: most calls
 * return one of a few hundred types, and the walk was 95% of the sweep's time.
 */
const callResultCache = new Map<Type["compilerType"], boolean>();
function callResultReaches(type: Type): boolean {
  let reaches = callResultCache.get(type.compilerType);
  if (reaches === undefined) {
    reaches = reachesParseNode(type);
    callResultCache.set(type.compilerType, reaches);
  }
  return reaches;
}

/**
 * Every expression under `pattern` whose value is a parse node, however the
 * module got it (#1957).
 *
 * `parse-tree-confined-to-parser` reads imports, so a module that gets a tree
 * as a RETURN VALUE -- `CnxSourceParser.parse(src).tree` -- names no parse
 * type and passes it. This asks the type checker about every expression
 * instead. A call is also walked by reachability, so a call handing back a
 * bundle that carries a tree (`IParsedFile`) is found before anyone reads it.
 */
function heldParseValues(pattern: RegExp, stopAfter = Infinity): string[] {
  const found: string[] = [];
  for (const sf of project.getSourceFiles()) {
    if (found.length >= stopAfter) break;
    const path = sf.getFilePath();
    if (path.includes("__tests__") || !pattern.test(path)) continue;
    // Every way a value is obtained or named: a call, a member read, an
    // index, a declared variable. Bare identifiers only re-read one of these,
    // and skipping them keeps the sweep inside the coverage-run timeout.
    const nodes = [
      ...sf.getDescendantsOfKind(SyntaxKind.CallExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.ElementAccessExpression),
      ...sf.getDescendantsOfKind(SyntaxKind.VariableDeclaration),
    ];
    for (const node of nodes) {
      if (found.length >= stopAfter) break;
      const type = node.getType();
      if (
        containsParseType(type) ||
        (Node.isCallExpression(node) && callResultReaches(type))
      )
        found.push(
          `${relative(repoRoot, path)}:${node.getStartLineNumber()} ${node.getText().slice(0, 60)}`,
        );
    }
  }
  return found;
}

/**
 * The modules after 1.2 Parse (#1991, "the tree never leaves 1.2"): 1.3, 1.4,
 * 2.1, the walker, its state, and every later layer
 */
const AFTER_PARSE_PASSES: ReadonlyArray<readonly [string, RegExp]> = [
  ["1.3 Declare", /src\/cnx\/PARSE\/3-Declare\//],
  ["1.4 Resolve", /src\/cnx\/PARSE\/4-Resolve\//],
  ["2.1 Analyze", /src\/cnx\/TRANSPILE\/1-Analyze\//],
  ["2.2 Plan", /src\/cnx\/TRANSPILE\/2-Plan\//],
  ["2.3 Render", /src\/cnx\/TRANSPILE\/3-Render\//],
  [
    "the walker and its state",
    /src\/cnx\/TRANSPILE\/types\/|src\/cnx\/TRANSPILE\/(CodeGenWalker|TranspileState)\.ts$/,
  ],
  ["3.1 Write", /src\/cnx\/WRITE\//],
];
const AFTER_PARSE = new RegExp(
  AFTER_PARSE_PASSES.map(([, pass]) => pass.source).join("|"),
);

/** 1.2 Parse, which holds the tree, so every detector must find it there */
const PARSE = /src\/cnx\/PARSE\/2-Parse\//;

/**
 * Each assertion walks types across the whole program, and `npm run unit` runs
 * under v8 coverage in CI, which took these from ~0.5s to 5.8-11.4s -- past
 * vitest's 5000ms default. The local gate passed because it does not instrument.
 */
const WALK_TIMEOUT_MS = 60_000;

describe("artifact lifetime (#1445 box 2)", () => {
  it(
    "the walk works at all",
    () => {
      // The control, and it is load-bearing. Every assertion below is an
      // emptiness claim, and an emptiness claim from a broken scan is
      // indistinguishable from a true one, so the scan must see a class that
      // holds a parse node on a field. The control used to be production code:
      // `Transpiler.retainedParses` until #1932 deleted it, then
      // `NullCheckAnalyzer.currentIfCtx` until #2003 moved 2.1's listeners onto
      // the lowered tree. Each time the code got better, the control broke. So
      // the class is written here, in a file the scan reads like any other.
      const probe = project.createSourceFile(
        join(repoRoot, "src/cnx/TRANSPILE/1-Analyze/ParseNodeHolderProbe.ts"),
        [
          'import * as Parser from "../../PARSE/2-Parse/grammar/CnxParser";',
          "class ParseNodeHolderProbe {",
          "  private held: Parser.IfStatementContext | null = null;",
          "}",
          "export default ParseNodeHolderProbe;",
        ].join("\n"),
      );
      try {
        const control = storedParseNodes(/ParseNodeHolderProbe\.ts$/);

        expect(control).toEqual([
          "src/cnx/TRANSPILE/1-Analyze/ParseNodeHolderProbe.ts:3 ParseNodeHolderProbe.held",
        ]);
      } finally {
        project.removeSourceFile(probe);
      }
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no artifact a pass hands forward reaches a parse node",
    () => {
      const carriers = ARTIFACTS.filter(([file, name]) =>
        reachesParseNode(namedType(file, name)),
      ).map(([, name]) => name);

      expect(carriers).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no shared state holds one",
    () => {
      // `TranspileState`, `SymbolTable` and `SymbolRegistry` outlive every pass
      // and are reachable from all of them, so a tree parked on one is the
      // lifetime violation with the longest reach available.
      //
      // #1452 moved all three out of `src/transpiler/state/` and deleted that
      // directory. The pattern kept pointing at it, so it matched zero files and
      // the assertion was vacuously true -- proven by mutation: a
      // `ProgramContext` field added to `TranspileState` reddened three sibling
      // arms here and left this one green in 1ms. The same dead-path shape
      // `e0245d08c` fixed for two depcruise rules, one directory over.
      const shared =
        /src\/cnx\/TRANSPILE\/TranspileState\.ts$|src\/cnx\/PARSE\/3-Declare\/Symbol(Table|Registry)\.ts$/;

      // POPULATION CONTROL. An emptiness claim over a pattern that matches
      // nothing is the defect this assertion just had, so prove the pattern
      // reaches the three files before trusting that none of them holds a tree.
      expect(matchingModules(shared).sort()).toEqual([
        "src/cnx/PARSE/3-Declare/SymbolRegistry.ts",
        "src/cnx/PARSE/3-Declare/SymbolTable.ts",
        "src/cnx/TRANSPILE/TranspileState.ts",
      ]);

      expect(storedParseNodes(shared)).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no field outside the parser holds a parse node",
    () => {
      // The pattern is ALL of `src/` minus the two directories that may hold a
      // tree, because a check scoped to where holders were already known cannot
      // find one anywhere else. It used to name
      // one directory, `src/transpiler/`, plus the walker's file -- so `src/cli/` was outside it, and `ServeCommand` sat unlisted.
      // Found by review. `parse-tree-sites.md` reports modules that NAME a parse
      // type, and `ServeCommand` names none -- transitive reach is precisely what
      // this file exists to catch.
      //
      // This was a roster of two until #1932: `Transpiler.retainedParses`, and
      // `ServeCommand.transpiler`, which reached a tree only through it. Since
      // 2.1's `TreePasses` holds every tree as a local of one call, the host has
      // none to hold, and a field that brings one back fails here.
      const holders = storedParseNodes(/src\/(?!cnx\/PARSE\/2-Parse)/);

      expect(holders).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no pass after 1.2 holds one on a field",
    () => {
      // The passes proper. #1991: 1.3 and 2.1 read 1.2's plain data, so they are
      // no longer excluded.
      const holders = storedParseNodes(
        /src\/cnx\/(PARSE\/(3-Declare|4-Resolve)|TRANSPILE\/(1-Analyze|2-Plan|3-Render))\//,
      );

      expect(holders).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "nothing after 1.2 accepts a parse node, by name or by shape (#1932, #1991)",
    () => {
      // POPULATION CONTROL: the pattern reaches 1.3, 2.1, the walker, the state
      // it writes into, and every layer and type directory after them.
      const modules = matchingModules(AFTER_PARSE);
      expect(modules).toContain("src/cnx/TRANSPILE/CodeGenWalker.ts");
      expect(modules).toContain("src/cnx/TRANSPILE/TranspileState.ts");
      for (const layer of [
        "3-Declare/",
        "4-Resolve/",
        "1-Analyze/",
        "2-Plan/",
        "3-Render/",
        "TRANSPILE/types/",
        "src/cnx/WRITE/",
      ])
        expect(modules.some((m) => m.includes(layer))).toBe(true);

      // DETECTOR CONTROL: 1.2 lowers the tree, so the same scan over it has to
      // find acceptors -- otherwise an empty result below could mean a scan
      // that cannot match.
      expect(parseNodeAcceptors(PARSE).length).toBeGreaterThan(0);

      expect(parseNodeAcceptors(AFTER_PARSE)).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );
  it(
    "the value sweep finds the parse nodes 1.2 holds",
    () => {
      // DETECTOR CONTROL: 1.2 walks the tree, so the same sweep over it must
      // find parse-node values -- otherwise an empty result below could mean
      // a sweep that cannot match.
      expect(heldParseValues(PARSE, 1)).toHaveLength(1);
    },
    WALK_TIMEOUT_MS,
  );
  // One test per pass: the sweep type-checks every module it reads, and all
  // of them in one test took 75s under CI's coverage run (#1991).
  it.each(AFTER_PARSE_PASSES)(
    "nothing in %s holds a parse node as a value, however obtained (#1957, #1991)",
    (_pass, modules) => {
      expect(matchingModules(modules)).not.toEqual([]);

      expect(heldParseValues(modules)).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );
  it(
    "the host holds no parse node as a value, however obtained (#1932)",
    () => {
      // `cli/` orchestrates the passes. Since #1932 the passes that read a tree
      // run as one call, 2.1's `TreePasses`, so nothing here may obtain one --
      // not by a parser call, not through a returned artifact.
      const host = /src\/cli\//;
      expect(matchingModules(host)).toContain("src/cli/Transpiler.ts");

      expect(heldParseValues(host)).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );
});
