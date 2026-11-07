/**
 * Everything 1.4 Resolve needs besides the files themselves.
 *
 * ## Why one object rather than a positional list (#1452)
 *
 * `Program.build` reached eight positional parameters, seven of them with
 * defaults, and TypeScript refused the eighth before anything else did. The
 * defaults are what hid the growth: each new parameter compiled silently, so
 * the signature widened without a single call site objecting. A seven-parameter
 * builder with seven defaults is exactly as coupled as an eight-parameter one
 * -- it just does not say so.
 *
 * The count was not the real cost either. Positionally, adding an input meant
 * editing the signature, every full call, and every test that passed a later
 * argument by position; a named field means editing the interface and the
 * producer. #1452 still has `SymbolTable` and `CodeGenState` to move, and
 * both will want to arrive the same way, so the change point is worth having once.
 *
 * Every field is optional and carries the same empty default the positional
 * form did, so a caller that supplied nothing still supplies nothing.
 */
import type TRunTarget from "../../../types/TRunTarget";
import type IForeignSymbols from "./IForeignSymbols";
import type IStructFieldInfo from "../../../types/symbols/IStructFieldInfo";
import type IVisibilityInput from "./IVisibilityInput";
import type SymbolRegistry from "../../3-Declare/SymbolRegistry";
import type SymbolTable from "../../3-Declare/SymbolTable";

interface IProgramInputs {
  /** Struct fields the C and C++ headers contributed, by type name. */
  readonly headerStructFields?: ReadonlyMap<
    string,
    ReadonlyMap<string, IStructFieldInfo>
  >;

  /** The C and C++ halves of the conflict question, plus the opacity inputs. */
  readonly foreign?: IForeignSymbols;

  /**
   * The C and C++ headers' symbols, as the run's table holds them before any
   * cnx file is published to it (#1825). ADR-006's and ADR-029's
   * derivations look callees and typedefs up in it by name.
   *
   * Absent only where a test builds a program with no headers behind it.
   */
  readonly symbolTable?: SymbolTable;

  /** ADR-016 visibility inputs. */
  readonly visibility?: IVisibilityInput;

  /**
   * The run's scope graph (#1452 box 3).
   *
   * Absent only where a test builds a program without one; production always
   * supplies the registry the run constructed.
   */
  readonly registry?: SymbolRegistry;

  /**
   * ADR-049: the run's one target, which 1.2 chose (#1713). Absent only
   * where a test builds a program that never asks for its target.
   */
  readonly target?: TRunTarget;

  /**
   * #1428: does the run emit C++? 1.1 Discover's answer (`ISourceGraph.cppMode`,
   * #1844), carried by the program so every pass after 1.4 reads that one fact
   * rather than being handed a copy. Required: a program never answers "C"
   * for a run that did not say so, so a test states its mode as a run does.
   */
  readonly cppMode: boolean;
  /**
   * #1881: the C/C++ headers each file includes itself, keyed by the file's
   * path. A header's names are visible only there. Absent, no file includes
   * one.
   */
  readonly headerPathsByFile?: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * #1175: the files that include a C or C++ header themselves (#1881). A `#define` never reaches the symbol model, so in these a
   * name nothing binds may be a macro. Absent, no file does.
   */
  readonly filesIncludingForeignHeaders?: ReadonlySet<string>;
}

export default IProgramInputs;
