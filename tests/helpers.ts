// ============================================================================
// Shared test helpers for mux-softcode-parser e2e tests
// ============================================================================

import { parse, type ASTNode, ParseError } from "../parser/mod.ts";
export { parse, ParseError };
export type { ASTNode };

// ── Parse helpers ─────────────────────────────────────────────────────────────

/** Parse text as a full attribute value (Start rule). */
export function parseAttr(text: string): ASTNode {
  return parse(text, "Start");
}

/** Parse text as a lock expression. */
export function parseLock(text: string): ASTNode {
  return parse(text, "LockExpr");
}

/** Assert parse succeeds and return the AST. */
export function mustParse(text: string): ASTNode {
  return parseAttr(text);
}

/** Assert parse FAILS (used for regression / negative tests). */
export function mustFail(text: string, ctx = "Start"): ParseError {
  try {
    parse(text, ctx as "Start" | "LockExpr");
  } catch (e) {
    if (e instanceof ParseError) return e;
    throw e;
  }
  throw new Error(`Expected parse of ${JSON.stringify(text)} to fail but it succeeded`);
}

// ── AST query helpers ─────────────────────────────────────────────────────────

/** Collect all nodes of a given type anywhere in the tree. */
export function findAll(node: ASTNode, type: string): ASTNode[] {
  const found: ASTNode[] = [];
  function walk(n: ASTNode) {
    if (!n || typeof n !== "object") return;
    if (n.type === type) found.push(n);
    for (const val of Object.values(n)) {
      if (Array.isArray(val)) val.forEach((v) => { if (v?.type) walk(v); });
      else if (val?.type) walk(val as ASTNode);
    }
  }
  walk(node);
  return found;
}

/** Find the first node of a given type, or throw. */
export function findFirst(node: ASTNode, type: string): ASTNode {
  const results = findAll(node, type);
  if (results.length === 0) throw new Error(`No node of type "${type}" found`);
  return results[0];
}

/** Collect all Literal values in order (depth-first). */
export function literals(node: ASTNode): string[] {
  return findAll(node, "Literal").map((n) => n.value as string);
}

/** Collect all Substitution codes in order. */
export function substitutions(node: ASTNode): string[] {
  return findAll(node, "Substitution").map((n) => n.code as string);
}
