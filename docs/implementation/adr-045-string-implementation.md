# ADR-045: Bounded String Implementation Plan

**Status:** Ready for Implementation
**ADR:** [ADR-045: Bounded String Type](../decisions/adr-045-string-type.md)
**Estimated Phases:** 4

---

## Overview

Implement `string<N>` bounded string type with compile-time safety guarantees:

- `string<64>` → `char[65]` (capacity + null terminator)
- No heap allocation, no buffer overflows
- Properties: `.value_char_count` (strlen), `.capacity` (compile-time N); length properties: ADR-058

---

## Phase 1: Core Type (MVP)

**Goal:** Basic `string<N>` declaration and initialization

### Grammar Changes

**File:** `grammar/Cnx.g4`

1. Add `stringType` rule after `type` rule (~line 427):

```antlr
stringType
    : 'string' '<' INTEGER_LITERAL '>'  // string<64>
    | 'string'                          // For const inference (Phase 2)
    ;
```

2. Add `stringType` to `type` rule:

```antlr
type
    : primitiveType
    | stringType           // ADD THIS
    | scopedType
    | qualifiedType
    | userType
    | arrayType
    | genericType
    | 'void'
    ;
```

3. Add STRING keyword (~line 536):

```antlr
STRING      : 'string';
```

4. Regenerate parser: `npm run antlr`

### CodeGenerator Changes

**File:** `src/codegen/CodeGenerator.ts`

1. **Extend TypeInfo interface** (~line 68):

```typescript
interface TypeInfo {
  // ... existing fields
  isString?: boolean;
  stringCapacity?: number; // The N in string<N>
}
```

2. **Add generateStringType method**:

```typescript
private generateStringType(ctx: Parser.StringTypeContext): {
    cType: string;
    capacity: number | null
} {
    const intLiteral = ctx.INTEGER_LITERAL();
    if (intLiteral) {
        const capacity = parseInt(intLiteral.getText(), 10);
        return { cType: 'char', capacity };
    }
    // Plain 'string' without capacity - needs inference
    return { cType: 'char', capacity: null };
}
```

3. **Update generateType method** to detect stringType:

```typescript
if (ctx.stringType()) {
  const { cType, capacity } = this.generateStringType(ctx.stringType()!);
  // Store capacity for later use
  return cType;
}
```

4. **Update generateVariableDeclaration**:

- Detect string type
- Generate `char name[N+1]` instead of `char name`
- Validate literal fits in capacity
- Add `#include <string.h>` tracking

5. **Add string literal validation**:

```typescript
private validateStringLiteral(literal: string, capacity: number): void {
    // Remove quotes from literal
    const content = literal.slice(1, -1);
    if (content.length > capacity) {
        throw new Error(
            `Error: String literal "${content}" (${content.length} chars) exceeds string<${capacity}> capacity`
        );
    }
}
```

### Tests

**Directory:** `tests/string/`

| File                        | Description                       |
| --------------------------- | --------------------------------- |
| `string-basic.cnx`          | `string<64> msg <- "Hello";`      |
| `string-empty.cnx`          | `string<64> buffer;` (empty init) |
| `string-error-overflow.cnx` | Literal exceeds capacity          |

### Success Criteria

- [ ] `string<5> s <- "Hello"` → `char s[6] = "Hello"`
- [ ] `string<64> buf;` → `char buf[65] = ""`
- [ ] Literal overflow is compile error
- [ ] `#include <string.h>` added when string used

---

## Phase 2: Properties

**Goal:** `.value_char_count` and `.capacity` property access (length properties: [ADR-058](../decisions/adr-058-explicit-length-properties.md))

### CodeGenerator Changes

1. **Update generatePostfixExpr** (~line 3147):

```typescript
if (memberName === "char_count") {
  const typeInfo = this.context.typeRegistry.get(primaryId);
  if (typeInfo?.isString) {
    result = `strlen(${primaryId})`;
    return result;
  }
  // ... existing array/integer handling
}

if (memberName === "capacity") {
  const typeInfo = this.context.typeRegistry.get(primaryId);
  if (typeInfo?.isString && typeInfo.stringCapacity) {
    result = String(typeInfo.stringCapacity);
    return result;
  }
}
```

### Tests

| File                    | Description                               |
| ----------------------- | ----------------------------------------- |
| `string-properties.cnx` | `.value_char_count` and `.capacity` usage |

### Success Criteria

- [ ] `msg.value_char_count` → `strlen(msg)`
- [ ] `msg.capacity` → compile-time constant N

---

## Phase 3: Read-only Inference

**Goal:** a read-only `string X <- "literal"` (no `mut`, ADR-071) auto-sizes

### CodeGenerator Changes

1. **Detect a read-only string without capacity**:

```typescript
if (isConst && isStringType && !hasCapacity && hasLiteral) {
  // Infer capacity from literal length
  const literal = getLiteralContent(initExpr);
  const inferredCapacity = literal.length;
  // Generate: const char X[N+1] = "literal"
}
```

2. **Error if no initializer**:

```typescript
if (isConst && isStringType && !hasCapacity && !hasLiteral) {
  throw new Error(
    "Error: const string requires initializer for capacity inference",
  );
}
```

### Tests

| File                             | Description                               |
| -------------------------------- | ----------------------------------------- |
| `string-const-inference.cnx`     | `string VERSION <- "1.0.0"`               |
| `string-error-const-no-init.cnx` | read-only `string X;` without initializer |

### Success Criteria

- [ ] `const string VERSION <- "1.0.0"` → `const char VERSION[6] = "1.0.0"`
- [ ] `const string X;` is compile error

---

## Phase 4: Operations

**Goal:** Concatenation, substring, and comparison

### 4.1 Comparison

Detect `==` and `!=` with string operands:

```typescript
// In generateEqualityExpr
if (leftIsString && rightIsString) {
  const cmpOp = isEquals ? "== 0" : "!= 0";
  return `strcmp(${leftCode}, ${rightCode}) ${cmpOp}`;
}
```

### 4.2 Concatenation

Detect `+` with string operands, validate capacity:

```typescript
// In generateAdditiveExpr or assignment handling
if (destCapacity < src1Capacity + src2Capacity) {
  throw new Error(
    `Error: Concatenation requires capacity ${src1Capacity + src2Capacity}, but destination has ${destCapacity}`,
  );
}

// Generate:
// char dest[N+1] = "";
// cnx_string_copy(dest, src1, NU);
// {
//     const uint32_t cnx_used = (uint32_t) strlen(dest);
//     cnx_string_copy(&dest[cnx_used], src2, NU - cnx_used);
// }
```

### 4.3 Substring

Detect `string[start, len]` pattern:

```typescript
// In generatePostfixExpr for subscript
if (typeInfo?.isString && hasStartAndLength) {
  // Validate bounds
  if (start + length > capacity) {
    throw new Error(
      `Error: Substring [${start},${length}] exceeds capacity ${capacity}`,
    );
  }
  // Generate: cnx_string_copy(dest, src + start, lengthU);
}
```

### Tests

| File                                | Description           |
| ----------------------------------- | --------------------- |
| `string-compare.cnx`                | `a = b`, `a != b`     |
| `string-concat.cnx`                 | `result <- a + b`     |
| `string-substring.cnx`              | `sub <- s[0, 5]`      |
| `string-error-concat-overflow.cnx`  | Capacity insufficient |
| `string-error-substring-bounds.cnx` | Out of bounds         |

### Success Criteria

- [ ] `a = b` → `strcmp(a, b) == 0`
- [ ] `a != b` → `strcmp(a, b) != 0`
- [ ] `a + b` with capacity validation
- [ ] `s[0, 5]` substring extraction
- [ ] Capacity/bounds errors are compile errors

---

## Documentation Updates

After all phases complete:

1. **ADR-045**: Change status to "Implemented"
2. **README.md**: Add Bounded Strings to Core Features
3. **learn-cnx-in-y-minutes.md**: Add string examples

---

## Reference: Generated C Patterns

### Declaration

```cnx
string<64> message <- "Hello";
```

→

```c
char message[65] = "Hello";
```

### Empty Declaration

```cnx
string<64> buffer;
```

→

```c
char buffer[65] = "";
```

### Properties

```cnx
u32 len <- message.value_char_count;
u32 cap <- message.capacity;
```

→

```c
uint32_t len = strlen(message);
uint32_t cap = 64;
```

### Read-Only by Default (ADR-071)

```cnx
string VERSION <- "1.0.0";
```

→

```c
const char VERSION[6] = "1.0.0";
```

### Comparison

```cnx
if (a = b) {}
```

→

```c
if (strcmp(a, b) == 0) { }
```

### Concatenation

```cnx
string<64> result <- a + b;
```

→

```c
char result[65] = "";
cnx_string_copy(result, a, 64U);
{
    const uint32_t cnx_used = (uint32_t) strlen(result);
    cnx_string_copy(&result[cnx_used], b, 64U - cnx_used);
}
```

### Substring

```cnx
string<5> hello <- source[0, 5];
```

→

```c
char hello[6] = "";
cnx_string_copy(hello, source + 0, 5U);
```

---

## Session Resume Instructions

When resuming this implementation:

1. Check which phase is complete by running tests: `npm test`
2. Look for `tests/string/` directory to see what's implemented
3. Read this file for next phase requirements
4. Follow the CodeGenerator patterns from existing features (switch, ternary)

---

## Complexity Notes

- **Phase 1**: Medium - new type system extension
- **Phase 2**: Low - property access pattern exists
- **Phase 3**: Low - const detection exists
- **Phase 4**: Medium-High - operator overloading for strings

Recommend completing Phases 1-3 in one session, Phase 4 in a separate session.
