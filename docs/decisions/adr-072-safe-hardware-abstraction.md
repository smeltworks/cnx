# ADR-072: Safe Hardware Abstraction Primitives

**Status:** Research
**Date:** 2026-02-20 (revised 2026-07-04: simplified register syntax; added Parts 4–5)
**Decision Makers:** Language Design Team
**Supersedes:** ADR-004 (Register Bindings — on acceptance; this ADR removes the `register Name @ address { }` form ADR-004 defines)
**Amends:** ADR-016 (`### Scoped Registers` — on acceptance; that section's `@ address` examples go with it)
**Related ADRs:** ADR-034 (Bitmap Types), ADR-033 (Packed Structs — Rejected; Part 4 is the safe alternative)

> **Status is load-bearing here.** While this ADR is `Research` it is **not**
> established syntax: ADR-004 still governs, a register is still not a type, and the
> `@ address` form is still the one to write. The supersession is recorded now so a
> reader arriving at ADR-004 has a route forward — it does not take effect until this
> ADR is Accepted.

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
GPIO1.ISR <- GPIO1.ISR;           // ERROR: RMW on w1c register
UART1.send("hello");              // ERROR: UART1 clock not enabled
GPIO1.Pin13 <- output;            // ERROR: Pin13 muxed to SPI
DMA.transfer(src, dst, 1000);     // ERROR: DMA not initialized
```

---

## Part 1: Parameterized Register Blocks

### Problem

The i.MX RT1062 (Teensy 4.x) has 9 GPIO ports with identical register layouts at different base addresses. Current syntax requires 9 separate definitions:

```cnx
// Current: repetitive and error-prone
register GPIO1 @ 0x401B8000 {
    DR:   GpioDirection rw @ 0x00,
    GDIR: GpioDirection rw @ 0x04,
    PSR:  GpioDirection ro @ 0x08,
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
3. **Zero runtime cost** — All addresses resolved at compile time
4. **MISRA compliance** — Generated C must pass static analysis
5. **SVD compatibility** — Syntax should map cleanly from SVD peripheral definitions

### Recommendation: Parameterized Register Blocks

Parameterized registers follow cnx's function-like patterns and are straightforward to implement — the base address is just a compile-time constant parameter.

### Specification: Parameterized Registers

#### Grammar (Breaking Change)

The base address is **not** a parameter. A register defines its fields at plain byte
offsets from an implicit base; the base is supplied at instantiation. A field is
`byteOffset access type name` with an optional scaling transform. Both the old
`register Name @ address { }` form and an explicit `(u32 baseAddress)` parameter are
removed — the base ceremony was pure boilerplate the transpiler can supply.

```antlr
registerDefinition
    : 'register' IDENTIFIER '{' registerField* '}'
    ;

registerField
    : byteOffset access type IDENTIFIER transform?
    ;

transform
    : ('multiplier' | 'divisor') NUMBER ('offset' NUMBER)?
    | 'offset' NUMBER
    ;

registerInstantiation
    : type IDENTIFIER ( '(' address ')' )? ';'   // address -> MMIO; omitted -> data register (Part 4)
    ;
```

Single-instance peripherals simply have one instantiation:

```cnx
// Single-instance peripheral (e.g., system control block)
register SystemControl {
    0x00 ro u32 CPUID,
    0x04 rw u32 ICSR,
}

SystemControl SCB(0xE000ED00);  // Only one instance
```

#### Syntax

```cnx
// Register definition — plain byte offsets, no base ceremony
register GpioPort {
    0x00 rw  GpioDirection DR,
    0x04 rw  GpioDirection GDIR,
    0x08 ro  GpioDirection PSR,
    0x0C rw  u32           ICR1,
    0x10 rw  u32           ICR2,
    0x14 rw  GpioDirection IMR,
    0x18 w1c GpioDirection ISR,
    0x1C rw  u32           EDGE,
    0x84 wo  GpioDirection DR_SET,
    0x88 wo  GpioDirection DR_CLR,
    0x8C wo  GpioDirection DR_TOG,
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
#define GPIO1_DR   (*(volatile uint32_t*)(0x401B8000 + 0x00))
#define GPIO1_GDIR (*(volatile uint32_t*)(0x401B8000 + 0x04))

#define GPIO2_DR   (*(volatile uint32_t*)(0x401BC000 + 0x00))
#define GPIO2_GDIR (*(volatile uint32_t*)(0x401BC000 + 0x04))
```

#### Implementation Notes

This is straightforward to implement:

1. **Parser**: `registerDeclaration` takes no parameter list; a field is `offset access type name transform?`
2. **Symbol Collection**: Store the register's fields (offset, access, type, optional transform) with the definition
3. **Instantiation**: When processing `GpioPort GPIO1(0x401B8000)`:
   - Look up `GpioPort` definition
   - Add the instance address `0x401B8000` to each field's byte offset
   - Evaluate constant expressions at compile time
   - Generate macros with resolved addresses

The key insight: **all expressions are compile-time constants**. No runtime evaluation needed — just constant folding during transpilation.

#### Type Identity and Generic Peripheral Code

Register instances can be used in two ways:

**Specific instance** — when you need a particular peripheral:

```cnx
void debugGpio1() {
    GPIO1.DR[13] <- true;  // Only works with GPIO1
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

setPin(GPIO1, 13);   // OK — GPIO1 is a GpioPort
setPin(GPIO2, 0);    // OK — GPIO2 is a GpioPort
setPin(UART1, 0);    // ERROR: UART1 is not a GpioPort
```

#### Function Specialization

The compiler **specializes** generic peripheral functions at each call site. There is no runtime indirection:

```cnx
setPin(GPIO1, 13);
setPin(GPIO2, 0);
```

Transpiles to:

```c
// Inlined/specialized — no function call overhead
GPIO1_DR |= (1 << 13);
GPIO2_DR |= (1 << 0);
```

If the function is too large to inline, the compiler generates separate specialized versions:

```c
void setPin_GPIO1(uint8_t pin) { GPIO1_DR |= (1 << pin); }
void setPin_GPIO2(uint8_t pin) { GPIO2_DR |= (1 << pin); }
```

This enables writing reusable HAL code without runtime overhead or duplicating source code per instance.

#### Compile-Time-Only Constraint

Register template types (`GpioPort`) are **compile-time-only identifiers**, not runtime values. They cannot be assigned to variables or stored in data structures:

```cnx
GpioPort activePort <- GPIO1;  // ERROR: register types are not assignable
activePort <- GPIO2;           // ERROR: cannot reassign register type
setPin(activePort, 13);        // Would require runtime indirection

GpioPort[2] ports <- [GPIO1, GPIO2];  // ERROR: cannot store registers in arrays
```

This is intentional — runtime polymorphism over registers would require function pointers or vtables, defeating zero-cost abstraction. If you need dynamic port selection, use explicit branching:

```cnx
void setPinOnPort(u8 portNum, u8 pin) {
    switch (portNum) {
        case 1 { setPin(GPIO1, pin); }
        case 2 { setPin(GPIO2, pin); }
        // ...
    }
}
```

The compiler may optimize this switch into a lookup table if beneficial, but the register access itself remains a direct memory operation.

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
    Chan0Err[4],   // 4 bits wide
    Chan1Err[4],
    Reserved[24]
}

u8 error <- 0xFF;

DMA.ERR.Chan0Err <- error;        // ERROR: u8 (8 bits) doesn't fit in 4-bit field
DMA.ERR.Chan0Err <- error[0, 4];  // OK: explicitly extract 4 bits
DMA.ERR.Chan0Err <- 0xF;          // OK: literal fits in 4 bits
DMA.ERR.Chan0Err <- 0x1F;         // ERROR: literal exceeds 4 bits
```

This follows cnx's philosophy of explicit bit extraction (`value[start, width]`) rather than C's implicit truncating casts.

#### Generated C

A `w1c` / `wo` / `w1s` bit assignment emits a **direct write**, never the
read-modify-write an `rw` field gets:

```cnx
STATUS.OVERFLOW <- true;    // STATUS declared w1c
CTRL.ENABLE <- true;        // CTRL declared rw
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
    0x00 rw  GpioPins DR,
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

3. **Field name sanitization** — SVD field names may conflict with cnx keywords

4. **Cluster handling** — SVD `<cluster>` elements represent register arrays; emit with appropriate indexing

5. **Dim handling** — SVD `<dim>`, `<dimIncrement>`, `<dimIndex>` represent register arrays (e.g., GPT timer's `OCR1`, `OCR2`, `OCR3` with dim=3). Default: expand to individual registers. Future: emit array syntax if cnx adds register arrays.

6. **Alternate registers** — SVD `<alternateGroup>` and `<alternateRegister>` handle registers sharing the same address with different access (e.g., UART THR/RBR). Emit as two register fields at same offset with `wo` and `ro` — cnx already supports this.

7. **Layout deduplication** — SVD files with layout-identical peripherals (without `derivedFrom`) are automatically consolidated into one template with multiple instances. The compiler enforces this: duplicate register definitions are an error.

8. **Struct name mapping** — SVD's `<headerStructName>` maps directly to the parameterized register template name

9. **Bitmap reuse** — When multiple registers have identical field layouts (e.g., DR and ISR both have Pin0-Pin31), generate one bitmap type and reuse it

#### Compiler Enforcement

Duplicate register definitions are a compile error:

```cnx
register Gpio1Port { 0x00 rw u32 DR }
register Gpio2Port { 0x00 rw u32 DR }
// ERROR: Gpio2Port has identical layout to Gpio1Port — use Gpio1Port instead
```

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
scaled fields (Part 5), template-as-interface — is unchanged.

```cnx
GpioPort GPIO1(0x401B8000);   // MMIO — address given
GpioPort scratch;             // data register — no address, normal memory
```

Bit-packed bytes use a bitmap field; byte-aligned scalars use a scalar type (with an
optional transform). A J1939 PGN is a data register:

```cnx
bitmap8 Etc1Control { drivelineEngaged[2], tccLockup[2], shiftInProcess[2], transition[2] }

register Etc1 {
    0 ro Etc1Control control,             // byte 0 — bit-packed, via bitmap
    1 ro u16 outputShaft divisor 8,       // bytes 1-2 — 0.125 rpm/bit
    3 ro u8  clutchSlip  multiplier 0.4,  // byte 3 — 0.4 %/bit
    5 ro u16 inputShaft  divisor 8,       // bytes 5-6
}

Etc1 etc1;                                 // in normal memory
```

Because J1939 fields are either byte-aligned or bit-fields within a single byte (never a
field that starts mid-byte and crosses a byte boundary), byte-offset registers plus
bitmaps cover the format completely.

### Open questions

- **Backing model.** An _owned_ buffer (the instance allocates its own bytes at a
  compile-time address; a received frame is copied in before reading) keeps ADR-072's
  zero-cost / compile-time model. A _view_ over an existing runtime buffer avoids the
  copy but holds a runtime pointer and needs a lifetime story. Owned-first is the minimal
  safe start.
- **How bytes get in.** A `load(bytes)` step, field-by-field assignment, or a view — tied
  to the backing-model choice.

---

## Part 5: Scaled Fields

_Added 2026-07-04._

### Problem

A raw register value often _means_ an engineering value: an ADC code is volts, an on-die
temperature reading is °C (via a calibration scale + offset), a J1939 signal is
`raw × resolution + offset`. Today the raw integer comes back and the caller applies the
formula by hand — the same magic-number-at-the-call-site problem registers exist to
remove.

### Decision

A register field may carry a scaling transform: **exactly one** of `multiplier N` or
`divisor N` (they are inverses — pick whichever reads cleaner: `divisor 8` beats
`multiplier 0.125`), followed by an optional `offset N`. Reading the field returns the
engineering value:

```
value = (raw {× multiplier | ÷ divisor}) + offset
```

Both is a compile error; neither means no scaling. `divisor` — the number divided _by_ —
is the precise term (not "divider").

```cnx
register Adc {
    0x00 ro u16 sample  divisor 4096,           // 12-bit code -> fraction of full scale
    0x04 ro i16 dieTemp divisor 100 offset -40, // on-die temp sensor -> °C
}
```

Scaled fields apply equally to MMIO (ADC, on-die temp, DAC, timer prescalers) and to data
registers (J1939 resolution/offset). The "raw code -> real-world unit" pattern is not
J1939-specific, which is why it belongs on the standard register field rather than in a
library.

### Open questions

- **Read type.** How `(storage type, multiplier/divisor, offset)` maps to the field's read
  type — when it is `f32` vs a wider integer vs the storage type.
- **Offset order.** `raw*scale + offset` (SAE/J1939) vs `(raw - offset)*scale` (some sensor
  calibrations). This ADR assumes the former.
- **Validity.** Whether a field can declare a not-available/error sentinel (e.g. J1939's
  0xFF/0xFE) and read as a `{value, valid}` pair — possibly a language feature, possibly
  left to library code layered on plain scaled fields.

---

## Summary

This ADR covers five features for safe hardware abstraction in cnx:

1. **Registers** — Define layouts once (byte offsets, implicit base), instantiate at multiple addresses
2. **Data registers** — Instantiate a register in normal memory (no address) for wire/buffer formats
3. **Scaled fields** — `multiplier`/`divisor` + `offset` on fields; reads return the engineering value
4. **w1c/wo/w1s codegen fix** — Generate direct writes instead of RMW for write-only registers
5. **svd2cnx tool** — Import register definitions from ARM SVD files

### Out of Scope (Future ADRs if needed)

- **Peripheral initialization ordering** — Developer responsibility; easy to catch during testing
- **Pin multiplexing conflicts** — HAL concern, not a language concern

---

## Decision

### Accepted

1. **Registers** — `register Name { byteOffset access type field, ... }` with `Name Instance(address);` instantiation. The base is implicit (not a parameter); fields are plain byte offsets. All registers use this syntax (breaking change). Template type serves as interface for generic peripheral code. Duplicate definitions are a compiler error.

2. **w1c/wo/w1s codegen fix** — Bit-field and bitmap-field writes generate direct writes, not RMW. Writing `false` to a w1c bit is a compiler error.

3. **svd2cnx tool** — TypeScript tool to generate cnx from SVD files. Auto-generates bitmap types from field definitions with good naming.

### Proposed (2026-07-04 revision — not yet accepted)

4. **Data registers** — A register instantiated without an address (`Name Instance;`) is backed by normal memory, giving typed field access to wire/buffer formats (CAN/J1939, packets) without ADR-033's packed-struct overlay hazards. Backing model (owned vs view) is open.

5. **Scaled fields** — A field may carry exactly one of `multiplier N` / `divisor N` plus optional `offset N`; reading returns `(raw {× multiplier | ÷ divisor}) + offset`. Serves MMIO (ADC, on-die temp) and wire data alike. Read-type inference, offset order, and validity are open.

---

## References

- [CMSIS-SVD Format](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/) — Rust SVD tool
- [Embedded HAL](https://docs.rs/embedded-hal/latest/embedded_hal/) — Rust embedded traits
- [i.MX RT1060 Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMXRT1060RM.pdf)
- ADR-004: Register Bindings
- ADR-034: Bitmap Types for Bit-Packed Data
