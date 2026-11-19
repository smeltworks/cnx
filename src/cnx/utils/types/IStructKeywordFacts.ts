/**
 * #834: which C struct tags were declared with no typedef, so that C must
 * write `struct Point`. `IResolvedSymbols` answers it from the C headers.
 */
interface IStructKeywordFacts {
  checkNeedsStructKeyword(structName: string): boolean;
}

export default IStructKeywordFacts;
