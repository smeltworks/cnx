<!-- GENERATED FILE - DO NOT EDIT.
     Source: src/cnx/utils/constants/TOOLCHAIN_REQUIREMENTS.ts
     Regenerate: npm run docs:toolchain -->

# Toolchain compatibility

## Policy

cnx's toolchain requirements are **per-feature, not global**.

The baseline is C99 (C++11 with `--cpp`), and code that uses none of the
features below really does compile with any conforming compiler. Each
feature listed here adds a requirement _only to files that use it_: you pay
for CMSIS only if you write a critical section, and for C11 only if you index
the bits of a float.

This file is generated from the transpiler's own requirements registry, so it
cannot fall out of step with what the code generator emits. To see what _your_
project needs -- as opposed to what cnx might need -- transpile it: the
requirements are reported at the end of the run.

## Baseline

| transpile mode | language standard | compiler       | platform library |
| -------------- | ----------------- | -------------- | ---------------- |
| C (default)    | C99               | any conforming | none             |
| C++ (`--cpp`)  | C++11             | any conforming | none             |

## Conditional requirements

| feature                  | you pay it when                                                                                                                                         | mode   | language standard | compiler                                                | platform library                                              | emitted                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------- | ------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| float bit indexing       | reading or writing a bit range of an f32 or f64                                                                                                         | c      | C11               | any conforming                                          | none                                                          | `_Static_assert`                                                     |
| float bit indexing       | reading or writing a bit range of an f32 or f64 with --cpp                                                                                              | cpp    | C++11             | any conforming                                          | none                                                          | `static_assert`                                                      |
| interrupt masking        | a critical block, or an atomic read-modify-write on a target without LDREX/STREX, and `defined(__arm__) \|\| defined(__ARM_ARCH)`                       | c, cpp | C99               | `GNU inline assembly`, `__attribute__((always_inline))` | ARMv7-M core                                                  | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| interrupt masking        | a critical block, or an atomic read-modify-write on a target without LDREX/STREX, and `(defined(__arm__) \|\| defined(__ARM_ARCH)) && defined(ARDUINO)` | c, cpp | C99               | `GNU inline assembly`, `__attribute__((always_inline))` | ARMv7-M core + Arduino core                                   | `noInterrupts()`                                                     |
| interrupt masking        | a critical block, or an atomic read-modify-write on a target without LDREX/STREX, and `defined(__AVR__)`                                                | c, cpp | C99               | any conforming                                          | avr-libc                                                      | `SREG, cli()`                                                        |
| atomic read-modify-write | compound assignment to an atomic variable on a target with LDREX/STREX                                                                                  | c, cpp | C99               | any conforming                                          | CMSIS + ARMv7-M                                               | `__LDREXB/H/W, __STREXB/H/W`                                         |
| atomic read-modify-write | compound assignment to an atomic variable on a target without LDREX/STREX or interrupt masking                                                          | c, cpp | C99               | `GNU __atomic builtins`                                 | none                                                          | `__atomic_load(), __atomic_compare_exchange()`                       |
| atomic read-modify-write | compound assignment to an atomic variable wider than the target's word_size, on a target without LDREX/STREX or interrupt masking                       | c, cpp | C99               | `GNU __atomic builtins`                                 | libatomic (or the platform's \__atomic_\*\_N, e.g. ESP-IDF's) | `__atomic_load_N(), __atomic_compare_exchange_N() library calls`     |
| struct initializer       | initializing a struct in --cpp mode                                                                                                                     | cpp    | C++20             | `designated initializers in C++`                        | none                                                          | `.field = value inside a braced initializer`                         |
| struct initializer       | a non-declaration struct literal in --cpp mode                                                                                                          | cpp    | C++11             | `compound literals in C++`                              | none                                                          | `(T){ ... } in C++`                                                  |
| overflow panic (--debug) | transpiling with --debug and using clamp or wrap integer arithmetic                                                                                     | c, cpp | C99               | any conforming                                          | hosted libc                                                   | `fprintf(stderr, ...), abort()`                                      |

## Compiler version floors

**None.** No construct cnx emits has a minimum compiler version.

cnx previously required GCC 5+ / Clang 3.8+ wherever an unsigned `clamp`
helper was emitted, because those helpers called `__builtin_add_overflow` and
friends. Those calls were unreachable -- the preceding range check is already
a complete overflow test -- and were removed in #1143.

## Compiler extensions

These are not standard C or C++. GCC and Clang accept them; IAR, TI CGT,
Keil and MSVC may not.

| extension                                               | used by                  | emitted                                                              |
| ------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------- |
| `GNU inline assembly`, `__attribute__((always_inline))` | interrupt masking        | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| `GNU inline assembly`, `__attribute__((always_inline))` | interrupt masking        | `noInterrupts()`                                                     |
| `GNU __atomic builtins`                                 | atomic read-modify-write | `__atomic_load(), __atomic_compare_exchange()`                       |
| `GNU __atomic builtins`                                 | atomic read-modify-write | `__atomic_load_N(), __atomic_compare_exchange_N() library calls`     |
| `designated initializers in C++`                        | struct initializer       | `.field = value inside a braced initializer`                         |
| `compound literals in C++`                              | struct initializer       | `(T){ ... } in C++`                                                  |

## Platform libraries

| library                                                       | feature                  | selected when                                                     | emitted                                                              |
| ------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| ARMv7-M core                                                  | interrupt masking        | `defined(__arm__) \|\| defined(__ARM_ARCH)`                       | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| ARMv7-M core + Arduino core                                   | interrupt masking        | `(defined(__arm__) \|\| defined(__ARM_ARCH)) && defined(ARDUINO)` | `noInterrupts()`                                                     |
| avr-libc                                                      | interrupt masking        | `defined(__AVR__)`                                                | `SREG, cli()`                                                        |
| CMSIS + ARMv7-M                                               | atomic read-modify-write | always                                                            | `__LDREXB/H/W, __STREXB/H/W`                                         |
| libatomic (or the platform's \__atomic_\*\_N, e.g. ESP-IDF's) | atomic read-modify-write | always                                                            | `__atomic_load_N(), __atomic_compare_exchange_N() library calls`     |
| hosted libc                                                   | overflow panic (--debug) | always                                                            | `fprintf(stderr, ...), abort()`                                      |

## MISRA C:2012 guidelines affected

See [misra-compliance.md](misra-compliance.md) for the full assessment.

| guideline | features that bear on it                                        |
| --------- | --------------------------------------------------------------- |
| 1.1       | baseline, float bit indexing                                    |
| 1.2       | interrupt masking, atomic read-modify-write, struct initializer |
| 20.8      | interrupt masking                                               |
| 20.9      | interrupt masking                                               |
| 20.14     | interrupt masking                                               |
| 21.6      | overflow panic (--debug)                                        |
| 21.8      | overflow panic (--debug)                                        |
| Dir 4.3   | interrupt masking                                               |
| Dir 4.9   | interrupt masking, atomic read-modify-write                     |
