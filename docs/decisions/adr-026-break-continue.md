# ADR-026: Break and Continue

## Status

**Rejected**

## Context

`break` and `continue` are common loop control statements in C:

- `break` - exit loop early
- `continue` - skip to next iteration

However, these statements introduce complexity and ambiguity that conflicts with cnx's safety-first design philosophy.

## Decision Drivers

1. **Structured Programming** - Single entry, single exit principle
2. **Code Clarity** - Exit conditions should be visible in loop headers
3. **No Ambiguity** - Avoid confusion about which construct `break` exits
4. **C Compatibility** - Generated C must be valid and maintainable
5. **MISRA Alignment** - Support safety-critical embedded development

## The Problem with Break

### Ambiguity in Nested Constructs

In C, when a switch is inside a loop, `break` only exits the switch:

```c
// C - confusing behavior
while (running) {
    switch (cmd) {
        case CMD_QUIT:
            break;  // Exits switch, NOT the loop!
    }
    // Loop continues...
}
```

This forces ugly workarounds with flag variables or goto statements.

### Hidden Exit Points

`break` creates exit points hidden in the middle of loop bodies:

```c
for (int i = 0; i < n; i++) {
    // ... 50 lines of code ...
    if (condition) {
        break;  // Hidden exit - easy to miss when reading
    }
    // ... 50 more lines ...
}
```

This violates the structured programming principle that loops should have clear, visible termination conditions.

### MISRA Restrictions

MISRA C:2023 Rule 15.4 states: "There should be no more than one break or goto statement used to terminate any iteration statement." This acknowledges that multiple exit points reduce code clarity.

## Options Considered

### Option A: C-Style Break/Continue

Standard C behavior.

**Pros:** Familiar to C programmers
**Cons:** Ambiguity with nested switch/loop, hidden exit points, violates structured programming

### Option B: Labeled Breaks (Java/Rust style)

```cnx
outer: for (u32 i <- 0; i < 10; i +<- 1) {
    for (u32 j <- 0; j < 10; j +<- 1) {
        if (found) {
            break outer;
        }
    }
}
```

**Pros:** Solves ambiguity for nested loops
**Cons:** Still has hidden exit points, adds complexity

### Option C: No Break/Continue (Selected)

Reject both statements. Require explicit loop conditions.

**Pros:** Forces clear loop structure, no ambiguity, aligns with structured programming
**Cons:** Requires restructuring some C patterns

## Recommended Decision

**Option C: Reject break and continue for v1**

cnx does not support `break` or `continue` statements. All loop exit conditions must be expressed in the loop header. This aligns with:

1. **Pascal's original design** - The canonical structured programming language had no internal loop exits
2. **MISRA's single-exit philosophy** - Reduces complexity and improves code analysis
3. **ADR-025's switch design** - With no fallthrough, switches don't need break; this extends naturally to "break doesn't exist"

## Diagnostics

| Code  | Reported when                             | Asserted by                                                                         |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| E0703 | `break` or `continue` is written anywhere | `tests/adr-026/break-rejected.test.cnx`, `tests/adr-026/continue-rejected.test.cnx` |

The two words are not keywords -- they parse as ordinary identifiers -- so the
rejection is a rule rather than a grammar error, and it names the position of
the word. Since #1322 it is decided during analysis with the other loop rules
(ADR-068), and every occurrence in a file is reported.

## Scope-Context Matrix (#1219)

<!-- MATRIX-SEVERITY code: E0703 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| scope member       | same file               | error    |
| for header         | same file               | error    |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | warn     |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | warn     |

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0703 rejects `break`/`continue` used as a value, which is about no declaration, so it cannot occupy one; its cross-file case is the provider side.

The two words parse as identifiers, so E0703 can be written in any expression:
a loop body, a global or scope member initializer, or a `for` header. The rule
reads only the word in the file that writes it, so a fixture one or two `.cnx`
includes deep is rejected the same way. The ADR-wide table is gone: E0703 is
this ADR's only diagnostic and no site records ADR-026 provenance, so nothing
could occupy it.

## Proper Patterns

Every use case for `break` and `continue` can be expressed with proper loop structure.

### Pattern 1: Search Loop

**C (with break):**

```c
for (int i = 0; i < 100; i++) {
    if (buffer[i] == 0) {
        break;
    }
}
```

**cnx (exit condition in header):**

```cnx
u8[100] buffer;  // unsigned, so != 0 is correct
u32 i <- 0;
while (i < 100 && buffer[i] != 0) {
    i +<- 1;
}
// i is now either 100 (not found) or index of first zero
```

For signed buffers, use `> 0` or `>= 0` depending on the sentinel value:

```cnx
i8[100] signedBuffer;  // signed, could have negative values
u32 i <- 0;
while (i < 100 && signedBuffer[i] > 0) {
    i +<- 1;
}
// Stops at first zero or negative value
```

The exit condition is explicit and visible in the loop header.

### Pattern 2: Skip and Process

**C (with continue):**

```c
for (int i = 0; i < 100; i++) {
    if (buffer[i] == 0) {
        continue;
    }
    process(buffer[i]);
}
```

**cnx (inverted condition):**

```cnx
for (u32 i <- 0; i < 100; i +<- 1) {
    if (buffer[i] != 0) {
        process(buffer[i]);
    }
}
```

Simply invert the skip condition to a guard condition.

### Pattern 3: Read Until Sentinel

**C (with break and continue):**

```c
while (hasData()) {
    uint8_t byte = readByte();
    if (byte == SKIP_MARKER) {
        continue;
    }
    if (byte == END_MARKER) {
        break;
    }
    buffer[idx++] = byte;
}
```

**cnx (structured):**

```cnx
u8 byte <- 0;
while (hasData() && byte != END_MARKER) {
    byte <- readByte();
    if (byte != SKIP_MARKER && byte != END_MARKER) {
        buffer[idx] <- byte;
        idx +<- 1;
    }
}
```

Exit condition moves to header; skip logic becomes a guard.

### Pattern 4: Retry Loop

**C (infinite loop with break):**

```c
while (1) {
    result = tryOperation();
    if (result == SUCCESS) {
        break;
    }
    handleRetry();
}
```

**cnx (proper structure):**

```cnx
TResult result <- tryOperation();
while (result != EResult.SUCCESS) {
    handleRetry();
    result <- tryOperation();
}
```

Or with do-while (see ADR-027):

```cnx
TResult result;
do {
    result <- tryOperation();
    if (result != EResult.SUCCESS) {
        handleRetry();
    }
} while (result != EResult.SUCCESS);
```

### Pattern 5: Nested Search

**C (with break, requires flag):**

```c
bool found = false;
for (int row = 0; row < rowCount && !found; row++) {
    for (int col = 0; col < colCount && !found; col++) {
        if (matrix[row][col] == target) {
            found = true;
        }
    }
}
```

**cnx (same pattern, but idiomatic):**

```cnx
bool found <- false;
u32 foundRow <- 0;
u32 foundCol <- 0;

for (u32 row <- 0; row < rowCount && !found; row +<- 1) {
    for (u32 col <- 0; col < colCount && !found; col +<- 1) {
        if (matrix[row][col] = target) {
            found <- true;
            foundRow <- row;
            foundCol <- col;
        }
    }
}
```

**Or extract to a function:**

```cnx
struct TSearchResult {
    bool found;
    u32 row;
    u32 col;
}

TSearchResult findInMatrix(const u32 matrix[], u32 rowCount, u32 colCount, u32 target) {
    for (u32 row <- 0; row < rowCount; row +<- 1) {
        for (u32 col <- 0; col < colCount; col +<- 1) {
            if (matrix[row * colCount + col] = target) {
                TSearchResult result <- { found: true, row: row, col: col };
                return result;
            }
        }
    }
    TSearchResult notFound <- { found: false, row: 0, col: 0 };
    return notFound;
}
```

Early return from functions is permitted and encouraged for search operations.

## Why This Is Safer Than C

### No Ambiguity

In cnx, there is no `break` statement. You never have to wonder "does this exit the switch or the loop?" because:

- Switches have implicit break (ADR-025)
- Loops require explicit exit conditions in the header

### Visible Termination

All loop exit conditions are in the loop header:

```cnx
while (i < n && !found && retries < MAX_RETRIES) {
    // ...
}
```

A reader immediately knows all the ways this loop can terminate.

### Better Static Analysis

With single-exit loops, static analyzers can more easily:

- Prove termination
- Check bounds
- Verify invariants

## Implementation Notes

### Grammar

No grammar changes needed - simply don't add break/continue productions.

### Semantic Analysis

- If `break` or `continue` tokens appear, emit compile error
- Error message: `"break/continue statements are not supported; restructure loop with exit condition in header"`

### Generated C

The generated C will use structured loops that may include flag variables when needed. This is acceptable because:

1. The C code is generated, not hand-written
2. The flag pattern is well-understood and analyzable
3. The source cnx code remains clean

## Open Questions

1. **Labeled breaks for v2?** - If real-world usage reveals patterns that are genuinely awkward without labeled breaks, reconsider for v2

## References

- [Structured Programming Principles](https://courses.lumenlearning.com/zeliite115/chapter/reading-structured-programming/)
- [Loop Exits and Structured Programming](https://cis.temple.edu/~ingargio/cis71/software/roberts/documents/loopexit.txt)
- [MISRA C:2023 Rule 15.4](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule15.4.html) - Single break/goto per loop
- [Single Exit Point Philosophy](https://olayiwolaayinde.medium.com/c-programming-why-single-exit-point-6b2f8c43054f)
- [Rust Labeled Loops](https://doc.rust-lang.org/rust-by-example/flow_control/loop/nested.html) - For potential v2 reference
- ADR-025: Switch Statements (implicit break, no fallthrough)
- ADR-027: Do-While Loops
