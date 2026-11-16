/**
 * Type information a clamp helper is generated from (#1991: 2.2 decides it, and 2.3 reads it off the planned helper)
 */
interface IClampTypeInfo {
  cType: string;
  widerType: string;
  maxValue: string;
  minValue: string;
  cnxType: string;
  isUnsigned: boolean;
  useWiderArithmetic: boolean;
}

export default IClampTypeInfo;
