# ADR-007: Type-Aware Bit Indexing

**Status:** Implemented; section 3 (`.length`) superseded by [ADR-058](adr-058-explicit-length-properties.md)
**Date:** 2025-12-26
**Decision Makers:** cnx Language Design Team

## Context

Bit manipulation in embedded C is verbose and error-prone:

```c
// Traditional C - verbose and error-prone
uint8_t flags = 0;
flags |= (1 << 3);           // Set bit 3
flags &= ~(1 << 3);          // Clear bit 3
bool isSet = (flags >> 3) & 1;  // Read bit 3

// Bit ranges require masks
uint8_t field = (flags >> 4) & 0x0F;  // Read 4 bits at position 4
flags = (flags & ~(0x0F << 4)) | ((value & 0x0F) << 4);  // Write 4 bits
```

Problems with this approach:

1. **Verbose** — Simple bit operations require complex expressions
2. **Error-prone** — Easy to get shift amounts or masks wrong
3. **No bounds checking** — Nothing stops you from accessing bit 9 of a u8
4. **Repeated patterns** — Same bit manipulation code everywhere
5. **No type awareness** — C doesn't know u8 is 8 bits, u32 is 32 bits

### The Key Insight

The transpiler already knows type information:

- `u8` is 8 bits
- `u32` is 32 bits
- `buffer[16]` has 16 elements

**Why not expose this to the programmer?**

---

## Decision

### The Subscript Rule: `x[a]` is `x[a, 1]`

**`x[a]` is syntactic sugar for `x[a, 1]`, for every value** (owner ruling, 2026-11-16, #1691).
There is one subscript, `[start, count]`. Writing one index only leaves the count at its
default, 1. Nothing about a one-index subscript is decided separately: its type, its bounds,
its lowering and its diagnostics are those of `x[a, 1]`, in a read, a write, a compound
write and a `for` header.

What `count` counts is decided by what `x` is: bits for an integer, a float, a register
member or a bitmap field; characters for a `string<N>` (ADR-045); elements for an array.

| written                 | is                    | yields                                      |
| ----------------------- | --------------------- | ------------------------------------------- |
| `flags[3]` (a `u8`)     | `flags[3, 1]`         | one bit                                     |
| `flags[3] <- true`      | `flags[3, 1] <- true` | a write of one bit                          |
| `f[31]` (an `f32`)      | `f[31, 1]`            | one bit, read through the union (see Float) |
| `GPIO7.DR[3]`           | `GPIO7.DR[3, 1]`      | one bit of the register member              |
| `s.Mode[1]`             | `s.Mode[1, 1]`        | one bit of the bitmap field                 |
| `name[2]` (`string<8>`) | `name[2, 1]`          | a `string<1>` (ADR-045)                     |
| `arr[2]` (`u32[8]`)     | `arr[2, 1]`           | one element, a `u32`                        |
| `grid[1]` (`u8[4][8]`)  | `grid[1, 1]`          | one row, a `u8[8]`                          |

A bit is a bit range one bit wide, and an element is a slice one element long. There is no
"single bit" or "single element" access distinct from a range: an implementation that keeps
one as its own kind has two code paths for one construct, and the second path drifts
(#1691: the float union was built for `f[a, n]` only, so `f[a]` shifted a float).

### 1. Integers Are Indexable as Bit Arrays

Any integer type can be indexed to access individual bits:

```cnx
mut u8 flags <- 0;
flags[3] <- true; // Set bit 3
flags[3] <- false; // Clear bit 3
bool isSet <- flags[3]; // Read bit 3
```

**Generated C:**

```c
uint8_t flags = 0;
flags = (flags & ~(1 << 3)) | ((1) << 3);   // Set
flags = (flags & ~(1 << 3)) | ((0) << 3);   // Clear
bool isSet = ((flags >> 3) & 1);             // Read
```

### 2. Bit Range Syntax: [start, width]

Access multiple bits with `[start, width]` syntax:

```cnx
mut u8 flags <- 0;
flags[0, 3] <- 5; // Set 3 bits starting at bit 0 to value 5
u8 field <- flags[4, 4]; // Read 4 bits starting at bit 4
```

**Generated C:**

```c
uint8_t flags = 0;
flags = (flags & ~(((1 << 3) - 1) << 0)) | ((5 & ((1 << 3) - 1)) << 0);
uint8_t field = ((flags >> 4) & ((1 << 4) - 1));
```

### 3. Length Properties

Superseded by [ADR-058](adr-058-explicit-length-properties.md), which defines every length property. This ADR defines none.

---

## Syntax Rationale

### Why [start, width] Instead of [high:low]?

We considered several alternatives from other languages:

| Language | Syntax           | Example                |
| -------- | ---------------- | ---------------------- |
| Verilog  | `[7:4]`          | High:low bit range     |
| Verilog  | `[4 +: 4]`       | Start, ascending width |
| VHDL     | `(7 downto 4)`   | High down to low       |
| Ada      | `(4..7)`         | Range with dots        |
| Rust     | `bits.get(4..8)` | Method call with range |

**Decision:** `[start, width]` because:

1. **Intuitive for C programmers** — Matches how you think about bit fields
2. **Matches shift operations** — `value >> start` shifts to position, `& ((1 << width) - 1)` masks
3. **No confusion about inclusive/exclusive** — Width is always exact
4. **Comma separator** — The count follows the start; leaving it out means a count of 1 (`[n]` is `[n, 1]`)

### Why Not Variable Indices Initially?

```cnx
mut u8 flags <- 0;
u32 i <- 3;
flags[i] <- true; // in range: i is read-only 3, and u8 has 8 bits
```

Variable indices are supported but not compile-time validated. Future work may add runtime bounds checking or restrict to compile-time constants for memory safety.

---

## Implementation Details

### One Subscript Kind

The transpiler has one subscript: a start and a count. `[a]` is typed as `[a, 1]` the
moment its operand's type is known, and no pass may branch on how many indexes were
written. What varies is only what the count counts (bits, characters, elements), which the
operand's type decides once.

### Type Tracking

A bit index is resolved against the operand's **declared type**, never against its
value or its current contents. The widths are the ones in ADR-044's type table;
`u8[16] buffer` carries both an element count and, per element, a bit width.

This is what makes the feature type-_aware_ rather than a bit-twiddling shorthand: the
same index expression is in range or out of range depending only on what the operand
was declared as.

```cnx
mut u8 small <- 0;
mut u32 wide <- 0;

wide[20] <- true; // in range: u32 has 32 bits
small[20] <- true; // out of range: u8 has 8 bits
```

Both spellings are identical as text. Nothing about `20`, and nothing about what
either variable happens to hold, distinguishes them — only the declaration does. An
untyped bit-index feature could not tell them apart at all, which is the alternative
this ADR rejects.

### Register Bit Access

Bit indexing works with register members:

```cnx
register GPIO7 @ 0x42004000 {
    DR: u32 rw @ 0x00,
}

u32 LED_BIT <- 3;
bool isOn <- GPIO7.DR[LED_BIT];   // Read bit 3 of DR register
```

**Generated C:**

```c
bool isOn = ((GPIO7_DR >> LED_BIT) & 1);
```

---

## Examples

### LED Blink with Bit Indexing

```cnx
// Create a mask using bit indexing
u32 mask <- 0;
mask[LED_BIT] <- true;        // Set the LED bit
GPIO7.DR_SET <- mask;         // Atomic write to set register
```

**Generated C:**

```c
uint32_t mask = 0;
mask = (mask & ~(1 << LED_BIT)) | ((true ? 1 : 0) << LED_BIT);
GPIO7_DR_SET = mask;
```

### Configuration Bitfields

```cnx
mut u8 config <- 0;
config[0, 2] <- 3; // Mode: bits 0-1
config[2, 3] <- 5; // Priority: bits 2-4
config[5] <- true; // Enable: bit 5
config[6] <- false; // Interrupt: bit 6
```

### Float Bit Indexing (IEEE-754 Byte Access)

Float types (`f32`, `f64`) support bit indexing for type-safe access to their underlying IEEE-754 representation. Unlike integer bit indexing which uses direct bitwise operations, float bit indexing copies the float into a union with an unsigned integer of the same width, because MISRA C:2012 Rule 21.15 forbids the pointer cast (and `memcpy` would pass incompatible pointer types). One bit, `value[31]`, is `value[31, 1]` and goes through the same union.

```cnx
// Build an f32 from little-endian bytes
mut f32 value <- 0.0;
value[0, 8] <- 0x00; // Byte 0 (LSB)
value[8, 8] <- 0x00; // Byte 1
value[16, 8] <- 0x80; // Byte 2
value[24, 8] <- 0x3F; // Byte 3 (MSB) → value is now 1.0f

// Read bytes from a float
u8 highByte <- value[24, 8]; // Read MSB
```

**Generated C:**

```c
/* MISRA C:2012 Rule 21.15: float bits accessed through a union (memcpy would pass incompatible pointer types: float* vs uint32_t*). */
union { float f; uint32_t u; } __bits_value;
__bits_value.f = value;
__bits_value.u = (__bits_value.u & ~((uint32_t)0xFFU << 24)) | ((0x3FU & (uint32_t)0xFFU) << 24);
value = __bits_value.f;
// ... subsequent accesses reuse __bits_value ...

// Read operation
const uint8_t highByte = ((__bits_value.u >> 24U) & 0xFFU);
```

**Type Mapping:**

| Float Type | Union Integer | Size |
| ---------- | ------------- | ---- |
| `f32`      | `uint32_t`    | 4    |
| `f64`      | `uint64_t`    | 8    |

**Use Cases:**

- Serialization/deserialization of binary protocols
- CAN bus message encoding (J1939, etc.)
- Network byte order conversion
- Low-level IEEE-754 manipulation

### Float Bit Access vs. Integer Truncation

There are **two distinct ways** to extract bits from a float value:

| Syntax           | Behavior                               | Result for `f32 a <- 1.5`       |
| ---------------- | -------------------------------------- | ------------------------------- |
| `a[0, 8]`        | Raw IEEE-754 bytes                     | `0x00` (low byte of 0x3FC00000) |
| `((u32)a)[0, 8]` | Truncate to integer, then extract bits | `1` (integer part)              |

**Example:**

```cnx
f32 temperature <- 25.7;

// Raw IEEE-754 byte access (for binary protocols)
u8 rawByte <- temperature[0, 8];  // Some byte from IEEE-754 representation

// Integer truncation then bit extract (for numeric processing)
u8 intValue <- ((u32)temperature)[0, 8];  // 25 (truncated integer value)
```

Choose the appropriate method based on your use case:

- **Binary protocols/serialization**: Use `floatVar[offset, width]` for raw bytes
- **Numeric value extraction**: Use `((u32)floatVar)[offset, width]` for truncated integer

---

## Compile-Time Validation (Future Work)

For compile-time constant indices, the transpiler can validate:

```cnx
mut u8 myVar <- 0;
myVar[7] <- true; // OK: bit 7 exists in u8
myVar[8] <- true; // ERROR: u8 only has bits 0-7
myVar[0, 9] <- 5; // ERROR: 9 bits exceeds u8 width
```

A constant index past the value's width, or a constant range whose last bit is,
is E0920 (#1808, implemented 2026-10-19 in #2155). A bitmap field is indexed
within its own width (ADR-034, #2251): on `Mode[3]`, `p.Mode[3]` is E0920
rather than a write into the next field. A runtime index is not checked.

### Implemented: subscript depth (E0856, Issue #1106)

A neighboring check does exist. Bit-index _bounds_ (above) remain future work, but
subscript _depth_ is validated today: since a scalar may be bit-indexed **once**, and
ADR-036 peels one array dimension per subscript, an integer or float base accepts at
most `arrayDimensions + 1` subscripts (a `bool`, a `char` and a 1-bit field take none
for a bit, below). A deeper chain indexes a value that is not an array
and is rejected with **E0856**.

```cnx
mut u8 flags <- 0;
flags[4] <- true; // OK: one bit index on a scalar
flags[4, 3] <- 5; // OK: bit range
flags[4][3] <- 5; // ERROR E0856: flags[4] is flags[4, 1], one bit, not an array
```

Enforced for every ADR-016 spelling of the base — bare, `this.` and `global.` — via a
single shared classifier (Issue #1115). Before that unification the prefixed forms
silently miscompiled: the write dropped the second subscript and coerced the value to a
bool, and the read chained bit-indexes into always-zero code.

The limit belongs to the value being indexed, so a struct field is measured by the
field's own declared shape, at any depth of the chain (Issue #1114). Before this, the
struct-field forms were accepted: the write emitted C that subscripts a scalar, and the
read chained bit-indexes.

```cnx
struct Packet { u8 header; u8[4] bytes; }
mut Packet p;

void setBits() {
    p.header[4] <- true;   // OK: one bit index on a scalar field
    p.bytes[1][2] <- true; // OK: one element, then one bit
    p.header[4][3] <- 5;   // ERROR E0856: p.header[4] is p.header[4, 1], one bit, not an array
    p.bytes[1][2][3] <- 5; // ERROR E0856: p.bytes allows at most 2
}
```

A `bool` takes no bit index: it is already one bit wide, so indexing it makes no sense
(owner ruling, Issue #2354). It takes one subscript per array dimension and nothing more.
Before this, `done[1] <- true` was accepted and set the whole bool, and `done[1]` always
read 0.

A bitmap field follows the same rule by its declared width. A 1-bit field is a single
bit, so it takes no bit index; a wider field takes one, like a scalar:

```cnx
bitmap8 Status { Ready, Mode[3], Rest[4] }
mut Status s;

void setStatus() {
    s.Mode[1] <- true;      // OK: one bit of a 3-bit field
    s.Ready[0] <- true;     // ERROR E0856: s.Ready is already one bit wide
    s.Mode[1][0] <- true;   // ERROR E0856: s.Mode[1] is s.Mode[1, 1], one bit, not an array
}
```

A C struct's bit-field is measured the same way, by its declared width: in
`struct { unsigned int one : 1; unsigned int three : 3; } cs`, `cs.one[0]` is E0856
and `cs.three[1]` reads one bit.

A `char` takes no bit index either. A bit index shifts and masks, and ADR-045 forbids
both on a character (MISRA C:2012 Rule 10.1), so `name[1][2]` on a `char[4]` is E0856.
Cast the character to an integer type to read its bits, which makes the intent explicit
(owner ruling, Issue #1114 review):

```cnx
bool high <- ((u8)name[1])[7]; // OK: the u8 takes a bit index
bool bad <- name[1][7];        // ERROR E0856: a char takes no bit index
```

```cnx
mut bool done;
mut bool[4] ready;

void flags() {
    ready[1] <- true;    // OK: one element
    done[1] <- true;     // ERROR E0856: a scalar bool allows at most 0
    ready[1][0] <- true; // ERROR E0856: ready allows at most 1
}
```

---

## Trade-offs

### Advantages

1. **Intuitive syntax** — Integers as bit arrays is natural
2. **Type safety** — Compiler knows bit widths
3. **No runtime cost** — All operations are compile-time transforms
4. **Eliminates patterns** — No more manual mask/shift code

### Disadvantages

1. **Verbose output** — Generated C is more complex than hand-written
2. **New syntax** — Programmers must learn `[start, width]`
3. **Limited validation** — Variable indices can't be checked at compile time

---

## Interaction with Other Features

### Register Bindings (ADR-004)

Bit indexing combines naturally with register syntax:

```cnx
register UART @ 0x40000000 {
    SR: u32 ro @ 0x00,
}

bool txEmpty <- UART.SR[7];     // Read TX empty flag
```

### Namespaces (ADR-002)

Bit operations work within namespace functions:

```cnx
namespace LED {
    void on() {
        u32 mask <- 0;
        mask[LED_BIT] <- true;
        GPIO7.DR_SET <- mask;
    }
}
```

### Array Slice Assignment (Issue #234, #1081)

The `[offset, length]` syntax has a different meaning when applied to arrays versus scalars:

| Context                                 | Syntax                    | Meaning                                                                   |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| Scalar (u8, u32, etc.)                  | `value[start, width]`     | Bit range manipulation                                                    |
| Array (any element type, any dimension) | `bufArray[offset, count]` | `count` elements from element `offset`; `bufArray[i]` is `bufArray[i, 1]` |
| String (`string<N>`)                    | `s[offset, count]`        | `count` characters (ADR-045)                                              |

**Revised (owner ruling, 2026-11-16, #1691): an array slice counts elements.** Before this,
`length` was a byte count, a slice was a write-only integer serialization, and only a
one-dimensional array could be sliced. Each of those made `arr[i]` and `arr[i, 1]` two
different things, which the Subscript Rule forbids.

- **Read:** `arr[off, n]` is `n` elements, a `T[n]`, as `s[i, n]` is a `string<n>`. `n = 1`
  is the element itself: `arr[i]`.
- **Write:** `arr[off, n] <-` takes a `T[n]`, an element when `n = 1` (`arr[i, 1] <- x` is
  `arr[i] <- x`), or an integer split across the `n` elements least-significant first, as
  below (`s[0, 2] <- 0x4241` does the same with characters).
- **Every dimension:** a subscript indexes one dimension and yields the nested type
  (ADR-036). `grid[i]` is `grid[i, 1]`, one row; `grid[i, 2]` is two rows.
- **Offset and count:** the offset may be a runtime value, as `arr[i]`'s index always could,
  and is evaluated once; a runtime offset is bounds-checked as an index is (ADR-036). The
  count must be a compile-time constant, so the type `T[n]` is known.

The integer-split write below is what the earlier, byte-counted construct did. Its lowering
is unchanged; only its count is now elements.

#### Superseded: `memcpy` lowering (MISRA C:2012 Rule 21.15)

Earlier versions lowered an array slice to a single `memcpy`:

```c
/* Superseded — no longer generated */
memcpy(&packetArray[0], &magic, 4);
```

This form was **superseded** (Issue #1081) for two reasons:

1. **MISRA C:2012 Rule 21.15 violation** — `memcpy` was handed incompatible pointer types: the destination was a byte buffer (`uint8_t *`) while the source was a wider integer (`uint32_t *`). Rule 21.15 requires the pointer arguments of `memcpy`/`memmove`/`memcmp` to point to compatible types.
2. **Non-deterministic byte order** — `memcpy` copied the value in the host's native byte order, so the same source produced different bytes on a big-endian target than on a little-endian target.

#### Current behavior: per-element little-endian unrolled writes

An array slice now lowers to fully-unrolled, per-element writes. Each destination element receives one slice of the source, extracted with an explicit right shift, so the bytes are written **least-significant-first (little-endian) on every target**, regardless of host endianness.

**Units (exactly as the transpiler treats them):**

- **`offset` is an element index** — `bufArray[2, 4]` begins writing at element `2`, not byte 2. For a `u8[]` an element is one byte, so the element index and the byte offset coincide; for wider arrays they differ.
- **`count` is an element count** — the number of destination elements written; an integer source is split into `count` elements, so it supplies `count * elementSize` bytes.
- **Bounds are checked as an element span**: `offset + count <= capacity`. An in-bounds slice at a non-zero offset into a `u16[]`/`u32[]`/`u64[]` is accepted.
- The **source is evaluated exactly once**: it is materialized into a single unsigned temporary before the writes, so an impure source such as `packetArray[0, 4] <- readSensor()` calls `readSensor()` once, not once per byte. (A single-element slice, where the value is used only once, skips the temporary.) Shifting the unsigned temporary also keeps every write MISRA C:2012 Rule 10.1-clean.

The Rule 21.15 comment is emitted only when an equivalent `memcpy` would genuinely have passed incompatible pointer types: the source type is **known**, **differs** from the destination element type (the comment names the two types, e.g. `uint8_t* vs uint32_t*`), and **more than one element** is written. A same-type slice (`u32[] <- u32`), a single-element write, or a source whose type cannot be resolved at compile time omits the comment — the citation is never asserted where the incompatibility cannot be proven.

**`u8[]` slice (one byte per element):**

```cnx
mut u8[256] packetArray;
u32 value32 <- 0x12345678;
packetArray[0, 4] <- value32;
```

Generated C:

```c
uint8_t packetArray[256] = {0};
uint32_t value32 = 0x12345678U;
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint8_t* vs uint32_t*). */
const uint32_t _tmp0 = (uint32_t)(value32);
packetArray[0] = (uint8_t)(_tmp0);
packetArray[1] = (uint8_t)(_tmp0 >> 8U);
packetArray[2] = (uint8_t)(_tmp0 >> 16U);
packetArray[3] = (uint8_t)(_tmp0 >> 24U);
```

**`u16[]` slice (element offset, whole `uint16_t` writes):**

```cnx
mut u16[8] wordArray;
u32 v <- 0x11223344;
wordArray[2, 2] <- v;
```

Generated C:

```c
uint16_t wordArray[8] = {0};
uint32_t v = 0x11223344U;
/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint16_t* vs uint32_t*). */
const uint32_t _tmp0 = (uint32_t)(v);
wordArray[2] = (uint16_t)(_tmp0);
wordArray[3] = (uint16_t)(_tmp0 >> 16U);
```

Here `offset = 2` is an element index (writing starts at `wordArray[2]`) and `count = 2` is an element count, so the four bytes of `v` land in two `uint16_t` elements (`wordArray[2]` and `wordArray[3]`), each shifted into little-endian order.

**Issue #234: Compile-Time Safety Requirements**

Array slice assignment enforces strict compile-time safety:

1. **Offset may be a runtime value** (revised, #1691) — `arr[i]` always took a runtime index and is `arr[i, 1]`; a folded offset is bounds-checked at compile time, a runtime one as an index is (ADR-036).
2. **Count must be a compile-time constant** — literals or read-only bindings with a literal value.
3. **Bounds checked** — `offset + count <= capacity`.
4. **Any dimension** (revised, #1691) — `grid[i, n]` is `n` rows.
5. **Source** — a `T[n]`, an element when `count` is 1, or an integer split across the elements; an integer may not be wider than `count * elementSize` bytes. A bare integer **literal** source is contextually typed to the slice width (ADR-052) and must fit in `length` bytes — e.g. `packetArray[0, 2] <- 0x12345678` is a compile error (a 4-byte value will not fit a 2-byte slice).

```cnx
// VALID: compile-time constants
packetArray[0, 4] <- magic;
packetArray[HEADER_OFFSET, 4] <- magic;  // const variable

// VALID: runtime offset, constant count (revised, #1691)
u32 offset <- 0;
packetArray[offset, 4] <- magic;

// VALID: an outer dimension -- board[0, 1] is board[0], one row (revised, #1691)
mut u8[4][8] board;
board[0, 1] <- row;  // row is a u8[8]

// INVALID: runtime count
packetArray[0, offset] <- magic;  // ERROR E0859: the count must be a compile-time constant
```

**Design Rationale (Issue #272):**

The compile-time-constant requirement is a deliberate safety design choice. An earlier implementation emitted a runtime-bounds-checked `memcpy` that was _silently skipped_ when the bounds check failed, producing subtle bugs (e.g. incorrect CRC checksums from skipped writes). Two things removed that hazard:

1. **No `memcpy` at all.** The current lowering is unrolled per-element writes, so there is no `memcpy` call that can be silently skipped — the "silent skip" failure mode described in #272 is now moot.
2. **Compile-time bounds.** Requiring compile-time constants lets the element-span bound be verified before the code runs: if it compiles, it cannot overflow at runtime, which aligns with MISRA and similar safety-critical coding standards.

A runtime count is rejected, because the slice's type `T[count]` and its span must be known at compile time. A runtime offset is accepted (revised, #1691): `arr[i]` is `arr[i, 1]`, and one element has always taken a runtime index. The characters of a `string<N>` were ruled this way first (owner ruling, 2026-11-05, #2385); arrays now follow the same rule.

**Named Compile-Time Offsets**

When a struct layout is fixed, the offsets are known at compile time. Use read-only bindings (no `mut`, ADR-071) to keep the writes readable while preserving compile-time safety:

```cnx
u32 OFFSET_FIELD1 <- 0;
u32 OFFSET_FIELD2 <- 4;
u32 OFFSET_FIELD3 <- 6;

packetArray[OFFSET_FIELD1, 4] <- data.field1;
packetArray[OFFSET_FIELD2, 2] <- data.field2;
packetArray[OFFSET_FIELD3, 1] <- data.field3;
```

---

## Success Criteria

1. `flags[3] <- true` compiles to correct bit-set C code
2. `flags[0, 3] <- 5` compiles to correct bit-range C code
3. Bit access works with register members
4. blink.cnx works on Teensy MicroMod with new syntax
5. `packetArray[0, 4] <- value` generates per-element little-endian unrolled writes — one shifted byte/element write per destination element, no memcpy (Issue #234, #1081)
6. Runtime offsets in slice assignment produce compile-time errors (Issue #234)
7. Multi-dimensional array outer-dimension slicing produces compile-time errors (Issue #234)

---

## Diagnostics: bit access

| Code  | Reported when                                      | Asserted by                                                            |
| ----- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| E0856 | A base is subscripted deeper than its shape allows | `tests/adr-007/subscript-depth-*-error.test.cnx`                       |
| E0888 | A float's bits are read at file scope              | `tests/adr-007/float-bit-range-global-scope-error.test.cnx`            |
| E0890 | A read-modify-write target has a side effect       | `tests/adr-007/rmw-side-effect-*error.test.cnx`                        |
| E0858 | A slice target cannot be sliced (element type)     | `tests/adr-007/slice-outer-dim-error.test.cnx`                         |
| E0859 | A slice assignment offset or length does not fold  | `tests/adr-007/slice-runtime-offsets.test.cnx`                         |
| E0860 | A slice assignment span does not fit the buffer    | `tests/adr-007/slice-bounds-violation.test.cnx`                        |
| E0861 | A slice assignment source does not fit the slice   | `tests/adr-007/slice-length-exceeds-source.test.cnx`                   |
| E0920 | A constant bit index is past the value's width     | `tests/bugs/issue-1808-bit-index-width/bit-index-width-error.test.cnx` |

An array takes one subscript per dimension (ADR-036) and a bit-indexable scalar
element one more, for the bit. A third subscript on a one-dimensional array is
therefore indexing a value that is not an array, and the spelling the author
usually wanted is the bit range.

Reading a float's bits copies it through a union, because MISRA C:2012 Rule
21.15 forbids the pointer cast. A copy is a statement, and file scope has none
-- which makes E0888 the one rule here about WHERE the access is written rather
than what it is written on. `f[a]` is `f[a, 1]`, so one bit goes through the
union too and is restricted the same way.

Both are asked of an expression and of an assignment TARGET. They are different
node types, and both fixtures for E0856 are writes.

**A read-modify-write evaluates its target once** (owner ruling, 2026-09-27,
#1760 review). A bit, bit-range or bitmap-field write keeps the bits it does not
name, so it reads its target and stores it back. Every subscript in the target,
the bit index included, would be evaluated twice: a call there would run twice,
and a volatile read could pick a different element for the store than for the
read. Such a subscript is an error (E0890), as a call in a condition is (E0702).
Store it in a variable first:

```cnx
arr[idx()][3] <- true;   // ERROR E0890: idx() would run twice
u8 i <- idx();
arr[i][3] <- true;       // OK
arr[idx()] <- 7;         // OK: a whole-element write evaluates its target once
```

A write-1 register member (`wo`, `w1s`, `w1c`, ADR-004) is written without being
read, so its bit writes are not restricted. A compound operator on a bit is
already E0857.

## Scope-context matrix

Declared per diagnostic code (#1620): each code in the table above has its own
matrix, occupied only by fixtures asserting that code. The four slice codes are
**array slice assignment**'s rules (the section above), which #1322 moved out of
codegen: the target must be a one-dimensional integer or string buffer whose size
folds (E0858), the offset and length must fold (E0859), the span must fit
(E0860), and the source must fit the span (E0861).

<!-- MATRIX-SEVERITY code: E0856 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
| for header         | same file               | error    |
| global variable    | imported direct         | error    |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | error    |
| scope method       | imported direct         | error    |
| for header         | imported direct         | error    |
| global variable    | imported transitive     | error    |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| scope method       | imported transitive     | error    |
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

<!-- MATRIX-SEVERITY code: E0858 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
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

off: E0858 is asked of a slice assignment, a statement, so it only fires in a function body (a `for` header's declaration writes no target).

<!-- MATRIX-SEVERITY code: E0859 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
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

off: E0859 is asked of a slice assignment, a statement, so it only fires in a function body (a `for` header's declaration writes no target).

<!-- MATRIX-SEVERITY code: E0860 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
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

off: E0860 is asked of a slice assignment, a statement, so it only fires in a function body (a `for` header's declaration writes no target).

<!-- MATRIX-SEVERITY code: E0861 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
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

off: E0861 is asked of a slice assignment, a statement, so it only fires in a function body (a `for` header's declaration writes no target).

<!-- MATRIX-SEVERITY code: E0888 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | off      |
| scope member       | same file               | error    |
| scope method       | same file               | off      |
| for header         | same file               | off      |
| global variable    | imported direct         | error    |
| top-level function | imported direct         | off      |
| scope member       | imported direct         | error    |
| scope method       | imported direct         | off      |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | error    |
| top-level function | imported transitive     | off      |
| scope member       | imported transitive     | error    |
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

off: E0888 only fires at file scope; in a function body, `for` header included, the union copy is a statement and the read is accepted.

<!-- MATRIX-SEVERITY code: E0890 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | off      |
| top-level function | same file               | error    |
| scope member       | same file               | off      |
| scope method       | same file               | error    |
| for header         | same file               | off      |
| global variable    | imported direct         | off      |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | off      |
| scope method       | imported direct         | error    |
| for header         | imported direct         | off      |
| global variable    | imported transitive     | off      |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | off      |
| scope method       | imported transitive     | error    |
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

off: E0890 is asked of a bit write's target, a statement, so it only fires in a function body; an initializer only reads (a call there is E0909).

<!-- MATRIX-SEVERITY code: E0920 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| global variable    | same file               | error    |
| top-level function | same file               | error    |
| scope member       | same file               | error    |
| scope method       | same file               | error    |
| for header         | same file               | error    |
| global variable    | imported direct         | error    |
| top-level function | imported direct         | error    |
| scope member       | imported direct         | error    |
| scope method       | imported direct         | error    |
| for header         | imported direct         | error    |
| global variable    | imported transitive     | error    |
| top-level function | imported transitive     | error    |
| scope member       | imported transitive     | error    |
| scope method       | imported transitive     | error    |
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

A slice assignment is a **statement**. It appears in a function body and
nowhere else, so the two declaration contexts cannot hold one -- the same shape
as a `critical` block, and for the same reason.

The imported columns are `error` for both function contexts because the rules are
checked against the buffer's DECLARATION, which may live in another file. That
is not a hypothetical: resolving the target through the current file alone made
an out-of-bounds slice on an imported buffer pass the check entirely.

## References

### Bit Manipulation in Other Languages

- [Verilog Bit-Select and Part-Select](https://www.chipverify.com/verilog/verilog-part-select)
- [VHDL Slice Notation](https://www.ics.uci.edu/~jmoorkan/vhdlref/arrays.html)
- [Ada Bit Operations](https://learn.adacore.com/courses/intro-to-ada/chapters/standard_library_containers.html)
- [Rust bitvec Crate](https://docs.rs/bitvec/)
- [D Language Bit Manipulation](https://dlang.org/spec/expression.html#bit_manipulation)

### C Bit Manipulation Patterns

- [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html)
- [Embedded.com: Bit Manipulation](https://www.embedded.com/bit-manipulation-basics/)
- [MISRA C: Bitwise Operations](https://www.misra.org.uk/)
