# Symbol views and their scopes

> **Renamed (#1452).** `CodeGenState` below is the class now called `TranspileState`,
> at `src/cnx/TRANSPILE/TranspileState.ts` — merged with `TranspilerState`, made an
> instance owned by `CodeGenerator`, and moved out of the deleted
> `src/transpiler/state/`. The measurements and the classification are unchanged;
> only the name and the path are. Left as written rather than rewritten, because
> this document records what was measured when it was measured.

How cnx's symbol and type facts are stored today, which of those stores are views of one
fact set, whether they agree, and what to do about it.

Its companion, [`symbol-store-prior-art.md`](symbol-store-prior-art.md), records how other
compilers solve the same problem — read that one before proposing a database, a query engine or
a state-management library for the symbol layer.

This is the write-up of the [#1431](https://github.com/smeltworks/cnx/issues/1431) spike. The
probe that produced the numbers was throwaway and is not in the tree; it is recoverable from
that branch's history, and the method below is described in enough detail to rebuild it. Where
a figure came from a command rather than from the probe, the command is given.

## The question

[#1313](https://github.com/smeltworks/cnx/issues/1313) describes Cause 1 as four
representations of the same symbols that "agree only by coincidence". #1431 restated that as a
falsifiable claim: the stores are **denormalized materializations of one fact set with no
integrity constraint**, and the apparent "scopes" are one query with different predicates.

If that is right, a normalized schema reproduces every view as a query, and each place the
reproduction disagrees is a latent defect with an address. If it is wrong, the reproduction
fails and says where.

## The schema

Five tables were enough to express every view that could be expressed at all.

| table          | key                                        | source                                 |
| -------------- | ------------------------------------------ | -------------------------------------- |
| `symbol`       | `fullyQualifiedCName` (injective, ADR-063) | `SymbolTable`                          |
| `scope`        | path, `parentId` a self-referencing FK     | `SymbolRegistry`                       |
| `file`         | resolved path                              | discovery                              |
| `include_edge` | (`dependent`, `dependency`)                | `DependencyGraph`                      |
| `member`       | (`ownerCName`, `name`)                     | enum, bitmap, struct, register members |

Two shapes are load-bearing rather than stylistic.

**A scope is a row, not an object.** `parentId` is a foreign key.
[#1298](https://github.com/smeltworks/cnx/issues/1298) is a cycle guard that cannot fire,
because successive `.parent` reads can return non-identical objects for the same scope. Under a
key, a cycle is a constraint violation on insert and the guard has nothing left to guard. This
is what `docs/architecture/README.md` means by "an entry in a table that symbols point at, not
a live object graph they hang off".

**The include closure is a query, not a stored set.** It is the join
[#1398](https://github.com/smeltworks/cnx/issues/1398) says nobody wrote.

### The six scopes are one query with different predicates

| scope                    | predicate                         | verdict                                    |
| ------------------------ | --------------------------------- | ------------------------------------------ |
| this file's parse tree   | `WHERE source_file = ?`           | real                                       |
| per-file include-visible | `WHERE source_file IN closure(?)` | real — this is the missing join            |
| run-wide                 | no predicate                      | real                                       |
| run-so-far               | `WHERE topological_index < ?`     | **not a scope** — a per-file-loop artifact |
| per-generate-call        | _not expressible_                 | **not a scope** — an orthogonal phase axis |
| cross-run persisted      | the warm cache                    | a materialized table, legitimately         |

`run-so-far` being an artifact is not an inference. `Transpiler.ts` says so at the site: under a
cyclic include graph `getSortedFiles()` returns insertion order with a warning, so "a file can
be declared before the file defining the scope types it uses… the pass this issue removed was
not only recomputing, it was **repairing**."

`per-generate-call` cannot be written as a predicate over these tables at all, because it is
"which pass has run", not "which symbols are in view".
[#1430](https://github.com/smeltworks/cnx/issues/1430) is what confusing the two produces.

## The partition

Every member of `ICodeGenSymbols`, `CodeGenState` and `SymbolTable` was classified, and **every
exclusion was then adversarially challenged** by an independent pass instructed to refute it.

| bucket          | count  |
| --------------- | ------ |
| symbol view     | **74** |
| codegen scratch | 24     |
| dead            | 4      |
| **audited**     | 102    |

**13 of 41 exclusions were overturned; none was overturned the other way.** That asymmetry is
the finding, not an accident of process: a name-grep classification is biased toward exclusion,
and exclusion is the direction that flatters the result. The three families it systematically
missed were indirect reads (`{ ...base }` spread, reads through a renamed interface field),
sink-versus-source tracing (the writer is a pure function several hops from the assignment), and
confusing a narrow _lifetime_ with a non-derivable _content_.

The practical consequence is that `CodeGenState` is smaller than it looks as a problem: 24 of
its 59 static data fields are emission bookkeeping, not views of the program.

## The measurement

Each hooked accessor records **three** answers for the same key at the same moment:

|                | meaning                                                     |
| -------------- | ----------------------------------------------------------- |
| `live`         | what the container returned                                 |
| `asSpecified`  | the same view re-expressed — same predicate, same key space |
| `asPrincipled` | the answer the normalized model says is correct             |

`asSpecified` is the **identity control**, and it is the reason the numbers below can be
believed. Two answers cannot distinguish a real divergence from a key-space mismatch, and
`ICodeGenSymbols` holds two key spaces at once: `knownScopes`, `scopeMembers` and
`scopeMemberVisibility` are keyed by a scope's `cnxScopedName` -- its dotted SOURCE path --
while `knownStructs` and `functionReturnTypes` use the transpiled C name.

> **Updated by #1295.** Those three were keyed by the bare leaf `scope.name` when this was
> written, which collided whenever two scopes shared a leaf. The argument above is unchanged
> by the correction: there are still two key spaces, so the control is still doing the work
> described here. Only the spelling of the first one moved.

**The identity control caught six defects in the measurement itself. Every one would have been
published as a finding.** Two examples: a kind filter of `{struct, typedef}` misses C++ `class`
(262 false divergences), and 530 more were header-declared types whose principled answer is
unanswerable for the reason in the next section. The tell for the second was distributional —
10 of 10 true cases "diverged", and a real divergence is a minority.

Observations are recorded in **files mode**, never source mode. Under source mode there is no
include graph, so `visibleFrom` collapses into `runWide` and every include-sensitive view agrees
trivially. `scripts/format-fidelity.ts` and the matrix tooling both drive the transpiler one
fixture at a time, which is why that trap is easy to fall into.

### Controls

Three layers, all firing, over 1143 fixtures and 7490 observations:

- **Per view** — corrupting each view's derivation reddens **exactly that view and no other**,
  6 of 6.
- **Global** — breaking the include closure moves identity mismatches 0 → 35 and divergence
  counts 0 → 44 and 0 → 78.
- **Directional** — `getStructFieldType`'s divergences run 32 → **0** when the closure is
  broken. That is the strongest attribution in the run: the divergence exists _because_ of
  cross-file visibility, so removing cross-file visibility removes it.

## Results

### There is one real divergence, and the reframe predicted it

`CodeGenState.getStructFieldType` answers **"no such field"** for a struct the file can see —
32 observations, all cross-file, all one direction.

`getStructFieldType` reads the per-file `structFields` and stops; it has no run-wide branch at
all. Its sibling `getStructFieldInfo` asks the run-wide table **first**. And `structFields` is
one of the collections that never crosses an include boundary, while `knownStructs` does — so an
included struct has a **known name and unknown fields**.

`TSymbolInfoAdapter`'s own comment, twenty lines above the merge list, records
[#1333](https://github.com/smeltworks/cnx/issues/1333) fixing this asymmetry for type _names_
and then says: _"A type's NAME is not enough; its detail travels with it."_ It merges enum
members and bitmap fields. It does not merge struct fields. The same bug, one kind over.

Whether each case is a live miscompile depends on whether callers reach for the sibling
accessor, which is run-wide-first. That is "agree only by coincidence" stated exactly: one
accessor is wrong, and the system works because callers of the other one happen to cover it.

### The bigger finding is that the question cannot be derived at all

**2626 of 7490 observations (35%) have no derivable include-visible answer at all**, for one
reason:

> A run builds **two** `DependencyGraph` instances. One holds `.cnx → .cnx` edges; the other,
> inside `IncludeResolver.resolveHeadersTransitively`, holds header → header edges. Both are
> locals, both are discarded, and **no edge anywhere connects a `.cnx` to a header it
> includes.**

The only surviving trace is `reachesForeignHeader` — one bit per file meaning "can this file see
_any_ foreign header". So "can this file see `CAN_message_t`?" is not an unwritten query; it is
unanswerable from what the transpiler keeps.

> **#1881 update.** That bit is now `includesForeignHeader`, and it is direct: a header's names
> are visible only in a file whose own C includes bring that header in, nested headers included
> as C inlines them, and never through another `.cnx`'s include. `IFileIncludes.cHeaderPaths`
> keeps the headers the walk found, and `IHeaderMacroDump.headerFiles` the ones the preprocessor
> entered, so "can this file see `CAN_message_t`?" is answered by `IProgram.seesForeignSymbol`,
> and a macro by `IProgram.seesHeaderMacro`.

That sharpens #1398. It is not only that the edges exist and nobody joined them — for foreign
types **the edge does not exist in either graph**, so the join has nothing to join.

### The criteria

| #   | criterion                     | result                                                 |
| --- | ----------------------------- | ------------------------------------------------------ |
| 1   | disagreements, control firing | one real divergence; the rest agree or are underivable |
| 2   | does the boundary typecheck   | typed **4/4**, as a string **0/4** [^ql]               |
| 3   | do the gates survive          | **engine rejected**                                    |
| 4   | cost                          | naive derive **+23.8%** against a 10% ceiling          |
| 5   | unreachable except by query   | a gate catches the realistic bypass                    |

**Criterion 3 is decisive — but the rule is not "no query strings".** That was this spike's
first phrasing and it is too narrow. Expressing the same coupling eight ways against the
project's own four layer rules gives the real boundary:

| how the coupling is written                            | depcruise                          |
| ------------------------------------------------------ | ---------------------------------- |
| direct typed import                                    | **error**                          |
| free-function query imported from `output/`            | **error** (direct and transitive)  |
| provider table, layer-neutral result type              | silent                             |
| provider table, vocabulary laundered through `unknown` | silent — and `tsc --strict` exit 0 |
| SQL string                                             | silent                             |
| phase slice map naming the generate slice              | **error** (transitive)             |
| dynamic `import()` with a non-literal specifier        | silent — `tsc` exit 0              |

A provider table is fully typed, string-free and compiles clean, and the gate sees nothing. So
the rule is **the coupling must be a TypeScript import edge**. Phrased that way it rejects
provider tables, dynamic imports and query strings alike, and it accepts the free-function form
— which is why the recommendation below is queries as ordinary functions, never a registry.

Concretely, the same `logic/ → output/` coupling produces **130 errors** as a
typed import and **`✔ no dependency violations found`** as a SQL string, in a module that is
imported so `no-orphans` cannot account for it. #1297 fixed a gate that matched direct edges
only; under an engine, CI would print the same reassuring sentence for the same reason one layer
deeper — `logic/` reaching `output/` through a **string** — and no config flag fixes that,
because a dependency cruiser cannot follow a join inside a string literal.
`docs/architecture/README.md` states the principle it violates: **an invariant without a gate
does not count.**

**Criterion 4 fails for the naive derive**, exactly as pre-registered. The store is plain arrays
with no indices, because an index _is_ a materialized view and building one would reintroduce
the thing under measurement, and `visibleFrom` recomputes the closure on every call. Notably the
naive derive is slow for the _same reason the transpiler is_: it recomputes the include closure
instead of retaining it, and the transpiler does that three times per file per run, from disk.
One fix serves both.

### Bypass is already the majority, and that reframes criterion 5

The probe hooks accessors. Two of them — `isKnownBitmap` and `isKnownRegister` — were **never
asked** across 1143 fixtures. `isKnownBitmap` is dead. `isKnownRegister` is not: its concept is
used constantly, and the canonical accessor is simply bypassed.

> **Settled since (#1556).** `CodeGenState.isKnownRegister` was removed as unreferenced: every
> caller asks an injected `deps.isKnownRegister` declared by `IMemberSeparatorDeps`, and the two
> providers build that predicate inline from `knownRegisters` rather than passing the accessor.
> So the bypass this paragraph measures is now the only path, and the open question of whether
> the accessor should be reached is closed by there no longer being one.

Measured across the symbol surface:

| collection            | direct reads, bypassing any accessor | canonical accessor calls |
| --------------------- | ------------------------------------ | ------------------------ |
| `knownEnums`          | 23                                   | 14                       |
| `knownRegisters`      | 18                                   | **0**                    |
| `structFields`        | 16                                   | 4                        |
| `enumMembers`         | 15                                   | —                        |
| `knownScopes`         | 12                                   | 10                       |
| `knownBitmaps`        | 11                                   | **0**                    |
| `knownStructs`        | 9                                    | 9                        |
| `opaqueTypes`         | 8                                    | 3                        |
| `functionReturnTypes` | 6                                    | 5                        |
| **total**             | **118**                              | **45**                   |

Criterion 5 asked whether anything stops call site N+1 from bypassing a single store module.
Nothing does, and nothing has: **bypass is already 72% of the sites.** So routing through one
module is not the status quo being preserved, it is the change being proposed, and the gate is
what makes it hold rather than a nicety on top.

This also explains D1 without appealing to carelessness. "Five implementations of _is this a
struct?_" is what a codebase looks like when the canonical answer is one option among several
and no rule prefers it.

**It is also the main limitation of this measurement.** Hooking accessors observes roughly a
quarter of the sites where these questions are actually asked. Every divergence reported is
real — the identity control holds at 0 across 15852 observations — but the divergence count is
a floor, and a low one: `getStructFieldType`'s 32 cases come from 4 of the 20 `structFields`
question sites. Anyone continuing this should hook the **collections** behind a `Proxy` rather
than the accessors, so a read is observed regardless of who makes it.

## Defects found on the way

Ten, all reproduced and none fixed at the time — a measurement that also changes behavior
measures nothing. Three were more serious than the reading that prompted them, which is the
argument for requiring a reproduction rather than a confident note. Dispositions since are
noted in the table; the rows otherwise stand as they were measured.

| issue                                                  | what                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [#1432](https://github.com/smeltworks/cnx/issues/1432) | an analyzer reads the previous file's `typeRegistry`; E0850 is order-dependent and a signed subscript reaches generated C at exit 0 |
| [#1433](https://github.com/smeltworks/cnx/issues/1433) | `collectDependentsOf` memoizes a cycle-cut `false`, so E0427 falsely rejects                                                        |
| [#1434](https://github.com/smeltworks/cnx/issues/1434) | no `.cnx → header` edge exists, so E0426 is wrong in both directions                                                                |
| [#1435](https://github.com/smeltworks/cnx/issues/1435) | three derivations answer "what can this file see?", with different search paths and opposite cycle rules                            |
| [#1436](https://github.com/smeltworks/cnx/issues/1436) | cross-file struct fields never reach `structFields`; E0805/E0806/E0850 go silent                                                    |
| [#1437](https://github.com/smeltworks/cnx/issues/1437) | init-completeness is off for every qualified type form and every cross-file struct                                                  |
| [#1438](https://github.com/smeltworks/cnx/issues/1438) | `scopeVariableUsage` never written — leftover scaffolding, not a missing optimization; deleted in #1394                             |
| [#1439](https://github.com/smeltworks/cnx/issues/1439) | `collectGrammarCoverage` stored and never read                                                                                      |
| [#1440](https://github.com/smeltworks/cnx/issues/1440) | dead accessors `knip` cannot see; two stale ignore globs                                                                            |

[^ql]:
    The 0/4 is about **SQL specifically**, not query languages generally. CodeQL's QL, Glean's
    Angle and Soufflé all typecheck queries against a declared schema, and Glean additionally
    generates typed host bindings. They are rejected here on criterion 3, not criterion 2 — a
    query in a second language is not a TypeScript import edge, so enforcing the layer model
    under one of them means building and mutation-checking a second gate suite over a second
    toolchain.

## Recommendation

**Normalization as discipline, in plain TypeScript.** Specifically:

1. **Retain the include graph and memoize the closure.** It is currently built twice and thrown
   away twice, then rebuilt from disk twice more per file. This is the single change that
   brings the derive under the cost ceiling _and_ removes two redundant rebuilds, and it is a
   precondition for everything else.
2. **Give headers edges in that graph.** Until a `.cnx → header` edge exists, 35% of the
   questions asked of the symbol layer have no principled answer, and no schema can supply one.
3. **Make `structFields` cross the include boundary** on the same terms as `enumMembers` and
   `bitmapFields`, and give `getStructFieldType` and `getStructFieldInfo` one answer.
4. **Hide the raw collections from the exported type**, which is how TypeScript prevents the
   same bypass at zero runtime cost: `SourceFile.locals` exists at runtime and is simply not
   declared, and the public `Symbol` exposes seven of fourteen runtime slots. Four attempted
   bypasses fail under `--strict` with TS2339. This is cheaper and earlier than a gate, and it
   is the answer to 118 of 163 sites.
5. **Gate the store** as a backstop — mutation-check the gate in CI the way `layer-rules.test.ts` already
   checks that transitive rules carry `reachable: true`. An unchecked rule is how #1297
   happened.

**Do not adopt an in-memory SQL engine.** It is rejected on criterion 3 and independently
confirmed by criterion 2, before its dependency cost is even considered — and that cost is not
small: cnx has eight runtime dependencies, all pure JavaScript, so `better-sqlite3` would be
the first native build in a toolchain that embedded developers install.

Because the engine is rejected, #1431's flag for #1313 resolves: an engine will not subsume
[#1323](https://github.com/smeltworks/cnx/issues/1323), and the Cause 1 taxonomy cards are not
blocked on that question.

#### Two techniques worth naming, and one card available today

**Derive lazily and memoize on the entity, not the pass.** TypeScript keeps derived facts in
`symbolLinks` / `nodeLinks` — arrays inside the checker closure, keyed by a lazily stamped id —
and measured on this repo's own 1107 files it produces 523,596 symbols but only **148,496
types**. About 72% of symbols never have the expensive fact derived at all. The +23.8% above is
a _pass_ cost because the probe derived everything; lazy per-question memoization converts it
into a per-question cost most questions never pay.

**Never memoize a value computed inside an unresolved cycle.** TypeScript threads an explicit
resolution stack and, on a real cycle, emits a circularity error rather than caching garbage.
That is exactly [#1433](https://github.com/smeltworks/cnx/issues/1433), where
`collectDependentsOf` memoizes a cycle-cut `false` and E0427 then falsely rejects. The fix is
the general property, not a patch to one walk.

**And one gate is shippable now, independent of any of this.** A rule forbidding
`logic/analysis/` from reaching the state class (then `state/CodeGenState.ts`), with `reachable: true`, reports **26
violations across 15 non-test source modules** on the current tree — several only transitively,
so the reachability flag is doing real work. It fails on exactly the #1430 / #1432 case, needs
no dependency and no type work, and is the precondition for phase-typing that boundary later:
phase types over a codebase that still reaches a module-global are decorative, because the
analyzer never held the value the type describes.

## What this does not say

The probe covers the views it hooked, not all 74. The divergence count is a floor. The
recommendation rests on criteria 2 through 5, which are properties of the _options_ and do not
depend on how many views were probed; criterion 1's verdict is the one that would move with
more coverage, and it can only move toward more divergence, which strengthens the same
recommendation rather than changing it.
