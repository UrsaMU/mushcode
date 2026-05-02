import type { ASTNode } from "../../parser/mod.ts";

// ── Iteration state ───────────────────────────────────────────────────────────

/** One frame on the iteration stack — pushed by iter(), map(), @dolist, etc. */
export interface IterFrame {
  item:  string;  // ## — current element value
  index: number;  // #@ — current position (1-based)
}

// ── Custom substitution handlers ──────────────────────────────────────────────

/** A custom substitution handler registered via `EvalEngine.registerSub()`. */
export type SubHandlerFn = (code: string, ctx: EvalContext) => Promise<string> | string;

// ── Command fallback handler ──────────────────────────────────────────────────

/**
 * A fallback handler called when an `@command` is executed but no specific
 * handler is registered for that command name.
 */
export type CommandFallbackFn = (
  name:     string,
  switches: string[],
  object:   string | null,
  value:    string | null,
  ctx:      EvalContext,
  engine:   IEvalEngine,
) => Promise<void>;

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
  /**
   * Optional command-context data for %w, %W, %+, %| substitutions.
   * Provided by the host when evaluating commands triggered from input.
   */
  commandContext?: {
    /** Last bare command entered (%w lowercase, %W uppercase) */
    lastCommand?: string;
    /** Last command arguments (%+ in command-context meaning) */
    lastArgs?: string;
    /** Output of the previous piped command (%|) */
    pipedOutput?: string;
  };
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

/**
 * Create a child frame that **shares** the parent's register map.
 * Any `setq()` calls inside the child are visible to the parent after the
 * child returns.  Used by `u()`.
 */
export function childShared(
  parent: EvalContext,
  overrides: Partial<EvalContext> = {},
): EvalContext {
  return {
    ...parent,
    depth: parent.depth + 1,
    ...overrides,
    // registers intentionally NOT overridden here — shared by reference
    registers: overrides.registers ?? parent.registers,
  };
}

/**
 * Create a child frame with a **deep copy** of the parent's register map.
 * Mutations inside the child do not affect the parent.  Used by `ulocal()`.
 */
export function childIsolated(
  parent: EvalContext,
  overrides: Partial<EvalContext> = {},
): EvalContext {
  return {
    ...parent,
    depth: parent.depth + 1,
    registers: new Map(parent.registers),
    ...overrides,
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
  /**
   * Return a pronoun for the object.
   * `code` is the lower-case substitution letter: "s", "o", "p", or "a".
   * Returns `null` (or undefined) to fall back to empty string.
   */
  getPronoun?(objectId: string, code: string): Promise<string | null> | string | null;
  /**
   * Return the moniker (decorated/accented name) for the object, or `null` to
   * fall back to the plain name.
   */
  getMoniker?(objectId: string): Promise<string | null> | string | null;
  /** Return the location dbref of an object, or `""` if unknown. */
  getLocation?(id: string): Promise<string> | string;
  /** Return a list of dbref strings for the contents of an object. Optional type filter. */
  getContents?(id: string, type?: string): Promise<string[]> | string[];
  /** Return a list of dbref strings for all connected players. */
  getConnectedPlayers?(): Promise<string[]> | string[];
  /** Return the parent chain of an object (object first, then parents). */
  getParentChain?(id: string): Promise<string[]> | string[];
  /** Partial-name player lookup. Returns dbref string, null (no match), or "#-2 MULTIPLE MATCHES". */
  findPlayer?(partial: string): Promise<string | null> | string | null;
  /** List attribute names on an object, optionally filtered by wildcard pattern. */
  listAttrs?(objectId: string, pattern?: string): Promise<string[]> | string[];
  /** Return the type of an object: "ROOM" | "PLAYER" | "THING" | "EXIT". */
  getType?(objectId: string): Promise<string> | string;
  /** Resolve a name/dbref expression to an object ID. */
  findObject?(from: string, expr: string): Promise<string | null> | string | null;
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

// ── Plugin interface ──────────────────────────────────────────────────────────

/**
 * A platform or capability plugin that extends an {@link IEvalEngine} with
 * additional functions, commands, substitution handlers, or a command fallback.
 *
 * Install a plugin by calling `engine.use(plugin)`. Registrations are applied
 * in order — functions first, then commands, subs, then the fallback — so any
 * existing registration with the same name is silently replaced.
 *
 * @example
 * ```ts
 * import { EvalEngine, registerStdlib } from "@ursamu/mushcode/eval";
 * import { rhostPlugin } from "@ursamu/mushcode/rhost";
 *
 * const engine = new EvalEngine(accessor);
 * registerStdlib(engine);
 * engine.use(rhostPlugin);
 * ```
 */
export interface MushPlugin {
  /** Display name, e.g. `"@ursamu/mushcode-rhost"`. */
  readonly name: string;
  /** SemVer string, e.g. `"1.0.0"`. */
  readonly version: string;
  /**
   * Softcode functions to register, keyed by lower-case MUSH function name.
   * Each entry is passed to {@link IEvalEngine.registerFunction}.
   */
  readonly functions?: Record<string, FunctionImpl>;
  /**
   * `@command` handlers to register, keyed by lower-case command name.
   * Each entry is passed to {@link IEvalEngine.registerCommand}.
   */
  readonly commands?: Record<string, CommandImpl>;
  /**
   * Custom `%<code>` substitution handlers to install.
   * Each entry is passed to {@link IEvalEngine.registerSub}.
   */
  readonly subs?: ReadonlyArray<{
    readonly match: string | ((code: string) => boolean);
    readonly fn: SubHandlerFn;
  }>;
  /**
   * Fallback `@command` handler.
   * Passed to {@link IEvalEngine.registerCommandFallback} when present.
   */
  readonly commandFallback?: CommandFallbackFn;
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
  /**
   * Register a custom `%<code>` substitution handler.
   * Custom handlers are checked before built-in substitutions.
   */
  registerSub(match: string | ((code: string) => boolean), fn: SubHandlerFn): this;
  /**
   * Register a fallback handler for `@commands` with no specific handler registered.
   */
  registerCommandFallback(fn: CommandFallbackFn): this;
  /**
   * Install a {@link MushPlugin}, registering all of its functions, commands,
   * substitution handlers, and command fallback in one call.
   * Returns `this` for chaining.
   */
  use(plugin: MushPlugin): this;
  /** Evaluate an AST node to a string. */
  eval(node: ASTNode, ctx: EvalContext): Promise<string>;
  /**
   * Shallow-evaluate a node: expand `[...]` and `%x` normally, but leave
   * `{...}` as literal braced text for the dispatcher to re-evaluate.
   */
  evalShallow(node: ASTNode, ctx: EvalContext): Promise<string>;
  /** Execute a node for its side effects (commands). */
  exec(node: ASTNode, ctx: EvalContext): Promise<void>;
  /** Parse and evaluate a raw softcode string. */
  evalString(source: string, ctx: EvalContext): Promise<string>;
}
