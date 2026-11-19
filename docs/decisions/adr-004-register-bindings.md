# ADR-004: Type-Safe Register Bindings

**Status:** Implemented
**Date:** 2025-12-26
**Decision Makers:** cnx Language Design Team
**Superseded By:** ADR-072 (Safe Hardware Abstraction Primitives — Accepted; the supersession takes effect when ADR-072 Part 1 is implemented)

> **What is implemented, and what is not.** The register syntax this ADR defines —
> `NAME: type access @ offset` — and its `rw` / `ro` / `wo` access modifiers are
> implemented and enforced: reading a `wo` member is a compile error, as is writing
> an `ro` one. ADR-016 `### Scoped Registers` shows the same syntax inside a scope; it
> applies this ADR rather than competing with it.
>
> The `typedef struct { … } GPIOA_Registers;` shape in `## Initial Design Direction`
> below was **never implemented** and is illustrative, not normative — it sits beside
> `## Open Questions (Research Needed)`. A register emits one `#define` per field:
>
> ```c
> #define Teensy4__GPIO7__DR (*(volatile uint32_t*)(0x42004000U))
> ```
>
> So **a register is not a type** in the language as shipped, and that is enforced:
> a register name in a type position is rejected with **E0429**. It was accepted
> silently until then, emitting a declaration of a type that is never defined, so the
> generated C failed to compile while the transpiler reported success. E0429 is retired
> when ADR-072 is implemented, not when it is merely Accepted.
>
> It becomes a type under ADR-072, where a register definition is a parameterized type
> and the base address is supplied at instantiation (`SystemControl SCB(0xE000ED00);`).

## Context

Register definitions in embedded C are notoriously unreadable and error-prone. Opening a typical microcontroller library reveals thousands of lines like this:

```c
// From Teensy imxrt.h - What does this actually DO?
#define IMXRT_GPIO1_ADDRESS     0x401B8000
#define GPIO1_DR                (IMXRT_GPIO1.offset000)
#define GPIO1_GDIR              (IMXRT_GPIO1.offset004)
#define GPIO1_PSR               (IMXRT_GPIO1.offset008)
#define GPIO1_ICR1              (IMXRT_GPIO1.offset00C)

// Bit manipulation macros - hope you don't make a typo!
#define ADC_HC_AIEN             ((uint32_t)(1<<7))
#define ADC_HC_ADCH(n)          ((uint32_t)(((n) & 0x1F) << 0))
#define CCM_CACRR_ARM_PODF(n)   ((uint32_t)(((n) & 0x07) << 0))
```

This approach has critical problems:

1. **No context** — `GPIO1_DR` tells you nothing about what "DR" means (it's "Data Register")
2. **No type safety** — You can write any value to any register
3. **No access control** — Nothing stops you from writing to a read-only register
4. **No bounds checking** — `ADC_HC_ADCH(0xFF)` silently truncates to 5 bits
5. **MISRA violations** — Integer-to-pointer casts require formal deviations
6. **No IDE support** — Can't hover to see documentation

### The Current State is Painful

> "Unfortunately, this information can be difficult to read for non-engineers (and even for engineers too!)"
> — [PJRC: Teensy Datasheets](https://www.pjrc.com/teensy/datasheets.html)

> "Every port, pin, or internal device (like SPI, I2C or serial controllers) are represented by registers in the memory. In order to use them, you need to write to certain memory locations. To which addresses and what values you should write is specified in the manual."
> — [l0ner: Teensy the Hard Way](https://l0ner.github.io/2020-08-24_teensy-the-hard-way-blink/)

### MISRA Compliance is Difficult

MISRA C forbids direct integer-to-pointer casts (Rule 11.3/11.4):

> "MISRA doesn't like taking the integer value of an address and making it into a pointer... Rule 11.3 does at least recognize that this type of cast may be unavoidable for the reasons given."
> — [Embedded Related: MISRA Rule 45](https://embeddedrelated.com/showthread/comp.arch.embedded/26622-1.php)

Most embedded projects require formal deviations for every register access, which defeats the purpose of the safety guidelines.

---

## Research: How Other Languages Solve This

### Rust: svd2rust (Type-Safe Register Access)

Rust's embedded ecosystem uses `svd2rust` to generate type-safe register APIs from SVD files:

> "svd2rust is a tool that generates safe and type-rich Rust code for interacting with microcontroller peripherals. The main advantage is that it eliminates much of the manual effort involved in low-level hardware programming."
> — [Embedded.com: Creating Peripheral Access Crates](https://www.embedded.com/embedded-rust-creating-peripheral-access-crates-pacs/)

```rust
// Rust svd2rust generated code
// Clear, type-safe, with compile-time checks
dp.GPIOA.odr.modify(|_, w| w.odr0().set_bit());

// The API structure:
// - Peripherals struct with members for each peripheral
// - Each Peripheral has methods for each Register
// - Each Register has read(), write(), modify() methods
// - Each Register has typed Read (R) and Write (W) accessors
```

**Key Benefits:**

- Compile-time verification of valid register values
- Read-only registers have no `write()` method
- Bitfield values are constrained to valid ranges
- IDE autocomplete shows available fields

> "Where the auto-generated code isn't able to determine that all possible arguments are valid, the function is marked as unsafe."
> — [svd2rust documentation](https://docs.rs/svd2rust/)

### Zig: Explicit Volatile with Packed Structs

Zig takes a different approach with explicit volatile operations:

> "If a given load or store should have side effects, such as Memory Mapped Input/Output (MMIO), use volatile. Loads and stores with mmio_ptr are guaranteed to all happen and in the same order as in source code."
> — [Zig Documentation](https://ziglang.org/documentation/0.5.0/)

```zig
// Zig MMIO pattern
const GPIOA = @intToPtr(*volatile GPIO_Registers, 0x40020000);
GPIOA.ODR = 0x0001;  // Volatile write
```

The MicroZig framework provides higher-level abstractions:

> "The MicroZig MMIO interface 'feels high-level, but every call results in a single read-modify-write to a register.'"
> — [MicroZig](https://microzig.tech/)

### C++: Template-Based Type Safety

Several C++ libraries provide type-safe register access:

**regbits** (thanks4opensource):

> "Hardware does not support [atomic bit access], and with the exception of C bitfields, neither do the C and C++ languages. Regbits and other software techniques address these limitations."
> — [GitHub: regbits](https://github.com/thanks4opensource/regbits)

**Write-only enforcement:**

> "This month, I'll show you one simple, yet remarkably effective way you can use C++ to eliminate accidentally reading from write-only device registers. The trick is to define a write-only data type... using this class adds no run-time overhead. It just improves compile-time type checking."
> — [Embedded.com: Write-Only Access](https://www.embedded.com/how-to-enforce-write-only-access/)

### CMSIS-SVD: The Standard Format

ARM's CMSIS-SVD format describes registers in XML:

> "The CMSIS System View Description format formalizes the description of memory mapped registers of peripherals. The detail contained in system view descriptions is comparable to the data in device reference manuals."
> — [ARM CMSIS-SVD](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)

**Problems with SVD:**

- Missing core peripherals (vendors don't include them)
- Incomplete register definitions from some vendors
- XML is verbose and hard to read directly

> "Not having machine parse-able sources for this very core data is extremely annoying."
> — [GitHub Issue: SVD Missing Core Peripherals](https://github.com/ARM-software/CMSIS_5/issues/844)

---

## Research: C Struct Overlay Patterns

The traditional C approach uses struct overlays:

```c
// Traditional C pattern
typedef struct {
    volatile uint32_t DR;     // Data Register
    volatile uint32_t GDIR;   // GPIO Direction Register
    volatile uint32_t PSR;    // Pad Status Register
    volatile uint32_t ICR1;   // Interrupt Config Register 1
} GPIO_TypeDef;

#define GPIOA ((GPIO_TypeDef *)0x40020000)

// Usage
GPIOA->DR = 0x0001;
```

**Problems:**

1. **Bitfield portability:**

   > "The C standard does not define how compilers allocate bit-fields in memory. This means that bit-field layouts may differ between compilers, toolchains, or even optimization levels."
   > — [Feabhas: Peripheral Register Access](https://blog.feabhas.com/2019/01/peripheral-register-access-using-c-structs-part-1/)

2. **No read/write enforcement:**

   > "We cannot make certain bits in a bitfield read-only, but registers may have read-only bits in any given register."
   > — [AllThingsEmbedded: Register Access API](https://allthingsembedded.com/post/bare-metal-register-access-api/)

3. **MISRA forbids unions for type punning:**
   > "Using unions isn't recommended in embedded and even forbidden by most of the standards and guidelines for safety software like MISRA C 2004."
   > — [LinkedIn: Memory Mapped Registers](https://www.linkedin.com/pulse/best-way-handling-memory-mapped-registers-any-c-ahmed-nasr-eldin)

---

## Initial Design Direction

cnx can provide a register binding syntax that is:

- Human-readable with inline documentation
- Type-safe with compile-time checks
- MISRA-compliant by design
- IDE-friendly with hover support

### Proposed Syntax

```
// cnx register definition
register GPIOA @ 0x40020000 {
    /// Data Register - Read/Write
    /// Each bit corresponds to a GPIO pin output value
    DR: u32 rw @ 0x00,

    /// GPIO Direction Register - Read/Write
    /// 0 = Input, 1 = Output
    GDIR: u32 rw @ 0x04,

    /// Pad Status Register - Read Only
    /// Reflects the current state of the GPIO pins
    PSR: u32 ro @ 0x08,

    /// Interrupt Configuration Register 1 - Read/Write
    /// Configures interrupt detection for pins 0-15
    ICR1: u32 rw @ 0x0C {
        /// Interrupt configuration for pin 0
        /// 0b00 = Low level, 0b01 = High level
        /// 0b10 = Rising edge, 0b11 = Falling edge
        ICR0: bits[0..2],
        ICR1: bits[2..4],
        ICR2: bits[4..6],
        // ... etc
    }
}
```

### Transpilation

This would transpile to MISRA-compliant C:

```c
// Generated C - MISRA compliant
typedef struct {
    volatile uint32_t DR;
    volatile uint32_t GDIR;
    volatile const uint32_t PSR;  // Read-only
    volatile uint32_t ICR1;
} GPIOA_Registers;

// Linker-defined symbol (avoids integer-to-pointer cast)
extern GPIOA_Registers GPIOA;

// Or with documented deviation
#define GPIOA (*(volatile GPIOA_Registers *)0x40020000UL)

// Inline functions for bitfield access with bounds checking
static inline void GPIOA_ICR1_set_ICR0(uint8_t value) {
    assert(value <= 3);  // 2 bits max
    GPIOA.ICR1 = (GPIOA.ICR1 & ~0x3UL) | (value & 0x3UL);
}
```

### Key Features

#### 1. Access Modifiers

| Modifier | Meaning          | C Output                  |
| -------- | ---------------- | ------------------------- |
| `rw`     | Read-Write       | `volatile uint32_t`       |
| `ro`     | Read-Only        | `volatile const uint32_t` |
| `wo`     | Write-Only       | Special write-only type   |
| `w1c`    | Write-1-to-Clear | Special handling          |
| `w1s`    | Write-1-to-Set   | Special handling          |

Attempting to write to a `ro` register or read from a `wo` register is a
**compile-time error** (E0871, E0870 -- see Diagnostics below). A compound
assignment (`+<-` and the others) reads its target, so it is a read of a `wo`
member as well as a write.

A **zero written to a bit range (`x[b]` is `x[b, 1]`) or a bitmap field** of a
write-1 member (`wo`, `w1s`, `w1c`) is also rejected (E0872, and for a field
#2027): the hardware ignores zeros, so
`REG.SET[3] <- false` cannot clear bit 3 and the author almost certainly wanted
the corresponding CLEAR register. The rule is about the VALUE, not its spelling:
`0`, `0x0`, `0b0`, `false` and a `const` that evaluates to zero are all the same
zero. A zero written to the whole member (`REG.SET <- 0`) is accepted -- a
write-only data or command register takes zero as a value.

#### 2. Bitfield Safety

```
// cnx
GPIOA.ICR1.ICR0 <- 0b11;  // OK: 2 bits, value fits
GPIOA.ICR1.ICR0 <- 5;     // ERROR: Value 5 doesn't fit in 2 bits
```

#### 3. Documentation as First-Class

Triple-slash comments become accessible to:

- IDE hover information
- Generated documentation
- Code completion hints

#### 4. SVD Import

cnx could import SVD files directly:

```
import svd "STM32F407.svd";

// All registers from SVD now available with full type safety
GPIOA.ODR.ODR0 <- 1;
```

---

## Open Questions (Research Needed)

### Q1: How to handle the MISRA integer-to-pointer cast?

Options:

- a) Use linker symbols (requires linker script modification)
- b) Generate documented deviations automatically
- c) Use a compile-time-checked cast intrinsic
- d) Provide both options and let user choose

### Q2: What about reserved/undefined bits?

Some registers have bits that are "reserved - must write 0" or "undefined - do not modify":

- a) Automatically mask writes to preserve reserved bits
- b) Make reserved bits inaccessible
- c) Warning if accessing reserved bits

### Q3: Atomic read-modify-write operations?

Many registers require atomic bit manipulation:

- a) Generate inline functions that disable interrupts
- b) Use hardware atomic instructions where available
- c) Provide explicit `atomic_modify` syntax

### Q4: How to handle registers that change behavior based on mode?

Some registers have different bit meanings depending on chip configuration:

- a) Different register types for different modes
- b) Runtime checking
- c) Document only, don't enforce

### Q5: Should cnx ship with register definitions?

Options:

- a) Include common MCU families (STM32, NXP, Nordic, etc.)
- b) Provide SVD import tool only
- c) Community-maintained register packages

### Q6: What about non-standard register widths?

Some peripherals have 8-bit or 16-bit registers:

- a) Support u8, u16, u32, u64 register widths
- b) Always use u32 with appropriate masking

### Q7: Alignment and padding?

Registers aren't always contiguous:

```
register UART @ 0x40000000 {
    CR: u32 rw @ 0x00,
    // Gap at 0x04-0x07
    SR: u32 ro @ 0x08,
}
```

- a) Explicit offset syntax (shown above)
- b) Automatic padding bytes
- c) Both

---

## Potential Impact

If done right, this could be cnx's standout feature:

| Current C                         | cnx                         |
| --------------------------------- | --------------------------- |
| `GPIO1_DR = 0x01;`                | `GPIOA.DR <- 0x01;`         |
| Magic hex address                 | Named, documented register  |
| Hope you don't write to read-only | Compile error if you try    |
| Bitfield values unchecked         | Compile-time range checking |
| No IDE help                       | Hover shows documentation   |
| MISRA deviations required         | Compliant by design         |

---

## Next Steps

1. **Analyze real SVD files** — Understand the full complexity of register definitions
2. **Prototype the syntax** — Try writing real MCU definitions in proposed syntax
3. **Research linker symbol approach** — For MISRA-compliant address binding
4. **Survey embedded developers** — What features matter most?
5. **Design SVD import tool** — Automatic generation from vendor files

---

## Diagnostics

| Code  | Reported when                                                                                                    | Asserted by                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| E0870 | A `wo` member is read -- as an operand, an initializer, or the target of a compound assignment                   | `tests/adr-004/register-read-wo-error.test.cnx`                                                   |
| E0871 | An `ro` member is written -- whole, a bit, a bit range, or through a compound assignment                         | `tests/adr-004/register-write-ro-error.test.cnx`                                                  |
| E0872 | A bit range (`x[b]` is `x[b, 1]`) or a bitmap field of a `wo`/`w1s`/`w1c` member is assigned a compile-time zero | `tests/adr-004/register-wo-set-false-error.test.cnx`, `tests/bugs/issue-2027-register-field-zero` |

Each rule applies to every spelling of the member: `R.M`, `this.R.M`,
`global.R.M`, `Scope.R.M` and `global.Scope.R.M` name the same hardware, so the
same rule answers for all of them. Until #1322 the three rules each resolved the
spelling on their own, and the scoped forms of a write to an `ro` member were
accepted -- the generated C then assigned through a `const` qualified access,
which the C compiler rejected instead of cnx. `E0871` is the register half of
ADR-013's "read-only register members are implicitly const".

Every offense in a file is reported, each at the position of the access that
commits it.

### Where the accessors live

A register's accessors are `#define`s, and a `#define` can only be shared
through a header. So a register that is part of a file's public interface -- a
file-scope register, or a `public` one inside a scope -- is emitted into the
file's generated header, and a file that `#include`s the declaring `.cnx` uses
it exactly as the declaring file does. A private scoped register stays in the
implementation file, as a private scope variable does. A public register whose
member is typed by a private bitmap carries that bitmap's definition into the
header with it, since the accessor names the type (#1453).

Until #1453 the accessors were written to the implementation file for every
register, so the board file that ADR-004 exists for could not be included: the
consumer reported the register as undefined.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist** for
this feature, `warn` that it should be covered and is not, `error` that it must be.
Undeclared cells are `off`.

A register access is an expression or an assignment, and an expression can stand
in a declaration initializer as well as in a function body, so every context is
reachable -- a `for` header's declaration included, for a read, since its
initializer is an expression too. The rules read the member's access modifier
from where the register is DECLARED, and a register declared in an included
file is as much hardware as one declared here, so the imported columns are
declared `error` and asserted by fixtures that reach the register across one and
two include hops.

<!-- MATRIX-SEVERITY code: E0870 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| for header         | same file               | error    |
| scope member       | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | error    |
| top-level function | imported direct         | error    |
| for header         | imported direct         | error    |
| scope member       | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | error    |
| top-level function | imported transitive     | error    |
| for header         | imported transitive     | error    |
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

<!-- MATRIX-SEVERITY code: E0871 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| for header         | same file               | off      |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| for header         | imported direct         | off      |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
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

off: an assignment is a statement, so it cannot stand in a global or scope member initializer or in a `for` header's declaration (`u32 g <- (HW.STATUS <- 1);` and `for (mut u32 i <- (HW.STATUS <- 1); ...)` are parse errors); a `for` header's first clause written as an assignment, `for (HW.STATUS <- 1; ...)`, is the enclosing function's.

<!-- MATRIX-SEVERITY code: E0872 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| for header         | same file               | off      |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| for header         | imported direct         | off      |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
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

off: an assignment is a statement, so it cannot stand in a global or scope member initializer or in a `for` header's declaration (`bool g <- (HW.SET[3] <- false);` and `for (mut bool b <- (HW.SET[3] <- false); ...)` are parse errors); a `for` header's update written as an assignment, `for (...; ...; HW.SET[3] <- false)`, is the enclosing function's.

---

## References

### Current Approaches

- [PJRC: Teensy imxrt.h](https://github.com/PaulStoffregen/cores/blob/master/teensy4/imxrt.h)
- [Feabhas: Peripheral Register Access Using C Structs](https://blog.feabhas.com/2019/01/peripheral-register-access-using-c-structs-part-1/)
- [Embedded.com: Device Registers in C](https://www.embedded.com/device-registers-in-c/)
- [LinkedIn: Memory Mapped Registers in C](https://www.linkedin.com/pulse/best-way-handling-memory-mapped-registers-any-c-ahmed-nasr-eldin)

### Type-Safe C++ Libraries

- [GitHub: regbits](https://github.com/thanks4opensource/regbits) — Type-safe bit manipulation
- [AllThingsEmbedded: Bare Metal Register Access API](https://allthingsembedded.com/post/bare-metal-register-access-api/)
- [Embedded.com: Write-Only Access](https://www.embedded.com/how-to-enforce-write-only-access/)
- [blog.salkinium.com: Typesafe Register Access in C++](https://blog.salkinium.com/typesafe-register-access-in-c++/)
- [preshing.com: Safe Bitfields in C++](https://preshing.com/20150324/safe-bitfields-in-cpp/)

### Rust Approach

- [The Embedded Rust Book: Registers](https://docs.rust-embedded.org/book/start/registers.html)
- [svd2rust documentation](https://docs.rs/svd2rust/)
- [Embedded.com: Creating PACs](https://www.embedded.com/embedded-rust-creating-peripheral-access-crates-pacs/)
- [Ferrous Systems: PACs and svd2rust](https://rust-training.ferrous-systems.com/latest/book/pac-svd2rust)

### Zig Approach

- [scattered-thoughts: MMIO in Zig](https://www.scattered-thoughts.net/writing/mmio-in-zig/)
- [MicroZig](https://microzig.tech/)
- [Zig Issue #4284: Volatile Semantics](https://github.com/ziglang/zig/issues/4284)

### CMSIS-SVD

- [ARM CMSIS-SVD Documentation](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [Open-CMSIS-SVD Specification](https://open-cmsis-pack.github.io/svd-spec/main/index.html)
- [GitHub: cmsis-svd](https://github.com/cmsis-svd/cmsis-svd) — Community SVD repository

### MISRA Compliance

- [Feabhas: Side Effects and Sequence Points](https://blog.feabhas.com/2020/04/side-effects-and-sequence-points-why-volatile-matters/)
- [OSDev Wiki: Memory Mapped Registers](https://wiki.osdev.org/Memory_mapped_registers_in_C/C++)
- [Aticleworld: Access GPIO Using Bit Field](https://aticleworld.com/access-the-port-and-register-using-bit-field-in-embedded-c/)
