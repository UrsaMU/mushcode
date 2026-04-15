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
  maxDepth:  number;
  /** Optional cancellation signal */
  signal?:   AbortSignal;
}

/** Create a default EvalContext with safe fallback values. */
export function makeContext(
  partial: Partial<EvalContext> & Pick<EvalContext, "enactor" | "executor">,
): EvalContext {
  return {
    caller:    null,
    args:      [],
    registers: new Map(),
    iterStack: [],
    depth:     0,
    maxDepth:  100,
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
  /** Read a named attribute from an object (null if absent). */
  getAttr(objectId: string, attr: string): Promise<string | null>;
  /** Resolve a target expression ("me", "#uuid", "Name") → UUID (null if not found). */
  resolveTarget(from: string, expr: string): Promise<string | null>;
  /** Return the display name of an object. */
  getName(objectId: string): Promise<string>;
  /** Check whether an object has a flag. */
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
  eval?:   "eager" | "lazy";
  minArgs: number;
  maxArgs: number;
  exec: (
    args:   string[] | EvalThunk[],
    ctx:    EvalContext,
    engine: IEvalEngine,
  ) => Promise<string> | string;
}

/** A registered @command handler. */
export interface CommandImpl {
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
  readonly accessor: ObjectAccessor;
  registerFunction(name: string, impl: FunctionImpl): this;
  registerCommand(name: string, impl: CommandImpl): this;
  eval(node: ASTNode, ctx: EvalContext): Promise<string>;
  exec(node: ASTNode, ctx: EvalContext): Promise<void>;
  evalString(source: string, ctx: EvalContext): Promise<string>;
}
