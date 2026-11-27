/** A C++ enum specifier as 1.2 lowers it (#1991) */
interface ICppEnumSyntax {
  readonly name: string | null;
  /** The underlying type as written, `uint8_t` in `enum E : uint8_t` */
  readonly baseType: string | null;
  /** #2510 review: `enum class`, whose enumerators a bare name does not read */
  readonly isScoped: boolean;
  /** #2510 review: the names its enumerators declare */
  readonly enumerators: readonly string[];
}

export default ICppEnumSyntax;
