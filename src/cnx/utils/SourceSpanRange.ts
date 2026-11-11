import type ISourceSpan from "../types/ISourceSpan";

/** The span from the start of one span to the end of a later one */
class SourceSpanRange {
  static between(first: ISourceSpan, last: ISourceSpan): ISourceSpan {
    return {
      line: first.line,
      column: first.column,
      endLine: last.endLine,
      endColumn: last.endColumn,
    };
  }
}

export default SourceSpanRange;
