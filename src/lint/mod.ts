/**
 * @module
 * Static analysis for softcode: `lint()` runs built-in rules and returns
 * `Diagnostic` findings with severity, rule ID, and the offending AST node.
 *
 * @example
 * ```ts
 * import { parse } from "@ursamu/mushcode/parse";
 * import { lint }  from "@ursamu/mushcode/lint";
 *
 * const ast  = parse("$finger:@pemit %#=[u(me/FN)]");
 * const diags = lint(ast);
 * diags.forEach(d => console.log(`[${d.severity}] ${d.rule}: ${d.message}`));
 * ```
 */
import type { ASTNode }                from "../../parser/mod.ts";
import { walk }                         from "../traverse/walk.ts";
import { checkMissingWildcard }         from "./rules/missing_wildcard.ts";
import { checkIterVarOutsideIter }      from "./rules/iter_var_outside_iter.ts";
import { checkArgCount }                from "./rules/arg_count.ts";
import { checkRegisterBeforeSet }       from "./rules/register_before_set.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Severity level of a lint diagnostic. */
export type Severity = "error" | "warning" | "info";

/** A single lint finding produced by a rule. */
export interface Diagnostic {
  /** Identifier for the rule that produced this diagnostic. */
  rule:     string;
  /** How serious the finding is. */
  severity: Severity;
  /** Human-readable description of the issue. */
  message:  string;
  /** The AST node most closely associated with the issue. */
  node:     ASTNode;
}

/**
 * A single lint rule implementation.
 *
 * Rules are pure functions: given the AST root they return an array of
 * {@link Diagnostic} findings (empty when nothing is wrong).
 *
 * Plugin authors export an array of `RuleImpl` values (e.g. `rhostLintRules`)
 * and callers pass them via {@link LintOptions.extraRules}.
 */
export type RuleImpl = (root: ASTNode) => Diagnostic[];

/** Options passed to the {@link lint} function. */
export interface LintOptions {
  /** Whitelist of rule IDs to run.  Omit to run all rules. */
  rules?: string[];
  /**
   * Extra `[minArgs, maxArgs]` arity entries to augment the built-in table for
   * the `arg-count` rule.  Pass a plugin's arity map here so the linter can
   * flag wrong call-sites for platform-specific functions.
   *
   * Entries in `extraArities` override the built-in table when names collide.
   *
   * @example
   * ```ts
   * import { lint }         from "@ursamu/mushcode/lint";
   * import { rhostArities } from "@ursamu/mushcode/rhost";
   *
   * const diags = lint(ast, { extraArities: rhostArities });
   * // [vadd(1 2)] now warns: vadd() requires at least 2 arguments, got 1
   * ```
   */
  extraArities?: Record<string, [number, number]>;
  /**
   * Additional rule implementations to run after the built-in rules.
   *
   * Each entry is a {@link RuleImpl} — a plain function that receives the AST
   * root and returns an array of {@link Diagnostic} findings.  Plugin authors
   * export these arrays (e.g. `rhostLintRules`) so callers can opt in:
   *
   * @example
   * ```ts
   * import { lint }              from "@ursamu/mushcode/lint";
   * import { rhostArities,
   *          rhostLintRules }    from "@ursamu/mushcode/rhost";
   *
   * const diags = lint(ast, {
   *   extraArities: rhostArities,
   *   extraRules:   rhostLintRules,
   * });
   * // [digest(md5,data)] → rhost-digest-algorithm warning
   * // [lcon(here,players)] → rhost-lcon-type warning
   * ```
   */
  extraRules?: RuleImpl[];
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Derive an arity map from a record of function implementations.
 *
 * Accepts any object whose values expose `minArgs` and `maxArgs` — compatible
 * with `FunctionImpl` from `@ursamu/mushcode/eval` as well as hand-written
 * arity objects.
 *
 * Use this to build an `extraArities` map for {@link lint} from any plugin's
 * function table without importing the lint module into the plugin itself.
 *
 * @param fns - A record of `{ minArgs, maxArgs }` entries (e.g. a plugin's
 *   `functions` map).
 * @returns A `Record<string, [number, number]>` ready to pass as
 *   `LintOptions.extraArities`.
 *
 * @example
 * ```ts
 * import { ariasFromFunctions } from "@ursamu/mushcode/lint";
 * import { myPlugin }            from "./my-plugin.ts";
 *
 * const myArities = ariasFromFunctions(myPlugin.functions ?? {});
 * const diags = lint(ast, { extraArities: myArities });
 * ```
 */
export function ariasFromFunctions(
  fns: Record<string, { minArgs: number; maxArgs: number }>,
): Record<string, [number, number]> {
  return Object.fromEntries(
    Object.entries(fns).map(([name, impl]) => [name.toLowerCase(), [impl.minArgs, impl.maxArgs]]),
  );
}

// ── Available rules ───────────────────────────────────────────────────────────

/** All built-in rule IDs.  Pass a subset to `LintOptions.rules` to enable only those rules. */
export const RULES = [
  "missing-wildcard",
  "iter-var-outside-iter",
  "arg-count",
  "register-before-set",
] as const;

/** Union type of every known rule ID string. */
export type RuleId = (typeof RULES)[number];

// ── lint ──────────────────────────────────────────────────────────────────────

/**
 * Run static analysis on an AST and return an array of diagnostics.
 *
 * Rules are applied at every DollarPattern/ListenPattern/FunctionCall/… node
 * anywhere in the tree, so this works correctly on CommandList roots too.
 *
 * @example
 * const diags = lint(parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]"));
 * diags.forEach(d => console.log(`[${d.severity}] ${d.rule}: ${d.message}`));
 */
export function lint(root: ASTNode, opts?: LintOptions): Diagnostic[] {
  const enabled = new Set(opts?.rules ?? RULES);
  const diags: Diagnostic[] = [];

  // Rules that examine individual nodes as we walk
  walk(root, {
    enter(node) {
      if (enabled.has("missing-wildcard")) {
        diags.push(...checkMissingWildcard(node));
      }
    },
  });

  // Rules that need a full-tree view (run once on the root)
  if (enabled.has("iter-var-outside-iter")) {
    diags.push(...checkIterVarOutsideIter(root));
  }
  if (enabled.has("arg-count")) {
    diags.push(...checkArgCount(root, opts?.extraArities));
  }
  if (enabled.has("register-before-set")) {
    diags.push(...checkRegisterBeforeSet(root));
  }

  // Extra rules supplied by the caller (e.g. platform plugin rule packs)
  for (const rule of opts?.extraRules ?? []) {
    diags.push(...rule(root));
  }

  return diags;
}
