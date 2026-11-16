# ADR-025: Switch Statements

## Status

**Implemented**

## Context

Switch statements are fundamental to embedded programming:

- State machines
- Command dispatching
- Protocol parsing
- Interrupt handlers

C's switch has footguns (fall-through, missing breaks), but the pattern is essential.

## Decision Drivers

1. **State Machines** - Core embedded pattern
2. **Safety** - Prevent accidental fall-through
3. **Exhaustiveness** - Catch missing cases with enums
4. **C Compatibility** - Generate valid C switch
5. **Clarity** - Each case should be self-contained and self-documenting

## Options Considered

### Option A: C-Style with Required Break

```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
        break;
    }
    case State.RUNNING: {
        checkSensors();
        break;
    }
    default: {
        handleError();
        break;
    }
}
```

**Pros:** Familiar
**Cons:** Still needs break, easy to forget

### Option B: Implicit Break, Explicit Fallthrough

```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
    }  // Implicit break
    case State.RUNNING: {
        checkSensors();
    }
    case State.STOPPING:
    fallthrough;  // Explicit fall-through
    case State.STOPPED: {
        cleanup();
    }
}
```

**Pros:** Safe by default, explicit intent
**Cons:** Different from C, still allows fallthrough complexity

### Option C: Match Expression (Rust-style)

```cnx
u32 result <- match (cmd) {
    Command.READ: 1,
    Command.WRITE: 2,
    Command.ERASE: 3,
};
```

**Pros:** Expression, exhaustive
**Cons:** Very different from C, complex

### Option D: Braces Replace Break, No Fallthrough (Selected)

```cnx
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
```

**Pros:** Safe by default, clean syntax, no colons needed, each case fully self-contained
**Cons:** Different from C (but safer)

## Decision

**Option D: Braces Replace Break, No Fallthrough**

Key design choices:

1. **Required braces** - Replace `break;` with mandatory `{}` blocks
2. **No colons** - Braces make colons redundant: `case X {` not `case X: {`
3. **No fallthrough** - Not supported; be explicit about each case's behavior
4. **Counted default for enums** - `default(n)` where n = variants covered by default
5. **Multiple cases with `||`** - Use `case A || B { }` syntax
6. **Constant expressions only** - No `case x + 1:`
7. **Integral types only** - Standard C switch type restrictions
8. **Minimum 2 clauses** - Single-case switches should use `if` instead
9. **Default must be last** - Improves readability and consistency
10. **No boolean switches** - Use `if/else` for boolean expressions

## Syntax

### Basic Switch (Non-Enum)

```cnx
// For integral types, use plain default (no count)
switch (command) {
    case 0 {
        handleReset();
    }
    case 1 {
        handleStart();
    }
    default {
        handleUnknown();
    }
}
```

### Multiple Cases (OR Syntax)

```cnx
switch (cmd) {
    case Command.READ || Command.PEEK {
        // Handle both read operations
        readData();
    }
    case Command.WRITE {
        writeData();
    }
    default(2) {
        // Covers remaining 2 variants
        handleOther();
    }
}
```

### Const Labels

A label may name a const in any of ADR-016's three spellings (#1629):

```cnx
u8 LIMIT <- 1;

scope Panel {
    u8 LIMIT <- 3;

    public u32 pick(u8 s) {
        switch (s) {
            case this.LIMIT { // the scope's LIMIT: 3
                return 30;
            }
            case global.LIMIT { // the file's LIMIT: 1
                return 10;
            }
            default {
                return 0;
            }
        }
    }
}
```

A bare `LIMIT` inside `Panel` is the scope's, as it is in any expression.

An enum member takes a root the same way: inside a scope, `State.IDLE` and
`this.State.IDLE` both name the scope's own `State`, and `global.EMode.IDLE`
the file's (#147, #2052). The label is the constant the binding names, so
`LIMIT` and `global.LIMIT` naming one const are one value -- and E0713 when
both are written.

E0713 compares what two labels claim in C, not how they are written (#2046). A
const is written as its value, so `LIMIT` beside `3`, two consts with one
value, and a local `LIMIT` beside a `global.LIMIT` of the same value are each
one C case twice. A label that does not fold is compared by what it names: a
qualified enum member by its member, a header macro by its name in either
spelling. A bare enum member (`IDLE`) is still compared by its spelling, so
beside `EMode.IDLE` it is not yet E0713 (#2067).

### Exhaustive Enum Matching (No Default)

```cnx
enum EState { IDLE, RUNNING, STOPPED, ERROR }  // 4 variants

switch (state) {
    case EState.IDLE {
        startMotor();
    }
    case EState.RUNNING {
        checkSensors();
    }
    case EState.STOPPED {
        // Intentionally empty - no action needed
    }
    case EState.ERROR {
        handleError();
    }
    // No default - all 4 cases covered explicitly
    // Compiler error if a case is missing
}
```

### Counted Default for Large Enums

```cnx
// HttpStatus has 50 variants, we only care about 5
switch (status) {
    case HttpStatus.OK {
        handleSuccess();
    }
    case HttpStatus.CREATED {
        handleCreated();
    }
    case HttpStatus.BAD_REQUEST {
        handleBadRequest();
    }
    case HttpStatus.UNAUTHORIZED {
        handleAuthError();
    }
    case HttpStatus.NOT_FOUND {
        handle404();
    }
    default(45) {
        // 5 explicit cases + 45 = 50 total ✓
        handleOther();
    }
}
```

**If a new variant is added to HttpStatus (now 51 variants):**

```
error: switch covers 50 of 51 HttpStatus variants (5 explicit + default(45)), missing 1
  --> src/handler.cnx:42:5
   |
42 |     default(45) {
   |     ^^^^^^^^^^^ update to default(46) or add explicit case
```

### Defensive Exhaustive Matching with default(0)

```cnx
enum EState { IDLE, RUNNING, STOPPED }  // 3 variants

switch (state) {
    case EState.IDLE {
        startMotor();
    }
    case EState.RUNNING {
        checkSensors();
    }
    case EState.STOPPED {
        cleanup();
    }
    default(0) {
        // Self-documenting: all cases handled explicitly
        // This block is defensive - should never execute
        logError("Invalid state reached");
    }
}
```

### Why No Fallthrough? Be Explicit

Instead of fallthrough for cumulative behavior:

```cnx
// cnx: Explicit and clear
switch (level) {
    case 3 {
        initLevel3();
        initLevel2();
        initLevel1();
    }
    case 2 {
        initLevel2();
        initLevel1();
    }
    case 1 {
        initLevel1();
    }
}
```

Each case is self-contained. A reader knows exactly what happens without tracing fallthrough paths.

### Generated C

```c
// From counted default example
switch (status) {
    case HttpStatus_OK: {
        handleSuccess();
        break;
    }
    case HttpStatus_CREATED: {
        handleCreated();
        break;
    }
    case HttpStatus_BAD_REQUEST: {
        handleBadRequest();
        break;
    }
    case HttpStatus_UNAUTHORIZED: {
        handleAuthError();
        break;
    }
    case HttpStatus_NOT_FOUND: {
        handle404();
        break;
    }
    default: {
        handleOther();
        break;
    }
}
```

## Implementation Notes

### Grammar Changes

```antlr
switchStatement
    : 'switch' '(' expression ')' '{' switchCase+ defaultCase? '}'
    ;

switchCase
    : 'case' caseLabel ('||' caseLabel)* block
    ;

caseLabel
    : qualifiedType                                  // EState.IDLE
    | ('this' | 'global') '.' (qualifiedType | IDENTIFIER)  // ADR-016 roots
    | IDENTIFIER                                     // const or enum member
    | '-'? INTEGER_LITERAL
    | '-'? HEX_LITERAL
    | BINARY_LITERAL
    | CHAR_LITERAL
    ;

defaultCase
    : 'default' ('(' INTEGER_LITERAL ')')? block
    ;
```

### Semantic Analysis

**Type Checking:**

- Verify switch expression is integral type (not boolean - error)
- Verify all case labels are constant expressions: a literal, an enum member
  or a const with a value, in every spelling (E0717, #2051)
- Verify case label types match switch expression type

**Structural Validation:**

- Minimum 2 clauses required (error if only 1)
- `default` must be last if present (error if not)
- Detect duplicate case values (including across `||` expressions)

**Exhaustiveness Checking (Enums Only):**

- Count explicit cases (each `||` alternative counts as 1)
- If `default(n)` present: verify `explicit_cases + n == enum_variant_count`
- If no `default`: verify `explicit_cases == enum_variant_count`
- `default(0)` is valid (defensive programming pattern)
- Error message format: `switch covers X of Y EnumName variants (N explicit + default(M)), missing Z`

**Non-Enum Switches:**

- `default` required (no count parameter)
- `default(n)` syntax is an error for non-enum types

### Generated C

- Add `break;` after each case block
- Expand `case A || B { }` to separate case labels in C
- Generate proper enum value names (e.g., `EState_IDLE`)
- `default(n)` generates plain `default:` in C (count is compile-time only)

### Priority

**Critical** - Essential for embedded state machines.

## Resolved Questions

1. ✅ Require exhaustive matching for enums? **Yes** - via explicit cases OR `default(n)` count
2. ✅ Allow expressions in case labels? **No** - constants only
3. ✅ Require braces around case bodies? **Yes** - braces replace break
4. ✅ Support fallthrough? **No** - be explicit about each case's behavior
5. ✅ Need colons after case? **No** - braces make them redundant
6. ✅ Multiple case syntax? **`case A || B { }`** - OR operator style
7. ✅ Large enum handling? **`default(n)`** - counted default with compile-time validation
8. ✅ Default position? **Must be last** - MISRA 16.5 compliance
9. ✅ Minimum clauses? **2 required** - MISRA 16.6 compliance
10. ✅ Boolean switches? **Error** - MISRA 16.7 compliance, use `if/else`
11. ✅ `default(0)` allowed? **Yes** - self-documenting defensive programming
12. ✅ May a const label be written `this.X` or `global.X`? **Yes** - ADR-016
    (Implemented) decides it: `this.X` is "for ANY scope member (variables,
    functions, types, enums)" and `global.X` "for ANY global", and its own
    example is `this.State.IDLE`. A case label is a value position like any
    other, so a member chain takes a root too (#1629, #147). `this.` asks the
    enclosing scope, `global.` file scope, and a bare name searches outward
    (ADR-057). A name that resolves to nothing in any spelling is E0427
    (ADR-030); one that resolves to something that is not a constant is E0717,
    and `this.` outside any scope is E0431 (ADR-016).

## MISRA C:2012/2023 Compliance

| MISRA Rule | Requirement             | cnx Approach                                                 | Status          |
| ---------- | ----------------------- | ------------------------------------------------------------ | --------------- |
| **16.1**   | Well-formed switch      | Grammar enforces structure                                   | ✅ **Enforced** |
| **16.2**   | Labels in correct scope | Grammar prevents nesting                                     | ✅ **Enforced** |
| **16.3**   | Unconditional break     | Implicit break, no fallthrough                               | ✅ **Exceeds**  |
| **16.4**   | Default required        | Required for non-enums; `default(n)` or exhaustive for enums | ✅ **Exceeds**  |
| **16.5**   | Default first or last   | Default must be last (error)                                 | ✅ **Enforced** |
| **16.6**   | Minimum 2 clauses       | Compiler error if < 2                                        | ✅ **Enforced** |
| **16.7**   | No boolean switch       | Compiler error                                               | ✅ **Enforced** |

### cnx Innovation: Counted Default

cnx's `default(n)` syntax goes beyond MISRA by providing **compile-time validation** that all enum variants are accounted for, even when using a default clause. This catches enum growth at build time rather than runtime.

**Comparison:**

- **C + MISRA:** `default` required but no validation of completeness
- **Rust:** `_` wildcard is silent when enum grows
- **cnx:** `default(n)` forces explicit acknowledgment; enum growth breaks build

## Diagnostics

| Code  | Meaning                                                                                                                                                                                         | Fixture                                                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| E0711 | Switch on a `bool` (MISRA C:2012 Rule 16.7)                                                                                                                                                     | `tests/switch/`                                                                                                                              |
| E0712 | Fewer than two clauses (MISRA C:2012 Rule 16.6)                                                                                                                                                 | `tests/switch/`                                                                                                                              |
| E0713 | Duplicate case value, keyed on the value a label claims in C                                                                                                                                    | `tests/bugs/issue-1629-case-label-undeclared/case-label-duplicate-spelling`, `tests/bugs/issue-2046-duplicate-case-value/duplicate-by-value` |
| E0714 | The clauses do not account for the enum's variants exactly                                                                                                                                      | `tests/switch/`                                                                                                                              |
| E0717 | A case label is a variable, a function, a scope, a type, a struct, bitmap or register field (through a scope's type too, #2108), or a const with no C constant value (a string), not a constant | `tests/bugs/issue-2051-case-label-not-constant/case-label-not-constant`                                                                      |

## Scope-context matrix

Declared for the switch rules #1322 moved out of codegen: no switch on a bool,
at least two clauses, no duplicate case value, and clauses that account for an
enum's variants exactly.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| global variable    | exercised from one away | off      |
| top-level function | exercised from one away | warn     |
| scope member       | exercised from one away | off      |
| scope method       | exercised from one away | warn     |
| global variable    | exercised through chain | off      |
| top-level function | exercised through chain | warn     |
| scope member       | exercised through chain | off      |
| scope method       | exercised through chain | warn     |

<!-- MATRIX-SEVERITY code: E0711 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
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

off: E0711 reports a switch on a bool, and a switch is a statement, which the grammar admits only in a function body; a `for` header's declaration takes an expression, and `switch` there is a parse error.

<!-- MATRIX-SEVERITY code: E0712 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | off      |
| scope method       | imported direct         | off      |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | off      |
| scope method       | imported transitive     | off      |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
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

#1402: the imported columns measure the include hops to the declaration a diagnostic or provenance site is about. E0712 counts a switch's clauses as written, which no declaration takes part in, so it cannot occupy one; its cross-file case is the provider side.

off: E0712 reports a one-clause switch, and a switch is a statement, which the grammar admits only in a function body; a `for` header's declaration takes an expression, and `switch` there is a parse error.

<!-- MATRIX-SEVERITY code: E0713 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
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

off: E0713 reports a duplicate case value, and a switch is a statement, which the grammar admits only in a function body; a `for` header's declaration takes an expression, and `switch` there is a parse error.

<!-- MATRIX-SEVERITY code: E0714 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
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

off: E0714 reports an enum switch that miscounts its variants, and a switch is a statement, which the grammar admits only in a function body; a `for` header's declaration takes an expression, and `switch` there is a parse error.

<!-- MATRIX-SEVERITY code: E0717 -->

| Context            | Relationship            | Severity |
| ------------------ | ----------------------- | -------- |
| top-level function | same file               | error    |
| scope method       | same file               | error    |
| global variable    | same file               | off      |
| scope member       | same file               | off      |
| top-level function | imported direct         | error    |
| scope method       | imported direct         | error    |
| global variable    | imported direct         | off      |
| scope member       | imported direct         | off      |
| top-level function | imported transitive     | error    |
| scope method       | imported transitive     | error    |
| global variable    | imported transitive     | off      |
| scope member       | imported transitive     | off      |
| for header         | same file               | off      |
| for header         | imported direct         | off      |
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

off: E0717 reports a case label that is not a constant, and a switch is a statement, which the grammar admits only in a function body; a `for` header's declaration takes an expression, and `switch` there is a parse error.

A switch is a **statement**. It appears in a function body and nowhere else, so
the two declaration contexts cannot hold one and are `off`.

The imported columns are `error` for a top-level function because exhaustiveness
is counted against the enum's MEMBERS, which may be declared in another file. A
check reading only the file in front of it finds no members there, and a variant
count of zero makes every switch look complete -- so the rule would go quiet
across an include rather than fail, which is the silence this matrix exists to
make visible.

`scope method` is `error` in the imported columns because a case label is
answered across an include, and a label the binder could not reach through the
include graph would emit a name C cannot switch on. Inside a scope method,
`case-label-imported-direct` folds `global.FARTHER` from its one include, and
`case-label-rooted-resolves` folds `global.FAR` and `FARTHER` through two
(#1629). The cell is occupied where the label is written as its value.

## References

- [MISRA-C Rule 16 Switch statements](https://hackmd.io/@IloveFSF/Hk9S6LNjK)
- [MISRA C:2023 Rule 16.1 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule16.1.html)
- [Rust match - Wildcard Pattern](https://www.slingacademy.com/article/avoiding-match-exhaustiveness-errors-with-the-wildcard-pattern/)
- [Rust #[non_exhaustive] RFC](https://rust-lang.github.io/rfcs/2008-non-exhaustive.html)
- [SPARK for MISRA C Developer - AdaCore](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/03_syntactic_guarantees.html)
- C switch statement
- Swift switch (no fallthrough by default)
