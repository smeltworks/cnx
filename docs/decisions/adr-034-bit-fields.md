# ADR-034: Bitmap Types for Bit-Packed Data

## Status

**Implemented**

## Context

C bit fields pack multiple values into bytes/words:

```c
struct StatusReg {
    unsigned int ready : 1;
    unsigned int error : 1;
    unsigned int mode : 3;
    unsigned int reserved : 3;
};
```

cnx already has register bitfields (ADR-004), but C-style bit fields in regular structs are sometimes needed for use cases like:

- **Protocol packing** - CAN messages, SPI packets, UART frames with specific bit layouts
- **Configuration storage** - EEPROM/Flash with packed flags to minimize memory
- **Binary formats** - File headers, network protocol headers

### Example: CAN Bus Message Packing

```c
// Traditional C - a motor status message (CAN ID 0x123, 8 bytes max)
struct MotorStatus {
    unsigned int running    : 1;   // Bit 0
    unsigned int direction  : 1;   // Bit 1: 0=CW, 1=CCW
    unsigned int fault      : 1;   // Bit 2
    unsigned int mode       : 3;   // Bits 3-5: operating mode (0-7)
    unsigned int reserved   : 2;   // Bits 6-7
    uint8_t speed_percent;         // Byte 1: 0-100
    uint16_t rpm;                  // Bytes 2-3
    int16_t temperature;           // Bytes 4-5: in 0.1°C
    uint16_t current_mA;           // Bytes 6-7
};
```

## Decision Drivers

1. **Memory Efficiency** - Pack flags into single byte/word
2. **Protocol Compatibility** - Match external message/packet layouts
3. **ADR-004 Overlap** - Register bitfields already exist for hardware
4. **Portability** - C bit field ordering is implementation-defined (major problem)
5. **Semantic Clarity** - Named fields vs. magic bit positions

---

## Research: How Other Languages Handle This

### Rust: Library Solution (bitflags crate)

Rust deliberately **has no native bit fields**. The community uses the `bitflags` crate (935+ million downloads):

```rust
bitflags! {
    struct MotorFlags: u8 {
        const RUNNING   = 0b00000001;
        const DIRECTION = 0b00000010;
        const FAULT     = 0b00000100;
        const MODE_MASK = 0b00111000;
    }
}
```

**Key insight**: Rust decided the language doesn't need bit fields - a library/macro pattern is sufficient.

### Zig: Explicit Packed Structs

Zig's `packed struct` solves portability with **explicit backing integers**:

```zig
const MotorFlags = packed struct(u8) {
    running: bool,      // bit 0
    direction: bool,    // bit 1
    fault: bool,        // bit 2
    mode: u3,           // bits 3-5
    _reserved: u2,      // bits 6-7
};
```

Layout is **guaranteed** - fields are always LSB-to-MSB order, no compiler surprises. The `packed struct(u8)` syntax explicitly specifies the backing integer type.

### Ada: Representation Clauses

Ada's approach is the most explicit - you specify **exact bit positions**:

```ada
type Motor_Flags is record
    Running   : Boolean;
    Direction : Boolean;
    Fault     : Boolean;
    Mode      : Mode_Type;
end record;

for Motor_Flags use record
    Running   at 0 range 0 .. 0;
    Direction at 0 range 1 .. 1;
    Fault     at 0 range 2 .. 2;
    Mode      at 0 range 3 .. 5;
end record;
```

### Summary

| Language | Approach               | Portability                     |
| -------- | ---------------------- | ------------------------------- |
| C        | Native bit fields      | Implementation-defined (broken) |
| Rust     | `bitflags` macro/crate | Explicit masks (portable)       |
| Zig      | `packed struct(uN)`    | Guaranteed LSB-first layout     |
| Ada      | Representation clauses | Explicit bit positions          |

---

## Research: Common C Bit Field Bugs

From SEI CERT and embedded systems research:

| Bug                          | Cause                                                                 |
| ---------------------------- | --------------------------------------------------------------------- |
| **Bit order flip**           | Compilers can allocate high-to-low OR low-to-high                     |
| **Unexpected memory access** | Compiler generates wider read-modify-write than expected              |
| **Endianness mismatch**      | Big-endian packs MSB first, little-endian packs LSB first             |
| **Silent padding**           | Compiler may insert padding bits unexpectedly                         |
| **Read-modify-write on WO**  | Bit field access reads before writing - fails on write-only registers |

> "The C standard doesn't define how bit fields should be ordered. In fact, it says: 'The order of allocation of bit-fields within a unit (high-order to low-order or low-order to high-order) is implementation-defined.'"
> — [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c/EXP11-C.+Do+not+make+assumptions+regarding+the+layout+of+structures+with+bit-fields)

### The btrfs Lock Corruption Bug (Linux Kernel)

The most concrete example of bit field dangers comes from the Linux kernel's btrfs filesystem. A structure contained two adjacent bit fields:

```c
struct extent_state {
    // ... other fields ...
    unsigned lock : 1;
    unsigned full : 1;
};
```

On ia64 architecture, GCC generated a 64-bit read-modify-write cycle when modifying `full` - reading both `lock` and `full`, modifying `full`, then writing both back. This caused lock corruption in concurrent code because another thread's changes to `lock` could be silently overwritten.

The fix required restructuring the code to avoid bit fields in performance-critical shared structures.

> — [Betrayed by a bitfield - LWN.net](https://lwn.net/Articles/478657/)

---

## Options Considered

### Options Summary

| Option             | Syntax                | Portability | Compiler Enforced | New Syntax  |
| ------------------ | --------------------- | ----------- | ----------------- | ----------- |
| A: C-Style         | `bool ready : 1;`     | ❌ Broken   | ❌ No             | Minimal     |
| B: Explicit Range  | `ready: bits[0..1];`  | ✅ Yes      | ✅ Yes            | Moderate    |
| C: Enum + ADR-007  | `flags[EFlags.READY]` | ✅ Yes      | ❌ Convention     | None        |
| **D: Bitmap Type** | `flags.Ready <- true` | ✅ Yes      | ✅ Yes            | New keyword |

### Option A: C-Style Syntax

```cnx
struct Flags {
    bool ready : 1;
    bool error : 1;
    u8 mode : 3;
}
```

**Pros**: Familiar to C developers, self-documenting field names
**Cons**: Inherits C's portability problems

### Option B: Explicit Bit Range (Zig/Ada style)

```cnx
struct Flags {
    ready: bits[0..1];
    error: bits[1..2];
    mode: bits[2..5];
}
```

**Pros**: Explicit positions, portable
**Cons**: New syntax to learn, verbose

### Option C: Use ADR-007 + Enum Pattern

Don't add C-style bit fields. Use type-aware bit indexing with enums for semantic clarity:

```cnx
enum EMotorBits { RUNNING, DIRECTION, FAULT, MODE_START }
const u8 MODE_WIDTH <- 3;

struct MotorStatus {
    u8 flags;
    u8 speed_percent;
    u16 rpm;
    i16 temperature;
    u16 current_mA;
}

// Usage - enum provides semantic meaning
status.flags[EMotorBits.RUNNING] <- true;
status.flags[EMotorBits.MODE_START, MODE_WIDTH] <- mode;

// Read
bool isRunning <- status.flags[EMotorBits.RUNNING];
u8 currentMode <- status.flags[EMotorBits.MODE_START, MODE_WIDTH];
```

**Pros**: No new syntax, explicit bit positions, portable, follows Rust's philosophy
**Cons**: Convention-based (not enforced by language), verbose for complex layouts

### Option D: The `bitmap` Type (Accepted)

A new dedicated type for bit-packed fields, defined like an enum but with guaranteed bit layout:

```cnx
bitmap8 MotorFlags {
    Running,           // bit 0 (1 bit, implicit)
    Direction,         // bit 1 (1 bit, implicit)
    Fault,             // bit 2 (1 bit, implicit)
    Mode[3],           // bits 3-5 (3 bits, explicit width)
    Reserved[2]        // bits 6-7 (2 bits, explicit width)
}
// Compiler validates: 1+1+1+3+2 = 8 ✓
```

Available sizes: `bitmap8`, `bitmap16`, `bitmap24`, `bitmap32`

Usage in structs with clean dot notation:

```cnx
struct MotorStatus {
    MotorFlags flags;      // Type is MotorFlags, backed by u8
    u8 speed_percent;
    u16 rpm;
    i16 temperature;
    u16 current_mA;
}

// Clean field access - no bit indexing syntax needed
status.flags.Running <- true;
status.flags.Mode <- 5;

// Reading
bool isRunning <- status.flags.Running;
u8 currentMode <- status.flags.Mode;
```

**Pros**: Clean syntax, self-documenting, compiler-enforced layout, portable, reusable types
**Cons**: New keyword/concept, grammar changes required

---

## Decision

**Option D: The `bitmap` Type**

cnx will introduce `bitmap8`, `bitmap16`, `bitmap24`, and `bitmap32` types for bit-packed data with guaranteed layout and clean dot-notation access.

### Why Not C Bit Fields (Option A)?

C bit field ordering is fundamentally non-portable - even across versions of the same compiler. This is not a theoretical concern; real projects have been broken by compiler updates.

### Why Not Enum Pattern (Option C)?

While Option C works and requires no new syntax, it's convention-based and verbose for complex layouts. The `bitmap` type provides:

- Compiler enforcement of bit counts
- Cleaner access syntax (`status.flags.Running` vs `status.flags[EFlags.RUNNING]`)
- Self-documenting type definitions
- Reusable named types

### Why This Is Different From C Bit Fields

| C Bit Fields                   | cnx `bitmap`                                 |
| ------------------------------ | -------------------------------------------- |
| Compiler chooses bit ordering  | cnx guarantees LSB-first                     |
| Implementation-defined padding | Compiler enforces exact bit count            |
| Silent truncation on overflow  | Compile error for literals, clamp at runtime |
| Struct-level declaration only  | Standalone reusable type                     |
| No portability                 | Fully portable (cnx controls layout)         |

---

## Specification

### Syntax

```cnx
bitmap8 TypeName {
    FieldName,           // 1 bit (implicit)
    FieldName[N],        // N bits (explicit width)
}
```

Available sizes:

- `bitmap8` - 8 bits, backed by `u8`
- `bitmap16` - 16 bits, backed by `u16`
- `bitmap24` - 24 bits, backed by `u24` (3 bytes)
- `bitmap32` - 32 bits, backed by `u32`

### Field Width

- Fields without `[N]` are 1 bit (suitable for booleans). A 1-bit field is already a single bit, so it takes no bit index: on a `MotorFlags flags`, `flags.Running[0]` is E0856 (ADR-007). A wider field takes one, as a scalar does.
- Fields with `[N]` are N bits wide
- Compiler validates total bits equals the bitmap size

### Bit Ordering

Fields are allocated **LSB-first** (bit 0 is least significant):

```cnx
bitmap8 Example {
    A,        // bit 0
    B,        // bit 1
    C[3],     // bits 2-4
    D[3]      // bits 5-7
}
```

### Usage

```cnx
// Declaration
bitmap8 MotorFlags {
    Running,
    Direction,
    Fault,
    Mode[3],
    Reserved[2]
}

// In a struct
struct MotorStatus {
    MotorFlags flags;
    u8 speed_percent;
}

// Access (dot notation)
status.flags.Running <- true;
status.flags.Mode <- 5;

// Reading
bool isRunning <- status.flags.Running;
u8 mode <- status.flags.Mode;
```

A bitmap's value is its backing integer, and its fields are then set one by one:
`MotorFlags flags <- 0; flags.Running <- true;`. That is the same whether the
bitmap stands alone or is a struct's field, where the integer is the field's
initializer (`{ flags: 0, speed_percent: 50 }`). A struct initializer is not a
bitmap's value in either place: `{ Running: 1 }` is E0358 (ADR-014). Owner
ruling, 2026-09-28: _"a bitmap should be defined the exact same way it is
anywhere else, being inside a struct changes nothing"_.

Arithmetic on a whole bitmap is legal and operates on its backing integer:
`flags +<- 1` and `flags <- flags + 1` are integer arithmetic on the bitmap's
fixed-size value, carries into the next field included. Owner ruling,
2026-10-19 (#2245): _"it's the entire reason for making bitmaps a fixed size
and requiring a full definition"_. An `atomic` bitmap's compound write is a
read-modify-write of that integer, the same as a write to one of its fields
(ADR-049, `tests/bugs/issue-2245-atomic-whole-bitmap`).

A compound operator on a bitmap field (`flags.Mode +<- 1`) is an error
(E0857); write the read and the write out separately. Owner ruling,
2026-10-18 (#2159).

### Overflow Behavior

- **Compile-time literals**: Error if value exceeds field width
  ```cnx
  status.flags.Mode <- 10;  // ERROR: 10 exceeds 3-bit max (7)
  ```
- **Runtime values**: Clamp to field maximum per ADR-044
  ```cnx
  u8 value <- getUserInput();
  status.flags.Mode <- value;  // Clamped to 0-7 at runtime
  ```

### Transpilation

```c
// bitmap8 MotorFlags transpiles to:
typedef uint8_t MotorFlags;

// status.flags.Running <- true becomes:
status.flags = (status.flags & ~(1 << 0)) | ((1) << 0);

// status.flags.Mode <- 5 becomes:
status.flags = (status.flags & ~(0x7 << 3)) | ((5 & 0x7) << 3);

// u8 mode <- status.flags.Mode becomes:
uint8_t mode = ((status.flags >> 3) & 0x7);
```

---

## Diagnostics

| Code  | Reported when                                                                    | Asserted by                                                                                                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0857 | A compound operator such as `+<-` writes a bitmap field (#2159)                  | `tests/compound-assign/bitmap-field-compound.test.cnx`, `tests/adr-034/bitmap-compound-same-file-error.test.cnx`, `tests/adr-034/bitmap-compound-imported-transitive-error.test.cnx`                                                                        |
| E0881 | A value written to a bitmap field does not fit the field's declared width        | `tests/adr-034/bitmap-error-overflow.test.cnx`, `tests/adr-034/bitmap-codes-same-file-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-direct-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-transitive-error.test.cnx`                         |
| E0882 | A member access names something the bitmap does not declare                      | `tests/adr-034/bitmap-unknown-field-error.test.cnx`, `tests/adr-034/bitmap-codes-same-file-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-direct-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-transitive-error.test.cnx`                    |
| E0883 | A bitmap is addressed by bit index rather than by named field                    | `tests/adr-034/bitmap-bracket-indexing-error.test.cnx`, `tests/adr-034/bitmap-codes-same-file-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-direct-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-transitive-error.test.cnx`                 |
| E0893 | A bitmap's field widths do not add up to its size, at the bitmap                 | `tests/bitmap/bitmap-error-bits.test.cnx`, `tests/bugs/issue-1531-declaration-rejections/cross-file-bitmap.test.cnx`                                                                                                                                        |
| E0921 | A field is read or written on a bitmap array that names no whole element (#2186) | `tests/bugs/issue-2186-bitmap-array-field/bitmap-array-field.test.cnx`, `tests/adr-034/bitmap-codes-same-file-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-direct-error.test.cnx`, `tests/adr-034/bitmap-codes-imported-transitive-error.test.cnx` |

A bitmap is reached two ways -- through a variable declared with a bitmap type,
and through a register member typed by one -- and E0881, E0882, E0883 and
E0921 ask the same question of both. The distinction matters: bracket indexing was rejected only
through a register until #1322, so indexing a bitmap variable was accepted and
lowered to a bit index, which is the shape ADR-034 exists to replace.

A bitmap reached through a struct member, an array element, a scope member or
`this.` is checked by E0881, E0882, E0883 and E0921 exactly as a bitmap
variable is (#1749,
`tests/adr-034/bitmap-unknown-field-through-chain-error.test.cnx`).

The four shape properties ADR-058 defines describe the type rather than name a
field, so they are not unknown members.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| top-level function | imported transitive | warn     |
| scope method       | imported transitive | warn     |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |

off: since #1620 only the bitmap field write lowering occupies this table, and a field write is a statement, which no initializer can hold.

<!-- MATRIX-SEVERITY code: E0857 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: a compound operator is a statement, which no initializer can hold (`u8 g <- f.Mode +<- 1;` is a parse error).

<!-- MATRIX-SEVERITY code: E0881 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0881 judges a write to a field, a statement no initializer can hold, and a bitmap has no initializer literal to overflow (`Flags g <- {Mode: 9};` is E0358).

<!-- MATRIX-SEVERITY code: E0882 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0883 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0893 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| for header         | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| for header         | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | imported transitive | off      |

off: E0893 fires at a bitmap's declaration, which is none of these contexts.

<!-- MATRIX-SEVERITY code: E0921 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| for header         | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| for header         | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | imported transitive | error    |

A bitmap's fields and a register member's type can both be declared in an
included file, so every imported cell a field write can reach is reachable and
none of those is `off`.

`top-level function | imported direct` is `error`: #1651 built it, and
`scope method | imported direct` is `error`:
`tests/compound-assign/bitmap-field-included-scope-method` writes an
included bitmap's fields from a scope method (#2155 review 9). A bitmap
declared one hop away was assigned as a struct member and emitted
`shared.Active = 1` -- a member access on a scalar, rejected by the C compiler,
with the same statement lowering correctly in the declaring file. That cell is
now an obligation this ADR holds rather than one it hopes for, so a change that
stops covering it fails the gate instead of quietly returning the matrix to the
state that let the defect ship.

The remaining imported cells stay `warn`: no fixture builds them yet, and
claiming `error` would record an obligation as met. They were `warn` for that
reason before an occupancy derivation existed for this ADR at all -- every one
of its fixtures was "a linked fixture with no derivable context", because a
bitmap write that works emits no diagnostic and so supplies no position. So the
`warn`s below are a real coverage gap now, where previously they could not have
read anything else.

## Interim Pattern (Until Implementation)

Until `bitmap` types are implemented, use the enum + ADR-007 pattern:

```cnx
// Define bit positions with enum
enum EMotorFlags { RUNNING, DIRECTION, FAULT, MODE_START <- 3 }
const u8 MODE_WIDTH <- 3;

struct MotorStatus {
    u8 flags;
    u8 speed_percent;
    u16 rpm;
    i16 temperature;
    u16 current_mA;
}

// Access via bit indexing
status.flags[EMotorFlags.RUNNING] <- true;
status.flags[EMotorFlags.MODE_START, MODE_WIDTH] <- mode;

// Reading
bool isRunning <- status.flags[EMotorFlags.RUNNING];
u8 currentMode <- status.flags[EMotorFlags.MODE_START, MODE_WIDTH];
```

---

## Resolved Design Questions

1. **Gap/reserved bits**: No unnamed syntax. All fields must have valid names (e.g., `Reserved[2]`). This keeps the grammar simple and encourages self-documenting code.

2. **Read-only modifier**: Deferred for v1. Bitmaps are primarily for moving data around (protocols, storage), where all fields are typically read-write. If `ro` is needed later, it can be added.

3. **Explicit field positioning**: Not supported. Fields are always allocated sequentially LSB-first. This keeps the feature simple and portable. If a protocol requires non-contiguous bits, use multiple bitmap fields or manual bit indexing (ADR-007).

---

## References

### C Bit Field Problems

- [Betrayed by a bitfield - LWN.net](https://lwn.net/Articles/478657/) - Linux kernel btrfs lock corruption bug caused by GCC's bit field memory access patterns
- [SEI CERT: Do Not Make Assumptions About Bit-Field Layout](https://wiki.sei.cmu.edu/confluence/display/c/EXP11-C.+Do+not+make+assumptions+regarding+the+layout+of+structures+with+bit-fields)
- [Siemens: Why Not Use Bit Fields for Device Registers](https://blogs.sw.siemens.com/embedded-software/2019/12/02/why-not-use-bit-fields-for-device-registers/)
- [Hackaday: Bit Fields vs Shift and Mask](https://hackaday.com/2015/08/28/firmware-factory-bit-fields-vs-shift-and-mask/)

### Other Language Approaches

- [Rust bitflags crate](https://docs.rs/bitflags) - 935M+ downloads
- [Zig Packed Structs](https://devlog.hexops.com/2022/packed-structs-in-zig/)
- [Ada Representation Clauses](https://learn.adacore.com/courses/advanced-ada/parts/data_types/types_representation.html)
- [Ada for Embedded C Developers](https://learn.adacore.com/courses/Ada_For_The_Embedded_C_Developer/chapters/04_Embedded.html)

### cnx Related ADRs

- [ADR-004: Register Bindings](adr-004-register-bindings.md) - Hardware register bitfields
- [ADR-007: Type-Aware Bit Indexing](adr-007-type-aware-bit-indexing.md) - Integer bit access
- [ADR-017: Enums](adr-017-enums.md) - Type-safe enums
- [ADR-044: Primitive Types](adr-044-primitive-types.md) - Overflow behavior (clamp/wrap)
