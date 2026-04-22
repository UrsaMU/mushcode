import type { ASTNode }  from "../../../parser/mod.ts";
import type { Diagnostic } from "../mod.ts";
import { findAll }          from "../../traverse/walk.ts";
import { ARITIES }          from "../builtin_arities.ts";

/**
 * arg-count
 *
 * Reports FunctionCall nodes where the number of arguments falls outside the
 * known [minArgs, maxArgs] range for that built-in function.
 *
 * Only functions listed in ARITIES (plus any supplied via `extraArities`) are
 * checked; user-defined functions and unrecognised names are silently skipped.
 *
 * @param root - The AST root to inspect.
 * @param extraArities - Additional `[minArgs, maxArgs]` entries to merge with
 *   the built-in table.  Plugin arity maps (e.g. `rhostArities`) should be
 *   passed here.  Entries override the built-in table when names collide.
 */
export function checkArgCount(
  root: ASTNode,
  extraArities?: Record<string, [number, number]>,
): Diagnostic[] {
  const allArities = extraArities ? { ...ARITIES, ...extraArities } : ARITIES;
  const diagnostics: Diagnostic[] = [];

  for (const node of findAll(root, "FunctionCall")) {
    const name  = (node.name as string).toLowerCase();
    const arity = allArities[name];
    if (!arity) continue; // not a known built-in — skip

    const [min, max] = arity;
    const argc = (node.args as ASTNode[]).length;

    if (argc < min) {
      diagnostics.push({
        rule:     "arg-count",
        severity: "warning",
        message:  `${node.name}() requires at least ${min} argument(s), got ${argc}`,
        node,
      });
    } else if (argc > max) {
      diagnostics.push({
        rule:     "arg-count",
        severity: "warning",
        message:  `${node.name}() accepts at most ${max} argument(s), got ${argc}`,
        node,
      });
    }
  }

  return diagnostics;
}
