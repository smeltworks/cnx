# ADR-024: Type Casting

## Status

**Implemented**

## Context

Type casting in C is a major source of bugs and security vulnerabilities. CNX takes a strict approach: **widening is safe, narrowing is dangerous**.

### The Problem with C Casts

```c
uint32_t large = 1000;
uint8_t byte = (uint8_t)large;  // Silently truncates to 232!

int32_t signed_val = -5;
uint32_t unsigned_val = (uint32_t)signed_val;  // Becomes 4294967291!
```

These silent data losses cause real security vulnerabilities.

---

## Research: Casting Bugs and Vulnerabilities

### CWE Classifications

| CWE                                                        | Name                                       | Description                                           |
| ---------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| [CWE-681](https://cwe.mitre.org/data/definitions/681.html) | Incorrect Conversion between Numeric Types | Converting a value to a type that cannot represent it |
| [CWE-195](https://cwe.mitre.org/data/definitions/195.html) | Signed to Unsigned Conversion Error        | Negative values become large positive values          |
| [CWE-196](https://cwe.mitre.org/data/definitions/196.html) | Unsigned to Signed Conversion Error        | Large values become negative                          |

### Real-World Vulnerabilities

**CVE-2025-30646 (Juniper Networks):** A signed-to-unsigned conversion error in the Layer 2 Control Protocol daemon allowed unauthenticated attackers to crash and restart the l2cpd process via malformed LLDP packets.

**SSHD Casting Vulnerability:** Port was defined as signed int but `sin_port` was unsigned short. Negative values subverted error checks while still assigning privileged ports below 1024.

**Dell BIOS (DSA-2023-176):** Signed-to-unsigned conversion error could be exploited to compromise the system.

> "It is dangerous to rely on implicit casts between signed and unsigned numbers because the result can take on an unexpected value and violate assumptions made by the program."
> — [CWE-195](https://cwe.mitre.org/data/definitions/195.html)

### Buffer Overflow via Truncation

> "If a variable like `numHeaders` is defined as a signed int, it could be negative. If the incoming packet specifies a value such as -3, then the malloc calculation will generate a negative number. When converted to `size_t`, this produces a large value like 4294966996, potentially leading to a buffer overflow."
> — [InformIT: Type Conversion Vulnerabilities](https://www.informit.com/articles/article.aspx?p=686170&seqNum=6)

### MISRA C Guidelines

MISRA C has extensive rules about type conversions:

- **Rule 10.3**: "The value of an expression shall not be assigned to an object with a narrower essential type or of a different essential type category"
- **Rule 10.4**: "Both operands of an operator shall have the same essential type category"
- **Rule 10.5**: Avoid casting non-Boolean values to Boolean

> "ISO C may be considered to exhibit poor type safety as it permits a wide range of implicit type conversions to take place. These type conversions can compromise safety."
> — [SPARK for the MISRA C Developer](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)

---

## Decision

CNX eliminates dangerous casts by design:

1. **Widening conversions**: Implicit for a **value**; a **composite expression**
   requires an explicit cast (see the correction below)
2. **Narrowing conversions**: **Compiler error** - use bit indexing instead
3. **Signed/unsigned conversions**: **Compiler error** - be explicit about intent

### Correction: widening a composite expression is not safe

> **This corrects the original decision, which stated widening is implicit in all
> cases. Raised in #1152.**

The original rationale is _"widening never loses data"_. That is true of a
**value** conversion and false of a **composite expression**:

```cnx
u8 a <- 250;
u8 b <- 250;
u16 wide <- a + b;    // 500? No -- a + b is computed at u8 width first
```

`a + b` is an operation between two `u8` operands, so it is evaluated at `u8`
width and has already lost data **before** the widening happens. Widening the
result cannot recover it. The ADR proved the claim for values and then applied
the conclusion to expressions, where it does not hold.

This is exactly what **MISRA C:2012 Rule 10.8** prohibits: _"The value of a
composite expression shall not be cast to a different essential type category or
a wider essential type."_ cnx already claims to address Rule 10.8;
`docs/misra-compliance.md` lists it as **Not Enforced**, and #846 reports 37
violations in generated output. So the original decision is in conflict with a
rule the project has already committed to, not merely with a preference.

**Corrected rule:**

| conversion                                             | status                     |
| ------------------------------------------------------ | -------------------------- |
| widening a **value** (`u8 x; u16 y <- x`)              | implicit, unchanged        |
| widening a **composite expression** (`u16 y <- a + b`) | **explicit cast required** |

The two intents then have two distinct spellings, and neither is silent:

```cnx
u16 narrow <- (u16)(a + b);      // add at u8 (saturating), then widen  -> 255
u16 full   <- (u16)a + (u16)b;   // widen operands, then add at u16     -> 500
```

This composes with `clamp` (ADR-044): once arithmetic on a `clamp` type
saturates (#1152), `a + b` yields 255 rather than a wrapped 244, so the first
spelling is both safe and predictable.

**Same-category widening of a composite is included.** The statement below that
_"same-category widening stays implicit"_ holds for a value operand; for a
composite expression it is superseded by this correction, because the loss
occurs in the operation rather than in the conversion.

### Widening Conversions (Implicit, Safe)

Widening never loses data, so it's allowed implicitly:

```cnx
u8 byte <- 42;
u32 wide <- byte;      // OK: u8 → u32 is safe (implicit)
i16 small <- 100;
i32 large <- small;    // OK: i16 → i32 is safe (implicit)
```

**Generated C:**

```c
uint8_t byte = 42;
uint32_t wide = byte;      // Implicit widening
int16_t small = 100;
int32_t large = small;     // Implicit widening
```

### Narrowing Conversions (Error - Use Bit Indexing)

Narrowing can lose data, so CNX **forbids casts** and requires **bit indexing** instead:

```cnx
u32 large <- 1000;
u8 byte <- (u8)large;      // ERROR: Narrowing cast forbidden

// Instead, use bit indexing to be explicit about which bits you want:
u8 lowByte <- large[0, 8];    // Take bits 0-7 (least significant byte)
u8 highByte <- large[24, 8];  // Take bits 24-31 (most significant byte)
```

**Why bit indexing?**

- **Explicit**: Developer states exactly which bits are kept
- **Intentional**: No accidental truncation
- **Self-documenting**: `large[0, 8]` clearly means "low 8 bits"

**Generated C:**

```c
uint32_t large = 1000;
uint8_t lowByte = (large >> 0) & 0xFF;   // Bits 0-7
uint8_t highByte = (large >> 24) & 0xFF; // Bits 24-31
```

### Signed/Unsigned Conversions (Error)

Converting between signed and unsigned is dangerous:

```cnx
i32 signed_val <- -5;
u32 unsigned_val <- (u32)signed_val;  // ERROR: Sign conversion forbidden

u32 large_unsigned <- 4000000000;
i32 as_signed <- (i32)large_unsigned; // ERROR: Sign conversion forbidden
```

If you truly need this conversion, use bit indexing to acknowledge the risk:

```cnx
i32 signed_val <- -5;
u32 as_bits <- signed_val[0, 32];  // Explicit: treat as 32 bits
```

### Operand Type Categories (Rule 10.4)

The same essential-type-category discipline applies to the **operands of a binary operator**, not only to casts and assignments. Per MISRA C:2012 **Rule 10.4** ("Both operands of an operator shall have the same essential type category"), combining a signed and an unsigned value with a single operator is a **compile error** (Issue #1091):

```cnx
u32 a <- 1;
i32 b <- 2;
u32 c <- a + b;       // ERROR: mixed essential type category (u32 + i32)
bool ok <- (a = b);   // ERROR: mixed essential type category in a comparison
```

To combine values of different categories, reinterpret one operand's bits to the other's category with **bit indexing** (ADR-007) — the same mechanism used for the sign conversions above — so the reinterpretation is explicit:

```cnx
u32 c <- a + b[0, 32];   // OK: b reinterpreted as 32 unsigned bits, then added
```

**Unsuffixed integer literals are exempt.** A bare integer literal has no fixed essential category; it is contextually typed to the other operand (ADR-052), so `a + 5` generates `a + 5U` (the literal adopts `a`'s category) and never trips Rule 10.4. _(2026-09-26, #1668: "integer literals" narrowed to **unsuffixed** ones, by owner ruling; see the suffixed-literal paragraph below.)_ The rule fires only when **both** operands resolve to concrete, fixed-width types of different category (variable + variable, struct field, array element, function-call result, …).

**Same-category widening stays implicit** — `u8 + u32` combines two unsigned values and needs no cast (only the width widens, the category is unchanged).

**Integer and floating are different categories** (owner ruling, 2026-09-26, #1668). Rule 10.4's categories are signed, unsigned and floating, so combining an integer with a floating value is the same compile error as a signed/unsigned mix, in arithmetic and in a comparison alike:

```cnx
u32 i <- 3;
f32 k <- 2.5;
f32 x <- i * k;       // ERROR: mixed essential type category (u32 * f32)
f32 y <- i * 2.5;     // ERROR: a float literal is floating
bool b <- (i < 2.5);  // ERROR: in a comparison too
```

To combine them, convert the integer with an explicit cast. The conversion is then written where it happens, and the arithmetic is floating:

```cnx
f32 x <- (f32)i * k;     // OK
f32 y <- (f32)i * 2.5;   // OK: 7.5
```

**A float literal is not exempt.** The exemption above rests on an integer literal adopting the other operand's category, and no integer operand can adopt a float literal, so `i * 2.5` mixes unsigned with floating. An integer literal beside a floating operand stays exempt: `k * 3` is floating arithmetic.

Until this ruling the mix was accepted, and it computed the wrong value. The integer operand selected integer saturating arithmetic (ADR-044), which converted the float operand to the integer type before multiplying, so `u32` 3 × 2.5 evaluated to 6.0.

**The categories are MISRA C:2012 Rule 10.4's essential type categories** (owner ruling, 2026-09-26, #1668: "follow misra 10.4"): signed, unsigned, floating, Boolean, character, and **each named enum type as a category of its own**. They apply to cnx types and to C and C++ header types alike. MISRA's exception is kept: `+` and `+<-` may combine a character operand with a signed or unsigned one.

```cnx
u32 a <- 1;
EColor c <- EColor.RED;
u32 x <- a + c;        // ERROR: unsigned and enum EColor
```

**A character literal is essentially character** (owner ruling, 2026-09-26, #1668: strict MISRA). Unlike an unsuffixed integer literal it is not contextually typed, so comparing it with an integer, or combining the two with any operator but `+`, is the mix. Cast the literal to say which is meant:

```cnx
// with u8 ch, u8 digit, u32 a
bool x <- ch = 'A';        // ERROR: unsigned and character
bool y <- ch = (u8)'A';    // OK: both unsigned
u8 d <- (u8)'0' + digit;   // OK
u32 e <- a + 'A';          // OK: MISRA's + exception
```

**An exempt character and integer pair is essentially character** (owner ruling, 2026-09-28, in the #1760 review; MISRA C:2012 Appendix D.7). The pair's result carries the character category into the rest of the expression. A later operand of either signedness is therefore exempt beside it, so `u32 a + 'A' + i32 s` is legal under Rule 10.4. Its value is the exact sum, converted into the destination once, under the destination's ADR-044 overflow behavior (owner ruling, 2026-09-28). With `a = 3` and `s = -100`, a `u32` destination under clamp holds 0. cnx does not compute that yet: it saturates in the first operand's type. This is tracked as #1809.

A comparison with an enum operand is ADR-017's question, and is reported once, as ADR-017's diagnostic.

**A suffixed integer literal takes its suffix's category and width** (owner ruling, 2026-09-26, #1668). A suffix fixes the literal's type, so it is not contextually typed:

```cnx
u32 a <- 1;
i32 s <- 1;
u32 x <- a + 5i32;     // ERROR: unsigned and signed, in either operand order
i32 y <- s + 5i32;     // OK: both signed
```

**A conditional's two value operands are compared with each other** (owner ruling, 2026-09-26, #1668). Rule 10.4 covers the second and third operands of `?:`. The condition is not an operand, so a signed value in the condition alone does not trip the rule:

```cnx
// with u32 i, u32 j, f32 k, i32 s
f32 z <- (s > 0) ? i : k;   // ERROR: u32 and f32 arms
u32 w <- (s > 0) ? i : j;   // OK: both arms unsigned; s appears only in the condition
```

**An operand's category is its declared type, however the operand is reached** (owner ruling, 2026-09-26, #1668, which folds in #1092's first item). That covers:

- a variable and a scope member;
- a struct field and an array element;
- a function result, including a member of that result (`get().v`) and the result of an ADR-029 callback (`s.fn()`);
- a cast, whose category is the type it names;
- the value arms of a ternary, but never its condition;
- a variable, struct field or function declared in a C or C++ header. Its category comes from its C type, following typedefs such as `float32_t`: signed and unsigned integers, `float` and `double`, `_Bool`, plain `char`, and a named C enum. Its width comes from a fixed-width name (`uint16_t`, `int32_t`, …), or, for `short`, `int`, `long`, `long long`, `size_t`, `ptrdiff_t` and `intptr_t`, from the program's target description (ADR-049). `int_fastN_t` and `intmax_t` are integers of unknown width. A pointer is not an integer operand. Three such operands are not typed yet; see below. _(Widened 2026-09-26, #1668, by owner ruling, from "when its type is floating".)_

A subscript into a scalar is a bit index and has no declared type, so the bit-indexed reinterpretation `b[0, 32]` stays exempt. That includes a subscript of a C header scalar integer. An array or pointer keeps element access. Each of these used to contribute no category, so `u32 + p.offset` (a signed field) compiled, and `u8 x <- arr[0] * 2.5` was rejected only by accident, as a `u32` narrowing.

**What is an operand of the operator, for this rule** (consequences of the rulings above, #1668; none is a new decision):

- A comparison or a `!` is one Boolean operand, whatever it compares. Its own operands are not operands of the enclosing operator, so with `u32 a, b` and `i32 c, d`, `(a < b) = (c < d)` compares two Booleans and is not a signed/unsigned mix.
- A chain of comparisons is that, left to right, whether or not it is parenthesized (#1373): `a = b = c` is `(a = b) = c`, so with `u32 a, b` and `i32 c` it compares a Boolean with a signed value and is E0810. Under `<`, `>`, `<=` or `>=` the Boolean is Rule 10.1's, so `a < b < c` is E0807 as `(a < b) < c` is. A chain of Booleans, `p = q = r`, is legal.
- A shift's count is not an operand of the shift. `a << s` has `a`'s category whatever `s`'s is, because Rule 10.4 does not govern a shift (the count is promoted on its own).
- A register member has its declared category, as a variable does. A bitmap field wider than one bit is unsigned, and a one-bit field is Boolean.
- A call to a C++ overload set whose candidates return different categories is not classified, because which candidate C++ chooses is not decided here. It is never taken into integer saturating arithmetic either, so `u * choose(y)` is computed in the category of the candidate C++ picks.

**A header macro is typed from its replacement tokens** _(owner ruling 2026-10-04, #1688)_. An object-like macro named as an operand is read as the preprocessor will expand it, following the macros it names: The macros a file sees are the ones C sees for it: the preprocessor's macro dump (`-dM`) of that file's C includes, system headers and compiler builtins included _(owner ruling 2026-10-05)_, so `M_PI` and `FLT_EPSILON` are read as a local header's macro is, and another file's includes do not reach it.

- **Floating:** a floating literal anywhere in an expansion that holds no cast, call or other unreadable part, such as `2.5f`, `(2.5)`, `1e3` or `(VREF / 4096.0)`. Combined with an integer it is E0810, as any integer and floating mix is, so `u32 i * SCALE_F` with `#define SCALE_F 2.5f` is rejected. Its type is C's: `float` when every floating literal in it is `f`-suffixed, `long double` (which cnx does not name) when any is `L`-suffixed, `double` otherwise.
- **Integer:** only integer literals, arithmetic and bitwise operators, parentheses and other integer macros, such as `#define LIMIT 10`. It keeps the handling it had, an unsuffixed literal's, ADR-044 clamping included.
- **Character:** a character constant alone, parenthesized or not, such as `#define DELIM ','`, is typed as the same constant written inline, category character _(owner ruling 2026-10-05)_. Mixed with anything else it is unreadable.
- **Unreadable:** anything else, such as a call, a cast, a pointer dereference like avr-libc's `PINB`, or a name no header defines. A cast or call decides the type whatever it holds _(owner ruling 2026-10-05)_, so `((uint16_t)(F_CPU / 1000.0))` is unreadable, not floating. Combined with an integer it asks for a cast, `(u32)M` or `(f32)M` _(owner ruling 2026-10-05)_: E0811 for `+ - *` and their compound assignments, which would hand it to an integer clamp helper untyped, and E0812 for every other operator E0810 covers, `/` and `%` included, and a conditional's value arms, where C's usual arithmetic conversions decide the result from a type cnx cannot see (an unsigned `3 < -1` is true, and `3U / -1` is 0) _(owner ruling 2026-10-05)_. Beside any other operand it is left to C, as before.

Including a header is not an error by itself. A name the preprocessor does not define for the file is not a macro here and stays untyped. When a file's C includes were not all read -- the preprocessor cannot read them together -- a name nothing declares may be a macro of any type, so it is unreadable _(owner ruling 2026-10-05)_; a name a header declares keeps its declaration's type. Whether a macro that dereferences a pointer should be rejected outright is a separate question, not decided here.

**Three header operands are not typed yet.** Each has a declared C type, so each is an operand with a category under the ruling above. cnx does not read that type yet, so an integer combined with one that is floating is not rejected:

- an element of a C pointer: `u32 i * fp[0]`, with `extern float *fp;`;
- a variable whose type is a typedef declared in a C++ header: `i * r`, with `typedef float real_t; extern real_t r;` in a `.hpp`. The same typedef in a C header is typed;
- a static data member of a C++ class: `i * K.sf`. An instance member is typed.

This narrows the header bullet above to what is enforced today. The three shapes are tracked as #1788, which the owner deferred in #1760's review.

#### Compound assignment is the same operator

Owner ruling, 2026-09-26 (#1668). The section above spoke of binary operators and was silent on compound assignment, which compiled a signed/unsigned mix too. A compound assignment (`+<-`, `-<-`, `*<-`, `/<-`, `%<-`, `&<-`, `|<-`, `^<-`) combines its target and its value with the operator it names, so Rule 10.4 compares the target's category with the value's. `y *<- 2.5` is `y <- y * 2.5`, and `y +<- b` is `y <- y + b`:

```cnx
u32 y <- 3;
i32 b <- 2;
y *<- 2.5;   // ERROR: unsigned target, floating value
y +<- b;     // ERROR: unsigned target, signed value
y +<- 1;     // OK: an integer literal is exempt
```

The shift compounds (`<<<-`, `>><-`) are not covered, because Rule 10.4 does not govern a shift: its count is promoted independently of the value shifted. A plain assignment (`<-`) combines nothing. What it may convert is Rule 10.3's question, under _Where a conversion is checked_ below.

### Boolean Extraction (Use Bit Indexing)

In C, you might write:

```c
bool bit = (bool)((flags >> 3) & 1);
```

In CNX, use the bit indexing syntax (ADR-007):

```cnx
bool bit <- flags[3];  // Much cleaner!
```

---

## What CNX Does NOT Support

### No Pointer/Address Casts

CNX does not support casting integers to pointers or vice versa:

```cnx
u32 rawAddr <- 0x40000000;
volatile u32 reg <- (volatile u32)rawAddr;  // NOT SUPPORTED
```

**Why?** For hardware register access, use the `register` keyword (ADR-004):

```cnx
register GPIO @ 0x40000000 {
    DR: u32 rw @ 0x00,
}

GPIO.DR <- 0xFF;  // Safe, typed register access
```

### Float to Integer Casts (Truncation)

Casting a float to an integer **truncates** the value (discards the fractional part):

```cnx
f32 floatVal <- 3.14;
u32 truncated <- (u32)floatVal;  // OK: truncated = 3 (fractional part discarded)

// Combine with bit indexing to extract bits from the integer value:
f32 temp <- 25.7;
u8 lowByte <- ((u32)temp)[0, 8];  // Truncates to 25, extracts low 8 bits → 25
```

**A float reaches an integer only through that cast.** Without it the
conversion is E0891, at every position a value lands in an integer (owner
ruling, 2026-09-28, #1760 review: _"all positions now"_):

- a declaration's initializer, a `for` header's included;
- an assignment;
- an argument to an integer parameter;
- a return value from a function returning an integer;
- a struct field's initializer;
- an array element, in a list or a fill.

`u32 b <- k;`, `u32 c <- k + 1.0;`, `d <- k;`, `take(k)` and `return k;` are all
errors, and so is a floating ternary or a call returning a float. The value is
asked of every leaf, so a composite that is floating counts.
Owner ruling, 2026-09-28 (#1800): _"this should be a compiler error with an
explicit cast"_. Until then the implicit form was accepted, and it was emitted
as C's own conversion, which is undefined for NaN and for a value past the
target's range. The cast truncates and then clamps to the range (ADR-056).

**A string lands in no scalar, at the same positions.** A string literal or
a `string<N>` value (ADR-045) has no conversion to an integer, a float, a bool,
an enum or a bitmap, cast or not, so `u32 g <- "hello";`, `x <- s;`,
`take("arg")`, `return "r";` from a `u32` function, `bool b <- "flag";`,
`EColor c <- "RED";`, `Flags f <- "x";` and `a[0] <- s;` into a `u8[4]` are
E0914 (#1739). What lands is the value, the value it parenthesizes and each arm
of a ternary, so `u32 x <- (a = 1) ? "x" : "y";` is E0914 too. Until then each was accepted at exit 0 and emitted as C's
pointer-to-integer conversion. A whole `u8` array is no such position, so
ADR-035's `u8[] buf <- "abc";` stands.

**Note:** This is truncation, NOT bit reinterpretation. For raw IEEE-754 byte access, use float bit indexing (ADR-007):

```cnx
f32 floatVal <- 3.14;
u8 rawByte <- floatVal[0, 8];  // Raw IEEE-754 byte (NOT truncation)
```

### No Pointer/Reinterpret Casts

CNX does not support:

- Casting integers to pointers (use `register` keyword instead - ADR-004)
- Reinterpreting memory as a different type (for raw float bytes, use float bit indexing - ADR-007)

---

## Summary of Cast Rules

| Conversion              | CNX Behavior                             | Rationale                     |
| ----------------------- | ---------------------------------------- | ----------------------------- |
| u8 → u32 (widen)        | Implicit                                 | No data loss possible         |
| i8 → i32 (widen)        | Implicit                                 | No data loss possible         |
| u32 → u8 (narrow)       | **Error** - use `val[0, 8]`              | Potential data loss           |
| i32 → u32 (sign change) | **Error** - use `val[0, 32]`             | Sign semantics change         |
| u32 → i32 (sign change) | **Error** - use `val[0, 32]`             | Sign semantics change         |
| f32 → u32 (truncate)    | Supported - `(u32)floatVal`              | Truncates fractional part     |
| f32 → u32 (no cast)     | **Error** (E0891) - `(u32)floatVal`      | Only the cast is defined      |
| u32 × f32 (mixed)       | **Error** - use `(f32)intVal * floatVal` | Rule 10.4 category mix        |
| f32 → u32 (reinterpret) | Use float bit indexing `floatVal[0, 32]` | Raw IEEE-754 access (ADR-007) |
| int → pointer           | **Not supported**                        | Use `register` (ADR-004)      |

### Where a conversion is checked

**Wherever a value meets a typed target**, and the target is the one the value
actually lands in — not the variable its name starts with. Every position
in E0868's and E0869's position tables below -- a declaration's initializer, an
assignment (to a variable, an element or a field), a compound assignment, a
return value, a call argument, an array element initializer, a struct field
initializer and either arm of a ternary -- and a cast are all conversions, all
checked the same way.

**Every program names a target (ADR-049)**, and every platform-dependent width in this ADR is read from it. A suffixed literal is typed by its suffix, so `u8 x <- 300u16` is a narrowing. A header integer of unknown width never selects saturating arithmetic (ADR-044).

**A composite source (`a + b`) is typed** — category from the first integer
operand, width from the widest — in every position except a cast, where writing
`(u8)(a + b)` is the author stating the width they mean.

**The source is typed as an operand is** (#1668). A call's result, an
ADR-029 callback's result, and `-x` or `~x` (the type of `x`) are checked like
a variable: with a `u32 get()` and a `u32 w`, `u8 n <- get();` and
`u8 m <- ~w;` both narrow.

**A composite with a floating operand is not an integer composite** (#1668). It
is floating arithmetic, so integer saturation (ADR-044) never applies to it, and
it has no integer width to check. Rule 10.4 above rejects the mix wherever the
float's type is known, so what this sentence still decides is an operand the
program states no type for, such as a header's float macro (#1688).

Two exceptions to that were live until #1322 and are recorded because the code
they permitted is the code this decision exists to reject:

- a composite was typed on a declaration and not on an assignment, so
  `u8 s <- large + 1;` was rejected while `t <- large + 1;` was accepted;
- an assignment was checked against the ROOT name's declared type, so
  `c.col <- wide` — a `u32` into a `u8` field — was never checked at all,
  because `c` is a struct. It emitted `c.col = wide;`.

Until #1618 the integer rules (E0868, E0869) were checked at only four of the
positions a value lands in -- a declaration's initializer, an assignment, and
an element or field reached through an assignment's chain -- while E0891 was
checked at all of them. These all accepted a `u64 wide` into a `u32`:

- a compound assignment, `a +<- wide`, which lands `a + wide`;
- a return value, `return wide;` in a `u32` function;
- an argument, `take(wide)`, direct or through a callback field
  (`h.handler(wide)`);
- an array element, listed or filled: `[wide, 0]`, `[wide*]`;
- a struct field's initializer, `{ x: wide }`;
- either arm of a ternary, `(c = 1) ? wide : 0`.

A C function's result (`global.cWide()`) leaked at the return and the
argument the same way. Each position is now asked the type its position gives
the value, the one question E0891 already asked, so the three rules are
checked at the same places. The bit extraction (`wide[0, 32]`) stays silent at
every one.

---

## Implementation Notes

### Grammar Changes

Casts are primarily removed from the language. Bit indexing (ADR-007) handles narrowing:

```antlr
// No cast expression needed - widening is implicit
// Narrowing uses existing bit indexing: expr '[' start ',' width ']'
```

### Conversion Handling

1. Detect widening conversions → generate implicit C conversion
2. Detect narrowing conversions → emit compiler error with suggestion
3. Detect sign conversions → emit compiler error with suggestion

### Error Messages

| Code  | Meaning                                                                                        | Fixtures                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| E0810 | Operands of different essential type categories, under one operator or in a conditional's arms | `tests/adr-024/category-*-error`, `tests/bugs/issue-1668-int-float-clamp/`                           |
| E0811 | An integer combined by `+`, `-` or `*` with a header macro whose type cnx cannot read          | `tests/adr-024/category-*-error`, `tests/bugs/issue-1688-float-macro/unreadable-macro-error`         |
| E0812 | An integer combined with such a macro by any other operator E0810 covers, or in a conditional  | `tests/adr-024/category-*-error`, `tests/bugs/issue-1688-float-macro/unreadable-macro-error`         |
| E0868 | An integer literal does not fit its target's range                                             | `tests/adr-024/literal-*-error`                                                                      |
| E0869 | An implicit narrowing or sign-changing integer conversion, a cast included                     | `tests/adr-024/conversion-*-error`, `narrowing-*-error`, `sign-*-error`, `composite-narrowing-error` |
| E0891 | An implicit conversion from a floating value to an integer                                     | `tests/adr-024/float-*-error`                                                                        |

```
ERROR: Cannot narrow u32 to u8 (potential data loss)
  --> src/main.cnx:10:5
   |
10 | u8 byte <- (u8)large;
   |            ^^^^^^^^^
   |
   = help: Use bit indexing to specify which bits: large[0, 8]
```

```
ERROR: Cannot convert i32 to u32 (sign change)
  --> src/main.cnx:15:5
   |
15 | u32 x <- (u32)signed_val;
   |          ^^^^^^^^^^^^^^^
   |
   = help: Use bit indexing to reinterpret: signed_val[0, 32]
```

---

## Trade-offs

### Advantages

1. **No silent truncation** - Data loss is impossible without explicit bit indexing
2. **No sign conversion bugs** - Signed/unsigned confusion eliminated
3. **Self-documenting** - `large[0, 8]` is clearer than `(u8)large`
4. **MISRA compliant** - Satisfies Rules 10.3, 10.4, 10.5
5. **Security** - Eliminates entire classes of vulnerabilities (CWE-195, CWE-196, CWE-681)

### Disadvantages

1. **More verbose** - `large[0, 8]` vs `(u8)large`
2. **Learning curve** - C programmers expect casts to work
3. **Migration effort** - Existing C patterns need rewriting

---

## Success Criteria

1. Widening conversions (u8 → u32, etc.) work implicitly
2. Narrowing conversions produce compiler error with helpful message
3. Sign conversions produce compiler error with helpful message
4. Bit indexing provides explicit alternative for all narrowing needs
5. No pointer/address casts supported (use ADR-004 registers)

---

## Scope-context matrix

Declared for the integer-conversion rules #1322 moved out of codegen: a literal
must fit its target's range, and a non-literal integer source must be neither
wider than its target nor of the other signedness -- whether it reaches the
target through a declaration, an assignment, or a cast.

<!-- MATRIX-SEVERITY code: E0810 -->

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

<!-- MATRIX-SEVERITY code: E0811 -->

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

<!-- MATRIX-SEVERITY code: E0812 -->

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

<!-- MATRIX-SEVERITY code: E0868 -->

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

<!-- MATRIX-SEVERITY code: E0869 -->

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

<!-- MATRIX-SEVERITY code: E0891 -->

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

A conversion happens wherever a value meets a typed target, so it reaches an
initializer as well as a function body -- all four same-file contexts. The two
scope contexts are where the rule had been SILENT: `u8 narrow <- this.wide;`
inside a scope was accepted while the identical line at top level was not, and
no fixture depended on that, so it is closed rather than reproduced.

A `for` header's declaration is a declaration too, so its initializer is a
typed target like any other: a literal past the loop variable's range, a
wider or other-signedness integer, a float without a cast, and an operator
mixing categories or naming an unreadable header macro are each rejected
there, whether the source is declared in the same file or one or two
includes away. Every `for header` cell is `error`, and each is occupied by a
fixture that asserts it beside a silent control.

The scope contexts reach an included file too (#1668). A scope member or
method narrowing a value declared in another file is the same conversion as
at file scope, whichever way the scope names the value: a file-scope source, a
member of another scope written `Other.wide`, or `this.x` in a scope reopened
in another file. All four cells are `error`, and each is occupied by a fixture
that asserts it and keeps a wide-enough target beside it as a control.

The imported columns matter because the rule asks the SOURCE's type, and the
source may be declared in another file. A check reading only the file in front
of it finds no type for it, and untyped never rejects -- the rule would go
quiet across an include rather than fail.

**Two divergences this section once recorded are closed.** A composite source
is checked on an assignment statement as it is on a declaration's initializer,
and an assignment is checked against the declared type of the variable or
field it writes, not its root's: with `u32 a, b`, `u8 g` and a `u8` field `f`,
both `g <- a + b` and `p.f <- a` are E0869 (narrowing).

### Positions (#1618)

A context cell says which declaration encloses a diagnostic, not which part of
the statement it reports. E0869 at `u32 a <- wide;` and silence at
`return wide;` in the same function both landed in `top-level function | same
file`, so the declaration's fixture greened the cell while every return leaked.
E0868 and E0869 therefore also declare a position table: each position a value
lands in must be reached by a fixture asserting that code, whatever context
the fixture is in.

A literal operand is checked as a lone literal is (owner ruling on #1618):
a value known at compile time that does not fit the target is E0868, and
ADR-044's clamp is for runtime values only. `u8 a +<- 300` and
`a <- a + 300` are both rejected; `a +<- 255` is not. The operators beside a
literal decide what it must fit; ADR-044's _Compile time first_ lists them.

<!-- MATRIX-POSITION code: E0868 -->

| Position                  | Severity |
| ------------------------- | -------- |
| declaration initializer   | error    |
| assignment                | error    |
| array element assignment  | error    |
| struct field assignment   | error    |
| compound assignment       | error    |
| return statement          | error    |
| call argument             | error    |
| array element initializer | error    |
| struct field initializer  | error    |
| ternary branch            | error    |

<!-- MATRIX-POSITION code: E0869 -->

| Position                  | Severity |
| ------------------------- | -------- |
| declaration initializer   | error    |
| assignment                | error    |
| array element assignment  | error    |
| struct field assignment   | error    |
| compound assignment       | error    |
| return statement          | error    |
| call argument             | error    |
| array element initializer | error    |
| struct field initializer  | error    |
| ternary branch            | error    |

## References

### Vulnerability Research

- [CWE-681: Incorrect Conversion between Numeric Types](https://cwe.mitre.org/data/definitions/681.html)
- [CWE-195: Signed to Unsigned Conversion Error](https://cwe.mitre.org/data/definitions/195.html)
- [CWE-196: Unsigned to Signed Conversion Error](https://cwe.mitre.org/data/definitions/196.html)
- [InformIT: Type Conversion Vulnerabilities](https://www.informit.com/articles/article.aspx?p=686170&seqNum=6)
- [Feabhas: When Integers Go Bad](https://blog.feabhas.com/2014/10/vulnerabilities-in-c-when-integers-go-bad/)

### MISRA C Guidelines

- [SPARK for the MISRA C Developer: Enforcing Strong Typing](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/04_strong_typing.html)
- [PVS-Studio: V2572 - Narrowing Essential Type](https://pvs-studio.com/en/docs/warnings/v2572/)
- [MISRA C 2012 Rules Explained](https://www.codeant.ai/blogs/misra-c-2012-rules-examples-pdf)

### Related ADRs

- ADR-004: Register Bindings (for hardware access instead of pointer casts)
- ADR-007: Type-Aware Bit Indexing (for explicit bit extraction)
- ADR-044: Primitive Types (for overflow handling with clamp/wrap)
