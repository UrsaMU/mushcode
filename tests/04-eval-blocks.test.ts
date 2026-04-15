// ============================================================================
// 04 — Eval blocks  [ ... ]
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

describe("Basic eval blocks", () => {
  it("[add(1,2)] → EvalBlock containing FunctionCall", () => {
    const ast = mustParse("[add(1,2)]");
    // Start always returns UserCommand; the eval block is its first part
    assertEquals(ast.type, "UserCommand");
    assertEquals(ast.parts[0].type, "EvalBlock");
  });

  it("[name(%#)] → EvalBlock with FunctionCall(name)", () => {
    const ast = mustParse("[name(%#)]");
    assertEquals(ast.parts[0].type, "EvalBlock");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "name");
  });

  it("text before eval: hello [name(%#)] → UserCommand with mixed parts", () => {
    const ast = mustParse("hello [name(%#)]");
    assertEquals(ast.type, "UserCommand");
    const blocks = findAll(ast, "EvalBlock");
    assertEquals(blocks.length, 1);
  });
});

describe("Nested eval blocks", () => {
  it("[[lwho()]] → outer EvalBlock wrapping inner EvalBlock", () => {
    const ast = mustParse("[[lwho()]]");
    assertEquals(ast.parts[0].type, "EvalBlock");
    const inner = findAll(ast, "EvalBlock");
    // outer + inner
    assertEquals(inner.length >= 2, true);
  });

  it("[add([mul(2,3)],1)] → nested function in arg", () => {
    const outer = findFirst(mustParse("[add([mul(2,3)],1)]"), "FunctionCall");
    assertEquals(outer.name, "add");
    const innerBlock = findFirst(outer.args[0], "EvalBlock");
    assertEquals(innerBlock.type, "EvalBlock");
    const mul = findFirst(innerBlock, "FunctionCall");
    assertEquals(mul.name, "mul");
  });
});

describe("Multiple eval blocks in sequence", () => {
  it("[setq(0,hello)][r(0)] → two top-level EvalBlocks", () => {
    const ast = mustParse("[setq(0,hello)][r(0)]");
    assertEquals(ast.type, "UserCommand");
    const blocks = findAll(ast, "EvalBlock");
    assertEquals(blocks.length, 2);
  });

  it("Name: [name(%#)] (Loc: [loc(%#)]) → two blocks interleaved in text", () => {
    const ast = mustParse("Name: [name(%#)] Loc: [loc(%#)]");
    const blocks = findAll(ast, "EvalBlock");
    assertEquals(blocks.length, 2);
  });
});

describe("Eval block in AtCommand value", () => {
  it("@pemit %#=Hello [name(%#)]! → EvalBlock in value", () => {
    const ast = mustParse("@pemit %#=Hello [name(%#)]!");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "pemit");
    const blocks = findAll(ast.value, "EvalBlock");
    assertEquals(blocks.length, 1);
  });
});

describe("Eval block in dollar pattern action", () => {
  it("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)] → EvalBlock in action", () => {
    const ast = mustParse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
    assertEquals(ast.type, "DollarPattern");
    const blocks = findAll(ast, "EvalBlock");
    assertEquals(blocks.length >= 1, true);
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "u");
  });
});

describe("Eval blocks with substitutions", () => {
  it("[r(%q0)] → EvalBlock with FunctionCall using register sub", () => {
    const ast = mustParse("[r(%q0)]");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "r");
    assertEquals(fn.args[0].parts[0].type, "Substitution");
    assertEquals(fn.args[0].parts[0].code, "q0");  // %q0 → register named q0
  });

  it("[r(%qA)] → register %qA works in eval (was broken)", () => {
    const ast = mustParse("[r(%qA)]");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.args[0].parts[0].code, "qA");
  });
});

describe("Eval block containing only literal text", () => {
  it("[hello] → EvalBlock with Literal parts", () => {
    const ast = mustParse("[hello]");
    assertEquals(ast.parts[0].type, "EvalBlock");
    const lits = findAll(ast, "Literal");
    assertEquals(lits[0].value, "hello");
  });
});
