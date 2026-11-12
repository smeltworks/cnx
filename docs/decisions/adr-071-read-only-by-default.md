# ADR-071: Read-Only by Default (`mut`)

**Status:** Implemented
**Date:** 2026-10-15
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-006 (Simplified References), ADR-013 (Const Qualifier), ADR-029 (Function Pointers), ADR-061 (C Library Interop)
**Related Issues:** #2099 (this ADR), #2100 (ADR-013 out of date with the shipped auto-const behavior), #1529 (callback typedef takes its `const` from the body), #986 (array parameters lost auto-`const`)

## Context

### A parameter's declaration and its generated signature disagree

ADR-013 makes `const` opt-in: an unqualified parameter is writable. ADR-006 then decides
the generated signature from the body — whether the function writes the parameter, directly
or through a call. So the same unqualified declaration produces different C depending on
what the body does:

```cnx
struct Point { u32 x; u32 y; }

void show(const u32 v)     { u32 a <- v; }
void readScalar(u32 v)     { u32 a <- v; }
void bump(u32 v)           { v <- v + 1; }
void readPoint(Point p)    { u32 a <- p.x; }
void movePoint(Point p)    { p.x <- 1; }
void fill(u8[4] data)      { u8 a <- data[0]; }
```

```c
void show(const uint32_t v)   { uint32_t a = v; }
void readScalar(uint32_t v)   { uint32_t a = v; }
void bump(uint32_t* v)        { (*v) = cnx_clamp_add_u32((*v), 1U); }
void readPoint(const Point* p){ uint32_t a = p->x; }
void movePoint(Point* p)      { p->x = 1U; }
void fill(uint8_t data[4])    { uint8_t a = data[0U]; }
```

The transpiler already knows which parameters are written, and it uses that knowledge for
the C signature. The language does not: `readScalar` declares a writable parameter, generates
a read-only by-value one, and the const check still treats it as writable.

### The const check uses the declaration, so a read-only callee rejects a constant

```cnx
const u32 LIMIT <- 5;
void readOnly(u32 value) { u32 local <- value; }
void caller() { readOnly(LIMIT); }
```

```text
error[E0878]: cannot pass const 'LIMIT' to non-const parameter 'value' of function 'readOnly'
       help: The callee may write through that parameter; declare it `const` in the callee, or pass a mutable copy (ADR-013).
```

`readOnly` is generated as `void readOnly(uint32_t value)` — by value, so nothing could be
written back — yet the call is an error. The same call in a global or scope-member
initializer is rejected the same way. The fix today is to write `const` on a parameter the
transpiler already proved is read-only.

### A callback's type depends on its body

A function used as a callback type (ADR-029) gets its pointer type from the same body-derived
answer, so two functions with identical declarations can get incompatible pointer types
(#1529). A signature derived from the declaration alone cannot disagree with itself.

### Most bindings are never written

Measured over the conformance corpus (every `.cnx` under `tests/` and `examples/`, 1982
files) with the transpiler's own analysis, not a text search: for a parameter, the
direct-and-transitive answer that decides the generated signatures above; for every other
binding, the binder that decides which declaration each assignment target, `safe_div`/
`safe_mod` output and call argument names, with a call argument counted as a write when the
cnx callee writes that parameter. Parameters were counted in the 1942 files that reach
whole-program analysis; other bindings in the 1449 that reach the const check (the other 533
are 519 fixtures that stop at an earlier error and 14 helpers that do not transpile alone).

| Binding        | Declared | Written (needs `mut`) | — only through a call | Declared `const` | Neither written nor `const` |
| -------------- | -------: | --------------------: | --------------------: | ---------------: | --------------------------: |
| parameter      |     1511 |                   300 |                    73 |              120 |                        1102 |
| local          |     5139 |                  1142 |                   121 |               40 |                        3958 |
| `for` variable |      239 |                   237 |                     0 |                0 |                           2 |
| global         |     1139 |                   413 |                     4 |              273 |                         474 |
| scope member   |      449 |                   192 |                     1 |              101 |                         158 |
| **all**        | **8477** |              **2284** |               **199** |          **534** |                    **5694** |

- 20 of the 73 parameters written only through a call are written through a callee that is
  not cnx (a C/C++ header).
- 35 bindings are both written and `const`; they are the fixtures that assert E0877.
- 97 more bindings are passed to a C/C++ function or a builtin and written nowhere else. Each
  needs `mut` only if that parameter is a non-`const` pointer, which the count does not
  decide; it is an upper bound, not part of the 2284.

So a declaration that says nothing is already read-only two times in three. Today that
guarantee is unstated; `const` is written on 534 of the 5694 + 534 read-only bindings.

A control in the same runs confirmed the analysis reports a direct write, a write through a
call, a `this.` write to a scope member, a `for` update and a global write as written, and
an unwritten parameter, local, global and scope member as not written.

## Decision

**Accepted by the owner on 2026-10-15** (#2099): adopt, before v1, for every binding, and
`const` is no longer written. Implementation is tracked in #2103.

1. Every binding is **read-only by default**: parameters, locals, `for` variables, globals and
   scope members.
2. A binding that is written — assigned, used as a `safe_div`/`safe_mod` output, or passed to
   a parameter that is written — is declared **`mut`**. Writing a binding that is not `mut`
   is a compile error.

   _(Clarified 2026-11-12, owner ruling on #2117: cnx has no `&`, so past a variadic C
   function's declared parameters the format of a C standard scanf-family call --
   `scanf`, `fscanf`, `sscanf`, `wscanf`, `fwscanf`, `swscanf` -- says which arguments are
   written. With a literal format, each conversion writes the next argument, except `%%`
   and an assignment-suppressed `%*d` (C11 7.21.6.2); a `\x25` or `\045` escape is the `%` it
   spells, and a `\0` ends the format where C stops reading. That argument must be a `mut` variable (a literal or a call's result is E0915), and C
   receives its address. The address reaches `...` with no qualifier, so an `atomic` or `volatile`
   argument, or a register member, is E0915 as well: scan into a `mut` local, then assign it (#2398). C receives its address: `global.sscanf("7", "%d", parsed)` is `sscanf("7", "%d", &parsed)`.
   An array or a `string<N>` is already passed as a pointer to its first element. A format that
   is not a string literal is E0930. cnx has no wide string literal yet, so the wide variants
   take a format only through a C header. Past any other variadic function's parameters, an
   argument is passed as written, and an array or a `string<N>` is one the callee may write
   through; how such a callee writes any other out-parameter is open (#2397).)_

   ```cnx
   u32 LIMIT <- 5;                       // read-only: no keyword

   void readOnly(u32 value) { u32 local <- value; }
   void bump(mut u32 v) { v <- v + 1; }  // written: says so

   void tick() {
       mut u32 count <- 0;
       count <- count + 1;
       readOnly(LIMIT);                  // compiles
   }
   ```

3. A parameter's generated signature follows its declaration, not the body.
4. This is `0xx` work: it ships before v1.
5. `const` on a declaration is a compile error ("`const` is the default; remove it").
6. A `mut` that nothing writes is a compile error ("'v' is never written; remove `mut`"),
   except where the `mut` is fixed by something outside the body: a function used as a
   callback type (ADR-029), whose `mut` is part of the type its implementations match, and a
   global that C code writes.
7. A read-only binding is generated with C's `const` (`const uint32_t LIMIT = 5U;`,
   `void show(const uint32_t v)`), so the generated C and the header a C file includes say
   what the cnx says. For a struct or array parameter, passed by pointer, that is also
   MISRA C:2012 Rule 8.13's `const` on the pointed-to type.

_(Clarified 2026-10-19, owner ruling on #2233: an `atomic` binding is writable without `mut`, since only a value something writes needs a read or write that cannot be torn (ADR-049). `atomic mut` is E0919. Decision 6 still applies: an `atomic` local or private scope member nothing writes is E0899, which asks for `atomic` to be removed.)_

Rejected:

- **Parameters only.** Explored first; the owner widened it so one rule covers every binding.
- **Keeping the body-derived inference as the language rule.** It is what produces the three
  problems in Context; the analysis stays, but as a check on the declaration, not as its
  substitute.
- **Ada-style `in` / `out` / `inout` modes.** ADR-013 Alternative 2 already weighed them;
  `mut` adds one keyword where modes add three and an `out` rule C has no way to express.

## Questions

Every question #2099 asked is answered; each heading names the Decision that answers it.

### Q1: `const`, once it is the default — decided

An error (Decision 5). The rewrite in Q8 removes all 534 mechanically, so a warning or a
migration window would protect no code.

### Q2: Writing a binding that is not `mut`, and a `mut` that is never needed — decided

**The write gets a new diagnostic, E0900**, not E0877. E0877's help is "remove `const`",
which is the wrong advice when there is no `const` to remove:

```text
error[E0900]: cannot assign to read-only variable 'count'
       help: A binding is read-only unless declared `mut` (ADR-071); declare it `mut` if the value must change.
```

**A `mut` that nothing writes is also an error** (Decision 6), so a declaration never claims
more than the code needs — with two exemptions:

- a function used as a callback type (ADR-029): its body is the default and is often empty,
  while the functions assigned to it may write; its `mut` is part of the type;
- a global another language writes: a cnx global a C file or an interrupt handler written
  in C assigns is written in no cnx code, so the analysis would call its `mut` unused.

### Q3 and Q4: Passing a binding to a parameter that writes — decided (Decision 2)

```cnx
u32 LIMIT <- 5;                      // read-only by default
void sink(mut u32 v) { v <- 1; }
void forward(u32 v) { sink(v); }     // forward's v is read-only
```

**One rule.** Passing a binding to a `mut` parameter writes it, so the binding
must be `mut`, with Q2's diagnostic. E0878 ("cannot pass const ... to non-const parameter")
becomes that diagnostic: there is no longer a "non-const" parameter that is not `mut`, so the
`LIMIT` call in Context compiles and `sink(LIMIT)` is the error. The same applies to a C/C++
parameter that is a non-`const` pointer (ADR-061): 20 parameters are writable today only for
that reason, and up to 97 other bindings are passed to C/C++ or builtin parameters.

A callee nothing declares does not reach this rule: calling a function with no cnx
definition and no header declaration is already an error (E0422, "function 'g' called before
definition"), so every call has a signature to check.

ADR-062 (Proposed, not established) answers the array half of this by inference, falling back to
"mutable" with a note. With a declared `mut` there is nothing to infer, so ADR-062 is revisited
rather than implemented as written.

### Q5: Callbacks (ADR-029) — decided (Decisions 3 and 6)

`mut` is part of the function-as-type signature and comes from the
declaration only. A function assigned to a callback type matches its parameters' `mut` exactly,
the same way it already matches type and `const` (E0879). This removes #1529's class of defect:
two identical declarations always have one pointer type.

### Q6: Generated C — decided (Decisions 3 and 7)

Parameters, decided by the declaration alone:

| Parameter    | Read-only (default)     | `mut`             |
| ------------ | ----------------------- | ----------------- |
| scalar       | `uint32_t v` (by value) | `uint32_t* v`     |
| struct (C)   | `const Point* p`        | `Point* p`        |
| struct (C++) | `const Point& p`        | `Point& p`        |
| array        | `const uint8_t data[4]` | `uint8_t data[4]` |

Every other read-only binding is generated with C's `const` too (Decision 7): for a global it is
what a C file including the header sees, and MISRA C:2012 Rule 8.13 asks for it on pointed-to
types. This changes the generated C of every unmarked read-only binding (5694 in the corpus),
so their snapshots are regenerated with the implementation.

Three read-only bindings are generated without `const`, with the owner's approval:

- A string filled at runtime: the generated `strncpy`/`strncat` and null terminator write it.
- A C++ class object filled after it is declared (`{}`, then one assignment per field).
- An `ISR` parameter, `void run(ISR cb);`, which is generated the same way a callback parameter is.
  `const ISR cb` is valid C, but cppcheck 2.13's MISRA addon reports Rule 8.2 on a `const`
  function-pointer parameter in a declaration. `ISR const cb` and `void (* const cb)(void)` are
  reported too.

The cnx rule does not change for any of them: writing one is still E0900.

### Q7: Which bindings — decided

All of them (Decision 1).

### Q8: Can the migration be automated? — yes

Yes, and it was measured. The rewrite is: add `mut` to every written binding
(2284 in the corpus) and delete `const` from every binding that has it (534). The analysis that
produced those counts is the one that would drive the rewrite. The 97 bindings passed only to
C/C++ or builtin parameters need that parameter's signature first. The written bindings in
error-expecting fixtures (130) need review rather than the rewrite: the 35 that assert E0877 on a
`const` binding become fixtures for Q2's diagnostic (drop `const`, add nothing).

The migration script #2103 adds is that rewrite. Each round transpiles every file and
applies what the diagnostics say: delete the `const` E0898 points at, and add `mut` where E0900
(or E0879, for a callback whose C typedef writes through a pointer) says the binding is declared.
Run on main's corpus from before this ADR, with the harness's `--include tests/include`, it
rewrites 890 files (re-measured after #1755, with the harness's `--include tests/include`). Compared with the
committed corpus, 1369 files come out identical and the 112 `// test-error` fixtures are left for review, as above. The
other 13 differ for reasons the analysis does not decide:

- 2 `tests/null-check/` fixtures store `strstr`'s result from a read-only string; their `mut`
  waits on what `mut cstring` means. The other 10 that hand a string or `FILE` to `fgets`/`fclose`
  now get their `mut` from the analysis, because `<stdio.h>` is read with the target's compiler
  (#1755).
- 5 keep a test's intent: `tests/adr-057/cross-file-*` write a member so it is emitted,
  `issue-1175-constant-dimensions/var-lib.cnx` and `issue-1760-bit-writer` need a runtime value
  rather than a constant, and `initialization/global-zero-init` tests writable zero-initialized
  globals.
- 5 differ only in comments, Prettier wrapping, or the `#1764` xfail markers the C boundary
  wrapper made obsolete.

Writing the script found two writes the corpus missed: a member or element passed to a `mut`
parameter (`fill(o.inner.data)`) reported no E0900, and a callback was not checked against its C
typedef's pointer constness. Both are fixed, and the script's `mut` for them is committed.

### Q9: Which release — decided

`0xx`: before v1 (Decision 4).

## Diagnostics

| Code  | Meaning                                                                                                                                                                                                                                                                                                                                         | Asserted by                                                                                                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0879 | A function placed in a callback slot whose parameters' `mut` differs from the callback type's (Q5): `mut` is part of the type, matched exactly as type and `const` are (ADR-029's E0879)                                                                                                                                                        | `tests/adr-071/callback-*-error.test.cnx`, `tests/adr-071/c-callback-mut-match-error.test.cnx`                                                                                                                                   |
| E0898 | `const` written on a declaration (Decision 5)                                                                                                                                                                                                                                                                                                   | `tests/adr-071/`                                                                                                                                                                                                                 |
| E0899 | A `mut` binding nothing writes, outside the two exemptions (Decision 6)                                                                                                                                                                                                                                                                         | `tests/adr-071/`                                                                                                                                                                                                                 |
| E0900 | A write to a binding not declared `mut`: an assignment to or through it, a `safe_div`/`safe_mod` output, an argument to a `mut` cnx parameter or a C/C++ pointer or array parameter that is not const (Decision 2), or an opaque handle (ADR-030) stored in a `mut` binding, which can then write what it refers to. It retires E0877 and E0878 | `tests/adr-013/const-*-error.test.cnx`, `tests/adr-051/safe-division-const-output-error.test.cnx`, `tests/bugs/issue-1977-struct-to-c-byte-pointer/`, `tests/bugs/issue-1722-opaque-param-forwarding/scope-this-callee.test.cnx` |
| E0930 | A C standard scanf-family call whose format is not a string literal, so nothing says which arguments it writes (Decision 2, #2117)                                                                                                                                                                                                              | `tests/bugs/issue-2117-address-of/scanf-format-not-literal-error.test.cnx`                                                                                                                                                       |

## Scope-Context Matrix (#1219)

Every cell can occur. A global or a scope member is declared in one file and written from a
function or scope method in the same file, in a file that includes it directly, or in one that
includes it transitively; its `mut` sits in the declaring file. A call into a `mut` parameter
also happens in a global or scope-member initializer: today's E0878 fires there
(`u32 g <- twice(LIMIT);` at file scope and inside a scope both report it), and Q3 changes it.

Every cell is `error` unless the `off:` note under its table says why it cannot occur, and each
diagnostic is asserted in every cell it can occur in:

- **E0900:** an assignment in the two function contexts and a call into a `mut` parameter from
  the two initializers, across zero, one and two include hops
  (`tests/adr-013/const-uncovered-arms-error`, `const-imported-direct-error`,
  `const-imported-transitive-error`). A compound assignment, a `safe_div` output and a qualified
  scope member one and two hops away, from a function and from a scope method
  (`tests/adr-071/write-imported-direct-error`, `write-imported-transitive-error`). A C pointer,
  a C array and an opaque handle the same way (`c-write-imported-direct-error`,
  `c-write-imported-transitive-error`), and a scope method's own locals and parameters passed to
  them (`c-write-scope-method-error`). Inside a `for` header's declaration, a call into a `mut`
  parameter and a `safe_div` output in the loop variable's initializer, from the same file and one
  and two includes away (`write-for-header-error`, `write-for-header-imported-direct-error`,
  `write-for-header-imported-transitive-error`).
- **E0898:** on each kind of declaration, in a top-level function and in a scope method
  (`const-keyword-error`), and in a file one and two includes away
  (`const-keyword-imported-error`). The matrix cannot place that last one, because a diagnostic
  naming another file is not resolved against it (#1408), so it is listed below as a fixture
  with no derivable context.
- **E0899:** in a top-level function, a scope method and a private scope member
  (`unused-mut-error`), including a `for` variable in each function context. What it checks
  (locals, parameters, `for` variables and private members) is declared only in its own file, and
  a global or public member is exempt (Decision 6), but whether such a binding is written can
  depend on an included function's signature: passed only to an imported read-only parameter, it
  is never written, one and two includes away (`unused-mut-imported-direct-error`,
  `unused-mut-imported-transitive-error`, and for a `for` variable
  `unused-mut-for-header-imported-direct-error`, `unused-mut-for-header-imported-transitive-error`).
- **E0879:** a callback type from the same file and from one and two includes away
  (`callback-mut-match-error`, `c-callback-mut-match-error`, `callback-imported-direct-error`,
  `callback-imported-transitive-error`), and in a `for` loop variable's initializer, as the
  variable itself or a struct field, from the same file and one and two includes away
  (`callback-for-header-error`, `callback-for-header-imported-direct-error`,
  `callback-for-header-imported-transitive-error`).

<!-- MATRIX-SEVERITY code: E0879 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0898 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: E0898 never fires in a `for` header, whose declaration has no place for `const`: `for (const u32 i <- 0; ...)` is a parse error.

<!-- MATRIX-SEVERITY code: E0899 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

off: E0899 never fires on a global, which is exempt (Decision 6), and a global's initializer declares no binding it could check.

<!-- MATRIX-SEVERITY code: E0900 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0930 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | warn     |
| top-level function | imported direct     | warn     |
| scope method       | imported direct     | warn     |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | warn     |
| top-level function | imported transitive | warn     |
| scope method       | imported transitive | warn     |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | warn     |

off: a global or scope member initializer cannot call a C function. warn: no fixture reaches
a scanf-family call in an included file or a `for` header yet (#2391).

## Consequences

- **Breaking, everywhere.** Every program that writes any binding stops compiling until the
  binding says `mut`, and every `const` stops compiling until it is removed (Decision 5).
  In the corpus that is 2284 and 534 declarations (Context).
- **`mut` is a reserved word.** A C field or function named `mut` (`l.mut`, `global.mut()`)
  can no longer be named from cnx: it is a parse error, where before this ADR it compiled.
- **The common case gets shorter.** 5694 corpus bindings are already read-only and unmarked; they
  keep their spelling and gain a guarantee they did not have.
- **A constant can be passed to a read-only function** without the callee writing `const`.
- **Signatures stop depending on bodies**, so a change inside a function body can no longer
  change its C prototype, its header, or its callback type.
- **ADR-013 is superseded by this ADR.** Its Alternative 1 — default immutability,
  rejected then as too aggressive for C developers — is what this adopts; its opt-in `const`
  is what this replaces.
- **ADR-062** is revisited (Q3 and Q4).
- **Learning cnx:** every tutorial and example that writes a variable changes.

## References

- #2099 — the decision, the measurement and how to reproduce it
- #2100 — ADR-013's auto-const section is out of date; read it before ADR-013
- #1529 — callback typedef takes its `const` from auto-const
- ADR-013 Alternative 1 and Q5 — the previous rejection of default immutability
- `tests/adr-013/const-param-assign-error.test.cnx` — E0877 on a written `const` parameter
- MISRA C:2012 Rule 8.13 — a pointer should point to a const-qualified type whenever possible
