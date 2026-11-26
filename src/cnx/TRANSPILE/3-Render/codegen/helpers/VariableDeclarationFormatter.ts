/**
 * VariableDeclarationFormatter - Unified variable declaration string generation.
 *
 * Phase 2 of unified code generation: Provides a single source of truth for
 * variable declaration formatting, eliminating sync issues between
 * CodeGenerator and HeaderGeneratorUtils.
 *
 * Handles:
 * - Modifier ordering (extern const volatile)
 * - Type formatting with embedded dimensions (string<N> → char[N+1])
 * - Array dimension placement after variable name
 *
 * This class is STATELESS - all decisions are pre-computed in IVariableFormatInput.
 */

import ConstQualifier from "../../../../utils/ConstQualifier";
import type IVariableFormatInput from "../types/IVariableFormatInput";

/** Modifier flags for variable declarations */
type IVariableModifiers = IVariableFormatInput["modifiers"];

class VariableDeclarationFormatter {
  /**
   * Format a variable declaration string.
   *
   * @param input - Normalized variable declaration input (all decisions pre-computed)
   * @returns Formatted declaration string (e.g., "extern const uint32_t count")
   */
  static format(input: IVariableFormatInput): string {
    const modifierPrefix = VariableDeclarationFormatter.buildModifierPrefix({
      ...input.modifiers,
      isConst:
        input.modifiers.isConst && !ConstQualifier.isSpelled(input.mappedType),
    });
    const arrayDimsStr = VariableDeclarationFormatter.buildArrayDimensions(
      input.arrayDimensions,
    );

    // Handle types with embedded dimensions (e.g., char[33] from string<32>)
    // In C, array dimensions follow the variable name, not the type
    return VariableDeclarationFormatter.formatWithEmbeddedDimensions(
      modifierPrefix,
      input.mappedType,
      input.name,
      arrayDimsStr,
    );
  }

  /**
   * Build the modifier prefix string with consistent ordering.
   *
   * Order: extern volatile const
   * - Matches the established cnx output format
   * - atomic maps to volatile, so atomic and volatile are mutually exclusive
   * - The caller should validate this before calling
   */
  static buildModifierPrefix(modifiers: IVariableModifiers): string {
    const parts: string[] = [];

    if (modifiers.isExtern) {
      parts.push("extern");
    }
    // atomic and volatile both map to volatile in C
    // volatile comes before const to match established format
    if (modifiers.isAtomic || modifiers.isVolatile) {
      parts.push("volatile");
    }
    if (modifiers.isConst) {
      parts.push("const");
    }

    return parts.length > 0 ? parts.join(" ") + " " : "";
  }

  /**
   * Build array dimension string from dimensions array.
   *
   * @param dimensions - Array of dimension strings (e.g., ['10', '20'])
   * @returns Formatted dimensions (e.g., '[10][20]')
   */
  static buildArrayDimensions(dimensions?: readonly string[]): string {
    if (!dimensions || dimensions.length === 0) {
      return "";
    }
    return dimensions.map((d) => `[${d}]`).join("");
  }

  /**
   * Format declaration handling types with embedded array dimensions.
   *
   * Handles types like char[33] from string<32> where the dimension is
   * embedded in the mapped type. In C, array dimensions must follow the
   * variable name:
   *   char greeting[33];      // Correct
   *   char[33] greeting;      // Wrong
   *
   * For string arrays (string<32>[5] names), produces:
   *   char names[5][33];      // Additional dims first, embedded dim last
   */
  private static formatWithEmbeddedDimensions(
    modifierPrefix: string,
    mappedType: string,
    name: string,
    additionalDims: string,
  ): string {
    // Check if the mapped type has embedded array dimensions (e.g., char[33])
    // This happens for string<N> types which map to char[N+1]
    const embeddedMatch = /^(\w+)\[(\d+)\]$/.exec(mappedType);
    if (embeddedMatch) {
      const baseType = embeddedMatch[1];
      const embeddedDim = embeddedMatch[2];
      // Format: modifiers baseType name[additionalDims][embeddedDim]
      return `${modifierPrefix}${baseType} ${name}${additionalDims}[${embeddedDim}]`;
    }

    // No embedded dimensions - standard format
    return `${modifierPrefix}${mappedType} ${name}${additionalDims}`;
  }
}

export default VariableDeclarationFormatter;
