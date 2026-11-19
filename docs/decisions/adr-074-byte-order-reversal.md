# ADR-074: Byte-Order Reversal

**Status:** Research
**Date:** 2026-11-19
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-072 (Safe Hardware Abstraction — Part 4's data registers are little-endian), ADR-058 (Explicit Length Properties)
**Related Issues:** #2449 (ruling 10)

## Context

A data register's multi-byte fields are little-endian (ADR-072 Part 4, ruling 10 on #2449),
and a data register is assigned whole from a `u8` array of exactly its size (ruling 8):

```cnx
register Pair {
    0 rw u16 value,
}

Pair p;
u8[2] bytes <- [1, 2];
p <- bytes;          // p.value = 0x0201 = 513
```

Big-endian sources (Modbus, most network protocols) send the high byte first. Their bytes
need reversing on the way in and out, and the owner's direction is that the assignment
should say so explicitly, sketched as:

```cnx
p <- bytes.reversed();   // p.value = 0x0102 = 258 — syntax not decided
```

The syntax has to be memory safe and read like C.

## The whole array or each field

Reversing the whole array is only right when the register has one field. With more than one
field it moves the fields as well as their bytes:

```cnx
register Holding {
    0 ro u16 setpoint,     // bytes 0-1
    2 ro u16 actual,       // bytes 2-3
}

u8[4] rx <- [0x04, 0xD2, 0x00, 0x64];   // big-endian: setpoint 1234, actual 100
```

| Conversion              | Bytes in the register      | `setpoint`      | `actual`        |
| ----------------------- | -------------------------- | --------------- | --------------- |
| reverse the whole array | `[0x64, 0x00, 0xD2, 0x04]` | `0x0064` = 100  | `0x04D2` = 1234 |
| swap within each field  | `[0xD2, 0x04, 0x64, 0x00]` | `0x04D2` = 1234 | `0x0064` = 100  |

Reversing the whole array swaps the two values. A swap that follows the register's field
layout gives the right answer for any number of fields.

## Research

- **C:** no standard byte swap until C23's `<stdbit.h>`, and that has none either. POSIX
  `ntohs`/`ntohl` and the compiler built-ins `__builtin_bswap16/32/64` act on one integer.
- **C++23:** `std::byteswap(x)` acts on one integer.
- **Rust:** `u16::from_be_bytes([u8; 2])` and `swap_bytes()`. The size is in the type, so a
  wrong-length slice is a compile error.
- **Zig:** `@byteSwap(x)` on an integer, and `std.mem.readInt(u16, bytes, .big)`.

## Open questions

- **What is reversed.** The whole array, or each field following the register's layout (the
  table above).
- **Spelling.** A method on the array (`bytes.reversed()`), a built-in function, or
  something on the assignment itself.
- **Value or in place.** Whether reversal produces a new value of the same size or changes
  the array it is called on.
- **Memory safety.** The size is known at compile time in every case, so no runtime length
  is involved, and no reversed copy can alias its source.
- **Plain integers.** Whether the same spelling also swaps a single `u16`/`u32`/`u64`.
