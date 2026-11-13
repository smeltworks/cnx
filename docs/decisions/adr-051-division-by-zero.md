# ADR-051: Division by Zero Detection

## Status

**Accepted**

## Context

Division by zero is a critical source of undefined behavior in C/C++ and a significant safety concern in embedded systems. cnx currently transpiles division operations directly to C without any checks, inheriting C's undefined behavior.

### Current Behavior

```cnx
// cnx input
u32 result <- 10 / 0;

// Generated C output (compiles with warning)
uint32_t result = 10 / 0;  // warning: division by zero [-Wdiv-by-zero]
```

**Runtime behavior:**

- x86/x86_64: Hardware exception (SIGFPE), program crash
- ARM Cortex-M: Returns 0 by default (unless DIV_0_TRP enabled), **silent corruption**
- Both cases: Undefined behavior per C standard

### The ARM Cortex-M Problem

Unlike x86 processors that trap on division by zero, [ARM Cortex-M processors return 0 by default](https://medium.com/@pqshedy33/why-doesnt-the-program-crash-when-the-stm32-microcontroller-performs-zero-division-operation-fe53bb97a697) without generating a fault. This means:

```c
uint32_t speed = distance / time;  // If time is 0, speed becomes 0 silently
motorControl(speed);                // Motor receives incorrect command
```

In safety-critical embedded systems (medical devices, automotive), this **silent data corruption** is more dangerous than a crash.

### MISRA C Requirements

[MISRA C:2012](https://wiki.sei.cmu.edu/confluence/display/c/MISRA+C:2012) addresses division by zero through:

- **Rule 1.3:** "There shall be no occurrence of undefined or critical unspecified behavior"
- **Directive 4.1:** "Run-time failures shall be minimized"

[Division by zero is listed among the most serious bugs](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf) arising from undefined behavior, alongside buffer overruns and use of uninitialized memory.

[MISRA recommends static analysis tools](https://www.parasoft.com/solutions/misra/) to detect division by zero violations.

---

## Research: How Other Languages Handle Division by Zero

### C and C++

**Behavior:** [Undefined behavior for integer division](https://www.geeksforgeeks.org/cpp/undefined-behavior-c-cpp/) (both signed and unsigned)

**Reality:** x86 crashes, behavior varies by processor

**Floating-point:** [Well-defined per IEEE 754](https://riptutorial.com/cplusplus/example/7411/integer-division-by-zero) (returns ±Inf or NaN)

**Detection:** GCC warning at compile-time for literals, [UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html) at runtime

### Rust

**Compile-time:** [Detects division by zero in constant expressions](https://github.com/rust-lang/rust/issues/37998), compilation fails

**Runtime:** [Integer division panics (SIGFPE)](https://microblog.desipenguin.com/post/rust-divide-by-zero/), crashes the program

**Floating-point:** [Returns Inf, does not panic](https://internals.rust-lang.org/t/should-x-0-be-an-error/2252)

**Safe alternative:** [CheckedDiv trait](https://docs.rs/num/latest/num/trait.CheckedDiv.html) returns `Option<T>` instead of panicking

**Philosophy:** ["Why does dividing by zero have no safety guarantees?"](https://internals.rust-lang.org/t/question-why-does-dividing-by-zero-have-no-safety-guarantees/19189) - Rust considers panic to be safe (controlled abort)

### Zig

**Compile-time:** [Detects literal division by zero](https://github.com/ziglang/zig/issues/372), returns compile error

**Runtime:** [Classified as "illegal behavior"](https://zig.guide/language-basics/runtime-safety/), checked in safe builds

**Safety modes:**

- Debug builds: [Runtime check, panics on division by zero](https://github.com/ziglang/zig/issues/149)
- Release-safe builds: Runtime check included
- Release-fast/small builds: Check omitted for performance (undefined behavior)

**Control:** [`@setRuntimeSafety(false)`](https://ziglang.org/documentation/master/) to disable checks in hot paths

**Philosophy:** [Uses "illegal behavior" as a tool for both bug prevention and performance](https://www.scattered-thoughts.net/writing/how-safe-is-zig/)

### Ada

**Runtime:** [Raises Constraint_Error exception](https://piembsystech.com/understanding-built-in-exceptions-in-ada-programming-language/) when division by zero occurs

**Safety-critical:** [Exception handlers allow graceful degradation](https://learn.adacore.com/courses/advanced-ada/parts/control_flow/exceptions.html) instead of abrupt termination

**Static analysis:** [SPARK/GNATprove can prove absence of division by zero](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html) at compile-time

**Philosophy:** Designed for hospital patient monitoring, aircraft fly-by-wire, nuclear control systems

### Swift

**Runtime:** [Division by zero causes a runtime trap, crashes the program](https://medium.com/@wircho/throwing-arithmetic-operators-in-swift-6c39fca4ff0e)

**Philosophy:** ["Trapping is safe"](https://numerics.diploid.ca/integers-part-2.html) - Swift traps on overflow, bounds errors, precondition failures

**Safe alternative:** [`dividedReportingOverflow(by:)`](https://github.com/swiftlang/swift/issues/54279) returns tuple with overflow flag

**Note:** [Overflow division operators &/ and &% were removed](https://forums.swift.org/t/division-and-prefix-minus-with-overflow/50195) in Swift 1.2

### Go

**Runtime:** [Panics with "runtime error: integer divide by zero"](https://labex.io/questions/how-does-go-handle-division-by-zero-166173), terminates program

**Floating-point:** [Returns ±Inf or NaN](https://www.brandongreeley.com/how-to-recover-from-panics-in-go/)

**Recovery:** [Can use defer + recover() to catch panic](https://labex.io/tutorials/go-how-to-prevent-integer-division-panic-437944)

**Philosophy:** Simple, predictable - panic on error

### Summary Table

| Language  | Compile-Time Detection | Runtime Behavior                        | Safe Alternative                    |
| --------- | ---------------------- | --------------------------------------- | ----------------------------------- |
| **C/C++** | Warning only           | Undefined (crash on x86, silent on ARM) | UBSan runtime check                 |
| **Rust**  | Error in const expr    | Panic (crash)                           | `checked_div()` returns `Option<T>` |
| **Zig**   | Error for literals     | Panic in safe mode, UB in fast mode     | Build mode control                  |
| **Ada**   | Optional (SPARK)       | Exception (catchable)                   | Exception handling                  |
| **Swift** | No                     | Trap (crash)                            | `dividedReportingOverflow(by:)`     |
| **Go**    | No                     | Panic (crash)                           | Manual check + error return         |

---

## Options for cnx

### Option A: No Detection (Status Quo)

**Current behavior** — Transpile directly to C, inherit undefined behavior.

```cnx
u32 result <- 10 / 0;  // Transpiles to: uint32_t result = 10 / 0;
```

**Pros:**

- Zero implementation cost
- Matches C behavior exactly
- No performance overhead

**Cons:**

- ❌ Violates MISRA Rule 1.3 (undefined behavior)
- ❌ Silent corruption on ARM Cortex-M (most cnx target platforms)
- ❌ No safety improvement over C
- ❌ Literal division by zero is trivially detectable, yet uncaught

**Verdict:** Unacceptable for a "safer C" targeting embedded systems.

---

### Option B: Compile-Time Detection Only

Detect and reject division by zero when divisor is a **compile-time constant**.

```cnx
// Case 1: Literal zero - COMPILE ERROR
u32 result <- 10 / 0;
// Error: Division by zero

// Case 2: Const variable - COMPILE ERROR
u32 DIVISOR <- 0;
u32 result <- 10 / DIVISOR;
// Error: Division by zero

// Case 3: Runtime variable - ALLOWED (no check)
u32 divisor <- getUserInput();
u32 result <- 10 / divisor; // Undefined if divisor is 0
```

**Implementation:**

- Add semantic check in analysis phase
- Evaluate constant expressions
- Emit error if divisor evaluates to 0

**Pros:**

- ✅ Catches trivial bugs (typos, logic errors)
- ✅ Zero runtime overhead
- ✅ Simple implementation
- ✅ Aligns with Rust/Zig compile-time detection

**Cons:**

- ⚠️ Doesn't protect against runtime division by zero
- ⚠️ Partial solution only

**MISRA compliance:** Partial (catches some violations, not all)

---

### Option C: Runtime Checks (Always)

Insert runtime checks for **all** division/modulo operations.

```cnx
// cnx input
u32 result <- numerator / denominator;

// Generated C
if (denominator == 0) {
    // Trap/abort/handler
    __cnx_division_by_zero_error();
}
uint32_t result = numerator / denominator;
```

**Handler options:**

- Call abort() or trap handler
- Set result to 0 and continue (silent error - BAD)
- Invoke user-defined error handler
- On ARM: Trigger UsageFault via `__builtin_trap()`

**Pros:**

- ✅ Complete protection against division by zero
- ✅ Works on ARM Cortex-M (fixes silent corruption)
- ✅ Full MISRA compliance

**Cons:**

- ❌ Performance overhead on every division
- ❌ Code size increase
- ❌ May be overkill for validated inputs
- ❌ Conflicts with cnx's "zero-cost abstractions" philosophy

**Embedded implications:** In tight control loops, division is common (PID controllers, sensor fusion). Adding checks to every division could impact real-time performance.

---

### Option D: Compile-Time + Optional Runtime Checks

Combine Option B (always) with Option C (opt-in).

```cnx
// Case 1: Literal zero - COMPILE ERROR
u32 result <- 10 / 0;  // Error: Division by zero

// Case 2: Normal division - NO runtime check
u32 result <- numerator / divisor;  // Programmer responsible

// Case 3: Checked division - Runtime check
u32 result <- safe numerator / divisor;
// Generates: if (divisor == 0) abort();
```

**Alternative syntax:**

```cnx
// Built-in checked division function
u32 result <- checked_div(numerator, divisor);  // Aborts on zero
```

**Pros:**

- ✅ Catches trivial bugs at compile time
- ✅ Zero overhead by default
- ✅ Opt-in safety for critical paths
- ✅ Flexible for embedded constraints

**Cons:**

- ⚠️ Requires programmer discipline
- ⚠️ Extra syntax/built-in to learn
- ⚠️ Partial MISRA compliance (depends on usage)

---

### Option E: Require Explicit Checks (Compiler-Enforced)

Force programmers to prove divisor is non-zero via explicit check.

```cnx
// ERROR: Unchecked division
u32 result <- numerator / divisor;
// Error: Division requires prior non-zero check

// OK: Explicit check before division
if (divisor != 0) {
    u32 result <- numerator / divisor;  // Allowed in this scope
} else {
    // Handle error
}
```

**Flow-sensitive analysis:**

- Compiler tracks which variables have been checked
- Division only allowed after `!= 0` check in control flow
- Similar to Rust's ownership/borrow checker complexity

**Pros:**

- ✅ Forces correct handling
- ✅ No runtime overhead (check is already there)
- ✅ Excellent safety

**Cons:**

- ❌ Very complex to implement (flow analysis)
- ❌ Frustrating when divisor is known safe (e.g., constant 10)
- ❌ Overkill for cnx's simplicity goals
- ❌ Requires sophisticated compiler

---

### Option F: Saturating Division (Return Sentinel Value)

On division by zero, return a defined sentinel value instead of undefined behavior.

```cnx
// cnx input
u32 result <- numerator / 0;

// Generated C
uint32_t result = (denominator == 0) ? UINT32_MAX : (numerator / denominator);
```

**Pros:**

- ✅ Defined behavior (no UB)
- ✅ Works on ARM (fixes silent corruption)
- ✅ Fast (one comparison)

**Cons:**

- ❌ Hides bugs (program continues with wrong data)
- ❌ Not a real solution (0 vs UINT32_MAX are both wrong)
- ❌ Violates principle of least surprise
- ❌ Not how any other language handles this

**Verdict:** Creative but **not recommended**. Masking errors is worse than catching them.

---

## Decision

**Accepted: Option B (Compile-Time Detection) + safe_div() Built-in**

cnx will implement a two-tier approach to division by zero safety:

### 1. Compile-Time Detection (Always Enabled)

Detect and reject division/modulo by zero when the divisor is a **compile-time constant**:

```cnx
// ❌ COMPILE ERROR
u32 result <- 10 / 0;
u32 remainder <- 10 % 0;

// ❌ COMPILE ERROR (const evaluates to zero)
u32 ZERO <- 0;
u32 result <- 10 / ZERO;

// ❌ COMPILE ERROR (const expression)
u32 VALUE <- 5 - 5;
u32 result <- 10 / VALUE;
```

**Error message:** `"Division by zero"`

### 2. Normal Division (Fast Path)

Standard division/modulo operators have **zero runtime overhead**:

```cnx
// ✅ Compiles (no runtime check)
u32 divisor <- getUserInput();
u32 result <- 10 / divisor;  // Fast, programmer responsible for validation
```

**Use case:** Time-critical control loops where every CPU cycle matters and the developer has validated inputs.

### 3. Safe Division Built-in (Opt-in Safety)

For safety-critical calculations, cnx provides `safe_div()` and `safe_mod()` built-in functions:

```cnx
u32 speed <- 100;  // Current value
bool hadError <- safe_div(speed, distance, time, 100);
if (hadError) {
    logError("Division by zero in speed calculation");
}
// If time was 0, speed is now 100 (default)
// If time was non-zero, speed = distance / time
```

**Function signature (conceptual):**

```cnx
// Returns true if divisor was zero (used default), false if division succeeded
bool safe_div(output, numerator, divisor, defaultIfZero);
bool safe_mod(output, numerator, divisor, defaultIfZero);
```

**Generated C implementation (example for u32):**

```c
bool cnx_safe_div_u32(uint32_t* output, uint32_t numerator, uint32_t divisor, uint32_t defaultIfZero) {
    if (divisor == 0) {
        *output = defaultIfZero;
        return true;  // Error: used default
    }
    *output = numerator / divisor;
    return false;  // Success: performed division
}
```

**Type variants:** Generated for all integer types: `u8`, `u16`, `u32`, `u64`, `i8`, `i16`, `i32`, `i64`

**Signed overflow:** a signed `MIN / -1` is not a zero divisor, so `safe_div` and `safe_mod`
return `false` and write what `/` and `%` give, as decided in ADR-044 (#1790): the type's MAX for
`clamp`, its MIN for `wrap`, and 0 for the remainder.
Under `--debug` a `MIN / -1` panics here under either modifier (#2408), as every overflow does in ADR-044
([owner ruling](https://github.com/smeltworks/cnx/issues/1790#issuecomment-6854471224), #1790); a zero divisor still
returns `true` and writes the default.

**Use case:** Safety-critical calculations where the extra check is worth the cost and a sensible default exists.

---

## Rationale

### Why This Approach?

1. **Catches trivial bugs** — Literal division by zero (`10 / 0`) is always a programming error, caught at compile time
2. **Zero-cost by default** — Fast path has no overhead; critical for embedded real-time constraints
3. **Explicit opt-in safety** — Developers choose where to pay for runtime checks
4. **Sensible defaults** — `safe_div()` prevents ARM Cortex-M silent corruption with explicit fallback values
5. **Simple implementation** — Constant folding for compile-time, simple function for runtime
6. **Matches modern languages** — Rust/Zig detect compile-time, provide safe alternatives

### Real-World Example

```cnx
// Time-critical PID control loop (runs at 1kHz)
void pidUpdate() {
    u32 error <- setpoint - current;
    u32 derivative <- (error - lastError) / dt;  // Fast division, dt validated at init
    output <- Kp * error + Kd * derivative;
}

// Safety-critical speed calculation
void updateMotorSpeed() {
    u32 speed <- 100;  // Safe default (stopped)
    bool err <- safe_div(speed, distance, time, 100);
    if (err) {
        systemState <- State.FAULT;
        logError("Division by zero in motor speed");
    }
    motorControl(speed);  // Uses safe default if time=0
}
```

### ARM Cortex-M Safety

On ARM Cortex-M (most cnx targets), division by zero **silently returns 0** without trapping. This means:

```c
uint32_t speed = distance / 0;  // speed = 0 (wrong, but no crash)
motorControl(speed);             // Motor receives bad command
```

With `safe_div()`:

```cnx
bool err <- safe_div(speed, distance, time, speed);  // Preserve current speed if time=0
```

This prevents silent corruption while allowing the developer to specify context-appropriate defaults.

---

## MISRA Compliance

**Rule 1.3:** "There shall be no occurrence of undefined or critical unspecified behavior"

- **Compile-time detection** catches statically determinable violations
- **safe_div()** provides runtime safety for critical paths
- Combined with static analysis over the generated C, achieves full coverage

**Directive 4.1:** "Run-time failures shall be minimized"

- Developers can use `safe_div()` for all division in safety-critical modules
- Error return value enables proper logging and fault handling

---

## Test Coverage Requirements

Add these test cases to validate the implementation:

### 1. Compile-Time Error Tests (Should Fail)

**File:** `tests/arithmetic/division-by-zero-literal.test.cnx`

```cnx
// Literal zero division
u32 result <- 10 / 0;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/division-by-const-zero.test.cnx`

```cnx
// Const zero
u32 ZERO <- 0;
u32 result <- 10 / ZERO;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/modulo-by-zero-literal.test.cnx`

```cnx
// Modulo by zero
u32 remainder <- 10 % 0;
// Expected: Error: Division by zero
```

**File:** `tests/arithmetic/division-by-zero-const-expr.test.cnx`

```cnx
// Const expression evaluating to zero
u32 VALUE <- 5 - 5;
u32 result <- 10 / VALUE;
// Expected: Error: Division by zero
```

### 2. Valid Division Tests (Should Pass)

**File:** `tests/arithmetic/division-runtime-variable.test.cnx`

```cnx
// Runtime variable (no compile-time check)
void testRuntimeDivision(u32 divisor) {
    u32 result <- 10 / divisor;  // Valid, no static check
}
```

**File:** `tests/arithmetic/division-non-zero-const.test.cnx`

```cnx
// Non-zero const
u32 TEN <- 10;
u32 result <- 100 / TEN; // Valid
```

### 3. safe_div() Built-in Tests

**File:** `tests/arithmetic/safe-div-basic.test.cnx`

```cnx
void testSafeDivBasic() {
    mut u32 result;

    // Division succeeds
    bool err1 <- safe_div(result, 100, 10, 0);
    // result should be 10, err1 should be false

    // Division by zero, uses default
    bool err2 <- safe_div(result, 100, 0, 999);
    // result should be 999, err2 should be true
}
```

**File:** `tests/arithmetic/safe-div-preserve-on-error.test.cnx`

```cnx
void testSafeDivPreserve() {
    mut u32 speed <- 100;

    // Preserve current value on error
    bool err <- safe_div(speed, 500, 0, speed);
    // speed should still be 100, err should be true
}
```

**File:** `tests/arithmetic/safe-mod-basic.test.cnx`

```cnx
void testSafeModBasic() {
    mut u32 result;

    // Modulo succeeds
    bool err1 <- safe_mod(result, 10, 3, 0);
    // result should be 1, err1 should be false

    // Modulo by zero, uses default
    bool err2 <- safe_mod(result, 10, 0, 99);
    // result should be 99, err2 should be true
}
```

**File:** `tests/arithmetic/safe-div-all-types.test.cnx`

```cnx
void testSafeDivAllTypes() {
    // Test all integer types
    mut u8 r8;
    mut u16 r16;
    mut u32 r32;
    mut u64 r64;
    mut i8 ri8;
    mut i16 ri16;
    mut i32 ri32;
    mut i64 ri64;

    bool e1 <- safe_div(r8, 100, 0, 0);
    bool e2 <- safe_div(r16, 1000, 0, 0);
    bool e3 <- safe_div(r32, 10000, 0, 0);
    bool e4 <- safe_div(r64, 100000, 0, 0);
    bool e5 <- safe_div(ri8, -100, 0, 0);
    bool e6 <- safe_div(ri16, -1000, 0, 0);
    bool e7 <- safe_div(ri32, -10000, 0, 0);
    bool e8 <- safe_div(ri64, -100000, 0, 0);
}
```

### 4. Floating-Point Division by Zero (Issue #1010)

**Update (Issue #1010):** Floating-point division by literal zero is now also rejected, for parity with integer division. While IEEE 754 defines float division by zero (producing ±Inf/NaN), cnx chooses to reject it at compile time because:

1. **Consistency** — Integer and float division should behave the same way
2. **Safety** — Division by zero is almost always a bug, not intentional
3. **Embedded focus** — cnx targets safety-critical systems where undefined/infinite values are problematic

**File:** `tests/floats/float-division-by-literal-zero.test.cnx`

```cnx
void testFloatDivisionByZero() {
    // ❌ COMPILE ERROR - Float division by literal zero is now rejected
    f32 result1 <- 10.0 / 0.0;   // Error: Division by zero
    f32 result2 <- -10.0 / 0.0;  // Error: Division by zero
    f32 result3 <- 0.0 / 0.0;    // Error: Division by zero
}
```

**Note:** Runtime float division by a variable that happens to be zero still follows IEEE 754 (produces ±Inf/NaN), as runtime checking is opt-in via `safe_div()`.

---

### 5. Scope-Context Matrix (#1219)

A division can appear in all five structural contexts -- a `for` header's
declaration among them -- and the check must hold in each of them however the
zero-valued `const` reaches the division. No cell on the
derivable axes is `off` for this ADR.

Severity follows the eslint model: `off` records that a cell cannot exist for this
feature, `warn` that it should be covered and is not, `error` that it must be.
Undeclared cells are `off`.

<!-- MATRIX-SEVERITY code: E0800 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0802 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

One limit of the tooling applies to any ADR declaring a matrix, tracked as
#1402: the relationship axis measures the deepest include chain reachable from
the fixture rather than the hops to the declaration under test, so a helper that
gains an unrelated include silently moves the cells its consumers occupy. The two
provider-side relationships are not derivable for the same reason.

A second limit used to sit beside it -- that only a fixture with an
`.expected.error` could occupy a cell -- and **#1241 removed it** on 2026-08-29.
Occupancy now derives from diagnostic positions union ADR provenance, so an ADR
covering codegen behavior rather than a diagnostic can satisfy an `error` cell,
provided it records where its rule fired.

All fifteen derivable cells are `error`, and all fifteen are occupied -- see
`docs/scope-context-matrix.md`. The three `for` header cells are occupied by
`tests/adr-051/for-header-division-{same-file,imported-direct,imported-transitive}.test.cnx`,
each dividing by a const zero in the initializer of a `for` header's declaration;
in the imported two the zero is declared one and two includes away.

The eight cross-file cells were `warn` while they were **known broken** (#1217):
the constant folding behind E0800 resolved `const` values from the current
file's symbol table only, so an imported zero was treated as a runtime variable
and the check was skipped. Declaring them `error` then would have failed the
gate on a transpiler defect rather than on missing tests.

#1217 is fixed (#1237), which also contributed the fixtures. Three of them --
`tests/bugs/issue-1220-analyzer-cross-file-symbols/division-by-zero-{same-file,
imported-direct,imported-transitive}.test.cnx` -- each exercise a const zero in
all four contexts at one file relationship, so between them they occupy the
whole grid. The condition this table recorded has been met, so the cells are
promoted.

The grid has no axis for how the division spells the const. A const divisor is
the same divisor however it is written -- `ZERO`, `this.ZERO`, `global.ZERO`,
`Scope.ZERO` or `global.Scope.ZERO` -- and means the declaration ADR-057 names,
for an integer and a float const alike. #1268 sat in that gap: every cell was
occupied while `n / this.ZERO` was accepted and emitted a literal `n / 0`.
`tests/bugs/issue-1268-qualified-zero-const/` covers each spelling, same-file
and imported, with nonzero same-named consts in the other scope as controls.

The two provider-side relationships carry no declaration: `.expected.error`
holds no file path, so occupancy for them is not derivable and the report
renders them `n/a` rather than counting them empty.

### 6. Compound Division and Modulo (Issue #1770)

`x /<- d` divides by `d` and `x %<- d` takes the remainder by `d`, so the check
holds for them as it does for `/` and `%`: E0800 for `/<-` and E0802 for `%<-`,
at the divisor, wherever the assignment stands -- a statement, a `for`
initializer or a `for` update. Before #1770 each of these was accepted and
emitted `x /= 0U` or `x %= 0U`, while every cell of the matrix in §5 was
occupied: the grid has no axis for how a division is spelled, its operator or
its const (#1268).

**File:** `tests/bugs/issue-1770-compound-division-zero/compound-division-zero.test.cnx`

```cnx
u32 ZERO <- 0;

u32 x <- 10;
x /<- 0; // Error: Division by zero (E0800)
x %<- ZERO; // Error: Modulo by zero (E0802)
x /<- 2; // OK
for (x /<- 0; x < 5; x %<- ZERO) {} // E0800, E0802
```

## Diagnostics

| Code  | Reported when                                                                                      | Asserted by                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| E0800 | `/` or `/<-` by a compile-time zero: a literal, a const or a constant expression, integer or float | `tests/arithmetic/division-by-zero-literal.test.cnx`, `tests/bugs/issue-1770-compound-division-zero/compound-division-zero.test.cnx`            |
| E0802 | `%` or `%<-` by a compile-time zero: a literal, a const or a constant expression                   | `tests/arithmetic/modulo-by-zero-literal.test.cnx`, `tests/bugs/issue-1770-compound-division-zero/compound-division-zero.test.cnx`              |
| E0884 | `safe_div` or `safe_mod` is called with other than four arguments                                  | `tests/adr-051/safe-division-shape-error.test.cnx`, `tests/adr-051/safe-division-shape-{contexts,imported-direct,imported-transitive}.test.cnx` |
| E0885 | The first argument is not a variable that can receive the result                                   | `tests/adr-051/safe-division-shape-error.test.cnx`, `tests/adr-051/safe-division-shape-{contexts,imported-direct,imported-transitive}.test.cnx` |

The result is written THROUGH the first argument, which is why it must be a
variable rather than an expression: the generated helper takes its address. A
name that resolves to nothing is not this rule's to report; a name that
resolves to something other than a variable is.

That the output is written through also makes a `const` there an assignment to
a const, reported as E0877 under ADR-013 and asserted by
`tests/adr-051/safe-division-const-output-error.test.cnx`. Until #1322 that was
accepted, and the generated C passed the address of a `const` into a non-const
pointer parameter.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY code: E0884 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

<!-- MATRIX-SEVERITY code: E0885 -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| for header         | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| for header         | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |
| for header         | imported transitive | error    |

Both rules are about the call as written -- how many arguments it has, and
whether its first is a variable -- so each holds wherever a call can stand,
including a file-scope or scope-member initializer or a `for` header's
declaration, and however far the names in the call reach across includes. The
`for` header cells are occupied by
`tests/adr-051/for-header-shape-{same-file,imported-direct,imported-transitive}.test.cnx`.

## Implementation Plan

### Phase 1: Compile-Time Detection

**Component:** Semantic Analyzer

1. Add constant expression evaluator to semantic analysis phase
2. During division/modulo operations, check if divisor is a compile-time constant
3. If constant evaluates to zero, emit error: `"Division by zero"`
4. Test with all error test cases

The check is a compile-time one and applies only where the divisor is known at
compile time; a runtime-valued divisor is Phase 2's problem, not this one.

### Phase 2: safe_div() and safe_mod() Built-ins

**Component:** Code Generator

1. Generate helper functions for all integer types:
   - `cnx_safe_div_u8`, `cnx_safe_div_u16`, `cnx_safe_div_u32`, `cnx_safe_div_u64`
   - `cnx_safe_div_i8`, `cnx_safe_div_i16`, `cnx_safe_div_i32`, `cnx_safe_div_i64`
   - `cnx_safe_mod_*` variants for modulo

2. Add to generated C header:

```c
// Division by zero safety helpers (ADR-051)
static inline bool cnx_safe_div_u32(uint32_t* output, uint32_t numerator,
                                     uint32_t divisor, uint32_t defaultIfZero) {
    if (divisor == 0) {
        *output = defaultIfZero;
        return true;  // Error occurred
    }
    *output = numerator / divisor;
    return false;  // Success
}

// ... repeat for all types
```

3. Recognize `safe_div()` and `safe_mod()` as built-in functions
4. Transpile calls to appropriate `cnx_safe_div_*` function based on output type
5. Test with all safe_div() test cases

`safe_div` and `safe_mod` are built-ins rather than library functions, so a program
cannot shadow them and a reviewer of the generated C can rely on the helper meaning
what this ADR says it means.

### Phase 3: Update Coverage Matrix

Add to `coverage.md`:

| Feature                          | Status | Test File                                      |
| -------------------------------- | ------ | ---------------------------------------------- |
| Division by zero error (literal) | [x]    | `arithmetic/division-by-zero-literal.test.cnx` |
| Division by zero error (const)   | [x]    | `arithmetic/division-by-const-zero.test.cnx`   |
| Modulo by zero error             | [x]    | `arithmetic/modulo-by-zero-literal.test.cnx`   |
| safe_div() built-in              | [x]    | `arithmetic/safe-div-basic.test.cnx`           |
| safe_mod() built-in              | [x]    | `arithmetic/safe-mod-basic.test.cnx`           |

---

## Implementation Status

**Current (measured 2026-10-17 at `1d5d36ed5`, #1933):** the table above is implemented.
A zero literal, or a read-only binding whose value is zero, as divisor is rejected at compile time (E0800, and E0802 for `%`), and
`safe_div()`/`safe_mod()` are built in. Two divisors that are zero at compile time are not
caught yet: a constant expression such as `x / (1 - 1)` (#1879) and a header macro such as
`#define ZM 0` (#2071).

**Target:** v1.0 release

**Priority:** High (core safety feature)

---

## References

### Language Behavior Research

**Rust:**

- [Rust programs crash when dividing by zero](https://github.com/rust-lang/rust/issues/944)
- [Why dividing by zero has no safety guarantees](https://internals.rust-lang.org/t/question-why-does-dividing-by-zero-have-no-safety-guarantees/19189)
- [CheckedDiv trait](https://docs.rs/num/latest/num/trait.CheckedDiv.html)

**Zig:**

- [Add compile error for division by zero](https://github.com/ziglang/zig/issues/372)
- [Runtime Safety Guide](https://zig.guide/language-basics/runtime-safety/)
- [How (memory) safe is Zig?](https://www.scattered-thoughts.net/writing/how-safe-is-zig/)

**Ada:**

- [Understanding Built-in Exceptions in Ada](https://piembsystech.com/understanding-built-in-exceptions-in-ada-programming-language/)
- [SPARK for MISRA C Developers - Undefined Behavior](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/07_undefined_behavior.html)

**Swift:**

- [Throwing Arithmetic Operators in Swift](https://medium.com/@wircho/throwing-arithmetic-operators-in-swift-6c39fca4ff0e)
- [Notes on numerics in Swift](https://numerics.diploid.ca/integers-part-2.html)

**Go:**

- [How does Go handle division by zero?](https://labex.io/questions/how-does-go-handle-division-by-zero-166173)

**C/C++:**

- [Undefined Behavior in C and C++](https://www.geeksforgeeks.org/cpp/undefined-behavior-c-cpp/)
- [UndefinedBehaviorSanitizer](https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html)

### Embedded Systems & ARM

- [ARM Cortex-M division by zero behavior](https://medium.com/@pqshedy33/why-doesnt-the-program-crash-when-the-stm32-microcontroller-performs-zero-division-operation-fe53bb97a697)
- [Generic Hard Fault handler for ARM Cortex-M](https://blog.feabhas.com/2013/02/developing-a-generic-hard-fault-handler-for-arm-cortex-m3cortex-m4/)
- [ARM Cortex-M Exception Handling](https://interrupt.memfault.com/blog/arm-cortex-m-exceptions-and-nvic)

### MISRA C Standards

- [MISRA C:2012 Guidelines](https://wiki.sei.cmu.edu/confluence/display/c/MISRA+C:2012)
- [MISRA C 2012 Rules Explained](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf)
- [MISRA Compliance - Parasoft](https://www.parasoft.com/solutions/misra/)

### Related ADRs

- `docs/implementation/static-analysis.md` (formerly ADR-012): how the generated C is checked
- ADR-044: Overflow Modifiers (clamp/wrap)
