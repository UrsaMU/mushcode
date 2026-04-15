import type { ASTNode }     from "../../parser/mod.ts";
import { parse }              from "../../parser/mod.ts";
import type {
  EvalContext, EvalThunk,
  FunctionImpl, CommandImpl,
  ObjectAccessor, IEvalEngine,
  IterFrame, SubHandlerFn, CommandFallbackFn,
} from "./context.ts";

// ── EvalEngine ────────────────────────────────────────────────────────────────

/**
 * AST-based softcode evaluator.
 *
 * Register functions and commands, then call `evalString()` to evaluate a
 * raw softcode string or `eval()` to evaluate an already-parsed node.
 *
 * @example
 * const engine = new EvalEngine(myAccessor);
 * registerStdlib(engine);
 * engine.registerFunction("u", { eval: "lazy", minArgs: 1, maxArgs: Infinity, exec: uImpl });
 * const result = await engine.evalString("[add(1,2)]", ctx);
 * // → "3"
 */
export class EvalEngine implements IEvalEngine {
  private readonly functions   = new Map<string, FunctionImpl>();
  private readonly commands    = new Map<string, CommandImpl>();
  private readonly subHandlers: Array<{ match: string | ((code: string) => boolean); fn: SubHandlerFn }> = [];
  private fallbackCommand?: CommandFallbackFn;

  constructor(
    /** The host-provided database accessor (passed to DB stdlib functions). */
    readonly accessor: ObjectAccessor,
  ) {}

  /** Register a softcode function by name (case-insensitive). Returns `this` for chaining. */
  registerFunction(name: string, impl: FunctionImpl): this {
    this.functions.set(name.toLowerCase(), impl);
    return this;
  }

  /** Register a `@command` handler by name (case-insensitive). Returns `this` for chaining. */
  registerCommand(name: string, impl: CommandImpl): this {
    this.commands.set(name.toLowerCase(), impl);
    return this;
  }

  /**
   * Register a custom `%<code>` substitution handler.
   *
   * Custom handlers are checked **before** built-in substitutions, so you can
   * override any built-in code. `match` is either an exact code string (e.g.
   * `"s"` for `%s`) or a predicate (e.g. `code => code.startsWith("V")` for
   * `%Va`–`%Vz`).
   *
   * @returns `this` for chaining.
   */
  registerSub(
    match: string | ((code: string) => boolean),
    fn: SubHandlerFn,
  ): this {
    this.subHandlers.push({ match, fn });
    return this;
  }

  /**
   * Register a fallback handler for `@commands` that have no specific handler registered.
   *
   * @returns `this` for chaining.
   */
  registerCommandFallback(fn: CommandFallbackFn): this {
    this.fallbackCommand = fn;
    return this;
  }

  /** Parse and evaluate a raw softcode string. */
  async evalString(source: string, ctx: EvalContext): Promise<string> {
    const ast = parse(source, "Start");
    return await this.eval(ast, ctx);
  }

  // ── Core evaluator ──────────────────────────────────────────────────────────

  /** Evaluate a node to a string. */
  async eval(node: ASTNode, ctx: EvalContext): Promise<string> {
    if (ctx.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (ctx.depth > ctx.maxDepth) return "#-1 EVALUATION DEPTH EXCEEDED";

    // deno-lint-ignore no-explicit-any
    const n = node as any;

    switch (node.type) {
      // ── Leaves ──────────────────────────────────────────────────────────────
      case "Literal":      return n.value as string;
      case "Escape":       return n.char  as string;
      case "TagRef":       return "#" + (n.name as string);

      case "Substitution": return await this.evalSub(n.code as string, ctx);
      case "SpecialVar":   return this.evalSpecialVar(n.code as string, ctx);

      // ── Containers that just concatenate their parts ─────────────────────
      case "EvalBlock":
      case "Arg":
      case "Text":
      case "Pattern":
      case "BracedString":
      case "UserCommand":
        return this.evalParts(n.parts as ASTNode[], ctx);

      // ── Function call ────────────────────────────────────────────────────
      case "FunctionCall":
        return this.evalFunction(node, ctx);

      // ── Command nodes — side effects only, return empty string ──────────
      case "CommandList":
      case "AtCommand":
      case "AttributeSet":
        await this.exec(node, ctx);
        return "";

      // ── Patterns — produce their printed form; registration is host work ─
      case "DollarPattern":
      case "ListenPattern":
        return "";

      default:
        return "";
    }
  }

  /** Execute a node for its side effects (commands). */
  async exec(node: ASTNode, ctx: EvalContext): Promise<void> {
    // deno-lint-ignore no-explicit-any
    const n = node as any;

    switch (node.type) {
      case "CommandList":
        for (const cmd of n.commands as ASTNode[]) {
          await this.exec(cmd, ctx);
        }
        break;

      case "AtCommand": {
        const name = (n.name as string).toLowerCase();
        const impl = this.commands.get(name);
        const obj = n.object ? await this.eval(n.object as ASTNode, ctx) : null;
        const val = n.value  ? await this.eval(n.value  as ASTNode, ctx) : null;
        if (impl) {
          await impl.exec(n.switches as string[], obj, val, ctx, this);
        } else if (this.fallbackCommand) {
          await this.fallbackCommand(n.name as string, n.switches as string[], obj, val, ctx, this);
        }
        break;
      }

      case "AttributeSet": {
        const impl = this.commands.get("&");
        if (!impl) break;
        const obj = await this.eval(n.object as ASTNode, ctx);
        const val = n.value ? await this.eval(n.value as ASTNode, ctx) : null;
        await impl.exec([], obj, val != null ? `${n.attribute}=${val}` : n.attribute, ctx, this);
        break;
      }

      default:
        // Non-command in exec position — evaluate for side effects (e.g. a UserCommand
        // that contains embedded [pemit(...)] blocks).
        await this.eval(node, ctx);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async evalParts(parts: ASTNode[], ctx: EvalContext): Promise<string> {
    const chunks: string[] = [];
    let total = 0;
    for (const p of parts) {
      const chunk = await this.eval(p, ctx);
      total += chunk.length;
      if (total > ctx.maxOutputLen) return "#-1 OUTPUT LIMIT EXCEEDED";
      chunks.push(chunk);
    }
    return chunks.join("");
  }

  private async evalFunction(node: ASTNode, ctx: EvalContext): Promise<string> {
    // deno-lint-ignore no-explicit-any
    const n    = node as any;
    const name = (n.name as string).toLowerCase();
    const impl = this.functions.get(name);

    if (!impl) return `#-1 FUNCTION (${n.name}) NOT FOUND`;

    const args = n.args as ASTNode[];
    if (args.length < impl.minArgs)
      return `#-1 FUNCTION (${n.name}) REQUIRES AT LEAST ${impl.minArgs} ARGUMENT(S)`;
    if (args.length > impl.maxArgs)
      return `#-1 FUNCTION (${n.name}) TAKES AT MOST ${impl.maxArgs} ARGUMENT(S)`;

    try {
      if (impl.eval === "lazy") {
        const thunks: EvalThunk[] = args.map(arg =>
          (override?: Partial<EvalContext>) =>
            this.eval(arg, override ? { ...ctx, ...override } : ctx)
        );
        return (await impl.exec(thunks, ctx, this)) ?? "";
      }
      const vals: string[] = [];
      for (const arg of args) vals.push(await this.eval(arg, ctx));
      return (await impl.exec(vals, ctx, this)) ?? "";
    } catch (e: unknown) {
      return `#-1 ${e instanceof Error ? e.message.toUpperCase() : "ERROR"}`;
    }
  }

  private async evalSub(code: string, ctx: EvalContext): Promise<string> {
    // Custom substitution handlers — checked before built-ins
    for (const { match, fn } of this.subHandlers) {
      if (typeof match === "string" ? match === code : match(code)) {
        return fn(code, ctx);
      }
    }
    // Positional arguments
    if (/^[0-9]$/.test(code))          return ctx.args[parseInt(code)] ?? "";
    // Registers
    if (code.startsWith("q"))           return ctx.registers.get(code.slice(1)) ?? "";
    // Context objects
    if (code === "#")                   return ctx.enactor;
    if (code === ":")                   return ctx.enactor;  // objid — same as enactor in flat-UUID systems
    if (code === "!")                   return ctx.executor;
    if (code === "@")                   return ctx.caller ?? "";
    if (code === "+")                   return String(ctx.args.length);
    // Formatting characters
    if (code === "r" || code === "R")   return "\r\n";
    if (code === "t" || code === "T")   return "\t";
    if (code === "b" || code === "B")   return " ";
    if (code === "%")                   return "%";
    if (code === "[")                   return "[";
    if (code === "]")                   return "]";
    if (code === ",")                   return ",";
    if (code === ";")                   return ";";
    if (code === "\\")                  return "\\";
    // Name — needs DB
    if (code === "N")                   return this.accessor.getName(ctx.enactor);
    if (code === "n")                   return (await this.accessor.getName(ctx.enactor)).toLowerCase();
    // Location — needs DB
    if (code === "L")                   return await this.resolveLocation(ctx);
    // Iter variables via %i0–%i9
    if (/^i[0-9]$/.test(code)) {
      const depth = parseInt(code[1]);
      return ctx.iterStack[depth]?.item ?? "";
    }
    // Attribute shorthand %=ATTRNAME — read from enactor
    if (code.startsWith("="))           return (await this.accessor.getAttr(ctx.enactor, code.slice(1))) ?? "";
    // ANSI codes — pass through as-is for the host to render
    if (/^[xXcC]/.test(code))          return `%${code}`;
    return "";
  }

  private evalSpecialVar(code: string, ctx: EvalContext): string {
    const frame: IterFrame | undefined = ctx.iterStack[0];
    if (code === "##") return frame?.item  ?? "";
    if (code === "#@") return frame ? String(frame.index) : "";
    if (code === "#$") return "";  // last name-lookup dbref — host concern
    return "";
  }

  private async resolveLocation(ctx: EvalContext): Promise<string> {
    try {
      const target = await this.accessor.resolveTarget(ctx.enactor, "loc(me)");
      return target ?? "";
    } catch {
      return "";
    }
  }
}
