import type { ASTNode } from "../../parser/mod.ts";
import { CHILD_SLOTS } from "./child_slots.ts";

// ── Visitor ──────────────────────────────────────────────────────────────────

/**
 * Depth-first visitor hooks.
 *
 * `enter` is called before a node's children are visited.
 *   Return `false` to skip all children of this node (leave is NOT called).
 *
 * `leave` is called after all children have been visited.
 */
export interface Visitor {
  enter?: (node: ASTNode) => false | void;
  leave?: (node: ASTNode) => void;
}

// ── walk ─────────────────────────────────────────────────────────────────────

/**
 * Walk an AST depth-first, calling visitor hooks at each node.
 *
 * @example
 * const fnNames: string[] = [];
 * walk(ast, {
 *   enter(node) {
 *     if (node.type === "FunctionCall") fnNames.push(node.name as string);
 *   }
 * });
 */
export function walk(node: ASTNode, visitor: Visitor): void {
  if (!node || typeof node !== "object") return;

  const result = visitor.enter?.(node);
  if (result === false) return; // skip children and leave

  const slots = CHILD_SLOTS[node.type] ?? [];
  for (const { field, kind } of slots) {
    // deno-lint-ignore no-explicit-any
    const val = (node as any)[field];
    if (val == null) continue;

    if (kind === "array") {
      if (!Array.isArray(val)) continue;
      for (const child of val) {
        if (child && typeof child === "object" && child.type) {
          walk(child as ASTNode, visitor);
        }
      }
    } else {
      if (typeof val === "object" && val.type) {
        walk(val as ASTNode, visitor);
      }
    }
  }

  visitor.leave?.(node);
}

// ── findAll / findFirst ───────────────────────────────────────────────────────

/** Collect every node of the given type anywhere in the tree. */
export function findAll(root: ASTNode, type: string): ASTNode[] {
  const found: ASTNode[] = [];
  walk(root, { enter(n) { if (n.type === type) found.push(n); } });
  return found;
}

/** Return the first node of the given type, or `null` if none exists. */
export function findFirstOrNull(root: ASTNode, type: string): ASTNode | null {
  return findAll(root, type)[0] ?? null;
}

/** Return the first node of the given type, or throw if none exists. */
export function findFirst(root: ASTNode, type: string): ASTNode {
  const n = findFirstOrNull(root, type);
  if (n == null) throw new Error(`No node of type "${type}" found in tree`);
  return n;
}
