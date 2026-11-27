# ADR-068: Forever Loops

> **Formerly ADR-113.** Renumbered 2026-08-23 into the `0xx` band — this is
> v1-gating work. See [`README.md`](README.md) for the numbering rule and the full
> mapping table.

**Status:** WIP — Accepted design, implementation in progress (completes only when ADR-069 lands)
**Date:** 2026-06-26
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-026 (Break and Continue), ADR-027 (Do-While), ADR-067 (All-Paths-Return), ADR-069 (Dead-Code / Reachability Analysis)

## Context

cnx has no dedicated construct for an intentionally infinite loop. Because loop
conditions must be explicit comparisons (E0701 — bare booleans and bare constants are
rejected), the only ways to write "loop forever" today are hacks:

```cnx
while (1 = 1) {   // `1 = 1` is equality in cnx, i.e. `1 == 1`
    loop();
}
```

which transpiles to:

```c
while (1 == 1) {
    Main_loop();
}
```

or

```cnx
for (;;) {
    loop();
}
```

which transpiles to:

```c
for (;;) {
    Main_loop();
}
```

This is unsatisfying for a "safer C": the intent (_this loop never ends_) is buried in
an arithmetic identity that the transpiler cannot recognize as deliberate. Two concrete
problems follow from the transpiler not understanding the loop is infinite:

1. **It forces dead code.** ADR-067's all-paths-return rule treats a `while` body as
   _possibly skipped_, so a non-void function whose only terminal path is `while (1 = 1)`
   fails with **E0704** unless an unreachable trailing `return` is added. The project's own
   flagship example ships exactly this dead code:

   ```cnx
   // examples/nucleo-f446re/blink.cnx:286
   i32 main() {
       setup();
       while (1 = 1) {
           loop();
       }
       return 0;          // unreachable — present only to satisfy E0704
   }
   ```

2. **It cannot express divergence.** There is no way to tell the compiler "control never
   leaves this loop," so the compiler cannot reason about the code around it (see ADR-069).

### Relevant existing constraints

- **No `break` / `continue` (ADR-026).** A loop body has no structural early exit. The
  _only_ way out of any loop is a `return` from the enclosing function. This makes a
  conditionless loop **unconditionally divergent** — a stronger guarantee than in C or Rust,
  where `break` can escape. There are zero edge cases for the analyzer to consider.
- **All-paths-return (ADR-067).** A `do-while` counts as a guaranteed return (its body always
  runs at least once); `while`/`for` never do. The analyzer makes no attempt to prove a loop
  is infinite.

### How other languages model "never returns"

Research across seven languages (Rust, Ada, C/C++, Zig, Kotlin, Swift, Verilog) found that
**no mainstream typed language syntactically restricts its infinite-loop construct by the
enclosing function's return type.** They split into two camps:

| Mechanism                                              | Languages                                                 | How an infinite loop fits a value-returning function                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Bottom / never type** (coerces to every type)        | Rust `!`, Zig `noreturn`, Kotlin `Nothing`, Swift `Never` | The loop expression has a bottom type that is a subtype of all types, so it is valid in any return context with no special rule |
| **Out-of-band contract** (attribute / aspect / pragma) | C `_Noreturn`, C++ `[[noreturn]]`, Ada `No_Return`        | The loop itself is unrestricted; a function with an infinite loop is allowed under any return type                              |

- Swift deliberately **removed** its `@noreturn` _attribute_ (SE-0102) in favor of the `Never`
  _type_, because the attribute did not compose with the rest of the type system. This is the
  clearest industry signal that the bottom-type approach is the converged-upon design.
- Verilog is the only surveyed language that uses the **keyword `forever`** — it confirms the
  word reads naturally, but offers no guidance on return types (hardware has none).

The proposed cnx rule below (`forever` only in `void` functions) is therefore **novel**.
The justification is that it is the _simplest sound_ option and, per the repo audit, costs
nothing today (see "Migration Impact").

## Decision

> This ADR's design is **Accepted** (2026-06-27); status is now **WIP** — the `forever`
> core landed in #1074, but ADR-068 is not considered _Implemented_ until ADR-069 (the
> reachability pass that consumes its divergence primitive) also lands. The open questions
> raised during research are recorded as resolved in the
> _Resolved (2026-06-26 design session)_ section.

Add a dedicated infinite-loop statement:

```cnx
forever {
    loop();
}
```

The keyword is **`forever`** (decided 2026-06-26). It reads as plain English — "reads like a
book" — and a C developer grasps its intent instantly. `loop` (Rust) was rejected as ambiguous
with labels/calls and less recognizable to C developers; `for (;;)` and `while (1 = 1)` are
treated as **hacks** to be forbidden in source (see "Forbidding the Disguised Infinite Loop"), so
`forever` is the **single** way to write an infinite loop in cnx.

**Braces are always required** — `forever { … }`, never a single-statement form — matching
cnx's brace-always style (`switch`, `scope`, `critical`).

**Source vs. generated C.** `forever` is the _source_ form; the transpiler still _emits_ the
canonical `for (;;)` in the generated `.c`. The "hack" objection is about what a human authors in
`.cnx`, not what the compiler outputs — `for (;;)` is the correct, MISRA 14.3-compliant C idiom to
generate.

### Semantics

1. **Lowering.** `forever { … }` transpiles to `for (;;) { … }` — the idiom MISRA C:2012
   explicitly permits as an infinite loop (Rule 14.3 carve-out), with no controlling
   expression to be flagged as invariant. The lowered for statement will include a detailed comment specifying the MISRA 14.3 rule etc.
2. **Divergent.** Because cnx has no `break`/`continue` (ADR-026), `forever` never completes.
   The all-paths-return analyzer (ADR-067) treats it as a **divergent statement** — a terminal
   path, like an unconditional `return`. A function whose every path either returns a value or
   diverges via `forever` satisfies E0704 with **no dead trailing return**.
3. **`void`-only.** A `forever` loop may appear **only in a function with a `void` return
   type** (proposed **E0705**). A value-returning function that loops forever can never honor
   its return type; rather than silently accept it (Rust) or force dead code (today), cnx
   rejects the combination outright. Functions that "loop until they have a value to return"
   are _not_ forever loops — by ADR-026's own philosophy they express the exit as a `while`
   condition:

   ```cnx
   u8 readUntilNonzero() {
       u8 b <- 0;
       while (b = 0) {        // the trigger is explicit
           b <- readByte();
       }
       return b;              // reachable, not dead
   }
   ```

4. **No code after `forever`.** Any statement following a `forever` loop in the same block is
   unreachable and is an error. This is the first concrete consumer of the divergence primitive
   that ADR-069 (Dead-Code / Reachability Analysis) generalizes — see "Relationship to ADR-069."

### Proposed error codes (not yet allocated)

Diagnostics follow the existing `Error EXXXX: <message>\n  help: <suggestion>` format (see E0701).

| Code  | Trigger                                                   | Message → help                                                                                                                                                                                          |
| ----- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0705 | `forever` in a non-`void` function                        | `forever loop in non-void function '<name>'` → `a forever loop never returns a value; make '<name>' return void, or use a while loop with an exit condition`                                            |
| E0707 | `for (;;)` in source                                      | `empty for-loop header is an infinite loop` → `write 'forever { … }' for an intentional infinite loop`                                                                                                  |
| E0707 | always-true loop condition (`while (1 = 1)`, etc.)        | `loop condition is always true` → `write 'forever { … }' for an intentional infinite loop`                                                                                                              |
| E0715 | a `for` header assignment that is more than one statement | `a for-loop header cannot hold this assignment: <form>` → `assign before the loop and leave the init clause empty` (init) or `assign at the end of the loop body and write it as a while loop` (update) |

**E0706 is allocated to ADR-069** (unreachable code); "code after a `forever` loop" is reported
there, not by a `forever`-specific diagnostic.

### Grammar (proposed)

```antlr
FOREVER : 'forever';   // ADR-068

foreverStatement : FOREVER block ;   // `block` requires braces — no single-statement form
```

`foreverStatement` is added to the `statement` rule's alternatives, alongside `whileStatement` /
`doWhileStatement` / `forStatement`. `forever` becomes a reserved keyword (no existing identifier
in the repo uses it). The forbidden `for (;;)` and always-true `while` forms are still **accepted
by the grammar** and rejected in the analysis/codegen layer (E0707) — so the diagnostic can carry
the steer-to-`forever` help text instead of a generic parse error.

## Relationship to ADR-069

`forever` and general dead-code detection are **independent** (neither strictly requires the
other) but **share one primitive**. The decision (recorded in the design discussion) is **two
ADRs sharing a single divergence primitive**:

- **This ADR (113)** introduces the **"divergent statement"** concept into the
  all-paths-return rule (a `forever` loop is divergent) and the minimal rule "no code after
  `forever`." Small,
  self-contained, **non-breaking** (it only accepts more programs — those that previously
  needed a dead trailing return).
- **ADR-069** _generalizes the consumption_ of that same primitive into a full reachability
  pass (unreachable code after `return`, after fully-returning `if`/`else`, etc.). It is a
  **breaking** change and is independently motivated by MISRA 2.1/2.2 and DO-178C.

Adhering to a single shared primitive (rather than ADR-069 re-deriving reachability) is required by
the project's "No Duplicate Code Paths" rule.

## Migration Impact

A full audit of the repository (1,028 `.cnx` files in `examples/` and `tests/`) found
**exactly one** infinite loop: `examples/nucleo-f446re/blink.cnx`, the `i32 main()` shown
above. Every Arduino `setup`/`loop` and FreeRTOS task is already `void`. That single case
converts to `void main()` with zero loss of meaning:

```cnx
void main() {
    setup();
    forever {
        loop();
    }
}                          // no return type to honor, no dead code
```

So the `void`-only restriction costs nothing in the current codebase. (`void main()` already
transpiles correctly.)

## Forbidding the Disguised Infinite Loop (follow-on)

Once `forever` exists, the disguised infinite-loop forms — `while (1 = 1)` **and** `for (;;)` in
source — have **zero** legitimate use. Both are forbidden in cnx source and steered to
`forever` (decided 2026-06-26), so there is exactly one source form. Note `for (;;)` compiles
today, so forbidding it is a deliberate (tiny) breaking change — the repo audit found **zero**
occurrences (see "Migration Impact"). The error reads, e.g.:

```
error[E0707]: loop condition is always true
  help: this is an infinite loop — write `forever { … }` instead
```

(Error code `E0707` is a proposal, not yet allocated.)

### Prior art

Steering a disguised infinite loop toward a dedicated construct is an established pattern:

| Tool                                   | Behavior                                                                                                                 | Level    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| **Rust `while_true`** (built-in rustc) | Detects `while true`; message _"denote infinite loops with `loop { … }`"_                                                | warn     |
| **Go Staticcheck `S1006`**             | `for true {}` → suggests the dedicated `for {}`                                                                          | lint     |
| **ESLint `no-constant-condition`**     | default `allExceptWhileTrue`: flags `while (1==1)`, **exempts** `while (true)`                                           | lint     |
| **MISRA C:2012 Rule 14.3**             | "Controlling expressions shall not be invariant"; blesses `true`/`1`/`for(;;)`, but a `1==1` comparison is non-compliant | Required |
| SonarQube `S2189`                      | _Opposite_ stance — flags `while(true)` as a likely bug                                                                  | —        |

Two consistent findings:

1. **Elsewhere it is a warning, not a hard error.** Rust, Go, ESLint, C# all warn; no mainstream
   toolchain blocks the build by default. MISRA is the only "must," and it _permits_ the idiom.
2. **`while (1 == 1)` is treated differently from `while (true)`.** Everywhere, the bare literal
   `true`/`1`/`for(;;)` is the _blessed intentional idiom_, while a constant _comparison_ like
   `1==1` reads as an _accidental invariant / likely logic bug_ (ESLint flags it, MISRA's blessed
   list excludes it).

There is also a recurring _semantic_ payoff: Rust's `loop {}` and Go's `for {}` are recognized by
the compiler as diverging/terminating, improving flow analysis — exactly the divergence primitive
this ADR introduces.

### Why cnx can make it a single-tier error

Every other tool needs a _two-tier_ rule (bless `while(true)`, flag `while(1==1)`). **cnx does
not** — `E0701` already forbids bare booleans/constants as conditions, so `while (true)` is not
even writable today. cnx's _only_ infinite-loop form is `while (1 = 1)` — precisely the
constant-_comparison_ form that ESLint and MISRA flag as the suspicious case. With no literal-true
idiom to protect, the two tiers collapse into one rule: **an always-true loop condition is an
error; if you meant to loop forever, use `forever`.**

That rule is exactly **MISRA Rule 14.3**, which cnx currently marks **"Not Enforced"**
(`docs/misra-compliance.md`). So the `forever` steering is the loop-true _facet_ of 14.3. A
hard error here is stricter than any precedent, but defensible for cnx: the language is
hard-error-first, `E0701` already hard-errors the adjacent case, MISRA 14.3 is Required, and
post-`forever` the form has no legitimate use.

### Scope notes

- **v0.2.18 (ships with `forever`):** `for (;;)`, plus any loop condition whose operands are all
  **literals** — `1 = 1`, `2 = 2`, `5 > 3`, `true = true`. These are decided by evaluating the
  comparison directly, with **no symbol resolution** required.
- **v0.2.19 (separate full-MISRA-14.3 effort):** invariants involving **named constants or
  non-literal operands** (`MAX > 0`, `CONST = CONST`), which need the symbol table + constant
  folding; plus the non-loop 14.3 cases (always-_false_ conditions, invariant `if`/`for`). Full
  14.3 is a separate, larger effort worth its own tracking and thus will get its own github issue in the next minor release.

## Alternatives Considered

1. **A `never` / bottom type (Rust `!`, Swift `Never`).** The idiomatic modern choice; lets a
   `forever` — or a future `panic()`-style diverging function — appear in any return context,
   compose in expressions, and drive exhaustiveness checks. **Deferred, not rejected:** it
   requires adding a real bottom type to the type system and specifying its coercion against
   every other feature (overflow modes, atomics, structs-by-ref) — a large, safety-sensitive
   surface. If diverging functions (panic handlers, fault traps, non-returning ISR dispatchers)
   land on the roadmap, the `void`-only rule becomes a stepping-stone to revisit. Recorded here
   so that decision is explicit.
2. **Pure syntactic sugar.** `forever` lowers to a loop but flow analysis is unchanged, so a
   non-void function still needs a dead trailing return. Rejected: it leaves the E0704
   dead-code wart in place, which is half the motivation.
3. **Keyword `loop` (Rust/CoffeeScript) instead of `forever` (Verilog).**

## Resolved (2026-06-26 design session)

- **Keyword:** `forever` (over `loop`, which reads ambiguously as a label/call).
- **Braces:** always required (`forever { … }`), matching `switch`/`scope`/`critical`.
- **`void`-only:** adopted for v0.2.18; a `never`/bottom type is the documented future fork
  (Alternatives Considered, #1).
- **Single source form:** `for (;;)` and always-true `while` are forbidden, steered to `forever`.
- **Diagnostics:** E0705 (`forever` in non-void) and E0707 (disguised loop) — wording in the
  _Proposed error codes_ table; grammar in the _Grammar_ subsection.
- **Steering is a hard error**, not a warning — consistent with cnx's hard-error-first stance
  (prior art warns, but cnx already hard-errors the adjacent E0701, and the form has no
  legitimate use post-`forever`).
- **v0.2.18 scope / sequencing:** `forever` ships _with_ the syntactic disguised-loop slice (`for (;;)`
  - literal-operand always-true comparisons); general-invariant detection is deferred — see
    _Scope notes_ above.

## Implementation Notes (Issue #1074, 2026-06-27)

The `forever` core shipped: grammar (`FOREVER` token + `foreverStatement : FOREVER block`),
lowering to `for (;;)` with a MISRA 14.3 comment, the divergence primitive in
ADR-067's all-paths-return rule, **E0705** (confirmed allocated), and the `blink.cnx` migration to
`void main()` + `forever`. **Status is _WIP_, not _Implemented_: ADR-068 completes only when
ADR-069 (which consumes the divergence primitive) also lands.**

Key finding for ADR-069 / #849 — **the divergence primitive is not inert in ADR-068**, contrary
to the naive reading that "`forever` is void-only and all-paths-return only checks non-void
functions, so it never sees a `forever`." A non-void function _can_ contain a `forever` loop in
source, and the check happens **before** any code is generated, so without the primitive it emits the **misleading
E0704** ("must return a value on all paths") instead of the precise **E0705**. Marking `forever`
as a terminal/divergent path in `statementDefinitelyReturns` suppresses the wrong E0704 so E0705
surfaces. This is exactly the shared decision ADR-069 must reuse rather than re-derive.

Scope held: the unreachable-code-after-`forever` diagnostic (E0706) is **not** part of #1074 — it
belongs to ADR-069's reachability pass. #1074 delivers only the divergence primitive + E0704 relief.

## Implementation Notes (Issue #1075, 2026-06-27)

The v0.2.18 **disguised-loop slice** shipped as **E0707** (E0706 stays reserved for ADR-069):

- **`for (;;)`** — a for-loop with no controlling expression is rejected in `generateFor`.
- **Always-true literal conditions** — `while`/`for`/`do-while` conditions that are a single
  comparison of integer/bool literals evaluating to true (`1 = 1`, `5 > 3`, `true = true`,
  `1 != 2`) are rejected.

Strictly the **literal** slice (no symbol resolution): named constants, non-literal/compound
operands, floats, and always-**false** conditions are deliberately _not_ flagged — deferred to the
full MISRA 14.3 effort (#1076). MISRA 14.3 moves Not Enforced → **Partial**. Repo audit confirmed
zero pre-existing `for (;;)` or `while (1 = 1)` in source (only the one already migrated in #1074),
so this breaking change flags nothing existing.

## For-Header Assignments (#1647, 2026-10-04)

A `for` header's init and update are written exactly as an assignment
statement is (#1647), so the header gets ADR-044's clamp and MISRA C:2012
Rule 7.2's suffix as a statement does. But a header clause is a C
**expression**, and four assignment forms lower to more than one statement:

| form in a header                                   | lowers to                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| a string built from its parts (`s <- a + b`)       | a bounded copy into a temp, then an append per part (ADR-045)      |
| a slice (`buf[offset, length] <- v`)               | per-element writes, and a source temp (ADR-052, #1081)             |
| any write to an `atomic` target (`<-` or compound) | an LDREX/STREX loop or a PRIMASK critical section (ADR-049 Q4, Q7) |
| a bit index or bit range on a float target         | a write through a `union` of the float and its bits (ADR-007)      |

Before #1647 the header concatenated target, operator and value, so each form
emitted C that either failed to compile (`s = "abc"`, `f[31] = true`) or
compiled to the wrong program: `buf[0, 4] = v` is C's comma operator, and
`counter += 1` on an atomic is a read-modify-write an interrupt can split.

**Decision:** each form is rejected at compile time as **E0715**, at the clause
that holds it. The help says where the assignment goes instead, which differs
by clause:

```
error[E0715]: a for-loop header cannot hold this assignment: a string built from its parts is more than one statement
  help: assign before the loop and leave the init clause empty
error[E0715]: a for-loop header cannot hold this assignment: a slice write is more than one statement
  help: assign at the end of the loop body and write it as a while loop
```

Moving an update to the end of the body is exact: ADR-026 rejects `continue`,
so nothing can skip it.

- **Strings (#2234, 2026-11-25):** a string copied whole -- a literal, a
  string, or a ternary between two -- is one `cnx_string_copy` call since
  #2207, so a header holds it, at any target (`s`, `p.name`, `names[i]`). A
  string built from its parts is still E0715: a concatenation, a substring, or
  a ternary with either as an arm (#2263 builds that arm into a buffer before
  the `if`), and so is a string a call returns, since the call fills a
  temporary before the statement (#1209): `s <- next()` is
  `a string returned by a call is more than one statement`. Fixture: `tests/adr-068/for-header-string-copy.test.cnx`.
- **Initialization (#2034, #1726):** a header assignment is the assignment a
  statement is for E0381 and E0901 too. The init runs once before the
  condition, so its target is initialized in the loop and after it; the update
  runs after the body, so the body cannot rely on it.
- **Scope:** the form is the rule, not how many statements it currently lowers
  to. A one-element slice happens to lower to one write today. It is rejected
  anyway, so the rule never depends on the slice's element arithmetic.
- **Atomic scope members:** `this.c +<- 1` is rejected as well. ADR-049 Q7 makes
  it an atomic read-modify-write, which is how it lowers outside a header
  (#1179), so a header could not hold it as one write either.
- **Compound operators** on a string or slice are E0857 already, reported
  earlier in the same pass. E0715 does not report them again, so one mistake
  gets one diagnostic.
- **Plain `<-` on an atomic** is rejected too. ADR-049 Q4 puts every access,
  stores included, in a critical section for an `atomic u64`/`i64`/`f64` on a
  32-bit MCU and an `atomic u16`/`u32` on AVR. That a store lowers to one write
  today is #1414's defect. The rule names the form, so it does not depend on
  the target's word size.
- **Bit indexes and bit ranges on an integer** lower to one expression and stay
  legal.

## Scope-Context Matrix (#1219)

Declared for the loop rules: `forever` in a non-void function (E0705),
`for (;;)` and an always-true literal condition (E0707), all three moved out of
codegen by #1322, and a for-header assignment that is more than one statement
(E0715). Severity follows the eslint model: `off` records that a cell **cannot
exist**, `warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY code: E0705 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| for header         | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| for header         | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0705 rejects the `forever` keyword as written, so it cannot occupy one; its cross-file case is the provider side.

off: a loop is a statement, so it cannot stand in a global or scope-member declaration (`forever`, `for` and `while` at file or scope level are parse errors), nor in a `for` header's declaration, whose initializer is an expression (`for (mut u32 i <- forever {}; ...)` is a parse error).

<!-- MATRIX-SEVERITY code: E0707 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| for header         | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| for header         | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0707 rejects `for (;;)` as written, so it cannot occupy one; its cross-file case is the provider side.

off: a loop is a statement, so it cannot stand in a global or scope-member declaration (`forever`, `for` and `while` at file or scope level are parse errors), nor in a `for` header's declaration. E0707 is reported at the `for` keyword or at the condition, and neither is inside the declaration.

<!-- MATRIX-SEVERITY code: E0715 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| for header         | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| for header         | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0715 rejects a for-header's shape as written, whatever its parts name, so it cannot occupy one; its cross-file case is the provider side.

off: a loop is a statement, so it cannot stand in a global or scope-member declaration (`forever`, `for` and `while` at file or scope level are parse errors). A `for` header exists only in a function body. Its declaration is not an assignment. Its initializer is a C initialization, so `for (atomic u64 i <- big; ...)` lowers to one C declaration. A string or array declared there is E0917, and a slice or bit write cannot be written in a declaration.

A loop is a **statement**: it stands in a function body and nowhere else, so the
declaration contexts, a `for` header's declaration among them, are `off`. E0705
and E0707 read only facts in the file holding the loop -- the keyword, the
header's condition, the two literals, the enclosing function's declared type.
E0715 also reads the header target's type and whether it is declared `atomic`,
and the target may be declared in an included file, so the imported cells of
both function contexts are `error`.

Since #1322 the four rules are decided during analysis, each at the position
of the loop, condition or clause that commits it, and every offense in a file
is reported. The always-true check is still the LITERAL slice described above;
#1076 owns the rest.

## Remaining

- **Back-reference ADR-067:** ADR-068 added to ADR-067's _Related ADRs_ (2026-06-27, on
  acceptance). ADR-069 still to be added when it is accepted/implemented — both extend
  ADR-067's `definitelyReturns` machinery. Documentation counterpart, not a code change.

## References

- ADR-026 (Break/Continue rejected — why a conditionless loop is unconditionally divergent)
- ADR-067 (All-Paths-Return — the analyzer this extends with a divergence primitive)
- ADR-069 (Dead-Code / Reachability Analysis — generalizes the divergence primitive)
- MISRA C:2012 Rule 14.3 (infinite-loop idiom carve-out for `for(;;)`)
- Swift SE-0102 (removal of `@noreturn` in favor of the `Never` bottom type)
