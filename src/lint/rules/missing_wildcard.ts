import type { ASTNode }  from "../../../parser/mod.ts";
import type { Diagnostic } from "../mod.ts";
import { findAll }          from "../../traverse/walk.ts";

/**
 * missing-wildcard
 *
 * Reports when a DollarPattern or ListenPattern action uses a positional
 * substitution %N (N ≥ 1) but the pattern contains fewer than N wildcards.
 *
 * In TinyMUX:
 *   %0 = the full matched input (always available)
 *   %1 = first wildcard match, %2 = second, … %9 = ninth
 *
 * So if the action uses %2, the pattern must have at least 2 wildcards.
 */
export function checkMissingWildcard(node: ASTNode): Diagnostic[] {
  if (node.type !== "DollarPattern" && node.type !== "ListenPattern") return [];

  const pattern = node.pattern as ASTNode;
  const action  = node.action  as ASTNode;

  const wildcardCount = findAll(pattern, "Wildcard").length;

  const maxPositional = findAll(action, "Substitution")
    .map(s => s.code as string)
    .filter(code => /^[1-9]$/.test(code))
    .reduce((max, code) => Math.max(max, parseInt(code)), 0);

  if (maxPositional > wildcardCount) {
    return [{
      rule:     "missing-wildcard",
      severity: "warning",
      message:  `Pattern has ${wildcardCount} wildcard(s) but action uses %${maxPositional} `
              + `— needs at least ${maxPositional} wildcard(s) in pattern`,
      node: pattern,
    }];
  }
  return [];
}
