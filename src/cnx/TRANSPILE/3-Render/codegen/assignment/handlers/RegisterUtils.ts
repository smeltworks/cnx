/**
 * RegisterUtils
 * Shared utilities for register assignment handlers.
 *
 * Extracted from AccessPatternHandlers.ts and RegisterHandlers.ts to reduce duplication.
 */
import RegisterAccessMode from "../../../../../utils/RegisterAccessMode";
import type TranspileState from "../../../../TranspileState";
import RegisterAddress from "../../../../../utils/RegisterAddress";

/** Result from MMIO optimization attempt */
interface IOptimizationResult {
  success: boolean;
  statement?: string;
}

/**
 * Utilities for register access patterns
 */
class RegisterUtils {
  /**
   * Try to generate MMIO-optimized memory access for byte-aligned writes.
   * Returns success: true with statement if optimization applicable, false otherwise.
   */
  static tryGenerateMMIO(
    fullName: string,
    regName: string,
    accessType: string | null,
    startConst: number | undefined,
    value: string,
    state: TranspileState,
  ): IOptimizationResult {
    // 2.2 decided which writes are one memory access, and through what (#1991)
    if (accessType === null) return { success: false };

    const base = state.symbols!.registerBaseAddresses.get(regName);
    const offset = state.symbols!.registerMemberOffsets.get(fullName);

    if (base === undefined || offset === undefined) {
      return { success: false };
    }
    // The same renderer and folding the register macro uses (#1991, ADR-072)
    const address = RegisterAddress.render(
      base + offset + BigInt(startConst! / 8),
    );

    return {
      success: true,
      statement: `*((volatile ${accessType}*)(${address})) = (${value});`,
    };
  }
  /**
   * Check if register is write-only based on access modifier.
   *
   * Write-only registers include:
   * - 'wo': Write-only
   * - 'w1s': Write-1-to-set
   * - 'w1c': Write-1-to-clear
   */
  static isWriteOnlyRegister(accessMod: string | undefined): boolean {
    return RegisterAccessMode.isWriteOne(accessMod);
  }
}

export default RegisterUtils;
