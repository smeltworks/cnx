# ADR-050: Critical Sections

**Status:** Implemented
**Date:** 2026-01-03
**Accepted:** 2026-01-04
**Implemented:** 2026-01-06
**Decision Makers:** cnx Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

Atomic types (ADR-049) handle single-variable operations, but some operations require multiple variables to be updated atomically. For example:

```c
// These two updates must happen together
buffer[write_index] = data;
write_index = write_index + 1;
```

If an ISR fires between these lines, it could see inconsistent state. Critical sections disable interrupts to guarantee atomicity of multi-statement operations.

### Related ADRs

- **ADR-009**: Parent ADR covering overall ISR safety strategy
- **ADR-049**: Atomic types (for single-variable operations)
- **ADR-104**: ISR-safe queues (built on critical sections internally)
- **ADR-100**: Multi-core synchronization (v2, deferred)
- **ADR-102**: Critical section complexity analysis (v2, deferred)

### Scope

This ADR focuses on **single-core MCUs** (Cortex-M0 through M7). Multi-core synchronization (ESP32, RP2040, etc.) requires spinlocks and is deferred to ADR-100 for v2.

---

## Research Findings

### ARM Cortex-M Mechanisms

| Mechanism   | Availability  | Effect                          | Use Case                |
| ----------- | ------------- | ------------------------------- | ----------------------- |
| **PRIMASK** | All Cortex-M  | Disable ALL interrupts          | Short critical sections |
| **BASEPRI** | M3/M4/M7 only | Disable interrupts ≤ priority N | Selective masking       |

### PRIMASK Implementation

```c
// Disable all configurable interrupts
uint32_t primask = __get_PRIMASK();
__disable_irq();  // CPSID i

// Critical section code here

__set_PRIMASK(primask);  // Restore previous state
```

**Characteristics:**

- Simple, works on all Cortex-M
- Nestable via save/restore pattern
- Blocks ALL interrupts including high-priority

### BASEPRI Implementation

```c
// Only disable interrupts with priority >= threshold
uint32_t basepri = __get_BASEPRI();
__set_BASEPRI(priority << (8 - __NVIC_PRIO_BITS));

// Critical section code here

__set_BASEPRI(basepri);  // Restore
```

**Characteristics:**

- Only available on M3/M4/M7
- Higher-priority interrupts still fire
- Requires knowing interrupt priority levels

### RTIC's Stack Resource Policy

RTIC (Rust) automatically computes the "ceiling priority" for each resource:

1. Analyzes which tasks/ISRs access each shared variable
2. Computes ceiling = max priority of all accessors
3. When claiming resource, sets BASEPRI to ceiling
4. No explicit critical sections in user code

This is elegant but requires static analysis of all resource accesses.

### How Other Languages Handle Critical Sections

**Rust (bare-metal):**

```rust
cortex_m::interrupt::free(|_cs| {
    // Interrupts disabled in this closure
    SHARED.borrow(cs).replace(new_value);
});
```

**C (CMSIS):**

```c
__disable_irq();
// critical section
__enable_irq();
```

**Ada (Ravenscar):**

```ada
protected Counter is
   procedure Increment;  -- Automatically protected
end Counter;
```

Ada's protected objects handle this automatically.

---

## Design Questions

### Q1: Syntax for Critical Sections ✓

**Decision: Block statement syntax**

```cnx
critical {
    // Interrupts disabled here
}
```

**Rationale:**

1. **MISRA alignment**: MISRA recommends encapsulating interrupt disable/enable in well-defined constructs rather than raw `__disable_irq()`/`__enable_irq()` calls
2. **Single exit point**: Works perfectly with Q5 decision to forbid early exits - the block has exactly one exit point (the end)
3. **RAII-style cleanup**: Transpiled C uses save/restore pattern that automatically handles cleanup
4. **Familiar to C developers**: Looks like a normal block statement
5. **Consistent with cnx**: `atomic` modifies types, `critical` modifies regions - clear separation of concerns

**Alternatives Considered:**

| Option               | Why Not Chosen                                                   |
| -------------------- | ---------------------------------------------------------------- |
| Explicit enter/exit  | Easy to forget exit, doesn't align with "wrong thing impossible" |
| Closure-based (Rust) | cnx doesn't have first-class closures                            |
| Automatic (Ada)      | Complex implementation, may defer to v2 for protected objects    |

> **Toolchain note (#1143).** The `__cnx_*` wrappers are emitted as a three-arm
> `#if`/`#elif` block: ARM uses GNU inline assembly on PRIMASK, Arduino on
> ARM uses `noInterrupts()`, AVR uses avr-libc `SREG`/`cli()`, and any other
> compiler stops at `#error`. A target whose description has
> `interrupt_mask: false` (host, esp32) rejects a `critical` block with E0916,
> and makes an atomic read-modify-write a GNU `__atomic` compare-exchange loop
> instead of a masked region (#1147, #1789). Multi-core exclusion stays with
> ADR-100. So a `critical` block costs a platform interrupt API, chosen
> by the compiler rather than by the transpiler. The current requirements are in
> [compatibility.md](../compatibility.md), generated from the transpiler's registry.

**Transpiled Output:**

```c
// critical { ... }
uint32_t __primask = __cnx_get_PRIMASK();
__cnx_disable_irq();
{
    // Critical section code here
}
__cnx_set_PRIMASK(__primask);
```

### Q2: PRIMASK vs BASEPRI ✓

**Decision: Automatic ceiling priority (RTIC-inspired) with PRIMASK fallback**

The compiler automatically computes the optimal interrupt masking level based on static analysis of which ISRs access which variables. No developer decisions required.

#### How It Works

**Step 1: ISR priorities are declared (or default to 0)**

```cnx
interrupt(priority: 4) CAN_RX { ... }   // High priority
interrupt(priority: 2) UART_RX { ... }  // Medium priority
interrupt SPI_RX { ... }                // Default priority 0
```

**Step 2: Compiler tracks variable access per context**

The compiler analyzes which variables are accessed by which ISRs and main code. This extends the existing tracking needed for ADR-049 atomic enforcement.

**Step 3: Ceiling computed automatically**

```
ceiling(variable) = max(priority of all ISRs accessing variable)
```

Example:

- `shared_buffer` accessed by UART_RX (pri 2) and CAN_RX (pri 4)
- `ceiling(shared_buffer) = max(2, 4) = 4`

**Step 4: Critical section uses computed ceiling**

```cnx
critical {
    shared_buffer[idx] <- data;
    idx +<- 1;
}
// Compiler computes: ceiling = max(ceiling(shared_buffer), ceiling(idx))
```

#### Transpiled Output

**On M3/M4/M7 (has BASEPRI):**

```c
// ceiling computed to 4
uint32_t __basepri = __get_BASEPRI();
__set_BASEPRI(4 << (8 - __NVIC_PRIO_BITS));
{
    shared_buffer[idx] = data;
    idx = idx + 1;
}
__set_BASEPRI(__basepri);
```

**On M0/M0+ (no BASEPRI):**

```c
// Falls back to PRIMASK (disables all interrupts)
uint32_t __primask = __cnx_get_PRIMASK();
__cnx_disable_irq();
{
    shared_buffer[idx] = data;
    idx = idx + 1;
}
__cnx_set_PRIMASK(__primask);
```

#### Benefits

| Benefit                    | Description                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| **Zero-latency ISRs**      | Higher-priority ISRs not accessing contested resources still fire |
| **Deadlock-free**          | Stack Resource Policy guarantees no circular waiting              |
| **No developer decisions** | Compiler computes optimal masking automatically                   |
| **Portable**               | Same source code works on M0 through M7                           |

#### Lock-Free Optimization

If all accessors have the **same priority**, no critical section overhead needed:

```cnx
// UART_RX (pri 2) and SPI_RX (pri 2) both access log_buffer
// Same priority = can't preempt each other
// Compiler generates volatile access only, no BASEPRI manipulation
```

#### Compiler Warnings

| Situation                                 | Warning                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| Critical section with main-only variables | "Critical section unnecessary - variables only accessed from main" |
| Function call inside critical             | "Function call in critical section - ceiling assumes worst case"   |

#### What the Compiler Tracks

| Information               | Source                                | Purpose                               |
| ------------------------- | ------------------------------------- | ------------------------------------- |
| ISR priorities            | `interrupt(priority: N)` or default 0 | Compute ceilings                      |
| Variable-to-context map   | Static analysis                       | Know which contexts access which vars |
| Critical section contents | AST analysis                          | Know which vars are protected         |
| Target capabilities       | `#pragma target`                      | BASEPRI vs PRIMASK                    |

**Rationale:**

This approach makes cnx shine by providing **correct-by-construction** concurrency:

- Developer writes simple `critical { }` blocks
- Compiler guarantees race-free, optimal code
- No manual priority calculations
- Works across all Cortex-M platforms

**References:**

- [RTIC Stack Resource Policy](https://rtic.rs/dev/book/en/by-example/resources.html)
- [RTIC Ceiling Priority](https://rtic.rs/2/book/en/)

### Q3: Where Can Critical Sections Be Used? ✓

**Decision: Allow everywhere, with context-aware automatic ceiling**

| Context               | Behavior                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Main code             | Uses computed ceiling (primary use case)                           |
| Inside ISR            | Uses computed ceiling (blocks higher-priority ISRs if needed)      |
| Inside scope function | Inherits context from caller, ceiling computed from all call sites |

#### ISR Example

```cnx
interrupt(priority: 2) UART_RX {
    critical {
        shared_buffer[idx] <- data;  // Also accessed by CAN_RX (pri 4)
        idx +<- 1;
    }
    // ceiling = 4, so BASEPRI blocks CAN_RX during critical section
}
```

This is valid - UART_RX needs protection from higher-priority CAN_RX.

#### Scope Function Example

```cnx
scope Logger {
    void log(u8 byte) {
        critical {
            buffer[idx] <- byte;
            idx +<- 1;
        }
    }
}

// Called from main and UART_RX (pri 2)
// Compiler computes ceiling from all call sites
```

#### Compiler Warning

If critical section inside ISR has no effect (ceiling = ISR's own priority):

```
warning[W0851]: Critical section in ISR has no effect
  --> myfile.cnx:15
   |
15 | critical {
   | ^^^^^^^^
   |
   = note: Variables accessed here are only used by this ISR (priority 2)
   = help: Remove critical section, or consider if higher-priority ISRs need access
```

**Rationale:**

- **Flexible otherwise** - don't restrict where developers can use it
- **Automatic ceiling** handles correctness in all contexts
- **Warnings** catch likely mistakes without blocking valid use cases

### Q4: Nesting Behavior ✓

**Decision: Allow nesting, handle correctly with save/restore pattern**

```cnx
void outer() {
    critical {
        inner();  // inner() has its own critical - that's OK
    }
}

void inner() {
    critical {
        // Nested critical section works correctly
    }
}
```

#### How Nesting Works

Each critical section saves and restores BASEPRI/PRIMASK independently. Inner critical sections only **raise** priority, never lower it:

```c
// Outer critical (ceiling = 4)
uint32_t outer_state = __get_BASEPRI();
__set_BASEPRI(4);
{
    // Inner critical (ceiling = 2)
    uint32_t inner_state = __get_BASEPRI();
    // Only raise priority, never lower (4 > 2, so no change)
    if (2 > inner_state) {
        __set_BASEPRI(2);
    }
    {
        // Inner code
    }
    __set_BASEPRI(inner_state);  // Restore to outer's level
}
__set_BASEPRI(outer_state);  // Restore original
```

#### Why This Is Safe

| Scenario                      | Behavior                                           |
| ----------------------------- | -------------------------------------------------- |
| Inner ceiling > outer ceiling | Inner raises BASEPRI higher, then restores         |
| Inner ceiling ≤ outer ceiling | Inner leaves BASEPRI unchanged (already protected) |

The key insight: inner critical sections can only provide **more** protection, never less.

#### Optional Warning (off by default)

```
warning[W0852]: Nested critical sections detected
  --> myfile.cnx:5
   |
 5 | critical {
   | ^^^^^^^^
   |
   = note: inner() at line 6 contains a critical section
   = help: Consider restructuring to avoid nesting if performance is critical
```

**Rationale:**

- **Works correctly** - save/restore pattern handles all cases
- **No artificial restrictions** - developers can nest if needed
- **Flexible** - optional warning for performance-conscious code

### Q5: Control Flow Inside Critical Sections ✓

**Decision: Forbid early exits (`return`, `break`, `continue`) inside critical blocks**

Critical sections must have exactly one exit point: the end of the block. This aligns with MISRA's single entry/exit point preference and cnx's "wrong thing impossible" ethos.

#### Compile Errors

```cnx
u32 getValue() {
    critical {
        return shared_value;  // ERROR
    }
}
```

```
error[E0853]: Cannot use 'return' inside critical section
  --> myfile.cnx:3
   |
 3 |         return shared_value;
   |         ^^^^^^
   |
   = note: Critical sections must have exactly one exit point (end of block)
   = help: Assign to a variable inside critical, then return after:
   |
   |     u32 result;
   |     critical {
   |         result <- shared_value;
   |     }
   |     return result;
```

```
error[E0854]: Cannot use 'break' inside critical section
error[E0855]: Cannot use 'continue' inside critical section
```

| Code  | Meaning                              | Fixtures                                                                                                                                                     |
| ----- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E0853 | A `return` inside a `critical` block | `return-in-critical-error`, `return-in-critical-switch-error`, `return-in-critical-scope-method-error`, `imported-direct-error`, `imported-transitive-error` |

#### Workaround Patterns

**Pattern 1: Assign and check after**

```cnx
u32 getValue() {
    u32 result <- 0;
    critical {
        result <- shared_value;
    }
    return result;
}
```

**Pattern 2: Flag for loop control**

```cnx
bool done <- false;
while (!done) {
    critical {
        if (shouldStop) {
            done <- true;
        } else {
            processItem();
        }
    }
}
```

**Pattern 3: Conditional state machine**

```cnx
bool started <- false;
critical {
    if (state == IDLE) {
        state <- RUNNING;
        started <- true;
    }
}
if (started) {
    // Handle successful start
}
```

#### Why Forbid Instead of Auto-Restore?

| Approach                  | Pros                                    | Cons                          |
| ------------------------- | --------------------------------------- | ----------------------------- |
| Auto-restore on all exits | Developer convenience                   | Complex codegen, hides issues |
| **Forbid early exits**    | Simple codegen, MISRA aligned, explicit | Slightly more verbose         |

The workarounds make code **clearer** - the reader sees exactly what happens before and after the critical section.

**Rationale:**

1. **Wrong thing impossible** - Can't accidentally leave interrupts disabled
2. **MISRA alignment** - Single entry/exit point principle
3. **Simple codegen** - No complex cleanup logic needed
4. **Explicit is better** - Developer sees exactly what's protected

### Q6: Maximum Length / Complexity Warnings ✓

**Decision: Deferred to v2 (ADR-102)**

For v1, critical section complexity is the developer's responsibility. cnx trusts the developer to keep critical sections short.

**Rationale:**

1. **MVP focus** - v1 already has complex features (automatic ceiling priority)
2. **Developer responsibility** - Embedded developers understand latency tradeoffs
3. **No false positives** - Avoids warning fatigue from arbitrary limits
4. **v2 opportunity** - Cycle estimation and WCET analysis are rich features for later

**v2 Features (ADR-102):**

- Opt-in complexity warnings
- Cycle estimation with `@max_cycles(N)` annotation
- Runtime instrumentation for debugging
- Integration with static analysis tools

See [ADR-102: Critical Section Complexity Analysis](adr-102-critical-section-analysis.md) for v2 planning.

### Q7: Can Critical Be an Expression? ✓

**Decision: Statement form only**

```cnx
critical {
    buffer[write_idx] <- data;
    write_idx +<- 1;
}
```

**Rationale:**

Critical sections exist for **multi-variable operations**. Single-value access is already handled by `atomic` types (ADR-049):

```cnx
atomic u32 shared_data <- 0;
u32 value <- shared_data;  // Already atomic, no critical needed
```

Expression form would encourage putting complex logic inside critical sections to get a return value—the **opposite** of the "keep critical sections short" best practice.

**Use Cases:**

| Need                         | Solution                                        |
| ---------------------------- | ----------------------------------------------- |
| Single-value atomic access   | Use `atomic` type (ADR-049)                     |
| Multi-variable atomic update | Use `critical { }` statement                    |
| Conditional with result      | Assign to variable inside critical, check after |

**Example - conditional state transition:**

```cnx
bool started <- false;
critical {
    if (state == IDLE) {
        state <- RUNNING;
        started <- true;
    }
}
if (started) {
    // Handle successful start
}
```

### Q8: Platform Fallback ✓

**Decision: Automatic fallback to PRIMASK on M0/M0+**

Since Q2 uses automatic ceiling computation, platform fallback is handled transparently:

| Target   | Mechanism | Behavior                                       |
| -------- | --------- | ---------------------------------------------- |
| M3/M4/M7 | BASEPRI   | Uses computed ceiling priority                 |
| M0/M0+   | PRIMASK   | Disables all interrupts (no BASEPRI available) |

**No warning needed** - the same source code produces correct behavior on all platforms. The M0 code is slightly less optimal (blocks all interrupts instead of selective masking) but is still correct.

**Rationale:**

The developer shouldn't need to know or care about BASEPRI vs PRIMASK. cnx generates the best possible code for the target platform automatically. This aligns with "right thing easy" - write once, works everywhere.

> **Added 2026-10-17 (#1789, owner ruling recorded on the issue).** "Works everywhere" holds for every target whose description has `interrupt_mask: true`. On a target where disabling interrupts does not shut out every other execution context, a `critical` block has no lowering and is rejected, not compiled as a plain block. That covers host (user space cannot disable interrupts) and esp32 (it can, but only on one of its two cores; multi-core exclusion stays with ADR-100):
>
> ```
> error[E0916]: target 'host' has no critical section: disabling interrupts there does not shut out every other execution context
> ```
>
> An atomic variable's read-modify-write needs no critical block there: ADR-049 lowers it to a compare-exchange loop.

---

## Questions Summary

### All Questions Resolved ✓

| Q#  | Question            | Decision                                                 |
| --- | ------------------- | -------------------------------------------------------- |
| Q1  | Syntax              | Block statement `critical { }`                           |
| Q2  | PRIMASK vs BASEPRI  | Automatic ceiling priority with PRIMASK fallback         |
| Q3  | Where allowed       | Everywhere (main, ISR, scope) with context-aware ceiling |
| Q4  | Nesting             | Allowed, safe via save/restore pattern                   |
| Q5  | Control flow        | Forbid early exits (return/break/continue)               |
| Q6  | Complexity warnings | Deferred to v2 (ADR-102)                                 |
| Q7  | Expression form     | Statement only                                           |
| Q8  | Platform fallback   | Automatic (BASEPRI on M3+, PRIMASK on M0)                |

---

## When to Use What: volatile vs atomic vs critical

Developers often confuse these three mechanisms. Here's a decision tree:

### Decision Tree

```
Is the variable shared between ISR and main code?
├── No → Use normal variable (no special handling)
└── Yes → Is it a single-variable operation?
    ├── Yes → Is it just a load or store?
    │   ├── Yes, and naturally atomic size (u8, aligned u32) → `atomic` type
    │   └── Yes, but needs RMW (increment, etc.) → `atomic` type
    └── No, multiple variables must update together → `critical { }`
```

### Comparison

| Mechanism      | Purpose                             | When to Use                             |
| -------------- | ----------------------------------- | --------------------------------------- |
| `volatile` (C) | Prevent compiler optimization       | **Never in cnx** - use `atomic` instead |
| `atomic`       | Single-variable ISR-safe operations | Counters, flags, single values          |
| `critical { }` | Multi-variable atomic updates       | State machines, buffer + index pairs    |

### Examples

```cnx
// Single flag - use atomic
atomic bool dataReady <- false;

// Single counter - use atomic
atomic wrap u32 tickCount <- 0;

// Buffer + index must update together - use critical
u8[64] buffer;
u32 writeIdx <- 0;

critical {
    buffer[writeIdx] <- data;
    writeIdx +<- 1;
}
```

### Why Not `volatile`?

cnx doesn't have a `volatile` keyword. Here's why:

| C's `volatile`      | cnx Alternative                         |
| ------------------- | --------------------------------------- |
| Prevents caching    | `atomic` provides this + atomicity      |
| For MMIO registers  | Register bindings (ADR-004) handle this |
| For ISR-shared data | `atomic` or `critical` required         |

cnx's type system makes the right thing explicit rather than relying on a modifier that's often misunderstood.

---

## Testing Recommendations

While cnx provides compile-time safety guarantees, testing remains important.

### What cnx Guarantees

- **No data races on atomic variables** - compiler enforces atomic operations
- **No forgotten interrupt restore** - Q5 forbids early exits
- **Optimal masking** - automatic ceiling computation

### What Still Needs Testing

| Concern                | Testing Approach                             |
| ---------------------- | -------------------------------------------- |
| Logic correctness      | Unit tests with mocked ISR calls             |
| Timing requirements    | Measure actual critical section duration     |
| Priority configuration | Verify ISR priorities match design           |
| Edge cases             | Test boundary conditions (buffer full, etc.) |

### Testing Patterns

**Pattern 1: Simulated ISR for unit tests**

```cnx
// Test file
void test_buffer_update() {
    // Simulate what ISR would do
    critical {
        buffer[writeIdx] <- 0x42;
        writeIdx +<- 1;
    }
    assert(buffer[0] == 0x42);
    assert(writeIdx == 1);
}
```

**Pattern 2: Timing measurement (debug builds)**

```cnx
// Measure critical section duration
u32 start <- get_cycle_count();
critical {
    // ... operations ...
}
u32 cycles <- get_cycle_count() - start;
assert(cycles < MAX_ALLOWED_CYCLES);
```

**Pattern 3: Priority verification**

```cnx
// Verify ISR priorities at startup
void verify_priorities() {
    assert(NVIC_GetPriority(UART_IRQn) == 2);
    assert(NVIC_GetPriority(CAN_IRQn) == 4);
}
```

### Future: ADR-102

ADR-102 (v2) will explore compiler-assisted analysis including cycle estimation and runtime instrumentation for more sophisticated testing support.

---

## Scope-context matrix

<!-- MATRIX-SEVERITY code: E0853 -->

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

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0853 rejects a `return` inside a critical section as written, so it cannot occupy one; its cross-file case is the provider side.

off: `global variable`, `scope member` and `for header` -- a `critical` block and a `return` are statements, so they cannot be written at file scope, as a scope member or inside a `for` header's declaration, which holds only a type, a name and an expression (all parse errors); a `return` in the body of a `for` loop inside a `critical` block is reported in the enclosing function, and E0853 has nowhere else to fire.

Every `error` cell is occupied: `return-in-critical-error` and
`return-in-critical-switch-error` for a top-level function in the same file,
`return-in-critical-scope-method-error` for a scope method, and
`imported-direct-error` / `imported-transitive-error` for both contexts with the
guarded value one and two include hops away. The rule is lexical, so an include
must not change the answer; those two fixtures are what show it does not.

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [ADR-049: Atomic Types](adr-049-atomic-types.md) - Related ADR
- [ARM Cortex-M Interrupt Priorities](https://www.state-machine.com/cutting-through-the-confusion-with-arm-cortex-m-interrupt-priorities)
- [RTIC Resource Locking](https://rtic.rs/)
- [CMSIS Core](https://arm-software.github.io/CMSIS_5/Core/html/group__intrinsic__CPU__gr.html)
