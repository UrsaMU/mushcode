import type { ASTNode } from "../../parser/mod.ts";

// ── Iteration state ───────────────────────────────────────────────────────────

/** One frame on the iteration stack — pushed by iter(), map(), @dolist, etc. */
export interface IterFrame {
  item:  string;  // ## — current element value
  index: number;  // #@ — current position (1-based)
}

// ── Evaluation context ────────────────────────────────────────────────────────

/**
 * Runtime state threaded through every eval call.
 *
 * `registers` is intentionally mutable — `setq()` writes to it and subsequent
 * reads within the same attribute eval see the updated value.
 */
export interface EvalContext {
  /** UUID of the enacting object — %# */
  enactor:   string;
  /** UUID of the executing object — %! */
  executor:  string;
  /** UUID of the calling object — %@ (null at the top level) */
  caller:    string | null;
  /** Positional arguments — %0 through %9 */
  args:      string[];
  /** Named registers — %q<name>.  setq() mutates this map. */
  registers: Map<string, string>;
  /** Iteration stack — ## and #@ resolve from iterStack[0] */
  iterStack: IterFrame[];
  /** Current recursion depth (incremented on each u() call) */
  depth:     number;
  /** Maximum allowed recursion depth before returning #-1 error */
  maxDepth:     number;
  /** Maximum total output length per evalString call (default 65 536) */
  maxOutputLen: number;
  /** Optional cancellation signal */
  signal?:   AbortSignal;
}

/**
 * Create a default {@link EvalContext} with safe fallback values.
 *
 * Provide at minimum `enactor` and `executor` (usually the same UUID for
 * top-level evaluations). All other fields default to safe empty values and a
 * recursion limit of 100.
 *
 * @example
 * const ctx = makeContext({ enactor: "player-uuid", executor: "player-uuid" });
 */
export function makeContext(
  partial: Partial<EvalContext> & Pick<EvalContext, "enactor" | "executor">,
): EvalContext {
  return {
    caller:    null,
    args:      [],
    registers: new Map(),
    iterStack: [],
    depth:        0,
    maxDepth:     100,
    maxOutputLen: 65_536,
    ...partial,
  };
}

// ── Thunks (lazy arg evaluation) ──────────────────────────────────────────────

/**
 * A lazily-evaluated function argument.
 * Call it to evaluate the underlying AST node in the current context.
 * Pass a partial context override (e.g. `{ iterStack: [...] }`) to temporarily
 * change evaluation state — used by iter() to set ## and #@.
 */
export type EvalThunk = (ctxOverride?: Partial<EvalContext>) => Promise<string>;

// ── Database accessor ─────────────────────────────────────────────────────────

/**
 * Minimal read-only interface to the game database.
 * Implement this in the host application and pass it to EvalEngine.
 */
export interface ObjectAccessor {
  /** Read a named attribute from an object. Returns `null` if the attribute is absent. */
  getAttr(objectId: string, attr: string): Promise<string | null>;
  /** Resolve a target expression (`"me"`, `"#uuid"`, `"Name"`) to an object UUID. Returns `null` if not found. */
  resolveTarget(from: string, expr: string): Promise<string | null>;
  /** Return the display name of an object. */
  getName(objectId: string): Promise<string>;
  /** Return `true` if the object has the named flag. */
  hasFlag(objectId: string, flag: string): Promise<boolean>;
}

// ── Function and command registrations ───────────────────────────────────────

/**
 * A registered softcode function.
 *
 * When `eval` is "eager" (default), all arguments are evaluated before `exec`
 * is called and `args` contains `string[]`.
 *
 * When `eval` is "lazy", `args` contains `EvalThunk[]`.  The function calls
 * only the thunks it needs (e.g. `if()` evaluates only the taken branch).
 */
export interface FunctionImpl {
  /** Argument evaluation strategy. `"eager"` (default) pre-evaluates all args; `"lazy"` passes thunks. */
  eval?:   "eager" | "lazy";
  /** Minimum number of arguments required; fewer returns a `#-1` error. */
  minArgs: number;
  /** Maximum number of arguments accepted; more returns a `#-1` error. Use `Infinity` for variadic. */
  maxArgs: number;
  /** The function implementation. Receives `string[]` when eager, `EvalThunk[]` when lazy. */
  exec: (
    args:   string[] | EvalThunk[],
    ctx:    EvalContext,
    engine: IEvalEngine,
  ) => Promise<string> | string;
}

/** A registered `@command` handler (e.g. `@pemit`, `@trigger`). */
export interface CommandImpl {
  /** Execute the command. `switches` are the `/switch` tokens; `object` and `value` are the two sides of `=`. */
  exec: (
    switches: string[],
    object:   string | null,
    value:    string | null,
    ctx:      EvalContext,
    engine:   IEvalEngine,
  ) => Promise<void>;
}

// ── Engine interface (forward declaration for use in FunctionImpl/CommandImpl) ─

/** Public interface of EvalEngine, used in function/command signatures. */
export interface IEvalEngine {
  /** The host-provided database accessor used by DB stdlib functions. */
  readonly accessor: ObjectAccessor;
  /** Register a softcode function (e.g. `add`, `u`) by name. */
  registerFunction(name: string, impl: FunctionImpl): this;
  /** Register a softcode `@command` handler by name. */
  registerCommand(name: string, impl: CommandImpl): this;
  /** Evaluate an AST node to a string. */
  eval(node: ASTNode, ctx: EvalContext): Promise<string>;
  /** Execute a node for its side effects (commands). */
  exec(node: ASTNode, ctx: EvalContext): Promise<void>;
  /** Parse and evaluate a raw softcode string. */
  evalString(source: string, ctx: EvalContext): Promise<string>;
}
