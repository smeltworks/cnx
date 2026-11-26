import type IFileSystem from "../../types/IFileSystem";
import invariant from "../../utils/invariant";

/**
 * One run's read-only view of the host port, in which each file's text is read
 * once (#1444, owner ruling 3).
 *
 * 1.1 Discover reads through it, so every part of discovery that asks for a
 * file sees the same text. `platformio.ini` was read once per directory that
 * resolved includes, for `lib_extra_dirs`, and then again in Stage 3 for
 * ADR-049's target. A save between those reads gave discovery one version of
 * the file and the target another. Discovery now parses the project from
 * this view too, so the target is read from the same text.
 *
 * Read-only, because 1.1 changes nothing on disk: 3.1 Write owns every change
 * (#1653). A view that forwarded the mutating methods would be one more module
 * able to write, so each refuses instead.
 */
class ReadOnceFileSystem implements IFileSystem {
  private readonly texts = new Map<string, string>();

  constructor(private readonly host: IFileSystem) {}

  readFile(path: string): string {
    const known = this.texts.get(path);
    if (known !== undefined) return known;
    const text = this.host.readFile(path);
    this.texts.set(path, text);
    return text;
  }

  exists(path: string): boolean {
    return this.host.exists(path);
  }

  isDirectory(path: string): boolean {
    return this.host.isDirectory(path);
  }

  isFile(path: string): boolean {
    return this.host.isFile(path);
  }

  isExecutable(path: string): boolean {
    return this.host.isExecutable(path);
  }

  readdir(path: string): string[] {
    return this.host.readdir(path);
  }

  stat(path: string): { mtimeMs: number } {
    return this.host.stat(path);
  }

  /** #2504: the file a symlinked spelling names, as the host follows it */
  realpath(path: string): string {
    return this.host.realpath ? this.host.realpath(path) : path;
  }

  writeFile(path: string): void {
    ReadOnceFileSystem.refuse("write", path);
  }

  mkdir(path: string): void {
    ReadOnceFileSystem.refuse("create the directory", path);
  }

  unlink(path: string): void {
    ReadOnceFileSystem.refuse("delete", path);
  }

  rename(from: string): void {
    ReadOnceFileSystem.refuse("rename", from);
  }

  private static refuse(what: string, path: string): never {
    invariant(
      false,
      `1.1 Discover changes nothing on disk (asked to ${what} ${path})`,
    );
  }
}

export default ReadOnceFileSystem;
