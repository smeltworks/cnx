# cnx Error Code Registry

This document is the authoritative registry of all cnx compiler error codes. When adding new error codes, assign the next available code in the appropriate range and update this document.

A row marked _(reserved)_ names a code that is spoken for but not yet implemented. It is
listed because "next available" is read from this table: a code reserved elsewhere and
recorded nowhere gets assigned a second time, and the collision is silent — the registry
is hand-maintained and has no gate, while `npm run diagnostics:manifest:check` only sees
codes that already have a fixture.

## Error Code Ranges

| Range     | Category                                                                                                                                                       | Count   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| E00xx     | Reserved/Test                                                                                                                                                  | 1       |
| E02xx     | Identifier/Param Naming                                                                                                                                        | 5       |
| E03xx     | Struct Fields/Init                                                                                                                                             | 6       |
| E04xx     | Symbol Resolution                                                                                                                                              | 16      |
| E05xx     | Include/Preprocessor                                                                                                                                           | 19      |
| E06xx     | Sizeof Expressions                                                                                                                                             | 3       |
| E07xx     | Control Flow                                                                                                                                                   | 15      |
| E08xx     | Arithmetic/Array Safety                                                                                                                                        | 61      |
| E09xx     | NULL Safety, Compile-Time Values, Literal Form, String Conversions, Interrupt Masking, `mut` Arguments, `for` Arrays, Config File Names, Environment Variables | 25      |
| **Total** |                                                                                                                                                                | **151** |

---

## E00xx — Reserved/Test

| Code  | Message            | Source                                                           |
| ----- | ------------------ | ---------------------------------------------------------------- |
| E0000 | Generic test error | `TRANSPILE/1-Analyze/types/__tests__/IBaseAnalysisError.test.ts` |

---

## E02xx — Identifier and Parameter Naming

| Code  | Message                                                                      | Help                                                              | Source                                            |
| ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| E0201 | Identifier ends with, or contains consecutive, underscores                   | Remove the trailing underscore, or collapse `__` to `_`           | `PARSE/2-Parse/IdentifierForm.ts`                 |
| E0202 | Identifier begins with the reserved prefix `cnx_`                            | Drop the reserved prefix                                          | `PARSE/2-Parse/IdentifierForm.ts`                 |
| E0203 | Two source files produce the same include guard                              | Rename one so the generated headers stay distinguishable          | `Transpiler.ts`                                   |
| E0204 | External identifiers not distinct within the target's significant characters | Shorten the scope name or the member names                        | `Transpiler.ts`, `PARSE/3-Declare/SymbolTable.ts` |
| E0227 | Parameter cannot start with function name prefix                             | Consider renaming to a name that doesn't start with function name | `TRANSPILE/1-Analyze/ParameterNamingAnalyzer.ts`  |

**Related:** ADR-063 and Issue #1117 (E0201); ADR-063 and Issues #1131/#1132 (E0202);
ADR-063 and Issues #1133/#1134 (E0203); ADR-063 and Issue #1307 (E0204); Issue #227 (E0227)

E0201 reserves `__` as the qualified-name separator so that `Scope__member` cannot
collide with a plain identifier. A **leading** underscore is legal — injectivity
constrains only the separator's left boundary. Checked on declarations only, so
references to C/C++ header symbols such as `__disable_irq()` are unaffected.

E0202 reserves the `cnx_` prefix, compared case-insensitively, for names the
transpiler generates — `cnx_tmp<N>`, `cnx_len_<var>`, `cnx_clamp_<op>_<type>` and
the `CNX_<PATH>_H` include guard. It is a different guarantee from E0201: `__`
says which components built a qualified name, while `cnx_` keeps the transpiler's
namespace and the user's disjoint. Prefix-only, so `my_cnx_buffer` is legal, and
declarations-only, so calling an external C symbol named `cnx_foo()` is fine.

E0204 is the same injectivity question asked against a **budget** rather than
against the whole string. E0201 makes the `Scope__member` join injective; C99
§5.2.4.1 then guarantees only 31 significant initial characters in an external
identifier, so a join that is injective can still land on one identifier once the
target truncates it. The `__` separator costs two characters per level and the
scope name costs its full length, so the budget is consumed by the encoding, not
by the author's naming (#1307). Reported against
the target description's `external_identifier_chars`, not a hardcoded 31 —
the limit belongs to the C target. Rule 5.1 is a whole-program property, and a
program has exactly one target (ADR-049), so the budget is that target's. Scoped to identifiers cnx generates with
external linkage: `private` members are `static` and get the 63-character
internal budget (#1338), types have no linkage, and a C/C++ header's identifiers
are not cnx's to rename. The message names `cnxScopedName` rather than the
generated identifier, per #1292.

E0203 fires when two files in one compilation map to the same include guard.
Guards are built from the project-relative path, and conversion to upper case
is lossy, so
`mod-a.cnx` and `mod_a.cnx` collide, as do filenames differing only by case.
ADR-063 diagnoses that residue rather than hashing or escape-encoding the path,
which would trade away the readability of the generated artifact. The requirement
is only that it is never silent: before this check the preprocessor skipped the
second header and the program ran with a wrong value.

---

## E03xx — Struct Fields and Initializers

| Code  | Message                                                                                                                                                                          | Help                                                                                                                                                                                                          | Source                                             |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| E0355 | Struct field uses a reserved property name                                                                                                                                       | Reserved names (e.g., `.length`). Use 'len', 'size', or 'count'                                                                                                                                               | `TRANSPILE/1-Analyze/StructFieldAnalyzer.ts`       |
| E0356 | _(retired)_ — was: redundant type in a struct initializer                                                                                                                        | Removed with the grammar alternative it rejected (#1322): `Point { x: 1 }` was never valid cnx, since every position that consumes a value already declares the type. It is a parse error now. Not reassigned | `TRANSPILE/1-Analyze/StructLiteralAnalyzer.ts`     |
| E0357 | A struct initializer with no written type, in a position that declares none                                                                                                      | Move it where a type is declared: a variable, an assignment target, a field, an argument, or a return                                                                                                         | `TRANSPILE/1-Analyze/StructLiteralAnalyzer.ts`     |
| E0358 | A struct initializer gives a value to a type that is not a struct (a primitive, a string, a bitmap, an enum, a function type, or a header's scalar, pointer or function pointer) | Give a value of the type itself; a bitmap's is its backing integer, set field by field after (ADR-034)                                                                                                        | `TRANSPILE/1-Analyze/StructLiteralAnalyzer.ts`     |
| E0359 | An array whose every element has a default (a callback array or an array of a struct with a default, ADR-029; an enum array, ADR-017) is sized by a value cnx cannot read        | cnx spells each element's default, so it needs the count: size it with a read-only cnx binding (`u32 N_HANDLERS <- 3;`)                                                                                       | `TRANSPILE/1-Analyze/ConstantDimensionAnalyzer.ts` |

---

## E04xx — Symbol Resolution / Initialization

| Code  | Message                                                                                                           | Help                                                                                             | Source                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| E0381 | Use of possibly/uninitialized variable                                                                            | Variable must be initialized before use                                                          | `TRANSPILE/1-Analyze/InitializationAnalyzer.ts`                                                   |
| E0422 | Function called before definition                                                                                 | Define function before calling it                                                                | `TRANSPILE/1-Analyze/FunctionCallAnalyzer.ts`                                                     |
| E0423 | Recursive function call (MISRA C:2012 Rule 17.2)                                                                  | Remove recursive call                                                                            | `TRANSPILE/1-Analyze/FunctionCallAnalyzer.ts`                                                     |
| E0424 | Unqualified enum member — did you mean `Enum.member`?                                                             | Use qualified enum member syntax                                                                 | `TRANSPILE/1-Analyze/BareEnumMemberAnalyzer.ts`, `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts` |
| E0425 | Symbol defined multiple times, or in multiple languages                                                           | Rename one definition                                                                            | `PARSE/3-Declare/SymbolTable.ts`, `Transpiler.ts`, `RedeclarationAnalyzer.ts` (a local, #2011)    |
| E0426 | Type is not defined -- nowhere, or not yet: this file defines it below the use, or the use is inside it (ADR-030) | Declare the type above its first use, or #include the file that does                             | `TRANSPILE/1-Analyze/UndeclaredTypeAnalyzer.ts`                                                   |
| E0427 | Identifier is not defined                                                                                         | Declare it, or #include the file that does                                                       | `TRANSPILE/1-Analyze/UndeclaredValueAnalyzer.ts`                                                  |
| E0428 | Value assigned to an enum is not of that enum type                                                                | Assign one of the enum's members, or convert explicitly with a cast                              | `TRANSPILE/1-Analyze/EnumTypeSafetyAnalyzer.ts`                                                   |
| E0429 | Name is a register, not a type                                                                                    | Access the register's members instead, e.g. `GPIO.DR`                                            | `TRANSPILE/1-Analyze/UndeclaredTypeAnalyzer.ts`                                                   |
| E0430 | Nested scopes are not allowed                                                                                     | Close the enclosing scope before declaring another, or use a flat scope such as `Hardware_GPIO`  | `PARSE/2-Parse/CnxSourceParser.ts`                                                                |
| E0431 | `this` used outside a `scope`, or `global` at file level (ADR-016)                                                | At file level write the bare name; in a function, `global.Name`; or move the code into its scope | `TRANSPILE/1-Analyze/ThisOutsideScopeAnalyzer.ts`                                                 |
| E0432 | C++ constructor argument is declared `mut`                                                                        | Remove `mut` from the argument; a constructor runs during static initialization                  | `TRANSPILE/1-Analyze/ConstructorArgumentAnalyzer.ts`                                              |
| E0433 | C++ constructor argument names nothing declared                                                                   | Declare it before the constructor, or pass a literal                                             | `TRANSPILE/1-Analyze/ConstructorArgumentAnalyzer.ts`                                              |
| E0434 | Comparison operands are not the same enum type                                                                    | Compare the enum with a member of the same enum, or cast explicitly                              | `TRANSPILE/1-Analyze/EnumTypeSafetyAnalyzer.ts`                                                   |
| E0435 | Scope's own member referenced through the scope's name (ADR-016)                                                  | Use `this.member` inside the scope; `global.Scope.member` is allowed when deliberate             | `TRANSPILE/1-Analyze/ScopeAccessAnalyzer.ts`                                                      |
| E0436 | Private scope member reached from outside its scope (ADR-016)                                                     | Mark the member `public`, or reach it through a public one                                       | `TRANSPILE/1-Analyze/ScopeAccessAnalyzer.ts`                                                      |
| E0437 | Global enum or register shadowed inside a scope and reached bare (ADR-016)                                        | Write `global.Name.member`; the bare name resolves to the shadow                                 | `TRANSPILE/1-Analyze/ScopeAccessAnalyzer.ts`                                                      |

**Related:** ADR-030 (E0422, E0423, E0426, E0427 — one define-before-use promise
enforced in the call, type and value positions; the ADR's `## Diagnostics` table
is where the promise is stated), ADR-016 (E0425 — a reopened scope composes, but
its members stay unique)

**E0429 (#1336)** is the type position's other answer: the name IS declared, as a
register, and a register is not a type. ADR-004 makes a register a binding to memory,
not a type name, so `Control c;` had no type behind it and the transpiler emitted C the
compiler rejects at exit 0. Reporting E0426 ("not defined") for a register declared a
few lines up would describe the transpiler rather than the source, which is why this is
its own code rather than a second message on E0426.

ADR-111 would make a register name a type. It is `Research`, and its own header states
that while it is Research "a register is still not a type", so ADR-004 governs and this
diagnostic is correct today. **When ADR-111 is implemented, E0429 is retired outright** —
`Control c(0x40000000)` becomes the instantiation form that ADR designs. Grep `ADR-111`
to find every site that has to change together.

**E0426/E0427 (#1312, #1353, #1398)** complete the set: an undeclared name is diagnosed
in a type position, a value position and a call position (E0422) rather than only the
last. The value position is both halves of it — a name READ and the same name WRITTEN
(#1582) — in all three of ADR-016's spellings, since `this.x` and `global.x` each state
which level to search and a name visible at one level is not thereby visible at another.
What is diagnosed is the name a spelling starts from; whether a member further along a
chain exists is a separate question neither code answers.
E0426's define-before-use half — a type used above its definition, or inside it — covers
every type spelling: bare `T`, `this.T`, `global.T` and `Scope.T` (#1332, #2339). Whether a
qualified spelling names a type at all is still checked for the bare spelling only (#1458),
so `global.Nope c;` is not yet diagnosed while `global.Config c;` above `Config` is E0426.
Both are reported only where the transpiler knows the file's whole name universe —
a file including an unparsed C/C++ header keeps the previous permissive behavior, because
rejecting a type the compiler will supply is a regression while failing to diagnose is
the status quo.

Both also answer per FILE, not per run (#1398). A value declared in a sibling this file
never included is undefined here, exactly as a type is — the value check reads the
include-filtered name set rather than the run-wide symbol table, which answers "declared
anywhere in this run" and so could never reject a sibling reference. E0426 had a per-file
view from the start and E0427 did not, which is why the type case was diagnosed and the
identical value case compiled to C that gcc rejects. What remains permissive is the
foreign-header case above: no edge connects a `.cnx` to the headers it includes, so
include-visibility is not derivable for a C or C++ name.

---

## E05xx — Include/Preprocessor

| Code  | Message                                                                                              | Help                                                                                                                                                                                                                                                                                                                                                                                        | Source                                                                                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0501 | Function-like macro not allowed                                                                      | Use inline functions instead                                                                                                                                                                                                                                                                                                                                                                | `TRANSPILE/1-Analyze/DefineDirectiveAnalyzer.ts`                                                                                                                    |
| E0502 | `#define` with value not allowed                                                                     | Use a read-only binding, `u32 NAME <- value;`                                                                                                                                                                                                                                                                                                                                               | `TRANSPILE/1-Analyze/DefineDirectiveAnalyzer.ts`                                                                                                                    |
| E0503 | Cannot `#include` implementation file                                                                | Only `.h` and `.hpp` files are allowed                                                                                                                                                                                                                                                                                                                                                      | `TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.ts`                                                                                                                   |
| E0504 | `.cnx` alternative exists for included header                                                        | Use `#include "file.cnx"` for the cnx version                                                                                                                                                                                                                                                                                                                                               | `TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.ts`                                                                                                                   |
| E0505 | _(retired)_ — was: header names a pointer typedef it cannot declare                                  | Reclassified as an internal invariant by #1322: for it to fire, a name would have to be in a header's external types and absent from the enumeration those types are collected by — a transpiler defect, not a program. Not reassigned                                                                                                                                                      | `TRANSPILE/3-Render/headers/BaseHeaderGenerator.ts`                                                                                                                 |
| E0506 | Included cnx file not found                                                                          | A quoted include resolves relative to the file it appears in; check the spelling                                                                                                                                                                                                                                                                                                            | `TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.ts`                                                                                                                   |
| E0507 | C++ header in a run that asks for C (`cppRequired: false`, `--no-cpp`)                               | Remove `cppRequired: false` so the mode is detected from the headers, set it to `true`, or pass `--cpp` (#1844)                                                                                                                                                                                                                                                                             | `PARSE/2-Parse/HeaderReading.ts`                                                                                                                                    |
| E0508 | C++ class with a constructor initialized outside a function body                                     | A class with a constructor is not an aggregate, so its fields are assigned one at a time, and a declaration outside a function body has no statement to assign them in                                                                                                                                                                                                                      | `TRANSPILE/1-Analyze/CppClassInitializerAnalyzer.ts`                                                                                                                |
| E0509 | Generated header names a cnx source that is not there                                                | A generated header records the source it was written from; check that source is present and reachable from the include path                                                                                                                                                                                                                                                                 | `PARSE/1-Discover/CppEntryPointScanner.ts`                                                                                                                          |
| E0510 | Not a known target                                                                                   | Name a target from the catalog, exactly as it is spelled there; `cnx --help` lists them (ADR-049)                                                                                                                                                                                                                                                                                           | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0511 | Target declarations in one program disagree                                                          | A program has one target: declare the same one in every file that declares one, or declare it once (ADR-049)                                                                                                                                                                                                                                                                                | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0512 | Unknown pragma                                                                                       | A pragma names the program's target: `target`, or a target description field (ADR-049)                                                                                                                                                                                                                                                                                                      | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0513 | Invalid value for a pragma key                                                                       | An integer field takes decimal digits from the schema's allowed values, a Boolean field takes `true` or `false`, and each key takes exactly one value (ADR-049)                                                                                                                                                                                                                             | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0514 | Incomplete target description                                                                        | An inline description gives every field, like a catalog row; the help lists what is missing (ADR-049)                                                                                                                                                                                                                                                                                       | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0515 | The program names no target                                                                          | Name one with `#pragma target <name>`, `--target <name>`, `"target"` in `cnx.config.json`, or a PlatformIO environment's board (ADR-049)                                                                                                                                                                                                                                                    | `PARSE/2-Parse/RunTarget.ts`                                                                                                                                        |
| E0516 | No C preprocessor to read the run's C headers                                                        | A run that includes C/C++ headers needs its target's own compiler (`gcc`, `avr-gcc`, `arm-none-eabi-gcc`), or one `CNX_CROSS_COMPILER` or `compile_commands.json` names that builds for the target: a header's language is judged on its preprocessed text (#1844)                                                                                                                          | `PARSE/2-Parse/HeaderReading.ts`                                                                                                                                    |
| E0517 | A header cannot be preprocessed, or a compiler the project names builds for another target           | Reported at the `.cnx` include that reached it, after the predecessor retry and the #985 translation-unit recovery both failed; the help is the preprocessor's own message. No header is read raw (#1844). Also when `CNX_CROSS_COMPILER` or `compile_commands.json` names a compiler whose data-model macros differ from the target's (#1542 ruling 10), at the run's first header include | `PARSE/2-Parse/HeaderReading.ts`                                                                                                                                    |
| E0518 | cnx source extension must be lowercase                                                               | Only `.cnx`, in lowercase, names cnx source (#1833 ruling); reported at the include, at a generated header's marker, or for the run's input at `1:0`, like E0510/E0511/E0515 (#1847)                                                                                                                                                                                                        | `TRANSPILE/1-Analyze/IncludeDirectiveAnalyzer.ts`, `PARSE/1-Discover/Discover.ts`, `PARSE/1-Discover/CppEntryPointScanner.ts`, `PARSE/1-Discover/InputExpansion.ts` |
| E0519 | _(retired)_ — was: the source extension from before the rename; _(reserved)_ so it is not reassigned | Retired by #2163, owner ruling of 2026-10-22: cnx recognizes no name it had before the rename, so that extension is any other file's.                                                                                                                                                                                                                                                       | `utils/CnxSourcePath.ts`                                                                                                                                            |

---

## E06xx — Sizeof Expressions (ADR-023)

| Code  | Message                                                                | Help                                                                                                                                                                                                      | Source                                  |
| ----- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| E0601 | _(retired)_ — was: `sizeof()` on an array parameter measures a pointer | Retired by #1975: cnx has no `sizeof` (E0603), and `.type_byte_length` of an array parameter is the array's. Not reassigned                                                                               | `TRANSPILE/1-Analyze/SizeofAnalyzer.ts` |
| E0602 | _(retired)_ — was: `sizeof()` operand must not have side effects       | Retired by #1975: cnx has no `sizeof` (E0603), and a length property reads no value, so it has no operand to evaluate. Not reassigned                                                                     | `TRANSPILE/1-Analyze/SizeofAnalyzer.ts` |
| E0603 | cnx has no 'sizeof'                                                    | Name the length you mean (ADR-058): `.memory_byte_length` is C's layout, padding included (`Point.memory_byte_length`); `.type_byte_length` is the logical size, fields summed (`Point.type_byte_length`) | `TRANSPILE/1-Analyze/SizeofAnalyzer.ts` |

---

## E07xx — Control Flow Validation

| Code  | Message                                                                                                             | Help                                                                          | Source                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| E0701 | Condition must be a boolean expression                                                                              | Use explicit comparison: `expr > 0` or `expr != 0`                            | `TRANSPILE/1-Analyze/ControllingExpressionAnalyzer.ts` |
| E0702 | Function call in condition not allowed                                                                              | Store function result in a variable first                                     | `TRANSPILE/1-Analyze/ControllingExpressionAnalyzer.ts` |
| E0703 | `break`/`continue` not supported                                                                                    | Use structured conditions instead                                             | `TRANSPILE/1-Analyze/LoopAnalyzer.ts`                  |
| E0704 | Non-void function must return on all paths                                                                          | Add an explicit `return <value>;` so every path returns a value               | `TRANSPILE/1-Analyze/ReturnPathAnalyzer.ts`            |
| E0705 | `forever` loop in non-void function                                                                                 | Make the function return `void`, or use a `while` loop with an exit condition | `TRANSPILE/1-Analyze/LoopAnalyzer.ts`                  |
| E0707 | Disguised infinite loop (`for(;;)` / always-true literal condition)                                                 | Write `forever { ... }` for an intentional infinite loop                      | `TRANSPILE/1-Analyze/LoopAnalyzer.ts`                  |
| E0708 | Return value of non-void function discarded                                                                         | Use the value, or discard it explicitly: `(void) f(...);`                     | `TRANSPILE/1-Analyze/ReturnValueUseAnalyzer.ts`        |
| E0710 | Nested ternary not allowed in a ternary's condition or branches                                                     | Use `if`/`else`, or lift the inner expression into a named variable first     | `TRANSPILE/1-Analyze/NestedTernaryAnalyzer.ts`         |
| E0711 | Switch on a `bool` (MISRA C:2012 Rule 16.7)                                                                         | Use `if`/`else`; a bool has two states and a switch implies more              | `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts`       |
| E0712 | Switch has fewer than two clauses (MISRA C:2012 Rule 16.6)                                                          | Use an `if` statement; a one-clause switch is an if written the long way      | `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts`       |
| E0713 | Duplicate case value in a switch                                                                                    | Remove one of them; the second is unreachable                                 | `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts`       |
| E0714 | Switch clauses do not account for the enum's variants exactly                                                       | Add the missing cases, or a `default(N)` stating how many variants it absorbs | `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts`       |
| E0715 | `for` header assignment that is more than one statement (slice, atomic, float bit), or a string copy (#2234)        | Assign before the loop, or at the end of its body as a `while` loop           | `TRANSPILE/1-Analyze/LoopAnalyzer.ts`                  |
| E0716 | An `if`, `else`, `while` or `for` body is not a braced block (MISRA C:2012 Rule 15.6)                               | Wrap the body in `{ }`; `else if` is the one unbraced `else` allowed          | `TRANSPILE/1-Analyze/BracedBodyAnalyzer.ts`            |
| E0717 | Case label is not a constant (a variable, a function, a scope, a type, a struct or bitmap field, or a string const) | Use a literal, an enum member or a const; compare a variable with `if`/`else` | `TRANSPILE/1-Analyze/SwitchStatementAnalyzer.ts`       |

**Related:** MISRA C:2012 Rule 14.4 (E0701), Rule 13.5 / Issue #254 (E0702), ADR-026 / Issue #1011 (E0703), ADR-067 / Issue #1040 (E0704), ADR-068 / Issue #1074 (E0705), ADR-068 / Issue #1075 (E0707; E0706 reserved for ADR-069 unreachable code; ADR-070 / Issue #847 (E0708); E0709 reserved for ADR-069 unused variable / Issue #1107; ADR-022 / Issue #1322 (E0710); ADR-068 / Issue #1647 (E0715); ADR-025 / Issue #2051 (E0717))

---

## E08xx — Arithmetic and Array Safety

### Division/Modulo (ADR-051)

| Code  | Message                                                                                      | Help                                                                                                                                 | Source                                          |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| E0800 | Division by a compile-time zero: a literal, const or constant expression, integer or float   | In a statement, use `safe_div(output, numerator, divisor, defaultValue)`; elsewhere a divisor known at compile time must not be zero | `TRANSPILE/1-Analyze/DivisionByZeroAnalyzer.ts` |
| E0801 | _(retired)_ — was: division by zero (const expression); _(reserved)_ so it is not reassigned | Folded into E0800 by #1268: ADR-051 §1 gives a literal, a const and a constant expression one message                                | `TRANSPILE/1-Analyze/DivisionByZeroAnalyzer.ts` |
| E0802 | Modulo by a compile-time zero: a literal, const or constant expression                       | In a statement, use `safe_mod(output, numerator, divisor, defaultValue)`; elsewhere a divisor known at compile time must not be zero | `TRANSPILE/1-Analyze/DivisionByZeroAnalyzer.ts` |
| E0803 | _(retired)_ — was: modulo by zero (const expression); _(reserved)_ so it is not reassigned   | Folded into E0802 by #1268: ADR-051 §1 gives a literal, a const and a constant expression one message                                | `TRANSPILE/1-Analyze/DivisionByZeroAnalyzer.ts` |
| E0804 | Modulo with floating-point type                                                              | Use `fmod()` from `<math.h>`                                                                                                         | `TRANSPILE/1-Analyze/FloatModuloAnalyzer.ts`    |

### Essential Type Safety (MISRA C:2012)

| Code  | Message                                                                                                                                                                                                                                                   | Help                                                                                                                                                  | Source                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| E0805 | Shift operator used on a signed integer type (MISRA C:2012 Rule 10.1)                                                                                                                                                                                     | Shift an unsigned value; signed shifts are UB / implementation-defined in C                                                                           | `TRANSPILE/1-Analyze/ShiftAnalyzer.ts`             |
| E0806 | Compound assignment used on a `bool` (MISRA C:2012 Rule 10.1)                                                                                                                                                                                             | Only `<-` is valid on a bool; flip a flag with `flag <- !flag`                                                                                        | `TRANSPILE/1-Analyze/BooleanOperandAnalyzer.ts`    |
| E0807 | Arithmetic, bitwise, shift or relational operator applied to a `bool` operand (MISRA C:2012 Rule 10.1)                                                                                                                                                    | A bool is not a number; combine flags with `&&` / `\|\|` / `!`, compare them with `=` / `!=`                                                          | `TRANSPILE/1-Analyze/BooleanOperandAnalyzer.ts`    |
| E0810 | Operands of different essential type categories: a binary operator's, or a conditional's two value arms (Rule 10.4)                                                                                                                                       | Integer and floating: cast the integer, e.g. `(f32)value`. Signed and unsigned: reinterpret one operand's bits with bit indexing, e.g. `value[0, 32]` | `TRANSPILE/1-Analyze/MixedTypeCategoryAnalyzer.ts` |
| E0811 | An integer operand combined by `+`, `-` or `*` with a header macro whose replacement is not a literal expression -- a call, a cast, a pointer dereference -- or, where the file's macros were not all read, with a name nothing declares (ADR-024, #1688) | Cast the macro to the type it has, e.g. `(u32)MACRO` or `(f32)MACRO`                                                                                  | `TRANSPILE/1-Analyze/MixedTypeCategoryAnalyzer.ts` |
| E0812 | An integer operand combined with such a header macro by `/`, `%`, a comparison, bitwise or shift operator, or in a conditional's value arms (ADR-024, #1688)                                                                                              | Cast the macro to the type it has, e.g. `(u32)MACRO` or `(f32)MACRO`                                                                                  | `TRANSPILE/1-Analyze/MixedTypeCategoryAnalyzer.ts` |

### Array Index Type Safety

| Code  | Message                                  | Help                                              | Source                                          |
| ----- | ---------------------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| E0850 | Signed integer used as subscript index   | Use unsigned integer type for array/bit subscript | `TRANSPILE/1-Analyze/ArrayIndexTypeAnalyzer.ts` |
| E0851 | Floating-point used as subscript index   | Use unsigned integer type for array/bit subscript | `TRANSPILE/1-Analyze/ArrayIndexTypeAnalyzer.ts` |
| E0852 | Non-integer type used as subscript index | Use unsigned integer type for array/bit subscript | `TRANSPILE/1-Analyze/ArrayIndexTypeAnalyzer.ts` |

### Critical Section Safety

| Code  | Message                                     | Help                                              | Source                              |
| ----- | ------------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| E0853 | Cannot use `return` inside critical section | Would leave interrupts disabled; restructure flow | `TRANSPILE/2-Plan/TypeValidator.ts` |

### Array Index Bounds (ADR-036; E0855 reserved for ADR-054)

| Code  | Message                                      | Help                                                        | Source                                            |
| ----- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| E0854 | Constant array index out of bounds (ADR-036) | The index is negative or not below the dimension it indexes | `TRANSPILE/1-Analyze/ArrayIndexBoundsAnalyzer.ts` |
| E0855 | Invalid overflow modifier in array dimension | Use `clamp`, `wrap`, or `discard`                           | Planned                                           |

### Subscript Depth (ADR-036 / ADR-007)

| Code  | Message                                                                                                                | Help                                                                                                                                                                                                                                                                                                                      | Source                                                                                                                                         |
| ----- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| E0856 | More subscripts than the base's shape allows                                                                           | One per array dimension plus one optional bit index (ADR-036/ADR-007)                                                                                                                                                                                                                                                     | `TRANSPILE/1-Analyze/BitAccessAnalyzer.ts`                                                                                                     |
| E0857 | Compound assignment on a target that is not a whole storage location                                                   | A compound operator reads, modifies and writes back one location; write the read and write separately                                                                                                                                                                                                                     | `TRANSPILE/1-Analyze/CompoundAssignmentAnalyzer.ts`                                                                                            |
| E0858 | Slice assignment target cannot be sliced (element type, dimensions, or size)                                           | Slice a one-dimensional integer or string buffer whose size folds at compile time                                                                                                                                                                                                                                         | `TRANSPILE/1-Analyze/SliceAssignmentAnalyzer.ts`                                                                                               |
| E0859 | Slice assignment offset or length is not a compile-time constant                                                       | Use a literal or a read-only binding; a runtime span cannot be bounds-checked                                                                                                                                                                                                                                             | `TRANSPILE/1-Analyze/SliceAssignmentAnalyzer.ts`                                                                                               |
| E0860 | Slice assignment span does not fit the buffer (bounds, alignment, or sign)                                             | Keep `offset + length / elementSize` within the capacity, and the length a positive multiple of the element size                                                                                                                                                                                                          | `TRANSPILE/1-Analyze/SliceAssignmentAnalyzer.ts`                                                                                               |
| E0861 | Slice assignment source does not fit the slice (type, width, or literal range)                                         | Assign an integer no wider than the slice, or widen the slice                                                                                                                                                                                                                                                             | `TRANSPILE/1-Analyze/SliceAssignmentAnalyzer.ts`                                                                                               |
| E0862 | String declaration does not state a capacity that can be determined                                                    | Write the capacity, e.g. `string<64>`; only a read-only binding with a literal can have one inferred, and `atomic` makes a binding writable (#2233)                                                                                                                                                                       | `PARSE/2-Parse/StringForm.ts`                                                                                                                  |
| E0863 | String, or a struct initializer's string field, at file scope is initialized by something other than a literal (#2236) | Move the declaration into a function, or initialize it empty and assign later                                                                                                                                                                                                                                             | `PARSE/2-Parse/StringForm.ts`, `TRANSPILE/1-Analyze/StringDeclarationAnalyzer.ts` (a field)                                                    |
| E0864 | Value does not fit the string capacity it is declared, assigned or passed into (#2191, #2239)                          | Widen the declaration, or shorten the value                                                                                                                                                                                                                                                                               | `TRANSPILE/1-Analyze/StringDeclarationAnalyzer.ts`                                                                                             |
| E0865 | Substring bounds exceed the source string                                                                              | Keep `start + length` within the source's capacity                                                                                                                                                                                                                                                                        | `TRANSPILE/1-Analyze/StringDeclarationAnalyzer.ts`                                                                                             |
| E0866 | Array initializer does not match the declaration, or a whole array is given a struct initializer (ADR-035)             | Give a bracketed list with one element per slot at every level, or the fill-all form                                                                                                                                                                                                                                      | `PARSE/2-Parse/ArrayForm.ts` (form), `TRANSPILE/1-Analyze/ArrayDeclarationAnalyzer.ts` (count), `TRANSPILE/1-Analyze/StructLiteralAnalyzer.ts` |
| E0867 | Length property not available on this type (ADR-058)                                                                   | `_element_count` needs an array or struct, `.memory_char_count` a string, `.value_*` a value (not a type, a signed integer's bits or a float's chars), `.memory_*` no bit-field, the `type_` lengths a sized type: not a pointer, a union, a bit-field or another header layout cnx cannot sum (ADR-058); never a literal | `TRANSPILE/1-Analyze/LengthPropertyAnalyzer.ts`                                                                                                |
| E0868 | Integer literal or known value does not fit the target type's range, or has bits outside its width (ADR-024)           | Widen the target type, or narrow the value; an unsigned type holds no negative                                                                                                                                                                                                                                            | `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts`                                                                                             |
| E0869 | Implicit narrowing or sign-changing integer conversion (ADR-024)                                                       | Use bit indexing to say which bits you mean, e.g. `value[0, 8]`                                                                                                                                                                                                                                                           | `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts`                                                                                             |

### Register Access Modifiers (ADR-004)

| Code  | Message                                                                                                                                                                                                    | Help                                                                                                | Source                                          |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| E0870 | Read of a write-only (`wo`) register member                                                                                                                                                                | A `wo` member returns nothing meaningful; read the register's readable member or keep a shadow copy | `TRANSPILE/1-Analyze/RegisterAccessAnalyzer.ts` |
| E0871 | Write to a read-only (`ro`) register member                                                                                                                                                                | An `ro` member is `const` hardware; write the register's writable member, or change the declaration | `TRANSPILE/1-Analyze/RegisterAccessAnalyzer.ts` |
| E0872 | Zero assigned to a bit, a bit range or a bitmap field of a write-1 (`wo`/`w1s`/`w1c`) register member (fixtures: `tests/adr-004/register-wo-set-false-error`, `tests/bugs/issue-2027-register-field-zero`) | Writing 0 to a write-1 register does not clear the bit; use the corresponding CLEAR register        | `TRANSPILE/1-Analyze/RegisterAccessAnalyzer.ts` |

Each subscript peels one array dimension (ADR-036) and a scalar integer/float may be
bit-indexed once (ADR-007), so `flags[4][3]` on a scalar `u8` indexes the single bit
`flags[4]` — a value that is not an array. Raised for every ADR-016 spelling of the
base: bare, `this.` and `global.`.

---

### Shift Range (MISRA C:2012 Rule 12.2)

| Code  | Message                                                                | Help                                                                                   | Source                                 |
| ----- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------- |
| E0873 | Shift amount is negative, or not below the shifted operand's bit width | Keep the amount in `0 .. width-1`; shifting by the width or more is undefined behavior | `TRANSPILE/1-Analyze/ShiftAnalyzer.ts` |

### Array Declarations (ADR-035 / ADR-036)

| Code  | Message                                                            | Help                                                                     | Source                       |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ | ---------------------------- |
| E0874 | C-style array declaration or parameter (dimensions after the name) | Put every dimension in the type: `u8[4] arr`, not `u8 arr[4]`            | `PARSE/2-Parse/ArrayForm.ts` |
| E0875 | Unbounded array parameter                                          | Write every dimension's size; the callee can trust only what is declared | `PARSE/2-Parse/ArrayForm.ts` |
| E0876 | Fill-all initializer on an array whose size is inferred            | An inferred size is counted from a list; write the dimension for `[v*]`  | `PARSE/2-Parse/ArrayForm.ts` |

### Read-Only Enforcement (ADR-071, was ADR-013)

| Code  | Message                                                          | Help                                                                                                           | Source                                           |
| ----- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| E0877 | _(retired)_ — was: assignment to a const binding                 | Folded into E0900 by #2103: ADR-071 gives every write to a binding not declared `mut` one code. Not reassigned | `TRANSPILE/1-Analyze/ConstAssignmentAnalyzer.ts` |
| E0878 | _(retired)_ — was: a const value passed to a non-const parameter | Folded into E0900 by #2103: passing a binding to a `mut` parameter writes it (ADR-071). Not reassigned         | `TRANSPILE/1-Analyze/ConstAssignmentAnalyzer.ts` |

### Callback Typing (ADR-029)

| Code  | Message                                                                         | Help                                                                                                                                                                                                | Source                                              |
| ----- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| E0879 | A function's declared signature does not match the callback type it is given to | Match the type exactly: return type, parameter count, and each parameter's type, `mut` and array-ness; against a C typedef, a parameter is `mut` exactly where its pointer is not `const` (ADR-071) | `TRANSPILE/1-Analyze/CallbackAssignmentAnalyzer.ts` |
| E0880 | A function that is itself a callback type given to a slot of another type       | Nominal typing: only a function that is not a type may stand in for one                                                                                                                             | `TRANSPILE/1-Analyze/CallbackAssignmentAnalyzer.ts` |

### Bitmap Access (ADR-034)

| Code  | Message                                                                             | Help                                                                  | Source                                        |
| ----- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------- |
| E0881 | A constant value, a const included, too wide for the bitmap field it is assigned to | Widen the field in the bitmap declaration, or write a value that fits | `TRANSPILE/1-Analyze/BitmapAccessAnalyzer.ts` |
| E0882 | A member the bitmap does not declare                                                | Use one of the bitmap's declared fields                               | `TRANSPILE/1-Analyze/BitmapAccessAnalyzer.ts` |
| E0883 | Bracket indexing on a bitmap                                                        | A bitmap is addressed by named field, not by bit index                | `TRANSPILE/1-Analyze/BitmapAccessAnalyzer.ts` |

### Safe Division Call Shape (ADR-051)

| Code  | Message                                                     | Help                                                                        | Source                                        |
| ----- | ----------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------- |
| E0884 | `safe_div`/`safe_mod` called with other than four arguments | Pass output, numerator, divisor and the value used when the divisor is zero | `TRANSPILE/1-Analyze/SafeDivisionAnalyzer.ts` |
| E0885 | The first argument is not a variable to receive the result  | The helper takes the output's address; declare a variable and pass it       | `TRANSPILE/1-Analyze/SafeDivisionAnalyzer.ts` |

### Value Properties (ADR-058 / ADR-045)

| Code  | Message                                                                                                    | Help                                                                                                           | Source                                          |
| ----- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| E0886 | `.length` is deprecated, and `.bit_length`, `.byte_length`, `.char_count` and `.element_count` are removed | Name the kind: `.value_char_count`, `.type_element_count`, `.type_bit_length` or `.type_byte_length` (ADR-058) | `TRANSPILE/1-Analyze/LengthPropertyAnalyzer.ts` |
| E0887 | `.capacity` or `.size` on something with no buffer                                                         | Both describe a string's buffer; use `.type_element_count` or `.type_byte_length`                              | `TRANSPILE/1-Analyze/LengthPropertyAnalyzer.ts` |

### Bit Access and Declaration Modifiers (ADR-007 / ADR-049)

| Code  | Message                                                           | Help                                                                  | Source                                               |
| ----- | ----------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| E0888 | A float bit range read at file scope                              | The union copy it lowers to is a statement; read it inside a function | `TRANSPILE/1-Analyze/BitAccessAnalyzer.ts`           |
| E0889 | Both `atomic` and `volatile` on one declaration                   | `atomic` already implies `volatile`; choose one                       | `TRANSPILE/1-Analyze/DeclarationModifierAnalyzer.ts` |
| E0890 | A read-modify-write target has a side effect                      | Store the index in a variable first; a bit write evaluates it twice   | `TRANSPILE/1-Analyze/BitAccessAnalyzer.ts`           |
| E0891 | Implicit conversion from a floating value to an integer (ADR-024) | Write the conversion as a cast, which saturates: `(u32)value`         | `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts`   |

### Array Size (ADR-035)

| Code  | Message                                                      | Help                                                                                                                           | Source                       |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| E0892 | Array dimension without a size, and nothing to count it from | Write the size; only a one-dimensional array initialized by a list (or, for `u8`, a string literal) may leave it out (ADR-035) | `PARSE/2-Parse/ArrayForm.ts` |

### Declared Type Shape (ADR-034 / ADR-017)

| Code  | Message                                                                                          | Help                                                                                            | Source                                            |
| ----- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| E0893 | A bitmap's field widths do not add up to its size                                                | Resize a field, or declare the bitmap with the size its fields add up to                        | `TRANSPILE/1-Analyze/TypeDeclarationAnalyzer.ts`  |
| E0894 | An enum member's value is negative                                                               | Use a non-negative value                                                                        | `TRANSPILE/1-Analyze/TypeDeclarationAnalyzer.ts`  |
| E0895 | An argument is not what a C pointer parameter points to, or is const and the parameter is not    | Pass an object of the pointed-to type, or an array of them; a const one needs a const parameter | `TRANSPILE/1-Analyze/CPointerArgumentAnalyzer.ts` |
| E0896 | Warning: cnx cannot see how a C function uses a pointer argument, so the call is not memory safe | Consider converting the C function to cnx                                                       | `TRANSPILE/1-Analyze/CPointerArgumentAnalyzer.ts` |

### Type Named as a Value (ADR-058)

| Code  | Message                                                                              | Help                                                                                                                 | Source                                         |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| E0897 | A type named where a value goes: a type answers only its length properties (ADR-058) | Ask the type a length property (`Point.type_byte_length`, `Point.x.type_bit_length`), or read a variable of the type | `TRANSPILE/1-Analyze/TypeNameValueAnalyzer.ts` |

### Read-Only Declarations (ADR-071)

| Code  | Message                                                                                                                                                                                                                                              | Help                                                                                                        | Source                                                                                              |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| E0898 | `const` written on a declaration: every binding is already read-only; on `atomic const`, a read-only `atomic` protects nothing; remove `atomic`                                                                                                      | Delete `const` (ADR-071); beside `atomic`, remove `atomic`, which a read-only value does not need (ADR-049) | `PARSE/2-Parse/MutabilityForm.ts`                                                                   |
| E0899 | A `mut` binding nothing writes (a parameter of a callback-type function, a global and a public scope member are exempt)                                                                                                                              | Remove `mut`, or `atomic` for an `atomic` binding (ADR-071, ADR-049)                                        | `TRANSPILE/1-Analyze/ConstAssignmentAnalyzer.ts`                                                    |
| E0900 | A write to a binding not declared `mut`: an assignment to or through it, a `safe_div`/`safe_mod` output, an argument to a `mut` cnx parameter or a C/C++ pointer or array parameter that is not const, or an opaque handle stored in a `mut` binding | Declare the binding `mut` (ADR-071)                                                                         | `TRANSPILE/1-Analyze/ConstAssignmentAnalyzer.ts`, `TRANSPILE/1-Analyze/CPointerArgumentAnalyzer.ts` |

## E09xx — NULL Safety (ADR-046)

| Code  | Message                                                | Help                                                      | Source                                        |
| ----- | ------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------- |
| E0901 | C library function can return NULL — must check result | Use: `if (func(...) != NULL) { ... }`                     | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0902 | Importing a dynamic memory function from C/C++         | Keep it in your C or C++ code (ADR-003)                   | `TRANSPILE/1-Analyze/FunctionCallAnalyzer.ts` |
| E0903 | NULL can only be used in comparison context            | Use: `if (func(...) != NULL)` or `== NULL`                | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0904 | Cannot store C function pointer return in variable     | Use direct comparison: `if (func(...) != NULL)`           | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0905 | Missing `c_` prefix for nullable C type                | Use: `TypeName c_varName <- func(...)`                    | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0906 | Invalid `c_` prefix on non-nullable type               | Remove `c_` — only for nullable C pointer types           | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0907 | NULL comparison on non-nullable variable               | Only `c_` variables can be compared to NULL               | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |
| E0908 | Nullable variable used without NULL check              | Check for NULL before use: `if (varName != NULL) { ... }` | `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`    |

## E0909-E0911 — Values Fixed at Compile Time (ADR-017, ADR-023, ADR-044)

| Code  | Message                                                                                                                    | Help                                                                                                                                                                                                    | Source                                                                                                                                                                                                       |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E0909 | An array dimension, an enum member's value or a value in a static-storage initializer (#1735) is not known at compile time | Build it from literals, read-only bindings that are not `volatile` (ADR-064), length properties (`.type_byte_length`) and casts; an enum member may also name the members of its enum declared above it | `TRANSPILE/1-Analyze/ConstantDimensionAnalyzer.ts`, `TRANSPILE/1-Analyze/TypeDeclarationAnalyzer.ts`, `TRANSPILE/1-Analyze/StaticInitializerAnalyzer.ts`                                                     |
| E0910 | A value fixed at compile time overflows the type its arithmetic happens at (ADR-044)                                       | Do the arithmetic at a width that holds the result, for example by casting the operands to a wider type                                                                                                 | `TRANSPILE/1-Analyze/ConstantDimensionAnalyzer.ts`, `TRANSPILE/1-Analyze/TypeDeclarationAnalyzer.ts`, `TRANSPILE/1-Analyze/StaticInitializerAnalyzer.ts`, `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts` |
| E0911 | An enum member's value does not fit `i32` (ADR-017)                                                                        | Use a value of at most 2147483647                                                                                                                                                                       | `TRANSPILE/1-Analyze/TypeDeclarationAnalyzer.ts`                                                                                                                                                             |

## E0912 — Integer Literal Form (ADR-044)

| Code  | Message                                                                                    | Help                                                                      | Source                                             |
| ----- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| E0912 | A decimal integer literal has a leading zero; cnx has no octal literal (ADR-044)           | Write the value in decimal without the leading zero, or as `0x…` or `0b…` | `PARSE/2-Parse/LiteralForm.ts`                     |
| E0913 | Array dimension is zero or negative (a literal, a folded const, or a header macro's value) | An array holds one element or more (C99 6.7.5.2, ADR-036)                 | `TRANSPILE/1-Analyze/ConstantDimensionAnalyzer.ts` |

## E0914 — A String Into a Scalar (ADR-024)

| Code  | Message                                                                                                                                                                           | Help                                                                                                          | Source                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| E0914 | A string value (a literal or a `string<N>`) lands in an integer, float, bool, enum or bitmap target -- as the value, the value it parenthesizes or a ternary arm (ADR-024, #1739) | A string lands only in a `string<N>` (ADR-045); a `u8` array may be initialized by a string literal (ADR-035) | `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts` |

## E0915 — An Argument a `mut` Parameter Cannot Write (ADR-006)

| Code  | Message                                                                                                                                                                                                                                                                                                                                                                       | Help                                                                                                                                                                  | Source                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| E0915 | An argument to a `mut` cnx parameter is not a variable -- a literal (number, string, struct or array), a call's, an operator's or a ternary's result, a cast, an enum member, a bit index or range, an ADR-058 length property, a function's name, or a header's `#define` or enum constant. A `#define` is rejected even when it expands to a variable, with its own message | A `mut` parameter writes its argument (ADR-006); assign the value to a `mut` variable and pass that. For a `#define`: pass the variable it names, or a `mut` variable | `TRANSPILE/1-Analyze/ConstAssignmentAnalyzer.ts` |

## E0916 — A Critical Section the Target Cannot Give (ADR-050)

| Code  | Message                                                                                                                                                         | Help                                                                                                                                                                                                                                                   | Source                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| E0916 | A `critical` block on a target where disabling interrupts does not shut out every other execution context (`interrupt_mask: false`: host, esp32) (#1789, #1147) | A critical block disables interrupts (ADR-050), which shuts out every other context only on a target whose description has interrupt_mask true. An atomic variable's read-modify-write needs no critical block; otherwise name a target that can mask. | `TRANSPILE/1-Analyze/CriticalSectionAnalyzer.ts` |

## E0917 — An Array or a String in a `for` Header (ADR-036)

| Code  | Message                                                                                                                                 | Help                                                                                                    | Source                                                                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| E0917 | A `for` header declares an array, in either spelling (`u8[3] v`, `u32 c[2]`) or through a header typedef (`Buf b`), or a string (#1823) | A for header declares one scalar loop variable (ADR-036); declare it before the loop and use it inside. | `PARSE/2-Parse/ArrayForm.ts`, `TRANSPILE/1-Analyze/ArrayDeclarationAnalyzer.ts` (a header typedef) |

## E0918 — A Config File Under an Old Name (#2165)

| Code  | Message                                                                                                      | Help                                                                                                                                      | Source                                |
| ----- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| E0918 | _(retired)_ — was: a config file under its name from before the rename; _(reserved)_ so it is not reassigned | Retired by #2163, owner ruling of 2026-10-22: cnx recognizes no name it had before the rename, so a file under that name is not a config. | `PARSE/1-Discover/ConfigFileNames.ts` |

## E0919 — `atomic` and `mut` on One Declaration (ADR-049)

| Code  | Message                                                       | Help                                                                                                                               | Source                                               |
| ----- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| E0919 | Cannot use both 'atomic' and 'mut' on one declaration (#2233) | `atomic` already makes the binding writable: only a value something writes needs a read or write that cannot be torn. Remove `mut` | `TRANSPILE/1-Analyze/DeclarationModifierAnalyzer.ts` |

## E0920 — A Constant Bit Index Past the Value's Width (ADR-007)

| Code  | Description                                                                                                                                                                                    | Help                                                                                              | Source                                     |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| E0920 | Bit index out of range in '<expr>': bit N (or a bit range that ends at bit N), but the value has W bits -- a constant index past its declared type's width, or a bitmap field's (#1808, #2251) | A bit index counts within the indexed value's own bits; index a wider value, or a bit that exists | `TRANSPILE/1-Analyze/BitAccessAnalyzer.ts` |

## E0921 — A Field of a Bitmap Array That Names No Element (ADR-034)

| Code  | Message                                                                                                        | Help                                  | Source                                        |
| ----- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| E0921 | A field of a bitmap array that does not name a whole element (`a.A` on `F[2]`, `g[1].A` on `F[2][2]`, ADR-034) | Index every dimension first: `a[i].A` | `TRANSPILE/1-Analyze/BitmapAccessAnalyzer.ts` |

## E0922 — A Substring With a Run-Time Length (ADR-045)

| Code  | Message                                                                                                                                   | Help                                                                                                                                        | Source                                             |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| E0922 | A substring's length is not a compile-time constant (`src[0, n]` with `n` known only at run time), wherever the substring is read (#2240) | Write the length as a literal or a constant, so the substring is known to fit what it is copied into; the start may be computed at run time | `TRANSPILE/1-Analyze/StringDeclarationAnalyzer.ts` |

## E0923 — Something Other Than a String Into a `string<N>` (ADR-045)

| Code  | Message                                                                                                                                                                                                                                                                                                                                                          | Help                                                                                                                              | Source                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| E0923 | A value that is not a string (an integer, a float or its bits, a bool, a char, an enum, a struct or an array that is not a C `char` array) lands in a `string<N>` -- as a declaration's initializer, an assignment's value or an argument, the value it parenthesizes or a ternary arm, but not a string array's list element, which is E0866's (ADR-045, #1634) | A `string<N>` holds only a string: a literal, another `string<N>`, a concatenation, a substring or a C string (`char*`, `char[]`) | `TRANSPILE/1-Analyze/IntegerConversionAnalyzer.ts` |

## E0924 — An Environment Variable Under an Old Name (#2166)

| Code  | Message                                                                                                                          | Help                                                                                                                                 | Source                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| E0924 | _(retired)_ — was: the environment sets the cross-compiler variable from before the rename; _(reserved)_ so it is not reassigned | Retired by #2163, owner ruling of 2026-10-22: cnx recognizes no name it had before the rename, so only `CNX_CROSS_COMPILER` is read. | `PARSE/1-Discover/CrossCompilerVariable.ts` |

---

## Adding New Error Codes

1. Choose the next available code in the appropriate range
2. Add the error to the source file with format: `E0XXX: message`
3. Update this document with the new code, message, help text, and source
4. If starting a new range, add a new section

**Source paths are relative to `src/`.**
