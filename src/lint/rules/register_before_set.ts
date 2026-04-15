import type { ASTNode }  from "../../../parser/mod.ts";
import type { Diagnostic } from "../mod.ts";
import { findAll }          from "../../traverse/walk.ts";

/**
 * register-before-set
 *
 * Reports %q<name> substitutions and r(<name>) calls where the named register
 * has no corresponding setq(<name>, ...) anywhere in the same attribute value.
 *
 * This catches typos (using %q0 when you meant %0) and missing initialisation.
 *
 * Limitation: purely static — cannot detect registers set in other attributes
 * called via u() before this one runs.  Use severity "info" to reflect this.
 */
export function checkRegisterBeforeSet(root: ASTNode): Diagnostic[] {
  const setRegisters = new Set<string>();
  const readNodes: Array<{ name: string; node: ASTNode }> = [];

  // Collect all setq() writes
  for (const node of findAll(root, "FunctionCall")) {
    if ((node.name as string).toLowerCase() !== "setq") continue;
    const args = node.args as ASTNode[];
    if (args.length < 1) continue;
    const nameStr = literalText(args[0]);
    if (nameStr !== null) setRegisters.add(nameStr);
  }

  // Collect all register reads — %q<name> substitutions
  for (const node of findAll(root, "Substitution")) {
    const code = node.code as string;
    if (!code.startsWith("q")) continue;
    const name = code.slice(1); // "q0" → "0", "qfoo" → "foo"
    if (name) readNodes.push({ name, node });
  }

  // Collect r(<name>) function calls
  for (const node of findAll(root, "FunctionCall")) {
    if ((node.name as string).toLowerCase() !== "r") continue;
    const args = node.args as ASTNode[];
    if (args.length !== 1) continue;
    const name = literalText(args[0]);
    if (name !== null) readNodes.push({ name, node });
  }

  return readNodes
    .filter(({ name }) => !setRegisters.has(name))
    .map(({ name, node }) => ({
      rule:     "register-before-set",
      severity: "info" as const,
      message:  `Register "%q${name}" is read but no setq("${name}", …) found in this attribute`,
      node,
    }));
}

/** Extract the literal string value of a single-literal Arg node, or null. */
function literalText(arg: ASTNode): string | null {
  if (arg.type !== "Arg") return null;
  const parts = arg.parts as ASTNode[];
  if (parts.length === 1 && parts[0].type === "Literal") {
    return parts[0].value as string;
  }
  return null;
}
