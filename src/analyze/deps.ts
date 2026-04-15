import type { ASTNode }  from "../../parser/mod.ts";
import { findAll }         from "../traverse/walk.ts";
import { print }           from "../print/mod.ts";

export interface DepEntry {
  /**
   * "u"       — u(attr, …) call (attribute function invocation)
   * "trigger" — @trigger obj/attr=arg
   * "get"     — get(obj/attr) or v(attr) read
   */
  type:   "u" | "trigger" | "get";
  /** Printed target, e.g. "me/FN_FINGER", "#weather/ATTR", "[tag(db)]/ATTR". */
  target: string;
}

/**
 * Extract dependency edges from the tree: u() calls, @trigger commands, and
 * get()/v() attribute reads.
 *
 * Targets are the printed form of the first argument (for function calls) or
 * the object slot (for @trigger).  Dynamic targets (eval blocks) are included
 * as-printed — the caller decides how to interpret them.
 */
export function extractDeps(root: ASTNode): DepEntry[] {
  const deps: DepEntry[] = [];

  for (const node of findAll(root, "FunctionCall")) {
    const name = (node.name as string).toLowerCase();
    const args  = node.args as ASTNode[];
    if (args.length === 0) continue;
    const target = print(args[0]);

    if (name === "u") {
      deps.push({ type: "u", target });
    } else if (name === "get") {
      deps.push({ type: "get", target });
    } else if (name === "v") {
      deps.push({ type: "get", target });
    }
  }

  for (const node of findAll(root, "AtCommand")) {
    const name = (node.name as string).toLowerCase();
    if (name !== "trigger") continue;
    if (!node.object) continue;
    deps.push({ type: "trigger", target: print(node.object as ASTNode) });
  }

  return deps;
}
