import Installation from "../Installation";
import NodeFileSystem from "../NodeFileSystem";
import noIncludes from "./noIncludes";
import type IPipelineFile from "../types/IPipelineFile";
import type ISourceGraph from "../types/ISourceGraph";

/**
 * The part of 1.1's graph that 1.2 through 2.1 read, for in-memory files and
 * the installed catalog. Like 1.1, it records the includes of every file (here,
 * none), so a pass after it finds each file's facts.
 */
function testSourceGraph(
  files: readonly IPipelineFile[],
): Pick<
  ISourceGraph,
  | "cnxFiles"
  | "anchor"
  | "includes"
  | "outputs"
  | "targetCatalog"
  | "headerFiles"
  | "headerTexts"
  | "headerIncludes"
  | "headerEdges"
  | "headerUnit"
  | "headerSearchPaths"
  | "includeSearchPaths"
  | "run"
> {
  const catalog = Installation.catalog(NodeFileSystem.instance);
  const includes = new Map(files.map((file) => [file.path, noIncludes()]));
  return {
    cnxFiles: files,
    anchor: {
      directory: "/p",
      projectRoot: undefined,
      defines: {},
      platformio: null,
      configuredCompiler: null,
    },
    includes: { c: includes, cpp: includes },
    outputs: { c: new Map(), cpp: new Map() },
    headerFiles: [],
    headerTexts: new Map(),
    headerIncludes: [],
    headerEdges: new Map(),
    headerUnit: { directives: [], sites: new Map(), unresolvedSystem: [] },
    headerSearchPaths: new Map(),
    includeSearchPaths: [],
    run: { debugMode: false, parseOnly: false, target: {} },
    targetCatalog: {
      path: catalog,
      text: NodeFileSystem.instance.readFile(catalog),
    },
  };
}

export default testSourceGraph;
