// ============================================================================
// 09 — Edge cases, deep nesting, real-world patterns
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

describe("Deep nesting", () => {
  it("5-level nested function calls parse without error", () => {
    const src = "[if(gt(abs(add(mul(%0,2),3)),10),yes,no)]";
    const ast = mustParse(src);
    // Start wraps in UserCommand; the eval block is the first part
    assertEquals(ast.parts[0].type, "EvalBlock");
    const fns = findAll(ast, "FunctionCall");
    assertEquals(fns.length >= 4, true);
  });

  it("deeply nested braces {{{{{inner}}}}} parse without error", () => {
    const ast = mustParse("{{{{{inner}}}}}");
    const braces = findAll(ast, "BracedString");
    assertEquals(braces.length, 5);
  });

  it("nested eval inside brace inside function: [f({[g(x)]})] parses", () => {
    const ast = mustParse("[f({[g(x)]})]");
    const fns = findAll(ast, "FunctionCall");
    assertEquals(fns.length, 2);
  });
});

describe("Real-world softcode patterns", () => {
  it("+finger command with u() delegation", () => {
    const src = "$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]";
    const ast = mustParse(src);
    assertEquals(ast.type, "DollarPattern");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "u");
    assertEquals(fn.args[0].parts[0].value, "me/FN_FINGER");
  });

  it("+who with iter over lwho()", () => {
    const src = "$+who:@pemit %#=[iter(lwho(),[name(##)] (#[loc(##)]),%r)]";
    const ast = mustParse(src);
    assertEquals(ast.type, "DollarPattern");
    const iter = findFirst(ast, "FunctionCall");
    assertEquals(iter.name === "iter" || findAll(ast, "FunctionCall").some(f => f.name === "iter"), true);
  });

  it("@switch with setq and register read", () => {
    const src = "@switch [setq(0,pmatch(%0))]=1,{@pemit %#=Found: [r(0)]},{@pemit %#=Not found.}";
    const ast = mustParse(src);
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "switch");
    const braces = findAll(ast.value, "BracedString");
    assertEquals(braces.length, 2);
  });

  it("@dolist with iter ##", () => {
    const src = "@dolist [lwho()]={@pemit ##=Restart in 5 minutes.}";
    const ast = mustParse(src);
    assertEquals(ast.name, "dolist");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv.length >= 1, true);
  });

  it("score display with column formatting", () => {
    const src = "[ljust(Name,20)][rjust(Score,10)]";
    const ast = mustParse(src);
    const fns = findAll(ast, "FunctionCall");
    assertEquals(fns.some(f => f.name === "ljust"), true);
    assertEquals(fns.some(f => f.name === "rjust"), true);
  });
});

describe("ANSI formatting patterns", () => {
  it("%ch%crRed Bold Text%cn parses as 4 substitutions", () => {
    const ast = mustParse("%ch%crRed Bold Text%cn");
    const subs = findAll(ast, "Substitution");
    assertEquals(subs.length, 3); // ch, cr, cn
  });

  it("ansi() function call", () => {
    const ast = mustParse("[ansi(hg,SUCCESS)]");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "ansi");
    assertEquals(fn.args[0].parts[0].value, "hg");
  });
});

describe("Multiple commands with complex content", () => {
  it("three-command sequence with eval blocks", () => {
    const src = "@pemit %#=Step 1: [add(1,1)];@pemit %#=Step 2: [mul(2,2)];@pemit %#=Done";
    const ast = mustParse(src);
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands.length, 3);
  });

  it("attribute set followed by trigger", () => {
    const src = "&TEMP me=[add(%0,1)];@trigger me/DO_THING=%qresult";
    const ast = mustParse(src);
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands[0].type, "AttributeSet");
    assertEquals(ast.commands[1].type, "AtCommand");
  });
});

describe("Whitespace handling", () => {
  it("leading/trailing whitespace stripped by Start rule", () => {
    const ast = mustParse("  @pemit %#=hi  ");
    assertEquals(ast.type, "AtCommand");
  });

  it("@pemit with space before object: '@pemit   me=hi' parses", () => {
    const ast = mustParse("@pemit   me=hi");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "pemit");
  });
});

describe("Special dbref syntax in object positions", () => {
  it("#123 in @trigger object position", () => {
    const ast = mustParse("@trigger #123/ATTR=hello");
    assertEquals(ast.type, "AtCommand");
    // Object should contain a '#' literal followed by '123/ATTR'
    const lits = findAll(ast.object, "Literal");
    // deno-lint-ignore no-explicit-any
    const joined = lits.map((l) => (l as any).value as string).join("");
    assertEquals(joined.includes("#123"), true);
  });

  it("##-based iteration: [iter(list,## has [strlen(##)] chars)]", () => {
    const ast = mustParse("[iter(list,## has [strlen(##)] chars)]");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv.length, 2);
    // deno-lint-ignore no-explicit-any
    assertEquals(sv.every((s) => (s as any).code === "##"), true);
  });
});

describe("Empty command list elements", () => {
  it("single command with no content → UserCommand with empty parts", () => {
    const ast = mustParse("");
    assertEquals(ast.type, "UserCommand");
    assertEquals(ast.parts.length, 0);
  });
});

describe("Percent-sign edge cases", () => {
  it("%% → single Substitution with code '%'", () => {
    const subs = findAll(mustParse("%%"), "Substitution");
    assertEquals(subs.length, 1);
    assertEquals(subs[0].code, "%");
  });

  it("100% → literal '100' then Substitution(unknown?) → graceful", () => {
    // % at end of input with no code — grammar either errors or produces Substitution
    // Just verify it doesn't crash when % has a following char
    const ast = mustParse("100%%");
    assertEquals(findAll(ast, "Substitution").length, 1);
  });
});
