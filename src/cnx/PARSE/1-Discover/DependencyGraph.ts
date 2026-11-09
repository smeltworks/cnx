/**
 * DependencyGraph
 *
 * Manages file dependencies and provides topological sorting for correct
 * processing order. Files are sorted so that dependencies are processed
 * before dependents.
 *
 * Uses @n1ru4l/toposort for cycle-aware topological sorting.
 */

// Handle tsx vs vitest ESM/CJS interop differences:
// - tsx wraps named exports inside `default`
// - vitest exposes named exports at namespace level
import * as toposortNS from "@n1ru4l/toposort";

type ToposortFn = (deps: Map<string, string[]>) => Set<string>[];
type ToposortModule = {
  toposortReverse?: ToposortFn;
  default?: ToposortModule;
};

/**
 * Resolves toposortReverse from module with tsx/vitest interop support.
 */
function resolveToposortReverse(mod: ToposortModule): ToposortFn {
  if (mod.toposortReverse) {
    return mod.toposortReverse;
  }
  return mod.default!.toposortReverse!;
}

const toposortReverse = resolveToposortReverse(toposortNS as ToposortModule);

/**
 * Manages file dependencies for topological sorting
 */
class DependencyGraph {
  /** Maps each file to its dependencies (files it includes) */
  private readonly dependencies: Map<string, string[]> = new Map();
  private readonly warnings: string[] = [];

  /**
   * Resolves toposortReverse with tsx/vitest interop support.
   * Exposed as static for testing both code paths.
   * @public test seam: DependencyGraph.test.ts drives both interop paths of this module function
   */
  static readonly resolveToposortReverse = resolveToposortReverse;

  /**
   * Add a file to the graph without dependencies
   */
  addFile(path: string): void {
    if (!this.dependencies.has(path)) {
      this.dependencies.set(path, []);
    }
  }

  /**
   * Add a dependency relationship
   * @param dependent - The file that depends on another (the includer)
   * @param dependency - The file being depended on (the included file)
   */
  addDependency(dependent: string, dependency: string): void {
    // Ensure both nodes exist
    if (!this.dependencies.has(dependent)) {
      this.dependencies.set(dependent, []);
    }
    if (!this.dependencies.has(dependency)) {
      this.dependencies.set(dependency, []);
    }

    // Add the dependency relationship
    const deps = this.dependencies.get(dependent)!;
    if (!deps.includes(dependency)) {
      deps.push(dependency);
    }
  }

  /**
   * Get files in topological order (dependencies first)
   *
   * Uses toposortReverse which expects a map of [node -> dependencies].
   * The result is batches of files that can be processed in parallel,
   * but we flatten it to a single array.
   *
   * If a cycle is detected, returns nodes in arbitrary order with a warning.
   */
  getSortedFiles(): string[] {
    if (this.dependencies.size === 0) {
      return [];
    }

    try {
      // toposortReverse returns batches (Set[]) - flatten to array
      const batches = toposortReverse(this.dependencies);
      const result: string[] = [];
      for (const batch of batches) {
        for (const file of batch) {
          result.push(file);
        }
      }
      return result;
    } catch (error) {
      // Cycle detected - return nodes in arbitrary order with warning
      const message = error instanceof Error ? error.message : "unknown error";
      this.warnings.push(
        `Circular dependency detected in include graph (${message}). Files may be processed in incorrect order.`,
      );
      return [...this.dependencies.keys()];
    }
  }

  /**
   * Get any warnings generated during sorting
   */
  getWarnings(): string[] {
    return [...this.warnings];
  }
}

export default DependencyGraph;
