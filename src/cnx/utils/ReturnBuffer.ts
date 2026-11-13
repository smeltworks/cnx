import type TType from "../types/TType";
import headerCType from "./headerCType";
import TypeResolver from "./TypeResolver";

/**
 * #1209 (owner ruling, 2026-11-13): C returns no array, so a function whose
 * cnx return type is a `string<N>` or an array fills a buffer its caller
 * supplies -- `void greet(char cnx_return[17])` -- and its `return` copies
 * into it. The caller's buffer outlives the call, so returning a local is
 * memory safe. This is the one place that says which return types do.
 */
class ReturnBuffer {
  /** The parameter the buffer is passed as, ahead of the declared ones */
  static readonly NAME = "cnx_return";

  /**
   * The C dimensions of the buffer a function returning `type` fills --
   * `[17]` for a `string<16>`, `[4]` for a `u8[4]`, `[2][17]` for a
   * `string<16>[2]` -- or null when the type is returned by value
   */
  static dimensionsOf(type: TType): string | null {
    if (type.kind === "string") return `[${type.capacity + 1}]`;
    if (type.kind !== "array") return null;
    const element =
      type.elementType.kind === "string"
        ? `[${type.elementType.capacity + 1}]`
        : "";
    return type.dimensions.map((size) => `[${size}]`).join("") + element;
  }

  /** The C type of one element of the buffer a function returning `type` fills */
  static elementCType(type: TType): string {
    const element = type.kind === "array" ? type.elementType : type;
    return element.kind === "string"
      ? "char"
      : headerCType(TypeResolver.getTypeName(element));
  }

  /** The buffer parameter of a function returning `type`, or null */
  static parameterFor(type: TType): string | null {
    const dimensions = ReturnBuffer.dimensionsOf(type);
    return dimensions === null
      ? null
      : ReturnBuffer.parameter(ReturnBuffer.elementCType(type), dimensions);
  }

  /**
   * A function returning a `string<N>` or an array is `void`, and the buffer
   * it fills is its first parameter: its prototype and its callback typedef
   * both say so through here
   */
  static signature(
    returnType: string,
    params: string,
    returnBuffer: string | null,
  ): { returnType: string; params: string } {
    if (returnBuffer === null) return { returnType, params };
    return {
      returnType: "void",
      params: params === "void" ? returnBuffer : `${returnBuffer}, ${params}`,
    };
  }

  /** A caller's temporary for a call returning `type`, or null */
  static temporaryFor(type: TType, name: string): string | null {
    const dimensions = ReturnBuffer.dimensionsOf(type);
    return dimensions === null
      ? null
      : ReturnBuffer.temporary(
          ReturnBuffer.elementCType(type),
          name,
          dimensions,
        );
  }

  /** A caller's temporary of the buffer's shape, zero-filled */
  private static temporary(
    cElementType: string,
    name: string,
    dimensions: string,
  ): string {
    return `${cElementType} ${name}${dimensions} = {0};`;
  }

  /** The buffer parameter, written with the element's C type */
  private static parameter(cElementType: string, dimensions: string): string {
    return `${cElementType} ${ReturnBuffer.NAME}${dimensions}`;
  }
}

export default ReturnBuffer;
