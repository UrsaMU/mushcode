import type { ASTNode }  from "../../parser/mod.ts";
import { findAll }         from "../traverse/walk.ts";
import { print }           from "../print/mod.ts";

export interface PatternEntry {
  /** Whether this is a `$command` or `^listen` trigger. */
  type:        "dollar" | "listen";
  /** Printed form of the pattern for display (e.g., "+finger *"). */
  patternText: string;
  /** The raw pattern node (Pattern or PatternAlts). */
  pattern:     ASTNode;
  /** The action to execute when the pattern matches. */
  action:      ASTNode;
}

/**
 * Extract all DollarPattern and ListenPattern nodes from the tree, returning
 * a flat list with the printed pattern text for easy display.
 *
 * Scans the entire tree so it works on CommandList roots and AttributeSet
 * values alike.
 */
export function extractCommands(root: ASTNode): PatternEntry[] {
  const entries: PatternEntry[] = [];

  for (const node of findAll(root, "DollarPattern")) {
    entries.push({
      type:        "dollar",
      patternText: print(node.pattern as ASTNode),
      pattern:     node.pattern as ASTNode,
      action:      node.action  as ASTNode,
    });
  }

  for (const node of findAll(root, "ListenPattern")) {
    entries.push({
      type:        "listen",
      patternText: print(node.pattern as ASTNode),
      pattern:     node.pattern as ASTNode,
      action:      node.action  as ASTNode,
    });
  }

  return entries;
}
