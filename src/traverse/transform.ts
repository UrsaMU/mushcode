import type { ASTNode } from "../../parser/mod.ts";
import { CHILD_SLOTS } from "./child_slots.ts";

// ── Transformer ───────────────────────────────────────────────────────────────

/**
 * A function called on each node, top-down.
 *
 * Return values:
 *   `undefined`  — keep the node as-is and recurse into its children
 *   `ASTNode`    — replace the node with this value, then recurse into it
 *   `null`       — when in an array slot, remove the node from the array;
 *                  when in a single slot, set the field to null
 */
export type Transformer = (node: ASTNode) => ASTNode | null | undefined;

// ── transform ─────────────────────────────────────────────────────────────────

/**
 * Produce a new tree by applying `fn` to every node top-down.
 *
 * The function is called on each node before its children are processed.
 * Returning a replacement node causes that replacement's children to be
 * processed next (not the original children).
 *
 * The original tree is never mutated; a new object is returned whenever
 * any node in the subtree changes.
 *
 * @example
 * // Replace every TagRef with a Literal placeholder
 * const out = transform(ast, (n) => {
 *   if (n.type === "TagRef") return { type: "Literal", value: `<tag:${n.name}>` };
 * });
 */
export function transform(root: ASTNode, fn: Transformer): ASTNode {
  return transformNode(root, fn) ?? root;
}

function transformNode(node: ASTNode, fn: Transformer): ASTNode | null {
  // 1. Apply fn to this node first (top-down)
  const replacement = fn(node);
  if (replacement === null) return null; // removal signal
  const current = replacement ?? node;

  // 2. Recurse into children of `current`
  const slots = CHILD_SLOTS[current.type] ?? [];
  if (slots.length === 0) return current; // leaf — nothing to recurse

  // deno-lint-ignore no-explicit-any
  const patches: Record<string, any> = {};
  let changed = replacement !== undefined; // track whether we need a new object

  for (const { field, kind } of slots) {
    // deno-lint-ignore no-explicit-any
    const val = (current as any)[field];

    if (kind === "array") {
      if (!Array.isArray(val)) continue;
      const newArr: ASTNode[] = [];
      let arrChanged = false;
      for (const item of val) {
        if (!item || typeof item !== "object" || !item.type) {
          newArr.push(item);
          continue;
        }
        const result = transformNode(item as ASTNode, fn);
        if (result === null) { arrChanged = true; continue; } // removed
        newArr.push(result);
        if (result !== item) arrChanged = true;
      }
      if (arrChanged) { patches[field] = newArr; changed = true; }

    } else {
      if (!val || typeof val !== "object" || !val.type) continue;
      const result = transformNode(val as ASTNode, fn);
      if (result !== val) {
        patches[field] = result ?? null;
        changed = true;
      }
    }
  }

  return changed ? { ...current, ...patches } as ASTNode : current;
}
