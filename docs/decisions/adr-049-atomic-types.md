# ADR-049: Atomic Types

**Status:** Implemented
**Date:** 2026-01-03
**Accepted:** 2026-01-04
**Implemented:** 2026-01-06
**Decision Makers:** cnx Language Design Team
**Parent ADR:** [ADR-009: ISR Safety](adr-009-isr-safety.md)

## Context

When sharing data between ISRs and main code, normal variable access is unsafe due to:

- **Torn reads/writes**: Multi-byte values partially updated
- **Read-Modify-Write races**: ISR fires between read and write phases
- **Compiler reordering**: Optimizer caches values or reorders accesses

cnx needs a way to declare variables that are safe for ISR/main sharing, with the compiler generating appropriate code for the target platform.

### Related ADRs

- **ADR-009**: Parent ADR covering overall ISR safety strategy
- **ADR-050**: Critical sections (for complex multi-variable operations)
- **ADR-104**: ISR-safe queues (for producer-consumer patterns)

---

## Research Findings

### What Makes an Operation Atomic?

| Operation Type                 | Naturally Atomic?   | Notes                                    |
| ------------------------------ | ------------------- | ---------------------------------------- |
| Single-byte read/write         | Yes (all platforms) | `u8` is always atomic                    |
| 32-bit aligned read/write      | Yes (Cortex-M3+)    | Single LDR/STR instruction               |
| Read-Modify-Write (e.g., `++`) | No                  | Requires LDREX/STREX or critical section |
| 64-bit operations              | No                  | Always requires synchronization          |

### Platform Capabilities

_(Corrected 2026-09-26, #1668: Cortex-M0+ is ARMv6-M, which has no exclusive-access instructions. This table and the old target list both said it had them.)_

| Feature                   | M0  | M0+ | M3/M4/M7 |
| ------------------------- | --- | --- | -------- |
| LDREX/STREX               | No  | No  | Yes      |
| PRIMASK (disable all IRQ) | Yes | Yes | Yes      |
| BASEPRI (selective IRQ)   | No  | No  | Yes      |

### How Other Languages Handle Atomics

**C++ `std::atomic<T>`:**

```cpp
std::atomic<uint32_t> counter{0};
counter.fetch_add(1, std::memory_order_relaxed);
uint32_t value = counter.load();
```

**Zig atomics:**

```zig
var counter: u32 = 0;
_ = @atomicRmw(u32, &counter, .Add, 1, .SeqCst);
const value = @atomicLoad(u32, &counter, .SeqCst);
```

**Rust `AtomicU32`:**

```rust
static COUNTER: AtomicU32 = AtomicU32::new(0);
COUNTER.fetch_add(1, Ordering::Relaxed);
let value = COUNTER.load(Ordering::Relaxed);
```

### Common Atomic Operations

All three languages provide similar operations:

| Operation | C++                   | Rust                  | Zig                 | Description             |
| --------- | --------------------- | --------------------- | ------------------- | ----------------------- |
| Load      | `.load()`             | `.load()`             | `@atomicLoad`       | Read value              |
| Store     | `.store()`            | `.store()`            | `@atomicStore`      | Write value             |
| Add       | `.fetch_add()`        | `.fetch_add()`        | `@atomicRmw(.Add)`  | Add and return old      |
| Sub       | `.fetch_sub()`        | `.fetch_sub()`        | `@atomicRmw(.Sub)`  | Subtract and return old |
| CAS       | `.compare_exchange()` | `.compare_exchange()` | `@cmpxchg`          | Compare and swap        |
| Exchange  | `.exchange()`         | `.swap()`             | `@atomicRmw(.Xchg)` | Swap and return old     |

### Memory Ordering

C++, Rust, and Zig all expose memory ordering semantics:

| Ordering | Description                                | Use Case                    |
| -------- | ------------------------------------------ | --------------------------- |
| Relaxed  | No ordering guarantees                     | Single-threaded or counters |
| Acquire  | Reads after this see writes before release | Lock acquisition            |
| Release  | Writes before this visible after acquire   | Lock release                |
| SeqCst   | Full sequential consistency                | When in doubt               |

**Question:** Does cnx need to expose memory ordering, or is single-core embedded simple enough to always use one ordering?

---

## Design Questions

### Q1: Syntax for Declaring Atomic Variables

**Option A: Keyword modifier**

```cnx
atomic u32 counter <- 0;
```

**Option B: Generic type**

```cnx
Atomic<u32> counter <- 0;
```

**Option C: Type suffix**

```cnx
u32_atomic counter <- 0;
```

### Q2: Syntax for Atomic Operations

**Option A: Method syntax**

```cnx
u32 value <- counter.load();
counter.store(42);
counter.increment();
```

**Option B: Function syntax**

```cnx
u32 value <- atomic_load(counter);
atomic_store(counter, 42);
atomic_increment(counter);
```

**Option C: Operator overloading with explicit RMW**

```cnx
u32 value <- counter;           // Atomic load
counter <- 42;                   // Atomic store
counter +<- 1;                   // Atomic increment (new operator)
```

### Q3: Should Direct Assignment Be Allowed?

**Option A: Error on direct access (force explicit operations)**

```cnx
atomic u32 x <- 0;
x <- 5;           // ERROR: Use x.store(5)
x <- x + 1;       // ERROR: Use x.increment()
```

**Option B: Allow direct access (implicit atomic)**

```cnx
atomic u32 x <- 0;
x <- 5; // OK: Generates atomic store
x <- x + 1; // OK: Generates atomic RMW
```

### Q4: Which Types Can Be Atomic?

| Type     | Atomic-Capable? | Notes                                       |
| -------- | --------------- | ------------------------------------------- |
| u8, i8   | ?               | Always naturally atomic                     |
| u16, i16 | ?               | Platform-dependent                          |
| u32, i32 | ?               | Naturally atomic on 32-bit, RMW needs LDREX |
| u64, i64 | ?               | Never naturally atomic on 32-bit            |
| f32, f64 | ?               | Floats typically not supported              |
| bool     | ?               | Could alias to u8                           |
| Structs  | ?               | Generally too complex                       |
| Pointers | ?               | Platform word size                          |

### Q5: Memory Ordering Exposure

**Option A: Always sequentially consistent**

- Simplest, safest, slight performance cost
- Most embedded is single-core where this doesn't matter

**Option B: Always relaxed**

- Best performance
- Safe for single-core, dangerous if ever multi-core

**Option C: Expose ordering as parameter**

```cnx
counter.load(Ordering.Relaxed);
counter.store(42, Ordering.Release);
```

**Option D: Context-dependent default**

- ISR access uses one ordering
- Main access uses another

### Q6: Code Generation for Different Platforms

How does the compiler know which intrinsics to emit?

_(Corrected 2026-09-26, #1668: Cortex-M0+ is ARMv6-M and has no LDREX/STREX, so it uses the critical section like Cortex-M0.)_

_(Corrected 2026-10-19, owner ruling on #2155: a float takes the critical section on an `ldrex_strex` target. The LDREX/STREX loop would read a `float` through a `uint32_t` lvalue, which C11 6.5p7 makes undefined, and CMSIS has no float form. A compound write and a bit write to an `atomic f32` already emitted the critical section; the table said otherwise.)_

_(Corrected 2026-10-17, #1789: the table named only Cortex rows. The form is chosen from the target description's `ldrex_strex` and `interrupt_mask`, not from the platform's name.)_

| Platform                                                     | RMW Implementation                   |
| ------------------------------------------------------------ | ------------------------------------ |
| Cortex-M3+ (`ldrex_strex`, 8/16/32-bit integer types)        | LDREX/STREX loop                     |
| Cortex-M0+, Cortex-M0, a wider type or a float on Cortex-M3+ | Critical section (PRIMASK)           |
| AVR (atmega328p)                                             | Critical section (SREG)              |
| host, esp32 (`interrupt_mask: false`)                        | GNU `__atomic` compare-exchange loop |

_(Clarified 2026-10-18, #2200: a bit, a bit range or a bitmap field written to an `atomic` value, `word[1] <- true`, `word[2, 3] <- 5`, `flags.Mode <- 3`, is a read-modify-write of the whole value, so it takes the row's form too, in every spelling of the value. A bitmap is accessed as its backing integer (Q4). These writes were emitted as a plain read-modify-write.)_

A retry loop evaluates the value once, before the loop (#1807). On esp32, a type wider than `word_size` makes GCC call libatomic's `__atomic_*_N`, which the output's requirements list.

**Related question:** How does cnx know the target platform? (See ADR-009 Q6)

### Q7: Atomic Variables in Scopes

```cnx
scope Counter {
    atomic u32 value <- 0;

    void increment() {
        this.value.???();  // How does this work?
    }
}
```

How do atomic operations interact with the `scope` system?

---

## Resolved Questions

### Q1: Declaration Syntax ✓

**Decision: Keyword modifier**

```cnx
atomic u32 counter <- 0;
atomic u8 flags <- 0;
atomic bool ready <- false;
```

**Rationale:**

- Senior C developers can understand it in 30 seconds
- Consistent with cnx's `clamp`/`wrap` modifier pattern
- Makes `atomic` a first-class citizen in the language
- Clear and explicit without being verbose

_(Clarified 2026-10-19, owner ruling on #2233: `atomic` implies ADR-071's `mut`. Only a value something writes can be torn, so an `atomic` nothing writes protects nothing, and these examples declare writable bindings as written. `atomic mut` is E0919, as `atomic volatile` is E0889. An `atomic` local or private scope member nothing writes is ADR-071's E0899, which asks for `atomic` to be removed.)_

### Q2 & Q3: Operation Syntax ✓

**Decision: Natural syntax with type-level behavior**

```cnx
// Declaration combines atomic + overflow behavior
atomic clamp u8 brightness <- 0;
atomic wrap u32 counter <- 0;
atomic bool ready <- false;

// Operations use standard cnx syntax
brightness +<- 10; // Atomic add with clamp
counter +<- 1; // Atomic add with wrap
ready <- true; // Atomic store
u32 val <- counter; // Atomic load
```

**Key Insight: Behavior Belongs to the Type**

cnx already has `clamp` and `wrap` modifiers that define overflow behavior at the type level. Atomic operations work the same way—the **type** carries the behavior, not the operation site.

When you write `brightness +<- 10` on an `atomic clamp u8`, the transpiler generates:

**For Cortex-M3+ (has LDREX/STREX):**

```c
// Atomic add-with-clamp, hidden retry loop
do {
    uint8_t old = __LDREXB(&brightness);
    uint8_t new_val = old + 10;
    if (new_val < old) new_val = 255;  // Overflow = clamp
} while (__STREXB(new_val, &brightness) != 0);
```

**For Cortex-M0 (no LDREX/STREX):**

```c
// Critical section fallback
uint32_t primask = __get_PRIMASK();
__disable_irq();
uint8_t old = brightness;
uint8_t new_val = old + 10;
if (new_val < old) new_val = 255;
brightness = new_val;
__set_PRIMASK(primask);
```

Multiple ISRs can call `brightness +<- 10`—the retry loop ensures each operation completes correctly even if interrupted.

**No Explicit CAS/fetchAdd Methods Needed**

Other languages (C++, Rust, Zig) expose operations like `fetchAdd()`, `compareExchange()`, etc. cnx takes a different approach:

| Concern                   | Who Handles It               |
| ------------------------- | ---------------------------- |
| Atomicity                 | `atomic` keyword             |
| Overflow behavior         | `clamp`/`wrap` modifier      |
| Retry loops (LDREX/STREX) | Transpiler (hidden)          |
| Platform differences      | Transpiler (hidden)          |
| Conditional logic         | Developer via `critical { }` |

**Simple operations** (arithmetic, flags) → Type handles it automatically

**Complex conditional operations** (check-then-act) → Use critical blocks (ADR-050)

```cnx
// Simple: type handles atomicity and clamping
atomic clamp u8 brightness <- 250;
brightness +<- 10;  // Just works, safely

// Complex: conditional state transition needs critical block
atomic State machineState <- State.IDLE;
critical {
    if (machineState = State.IDLE) {
        machineState <- State.RUNNING;
    }
}
```

**Why Not Expose CAS?**

Compare-And-Swap (CAS) is the primitive that enables lock-free algorithms. It atomically checks "is the value what I expect?" and only writes if true.

For most embedded use cases, CAS isn't needed:

| Use Case                 | cnx Solution                              | Needs CAS? |
| ------------------------ | ----------------------------------------- | ---------- |
| Atomic counter           | `atomic wrap u32` + `counter +<- 1`       | No         |
| Bounded value            | `atomic clamp u8` + `brightness +<- 5`    | No         |
| Flag                     | `atomic bool` + `flag <- true`            | No         |
| State machine transition | `critical { if (state = X) state <- Y; }` | No         |

The retry loop inside the transpiled code IS using CAS-like hardware (LDREX/STREX), but the developer never sees it. For conditional logic that doesn't fit simple arithmetic, `critical { }` blocks provide a clear, explicit solution.

### Q4: Which Types Can Be Atomic? ✓

**Decision: All scalar types allowed. Transpiler handles platform differences.**

| Type          | Allowed? | 32-bit MCU (Cortex-M)                        | 8-bit MCU (AVR)               |
| ------------- | -------- | -------------------------------------------- | ----------------------------- |
| u8, i8, bool  | ✓        | Natural                                      | Natural                       |
| u16, i16      | ✓        | Natural                                      | Critical section              |
| u32, i32      | ✓        | Natural load/store, LDREX/STREX for RMW      | Critical section              |
| f32           | ✓        | Natural load/store, critical section for RMW | Critical section              |
| u64, i64, f64 | ✓        | Critical section (document cost)             | Critical section              |
| Enums         | ✓        | Inherits from underlying type                | Inherits from underlying type |
| bitmap8/16/32 | ✓        | Same as underlying integer                   | Same as underlying integer    |
| Structs       | ✗        | Use `critical { }` block                     | Use `critical { }` block      |
| Arrays        | ✗        | Use `critical { }` block                     | Use `critical { }` block      |

**Guiding Principle**: cnx makes the right thing easy, the wrong thing impossible, and remains flexible in between.

- 64-bit atomics on 32-bit platforms are **expensive but not wrong**
- Atomic floats are **uncommon but not wrong**
- The type declares **intent**, the transpiler makes it **safe for the target**

_(Corrected 2026-10-19, owner ruling on #2155: `f32` was listed with `u32` and `i32` as LDREX/STREX for a read-modify-write. A float's is the critical section, for the reason Q6 gives.)_

**Examples:**

```cnx
// All valid atomic declarations
atomic u8 flags <- 0;
atomic u32 counter <- 0;
atomic u64 timestamp <- 0;        // Expensive on 32-bit, but allowed
atomic f32 temperature <- 0.0;    // Uncommon, but valid
atomic bool ready <- false;

// Enums inherit atomic capability
enum State : u8 { IDLE, RUNNING, STOPPED }
atomic State machineState <- State.IDLE;  // Works like atomic u8

// Combined with overflow modifiers
atomic clamp u8 brightness <- 0;
atomic wrap u32 tickCount <- 0;

// NOT allowed - use critical blocks instead
// atomic MyStruct data;           // ERROR: structs not atomic
// atomic u8[16] buffer;           // ERROR: arrays not atomic
```

**Documentation Note**: 64-bit atomics on 32-bit platforms require disabling interrupts for every access. Use when correctness matters more than latency. Consider whether a `critical { }` block around multiple operations might be clearer.

### Q5: Memory Ordering ✓

**Decision: SeqCst always, no user-facing ordering options. Compiler enforces atomic access for ISR-shared variables.**

**Key Insight: Wrong Thing Impossible**

The memory ordering question becomes mostly irrelevant when cnx enforces a stronger rule: **non-atomic variables accessed from both ISR and main code are a compile error.**

| Variable Access Pattern           | cnx Response         |
| --------------------------------- | -------------------- |
| Only in main code                 | OK (no ISR concern)  |
| Only in ISR(s)                    | OK (no main concern) |
| Both ISR and main, **atomic**     | OK ✓                 |
| Both ISR and main, **non-atomic** | **COMPILE ERROR**    |
| Inside `critical { }` block       | OK (protected)       |

**Example of what cnx prevents:**

```cnx
atomic bool dataReady <- false;
u32 sharedData <- 0;  // NOT atomic

interrupt Producer {
    sharedData <- 42;      // ERROR: non-atomic variable 'sharedData' accessed
                           //        from ISR but also accessed from main context
    dataReady <- true;
}

void main() {
    if (dataReady) {
        u32 val <- sharedData;  // Also accessed here - compiler detects the conflict
    }
}
```

**Correct version:**

```cnx
atomic bool dataReady <- false;
atomic u32 sharedData <- 0;  // Now atomic

interrupt Producer {
    sharedData <- 42;      // OK: atomic store with SeqCst ordering
    dataReady <- true;     // OK: atomic store with SeqCst ordering
}

void main() {
    if (dataReady) {
        u32 val <- sharedData;  // OK: atomic load with SeqCst ordering
    }
}
```

**Why SeqCst Always?**

1. **Correct by construction** — SeqCst (Sequential Consistency) is always safe
2. **Future-proof** — Works correctly when cnx expands to multi-core
3. **No cognitive burden** — Developers don't need to understand Acquire/Release/Relaxed
4. **Minimal overhead** — On single-core Cortex-M, memory barriers are ~1-3 cycles

**What about Relaxed ordering for performance?**

Deferred to v2+. If profiling shows SeqCst is a bottleneck on multi-core targets, we could add:

```cnx
relaxed atomic u32 fastCounter <- 0;  // Expert opt-in, v2+
```

For v1, the simplicity of "all atomics are SeqCst" outweighs micro-optimization.

**The cnx Philosophy Applied:**

- **Right thing easy**: Just mark shared variables as `atomic`
- **Wrong thing impossible**: Compiler prevents non-atomic ISR access
- **Flexible in between**: Use `critical { }` for complex multi-variable operations

### Q6: Target Platform Specification ✓

> **Rewritten 2026-09-26 (#1668), by owner ruling.** The previous text decided "capability-based with named aliases": three facts (word size, LDREX/STREX, BASEPRI), a table of names, the precedence below, and an error when no target is found. The owner ruled that this precedence and the missing-target error are right, and that the code, which did neither, must follow them. The same rulings widened a target to a complete description and moved the named targets into a published catalog. Three statements in the old text were wrong and are corrected: Cortex-M0+ had LDREX/STREX, the example error code E0802 belongs to a different diagnostic, and the ADR carried its own list of targets.

**Decision: every program names exactly one target, and a target is a complete description of the platform facts the language depends on.**

#### Why a target is required

Atomic lowering (this ADR), selective interrupt masking (ADR-050), the width of a C or C++ header's `int`, `long` and `size_t` operands (ADR-024), and the identifier-significance limits of MISRA C:2012 Rules 5.1 and 5.9 all depend on the platform. A program with no target has no defined meaning, so it is rejected.

#### The target description (schema version 2)

A target description gives every one of these facts. None is optional, except the two toolchain fields.

_(Schema version 2, 2026-10-17, #1789: adds `interrupt_mask`. A compiler that reads version 1 rejects the new catalog by its version, as the rule below says, rather than for an unknown member.)_

| Field                       | Kind              | Allowed         | Meaning                                                                                                                                                                     |
| --------------------------- | ----------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                      | string            | one pragma word | the target's name (catalog only)                                                                                                                                            |
| `word_size`                 | unsigned integer  | 8, 16, 32, 64   | the widest naturally atomic access                                                                                                                                          |
| `ldrex_strex`               | Boolean           |                 | exclusive-access read-modify-write instructions exist                                                                                                                       |
| `basepri`                   | Boolean           |                 | selective interrupt masking exists (ADR-050)                                                                                                                                |
| `interrupt_mask`            | Boolean           |                 | disabling interrupts shuts out every other execution context (one core), through a mechanism the ADR-050 IRQ wrappers lower; `false` makes a `critical` block E0916 (#1789) |
| `char_bits`                 | unsigned integer  | 8               | a platform with a wider `char` is rejected explicitly                                                                                                                       |
| `char_signed`               | Boolean           |                 | plain `char` is signed                                                                                                                                                      |
| `short_bits`                | unsigned integer  | 16              |                                                                                                                                                                             |
| `int_bits`                  | unsigned integer  | 16, 32          |                                                                                                                                                                             |
| `long_bits`                 | unsigned integer  | 32, 64          |                                                                                                                                                                             |
| `long_long_bits`            | unsigned integer  | 64              |                                                                                                                                                                             |
| `size_t_bits`               | unsigned integer  | 16, 32, 64      |                                                                                                                                                                             |
| `pointer_bits`              | unsigned integer  | 16, 32, 64      |                                                                                                                                                                             |
| `float_bits`                | unsigned integer  | 32              |                                                                                                                                                                             |
| `double_bits`               | unsigned integer  | 32, 64          |                                                                                                                                                                             |
| `long_double_bits`          | unsigned integer  | 32, 64, 96, 128 | storage size, at least `double_bits`                                                                                                                                        |
| `big_endian`                | Boolean           |                 |                                                                                                                                                                             |
| `external_identifier_chars` | unsigned integer  | at least 6      | MISRA C:2012 Rule 5.1                                                                                                                                                       |
| `internal_identifier_chars` | unsigned integer  | at least 31     | MISRA C:2012 Rule 5.9                                                                                                                                                       |
| `toolchain_triple`          | string (optional) |                 | a compiler configuration used to check generated code; never changes the program's meaning                                                                                  |
| `toolchain_cpu`             | string (optional) |                 | as above                                                                                                                                                                    |

A description must also satisfy C's relations: `short` ≤ `int` ≤ `long` ≤ `long long`, and `float` ≤ `double` ≤ `long double`.

#### Named targets

Named targets are published with the compiler as **one cnx source file**, the target catalog, which any conforming compiler reads as a cnx program:

- The file declares its schema version, and a compiler rejects a version it does not know.
- Each target is a `const TargetDescription` whose initializer gives every required field as a **literal**: an integer, `true` or `false`, or a string. No expression and no reference to another constant is allowed, so no compiler has to evaluate code to learn a target.
- A name that denotes the same platform as another is a `const TargetAlias`, which maps the name to that target's name. No fact is written twice.
- Names are strings, because a name such as `cortex-m0+` is not an identifier. They match **exactly**, with no case folding.
- The build machine is a target like any other, named `host`.
- Adding a target means adding one initializer to the catalog. **The catalog, not this ADR, lists the targets**, so there is no second list to drift.

#### Where the target comes from

```
1. Source: #pragma target <name>, or an inline description (below)
       ↓ (if not present)
2. The command-line target option (a project configuration's `target` is its default)
       ↓ (if not present)
3. The build system: PlatformIO, meaning the board of the environment being built
       ↓ (if not found)
4. COMPILER ERROR: the program names no target
```

Every name given in source or as the option must be a known target, even when a higher rung decides. A tool that only parses, such as an editor listing symbols, needs no target.

#### Pragma syntax

A pragma is `#pragma`, a key, and its values separated by spaces or tabs, all on one line, before any declaration:

- A key is a letter or underscore followed by letters, digits or underscores. A value is letters, digits, `_`, `.`, `+` and `-`.
- The keys are `target` and the description's field names except `name` and the toolchain fields. Each takes exactly one value.
- An integer field takes decimal digits, and a Boolean field takes `true` or `false`.
- Any other pragma is an error.

#### Inline description

A program's description pragmas together form one description, for a platform the catalog does not name:

```cnx
#pragma word_size 32
#pragma ldrex_strex true
#pragma basepri false
#pragma interrupt_mask true
#pragma char_bits 8
#pragma char_signed false
#pragma short_bits 16
#pragma int_bits 32
#pragma long_bits 32
#pragma long_long_bits 64
#pragma size_t_bits 32
#pragma pointer_bits 32
#pragma float_bits 32
#pragma double_bits 64
#pragma long_double_bits 64
#pragma big_endian false
#pragma external_identifier_chars 31
#pragma internal_identifier_chars 63

atomic u32 counter <- 0;
counter +<- 1;  // Generates the LDREX/STREX loop
```

- It must be complete, under the same rule as a catalog entry.
- It cannot be combined with `#pragma target`.

A partial description is an error that lists the missing fields. For a file whose only description pragma is `#pragma word_size 32`:

```
Error: myfile.cnx:1:0 error[E0514]: incomplete target description
       help: missing: ldrex_strex, basepri, interrupt_mask, char_bits, char_signed, short_bits, int_bits, long_bits, long_long_bits, size_t_bits, pointer_bits, float_bits, double_bits, long_double_bits, big_endian, external_identifier_chars, internal_identifier_chars. Either use '#pragma target <name>' or give every field (ADR-049).
```

#### One target per program

Every target declaration in a program, whether it is in the entry file or an included `.cnx`, must describe the same target, compared field by field. A file with no declaration takes the program's target.

#### Scope-context matrix

A target declaration appears before every declaration, so it lies in none of the matrix's four contexts, and target diagnostics occupy no cell.

### Q7: Atomics Within Scope ✓

**Decision: Works naturally with `this.` prefix, no special handling needed**

Given the decisions from Q1-Q3 (keyword modifier, natural syntax), atomics in scopes "just work":

```cnx
scope Counter {
    atomic wrap u32 value <- 0;

    void increment() {
        this.value +<- 1;  // Atomic increment with wrap
    }

    u32 get() {
        return this.value;  // Atomic load
    }

    void reset() {
        this.value <- 0;    // Atomic store
    }
}

// Usage
Counter.increment();
u32 count <- Counter.get();
```

**Scopes can mix atomic and non-atomic members:**

```cnx
scope Sensor {
    atomic bool dataReady <- false;    // Shared with ISR
    atomic f32 lastReading <- 0.0;     // Shared with ISR
    u32 readCount <- 0;                // Main-only, not atomic

    void onNewReading(f32 value) {     // Called from ISR
        this.lastReading <- value;
        this.dataReady <- true;
    }

    void process() {                   // Called from main
        if (this.dataReady) {
            f32 val <- this.lastReading;
            this.dataReady <- false;
            this.readCount +<- 1;      // Not atomic - only accessed from main
        }
    }
}
```

**Complex operations still use `critical { }`:**

```cnx
enum State : u8 { IDLE, RUNNING, STOPPED }

scope Motor {
    atomic State current <- State.IDLE;

    void start() {
        critical {
            if (this.current = State.IDLE) {
                this.current <- State.RUNNING;
            }
        }
    }

    void stop() {
        this.current <- State.STOPPED;  // Simple atomic store
    }
}
```

The compiler tracks ISR vs main access per-member, not per-scope, so mixed atomicity within a scope is fully supported.

---

## All Questions Resolved ✓

1. ~~What syntax for declaring atomic variables?~~ **RESOLVED: keyword modifier**
2. ~~What syntax for atomic operations?~~ **RESOLVED: natural syntax**
3. ~~Should direct assignment be allowed?~~ **RESOLVED: yes, type handles safety**
4. ~~Which primitive types can be atomic?~~ **RESOLVED: all scalars, structs/arrays use critical**
5. ~~Should memory ordering be exposed or hidden?~~ **RESOLVED: SeqCst always, compiler enforces atomic for ISR-shared**
6. ~~How is target platform specified?~~ **RESOLVED: a complete target description, named or inline** (rewritten 2026-09-26, #1668)
7. ~~How do atomics work within `scope`?~~ **RESOLVED: works naturally with `this.` prefix**

---

## Diagnostics

| Code  | Reported when                                                                                                               | Asserted by                                                                                                                                                                                                                                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0889 | A declaration carries both `atomic` and `volatile`                                                                          | `tests/adr-049/atomic-volatile-error.test.cnx`, `atomic-volatile-in-scope-member-error.test.cnx`, `atomic-volatile-in-function-error.test.cnx`, `atomic-volatile-in-scope-method-error.test.cnx`, `atomic-volatile-in-for-header-error.test.cnx`, `atomic-modifiers-imported-direct-error.test.cnx`, `atomic-modifiers-imported-transitive-error.test.cnx` |
| E0919 | A declaration carries both `atomic` and `mut` (#2233)                                                                       | `tests/adr-049/atomic-mut-error.test.cnx`, `atomic-mut-in-function-error.test.cnx`, `atomic-mut-in-scope-method-error.test.cnx`, `atomic-mut-in-for-header-error.test.cnx`, `atomic-modifiers-imported-direct-error.test.cnx`, `atomic-modifiers-imported-transitive-error.test.cnx`                                                                       |
| E0510 | A name given as a target, in source or as the target option, is not a known target                                          | `tests/bugs/issue-1668-targets/unknown-pragma.test.cnx`                                                                                                                                                                                                                                                                                                    |
| E0511 | Two target declarations in one program describe different platforms, or one names a target and another describes one inline | `tests/bugs/issue-1668-targets/conflicting-pragmas.test.cnx`, `target-and-inline.test.cnx`                                                                                                                                                                                                                                                                 |
| E0512 | A pragma's key is neither `target` nor a description field                                                                  | `tests/bugs/issue-1668-targets/pragma-unknown-key.test.cnx`                                                                                                                                                                                                                                                                                                |
| E0513 | A pragma's value is wrong in count, kind or range                                                                           | `tests/bugs/issue-1668-targets/pragma-bad-value.test.cnx`, `inline-bad-values.test.cnx`                                                                                                                                                                                                                                                                    |
| E0514 | An inline description leaves a field out                                                                                    | `tests/bugs/issue-1668-targets/inline-incomplete.test.cnx`                                                                                                                                                                                                                                                                                                 |
| E0515 | Nothing names the program's target: no pragma, no option, no build-system board                                             | `tests/bugs/issue-1668-targets/target-required/no-target.test.cnx`                                                                                                                                                                                                                                                                                         |

`atomic` is `volatile` plus the guarantee that a read or write cannot be torn,
so writing both says one of two different things and the author has to be asked
which. `atomic` also implies `mut` (#2233), so writing both is E0919. Both
rules are entirely syntactic -- two modifier tokens on one declaration -- so
they need no type, no scope and no symbols.

E0510 and E0511 are the two ways a program's one target can fail to exist
(Q6). E0510 is reported at the naming pragma, or on the entry file when the
option named it -- even when a pragma decides, because a misspelled option
is an error rather than a setting that happens to be overridden. E0511 is
reported at the declaration that disagrees with the first. Declarations agree
when they describe the same platform, whatever the names, so an alias agrees
with the target it names.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |

This table is the atomic form of a read-modify-write (Q2, Q6, #2200, #1179),
the one rule of this ADR with no diagnostic code. It fires at the WRITE, in a
top-level function or a scope method, and reads `atomic` from where the value
is DECLARED. An atomic value declared in an included file is as atomic as one
declared here, so those contexts are declared `error` in every column,
asserted by `atomic-across-include-direct` and
`atomic-across-include-transitive` (review of #2155).

off: a global's or a scope member's initializer cannot hold a write (`u32 b <- a +<- 1;` is a parse error), so the read-modify-write rule has no cell there.

<!-- MATRIX-SEVERITY code: E0889 -->

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

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0889 rejects a declaration's own `atomic volatile` modifiers, and that declaration is in the file being transpiled, so it cannot occupy one; its cross-file case is the provider side.

The rule reads only the declaration, so it fires in a file that includes others as in one that includes nothing; `atomic-modifiers-imported-direct-error` and `atomic-modifiers-imported-transitive-error` assert it in every context there.

E0889 is asserted on a global by `atomic-volatile-error`, on a scope member by
`atomic-volatile-in-scope-member-error`, on a local by
`atomic-volatile-in-function-error` and `atomic-volatile-in-scope-method-error`,
and on a loop variable by `atomic-volatile-in-for-header-error`.

<!-- MATRIX-SEVERITY code: E0919 -->

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

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0919 rejects a declaration's own `atomic mut` modifiers, and that declaration is in the file being transpiled, so it cannot occupy one; its cross-file case is the provider side.

The rule reads only the declaration, so it fires in a file that includes others as in one that includes nothing; `atomic-modifiers-imported-direct-error` and `atomic-modifiers-imported-transitive-error` assert it in every context there.

E0919 is asserted on a global and a scope member by `atomic-mut-error`, on a
local by `atomic-mut-in-function-error` and `atomic-mut-in-scope-method-error`,
and on a loop variable by `atomic-mut-in-for-header-error`.

<!-- MATRIX-SEVERITY code: E0510 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0510 is reported at a `#pragma`, which stands only at file scope (a pragma inside a function or a scope is a parse error), or on the entry file, so it lies in no declaration context.

<!-- MATRIX-SEVERITY code: E0511 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0511 is reported at a `#pragma`, which stands only at file scope (a pragma inside a function or a scope is a parse error), or on the entry file, so it lies in no declaration context.

<!-- MATRIX-SEVERITY code: E0512 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0512 is reported at a `#pragma`, which stands only at file scope (a pragma inside a function or a scope is a parse error), or on the entry file, so it lies in no declaration context.

<!-- MATRIX-SEVERITY code: E0513 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0513 is reported at a `#pragma`, which stands only at file scope (a pragma inside a function or a scope is a parse error), or on the entry file, so it lies in no declaration context.

<!-- MATRIX-SEVERITY code: E0514 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0514 is reported at a `#pragma`, which stands only at file scope (a pragma inside a function or a scope is a parse error), or on the entry file, so it lies in no declaration context.

<!-- MATRIX-SEVERITY code: E0515 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | off      |
| scope method       | same file               | off      |
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
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

off: E0515 is reported on the entry file (1:0), not at any declaration, so it lies in no declaration context.

## References

- [ADR-009: ISR Safety](adr-009-isr-safety.md) - Parent ADR
- [ARM LDREX/STREX](https://developer.arm.com/documentation/dht0008/a/ch01s02s01)
- [C++ std::atomic](https://en.cppreference.com/w/cpp/atomic/atomic)
- [Rust AtomicU32](https://doc.rust-lang.org/std/sync/atomic/struct.AtomicU32.html)
- [Zig Atomics](https://ziglang.org/documentation/master/#Atomics)
