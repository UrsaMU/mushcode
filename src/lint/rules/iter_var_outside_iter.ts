import type { ASTNode }  from "../../../parser/mod.ts";
import type { Diagnostic } from "../mod.ts";
import { walk }             from "../../traverse/walk.ts";

const ITER_VARS = new Set(["##", "#@", "#$"]);

/**
 * iter-var-outside-iter
 *
 * Reports when ##, #@, or #$ (iteration SpecialVars) appear outside an
 * iter() function call or @dolist command, where they have no defined value.
 *
 * Valid contexts:
 *   iter(list, body) — ## is the current element in `body`
 *   @dolist list={body} — ## is the current element in `body`
 *
 * The rule is conservative: any nesting under an iter/dolist suppresses the
 * warning for the entire subtree, avoiding false positives on patterns like
 * iter(iter(inner, ##), ##).
 */
export function checkIterVarOutsideIter(root: ASTNode): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let iterDepth = 0;

  walk(root, {
    enter(node) {
      if (isIterContext(node)) {
        iterDepth++;
        return; // continue into children
      }
      if (node.type === "SpecialVar" && ITER_VARS.has(node.code as string)) {
        if (iterDepth === 0) {
          diagnostics.push({
            rule:     "iter-var-outside-iter",
            severity: "warning",
            message:  `"${node.code}" is only meaningful inside iter() or @dolist`,
            node,
          });
        }
      }
    },
    leave(node) {
      if (isIterContext(node)) iterDepth--;
    },
  });

  return diagnostics;
}

function isIterContext(node: ASTNode): boolean {
  if (node.type === "FunctionCall") {
    return (node.name as string).toLowerCase() === "iter" ||
           (node.name as string).toLowerCase() === "ilist" ||
           (node.name as string).toLowerCase() === "map";
  }
  if (node.type === "AtCommand") {
    return (node.name as string).toLowerCase() === "dolist";
  }
  return false;
}
