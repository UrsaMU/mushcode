/**
 * @module
 * Pattern matching and execution for `$command` and `^listen` softcode patterns.
 *
 * @example
 * ```ts
 * import { matchPattern, execPattern } from "@ursamu/mushcode/pattern";
 * import { parse } from "@ursamu/mushcode/parse";
 *
 * const ast = parse("$+greet *:@pemit %#=Hello, %1!");
 * const match = matchPattern(ast.pattern, "+greet Alice");
 * // → { input: "+greet Alice", captures: ["Alice"] }
 * ```
 */

import type { ASTNode }       from "../../parser/mod.ts";
import { parse }               from "../../parser/mod.ts";
import type { EvalContext, IEvalEngine } from "../eval/context.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The result of a successful pattern match.
 *
 * `input` is the full matched string (becomes `%0`).
 * `captures` contains wildcard captures in order (become `%1`, `%2`, …).
 */
export interface PatternMatch {
  /** The entire input string — becomes %0 in the action. */
  input: string;
  /** Wildcard captures in order — become %1, %2, … %9. */
  captures: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Escape all special regex metacharacters in a literal string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── matchPattern ──────────────────────────────────────────────────────────────

/**
 * Match an input string against a `Pattern` or `PatternAlts` AST node.
 *
 * Matching is case-insensitive.  Returns `null` if the input does not match.
 *
 * @param patternNode  A `Pattern` or `PatternAlts` node from the parser.
 * @param input        The raw input string to test.
 */
export function matchPattern(
  patternNode: ASTNode,
  input: string,
): PatternMatch | null {
  if (patternNode.type === "PatternAlts") {
    // Try each alternative in order; return the first match.
    for (const alt of patternNode.patterns as ASTNode[]) {
      const m = matchPattern(alt, input);
      if (m) return m;
    }
    return null;
  }

  if (patternNode.type === "Pattern") {
    return matchSinglePattern(patternNode, input);
  }

  // Unexpected node type — treat as no match.
  return null;
}

/**
 * Build a regex from a single `Pattern` node and test against `input`.
 */
function matchSinglePattern(pattern: ASTNode, input: string): PatternMatch | null {
  const parts = pattern.parts as ASTNode[];

  // Build an array of regex fragments.  Track which fragments are captures.
  const regexParts: string[] = [];

  // We need to know if a `*` wildcard is the last one so we can use greedy
  // matching for it (all others are non-greedy to let later pieces match).
  // Collect indices of `*` wildcards first.
  const starIndices: number[] = [];
  parts.forEach((p, i) => {
    if (p.type === "Wildcard" && (p as ASTNode & { wildcard: string }).wildcard === "*") {
      starIndices.push(i);
    }
  });
  const lastStarIdx = starIndices.length > 0 ? starIndices[starIndices.length - 1] : -1;

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i] as ASTNode & { wildcard?: string; value?: string; char?: string };
    switch (p.type) {
      case "Literal":
        regexParts.push(escapeRegex((p.value ?? "") as string));
        break;
      case "Escape":
        regexParts.push(escapeRegex((p.char ?? "") as string));
        break;
      case "Wildcard":
        if (p.wildcard === "*") {
          // Last star is greedy so it consumes the remainder; earlier stars
          // are non-greedy so later literal pieces can anchor properly.
          regexParts.push(i === lastStarIdx ? "(.*)" : "(.*?)");
        } else {
          // "?" — match exactly one character, captured.
          regexParts.push("(.)");
        }
        break;
      default:
        // Unknown piece — treat as literal empty.
        break;
    }
  }

  const regex = new RegExp("^" + regexParts.join("") + "$", "i");
  const m = input.match(regex);
  if (!m) return null;

  return {
    input,
    captures: m.slice(1),
  };
}

// ── execPattern ───────────────────────────────────────────────────────────────

/**
 * Parse `attrSource`, match `input` against it, and execute the action if
 * the pattern matches.
 *
 * Handles both `DollarPattern` (`$…:…`) and `ListenPattern` (`^…:…`).
 *
 * Returns `null` when:
 *   - the attribute is not a dollar/listen pattern, or
 *   - the input does not match the pattern.
 *
 * Returns the evaluated result of the action (typically `""` for command-only
 * actions) when the pattern matches.
 *
 * @param attrSource  Raw softcode attribute string, e.g. `"$+greet *:@pemit %#=Hi, %1!"`.
 * @param input       Player input to test against the pattern.
 * @param ctx         Evaluation context (enactor, executor, etc.).
 * @param engine      The engine to use for evaluating the action.
 */
export async function execPattern(
  attrSource: string,
  input: string,
  ctx: EvalContext,
  engine: IEvalEngine,
): Promise<string | null> {
  const ast = parse(attrSource, "Start");

  if (ast.type !== "DollarPattern" && ast.type !== "ListenPattern") {
    return null;
  }

  const patternNode = ast.pattern as ASTNode;
  const actionNode  = ast.action  as ASTNode;

  const match = matchPattern(patternNode, input);
  if (!match) return null;

  // Build a child context with %0 = full input, %1–%9 = captures.
  const newArgs: string[] = [match.input, ...match.captures.slice(0, 9)];

  const subCtx: EvalContext = {
    ...ctx,
    args: newArgs,
  };

  return await engine.eval(actionNode, subCtx);
}
