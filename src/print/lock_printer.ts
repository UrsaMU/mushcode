import type { ASTNode } from "../../parser/mod.ts";

/**
 * Print a lock expression subtree back to its canonical string form.
 * Only called when the root was parsed with the "LockExpr" start rule.
 */
export function printLock(node: ASTNode): string {
  return printLockNode(node, null);
}

function printLockNode(node: ASTNode, parentType: string | null): string {
  switch (node.type) {
    case "LockOr": {
      const inner = (node.operands as ASTNode[])
        .map(op => printLockNode(op, "LockOr"))
        .join("|");
      // Parens needed when OR appears inside AND context
      return parentType === "LockAnd" ? `(${inner})` : inner;
    }
    case "LockAnd": {
      return (node.operands as ASTNode[])
        .map(op => printLockNode(op, "LockAnd"))
        .join("&");
    }
    case "LockNot": {
      const operand = node.operand as ASTNode;
      const inner = printLockNode(operand, "LockNot");
      // Re-add parens if the operand is a compound expression
      const needsParens = operand.type === "LockOr" || operand.type === "LockAnd";
      return needsParens ? `!(${inner})` : `!${inner}`;
    }
    case "LockMe":         return "me";
    case "LockDbref":      return node.dbref as string;
    case "LockFlagCheck":  return `flag^${node.flag}`;
    case "LockTypeCheck":  return `type^${node.typeName}`;
    case "LockAttrCheck":  return `attr^${node.attribute}`;
    case "LockPlayerName": return `=${node.name}`;
    default:
      throw new Error(`printLock: unexpected node type "${node.type}"`);
  }
}
