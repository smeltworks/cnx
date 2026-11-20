# ADR-064: Volatile Keyword

> **Formerly ADR-108.** Renumbered 2026-08-23 into the `0xx` band — this is
> v1-gating work. See [`README.md`](README.md) for the numbering rule and the full
> mapping table.

**Status:** Accepted (was Implemented; it declares no test matrix yet, which #1406 tracks. Owner ruling on #1933, 2026-10-17)
**Date:** 2026-01-10
**Accepted:** 2026-01-10
**Implemented:** 2026-01-10
**Decision Makers:** cnx Language Design Team

## Context

Variables can be modified outside normal program flow in several scenarios:

- **Hardware registers** - Memory-mapped I/O that changes asynchronously
- **Interrupt Service Routines (ISRs)** - Variables shared between ISR and main code
- **Multi-threaded contexts** - Variables modified by other threads (future consideration)
- **Compiler optimization barriers** - Preventing optimization of timing-critical code

Without marking these variables as `volatile`, the compiler may:

- Cache values in registers instead of reading from memory
- Reorder memory accesses
- Optimize away seemingly "useless" reads or writes
- Remove delay loops that appear to have no side effects

### Related ADRs

- **ADR-004**: Register bindings (hardware access needs volatile)
- **ADR-009**: ISR Safety (shared variables need volatile)
- **ADR-049**: Atomic types (atomic includes volatile + synchronization)

---

## Problem

Consider a busy-wait delay loop:

```cnx
void delay_ms(u32 ms) {
    mut u32 count <- ms * 2000;
    while (count > 0) {
        count -<- 1;
    }
}
```

With optimization enabled (`-Os` or `-O2`), the compiler sees:

1. `count` is a local variable
2. The loop has no observable side effects (doesn't touch hardware, doesn't call functions)
3. The result of the loop is never used
4. **Decision: Remove the entire loop!**

Result: No delay, code doesn't work as intended.

### Real-World Discovery

This issue was discovered while implementing a blink example for the Nucleo-F446RE board:

- Debug build (`-O0`): Worked
- Release build (`-Os`): LED stayed on (delay optimized away)
- Using `atomic` keyword: Added `volatile` but also unnecessary interrupt masking
- Using explicit `volatile`: Works perfectly!

---

## Decision

**Add `volatile` keyword to cnx** with the same semantics as C's `volatile`:

```cnx
volatile u32 hardware_register;      // Prevents optimization
volatile u8 isr_flag <- false;       // Shared with ISR
```

### Syntax

```cnx
variableDeclaration
    : atomicModifier? volatileModifier? constModifier? overflowModifier?
      type IDENTIFIER arrayDimension* ('<-' expression)? ';'
    ;

volatileModifier
    : 'volatile'
    ;
```

### Semantics

A `volatile` variable:

- **Must be read from memory** on every access (no register caching)
- **Must be written to memory** on every assignment (no write combining)
- **Cannot be reordered** relative to other volatile accesses
- **Cannot be optimized away** even if the value appears unused

A `volatile` binding is never a compile-time value, even when it is read-only:
its value is the hardware's or an interrupt's, so every use reads it where it
is written. It does not size an array (E0909), fold into a bit write, label a
`case`, or stand in for a known zero (E0872). (Clarified 2026-10-19, review of
#2155.)

### Code Generation

```cnx
volatile u32 count <- 1000;
```

Generates:

```c
volatile uint32_t count = 1000;
```

---

## Considered Alternatives

### Alternative 1: Use `atomic` for All Non-Optimizable Variables

**Rejected** because:

- `atomic` adds interrupt masking overhead (`PRIMASK` save/restore)
- Delay loops don't need atomicity, just non-optimization
- `atomic` is semantically wrong for non-concurrent code
- Performance overhead is significant (measured: 420 bytes vs 408 bytes for blink example)

### Alternative 2: Compiler Attributes/Pragmas

```cnx
#pragma no_optimize
void delay_ms(const u32 ms) { ... }
```

**Rejected** because:

- Disables ALL optimizations for the entire function
- Less granular than per-variable `volatile`
- Not portable across compilers
- Harder to reason about which optimizations are disabled

### Alternative 3: Assembly Barriers

```c
while (count > 0) {
    count--;
    __asm__ volatile ("nop");
}
```

**Rejected** because:

- Requires inline assembly (not supported in cnx grammar)
- Less portable
- `volatile` is the standard C solution

---

## Implementation

### Grammar Changes

Added `volatileModifier` rule and integrated into variable declarations:

```antlr
volatileModifier
    : 'volatile'
    ;

variableDeclaration
    : atomicModifier? volatileModifier? constModifier? overflowModifier?
      type IDENTIFIER arrayDimension* ('<-' expression)? ';'
    ;

forVarDecl
    : atomicModifier? volatileModifier? overflowModifier?
      type IDENTIFIER arrayDimension* ('<-' expression)?
    ;
```

### Generated Output

Both modifiers reach C as the same qualifier:

```cnx
volatile u32 statusReg <- 0;
atomic u32 counter <- 0;
```

```c
volatile uint32_t statusReg = 0U;
volatile uint32_t counter = 0U;
```

They are distinct in cnx and identical in C because `atomic` promises more than
the qualifier can express -- `volatile` asks the compiler not to cache the value,
while `atomic` additionally asserts the access is indivisible. C has one spelling for
the first and nothing for the second, so the difference is enforced before the C
exists rather than carried into it.

Applying both is a **compile error**, not a redundancy that collapses:

```cnx
atomic volatile u32 shared <- 0;
```

```
Error: Cannot use both 'atomic' and 'volatile' modifiers. Use 'atomic' for
ISR-shared variables (includes volatile + atomicity), or 'volatile' for hardware
registers and delay loops.
```

Rejecting it keeps the source honest about which guarantee was wanted. Accepting it
would produce C indistinguishable from either modifier alone, so the reader of the
generated artifact could no longer tell which one the author meant.

---

## Examples

### Delay Loop (Non-ISR Case)

```cnx
void delay_ms(u32 ms) {
    volatile mut u32 i <- 0;
    volatile u32 count <- ms * 2000;

    while (i < count) {
        i +<- 1;
    }
}
```

Generates:

```c
void delay_ms(const uint32_t* ms) {
    volatile uint32_t i = 0;
    volatile uint32_t count = (*ms) * 2000;

    while (i < count) {
        i = cnx_clamp_add_u32(i, 1);
    }
}
```

**Result**: Compiler cannot optimize away the loop.

### Hardware Register Access

```cnx
scope STM32 {
    // Status register changes asynchronously
    volatile u32 status_register @ 0x40020000;

    void waitReady() {
        while (this.status_register & 0x01 = 0) {
            // Wait for ready bit
        }
    }
}
```

Without `volatile`, the compiler might read `status_register` once and loop forever.

### ISR Flag (Use `atomic` Instead)

```cnx
// BAD: volatile alone is not ISR-safe for read-modify-write
volatile bool flag <- false;

// GOOD: atomic provides both volatile and atomicity
atomic bool flag <- false;
```

For ISR-shared variables, prefer `atomic` which provides:

- `volatile` semantics (prevents optimization)
- Atomic read-modify-write (prevents torn reads/writes)
- Memory barriers (prevents reordering)

---

## When to Use `volatile` vs `atomic`

| Scenario                     | Use        | Reason                                    |
| ---------------------------- | ---------- | ----------------------------------------- |
| **Delay loops**              | `volatile` | No concurrency, just prevent optimization |
| **Hardware registers**       | `volatile` | Asynchronous changes, no RMW races        |
| **ISR shared variables**     | `atomic`   | Needs both volatile + atomicity           |
| **Flags set by ISR**         | `atomic`   | Prevent torn reads on multi-byte types    |
| **Counters modified by ISR** | `atomic`   | RMW operations need synchronization       |

---

## Tradeoffs

### Benefits

✅ **Standard C semantics** - Familiar to C developers
✅ **Granular control** - Mark only variables that need it
✅ **No runtime overhead** - Just prevents optimization
✅ **Essential for hardware** - Memory-mapped I/O requires volatile
✅ **Debugging aid** - Makes intent explicit (this variable changes externally)

### Costs

⚠️ **Potential misuse** - Can be used where `atomic` is needed
⚠️ **Performance impact** - Prevents beneficial optimizations
⚠️ **Not a complete ISR solution** - Need `atomic` for RMW operations

---

## Teaching

### When You Need `volatile`

Ask: **"Can this variable change outside normal program flow?"**

- ✅ YES → Hardware register that updates asynchronously
- ✅ YES → Delay loop counter that must not be optimized away
- ✅ YES → Status flag polled in tight loop
- ❌ NO → Regular variables in single-threaded code

### Common Mistakes

**Mistake 1: Using `volatile` for ISR safety**

```cnx
// WRONG: Not ISR-safe!
volatile mut u32 counter <- 0;

void ISR_Handler() {
    counter +<- 1; // Read-modify-write race!
}
```

**Fix: Use `atomic` for ISR-shared variables**

```cnx
// CORRECT: ISR-safe
atomic u32 counter <- 0;

void ISR_Handler() {
    counter +<- 1; // Atomic RMW operation
}
```

**Mistake 2: Forgetting `volatile` for hardware**

```cnx
// WRONG: Compiler may cache this
u32 status @ 0x40020000;

while (status & 0x01 = 0) { }  // Infinite loop!
```

**Fix: Mark hardware registers as volatile**

```cnx
// CORRECT: Always reads from memory
volatile u32 status @ 0x40020000;

while (status & 0x01 = 0) { }  // Works correctly
```

---

## Verification

Tested with Nucleo-F446RE blink example:

- **Without `volatile`**: LED stays on (delay optimized away)
- **With `volatile`**: LED blinks correctly at ~1 Hz
- **Binary size**: 408 bytes (minimal overhead)
- **Compiler**: arm-none-eabi-gcc 7.2.1 with `-O0`

---

## References

- ISO C Standard: 6.7.3 Type qualifiers (`volatile`)
- [Volatile Considered Harmful](https://www.kernel.org/doc/Documentation/volatile-considered-harmful.txt) (Linux kernel docs)
- ADR-049: Atomic Types (when to use `atomic` instead)
- [STM32F446 Reference Manual](https://www.st.com/resource/en/reference_manual/rm0390-stm32f446xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf)

---

## Future Considerations

### Register-Level Volatile (ADR-004 Enhancement)

Currently `register` blocks don't automatically add `volatile`. Consider:

```cnx
register GpioPort {
    0x00 rw u32 DR, // Should this be implicitly volatile?
}

GpioPort GPIOA(0x40020000);
```

**Decision**: Defer to future ADR. Register members should likely be implicitly volatile.

### Compiler Warnings

Consider adding warnings for:

- Using `volatile` on ISR-shared variables (suggest `atomic` instead)
- Using neither `volatile` nor `atomic` on memory-mapped registers
- Redundant `volatile` when `atomic` is already used

---

## Status

**Implemented** - 2026-01-10

- ✅ Grammar updated with `volatileModifier`
- ✅ Code generator produces `volatile` keyword
- ✅ Works for variable declarations and for-loops
- ✅ Tested on real hardware (Nucleo-F446RE)
- ✅ Documentation complete
