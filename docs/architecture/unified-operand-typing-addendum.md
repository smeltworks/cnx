> **A design record, not the current state.** Written at `1ca1d67eb`, before
> implementation. Its citations and descriptions of the code are that commit's.

> **Later rulings (owner, 2026-09-26, after this addendum was written) override it where they differ:**
>
> 1. **ADR-049 governs targets.** The addendum's R5, which rejects only a program that reaches a C/C++ header, is superseded:
>    - **every** program with no target is rejected;
>    - the precedence is `#pragma target`, then `--target`, then the build system, which reverses the code's CLI-first order that §A5 kept;
>    - an unknown target name is rejected, not warned about.
> 2. **E0810's categories follow MISRA C:2012 Rule 10.4**, for cnx and header types alike:
>    - a named enum is its own essential category, and so are character and Boolean;
>    - MISRA's exception that `+`/`+=` may combine a character with a signed or unsigned operand is kept;
>    - this overrides §A4's default, which left enum and character with no category.
> 3. **The AVR miscompiles are fixed in this PR**: row A (masks shifted 16 or more places on a 16-bit `unsigned int`) and #1147's AVR arm. Row H (`case -32768`) was deferred to #1780 by a later ruling (2026-09-27). It carries no marker, because avr-g++ accepts it and no cell fails. What remains on AVR is marked `// test-target-xfail: atmega328p … #<issue>`, each failure naming its issue.
> 4. **The cross compile uses the real target libraries**, which overrides §A6.3's prototype-only headers:
>    - newlib and its C++ headers for Cortex-M, and avr-libc for AVR;
>    - CI installs them;
>    - a missing library fails the run loudly.
> 5. **The target table gains rows** for atmega328p, arduino-uno, esp32 (xtensa, ILP32) and native/host.
>    **Correction withdrawn, 2026-09-26.** An earlier note here said that §A12 item 5, "avr-libc hides `UINT*_MAX` from C++", did not reproduce. That note was wrong:
>    - In the real avr-libc 2.0.0 `stdint.h` (from the Ubuntu noble package), the limit macros are guarded by `#if !defined(__cplusplus) || defined(__STDC_LIMIT_MACROS)` at line 296, with no C++11 exception. The constant macros at line 613 do have one.
>    - With that header, `clang++ -std=c++14` fails: `use of undeclared identifier 'INT32_MAX'`.
>    - The non-reproduction had not compiled against avr-libc's header.
>    - Whether `avr-g++` behaves the same is unverified. T4's startup probe runs with the harness's exact flags and settles it.
> 6. **Targets are data (the long-term lens).** A target is a complete description of every fact the language depends on:
>    - word size, LDREX/STREX, BASEPRI;
>    - integer and pointer widths, and plain-`char` signedness;
>    - float and `double` widths, and endianness;
>    - the MISRA 5.1 identifier limits.
>
>    ADR-049 owns it, data model included, and ADR-024 only references it (superseding "amend ADR-024"). Other details:
>    - Named targets are `const TargetDescription` initializers in one versioned **cnx source** file. The compiler and the harness both read it, and a future cnx compiler reads it natively. The file allows literal values only, and a validator enforces that.
>    - ADR-049's capability pragmas are inline descriptions under the same completeness rule.
>    - Cortex-M0+ has no LDREX/STREX.
>    - The target errors get new codes, and ADR-049's E0802 example is corrected.
>
> 7. **T4 as built (2026-09-27).** It follows §A6, with these differences:
>    - The matrix drives GCC, not clang (owner ruling, 2026-09-27); other compilers are #1761. A target's driver and flags come from its catalog row's `toolchain_triple` and `toolchain_cpu`.
>    - The Cortex cells use a vendored CMSIS-Core (`vendor/cmsis-core/`, CMSIS 5.9.0) with `-D__PROGRAM_START`. CMSIS's own startup helper is not valid C++ under GCC 13, which is #1763.
>    - The host-only shims (`tests/include/avr/*.h`, `tests/include/cmsis_gcc.h`) are deleted, and so is `requiresArmRuntime`. A fixture's target is the transpiler's own `Target:` report, so a pin in a helper, an inline description and `platformio.ini` count as well as a pragma. No `FixtureTargets` module re-reads the source.
>    - Cross transpiles run in per-run mirrors of `tests/`, whose root carries a project-root marker so generated include guards match the committed ones. The plan's `-o <tmp>/` is not used.
>    - Every cell, the host included, compiles every generated translation unit with `-Werror`. The host previously ran `-fsyntax-only` on the entry alone.
>    - The marker is `// test-target-xfail: <target>... [c|cpp] #<issue> ["<text>"]`: an issue is required (box 12), a mode is optional, and one line may name several targets. A stray marker fails the fixture. The quoted text, added by the second review, is the failure the cell must show, and a host cell still runs its program.
>    - The model probe covers every catalog row that names a toolchain, not only the matrix members, and asserts LDREX/STREX and BASEPRI from the compiler's architecture macros.
>    - There is no `--targets` flag. `--transpile-only` runs no cross cells, so the warm re-run is host-only, as §A6.7 intended.

# Addendum: rulings R2-R6 (2026-09-26)

**Baseline.** HEAD is `1ca1d67eb` on branch `fix/1668-reject-mixed-int-float-arithmetic`. This addendum changes no repository file.

**Probe trees**, all under `scratchpad/`:

- `head2`: HEAD, unmodified.
- `head3`: head2 plus a throwaway E0510 check in `Transpiler._analyzeFile`.
- `head4`: head2 plus throwaway switches for R2, R3 and R4 (`CNX_R2`, `CNX_R3`, `CNX_R4=lp64|avr`).

**Tags.** **[ran]** names the probe directory under `scratchpad/addendum/`. Issue states were queried at `2026-09-26T19:38:57Z` with `gh api repos/smeltworks/cnx/issues/<n> --jq .state`.

**Inputs merged.** This addendum merges three documents:

- The typer-side addendum: R2–R4, and a first draft of R5 and R6.
- The target-side addendum: R5 and R6.
- The critic's review of both.

§A11 maps every confirmed critic finding to where it is resolved.

---

## A0. What changes in the approved design

| Approved design                                                  | Now                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §0.3 "Ternary arms compared with each other: **Not** added (Q5)" | Added, per R3 (§A3).                                                                                                                                                                                                                                                                                                                                                                 |
| §3.3 literal row; §5 E0810 "Suffixed integer literal: none (Q3)" | A suffixed literal is typed by its suffix, per R2 (§A2).                                                                                                                                                                                                                                                                                                                             |
| §3.5 "C and C++ integers: stay untyped, per #978 … Q4"           | Typed by spelling and by the target's data model, per R4 (§A4). The #978 guard is kept: arrays keep their dimensions, and pointers stay untyped.                                                                                                                                                                                                                                     |
| §5 E0869 "Lone suffixed literal: its type **(p)**"               | This is a Δ, not a (p). At HEAD, `u8 s1 <- 300u16` emits `uint8_t s1 = 300U;` and exits 0 (**[ran]** `r2/p4`, re-run by the critic), because `INTEGER_LITERAL` excludes suffixes (`IntegerConversionAnalyzer.ts:64`). Forecast B28.                                                                                                                                                  |
| §5 composite "suffixed ones too … (Δ S18)"; §6 B19, S18          | Deleted. HEAD already counts suffixed literals at their suffix width in both passes (`IntegerConversionAnalyzer.ts:280-285`). **[ran]** `r2/p7`: `b + 100u32` gives `cnx_clamp_add_u32`. R2 keeps this.                                                                                                                                                                              |
| §5 `directTypeName` "Integer literal: `"int"` (p)"               | The row was imprecise. HEAD gives `int` for an unsuffixed literal and the suffix type for a suffixed one (`ExpressionTypeResolver.ts:753-755` calls `LiteralUtils.ts:141-146`). The typer's `typeName` reproduces both, so R2 adds 0 hunks to 2.2 direct typing. The typer-side reason ("equals the target type for every accepted program") was false: `u32 w <- 5u16` is accepted. |
| §5 "Foreign integer: none (p, **Q4**)"; §7 P0 "file C09"         | R4 types them. C09 is fixed in this PR, not filed.                                                                                                                                                                                                                                                                                                                                   |
| §10 Q3, Q4, Q5                                                   | Answered by R2, R4 and R3. Q1, Q2 and Q6 stand.                                                                                                                                                                                                                                                                                                                                      |
| §2.2 "No orchestrator field is added"                            | Still holds, and one field is removed: `Transpiler.pragmaTargets` (`Transpiler.ts:154`).                                                                                                                                                                                                                                                                                             |

---

## A1. Measurements (P5)

| Fact                                                 | Probe / command                                                                                                                                     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Does generated output depend on the target?          | **[ran]** the target-diff probe: every fixture, both modes, no target vs cortex-m7 vs avr. **[ran]** `tdiff/`: no target vs cortex-m4 vs avr.       | the target-diff probe made 3813 C and 3957 C++ comparisons; tdiff made 7632 CLI runs over 3315 files. **0 unpinned fixtures differ.** Every difference is a pinned fixture whose pragma `--target` overrides (`CodeGenWalker.ts:2157-2170`). Every `test-error` diagnostic is identical across targets.                                                                                                                                      |
| Data models                                          | **[ran]** `dm/`, `dm.c`: `_Static_assert` per target, plus a negative control                                                                       | host gcc: short, int, long, long long, size_t, pointer = 16/32/64/64/64/64. thumbv6m, thumbv7m and thumbv7em: 16/32/32/64/32/32. avr (`-mmcu=atmega328p`): 16/16/32/64/16/16, with a 32-bit `double`.                                                                                                                                                                                                                                        |
| Fixtures that reach a C/C++ header                   | **[ran]** `e0510.sh` on head3 (the check sits in 2.1). **[ran]** `measure/foreign.py` (a text walk).                                                | 176 by the first, 181 by the second, out of 1272. The Stage 3b count is recorded by M42 in T3.                                                                                                                                                                                                                                                                                                                                               |
| Other callers that go red with no target             | **[ran]** the unit and test:cli probe logs                                                                                                          | Unit tests: 34 tests in 6 files (Transpiler.coverage 20, examples-transpile 6, externalSymbolRecovery 3, RequireInclude 2, cacheParity 2, compileCommandsDiscovery 1). test:cli: 4 of 34 (the hello-world tests at `test-cli.js:179`, `:203`, `:231`, and #580 at `:854`/`:880`). Examples: 6 of 6. The cli smoke step goes red. DualCodePaths: 0.                                                                                           |
| Pinned fixtures                                      | **[ran]** `grep -rlE '^\s*#\s*pragma\s+target' tests`, listed in `final/pinned.txt`                                                                 | 16: 13 `teensy41`, 1 `cortex-m0`, 2 `stm32f4`. None includes a file, and none is `test-execution`.                                                                                                                                                                                                                                                                                                                                           |
| Cross compile at HEAD (shim plus the `-Werror` trio) | **[ran]** `tdiff/ccF`, regrouped in `final/fails.txt`                                                                                               | Cortex-M: **0** failures. AVR: **34 fixtures**, by cause: A (shift masks on a 16-bit `int`) 12; B (#1147, SREG/cli) 11; C (f64 bits on a 32-bit `double`) 4; H (`switch-negative-i16`) 1; E–G (C `int` interop: cjson, esp-idf-style, func-arg, issue-314, comprehensive-cpp) 5; I (a 76 800-byte object) 1. The target-side count of 37 included 1 pinned fixture run on avr (`atomic/atomic-in-critical`) and the 2 row-D artifacts below. |
| Row D "clang++ redefinition" is a probe artifact     | **[ran]** in the repo: clang++ and g++ with `-std=c++14 -fsyntax-only -I tests/include -I <dir>` on `issue-332-…test.cpp` and `issue-328-…test.cpp` | Both compilers return 0 on both files. The failing copy had regenerated `issue-332-cnx-types.h` outside the repo root, so its guard became `CNX_ISSUE_332_CNX_TYPES_H` instead of the committed `CNX_TESTS_INCLUDE_…`, and the `.h`/`.hpp` pair stopped sharing a guard.                                                                                                                                                                     |
| Cross compile with real libc headers                 | **[ran]** `xcc/cc2.sh` with extracted debs (the packages are not installed)                                                                         | cortex-m7: 1606 of 1614 pass; the 8 failures need `<cstdint>`, which comes from hand-written helper headers (§A6.3). avr: 231 `.cpp` fail because avr-libc hides the limit macros from C++ (`avr/include/stdint.h:296`).                                                                                                                                                                                                                     |
| Plain `-fsyntax-only` on avr                         | Re-run by the critic with avr-libc                                                                                                                  | The 12 row-A fixtures produce 10 warnings and rc 0. Only `-Werror=shift-count-overflow` fails them.                                                                                                                                                                                                                                                                                                                                          |
| R2, R3 and R4 diagnostics at HEAD's typing reach     | **[ran]** head4 with `p4.sh`/`p4b.sh` over every fixture and example                                                                                | 0 diagnostics added or removed under each switch. Under R4, with both lp64 and avr models, 0 output files changed.                                                                                                                                                                                                                                                                                                                           |
| cnx's own categories                                 | **[ran]** `final/en.cnx`, `ch.cnx`, `bo.cnx` on head2                                                                                               | `u32 a + EColor c` compiles. `u32 a + s[0]` compiles. `u32 a + bool b` gives E0807.                                                                                                                                                                                                                                                                                                                                                          |
| #978 subscript on a C scalar                         | **[ran]** critic `crit/r978`                                                                                                                        | `bool d <- word[4]`, with `extern uint32_t word;`, emits `bool d = word[4U];`. That is invalid C, and the transpiler exits 0.                                                                                                                                                                                                                                                                                                                |
| Project-root markers in the tree                     | `git ls-files \| grep -E '(^\|/)(package\.json\|\.cnx\.json\|\.cnxrc\|cnx\.config\.json\|platformio\.ini)$'`                                        | `package.json`, `prettier-plugin/package.json`, `tests/platformio-detect/platformio.ini`, `examples/nucleo-f446re/test-nucleo/platformio.ini`.                                                                                                                                                                                                                                                                                               |
| Runtime                                              | `gh api repos/smeltworks/cnx/actions/jobs/<id>` for runs 36258482158, 36258141251, 36257108075; `/usr/bin/time`                                     | The `npm test` step takes 57/57/60 s, and the Integration job 2m12/2m10/2m17. Transpiling the corpus once for one target in both modes costs 1160 user + 348 sys CPU-s, 45–47 s wall at 24 workers. A clang syntax pass over 3440 TUs takes about 4 s wall at 28-way.                                                                                                                                                                        |
| Issue states                                         | Queried at `2026-09-26T19:38:57Z`                                                                                                                   | Open: #1147, #1435, #1671, #1146, #1414, #1213.                                                                                                                                                                                                                                                                                                                                                                                              |

---

## A2. R2: a suffixed integer literal takes its suffix's category and width

**Typer (C3).** A literal is typed by `LiteralUtils.typeOf` (`LiteralUtils.ts:137-160`), which is unchanged.

- A **suffixed** literal gives `typeName` `u16`, `i32` and so on. Its `category` and `bitWidth` come from that name. Its form is `{kind:"literal", literal:"integer", suffixed:true}`.
- An **unsuffixed** literal gives `typeName "int"`, `category "none"` and `bitWidth null` (ADR-052).
- `category` is derived once from `typeName` (G8). The typer has no special case for literals.

**Policy.** Two rows collapse into one fact: a literal has a category.

| Consumer                       | Rule                                                                                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0810 `rule104Category`        | Reads `t.category`. Unsuffixed gives none, suffixed gives its suffix's category, float gives floating.                                                                                                                                          |
| E0868/E0869 `conversionSource` | A lone unsuffixed literal takes the range path (p, `:152-158`). A lone suffixed literal is its type (Δ B28): `u8 s1 <- 300u16` and `u8 x <- 5u16` are narrowing, and `i32 x <- 5u32` is a sign change. `u32 w <- 5u16` is accepted as widening. |
| Composite width, both passes   | `CompositeType.integerOf` skips leaves whose category is none, and counts a suffixed literal at its suffix width. That is HEAD's answer in both passes (p). 2.1 and 2.2 call the same function.                                                 |
| 2.2 `directTypeName`           | (p), per §A0.                                                                                                                                                                                                                                   |

**Order dependence goes away.**

- At HEAD, `a + 5i32` compiles to `cnx_clamp_add_u32(a, 5U)`, while `5i32 + a` is E0869 (**[ran]** `r2/p1`, `r2/p2`).
- Under R2, both are E0810 (**[ran]** head4 with `CNX_R2=1`).
- `i32 s + 5i32` and `u8 b + 100u32` stay silent (`r2/p3`, `r2/p7`).
- **Corpus:** one fixture uses suffixed literals (`literals/integer-type-suffixes`), and every declaration in it matches its suffix.

---

## A3. R3: E0810 compares a ternary's two value arms

The check lives in `MixedTypeCategoryAnalyzer`, as a third caller of the operand-category function that `checkLevel` (`:233-243`) and `checkCompound` (`:265-282`) already use:

```ts
override enterTernaryExpression = (ctx) => {
  const arms = ParserUtils.ternaryValueArms(ctx); // ParserUtils.ts:252-258; the condition is excluded
  if (!arms) return;
  const left = this.operandCategory(arms[0]);     // valueLeaves + rule104Category (after C4b)
  const right = this.operandCategory(arms[1]);
  if (left && right && left !== right) this.analyzer.addTernaryError(arms[1], left, right);
};
```

**One report per defect.** `operandCategory` returns null for an operand whose leaves are already mixed (`:210-227`).

- **An arm that is itself mixed.** `(c > 0) ? (a + s) : a` is reported once, at the inner `+`.
- **A mixed ternary inside a composite.** `a + ((c > 0) ? a : s)` is reported once, at the ternary. HEAD descends through the arms at the `+` level (`:149-156`), sees the mixed leaves `{a, s}`, and gets null there.

**Nesting.** The grammar allows a parenthesized ternary inside an arm; nesting is refused by a semantic check (`grammar/Cnx.g4:350-354`). Each ternary node is still checked once.

**Evidence.** **[ran]** `r3/t1.cnx` on head4 with `CNX_R3=1`:

- `r1` (u32 vs f32), `r2` (u32 vs i32), `r3` (inside `a + …`) and `r9` are each flagged exactly once.
- `r4` (signed only in the condition), `r5` (an unsuffixed literal arm), `r6` (both signed) and `r10` (u32 vs u16) stay silent.
- With R2 also on, `r7` (`a : 5i32`) is flagged.

**Message.** The code is the same, E0810, with a second message form: "Conditional operator's value arms have different essential type categories (…)". The help text is unchanged.

**2.2.** No change. A typed disagreement is now rejected in 2.1. "Category none when the arms disagree" survives only for untyped arms (§3.3).

---

## A4. R4: C and C++ header integers get a category and a width

**Where the model comes from.** The typer reads it from Program:

```
ctx.program.target()  →  kind === "resolved" ? capabilities.dataModel : null
```

`ITypingContext` gains no field. 2.1's context and 2.2's `state.typingContext()` already carry `program`. The typer still imports no pass, no `TranspileState` and no `Program` class (§8.5).

**`ForeignTypeFacts.operandType(nameOrPath, lookup, model)`.** For each operand:

1. The spelling is qualifier-stripped (`unqualified`, `ForeignTypeFacts.ts:140-145`), and a leading `std::` or `::` is removed.
2. It is matched against the table below **at every hop of the typedef walk, before the typedef is followed** (`:124-138`, 8 hops).

The name must come first because headers are preprocessed with a compiler chosen independently of the target. Without it, `uint32_t → __uint32_t → unsigned int` would take `int`'s width from the wrong model. M34 guards this.

| Spelling (qualifier-stripped)                                                                    | category          | width                       | `typeName`                           |
| ------------------------------------------------------------------------------------------------ | ----------------- | --------------------------- | ------------------------------------ |
| `intN_t`, `int_leastN_t` / `uintN_t`, `uint_leastN_t` (N = 8, 16, 32, 64)                        | signed / unsigned | N                           | `iN` / `uN`                          |
| `size_t`                                                                                         | unsigned          | `model.sizeT`               | `u{w}`                               |
| `ptrdiff_t`, `intptr_t` / `uintptr_t`                                                            | signed / unsigned | `model.pointer`             | `i{w}` / `u{w}`                      |
| `signed char` / `unsigned char`                                                                  | signed / unsigned | 8                           | `i8` / `u8`                          |
| `char`                                                                                           | character         | 8                           | `char`                               |
| `short`, `int` / `signed`, `long`, `long long`, each with its `unsigned` form                    | signed / unsigned | the model's field           | `i{w}` / `u{w}`                      |
| `_Bool`, `bool`                                                                                  | boolean           | —                           | `bool`                               |
| C `enum` type or tag; C++ `enum` / `enum class`                                                  | enum              | —                           | its C spelling; `enumTypeName: null` |
| `int_fastN_t`, `uint_fastN_t`, `intmax_t`, `uintmax_t`                                           | signed / unsigned | **null** (the libc decides) | —                                    |
| Anything else: a pointer, `wchar_t`, `char16_t`, `__int128`, an unrecorded `using` alias (#1213) | —                 | —                           | null (untyped)                       |

- **`model === null`.** The spellings that depend on the model keep their category and give a null width. The answer is total: no `invariant`, and nothing crashes in unit tests or in a program that E0510 stops (this answers critic finding B6).
- **The #978 guard.** An array keeps `arrayDimensions`, including `dims:[""]` for `extern T x[]`, so subscripting it stays element access. A pointer spelling is untyped, and `SubscriptClassifier`'s default keeps element access. Only a scalar C integer is now subscripted as bits: that is ADR-024's rule, and it replaces the invalid `word[4U]` (§A1). This is S25, with M50 and M51.
- **Overflow.** Foreign operands carry `overflow: null` (§5). In `a + cU32`, `a` decides the overflow and the foreign operand decides the width. Arithmetic between two C operands stays native.

**Policy.**

- **E0810.** Counts signed, unsigned and floating. Character, boolean and enum stay none, as they are for cnx's own `char`, `bool` and enums (§A1; open question 2).
- **Composite (`CompositeType.integerOf`).** A foreign integer leaf counts at its width (S23). A known integer category with a null width vetoes the helper, the same way floating does, and gives native C (S24).
- **Every other integer consumer** reads the same answer through the one typer: E0805, E0806/E0807 (C `_Bool` is `bool`, so `cBool + 1` is E0807), E0850, and E0868/E0869, including casts such as `(u8)cInt`. This is B31, measured per analyzer group.

**The live miscompile this fixes.** **[ran]** `r4/q1`: with `u8 b <- 200` and `uint32_t cU32 = 70000`, HEAD emits `cnx_clamp_add_u8` and exits 2 (255, not 70200). Under head4 with either model it emits `cnx_clamp_add_u32` and exits 0.

---

## A5. R5: data models in the one target table, one run target, and E0510

### A5.1 Contracts and the table

```ts
// src/cnx/types/ICDataModel.ts (widths in bits)
interface ICDataModel {
  readonly short: 16; readonly int: 16 | 32; readonly long: 32 | 64;
  readonly longLong: 64; readonly sizeT: 16 | 32 | 64; readonly pointer: 16 | 32 | 64;
}
// ITargetCapabilities.ts (:6-27) gains:
readonly dataModel: ICDataModel | null;          // null only on DEFAULT_TARGET, meaning "no target named"
readonly compileFlags: readonly string[] | null; // clang flags that select the target; null = native host compiler (executes)
// TARGET_CAPABILITIES.ts (:21-30): an annotation, NOT `satisfies`, so byName's string index
// (TargetResolver.ts:29) still type-checks; a row without a model is a type error (M49)
const TARGET_CAPABILITIES: Readonly<Record<string, ITargetCapabilities & { readonly dataModel: ICDataModel }>>;
```

| Row                           | Capabilities                             | Model                   | `compileFlags`                                                  |
| ----------------------------- | ---------------------------------------- | ----------------------- | --------------------------------------------------------------- |
| **`host`** (new)              | `...DEFAULT_TARGET`                      | LP64 16/32/64/64/64/64  | `null`: native gcc/g++, which also executes                     |
| teensy41, teensy40, cortex-m7 | unchanged                                | ILP32 16/32/32/64/32/32 | `--target=thumbv7em-none-eabi -mcpu=cortex-m7`                  |
| cortex-m4, **stm32f4** (new)  | stm32f4 copies cortex-m4                 | ILP32                   | `--target=thumbv7em-none-eabi -mcpu=cortex-m4`                  |
| cortex-m3                     | unchanged                                | ILP32                   | `--target=thumbv7m-none-eabi -mcpu=cortex-m3`                   |
| cortex-m0+, cortex-m0         | unchanged (the m0+ LDREX claim is filed) | ILP32                   | `--target=thumbv6m-none-eabi -mcpu=cortex-m0plus` / `cortex-m0` |
| avr                           | unchanged                                | 16/16/32/64/16/16       | `--target=avr -mmcu=atmega328p`                                 |

- **`host`** has exactly the default capabilities, so `--target host` produces today's no-target output byte for byte.
- **`stm32f4`** is listed at ADR-049:494. `examples/nucleo-f446re/blink.cnx:20` names it, and so do 2 fixtures; today all three silently get the default.
  - The example's C changes from PRIMASK to LDREX (**[ran]** `ex/nuc-m4.c` vs `ex/nuc-none.c`). That is S27.
  - The 2 fixtures' output does not change (**[ran]** the target-diff probe).
- **`DEFAULT_TARGET`** (`DEFAULT_TARGET.ts:13-19`) gains `dataModel: null` and `compileFlags: null`.
- **The model constants** are private to the table file.
- **`ArgParser.ts:153`** derives its list from `Object.keys(TARGET_CAPABILITIES)`. The hand-written list already lacks `teensy40`.

### A5.2 One run target, resolved in 1.4 and stored on Program

This replaces the per-file codegen decision (`CodeGenWalker.resolveTargetCapabilities`, `:2153-2170`, called at `:1645`) and the per-run narrowest-budget loop (`TargetResolver.forRun`, `:63-84`, used at `Transpiler.ts:1898`). A C `int` has one width per build.

**1.3.** `IFileSymbols.declaredTarget: {name, line, column} | null`.

- `CnxResolver.resolve` records it through `TargetResolver.fromPragma` (`:36-49`), which now also returns the position.
- `Transpiler.ts:154`, `:874-877` and `:1500` are deleted.
- No artifact-lifetime edit is needed: the `:294` pin covers parse-node holders only.

**1.4.** `Program.build` takes `target: {option, platformio}`. `IProgram.target(): TRunTarget` is frozen with the program. The new contract is:

```ts
// src/cnx/types/TRunTarget.ts
type TRunTarget =
  | {
      kind: "resolved";
      name;
      source: "option" | "pragma" | "platformio";
      capabilities;
    }
  | {
      kind: "unresolved";
      reason: "none" | "unknown" | "conflict" | "platformio-ambiguous";
      names;
      at;
    };
```

**`TargetResolver.forRun(option, declared, platformio)`** tries these rungs in order:

1. The option, if it is a table key. Config `target` merges into it at `Cli.ts:131`.
2. Pragmas. If the known names all agree, that target. If two known names differ, **conflict**, positioned at the second pragma.
3. PlatformIO (§A5.3).
4. Unresolved: `unknown` if any unknown name was given, else `none`.

Rules for the rungs:

- An unknown name skips its rung, which is HEAD's fallback (`CodeGenWalker.ts:2157-2168`), and is kept for the messages. This answers critic finding B5.
- The order is HEAD's, which `TargetResolver.test.ts:88-91` pins.

**Consumers.**

- **Codegen.** `ICodeGeneratorOptions.target?: string` (`:14-15`) becomes `targetCapabilities: ITargetCapabilities`. `Transpiler.ts:1200` feeds it from `program.target()`, falling back to `DEFAULT_TARGET` when unresolved.
- **Rule 5.1** (`Transpiler.ts:1898`) reads the same value.
- **The typer** reads `dataModel`.
- **Warnings.** The unknown-target warning becomes one entry in `result.warnings` per run, instead of a `console.warn` per file (`CodeGenWalker.ts:2162`).

**Changes, each forecast.**

- A helper with no pragma, in a program whose files name one target, now gets that target (S26). HEAD gave it the default. Corpus: 0.
- Files that name different known targets are E0510. Corpus: 0. This is open question 1.

### A5.3 PlatformIO detection and the one project-root finder

**One project-root finder (T1).** Today there are two:

- `Transpiler.determineProjectRoot` (`Transpiler.ts:3370-3397`): cnx.config.json, platformio.ini, .git, package.json.
- `IncludeDiscovery.findProjectRoot` (`IncludeDiscovery.ts:329-341`): platformio.ini, cnx.config.json, .cnx.json, .cnxrc, .git.

They become one: `IncludeDiscovery.findProjectRoot`, with the **union** of the markers.

- Both finders already return the nearest ancestor that holds any marker. So a root changes only where a nearer marker is on one list and not the other, and `git ls-files` shows none in `tests/` or `examples/` (§A1).
- The start-directory rule (a file gives its directory; a directory gives itself) stays in the caller.
- The cases in `determineProjectRoot.test.ts` move to the one finder.

**One `platformio.ini` reader.** `src/cnx/PARSE/1-Discover/PlatformIOIni.ts` (in `transpiler/data/` until #1444, and in `PARSE/1-Discover/` since).

- `_collectLibExtraDirsValues` and `parsePlatformIOLibExtraDirs` (`IncludeDiscovery.ts:202-311`) move onto it.
- It returns each env's `{name, board, platform}` and `default_envs`.

**The decision: `TargetResolver.fromPlatformIO(ini)`.**

- The envs considered are the `default_envs` entries if the file sets any, otherwise every env.
- Each env gives its `board` if that is a table key, else `avr` if `platform = atmelavr`, else unknown (the board is kept for the message).
- If all considered envs agree, the target is resolved. If they differ, the result is `platformio-ambiguous`.

**Where the search starts.** At the entry file's directory:

- `config.input` in files mode;
- `sourcePath` in source mode, else `workingDir`.

This reaches serve, which builds its Transpiler with `input: ""` (`ServeCommand.ts:249-256`). There, `determineProjectRoot` returns undefined today.

**Build-script template.** `cnx_build.py` (`PlatformIOCommand.ts:88-121`) passes `--target $BOARD` (via `env.subst`) when the value is not empty. Each env of a multi-env project therefore builds for its own board.

- Existing installs keep their old script until `cnx --pio-install` runs again.
- **`ponytail:` ceiling.** A multi-env project whose AVR boards are not table keys and that sets no `default_envs` needs `#pragma target avr`.
- PlatformIO is not installed here, so test:cli asserts the template's text.

### A5.4 E0510

**Where.** Stage 3b, between Stage 3 (`Transpiler.ts:518-521`) and Stage 4. It is skipped under `parseOnly`, following the precedent at `:964-966`.

- It reads `program.target()` and each pipeline file's `firstForeignInclude`.
- It fires once per run and halts before 2.1.
- No orchestrator field is added. This answers critic findings B1 and A6.

**When.**

- The target is unresolved **and** some pipeline file directly includes a C/C++ header: E0510.
- The target is unresolved because of a **conflict**: E0510, header or not (open question 1).
- Any other unresolved case keeps HEAD's behavior: default capabilities, plus a warning if names were given.

**Position.**

- For an unknown or conflicting pragma: that pragma.
- Otherwise: the first header `#include` of the first pipeline file that has one. Pipeline order puts dependencies first in both modes, because source mode builds its input through the same `Transpiler._buildPipelineInput` and its `_sortFilesByDependency`.
- The chain case is equal in both modes, which the DualCodePaths test asserts. The order of sibling branches can differ between modes; that is #1435's territory.

**The one fact behind "reaches a header".**

- `IResolvedIncludes.hasForeignInclude` (set in `IncludeResolver._categorizeFile` and `_handleUnresolvedInclude`) becomes `firstForeignInclude: {line, column} | null`.
- `IncludeDiscovery.extractCnxIncludes` carries the position of the `INCLUDE_DIRECTIVE` token. Since #1745, it is how `IncludeResolver.resolve` reads a `.cnx` file's directives. The text scan, `extractIncludesWithInfo`, now reads only C and C++ headers.
- Its one reader, in `Transpiler._buildPipelineInput`, compares it with `!== null`.
- `IPipelineFile` gains `firstForeignInclude`, which is direct. `IPipelineFile.reachesForeignHeader` is unchanged, so E0426 and E0427 are unchanged. (#1881 later replaced it with the direct `includesForeignHeader`.)

**Source-mode reach.**

- The gap: `IncludeTreeWalker.resolveIncludes` (`:129-152`) already runs `resolver.resolve` and throws away everything except `cnxIncludes`. Without the fix, source mode reports `E0427 'cValue' is not defined` where files mode reports E0510 (**[ran]** critic `crit/src3`).
- The change: the walker passes each walked file's `firstForeignInclude` to its callback, which `_discoverFromSource` stores.
- This adds no include-graph derivation; #1435 remains the unification card. This answers critic finding B2.
- Still open: source mode never collects the symbols of such a header. That is filed.

**Messages.**

```
error[E0510]: this program includes a C/C++ header, but names no target, so the header's integer types have no width
```

Variants:

- "the target 'X' is not a known target";
- "files name different targets ('a' at f:l, 'b' at g:m)";
- "platformio.ini environments name different targets".

The help text is "name one with `#pragma target <name>`, `--target <name>`, or `"target"` in cnx.config.json; known targets: …", with the list derived from the table.

**Registry.** E0510 is the next free code in E05xx: `docs/error-codes.md:175` ends at E0509, and a grep finds no E0510. Its source is `Transpiler.ts`, as for E0507 and E0509. The range row goes from 9 to 10 (`:19`), and the total from 106 to 107. The row, the emitter, the fixtures and the `diagnostics:manifest` regeneration land in one commit (T3).

**ADR-024** records the rule in T0 and declares **no matrix cell**, because an `#include` or a pragma sits in none of the four contexts (`adr-024-type-casting.md:443-456`). The transitive fixture and the DualCodePaths case carry the cross-file obligation.

**Result output.** `ITranspilerResult` gains `target?: {name, source}`, and `ResultPrinter.print` (`ResultPrinter.ts:27`) prints `Target: <name> (<source>)` on success. The harness reads that line.

---

## A6. R6: the target matrix in the harness

### A6.1 Choosing a fixture's targets

`scripts/utils/FixtureTargets.ts` has two methods, `planFor(source, requested)` and `primaryFor(source)`. Its callers are:

- the harness;
- `examples-transpile.test.ts:72`;
- `format-fidelity.ts:135`;
- `matrix/AdrProvenanceLines.ts:41`.

Provenance returns an empty map for a failed transpile, by design (`AdrProvenanceLines.ts:27-31`). Without a target, a fixture that reaches a header would therefore lose its matrix occupancy without any error.

| Fixture                                                                                     | Runs                                                                                                                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `// test-no-target` (this wins over a pragma)                                               | Once, with **no** `--target`. The effective target is the `Target:` line; if there is none, the host toolchain.                |
| `#pragma target X`, read by `TargetResolver.fromPragma(CnxSourceParser.parse(source).tree)` | `[X]`, pinned. An unknown X is a harness error.                                                                                |
| anything else                                                                               | `MATRIX = ["host", "cortex-m7", "avr"]`, narrowed by `--targets a,b`. `--targets` never narrows a pinned or no-target fixture. |

- The pragma is read with the same reader the transpiler uses, not a second regex.
- A unit test asserts that each MATRIX name is a table key and that the three models are pairwise distinct.
- Both new markers join `TestMarkers.SPELLINGS` (`TestMarkers.ts:67-76`), and "all eight" (`:51`) becomes "every row".
- The Cortex-M member is `cortex-m7`. Both cortex-m7 and cortex-m4 measured 0 unpinned differences (§A1).

### A6.2 Runs per fixture and mode (`runTestMode`, `test-utils.ts:1092`)

**1. The first target** (host, the pinned one, or none):

- Transpile in place. `transpileViaCli` appends `--target` at `:183`; its call sites are `:1121` and `:1830`.
- Assert that the `Target:` line equals the requested target (M43).
- Compare against the one snapshot set, or write it under `--update`.
- If the target is native, run today's gcc/g++ compile (`:1350`), the no-warnings check (`:1404`) and execution (`:1421`). `requiresArmRuntime` (`:542-551`) still skips execution for CMSIS output, and says so.
- If the target is not native, run the cross compile (§A6.3).

**2. Every other matrix target:**

- Transpile with `-o <tmp>/`. This writes every output there, and the #1134 subdirectory helpers still match their snapshots (**[ran]** by probe, and by the critic). The tree stays clean for Verify Clean.
- Assert the `Target:` line.
- Compare **byte for byte** against the same snapshots and the same `.expected.error`. A mismatch fails as "target-dependent output: pin it with `#pragma target`", **also under `--update`** (#1316).
- Cross compile.

### A6.3 Cross compile

`getCompilerConfig(mode, tu, target)` (`test-utils.ts:526-536`) is the one decision. It returns clang or clang++ when `compileFlags !== null`. The flags, in order:

1. The standard flag.
2. `-fsyntax-only -ffreestanding -nostdlibinc -isystem tests/include/cross-libc -Werror=shift-count-overflow -Werror=constant-conversion -Werror=incompatible-pointer-types`.
3. The row's `compileFlags`.
4. `fixtureCompileFlags(<tmp>, root)` (`:702-711`).

**Why these flags.**

- **The `-Werror` trio** is what makes a 16-bit `int` visible. Without it, the 12 row-A AVR miscompiles pass (§A1). This answers critic finding A2.
- **`tests/include/cross-libc/`** holds ISO C prototypes only, for the headers the corpus uses that clang's freestanding set lacks: string.h, stdio.h and stdlib.h, as measured.
  - The headers that carry widths (stdint.h, limits.h, stddef.h) are clang's own, built from the target's predefined macros, so the shim cannot state a width wrongly.
  - **`ponytail:`** declarations only, never linked. Real newlib and avr-libc are open question 4.
- **No `<cstdint>` or `<cstddef>` is needed.** Codegen emits neither (grep `src`). Six hand-written helper headers include them, and none uses a `std::` name (grep): `tests/include/template-stubs.h:8`, `tests/regression/issue-314-global-method-call.hpp:2`, `issue-321-global-object-method.hpp:2-3`, `tests/issue-516/CppNamespace.hpp:2`, `tests/cpp-interop/MockLib.hpp:2`, `comprehensive-cpp.hpp:2-3`. They switch to `<stdint.h>`/`<stddef.h>`, which keeps the 8 fixtures that need `<cstdint>` on all three targets rather than pinning them.

**Ceilings.**

- `tests/include/avr/interrupt.h:17-20` and `cmsis_gcc.h:17` are stubs on every run. avr-libc and CMSIS semantics (#1146, #1147, #1414) are therefore checked only as "declared". This answers critic finding A3.
- `-fsyntax-only` misses backend-only failures. The one known case, cortex-m0+ LDREX, is also hidden by the CMSIS stub, and cortex-m0+ is not in the matrix. It is filed.

**Startup model probe (M47, M48).** Before any fixture runs:

- **host:** gcc compiles and runs a probe that prints the six widths.
- **each cross target:** its flags compile `_Static_assert(sizeof(T)*8 == W)` for the row's model.

A mismatch aborts the run, and an LLP64 machine is rejected for `host`. Under `--transpile-only`, the cross probes are skipped and the report says so, so the Unit Tests job, which spawns the harness with `--transpile-only` (`no-snapshot-reporting.test.ts:64-90`), needs no clang. `checkValidationTools` (`test.ts:69`) fails hard, with the install line, if clang is missing when a cross target will compile.

### A6.4 Expected failures

The marker is `// test-target-xfail: <target> <#issue | reason>`.

- That target still runs and **must fail**. A pass fails the fixture as a stale xfail.
- Nothing is skipped.
- At HEAD it covers the **34 AVR fixtures** in §A1. Cortex-M needs none.
- Every marker cites an issue from §A12. The exception is row I, a 76 800-byte object, which is not a valid AVR program and carries a reason text instead.
- ADR-043 carries each marker into the output as one line (S28).

### A6.5 Reporting

- The pass line lists each target, for example `[c: host:exec cortex-m7:cc avr:xfail #N] [cpp: …]`.
- `ITestResult` (`scripts/types/ITestResult.ts:10`) gains `targets: {target, pin, level}[]`, with levels `executed | compiled | transpiled | diagnosed | xfail`.
- `printResult` (`test.ts:136`) and the summary, including quiet mode, give per-target totals, plus the pinned and no-target counts.
- A fixture with zero target runs fails.
- `Passed` still counts fixtures, which is what `no-snapshot-reporting.test.ts:58-61` parses.

### A6.6 Snapshots

There is one snapshot set per mode.

- **At HEAD, output does not depend on the target:** 0 unpinned fixtures differ (§A1).
- **Every later commit asserts this** through §A6.2 step 2.
- **A result that does depend on the target**, such as an R4 width, has to be a pinned fixture. The R4 model fixtures are pinned (§A9).
- **The warm re-run is host-only.** Cached C header symbols are strings that do not depend on the target. **`ponytail:`** if the cache ever stores a fact that depends on the target, the warm run needs the matrix.

### A6.7 Runtime and CI (`pr-checks.yml:358-420`)

**One job, not legs.** The 8 runners share one machine (`pr-checks.yml:46-63`), and each harness spawns a worker per core it may use (`availableParallelism()`, `test.ts:652`), so parallel legs would contend for the same cores.

- Before `npm test` (`:388`), add a guard: `command -v clang >/dev/null || (sudo apt-get update -qq && sudo apt-get install -y -qq clang)`.
- The warm re-run (`:406`) and `gate.sh:91` become `npm test -- --transpile-only --targets host`. `gate:roster:check` is unchanged, because the `run_check` count stays the same.
- The artifact upload, `headers:standalone:check` and `validate:c` stay host-only.
- **Estimate:** about 3000 extra CPU-s, so `npm test` goes from 57 s to about 150 s, and the job from 2m12 to about 3.5–4 min. T4 records the real figures (P6) with `gh api …/actions/jobs/<id>`.
- If it proves too slow, `--targets` makes a leg split a YAML-only change.

### A6.8 Every other entry point

| Entry point                                        | Change                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `examples-transpile.test.ts:72`                    | `target: FixtureTargets.primaryFor(source)`: the pragma, else `host`. No example source is edited for this test (this answers critic finding A9).                                                                                                                                            |
| cli smoke (`pr-checks.yml:492-501`, `gate.sh:108`) | `examples/teensy4/blink.cnx` gains `#pragma target teensy41`. The committed `blink.c` is byte-identical under that target (critic `crit/t4`), so it is not regenerated.                                                                                                                      |
| nucleo example                                     | `blink.c` and `blink.h` are regenerated in T2a (S27). No gate compares committed `examples/**/*.c` with fresh output; that gap is filed.                                                                                                                                                     |
| DualCodePaths                                      | Its programs include only `.cnx` files, so nothing goes red. It gains the chain case: `main → helper.cnx → x.h` with no target gives E0510 at the same position in both modes (M37).                                                                                                         |
| test:cli                                           | The 4 red tests pass `--target host`. New cases: no target plus a header exits 1 with a positioned E0510; `--target bogus` plus a header gives E0510 naming `bogus`; a `platformio.ini` with `board=teensy41` prints `Target: teensy41 (platformio)`; the template text contains `--target`. |
| Unit tests                                         | Each `new Transpiler` whose program reaches a header passes `target: "host"`. The population is whatever T3's `npm run unit` reports red, which is 34 in 6 files at head3 placement; it is recorded.                                                                                         |
| PlatformIO                                         | `PlatformIOIni`/`fromPlatformIO` unit rows: a key board, `atmelavr`, an unknown board, `default_envs`, envs that disagree, no file. The `lib_extra_dirs` tests are unchanged. `tests/platformio-detect/auto-detect` drops its pragma and becomes `// test-no-target`.                        |
| VS Code (serve, `ServeCommand.ts:249-256`)         | No code change beyond §A5.3's search start. E0510 arrives as a positioned diagnostic. `parseWithSymbols` and `parseCHeader` (`src/lib/`) type nothing and need no target.                                                                                                                    |
| `validate:c`, `headers:standalone:check`           | Host-only, unchanged. That MISRA runs for the host platform only is filed.                                                                                                                                                                                                                   |

---

## A7. Forecast (added to §6; B19 and S18 are deleted)

| #   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | At HEAD's reach                                                                                    | Commit               | Re-measured by                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------- |
| B27 | E0810 on a suffixed literal of the other category (both orders)                                                                                                                                                                                                                                                                                                                                                                                                                | probes red; corpus 0                                                                               | C4b                  | P4                                                                        |
| B28 | E0869 on a lone suffixed literal                                                                                                                                                                                                                                                                                                                                                                                                                                               | probe; corpus 0                                                                                    | C4c                  | P4                                                                        |
| B29 | E0810 on ternary value arms                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 4 hits, 0 duplicates; corpus 0 (36 ternary fixtures)                                               | C4d                  | P4                                                                        |
| B30 | E0810 on C/C++ integer operands                                                                                                                                                                                                                                                                                                                                                                                                                                                | 3 hits; corpus 0 under both models                                                                 | C4b                  | P4 plus the matrix equality check                                         |
| B31 | E0805, E0806/E0807, E0850 and E0868/E0869 (including casts) read C/C++ integers                                                                                                                                                                                                                                                                                                                                                                                                | corpus 0                                                                                           | C4b/C4c              | P4 per analyzer group                                                     |
| B32 | E0510                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 176–181 fixtures (each given a target by the harness), 34 unit tests, 4 test:cli tests, 6 examples | T3                   | M42 count, unit and CLI lists recorded                                    |
| B33 | Files naming different targets are rejected (open question 1)                                                                                                                                                                                                                                                                                                                                                                                                                  | 0 programs                                                                                         | T3                   | grep                                                                      |
| B34 | A diagnostic that depends on the target, in an unpinned fixture                                                                                                                                                                                                                                                                                                                                                                                                                | 0                                                                                                  | C4b on               | The equality check fails; the fixture is pinned or rewritten and listed   |
| S21 | Measured at C6c against §6's forecast of 0: **2 fixtures**, one cause. A call result is typed at the direct-type sites (the S2 fact reaching them). `func-return-member-cpp` gains the #304 `static_cast` on `getConfig().mode` that `c.mode` already had; `slice-call-no-citation` writes a one-element slice of a call directly rather than binding it to a temp as if composite. A multi-element slice binds a temp whatever the source, so a call is still evaluated once  | 2 fixtures                                                                                         | C6c                  | `test:q`; `PlanTyping.test` "a call is its return type", mutation-checked |
| S25 | Measured at C6d: **0 corpus fixtures**, as forecast; the new `c-integers/subscript` fixture is the change. The corpus could not see one regression the first cut made: a C++ `struct` with its own `operator[]` is typed as a named scalar, so its subscript became a bit read of a struct, which C++ rejects. Only a header's **integer** is subscripted as bits; any other header value is left to C and C++, which is what HEAD emitted. Fixture `c-integers/subscript-cpp` | 0 corpus fixtures                                                                                  | C6d                  | `test:q`; `OperandTyper.test` S25 rows                                    |
| S23 | A composite counts foreign integer leaves at their model width (`b + cU32` becomes `_u32`)                                                                                                                                                                                                                                                                                                                                                                                     | 0 files                                                                                            | C6                   | P3 hunk class                                                             |
| S24 | A foreign integer of unknown width vetoes the helper and gives native C                                                                                                                                                                                                                                                                                                                                                                                                        | 0                                                                                                  | C6                   | P3                                                                        |
| S25 | A subscript on a C scalar integer becomes a bit read; arrays and pointers stay element access                                                                                                                                                                                                                                                                                                                                                                                  | 0 fixtures                                                                                         | C6 (2.1 part in C4b) | P3/P4                                                                     |
| S26 | A helper file inherits the program's single target                                                                                                                                                                                                                                                                                                                                                                                                                             | 0                                                                                                  | T2a                  | P3                                                                        |
| S27 | `examples/nucleo-f446re/blink.{c,h}` go from PRIMASK to LDREX                                                                                                                                                                                                                                                                                                                                                                                                                  | examples only                                                                                      | T2a                  | diff                                                                      |
| S28 | Marker lines: `auto-detect` (4 snapshots) and 34 xfail fixtures                                                                                                                                                                                                                                                                                                                                                                                                                | marker or comment lines only                                                                       | T3/T4                | P3 classifier                                                             |

---

## A8. Commit sequence (the whole PR)

- **"Byte-identical"** means `npm test` leaves `git status tests/` empty.
- **Every commit** passes `npm run build && npm run unit && npm run test:q`. From T4 on, `test:q` runs the matrix.
- **Generated documents** are regenerated in the commit that changes their input.
- **Before the push**, `npm run test:gate` runs alone, from a committed tree.

| #   | Commit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Snapshot delta                                                                | Reviewer checks                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| P0  | Not a commit. File §A12. Comment §A1 on #1668, with commands. Cite #1147 for row B. The approved P0 applies, less C09 (now fixed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                                             | The issues exist; the numbers are posted.                                                             |
| T0  | `docs(#1668)`: ADR-024 records R2–R5, and passes the rewrite test. It says: an **unsuffixed** literal is exempt (`:205`); a suffixed literal has its suffix's category and width; the conditional's two value operands are Rule 10.4 operands and its condition is not; a header integer's category comes from its C type and its width from the target platform's data model (the three model families; the fixed-width standard types are fixed); a program that reaches a C/C++ header must name a known target, or it is rejected; an unknown name is not a target; E0510 declares no matrix cell. | —                                                                             | `adr:independence:check`, prettier                                                                    |
| T1  | `refactor(#1668)`: one project-root finder (§A5.3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Byte-identical                                                                | The moved `determineProjectRoot.test.ts` cases pass; the marker list from §A1                         |
| T2a | `feat(#1668)`: `ICDataModel` and `TRunTarget`; table fields and rows (host, stm32f4); `declaredTarget`; `Program.target()`; the new `forRun`; codegen and Rule 5.1 read it; `pragmaTargets`, `resolveTargetCapabilities`, the narrowest loop and `ICodeGeneratorOptions.target` are deleted; the ArgParser list is derived; the `Target:` line; the `TargetResolver.test.ts:88-96` cases are rewritten                                                                                                                                                                                                 | Fixtures byte-identical; S27; fixture `program-pragma/` (S26), seen red first | depcruise, knip (deleted members), `docs:throw-citations`, M49, M52                                   |
| T2b | `feat(#1668)`: `PlatformIOIni` (with the `lib_extra_dirs` move), `fromPlatformIO`, the template, `docs/platformio-integration.md`                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Byte-identical                                                                | Unit rows (§A6.8)                                                                                     |
| T3  | `feat(#1668)`: E0510: `firstForeignInclude`, the walker reach, Stage 3b; the `test-no-target` marker, with the harness passing `--target host` or the pin (the single-target precursor); every §A6.8 entry point given a target; the teensy pragma; the auto-detect conversion; the E0510 fixtures written **first** and seen failing; the error-codes row; `diagnostics:manifest`; the test:cli and DualCodePaths cases                                                                                                                                                                               | S28 (auto-detect); new fixtures                                               | M36–M40, M42, M53; `error-codes:check`, `diagnostics:manifest:check`; the unit and CLI lists recorded |
| T4  | `test(#1668)`: the matrix: `FixtureTargets` in its 5 callers, cross runs, the equality assertion, `cross-libc/`, the `-Werror` trio, the startup probe, reporting, `--targets`, `test-target-xfail` with 34 markers, the 6 helper headers, the CI guard and warm `--targets host`, `gate.sh`, `TargetMatrix.test.ts`, `docs/TESTING-WORKFLOW.md`                                                                                                                                                                                                                                                       | S28 (34 fixtures, marker lines only); byte-identical otherwise                | Per-target counts in the PR body; M41, M43–M48; P6 runtime                                            |
| C1  | As approved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Byte-identical                                                                | As approved                                                                                           |
| C2  | As approved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Byte-identical                                                                | As approved                                                                                           |
| C3  | As approved, **plus** R2 literal facts, the §A4 table in `ForeignTypeFacts.operandType(…, model)`, and the typer reading `program.target()`                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Byte-identical (asserted)                                                     | A unit row for every §A4 spelling × 3 models, and with `model = null`; M34                            |
| C4a | As approved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | P4 = B1, B21                                                                  | As approved                                                                                           |
| C4b | As approved, **plus** the E0810 policy from R2 and R4, and the 2.1 part of S25                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | P4 = B2–B5, B10–B17, B27, B30, B31 (E0810 part)                               | Each new diagnostic has a fixture and a control; M30, M33, M33b, M50, M51                             |
| C4c | As approved, **plus** B28 and the rest of B31, by analyzer group                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | P4 = B6, B7, B9, B20, B22–B25, B28, B31                                       | As C4b                                                                                                |
| C4d | `feat(#1668)`: E0810 compares a ternary's value arms (R3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | P4 = B29                                                                      | M32, M32b, M32c                                                                                       |
| C5  | As approved                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | S1                                                                            | As approved                                                                                           |
| C6  | As approved, **plus** `CompositeType` counts foreign integers and vetoes an unknown width; S18 removed from its list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | S2–S8, S10, S11, S15, S19–S22, S23–S25                                        | M31, M35                                                                                              |
| C7  | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | Any equality failure is a defect in that commit                                                       |
| C8  | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | As C7                                                                                                 |
| C9  | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | As C7                                                                                                 |
| C10 | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | As C7                                                                                                 |
| C11 | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | As C7                                                                                                 |
| C12 | As approved, run under the matrix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | As approved                                                                   | As C7                                                                                                 |
| C13 | As approved, **plus** ADR-024 matrix cells for the new fixtures and `coverage:matrix`; CLAUDE.md rows listed for owner approval (the marker table gains `test-no-target` and `test-target-xfail`; Quick Reference gains `npm test -- --targets host`); cspell words (`nostdlibinc`, `thumbv`, `mmcu`, `atmega`, `newlib`, `xfail`, `LP64`, `ILP32`, `LLP64`)                                                                                                                                                                                                                                           | —                                                                             | `adr:independence:check`; every generated document current                                            |

**Why T0–T4 come before C1.** Every later P3 and P4 then runs under all three targets, and B34 is caught in the commit that introduces it.

**DoD.** No #1668 box names R2–R6. Their evidence is posted on #1668 per commit (SHA plus command), and no box is added or reworded.

---

## A9. Fixtures

- Each fixture fails at its parent, and that is recorded.
- Each rejection has a control beside it.
- ADR-024 fixtures carry `// test-adr: 024`.
- The E0510 fixtures do not carry it, because E0510 declares no cell.

| Directory / file                                                                             | Asserts                                                                                                                                                                                                                                                                                                                    | Control                                                                                           |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `bugs/issue-1668-suffixed-literals/category` (error)                                         | With `u32 a`, `a + 5i32` and `5i32 + a` are both E0810                                                                                                                                                                                                                                                                     | `i32 s + 5i32`; `a + 5`                                                                           |
| `…/narrowing` (error)                                                                        | `u8 <- 300u16`, `u8 <- 5u16` and `i32 <- 5u32` are E0869                                                                                                                                                                                                                                                                   | `u16 <- 300u16`; `u32 <- 5u16`                                                                    |
| `…/width` (execution)                                                                        | `b + 100u32 == 300` and `100u32 + b == 300`                                                                                                                                                                                                                                                                                | —                                                                                                 |
| `bugs/issue-1668-ternary-arms/arms` (error)                                                  | `r1`, `r2`, `r3` and `r9` are each reported once; `(c>0) ? (a+s) : a` is reported once, at `+`                                                                                                                                                                                                                             | `r4`, `r5`, `r6`, `r10`                                                                           |
| `…/cast-remedy` (execution)                                                                  | `(c>0) ? (f32)a : k` evaluates to 3.0                                                                                                                                                                                                                                                                                      | —                                                                                                 |
| `…/transitive` (error)                                                                       | The arms are declared two `.cnx` hops away                                                                                                                                                                                                                                                                                 | Arms of the same category                                                                         |
| `bugs/issue-1668-c-integers/width` + `c_int.h/.c` (execution)                                | `b + cU32 == 70200` (**red at HEAD**, **[ran]** `r4/q1`); `b + cU16`                                                                                                                                                                                                                                                       | `b + cs.n`                                                                                        |
| `…/category` (error)                                                                         | `a + cSigned` (an `int`), `a + cGetS()`, `a + cSensor` (through a typedef), `a + cs.v`; a copy inside a scope method                                                                                                                                                                                                       | `a + cU32`, `a + cChar`, `a + cColor`                                                             |
| `…/category-cpp` (`test-cpp-only`, error)                                                    | `a + ns::nsInt`; a global `std::int32_t`                                                                                                                                                                                                                                                                                   | `a + ns::nsU32`                                                                                   |
| `…/model-host` (`#pragma target host`, error)                                                | `u32 r <- a + cULong` is E0869 (u64 to u32)                                                                                                                                                                                                                                                                                | `u64 r2 <- a + cULong`                                                                            |
| `…/model-cortex` (`#pragma target cortex-m7`)                                                | The same source compiles to `cnx_clamp_add_u32`                                                                                                                                                                                                                                                                            | —                                                                                                 |
| `…/model-avr` (`#pragma target avr`)                                                         | `u16 a16 + cUInt` compiles to `cnx_clamp_add_u16`                                                                                                                                                                                                                                                                          | Its cortex twin: E0869 (u32 to u16)                                                               |
| `…/unknown-width` (execution)                                                                | `b + cFast` (`uint_fast16_t`, 1000) is 1200, native                                                                                                                                                                                                                                                                        | —                                                                                                 |
| `…/bool-char-enum` (error)                                                                   | `cBool + 1` is E0807                                                                                                                                                                                                                                                                                                       | `cChar` and `cColor` with `u32` are silent for E0810                                              |
| `…/subscript` (execution)                                                                    | `buf[3]` (`extern uint8_t buf[]`), `fixed[2]` and `ptr[1]` stay element access; `bool d <- word[4]` reads bit 4 (it fails to compile at HEAD)                                                                                                                                                                              | The element reads themselves                                                                      |
| `bugs/issue-1668-target-required/` (each `// test-no-target`)                                | `c-header` gives E0510 at the include; `unknown-pragma` gives E0510 at the pragma, naming it; `transitive/` (main to mid.cnx to leaf.cnx to x.h) gives E0510 at leaf's include; `conflicting-pragmas/` gives E0510 at the second pragma; `pio-ambiguous/` (its own ini, 2 envs, no default) gives E0510 naming both boards | `pure-cnx` (executes); `pragma` (compiles); `unknown-pragma-no-header` (compiles, with a warning) |
| `…/program-pragma/` (the entry is pinned `teensy41`; its helper has an atomic and no pragma) | The helper's snapshot has LDREX (S26)                                                                                                                                                                                                                                                                                      | —                                                                                                 |
| `tests/platformio-detect/auto-detect` (converted)                                            | The ini gives teensy41; the snapshot keeps LDREX                                                                                                                                                                                                                                                                           | —                                                                                                 |
| DualCodePaths chain case; the source-mode walker unit test                                   | The same E0510 position in both modes                                                                                                                                                                                                                                                                                      | —                                                                                                 |

---

## A10. Mutations (M30 onward), under the §8.3 protocol

| #    | Mutation                                                                                                   | Must redden                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| M30  | The typer gives suffixed literals category none                                                            | `suffixed-literals/category` (both orders), `narrowing`                           |
| M31  | `integerOf` skips suffixed literals                                                                        | `suffixed-literals/width` (the `_u8` path gives 255)                              |
| M32  | The ternary listener is removed                                                                            | `ternary-arms/arms`                                                               |
| M32b | The ternary check uses raw leaves                                                                          | `arms` (a duplicate at `(a+s)`)                                                   |
| M32c | M32, on the transitive fixture                                                                             | ADR-024 top-level function × imported transitive                                  |
| M33  | The typer uses 32 bits for `int` whatever the model                                                        | `model-avr`                                                                       |
| M33b | The typer uses 32 bits for `long`                                                                          | `model-host`                                                                      |
| M34  | The typedef walk runs before the name table                                                                | Unit row: `uint32_t` stays `u32` under LP64                                       |
| M35  | The unknown-width veto is dropped                                                                          | `unknown-width` (`_u8`)                                                           |
| M36  | Stage 3b is deleted                                                                                        | Every `target-required` rejection; the controls stay green                        |
| M37  | The walker reach is reverted                                                                               | The DualCodePaths chain case and the source-mode unit test                        |
| M38  | `fromPlatformIO` returns none                                                                              | `auto-detect` (PRIMASK) and the test:cli PlatformIO case                          |
| M39  | E0510 is anchored at 1:0                                                                                   | `transitive/`                                                                     |
| M40  | The harness passes `--target host` to a `test-no-target` fixture                                           | `c-header`                                                                        |
| M41  | The cross-target equality check is dropped. Planted, uncommitted probe: an unpinned copy of `atomic/basic` | The probe passes when it must fail                                                |
| M42  | The harness passes no `--target` at all                                                                    | Exactly the fixtures that reach a header, each with E0510 (the count is recorded) |
| M43  | `forRun` ignores the option                                                                                | Every cross run fails the `Target:` assertion                                     |
| M44  | The cross flags lose `-Werror=shift-count-overflow`                                                        | The 12 row-A fixtures, reported as stale xfail                                    |
| M45  | The xfail marker is removed from `bitmap/bitmap-32`                                                        | Its avr run: "shift count >= width of type"                                       |
| M46  | Pinned fixtures are expanded over the matrix                                                               | The pinned fixtures that the target-diff probe lists fail the equality check      |
| M47  | The avr row's `int` becomes 32                                                                             | The startup probe aborts                                                          |
| M48  | The host row's `long` becomes 32                                                                           | The startup probe aborts                                                          |
| M49  | A table row has no `dataModel`                                                                             | `npm run typecheck`                                                               |
| M50  | `dims:[""]` is treated as a scalar                                                                         | `subscript` (`buf[3]`)                                                            |
| M51  | A pointer spelling is typed as its pointee                                                                 | `subscript` (`ptr[1]`)                                                            |
| M52  | The helper uses its own pragma only                                                                        | `program-pragma` helper snapshot                                                  |
| M53  | The conflict check is dropped                                                                              | `conflicting-pragmas`                                                             |

---

## A11. Critic findings and their resolution

| Finding                                                                                                                                                                              | Resolution                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1 (per-file resolution means two ABIs), B1 (orchestrator field)                                                                                                                     | One `TRunTarget` on `Program`. `pragmaTargets` is removed (§A5.2).                                                                                                                                     |
| A2 (the compile check is too weak)                                                                                                                                                   | The `-Werror` trio (§A6.3); M44, M45.                                                                                                                                                                  |
| A3 (stubs shadow libc), A4 (packages absent), B3 (the shim hides real-libc behavior)                                                                                                 | The shim holds prototypes only; widths come from clang's own headers; the `<cstdint>` helpers are fixed; the stub ceiling is stated; F1 is filed from the real-libc run; real libc is open question 4. |
| A5 (runtime)                                                                                                                                                                         | One job; estimate recorded (P6); pinned fixtures run once.                                                                                                                                             |
| A6 (a duplicate `IIncludeContext` carrier)                                                                                                                                           | Not added; the check is Stage 3b.                                                                                                                                                                      |
| A7 (the ArgParser list is hand-edited), A8 (`ICodeGeneratorOptions.target` left dead)                                                                                                | Derived; replaced by `targetCapabilities`.                                                                                                                                                             |
| A9 (the generic examples get a Teensy pragma)                                                                                                                                        | Only `teensy4/blink` gets one; the others use `primaryFor`.                                                                                                                                            |
| A10 (R4 × #978 subscript)                                                                                                                                                            | S25, the `subscript` fixture, M50, M51.                                                                                                                                                                |
| A11 (enum and character categories)                                                                                                                                                  | Open question 2.                                                                                                                                                                                       |
| False claims in the typer-side draft: the `:147` pin; "one E0510 per program"; source mode; the serve root; regenerating `blink.c`; "T1 byte-identical"; the `directTypeName` reason | No edit needed; Stage 3b fires once; the walker reach; the search starts at `sourcePath`; `blink.c` is not regenerated; S26 and S27 are forecast; §A0.                                                 |
| B2 (the walker deepens #1435)                                                                                                                                                        | It reads a field the walker already computes; no new derivation.                                                                                                                                       |
| B4 (conflict is always E0510)                                                                                                                                                        | Open question 1 (default kept, 0 programs affected).                                                                                                                                                   |
| B5 (an unknown `--target` with a known pragma)                                                                                                                                       | The rung is skipped, as at HEAD; E0510 names it and is placed at the header.                                                                                                                           |
| B6 (`invariant` crashes)                                                                                                                                                             | A total answer (§A4).                                                                                                                                                                                  |
| B7 (3 missed test:cli tests; F5 duplicates #1147)                                                                                                                                    | Included; #1147 is cited.                                                                                                                                                                              |
| Target-side F7 (row D)                                                                                                                                                               | A relocated-tree artifact (**[ran]**, §A1). Dropped.                                                                                                                                                   |
| Target-side F11 (disputed)                                                                                                                                                           | Dropped. The scripts still get a target (§A6.1).                                                                                                                                                       |
| `cortex-m0+` cannot be named by pragma (`grammar/Cnx.g4:638-640`)                                                                                                                    | Filed. A fix is a grammar change, which needs the ADR process.                                                                                                                                         |
| ESP32 and PlatformIO `native` have no row                                                                                                                                            | Open question 5.                                                                                                                                                                                       |
| Multi-env PlatformIO projects                                                                                                                                                        | `default_envs` plus the template's `--target` (§A5.3).                                                                                                                                                 |
| Project-root finding is duplicated                                                                                                                                                   | T1.                                                                                                                                                                                                    |
| The preprocessor's toolchain is chosen independently of the target                                                                                                                   | Filed. An agreement assertion would fire on every cross run of the harness, which preprocesses with host gcc. The name-first rule makes the stdint names immune.                                       |
| Gates: `TargetResolver.test.ts:93`, cspell, the CLAUDE.md marker table                                                                                                               | T2a, C13, C13.                                                                                                                                                                                         |
| Two ADRs with different rules for a missing target                                                                                                                                   | Open question 1.                                                                                                                                                                                       |

---

## A12. Issues to file in P0

1. AVR: bit, bitmap and register masks are shifted 16 or more places on a 16-bit `unsigned int`. This is a miscompile (row A, 12 fixtures).
2. f64 bit indexing on a target whose `double` is 32 bits is not diagnosed at transpile time (row C, 4 fixtures).
3. `case -32768` is ill-formed C++ on a 16-bit `int` (row H).
4. C `int` interop widths are not checked on 16-bit-`int` targets: cjson, esp-idf-style, func-arg, issue-314, comprehensive-cpp (5 fixtures).
5. avr-libc hides `UINT*_MAX` from C++ unless `__STDC_LIMIT_MACROS` is defined, so generated C++ does not compile on Arduino-AVR (231 `.cpp` files, real-libc run).
6. ADR-049 disagrees with the code in five ways:
   - its precedence (`:522-528`) is not the code's;
   - it says a program with no target is an error (`:528`);
   - it says an unknown pragma name is an error (`:543`);
   - its `E0802` example (`:548`) collides with the registry's E0802 (`error-codes.md:217`);
   - it lists `atmega328p` and `arduino-uno` (`:491`, `:493`), which the table does not have.
7. `#pragma target cortex-m0+` is a parse error (`grammar/Cnx.g4:638-640`).
8. `cortex-m0+` claims LDREX, which ARMv6-M does not have (`TARGET_CAPABILITIES.ts:27`, ADR-049:486). `-c` fails with "Cannot select: intrinsic %llvm.arm.ldrex", and the CMSIS stub hides it.
9. Source mode never collects a header that is reached only through an included `.cnx`, which gives a false E0427. Related to #1435.
10. C bit-field members are not collected. C++ `using` aliases are recorded with a null target, and static class members are not collected (both under §10 R8).
11. The preprocessor's toolchain is chosen independently of the resolved target, so `#if`-selected typedefs follow the host model.
12. `validate:c` runs MISRA for the host platform only.
13. No gate compares committed `examples/**/*.c` with fresh output.

Row B cites the open #1147. The `word[4U]` miscompile and C09 are fixed in this PR (S25, B30).

---

## Open questions for the owner

1. **ADR-049 against R5.** ADR-049 (Implemented) says three things that differ from the code and this design:
   - its precedence is pragma, then CLI, then build system;
   - a program with no target is an error, whether or not it includes a header;
   - an unknown pragma name is an error.

   This design keeps the code's order (CLI beats pragma), rejects only programs that reach a C/C++ header (R5), and only warns about unknown names. It also rejects files that name _different_ targets in one program, which affects 0 programs today. Should ADR-049 be amended to match, or should the behavior follow ADR-049?

2. **Rule 10.4 categories for enum and character.** R4 gives header enums and `char` their categories. Today E0810 treats cnx's own enums and `char` as having no category: `u32 a + EColor c` compiles (**[ran]**). The default treats header enums and `char` the same way. Should _enum_ (and _character_) instead become E0810 categories, for both header and cnx types?
3. **The 34 fixtures that fail on AVR** (rows A, B, C, E–H, I). The default marks them `test-target-xfail: avr`, citing the filed issues and #1147; each still runs and must fail. The alternative is to fix rows A and H and #1147's AVR arm in this PR.
4. **Cross libc.** The default is prototype-only headers, which run today with no system change. The alternative is to install `libnewlib-dev` and `avr-libc` on the runner host and every developer machine. That is a system change, and it would also exercise real avr-libc behavior (issue 5 above).
5. **Targets with no row.** Should ESP32 (xtensa, ILP32, whose ESP-IDF projects work today through `CNX_CROSS_COMPILER`, `ToolchainDetector.ts:19-40`) and PlatformIO `platform = native` get table rows, and with what capabilities? Or should those users name `--target` themselves, and get E0510 until they do?
