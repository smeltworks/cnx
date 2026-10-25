import type IGateViolation from "./IGateViolation";

/**
 * One `gh` invocation that reads a capped page and cannot tell it did (issue #1416).
 */
interface IGhPaginationViolation extends IGateViolation {
  /** Repo-relative path, e.g. `.claude/skills/issue-check/SKILL.md`. */
  file: string;
  /** 1-indexed line the command STARTS on, so the report points at something openable. */
  line: number;
  /**
   * Which bound is missing. `unbounded-list` is a `gh … list` with no `--limit`
   * (gh defaults to 30). `unpaginated-collection` is `gh api` on a REST collection
   * with no `--paginate` (the API defaults to 30). `unpaginated-graphql` is a
   * GraphQL query carrying `first:`/`last:` without `--paginate` driving an
   * `$endCursor` — the cursor name matters, because `--paginate` advances no other.
   * `unreadable-path` is a `gh api` whose endpoint the scanner could not find at
   * all: reporting it keeps "I could not read this" distinct from "this is a
   * single resource", a conflation that hid two live misses.
   */
  kind:
    | "unbounded-list"
    | "unpaginated-collection"
    | "unpaginated-graphql"
    | "unreadable-path";
  /** The offending command, collapsed to one line for the report. */
  detail: string;
}

export default IGhPaginationViolation;
