# ADR-006: Simplified Reference Model

**Status:** Accepted (was Implemented; it declares no test matrix yet, which #1406 tracks. Owner ruling on #1933, 2026-10-17)
**Date:** 2025-12-26
**Decision Makers:** cnx Language Design Team

## Context

C's pointer system is powerful but notoriously confusing. The distinction between `*ptr`, `ptr`, `&var`, `**ptr`, and when to use each is a major source of bugs and developer frustration.

### The Problem in C

```c
void increment(int x) {
    x = x + 1;  // Oops! Modified local copy, not original
}

void incrementPtr(int* x) {
    *x = *x + 1;  // Works, but easy to forget the *
}

int main() {
    int value = 5;
    increment(value);      // value is still 5!
    incrementPtr(&value);  // Now value is 6 (don't forget &!)
}
```

**Common confusions:**

1. Forgetting `&` when calling a function that needs a pointer
2. Forgetting `*` when dereferencing inside the function
3. `*` means different things in declarations vs expressions
4. Pointer reassignment vs value modification (`ptr = x` vs `*ptr = x`)
5. Double pointers `**ptr` for output parameters

### Real-World Bug Frequency

> "Pointers are the single most confusing aspect of C for beginners and remain a source of subtle bugs for experienced programmers."
> — Brian Kernighan

> "In a study of over 850 security vulnerabilities, 65% were related to memory safety issues, many involving pointer misuse."
> — Microsoft Security Response Center, 2019

---

## Research: How Other Languages Handle This

### Fortran: Pass by Reference by Default

Fortran has always passed arguments by reference:

```fortran
subroutine increment(x)
    integer, intent(inout) :: x
    x = x + 1
end subroutine

program main
    integer :: value = 5
    call increment(value)  ! value is now 6, no special syntax needed
end program
```

**Key insight:** Fortran programmers don't think about pointers for most code. The common case (modifying a variable) is the default.

### C++ References: Syntax Sugar

C++ added references to hide pointer syntax:

```cpp
void increment(int& x) {  // & in declaration means "reference"
    x = x + 1;            // No * needed, looks like normal variable
}

int main() {
    int value = 5;
    increment(value);     // No & needed at call site
}
```

**Problems with C++ references:**

- `&` means different things in different contexts (reference type vs address-of operator)
- References can still dangle
- Can't tell at the call site whether a function modifies its argument

### Rust: Explicit Borrowing

Rust makes borrowing explicit but verbose:

```rust
fn increment(x: &mut i32) {
    *x = *x + 1;  // Still need * to dereference
}

fn main() {
    let mut value = 5;
    increment(&mut value);  // Explicit borrow at call site
}
```

**Trade-off:** More explicit, but adds cognitive overhead with `&`, `&mut`, `*`, and borrow checker rules.

### Go: Pointers Without Arithmetic

Go keeps pointers but removes pointer arithmetic:

```go
func increment(x *int) {
    *x = *x + 1
}

func main() {
    value := 5
    increment(&value)  // Still need & and *
}
```

**Simplification:** No pointer arithmetic, but still has `*` and `&` confusion.

### Swift/Kotlin: inout Parameters

Swift uses `inout` for pass-by-reference:

```swift
func increment(_ x: inout Int) {
    x = x + 1  // No * needed
}

var value = 5
increment(&value)  // & at call site signals modification
```

**Trade-off:** Cleaner inside function, but still need `&` at call site.

---

## Research: Why Pointer Reassignment Causes Bugs

In C, pointers can be reassigned to point to different memory:

```c
void dangerous(int* ptr) {
    int local = 42;
    ptr = &local;  // Reassigned! Now points to stack variable
    *ptr = 100;    // Writing to stack
}  // local goes out of scope, ptr now dangles
```

**Common bugs from pointer reassignment:**

1. **Dangling pointers** — Reassign to stack variable that goes out of scope
2. **Lost references** — Reassign and lose track of original memory (leak)
3. **Aliasing confusion** — Multiple pointers to same memory, reassign one
4. **Output parameter bugs** — `ptr = result` instead of `*ptr = result`

### MISRA C Rules on Pointers

MISRA C has extensive rules limiting pointer operations:

- **Rule 18.1** — A pointer must not point past the end of an array
- **Rule 18.2** — Subtraction between pointers shall only apply to pointers that address elements of the same array
- **Rule 18.3** — Relational operators shall not be applied to pointer types except where they point to the same object
- **Rule 18.4** — Pointer arithmetic shall not be performed (Advisory)

> "The use of pointer arithmetic is inadvisable. Array indexing is preferred because it is clearer and hence less error-prone."
> — MISRA C:2012 Rationale

---

## Research: Static Allocation Enables Simplification

Because cnx uses static allocation (ADR-003), we have a unique opportunity:

**In traditional C:**

- Pointers must be reassignable because memory addresses change at runtime
- `malloc()` returns different addresses each time
- Pointers are passed around to track dynamically allocated memory

**In cnx:**

- All memory is allocated at compile time or startup
- Memory addresses are fixed for the program's lifetime
- No need to "pass ownership" via pointer reassignment

This means **pointer reassignment serves no purpose** in cnx. If you can't reallocate memory, why would you need to change what address a variable refers to?

---

## Proposed Design: Simplified Reference Model

### The Rules

1. **All variables have an address and a value**
2. **Function parameters receive the address** (pass-by-reference)
3. **Assignment (`<-`) updates the value** at that address
4. **Addresses cannot be reassigned** after initialization

There is no `&` operator: `&x` is not cnx (owner ruling, 2026-10-17, #2117; see
[No `&`](#no-)).

### Syntax Examples

```
// Declaration: creates variable with address and value
i8 myVar <- 1;

// Function call: passes ADDRESS (no * or & needed)
i8 result <- doSomething(myVar);

// Inside function: x refers to original variable's address
void doSomething(i8 x) {
    x <- x + 1;   // Updates VALUE at that address
    return x;     // Returns the VALUE
}

// After call: myVar is now 2
Console.print(myVar);   // Prints "2" (the value)
```

### What This Eliminates

| C Problem                        | cnx Solution                             |
| -------------------------------- | ---------------------------------------- |
| Forget `&` when calling          | Always pass by reference, no `&` needed  |
| Forget `*` when dereferencing    | No `*` needed, assignment works directly |
| `*` in declaration vs expression | No `*` in the language                   |
| Pointer reassignment bugs        | Cannot reassign addresses                |
| Dangling pointers                | Addresses are fixed, no reassignment     |
| Output parameter confusion       | All parameters can be "output"           |

### Transpilation to C

cnx:

```
i8 myVar <- 1;

void increment(i8 x) {
    x <- x + 1;
}

increment(myVar);
```

Generated C:

```c
int8_t myVar = 1;

void increment(int8_t* x) {
    *x = *x + 1;
}

increment(&myVar);  // Compiler adds & automatically
```

The C output uses standard pointer patterns — cnx just hides the syntactic complexity.

---

## Design Details

### Return Values

Return statements return the **value**, not the address:

```
i32 calculate(i32 a, i32 b) {
    i32 result <- a + b;
    return result;  // Returns the VALUE (copies to caller)
}

i32 x <- calculate(5, 3);  // x gets value 8
```

### Arrays

Arrays pass by reference naturally (pointer to first element):

```
void processBuffer(u8[256] buffer) {
    buffer[0] <- 0xFF;  // Modifies original array
}

u8[256] myBuffer;
processBuffer(myBuffer);  // Pass array, modifies in place
```

### Structs and Classes

Same rules apply — structs pass by reference:

```
class Point {
    i32 x;
    i32 y;
}

void moveRight(Point p) {
    p.x <- p.x + 1;  // Modifies original Point
}

Point cursor;
cursor.x <- 0;
cursor.y <- 0;
moveRight(cursor);  // cursor.x is now 1
```

### No `&`

Owner ruling, 2026-10-17 (#2117): `&x` is not valid cnx anywhere, including as
an argument to a C function. It is a compile error for unknown syntax. Rejecting
it is a fix, not a breaking change, because `&x` was never cnx.

An earlier draft of this ADR offered a read-only `&` (`u32 addr <- &value;`).
The compiler parsed it and emitted `uint32_t addr = &value;`, which gcc's
`-Werror=int-conversion` rejects. Nothing a cnx program needs takes it:

- **A C function's pointer parameter** takes its `&` from the header: `bump(a)`
  for `void bump(uint32_t* x)` is `bump(&a)` in C (#1991).
- **A variadic C out-parameter** (`sscanf`'s `%d` target) takes its `&` from the
  literal format of a C standard scanf-family call (owner ruling, 2026-11-12,
  #2117; [ADR-071](adr-071-read-only-by-default.md) Decision 2):
  `global.sscanf("7", "%d", parsed)` is `sscanf("7", "%d", &parsed)` in C.
- **A register's address** is the one its declaration writes (ADR-004).

### Small Types: Optimization Opportunity

For small types (`u8`, `i8`, `bool`), the compiler MAY pass by value for efficiency while maintaining the same semantics:

```
void setBit(bool flag) {
    flag <- true;  // Semantically modifies original
}
```

If the compiler can prove the original isn't read after the call, it can optimize to pass-by-value. But the **semantics** are always pass-by-reference.

---

## Design Consequence: No Magic Numbers

### The Constraint

A `mut` parameter is passed by reference, so **you cannot pass a literal to a
`mut` parameter** (E0915) -- there is no variable for the write to land in:

```
void LED_toggle(mut u8 pin);
LED_toggle(13);      // ERROR E0915: a `mut` parameter needs a variable to write
```

A read-only parameter is passed by value (ADR-071), so a literal loses nothing
and is valid there: `Timing_delay(500)` compiles to `Timing_delay(500U)`
(ruling on #1203). Named values are still the recommended style for read-only
arguments, for the reasons below; the compiler enforces it only where a write
would be lost.

### Why Magic Numbers Are Harmful

Passing raw literals (magic numbers) is a well-documented anti-pattern:

- **MISRA C** discourages magic numbers in code
- **BARR-C Embedded Style Guide** explicitly prohibits them
- **Maintainability**: If the LED pin changes in hardware rev B, you must search the entire codebase for every `13` that refers to that pin

```c
// Bad: What if hardware rev B uses pin 7?
LED_init(13);
UART_init(9600);
Timer_set(1000);

// Good: Single source of truth, self-documenting
const uint32_t LED_PIN = 13;
const uint32_t BAUD_RATE = 9600;
const uint32_t TICK_MS = 1000;

LED_init(&LED_PIN);
```

### The cnx Way

cnx forces the "good" pattern by making the "bad" pattern impossible:

```
// Configuration values as const variables
const u32 LED_PIN <- 13;
const u32 BAUD_RATE <- 9600;

// Usage - clean and maintainable
LED_init(LED_PIN);
UART_init(BAUD_RATE);
```

### `#define` vs Variables: Clear Separation

| Mechanism   | Purpose                         | Passed to functions? |
| ----------- | ------------------------------- | -------------------- |
| `#define`   | Text replacement (compile-time) | **No** — not a value |
| `const var` | Immutable value                 | **Yes**              |
| `var`       | Mutable value                   | **Yes**              |

**Guideline:**

```
// #define for compile-time constants NOT passed to functions:
#define GPIOB_BASE 0x40020400      // Register addresses
#define BIT(n) (1 << (n))          // Bit manipulation macros
#define ARRAY_SIZE(x) (sizeof(x)/sizeof(x[0]))

// const variables for values passed to functions:
const u32 LED_PIN <- 13;
const u32 BAUD_RATE <- 9600;
const u32 DEBOUNCE_MS <- 50;

// Usage
LED_init(LED_PIN);           // Works: variable has address
register GPIOB @ GPIOB_BASE; // Works: #define for address literal
```

### Rationale

`#define` is **text replacement** — it's not a value, it's a macro. Treating it as a value conflates two different concepts. The "icky" feeling of `LED_init(13)` (after macro expansion of `LED_init(LED_PIN)`) reflects this conceptual mismatch.

By enforcing that every argument to a `mut` parameter must be an addressable value, cnx creates a **"pit of success"** where the easy path is the correct path:

1. **Configuration is centralized** — all hardware constants in one place
2. **Code is self-documenting** — `LED_init(LED_PIN)` explains intent
3. **Maintenance is easier** — change one definition, not 50 call sites
4. **Reviews are simpler** — a magic number passed to a `mut` parameter becomes an obvious error (E0915)

---

## Enforcement: E0915 (#1203)

A `mut` parameter's argument must be an object the callee can write: a
variable, a field or an element, through any brackets (`(a)`, `(cfg.total)`,
`(cfg).total`). Anything else -- a literal, a call's, an operator's or a
ternary's result, a cast, a struct or array literal, an enum member, a bit
index or range, a function's name, or a header's `#define` or enum constant --
is E0915: C would take the write into a temporary and lose it, or not compile.
Passing a read-only binding to a `mut` parameter stays E0900 (ADR-071).

| Code  | Meaning                                        | Fixtures                                              |
| ----- | ---------------------------------------------- | ----------------------------------------------------- |
| E0915 | a `mut` parameter's argument is not a variable | `tests/bugs/issue-1203-non-addressable-mut-argument/` |

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY code: E0915 -->

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

The rule is about a call's argument, so every place a call can be written can
break it: a function or scope method body, a global variable's or scope
member's initializer (`u32 g <- take(5);`), and a `for` header's declaration
(`for (mut u32 i <- take(3); ...)`). A callee one or two `#include`
hops away is the same `mut` parameter. Every cell is `error`, with a fixture
under `tests/bugs/issue-1203-non-addressable-mut-argument/`.

## Open Questions

### Q1: What about read-only parameters?

Should there be a `const` equivalent?

```
// Option A: const keyword
void printValue(const i32 x) {
    Console.print(x);
    // x <- 5;  // ERROR: x is const
}

// Option B: Separate syntax
void printValue(in i32 x) { ... }      // Read-only
void modifyValue(out i32 x) { ... }    // Write-only
void useValue(inout i32 x) { ... }     // Read-write (default)
```

### Q2: How to handle optional/nullable references?

In C, `NULL` pointers are common for "no value". Without pointer reassignment, how do we handle optional values?

```
// Option A: Explicit Option type
Option<i32> maybeValue;

// Option B: Nullable types with ?
i32? maybeValue <- null;

// Option C: Sentinel values (not recommended but matches embedded practice)
i32 value <- -1;  // -1 means "invalid"
```

### Q3: What about returning multiple values?

Without output pointers, how do functions return multiple values?

```
// Option A: Struct return
struct DivResult { i32 quotient; i32 remainder; }
DivResult divide(i32 a, i32 b) { ... }

// Option B: Tuple-like syntax
(i32, i32) divide(i32 a, i32 b) {
    return (a / b, a % b);
}

// Option C: Named return values (Go-style)
void divide(i32 a, i32 b, i32 quotient, i32 remainder) {
    quotient <- a / b;
    remainder <- a % b;
}  // All parameters are modified in place anyway!
```

### Q4: Performance implications?

Pass-by-reference for large structs is efficient. But for small types, pass-by-value is faster (no indirection). Should the compiler:

- a) Always generate pass-by-reference (consistent but potentially slower)
- b) Optimize small types to pass-by-value (faster but subtle semantics)
- c) Let developer annotate (`byval` keyword)

### Q5: How does this interact with register bindings?

Hardware registers need actual addresses:

```
// Register at fixed address
register GPIOA @ 0x40020000 {
    DR: u32 rw @ 0x00
}

// Can we get the address?
u32 addr <- &GPIOA.DR;  // No: `&` is not cnx (#2117)
```

---

## Impact on Existing C Patterns

### Pattern: Output Parameters

**C:**

```c
bool parse(const char* input, int* result) {
    *result = atoi(input);
    return true;
}

int value;
if (parse("42", &value)) { ... }
```

**cnx:**

```
bool parse(const char input[], i32 result) {
    result <- atoi(input);
    return true;
}

i32 value;
if (parse("42", value)) { ... }  // Cleaner!
```

### Pattern: Swap

**C:**

```c
void swap(int* a, int* b) {
    int temp = *a;
    *a = *b;
    *b = temp;
}
swap(&x, &y);
```

**cnx:**

```
void swap(i32 a, i32 b) {
    i32 temp <- a;
    a <- b;
    b <- temp;
}
swap(x, y);  // Just works!
```

### Pattern: Linked Lists / Dynamic Structures

**This is intentionally unsupported.** cnx targets static allocation. Dynamic data structures that require pointer reassignment (linked lists, trees with rebalancing) are not idiomatic cnx.

For collections, use statically-allocated alternatives:

- Arrays with indices instead of pointers
- Ring buffers with head/tail indices
- Pool allocators with handles

---

## Simplicity Check

> **Can a senior C developer read cnx code cold and understand it in 30 seconds?**

Test case:

```
void processReading(i32 value, i32 calibration) {
    value <- value + calibration;
}

i32 sensor <- readADC();
processReading(sensor, 42);
Console.print(sensor);  // What prints?
```

A C developer might initially assume pass-by-value (like C defaults). But the rule "functions receive the address, assignment updates the value" is simple enough to learn in one sentence.

The key insight: **If it looks like it modifies the variable, it does.** No hidden copies.

---

## Summary

| Feature              | C         | C++                 | Rust       | cnx           |
| -------------------- | --------- | ------------------- | ---------- | ------------- |
| Pass by value        | Default   | Default             | Default    | Never         |
| Pass by reference    | `*` + `&` | `&` in signature    | `&`/`&mut` | Default       |
| Pointer reassignment | Allowed   | Allowed             | Allowed    | **Forbidden** |
| Dereference syntax   | `*ptr`    | `*ptr` or automatic | `*ptr`     | Automatic     |
| Address-of operator  | `&var`    | `&var`              | `&var`     | None (#2117)  |

**cnx's model:** Everything is a reference. Assignment updates values. Addresses are fixed. Simple.

---

## Next Steps

1. **Prototype transpiler** — Implement the reference model transformation
2. **Test with real code** — Convert Arduino examples to cnx
3. **Performance benchmarks** — Measure pass-by-reference overhead for small types
4. **Survey developers** — Is this model intuitive or surprising?
5. **Edge cases** — Document all interactions with other features

---

## References

### Pointer Safety Research

- [Microsoft Security: Memory Safety](https://msrc-blog.microsoft.com/2019/07/16/a-proactive-approach-to-more-secure-code/) — 70% of CVEs are memory safety issues
- [MISRA C:2012 Guidelines](https://www.misra.org.uk/) — Rules 18.1-18.4 on pointer use

### Language Design

- [Fortran Parameter Passing](https://pages.mtu.edu/~shene/COURSES/cs201/NOTES/chap07/pass.html)
- [C++ References](https://isocpp.org/wiki/faq/references)
- [Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
- [Swift inout Parameters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#In-Out-Parameters)
- [Go Pointers](https://go.dev/tour/moretypes/1)

### Static Allocation Benefits

- [ADR-003: Static Memory Allocation](adr-003-static-allocation.md) — Why static allocation enables this simplification
