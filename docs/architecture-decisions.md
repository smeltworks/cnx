# Architecture Decision Records

This document lists all Architecture Decision Records (ADRs) for the cnx project.

ADRs are stored in [`docs/decisions/`](decisions/) and document significant design choices.
This page groups them **by status**; [`docs/decisions/README.md`](decisions/README.md) defines
how they are **numbered**.

An ADR's number band is the release it must ship in: `0xx` must all be implemented to cut v1
(so "Research (v1 Roadmap)" below holds `0xx` ADRs), and `1xx` must all be implemented to cut
v2 (so "Research (v2 Roadmap)" holds `1xx` ADRs).

## Implemented

| ADR                                                        | Title                      | Description                                                                      |
| ---------------------------------------------------------- | -------------------------- | -------------------------------------------------------------------------------- |
| [ADR-001](decisions/adr-001-assignment-operator.md)        | Assignment Operator        | `<-` for assignment, `=` for comparison                                          |
| [ADR-004](decisions/adr-004-register-bindings.md)          | Register Bindings          | Type-safe hardware access (ADR-111 supersedes on acceptance)                     |
| [ADR-007](decisions/adr-007-type-aware-bit-indexing.md)    | Type-Aware Bit Indexing    | Integers as bit arrays (`.length` superseded by ADR-058)                         |
| [ADR-010](decisions/adr-010-c-interoperability.md)         | C Interoperability         | Unified ANTLR parser architecture                                                |
| [ADR-014](decisions/adr-014-structs.md)                    | Structs                    | Data containers without methods                                                  |
| [ADR-016](decisions/adr-016-scope.md)                      | Scope                      | `this.`/`global.` explicit qualification                                         |
| [ADR-017](decisions/adr-017-enums.md)                      | Enums                      | Type-safe enums with C-style casting                                             |
| [ADR-030](decisions/adr-030-forward-declarations.md)       | Define-Before-Use          | Functions must be defined before called                                          |
| [ADR-037](decisions/adr-037-preprocessor.md)               | Preprocessor               | Flag-only defines, const for values                                              |
| [ADR-044](decisions/adr-044-primitive-types.md)            | Primitive Types            | Fixed-width types with `clamp`/`wrap` overflow                                   |
| [ADR-024](decisions/adr-024-type-casting.md)               | Type Casting               | Widening implicit, narrowing uses bit indexing                                   |
| [ADR-022](decisions/adr-022-conditional-expressions.md)    | Conditional Expressions    | Ternary with required parens, boolean condition, no nesting                      |
| [ADR-025](decisions/adr-025-switch-statements.md)          | Switch Statements          | Safe switch with braces, `\|\|` syntax, counted `default(n)`                     |
| [ADR-029](decisions/adr-029-function-pointers.md)          | Callbacks                  | Function-as-Type pattern with nominal typing                                     |
| [ADR-045](decisions/adr-045-string-type.md)                | Bounded Strings            | `string<N>` with compile-time safety                                             |
| [ADR-035](decisions/adr-035-array-initializers.md)         | Array Initializers         | `[1, 2, 3]` syntax with `[0*]` fill-all                                          |
| [ADR-036](decisions/adr-036-multidimensional-arrays.md)    | Multi-dim Arrays           | `arr[i][j]` with compile-time bounds enforcement                                 |
| [ADR-034](decisions/adr-034-bit-fields.md)                 | Bitmap Types               | `bitmap8`/`bitmap16`/`bitmap32` for portable bit-packed data                     |
| [ADR-049](decisions/adr-049-atomic-types.md)               | Atomic Types               | `atomic` keyword with LDREX/STREX or PRIMASK fallback                            |
| [ADR-050](decisions/adr-050-critical-sections.md)          | Critical Sections          | `critical { }` blocks with PRIMASK save/restore                                  |
| [ADR-057](decisions/adr-057-implicit-scope-resolution.md)  | Implicit Scope Resolution  | Bare identifiers resolve local -> scope -> global                                |
| [ADR-058](decisions/adr-058-explicit-length-properties.md) | Explicit Length Properties | `.type_bit_length`/`.type_byte_length`/`.type_element_count`/`.value_char_count` |
| [ADR-070](decisions/adr-070-return-value-use.md)           | Return-Value Use           | Reject discarded non-void returns (MISRA 17.7, E0708)                            |
| [ADR-071](decisions/adr-071-read-only-by-default.md)       | Read-Only by Default       | Every binding read-only unless declared `mut` (`atomic` implies `mut`)           |

## Accepted

| ADR                                                             | Title                 | Description                                                                        |
| --------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------- |
| [ADR-003](decisions/adr-003-static-allocation.md)               | Static Allocation     | No dynamic memory after init                                                       |
| [ADR-006](decisions/adr-006-simplified-references.md)           | Simplified References | Pass by reference, no pointer syntax                                               |
| [ADR-015](decisions/adr-015-null-state.md)                      | Null State            | Zero initialization for all variables                                              |
| [ADR-027](decisions/adr-027-do-while.md)                        | Do-While              | `do { } while ()` with boolean condition (E0701)                                   |
| [ADR-032](decisions/adr-032-nested-structs.md)                  | Nested Structs        | Named nested structs only (no anonymous)                                           |
| [ADR-040](decisions/adr-040-isr-declaration.md)                 | ISR Type              | Built-in `ISR` type for `void(void)` function pointers                             |
| [ADR-043](decisions/adr-043-comments.md)                        | Comments              | Comment preservation with MISRA compliance                                         |
| [ADR-046](decisions/adr-046-nullable-c-interop.md)              | Nullable C Interop    | `c_` prefix for nullable C pointer types                                           |
| [ADR-051](decisions/adr-051-division-by-zero.md)                | Division by Zero      | Compile-time and runtime division-by-zero detection                                |
| [ADR-052](decisions/adr-052-safe-numeric-literal-generation.md) | Safe Numeric Literals | `type_MIN`/`type_MAX` constants + safe hex conversion                              |
| [ADR-061](decisions/adr-061-c-library-interop.md)               | C Library Interop     | C is the escape hatch: unsafe C stays in a `.h`/`.c` boundary layer                |
| [ADR-063](decisions/adr-063-identifier-syntax.md)               | Identifier Syntax     | No trailing/consecutive `_`; `__` reserved as the qualified-name separator (E0201) |
| [ADR-064](decisions/adr-064-volatile-keyword.md)                | Volatile Variables    | `volatile` keyword prevents compiler optimization                                  |
| [ADR-067](decisions/adr-067-all-paths-return.md)                | All-Paths-Return      | Reject non-void functions that can fall off the end (E0704)                        |

## Proposed

| ADR                                                         | Title                       | Description                                                                    |
| ----------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------ |
| [ADR-062](decisions/adr-062-sink-aware-array-auto-const.md) | Sink-Aware Array Auto-Const | Array parameters are auto-`const` unless they reach a non-`const` pointer sink |

## WIP (Implementation In Progress)

| ADR                                           | Title         | Description                                                                                    |
| --------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| [ADR-068](decisions/adr-068-forever-loops.md) | Forever Loops | `forever { }` divergent infinite loop (void-only); core landed (#1074), completes with ADR-069 |

## Superseded

| ADR                                             | Title              | Description                                                 |
| ----------------------------------------------- | ------------------ | ----------------------------------------------------------- |
| [ADR-013](decisions/adr-013-const-qualifier.md) | Const Qualifier    | Opt-in `const` (replaced by ADR-071, read-only by default)  |
| [ADR-047](decisions/adr-047-nullable-types.md)  | NULL for C Interop | `NULL` keyword for C stream functions (replaced by ADR-046) |

## Research (v1 Roadmap)

| ADR                                                     | Title                         | Description                                      |
| ------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| [ADR-008](decisions/adr-008-language-bug-prevention.md) | Language-Level Bug Prevention | Top 15 embedded bugs and prevention              |
| [ADR-009](decisions/adr-009-isr-safety.md)              | ISR Safety                    | Safe interrupts without `unsafe` blocks          |
| [ADR-054](decisions/adr-054-array-index-overflow.md)    | Array Index Overflow          | Overflow semantics for array index expressions   |
| [ADR-056](decisions/adr-056-cast-overflow-behavior.md)  | Cast Overflow Behavior        | Consistent overflow semantics for type casts     |
| [ADR-066](decisions/adr-066-do178c-compliance.md)       | DO-178C Compliance            | Safety-critical software certification framework |
| [ADR-069](decisions/adr-069-dead-code-reachability.md)  | Dead-Code / Reachability      | Reject unreachable code (MISRA 2.1/2.2, DO-178C) |

## Research (v2 Roadmap)

| ADR                                                        | Title                      | Description                               |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------- |
| [ADR-100](decisions/adr-100-multi-core-synchronization.md) | Multi-Core Synchronization | ESP32/RP2040 spinlock patterns            |
| [ADR-101](decisions/adr-101-heap-allocation.md)            | Heap Allocation            | Dynamic memory for desktop targets        |
| [ADR-102](decisions/adr-102-critical-section-analysis.md)  | Critical Section Analysis  | Complexity warnings and cycle analysis    |
| [ADR-103](decisions/adr-103-stream-handling.md)            | Stream Handling            | FILE\* and fopen patterns for file I/O    |
| [ADR-104](decisions/adr-104-isr-queues.md)                 | ISR-Safe Queues            | Producer-consumer patterns for ISR/main   |
| [ADR-105](decisions/adr-105-prefixed-includes.md)          | Prefixed Includes          | Namespace control for includes            |
| [ADR-106](decisions/adr-106-isr-vector-bindings.md)        | Vector Table Bindings      | Register bindings for ISR vector tables   |
| [ADR-111](decisions/adr-111-safe-hardware-abstraction.md)  | Safe Hardware Abstraction  | Type-safe hardware abstraction primitives |

## Rejected

| ADR                                                         | Title               | Description                                                             |
| ----------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| [ADR-041](decisions/adr-041-inline-assembly.md)             | Inline Assembly     | Write assembly in C files; cnx transpiles to C anyway                   |
| [ADR-042](decisions/adr-042-error-handling.md)              | Error Handling      | Works with existing features (enums, pass-by-reference, struct returns) |
| [ADR-039](decisions/adr-039-null-safety.md)                 | Null Safety         | Emergent from ADR-003 + ADR-006 + ADR-015; no additional feature needed |
| [ADR-020](decisions/adr-020-size-type.md)                   | Size Type           | Fixed-width types are more predictable than platform-sized              |
| [ADR-019](decisions/adr-019-type-aliases.md)                | Type Aliases        | Fixed-width primitives already solve the problem                        |
| [ADR-021](decisions/adr-021-increment-decrement.md)         | Increment/Decrement | Use `+<- 1` instead; separation of concerns                             |
| [ADR-023](decisions/adr-023-sizeof.md)                      | Sizeof              | Use `.type_byte_length` or `.memory_byte_length` (ADR-058)              |
| [ADR-002](decisions/adr-002-namespaces.md)                  | Namespaces          | Replaced by `scope` keyword (ADR-016)                                   |
| [ADR-005](decisions/adr-005-classes-without-inheritance.md) | Classes             | Use structs + free functions instead (ADR-016)                          |
| [ADR-018](decisions/adr-018-unions.md)                      | Unions              | Use ADR-004 register bindings or explicit byte manipulation             |
| [ADR-038](decisions/adr-038-static-extern.md)               | Static/Extern       | Use `scope` for visibility; no `static` keyword                         |
| [ADR-026](decisions/adr-026-break-continue.md)              | Break/Continue      | Use structured loop conditions instead                                  |
| [ADR-028](decisions/adr-028-goto.md)                        | Goto                | Permanently rejected; use structured alternatives                       |
| [ADR-031](decisions/adr-031-inline-functions.md)            | Inline Functions    | Trust compiler; `inline` is just a hint anyway                          |
| [ADR-033](decisions/adr-033-packed-structs.md)              | Packed Structs      | Use ADR-004 register bindings or explicit serialization                 |
