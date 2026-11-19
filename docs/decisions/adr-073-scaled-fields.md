# ADR-073: Scaled Fields

**Status:** Research
**Date:** 2026-11-19
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-072 (Safe Hardware Abstraction — this was its Part 5; Part 4's data registers are the main consumer), ADR-034 (Bitmap Types), ADR-044 (Primitive Types)
**Related Issues:** #2449 (rulings 3 and 4)

## Context

A raw register or wire value often _means_ an engineering value. An ADC code is volts, an
on-die temperature reading is °C after a calibration scale and offset, and a J1939 signal is
`raw × resolution + offset` in a stated unit. Today the raw integer comes back and the caller
applies the formula by hand, which is the same magic-number-at-the-call-site problem that
registers exist to remove:

```cnx
u16 raw <- etc1.outputShaft;
f32 rpm <- raw * 0.125; // the resolution lives at every call site
```

The pattern is not J1939-specific. It covers MMIO (ADC, on-die temperature, DAC, timer
prescalers) as well as wire formats.

## Rejected: trailing scale keywords

ADR-072's 2026-07-04 revision proposed a trailing transform on the field:

```cnx
register Etc1 {
    1 ro u16 outputShaft divisor 8, // 0.125 rpm/bit
    3 ro u8 clutchSlip multiplier 0.4, // 0.4 %/bit
}
```

The owner rejected this syntax (ruling 3 on #2449): "the syntax doesn't work AT ALL … simply
adding a divisor requires a unit, it's no longer simply a number." A scaled value has a unit,
so the declaration has to carry one, and the form should be declarative. Ruling 4 moved
scaled fields out of ADR-072 into this ADR.

## Research

- **CAN DBC** describes a signal declaratively: factor, offset, range and unit.
  `SG_ EngineSpeed : 24|16@1+ (0.125,0) [0|8031.875] "rpm"`.
- **J1939 SPN definitions** give the resolution, offset, data range and unit per signal, and
  reserve the top values as not-available and error indicators (e.g. `0xFF`/`0xFE` for 8-bit).
- **Units as types:** F# units of measure, Rust `uom`, Ada (GNAT `Dimension_System`) and
  Boost.Units check units at compile time and erase them from the generated code.

## Open questions

- **Unit: checked type or label.** Whether a unit is part of the value's type (`rpm + %` is a
  compile error) or documentation only. A checked unit reaches beyond registers into
  variables, parameters and arithmetic.
- **Declaration syntax.** The declarative form that states the resolution, offset, unit and
  range of a field.
- **Read type.** How the storage type, resolution and offset map to the type a read returns.
- **Offset order.** `raw × scale + offset` (SAE/J1939) or `(raw − offset) × scale` (some
  sensor calibrations).
- **Writes.** Whether a scaled field can be written, and how a value outside its range is
  handled.
- **Validity.** Whether a field can declare not-available and error sentinels and read as a
  value-or-invalid result.
