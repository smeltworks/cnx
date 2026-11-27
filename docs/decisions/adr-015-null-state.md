# ADR-015: Null State and Variable Initialization

**Status:** Accepted (was Implemented; it declares no test matrix yet, which #1406 tracks. Owner ruling on #1933, 2026-10-17)
**Date:** 2025-12-28
**Decision Makers:** cnx Language Design Team

## Context

In cnx, the pattern for classes (ADR-005) is:

```cnx
u32 UART1_BASE <- 0x40011000;

UART uart1; // Global declaration

void init() {
    uart1 <- UART(UART1_BASE); // Initialization
}
```

This raises the question: **What is the value of `uart1` before `init()` is called?**

This applies to all variables:

- Primitives (`u32 count;`)
- Structs (`Point origin;`)
- Class instances (`UART uart1;`)
- Arrays (`u8[256] buffer;`)

## The Problem

In C, uninitialized variables have **undefined behavior**:

```c
int x;           // Could be anything: 0, garbage, nasal demons
int* ptr;        // Dangling pointer - crash waiting to happen
UART uart;       // Fields contain garbage
```

This is a source of countless bugs:

- Reading uninitialized memory
- Using garbage pointers
- Intermittent failures (works on my machine!)
- Security vulnerabilities (information leaks)

## Decision: Hybrid Approach

cnx uses a **hybrid approach** that combines the best of Go-style and Rust-style:

| Scope                         | Behavior                               | Rationale                                                  |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| **Global variables**          | Zero-initialized                       | Embedded pattern: declare globally, initialize in `init()` |
| **Scope/namespace variables** | Zero-initialized                       | Same as globals                                            |
| **Local variables**           | **Error on use before initialization** | Catches bugs at compile time                               |

The local rule covers every part of a local: a field, a nested field and an
array element read before it is assigned are each an error (E0381), as the
local itself is. A type's default value does not count as initialization: an
enum's zero enumerator (ADR-017) is the value an unassigned enum local, field or
element holds, not an assignment of it (owner ruling on #1980, 2026-10-10). A
callback's ADR-029 default is the same: a local struct's callback field, or an
element of a local callback array, read before it is assigned is E0381
(`Ticker t; t.handler();`). A global or scope variable declared without an
initializer holds its type's default, which is where a default is observed.

A declaration's own initializer cannot read it at all, in any context: the
variable is defined once its declaration closes, so `u32 n <- n + 1` names
nothing yet and is ADR-030's E0427, not a read of an uninitialized value
(owner ruling on #1643, 2026-10-12). A constructor declaration's arguments are the
one place the same use has its own code: `Tally seed(seed);` with no `seed`
defined above it, or `Tally t(LATER);` above `const u8 LATER <- 3;`, is E0433
(constructor argument not declared), the constructor form of E0427.

This decision aligns with ADR-008 (Language-Level Bug Prevention), Section 6: Uninitialized Variables.

### Why This Hybrid?

1. **Globals need zero-init**: The embedded `global + init()` pattern requires globals to have a known state before `init()` runs
2. **Locals should error**: Reading an uninitialized local variable is almost always a bug
3. **Best of both worlds**: Safe defaults for embedded patterns, strict checking for function-local code

## Implementation

### Global Variables (Zero-Initialized)

| Type                      | Zero Value        |
| ------------------------- | ----------------- |
| `u8`, `u16`, `u32`, `u64` | `0`               |
| `i8`, `i16`, `i32`, `i64` | `0`               |
| `f32`, `f64`              | `0.0`             |
| `bool`                    | `false`           |
| Arrays                    | All elements zero |
| Structs                   | All fields zero   |
| Class instances           | All fields zero   |

#### cnx Code (Global Scope)

```cnx
// Global variables - zero initialized
u32 count;           // count = 0
bool flag;           // flag = false
u8[256] buffer;      // All bytes = 0
Point origin;        // origin.x = 0, origin.y = 0
UART uart1;          // All fields = 0
```

#### Generated C

```c
uint32_t count = 0;
bool flag = false;
uint8_t buffer[256] = {0};
Point origin = {0};
UART uart1 = {0};
```

> **C++ mode (Issue #1004):** aggregates (structs and arrays) are zero-initialized
> with C++ value-initialization `= {}` rather than `= {0}`. `{0}` is an invalid
> `int`→enum narrowing when the aggregate's first field is an enum, whereas `{}`
> is valid for every aggregate. Scalars are unaffected (`count = 0`, `flag = false`).

### Local Variables (Error on Use Before Init)

Local variables inside functions follow Rust-style checking:

```cnx
void example() {
    i32 value;              // Declared but not initialized

    Console.print(value);   // ERROR E0381: use of uninitialized variable 'value'

    value <- 42;            // Now initialized
    Console.print(value);   // OK
}
```

#### Control Flow Analysis

The compiler tracks initialization through all code paths:

```cnx
void example(bool condition) {
    i32 result;

    if (condition) {
        result <- 10;
    }
    // ERROR: result not initialized on all paths
    Console.print(result);

    // Must cover all cases:
    if (condition) {
        result <- 10;
    } else {
        result <- 0;
    }
    Console.print(result);  // OK: initialized on all paths
}
```

#### Error Code

Use-before-initialization errors use Rust's error code **E0381**:

```
error[E0381]: use of uninitialized variable 'value'
 --> src/main.cnx:5:18
  |
3 |     i32 value;
  |         ----- variable declared here
5 |     Console.print(value);
  |                   ^^^^^ use of uninitialized variable
```

## Rationale

### Why Zero-Init for Globals?

1. **Embedded reality**: Many variables are legitimately initialized later in `init()`
2. **Predictable**: Every global has a known initial state
3. **No runtime cost**: Global zero-init happens in .bss, no code needed
4. **C-compatible**: `= {0}` is valid C and widely understood

### Why Errors for Locals?

1. **Catches bugs**: Reading an uninitialized local is almost always a bug
2. **Explicit intent**: Forces developer to think about initial state
3. **No false positives**: Simple flow analysis without Rust's complexity
4. **Aligns with ADR-008**: Language-level bug prevention

### Go's Philosophy (Applied to Globals)

> "When memory is allocated to store a value, either through a declaration or make or new, and no explicit initialization is provided, the memory is given a zero value."
> — The Go Programming Language Specification

cnx adopts this philosophy **for global variables**.

## Zero Values Are Useful (for Globals)

Go demonstrates that zero values are often the right default for global state:

```go
var count int        // 0 - ready for counting
var buffer []byte    // nil - ready for append
var wg sync.WaitGroup // ready to use
```

In cnx globals:

```cnx
u32 count;           // 0 - ready for incrementing
u8[256] buffer;      // All zeros - ready for data
bool initialized;    // false - correct initial state
```

## Implications for Classes

The global declaration + init() pattern relies on zero initialization:

```cnx
u32 UART1_BASE <- 0x40011000;

UART uart1; // Zero-initialized: all fields = 0

void init() {
    // Before this line, uart1 exists but is "empty"
    uart1 <- UART(UART1_BASE);
}

void main() {
    init();
    uart1.send(data, len); // Safe: uart1 is fully initialized
}
```

### Detecting Uninitialized State

For debugging, classes can check if they've been initialized:

```cnx
class UART {
    u32 baseAddress;  // 0 if uninitialized

    public bool isInitialized() {
        return baseAddress != 0;
    }

    public void send(u8* data, u32 len) {
        // Optional: check initialization in debug builds
        // assert(isInitialized());
        ...
    }
}
```

## Default Parameter Values

Related: function parameters can have defaults using `<-`:

```cnx
void configure(u32 baudRate <- 115200, u8 dataBits <- 8) {
    ...
}

configure();              // Uses defaults: 115200, 8
configure(9600);          // baudRate=9600, dataBits=8
configure(9600, 7);       // baudRate=9600, dataBits=7
```

This is distinct from zero initialization:

- **Zero init**: Variable declaration without explicit value
- **Default params**: Function parameter with fallback value

## Implementation

### Grammar Changes

No grammar changes needed. This is a code generation decision.

### Zero Initialization

Every declaration without an initializer is zero-initialized. There is no form of
cnx declaration that yields an indeterminate value, so the C a reader is used to
has no counterpart here:

```cnx
u32 count;
u8[4] buffer;
Point origin;
```

```c
uint32_t count = 0;
uint8_t buffer[4] = {0};
Point origin = {0};
```

The rule is unconditional and applies per type category -- scalar, array, aggregate --
as the table below sets out. That it takes no exception is the point: a language with
one indeterminate case still requires every reader to know which case it is.

### Special Cases

| Type           | Generated C               |
| -------------- | ------------------------- |
| `u32 x;`       | `uint32_t x = 0;`         |
| `bool f;`      | `bool f = false;`         |
| `f32 v;`       | `float v = 0.0f;`         |
| `u8[256] buf;` | `uint8_t buf[256] = {0};` |
| `Point p;`     | `Point p = {0};`          |
| `UART u;`      | `UART u = {0};`           |
| `cstring s;`   | `const char* s = NULL;`   |
| `Dev d;`       | `Dev* d = NULL;`          |
| `Handle h;`    | `Handle h = NULL;`        |

A scalar whose C type is a pointer (an ADR-046 `cstring`, an ADR-030 opaque
handle `Dev` whose type is incomplete, or a C typedef that names a pointer
type, such as `typedef struct X *Handle;`) zeroes to `NULL` in C and `nullptr` in
C++, at file scope, in a scope and in a body. MISRA C:2012 Rule 11.9 permits
only `NULL` as a null pointer constant, and MISRA rules win in generated C and
C++ (owner ruling, #1610). Rule 11.9 allows `{0}` for an aggregate, so an array
of handles keeps `{0}` (#996). Because the rule shaped it, each such C
declaration carries a `/* MISRA C:2012 Rule 11.9: ... */` annotation directly
above it (owner ruling, #1610: "if it satisfies MISRA 11.9 it should get the
comment"). C++'s `nullptr` is not an integer constant, so it carries none.

## Examples

### Before and After init()

```cnx
u32 UART1_BASE <- 0x40011000;

UART uart1;
UART uart2;

void init() {
    uart1 <- UART(UART1_BASE);
    // uart2 intentionally left uninitialized (all zeros)
}

void main() {
    init();

    if (uart1.isInitialized()) {
        uart1.send(data, len); // OK
    }

    if (uart2.isInitialized()) {
        uart2.send(data, len); // Never runs - uart2.baseAddress = 0
    }
}
```

### Counter Pattern

```cnx
mut u32 errorCount; // Starts at 0

void handleError() {
    errorCount +<- 1; // Increment from 0
}
```

### Buffer Pattern

```cnx
u8[1024] rxBuffer;   // All zeros

void receive(u8 byte) {
    rxBuffer[rxIndex] <- byte;
    rxIndex +<- 1;
}
```

## Comparison with Other Languages

| Language | Uninitialized Variable                                    |
| -------- | --------------------------------------------------------- |
| C        | Undefined behavior                                        |
| C++      | Undefined for primitives, default constructor for objects |
| Go       | Zero value                                                |
| Rust     | Compile error                                             |
| Java     | Zero for primitives, null for objects                     |
| **cnx**  | **Zero value**                                            |

## Research: Go's Zero Initialization Experience

Go has used zero initialization since 2009. Research into Go's bug history shows:

### What Works Well

| Type                    | Zero Value          | Read    | Write   | Result               |
| ----------------------- | ------------------- | ------- | ------- | -------------------- |
| `int`, `bool`, `struct` | `0`, `false`, `{0}` | ✅ Safe | ✅ Safe | **No issues**        |
| `sync.Mutex`            | unlocked            | ✅ Safe | ✅ Safe | **Brilliant design** |
| `bytes.Buffer`          | empty               | ✅ Safe | ✅ Safe | **Ready to use**     |

Go's philosophy of "make the zero value useful" works excellently for **value types**.

### Where Go Has Problems

| Type      | Zero Value | Read              | Write             | Result            |
| --------- | ---------- | ----------------- | ----------------- | ----------------- |
| `map`     | `nil`      | ✅ Returns zero   | ❌ **Panic**      | Runtime crash     |
| `slice`   | `nil`      | ✅ Safe           | ❌ **Panic**      | Must use `append` |
| `pointer` | `nil`      | ❌ **Panic**      | ❌ **Panic**      | Null pointer      |
| `channel` | `nil`      | ❌ Blocks forever | ❌ Blocks forever | Deadlock          |

The issues arise from **reference types**, not value types. There's an [open proposal](https://github.com/golang/go/issues/39572)
debating whether nil map reads should panic instead of silently returning zero.

### Why cnx Avoids Go's Problems

cnx sidesteps these issues by design:

- **No maps/slices**: Static allocation only (ADR-003)
- **No pointers in user code**: Pass-by-reference hides them (ADR-006)
- **Structs are values**: Zero initialization is always safe
- **No channels**: Not applicable to embedded

cnx operates in **Go's safe subset** where zero initialization is proven to work.

## Research: Rust's Compile-Time Enforcement

Rust takes the opposite approach: **uninitialized variables are compile errors**.

### Benefits

Microsoft's security team found that **70% of CVEs are memory safety issues** that Rust prevents:

> "By phasing out C++ code with Rust code, a whole class of vulnerabilities could be eliminated."
> — [Visual Studio Magazine](https://visualstudiomagazine.com/articles/2019/07/18/microsoft-eyes-rust.aspx)

On December 16, 2025, the first Rust CVE appeared in the Linux kernel. **On the same day, C had 159 CVEs**.
The Rust bug only causes crashes, not code execution—a testament to memory safety.

### Tradeoffs

Rust's strict checking creates developer friction:

> "Fighting the compiler will be an awfully frustrating experience... this is always done in our best interests."
> — [Rust Reviewed](https://dev.to/somedood/rust-reviewed-is-the-hype-justified-1pa1)

Common issues include:

- [False positives](https://github.com/rust-lang/rust/issues/106377) where the compiler claims variables are uninitialized when they aren't
- [Confusing error messages](https://github.com/rust-lang/rust/issues/72649) that say "borrowed after move" instead of "uninitialized"
- Closures that [can't initialize variables](https://github.com/rust-lang/rust/issues/41124) even when they obviously would

The learning curve is real: ["Senior engineers may struggle for weeks/months or even give up entirely"](https://corrode.dev/blog/flattening-rusts-learning-curve/).

### Arguments For Zero-Init Over Compile Errors

1. **Embedded reality**: Variables often initialized in `init()`, not at declaration
2. **Simpler mental model**: Every variable has a value, always
3. **No false positives**: Zero-init can't have "possibly uninitialized" bugs
4. **C interop**: Matches C static initialization semantics
5. **Target audience**: Embedded developers want predictability, not compiler battles

### Arguments For Compile-Time Errors (Rust-style)

1. **Catches bugs earlier**: Reading before writing is almost always a bug
2. **Explicit intent**: Forces developer to think about initial state
3. **No silent failures**: Zero might not be the right default (e.g., divisor = 0)
4. **Proven safety**: Microsoft's 70% CVE reduction data is compelling
5. **Optional middle ground**: Could be a warning instead of error

## Summary: Final Decision

| Approach                 | Pros                         | Cons                                      |
| ------------------------ | ---------------------------- | ----------------------------------------- |
| **C (undefined)**        | Fast                         | Bugs, CVEs, undefined behavior            |
| **Rust (compile error)** | Safest                       | Learning curve, false positives, friction |
| **Go (zero value)**      | Simple, safe for value types | Panics on reference types                 |
| **cnx (hybrid)**         | Best of both worlds          | Slightly more complex rules               |

### cnx's Hybrid Approach

| Scope             | Behavior                              | Why                                   |
| ----------------- | ------------------------------------- | ------------------------------------- |
| **Globals**       | Zero-initialized (Go-style)           | Embedded `init()` pattern requires it |
| **Scope members** | Zero-initialized (Go-style)           | Same as globals                       |
| **Locals**        | Error on use before init (Rust-style) | Catches bugs at compile time          |

### Why This Works

1. **No reference type problems**: cnx is all value types, so zero-init is always safe for globals
2. **Catches local bugs**: Uninitialized local reads are almost always bugs
3. **Supports embedded patterns**: The `global + init()` pattern works naturally
4. **Simple mental model**: Globals are zero, locals must be initialized

## References

- ADR-003: Static Allocation (startup allocation context)
- ADR-005: Classes Without Inheritance (global + init pattern)
- ADR-008: Language-Level Bug Prevention (Section 6: Uninitialized Variables)
- ADR-014: Structs (struct zero initialization)
- [Go Language Specification: Zero Value](https://go.dev/ref/spec#The_zero_value)
- [Go Zero Values Make Sense, Actually](https://yoric.github.io/post/go-nil-values/)
- [Understanding Zero Values in Go](https://www.victorpierre.dev/blog/zero-values-in-go/)
- [Microsoft Eyes Rust for Memory Safety](https://visualstudiomagazine.com/articles/2019/07/18/microsoft-eyes-rust.aspx)
- [Memory-Safety Challenge Considered Solved? (Rust CVE Study)](https://arxiv.org/pdf/2003.03296)
- [Flattening Rust's Learning Curve](https://corrode.dev/blog/flattening-rusts-learning-curve/)
- [The First Rust CVE in Linux Kernel](https://itsfoss.com/news/first-linux-kernel-rust-cve/)
