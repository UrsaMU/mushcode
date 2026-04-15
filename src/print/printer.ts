import type { ASTNode } from "../../parser/mod.ts";
import { printLock }   from "./lock_printer.ts";

// ── Options ───────────────────────────────────────────────────────────────────

/** Controls how `CommandList` separators are rendered in the output. */
export type PrintMode = "compact" | "pretty";

/** Options for the {@link print} function. */
export interface PrintOptions {
  /** "compact" (default): CommandList joined by ";".
   *  "pretty": CommandList joined by ";\n". */
  mode?: PrintMode;
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Convert an AST node back to a canonical softcode string.
 *
 * The output is semantically equivalent to the original source but whitespace
 * may be normalised (e.g. `@pemit%#=x` becomes `@pemit %#=x`).
 * Lock-expression nodes (LockOr, LockAnd, …) produced by the "LockExpr" start
 * rule are printed via the lock printer.
 */
export function print(node: ASTNode, opts?: PrintOptions): string {
  return printNode(node, opts);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

function printNode(node: ASTNode, opts?: PrintOptions): string {
  // deno-lint-ignore no-explicit-any
  const n = node as any;
  switch (node.type) {

    // ── Commands ──────────────────────────────────────────────────────────────

    case "CommandList": {
      const sep = opts?.mode === "pretty" ? ";\n" : ";";
      return (n.commands as ASTNode[]).map(c => printNode(c, opts)).join(sep);
    }

    case "AtCommand": {
      const sw = (n.switches as string[]).map((s: string) => `/${s}`).join("");
      const obj = n.object ? " " + printNode(n.object as ASTNode, opts) : "";
      const val = n.value  != null ? "=" + printNode(n.value  as ASTNode, opts) : "";
      return `@${n.name}${sw}${obj}${val}`;
    }

    case "AttributeSet": {
      const obj = printNode(n.object as ASTNode, opts);
      const val = n.value != null ? "=" + printNode(n.value as ASTNode, opts) : "";
      return `&${n.attribute} ${obj}${val}`;
    }

    case "UserCommand":
      return (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("");

    // ── Patterns ──────────────────────────────────────────────────────────────

    case "DollarPattern":
      return "$" + printNode(n.pattern as ASTNode, opts)
           + ":" + printNode(n.action  as ASTNode, opts);

    case "ListenPattern":
      return "^" + printNode(n.pattern as ASTNode, opts)
           + ":" + printNode(n.action  as ASTNode, opts);

    case "PatternAlts":
      return (n.patterns as ASTNode[]).map(p => printNode(p, opts)).join(";");

    case "Pattern":
      return (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("");

    case "Wildcard":
      return n.wildcard as string;   // "*" or "?"

    // ── Expression containers ─────────────────────────────────────────────────

    case "EvalBlock":
      return "[" + (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("") + "]";

    case "BracedString":
      return "{" + (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("") + "}";

    case "FunctionCall": {
      const args = (n.args as ASTNode[]).map(a => printNode(a, opts)).join(",");
      return `${n.name}(${args})`;
    }

    case "Arg":
      return (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("");

    case "Text":
      return (n.parts as ASTNode[]).map(p => printNode(p, opts)).join("");

    // ── Leaves ────────────────────────────────────────────────────────────────

    case "Literal":
      return n.value as string;

    case "Escape":
      return "\\" + (n.char as string);

    case "Substitution":
      return "%" + (n.code as string);

    case "SpecialVar":
      return n.code as string;   // "##", "#@", "#$" — already includes #

    case "TagRef":
      return "#" + (n.name as string);

    // ── Lock expressions ──────────────────────────────────────────────────────
    // These appear when using the "LockExpr" start rule.

    case "LockOr":
    case "LockAnd":
    case "LockNot":
    case "LockMe":
    case "LockDbref":
    case "LockFlagCheck":
    case "LockTypeCheck":
    case "LockAttrCheck":
    case "LockPlayerName":
      return printLock(node);

    default:
      throw new Error(`print: unhandled node type "${node.type}"`);
  }
}
