import type IChainStep from "./IChainStep";
import type TValueBinding from "./TValueBinding";

/**
 * A postfix chain or assignment target, typed one operation at a time
 * (#1668). A `this.` or `global.` root has consumed its first `.name`.
 */
interface IChainTyping {
  readonly root: TValueBinding | null;
  readonly steps: ReadonlyArray<IChainStep>;
  /** ADR-058: the chain ends on a bitmap field or a header bit-field, which has no address */
  readonly endsOnBitField: boolean;
}

export default IChainTyping;
