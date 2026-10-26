# Unified operand typing for #1668: final design (synthesis)

> **A design record, not the current state.** Written at `da2f84918`, before
> implementation. Its `file:line` citations, counts and descriptions of the code
> are that commit's. The addendum's later rulings override it where they differ,
> and the decisions themselves are ADR-024's and ADR-049's.

**Baseline.** Branch `fix/1668-reject-mixed-int-float-arithmetic` at `da2f84918`. Its `src/` is identical to `4b896bb42`. `main` is `f8651d55d`. This design changes no repository file.

**Evidence tags.**

- `file:line` citations were read at `da2f84918`.
- **[ran]** means run on the head2 archive, with the probe directory named.
- Baseline counts were re-measured at `da2f84918` at `2026-09-26T18:13Z`, using the commands in §0.4.

**Spine.** This design takes **"risk-first"** as its spine, because judges 2 and 3 chose it; judge 1 chose "incremental". It fixes every fatal flaw any judge raised against the spine. It adds grafts from "artifact-first" and "incremental", and each graft is marked where it is used.

---

## 0. Synthesis record

### 0.1 Corrections to the inputs (re-verified)

| #   | What an input says                                              | What the code says                                                                                                                                                                   |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G3  | `symbols.structFields` holds what the file and its includes see | This file's own structs only. `mergeExternalSymbols` spreads `...base` and does not merge `structFields`, `structFieldDimensions` or `scopeMembers` (`VisibleSymbols.ts:129-149`).   |
| G4  | `SymbolTable.getStructFieldInfo` holds C header structs only    | `addTSymbol` registers the fields of every cnx struct for the whole run (`SymbolTable.ts:176-177`, `:191-204`). The comment at `TranspileState.ts:1283` is stale.                    |
| G11 | The type-registry map cites ETR lines                           | The correct ETR lines are: `callReturnType :490`, `getMemberTypeInfo :817`, cast arm `:765`, `resolveIdentifier` call `:732`.                                                        |
| K4  | Both ETR mocks "will go inert"                                  | `ArrayHandlers.test.ts:28` is **already** inert, because `ArrayHandlers.ts` imports no ETR. `UnaryExprGenerator.test.ts:23` mocks a live import (`UnaryExprGenerator.ts:15`, `:87`). |
| K5  | —                                                               | `TTypeInfo.isParameter` has no production reader. It is written only at `FunctionContextManager.ts:282`.                                                                             |

### 0.2 Claims that judges accepted or left open, overturned or refined here

1. **`f32 x <- k * w[0, 8]` cannot be the evidence for #1668 box 3.** Artifact-first proposed it, and judges 2 and 3 recorded "M-18 reddens it". **[ran]** in `probes/synth-veto/`:
   - Unmodified head2 emits `float x = k * ((w) & 0xFFU);`.
   - With the veto line `PrimitiveKindUtils.ts:79` deleted in a copy of `src/`, the output is still `float x = k * ((w) & 0xFFU);`.
   - The cause: a bit range has no declared overflow behavior, so `getCompositeOverflowBehavior` (`ETR.ts:192-207`) returns null and no clamp is emitted either way. The unified rule keeps that population (§5), so this fixture can never go red.
2. **The one shape that reaches the veto after unification is a C++ overload set whose return categories disagree.** **[ran]** in `probes/synth-ovl/`:
   - The header declares `uint32_t choose(uint32_t)` first and `float choose(float)` second.
   - `f32 r <- u * choose(y)` emits `float r = cnx_clamp_mul_u32(u, choose(y));`.
   - The g++ run prints `6.000000`; the correct value is 7.5.
   - This is a live miscompile at HEAD. It becomes the #1668 box 3 fixture (§8.1).
3. **Artifact-first said `_inferPointerTypeFromFunctionCall` "always returns null". That is false.** `CodeGenWalker.ts:4491-4526` returns `${declaredType}*` when a C function returns `T*` for a declared `T`. All three arms are kept (§2.4). A fixture is added, because the #958 arm currently shadows this arm in the only fixture that has one.
4. **ADR-024:463-476 ("Two divergences preserved") is stale.** `IntegerConversionAnalyzer.ts:132-142` records that the composite divergence was ruled a bug and closed. Artifact-first's "preserve it" is rejected.
5. **The spine's §10.3 "file G1, G2, the three type-registry probes, C12/C25/C31/C33" is stale.** All of these already exist, as #1698, #1699, #1702, #1700, #1701 and #1690–#1693. They were queried with `gh api repos/smeltworks/cnx/issues/<n>` at `2026-09-26T18:11:04Z`, and all are open.
6. **The spine said `EnumTypeResolver` "keeps only label qualification". That is wrong.** Its one entry, `resolve()` (`:53`), answers "which enum type is this expression", for its one caller at `CodeGenWalker.ts:901`. Qualifying the label is `SwitchGenerator`'s job. The module is deleted (§4.2).
7. **Citation fixes to the spine:**
   - `widestIntegerOf` is at `PrimitiveKindUtils.ts:76`, not `:207`.
   - `Object.freeze` is at `Program.ts:162`.
   - `testAnalysisContext` has **32** users, not 33.

### 0.3 Where the designs or judges disagreed

| Question                                      | Decision                                                                                              | Why (one line)                                                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spine                                         | risk-first                                                                                            | 2 of 3 judges; the best measured baselines and the best per-card attribution.                                                                                                                                                |
| Key for the declaration artifact              | Source position (`line`, `column`) carried as `ISourceSpan`                                           | `docs/architecture/README.md` §2 names `SourceSpan` as _the_ long-lived position record. A token index would be a second shape for one fact.                                                                                 |
| Where `TSubscriptKind` lives                  | Moved to `src/transpiler/types/` (fixes a fatal flaw in two designs)                                  | `IChainStep` is a shared contract. `shared-contracts-cannot-import-a-pass` (`.dependency-cruiser.cjs:278-308`) with `tsPreCompilationDeps: true` (`:540`) forbids naming `2-Plan/TSubscriptKind.ts:7`.                       |
| `SubscriptClassifier`                         | Moved to `src/cnx/utils/`. The typer is its only caller once C12 lands.                               | One element-or-bit decision for 2.1 and 2.2. It imports only `TSubscriptKind` and `TTypeInfo`, and both then sit in shared contracts.                                                                                        |
| ETR name predicates                           | **Deleted** with ETR (from artifact-first). The spine kept them "until #1685".                        | They duplicate `TypeCheckUtils.isInteger/isFloat/isUnsigned` byte for byte (`TypeCheckUtils.ts:33-65` against `ETR:49-76`). CLAUDE.md: touching a duplicate means owning it.                                                 |
| Bare-call binding                             | `program.resolveFunction`                                                                             | It is the rule emission already uses (`QualifiedNameGenerator.forFunctionInScope`, `:56-70`, called at `CodeGenWalker.ts:2276`/`:3260`). `qualifyScopeType` agrees with it only because scopes cannot nest (`Cnx.g4:77-88`). |
| Emission naming                               | Routed through the same `bindValue` (from incremental)                                                | #1700 box 3 requires "the same local → scope → global decision" for typing and the emitted name.                                                                                                                             |
| #1668 box 3 fixture                           | The C++ overload execution fixture (from risk-first, **[ran]** above)                                 | The bit-range shape measured unreachable (§0.2.1).                                                                                                                                                                           |
| Registry regeneration                         | Per-card transitional arms (from risk-first)                                                          | #1667 box 2 and #1681 box 4 each want their own attributed diff. One mixed regeneration (artifact-first C6, incremental C13) cannot give that.                                                                               |
| Where policy lives                            | In the consuming pass, with the shared composite rule in utils                                        | This is the closest reading of "utils decides nothing" that still gives one composite rule.                                                                                                                                  |
| Ternary arms compared with each other (E0810) | **Not** added                                                                                         | The rulings do not cover it, and a new rejection needs an owner ruling (open question Q5).                                                                                                                                   |
| Single-evaluation cast                        | Helper only when the operand has a side effect: a call, or a read of a volatile or atomic declaration | It fixes C26 and the pre-existing `(u32)arr[nextIndex()]`. It does not churn the 82 pure saturating ternaries.                                                                                                               |

### 0.4 Baselines at `da2f84918` (commands shown)

| Fact                                             | Command                                                                                                                                                                   | Value                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `getVariableTypeInfo` production sites           | `grep -rn 'getVariableTypeInfo(' src --include=*.ts \| grep -v __tests__ \| grep -v src/cnx/TRANSPILE/TranspileState.ts \| grep -vE '^[^:]+:[0-9]+:\s*(\*\|//)' \| wc -l` | 59                   |
| Files that construct `DeclarationScopeCollector` | `grep -rln "new DeclarationScopeCollector" src \| grep -v __tests__ \| wc -l`                                                                                             | 24                   |
| `new OperandTypeResolver` sites                  | `grep -rn "new OperandTypeResolver" src \| grep -v __tests__ \| wc -l`                                                                                                    | 13                   |
| #1664 box 4a                                     | its grep                                                                                                                                                                  | 8                    |
| #1664 box 4b                                     | its grep                                                                                                                                                                  | 21                   |
| #1667 float-literal grep                         | its grep                                                                                                                                                                  | 0                    |
| #1671 greps                                      | `perFilePassByValueParams` / `symbolCollectors`                                                                                                                           | 4 / 4                |
| `*.test.cnx` fixtures                            | `find tests -name '*.test.cnx' \| wc -l`                                                                                                                                  | 1272                 |
| Saturating float→int ternaries                   | `grep -rhoE '\) > \(\((float\|double)\)'` over `.expected.c/.cpp`                                                                                                         | 82 sites in 24 files |
| `parse-tree-sites.md` total                      | read from the file                                                                                                                                                        | 102                  |

---

## 1. Result structure and the one typer API

### 1.1 Contracts

Each contract is in its own file under `src/cnx/types/`, and each is pure data.

**Moved in:**

- `TSubscriptKind`, from `2-Plan`. It is a four-string union.
- `TChainRoot` (`"this" | "global" | null`), from `1-Analyze/types`.

```ts
// TEssentialCategory.ts
type TEssentialCategory =
  | "signed"
  | "unsigned"
  | "floating"
  | "boolean"
  | "enum"
  | "character"
  | "none";

// IOperandType.ts
interface IOperandType {
  readonly type: TType; // settled element type, after every applied subscript
  readonly typeName: string; // TypeResolver.getTypeName(type): the one spelling ('u32','S__Cfg')
  readonly dimensions: ReadonlyArray<number | string>; // dimensions still to subscript, leading first; [] = scalar
  readonly category: TEssentialCategory; // decided once (G8)
  readonly bitWidth: number | null;
  readonly stringCapacity: number | null;
  readonly enumTypeName: string | null; // via DeclaredTypeFacts.of (one derivation)
  readonly bitmapTypeName: string | null;
  readonly overflow: TOverflowBehavior | null; // ONLY for a whole named variable (today's population, ETR:214-279)
  readonly hasSideEffect: boolean; // evaluating it calls a function or reads a volatile/atomic declaration
  readonly form: TOperandForm; // what caller policy reads (§5)
  readonly binding: TValueBinding | null; // for a name-rooted operand; declaration flags live here
}

// TOperandForm.ts
type TOperandForm =
  | { kind: "declared" } // variable, param, for-var, field, element, scope/register member, bitmap field
  | { kind: "call"; calleeCName: string }
  | {
      kind: "literal";
      literal: "integer" | "float" | "bool";
      suffixed: boolean;
    }
  | { kind: "cast" }
  | { kind: "bitIndex" }
  | { kind: "bitRange"; width: number | null } // width folded by the one const environment (§2.4)
  | { kind: "boolean" } // applied || && = != < > <= >=, and `!`
  | { kind: "composite"; leaves: ReadonlyArray<IOperandType | null> }
  | {
      kind: "ternary";
      arms: readonly [IOperandType | null, IOperandType | null];
    }
  | { kind: "enumMember" }
  | { kind: "foreign"; indeterminate: boolean }; // indeterminate: C++ overloads whose categories disagree (C03)

// IChainStep.ts / IChainTyping.ts
interface IChainStep {
  readonly before: IOperandType | null; // the prefix the op applies to (ADR-036/058 ask this)
  readonly subscript: TSubscriptKind | null; // from SubscriptClassifier (one decision)
  readonly after: IOperandType | null;
}
interface IChainTyping {
  readonly root: TValueBinding | null;
  readonly steps: ReadonlyArray<IChainStep>; // one per op, after a this./global. root has consumed its op
}

// IForeignSymbolLookup.ts: structural, so no contract names SymbolTable (precedent: IStructFieldLookup.ts:18)
interface IForeignSymbolLookup {
  getCSymbol(name: string): TCSymbol | undefined;
  getCppSymbol(name: string): TCppSymbol | undefined;
  getCppOverloads(name: string): ReadonlyArray<TCppSymbol>;
  getStructFieldInfo(
    structName: string,
    field: string,
  ): /* existing shape */ unknown;
  getStructFields(structName: string): /* existing shape */ unknown;
  isTypedefStructType(name: string): boolean;
}

// ITypingContext.ts
interface ITypingContext {
  readonly sourceFile: string;
  readonly symbols: ICodeGenSymbols; // this file's view
  readonly program: IProgram; // 1.4's artifact, including the lexical frames (§2)
  readonly symbolTable: IForeignSymbolLookup; // SymbolTable satisfies it structurally
}
```

- **Signature types.** The `unknown` shapes above stand for the existing `SymbolTable` return types. They are copied verbatim when the interface is written, because the `unknown-carriers` gate forbids an `unknown` parameter.
- **Declaration flags.** `isConst`, `isAtomic`, `isVolatile`, pointer and parameter kind are read from `binding`, never copied onto the value. They are facts about the declaration, and §2 is their only source.
- **`TTypeInfo`** (`TTypeInfo.ts`) stays as what render reads. It gets **one** producer, `DeclaredTypeInfo.of(binding, symbols)` in 2-Plan (§4.3). That producer replaces all of these:
  - `TypeRegistrationEngine`
  - `FunctionContextManager.registerParameterType :247-287`
  - `DeclaredVariableFacts.fromSymbol :80-137`
  - `TranspileState.getMemberTypeInfo`

### 1.2 The API

The typer lives in `src/cnx/utils/OperandTyper.ts`. It is a static class with no fields and no module state (from the spine).

```ts
class OperandTyper {
  /** Value type of any expression-level node: descends single-child levels, parens, unary, ternary, composites. */
  static typeOf(
    node: ParserRuleContext,
    ctx: ITypingContext,
  ): IOperandType | null;
  /** Per-op typing of a postfix chain or assignment target. */
  static chainOf(
    node: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    ctx: ITypingContext,
  ): IChainTyping;
  /** VALUE leaves of one arithmetic/relational level, by the ONE collection rule (§3.6). */
  static valueLeaves(
    node: ParserRuleContext,
    ctx: ITypingContext,
  ): ReadonlyArray<IOperandType | null>;
  /** Form boolean, or type bool. A bitIndex is NOT boolean (OperandTypeResolver.ts:126-129, preserved). */
  static isBoolean(t: IOperandType | null): boolean;
}
```

**Companion utils modules.** Each exists because two or more passes call it.

| Module                                 | What it holds                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/cnx/utils/CompositeType.ts`       | `integerOf(leaves)` and `anyFloating(leaves)`. It replaces `PrimitiveKindUtils.widestIntegerOf :76` and `anyFloating :98`. |
| `src/cnx/utils/SubscriptClassifier.ts` | Moved. `isArrayAccess` takes `Pick<TTypeInfo, "isArray" \| "isString"> \| null`.                                           |
| `src/cnx/utils/ChainRoot.ts`           | Moved from `1-Analyze/helpers`.                                                                                            |
| `src/cnx/utils/DeclaredPointer.ts`     | `of(decl, foreign)` and `calleeOf(expr)` (§2.4).                                                                           |
| `src/cnx/utils/ForeignTypeFacts.ts`    | Rewritten to `operandType(...)` (§3.5).                                                                                    |

**Placement.**

- It cannot go in `1-Analyze`: `render-cannot-import-analyzers` forbids that.
- It cannot go in `2-Plan`: `analyze-cannot-import-plan` forbids that.
- The typer imports none of `TranspileState`, `IAnalysisContext`, `1-Analyze`, `2-Plan`, `3-Render`, `4-Resolve`, `BitUtils` or the `Program` class. The existing rules enforce this through reachability (§8.5).

**What each caller passes.**

- **2.1:** `this.context`. `IAnalysisContext` (`1-Analyze/types/IAnalysisContext.ts:44-64`) gains `readonly sourceFile: string`. It then satisfies `ITypingContext` structurally, because `SymbolTable` satisfies `IForeignSymbolLookup`. `Transpiler._analyzeFile` adds `sourceFile: sourcePath` to the literal at `Transpiler.ts:1017-1023`.
- **2.2 and 2.3:** `state.typingContext()`, a new method on `TranspileState`. It is modelled on `typeBindingDeps()` (`:945`). It builds a fresh object each call and stores nothing. It uses `invariant()` to assert `symbols` (`:510`), `program` (`:525`) and `sourcePath` (`:741`), the same way `Transpiler.ts:1004-1008` does.
- **Positions** always come from the node (`ParserUtils.getPosition`, `:28-35`). The typer never reads `currentScopePath`, `resolveIdentifier`, `localVariables` or a registry.

**Statelessness.** The answer is a pure function of `(node, ctx)`. `ctx.program` is frozen (`Program.ts:162`). A unit test asserts that the class declares no field. `passes-hold-no-mutable-state` does not scan `utils`: its `PASS_ROOTS` are `src/cnx/PARSE` and `src/cnx/TRANSPILE` (`:70`).

---

## 2. The declaration artifact

### 2.1 What it holds

```ts
// src/cnx/types/ILexicalFrame.ts
interface ILexicalFrame {
  readonly kind: "file" | "scope" | "function" | "block" | "for";
  readonly span: ISourceSpan; // the construct that opened it (ParserUtils.getSpan)
  readonly scopePath: string; // "" outside a scope
  readonly functionCName: string | null; // "function" frames: IFunctionSymbol identity
  readonly declarations: ReadonlyArray<ILocalDeclaration>; // source order
  readonly children: ReadonlyArray<ILexicalFrame>; // source order, non-overlapping
}
// src/cnx/types/ILocalDeclaration.ts
interface ILocalDeclaration {
  readonly name: string;
  readonly kind: "local" | "parameter" | "for" | "constructor";
  readonly span: ISourceSpan; // span of the declarator IDENTIFIER
  readonly type: TType; // 1.3 may leave TDeferredType; 1.4 settles it
  readonly arrayDimensions: ReadonlyArray<number | string>; // ADR-035 inferred; folded by 1.4 in the lexical const env
  readonly isConst: boolean;
  readonly isAtomic: boolean;
  readonly isVolatile: boolean;
  readonly overflowBehavior: TOverflowBehavior; // fromModifier; never absent; parameter => "clamp"
  readonly initialValue: string | null; // ADR-045 capacity, const folding, ADR-046 text test
  readonly initializerCallee: string | null; // #895: DeclaredPointer.calleeOf(initializer) (Tier-1 text)
  readonly constValue: number | null; // 1.4: a const local folded in the lexical environment
}
```

**Coverage.** The artifact covers every function body, braced block, `for` header (`forVarDecl`, `Cnx.g4:300-302`: atomic, volatile and overflow, but no const), constructor declaration (`Cnx.g4:197`) and scope body, together with how they nest.

**Kept out on purpose.**

- File-scope globals and scope members stay as the `IVariableSymbol`s they already are, in `IFileSymbols.symbols`, and are reached by C-name identity. They are visible regardless of position, matching `registerAllVariableTypes` (`CodeGenWalker.ts:2338-2342`).
- Locals are never added to `SymbolTable`, whose bare-name index is G12's hazard (`SymbolTable.ts:219-222`).

**Facts the frames lack today.** These are overflow, atomic, parameter, pointer, size, capacity and const values (`IDeclaredVar.ts:31-48`). All of them come from decoders that already exist:

| Fact                                                     | Source                                                                                                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type, modifiers, ADR-045 capacity, ADR-035 inferred size | `VariableCollector.collect` (`:158`) is split into `declaredFacts(ctx, scopePath, constValues, isScopeType)` plus identity. Globals and locals then share one derivation.     |
| Overflow                                                 | `OverflowBehaviorUtils.fromModifier` (`:26-33`) returns `"clamp"` for null. Parameters have no modifier in the grammar (`Cnx.g4:165-167`), so #1681 is fixed by construction. |
| Parameter type, const and dimensions                     | Filled by 1.4 from `IFunctionSymbol.parameters` (the one source, settled by `DeferredTypes`). 1.3 records only the frame and the span.                                        |

### 2.2 Who builds it, and when

| Stage                                                            | Pass        | Work                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stage 3: `_declareFile` → `CnxResolver.resolve` (`cnx/index.ts`) | **1.3**     | `src/cnx/PARSE/3-Declare/cnx/collectors/LexicalScopeCollector.ts` walks the file once with a listener. Its shape is today's `DeclarationScopeCollector` (`:139-200`), moved and re-keyed. The listener holds only numbers and records. The result goes on a new field, `IFileSymbols.lexicalScopes: ILexicalFrame`. It builds no names (`collectors-build-names-from-scopes`, `.dependency-cruiser.cjs:62-90`). |
| Stage 3: `Program.build` (`Transpiler.ts:772`, `Program.ts:103`) | **1.4**     | `src/cnx/PARSE/4-Resolve/LexicalFrames.ts` runs `settle(files, isScopeType, consts, functionsByCName)`. Step (a) settles deferred types: `DeferredTypes.settleType` (`:173`) becomes public. Step (b) fills parameter declarations. Step (c) folds const locals in source order. Step (d) folds dimensions in the same environment. Step (e) freezes the result.                                                |
| Stage 4d (`Transpiler.ts:539-548`)                               | **2.1**     | Reads the artifact through `context.program`.                                                                                                                                                                                                                                                                                                                                                                   |
| Stage 5 (`:556-570`)                                             | **2.2/2.3** | Reads the same object through `state.program`.                                                                                                                                                                                                                                                                                                                                                                  |

**Why this ordering works.**

- 2.1 runs on every file before any file is planned. Program is complete before 2.1 and lives for the whole run.
- So G5's choice disappears: there is no node-keyed holder that crosses stages, no roster row, and no rebuild in Stage 5.
- No orchestrator field is added. That is #1671's concern, and it stays untouched.

### 2.3 Query surface, key and lifetime gates

`IProgram` (`src/cnx/types/IProgram.ts`) gains four methods. `P` is `Pick<ISourceSpan, "line" | "column">`, which `ParserUtils.getPosition` satisfies structurally. It is used so that no shared contract imports `utils/types`.

```ts
lexicalFrameAt(sourceFile: string, at: P): ILexicalFrame;                        // innermost; file frame if none
lexicalDeclarationAt(sourceFile: string, name: string, at: P): ILocalDeclaration | null; // lexical half only (#1398 visibility)
bindValue(sourceFile: string, root: TChainRoot, name: string, at: P): TValueBinding | null;
constValuesAt(sourceFile: string, at: P): ReadonlyMap<string, number>;          // visible local consts over constValuesIn(scopePath)

type TValueBinding =
  | { kind: "local"; declaration: ILocalDeclaration; scopePath: string }
  | { kind: "variable"; symbol: IVariableSymbol }     // global or scope member, by C-name identity
  | { kind: "scope"; scopePath: string }
  | { kind: "foreign"; name: string };
```

- **Stable positions.** 2.1 reads the same parse 1.3 declared (1.3 `Declare` carries 1.2's syntax to 2.1 `Analyze`), and Stage 5 reads the plain data 1.2 lowered from that same parse (`analyzedFiles`, #1932), so a node's position is the same in every pass.
- **Comparison.** Positions compare lexicographically on `(line, column)`.
- **artifact-lifetime.**
  - `IFileSymbols` and `Program` are already in `ARTIFACTS` (`artifact-lifetime.test.ts:146-160`).
  - `ILexicalFrame` is added by name, so a later field of node type fails on the frame itself.
  - The cases at `:252` (no artifact reaches a parse node), `:294` (pins every field) and `:342` (no pass after 1.3) are unaffected, because nothing new holds a node.
  - The 24 per-analyzer `Map<ParserRuleContext, IScopeFrame>` (`ScopeFrameResolver.ts:29`, `DeclarationScopeCollector.ts:33`) are deleted, not moved.

### 2.4 Const values, dimensions and pointers

**One evaluator.** `ArrayDimensionParser.parseText(text, options)` exposes the text path that `parseSingleDimension` already reduces to (`ArrayDimensionParser.ts:87-111`). Three callers use it:

- 1.4, for const locals.
- 1.4's global consts. This replaces the literal-only `Program.constValueOf` (`Program.ts:631-635`), so 2.2 stops being the only folder of `u32 B <- A + 1` (read-only, ADR-071) (`TypeRegistrationEngine.ts:99-105`).
- 2.2's `tryEvaluateConstant` (`CodeGenWalker.ts:1341`), over `constValuesAt`.

**Array dimensions** are read off the settled declaration by both `.c` and `.h`, and are **never re-folded in 2.2**. Otherwise #1538's `.c` and `.h` could split (risk R5).

**`#895`, `#958` and ADR-046.** `DeclaredPointer.of(decl, foreign)` holds the three arms of `CodeGenWalker._inferVariableType :4448-4486`, in order:

1. A typedef-struct type gives `T*` (#958).
2. A C function returning `T*` for a declared `T` gives `T*` (#895 Bug B; `_inferPointerTypeFromFunctionCall :4491-4526`).
3. A `c_` prefix with a `STRUCT_POINTER_C_FUNCTIONS` substring in `initialValue` gives `T*` (ADR-046).

`DeclaredPointer.calleeOf(expr)` is `_extractCFunctionName`, moved. 1.3 calls it to record `initializerCallee`. `_inferVariableType` (the emitted text) and `DeclaredTypeInfo.of` (the flag) both call `DeclaredPointer.of`, so the declaration and its type info cannot disagree.

---

## 3. Name resolution

`at` is the use node's position. The binding decision is `program.bindValue`, the only place a spelling becomes a declaration.

### 3.1 Value names

**A bare name (`root === null`)** resolves in this order:

1. **Lexical frames**, innermost to outermost within the function. In each frame, take the last declaration of `name` whose `span` starts strictly before `at`.
   - This fixes #1702: a later same-block declaration does not bind.
   - It fixes #1666: sibling blocks are disjoint and there is no flat key.
   - It covers locals, parameters and `for` variables.
   - `u8 x <- x` binds the inner `x`, which is today's behavior. That case is still #1643.
2. **The enclosing scope member:** `symbolByCName(ScopeUtils.qualifyInScope(name, frame.scopePath))`. Scopes cannot nest (`Cnx.g4:77-88`). A local shadowing a member binds the local, because step 1 runs first. That fixes #1700: today `TranspileState.resolveIdentifier :1223-1236` checks members only.
3. **A file-scope global:** `symbolByCName(name)`. This is exact identity, not `getTSymbol`'s first bare-name match (fixes G12). ADR-063 forbids `__`, so a global cannot collide with a member's C name.
4. **A cnx scope name** gives `{kind: "scope"}`.
5. **A C or C++ header name** gives `{kind: "foreign"}`.

**`this.x`** looks up `symbolByCName(qualifyInScope(x, frame.scopePath))` across the whole run. A scope reopened in another file (#1333) therefore binds (fixes #1699 and G2). Outside a scope the result is null, which is E0431's case. The false premise at `ScopeFrameResolver.ts:153-156` is deleted along with the file.

**`global.x`** is `symbolByCName(x)` only, never lexical, so a local cannot capture it (fixes #1701; `AssignmentClassifier.ts:100-102`). `global.Scope.x` binds the scope, then the member.

**`Scope.x`** binds the root as `{kind: "scope"}`, then takes the member step `symbolByCName(getTranspiledCName({scopePath, name}))` (fixes C07 and C13). Every spelling goes through the `ScopeUtils` encoders, so `scope-joins:check` gains no site. `OperandTypeResolver.ts:232` goes away.

**Emission shares the decision** (graft from incremental; needed for #1700 box 3). `TypeValidator.resolveBareIdentifier` (then `3-Render/codegen/TypeValidator.ts:77-127`, now `2-Plan/TypeValidator.ts`) takes the `TValueBinding` instead of `isLocalVariable` plus `_resolveScopeMember`:

- `local` gives the declaration's `emittedName`, which keeps the ADR-057 rename. #1934 settles it in 1.4, on the declaration, so it is bound at the use's position and a block's rename ends with the block (#1953); before, 2.3 kept it in a per-function map.
- `variable` gives `symbol.fullyQualifiedCName`.
- `foreign` gives null.

The walker's three call sites pass the node's position. The emitted names are expected to be byte-identical, because both orders are already local-first in emission. P3 checks that.

### 3.2 Calls

| Shape                                 | Binding                                                                                                                           | Result                                                                                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Bare `f()`                            | `program.resolveFunction(f, program.scope(frame.scopePath) ?? program.globalScope())` (`IProgram.ts:221`), the rule emission uses | `IFunctionSymbol.returnType`. Fixes G1/#1698, and C02 (a header function no longer answers for the scope's own function). |
| `this.f()`, `Scope.f()`, `global.f()` | Function symbol by C name                                                                                                         | Return type. Fixes C17; 2.2 types none of these today (`ETR.ts:495`).                                                     |
| Callback `s.fn()` (ADR-029)           | The current value's `TType` is a callback; `symbolByCName` gives its defining function                                            | Its return type                                                                                                           |
| `get().v`, `make().fn()`              | The walk continues from every call result                                                                                         | Typed. Fixes C10 and C27 (`OperandTypeResolver.ts:227`) and C28.                                                          |
| C/C++ function                        | `ForeignTypeFacts.operandType` (§3.5)                                                                                             | Typed foreign result, possibly indeterminate                                                                              |

### 3.3 Casts, literals, ternaries, unary operators, shifts, Boolean-valued sub-expressions

| Shape                            | `IOperandType`                                                                                                                                                                          |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cast `(T)x`                      | `T` resolved through `TypeNameLadder` (not raw text as at `ETR.ts:765-768`), form `cast`, `hasSideEffect` from the operand. A cast to a header float typedef is floating (C04, C23).    |
| Literal                          | `LiteralUtils.typeOf` (`:137-160`). Integer is `int`, or `uN`/`iN` when suffixed. Float is `f32`/`f64`. `true`/`false` is `bool`. Policy decides what each consumer reads (§5).         |
| Ternary                          | Form `ternary` with both arm types. `type` is the arms' common type, or category `none` when they disagree. The condition is never a leaf (`ParserUtils.ternaryValueArms`, `:252-258`). |
| `(e)`                            | Recurses into `e`. A parenthesized composite or ternary is typed, which fixes `ETR.ts:759-763` and the `(g+1)+1` clamp loss.                                                            |
| `-x`, `~x`                       | The operand's type (2.2's answer, `ETR.ts:790-805`)                                                                                                                                     |
| `!x`                             | Form `boolean`. This is 2.1's answer (`OperandTypeResolver.ts:439-442`) and fixes G10 in 2.2.                                                                                           |
| `&x`                             | null, and never a leaf (#1152)                                                                                                                                                          |
| `a << n`                         | `a`'s type. `n` is never a value leaf (C01).                                                                                                                                            |
| Applied `\|\| && = != < > <= >=` | Form `boolean`. It is one leaf and is not descended (C00).                                                                                                                              |
| ADR-058 properties               | null. Unchanged in both passes.                                                                                                                                                         |

### 3.4 Fields, elements, bits, enums, bitmaps, registers, strings

| Shape                  | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field of a cnx struct  | `program.symbolByCName(structCName).fields`. This covers the same file and imports alike. Per G3 and G4, this replaces `StructFieldFacts`' per-file view and `importedFieldType` (`OperandTypeResolver.ts:185-194`). It keeps the three states: `[…]`, `[]` (a scalar that exists) and `null` (unknown). A local typed `this.Cfg` or bare `Cfg` resolves because its `TType` is already `S__Cfg`. So `BareEnumMemberAnalyzer.structSpellings :277-286` is deleted. |
| Field of a C struct    | Only `ForeignTypeFacts`, followed through typedefs. The raw C string (`TranspileState.ts:1284-1292`) is never returned (fixes C15).                                                                                                                                                                                                                                                                                                                                |
| Element                | Removes the **leading** dimension per subscript: 2.1's rule, `OperandTypeResolver.ts:126-134`. Fixes the `grid[1][0]` → `bool` case at `ETR.ts:706-716`. A string element is `char`, category `character`.                                                                                                                                                                                                                                                         |
| Subscript kind         | `SubscriptClassifier.classify` (moved, unchanged rule) on `before`. An unknown type still defaults to array access (`SubscriptClassifier.ts` `isArrayAccess(null)`). A bit-range width comes from `constValuesAt` (fixes C18b; `IntegerConversionAnalyzer.ts:302-305` accepted digits only).                                                                                                                                                                       |
| Enum                   | A variable gets `enumTypeName`. `E.A`, `S.E.A` and `this.E.A` get form `enumMember`. This covers every pattern `EnumTypeResolver` handled.                                                                                                                                                                                                                                                                                                                         |
| Bitmap field `fg.Mode` | Width from `symbols.bitmapFields`. 1 bit is boolean; a wider field is unsigned of that width (ruling: "however reached").                                                                                                                                                                                                                                                                                                                                          |
| Register member `R.M`  | `symbols.registerMemberCTypes`, a bitmap when that name is in the visible `knownBitmaps` (#1514), with `overflow: null` (fixes C11). The inverse C-name map goes in `utils/constants`, not `BitUtils`.                                                                                                                                                                                                                                                             |

### 3.5 Foreign (C/C++) facts, in one place

`ForeignTypeFacts.operandType(nameOrPath, lookup)` replaces both `typeNameOf` (C then C++, `DeclaredVariableFacts.ts:154`) and `typeInfoOf` (C only, `:207-208`). One lookup fixes C16 and C22.

| Shape                                                                             | Answer                                                                                                                                                                                |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| float, double or long double, directly or through typedefs (`:124-138` loop kept) | Category floating. `long double` fixes C24a.                                                                                                                                          |
| Array variable, or an array of structs                                            | Keeps `arrayDimensions`, which fixes the early struct return at `:36` before the array check at `:37`. `cArr[1]` is a floating element; `cAnons[1].x` resolves (C06, C08, C14, C21).  |
| Array typedef `typedef float vec3[3]`                                             | `CResolver.buildTypedefType` (`c/index.ts:423-440`) records the declarator's dimensions, and a variable inherits them (C20; restores `gv[0U]`).                                       |
| C++ `Ns.f()`, `Ns.v`, `Class.f()`, `obj.m()`                                      | Key `Ns::f` / `Class::m`, the key `cpp/collectors/FunctionCollector.ts:58`, `:143` uses (C05). An instance method is reached through its class type.                                  |
| C++ overloads (`getCppOverloads`, `SymbolTable.ts:415-417`)                       | One category when every overload agrees. Otherwise form `foreign`, `indeterminate: true` (C03).                                                                                       |
| C++ `using` and typedef aliases; a C function-pointer field                       | The alias is followed. A function-pointer call result is the return part of its typedef (C24b, C24c). P1 confirms the collectors record these; any shape they do not record is filed. |
| C and C++ integers                                                                | Stay untyped, per #978 (`ForeignTypeFacts.ts:5-21`). C09 is open question Q4.                                                                                                         |

A cnx declaration whose `TType` is `external` (`real_t k`) is typed through the same typedef walk.

### 3.6 The one composite-collection rule

`valueLeaves(node)`:

- **Descends** through arithmetic and bitwise levels, parentheses, ternary **value arms**, and unary `-` and `~`.
- **Stops** at a postfix chain, a cast, a Boolean-valued level or `!` (one `boolean` leaf), and an ADR-058 property (one untyped leaf).
- **Excludes** `&x` and a shift count.

It replaces four collectors:

- `ETR.collectOperandPostfixes :382-412`
- `IntegerConversionAnalyzer.postfixLeaves :307-319`, which lacked the #1152 exclusions (G8)
- `MixedTypeCategoryAnalyzer.collectOperandCategories`/`postfixCategories :128-191`
- The hand copy at `ArrayIndexTypeAnalyzer.ts:186` (C34)

---

## 4. Migration, site by site

### 4.1 Pass 2.1

| Site at HEAD                                                                                                                                                                                                                                                                                          | Afterwards                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `OperandTypeResolver`: `typeOfOperand :413`, `typeOfPostfixExpression :315`, `typeOfPostfixPrefix :382`, `typeOfAssignmentTarget(Prefix) :272-308`, `applyChain :205-259`, `fieldType :146-166`, `importedFieldType :185-194`, `isBooleanType :67`                                                    | `typeOf`, `chainOf(..).steps[i]`, `OperandTyper.isBoolean`. **File deleted.**                                             |
| 13 constructions: ArrayIndexBounds :64, BareEnumMember :78, BooleanOperand :64, SliceAssignment :71, IntegerConversion :75, CppClassInitializer :166, CallbackAssignment :328, EnumTypeSafety :111, LengthProperty :67, SwitchStatement :52, MixedTypeCategory :307, EnumValueResolver :51, Shift :76 | None. The analyzer passes `this.context`.                                                                                 |
| `ScopeFrameResolver` and `DeclarationScopeCollector` in 24 analyzers (list in §0.4's command)                                                                                                                                                                                                         | `program.lexicalFrameAt` / `lexicalDeclarationAt` / `bindValue`. **Both deleted**, with `IScopeFrame` and `IDeclaredVar`. |
| `DeclaredVariableFacts.typeNameOf`/`typeInfoOf`/`symbolOf`                                                                                                                                                                                                                                            | `bindValue` + `ForeignTypeFacts.operandType`. **File deleted** in C8.                                                     |
| `MixedTypeCategoryAnalyzer.categoryOf :95-101` and its collectors                                                                                                                                                                                                                                     | `valueLeaves` + `MixedTypeCategoryAnalyzer.rule104Category` (§5)                                                          |
| `IntegerConversionAnalyzer.sourceTypeOf`/`leafType`/`postfixLeaves`/`literalValue :232-319` and its literal regex                                                                                                                                                                                     | `typeOf`, `valueLeaves`, `IntegerConversionAnalyzer.conversionSource` (§5)                                                |
| `ArrayIndexTypeAnalyzer`: `VariableTypeCollector :32`, `resolveOperandType :208`, `resolveBaseType :243`, `resolvePostfixOpType`, `:186`                                                                                                                                                              | `typeOf`. Fixes #1694: `VariableTypeCollector` is deleted.                                                                |
| `ShiftAnalyzer.declaredTypeAt :84`, `isSignedTarget :318-368`, `isSigned* :388-438`                                                                                                                                                                                                                   | `chainOf(target)`, `typeOf`                                                                                               |
| `FloatModuloAnalyzer.isFloatOperand :81-104`                                                                                                                                                                                                                                                          | `typeOf(..).category === "floating"`                                                                                      |
| `CompoundAssignmentAnalyzer.rejectionFor :136-180`                                                                                                                                                                                                                                                    | `chainOf(target)`                                                                                                         |
| `EnumValueResolver.classify :54-97`, `enumTypeNameFor :140`                                                                                                                                                                                                                                           | `typeOf` (`enum`/`enumMember` forms). The spelling normalization is deleted.                                              |
| `BareEnumMemberAnalyzer.structSpellings :277-286`                                                                                                                                                                                                                                                     | Deleted                                                                                                                   |
| `SliceAssignmentAnalyzer.declarationOf :121-132`, `StringDeclarationAnalyzer.capacityOfName :281-292`                                                                                                                                                                                                 | `bindValue` → dimensions and capacity                                                                                     |
| `UndeclaredValueAnalyzer :154, :246, :326` (#1398 visibility)                                                                                                                                                                                                                                         | `lexicalDeclarationAt` plus the per-file sets, as today                                                                   |
| `StructFieldFacts` typing uses (OperandTypeResolver :147, :159; Shift :342; CompoundAssignment :129, :132; BareEnumMember :262; ArrayIndexType :304; TranspileState :1263, :1273)                                                                                                                     | The field step of `chainOf`. **Module deleted** once it has no caller.                                                    |

### 4.2 Passes 2.2 and 2.3: typing sites

| Site                                                                                                                                                                                                                                                       | Afterwards                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ETR.getExpressionType :93-128` ← `CodeGenWalker.ts:1105`, `:4851`                                                                                                                                                                                         | `PlanTyping.directTypeName(expr)`                                                                                                                                                                                                |
| `ETR.getIntegerExpressionType :148` ← `:4853`; `getCompositeIntegerType :173` ← `:838-839`, `:867-868`                                                                                                                                                     | `CompositeType.integerOf(valueLeaves(..))`                                                                                                                                                                                       |
| `ETR.getCompositeOverflowBehavior :192-232` with `operandTypeInfo`, `scopeMemberOperandTypeInfo :261`, `memberChainKey :295-310` ← `:840-844`, `:869-873`                                                                                                  | `PlanTyping.overflowOf(valueLeaves(..))`                                                                                                                                                                                         |
| `ETR.hasFloatingOperand :327` ← `:4855` (then `AssignmentClassifier` `compoundClampOp`)                                                                                                                                                                    | `CompositeType.anyFloating(leaves)`                                                                                                                                                                                              |
| `ETR.getPostfixExpressionType :516` and suffix walkers `:577-720`, `callReturnType :490`, `bitExtractionWidth :432`                                                                                                                                        | `typeOf` / `chainOf`                                                                                                                                                                                                             |
| `ETR.getUnaryExpressionType :790` ← `:484-485` (`~`), `:2887-2891` → `planCast`                                                                                                                                                                            | `PlanTyping.castSourceType(unary)`                                                                                                                                                                                               |
| `ETR.getPrimaryExpressionType :776` (test-only caller)                                                                                                                                                                                                     | Deleted                                                                                                                                                                                                                          |
| ETR predicates: `CodeGenerator.ts:276`, `:284`, `:820`; `CodeGenWalker.ts:2881`; `UnaryExprGenerator.ts:87`                                                                                                                                                | `TypeCheckUtils.isFloat`/`isInteger`/`isUnsigned` and `DeclaredTypeFacts.isStruct`. **`ExpressionTypeResolver.ts` deleted**, with `2-Plan/__tests__/ExpressionTypeResolver.test.ts` and both `vi.mock` blocks (§8.4).            |
| `EnumTypeResolver` (`resolve :53`, one caller `CodeGenWalker.ts:901`)                                                                                                                                                                                      | `getExpressionEnumType(ctx)` returns `OperandTyper.typeOf(ctx, ctx').enumTypeName`. **Module and its test deleted.** Its three `scope-join` rows go too.                                                                         |
| `TranspileState.getStructFieldInfo`/`getMemberTypeInfo`/`getStructFieldType`/`isStructFieldArray :1269-1356`, and the delegates at `CodeGenerator.ts:675-694`, `IOrchestrator`, `ICodeGenApi`                                                              | The field step of `chainOf`. Each member is deleted where knip finds no caller; the rest delegate to `chainOf`. The stale comment at `:1283` goes.                                                                               |
| `AssignmentClassifier.targetTypeInfo :89-104` and its reads; `AssignmentContextBuilder.ts:237` (raw registry view fed at `CodeGenWalker.ts:4840`)                                                                                                          | `AssignmentContextBuilder` computes `chainOf(target)` once and puts the **values** on `IAssignmentContext.targetTyping`. The three `this.x` encoders (`AssignmentClassifier.ts:97`, `ETR :300-305`, `:650-653`; G6) are deleted. |
| `PostfixExpressionGenerator` `ITrackingState` type fields (`currentStructType`, `remainingArrayDims`, `currentMemberIsArray`, `:45-57`, `:94-137`) and `SubscriptClassifier` at `:1812`; `MemberChainAnalyzer :113`, `:168`; `AssignmentClassifier.ts:849` | `planPostfixExpression` passes `IChainTyping` values. Render reads `steps[i]` and computes no type (C12). Text decisions stay in render.                                                                                         |
| `CastRequirement.requiresClamping(sourceType: string, …) :79-89` (`FLOAT_TYPES` list, G8)                                                                                                                                                                  | Takes `IOperandType`: `category === "floating"`. New `clampForm(t)` returns `"helper"` when `t.hasSideEffect`, else `"inline"`.                                                                                                  |
| `TypeValidator.resolveBareIdentifier :77-127`                                                                                                                                                                                                              | Takes a `TValueBinding` (§3.1)                                                                                                                                                                                                   |
| `dimensionEvalOptions(state)` (12 callers), `tryEvaluateConstant :1341`                                                                                                                                                                                    | `constValuesAt(sourceFile, pos)` (C11)                                                                                                                                                                                           |
| `HeaderSymbolAdapter.ts:190` (reads the flat `state.constValues` after the walk)                                                                                                                                                                           | `program.constValuesIn(symbol.scopePath)` (C11)                                                                                                                                                                                  |

### 4.3 The 59 `getVariableTypeInfo` reads

The accessor becomes `declarationTypeInfo(name, at: ParserRuleContext)` in C7, so the compiler checks that every read carries a position. It is **one** projection in 2-Plan: `bindValue` followed by `DeclaredTypeInfo.of(binding, symbols)`.

`DeclaredTypeInfo.of` reproduces each registry convention exactly, and P2 checks each one:

- A local string is `char`, `isArray`, `[…, N+1]`.
- A scalar string parameter is `"string"` (`FunctionContextManager.ts:199-206`).
- A typedef-struct parameter has `isPointer`.

**Migration rule.** A site changes where its answer comes from, never which expressions it asks about.

| Group              | Sites                                                                                                                                                                                                                                         | Afterwards                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ETR internals      | ETR :224, :276, :679, :733                                                                                                                                                                                                                    | Deleted (§4.2)                                                                                                                                               |
| Assignment target  | AssignmentClassifier :94, :97, :102, :240, :289, :374, :647, :657, :823, :1000                                                                                                                                                                | `ctx.targetTyping`                                                                                                                                           |
| Handlers           | BitAccessHandlers :30, :65, :98; BitmapHandlers :106, :127, :145; StringHandlers :33, :121; ArrayHandlers :465; AssignmentExpectedTypeResolver :114, :161, :203 (its `\|\| "clamp"` default at `:124` goes, because overflow is never absent) | `ctx.targetTyping`                                                                                                                                           |
| Postfix chain      | PostfixExpressionGenerator ×14; MemberChainAnalyzer :113                                                                                                                                                                                      | `declarationTypeInfo` in C7, then `IChainTyping` in C12                                                                                                      |
| Walker             | CodeGenWalker :935, :978, :1031, :2987, :3014, :3068, :4125                                                                                                                                                                                   | `declarationTypeInfo(name, node)`                                                                                                                            |
| Call arguments     | CallExprGenerator :185, :401; ArgumentGenerator :47                                                                                                                                                                                           | Per-argument typing from `planCallArguments`. `ArgumentGenerator`'s adjacent `localArrays` check (`:38`) reads `dimensions.length > 0` from the same answer. |
| Enum               | EnumTypeResolver :66, :167                                                                                                                                                                                                                    | Deleted with the module                                                                                                                                      |
| Misc               | TypeValidator :154; StringOperationsHelper :57; StringLengthCounter :218                                                                                                                                                                      | `declarationTypeInfo` with the node                                                                                                                          |
| Writers' own reads | TypeRegistrationEngine :587; ArrayInitHelper :129; CodeGenWalker :4649                                                                                                                                                                        | Deleted with the writers                                                                                                                                     |

**`localArrays`** duplicates the dimensions fact. Its writers are deleted in C7 once its two readers read the typer: `StringDeclHelper.ts:116`, `VariableDeclHelper.ts:147`, `:165`, `ArrayInitHelper.ts:85`, and `TranspileState.ts:624`, `:1513`.

### 4.4 Registry and `constValues` writers deleted

**Registry writers (C8):**

- `TypeRegistrationEngine`, the whole module: `register`, `trackVariable`, every `setVariableTypeInfo`. Its callers at `CodeGenWalker.ts:1676`→`:2345` and `:4623` go too.
- `TypeRegistrationUtils`, the whole module.
- `FunctionContextManager.registerParameterType`'s registry part (`:286`) and the ADR-025 delete (`:350`).
- `CodeGenWalker.planConstructorDecl` set (`:4138`).
- `_markVariableAsPointer` (`:4644-4656`, called at `:4066`).
- `StringDeclHelper.ts:448`.
- `ArrayInitHelper.ts:129-132`, including the in-place mutation.
- `TranspileState`: `typeRegistry :538`, `getVariableTypeInfo :991`, `declaredVariableType :1024`, `getTypeInfo :1036`, `hasVariableTypeInfo :1054`, `setVariableTypeInfo :1061`, `deleteVariableTypeInfo :1068`, `getTypeRegistryView :1077`, `registerType :1379`, and its reset at `:1624`.
- `IGeneratorInput.typeRegistry` (`CodeGenerator.ts:103`).

**`#include <string.h>` (R4, from artifact-first).** The only production `requireInclude("string")` calls for declarations are `TypeRegistrationEngine.ts:346` and `:393`. They move onto the `string<N>` declaration's emission path in the same commit. The check is that the count of `#include <string.h>` across `.expected.*` is equal before and after C8.

**`constValues` (C11):**

- `TranspileState.constValues :541`, `registerConstValue :1386`, and the reset at `:1625`.
- Writers `CodeGenWalker.ts:1746-1748` (seed), `:4638`, `TypeRegistrationEngine.ts:103`.
- `IGeneratorInput.constValues` (`CodeGenerator.ts:107`).

---

## 5. Policy: explicit caller modes

The typer reports facts. Each deliberate null becomes a named rule on the **one** module that owns the decision, with a unit test per row.

- 2.1 rules are private statics on their analyzer, because each has one owner.
- 2.2 rules share one 2-Plan module, `PlanTyping`, because five 2.2 sites use them.
- The shared composite rule is `CompositeType`, in utils.

Row tags: **(p)** preserves today's answer; **(Δ)** is a deliberate change, keyed to §6.

| Consumer                                                                                                                      | Rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **E0810**: `MixedTypeCategoryAnalyzer.rule104Category(t)`                                                                     | Unsuffixed integer literal: none (p, ADR-052). Suffixed integer literal: none (**Q3** default; reverts C19's order dependence). Float literal: floating (p). `bitIndex`/`bitRange`: none (p, ADR-024 "a subscript into a scalar is a bit index"). Form `boolean`: none (p for `!`; Δ for comparisons, C00). Enum, whole bitmap, character, string, struct, callback value: none (p). Bitmap field wider than 1 bit: unsigned (Δ, ruling). Register member: its declared category (Δ C11). Foreign floating: floating (p). Foreign indeterminate: none (Δ C03). Foreign integer: none (p, **Q4**). Ternary arms compared with each other: **not added** (**Q5**). |
| **E0868/E0869**: `IntegerConversionAnalyzer.conversionSource(expr)`                                                           | Top-level unparenthesized ternary: null (p, `:237-242`; a `test-no-warnings` fixture asserts it). Lone `bitRange`: null (p, `:18-25`). Cast of a composite: null (p). Lone unsuffixed literal: range-check path (p, `:152-158`). Lone suffixed literal: its type (p). `-x`/`~x`: the operand's type (Δ). A composite: `CompositeType.integerOf(leaves)`.                                                                                                                                                                                                                                                                                                         |
| **Composite integer, both passes**: `CompositeType.integerOf(leaves)`                                                         | Integer-literal leaves skipped: suffixed ones too, per the Q3 default (Δ S18 in 2.2). A floating **or indeterminate** leaf gives null: the veto (p for floating, Δ for indeterminate, which is required once C03's fix makes those calls untyped). `bitRange` gives `u{width}` (p). `boolean`/`bitIndex` leaves skipped (p).                                                                                                                                                                                                                                                                                                                                     |
| **Rule 10.1 (E0806/E0807)**: `OperandTyper.isBoolean(t)`                                                                      | Form `boolean` or type `bool`. `bitIndex` is not Boolean (p).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **ADR-017 enums**: `EnumValueResolver.classify`                                                                               | Cast gives its type (p, `:57-62`). Declared enum or `enumMember` gives enum. Integer literal or all-integer arithmetic gives integer (p).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **2.2 direct type** (initializer MISRA 10.3 cast, `SimpleHandler`, slice source, call arguments): `PlanTyping.directTypeName` | Composite, top-level ternary, or parenthesized composite: null (p, `ETR.ts:102-127`; the missing 10.3 cast is **filed** in P0). `boolean`: `"bool"` (p). Integer literal: `"int"` (p). Otherwise `typeName`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **2.2 cast source**: `PlanTyping.castSourceType`                                                                              | `!`: `bool` (Δ S3, G10). Calls typed (Δ S2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **2.2 overflow**: `PlanTyping.overflowOf(leaves)`                                                                             | Clamp if any counted leaf is clamp. Wrap if at least one integer leaf is counted and none is clamp. Otherwise null (p, `ETR.ts:192-207`). A leaf counts only when it is a whole named variable (p; #1411 and #1703 stay out). No transitional arm remains. A `for`-variable leaf was skipped ("never registered") until C9 deleted it for #1667, together with its twin in `DeclaredTypeInfo.of`. A parameter leaf counted with no behavior (today's wrap) until C10 deleted it for #1681, and gave the parameter's `DeclaredTypeInfo` its declared behavior, so a compound assignment to a parameter clamps too.                                                |
| Preserved in both passes                                                                                                      | ADR-058 properties and C integers stay untyped (p). Fields, elements and call results carry no overflow (p).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## 6. Behavior change forecast and measurement

### 6.1 Pass 2.1 diagnostics

"New" means a program that compiles today is rejected.

| #       | Change                                                                                                                                                                                  | Source                            | Commit |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------ |
| B1      | A use before a later same-block declaration no longer binds to it; a false E0810/E0869 is removed                                                                                       | #1702                             | C4a    |
| B2      | `Scope.x`, `global.Scope.x`, cross-file `Other.x` typed: new                                                                                                                            | C07, C13                          | C4b    |
| B3      | A bare call binds by `resolveFunction`: new; the header-function false positive is removed                                                                                              | #1698, C02                        | C4b    |
| B4      | Split-scope `this.x` typed: new E0869/E0854/E0810                                                                                                                                       | #1699                             | C4b    |
| B5      | Fields of locals typed `this.Cfg`/`Cfg` resolve: new                                                                                                                                    | typer-2.1 map                     | C4b    |
| B6      | Cast leaf typed in the E0869 composite: new                                                                                                                                             | C18a                              | C4c    |
| B7      | `u8 d <- -w` / `~w`: new E0869                                                                                                                                                          | typer-2.1 map                     | C4c    |
| B9      | Const bit-range width: new E0869                                                                                                                                                        | C18b                              | C4c    |
| B10     | Second call in a chain: new                                                                                                                                                             | C10, C27                          | C4b    |
| B11     | Comparison of comparisons: false positive removed                                                                                                                                       | C00                               | C4b    |
| B12     | Shift count as an operand: false positive removed                                                                                                                                       | C01                               | C4b    |
| B13     | C++ overload order: false positive removed; indeterminate is untyped (the false negative is filed)                                                                                      | C03                               | C4b    |
| B14     | C++ namespaced, static, instance and global operands: new                                                                                                                               | C05, C16, C22                     | C4b    |
| B15     | Header float typedef in a cnx declaration, `long double`, C++ aliases, function-pointer fields, C float arrays, anonymous nested fields, struct-returning C calls, C struct arrays: new | C04, C06, C08, C14, C21, C23, C24 | C4b    |
| B16     | Typedef'd float-array global: new E0810 on `i * gv[0]`                                                                                                                                  | C20                               | C4b    |
| B17     | Register members, multi-bit bitmap fields: new                                                                                                                                          | C11, ruling                       | C4b    |
| B19     | Suffixed literal in the E0869 composite skipped (per Q3 default)                                                                                                                        | C19                               | C4c    |
| B20     | The E0869 collector gains the #1152 and shift-count exclusions                                                                                                                          | G8                                | C4c    |
| B21     | First-match bare-name fallback replaced by identity                                                                                                                                     | G12                               | C4a    |
| B22–B25 | Enum, ArrayIndexType, Shift and FloatModulo on canonical names and lexical binding: E0428/E0434/E0850/E0805/E0804 deltas, including #1694's pair                                        | #1694, G6/G8                      | C4c    |
| B26     | Richer global const folding: more E0854 bounds checks may fire                                                                                                                          | §2.4                              | C11    |

**Measurement P4** (spine, plus a graft from incremental):

- For each 2.1 commit, run every fixture and example at the parent and the child. Diff the diagnostic sets `(code, file, line)`.
- Also run **each analyzer alone** over every fixture (a throwaway script, not committed). `runAnalyzers.ts:450-463` stops at the first failing analyzer, so a new error can mask a later one.
- Every delta maps to a B id, or it blocks the commit.
- A fixture whose source is now rejected is changed and listed, as the branch already did for `floats/float-arrays` and `multi-dim-arrays/f{32,64}-multi-dim`.

### 6.2 Pass 2.2 emitted C

| #      | Change                                                                                                                                                                                     | Commit |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| S1     | A clamped cast whose operand has a side effect uses a single-evaluation helper (C26 callbacks, and the pre-existing `(u32)arr[nextIndex()]`). The 82 pure sites in 24 files are unchanged. | C5     |
| S2     | Cast of a call clamps: `(u8)half()`, `(u8)Scope.fn()`, `(u8)cHalf()`                                                                                                                       | C6     |
| S3     | `(u32)!k` loses its clamp                                                                                                                                                                  | C6     |
| S4     | `(float)grid[1][0]`; clamped casts on float elements                                                                                                                                       | C6     |
| S5     | `(u8)cS.v` clamps (C15)                                                                                                                                                                    | C6     |
| S6     | C++ globals typed (C16)                                                                                                                                                                    | C6     |
| S7     | A bare scope member's overflow comes from the member (G12, `ETR:223-224` vs `:732`)                                                                                                        | C6     |
| S8, S9 | #1700 and #1701 widths (reads)                                                                                                                                                             | C6/C7  |
| S10    | Parenthesized composites and ternaries typed; the outer clamp is added                                                                                                                     | C6     |
| S11    | `Scope.fn()`/`this.fn()` in composites: clamp width `_u8` → `_u32` (C17)                                                                                                                   | C6     |
| S12    | `for` counters gain ADR-044 clamps. #1664's audit counted 55 files / 28 fixtures at `f8651d55d`; three of those fixtures now cast `(f32)i` on the branch, so the count is re-measured.     | C9     |
| S13    | Parameter-only arithmetic clamps (#1681)                                                                                                                                                   | C10    |
| S14    | #1666 shadow reads (`.type_bit_length`, widths)                                                                                                                                            | C7     |
| S15    | The flat-key leak is removed. #1664 measured 4 files / 2 fixtures (`for-empty-parts`, `critical-in-loop`). **Cross-check:** the actual count must match, or be explained.                  | C6/C7  |
| S16    | ADR-035 sizes known before a global's initializer renders                                                                                                                                  | C7     |
| S17    | Lexical const environment (#1664 box 7) and global folds; `.h` dimensions from settled declarations                                                                                        | C11    |
| S18    | Composites led by a suffixed literal (Q3 default)                                                                                                                                          | C6     |
| S19    | Indeterminate C++ overloads: native arithmetic (the overload probe emits `u * choose(y)`)                                                                                                  | C6     |
| S20    | `gv[0U]` restored (C20)                                                                                                                                                                    | C6     |
| S21    | Direct-type consumers: 0, by policy                                                                                                                                                        | C6     |
| S22    | Register and bitmap widths in composites                                                                                                                                                   | C6     |

**Measurements:**

- **P1, typing differential.** An instrumented copy of head2 runs the old 2.1 typer, the old 2.2 paths and the overflow lookup beside `OperandTyper`. It covers every operand of every `tests/**/*.cnx` and `examples/**/*.cnx`, in C and in `--cpp`. The output is a TSV `(file, line, text, shape, old21, old22, old22ovf, new)`. An unclassified disagreement blocks C4.
- **P2, registry parity.** An instrumented `getVariableTypeInfo` logs `(site, name, field, old, new)` against `declarationTypeInfo` at all 59 sites during a full run. The convention classes must be 0 before C8. P2 also compares ADR-035 counts: `state.lastArrayInitCount` against `ArrayInitializerUtils.getInferredSize` (R6).
- **P3, commit rehearsal.** For each commit:
  - Run `npm run test:update` in C and C++.
  - Count changed files with `git diff --name-only -- tests | wc -l`.
  - Count changed fixtures with the same list, stems deduplicated.
  - Run a hunk classifier over `git diff -U0 -- 'tests/**/*.expected.*'`. It must report **0 unclassified hunks**.
  - Re-run `npm run test:q`, because a mismatch masks execution.
- **Recording.** Each count is posted on #1668, and also on #1667, #1681 or #1664 for their commits, with the SHA and the command.

---

## 7. Commit sequence

"Byte-identical" means `npm test` leaves `git status tests/` empty. Every commit builds and passes `npm run build && npm run unit && npm run test:q`.

Generated documents are regenerated **in the commit that changes their input**: `parse-tree`, `scope-joins`, `diagnostics:manifest`, `coverage:matrix`, and `docs:throw-citations` after any `3-Render` edit (#1399).

`npm run test:gate` runs alone, from a committed tree, before the push.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Snapshot delta                                              | Reviewer checks                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0  | Not a commit. Comment the plan on #1668, #1664, #1667, #1681, #1666 and #1694–#1702. **File** only what this PR does not fix: C09 (unless Q4 says otherwise), "E0810 cannot classify a call to a C++ overload set whose return categories disagree", and "a composite or bit-range initializer gets no MISRA 10.3 cast" (the preserved policy). Run P1–P3 at HEAD and record the numbers.                                                                                                                                                          | —                                                           | The issues exist; the baselines are recorded                                   |
| C1  | `test(#1668)`: `testAnalysisContextFor(source)` builds a declared and resolved Program. A population assertion fails a context that has a function but no lexical frame. The 32 users that type operands move to it (K11: `testAnalysisContext.ts:30` defaults to `Program.build([], {})`).                                                                                                                                                                                                                                                        | Byte-identical                                              | No vacuous context                                                             |
| C2  | `feat(#1664)`: contracts; `LexicalScopeCollector`; `VariableCollector.declaredFacts`; `DeclaredPointer.calleeOf`; `ArrayDimensionParser.parseText`; `LexicalFrames.settle`; the four `IProgram` methods; `ILexicalFrame` in ARTIFACTS; unit tests                                                                                                                                                                                                                                                                                                  | Byte-identical                                              | Globals and locals share one derivation; no node in the artifact               |
| C3  | `feat(#1668)`: `OperandTyper`, `CompositeType`, `DeclaredPointer.of`, `ForeignTypeFacts.operandType` (old methods kept until C6/C8), `CResolver` typedef dimensions. Moves: `TSubscriptKind` → `transpiler/types`, `TChainRoot` → `transpiler/types`, `SubscriptClassifier` and `ChainRoot` → `utils`. Table-driven unit tests.                                                                                                                                                                                                                    | Byte-identical (asserted)                                   | Every §3 row has a test; depcruise is clean                                    |
| C4a | 2.1 binding onto Program (24 analyzers); `DeclarationScopeCollector`, `ScopeFrameResolver`, `IScopeFrame`, `IDeclaredVar` deleted                                                                                                                                                                                                                                                                                                                                                                                                                  | P4 = B1, B21                                                | The delta matches P1                                                           |
| C4b | 2.1 operand typing (13 constructions, E0810 policy); `OperandTypeResolver` deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | P4 = B2–B5, B10–B17                                         | Each new diagnostic has a fixture and a control                                |
| C4c | 2.1 private typers, one commit per analyzer group; #1694 fixtures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | P4 = B6, B7, B9, B19, B20, B22–B25                          | Same as C4b                                                                    |
| C5  | `fix(#1668)`: a clamped cast with a side-effecting operand evaluates it once. Helper `cnx_cast_sat_<src>_<dst>` emitted through `addGeneratedHelpers` (CLAUDE.md _Adding Generator Effects_), with the annotation form of the Compliance Annotations standard.                                                                                                                                                                                                                                                                                     | S1 only                                                     | C26 execution fixture                                                          |
| C6  | 2.2 expression typing → the typer through `PlanTyping` and `CompositeType`, with the two transitional arms. **ETR deleted** (predicates → `TypeCheckUtils`/`DeclaredTypeFacts`, both mocks removed). **`EnumTypeResolver` deleted**, and its "deliberately NOT shared" rationale superseded (§8.6). `CastRequirement` on category. May split into 6a casts/unary, 6b composites, 6c direct/enum/target.                                                                                                                                            | S2–S8, S10, S11, S15 (clamp half), S18–S22                  | Hunk classes equal the forecast; the leak count equals #1664's measurement (1) |
| C7  | The 59 reads → `declarationTypeInfo(name, at)`; `targetTyping`; `resolveBareIdentifier` through `bindValue`; `localArrays` deleted                                                                                                                                                                                                                                                                                                                                                                                                                 | S9, S14, S15 (read half), S16; #1700 names byte-identical   | All P2 mismatch classes accounted for                                          |
| C8  | Registry writers and dead API deleted (§4.4); `string.h` requirement moved; `DeclaredVariableFacts`, `StructFieldFacts` and the old `ForeignTypeFacts` methods deleted; the #1664 box 3 guard added                                                                                                                                                                                                                                                                                                                                                | **Byte-identical to C7**; `#include <string.h>` count equal | Box 4 greps recorded: 8→0, 21→0                                                |
| C9  | `fix(#1667)`: `for`-variable arm deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | S12                                                         | #1667 grep 0; `critical-in-loop.expected.c:67` equals `:105`                   |
| C10 | `fix(#1681)`: parameter arm deleted                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | S13                                                         | #1681 list                                                                     |
| C11 | `fix(#1664 box 7)`: `constValuesAt` everywhere; global consts folded by `parseText`; `.h` dimensions from settled declarations; `constValues` deleted                                                                                                                                                                                                                                                                                                                                                                                              | S17, B26                                                    | No new `.c`/`.h` disagreement (R5)                                             |
| C12 | `refactor`: `PostfixExpressionGenerator`, `MemberChainAnalyzer` and `AssignmentClassifier` read `IChainTyping`. **As landed:** C12a (the bit analyzer reads the chain's last step), C12b (the classifier reads it; an element's bit range gets its kind) and C12c (the postfix plan carries each op's step; render tracks no type). The `PLAN_DECISIONS.SubscriptClassifier` row is **kept**, empty: an empty row asserts render imports it nowhere, which removing it would stop asserting. The assignment path's struct-field lookups are #1737. | **Byte-identical to C11**                                   | Any delta is a C12 defect                                                      |
| C13 | Docs (§8.6)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                           | `adr:independence:check`; all generated documents current                      |

---

## 8. Verification plan

### 8.1 Fixtures

Every fixture fails at its parent, and that is recorded. Each has a negative control beside it. ADR-024 fixtures carry `// test-adr: 024`.

| Directory                                           | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Control                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `tests/bugs/issue-1668-int-float-clamp/` (extended) | **Box 3 fixture**: `// test-cpp-only // test-execution` with `ovl.hpp` (`uint32_t choose(uint32_t)` first, `float choose(float)` second); `f32 r <- u * choose(y)` must equal 7.5. **[ran]**: gives 6.0 at HEAD. Also: one `test-error` fixture per B2–B17 shape, with C and `--cpp` variants where the shape is C++. C00 and C01 compile. The C20 `vec3 gv` fixture is `// test-no-warnings`, so gcc compiles every unit. C26: an execution fixture counts callback calls and requires 1. C29: E0869 on a callback result and on `get().v`. Box 1: cast spellings of each #1092 shape (`(f32)p.v`, `(f32)arr[0]`, `(f32)half()`, `(f32)Gauge.x`) each evaluate to 7.5. | Beside each rejection, its `(f32)…` spelling compiles |
| `tests/bugs/issue-1666-shadow-type-registry/`       | Across functions and inner block (execution, `x.type_bit_length = 32`); renamed local `first__x`; parameter shadow                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Sibling `if`/`else` blocks (`8`/`32`)                 |
| `tests/bugs/issue-1667-for-counter-types/`          | The three #1667 probes, as execution fixtures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                     |
| `tests/bugs/issue-1681-param-overflow/`             | `+`, `-`, `*` and a compound on a parameter-typed local, C and `--cpp`, returning 255                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | One-local controls                                    |
| `tests/bugs/issue-1664-const-shadow/`               | Function-local and inner-block `const N` shadows give `buf[8]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Renamed `M`                                           |
| `tests/bugs/issue-1694-e0850-scoped-name/`          | Programs 1 and 2 from #1694                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `data[i]` in the `u32` loop                           |
| `tests/bugs/issue-1698-*` to `issue-1702-*`         | Each card's own DoD fixtures. #1698's 2.2 guard: `u8 a <- 1; u32 r <- a + get();` inside the scope, with `get()` returning 300, must be 301 (execution). With a bare-key mutation it becomes `cnx_clamp_add_u8`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Each card's named controls                            |
| `tests/bugs/issue-895-pointer-return/`              | `u8 p <- getBuf()` with `uint8_t* getBuf(void);` emits `uint8_t* p`, as a compiled snapshot. This is the #895 Bug B arm alone, which no fixture pins today (§0.2.3).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | A declared type that does not match stays `T`         |

**Scope-context matrix for ADR-024** (`adr-024-type-casting.md:441-458`). The rows `scope member` and `scope method` × `imported direct` and `imported transitive` are `off` "as a stated obligation". Per CLAUDE.md's _New PRs use the matrix_, C13 declares them `error` once P4 shows them occupied. The occupying fixtures are:

- `Other.x` from an included file.
- The split-scope `this.x` across an include (#1699).

`npm run coverage:matrix` and `coverage:matrix:check` must then pass. M7 names the transitive cell it reddens.

### 8.2 Unit tests

None exist today for `OperandTypeResolver` or `ScopeFrameResolver` (G13).

| Test file                                                                                                 | What it covers                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PARSE/3-Declare/cnx/collectors/__tests__/LexicalScopeCollector.test.ts`                                  | Frames, spans, kinds; constructor declarations; `forVarDecl` modifiers; `initializerCallee`. It iterates every `tests/**/*.test.cnx` and must never throw.                                                                                                                                |
| `PARSE/4-Resolve/__tests__/LexicalFrames.test.ts`                                                         | Settled types; parameters filled from `IFunctionSymbol`; const-folding order and shadowing; dimensions; `bindValue` for every §3.1 row (position, siblings, split scope, G12); `constValuesAt`                                                                                            |
| `src/cnx/utils/__tests__/OperandTyper.test.ts`                                                            | `it.each` over a shape table built through the real declare and resolve path, one row per §3 shape. It asserts `typeName`, `dimensions`, `category`, `form`, `overflow`, `subscript` and `hasSideEffect`. `it.each` avoids Sonar S5976. A shape test asserts the class declares no field. |
| `CompositeType.test.ts`, `DeclaredPointer.test.ts` (all three arms), `ForeignTypeFacts.test.ts` additions | Arrays, typedef arrays, overloads, `::` members, `long double`                                                                                                                                                                                                                            |
| One test per §5 row                                                                                       | The policy rules. `compoundClampOp`'s `it.each` becomes a `CompositeType.anyFloating` case.                                                                                                                                                                                               |

The two `AtomicGenerator` tests that pass a null `clampOp` (C30) are retitled to what they assert. The float decision stays pinned by the case above.

### 8.3 Mutation table

**Protocol for every row:**

1. Commit first.
2. Assert the edit applied, by grepping for the marker.
3. Delete stale `.test.c/.h/.cpp/.hpp` between runs.
4. Assert the restore.

A correct row reddens exactly the fixtures it names.

| #   | Mutation, spelled the way production is                                                                                 | Must redden                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| M1  | Frames flattened to one key per name                                                                                    | Both #1666 shadow fixtures                                                 |
| M2  | One key per function                                                                                                    | #1666 inner-block fixture and sibling control                              |
| M3  | Position check dropped in `bindValue`                                                                                   | #1702 fixtures (its control stays green)                                   |
| M4  | `LexicalScopeCollector` skips `forVarDecl`, or the C9 arm restored                                                      | #1667 probes 1–3                                                           |
| M5  | Parameter overflow dropped from the lookup                                                                              | #1681 fixture                                                              |
| M6  | Bare callee keyed by the bare name                                                                                      | #1698 E0869/E0810 fixture **and** #1698 2.2 execution guard (one site now) |
| M7  | `this.` restricted to own-file symbols                                                                                  | #1699 fixtures (one per fixture); ADR-024 transitive cell                  |
| M8  | `Scope.x` → null                                                                                                        | C07/C13 fixtures                                                           |
| M9  | Member searched before locals in `bindValue`                                                                            | #1700 two shadow fixtures; both controls green                             |
| M10 | `global.` searched lexically: read side, then compound side                                                             | #1701 read and `.type_bit_length` checks, then the compound fixtures       |
| M11 | `VariableTypeCollector`'s flat lookup restored; then function frame removed                                             | Both #1694 fixtures; then at least one                                     |
| M12 | `valueLeaves` descends an applied comparison                                                                            | C00                                                                        |
| M13 | Shift count kept as a leaf                                                                                              | C01                                                                        |
| M14 | **Veto line deleted from `CompositeType.integerOf`** (#1668 box 3: "routing the float case back to the integer helper") | The box 3 overload execution fixture                                       |
| M15 | `clampForm` always `"inline"`                                                                                           | C26 call-count fixture                                                     |
| M16 | First overload wins                                                                                                     | C03 fixture in both orders                                                 |
| M17 | C-only foreign lookup                                                                                                   | C16 `--cpp`                                                                |
| M18 | Typedef dimensions dropped                                                                                              | C20 `test-no-warnings`                                                     |
| M19 | Second call → null                                                                                                      | C10/C27                                                                    |
| M20 | Cast leaf untyped; digit-only width                                                                                     | C18a; C18b                                                                 |
| M21 | Element keeps the trailing dimension                                                                                    | `grid[1][0]`                                                               |
| M22 | Parenthesized composite → null                                                                                          | `(g+1)+1` execution fixture                                                |
| M23 | Overflow keyed by bare text                                                                                             | e/bare fixture                                                             |
| M24 | `!` looks through                                                                                                       | S3 fixture                                                                 |
| M25 | `constValuesAt` without the local overlay                                                                               | #1664 box 7 fixtures                                                       |
| M26 | Raw C field string                                                                                                      | `(u8)cS.v`                                                                 |
| M27 | #895 Bug B arm dropped from `DeclaredPointer.of`                                                                        | `issue-895-pointer-return`                                                 |
| M28 | A `ParserRuleContext` field on `ILexicalFrame`                                                                          | artifact-lifetime `:252`                                                   |
| M29 | Each #1664 box 3 guard arm (§8.5)                                                                                       | That arm, with its population control                                      |

### 8.4 Mocks (G13)

`ExpressionTypeResolver.ts` is deleted, not hollowed, so `mock-paths.test.ts` goes red on both specifiers until they are handled:

- `ArrayHandlers.test.ts:28` is already inert, and its block is removed.
- `UnaryExprGenerator.test.ts:23`: the test is rewritten against the real `TypeCheckUtils.isUnsigned`.

`EnumTypeResolver.test.ts` is deleted with its module.

### 8.5 Gates

**depcruise.** No new rule is added, and the `layer-rules.test.ts` roster is unchanged.

- The typer is covered through reachability by `analyzers-cannot-reach-codegen-state`, `analyze-cannot-import-plan`, `analyze-cannot-import-render`, `nothing-after-resolve-derives-cross-file-facts` and `plan-cannot-import-render`.
- `shared-contracts-cannot-import-a-pass` must pass on the new contracts. It holds because `TSubscriptKind` and `TChainRoot` move and `IForeignSymbolLookup` is structural.
- Mutation checks: `import type TranspileState` in `OperandTyper.ts` turns it red, and so does `import BitUtils`.

**artifact-lifetime.** `ILexicalFrame` is added to `ARTIFACTS`. No roster row changes.

**render-decides-nothing.** The `SubscriptClassifier` row is removed in C12, a visible roster change. `CastRequirement`'s pinned consumer is `NarrowingCastHelper.ts` alone: C5 moved the cast's saturation decision into the plan (`IPlannedCast.clampForm`), so `CastExprGenerator.ts` reads the plan and consults nothing, and its pin was removed. After the review follow-ups the typer is `SubscriptClassifier`'s only caller.

**#1664 box 3 guard.** It is new, beside `render-decides-nothing.test.ts`, and its population controls are listed in M29.

- Arm A, a ts-morph field-type walk: no `Map<string, TTypeInfo>` or `Map<string, number>` field on `TranspileState`, `CodeGenWalker` or anything under `3-Render`. Its population control is that the walk finds the `LexicalFrames`/`Program` maps when pointed at `4-Resolve`.
- Arm B: no import of a declaration-authoring module (`LexicalScopeCollector`, `LexicalFrames`, `VariableCollector`) from those roots. Its population control is a planted specifier string.
- Arm C: `setVariableTypeInfo|deleteVariableTypeInfo|getTypeRegistryView|constValues\.set|TypeRegistration(Engine|Utils)` occurs nowhere in `src/`. Its population control is the regex matched against planted text.

**parse-tree:check.** Regenerated in C2, C3, C4a, C4b, C6 and C8.

- Removed rows: `DeclarationScopeCollector`, `ScopeFrameResolver`, `OperandTypeResolver`, `ExpressionTypeResolver`, `TypeRegistrationEngine`.
- Added rows: `LexicalScopeCollector`, `OperandTyper`. `ChainRoot` moves, which is count-neutral.
- Expected total 102 → 99. The measured figure is recorded. The PR states that typing an expression is tree-shaped, which is why the typer takes nodes.

**Other gates.**

- knip `classMembers`: dead ETR and `TranspileState` members are deleted, not kept.
- `one-struct-decision`: the typer calls `DeclaredTypeFacts.isStruct`.
- `scope-joins`: the list shrinks.
- `unknown-carriers`: no `unknown` parameter, including `IForeignSymbolLookup`.
- Also run `diagnostics:manifest:check`, `error-codes:check`, `docs:throw-citations:check`, `adr:independence:check`, `gate:roster:check`, `typecheck:scripts`, cspell, prettier and oxlint.
- SonarCloud: 0 new issues (`statuses=OPEN,CONFIRMED,REOPENED`, on the head SHA's analysis), coverage of at least 80% on new code, cognitive complexity of at most 15 per method. Moved files re-attribute their issues to this PR.

### 8.6 Documents

**ADR-024** (under Q6; rewrite-test clean, no module names):

- A comparison's result is a Boolean operand, not a category (C00).
- A shift count is never an operand of the enclosing operator (C01).
- E0869 reads call results, callback results and `-x`/`~x` (C29).
- Register members and multi-bit bitmap fields are classified.
- A C++ overload set whose results disagree is not classified.
- The Q3 ruling.
- The matrix cells.
- A refresh of the stale `:463-476` paragraph.

**Supersessions, stated explicitly:**

- `EnumTypeResolver.ts:14-27`. Its premise, that the passes "ask from different symbol views", is false. Both read `program.codeGenSymbolsFor(file)` (`Transpiler.ts:998`, `:1191`) and one lexical artifact through one typer, so "nothing detects that" no longer applies. This is recorded in `docs/architecture/symbol-resolution.md` under a new "Operand typing" section, because the module is deleted.
- `ScopeFrameResolver.ts:153-156` (deleted with the file; this is #1699 box 4).
- `TranspileState.ts:1283` (deleted with the method).
- `PrimitiveKindUtils.ts:54` (C32): the text moves to `CompositeType`, and says the veto covers indeterminate C++ overloads and not float macros (#1688).

**Architecture documents:**

- `docs/architecture/README.md` §2: the Tier 1 table gains lexical declarations.
- `module-destinations.md` (deleted by #1443):
  - Add utils rows for `OperandTyper`, `CompositeType`, `DeclaredPointer`, `SubscriptClassifier` and `ChainRoot`.
  - Add the 1.3 `LexicalScopeCollector` row and the 1.4 `LexicalFrames` row.
  - Add a "deleted rather than re-homed" entry covering: ETR, `EnumTypeResolver`, `TypeRegistrationEngine`, `TypeRegistrationUtils`, `OperandTypeResolver`, `ScopeFrameResolver`, `DeclarationScopeCollector`, `DeclaredVariableFacts` and `StructFieldFacts`.

**CLAUDE.md.** These entries name deleted modules and are listed for the owner to approve: "Analyzer type tracking", "Adding Generator Effects" (whose examples name `TypeRegistrationEngine`), the registry notes, and "Per-file vs run-wide symbol views".

---

## 9. Definition-of-done mapping

A box is ticked only with its SHA and command output, in the push that makes it true. No box is reworded.

| Card and box         | Met by                                                                                                                                                                                                        | Evidence                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#1668** 1          | C4b (E0810 probe) and C6 (cast-spelling execution fixtures)                                                                                                                                                   | Fixtures, run output. The float-macro part waits on #1688: the board's `Blocked by` = #1688, queried at `2026-09-26T18:12:53Z`. **#1668 stays open, and the PR says `Refs #1668`.** |
| #1668 2              | `6f7c46453`                                                                                                                                                                                                   | SHA                                                                                                                                                                                 |
| #1668 3              | M14 on the overload execution fixture                                                                                                                                                                         | Mutation log                                                                                                                                                                        |
| #1668 4              | P3 lists for C4–C11, posted on #1668                                                                                                                                                                          | Lists and commands                                                                                                                                                                  |
| **#1664** 1          | C2 + C7, #1666 fixtures, M1/M2                                                                                                                                                                                | Fixtures fail at `f8651d55d`; mutation logs                                                                                                                                         |
| #1664 2              | C2 (complete in Stage 3, including `forVarDecl`) + C8 (zero writers)                                                                                                                                          | **Q1**: the box names "the 2.2 registration pass"                                                                                                                                   |
| #1664 3              | C2/C3 decide ADR-035, ADR-045 and #895 in 1.3/1.4 and utils; C8 guard with named mutations                                                                                                                    | **Q1**: the box says "decided in 2.2", and its arms name structures this design deletes                                                                                             |
| #1664 4              | C8 greps 8→0 and 21→0, recorded                                                                                                                                                                               | **Q1**: "fields of 2.2's artifact"                                                                                                                                                  |
| #1664 5              | Not ticked; released by the owner on 2026-09-26                                                                                                                                                               | **Q1**: the card text still says it stands                                                                                                                                          |
| #1664 6              | Comment on #1452 box 2 with these numbers; #1671 is the remainder                                                                                                                                             | Link                                                                                                                                                                                |
| #1664 7              | C11 fixtures, M25                                                                                                                                                                                             | Fixtures, log                                                                                                                                                                       |
| **#1667** 1          | C2 + C9, probe fixtures, M4                                                                                                                                                                                   | **Q1**: "registered" means recorded in the 1.3/1.4 artifact                                                                                                                         |
| #1667 2              | C9 regeneration, hunks classified (clamp or width only), list on #1667                                                                                                                                        | P3 output                                                                                                                                                                           |
| #1667 3              | `critical-in-loop.expected.c:67` equals `:105`                                                                                                                                                                | The two lines                                                                                                                                                                       |
| #1667 4              | Grep → 0 after C9, recorded. E0810 (C4b) precedes C9 in the same PR.                                                                                                                                          | **Q1**: "#1668 has landed"                                                                                                                                                          |
| **#1681** 1–4        | C10 fixture (C and `--cpp`, `+ - *`, compound), M5, C10 list                                                                                                                                                  | Fixture, log, list                                                                                                                                                                  |
| **#1666** 1–5        | §8.1 directory, M1/M2, renamed and parameter fixtures                                                                                                                                                         | Closes with the PR                                                                                                                                                                  |
| **#1538** 4          | From #1664 box 7's fixtures and SHA                                                                                                                                                                           | Same                                                                                                                                                                                |
| #1538 1–3, 5         | Not this PR (1.4's `deriveConstValues` sibling-scope key). C11 measures Repro 1 and 2 and records the result.                                                                                                 | Measurement only                                                                                                                                                                    |
| **#1671**            | No box met, and no conflict. No orchestrator field is added; greps stay 4/4.                                                                                                                                  | —                                                                                                                                                                                   |
| **#1694** 1, 2, 4, 5 | C4c fixtures, M11, P3 list                                                                                                                                                                                    | —                                                                                                                                                                                   |
| #1694 3              | `VariableTypeCollector` deleted; names resolve through the shared artifact                                                                                                                                    | **Q1**: the box names `DeclarationScopeCollector`/`ScopeFrameResolver`, which this design deletes                                                                                   |
| **#1698** 1–5        | C4b fixtures (C, `--cpp`); negative-control pair; `resolveFunction` is the one resolution (box 3); M6 reddens the 2.1 fixture and the 2.2 guard (box 4); P3 list                                              | —                                                                                                                                                                                   |
| **#1699** 1–5        | C4b fixtures (E0869, E0854, E0810), negative control, M7, comment deleted with the file, P3 list                                                                                                              | —                                                                                                                                                                                   |
| **#1700** 1–5        | C6/C7 execution fixtures; controls; `bindValue` shared by typing and `resolveBareIdentifier` (box 3); M9; gate                                                                                                | —                                                                                                                                                                                   |
| **#1701** 1–5        | C6/C7 fixtures, controls, M10, P3 list                                                                                                                                                                        | —                                                                                                                                                                                   |
| **#1702** 1–5        | C4a fixtures, control (#1643 recorded as at HEAD), M3, P3 list                                                                                                                                                | —                                                                                                                                                                                   |
| Not closed           | #1411, #1703 (overflow of fields and calls), #1688, #1685 (the predicates remaining outside operand typing, listed on the card in C13), #1690–#1693, #1695, #1213, #1643, #1647 (measured in C9 and recorded) | —                                                                                                                                                                                   |

---

## 10. Risks, unknowns, owner questions

### 10.1 Risks

| #   | Risk                                                                                                                     | Mitigation                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| R1  | Size: about 60 modules and six regenerations                                                                             | Every delta is classified per commit (P3). C8 and C12 are byte-identical checkpoints. |
| R2  | New 2.1 rejections of programs that compile today                                                                        | P4, including per-analyzer runs; listed in the PR and the release note                |
| R3  | Registry conventions (string `[N+1]`, parameter `"string"`, `isPointer`)                                                 | P2 must show 0 convention mismatches before C8                                        |
| R4  | `#include <string.h>` was a side effect of registration                                                                  | Moved in C8; count compared                                                           |
| R5  | A `.c`/`.h` split if 2.2 re-folds dimensions                                                                             | Dimensions are read only from settled declarations                                    |
| R6  | ADR-035 count divergence between `ArrayInitHelper`'s render count and `getInferredSize` on nested initializers           | P2 compares them before C8. A difference is unified on 1.3's rule and listed.         |
| R7  | Tests passing vacuously on an empty Program                                                                              | C1's helper and population assertion                                                  |
| R8  | Collector coverage for C++ instance-method returns, `using` aliases, function-pointer fields, anonymous nested C structs | P1 before C4b. A shape not recorded is filed, and the PR does not widen.              |
| R9  | `IAssignmentContext` changes                                                                                             | `createMockContext` is updated in **every** handler test file                         |
| R10 | An indeterminate overload silences E0810                                                                                 | Filed in P0; the 2.2 veto guarantees no truncation (box 3 fixture)                    |
| R11 | Performance                                                                                                              | One walk replaces 24 per file; `time npm run test:q` before and after                 |

### 10.2 Unknowns, each settled by a named prototype

- S12, S13 and the B-counts: P1–P4.
- Whether any corpus program relies on G12's first-match fallback: P1.
- Whether `LexicalScopeCollector` meets a tree shape it cannot record: C2's all-fixtures test.

### Open questions for the owner

1. **DoD wording that names what this design replaces.** 2.1 runs before 2.2 and cannot import `2-Plan`, so declaration facts are authored in 1.3/1.4 and no registry remains. How should each of these boxes be recorded: annotated as met by the 1.3/1.4 artifact, or reworded by you?
   - #1664 box 2 ("2.2 registration pass").
   - #1664 box 3 ("decided in 2.2", and guard arms that target the deleted registry).
   - #1664 box 4 ("fields of 2.2's artifact").
   - #1667 box 1 ("registered").
   - #1667 box 4 ("#1668 has landed").
   - #1694 box 3 (names `DeclarationScopeCollector`/`ScopeFrameResolver`).
   - Separately, #1664 box 5 was released on 2026-09-26, but the card body still says it "stays as written".
2. **Placement.** `module-destinations.md:169-171` (deleted by #1443) admitted a utils module only if it "decides nothing". Do you accept a whole operand typer, `SubscriptClassifier` and `CompositeType` in `src/cnx/utils/`? `1-Analyze` and `2-Plan` are each ruled out by a depcruise rule.
3. **Suffixed integer literals.** Is `5i32` or `300u16` a "bare integer literal" under ADR-052 and ADR-024, so that it is exempt from E0810 and skipped by the composite width in both passes? That is this design's default, and it ends C19's order dependence. Or is it typed by its suffix everywhere, which makes `a + 5i32` E0810?
4. **C and C++ header integer operands (C09).** Should E0810 classify `uint32_t`/`int32_t` header operands? Today `u32 a + cSigned` yields 4294967295. ADR-024 names only floating header operands, and #978 keeps C integers untyped. The default is to leave them untyped and file C09.
5. **Rule 10.4 between a ternary's two value arms** (a #1092 item). Should `c ? i : k` with `u32 i` and `f32 k` be E0810? The rulings do not cover it, so this design does not add it.
6. **ADR-024 text in C13.** May ADR-024 record the items listed in §8.6 as consequences of the 2026-09-26 rulings, with no new decision? This covers C00, C01, C29, register and bitmap fields, the C++ overload case, and the matrix cells.
