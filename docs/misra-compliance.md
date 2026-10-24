# MISRA C:2012 Compliance in cnx

This document tracks cnx's compliance with MISRA C:2012 guidelines. MISRA C is a set of software development guidelines for the C programming language, widely used in safety-critical embedded systems.

## Status Legend

| Status           | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| **Enforced**     | Compiler produces an error if violated                          |
| **By Design**    | Language design makes violation impossible                      |
| **Partial**      | Some cases enforced, others not yet                             |
| **Planned**      | On roadmap for future implementation                            |
| **N/A**          | Rule not applicable to cnx                                      |
| **Not Enforced** | Currently not checked                                           |
| **Deviation**    | Documented deviation for a valid use, recorded where it applies |

<!-- BEGIN GENERATED: toolchain-guidelines -->

### Toolchain-derived guidelines

Generated from the transpiler's requirements registry by
`npm run docs:toolchain`. These rows state what generated output actually
contains, which is why they may read as deviations where a hand-written
assessment claimed N/A.

| guideline | bears on                                                        | emitted constructs                                                                                                                                                                                          |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1       | baseline, float bit indexing                                    | `stdint fixed-width types, // comments, mixed declarations`; `nullptr, static_cast, reinterpret_cast`; `_Static_assert`                                                                                     |
| 1.2       | interrupt masking, atomic read-modify-write, struct initializer | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))`; `__atomic_load(), __atomic_compare_exchange()`; `__atomic_load_N(), __atomic_compare_exchange_N() library calls`; `(T){ ... } in C++` |
| 20.8      | interrupt masking                                               | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))`; `noInterrupts()`; `SREG, cli()`                                                                                                       |
| 20.9      | interrupt masking                                               | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))`; `noInterrupts()`; `SREG, cli()`                                                                                                       |
| 20.14     | interrupt masking                                               | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))`; `noInterrupts()`; `SREG, cli()`                                                                                                       |
| 21.6      | overflow panic (--debug)                                        | `fprintf(stderr, ...), abort()`                                                                                                                                                                             |
| 21.8      | overflow panic (--debug)                                        | `fprintf(stderr, ...), abort()`                                                                                                                                                                             |
| Dir 4.3   | interrupt masking                                               | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))`                                                                                                                                        |
| Dir 4.9   | interrupt masking, atomic read-modify-write                     | `noInterrupts()`; `SREG, cli()`; `__LDREXB/H/W, __STREXB/H/W`                                                                                                                                               |

<!-- END GENERATED: toolchain-guidelines -->

<!-- BEGIN GENERATED: misra-summary -->

## Summary

| Category         | Enforced | By Design | Partial | Planned | N/A | Not Enforced | Deviation |
| ---------------- | -------- | --------- | ------- | ------- | --- | ------------ | --------- |
| Directives (1-4) | 1        | 8         | 1       | 0       | 1   | 1            | 1         |
| Rules 1-5        | 3        | 3         | 6       | 0       | 0   | 10           | 1         |
| Rules 6-10       | 4        | 13        | 9       | 0       | 0   | 7            | 0         |
| Rules 11-15      | 2        | 12        | 7       | 0       | 1   | 8            | 1         |
| Rules 16-22      | 6        | 26        | 6       | 0       | 1   | 17           | 1         |

Counted from the guideline tables below by `npm run docs:toolchain` (157 guidelines).

<!-- END GENERATED: misra-summary -->

---

## How violations are validated

`npm run validate:c` runs cppcheck's MISRA addon over every generated C test
file via `scripts/batch-validate.ts`. cppcheck emits all MISRA findings at
`style` severity, so the runner passes `--enable=style` — omitting it makes the
check a silent no-op (issue #1057).

The failure decision lives in `scripts/misra-baseline.ts`:

- **Generated-only**: cppcheck also flags transitively-included third-party libs
  and hand-written fixtures; only violations in cnx-generated output
  (`*.test.c` / generated `*.test.h`) count.
- **Per-rule baseline**: every rule that currently has generated violations is
  listed in `BASELINE`, each mapped to its tracking issue. Baselined rules do
  not fail the build, so the check is green today but fails
  on any **new** rule class. When a rule's issue is fixed, remove its entry from
  `BASELINE` to start enforcing it.

<!-- BEGIN GENERATED: misra-guards -->

### Regression guards

What fails if an **Enforced** or **By Design** row regresses, from
`scripts/misra-guards/MISRA_GUARDS.ts`. `npm run docs:misra-guards:check`
fails when such a row has no guard or names one that does not exist
(#1610). A row whose only guard is an issue has none yet.

| guideline | guards                                                                                               |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Dir 2.1   | `npm run test`                                                                                       |
| Dir 3.1   | none yet: #2312                                                                                      |
| Dir 4.1   | none yet: #2313                                                                                      |
| Dir 4.3   | none yet: #2314                                                                                      |
| Dir 4.6   | none yet: #2315                                                                                      |
| Dir 4.7   | E0901 fixture                                                                                        |
| Dir 4.8   | none yet: #2316                                                                                      |
| Dir 4.10  | none yet: #2317                                                                                      |
| Dir 4.12  | `validate:c` (cppcheck 21.3)                                                                         |
| 1.1       | none yet: #2318                                                                                      |
| 3.1       | `validate:c` (cppcheck 3.1)                                                                          |
| 3.2       | `validate:c` (cppcheck 3.2)                                                                          |
| 4.1       | `validate:c` (cppcheck 4.1)                                                                          |
| 4.2       | `validate:c` (cppcheck 4.2)                                                                          |
| 5.1       | `validate:c` (cppcheck 5.1); E0204 fixture                                                           |
| 6.1       | `validate:c` (cppcheck 6.1)                                                                          |
| 6.2       | `validate:c` (cppcheck 6.2)                                                                          |
| 7.1       | `validate:c` (cppcheck 7.1); E0912 fixture                                                           |
| 7.3       | `validate:c` (cppcheck 7.3)                                                                          |
| 8.1       | `validate:c` (cppcheck 8.1)                                                                          |
| 8.2       | `validate:c` (cppcheck 8.2)                                                                          |
| 8.3       | none yet: #2319                                                                                      |
| 8.4       | `validate:c` (cppcheck 8.4)                                                                          |
| 8.5       | `validate:c` (cppcheck 8.5)                                                                          |
| 8.6       | `validate:c` (cppcheck 8.6)                                                                          |
| 8.10      | `validate:c` (cppcheck 8.10)                                                                         |
| 8.13      | E0899 fixture                                                                                        |
| 8.14      | `validate:c` (cppcheck 8.14)                                                                         |
| 9.2       | `validate:c` (cppcheck 9.2)                                                                          |
| 9.3       | `validate:c` (cppcheck 9.3)                                                                          |
| 9.4       | `validate:c` (cppcheck 9.4)                                                                          |
| 9.5       | `validate:c` (cppcheck 9.5)                                                                          |
| 11.1      | `validate:c` (cppcheck 11.1)                                                                         |
| 11.2      | `validate:c` (cppcheck 11.2)                                                                         |
| 11.5      | `validate:c` (cppcheck 11.5)                                                                         |
| 11.6      | `validate:c` (cppcheck 11.6)                                                                         |
| 11.7      | `validate:c` (cppcheck 11.7)                                                                         |
| 11.8      | `validate:c` (cppcheck 11.8)                                                                         |
| 11.9      | `validate:c` (cppcheck 11.9); `validate:c` dump check; C++ compile `-Wzero-as-null-pointer-constant` |
| 12.3      | `validate:c` (cppcheck 12.3)                                                                         |
| 13.4      | `validate:c` (cppcheck 13.4)                                                                         |
| 13.5      | `validate:c` (cppcheck 13.5); E0702 fixture                                                          |
| 13.6      | `validate:c` (cppcheck 13.6); E0603 fixture                                                          |
| 15.1      | `validate:c` (cppcheck 15.1)                                                                         |
| 15.2      | `validate:c` (cppcheck 15.2)                                                                         |
| 15.3      | `validate:c` (cppcheck 15.3)                                                                         |
| 16.1      | `validate:c` (cppcheck 16.1)                                                                         |
| 16.2      | `validate:c` (cppcheck 16.2)                                                                         |
| 16.3      | `validate:c` (cppcheck 16.3)                                                                         |
| 16.4      | `validate:c` (cppcheck 16.4)                                                                         |
| 16.6      | `validate:c` (cppcheck 16.6); E0712 fixture                                                          |
| 16.7      | `validate:c` (cppcheck 16.7); E0711 fixture                                                          |
| 17.1      | `validate:c` (cppcheck 17.1)                                                                         |
| 17.3      | `validate:c` (cppcheck 17.3)                                                                         |
| 17.5      | none yet: #2320                                                                                      |
| 17.6      | `validate:c` (cppcheck 17.6)                                                                         |
| 17.7      | `validate:c` (cppcheck 17.7); E0708 fixture                                                          |
| 17.8      | `validate:c` (cppcheck 17.8)                                                                         |
| 18.1      | none yet: #2321                                                                                      |
| 18.2      | none yet: #2322                                                                                      |
| 18.3      | none yet: #2323                                                                                      |
| 18.5      | `validate:c` (cppcheck 18.5)                                                                         |
| 18.7      | `validate:c` (cppcheck 18.7)                                                                         |
| 18.8      | `validate:c` (cppcheck 18.8)                                                                         |
| 20.3      | `validate:c` (cppcheck 20.3)                                                                         |
| 20.5      | `validate:c` (cppcheck 20.5)                                                                         |
| 20.6      | E0501 fixture                                                                                        |
| 20.7      | `validate:c` (cppcheck 20.7); E0501 fixture                                                          |
| 20.8      | `validate:c` (cppcheck 20.8)                                                                         |
| 20.9      | `validate:c` (cppcheck 20.9)                                                                         |
| 20.10     | `validate:c` (cppcheck 20.10); E0502 fixture; E0501 fixture                                          |
| 20.11     | `validate:c` (cppcheck 20.11); E0501 fixture                                                         |
| 20.12     | `validate:c` (cppcheck 20.12); E0501 fixture                                                         |
| 20.13     | `validate:c` (cppcheck 20.13)                                                                        |
| 20.14     | `validate:c` (cppcheck 20.14)                                                                        |
| 21.3      | `validate:c` (cppcheck 21.3)                                                                         |
| 22.2      | `validate:c` (cppcheck 21.3)                                                                         |
| 22.5      | `validate:c` (cppcheck 22.5)                                                                         |

<!-- END GENERATED: misra-guards -->

---

## Directives

### Dir 1 - Implementation Compliance

| Rule    | Description                                         | Status | Reference                    |
| ------- | --------------------------------------------------- | ------ | ---------------------------- |
| Dir 1.1 | Implementation-defined behavior shall be documented | N/A    | cnx transpiles to standard C |

### Dir 2 - Compilation Units

| Rule    | Description                                   | Status        | Reference                          |
| ------- | --------------------------------------------- | ------------- | ---------------------------------- |
| Dir 2.1 | All source files shall compile without errors | **By Design** | Transpiler validates before output |

### Dir 3 - Run-time Failures

| Rule    | Description                        | Status        | Reference                          |
| ------- | ---------------------------------- | ------------- | ---------------------------------- |
| Dir 3.1 | Run-time errors shall be minimized | **By Design** | Static allocation, bounds checking |

### Dir 4 - Code Design

| Rule     | Description                                  | Status        | Reference                                                                                              |
| -------- | -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------ |
| Dir 4.1  | Run-time failures shall be minimized         | **By Design** | No dynamic allocation, type safety                                                                     |
| Dir 4.3  | Assembly shall be encapsulated               | **By Design** | Emitted ARM asm is encapsulated in `__cnx_*` wrappers; See "Toolchain-derived guidelines" above        |
| Dir 4.6  | typedefs for basic types should be used      | **By Design** | Fixed-width types (u8, i32, etc.)                                                                      |
| Dir 4.7  | Check return values of error-prone functions | **Enforced**  | E0901: NULL check required                                                                             |
| Dir 4.8  | Pointer members should be hidden             | **By Design** | No raw pointers                                                                                        |
| Dir 4.9  | Function-like macros should be avoided       | **Deviation** | Platform macros `cli()`, `noInterrupts()`, `__disable_irq()`; See "Toolchain-derived guidelines" above |
| Dir 4.10 | Precautions against multiple inclusion       | **By Design** | Module system handles this                                                                             |
| Dir 4.11 | Check validity of function parameters        | Partial       | Some validation, not comprehensive                                                                     |
| Dir 4.12 | Dynamic memory shall not be used             | **By Design** | ADR-003: Static allocation only                                                                        |
| Dir 4.13 | Resource lifetime management                 | Not Enforced  | A `c_` stream's `fclose` can be called twice: #2133                                                    |

---

## Rule 1 - Standard C Environment

| Rule | Description                                | Status        | Reference                                                                                    |
| ---- | ------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------- |
| 1.1  | Conform to C90/C99/C11                     | **By Design** | C99 baseline; C11 when `_Static_assert` is emitted; See "Toolchain-derived guidelines" above |
| 1.2  | Language extensions usage                  | **Deviation** | GNU inline asm and `__attribute__`; See "Toolchain-derived guidelines" above                 |
| 1.3  | No undefined/critical unspecified behavior | Partial       | Many cases prevented by design                                                               |

---

## Rule 2 - Unused Code

| Rule | Description                  | Status       | Reference                                                              |
| ---- | ---------------------------- | ------------ | ---------------------------------------------------------------------- |
| 2.1  | Unreachable code             | Not Enforced | Could add dead code detection                                          |
| 2.2  | No dead code                 | Not Enforced | Could add dead code detection                                          |
| 2.3  | Unused type declarations     | Not Enforced |                                                                        |
| 2.4  | Unused tag declarations      | Not Enforced |                                                                        |
| 2.5  | Unused macro declarations    | Not Enforced | ADR-037 flag defines pass through, and an unused one is reported: #863 |
| 2.6  | Unused function declarations | Not Enforced |                                                                        |
| 2.7  | Unused function parameters   | Not Enforced |                                                                        |

---

## Rule 3 - Comments

| Rule | Description                 | Status       | Reference                |
| ---- | --------------------------- | ------------ | ------------------------ |
| 3.1  | No nested /\* \*/ comments  | **Enforced** | ADR-043, test: misra-3-1 |
| 3.2  | No // or /\* in line splice | **Enforced** | ADR-043, test: misra-3-2 |

---

## Rule 4 - Character Sets

| Rule | Description                           | Status        | Reference                 |
| ---- | ------------------------------------- | ------------- | ------------------------- |
| 4.1  | Octal/hex escape sequences terminated | **By Design** | String literals validated |
| 4.2  | Trigraphs shall not be used           | **By Design** | Not supported in grammar  |

---

## Rule 5 - Identifiers

| Rule | Description                              | Status       | Reference                                                                                                                   |
| ---- | ---------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | External identifiers distinct (31 chars) | **Enforced** | E0204 — see below                                                                                                           |
| 5.2  | Identifiers in same scope distinct       | Partial      | #1341 — see below                                                                                                           |
| 5.3  | Identifier in inner scope no hide        | Partial      | Some shadowing detection                                                                                                    |
| 5.4  | Macro identifiers distinct               | Not Enforced | Include guards, register bindings and ADR-037 flag defines are macros; two include guards can agree in 63 characters: #1961 |
| 5.5  | Identifiers distinct from macros         | Not Enforced | A flag define may share a declaration's name, which then does not compile: #2127                                            |
| 5.6  | Unique typedef names                     | Partial      | #1341 — see below                                                                                                           |
| 5.7  | Unique tag names                         | Partial      | #1341 — see below                                                                                                           |
| 5.8  | Unique external identifiers              | Partial      | E0204 — see below; the clamp helpers' `a`/`b` parameters reuse a global's name: #2325                                       |
| 5.9  | Unique internal identifiers              | Not Enforced | #1338                                                                                                                       |

### Rule 5.1 and the cost of `Scope__member` (issue #1307)

Scope prefixing is not what _satisfies_ Rule 5.1 here — it is what puts the rule
at risk, and this table said the opposite until #1307.

C99 §5.2.4.1 guarantees only **31 significant initial characters** in an external
identifier. `Scope__member` spends that budget on the encoding rather than on the
author's names: the `__` separator costs two characters per level and the scope
name costs its full length. Two public members of a 27-character scope therefore
agree for 29 characters before their own names begin, and a conforming
implementation may treat them as one identifier:

```c
uint8_t TemperatureSensorController__calibrationOffsetValue = 1U;
uint8_t TemperatureSensorController__calibrationOffsetLimit = 2U;
/* first 31 characters of both: TemperatureSensorController__ca */
```

On a hosted GCC nothing happens, and `cppcheck --addon=misra` does not report it.
On the minimal embedded toolchain that is cnx's target audience the two
variables silently become one.

**E0204** rejects this at transpile time, against the budget recorded in
`ITargetCapabilities.significantExternalIdentifierChars` (31 by default) rather
than a hardcoded constant — the limit is a property of the C target, not of the
language. It applies only to identifiers cnx generates with external linkage:
`private` members are emitted `static` and get C99's 63-character internal budget
(Rule 5.9, not yet enforced — issue #1338), types name nothing the linker
resolves, and a C or C++ header's identifiers are not cnx's to rename.

### The same budget, still unenforced for types and statics

Rule 5.1 is the _external_ case. C99 §5.2.4.1 also caps **internal** identifiers at 63
significant characters, and `Scope__member` consumes that budget by the identical
mechanism. Two of the three classes are still open:

| Identifier class                        | Budget | Status            |
| --------------------------------------- | ------ | ----------------- |
| External variables and functions        | 31     | **E0204** (#1307) |
| `static` (private) variables, functions | 63     | Open — #1338      |
| Typedef names and struct tags           | 63     | Open — #1341      |

Rows 5.2, 5.6 and 5.7 previously read **By Design**, justified by "Scope prefixing" and
"Type system enforces". Both justifications are the one #1307 discredited for 5.1:
prefixing is what puts the budget at risk rather than what protects it, and the type
system enforcing uniqueness of _cnx_ names says nothing about whether the generated
names survive truncation. Two structs in a 52-character scope generate typedef names and
struct tags that are 94 characters and byte-identical for 63 — transpiling exit 0
(reproduction in #1341). Recorded here as `Partial` rather than satisfied.

---

## Rule 6 - Types

| Rule | Description                          | Status        | Reference                        |
| ---- | ------------------------------------ | ------------- | -------------------------------- |
| 6.1  | Bit-fields only on appropriate types | **By Design** | ADR-007: Type-aware bit indexing |
| 6.2  | Single-bit fields not signed         | **By Design** | Bit operations validated         |

---

## Rule 7 - Literals and Constants

| Rule | Description                    | Status        | Reference                                                                                     |
| ---- | ------------------------------ | ------------- | --------------------------------------------------------------------------------------------- |
| 7.1  | No octal constants             | **Enforced**  | E0912: cnx has no octal literal (ADR-044)                                                     |
| 7.2  | U suffix on unsigned constants | Partial       | Suffixes are generated, but not on every unsigned constant: #1062                             |
| 7.3  | Lowercase L not used in suffix | **By Design** | Generated code uses uppercase                                                                 |
| 7.4  | String literal not modified    | Not Enforced  | A writable `char[N]` initialized from a literal is reported; fix or deviation undecided: #844 |

---

## Rule 8 - Declarations and Definitions

| Rule | Description                                     | Status        | Reference                                                                                                                                                       |
| ---- | ----------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1  | Types explicitly stated                         | **By Design** | No implicit types                                                                                                                                               |
| 8.2  | Function types with prototypes                  | **By Design** | All functions have prototypes                                                                                                                                   |
| 8.3  | Compatible declarations                         | **By Design** | Single definition rule                                                                                                                                          |
| 8.4  | Compatible external declarations                | **Enforced**  | ADR-029 init functions are declared in the generating file's header (#1205); `validate:c` fails on a new undeclared external definition                         |
| 8.5  | External object/function one definition         | **By Design** | Issue #852: extern only in headers                                                                                                                              |
| 8.6  | Identifier with external linkage one definition | **By Design** |                                                                                                                                                                 |
| 8.7  | Functions/objects internal if possible          | Not Enforced  |                                                                                                                                                                 |
| 8.8  | Static for internal linkage                     | Partial       | ADR-038: static/extern                                                                                                                                          |
| 8.9  | Object at block scope if possible               | Not Enforced  |                                                                                                                                                                 |
| 8.10 | Inline functions internal linkage               | **By Design** | ADR-031                                                                                                                                                         |
| 8.11 | Array size explicit when extern                 | Partial       |                                                                                                                                                                 |
| 8.12 | Implicit enumerator values unique               | Not Enforced  |                                                                                                                                                                 |
| 8.13 | Pointer to const if not modified                | **By Design** | ADR-071: read-only by default, so an unwritten pointer is `const`; an unwritten `mut` is E0899 (a callback's `mut` parameters excepted, the typedef fixes them) |
| 8.14 | No restrict qualifier                           | **By Design** | Not in cnx                                                                                                                                                      |

---

## Rule 9 - Initialization

| Rule | Description                           | Status        | Reference                    |
| ---- | ------------------------------------- | ------------- | ---------------------------- |
| 9.1  | Auto variables initialized before use | Partial       | Some initialization tracking |
| 9.2  | Initializers in braces                | **By Design** | ADR-035: Array initializers  |
| 9.3  | No partial array initialization       | **Enforced**  | ADR-035                      |
| 9.4  | Element initialized once              | **By Design** | No designated initializers   |
| 9.5  | Array size matches initializer        | **Enforced**  | Array bounds validated       |

---

## Rule 10 - Essential Type Model

| Rule | Description                            | Status       | Reference                                                                                                                                                                 |
| ---- | -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.1 | Operands of appropriate essential type | Partial      | Each operator takes an allow-list of operand types (E0804, E0806, E0807, E0925; E0805 for signed shifts); an operand whose type cnx cannot read is left to the C compiler |
| 10.2 | Expressions of appropriate type        | Partial      |                                                                                                                                                                           |
| 10.3 | No narrowing without cast              | Partial      | E0403: Integer narrowing                                                                                                                                                  |
| 10.4 | Arithmetic on same essential type      | Partial      | E0810 (known gaps: #1092); generated C is still reported: #858                                                                                                            |
| 10.5 | No inappropriate cast                  | Partial      | ADR-024: Type casting                                                                                                                                                     |
| 10.6 | Composite assigned to wider type       | Not Enforced |                                                                                                                                                                           |
| 10.7 | Composite expressions type             | Not Enforced |                                                                                                                                                                           |
| 10.8 | Composite cast to wider type           | Not Enforced |                                                                                                                                                                           |

---

## Rule 11 - Pointer Type Conversions

| Rule | Description                            | Status        | Reference                                                                                                                                                                                                                                                                                                                           |
| ---- | -------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.1 | No function pointer conversion         | **By Design** | No raw pointers                                                                                                                                                                                                                                                                                                                     |
| 11.2 | No incomplete type pointer conversion  | **By Design** | No raw pointers                                                                                                                                                                                                                                                                                                                     |
| 11.3 | No cast between object pointer types   | **Deviation** | Signed 16/32-bit `atomic` LDREX/STREX loops pass the value's address as a pointer to its same-width unsigned type, at the `__LDREX*` and the `__STREX*`, because CMSIS takes an unsigned pointer (C11 6.5p7 defines the access); each loop's generated comment records it, and `i8` falls under the character-type exception: #2208 |
| 11.4 | No object pointer/integer conversion   | Not Enforced  | Register bindings convert an address to a `volatile` pointer; fix or deviation undecided: #867, #1413                                                                                                                                                                                                                               |
| 11.5 | No void\* to object pointer            | **By Design** | No void pointers                                                                                                                                                                                                                                                                                                                    |
| 11.6 | No pointer to void to arithmetic       | **By Design** | No void pointers                                                                                                                                                                                                                                                                                                                    |
| 11.7 | No cast between pointer and arithmetic | **By Design** | No raw pointers                                                                                                                                                                                                                                                                                                                     |
| 11.8 | No cast removing const/volatile        | **Enforced**  | Const-discard fixed with ADR-070 (#1259): the explicit `(void)` discard no longer hides a callee from modification tracking                                                                                                                                                                                                         |
| 11.9 | NULL for null pointer constant         | **By Design** | A scalar pointer zeroes to `NULL` in C and `nullptr` in C++; an array of pointers keeps `{0}` (ADR-015, #1610)                                                                                                                                                                                                                      |

---

## Rule 12 - Expressions

| Rule | Description                           | Status        | Reference                                                                                                                  |
| ---- | ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 12.1 | Explicit precedence with parentheses  | Not Enforced  | Could add warning                                                                                                          |
| 12.2 | Shift not exceeding bit width         | Partial       | E0873 checks the cnx operand's width; a generated shift of a narrow unsigned literal (`1U << 15`) is still reported: #1065 |
| 12.3 | No comma operator                     | **By Design** | Not in grammar                                                                                                             |
| 12.4 | Constant expressions no unsigned wrap | Partial       | E0910 in array dimensions and enum values (ADR-044); a binding's initializer (`u32 X <- 2 - 3`) wraps unchecked: #2145     |
| 12.5 | sizeof not on array parameters        | N/A           | No array decay                                                                                                             |

---

## Rule 13 - Side Effects

| Rule | Description                             | Status        | Reference                          |
| ---- | --------------------------------------- | ------------- | ---------------------------------- |
| 13.1 | Initializer lists no side effects       | Not Enforced  |                                    |
| 13.2 | Value of expression with side effects   | Not Enforced  |                                    |
| 13.3 | Full expression with increment          | Not Enforced  | Could add detection                |
| 13.4 | No assignment in condition              | **By Design** | ADR-001: `<-` vs `=`               |
| 13.5 | No function calls in boolean conditions | **Enforced**  | E0702 (Issue #254)                 |
| 13.6 | sizeof operand no side effects          | **By Design** | ADR-023: cnx has no sizeof (E0603) |

---

## Rule 14 - Control Statement Expressions

| Rule | Description                                | Status       | Reference                                                                                                                                                |
| ---- | ------------------------------------------ | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14.1 | Loop counter float                         | Not Enforced | A float loop counter transpiles (`while (temp < 100.0)`): #1071                                                                                          |
| 14.2 | For loop well-formed                       | Partial      | Some validation                                                                                                                                          |
| 14.3 | Controlling expression not invariant       | Partial      | E0707 forbids `for(;;)` and always-true literal loop conditions (ADR-068 / #1075); named-constant/non-literal invariants + always-false tracked in #1076 |
| 14.4 | Controlling expression essentially boolean | Partial      | E0701 on all five controlling expressions: `if`, `while`, `do-while`, `for` and the ternary (ADR-022)                                                    |

---

## Rule 15 - Control Flow

| Rule | Description                               | Status        | Reference                                                                                                                   |
| ---- | ----------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 15.1 | goto shall not be used                    | **By Design** | ADR-028: No goto                                                                                                            |
| 15.2 | goto only forward to same/enclosing block | **By Design** | No goto                                                                                                                     |
| 15.3 | goto in same function                     | **By Design** | No goto                                                                                                                     |
| 15.4 | One break/goto per loop                   | Partial       | break allowed, no goto                                                                                                      |
| 15.5 | Single exit point                         | Not Enforced  | Multiple returns allowed                                                                                                    |
| 15.6 | Compound statement for control            | Partial       | Program code: every body braced (grammar for `do`/`forever`, E0716 for `if`/`else`/`while`/`for`); generated helpers: #1774 |
| 15.7 | else required for if-else-if              | Not Enforced  |                                                                                                                             |

---

## Rule 16 - Switch Statements

| Rule | Description                    | Status        | Reference               |
| ---- | ------------------------------ | ------------- | ----------------------- |
| 16.1 | Switch well-formed             | **Enforced**  | ADR-025                 |
| 16.2 | Top-level switch label         | **By Design** | Grammar enforces        |
| 16.3 | Every switch clause terminated | **Enforced**  | ADR-025: No fallthrough |
| 16.4 | Every switch has default       | **Enforced**  | ADR-025                 |
| 16.5 | Default first or last          | Not Enforced  |                         |
| 16.6 | At least two switch clauses    | **Enforced**  | E0712 (ADR-025)         |
| 16.7 | Switch expression not boolean  | **Enforced**  | E0711 (ADR-025)         |

---

## Rule 17 - Functions

| Rule | Description                         | Status        | Reference                                                                                        |
| ---- | ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------ |
| 17.1 | No stdarg.h                         | **By Design** | No variadic functions                                                                            |
| 17.2 | No recursion                        | Partial       | E0423 (ADR-030); a call through the function's own callback type is not detected: #2131          |
| 17.3 | Function declared before use        | **By Design** | Module system                                                                                    |
| 17.4 | All exit paths return value         | Partial       | Some detection                                                                                   |
| 17.5 | Array parameter size                | **By Design** | Arrays have size info                                                                            |
| 17.6 | No `static` in array parameter `[]` | **By Design** | `[static N]` is never emitted                                                                    |
| 17.7 | Return value used or explicit void  | **Enforced**  | E0708 for author-written discards; transpiler-emitted lowering calls are `(void)`-cast (ADR-070) |
| 17.8 | Parameter not modified              | **By Design** | ADR-006: pass-by-value                                                                           |

---

## Rule 18 - Pointers and Arrays

| Rule | Description                   | Status        | Reference                                                                                                   |
| ---- | ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| 18.1 | Pointer arithmetic in bounds  | **By Design** | No pointer arithmetic in cnx source; premise under audit (see 18.4): #2134                                  |
| 18.2 | Subtraction on same array     | **By Design** | No pointer arithmetic in cnx source; premise under audit (see 18.4): #2134                                  |
| 18.3 | Relational on same object     | **By Design** | No pointer comparison                                                                                       |
| 18.4 | No +, -, += , -= on pointers  | Not Enforced  | Substring copies emit `source + offset` (ADR-045), and `+` on a `c_` pointer passes through (ADR-046): #859 |
| 18.5 | Max two levels of indirection | **By Design** | No raw pointers                                                                                             |
| 18.6 | No pointer to auto            | N/A           | No address-of operator                                                                                      |
| 18.7 | No flexible array members     | **By Design** | Not in grammar                                                                                              |
| 18.8 | No VLAs                       | **By Design** | Static allocation only                                                                                      |

---

## Rule 19 - Overlapping Storage

| Rule | Description                        | Status       | Reference                                                                     |
| ---- | ---------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| 19.1 | Object not assigned to overlapping | Partial      | Union restrictions                                                            |
| 19.2 | The union keyword not used         | Not Enforced | Float bit indexing (ADR-007) accesses a float's bits through a `union`: #1067 |

---

## Rule 20 - Preprocessing Directives

| Rule  | Description                                      | Status        | Reference                                                                                        |
| ----- | ------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| 20.1  | #include preceded only by directives or comments | Partial       | Includes follow the banner comment, but some (`<limits.h>`) are emitted after code: #1066        |
| 20.2  | No ' " \ in header names                         | Not Enforced  | `#include` names pass through unchecked: #2128                                                   |
| 20.3  | #include with <> or ""                           | **By Design** | All emitted includes use `<>` or `""`                                                            |
| 20.4  | No macro with keyword name                       | Not Enforced  | ADR-037 flag define names are unchecked: `#define const` is emitted (#2127)                      |
| 20.5  | No #undef                                        | **By Design** | `#undef` is not in the grammar                                                                   |
| 20.6  | No macro parameter in # or ##                    | **By Design** | No function-like macro is defined (E0501, ADR-037); this row's description is unverified: #2130  |
| 20.7  | Macro parameters in parentheses                  | **By Design** | No function-like macro is defined (E0501, ADR-037)                                               |
| 20.8  | #if conditions well-defined                      | **By Design** | IRQ wrapper arms use `defined(...)`; See "Toolchain-derived guidelines" above                    |
| 20.9  | All identifiers in #if defined                   | **By Design** | IRQ wrapper arms use `defined(...)`; See "Toolchain-derived guidelines" above                    |
| 20.10 | No # or ## operators                             | **By Design** | No emitted macro uses them; value and function-like macros are E0502 and E0501 (ADR-037)         |
| 20.11 | Macro parameter after # is not ##                | **By Design** | No function-like macro is defined (E0501, ADR-037)                                               |
| 20.12 | Macro parameter used once per ##                 | **By Design** | No function-like macro is defined (E0501, ADR-037)                                               |
| 20.13 | `#` line is a valid directive                    | **By Design** | An unrecognized directive is a syntax error                                                      |
| 20.14 | All #else/#elif after #if                        | **By Design** | IRQ wrapper `#if`/`#elif`/`#else` chain is well-formed; See "Toolchain-derived guidelines" above |

---

## Rule 21 - Standard Libraries

| Rule  | Description                      | Status        | Reference                                                                                                                                                  |
| ----- | -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21.1  | No #define/#undef reserved names | Not Enforced  | ADR-037 flag define names are unchecked: `#define _RESERVED` is emitted (#2127)                                                                            |
| 21.2  | No reserved identifiers          | Partial       | E0201 rejects `__`, but ADR-063 permits a leading underscore, so a file-scope `_Reserved` is emitted: #2129                                                |
| 21.3  | No stdlib memory functions       | **By Design** | ADR-003, ADR-101                                                                                                                                           |
| 21.4  | No setjmp.h                      | Not Enforced  | Callable through C library interop (`#include <setjmp.h>`): #2132                                                                                          |
| 21.5  | No signal.h                      | Not Enforced  | Callable through C library interop (`#include <signal.h>`): #2132                                                                                          |
| 21.6  | No stdio.h for input             | **Deviation** | Issue #850: Inline suppression for C interop                                                                                                               |
| 21.7  | No atof, atoi, atol, atoll       | Not Enforced  | Callable through C library interop (`#include <stdlib.h>`): #1069                                                                                          |
| 21.8  | No abort, exit, etc.             | Not Enforced  | Callable through C library interop (`#include <stdlib.h>`): #2132; the `--debug` overflow panic emits `abort()` (see "Toolchain-derived guidelines" above) |
| 21.9  | No bsearch, qsort                | Not Enforced  | Callable through C library interop with a comparator declared in a C header: #2132                                                                         |
| 21.10 | No time.h                        | Not Enforced  | Could restrict                                                                                                                                             |
| 21.11 | No tgmath.h                      | Not Enforced  | Reachable through C library interop (`#include <tgmath.h>`, a C99 header): #2132                                                                           |
| 21.12 | No fenv.h exception functions    | Not Enforced  |                                                                                                                                                            |

---

## Rule 22 - Resources

| Rule | Description                          | Status        | Reference                                                                                              |
| ---- | ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------ |
| 22.1 | Dynamically obtained resources freed | Partial       | E0902 rejects dynamic memory; a `FILE*` from `fopen` in a `c_` variable is not tracked: #2133          |
| 22.2 | Free only dynamic memory             | **By Design** | No free()                                                                                              |
| 22.3 | File opened once                     | Not Enforced  |                                                                                                        |
| 22.4 | Read-only file not written           | Not Enforced  |                                                                                                        |
| 22.5 | No dereference of a FILE pointer     | **By Design** | A `c_` variable can hold a `FILE*` (22.1, 22.6); whether one can be dereferenced is under audit: #2134 |
| 22.6 | FILE pointer valid                   | Not Enforced  | A `c_` stream can be used after `fclose`: #2133                                                        |

---

## Future Work

### High Priority

- **Rule 17.2**: Recursion through a callback of the function's own type (#2131)
- **Rule 2.1/2.2**: Dead code detection

### Medium Priority

- **Rule 12.1**: Precedence clarity warnings
- **Rule 15.7**: Require else in if-else-if chains

### Low Priority

- **Rule 5.9**: Internal identifier uniqueness
- **Rule 10.x**: Complete essential type model

---

## References

- [MISRA C:2012 Guidelines](https://www.misra.org.uk/misra-c/)
- [ADR Index](./decisions/)
- [cnx Error Codes](./error-codes.md)

---

_Based on MISRA C:2012 with Amendment 2_
