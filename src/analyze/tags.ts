import type { ASTNode } from "../../parser/mod.ts";
import { findAll }        from "../traverse/walk.ts";

/**
 * Return a deduplicated, sorted list of every tag name referenced by a `#tagname`
 * TagRef node anywhere in the tree.
 */
export function extractTagRefs(root: ASTNode): string[] {
  const names = findAll(root, "TagRef").map(n => n.name as string);
  return [...new Set(names)].sort();
}
