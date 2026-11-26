/**
 * How a diagnostic names a field or an extraction by its width: "a 3-bit
 * field", "an 8-bit extraction". The article follows how the number is said, so 8, 11, 18 and 80
 * through 89 take "an" (#2484 review).
 */
class BitFieldText {
  static named(width: number, noun = "field"): string {
    return `${BitFieldText.article(width)} ${width}-bit ${noun}`;
  }

  /** The same, starting a sentence: "A 3-bit field", "An 8-bit field" */
  static opening(width: number): string {
    const named = BitFieldText.named(width);
    return named.charAt(0).toUpperCase() + named.slice(1);
  }

  private static article(width: number): string {
    const digits = String(width);
    const saidWithVowel =
      digits.startsWith("8") ||
      (digits.length % 3 === 2 && /^1[18]/.test(digits));
    return saidWithVowel ? "an" : "a";
  }
}

export default BitFieldText;
