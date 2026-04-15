/**
 * @module
 * Static analysis for softcode: `lint()` runs built-in rules and returns
 * `Diagnostic` findings with severity, rule ID, and the offending AST node.
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

/** Options passed to the {@link lint} function. */
export interface LintOptions {
  /** Whitelist of rule IDs to run.  Omit to run all rules. */
  rules?: string[];
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
    diags.push(...checkArgCount(root));
  }
  if (enabled.has("register-before-set")) {
    diags.push(...checkRegisterBeforeSet(root));
  }

  return diags;
}
