# ADR-072: Safe Hardware Abstraction Primitives

> **Formerly ADR-111.** Renumbered 2026-11-18 into the `0xx` band — its target release moved
> from v2 to v1. See [`README.md`](README.md) for the numbering rule and the full mapping
> table.

**Status:** WIP — Accepted design, implementation in progress (Part 1 register types and instances landed in #2461, register parameters in #2467; Parts 2–4 to follow)
**Date:** 2026-02-20 (revised 2026-07-04: simplified register syntax; added Parts 4–5. 2026-11-19: Part 5, scaled fields, moved to ADR-073; contradictions settled in rulings 1–10 on #2449; Accepted)
**Decision Makers:** Language Design Team
**Supersedes:** ADR-004 (Register Bindings — takes effect when Part 1 is implemented; this ADR removes the `register Name @ address { }` form ADR-004 defines)
**Amends:** ADR-016 (`### Scoped Registers` — takes effect when Part 1 is implemented; that section's `@ address` examples go with it)
**Related ADRs:** ADR-034 (Bitmap Types), ADR-033 (Packed Structs — Rejected; Part 4 is the safe alternative), ADR-073 (Scaled Fields — formerly Part 5), ADR-074 (Byte-Order Reversal)

> **Part 1 is implemented.** Register types, fixed-address instances,
> compile-time addresses and reserved member names compile (#2461), and the
> `@ address` form is gone. A register parameter is bound to an instance at
> each call; offset groups and the overlap rule (E0938) hold for every
> register, and the alignment rule (E0939) for every register that maps
> hardware. A register type in any position but a
> one-address instance or a parameter (E0936) is rejected until Part 4 lands.
> Parts 2–4 are not implemented.

## Context

cnx's register and bitmap primitives (ADR-004, ADR-034) provide the foundation for type-safe hardware access. However, several gaps prevent achieving **100% statically typed, memory-safe hardware access**:

1. **No parameterized register blocks** — MCUs have multiple instances of identical peripherals (9 GPIO ports, 8 UARTs, etc.). Currently requires copy-pasting definitions.

2. **Incomplete w1c/w1s enforcement** — The compiler prevents reads from write-only registers but doesn't prevent read-modify-write (RMW) patterns that violate w1c semantics.

3. **No SVD import tooling** — Every Cortex-M chip has an SVD file describing its peripherals. Manual transcription is error-prone and tedious.

4. **Missing safety guarantees** — No compile-time enforcement of peripheral initialization order, clock gating, or pin multiplexing conflicts.

### The Goal

Enable writing MCU libraries where **invalid hardware access is a compile error**, not a runtime bug:

```cnx
// Ideal: compiler prevents all these mistakes
GPIO1.ISR <- GPIO1.ISR; // ERROR: RMW on w1c register
UART1.send("hello"); // ERROR: UART1 clock not enabled
GPIO1.Pin13 <- output; // ERROR: Pin13 muxed to SPI
DMA.transfer(src, dst, 1000); // ERROR: DMA not initialized
```

---

## Part 1: Parameterized Register Blocks

### Problem

The i.MX RT1062 (Teensy 4.x) has 9 GPIO ports with identical register layouts at different base addresses. Current syntax requires 9 separate definitions:

```cnx
// Current: repetitive and error-prone
register GPIO1 @ 0x401B8000 {
    DR: GpioDirection rw @ 0x00,
    GDIR: GpioDirection rw @ 0x04,
    PSR: GpioDirection ro @ 0x08,
    // ... 10 more fields
}

register GPIO2 @ 0x401BC000 {
    // ... exact same fields repeated
}

// ... 7 more times
```

### Research: How Other Languages Solve This

#### Rust (svd2rust)

Uses generics with marker types:

```rust
pub struct GPIO<const BASE: u32> {
    dr: Reg<DR_SPEC>,
    gdir: Reg<GDIR_SPEC>,
}

const GPIO1: GPIO<0x401B8000> = GPIO::new();
const GPIO2: GPIO<0x401BC000> = GPIO::new();
```

#### Zig

Uses comptime parameters:

```zig
fn GPIO(comptime base: u32) type {
    return struct {
        const DR = @intToPtr(*volatile u32, base + 0x00);
        const GDIR = @intToPtr(*volatile u32, base + 0x04);
    };
}

const GPIO1 = GPIO(0x401B8000);
```

#### C (CMSIS)

Uses macros and base address offsets:

```c
#define GPIO_DR_OFFSET   0x00
#define GPIO_GDIR_OFFSET 0x04

#define GPIO1_BASE 0x401B8000
#define GPIO1_DR   (*(volatile uint32_t*)(GPIO1_BASE + GPIO_DR_OFFSET))
```

### Decision Drivers

1. **Minimize repetition** — Define peripheral layout once, instantiate many times
2. **Type safety** — Each instance should be a distinct type (GPIO1 ≠ GPIO2)
3. **Type safety** — The register is the type and each instantiation is an instance of it with its own address: `GPIO1` and `GPIO2` are distinct instances of one type `GpioPort`, and passing a `UartPort` instance where a `GpioPort` is expected is a type error (ruling 1 on #2449)
4. **MISRA compliance** — Generated C must pass static analysis
5. **SVD compatibility** — Syntax should map cleanly from SVD peripheral definitions

### Recommendation: Parameterized Register Blocks

Parameterized registers follow cnx's function-like patterns and are straightforward to implement — the base address is just a compile-time constant parameter.

### Specification: Parameterized Registers

#### Grammar (Breaking Change)

The base address is **not** a parameter. A register defines its fields at plain byte
offsets from an implicit base; the base is supplied at instantiation. A field is
`byteOffset access type name`. Both the old
`register Name @ address { }` form and an explicit `(u32 baseAddress)` parameter are
removed — the base ceremony was pure boilerplate the transpiler can supply.

```antlr
registerDefinition
    : 'register' IDENTIFIER '{' registerEntry (',' registerEntry)* ','? '}'
    ;

registerEntry
    : byteOffset access type memberName                          // one member
    | byteOffset '{' groupMember (',' groupMember)* ','? '}'     // members sharing an offset
    ;

groupMember
    : access type memberName
    ;

memberName
    : IDENTIFIER | keyword   // any reserved word may name a member (ruling 2 on #2449)
    ;

registerInstantiation
    : type IDENTIFIER ( '(' address ')' )? ';'   // address -> MMIO; omitted -> data register (Part 4)
    ;

byteOffset : constantExpression ;
address    : constantExpression ;
```

A field offset and an instance address are compile-time constant expressions: literals,
named constants and arithmetic on them (ruling 5 on #2449). The compiler evaluates each one
and emits the value as a plain number, so no address is computed at runtime. An expression
the compiler cannot evaluate is an error, as is an address that does not fit the target's
pointer width.

```cnx
u32 GPIO_BASE <- 0x401B8000;

GpioPort GPIO1(GPIO_BASE); // 0x401B8000
GpioPort GPIO2(GPIO_BASE + 0x4000); // 0x401BC000
```

Single-instance peripherals simply have one instantiation:

```cnx
// Single-instance peripheral (e.g., system control block)
register SystemControl {
    0x00 ro u32 CPUID,
    0x04 rw u32 ICSR,
}

SystemControl SCB(0xE000ED00); // Only one instance
```

#### Syntax

```cnx
// Register definition — plain byte offsets, no base ceremony
register GpioPort {
    0x00 rw GpioDirection DR,
    0x04 rw GpioDirection GDIR,
    0x08 ro GpioDirection PSR,
    0x0C rw u32 ICR1,
    0x10 rw u32 ICR2,
    0x14 rw GpioDirection IMR,
    0x18 w1c GpioDirection ISR,
    0x1C rw u32 EDGE,
    0x84 wo GpioDirection DR_SET,
    0x88 wo GpioDirection DR_CLR,
    0x8C wo GpioDirection DR_TOG,
}

// Instantiate at specific addresses
GpioPort GPIO1(0x401B8000);
GpioPort GPIO2(0x401BC000);
GpioPort GPIO3(0x401C0000);
GpioPort GPIO4(0x401C4000);
GpioPort GPIO5(0x400C0000);
GpioPort GPIO6(0x42000000);
GpioPort GPIO7(0x42004000);
GpioPort GPIO8(0x42008000);
GpioPort GPIO9(0x4200C000);
```

A member may be named with any reserved word, so the datasheet's `ISR` is used as
written. A member is declared only in member position and reached only after a `.`,
so `GPIO1.ISR` cannot be read as the `ISR` type (ADR-040). The same rule covers bitmap
fields and struct fields: a keyword restricts naming only where it would make the
program ambiguous (ruling 2 on #2449, #2029). Names that are C keywords are a separate
question (#2222).

#### Layout Rules

A register's members match the hardware's map exactly, so the compiler rejects a layout
that cannot be one.

**Members that share an offset are written as one group.** Some hardware reaches more
than one register through one address. A 16550 UART reads received data, writes data
to send and, while a control bit is set, reads and writes the baud divisor, all at
`0x00`:

```cnx
register Uart {
    0x00 {
        ro u8 RBR,
        wo u8 THR,
        rw u8 DLL,
    },
    0x05 ro u8 LSR,
}
```

Every member of a group starts at the group's offset, and each keeps its own access
mode, so reading `THR` is still an error. Any other overlap is a compile error: two
separate members at one offset (the copy-pasted offset is the common register-map typo),
or a member that starts inside another. A gap needs no declaration; the offsets show it.

**A member is aligned to its size.** A member's offset is a multiple of its size: a
`u16` on 2, a `u32` on 4, a `u64` on 8, and a group's offset suits every member in it.
Cortex-M faults on an unaligned access to device memory, so an unaligned member is a
runtime fault the compiler can rule out. A 32-bit value that a datasheet places at
`0x02` is declared as the two halves the hardware can reach:

```cnx
register Odd {
    0x00 rw u8 CTRL,
    0x02 rw u16 DATA_LO,
    0x04 rw u16 DATA_HI,
}
```

Alignment is a rule for a register that maps hardware: a type with a fixed-address
instance, or one a parameter takes (ruling 13 on #2449). A declaration alone may place a
`u16` at an odd offset, as Part 4's J1939 frame does; Part 4 decides how such a field in
normal memory is read.

**A member is as wide as its type is on the target.** An enum member is as wide as the
target's C compiler makes the enum (ruling 14). With short enums, a fact each target
records and the toolchain probe checks, that is the narrowest of 8, 16 or 32 bits that
holds every enumerator; otherwise it is the target's C `int`. The same register map can
therefore be legal on one target and overlap (E0938) or misalign (E0939) on another:

```cnx
enum Mode { IDLE, RUN }

register Blk {
    0x00 rw Mode MODE,   // cortex-m7 (short enums): 1 byte
    0x01 rw u8 FLAG,     // legal on cortex-m7; E0938 on atmega328p, a 2-byte int
}
```

#### Transpilation

```cnx
register GpioPort {
    0x00 rw u32 DR,
    0x04 rw u32 GDIR,
}

GpioPort GPIO1(0x401B8000);
GpioPort GPIO2(0x401BC000);
```

Transpiles to:

```c
// Each instance gets its own macro set with computed addresses
#define GPIO1__DR   (*(volatile uint32_t*)(0x401B8000U))
#define GPIO1__GDIR (*(volatile uint32_t*)(0x401B8004U))

#define GPIO2__DR   (*(volatile uint32_t*)(0x401BC000U))
#define GPIO2__GDIR (*(volatile uint32_t*)(0x401BC004U))
```

#### Implementation Notes

This is straightforward to implement:

1. **Parser**: `registerDeclaration` takes no parameter list; a field is `offset access type name`
2. **Symbol Collection**: Store the register's fields (offset, access, type) with the definition
3. **Instantiation**: When processing `GpioPort GPIO1(0x401B8000)`:
   - Look up `GpioPort` definition
   - Add the instance address `0x401B8000` to each field's byte offset
   - Evaluate constant expressions at compile time
   - Generate macros with resolved addresses

The key insight: **every instance address and member offset is a compile-time constant**, folded during transpilation.

#### Type Identity and Generic Peripheral Code

Register instances can be used in two ways:

**Specific instance** — when you need a particular peripheral:

```cnx
void debugGpio1() {
    GPIO1.DR[13] <- true; // Only works with GPIO1
}
```

**Any instance of a template** — when you want generic code:

```cnx
void setPin(GpioPort port, u8 pin) {
    port.DR[pin] <- true;
}

void clearPin(GpioPort port, u8 pin) {
    port.DR[pin] <- false;
}

setPin(GPIO1, 13); // OK — GPIO1 is a GpioPort
setPin(GPIO2, 0); // OK — GPIO2 is a GpioPort
setPin(UART1, 0); // ERROR: UART1 is not a GpioPort
```

#### Register Parameters

A register parameter is resolved at compile time. Each call names an instance, never
a runtime value, so the compiler knows which instance every call reaches. This ADR
defines that cnx rule only; the C a register parameter compiles to is the
transpiler's choice (ruling 11 on #2449).

```cnx
setPin(GPIO1, 13); // port.DR is GPIO1's DR
setPin(GPIO2, 0); // port.DR is GPIO2's DR
```

This enables reusable HAL code without duplicating source code per instance.

A register parameter is never `mut` (ruling 12, E0943). A member's own access mode
(`rw`, `ro`, `wo`, `w1c`, `w1s`) decides whether it can be written, through a parameter
as through a fixed instance:

```cnx
void drive(GpioPort port) { port.DR <- 0xFF; } // DR is rw: written without mut
void bad(mut GpioPort port) { }                // E0943: mut does not apply to a register
```

The C a register parameter compiles to is the transpiler's, with two consequences a
user sees. A member named with a C or C++ keyword (`default`, `this`) keeps its cnx
name, and its field in the generated C layout is spelled `cnx__default` (ruling 15;
ADR-063 reserves `cnx__`). The layout's offsets and widths are checked by C11
`_Static_assert` (C++11 `static_assert`), so a file with a register parameter requires
C11, as float bit indexing already does (ruling 16).

#### Compile-Time-Only Constraint

Register template types (`GpioPort`) are **compile-time-only identifiers**, not runtime values. They cannot be assigned to variables or stored in data structures:

```cnx
GpioPort activePort <- GPIO1; // ERROR: register types are not assignable
activePort <- GPIO2; // ERROR: cannot reassign register type
setPin(activePort, 13); // ERROR: activePort is not an instance

GpioPort[2] ports <- [GPIO1, GPIO2]; // ERROR: cannot store registers in arrays
```

The same holds for a function with a register parameter. Its register is bound to an
instance at each call, so it can be called but never used as a callback (ADR-029): not
passed, stored or named as a callback type (E0941).

```cnx
struct Hal {
    setPin handler; // ERROR: setPin takes a register parameter
}
```

This is intentional — a register is bound at compile time, so cnx has no register value chosen at runtime. If you need dynamic port selection, use explicit branching:

```cnx
void setPinOnPort(u8 portNum, u8 pin) {
    switch (portNum) {
        case 1 {
            setPin(GPIO1, pin);
        }
        case 2 {
            setPin(GPIO2, pin);
        }
        // ...
    }
}
```

Each branch passes a fixed instance, so every register parameter is still bound at compile time.

---

## Part 2: w1c/wo/w1s Codegen Fix

### Problem

Current implementation generates read-modify-write for bit-field assignments, which is incorrect for w1c registers:

```cnx
INT.STATUS[3] <- true;
// Currently generates: INT_STATUS = (INT_STATUS & ~mask) | value;  // BUG!
// Should generate:     INT_STATUS = (1 << 3);                      // Direct write
```

### Fix

Bit-field and bitmap-field writes to w1c/wo/w1s registers must generate **direct writes**, not RMW.

#### Correct Codegen for w1c

| cnx                        | Generated C              |
| -------------------------- | ------------------------ |
| `INT.STATUS <- 0x0F`       | `INT_STATUS = 0x0F;`     |
| `INT.STATUS[3] <- true`    | `INT_STATUS = (1 << 3);` |
| `INT.STATUS.Pin3 <- true`  | `INT_STATUS = (1 << 3);` |
| `DMA.ERR.Chan0Err <- 0xF`  | `DMA_ERR = (0xF << 0);`  |
| `INT.STATUS[3] <- false`   | **Compiler error**       |
| `INT.STATUS.Pin3 <- false` | **Compiler error**       |
| `DMA.ERR.Chan0Err <- 0`    | **Compiler error**       |

Writing `false` or `0` to a w1c field is an error — it has no effect (w1c bits are cleared by writing `1`, not `0`).

Multi-bit w1c fields (rare but they exist — some DMA error status registers) work the same way: the value is shifted to the field position and written directly.

#### Width Safety for Multi-Bit Fields

Assigning a wider type to a narrower bitmap field requires explicit bit extraction — no implicit truncation:

```cnx
bitmap32 DmaErrors {
    Chan0Err[4], // 4 bits wide
    Chan1Err[4],
    Reserved[24]
}

u8 error <- 0xFF;

DMA.ERR.Chan0Err <- error; // ERROR: u8 (8 bits) doesn't fit in 4-bit field
DMA.ERR.Chan0Err <- error[0, 4]; // OK: explicitly extract 4 bits
DMA.ERR.Chan0Err <- 0xF; // OK: literal fits in 4 bits
DMA.ERR.Chan0Err <- 0x1F; // ERROR: literal exceeds 4 bits
```

This follows cnx's philosophy of explicit bit extraction (`value[start, width]`) rather than C's implicit truncating casts.

#### Generated C

A `w1c` / `wo` / `w1s` bit assignment emits a **direct write**, never the
read-modify-write an `rw` field gets:

```cnx
STATUS.OVERFLOW <- true; // STATUS declared w1c
CTRL.ENABLE <- true; // CTRL declared rw
```

```c
STATUS = (1 << 3);
CTRL = (CTRL & ~(1 << 0)) | (1 << 0);
```

The distinction is not an optimization. Reading a `w1c` register to modify it
clears every bit that happens to be set, so the RMW form silently acknowledges
interrupts the program never handled -- which is the class of defect this ADR
exists to remove.

Assigning `false` to a `w1c` / `wo` / `w1s` bit is a **compile error**. In those
registers a zero write is defined to have no effect, so the statement cannot do
what it appears to do, and rejecting it is better than emitting a write the
hardware ignores.

---

## Part 3: SVD Import Tool

### Problem

Every Cortex-M microcontroller ships with an SVD (System View Description) file that describes all peripherals, registers, fields, and access types. Manual transcription to cnx is:

- **Error-prone** — Typos in addresses, field widths, access types
- **Tedious** — Thousands of registers per chip
- **Maintenance burden** — SVD files get updated with errata

### Research: SVD Format

SVD is an XML format standardized by ARM (CMSIS-SVD). Example:

<!-- survives-rewrite: CMSIS-SVD, an ARM-standard part description read identically by any implementation -->

```xml
<peripheral>
  <name>GPIO1</name>
  <baseAddress>0x401B8000</baseAddress>
  <registers>
    <register>
      <name>DR</name>
      <addressOffset>0x00</addressOffset>
      <access>read-write</access>
      <fields>
        <field>
          <name>PIN0</name>
          <bitOffset>0</bitOffset>
          <bitWidth>1</bitWidth>
        </field>
        <!-- ... -->
      </fields>
    </register>
  </registers>
</peripheral>
```

### Specification: svd2cnx Tool

#### Contract

The importer takes one SVD file and an output directory, and writes cnx register
definitions. It selects which peripherals to emit -- an SVD for a full part
describes hundreds, and a project uses a handful:

| Input                     | Effect                                       |
| ------------------------- | -------------------------------------------- |
| an SVD file               | the source of record for the part            |
| an output directory       | where the generated definitions are written  |
| a peripheral include list | emit only those peripherals                  |
| a peripheral exclude list | emit everything except those                 |
| a split flag              | one file per peripheral rather than one file |

Generation is offline and its output is committed: the definitions are read by
every later build, so a part's register map must not depend on a tool being
present at build time.

#### Output Structure

<!-- survives-rewrite: a user's generated project tree -- the layout any implementation emits, not this repo's source -->

```
src/hal/imxrt1062/
├── gpio.cnx          # GPIO template + instances
├── uart.cnx          # UART template + instances
├── spi.cnx           # SPI template + instances
├── peripherals.cnx   # Re-exports all peripherals
└── _raw/             # Optional: raw per-peripheral files
```

#### SVD to cnx Mapping

| SVD                                           | cnx                                  |
| --------------------------------------------- | ------------------------------------ |
| `<peripheral>` (any)                          | Parameterized register + instance(s) |
| `<peripheral>` with `derivedFrom`             | Additional instance of same template |
| `<register access="read-write">`              | `rw`                                 |
| `<register access="read-only">`               | `ro`                                 |
| `<register access="write-only">`              | `wo`                                 |
| `<register modifiedWriteValues="oneToClear">` | `w1c`                                |
| `<register modifiedWriteValues="oneToSet">`   | `w1s`                                |
| `<register>` with `<field>` definitions       | Generate bitmap type                 |
| Reserved gaps in fields                       | `Reserved[width]`                    |

#### Bitmap Generation

The tool generates bitmap types for any register with `<field>` definitions. Field names are preserved from SVD:

Input SVD:

<!-- survives-rewrite: CMSIS-SVD, an ARM-standard part description read identically by any implementation -->

```xml
<register>
  <name>CR1</name>
  <addressOffset>0x00</addressOffset>
  <size>32</size>
  <access>read-write</access>
  <fields>
    <field>
      <name>ENABLE</name>
      <bitOffset>0</bitOffset>
      <bitWidth>1</bitWidth>
    </field>
    <field>
      <name>MODE</name>
      <bitOffset>1</bitOffset>
      <bitWidth>3</bitWidth>
    </field>
    <field>
      <name>PRESCALER</name>
      <bitOffset>4</bitOffset>
      <bitWidth>4</bitWidth>
    </field>
  </fields>
</register>
```

Generated cnx:

```cnx
bitmap32 UartCr1 {
    Enable,
    Mode[3],
    Prescaler[4],
    Reserved[24]
}

register UartPort {
    0x00 rw UartCr1 CR1,
}
```

The tool applies naming conventions:

- `ENABLE` → `Enable` (PascalCase)
- `GPIO1_DR` → `GpioDr` (strip peripheral prefix, PascalCase)
- Reserved gaps calculated automatically

#### Example Output

Input SVD:

<!-- survives-rewrite: CMSIS-SVD, an ARM-standard part description read identically by any implementation -->

```xml
<peripheral>
  <name>GPIO1</name>
  <baseAddress>0x401B8000</baseAddress>
  <registers>
    <register>
      <name>DR</name>
      <addressOffset>0x0</addressOffset>
      <size>32</size>
      <access>read-write</access>
      <fields>
        <field><name>PIN0</name><bitOffset>0</bitOffset><bitWidth>1</bitWidth></field>
        <field><name>PIN1</name><bitOffset>1</bitOffset><bitWidth>1</bitWidth></field>
        <!-- ... PIN2-PIN31 ... -->
      </fields>
    </register>
    <register>
      <name>ISR</name>
      <addressOffset>0x18</addressOffset>
      <size>32</size>
      <access>read-write</access>
      <modifiedWriteValues>oneToClear</modifiedWriteValues>
      <fields>
        <field><name>PIN0</name><bitOffset>0</bitOffset><bitWidth>1</bitWidth></field>
        <!-- ... same fields ... -->
      </fields>
    </register>
  </registers>
</peripheral>

<peripheral derivedFrom="GPIO1">
  <name>GPIO2</name>
  <baseAddress>0x401BC000</baseAddress>
</peripheral>
```

Generated cnx:

```cnx
/// GPIO - General Purpose Input/Output
/// Generated from MIMXRT1062.svd

bitmap32 GpioPins {
    Pin0, Pin1, Pin2, Pin3, Pin4, Pin5, Pin6, Pin7,
    Pin8, Pin9, Pin10, Pin11, Pin12, Pin13, Pin14, Pin15,
    Pin16, Pin17, Pin18, Pin19, Pin20, Pin21, Pin22, Pin23,
    Pin24, Pin25, Pin26, Pin27, Pin28, Pin29, Pin30, Pin31
}

register GpioPort {
    /// Data Register
    0x00 rw GpioPins DR,
    /// Interrupt Status Register (write 1 to clear)
    0x18 w1c GpioPins ISR,
}

GpioPort GPIO1(0x401B8000);
GpioPort GPIO2(0x401BC000);
```

#### Stages

The importer has four stages, whatever it is written in: read the SVD, resolve it into
the register model this ADR defines, emit `.cnx`, and carry the part's own type
definitions through. Naming them is useful because the second is where the work is --
an SVD describes memory, and a cnx register declares intent, so the mapping is a
decision rather than a transcription.

Key considerations:

1. **Peripheral derivation** — SVD uses `derivedFrom` for identical peripherals; emit as parameterized register + instances

2. **Reserved field generation** — Calculate gaps between fields and emit `Reserved[N]`

3. **Field names are copied unchanged** — a cnx reserved word may name a register member or bitmap field (Part 1), so no rename table is needed

4. **Cluster handling** — SVD `<cluster>` elements represent register arrays; emit with appropriate indexing

5. **Dim handling** — SVD `<dim>`, `<dimIncrement>`, `<dimIndex>` represent register arrays (e.g., GPT timer's `OCR1`, `OCR2`, `OCR3` with dim=3). Default: expand to individual registers. Future: emit array syntax if cnx adds register arrays.

6. **Alternate registers** — SVD `<alternateGroup>` and `<alternateRegister>` handle registers sharing the same address with different access (e.g., UART THR/RBR). Emit as two register fields at same offset with `wo` and `ro` — cnx already supports this.

7. **Layout deduplication** — SVD files with layout-identical peripherals (without `derivedFrom`) are automatically consolidated into one template with multiple instances.

8. **Struct name mapping** — SVD's `<headerStructName>` maps directly to the parameterized register template name

9. **Bitmap reuse** — When multiple registers have identical field layouts (e.g., DR and ISR both have Pin0-Pin31), generate one bitmap type and reuse it

#### Identical Layouts

Two register definitions are two types, even when their layouts match exactly. A register
is a named type like a struct, so the compiler does not compare layouts (ruling 6 on #2449):

```cnx
register Watchdog {
    0x00 rw u32 CTRL,
    0x04 wo u32 KEY,
}

register Timer {
    0x00 rw u32 CTRL,
    0x04 wo u32 KEY,
}

Timer TMR1(0x40038000);

void kick(Watchdog w) {
    w.KEY <- 0xB480A602;
}

kick(TMR1); // ERROR: TMR1 is a Timer, not a Watchdog
```

Merging layout-identical peripherals into one template is svd2cnx's job (item 7 above),
not a language rule.

---

## Part 4: Data Registers (registers in normal memory)

_Added 2026-07-04._

### Problem

Wire formats — a received CAN/J1939 frame, a network packet, an EEPROM record — are byte
buffers with typed fields at known offsets. That is exactly what a register describes,
except the bytes live in normal memory rather than at a hardware address. The obvious
tool, a packed struct overlaid on the bytes, was **rejected in ADR-033** (unaligned
access faults on Cortex-M0, unstandardized endianness, MISRA deviations). But a register
is _not_ an overlay — it generates explicit field access — so a register pointed at
normal memory gets the same typed ergonomics without the packed-struct hazards.

### Decision

A register instantiated **without an address** is backed by normal memory instead of
MMIO. Everything else about registers — typed fields, access modes, bitmap-typed fields,
template-as-interface — is unchanged.

```cnx
GpioPort GPIO1(0x401B8000); // MMIO — address given
GpioPort scratch; // data register — no address, normal memory
```

Bit-packed bytes use a bitmap field; byte-aligned scalars use a scalar type. Scaling a raw
value to an engineering unit is ADR-073. A J1939 PGN is a data register:

```cnx
bitmap8 Etc1Control {
    drivelineEngaged[2],
    tccLockup[2],
    shiftInProcess[2],
    transition[2]
}

register Etc1 {
    0 ro Etc1Control control, // byte 0 — bit-packed, via bitmap
    1 ro u16 outputShaft, // bytes 1-2 — raw, 0.125 rpm/bit
    3 ro u8 clutchSlip, // byte 3 — raw, 0.4 %/bit
    5 ro u16 inputShaft, // bytes 5-6 — raw, 0.125 rpm/bit
}

Etc1 etc1; // in normal memory
```

Because J1939 fields are either byte-aligned or bit-fields within a single byte (never a
field that starts mid-byte and crosses a byte boundary), byte-offset registers plus
bitmaps cover the format completely.

### Open questions

- **Backing model: owned (ruling 7 on #2449).** A data register is a variable of the
  register's type with its own bytes, like any other variable: `Etc1 etc1;`. There is no
  view over another buffer, so no runtime pointer, lifetime or aliasing question. A
  received frame is copied in before it is read. A global data register has a
  compile-time address, so generic register functions take it as they take a fixed instance.
- **How bytes get in: whole-register assignment (ruling 8 on #2449).** A data register is
  assigned from a `u8` array of exactly its size, and a `u8` array of that size is assigned
  from it. A size mismatch is a compile error. Field access modes still apply to field
  writes, and Part 1's rule that a register cannot be assigned covers MMIO instances only.

  ```cnx
  etc1 <- rxFrame; // copy a received frame in
  txFrame <- etc1; // copy out for sending
  etc1.clutchSlip <- 5; // ERROR: clutchSlip is ro
  ```

- **Size: the end of the last field (ruling 9 on #2449).** A register's size is the byte
  just past its last field. There is no declared size; to match an 8-byte frame, name the
  unused bytes as fields (`7 ro u8 reserved7,`). The editor shows a register's size on hover.
  A data register is written either one member at a time (`etc1.outputShaft <- 23;`, which
  needs a writable field) or whole, from a value of exactly its size.

- **Byte order: little-endian (ruling 10 on #2449).** A data register's multi-byte fields
  are little-endian: `u8[2] [1, 2]` assigned to a register with one `u16` field reads as
  `0x0201`. A big-endian source is reversed explicitly at the assignment; that syntax is
  ADR-074. An MMIO register uses the hardware's order.

---

## Summary

This ADR covers four features for safe hardware abstraction in cnx:

1. **Registers** — Define layouts once (byte offsets, implicit base), instantiate at multiple addresses
2. **Data registers** — Instantiate a register in normal memory (no address) for wire/buffer formats
3. **w1c/wo/w1s codegen fix** — Generate direct writes instead of RMW for write-only registers
4. **svd2cnx tool** — Import register definitions from ARM SVD files

### Out of Scope (Future ADRs if needed)

- **Peripheral initialization ordering** — Developer responsibility; easy to catch during testing
- **Pin multiplexing conflicts** — HAL concern, not a language concern
- **Scaled fields** — mapping a raw field to an engineering value with a unit; ADR-073 (ruling 4 on #2449)

---

## Decision

1. **Registers** — `register Name { byteOffset access type field, ... }` with `Name Instance(address);` instantiation. The base is implicit (not a parameter); fields are plain byte offsets. All registers use this syntax (breaking change). Template type serves as interface for generic peripheral code. Two definitions are two types even when their layouts match.

2. **w1c/wo/w1s codegen fix** — Bit-field and bitmap-field writes generate direct writes, not RMW. Writing `false` to a w1c bit is a compiler error.

3. **svd2cnx tool** — TypeScript tool to generate cnx from SVD files. Auto-generates bitmap types from field definitions with good naming.

4. **Data registers** — A register instantiated without an address (`Name Instance;`) is backed by normal memory, giving typed field access to wire/buffer formats (CAN/J1939, packets) without ADR-033's packed-struct overlay hazards. The instance owns its bytes (ruling 7 on #2449) and is assigned whole from a `u8` array of its size (ruling 8). Its size is the end of its last field (ruling 9). Its multi-byte fields are little-endian (ruling 10); reversing a big-endian source is ADR-074.

---

## Diagnostics

Part 1 (register types and fixed instances):

| Code  | Meaning                                                                                                                                     | Asserted by                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0937 | A register instance in a type position (`GPIO1 x;`); its register type is the type                                                          | `tests/bugs/issue-1336-register-in-type-position/`                                                                                                      |
| E0931 | A register instance's address cannot be used: not a compile-time constant, negative, or a member past the target's pointer range (ruling 5) | `tests/adr-072/register-address-not-constant-error.test.cnx`, `register-negative-offset-error.test.cnx`, `register-address-past-pointer-error.test.cnx` |
| E0932 | A register member's offset is not a compile-time constant                                                                                   | `tests/adr-072/register-offset-not-constant-error.test.cnx`                                                                                             |
| E0934 | A register instance is declared inside a function                                                                                           | `tests/adr-072/register-local-instance-error.test.cnx`                                                                                                  |
| E0935 | `Type name(expr);` whose type is not a register type (a C++ constructor takes named constants, #375)                                        | `tests/adr-072/constructor-expression-not-register-error.test.cnx`                                                                                      |
| E0936 | A register type anywhere but a one-address file- or scope-level instance (data registers are Part 4)                                        | `tests/adr-072/register-type-position-error.test.cnx`                                                                                                   |
| E0938 | Two register members overlap outside an offset group (Layout Rules)                                                                         | `tests/adr-072/register-overlap-error.test.cnx`                                                                                                         |
| E0939 | A register member's offset is not a multiple of its size (Layout Rules)                                                                     | `tests/adr-072/register-misaligned-error.test.cnx`                                                                                                      |
| E0940 | The argument to a register parameter is not an instance of its register type, nor a register parameter of that type                         | `tests/adr-072/register-parameter-error.test.cnx`                                                                                                       |
| E0941 | A function with a register parameter is used as a callback type (ADR-029)                                                                   | `tests/adr-072/register-callback-type-error.test.cnx`                                                                                                   |
| E0942 | A register instance or register parameter is read, assigned or stored whole, where a value goes                                             | `tests/adr-072/register-as-value-error.test.cnx`                                                                                                        |
| E0943 | A register parameter is declared `mut`; a member's access mode governs its writes (ruling 12)                                               | `tests/adr-072/register-mut-parameter-error.test.cnx`                                                                                                   |

<!-- MATRIX-SEVERITY code: E0931 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | off      |
| scope member       | same file               | error    |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

An instance is declared at file or scope level only (E0934), so the function rows are off. The imported rows are off because E0931 is about the instance in the file being transpiled; an included file's instance is checked when that file is.

<!-- MATRIX-SEVERITY code: E0932 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | warn     |
| top-level function | same file               | off      |
| scope member       | same file               | warn     |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

A register type is declared at file or scope level only, so the function rows are off. The imported rows are off for the same reason as E0931. The two same-file rows are `warn`, not `error`: E0932 is reported on the member inside the register body, a position the matrix derives no context for, so `register-negative-offset-error` and `register-offset-not-constant-error` assert it without occupying a cell.

<!-- MATRIX-SEVERITY code: E0938 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | warn     |
| top-level function | same file               | off      |
| scope member       | same file               | warn     |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

As for E0932: a register type is declared at file or scope level only, so the function and imported rows are off, and E0938 is reported on the member inside the register body, a position the matrix derives no context for, so `register-overlap-error` asserts it without occupying a cell.

<!-- MATRIX-SEVERITY code: E0939 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | warn     |
| top-level function | same file               | off      |
| scope member       | same file               | warn     |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | off      |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | off      |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | off      |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | off      |
| for header         | exercised through chain | off      |

As for E0932: a register type is declared at file or scope level only, so the function and imported rows are off, and E0939 is reported on the member inside the register body, a position the matrix derives no context for, so `register-misaligned-error` asserts it without occupying a cell.

<!-- MATRIX-SEVERITY code: E0940 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
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
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

An argument is written in a call, which only a function body holds, so the variable rows are off. The imported rows are off: the diagnostic is about the argument at the call, wherever the function is declared.

<!-- MATRIX-SEVERITY code: E0941 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
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

E0941 is reported at the callback type's position. A parameter's type is a function's own, so that row is an error; a struct field's type is written in the struct body, a position the matrix derives no context for, so `register-callback-type-error` asserts it without occupying a cell.

<!-- MATRIX-SEVERITY code: E0942 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
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

E0942 is reported where a register stands as a value: a read, an assignment's target or value. The fixture's are in function bodies. The imported rows are off: the diagnostic is about the expression, wherever the register is declared.

<!-- MATRIX-SEVERITY code: E0943 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
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

E0943 is reported on a function's parameter, so it applies wherever a function is declared: a top-level function and a scope method. A variable and a `for` header declare no parameters, and the imported rows are off: the diagnostic is about the declaration, not a use of the register.

<!-- MATRIX-SEVERITY code: E0934 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
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
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

E0934 is the local instance, so only the function rows can hold it.

<!-- MATRIX-SEVERITY code: E0935 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

The imported rows are off: the diagnostic is about the declaration it is written on.

<!-- MATRIX-SEVERITY code: E0936 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
| for header         | same file               | error    |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

The imported rows are off: the diagnostic is about the declaration it is written on, even when its register type is imported.

<!-- MATRIX-SEVERITY code: E0937 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
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
| global variable    | exercised from one away | warn     |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | warn     |
| scope method       | exercised from one away | warn     |
| for header         | exercised from one away | off      |
| global variable    | exercised through chain | warn     |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | warn     |
| scope method       | exercised through chain | warn     |
| for header         | exercised through chain | off      |

The imported rows are off: the diagnostic is about the type position it is written in, even when the instance is imported.

## References

- [CMSIS-SVD Format](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/) — Rust SVD tool
- [Embedded HAL](https://docs.rs/embedded-hal/latest/embedded_hal/) — Rust embedded traits
- [i.MX RT1060 Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMXRT1060RM.pdf)
- ADR-004: Register Bindings
- ADR-034: Bitmap Types for Bit-Packed Data
