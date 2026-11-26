/** `#include NAME`: an include whose file a macro names */
const NAMED_INCLUDE = /^#\s*include\s+([A-Za-z_]\w*)\s*$/;
/** `#define NAME "file.h"` or `#define NAME <file.h>` */
const PATH_DEFINE = /^#\s*define\s+([A-Za-z_]\w*)\s+(["<])([^">]+)[">]\s*$/;
/** A `-D` value that names a file: `"file.h"` or `<file.h>` */
const PATH_VALUE = /^(["<])([^">]+)[">]$/;

/** One file an include names, as `IncludeDiscovery.directivesOf` gives it */
type TSpelling = { path: string; isLocal: boolean };

/**
 * #2504: the files an include a macro names (`#include BOARD_HEADER`) can
 * open, for the walk to find as it finds a literal include's. 1.1 is the only
 * pass that may ask the file system where a file is (#1653), and a file only
 * 1.2's preprocessing opened has neither its real path -- a symlink spelling
 * is still the file the walk found under another -- nor its declarations read.
 *
 * Every definition of the macro, in any branch, is a spelling it may give:
 * the walk finds where a file is, and 1.2 reads only what C opens (#1844).
 * A macro whose file is computed (`STR(impl.h)`) names none here.
 */
class MacroIncludes {
  /** Each macro that names a file, from the run's defines and these texts */
  static spellings(
    texts: Iterable<string>,
    defines: Readonly<Record<string, string | boolean>>,
  ): ReadonlyMap<string, readonly TSpelling[]> {
    const spellings = new Map<string, TSpelling[]>();
    const learn = (name: string, delimiter: string, path: string): void => {
      const known = spellings.get(name) ?? [];
      if (known.some((spelling) => spelling.path === path)) return;
      spellings.set(name, [...known, { path, isLocal: delimiter === '"' }]);
    };
    for (const [name, value] of Object.entries(defines)) {
      const match = typeof value === "string" ? PATH_VALUE.exec(value) : null;
      if (match) learn(name, match[1], match[2]);
    }
    for (const text of texts) {
      for (const line of text.split("\n")) {
        const match = PATH_DEFINE.exec(line.trim());
        if (match) learn(match[1], match[2], match[3]);
      }
    }
    return spellings;
  }

  /** How many spellings, which only grows as the walk finds more files */
  static count(spellings: ReadonlyMap<string, readonly TSpelling[]>): number {
    return [...spellings.values()].reduce((n, known) => n + known.length, 0);
  }

  /** Each file `text`'s macro-named includes can open */
  static directivesOf(
    text: string,
    spellings: ReadonlyMap<string, readonly TSpelling[]>,
  ): TSpelling[] {
    return text.split("\n").flatMap((line) => {
      const match = NAMED_INCLUDE.exec(line.trim());
      return match ? [...(spellings.get(match[1]) ?? [])] : [];
    });
  }
}

export default MacroIncludes;
