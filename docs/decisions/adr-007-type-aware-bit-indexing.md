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

### One subscript, not two (#1691)

A subscript written with one index and a subscript written with two were once two
constructs, so every feature had to be built for both. A feature built for only one left
the other wrong. A float's bits were read through a union for `a[1, 1]` but not for `a[1]`,
so this shifted the float, and the transpiler exited 0:

```cnx
f32 a <- 2.5;

void main() {
    bool b <- a[1];
}
```

```c
bool b = ((((a >> 1U) & 1)) != 0U); /* gcc: invalid operands to binary >> (have 'float' ...) */
```

§1 makes the two spellings one expression.

---

## Decision

### 1. A subscript is `x[start, length]`, and `length` defaults to 1

**`x[start]` is syntactic sugar for `x[start, 1]`, for every value** (owner ruling,
2026-11-16, #1691). A subscript is

```ebnf
subscript = "[" start [ "," length ] "]" ;
```

read as `index(start, length = 1)`. `x[start]` and `x[start, 1]` are one expression: the
same type, bounds, behavior and diagnostics, in a read, a write, a compound write and a
`for` header. There is no single-bit or single-element access distinct from a range.

What one unit of `length` is, and what a subscript yields, depends only on the type of `x`:

| `x` is                                                                     | one unit                          | `x[start]`, which is `x[start, 1]` | `x[start, n]`, n > 1                                   |
| -------------------------------------------------------------------------- | --------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| an integer, a float, a register member, or a bitmap field wider than 1 bit | a bit                             | a `bool`                           | the smallest unsigned type holding n bits, zero-padded |
| a `string<N>`                                                              | a character                       | a `string<1>` (ADR-045)            | a `string<n>` (ADR-045)                                |
| an array `T[N]`, of any element type and any dimension                     | an element of its first dimension | the element, a `T` (ADR-036)       | a `T[n]` (Array Slices, below)                         |

The bit rows type a range as a bitmap field of the same width reads (ADR-034): one bit is a
`bool`, and more bits are unsigned. A write `x[start, n] <-` takes what the read yields: n
bits take an integer that fits them, and one bit takes a `bool` as well; a string range
takes what ADR-045 lists; an array range takes exactly its own type.

| written                                       | is               | yields                                            |
| --------------------------------------------- | ---------------- | ------------------------------------------------- |
| `flags[3]` (`u8 flags`)                       | `flags[3, 1]`    | a `bool`, bit 3                                   |
| `flags[4, 4]`                                 |                  | a `u8`, bits 4-7                                  |
| `f[31]` (`f32 f`)                             | `f[31, 1]`       | a `bool`, the sign bit (Float Bit Indexing below) |
| `GPIO7.DR[3]` (`DR` a `u32` register member)  | `GPIO7.DR[3, 1]` | a `bool`, bit 3                                   |
| `s.Mode[1]` (`Mode[3]`, a 3-bit bitmap field) | `s.Mode[1, 1]`   | a `bool`, bit 1 of the field                      |
| `name[2]` (`string<8> name`)                  | `name[2, 1]`     | a `string<1>`                                     |
| `arr[2]` (`u32[8] arr`)                       | `arr[2, 1]`      | a `u32`, element 2                                |
| `grid[1]` (`u8[4][8] grid`)                   | `grid[1, 1]`     | a `u8[8]`, row 1                                  |
| `grid[1, 2]`                                  |                  | a `u8[2][8]`, rows 1 and 2                        |

The range works on everything except one bit (owner ruling, 2026-09-27, #1757). A `bool`,
a 1-bit bitmap field, a `char` and what a one-bit subscript yields take no subscript of any
length (E0856, below).

**A compound operator** (`+<-` and the others) takes an array subscript of length 1, which is
one element (ADR-036). On a bit subscript of any length, and on an array subscript longer
than 1, it is E0857.

**A constant subscript is checked at any length** against what it indexes: past an integer's
or a float's width it is E0920, past an array's dimension E0854 (ADR-036), and past a
string's `char[N + 1]` E0860 (ADR-045).

### 2. Bits of an Integer

```cnx
mut u8 flags <- 0;
flags[3] <- true; // flags[3, 1]: set bit 3
flags[3] <- false; // clear bit 3
bool isSet <- flags[3]; // read bit 3
flags[0, 3] <- 5; // bits 0-2 hold 5
u8 field <- flags[4, 4]; // bits 4-7
```

**Generated C:**

```c
uint8_t flags = 0U;
flags = (uint8_t)((flags & ~(1U << 3)) | (1U << 3));
flags = (uint8_t)((flags & ~(1U << 3)) | (0U << 3));
const bool isSet = ((((flags >> 3U) & 1)) != 0U);
flags = (uint8_t)((flags & ~(0x7U << 0)) | ((5U & 0x7U) << 0));
const uint8_t field = (uint8_t)((flags >> 4U) & 0xFU);
```

### 3. Length Properties

Superseded by [ADR-058](adr-058-explicit-length-properties.md), which defines every length property. This ADR defines none.

---

## Syntax Rationale

### Why [start, length] Instead of [high:low]?

We considered several alternatives from other languages:

| Language | Syntax           | Example                |
| -------- | ---------------- | ---------------------- |
| Verilog  | `[7:4]`          | High:low bit range     |
| Verilog  | `[4 +: 4]`       | Start, ascending width |
| VHDL     | `(7 downto 4)`   | High down to low       |
| Ada      | `(4..7)`         | Range with dots        |
| Rust     | `bits.get(4..8)` | Method call with range |

**Decision:** `[start, length]` because:

1. **Intuitive for C programmers** — Matches how you think about bit fields
2. **Matches shift operations** — `value >> start` shifts to position, `& ((1 << length) - 1)` masks
3. **No confusion about inclusive/exclusive** — The length is always exact
4. **Comma separator** — The length follows the start; leaving it out means a length of 1 (`[n]` is `[n, 1]`)

### Why Not Variable Indices Initially?

```cnx
mut u8 flags <- 0;
u32 i <- 3;
flags[i] <- true; // in range: i is read-only 3, and u8 has 8 bits
```

Variable indices are supported but not compile-time validated. Future work may add runtime bounds checking or restrict to compile-time constants for memory safety.

---

## Implementation Details

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
register GpioPort {
    0x00 rw u32 DR,
}

GpioPort GPIO7(0x42004000);

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

Float types (`f32`, `f64`) support bit indexing of their IEEE-754 binary32/binary64 encoding: bit 0 is the least significant bit of the significand, and bit 31 (`f32`) or 63 (`f64`) is the sign. One bit, `value[31]`, is `value[31, 1]`: bit 31 of that encoding.

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

- **Binary protocols/serialization**: Use `floatVar[start, length]` for raw bytes
- **Numeric value extraction**: Use `((u32)floatVar)[start, length]` for truncated integer

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

A neighboring check does exist: a subscript written on a value that takes none is
**E0856**. What each subscript yields decides what the next one may be (§1): on an array,
a length of 1 yields the element and a longer length an array of that length; on an
integer or a float, a subscript yields bits; and a `bool`, a `char`, a 1-bit field and
what a one-bit subscript yields take no subscript of any length. So `flags[4][3]` and
`flags[4, 1][3]` are both E0856, while `grid[0, 2][1]` on a `u8[4][8]` is `grid[1]`, a row.

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

A `bool` takes no subscript of any length: it is already one bit wide, so `done[0]` and
`done[0, 1]` make no sense
(owner ruling, Issue #2354). It takes one subscript per array dimension and nothing more.
Before this, `done[1] <- true` was accepted and set the whole bool, and `done[1]` always
read 0.

A bitmap field follows the same rule by its declared width. A 1-bit field is one bit
wide, so it takes no subscript of any length (`s.Ready[0]` and `s.Ready[0, 1]` are E0856);
a wider field takes one, like a scalar:

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

A `char` takes no subscript either. A bit index shifts and masks, and ADR-045 forbids
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
2. **New syntax** — Programmers must learn `[start, length]`
3. **Limited validation** — Variable indices can't be checked at compile time

---

## Interaction with Other Features

### Register Bindings (ADR-004)

Bit indexing combines naturally with register syntax:

```cnx
register UartPort {
    0x00 ro u32 SR,
}

UartPort UART(0x40000000);

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

### Array Slices (Issue #234, #1081, #1757)

A subscript means the same thing on every operand: a run of units starting at a given unit.
The operand's type decides only what one unit is:

| Operand                                 | Syntax                 | Selects                                                                                |
| --------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Scalar (`u8`, `u32`, `f32`, ...)        | `value[start, length]` | `length` bits from bit `start`                                                         |
| Array (any element type, any dimension) | `buf[start, length]`   | `length` elements of the first dimension from element `start`; `buf[i]` is `buf[i, 1]` |
| String (`string<N>`)                    | `s[start, length]`     | `length` characters (ADR-045)                                                          |

**An array subscript selects a sub-array** (owner ruling, 2026-09-27, #1757: "the [] syntax
should work on everything except a single bit, it simply narrows to the lower building
block"). It keeps the element type and shrinks the first dimension, the one `buf[i]` peels
(ADR-036). Its length counts elements (owner ruling, 2026-11-16, #1691).

With `u8[8][8][8] r`, `u8[8] buf`, `u8[4] four` and `u32 magic`:

| expression                 | type or result                                |
| -------------------------- | --------------------------------------------- |
| `r[2]`, which is `r[2, 1]` | `u8[8][8]`, the element `r[2]` (ADR-036)      |
| `r[2, 2]`                  | `u8[2][8][8]`, the elements `r[2]` and `r[3]` |
| `r[2, 2][1]`               | `u8[8][8]`, which is `r[3]`                   |
| `r[0][0][0][0, 4]`         | `u8`: bits 0-3 of `r[0][0][0]`, zero-padded   |
| `buf[0, 4] <- four`        | allowed: a `u8[4]` written into a `u8[4]`     |
| `buf[0, 4] <- magic`       | E0861: a `u32` is not a `u8[4]`               |
| `buf[0, 1] <- 7`           | `buf[0] <- 7`, one element                    |

- **Type:** on an array, a length of 1 yields the element, never a one-element array:
  `buf[i, 1]` is `buf[i]`, a `u8`. A length of n > 1 yields an array whose first dimension
  is n. A string differs only because its unit is itself a string: `s[i, 1]` is a
  `string<1>` (ADR-045).
- **The elements themselves:** a slice names elements of its array, as `buf[i]` names one.
  Passed to a `mut u8[4]` parameter, `buf[0, 4]` is written by the callee, as `buf[i]`
  passed to a `mut u8` parameter is. A declaration initialized from a slice copies it:
  `u8[4] head <- buf[0, 4];`. Read at file scope, a slice is E0909, as an element is.
- **Write:** `x[start, n] <-` takes exactly its own type: the same element type and every
  dimension equal, with no widening or padding (#1757). A length of 1 takes what
  `x[start] <-` takes, the element type. An integer is not an array, so an integer is
  serialized into bytes with bit ranges, written out:

  ```cnx
  buf[0] <- magic[0, 8];
  buf[1] <- magic[8, 8];
  buf[2] <- magic[16, 8];
  buf[3] <- magic[24, 8];
  ```

- **Every base:** a variable, a struct field, a row (`grid[1][0, 4]`), an element of an
  array of structs (`packets[i].payload[0, 4]`), a register array and an array from a C header
  are all arrays, and each is sliced the same way.
- **Start and length:** the start may be a runtime value, as `buf[i]`'s index always could,
  and is read once. The characters of a `string<N>` were ruled this way first (owner
  ruling, 2026-11-05, #2385). The length must be a compile-time constant (E0859), because it
  is part of the slice's type.
- **Bounds:** a constant start whose span runs past the dimension is E0854, at any length,
  as a constant index past it is (ADR-036). A runtime start is checked at run time, as
  ADR-036 checks a runtime index (#2435).

```cnx
mut u8[256] packetArray;
u8[4] header <- [0xCA, 0xFE, 0xBA, 0xBE];
u32 HEADER_OFFSET <- 4;

void fill(u32 offset) {
    packetArray[0, 4] <- header; // VALID: a u8[4] into a u8[4]
    packetArray[HEADER_OFFSET, 4] <- header; // VALID: a read-only start
    packetArray[offset, 4] <- header; // VALID: a runtime start, read once
    packetArray[0, offset] <- header; // ERROR E0859: the length must be a compile-time constant
    packetArray[254, 4] <- header; // ERROR E0854: elements 254-257 run past 255
}
```

#### Rejected: integer serialization (#234, #1081, #272)

Before #1757, `buf[offset, length] <- value` serialized an integer's bytes into the array,
least significant first, and `length` counted bytes: with `u32 value32`,
`packetArray[0, 4] <- value32` wrote its four bytes into `packetArray[0]` to
`packetArray[3]`. It could only be written, and only a one-dimensional array could be
sliced. That made `buf[i]` and `buf[i, 1]` two different things, which §1 forbids, and an
integer is not a `u8[4]`. The explicit bit-range form above replaces it. Two of its
lowerings were rejected along the way:

1. **One `memcpy`** (`memcpy(&packetArray[0], &magic, 4);`, #1081). It passed `memcpy`
   incompatible pointer types, `uint8_t *` and `uint32_t *` (MISRA C:2012 Rule 21.15), and
   it copied in the host's byte order, so one source produced different bytes on big- and
   little-endian targets.
2. **A runtime-bounds-checked `memcpy`** (#272). When the check failed, the copy was
   silently skipped; an incorrect CRC from a skipped write was the reported symptom. A
   constant length and a compile-time span check replaced it.

---

## Success Criteria

1. `flags[3] <- true` compiles to correct bit-set C code
2. `flags[0, 3] <- 5` compiles to correct bit-range C code
3. Bit access works with register members
4. blink.cnx works on Teensy MicroMod with new syntax
5. `buf[0, 4] <- four` (a `u8[4]`) writes four elements, and `buf[0, 4] <- magic` (a `u32`) is E0861 (#1757)
6. A runtime start in an array slice is accepted, and a runtime length is E0859 (revised, #1691)
7. Any dimension can be sliced: `r[2, 2]` of a `u8[8][8][8]` is a `u8[2][8][8]` (revised, #1757)
8. `x[a]` and `x[a, 1]` have the same type, behavior and diagnostics on every operand (#1691)

---

## Diagnostics: bit access

| Code  | Reported when                                                                                                         | Asserted by                                                            |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| E0856 | A base is subscripted deeper than its shape allows                                                                    | `tests/adr-007/subscript-depth-*-error.test.cnx`                       |
| E0888 | A float's bits are read at file scope, at any length (revised, #1691: the fixture's one-bit control becomes an error) | `tests/adr-007/float-bit-range-global-scope-error.test.cnx`            |
| E0890 | A read-modify-write target has a side effect                                                                          | `tests/adr-007/rmw-side-effect-*error.test.cnx`                        |
| E0858 | Retired (#1757): every array dimension can be sliced, so the fixture's error goes                                     | `tests/adr-007/slice-outer-dim-error.test.cnx`                         |
| E0859 | A subscript's length does not fold (revised, #1691: the fixture's runtime start becomes valid)                        | `tests/adr-007/slice-runtime-offsets.test.cnx`                         |
| E0860 | A string subscript's constant span is past its `char[N + 1]` (ADR-045); an array's is E0854 (revised, #1691)          | `tests/adr-007/slice-bounds-violation.test.cnx`                        |
| E0861 | A slice's source is not exactly the slice's type (revised, #1757)                                                     | `tests/adr-007/slice-length-exceeds-source.test.cnx`                   |
| E0920 | A constant bit index is past the value's width                                                                        | `tests/bugs/issue-1808-bit-index-width/bit-index-width-error.test.cnx` |

Each subscript is judged on what the one before it yielded (§1), and a subscript written
on a value that takes none is E0856. On a one-dimensional integer array, `a[i][b]` reads
bit `b` of an element, so a third subscript, `a[i][b][c]`, is written on one bit; the
spelling the author usually wanted is the bit range `a[i][b, n]`.

Reading a float's bits copies the float into a union (the generated C under Float Bit
Indexing): a pointer cast between the float and an integer would break MISRA C:2012 Rule
11.3, and a `memcpy` between them Rule 21.15. A copy is a statement, and file scope has
none -- which makes E0888 the one rule here about WHERE the access is written rather
than what it is written on. `f[a]` is `f[a, 1]`, so it is restricted the same way.

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
read, so its bit writes are not restricted. A compound operator on a bit subscript is
E0857 (§1).

## Scope-context matrix

Declared per diagnostic code (#1620): each code in the table above has its own
matrix, occupied only by fixtures asserting that code. The slice codes are
**array slice** rules (the section above), which #1322 moved out of codegen: the
length must fold (E0859), a string's span must fit (E0860), and the source must be
exactly the slice's type (E0861). E0858 is retired (#1757).

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
as a `critical` block, and for the same reason. A slice read there is E0909, as
an element read is, so no slice reaches them as a value either.

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
