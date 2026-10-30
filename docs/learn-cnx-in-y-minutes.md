---
name: cnx
filename: learncnx.cnx
contributors:
  - ["Joshua Austill", "https://github.com/jlaustill"]
---

cnx is a safer C for embedded systems. It transpiles to clean, readable C.

```c
// Every program names its one target (ADR-049), and a #pragma comes before
// any declaration, so it opens the file:
#pragma target teensy41         // a catalog name; `cnx --help` lists them
// ...or describe it inline, one #pragma per field, every field given:
// #pragma word_size 32
// #pragma ldrex_strex true      (and the rest of the target description)
// (--target on the command line, or "target" in cnx.config.json, also work)

// Single-line comments work as you expect
/* Multi-line comments too */

// =============================================================================
// 1. BASICS
// =============================================================================

// Fixed-width types (no platform surprises)
u8  byte;       // uint8_t  (0 to 255)
u16 word;       // uint16_t (0 to 65535)
u32 dword;      // uint32_t
u64 qword;      // uint64_t
i8  sbyte;      // int8_t   (-128 to 127)
i16 sword;      // int16_t
i32 sdword;     // int32_t
i64 sqword;     // int64_t
f32 single;     // float
f64 dbl;        // double
mut bool flag;  // bool

// Assignment uses <- (not =)
mut u32 x <- 42;

// Every binding is read-only unless declared mut (ADR-071; atomic implies mut). The generated C
// marks a read-only binding `const`; a binding the code writes says `mut`.
u32 limit <- 10;            // read-only: const uint32_t limit = 10U;
mut u32 total <- 0;         // written below, so it is declared mut
total +<- limit;
// limit <- 11;             // ERROR E0900: limit is read-only
// const u32 k <- 1;        // ERROR E0898: `const` is the default; remove it
// mut u32 spare <- 0;      // ERROR E0899: never written; remove `mut`
// Code from before ADR-071: `npm run migrate:adr-071 -- <dir>` deletes each
// `const` and adds each `mut` the analysis asks for.

// A bool is not a number. It takes plain assignment, the logical operators,
// and equality - never arithmetic, bitwise, shift or relational operators.
flag <- true;
flag <- !flag;              // flip a flag this way
bool both <- flag && x = 42;
bool same <- (flag = true);
// flag +<- true;           // ERROR E0806: only <- is valid on a bool
// bool c <- flag + flag;   // ERROR E0807: '+' is not valid on a bool
// bool c <- flag / flag;   // ERROR E0807: and this one is a divide by zero

// Comparison uses = (not ==)
if (x = 42) { }     // "x equals 42"
if (x != 0) { }     // "x not equal to 0"

// Variables are zero-initialized by default
u32 counter;        // counter = 0, not garbage!

// =============================================================================
// 2. OPERATORS
// =============================================================================

// Arithmetic (same as C)
x <- a + b;
x <- a - b;
x <- a * b;
x <- a / b;
x <- a % b;

// Compound assignment uses arrow
x +<- 1;            // x = x + 1
x -<- 1;            // x = x - 1
x *<- 2;            // x = x * 2
x &<- mask;         // x = x & mask
x |<- flags;        // x = x | flags
x <<<- 1;           // x = x << 1

// Bitwise (same as C)
x <- a & b;         // AND
x <- a | b;         // OR
x <- a ^ b;         // XOR
x <- ~a;            // NOT
x <- a << 2;        // Left shift
x <- a >> 2;        // Right shift

// Logical - every operand must itself be an explicit comparison (MISRA 14.4).
// A bare boolean, a literal, or a negation (!x) in a condition is an error;
// write the comparison out instead.
if (x > 0 && y < 10) { }    // AND
if (x = 0 || y = 0) { }     // OR
if (flag = false) { }       // NOT: compare against false, not !flag
// if (a && b) { }          // ERROR: a, b are bare booleans, not comparisons
// if (!a) { }              // ERROR: use a = false

// Ternary - parentheses required, must be boolean comparison
u32 max <- (a > b) ? a : b;     // OK
// u32 y <- x ? 1 : 0;          // ERROR: x is not boolean
// u32 z <- (x) ? 1 : 0;        // ERROR: still not boolean
// Nested ternary is forbidden - use if/else instead

// =============================================================================
// 3. FUNCTIONS
// =============================================================================

// Basic function
void doNothing() {
}

// Parameters and return. Parameters are read-only too; mut lets the body
// write one, and the signature says so
u32 add(u32 a, u32 b) {
    return a + b;
}
void bump(mut u32 v) {
    v +<- 1;
}

// A non-void function must return a value on EVERY path (E0704), or it's a
// compile error. An `if` needs an `else`, a `switch` needs a `default`, and a
// loop never counts as a guaranteed return — add an explicit trailing return.
u8 classify(bool ready) {
    if (ready = true) {
        return 1;
    } else {
        return 0;       // without this else-return, E0704
    }
}

// Structs passed by reference automatically (no pointers needed)
struct Point { i32 x; i32 y; }

// A type answers its length properties, and its fields' (ADR-058)
u32 pointBytes <- Point.type_byte_length;    // 8: fields summed, no C padding
u32 xBytes <- Point.x.type_byte_length;      // 4

void movePoint(mut Point p, i32 dx, i32 dy) {
    p.x +<- dx;     // Modifies original! (mut: the body writes p)
    p.y +<- dy;
}

// Define-before-use is enforced (no forward declarations)
void helper() { }

void main() {
    helper();       // OK - helper defined above
    // other();     // ERROR: 'other' not defined yet
}

void other() { }

// =============================================================================
// 4. CONTROL FLOW
// =============================================================================

// If/else (braces required: every if, else, while and for body is a braced
// block, E0716 -- MISRA C:2012 Rule 15.6)
if (x > 0) {
    doSomething();
} else if (x < 0) {
    doOther();
} else {
    doDefault();
}

// While loop (condition must be an explicit comparison, not a bare boolean)
while (running = true) {
    process();
}

// For loop
for (mut u32 i <- 0; i < 10; i +<- 1) {
    buffer[i] <- 0;
}
// A header clause is one expression, so it cannot hold an assignment that is
// more than one statement (E0715): a slice write, any write to an atomic,
// or a bit write on a float. A string copy is E0715 too (#2234). Assign
// before the loop, or at the end of its body as a while loop.
// for (name <- "x"; i < 10; i +<- 1) { }   // ERROR E0715: a string copy

// Do-while (condition must be boolean comparison)
mut u8 byte;
do {
    byte <- readByte();
} while (byte != END_MARKER);   // OK: comparison
// } while (byte);              // ERROR: must be boolean

// Forever - the one intentional infinite loop (ADR-068). Braces always required.
// Lowers to MISRA-compliant for(;;). Allowed ONLY in void functions: a loop that
// never ends can never honor a return type (E0705 otherwise).
void main() {
    setup();
    forever {
        loop();
    }
}
// i32 main() { forever { } }   // ERROR E0705: forever in non-void function

// `forever` is the ONLY way to write an infinite loop. The disguised forms are
// rejected (E0707) and steered to `forever`:
// for (;;) { }            // ERROR E0707: no controlling expression
// while (1 = 1) { }       // ERROR E0707: loop condition is always true

// Switch - braces replace break, no fallthrough, no colons!
switch (state) {
    case State.IDLE {
        startMotor();
    }
    case State.RUNNING {
        checkSensors();
    }
    default {
        handleError();
    }
}

// Multiple cases with || syntax
switch (cmd) {
    case Command.READ || Command.PEEK {
        readData();
    }
    case Command.WRITE {
        writeData();
    }
}

// A constant label may be written bare, this.X or global.X, resolving as
// anywhere else; a label naming nothing is an error (E0427), and one naming
// a variable, a function or a type is not a constant (E0717)
switch (level) {
    case global.LIMIT {
        warn();
    }
    default {
        idle();
    }
}

// An enum member takes a root too: inside a scope, this.State.IDLE
// (or State.IDLE) is the scope's own State, global.EMode.IDLE the file's
switch (state) {
    case this.State.IDLE {
        idle();
    }
    case this.State.RUN {
        run();
    }
}

// No break/continue - use structured conditions
// Instead of: while (true) { if (done) break; }
while (done = false) {
    process();
}

// =============================================================================
// 5. ARRAYS
// =============================================================================

// Fixed-size arrays
mut u8[256] buffer;
buffer[0] <- 0xFF;

// .type_element_count property (ADR-058)
usize len <- buffer.type_element_count;  // 256

// Array initialization uses [] not {}
u8[5] data <- [1, 2, 3, 4, 5];   // Size 5
u8[100] zeros <- [0*];          // All 100 elements = 0
u8[50] ones <- [1*];            // All 50 elements = 1

// Partial init forbidden (MISRA 9.3)
// u8[5] bad <- [1, 2, 3];      // ERROR: 3 elements for size-5

// A whole array is assigned a list, under the same rules
mut u8[3] rgb <- [0*];
rgb <- [255, 128, 0];           // Every element read, then copied in
rgb <- [7*];                    // Fill-all works here too
// rgb <- data;                 // ERROR: an array must be given a list

// Multi-dimensional arrays
mut u8[4][8] matrix;
matrix[0][0] <- 1;
u32 rows <- matrix.type_element_count;   // 4
u32 cols <- matrix[0].type_element_count; // 8

// =============================================================================
// 6. STRINGS
// =============================================================================

// Bounded strings with capacity
string<64> name <- "Hello";     // 64 chars max, transpiles to char[65]
string<128> buffer;             // Empty string

// Properties
u32 len <- name.value_char_count;     // Runtime: strlen(name) = 5
u32 cap <- name.capacity;       // Compile-time: 64

// Comparison uses =
string<32> a <- "Hello";
string<64> b <- "Hello";
if (a = b) {                    // strcmp(a, b) == 0
    // Equal content
}

// Concatenation with capacity validation
string<64> result <- a + " World";  // OK: 64 >= 32 + 6

// Substring extraction
string<5> hello <- name[0, 5];  // "Hello"

// =============================================================================
// 7. TYPE SAFETY
// =============================================================================

// Widening conversions (implicit, always safe)
u8 small <- 42;
u32 large <- small;             // u8 -> u32: OK

// Narrowing conversions (FORBIDDEN - use bit indexing)
u32 bigValue <- 0xDEADBEEF;
// u8 byte <- bigValue;         // ERROR: narrowing forbidden
u8 lowByte <- bigValue[0, 8];   // OK: explicit bit extraction

// Sign conversions (FORBIDDEN - use bit indexing)
i32 signedVal <- -100;
// u32 unsigned <- signedVal;   // ERROR: sign change forbidden
u32 asBits <- signedVal[0, 32]; // OK: explicit reinterpret

// Mixing integer and float (FORBIDDEN - cast the integer)
u32 count <- 3;
f32 scale <- 2.5;
// f32 total <- count * scale;  // ERROR: integer and floating categories
f32 total <- (f32)count * scale; // OK: 7.5

// Float to integer (FORBIDDEN without a cast - the cast clamps to the range)
// u32 whole <- total;          // ERROR: implicit float-to-integer conversion
u32 whole <- (u32)total;        // OK: 7 (the fraction is truncated)

// =============================================================================
// 8. OVERFLOW BEHAVIOR
// =============================================================================

// clamp - saturating arithmetic (safe default)
mut clamp u8 brightness <- 200;
brightness +<- 100;             // Clamps to 255, not 44!

// wrap - two's complement wrapping (opt-in)
mut wrap u32 counter <- 0;
counter +<- 1;                  // Wraps at UINT32_MAX

// No modifier = clamp (safe default)
mut u16 temperature <- 0;
temperature -<- 100;            // Clamps to 0, not 65436!

// Struct fields carry their own modifier; array elements follow their array
struct Packet {
    u8 level;                   // clamp (default)
    wrap u8 checksum;           // wrap
}
mut Packet pkt <- { level: 250, checksum: 250 };
pkt.level +<- 10;               // 255
pkt.checksum +<- 10;            // 4
mut u8[2] levels <- [250, 250];
levels[0] +<- 10;               // 255

// A function's return type takes a modifier too, and its call result has it.
// A cast keeps its operand's modifier unless the cast writes its own
wrap u8 ring() {
    return 255;
}
u8 full() {                     // clamp (default)
    return 255;
}
void results() {
    u8 a <- full() + 1;         // 255
    u8 b <- ring() + 1;         // 0
    u8 c <- (u8)ring() + 1;     // 0 - the cast keeps wrap
    u8 d <- (clamp u8)ring() + 1; // 255
}

// Outside any function (at file scope or in a scope), an initializer is fixed
// at compile time, C and C++ alike: written as its value, never clamped or wrapped
mut u32 uptime <- 0;
u8 base <- 250;
u8 near <- base + 5;            // written as 255
// u8 over <- base + 10;        // ERROR E0910: overflows u8
// u32 late <- uptime;          // ERROR E0909: uptime has no value at compile time
// Inside a function it is E0910 too: base is read-only, so base + 10 is known
// at compile time (#1618). Clamp and wrap act only on values known at run time

// =============================================================================
// 9. BIT MANIPULATION
// =============================================================================

// Type-aware bit indexing
mut u8 flags <- 0;
flags[0] <- true;               // Set bit 0
flags[3] <- true;               // Set bit 3
bool isSet <- flags[0];         // Read bit 0

// Multi-bit fields
flags[4, 3] <- 5;               // Set 3 bits starting at bit 4
u8 field <- flags[4, 3];        // Read 3-bit field

// .type_bit_length on integers gives bit width
u8 w8 <- flags.type_bit_length;          // 8
u32 w32 <- counter.type_bit_length;      // 32

// A type answers the same length properties; cnx has no sizeof (ADR-023)
u32 wordBytes <- u32.type_byte_length;   // 4

// =============================================================================
// 10. STRUCTS
// =============================================================================

// Struct declaration
struct Point {
    i32 x;
    i32 y;
}

// Zero-initialized by default
Point origin;                   // x=0, y=0

// Named field initializer (type inferred)
mut Point p <- { x: 10, y: 20 };

// Member access
p.x <- 100;
i32 y <- p.y;

// Nested structs (always named, no anonymous)
struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

Rectangle bounds <- {
    topLeft: { x: 10, y: 20 },
    bottomRight: { x: 110, y: 120 }
};

// =============================================================================
// 11. ENUMS
// =============================================================================

enum State {
    IDLE,               // 0
    RUNNING,            // 1
    ERROR <- 255        // Explicit value
}

State current <- State.IDLE;

if (current = State.RUNNING) {
    // ...
}

// =============================================================================
// 12. BITMAPS
// =============================================================================

// Portable bit-packed types (guaranteed LSB-first ordering)
bitmap8 MotorFlags {
    Running,            // bit 0 (1 bit)
    Direction,          // bit 1 (1 bit)
    Fault,              // bit 2 (1 bit)
    Mode[3],            // bits 3-5 (3 bits)
    Reserved[2]         // bits 6-7 (2 bits)
}
// Total: 1+1+1+3+2 = 8 bits (must match bitmap8)

mut MotorFlags flags <- 0;
flags.Running <- true;          // Set single bit
flags.Mode <- 5;                // Set multi-bit field (0-7)
bool isRunning <- flags.Running;
u8 mode <- flags.Mode;

// =============================================================================
// 13. SCOPES
// =============================================================================

// Organize code with automatic name prefixing
// scopes are purely optional in cnx
scope LED {
    mut u8 brightness;         // private by default (variable)
    public u8 maxBrightness;   // public (explicit), C code may write it
    u32 BIT <- 3;              // private, read-only (inlined)

    enum Mode { OFF, ON }      // private by default (type)
    public struct Reading {    // public (explicit) - part of the API
        u8 level;
    }

    void on() {                // public by default (function)
        GPIO.DR_SET[BIT] <- true;
    }

    void off() {               // public by default (function)
        GPIO.DR_CLEAR[BIT] <- true;
    }

    private void reset() {     // private (explicit)
        brightness <- 0;       // bare name resolves to the scope member
    }
}

// Visibility defaults:
//   Functions:              public by default, use 'private' to hide
//   Variables AND TYPES:    private by default, use 'public' to expose
//
// "Types" means struct, enum and bitmap declared inside a scope. An unmarked
// one is PRIVATE, which is easy to miss because nothing in the source says so.
// A private type is defined in the generated .c, never in the .h, so it is not
// part of the library's C interface -- write 'public' on any type a caller in
// another file is meant to name.
//
// A scope `register` takes the same keywords, but nothing puts one in the .h
// yet: a register is emitted as #defines in the .c whether it is public or
// private, so it is not reachable across an include boundary. Tracked as #1453.
//
// Privacy is about NAMING, not about values. A public function may take or
// return a private type; what a caller cannot do is name that type itself. This
// is the getter/setter shape, and it is why the generated header still has to
// define a private type that a public signature mentions.

// Name resolution: bare names resolve local -> scope -> global automatically.
// Use this. / global. ONLY to break a real naming conflict (e.g. a local
// shadowing a scope member) -- qualifying everything by default is just noise.
// At file level nothing can shadow a file-scope name, so global. there is
// E0431: write the bare name (ADR-016).

// Usage: dot syntax
LED.on();                      // OK - public by default
LED.off();                     // OK - public by default
// LED.reset();                // ERROR - explicitly private

// Generates: LED__on(), LED__off(), static void LED__reset()
// The .h declares LED__maxBrightness, LED__Reading, LED__on and LED__off.
// LED__Mode and LED__brightness stay in the .c -- they are private.

// =============================================================================
// 14. REGISTER BINDINGS
// =============================================================================

// Type-safe hardware access
register GPIO7 @ 0x42004000 {
    DR:         u32 rw @ 0x00,  // Read-Write
    GDIR:       u32 rw @ 0x04,  // Direction
    PSR:        u32 ro @ 0x08,  // Read-Only
    DR_SET:     u32 wo @ 0x84,  // Write-Only atomic set
    DR_CLEAR:   u32 wo @ 0x88,  // Write-Only atomic clear
}

u32 data <- GPIO7.DR;           // Read
GPIO7.DR <- 0xFF;               // Write
GPIO7.DR_SET[3] <- true;        // Set bit 3 (atomic)

// =============================================================================
// 15. ATOMIC & CRITICAL SECTIONS
// =============================================================================

// Atomic variables - ISR-safe. `atomic` already makes a binding writable,
// so it takes no `mut` (`atomic mut` is E0919).
atomic u32 counter <- 0;

void increment() {
    counter +<- 1;              // Lock-free on Cortex-M3+
}

// Critical sections for multi-variable operations
mut u8[64] buffer;
mut u32 writeIdx <- 0;

void enqueue(u8 data) {
    critical {
        buffer[writeIdx] <- data;
        writeIdx +<- 1;
    }
}

// =============================================================================
// 16. CONSTANTS & PREPROCESSOR
// =============================================================================

// Use a read-only binding instead of #define for values
u32 BUFFER_SIZE <- 256;
f32 PI <- 3.14159;

// #define only for flags (conditional compilation)
#define ARDUINO
#define DEBUG

// #pragma target is at the top of this file: a directive comes before any
// declaration

#ifdef ARDUINO
// Arduino-specific code
#endif

// #define with values is FORBIDDEN
// #define MAX_SIZE 100       // ERROR: use a read-only binding

// =============================================================================
// 17. COMPLETE EXAMPLE
// =============================================================================

#include <Arduino.h>

register GPIO7 @ 0x42004000 {
    DR_SET:     u32 wo @ 0x84,
    DR_CLEAR:   u32 wo @ 0x88,
    DR_TOGGLE:  u32 wo @ 0x8C,
}

u32 LED_PIN <- 13;
u32 LED_BIT <- 3;

scope LED {
    void toggle() {            // public by default
        GPIO7.DR_TOGGLE[LED_BIT] <- true;
    }
}

void setup() {
    pinMode(LED_PIN, OUTPUT);
}

void loop() {
    LED.toggle();
    delay(1000);
}
```

## Return Values Must Be Used

A function that hands something back must have it used, or explicitly thrown away.

```cnx
u32 readSensor() {
    return 42;
}

void poll() {
    u32 v <- readSensor();   // used -- fine
    (void) readSensor();     // deliberately discarded -- fine, and it says so
    readSensor();            // error[E0708]: return value discarded
}
```

`(void)` is C's own cast, not a new keyword, and it is exactly what appears in the generated C.

This applies to anything cnx can see the return type of, including the standard library:

```cnx
(void) printf("ready\n");   // printf returns int
```

If the return type cannot be resolved at all -- an external C function cnx never parsed --
the rule cannot apply, because there is nothing to check against.

## Key Differences from C

| C                | cnx            | Why                       |
| ---------------- | -------------- | ------------------------- |
| `x = 5`          | `x <- 5`       | Assignment is explicit    |
| `x == 5`         | `x = 5`        | Equality uses math =      |
| `int`            | `i32`          | Fixed widths              |
| `(u8)big`        | `big[0, 8]`    | Explicit bit extract      |
| `case X: break;` | `case X { }`   | No fallthrough            |
| Silent overflow  | `clamp`/`wrap` | Explicit behavior         |
| `f();` ignored   | `(void) f();`  | Discards are written down |
| `{1, 2, 3}`      | `[1, 2, 3]`    | Arrays use []             |

## Further Reading

- [Project setup & PlatformIO integration](platformio-integration.md) — `cnx.config.json`, C/C++ output mode, build hook
- [AI codegen reference](cnx-ai-reference.md) — comprehensive cheat sheet
- [GitHub Repository](https://github.com/smeltworks/cnx)
- [Architecture Decision Records](https://github.com/smeltworks/cnx/tree/main/docs/decisions)
