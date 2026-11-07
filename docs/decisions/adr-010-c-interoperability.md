# ADR-010: C/C++ Interoperability via Unified ANTLR Parsing

**Status:** Implemented
**Date:** 2025-12-27
**Last Updated:** 2026-01-13
**Decision Makers:** cnx Language Design Team
**Tracking:** [Issue #39](https://github.com/smeltworks/cnx/issues/39)

## Context

For cnx to succeed in real embedded projects, it must support **incremental adoption**. Teams cannot rewrite entire codebases at once. They need to:

1. Add cnx files to existing C/C++ projects
2. Call C/C++ code from cnx
3. Call cnx code from C/C++
4. Convert file-by-file over time

### The Key Insight

ANTLR already has battle-tested grammars for C and C++ in the [grammars-v4](https://github.com/antlr/grammars-v4) repository. Instead of inventing new declaration formats or special syntax, we simply use the right parser for each file type.

---

## Decision: Unified ANTLR Parser Architecture

Parse all source files with their native ANTLR grammar, building a unified symbol table:

```
┌─────────────┐     ┌─────────────────┐
│  .cnx files │────▶│  Cnx Grammar    │────┐
└─────────────┘     └─────────────────┘    │
                                           │
┌─────────────┐     ┌─────────────────┐    │     ┌─────────────┐
│  .c/.h files│────▶│   C Grammar     │────┼────▶│   Unified   │────▶ .c + .h
└─────────────┘     └─────────────────┘    │     │   Symbol    │
                                           │     │   Table     │
┌─────────────┐     ┌─────────────────┐    │     └─────────────┘
│ .cpp/.hpp   │────▶│  C++ Grammar    │────┘
└─────────────┘     └─────────────────┘
```

**No declaration files. No extern blocks. No special syntax.**

---

## Advantages

### 1. Battle-Tested Patterns Force Good Design

Using existing C/C++ grammars means cnx naturally aligns with established patterns:

- **Expression precedence** matches C exactly
- **Type declaration patterns** are compatible
- **Statement structures** align with C conventions
- **Operator semantics** follow C standards

This isn't just about parsing C files — it's about ensuring cnx's own grammar follows patterns that decades of C development have proven work.

### 2. No New Syntax Required

cnx code simply uses symbols that exist in the unified symbol table:

```cnx
// Arduino functions are parsed from Arduino.h
// No extern declarations needed - they're in the symbol table
void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    delay(1000);
}
```

### 3. True Incremental Adoption

- Add .cnx files to existing C/C++ projects
- Existing .c/.h files work unchanged
- No wrapper files or declaration stubs
- Convert file-by-file at your own pace

### 4. Leverage the ANTLR Ecosystem

- [grammars-v4](https://github.com/antlr/grammars-v4) — 200+ maintained grammars
- [symtab](https://github.com/antlr/symtab) — Generic symbol table library
- Community-maintained, continuously improved
- Same toolchain for all languages

### 5. Single Toolchain

One parser infrastructure handles everything:

- No separate header parser
- No declaration file generator
- No special build steps for interop

---

## cnx File Includes

cnx supports including other cnx files using standard C `#include` syntax. The transpiler automatically transforms `.cnx` file references to `.h` references in the generated C code:

```cnx
// cnx source file
#include <types.cnx>        // System/library includes use angle brackets
#include "utils.cnx"        // Local includes use quotes

u32 main() {
    Point p;
    p.x <- calculate(10);
    return 0;
}
```

Transpiles to:

```c
// Generated C file
#include <types.h>          // .cnx → .h transformation
#include "utils.h"          // Works with both <> and ""

uint32_t main(void) {
    Point p = {0};
    p.x = calculate(10);
    return 0;
}
```

**Key features:**

- Supports both `<file.cnx>` and `"file.cnx"` syntax
- Validates that quoted (local) `.cnx` files exist at transpile time
- Angle bracket includes (system/library) are transformed without validation

This enables modular cnx code while ensuring the generated C code includes the correct header files.

### Diagnostics

| Code  | Rejects                                                                    |
| ----- | -------------------------------------------------------------------------- |
| E0503 | `#include` of an implementation file (`.c`, `.cpp`, `.cc`, `.cxx`, `.c++`) |
| E0504 | a header is included where its cnx source exists                           |
| E0506 | a quoted cnx include names a file that is not there                        |
| E0509 | a generated header records a cnx source that is not there                  |
| E0518 | `.cnx` spelled in any case but lowercase                                   |

The first three are reported at the directive's own line and column.

**E0509 has no directive to point at, and that is what it is about.** A
generated header records the cnx source it was written from, and a C or C++
entry point is compiled by following those records rather than by reading any
cnx source. So the reference that fails is in generated output, not in
anything the author wrote, and there is no cnx position to name; the
diagnostic names the missing source and the header that recorded it instead.
It is reported at the line of the generated header's marker that names the
missing source, at the column where that name starts.

The rule it restores is the one E0506 already states: **a cnx source that is
named but absent is an error.** Which route reached the name — a quoted include,
or a generated header's record — does not change the answer. It used to: reached
the second way the same fault was reported as a warning, and the run finished
successfully having produced nothing.

**Where each form is searched is part of the rule, not an implementation
choice.** A quoted include is resolved relative to the file it appears in, so
E0504 and E0506 look there and nowhere else. An angle include is searched along
the run's include path — the including file's directory, the directories the
invocation adds, and the project's own — so E0504 must consult the whole of it.
A narrower search silently accepts the very case the rule exists to reject; that
was live until #1322, where a header and its cnx twin sitting together in an
added include directory transpiled with no diagnostic while the same two files
beside the source were rejected.

**Only a lowercase `.cnx` names cnx source** (owner ruling on #1833).
`Colors.CNX` and `Colors.Cnx` are not cnx source, and naming one is E0518. It
is reported at the directive's line and column for an include, at the marker
for a generated header's record, and at `1:0` of the file when it is the run's
input, as the other diagnostics about the run are (#1847 decides that form for
all of them). `cnx --clean` reports it for such an input too.
Nothing is written. The
case of an extension is significant elsewhere in C tooling as well — GCC reads
`.C` as C++, not C. Before the ruling, discovery accepted the extension in any
case while the name of each generated file was derived from the lowercase
spelling only, so an in-place build of `Colors.CNX` wrote its generated header
over the source and finished successfully.

**None of these five occupies a cell of the scope-context matrix, and that is a
property of the construct rather than a coverage gap.** An `#include` is only
grammatical before the first declaration, so it is enclosed by no scope, no
function and no variable, and the matrix's context axis asks exactly that. This
statement is scoped to these five codes — E0509 the most plainly, since the
reference it rejects is not in cnx source at all; ADR-010's other decisions
are about
declarations and are not covered by it.

### What the emitted include names

The examples above are flat: source and header sit at the same relative
position, so swapping the extension gives the right answer. That is not the
general case, and the general rule is not "swap the extension".

**A generated include names its target relative to the header output root, so
that root alone is sufficient on the C compiler's search path.** Nothing else
need be added to build the generated C.

This follows from cnx generating _both_ sides of the contract. In C one
author writes the `#include` and places the header, and keeps them consistent
by hand. cnx decides where the header is written — mirroring the source
tree, or flattening it for a file outside that tree — and separately emits the
include text. Only the first fact knows where the header went, so the include
text is derived from it and never from the spelling the author used.

Two consequences, both of which are the point rather than side effects:

- A bare `#include <utils.cnx>` naming a file in a subdirectory emits the
  subdirectory. The author writes what is convenient to write; the include
  path is not the author's to choose, because the output layout is not theirs
  to choose either.
- Where the header is genuinely flat — an included file outside the entry's
  tree — the bare name _is_ the answer, and the emitted include stays bare.
  The rule is "name where it went", never "add a prefix".

Findings recorded 2026-09-04 under [issue #1467](https://github.com/smeltworks/cnx/issues/1467),
which fixed generated C that named a header cnx had written elsewhere. This
records the guarantee the fix restored; it does not revise the decision above.
Whether the guarantee belongs in the Decision itself is open.

**Refined 2026-10-20 ([#2272](https://github.com/smeltworks/cnx/issues/2272),
[#1473](https://github.com/smeltworks/cnx/issues/1473)), owner's ruling:** a
quoted include is spelled relative to the generated file that carries it,
because that is the directory a C compiler resolves it from. `lib/uart.h`
names the header written beside it as `"bitmaps.h"`, and `lib/uart.c` names
its own header `"uart.h"`, whichever entry pulled `lib/uart.cnx` into the
run. The output-root spelling above made the same file's output depend on its
entry (`"lib/bitmaps.h"` from `t.cnx`, `"bitmaps.h"` standalone), and the
first form compiles only with the output root on `-I`. The location is still
"where it went": the header path comes from the decision that writes the header, and only the
directory it is spelled from changed. With `--header-out` a `.c` names its
header across the split (`"../../include/lib/a.h"`). A quoted C header found
beside the `.cnx` follows the same rule
([#1746](https://github.com/smeltworks/cnx/issues/1746)): written with `-o out`,
`lib/uart.h` names `src/lib/dev.h` as `"../../src/lib/dev.h"`, once, so output
compiles with no `-I` wherever `-o` and `--header-out` put it. A spelling
found along the search path, and an angle include, are unchanged.

---

## Scope-context matrix

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |

**Every `same file` cell is `off`, and that is a property of the decision rather
than a coverage gap.** This ADR's subject is what one file may use from another;
an include is cross-file by definition, so there is no same-file case to
exercise. A reader who finds this row empty should not go looking for the
fixture that is missing -- there is none to write.

**The two remaining relationships are both `error` for all four contexts.** The
promise this ADR makes is that a declaration reached through an include is
usable wherever a local one would be, and "wherever" is precisely the context
axis. A cell left undeclared would read as `off`, which would be the claim that
an included symbol cannot be used in that position -- the opposite of what this
ADR decides.

**A C or C++ header's names are not re-exported by a cnx include** (owner
ruling on #1881). The promise above is for declarations a `.cnx` file makes. A
macro, function, variable or type a C/C++ header declares is visible only in a
`.cnx` whose own `#include` lines bring that header in -- not through another
`.cnx` that includes it. Within a file's own C includes, C's rule holds: an
include is textual, so the headers a named header includes are part of it, and
`FILE` after `#include <stdio.h>` is visible though glibc declares it in a
header `stdio.h` includes. Compiler builtins are visible in every file that
includes a header, as C sees them. Named anywhere else a header name is not
defined: E0427 for a value or macro, E0426 for a type, E0422 for a call.

**Where an include fixture occupies is the use site, never the directive.** The
Diagnostics section above records that the three include diagnostics occupy no
cell, because an `#include` is grammatical only before the first declaration and
is therefore enclosed by no scope, function or variable. That is a statement
about the directive. The decisions in this section are about the _symbol_ the
directive makes available, and a symbol is used inside a declaration like any
other -- so a fixture occupies through the call or type use it performs, and the
rejection fixtures occupy nothing.

<!-- MATRIX-SEVERITY code: E0503 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0503 is reported at the `#include` directive, which is grammatical only before the first declaration and so is enclosed by no context; a directive inside a `for` header is a parse error, and an included file's directive is reported at that file's head.

<!-- MATRIX-SEVERITY code: E0504 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0504 is reported at the `#include` directive, which is grammatical only before the first declaration and so is enclosed by no context; a directive inside a `for` header is a parse error, and an included file's directive is reported at that file's head.

<!-- MATRIX-SEVERITY code: E0506 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0506 is reported at the `#include` directive, which is grammatical only before the first declaration and so is enclosed by no context; a directive inside a `for` header is a parse error, and an included file's directive is reported at that file's head.

<!-- MATRIX-SEVERITY code: E0509 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0509 is reported at the marker of a generated C header, which is not cnx source and is enclosed by no context, `for` header included; it is raised only when a C or C++ entry point is scanned, so a cnx file that includes such a header is silent.

<!-- MATRIX-SEVERITY code: E0518 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | off      |
| top-level function | same file           | off      |
| scope member       | same file           | off      |
| scope method       | same file           | off      |
| for header         | same file           | off      |
| global variable    | imported direct     | off      |
| top-level function | imported direct     | off      |
| scope member       | imported direct     | off      |
| scope method       | imported direct     | off      |
| for header         | imported direct     | off      |
| global variable    | imported transitive | off      |
| top-level function | imported transitive | off      |
| scope member       | imported transitive | off      |
| scope method       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0518 is reported at the `#include` directive or at `1:0` of a run input, and neither is enclosed by a context; a directive inside a `for` header is a parse error, and an included file's directive is reported at that file's head.

---

## Known Limitations

### C Grammar

- Mature and well-tested (C11 specification)
- Preprocessor must run before parsing
- May need minor customization for edge cases

### C++ Grammar (CPP14)

- Does not parse nested templates: `vector<unique_ptr<T>>`
- Only covers C++14, not C++17/20 features
- GCC extensions not supported
- Suitable for most embedded C++ code

### Preprocessor Handling

C headers use heavy preprocessing. Options:

1. **Run cpp first** — Preprocess with system cpp, parse result
2. **Parse post-include** — Parse the already-preprocessed translation unit
3. **Common-case handling** — Handle simple `#define`, ignore complex macros

For embedded projects (Arduino, Teensy), option 1 or 2 works well since the build system already preprocesses.

---

## Implementation Phases

### Phase 1: Add C Grammar

1. Import `C.g4` from grammars-v4
2. Configure antlr4ng to generate TypeScript parser
3. Create `CSymbolCollector` visitor to extract:
   - Function declarations/definitions
   - Type definitions (typedef, struct, enum)
   - Global variables
   - Macro constants (from preprocessed output)

### Phase 2: Unified Symbol Table

1. One symbol table, shared across all three languages
2. cnx, C and C++ sources all populate it
3. Every symbol reference resolves against that one table, so a cnx name and a
   C name cannot mean different things to different stages
4. Track symbol origin (which file, which language)

### Phase 3: Cross-File Resolution

1. Parse all project files (any order)
2. Build complete symbol table
3. Resolve references across file boundaries
4. Report undefined symbols as errors

### Phase 4: Header Generation

1. Emit `.h` files alongside `.c` files
2. Public cnx symbols become C declarations
3. Enable C code to call cnx functions

### Phase 5: C++ Support (Optional)

1. Import CPP14 grammar
2. Handle C++ specific symbols (classes, namespaces)
3. Work around nested template limitation
4. Consider C++17 grammar when available

---

## Implementation Status

**Completed:**

- ✅ Phase 1: C11 and CPP14 grammars imported from grammars-v4
- ✅ Phase 1: `CSymbolCollector` and `CppSymbolCollector` extract symbols from C/C++ files
- ✅ Phase 2: cross-language symbol conflicts are detected
- ✅ Phase 2: all three languages populate one unified symbol table
- ✅ Phase 3: references resolve across file boundaries
  - **Behavior:** a struct declared in a C header is indistinguishable from a cnx
    one at the point of use -- field types and array dimensions come from the same
    lookup either way
  - **Impact:** ADR-058's length properties work on a C header struct member ([Issue #45](https://github.com/smeltworks/cnx/issues/45))
- ✅ Phase 4: `.h` files are emitted with include guards
- ✅ Phase 5: C++ grammar imported and working (with known limitations)
- ✅ `Preprocessor` with toolchain detection (gcc/clang/arm-gcc)
- ✅ `Project` class for multi-file compilation
- ✅ Unified parsing is now the default behavior (removed `--project` flag - [Issue #46](https://github.com/smeltworks/cnx/issues/46))
- ✅ C++ namespace type references ([Issue #388](https://github.com/smeltworks/cnx/issues/388))
  - **Syntax:** Use dot notation: `MockLib.Parse.ParseResult`
  - **Output:** Transpiles to C++ `::` syntax: `MockLib::Parse::ParseResult`
  - **Detection:** a C++ namespace and a cnx scope are distinguished, so the same dot notation resolves correctly against either
  - **Depth:** Supports arbitrary nesting (e.g., `Deep.Level1.Level2.DeepType`)

**Known Issues:**

- ~~Array indexing on C header structs broken~~ — Resolved ([Issue #8](https://github.com/smeltworks/cnx/issues/8) closed)

---

## Example: Mixed Project

```
project/
├── main.cnx          # cnx entry point
├── drivers/
│   ├── gpio.c        # Existing C driver
│   └── gpio.h        # C header
├── sensors/
│   └── temp.cnx      # New cnx module
└── lib/
    └── Arduino.h     # External library
```

Build process:

1. Preprocess all .h files
2. Parse .cnx with Cnx grammar → symbol table
3. Parse .c/.h with C grammar → symbol table
4. Resolve all cross-references
5. Generate .c + .h for each .cnx file
6. Compile with standard C toolchain

---

## Comparison: Old vs New Approach

| Aspect         | Old (Overcomplicated)       | New (Unified ANTLR)    |
| -------------- | --------------------------- | ---------------------- |
| C declarations | `extern` blocks or .d files | Parsed directly        |
| C headers      | Custom parser or ignore     | ANTLR C grammar        |
| New syntax     | `extern "C" { ... }`        | None needed            |
| Toolchain      | Multiple parsers            | One ANTLR setup        |
| Maintenance    | Declaration files drift     | Single source of truth |
| Adoption       | Requires wrappers           | Drop-in compatible     |

---

## Open Questions

### Resolved

1. **Preprocessor strategy** ✅
   - **Decision:** Run system cpp and parse output
   - **Rationale:** `Preprocessor` class uses gcc/clang/arm-gcc to preprocess C headers before parsing
   - **Implementation:** Working via unified parsing (always enabled)

2. **Symbol conflicts** ✅
   - **Decision:** Symbol conflicts between cnx and C/C++ are **ERRORS**
   - **Exceptions:**
     - Multiple `extern` declarations in C (OK - declaration, not definition)
     - C++ function overloads (OK - different signatures)
   - **Rationale:** Catch collisions for safety, don't silently shadow
   - **Status:** implemented

3. **Build system integration** ✅
   - **Decision:** Remove `--project` flag, always use unified parsing
   - **Behavior:**
     - `cnx src/main.cnx` → Parses entry point + discovers and parses all files referenced by `#include` directives
     - Always builds unified symbol table
   - **Include Path Resolution:**
     - Parse .cnx files first, extract `#include "..."` and `#include <...>` directives
     - Resolve header paths using `--include` directories (if specified) and standard search rules
     - Parse ONLY headers that are actually `#include`d (not all .h files in include dirs)
     - **Parsed header extensions:** `.h`, `.hpp`, `.hh`, `.hxx`, `.h++`, `.inl`, `.cnx`
     - **Error on implementation files:** `.c`, `.cpp`, `.cc`, `.cxx`, `.c++` (not headers, should not be #included)
     - **Benefit:** Matches standard C behavior and improves IntelliSense (only shows symbols in scope)
   - **Rationale:** Unified parsing should be the default behavior as shown in architecture diagram
   - **Watch mode:** Deferred - VSCode extension already handles live rebuilds gracefully
   - **Implementation:** Complete — unified parsing is now always enabled, `--project` flag removed

4. **C++ priority** ✅
   - **Decision:** Context-dependent priority - fix issues in whichever language users encounter them
   - **Rationale:**
     - Both C and C++ infrastructure already implemented using upstream ANTLR grammars
     - Many embedded projects mix C and C++ (Arduino, mbed, Zephyr)
     - Fixes may result in PRs back to grammars-v4 upstream projects
     - User needs drive priority, not arbitrary language preference
   - **Implementation:** Both C and C++ are first-class citizens

---

## References

### ANTLR Resources

- [grammars-v4 Repository](https://github.com/antlr/grammars-v4)
- [C Grammar (C11)](https://github.com/antlr/grammars-v4/tree/master/c)
- [CPP14 Grammar](https://github.com/antlr/grammars-v4/tree/master/cpp)
- [ANTLR Symbol Table Library](https://github.com/antlr/symtab)

### Best Practices

- [ANTLR Mega Tutorial](https://tomassetti.me/antlr-mega-tutorial/)
- [Multi-Language Parsing Patterns](https://tomassetti.me/best-practices-for-antlr-parsers/)
- [Symbol Table Management](https://martinlwx.github.io/en/how-to-use-antlr4-to-make-semantic-actions/)
