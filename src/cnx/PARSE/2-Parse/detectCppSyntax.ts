/**
 * Issue #208: Detect if header content contains C++ syntax requiring C++14 parser
 *
 * This heuristic determines whether to parse a .h file with the C or C++ parser.
 * Previously, the pipeline would parse ALL .h files with BOTH parsers and merge,
 * which was wasteful and led to issues with C++-specific features like typed enums.
 *
 * C++ indicators:
 * - Typed enums: enum Name : type { ... }
 * - Class/struct inheritance: class Foo : public Bar
 * - Namespaces: namespace Foo { ... }
 * - Templates: template<...>
 * - Access specifiers: public:, private:, protected:
 */

/**
 * True when the source contains an access-specifier label, as
 * /^\s*(public|private|protected)\s*:/m did.
 *
 * Scanned rather than matched: under /m the leading \s* can span newlines, so
 * the engine retries that run from every line start (S8786).
 *
 * Both whitespace runs may cross lines, matching the original: only whitespace
 * may precede the keyword on its line, and the colon may sit on a later line.
 */
function hasAccessSpecifierLabel(content: string): boolean {
  for (const keyword of ["public", "private", "protected"]) {
    let from = content.indexOf(keyword);
    while (from !== -1) {
      if (isAccessSpecifierAt(content, from, keyword.length)) {
        return true;
      }
      from = content.indexOf(keyword, from + 1);
    }
  }
  return false;
}

/** Only whitespace before it on its line, and a colon after any whitespace. */
function isAccessSpecifierAt(
  content: string,
  start: number,
  length: number,
): boolean {
  let before = start - 1;
  while (before >= 0 && content[before] !== "\n") {
    if (!/\s/.test(content[before])) {
      return false;
    }
    before -= 1;
  }

  let after = start + length;
  while (after < content.length && /\s/.test(content[after])) {
    after += 1;
  }
  return content[after] === ":";
}

/**
 * Detect if header content contains C++ syntax requiring C++14 parser
 * @param content Raw header file content
 * @returns true if C++ parser should be used, false for C parser
 */
function detectCppSyntax(content: string): boolean {
  // Typed enums: enum Name : type { (C++14 feature, key for Issue #208)
  if (/enum\s+\w+\s*:\s*\w+\s*\{/.test(content)) return true;

  // Class/struct with inheritance: class Foo : public/private/protected Bar
  if (/\b(class|struct)\s+\w+\s*:\s*(public|private|protected)/.test(content))
    return true;

  // A class body, or a struct body that opens with an access label: neither
  // is C, wherever the label sits (`class C { public: int x; };`)
  if (/\bclass\s+\w+\s*(?:final\s*)?\{/.test(content)) return true;
  if (/\bstruct\s+\w+\s*\{\s*(?:public|private|protected)\s*:/.test(content))
    return true;

  // namespace keyword: namespace Foo {
  if (/\bnamespace\s+\w+/.test(content)) return true;

  // template declarations: template<...>
  if (/\btemplate\s*</.test(content)) return true;

  // Access specifiers at line start (class members)
  if (hasAccessSpecifierLabel(content)) return true;

  // Default to C parser for pure C headers
  return false;
}

export default detectCppSyntax;
