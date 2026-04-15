// ============================================================================
// Traverse — walk, transform, findAll, findFirst, findFirstOrNull
// ============================================================================

import { assertEquals, assertThrows } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode } from "../parser/mod.ts";
import {
  walk,
  transform,
  findAll,
  findFirst,
  findFirstOrNull,
} from "../src/traverse/mod.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function p(text: string): ASTNode {
  return parse(text, "Start");
}

// Collect node types in enter order
function enterTypes(root: ASTNode): string[] {
  const types: string[] = [];
  walk(root, { enter(n) { types.push(n.type); } });
  return types;
}

// ── walk ───────────────────────────────────────────────────────────────────────

describe("walk — enter/leave hooks", () => {
  it("visits every node depth-first", () => {
    const ast = p("[add(1,2)]");
    const visited: string[] = [];
    walk(ast, { enter(n) { visited.push(n.type); } });
    // Must visit UserCommand, EvalBlock, FunctionCall, and two Arg+Literal nodes
    const unique = [...new Set(visited)];
    assertEquals(unique.includes("UserCommand"), true);
    assertEquals(unique.includes("EvalBlock"), true);
    assertEquals(unique.includes("FunctionCall"), true);
  });

  it("leave is called after children", () => {
    const ast = p("[f(x)]");
    const log: string[] = [];
    walk(ast, {
      enter(n) { log.push(`enter:${n.type}`); },
      leave(n) { log.push(`leave:${n.type}`); },
    });
    const enterIdx  = log.indexOf("enter:FunctionCall");
    const leaveIdx  = log.indexOf("leave:FunctionCall");
    const argIdx    = log.indexOf("enter:Arg");
    assertEquals(enterIdx < argIdx, true, "enter:FunctionCall before enter:Arg");
    assertEquals(argIdx < leaveIdx, true, "enter:Arg before leave:FunctionCall");
  });

  it("returning false from enter skips children (leave not called)", () => {
    const ast = p("[f(x)]");
    const visited: string[] = [];
    walk(ast, {
      enter(n) {
        visited.push(n.type);
        if (n.type === "FunctionCall") return false;
      },
      leave(n) { visited.push(`leave:${n.type}`); },
    });
    assertEquals(visited.includes("Arg"), false, "Arg (child of FunctionCall) skipped");
    assertEquals(visited.includes("leave:FunctionCall"), false, "leave not called when false returned");
  });

  it("walk on a leaf node (Literal) fires enter+leave once with no children", () => {
    const leaf: ASTNode = { type: "Literal", value: "hello" };
    const log: string[] = [];
    walk(leaf, { enter(n) { log.push(`e:${n.type}`); }, leave(n) { log.push(`l:${n.type}`); } });
    assertEquals(log, ["e:Literal", "l:Literal"]);
  });

  it("walk over CommandList visits all commands", () => {
    const ast = p("cmd1;cmd2;cmd3");
    const cmds: string[] = [];
    walk(ast, {
      enter(n) {
        if (n.type === "UserCommand") cmds.push(n.type);
      },
    });
    assertEquals(cmds.length, 3);
  });
});

// ── findAll ────────────────────────────────────────────────────────────────────

describe("findAll", () => {
  it("collects all FunctionCall nodes", () => {
    const ast = p("[add(mul(2,3),4)]");
    const fns = findAll(ast, "FunctionCall");
    assertEquals(fns.length, 2);
    const names = fns.map(n => n.name as string);
    assertEquals(names.includes("add"), true);
    assertEquals(names.includes("mul"), true);
  });

  it("returns empty array when type not found", () => {
    const ast = p("plain text");
    assertEquals(findAll(ast, "FunctionCall"), []);
  });

  it("finds nested EvalBlocks", () => {
    const ast = p("[[f()]]");
    const evals = findAll(ast, "EvalBlock");
    assertEquals(evals.length >= 1, true);
  });

  it("finds TagRef nodes", () => {
    const ast = p("[tag(me,#mytag)]");
    const refs = findAll(ast, "TagRef");
    assertEquals(refs.length, 1);
    assertEquals(refs[0].name, "mytag");
  });

  it("finds multiple Substitution nodes", () => {
    const ast = p("%0 %1 %2");
    const subs = findAll(ast, "Substitution");
    assertEquals(subs.length, 3);
  });
});

// ── findFirst / findFirstOrNull ────────────────────────────────────────────────

describe("findFirst / findFirstOrNull", () => {
  it("findFirst returns the first matching node", () => {
    const ast = p("[add(1,2)]");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.type, "FunctionCall");
    assertEquals(fn.name, "add");
  });

  it("findFirst throws when not found", () => {
    const ast = p("plain text");
    assertThrows(
      () => findFirst(ast, "FunctionCall"),
      Error,
      'No node of type "FunctionCall" found',
    );
  });

  it("findFirstOrNull returns null when not found", () => {
    const ast = p("plain text");
    assertEquals(findFirstOrNull(ast, "FunctionCall"), null);
  });

  it("findFirstOrNull returns the node when found", () => {
    const ast = p("[f()]");
    const fn = findFirstOrNull(ast, "FunctionCall");
    assertEquals(fn?.type, "FunctionCall");
  });
});

// ── transform ─────────────────────────────────────────────────────────────────

describe("transform", () => {
  it("returns the same reference when no changes made", () => {
    const ast = p("hello");
    const out = transform(ast, () => undefined);
    assertEquals(out, ast);
  });

  it("replaces a node", () => {
    const ast = p("[#mytag]");
    const out = transform(ast, (n) => {
      if (n.type === "TagRef") {
        return { type: "Literal", value: `<tag:${n.name as string}>` };
      }
    });
    const literals = findAll(out, "Literal");
    assertEquals(literals.some(l => (l.value as string) === "<tag:mytag>"), true);
    // Original tree is unmodified
    assertEquals(findAll(ast, "TagRef").length, 1);
  });

  it("removes array items when fn returns null", () => {
    const ast = p("[add(1,2)]");
    // Remove all Arg nodes (the children of FunctionCall) — result has empty args array
    const out = transform(ast, (n) => {
      if (n.type === "Arg") return null;
    });
    const fn = findFirst(out, "FunctionCall");
    assertEquals((fn.args as ASTNode[]).length, 0);
  });

  it("top-down: replacement's children are recursed (not original's)", () => {
    // Replace FunctionCall with a new FunctionCall that has different args;
    // make sure the new child is visited, not the old one
    const ast = p("[old(x)]");
    const visited: string[] = [];
    transform(ast, (n) => {
      visited.push(n.type);
      if (n.type === "FunctionCall" && n.name === "old") {
        return {
          type: "FunctionCall",
          name: "new",
          args: [{ type: "Arg", parts: [{ type: "Literal", value: "y" }] }],
        } as ASTNode;
      }
    });
    // "new" FunctionCall replacement is entered; "old" args never visited
    assertEquals(visited.filter(t => t === "FunctionCall").length, 1);
  });

  it("does not mutate the original tree", () => {
    const ast = p("[add(1,2)]");
    const originalStr = JSON.stringify(ast);
    transform(ast, (n) => {
      if (n.type === "Literal") return { type: "Literal", value: "X" };
    });
    assertEquals(JSON.stringify(ast), originalStr);
  });
});
