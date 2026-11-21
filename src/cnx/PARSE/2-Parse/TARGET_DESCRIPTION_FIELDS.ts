/**
 * ADR-049: the target description schema, version 1.
 *
 * Typed over every key of `ITargetDescription`, so tsc refuses a field this
 * table forgets, and the validator refuses a catalog whose `struct
 * TargetDescription` disagrees with it. The allowed values are the ADR's.
 */
import type ITargetDescription from "../../types/ITargetDescription";
import type ITargetFieldSpec from "./types/ITargetFieldSpec";

const TARGET_DESCRIPTION_FIELDS: {
  readonly [K in keyof ITargetDescription]-?: ITargetFieldSpec;
} = {
  name: { kind: "string", optional: false },
  word_size: { kind: "unsigned", optional: false, allowed: [8, 16, 32, 64] },
  ldrex_strex: { kind: "boolean", optional: false },
  basepri: { kind: "boolean", optional: false },
  interrupt_mask: { kind: "boolean", optional: false },
  char_bits: { kind: "unsigned", optional: false, allowed: [8] },
  char_signed: { kind: "boolean", optional: false },
  short_bits: { kind: "unsigned", optional: false, allowed: [16] },
  int_bits: { kind: "unsigned", optional: false, allowed: [16, 32] },
  long_bits: { kind: "unsigned", optional: false, allowed: [32, 64] },
  long_long_bits: { kind: "unsigned", optional: false, allowed: [64] },
  size_t_bits: { kind: "unsigned", optional: false, allowed: [16, 32, 64] },
  pointer_bits: { kind: "unsigned", optional: false, allowed: [16, 32, 64] },
  float_bits: { kind: "unsigned", optional: false, allowed: [32] },
  double_bits: { kind: "unsigned", optional: false, allowed: [32, 64] },
  long_double_bits: {
    kind: "unsigned",
    optional: false,
    allowed: [32, 64, 96, 128],
  },
  big_endian: { kind: "boolean", optional: false },
  short_enums: { kind: "boolean", optional: false },
  external_identifier_chars: { kind: "unsigned", optional: false, min: 6 },
  internal_identifier_chars: { kind: "unsigned", optional: false, min: 31 },
  toolchain_triple: { kind: "string", optional: true },
  toolchain_cpu: { kind: "string", optional: true },
};

export default TARGET_DESCRIPTION_FIELDS;
