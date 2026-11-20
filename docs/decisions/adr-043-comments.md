# ADR-043: Comments

## Status

**Accepted** (was Implemented; it declares no test matrix yet, which #1406 tracks. Owner ruling on #1933, 2026-10-17)

## Context

Comments are essential for code documentation and maintainability. cnx currently supports C-style comments in the grammar but skips them during transpilation, meaning no comments appear in the generated C output.

For embedded systems development, comments serve critical purposes:

- Documenting register bit layouts and magic numbers
- Explaining hardware-specific workarounds
- API documentation for libraries
- License headers and copyright notices
- TODO/FIXME markers for development

## Behavior Before This Decision

cnx accepted all three comment forms and discarded two of them, so a commented
source file transpiled to uncommented C:

```cnx
// Set the prescaler before enabling the clock.
u8 prescaler <- 4;
```

```c
uint8_t prescaler = 4;
```

**Behavior before this decision:**

- `// comment` — Skipped, not in output
- `/* comment */` — Skipped, not in output
- `/// doc comment` — Retained and reachable by tooling, but still absent from the generated C

## Decision

**Preserve comments in generated C output using standard C syntax.**

### Comment Syntax

cnx uses standard C comment syntax:

```cnx
// Single-line comment
x <- 5;  // Inline comment

/*
 * Multi-line block comment
 * for longer explanations
 */

/// Documentation comment for functions/types
void processData() { }
```

### Comment Preservation

Comments should pass through to generated C:

```cnx
// Initialize the LED controller
register GpioPort {
    0x84 wo u32 DR_SET, // Atomic set register
}

GpioPort GPIO7(0x42004000);

/// Toggle the onboard LED
void toggleLED() {
    GPIO7.DR_SET[3] <- true;  // Bit 3 = LED pin
}
```

Generates:

```c
/* Initialize the LED controller */
#define GPIO7__DR_SET (*(volatile uint32_t*)(0x42004084U))  /* Atomic set register (not emitted yet, #1366) */

/**
 * Toggle the onboard LED
 */
void toggleLED(void) {
    GPIO7_DR_SET = (1 << 3);  /* Bit 3 = LED pin */
}
```

### Documentation Comments

Triple-slash (`///`) indicates documentation comments that generate Doxygen-compatible output:

```cnx
/// Brief description of the function.
/// @param value The input value to process
/// @return The processed result
u32 processValue(u32 value) {
    return value * 2;
}
```

Generates:

```c
/**
 * Brief description of the function.
 * @param value The input value to process
 * @return The processed result
 */
uint32_t processValue(uint32_t value) {
    return value * 2;
}
```

### Struct/Enum Documentation

```cnx
/// Represents the current motor state.
/// Used by the state machine in Motor scope.
enum MotorState {
    IDLE,      /// Motor is stopped
    RUNNING,   /// Motor is active
    ERROR      /// Fault condition detected
}

/// Configuration for UART peripheral.
struct UARTConfig {
    u32 baudRate;   /// Baud rate in bits per second
    u8 dataBits;    /// Number of data bits (5-9)
    u8 stopBits;    /// Number of stop bits (1-2)
}
```

### Comment Conversion Rules

| cnx             | Generated C     | Notes                              |
| --------------- | --------------- | ---------------------------------- |
| `// comment`    | `/* comment */` | Single-line → block for C89 compat |
| `/* comment */` | `/* comment */` | Passed through unchanged           |
| `/// doc`       | `/** doc */`    | Doxygen-style                      |

**Option: C99 mode**
If targeting C99+, line comments can pass through unchanged:

```c
// comment  // Same as input (C99+)
```

### Special Comment Markers

Standard markers are preserved:

```cnx
// TODO: Implement error handling
// FIXME: Race condition here
// HACK: Workaround for hardware bug
// NOTE: See datasheet section 4.2
```

### License Headers

File-level comments at the top of `.cnx` files pass through:

```cnx
/*
 * Copyright (c) 2024 Example Corp
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>

// Rest of file...
```

## Implementation

### All Three Forms Are Retained

No syntax changes. What changes is that `//` and `/* */` join `///` in surviving
transpilation rather than being discarded, so all three reach the generated C.

### Output Form

| Written in cnx | Emitted in C                              |
| -------------- | ----------------------------------------- |
| `// text`      | `/* text */` where C89 output is required |
| `/* text */`   | unchanged                                 |
| `/// text`     | `/** text */` (Doxygen)                   |

A comment keeps its position relative to the construct it documents, per the
association rules below. The generated C is a certification artifact and a reviewer
reads it against the cnx it came from; a comment that moved, or that survived
while its neighbor did not, would break that correspondence.

### Comment Association Rules

Comments attach to the next declaration/statement:

```cnx
// This documents foo
u32 foo <- 5;

u32 bar <- 10;  // This documents bar (inline)
```

## Alternatives Considered

### 1. No Comment Preservation (Current)

**Rejected.** Losing comments makes debugging generated code harder and loses valuable documentation.

### 2. Custom Comment Syntax

**Rejected.** Using `#` or other non-C syntax would confuse C developers and break syntax highlighting.

### 3. Separate Documentation Files

**Rejected.** Keeping docs with code is a best practice. Separate files get out of sync.

## MISRA C:2012 Compliance

cnx enforces MISRA comment rules at transpile time:

### Rule 3.1: No Nested Comment Markers (Required)

The character sequences `/*` and `//` shall not appear within a comment.

```cnx
/* This /* is an error */     // ERROR: nested /*
/* http://example.com */      // OK: exception for URIs (Amendment 4)
// TODO: fix /* later */      // ERROR: /* inside // comment
```

**Error message:**

```
Error: Nested comment marker '/*' found inside comment (MISRA C:2012 Rule 3.1)
  --> file.cnx:5:12
```

### Rule 3.2: No Line-Splice in Line Comments (Required)

Line comments ending with `\` cause undefined behavior (next line is silently commented):

```cnx
// This ends with backslash \    // ERROR: line splice
x <- 5;                          // This would be commented out!
```

**Error message:**

```
Error: Line comment ends with '\\' which causes line-splice (MISRA C:2012 Rule 3.2)
  --> file.cnx:3:1
```

### URI Exception (Amendment 4)

URLs containing `://` are permitted inside comments:

```cnx
// See https://example.com/docs    // OK: URI exception
/* Reference: http://spec.org */   // OK: URI exception
```

## Consequences

### Positive

- Generated C is self-documenting
- Doxygen documentation works automatically
- License headers preserved
- Easier debugging of generated code
- MISRA C:2012 Rules 3.1 and 3.2 enforced at transpile time

### Negative

- Slightly more complex code generation
- Must handle edge cases (comments in expressions, etc.)
- Generated files are larger

## Resolved Questions

1. **C89 vs C99 mode?** → **C99+ by default.** Line comments (`//`) pass through unchanged. C89 compatibility mode can be added later if needed.

2. **Comment positioning?** → **Keep as close to the generated line as possible.** When a statement generates multiple lines, comments should stay near their logical association.

3. **Scope-level comments?** → **Keep above what they documented.** Comments inside scope blocks stay above the same declarations/statements in the flattened output.

## References

- [Doxygen Manual](https://www.doxygen.nl/manual/)
- [MISRA C:2012 Rule 3.1](https://ldra.com/misra/) - Comment nesting
- C99 Standard Section 6.4.9 - Comments
