# cnx Language Guide

This guide covers all cnx language features in detail. For a quick introduction, see the [README](../README.md).

## Table of Contents

- [Assignment vs Equality](#assignment--vs-equality-)
- [Fixed-Width Types](#fixed-width-types)
- [Read-Only by Default](#read-only-by-default-adr-071)
- [Register Bindings](#register-bindings)
- [Type-Aware Bit Indexing](#type-aware-bit-indexing)
- [Slice Assignment](#slice-assignment-for-memory-operations)
- [Scopes](#scopes-adr-016)
- [Switch Statements](#switch-statements-adr-025)
- [Ternary Operator](#ternary-operator-adr-022)
- [Bounded Strings](#bounded-strings-adr-045)
- [Callbacks](#callbacks-adr-029)
- [Atomic Variables](#atomic-variables-adr-049)
- [Volatile Variables](#volatile-variables-adr-108)
- [Critical Sections](#critical-sections-adr-050)
- [NULL for C Library Interop](#null-for-c-library-interop-adr-047)
- [Startup Allocation](#startup-allocation)
- [Hardware Testing](#hardware-testing)

## Core Features

### Assignment: `<-` vs Equality: `=`

Eliminates the `if (x = 5)` bug by design:

```cnx
x <- 5;         // assignment: value flows INTO x
if (x = 5) { }  // comparison: single equals, just like math
```

### Fixed-Width Types

```cnx
u8, u16, u32, u64      // unsigned integers
i8, i16, i32, i64      // signed integers
f32, f64               // floating point
bool                   // boolean
```

### Read-Only by Default (ADR-071)

Every binding — global, scope member, local, parameter, `for` variable — is
read-only unless it is declared `mut` (`atomic` implies `mut`). Writing one that is not is a compile
error, and so is a `mut` that nothing writes, or a `const` (it is the default):

```cnx
u32 LIMIT <- 5;                // read-only
void bump(mut u32 v) {         // `mut`: bump writes v
    v <- v + 1;
}
void tick() {
    mut u32 count <- 0;        // written below, so `mut`
    count <- count + LIMIT;
    bump(count);               // passing to a `mut` parameter is a write
}
```

Read-only bindings are `const` in the generated C:

```c
const uint32_t LIMIT = 5U;
void bump(uint32_t* v) { (*v) = cnx_clamp_add_u32((*v), 1U); }
```

### Register Bindings

Type-safe hardware access with access modifiers:

```cnx
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,    // Read-Write
    PSR:        u32 ro @ 0x08,    // Read-Only
    DR_SET:     u32 wo @ 0x84,    // Write-Only (atomic set)
    DR_CLEAR:   u32 wo @ 0x88,    // Write-Only (atomic clear)
    DR_TOGGLE:  u32 wo @ 0x8C,    // Write-Only (atomic toggle)
}
```

### Type-Aware Bit Indexing

Integers are indexable as bit arrays:

```cnx
mut u8 flags <- 0;
flags[3] <- true; // Set bit 3
flags[0, 3] <- 5; // Set 3 bits starting at bit 0
bool isSet <- flags[3]; // Read bit 3

// Length properties (ADR-058)
u8[16] bufArray;
bufArray.type_element_count; // 16 (array element count)
flags.type_bit_length; // 8 (bit width of u8)
```

Write-only registers generate optimized code:

```cnx
GPIO7.DR_SET[LED_BIT] <- true;    // Generates: GPIO7__DR_SET = (1 << LED_BIT);
```

### Slice Assignment for Memory Operations

Multi-byte serialization with compile-time validated, little-endian writes (Issue #234, #1081):

```cnx
mut u8[256] bufArray;
u32 magic <- 0x12345678;

// Serialize 4 bytes of magic into bufArray at element 0
bufArray[0, 4] <- magic;

// Named offsets: read-only bindings with constant values
u32 HEADER_OFFSET <- 0;
u32 DATA_OFFSET <- 8;
bufArray[HEADER_OFFSET, 4] <- magic;
bufArray[DATA_OFFSET, 8] <- timestamp;
```

Transpiles to explicit per-element little-endian writes, unrolled at compile time
(bounds validated at compile time):

```c
uint8_t bufArray[256] = {0};
const uint32_t magic = 0x12345678U;

/* MISRA C:2012 Rule 21.15: slice copy unrolled to per-element writes (memcpy would pass incompatible pointer types: uint8_t* vs uint32_t*). */
const uint32_t _tmp0 = (uint32_t)(magic);
bufArray[0] = (uint8_t)(_tmp0);
bufArray[1] = (uint8_t)(_tmp0 >> 8U);
bufArray[2] = (uint8_t)(_tmp0 >> 16U);
bufArray[3] = (uint8_t)(_tmp0 >> 24U);
```

The source is materialized into a single unsigned temporary before the writes,
so it is **evaluated exactly once** — even an impure source such as
`bufArray[0, 4] <- readSensor()` calls `readSensor()` a single time, not once per
byte. (A single-element slice, where the value is used only once, skips the
temporary.) Shifting the unsigned temporary also keeps every write MISRA C:2012
Rule 10.1-clean.

The Rule 21.15 comment is emitted only when an equivalent `memcpy` would
genuinely have passed incompatible pointer types: the source type is **resolved**
and differs from the destination element type (the comment names the two types),
and more than one element is written. A same-type slice such as `u32[] <- u32`
(where the pointer types would have matched), a single-element write, or a source
whose type cannot be resolved at compile time all omit the comment.

**Key Features:**

- **Compile-time bounds checking** prevents buffer overflows at compile time
- Offset and length must be compile-time constants (literals, or read-only bindings with constant values)
- Silent runtime failures are now compile-time errors
- Works with struct fields: `bufArray[0, 4] <- config.magic`
- The source must be an **integer** value (float/struct sources are a compile
  error), and the slice length may not exceed the source's width in bytes
- **Deterministic little-endian byte order on every target** — the bytes are
  written least-significant-first regardless of host endianness (Issue #1081).
  Earlier versions emitted `memcpy`, which copied in native byte order and (a)
  produced different output on big-endian targets and (b) violated MISRA C:2012
  Rule 21.15 by passing incompatible pointer types
- **Offset and length use different units for wider arrays:** the offset is an
  **element index** (`u16[] arr; arr[2, 4] <- v` starts at element 2), while the
  length is always a **byte count**. A `u16[]` slice writes whole `uint16_t`
  elements, so the length must be a multiple of the element size. Bounds are
  checked as an **element span** (`offset + length / elementSize <= capacity`),
  so an in-bounds slice at a non-zero offset into a `u32[]`/`u64[]` is accepted
- Distinct from bit operations: array slices serialize a value into memory,
  scalar bit ranges use bit manipulation

### Scopes (ADR-016)

Organize code with automatic name prefixing. Inside scopes, explicit qualification is available to avoid naming collisions:

- `this.X` for scope-local members
- `global.X` for global variables, functions, and registers

If the same name exists in local, scope, and global levels, the precedence is local, scope, global just like you are used to in other languages.

```cnx
u8 LED_BIT <- 3;

scope LED {
    u8 brightness <- 100;

    void on() { global.GPIO7.DR_SET[global.LED_BIT] <- true; }
    void off() { global.GPIO7.DR_CLEAR[global.LED_BIT] <- true; }

    u8 getBrightness() { return this.brightness; }
}

// Call as:
LED.on();
LED.off();
```

Transpiles to:

```c
const uint8_t LED_BIT = 3U;

void LED__on(void) { GPIO7__DR_SET = (1 << LED_BIT); }
void LED__off(void) { GPIO7__DR_CLEAR = (1 << LED_BIT); }

uint8_t LED__getBrightness(void) { return 100U; }  // read-only, folded
```

#### How a scope compares to a class, a namespace, and a struct

cnx uses `scope` rather than `namespace` or `class` because both of those terms
promise things cnx does not deliver (ADR-016). Rather than take that on faith,
check it row by row.

Each row is a single claim, true or false in every column. Where two constructs share
a spelling but not a meaning — `this.` is the important one — they get separate rows
instead of a shared checkmark, because a shared checkmark would teach the wrong thing.

|                                                         | C++ class | C++ namespace | C struct | cnx struct | cnx scope |
| ------------------------------------------------------- | :-------: | :-----------: | :------: | :--------: | :-------: |
| **Identity**                                            |           |               |          |            |           |
| Is a type — you can declare a variable of it            |     ✓     |       ✗       |    ✓     |     ✓      |     ✗     |
| Can be instantiated                                     |     ✓     |       ✗       |    ✓     |     ✓      |     ✗     |
| Exists exactly once, always                             |     ✗     |       ✓       |    ✗     |     ✗      |     ✓     |
| **Contents**                                            |           |               |          |            |           |
| Holds functions                                         |     ✓     |       ✓       |    ✗     |     ✗      |     ✓     |
| Holds type declarations (enum, struct, bitmap)          |     ✓     |       ✓       |    ✓     |     ✗      |     ✓     |
| Holds pointer or self-referential fields                |     ✓     |       ✓       |    ✓     |     ✗      |     ✗     |
| Explicit layout control (packed)                        |     ✓     |       —       |    ✓     |     ✗      |     —     |
| **Access**                                              |           |               |          |            |           |
| Per-member `public` / `private`                         |     ✓     |       ✗       |    ✗     |     ✗      |     ✓     |
| **Shape**                                               |           |               |          |            |           |
| Nests inside itself                                     |     ✓     |       ✓       |    ✓     |     ✗      |     ✗     |
| Reopened and split across several files                 |     ✗     |       ✓       |    ✗     |     ✗      |     ✓     |
| **`this.`**                                             |           |               |          |            |           |
| `this.` is an instance pointer                          |     ✓     |       ✗       |    ✗     |     ✗      |     ✗     |
| `this.` disambiguates a name, with no runtime meaning   |     ✗     |       ✗       |    ✗     |     ✗      |     ✓     |
| **Cost**                                                |           |               |          |            |           |
| Copied when passed to a function                        |     ✓     |       —       |    ✓     |     ✗      |     —     |
| Can carry a vtable, constructor, or destructor          |     ✓     |       ✗       |    ✗     |     ✗      |     ✗     |
| Inheritance                                             |     ✓     |       ✗       |    ✗     |     ✗      |     ✗     |
| Members reachable from plain C under a predictable name |     ✗     |       ✗       |    —     |     —      |     ✓     |

`—` marks a property that does not apply to that construct at all.

Two rows deserve a second look, because they are the ones most likely to surprise you.

**`this.`** is the trap. In a C++ class it is a pointer to the current instance, so it
carries data and exists at runtime. A scope has no instance, so its `this.` is
nothing but a way to say "the `brightness` belonging to this scope, not the local one"
(ADR-057). It disappears entirely in the generated C. If you find yourself wanting to
pass a scope's `this` somewhere, the mental model has slipped.

**Reachable from plain C** is what makes scopes practical for embedded work. A scope
member is named `Scope__member` in the generated C (ADR-063), so `LED.on()` above is
`LED__on()` — an ordinary C function that any C or C++ translation unit can call and
any linker can resolve. Neither a C++ class method nor a namespaced function offers
that without `extern "C"`.

#### Which one do I want?

- **A `scope`** when there is exactly one of something — one Console, one Logger, one
  CAN driver — and you want its functions and its state under a shared name, with
  `private` available for the parts that are nobody else's business. It costs nothing
  at runtime; it is a naming convention the compiler enforces.
- **A `struct`** when there are many of something and each needs its own copy of the
  data. A struct is a type, a scope is not — that is the whole distinction, and every
  other difference follows from it.
- **Coming from C++?** A scope is much closer to a namespace than to a class: no
  instances, reopens across files, and a `this.` that is not a pointer. It differs
  from a namespace in the two ways that matter most — it supports `private`, and it
  cannot nest.
- **Coming from C?** A scope is the `Module_function()` naming convention you are
  already writing by hand, except the compiler writes the prefix, enforces the
  privacy, and cannot get it wrong.

### Switch Statements (ADR-025)

Safe switch with MISRA compliance:

- Braces replace break (no colons needed)
- No fallthrough allowed
- Multiple cases with `||` syntax
- Counted `default(n)` for enum exhaustiveness

```cnx
enum EState { IDLE, RUNNING, STOPPED }

void handleState(EState state) {
    switch (state) {
        case EState.IDLE {
            startMotor();
        }
        case EState.RUNNING || EState.STOPPED {
            checkSensors();
        }
    }
}
```

Transpiles to:

```c
switch (state) {
    case EState__IDLE: {
        startMotor();
        break;
    }
    case EState__RUNNING:
    case EState__STOPPED: {
        checkSensors();
        break;
    }
}
```

### Ternary Operator (ADR-022)

Safe conditional expressions with MISRA compliance:

- Parentheses required around condition
- Condition must be boolean (comparison or logical)
- No nesting allowed (use if/else instead)

```cnx
u32 max <- (a > b) ? a : b;
u32 abs <- (x < 0) ? -x : x;
u32 result <- (a > 0 && b > 0) ? a : b;

// ERROR: Condition must be boolean
// u32 bad <- (x) ? 1 : 0;

// ERROR: Nested ternary not allowed
// i32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;
```

### Bounded Strings (ADR-045)

Safe, statically-allocated strings with compile-time capacity checking:

```cnx
string<64> name <- "Hello"; // 64-char capacity, transpiles to char[65]
string<128> message; // Empty string, initialized to ""
string VERSION <- "1.0.0"; // Read-only: auto-sized to string<5>

// Properties
u32 len <- name.value_char_count; // Runtime u32: (uint32_t) strlen(name)
u32 cap <- name.capacity; // Compile-time: 64

// Comparison - uses strcmp
if (name = "Hello") {} // strcmp(name, "Hello") == 0

// Concatenation with capacity validation
string<32> first <- "Hello";
string<32> second <- " World";
string<64> result <- first + second; // OK: 64 >= 32 + 32

// Substring extraction with bounds checking
string<5> greeting <- name[0, 5]; // First 5 chars
```

All operations are validated at compile time:

- Literal overflow → compile error
- Truncation on assignment → compile error
- Concatenation capacity mismatch → compile error
- Substring out of bounds → compile error

### Callbacks (ADR-029)

Type-safe function pointers with the Function-as-Type pattern:

- A function definition creates both a callable function AND a type
- Nominal typing: type identity is the function name, not just signature
- Never null: callbacks are always initialized to their default function

```cnx
// Define callback type with default behavior
void onReceive(CAN_Message_T msg) {
    // default: no-op
}

struct Controller {
    onReceive _handler;    // Type is onReceive, initialized to default
}

// User implementation must match signature
void myHandler(CAN_Message_T msg) {
    Serial.println(msg.id);
}

controller._handler <- myHandler;  // OK: signature matches
controller._handler(msg);          // Always safe - never null
```

Transpiles to:

```c
void onReceive(const CAN_Message_T msg) { }

typedef void (*onReceive_fp)(const CAN_Message_T);

struct Controller {
    onReceive_fp _handler;
};

// Initialization always sets to default
struct Controller Controller_init(void) {
    return (struct Controller){ ._handler = onReceive };
}
```

### Atomic Variables (ADR-049)

ISR-safe variables with hardware-assisted atomicity:

```cnx
#pragma target teensy41

atomic u32 counter <- 0;           // ISR-safe with LDREX/STREX
atomic clamp u8 brightness <- 100; // Combines atomic + clamp

void increment() {
    counter +<- 1;   // Lock-free atomic increment
}
```

`atomic` already makes a binding writable, so it takes no `mut`: `atomic mut` is E0919 (#2233).

Generates optimized code based on target platform:

- **Cortex-M3/M4/M7**: LDREX/STREX retry loops (lock-free)
- **Cortex-M0/M0+**: PRIMASK disable/restore (interrupt masking)
- **AVR**: SREG save, `cli()`, restore (interrupt masking)

A target with no interrupt masking, such as `host` or `esp32`, has no lowering yet (#1789).

A program has exactly one target (ADR-049): `#pragma target` in any file, else the `--target` option (a config file's `target` is its default), else the board of the PlatformIO environment being built. A program that names none is error E0515. Every name must be a known target — `cnx --help` lists them — and every file that declares one must declare the same.

### Volatile Variables (ADR-064)

Prevent compiler optimization for variables that change outside normal program flow:

```cnx
// Delay loop - prevent optimization
void delay_ms(u32 ms) {
    volatile mut u32 i <- 0;
    volatile u32 count <- ms * 2000;

    while (i < count) {
        i +<- 1;  // Compiler cannot optimize away
    }
}

// Hardware register - reads actual memory
volatile u32 status_register @ 0x40020000;

void waitReady() {
    while (status_register & 0x01 = 0) {
        // Always reads from hardware
    }
}
```

**When to use:**

- ✅ Delay loops that must not be optimized away
- ✅ Memory-mapped hardware registers
- ✅ Variables polled in tight loops
- ❌ ISR-shared variables (use `atomic` instead for RMW safety)

**Key difference from `atomic`:**

- `volatile` = prevents optimization only
- `atomic` = prevents optimization + adds synchronization (ISR-safe)

### Critical Sections (ADR-050)

Multi-statement atomic blocks with automatic interrupt masking:

```cnx
mut u8[64] buffer;
mut u32 writeIdx <- 0;

void enqueue(u8 data) {
    critical {
        buffer[writeIdx] <- data;
        writeIdx +<- 1;
    }
}
```

Transpiles to a PRIMASK save/restore through the `__cnx_` IRQ wrappers, which the file emits for ARM and AVR:

```c
void enqueue(uint8_t data) {
    {
        uint32_t __primask = __cnx_get_PRIMASK();
        __cnx_disable_irq();
        buffer[writeIdx] = data;
        writeIdx += 1;
        __cnx_set_PRIMASK(__primask);
    }
}
```

**Safety**: `return` inside `critical { }` is a compile error (E0853). A `critical` block on a target where disabling interrupts does not shut out every other execution context (`interrupt_mask: false`: host, esp32) is a compile error too (E0916). Use an `atomic` variable there instead.

### NULL for C Library Interop (ADR-047)

Safe interop with C stream functions that can return NULL:

```cnx
#include <stdio.h>

mut string<64> buffer;

void readInput() {
    // NULL check is REQUIRED - compiler enforces it
    if (fgets(buffer, buffer.size, stdin) != NULL) {
        printf("Got: %s", buffer);
    }
}
```

**Constraints:**

- NULL only valid in comparison context (`!= NULL` or `= NULL`)
- Only whitelisted stream functions: `fgets`, `fputs`, `fgetc`, `fputc`
- Cannot store C pointer returns in variables
- `fopen` returns a pointer that may be NULL, so it must be checked (E0901)
- `malloc` and the rest of the dynamic memory family cannot be imported at all
  (E0902): cnx has no heap, so that code belongs in C or C++

### Startup Allocation

Allocate at startup, run with fixed memory. Per MISRA C:2023 Dir 4.12: all memory is allocated during initialization, then forbidden. No runtime allocation means no fragmentation, no OOM, no leaks.

## Hardware Testing

Verified on **Teensy MicroMod**, **Teensy 4.0**, and **STM32** hardware:

```bash
# Build and flash with PlatformIO
cd test-teensy
pio run -t upload
```

See `examples/blink.cnx` for the complete LED blink example.
