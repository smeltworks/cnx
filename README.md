# cnx

[![npm version](https://img.shields.io/npm/v/@smeltworks/cnx)](https://www.npmjs.com/package/@smeltworks/cnx)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=smeltworks_cnx&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=smeltworks_cnx)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=smeltworks_cnx&metric=coverage)](https://sonarcloud.io/summary/overall?id=smeltworks_cnx)
[![Coverage Report](https://img.shields.io/badge/Coverage-Report-blue)](https://smeltworks.dev/cnx/coverage/)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=smeltworks_cnx&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=smeltworks_cnx)
[![CI](https://github.com/smeltworks/cnx/actions/workflows/pr-checks.yml/badge.svg)](https://github.com/smeltworks/cnx/actions/workflows/pr-checks.yml)

A safer C for embedded systems development. Transpiles to clean, readable C.

**Status: Working Transpiler** — Verified on Teensy MicroMod, 4.0, and stm32 hardware.

## Quick Example

```cnx
#pragma target teensy41

// Register binding with type-safe access
register GpioPort {
    0x00 rw u32 DR,
    0x84 wo u32 DR_SET,
    0x8C wo u32 DR_TOGGLE,
}

GpioPort GPIO7(0x42004000);

u32 LED_BIT <- 3;

scope LED {
    void toggle() {
        // Type-aware bit indexing on write-only register
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}
```

Generates clean C:

```c
#define GPIO7__DR_TOGGLE (*(volatile uint32_t*)(0x42004000 + 0x8C))

const uint32_t LED_BIT = 3U;

void LED__toggle(void) {
    GPIO7__DR_TOGGLE = ((uint32_t)1U << LED_BIT);
}
```

## Why cnx?

cnx transpiles to **C**, and your existing toolchain compiles the output. The baseline is C99; a few features cost more — a critical section needs a platform interrupt API, float bit indexing needs C11 — and you pay only for what you use. See [toolchain compatibility](docs/compatibility.md) for the per-feature matrix, or just transpile your project: it reports its own requirements.

This means:

- **50+ years of GCC optimizations** work out of the box
- **Existing debuggers and profilers** just work (GDB, Ozone, etc.)
- **No new runtime** — the generated C is what runs on your hardware
- **Incremental adoption** — drop a single `.cnx` file into an existing project

Other memory-safe languages require adopting an entirely new toolchain, build system, and ecosystem. cnx gives you safety improvements while keeping your investment in C infrastructure.

## Philosophy

cnx follows the TypeScript model for adoption:

1. **Not all-or-nothing** — Drop a single `.cnx` file into an existing C project
2. **Clean escape hatch** — Generated C is idiomatic and maintainable
3. **Helpful, not burdensome** — If you know C, you can read cnx immediately

### Core Principles

**KISS (Keep It Simple, Stupid)**
Every feature must pass the simplicity test: "Can a senior C developer read this cold and understand it in 30 seconds?" If not, it's too clever.

**DRY (Don't Repeat Yourself)**
Configuration belongs in one place. No magic numbers scattered through code. Named constants and register bindings enforce single sources of truth.

**Pragmatic, Not Dogmatic**
cnx makes the right thing easy and the wrong thing hard, but doesn't prevent escape hatches. Generated C is always readable and maintainable.

**Explicit Data Flow**
Values do not go missing quietly. `<-` marks assignment, there are no implicit conversions, no `switch` fallthrough — and a function's return value must be used or explicitly thrown away (ADR-070):

```cnx
u32 v <- readSensor();       // used
(void) readSensor();         // deliberately discarded -- says so
readSensor();                // error[E0708]: return value discarded
```

A dropped status code is one of the classic embedded bugs, so ignoring one is a decision you have to write down rather than one you can make by accident.

### C Preprocessor Compatibility

cnx uses the standard C preprocessor — no custom module system. This means:

- `#include` directives pass through to generated C
- Include cnx files: `#include "utils.cnx"` → `#include "utils.h"` in generated C
- Works with both `<file.cnx>` and `"file.cnx"` syntax
- MISRA preprocessor guidelines apply
- Full compatibility with existing toolchains (PlatformIO, arm-gcc, etc.)
- Conditional compilation (`#ifdef`) works as expected

Generated headers automatically include guards, built from the file's path
relative to the project root (see [the reserved `cnx_` prefix](#the-reserved-cnx_-prefix-adr-063)):

```c
#ifndef CNX_SRC_MYFILE_H
#define CNX_SRC_MYFILE_H
// ...
#endif /* CNX_SRC_MYFILE_H */
```

### The Simplicity Constraint

| Rust's Path                  | cnx's Path                              |
| ---------------------------- | --------------------------------------- |
| Add concepts to catch errors | Remove the ability to make errors       |
| Borrow checker complexity    | Startup allocation = predictable memory |
| Lifetime annotations         | Fixed runtime layout = clear lifetimes  |
| `unsafe` escape hatch        | No escape hatch needed!                 |

**Guiding Principle:** If Linus Torvalds wouldn't approve of the complexity, it doesn't ship. Safety through removal, not addition.

## Installation

### From npm (Recommended)

```bash
npm install -g @smeltworks/cnx
```

Verify the installation:

```bash
cnx --version
```

### From Source (Development)

```bash
git clone https://github.com/smeltworks/cnx.git
cd cnx
npm install
npm link
```

## Usage

```bash
# Transpile to C (output alongside input file)
cnx examples/teensy4/blink.cnx

# Explicit output path
cnx examples/teensy4/blink.cnx -o blink.c

# Parse only (syntax check)
cnx examples/teensy4/blink.cnx --parse

# Output as C++ (.cpp)
cnx examples/teensy4/blink.cnx --cpp

# Target platform (ADR-049). Every program names exactly one target: a
# `#pragma target` in the source, this option, "target" in cnx.config.json,
# or a PlatformIO environment's board. `cnx --help` lists the known targets.
# Upgrading: a program that names none is now error E0515, so an existing
# project adds one of these -- "target" in cnx.config.json covers every file.
cnx examples/teensy4/blink.cnx --target teensy41

# Separate output directories for code and headers
cnx src/main.cnx -o build/src --header-out build/include

# Clean generated files
cnx src/main.cnx -o build/src --header-out build/include --clean

# Show all options
cnx --help
```

### Configuration

Settings such as `target`, `include` and `headerOut` go in `cnx.config.json` (or
`.cnx.json` / `.cnxrc`), read from the project root: the nearest directory, from
the entry file up, that holds a config, `platformio.ini`, `.git` or
`package.json`. That directory is also where the `.cnx/` cache lives, and a config
above it is never read, so a `~/.cnxrc` does not reach a project with a `.git` of
its own. The options are listed by `--help` and described in
[PlatformIO integration](docs/platformio-integration.md#project-configuration-cnxconfigjson).

## Incremental Adoption

cnx supports gradual migration from existing C/C++ codebases. Convert files one at a time, starting with leaf modules:

**Step 1:** Convert a leaf file to cnx and transpile it:

```bash
cnx led.cnx --target teensy41   # Generates led.h and led.c
```

Every program names its target (ADR-049): `--target`, `#pragma target` in the file,
`"target"` in `cnx.config.json`, or a PlatformIO environment's board.

**Step 2:** Include the generated header in your existing code:

```cpp
// main.cpp
#include "led.h"

int main() {
    LED__on();
    return 0;
}
```

**Step 3:** Run the transpiler on your C/C++ entry point to auto-discover and re-transpile all cnx dependencies:

```bash
cnx main.cpp --cpp --target teensy41   # Discovers led.cnx via header marker, transpiles it
```

> With no `--cpp`, the run is C++ exactly when a header your `.cnx` files reach is C++: a
> `.hpp`, or a `.h` whose preprocessed text holds C++ (Issue #1844). `--cpp` (or
> `cppRequired: true` in `cnx.config.json`) makes it C++ regardless, which a C++ project
> should set so the mode does not depend on the include path. `--no-cpp` (or
> `cppRequired: false`) requires C, and a C++ header is then error **E0507**.

The transpiler automatically discovers cnx files by scanning the include tree for headers containing generation markers (e.g., `generated by cnx from: led.cnx`). When changes are made to any `.cnx` file, running `cnx main.cpp` ensures all generated code is up-to-date.

### Symbol naming (ADR-063)

Scope members are named `Scope__member` in generated C — **two** underscores:

```cnx
scope LED { void on() { } }     // call from C/C++ as LED__on()
```

The separator is two characters so that it cannot collide with a plain
identifier: cnx forbids an identifier from ending with `_` or containing
`__`, which makes the join unambiguous. Without that, a global `Reg_flags` and
a `scope Reg` member `flags` both produced `Reg_flags` and the generated
translation unit did not compile ([#1117](https://github.com/smeltworks/cnx/issues/1117)).

`snake_case` remains perfectly legal — `tick_count`, `CONTROL_REG` and
`SysTick_Handler` are all unaffected. Only a trailing underscore or a run of
two or more is rejected (error **E0201**).

### The reserved `cnx_` prefix (ADR-063)

Names the transpiler invents — temporaries, the cached `strlen` of a string,
overflow helpers, include guards — all begin with `cnx_`, and an identifier you
declare may not (error **E0202**, compared case-insensitively):

```cnx
u8 cnx_counter <- 1;      // error[E0202] — reserved prefix
u8 my_cnx_buffer <- 1;    // fine — only the leading position is reserved
```

This is a different guarantee from the `__` separator above, and both are
needed. `__` makes `Scope__member` unambiguous about _which components_ built
it; `cnx_` keeps the transpiler's names and yours in separate namespaces. Before
it, a generated temporary could shadow a global of the same name and every later
read silently bound to the wrong storage, with a clean `-Wall -Wextra` compile
([#1131](https://github.com/smeltworks/cnx/issues/1131)).

Include guards follow the same rule and are built from the file's path relative
to the project root, so `src/can/config.cnx` yields `CNX_SRC_CAN_CONFIG_H`. Two
files whose paths differ only in ways that vanish in upper case — `mod-a.cnx`
versus `mod_a.cnx`, or a difference of case alone — are rejected with error
**E0203** rather than silently sharing a guard
([#1133](https://github.com/smeltworks/cnx/issues/1133)).

> **Migrating from a pre-ADR-063 release:** generated symbol names changed, so
> C/C++ that calls into cnx must be updated — `LED_on()` becomes `LED__on()`.
> No `.cnx` source changes are required unless you declared a name starting with
> `cnx_`. Include guards also changed, but they are internal to the generated
> headers and need no downstream update.

## VS Code Extension

The cnx VS Code extension provides syntax highlighting, live C preview, IntelliSense, and error diagnostics.

**Install from:** [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jlaustill.vscode-cnx) (coming soon)

**Source:** [github.com/smeltworks/vscode-cnx](https://github.com/smeltworks/vscode-cnx)

## Getting Started with PlatformIO

cnx integrates seamlessly with PlatformIO. Quick setup:

```bash
cnx --pio-install
```

This creates a pre-build script that automatically transpiles `.cnx` files before each build.

**Full guide:** See [PlatformIO Integration](docs/platformio-integration.md) for the complete workflow including why you should commit generated files.

## Projects Using cnx

| Project                                           | Description                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [OSSM](https://github.com/jlaustill/ossm)         | Open-source stroke machine firmware using cnx for safe embedded control            |
| [examples/teensy4](examples/teensy4/)             | Hardware verification project — validates transpiler output on Teensy MicroMod/4.0 |
| [examples/nucleo-f446re](examples/nucleo-f446re/) | Hardware verification project — validates transpiler output on STM32 Nucleo-F446RE |

_Using cnx in your project? Open an issue to get listed!_

## Documentation

| Resource                                                 | Description                             |
| -------------------------------------------------------- | --------------------------------------- |
| [Language Guide](docs/language-guide.md)                 | Complete reference for all cnx features |
| [Architecture Decisions](docs/architecture-decisions.md) | 70+ ADRs documenting design choices     |
| [ADR Numbering](docs/decisions/README.md)                | How ADRs are numbered by release band   |
| [Learn cnx in Y Minutes](docs/learn-cnx-in-y-minutes.md) | Quick syntax overview                   |
| [Error Codes](docs/error-codes.md)                       | Compiler error reference                |
| [MISRA Compliance](docs/misra-compliance.md)             | MISRA C:2012 compliance details         |

## Project Structure

```
cnx/
├── grammar/Cnx.g4                      # ANTLR4 grammar definition
├── src/
│   ├── index.ts                        # CLI entry point
│   ├── transpiler/
│   │   ├── Transpiler.ts               # Orchestrator
│   │   ├── data/                       # Discovery layer (files, includes, deps)
│   │   ├── logic/                      # Business logic (parser, symbols, analysis)
│   │   └── output/                     # Generation (codegen, headers)
│   └── utils/                          # Shared utilities
├── examples/
│   ├── bit_test.cnx                    # Bit manipulation tests
│   ├── references.cnx                  # Pass-by-reference examples
│   ├── structs.cnx                     # Struct examples
│   ├── uart_buffer.cnx                 # UART ring-buffer example
│   ├── teensy4/                        # Teensy 4.x PlatformIO verification project
│   └── nucleo-f446re/                  # STM32 Nucleo-F446RE verification project
└── docs/decisions/                     # Architecture Decision Records
```

## Development

### Toolchain Requirements

cnx has two separate toolchain contexts with different requirements:

**End users** (transpiling `.cnx` files and compiling the generated C/C++ output):

- The baseline is **C99** (**C++11** with `--cpp`), with no minimum compiler version.
- Individual features can require more — a later standard, a compiler extension, or a
  platform library such as CMSIS or avr-libc. Requirements are **per-feature**: a file that
  uses none of those features needs nothing beyond the baseline.
- The full matrix is [docs/compatibility.md](docs/compatibility.md), generated from the
  transpiler's own requirements registry so it cannot drift from what codegen emits.
- Transpiling reports what _your_ project needs, with the source line that incurred each
  requirement.

**Contributors** (running the test suite locally):

- **GCC 9+** (or equivalent Clang) — the minimum verified to compile all generated test files
- Verified on: GCC 9.4 (Ubuntu 20.04), GCC 11.4 (Ubuntu 22.04), GCC 12.3 (Ubuntu 22.04), GCC 13.3 (Ubuntu 24.04)
- Ubuntu 22.04 users: `sudo apt install gcc g++` gives GCC 11, which works
- The test suite uses `-Wall -Wextra -Werror` for `// test-no-warnings` tests, so warning behavior differences between GCC versions may surface edge cases not seen on older compilers

### Setup

```bash
# Clone and install (IMPORTANT: npm install sets up pre-commit hooks)
git clone https://github.com/smeltworks/cnx.git
cd cnx
npm install                # Dependencies and Husky pre-commit hooks
npm run plugin:install     # Prettier plugin for .cnx files
npm run build              # Transpiler and Prettier plugin
```

**Pre-commit hooks:** The project uses [Husky](https://typicode.github.io/husky/) to automatically format code (Prettier) and fix linting (oxlint) before every commit. This prevents formatting errors in PRs.

**Formatting `.cnx` files:** `prettier-plugin/` teaches Prettier the cnx language, and
`.prettierrc` loads it for `*.cnx`, so `npm run prettier:fix` formats cnx sources
alongside everything else. The plugin prints ANTLR's parse tree directly, dispatching on the
rule indices generated from `grammar/Cnx.g4` — so adding a grammar rule without a layout
for it fails CI rather than going unnoticed. `npm run format:fidelity` checks the formatter
against every fixture in `tests/`: the transpiler must produce byte-identical output from
the formatted source, every comment must survive verbatim, and formatting must be
idempotent.

### Commands

```bash
npm run antlr      # Regenerate parser from grammar
npm run typecheck  # Type-check TypeScript (no build required)
npm test                              # Run all tests
npm test -- --quiet                   # Minimal output (errors + summary only)
npm test -- tests/enum                # Run specific directory
npm test -- tests/enum/my.test.cnx    # Run single test file

# Code quality (auto-run by pre-commit hooks)
npm run prettier:fix   # Format all code, .cnx included
npm run oxlint:check   # Check for lint errors

# cnx formatter
npm run plugin:install    # Install the Prettier plugin's dependencies
npm run plugin:test       # Prettier plugin unit tests
npm run format:fidelity   # Formatting preserves meaning across every fixture

# Coverage tracking
npm run coverage:check           # Feature coverage report
npm run coverage:grammar         # Grammar rule coverage (generates GRAMMAR-COVERAGE.md)
npm run coverage:grammar:check   # Grammar coverage with threshold check (CI)
```

**Note:** cnx runs directly via `tsx` without a build step. The `typecheck` command validates types only and does not generate any output files.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete development workflow, testing requirements, and PR process,
and [docs/WORKFLOW.md](docs/WORKFLOW.md) for how issues, pull requests and releases move on the project board.

**Quick start:** Ideas and feedback welcome via issues.

## License

MIT

## Acknowledgments

- The R community for proving `<-` works in practice
- MISRA C consortium for codifying embedded safety wisdom
- The TypeScript team for demonstrating gradual adoption works
- ANTLR for the parser infrastructure
