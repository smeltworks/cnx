# ADR-037: Preprocessor Directive Handling

## Status

**Implemented** — Flag-only defines pass through; value defines and function macros produce errors (E0501, E0502).

## Context

C preprocessor directives are heavily used in embedded development:

- `#include` - Already handled (pass-through)
- `#define` - Constants, macros
- `#ifdef` / `#ifndef` / `#else` / `#endif` - Conditional compilation
- `#pragma` - Names or describes the target (ADR-049); any other pragma is an error _(updated 2026-09-26, #1668; was "compiler hints (future)")_

cnx takes a **safety-first approach** based on MISRA C guidelines and common bug patterns.

## Research: Why `#define` Is Dangerous

### MISRA C:2012 Preprocessor Rules (Section 20)

MISRA has 14 rules governing preprocessor usage:

| Rule  | Description                               | Severity |
| ----- | ----------------------------------------- | -------- |
| 20.4  | Macro shall not share name with keyword   | Required |
| 20.5  | `#undef` should not be used               | Advisory |
| 20.7  | Macro parameters must be parenthesized    | Required |
| 20.10 | `#` and `##` operators should not be used | Advisory |

### The 7 Classic `#define` Bugs

1. **Operator Precedence**

   ```c
   #define MULT(a, b) a * b
   MULT(1+2, 3+4)  // Expands to: 1+2 * 3+4 = 11 (not 21!)
   ```

2. **Multiple Evaluation**

   ```c
   #define SQUARE(x) ((x) * (x))
   SQUARE(i++)  // Expands to: ((i++) * (i++)) - increments twice!
   ```

3. **No Type Checking** — Macros bypass the compiler's type system

4. **No Scope** — Macros pollute the global namespace

5. **Swallowing the Semicolon** — Statement macros cause control flow issues

6. **Control Flow Distortion** — Macros with `return` or `break` hide control flow

7. **Debugger Invisible** — Macro values don't exist at runtime

### `const` vs `#define` Comparison

| Aspect      | `#define`              | `const`                |
| ----------- | ---------------------- | ---------------------- |
| Type safety | None                   | Full                   |
| Scope       | Global from definition | Normal C scope         |
| Debugger    | Invisible              | Visible                |
| Memory      | None (text replace)    | Usually optimized away |

Modern compilers (GCC, Clang, arm-gcc) perform constant propagation on `const` variables, making them as efficient as `#define` while maintaining type safety.

## Decision

cnx enforces a **safety-first preprocessor policy**:

### Allowed

- `#define FLAG` — Flag-only defines for conditional compilation
- `#ifdef` / `#ifndef` / `#else` / `#endif` — Conditional compilation
- `#include` — Already implemented

### Forbidden (Compile Errors)

- `#define NAME value` — **Error E0502**: Must use a read-only binding instead (ADR-071)
- `#define NAME(args) ...` — **Error E0501**: Must use inline functions

This eliminates 5 of 7 classic macro bug classes while preserving useful conditional compilation.

### Bug Prevention Analysis

| Bug                         | Solved? | How                                 |
| --------------------------- | ------- | ----------------------------------- |
| 1. Operator Precedence      | ✅      | No value macros allowed             |
| 2. Multiple Evaluation      | ✅      | No function macros allowed          |
| 3. No Type Checking         | ✅      | A read-only binding is type-checked |
| 4. **No Scope**             | ❌      | `#define FLAG` still global         |
| 5. Swallowing the Semicolon | ✅      | No statement macros                 |
| 6. Control Flow Distortion  | ✅      | No macro code blocks                |
| 7. **Debugger Invisible**   | ❌      | Flags can't be inspected            |

**Why the 2 unsolved bugs are acceptable:**

**No Scope (#4):** Flag-only defines like `#define ARDUINO` are inherently meant for conditional compilation, which is a global concern. Platform flags need to be visible everywhere `#ifdef` checks them. This isn't a bug—it's the intended use case. If you need scoped constants, use `const` inside a scope.

**Debugger Invisible (#7):** Flags are compile-time constructs used for conditional compilation. They don't exist at runtime because they determine which code is compiled, not runtime values. If you need a debugger-visible value, use `const`. The flag itself (`#define DEBUG`) isn't meant to be inspected—it just controls which code paths exist.

**The key insight:** These two "bugs" only matter for value-bearing macros. For flag-only defines used with `#ifdef`, global visibility is a feature, and runtime invisibility is irrelevant.

## Syntax

### Flag-Only Defines (Allowed)

```cnx
#define ARDUINO
#define STM32F4
#define DEBUG

#ifdef ARDUINO
// Arduino-specific code
#endif

#ifndef DEBUG
// Release mode code
#endif
```

### Value Constants (Required Approach)

```cnx
// ERROR: #define with value
#define BUFFER_SIZE 256  // E0502

// CORRECT: Use a read-only binding (ADR-071)
u32 BUFFER_SIZE <- 256;
string VERSION <- "1.0.0";
```

### Function-Like Macros (Forbidden)

```cnx
// ERROR: Function-like macro
#define MAX(a, b) ((a) > (b) ? (a) : (b))  // E0501

// CORRECT: Use inline function (ADR-031)
inline u32 max(u32 a, u32 b) {
    return (a > b) ? a : b;
}
```

## Error Codes

| Code  | Message                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------- |
| E0501 | Function-like macro `NAME` is not allowed. Use inline functions instead.                          |
| E0502 | `#define` with value `NAME` is not allowed. Use a read-only binding instead: `u32 NAME <- value;` |

Both are reported at the directive's own line and column. Until #1322 they were
reported at `1:0` with the real line appended to the message as `Line N`, so a
file whose offending `#define` sat on line 7 pointed the reader at line 1.

### Scope-context matrix

<!-- MATRIX-SEVERITY -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | off      |
| scope member       | same file               | off      |
| scope method       | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | off      |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |

<!-- MATRIX-SEVERITY code: E0501 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | off      |
| scope member       | same file               | off      |
| scope method       | same file               | off      |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | off      |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | off      |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

- off (same file): E0501 fires only on a function-like `#define` before the first declaration, which no declaration encloses; the same directive inside a function, a scope, a method, an initializer or a `for` header's declaration, or after any declaration, is a syntax error instead.
- off (imported): an included `.cnx` reports E0501 at its own head, enclosed by no declaration, and a `#define` in an included C header is not checked at all.

<!-- MATRIX-SEVERITY code: E0502 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | off      |
| scope member       | same file               | off      |
| scope method       | same file               | off      |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | off      |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | off      |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| for header         | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

- off (same file): E0502 fires only on a `#define` with a value before the first declaration, which no declaration encloses; the same directive inside a function, a scope, a method, an initializer or a `for` header's declaration, or after any declaration, is a syntax error instead.
- off (imported): an included `.cnx` reports E0502 at its own head, enclosed by no declaration, and a `#define` in an included C header is not checked at all.

**Every cell is `off`, and that is a claim rather than a gap.** A `#define` is
only grammatical before the first declaration, so it is enclosed by no scope, no
function and no variable — after a declaration, inside a `scope`, or inside a
function body it is a syntax error, not an E0501 or E0502. The matrix's context
axis asks which declaration encloses the diagnostic's line, and for these two the
answer is "none" at every position the language admits. There is no fixture that
could occupy a cell here, and declaring one `error` would be an obligation
nothing can ever discharge.

The relationship axis is likewise not reachable: an included `.cnx` is itself a
compiled file whose own directives are checked and attributed to it, so a
`#define` never produces a diagnostic _about another file_. A `#define` inside an
included **C** header reaches neither rule at all — the C grammar discards
`#`-lines to a hidden channel before parsing, so such a header transpiles
untouched.

## Implementation

### Grammar (Cnx.g4)

```antlr
preprocessorDirective
    : defineDirective
    | conditionalDirective
    ;

defineDirective
    : DEFINE_FLAG          // #define PLATFORM
    | DEFINE_WITH_VALUE    // Error: #define SIZE 256
    | DEFINE_FUNCTION      // Error: #define MAX(a,b)
    ;

conditionalDirective
    : IFDEF_DIRECTIVE
    | IFNDEF_DIRECTIVE
    | ELSE_DIRECTIVE
    | ENDIF_DIRECTIVE
    ;
```

### Lexer Tokens

```antlr
DEFINE_FUNCTION   : '#' [ \t]* 'define' [ \t]+ ID [ \t]* '(' ~[\r\n]* ;
DEFINE_WITH_VALUE : '#' [ \t]* 'define' [ \t]+ ID [ \t]+ ~[\r\n]+ ;
DEFINE_FLAG       : '#' [ \t]* 'define' [ \t]+ ID [ \t]* ;
IFDEF_DIRECTIVE   : '#' [ \t]* 'ifdef' [ \t]+ ID [ \t]* ;
IFNDEF_DIRECTIVE  : '#' [ \t]* 'ifndef' [ \t]+ ID [ \t]* ;
ELSE_DIRECTIVE    : '#' [ \t]* 'else' [ \t]* ;
ENDIF_DIRECTIVE   : '#' [ \t]* 'endif' [ \t]* ;
```

### Directive Handling

- Flag-only defines: Pass through unchanged
- Conditional directives: Pass through unchanged
- Value defines: Throw E0502 error
- Function macros: Throw E0501 error

## Limitations

### Current Implementation

- Preprocessor directives must appear at the top of the file (before declarations)
- Inline conditional compilation (wrapping code blocks) is handled by the C preprocessor after transpilation

### Future Enhancements

- `#pragma` support (ADR-033 for `#pragma pack`)
- Inline conditional blocks in grammar
- `#if` / `#elif` with expressions

## Test Files

Located in `tests/adr-037/`:

- `flag-define-valid.test.cnx` — valid flag-only defines
- `value-define-error.test.cnx` — E0502 error case
- `function-macro-error.test.cnx` — E0501 error case
- `define-every-rejected-form-error.test.cnx` — both rejected forms and all
  three accepted ones in one file, so dropping a rule is a count change and
  widening one fails on the accepted forms
- `conditional-compilation.test.cnx` — full conditionals example
- `nested-ifdef.test.cnx` — nested conditionals are not in the grammar

## References

- [GCC Macro Pitfalls](https://gcc.gnu.org/onlinedocs/cpp/Macro-Pitfalls.html)
- [When #define Is Considered Harmful - Hackaday](https://hackaday.com/2015/10/16/code-craft-when-define-is-considered-harmful/)
- [Common C Preprocessor Mistakes - Atomic Object](https://spin.atomicobject.com/2012/03/30/preprocessing-with-caution/)
- [MISRA C:2012 Guidelines](https://electrovolt.ir/wp-content/uploads/2022/09/MISRA-C_2012_-Guidelines-for-the-Use-of-the-C-Language-in-Critical-Systems-Motor-Industry-Research-Association-2013-2013.pdf)
