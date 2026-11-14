# ADR-058: Explicit Length Properties (`bit_length`, `byte_length`)

## Status

**Implemented** (owner confirmed on #1933, 2026-10-17) -- revised by #1975 review 2
(owner-approved: "Approved, make it the decision and implement it on #2077"); the
revision is implemented in PR #2077. The original `bit_length`/`byte_length`/`element_count`/`char_count`
design was Implemented and is superseded by the Decision below.

## Decision

Each length names its kind: what a value holds now (`value_`), the declared,
logical width of its type (`type_`), or the memory C lays out for it
(`memory_`). The twelve properties and what each gives are in "The design
these rulings add up to" under Open Questions, with the ruling behind each
row. `.bit_length`, `.byte_length`, `.char_count` and `.element_count` are
removed, each a compile error whose help names its replacement. ADR-023 stays
Rejected: cnx has no `sizeof` operator; `.memory_byte_length` emits one for
the C compiler to answer.

## Related

- [ADR-007: Type-Aware Bit Indexing](adr-007-type-aware-bit-indexing.md) (introduces `.length`)
- [ADR-023: Sizeof](adr-023-sizeof.md) (type/value size queries)
- [ADR-044: Primitive Types](adr-044-primitive-types.md) (TYPE_WIDTH registry)
- [ADR-045: Bounded Strings](adr-045-string-type.md) (`.length`, `.capacity`, `.size`)

## Context

cnx currently uses `.length` as a universal property on multiple types, but it means different things depending on the type:

| Type                       | `.length` returns       | Compile-time? | Example                        |
| -------------------------- | ----------------------- | ------------- | ------------------------------ |
| `u32 counter`              | 32 (bit width)          | Yes           | `counter.length` → `32`        |
| `u8[16] buffer`            | 16 (element count)      | Yes           | `buffer.length` → `16`         |
| `string<64> name`          | Runtime character count | **No**        | `name.length` → `strlen(name)` |
| `u32[10] arr` via `arr[0]` | 32 (element bit width)  | Yes           | `arr[0].length` → `32`         |

This overloading means that reading `someVar.length` requires knowing the type of `someVar` to understand what the value represents. This is exactly the class of ambiguity that has caused well-documented problems in other languages.

### The Ambiguity Problem

Consider this cnx code:

```cnx
u32 x <- someVar.length;
```

Without knowing `someVar`'s type, this could be:

- **16** — the number of elements (if `someVar` is `u8[16]`)
- **32** — the bit width (if `someVar` is `u32`)
- **5** — the current string length at runtime (if `someVar` is `string<64>` containing "Hello")

A developer reading unfamiliar code, reviewing a PR, or debugging at 3 AM should not need to trace type information to understand what `.length` means.

### Additional Motivation: User-Defined Length

Beyond the ambiguity of built-in types, users reasonably want `.length` as a member name in their own structs and scopes:

```cnx
struct Packet {
    u8[256] data;
    u32 length;      // How many bytes are actually used
}
```

Currently, `.length` as a struct field name collides with the built-in property (Issue #212 added special disambiguation logic). Renaming the built-in properties frees `.length` for user code.

---

## Research: How Other Languages Handle This

### Languages with Ambiguous `.length` (Problematic)

**JavaScript** — `.length` means three different things:

- Array `.length`: element count
- String `.length`: UTF-16 code unit count (NOT characters — `"💩".length === 2`)
- Function `.length`: formal parameter count

This has caused [countless bugs](https://hsivonen.fi/string-length/) in input validation, database sizing, and text truncation. Notably, JavaScript's binary APIs use **explicit naming**: `ArrayBuffer.byteLength`, `TypedArray.byteLength` — these are never ambiguous.

**Java** — Three inconsistent APIs for the same concept:

- `int[].length` (field, no parentheses)
- `String.length()` (method)
- `List.size()` (method)

This inconsistency [is considered a historical mistake](https://www.geeksforgeeks.org/java/length-vs-length-java/) that cannot be fixed without breaking backward compatibility.

**Go** — `len()` returns bytes for strings but elements for slices. The [Go Blog](https://go.dev/blog/strings) explicitly documents this, and [GitHub issue #22127](https://github.com/golang/go/issues/22127) shows users regularly confused by it.

### Languages with Explicit Naming (Effective)

**Rust** — Systematic separation:

- `T::BITS` — bit width of integer types (e.g., `u32::BITS == 32`)
- `.len()` — element count for collections
- `std::mem::size_of::<T>()` — byte size of a type

**Ada** — The gold standard for safety-critical naming:

- `'Size` — bits needed for the type
- `'Length` — element count (arrays only, never integers)
- `'Component_Size` — bits per element
- `'Object_Size` — actual storage bits including padding

Ada's `'Length` is unambiguous because it only applies to arrays.

**Zig** — Explicit builtins:

- `@bitSizeOf(T)` — bits (no padding)
- `@sizeOf(T)` — bytes (with padding)
- `array.len` — element count

The distinction between `@sizeOf` and `@bitSizeOf` has been [a source of confusion](https://ziggit.dev/t/inconsistent-sizeof-vs-bitsizeof/6264) in the Zig community, particularly with packed structs — demonstrating that even in well-designed systems languages, the bit/byte distinction matters.

**Elixir/Erlang** — Perhaps the most relevant precedent:

- `bit_size(binary)` — total bits
- `byte_size(binary)` — total bytes
- `String.length(s)` — grapheme count

This is a deliberate design choice. The unit is always in the name.

**Python** — Explicit method naming:

- `len(obj)` — element/character count
- `int.bit_length()` — minimum bits to represent the value
- `sys.getsizeof(obj)` — byte size

Python's `int.bit_length()` uses the exact `bit_length` naming pattern proposed here.

**Swift** — No `.length` at all:

- `.count` — user-perceived character count for strings, element count for arrays
- `.utf8.count` — UTF-8 code units
- `.utf16.count` — UTF-16 code units

Swift deliberately chose `.count` over `.length` because there is no single correct "length" for a string.

**Ruby** — Explicit byte distinction:

- `.length` / `.size` — character count
- `.bytesize` — byte count

`.bytesize` was specifically added because `.length` was insufficient for multi-byte encodings.

### The Pattern

Languages that put the unit in the property name have the fewest bugs and the least confusion:

| Language            | Bit property | Byte property | Element count    |
| ------------------- | ------------ | ------------- | ---------------- |
| Elixir              | `bit_size`   | `byte_size`   | `length`         |
| JavaScript (binary) | —            | `byteLength`  | `length`         |
| .NET                | —            | `ByteLength`  | `Count`/`Length` |
| Python              | `bit_length` | —             | `len()`          |
| Rust                | `T::BITS`    | `size_of`     | `len()`          |
| Zig                 | `@bitSizeOf` | `@sizeOf`     | `.len`           |
| Ada                 | `'Size`      | —             | `'Length`        |

### Safety Standards Perspective

**CERT C** documents multiple rule categories caused by size/length confusion:

- ARR01-C: Don't apply sizeof to a pointer when taking array size
- STR31-C: Don't confuse buffer size with string length
- MEM35-C: Allocate sufficient memory (sizeof confusion)

**DO-178C** (avionics certification) requires "unambiguous syntax" with "definite naming conventions." SPARK Ada achieves this through its explicit attribute system.

**MISRA Directive 4.6** recommends fixed-width types to make sizes unambiguous — the same principle applies to property names.

### Research: Three Kinds of Length (#1975 review 2)

The owner reopened this ADR during PR #2077: it never says which kind of
length each property measures. There are three kinds, and they often give
different numbers for the same subject:

1. **Value length**: what a value holds now, known only at runtime
   (`strlen("hi")` is 2; Python's `(5).bit_length()` is 3).
2. **Type length**: the declared, logical width every value of the type shares
   (`uint32_t` is 32 bits, a bit-field `a : 3` is 3).
3. **Memory size**: what the compiler lays out, with padding, alignment and
   whole storage units (C's `sizeof`: `struct { uint32_t a; uint8_t b; }` is 8
   bytes on x86-64, not 5).

They are ordered: the value fits in the type, and the type fits in its memory.

#### How other languages separate them

Read from each language's own reference (links under References):

| Language      | Value length                                                               | Type length                                                                                                                           | Memory size                                                                                                                                                                                               | `bool` / a 3-bit field                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ada (RM 2022) | --                                                                         | `S'Size`: bits "the implementation would choose for ... a record component of subtype S when the record type is packed" (13.3(45-46)) | `S'Object_Size`: "the smallest multiple of the storage element size larger than or equal to S'Size that is consistent with the alignment of S" (13.3(58.3)); `X'Size` of an object                        | "Boolean'Size shall be 1" (13.3(49)). GNAT: `Natural'Size` is 31, its objects 32; a record of an `Integer` and a `Character` has `'Size` 40, its objects 64 |
| Zig           | --                                                                         | `@bitSizeOf`: "the number of bits it takes to store T in memory if the type were a field in a packed struct/union"                    | `@sizeOf`: bytes, "may contain padding bytes"; `@sizeOf(u24) == 4`                                                                                                                                        | packed `bool` fields "use exactly 1 bit"; a `u3` is 3 bits                                                                                                  |
| Rust          | --                                                                         | `u32::BITS`: "the size of this integer type in bits" (integers only)                                                                  | `size_of`: bytes, "including alignment padding", "always a multiple of its alignment"                                                                                                                     | `size_of::<bool>()` is 1; no bit-fields                                                                                                                     |
| Swift         | --                                                                         | --                                                                                                                                    | `MemoryLayout<T>.size` ("contiguous memory footprint ... in bytes"), `.stride`, `.alignment`; excludes "out of line storage"                                                                              | --                                                                                                                                                          |
| Go            | --                                                                         | --                                                                                                                                    | `unsafe.Sizeof`: bytes, "includes any padding"; lives in package `unsafe`                                                                                                                                 | --                                                                                                                                                          |
| Java          | --                                                                         | `Integer.SIZE` (bits) / `Integer.BYTES`                                                                                               | none: no `sizeof`; the JVM compiles `boolean` to `int` (JVM spec 2.3.4)                                                                                                                                   | --                                                                                                                                                          |
| C#            | --                                                                         | --                                                                                                                                    | `sizeof`: bytes "allocated by the common language runtime in managed memory", including padding; safe code only on built-in unmanaged types and enums. `Marshal.SizeOf` gives a different, unmanaged size | `sizeof(bool)` is 1                                                                                                                                         |
| Odin          | --                                                                         | --                                                                                                                                    | `size_of` (bytes)                                                                                                                                                                                         | `bit_field` takes an explicit backing type, LSB-first; C's bit-fields "are undefined and are not portable"                                                  |
| C             | --                                                                         | a bit-field's declared width                                                                                                          | `sizeof`: bytes, cannot be applied to a bit-field                                                                                                                                                         | `_Bool` is "at least CHAR_BIT" bits as an object, at most 1 as a bit-field                                                                                  |
| C++           | `std::bit_width(x)`: "1 plus the base-2 logarithm of x"                    | --                                                                                                                                    | `sizeof`: bytes of the object representation "including any additional padding"                                                                                                                           | as C                                                                                                                                                        |
| Python        | `int.bit_length()`: "the number of bits necessary to represent an integer" | --                                                                                                                                    | `sys.getsizeof`                                                                                                                                                                                           | --                                                                                                                                                          |

What the survey shows:

- **Each kind has its own name wherever a language has more than one.** Ada
  (`'Size` vs `'Object_Size`) and Zig (`@bitSizeOf` vs `@sizeOf`) measure type
  length and memory size with separate attributes. No surveyed language uses
  one name for both.
- **Type length is counted in bits, and memory size in whole bytes.** In the
  sources above, no language gets a sub-byte type width's byte count by
  dividing by 8. A 3-bit width has a bit count, and only the storage that
  holds it has a byte count.
- **A `bool` is 1 bit as a type length** (Ada `Boolean'Size`, a Zig packed
  field, a C bit-field) **and 1 byte as memory** (Rust, C#, C).
- **Memory-safe languages hide or narrow memory size, or leave it out.** Go
  keeps it in `unsafe`; C# allows it in safe code only for built-in unmanaged
  types and enums; Java has none. Rust is the exception, with a safe
  `size_of`.
- **Python's `int.bit_length()` is a value length.** The "Languages with
  Explicit Naming" list above cites it as the source of cnx's name, but
  cnx's `.bit_length` is never a value length.

#### cnx today

Measured on PR #2077 (`168d5da32`, `--target host`):

| Subject                                     | `.bit_length` | `.byte_length`              | Kind it measures                                                                                    |
| ------------------------------------------- | ------------- | --------------------------- | --------------------------------------------------------------------------------------------------- |
| `u32`                                       | 32            | 4                           | type (the same as memory)                                                                           |
| `bool`                                      | 8             | 1                           | memory (type length is 1)                                                                           |
| `bitmap8 Fl { on, mode[3], rest[4] }`       | 8             | 1                           | type (the same as memory)                                                                           |
| `g.on` (1-bit bitmap field)                 | 8             | 1                           | memory (#2081)                                                                                      |
| `g.mode` (3 bits)                           | 3             | `0.375`, emitted into the C | type                                                                                                |
| `g.rest` (4 bits)                           | 4             | `0.5`, emitted into the C   | type                                                                                                |
| header `uint32_t a : 3`                     | 3             | `0.375`, emitted into the C | type (owner ruling, #1975 review)                                                                   |
| `enum Mode { A, B, C }`                     | 32            | 4                           | neither: emitted as a C `enum`, whose size the C compiler picks (the reason a header enum is E0867) |
| `struct P { bool f; u8 g; }`                | 16            | 2                           | type sum (#1535), counting the `bool` as memory                                                     |
| `bool[3]`                                   | 24            | 3                           | memory per element                                                                                  |
| `string<4>`                                 | 40            | 5                           | the buffer, counting the terminator byte (Resolved Question 2)                                      |
| `string.char_count`                         | --            | --                          | value                                                                                               |
| `Cfg` (header `{ uint32_t a; uint8_t b; }`) | 40            | 5                           | type sum (owner ruling, #1975)                                                                      |

So `.bit_length`/`.byte_length` measure type length for structs, bitmap
fields and header bit-fields, and memory size for `bool`, 1-bit bitmap fields,
strings and enums. The note under String Examples calls `.byte_length` "the
universal storage-size property", which Resolved Question 7 contradicts.
`.byte_length` is defined as `.bit_length / 8`, so wherever the type length
is not a whole number of bytes, the fraction goes into the generated C.

---

## Proposal

Remove `.length` from all built-in types entirely. Replace with explicit, unit-in-the-name properties where every property tells you exactly what it returns.

### New Property System

| Property         | Applies to                      | Returns                                              | Compile-time? | Generated C          |
| ---------------- | ------------------------------- | ---------------------------------------------------- | ------------- | -------------------- |
| `.bit_length`    | Integers, bitmaps, enums, bools | Bit width of the type                                | Yes           | Constant             |
| `.bit_length`    | Arrays                          | Total bits of storage (elements × element bit width) | Yes           | Constant             |
| `.bit_length`    | Strings                         | Total buffer bits (`.size × 8`)                      | Yes           | Constant             |
| `.bit_length`    | Structs                         | Total struct size in bits                            | Yes           | Constant             |
| `.byte_length`   | All types above                 | `.bit_length / 8`                                    | Yes           | Constant             |
| `.element_count` | Arrays                          | Number of elements (first dimension)                 | Yes           | Constant             |
| `.element_count` | Structs                         | Number of fields                                     | Yes           | Constant             |
| `.char_count`    | Strings                         | Current character count                              | No            | `strlen()`           |
| `.capacity`      | Strings                         | Maximum character capacity                           | Yes           | Constant (unchanged) |
| `.size`          | Strings                         | Buffer size (capacity + 1)                           | Yes           | Constant (unchanged) |

### Design Principle

**`.length` is completely removed from all built-in types.** This:

- Eliminates all ambiguity — every property name contains its unit
- Frees `.length` for user-defined struct fields and scope members
- Removes the Issue #212 disambiguation hack entirely
- Uses `snake_case` so users can still use `camelCase` (e.g., `bitLength`) in their own code

### Scalar Type Examples

```cnx
// Before (ambiguous)
u32 flags <- 0;
u32 x <- flags.length;          // 32... but 32 what?

// After (explicit)
u32 flags <- 0;
u32 bits <- flags.bit_length;   // 32 — unambiguous
u32 bytes <- flags.byte_length; // 4 — also available

// Works on all scalar types
bool active <- true;
u32 b <- active.bit_length;     // 8

enum EState { IDLE, RUNNING, STOPPED }
EState s <- EState.IDLE;
u32 e <- s.bit_length;          // 32
```

### Array Examples

Arrays get all three properties — total storage size AND element count:

```cnx
u32[16] buffer;
u32 bits <- buffer.bit_length;        // 512  (16 × 32)
u32 bytes <- buffer.byte_length;      // 64   (512 / 8)
u32 count <- buffer.element_count;    // 16

u8[256] data;
u32 bits2 <- data.bit_length;        // 2048 (256 × 8)
u32 bytes2 <- data.byte_length;      // 256  (2048 / 8)
u32 count2 <- data.element_count;    // 256
```

### Multi-Dimensional Array Examples

Properties work recursively through each dimension:

```cnx
u8[8][8] matrix;

// Full array: 8 × 8 × 8 bits
u32 total <- matrix.bit_length;       // 512
u32 bytes <- matrix.byte_length;      // 64
u32 rows <- matrix.element_count;     // 8

// One row: 8 × 8 bits
u32 row_bits <- matrix[0].bit_length;       // 64
u32 row_bytes <- matrix[0].byte_length;     // 8
u32 cols <- matrix[0].element_count;        // 8

// Single element: 8 bits
u32 elem_bits <- matrix[0][0].bit_length;   // 8
u32 elem_bytes <- matrix[0][0].byte_length; // 1
```

### String Examples

```cnx
string<64> name <- "Hello";

u32 bits <- name.bit_length;      // 520  (65 × 8, actual buffer including null terminator)
u32 bytes <- name.byte_length;    // 65   (actual buffer size, same as .size)
u32 chars <- name.char_count;     // 5    (runtime strlen)
u32 cap <- name.capacity;         // 64   (unchanged — max usable characters)
u32 sz <- name.size;              // 65   (unchanged — capacity + 1)
```

Note: `byte_length` and `.size` return the same value for strings. Both exist because `byte_length` is the universal storage-size property (works on all types), while `.size` is the string-specific buffer size property (ADR-045).

### Struct Examples

```cnx
struct SensorReading {
    u32 timestamp;
    f32 temperature;
    u16 humidity;
    u8 status;
}

SensorReading reading;
u32 bits <- reading.bit_length;        // 88 (32 + 32 + 16 + 8)
u32 bytes <- reading.byte_length;      // 11 (sum of field sizes, no padding)
u32 fields <- reading.element_count;   // 4 (number of fields)
```

A struct's `.byte_length` is the sum of its fields' sizes, not its C storage
size: C's `sizeof(SensorReading)` is 12 on x86-64, because one padding byte
follows `u8 status`. An array of structs follows the array rule, so
`SensorReading[100]` is 1100 bytes, while C stores it in 1200.

A type answers the same length properties its values do (#1975), since cnx
has no `sizeof` (ADR-023): `u32.byte_length` is 4, `SensorReading.byte_length`
is 11, and `SensorReading.status.byte_length` is 1. A struct from a C header
follows the same rule -- its fields' sizes summed, no padding -- so
`typedef struct { uint32_t a; uint8_t b; } Cfg;` gives `Cfg.byte_length` 5.
cnx has no pointers, so a header's pointer field, and a struct that holds
one, has no length: E0867. Nor has a header struct whose members do not each
hold their own bytes, since cnx could only sum them wrongly: a union, a
struct with a bit-field or an unnamed member, a C++ class with a base or a
virtual member, and a header enum, whose width the C compiler picks. A C++
class's static members and methods are values, not storage, and are not
counted. A header bit-field is its declared width, as a cnx bitmap field
is (#1975 review, owner ruling): in
`typedef struct { uint32_t a : 3; uint32_t b : 5; } BF;`, `BF.a.bit_length`
is 3, not its `uint32_t`'s 32, while `BF.byte_length` stays E0867.

A chain that starts at a type names no value, so it must end in one of these
length properties: `Point.x`, `Point.x <- 5`, `u32.foo` and
`Point.z.byte_length` (no field `z`) are E0897.

### User-Defined `.length` Now Works

```cnx
// No collision with built-in properties
struct Packet {
    u8[256] data;
    u32 length;             // Perfectly fine now
}

scope Buffer {
    u8[1024] data;
    u32 length <- 0;        // Track used bytes — no conflict

    void append(u8 byte) {
        this.data[this.length] <- byte;
        this.length +<- 1;
    }
}
```

### Bit Indexing Interaction

The bit indexing feature (ADR-007) remains unchanged. The `[start, width]` syntax operates on bits regardless of the property name:

```cnx
u32 flags <- 0;
flags[0, 4] <- 5;                  // Set 4 bits starting at bit 0
u32 width <- flags.bit_length;     // 32 — how many bits flags has
```

The rename improves readability — `flags.bit_length` makes it obvious that the value relates to the bit indexing system.

### Slice Assignment Interaction

`byte_length` documents how many bytes a value occupies in a slice assignment (ADR-007, Issue #234). An array slice lowers to fully-unrolled per-element little-endian writes (not `memcpy`, which violated MISRA C:2012 Rule 21.15 — see ADR-007, Issue #1081), so `byte_length` is the number of bytes spread across those per-element writes:

```cnx
u8[256] bufArray;
u32 magic <- 0x12345678;

// magic.byte_length is 4, so 4 bytes are serialized as per-element little-endian writes:
bufArray[0, magic.byte_length] <- magic;
```

---

## Options Considered

### Option A: `bit_length` + `byte_length` + `element_count` + `char_count` (Selected)

Complete replacement of `.length` with explicit properties.

**Pros:**

- Follows Python's `int.bit_length()` and Elixir's `bit_size`/`byte_size` precedent
- Unit is always in the name — zero ambiguity on any type
- `.length` completely freed for user code
- `byte_length` directly useful for slice assignments to determine the write span
- `snake_case` leaves `camelCase` available for user identifiers
- Recursive array semantics are intuitive (`arr.bit_length` = total storage)
- `element_count` is unambiguous — cannot be confused with bit or byte counts

**Cons:**

- Breaking change for all existing `.length` usage
- Longer property names than `.length`
- Four new properties to learn (though each is self-explanatory)

### Option B: `bit_width` + `byte_size`

Use "width" for bits and "size" for bytes, following hardware terminology.

**Pros:**

- "Bit width" is standard hardware terminology
- Shorter than `bit_length`/`byte_length`

**Cons:**

- Mixes terminology (`width` vs `size`) — less consistent
- `.size` already exists on strings (ADR-045) with a different meaning (capacity + 1)
- "Width" doesn't naturally extend to arrays (what's the "width" of an array?)

### Option C: `bits` + `bytes` (Rust-inspired)

Ultra-short property names following Rust's `T::BITS` pattern.

**Pros:**

- Very concise: `flags.bits` → `32`, `flags.bytes` → `4`

**Cons:**

- Could be confused with the actual bit/byte values rather than the count
- `bytes` on a `u8` could mean "the raw bytes" vs "number of bytes"
- No natural array element count property in this scheme

### Option D: Non-breaking deprecation

Keep `.length` working everywhere but add new properties alongside.

**Cons:**

- Ambiguity remains during deprecation period
- "Helpful, not burdensome" principle — deprecation warnings add noise
- cnx is pre-1.0; now is the time for breaking changes

---

## Migration Impact

### Affected Code Patterns

Based on the test suite, **every** current `.length` usage changes:

| Current Pattern                         | New Pattern              | Files Affected |
| --------------------------------------- | ------------------------ | -------------- |
| `intVar.length`                         | `intVar.bit_length`      | ~30 test files |
| `bitmapVar.length`                      | `bitmapVar.bit_length`   | ~5 test files  |
| `enumVar.length`                        | `enumVar.bit_length`     | ~2 test files  |
| `boolVar.length`                        | `boolVar.bit_length`     | ~1 test file   |
| `arr[i].length` (element type width)    | `arr[i].bit_length`      | ~3 test files  |
| `structField.length` (field type width) | `structField.bit_length` | ~4 test files  |
| `arrayVar.length` (element count)       | `arrayVar.element_count` | ~11 test files |
| `stringVar.length` (strlen)             | `stringVar.char_count`   | ~2 test files  |
| `args.length` (argc)                    | `args.element_count`     | ~1 test file   |

### Error Message Support

The transpiler should emit a helpful error when `.length` is used on any built-in type:

```
error: `.length` is not a built-in property. Use explicit properties instead.
  --> file.cnx:10:20
   |
10 |     u32 bits <- flags.length;
   |                       ^^^^^^
   |
   = help: for bit width, use `.bit_length`
   = help: for byte width, use `.byte_length`
```

For arrays:

```
error: `.length` is not a built-in property. Use explicit properties instead.
  --> file.cnx:12:22
   |
12 |     u32 count <- buffer.length;
   |                         ^^^^^^
   |
   = help: for element count, use `.element_count`
   = help: for total bits of storage, use `.bit_length`
   = help: for total bytes of storage, use `.byte_length`
```

---

## Resolved Questions

1. **`args` in `main()`**: `args` is an array, so `args.element_count` maps to `argc`. Consistent with all other arrays.

2. **String `bit_length`/`byte_length` semantics**: Uses `.size` semantics (actual buffer storage including null terminator). For `string<64>`: `bit_length` = 520 (65 × 8), `byte_length` = 65. For a string, `bit_length`/`byte_length` report its actual buffer storage. (A struct's do not; see question 7.)

3. **Structs get all applicable properties**: `bit_length`, `byte_length` (the sum of the fields' sizes, without C padding; see question 7), and `element_count` (number of fields).

4. **Naming convention**: `snake_case` (`bit_length`, `byte_length`, `element_count`, `char_count`) so that users can still use `camelCase` (e.g., `bitLength`, `byteLength`) in their own struct fields and scope members without collision.

5. **Arrays**: `arr.bit_length` returns total storage (elements × element bit width), not just element count. `arr[i].bit_length` returns the element type's bit width. Multi-dimensional arrays work recursively: `u8[8][8].bit_length` = 512, `[0].bit_length` = 64, `[0][0].bit_length` = 8.

6. **Enums**: Yes, enums get `bit_length` (32) and `byte_length` (4).

7. **Struct padding** (owner ruling, #1535): a struct's `bit_length`/`byte_length` are the sum of its fields' sizes, without C struct padding. For `struct P { u32 x; u8 y; }`, `byte_length` is 5, while C's `sizeof(P)` is 8 on x86-64. Both are compile-time constants, independent of the C compiler's layout.

8. **Literals** (owner ruling, #1976): a length property is not available on a literal. `"Hello".char_count`, `(true).bit_length` and `"Hello"[0].bit_length` are E0867; a length property measures a declared value.

## Open Questions

1. **Nested struct arrays**: For `struct Outer { Inner[10] items; }`, should `outer.items.element_count` return 10? This follows naturally from the array rules, but the implementation needs to handle struct field type resolution.

2. **Which kind of length** (#1975 review 2; see "Research: Three Kinds of Length"): do `.bit_length` and `.byte_length` measure the type length or the memory size?
3. **`bool` and a 1-bit field** (#2081): what is their `.bit_length`, 1 or 8?
4. **A width that is no whole number of bytes**: what is `.byte_length` of a 3-bit field? Today it emits `0.375` into the C.
5. **Enums**: what is a cnx enum's length? It is emitted as a C `enum`, whose size the C compiler picks.
6. **Strings**: should a string's lengths count its terminator byte?

**Owner direction so far (#1975 review 2, PR #2077):**

- Each kind of length gets its own name, with the kind in front:
  `.value_bit_length`, `.value_byte_length`, `.value_char_count`,
  `.type_bit_length`, `.type_byte_length`, `.type_char_count`,
  `.memory_bit_length`, `.memory_byte_length`, `.memory_char_count`.
- The memory row exists: "I mainly rejected C's sizeof because I wasn't
  focusing on these 3 different types, after spelling them out, it seems like
  it couldn't hurt, even if it only ever gets used for displaying memory used
  to a user". ADR-023 stays Rejected: "this does NOT re-open adr023, it's
  still rejected!" -- cnx has no `sizeof`; memory size is one of these
  properties.
- `.type_char_count` is the number of letters in the type's name (`u8` is 2,
  `u32` is 3). All three `_char_count` names exist, `.memory_char_count`
  included.
- `.bit_length`, `.byte_length` and `.char_count` are removed: each is a
  compile error whose help names its replacement, as `.length` became.
- The C compiler answers the memory row: `Cfg.memory_byte_length` emits
  `sizeof(Cfg)`, exact for every build, including header unions and
  bit-fields. cnx itself does not know the number, so it cannot check
  anything sized by it. An array may still be sized by it
  (`u8[Cfg.memory_byte_length] raw;` emits `uint8_t raw[sizeof(Cfg)]`), as a
  header macro may; where cnx needs the number itself, as an enum member's
  value, it is E0909.
- The type row is the declared, logical width, so a `bool` and a 1-bit
  bitmap field have `.type_bit_length` 1 and `.memory_bit_length` 8.
- A `_byte_length` rounds up to the whole bytes that hold its bits: a 3-bit
  field's `.type_byte_length` is 1, `struct P { bool f; u8 g; }` (9 bits) is 2,
  and `.value_byte_length` of `n = 5` (3 bits) is 1.
- A string's type row is its declared capacity: `string<8>` has
  `.type_byte_length` 8; the `\0` counts only in `.memory_byte_length` (9).
- An enum's type row is the fewest bits that hold every member: `enum Mode
{ A, B, C }` (0 to 2) has `.type_bit_length` 2 and `.type_byte_length` 1.
  An enum holds one member at a time, so its members are not summed. Its
  memory row is the C compiler's `sizeof(Mode)`.
- `.value_bit_length` of an unsigned integer counts bits up to its highest
  set bit, at runtime (`u8 n <- 5` gives 3). It is a compile error on a
  signed integer: cast to unsigned first, as C++'s `std::bit_width` requires.
- Where a value's length cannot differ from its type's (a struct, an array, a
  float, a `bool`), `.value_*` gives the same as `.type_*`, so every name works
  on every subject: `Cfg c; c.value_byte_length` is 5.
- An integer's `.value_char_count` is the characters it prints as in decimal,
  at runtime: `5` is 1, `255` is 3, and `-5` is 2.
- `.value_*` on a type name is a compile error whose help names `.type_*`: a
  type has no value (`Cfg.value_byte_length`, `u8.value_char_count`).
- `.element_count` gets kind names too: `.value_element_count`,
  `.type_element_count` and `.memory_element_count`. `.element_count` is
  removed with a help message, as `.bit_length` is.
- A bit-field member has no memory of its own, so its `.memory_*` is a compile
  error (`sizeof` cannot take a C bit-field either); the struct that holds it
  still answers `.memory_*`. A cnx bitmap field is the same.
- `.memory_char_count` exists only on strings (`string<8>` is 9, its buffer
  with the `\0`); on anything else it is a compile error.
- `*_element_count` exists only on arrays and structs (a struct counts its
  fields); on anything else it is a compile error, as `.element_count` is.
- The memory row works on a C header pointer and on a struct that holds one
  (`sizeof(o.p)`, `sizeof(Odd)`); their type row stays E0867.
- `.value_char_count` on a float is a compile error: a float has no single
  decimal form (`0.1` prints as `"0.1"`, `"0.100000"` or `"0.100000001"`).
- `.value_char_count` is a `u32` wherever it counts characters as the program
  runs -- a string's, or an integer's in decimal (#1742; owner: _"The goal is
  memory safety and simplicity"_). Where it spells a type (a struct, a `bool`,
  an enum value, an array) it is the same constant `.type_char_count` is, and is
  typed the same way. It takes part in comparisons and arithmetic
  as any `u32` operand does (ADR-024): with an `i32 s`, `str.value_char_count > s`
  is E0810, and `u8 n <- str.value_char_count` narrows (E0869). A string's count
  is written `(uint32_t) strlen(s)`, cached or not. Width-named counts
  (`.char_count_64`) are left to a later version (#1756).
- The memory row (`.memory_bit_length`, `.memory_byte_length`,
  `.memory_char_count`) is a `u32` on every subject and target (#1806), as
  `.value_char_count` is (#1742), not the target's `size_t`. It takes part in
  comparisons and arithmetic as any `u32` operand does (ADR-024): with a
  `u8[300] buf` and a `u8 b`, `buf.memory_byte_length + b` is a `u32` sum
  (301, not 45), with an `i32 s`, `buf.memory_byte_length < s` is E0810, and
  `u8 n <- buf.memory_byte_length` narrows (E0869). It is written cast to
  `uint32_t`: `((uint32_t)sizeof(Cfg))`, and a string's `((uint32_t)9U)`.
  `.memory_element_count` is `.type_element_count`, a constant, and is typed
  the same way.

**The design these rulings add up to (the Decision; owner-approved):**

| Property                | Gives                                                                                                                                                                                                                                               | Compile error on                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `.value_bit_length`     | unsigned integer: bits up to its highest 1, at runtime; string: 8 x the bytes it holds; anything else: `.type_bit_length`                                                                                                                           | signed integers, type names                                                            |
| `.value_byte_length`    | `.value_bit_length` rounded up to whole bytes; string: the bytes it holds                                                                                                                                                                           | signed integers, type names                                                            |
| `.value_char_count`     | integer: characters in decimal, at runtime (`-5` is 2); string: characters held; anything else: `.type_char_count`                                                                                                                                  | floats, type names                                                                     |
| `.value_element_count`  | `.type_element_count`                                                                                                                                                                                                                               | what `.type_element_count` rejects, type names                                         |
| `.type_bit_length`      | the declared, logical width: `u32` 32, `bool` 1, `f32` 32, an enum the fewest bits for its members, a bitmap field or header bit-field its declared width, `string<N>` 8N, an array its elements summed, a struct its fields summed with no padding | header pointers, unions, and structs holding them or other unsupported layouts (E0867) |
| `.type_byte_length`     | `.type_bit_length` rounded up to whole bytes                                                                                                                                                                                                        | as `.type_bit_length`                                                                  |
| `.type_char_count`      | the letters in the type's name (`u32` is 3)                                                                                                                                                                                                         | --                                                                                     |
| `.type_element_count`   | an array's first dimension; a struct's field count                                                                                                                                                                                                  | anything else                                                                          |
| `.memory_bit_length`    | `.memory_byte_length` x 8, a `u32`                                                                                                                                                                                                                  | as `.memory_byte_length`                                                               |
| `.memory_byte_length`   | `sizeof`, emitted for the C compiler to answer, a `u32` on every target                                                                                                                                                                             | bit-field and bitmap-field members                                                     |
| `.memory_char_count`    | a string's buffer, `\0` included (`string<8>` is 9), a `u32`                                                                                                                                                                                        | anything but a string                                                                  |
| `.memory_element_count` | `.type_element_count`                                                                                                                                                                                                                               | as `.type_element_count`                                                               |

`.bit_length`, `.byte_length`, `.char_count` and `.element_count` are removed;
each is a compile error whose help names its replacement. ADR-023 stays
Rejected: cnx has no `sizeof` operator.

---

## Diagnostics

| Code  | Reported when                                                                                                                                       | Asserted by                                                                                                                                |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| E0867 | A shape property is asked of a subject that cannot answer it (a pointer, a header union, bit-field or other layout cnx cannot sum), or of a literal | `tests/explicit-length/`, `tests/adr-058/`                                                                                                 |
| E0886 | `.length` is used at all                                                                                                                            | `tests/adr-058/`                                                                                                                           |
| E0909 | A memory size is where cnx needs the number itself, as an enum member's value (the C compiler decides it for the target)                            | `tests/adr-058/kinds-memory-dimension-error.test.cnx`                                                                                      |
| E0897 | A chain that names a type does not end in a length property                                                                                         | `tests/bugs/issue-1975-header-struct-byte-length/type-named-as-value-error.test.cnx`, `tests/adr-058/type-named-as-value-*-error.test.cnx` |

`.length` is rejected by NAME and needs no subject: naming a different thing on
a string, an array and a scalar is what these four properties replaced.

A property name is only a property when it names nothing else. A scope variable
may be called `length`, and `this.length` then reads it (#212) -- so a chain
that resolves as a whole was a member access, and no property rule applies to
it.

## Scope-context matrix

Declared for the rule #1322 moved out of codegen: a length property may only be
asked of a type that can answer it -- `.element_count` of an array,
`.char_count` of a string, `.bit_length` and `.byte_length` of a type with a
known width. E0886's fixtures occupy the same cells: `.length` can be written
wherever a shape property can.

<!-- MATRIX-SEVERITY code: E0867 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0886 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0897 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported direct     | error    |
| scope member       | imported direct     | error    |
| top-level function | imported transitive | error    |
| scope method       | imported transitive | error    |
| global variable    | imported transitive | error    |
| scope member       | imported transitive | error    |
| for header         | same file           | error    |
| for header         | imported direct     | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0909 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | off      |
| scope method       | same file           | off      |
| global variable    | same file           | off      |
| scope member       | same file           | off      |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |
| for header         | same file           | off      |
| for header         | imported direct     | off      |
| for header         | imported transitive | off      |

off: E0909's memory-size form fires only at an enum member's value, at file scope or in a scope, which is none of these contexts; a memory size initializing a file-scope or scope variable, a `for` header's loop variable, or sizing an array (a cast's array type in a `for` header included), is the C compiler's to answer and is accepted (probed).

A length property is an EXPRESSION, so it reaches an initializer as well as a
function body -- all four same-file contexts, probed rather than assumed.

The imported columns matter because the rule asks the SUBJECT's type, and the
subject may be declared in another file. A check reading only the file in front
of it finds no type for it, and an unknown type never rejects -- so the rule
would go quiet across an include rather than fail. A struct declared inside a
scope is a type like any other: a scope member and a scope method can hold one,
declared in this file or across an include, so every cell is `error`.

**Structs.** A struct answers `.bit_length`, `.byte_length` and
`.element_count` as resolved question 7 rules (#1535):
`tests/adr-058/length-property-struct.test.cnx`.

## References

### Language Documentation

- [Rust `u32::BITS`](https://doc.rust-lang.org/std/primitive.u32.html)
- [Python `int.bit_length()`](https://python-reference.readthedocs.io/en/latest/docs/ints/bit_length.html)
- [Elixir `bit_size`/`byte_size`](https://hexdocs.pm/elixir/binaries-strings-and-charlists.html)
- [Zig `@bitSizeOf`/`@sizeOf`](https://ziglang.org/documentation/master/)
- [Ada `'Size`/`'Length` attributes](https://en.wikibooks.org/wiki/Ada_Programming/Attributes)
- [Swift String docs](https://docs.swift.org/swift-book/LanguageGuide/StringsAndCharacters.html)
- [MDN `ArrayBuffer.byteLength`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer)
- [Ada 2022 RM 13.3, Operational and Representation Attributes (`'Size`, `'Object_Size`)](http://www.ada-auth.org/standards/22rm/html/RM-13-3.html)
- [GNAT RM: `Object_Size`](https://gcc.gnu.org/onlinedocs/gnat_rm/Attribute-Object_005fSize.html), [`Value_Size`](https://gcc.gnu.org/onlinedocs/gnat_rm/Attribute-Value_005fSize.html)
- [Zig 0.13 language reference (`@bitSizeOf`, `@sizeOf`, packed structs)](https://ziglang.org/documentation/0.13.0/)
- [Rust `std::mem::size_of`](https://doc.rust-lang.org/std/mem/fn.size_of.html), [Rust Reference: Type Layout](https://doc.rust-lang.org/reference/type-layout.html)
- [Swift `MemoryLayout` source](https://github.com/swiftlang/swift/blob/main/stdlib/public/core/MemoryLayout.swift)
- [Go `unsafe.Sizeof`](https://pkg.go.dev/unsafe#Sizeof), [Go spec: Size and alignment guarantees](https://go.dev/ref/spec#Size_and_alignment_guarantees)
- [Java `Integer.SIZE`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html), [JVM spec 2.3.4: The boolean Type](https://docs.oracle.com/javase/specs/jvms/se21/html/jvms-2.html)
- [C# `sizeof` operator](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/sizeof)
- [Odin overview (`size_of`, `bit_field`)](https://odin-lang.org/docs/overview/)
- [C bit-fields](https://en.cppreference.com/w/c/language/bit_field), [C++ `sizeof`](https://en.cppreference.com/w/cpp/language/sizeof), [C++ `std::bit_width`](https://en.cppreference.com/w/cpp/numeric/bit_width)
- [Python `int.bit_length()`](https://docs.python.org/3/library/stdtypes.html#int.bit_length)

### Bug Patterns

- [JavaScript string length confusion](https://hsivonen.fi/string-length/)
- [Java length vs length() vs size()](https://www.geeksforgeeks.org/java/length-vs-length-java/)
- [Zig @sizeOf vs @bitSizeOf confusion](https://ziggit.dev/t/inconsistent-sizeof-vs-bitsizeof/6264)
- [C++ size_t underflow bugs](https://medium.com/@tomsvoj/why-size-t-can-cause-bugs-in-c-and-how-to-fix-them-c288c9d6c1d1)

### Safety Standards

- [CERT ARR01-C: sizeof on array pointers](https://wiki.sei.cmu.edu/confluence/display/c/ARR01-C.+Do+not+apply+the+sizeof+operator+to+a+pointer+when+taking+the+size+of+an+array)
- [CERT STR31-C: Buffer size vs string length](https://wiki.sei.cmu.edu/confluence/display/c/STR31-C.+Guarantee+that+storage+for+strings+has+sufficient+space+for+character+data+and+the+null+terminator)
- [MISRA C Guidelines](https://www.embedded.com/how-misra-c-guidelines-enhance-code-safety-reduce-risks/)
- [Barr Group: Top 10 Firmware Bugs](https://barrgroup.com/embedded-systems/how-to/top-ten-nasty-firmware-bugs)
