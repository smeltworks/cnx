import type EFileType from "./EFileType";

/**
 * What 1.1 Discover learned about one `.cnx` file's includes, while it
 * resolved them (#1444).
 *
 * Every fact here is decided at the one point where a directive's spelling and
 * the file it resolved to are both in hand, and none can be re-derived later:
 * a quoted spelling is relative to the file that wrote it, and whether it
 * resolved depends on the file system at the moment discovery asked. These
 * rode on 1.4's `Program` until 1.1 had an artifact of its own (#1452), and on
 * `Transpiler` fields before that.
 */
interface IFileIncludes {
  /**
   * How the `.c` names each include, by the author's spelling: a `.cnx`
   * include's generated header (#1467), spelled from the `.c`'s directory
   * when the `.cnx` was found beside this file (#2272), and a quoted C header
   * found beside this file, also from the `.c`'s directory (#1746).
   *
   * The `.c`'s spelling only: the `.h` is spelled from its own directory, and
   * 1.1 has already applied that spelling to `headerIncludeDirectives`,
   * `userIncludes` and `cHeaderIncludes`.
   */
  readonly includeRewrites: ReadonlyMap<string, string>;

  /**
   * The file each `#include` directive resolved to, or null, keyed by
   * `IncludeDirectiveText.join` (#1672).
   *
   * 2.1's ADR-010 rules report the answer discovery gave, not one of their own.
   * #1322 handed them the search path instead, after codegen re-derived a
   * narrower one; with the inputs in hand 2.1 still made its own decision, and
   * missed an absolute angle include that discovery resolves.
   */
  readonly resolutions: ReadonlyMap<string, string | null>;

  /**
   * ADR-010's E0504 question answered by the same rule: for each include of a
   * header whose cnx source the same form of include would find, that
   * source's spelling, keyed like `resolutions` (#1672). An include with no
   * entry has no such source.
   */
  readonly cnxAlternatives: ReadonlyMap<string, string>;

  /**
   * The kind of file each directive's spelling names, keyed like
   * `resolutions` (#1444, owner ruling 1). The one classification of an
   * include: 2.1's ADR-010 rules (E0503, E0506) and render read it, and no
   * pass after 1.1 classifies a spelling itself.
   */
  readonly kinds: ReadonlyMap<string, EFileType>;

  /**
   * The directory this file's quoted includes resolve from (#1435): its own
   * directory, or for a source run's in-memory root the directory of its
   * `sourcePath`, or the caller's `workingDir` when the text has no path.
   *
   * 2.1 once re-derived it as `dirname(sourcePath)` while discovery resolved
   * from `workingDir`, so a missing include read as a foreign header, E0426
   * declined, and cnx member syntax reached the C output at exit 0. A
   * generated header spells a quoted include relative to it (#1725).
   */
  readonly quotedIncludeDirectory: string;

  /**
   * The directory this file's generated header is written to (#2272). Every
   * quoted include the header carries is spelled relative to it, which is how
   * a compiler resolves one, so the header compiles with no `-I` and reads the
   * same whichever entry pulled the file in.
   */
  readonly generatedHeaderDirectory: string;

  /**
   * How this file spells each header and `.cnx` it includes: resolved header
   * path to directive, in discovery order (#497, #854). A quoted spelling is
   * relative to the file that wrote it, so it is a fact of the file, not of
   * the run (#1435).
   */
  readonly headerIncludeDirectives: ReadonlyMap<string, string>;

  /**
   * For each of those spellings that is relative to this file, the file it
   * names, so a file that reaches the header only through another can spell
   * it relative to itself (#1725). Keyed like `headerIncludeDirectives`.
   */
  readonly writerRelativeIncludes: ReadonlyMap<string, string>;

  /**
   * This file's `.cnx` includes, each rendered as the include its generated
   * header carries (#589, #941, #1467), in source order.
   */
  readonly userIncludes: readonly string[];

  /**
   * This file's other includes, as its generated header names them, in source
   * order: a quoted C header found beside the file is named from the header's
   * directory (#1746), like the matching `headerIncludeDirectives` entry, and
   * any other is kept as written. A generated header carries them only when it
   * names a macro one of them supplies (#424).
   */
  readonly cHeaderIncludes: readonly string[];

  /**
   * #1844 review: the same includes as a translation unit names them, `"x.h"`
   * or `<x.h>`, in source order. 1.1's #985 unit and the macro dump both read
   * this list, rather than each deriving it.
   */
  readonly cHeaderSpecs: readonly string[];

  /**
   * #1881: the C/C++ headers this file names in its own `#include` lines, as
   * resolved paths. Their names are the only header names the file sees: a
   * header one of them includes, or one another `.cnx` includes, is not.
   */
  readonly cHeaderPaths: ReadonlySet<string>;
}

export default IFileIncludes;
