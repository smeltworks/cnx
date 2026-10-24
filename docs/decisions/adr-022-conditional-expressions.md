# ADR-022: Conditional Expressions (If/Else and Ternary)

## Status

**Implemented**

## Context

Conditional control flow is fundamental to any programming language. cnx needs to support:

1. **If/else statements** - Standard conditional branching
2. **Ternary operator** - Inline conditional expressions

---

## Part 1: If/Else Statements (Implemented)

### Decision

**Use standard C-style if/else syntax** - It's familiar, clear, and works well.

### Syntax

```cnx
// Basic if
if (condition) {
    doSomething();
}

// If/else
if (x > 0) {
    handlePositive();
} else {
    handleNonPositive();
}

// If/else-if/else chain
if (x > 0) {
    doPositive();
} else if (x < 0) {
    doNegative();
} else {
    doZero();
}
```

### Key Differences from C

1. **Comparison operator** - Uses `=` for equality (not `==`)
2. **Assignment operator** - Uses `<-` (not `=`), eliminating the classic `if (x = 5)` bug

```cnx
// cnx prevents accidental assignment in conditions
if (x = 5) {      // This is COMPARISON (equals 5?)
    // ...
}

// Assignment would be:
x <- 5;           // Clear and distinct
```

### Implementation Notes

**Grammar:**

```antlr
ifStatement
    : 'if' '(' expression ')' block ('else' 'if' '(' expression ')' block)* ('else' block)?
    ;
```

**Code Generation:**
Direct mapping to C with operator translation:

```c
// cnx: if (x = 5)
// C output: if (x == 5)
```

---

## Part 2: Ternary Operator (Accepted)

### Decision

**Standard C ternary with safety constraints:**

1. **Parentheses required** around the condition
2. **Boolean condition required** - must be an explicit comparison
3. **No nesting allowed** - nested ternaries are a compile error

### Decision Drivers

1. **Convenience** - Avoids verbose if/else for simple cases
2. **Expression Context** - Works where statements don't
3. **Readability** - Can be clearer OR more confusing
4. **C Compatibility** - Familiar syntax
5. **MISRA Compliance** - Follows safety-critical coding standards

### MISRA C Alignment

cnx's ternary constraints align with these MISRA C rules:

| Rule     | Requirement                                 | cnx Approach                    |
| -------- | ------------------------------------------- | ------------------------------- |
| **14.4** | Condition must have essential Boolean type  | Required: explicit comparison   |
| **14.3** | Condition must not be invariant             | Compiler can warn               |
| **13.4** | Assignment results should not be used       | `<-` syntax prevents this       |
| **12.1** | Use parentheses to make precedence explicit | Required: parentheses mandatory |

#### MISRA Rule 14.4 - Boolean Condition

```cnx
// ERROR: integer used as condition (not boolean)
i32 x <- 5;
i32 y <- x ? 1 : 0;           // x is not a boolean expression

// OK: explicit comparison produces boolean
i32 y <- (x != 0) ? 1 : 0;    // explicit comparison
```

#### MISRA Rule 12.1 - Explicit Precedence

```cnx
// ERROR: parentheses required around condition
i32 result <- a = b ? a : a - b;

// OK: parentheses make precedence explicit
i32 result <- (a = b) ? a : (a - b);
```

#### MISRA Rule 13.4 - No Assignment in Expression

cnx's `<-` assignment operator naturally prevents this class of bugs:

```c
// C: Non-compliant - using assignment result
y = (x = getValue()) ? x : default;
```

```cnx
// cnx: This pattern isn't possible with <- syntax
// Must write it clearly:
x <- getValue();
y <- (x != 0) ? x : default;
```

### Options Considered

#### Option A: Standard C Ternary (with constraints) - SELECTED

```cnx
u32 max <- (a > b) ? a : b;
u32 abs <- (x < 0) ? -x : x;
```

**Pros:** Familiar, concise, MISRA-compliant with our constraints
**Cons:** Slightly more restrictive than C

#### Option B: Keyword-Based

```cnx
u32 max <- if a > b then a else b;
```

**Pros:** More readable
**Cons:** Unfamiliar, longer

#### Option C: No Ternary

Use if/else statements only.

**Pros:** Forces explicit code
**Cons:** Verbose, can't use in expressions

### Syntax

#### Valid Usage

```cnx
// Simple conditional - parentheses required, boolean expression required
u32 result <- (x > 0) ? x : 0;

// With equality comparison (= is comparison in cnx)
bool isEven <- (n % 2 = 0) ? true : false;

// Min/max
u32 min <- (a < b) ? a : b;
u32 max <- (a > b) ? a : b;

// Default value with null check
u32 value <- (ptr != null) ? ptr.value : 0;
```

#### Errors

```cnx
// ERROR: No parentheses around condition
u32 result <- x > 0 ? x : 0;
//            ^~~~~ missing parentheses

// ERROR: Condition is not a boolean expression
u32 result <- (x) ? 1 : 0;
//             ^ not a boolean expression, use (x != 0)

// ERROR: Nested ternaries not allowed
u32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;
//                        ^~~~~~~~~~~~~~ nested ternary not allowed

// Use if/else instead:
i32 sign;
if (x > 0) {
    sign <- 1;
} else if (x < 0) {
    sign <- -1;
} else {
    sign <- 0;
}

// ERROR: Nested ternary in clamp pattern
u32 clamped <- (x < min) ? min : (x > max) ? max : x;
//                               ^~~~~~~~~~~~~~~ nested ternary not allowed

// Use a function or if/else instead:
u32 clamped <- clamp(x, min, max);
```

### Implementation Notes

#### Grammar

```antlr
// Ternary cannot contain another ternary - enforced in semantic analysis
conditionalExpression
    : '(' booleanExpression ')' '?' nonTernaryExpression ':' nonTernaryExpression
    ;

booleanExpression
    : comparisonExpression
    | logicalExpression
    ;
```

#### Semantic Checks

1. Verify condition is wrapped in parentheses
2. Verify condition is a boolean expression (comparison or logical op)
3. Verify neither branch contains a ternary operator
4. Verify both branches have compatible types

#### Code Generation

Direct pass-through to C:

```c
// cnx: (x > 0) ? x : 0
// C output: (x > 0) ? x : 0
```

#### Priority

**Medium** - Useful but if/else covers most cases.

---

## Controlling-Expression Rule (Issue #1042)

**Status: Implemented.** Every controlling expression — `if`, `while`, `for`,
`do-while`, and the ternary condition — must be an **explicit comparison**.
After decomposing the expression by `||` and `&&`, **every leaf operand must
itself be an equality (`=`, `!=`) or relational (`<`, `>`, `<=`, `>=`)
comparison.** The rule is uniform across every spelling of the operand and every
controlling position: a local, a parameter, and a `this.`/`global.` scope member
are all held to it, and a ternary condition is held to exactly the same rule as an
`if` condition — error **E0701**.

**A bracketed group is judged by what it holds (Issue #1195).** A leaf operand
that is nothing but one bracketed group is decomposed again, so
`(n < 5) && (n > 1)` is two comparisons and `(flag)` is still a bare bool.
Anything around the group — a prefix such as `!(…)`, a postfix such as `(…)[0]`,
or an operator outside the brackets — makes it a single operand, judged as
written. The always-true loop check (E0707) reads a bracketed condition the same
way, so `while ((1 = 1))` is rejected exactly as `while (1 = 1)` is, and so does
the no-call rule (E0702): `(isValid()) = true` runs `isValid()` exactly as
`isValid() = true` does, so it is a call in the condition however it is
bracketed.

E0702 admits no call anywhere in a controlling expression, a call inside a
subscript or an argument included (owner ruling 2026-10-24, #2332:
_"NO CALLS IN A LOOP CONDITION"_). `while ((i < 3) && (arr[w(x)] = 1))` calls
`w` in the condition as surely as `while (w(x) = 1)` does; the check used to
stop at a subscript (#254, #366), which let a struct initializer's temporary
reach a loop condition.

Uniformity is stated here because it is the part most easily lost. A check applied
to one spelling and not another passes the corpus while leaving the rule with a
hole, and the scope-context matrix cannot see the difference: a bare `read()` and
a qualified `this.read()` derive the same cell (#1210, #1260).

This is intentionally **stricter than MISRA C:2012 Rule 14.4**. Rule 14.4 only
requires the controlling expression to have _essentially Boolean type_, which
would permit a bare `bool` variable. cnx additionally forbids the bare form
so that the comparison is always visible at the point of decision.

```cnx
bool flag <- false;

// ERROR (E0701): bare boolean — local, parameter, or member alike
if (flag) { }
if (this.flag) { }
while (running) { }

// ERROR (E0701): negation is not a comparison
if (!flag) { }
if (!(n < 5)) { }                  // brackets do not change that
while (!done && tries < MAX) { }   // use: done = false && tries < MAX

// ERROR (E0701): brackets do not make a bare bool a comparison
if ((flag)) { }

// ERROR (E0701): each operand of a logical combination must be a comparison
if (a && b) { }                    // use: a = true && b = true

// ERROR (E0701): a literal is not a comparison
if (true) { }

// OK: explicit comparisons
if (flag = true) { }
if (this.flag = false) { }
while (running = true) { }
if (x > 0 && y != 0) { }
if ((x > 0) && (y != 0)) { }       // each bracketed group holds a comparison
```

Before this fix only the `this.`/`global.` member form was rejected (member
access did not resolve through the variable-type lookup that whitelisted bare
booleans), while bare locals and parameters silently compiled — a divergent
code path that this change unified.

## Research note: a ternary of arrays as an argument (#2157)

_Research note; Status and Decision are unchanged._

ADR-014 passes an array argument by reference, so a ternary whose arms are
both arrays is passed as it stands, the way each arm is on its own (owner
ruling on #2161). Each arm gets the same checks as a bare array argument: its
shape must match the parameter's (#2194), and so must its element type and
string capacity (#2209); an arm that fails is E0866 at that arm. C emits the
ternary unchanged, as C++ already did, so only the chosen arm is read:

```cnx
u8 p <- peak((gear > 1) ? highGear : lowGear); // peak((gear > 1) ? highGear : lowGear)
u8 q <- peak((gear > 1) ? highGear : small);   // E0866: small is a u8[3]
```

An arm that is a list or a string literal is not an array that can be passed
as it stands, so the ternary stays E0866 under ADR-035, as it does at a
declaration (`u8[4] t <- (c) ? a : b`). Before #2161, C emitted the ternary
inside a one-element compound literal of the element type, which gcc rejects.

## Scope-context matrix

Declared for the rules #1322 moved out of codegen into pass 2.1: **E0710**
(no ternary inside a ternary), **E0701** (a controlling expression must be an
explicit comparison, MISRA C:2012 Rule 14.4) and **E0702** (a controlling
expression may not call a function, Rule 13.5).

| Code  | Meaning                                                 | Fixtures                                                                                                                                                                                                                                            |
| ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0701 | A controlling expression must be an explicit comparison | `if-error-non-boolean`, `ternary-error-non-boolean`, `controlling-expression-every-kind-error`, `controlling-expression-contexts-error`, `controlling-expression-imported-direct-error`, `controlling-expression-imported-transitive-error`         |
| E0702 | A controlling expression may not call a function        | `function-call-in-if-error`, `function-call-in-ternary-error`, `function-call-in-if-this-method-error`, `controlling-expression-contexts-error`, `controlling-expression-imported-direct-error`, `controlling-expression-imported-transitive-error` |
| E0710 | A ternary may not appear inside another ternary         | `nested-ternary-error`, `nested-ternary-for-header-error`, `nested-ternary-imported-direct-error`, `nested-ternary-imported-transitive-error`                                                                                                       |

The cells are shared, because a matrix cell is a claim about where an ADR's
rules are observable rather than about one code. All three are properties of an
EXPRESSION, so all three reach the same four same-file contexts and none of them
crosses a file boundary.

**No nesting is rejected two different ways, and only one of them is E0710.**
Written without parentheses, `(x > 0) ? 1 : (x < 0) ? -1 : 0` is a syntax error.
Written with them, it parses and is reported as E0710. The matrix below
describes the second mechanism only: a syntax error carries no code and no
analyzable tree, so there is no cell for it to occupy. Both fixtures are kept
side by side so the pair is visible.

**"No nesting" covers the condition, not only the branches.** `(((x > 0) ? 1 :
2) = 1) ? 3 : 4` nests a ternary inside the condition of another, and the
condition as a whole is still a comparison, so the boolean-condition rule above
is satisfied and does not reject it. It is rejected as nesting. This is not a
new decision -- Part 2 states the constraint without qualifying it to the
branches -- but the constraint went unenforced there until #1322, so it is
written out here rather than left to be re-derived.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |

<!-- MATRIX-SEVERITY code: E0701 -->

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

<!-- MATRIX-SEVERITY code: E0702 -->

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

<!-- MATRIX-SEVERITY code: E0710 -->

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

No code cell is `off`: a ternary reaches every initializer and a `for` header's declaration, and an imported name can be any operand (probed for all three codes).

All four same-file cells are `error`, which is the way this rule differs from a
statement-level one: a ternary is an **expression**, so it reaches an initializer
as well as a function body. That was probed rather than assumed — a nested
ternary in a file-scope initializer and in a scope-member initializer both
report — and all four are occupied by `nested-ternary-error`.

Every `imported` cell is `off`, and that is a claim about the rules rather than
a gap in the corpus: nesting, being a comparison, and containing a call are all
properties of one expression, written in one file.
An include cannot introduce a ternary into another file's expression, so no
cross-file arrangement can change the answer. Adding a fixture there would
occupy a cell by transporting an unrelated include, not by testing anything.

## References

- C conditional statements
- C ternary operator
- [MISRA C:2023 Rule 12.1 - Operator Precedence](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule12.1.html)
- [MISRA C:2023 Rule 13.4 - Assignment Results](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule13.4.html)
- [MISRA C:2012 Rule 14.3 - Invariant Expressions](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule14.3.html)
- [PVS-Studio V2584 - Essential Boolean Type](https://pvs-studio.com/en/docs/warnings/v2584/)
