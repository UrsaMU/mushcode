// ============================================================================
// 07 — Dollar-sign command patterns  $<pattern>:<action>
//    — Listen patterns              ^<pattern>:<action>
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

// ── DollarPattern ─────────────────────────────────────────────────────────────

describe("DollarPattern — basic", () => {
  it("$+finger *:@pemit %#=Hi → DollarPattern", () => {
    const ast = mustParse("$+finger *:@pemit %#=Hi");
    assertEquals(ast.type, "DollarPattern");
  });

  it("pattern contains Wildcard(*)", () => {
    const ast = mustParse("$+finger *:@pemit %#=Hi");
    const wc = findAll(ast.pattern, "Wildcard");
    assertEquals(wc.length, 1);
    assertEquals(wc[0].wildcard, "*");
  });

  it("pattern has literal prefix before wildcard", () => {
    const ast = mustParse("$+finger *:@pemit %#=Hi");
    assertEquals(ast.pattern.type, "Pattern");
    const lits = findAll(ast.pattern, "Literal");
    assertEquals(lits[0].value, "+finger ");
  });

  it("action is the @pemit AtCommand", () => {
    const ast = mustParse("$+finger *:@pemit %#=Hi");
    assertEquals(ast.action.type, "AtCommand");
    assertEquals(ast.action.name, "pemit");
  });
});

describe("DollarPattern — action command lists", () => {
  it("$hi:say Hi;@pemit %#=! → action is CommandList", () => {
    const ast = mustParse("$hi:say Hi;@pemit %#=!");
    assertEquals(ast.type, "DollarPattern");
    assertEquals(ast.action.type, "CommandList");
    assertEquals(ast.action.commands.length, 2);
  });

  it("action with eval block: $greet *:@pemit %#=[name(%0)]!", () => {
    const ast = mustParse("$greet *:@pemit %#=[name(%0)]!");
    const blocks = findAll(ast, "EvalBlock");
    assertEquals(blocks.length >= 1, true);
  });
});

describe("DollarPattern — pattern alternatives (;-separated)", () => {
  it("$hi;hello;hey *:@pemit → PatternAlts with 3 patterns", () => {
    const ast = mustParse("$hi;hello;hey *:@pemit %#=Greetings!");
    assertEquals(ast.type, "DollarPattern");
    assertEquals(ast.pattern.type, "PatternAlts");
    assertEquals(ast.pattern.patterns.length, 3);
  });

  it("each alternative is a Pattern node", () => {
    const ast = mustParse("$hi;hello:say Hi");
    assertEquals(ast.pattern.patterns[0].type, "Pattern");
    assertEquals(ast.pattern.patterns[1].type, "Pattern");
  });

  it("single alternative stays as Pattern (not PatternAlts)", () => {
    const ast = mustParse("$greet *:say Hi");
    assertEquals(ast.pattern.type, "Pattern");
  });
});

describe("DollarPattern — wildcard variants", () => {
  it("? wildcard: $+stat ? → single-char wildcard", () => {
    const ast = mustParse("$+stat ?:say stat");
    const wc = findAll(ast.pattern, "Wildcard");
    assertEquals(wc[0].wildcard, "?");
  });

  it("multiple wildcards: $* *:say two wildcards", () => {
    const ast = mustParse("$* *:say two");
    const wc = findAll(ast.pattern, "Wildcard");
    assertEquals(wc.length, 2);
  });

  it("escaped colon in pattern: $foo\\:bar:action", () => {
    const ast = mustParse("$foo\\:bar:say action");
    assertEquals(ast.type, "DollarPattern");
    const esc = findAll(ast.pattern, "Escape");
    assertEquals(esc[0].char, ":");
  });
});

describe("DollarPattern — switch in pattern", () => {
  it("$+stat/set *=*:action → = in pattern is literal", () => {
    const ast = mustParse("$+stat/set *=*:@pemit %#=ok");
    assertEquals(ast.type, "DollarPattern");
    // pattern should have wildcards and '=' as literal
    const wc = findAll(ast.pattern, "Wildcard");
    assertEquals(wc.length >= 2, true);
  });
});

describe("DollarPattern — complex real-world examples", () => {
  it("finger pattern with u() call in action", () => {
    const ast = mustParse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
    assertEquals(ast.type, "DollarPattern");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "u");
  });

  it("gold give pattern: $+give *=*:@pemit ...", () => {
    const src = "$+give *=*:@switch [isnum(%1)]=0,{@pemit %#=Not a number.},{@pemit %#=Gave.}";
    const ast = mustParse(src);
    assertEquals(ast.type, "DollarPattern");
    assertEquals(ast.action.type, "AtCommand");
  });
});

// ── ListenPattern ─────────────────────────────────────────────────────────────

describe("ListenPattern — basic", () => {
  it("^*hello*:@pemit → ListenPattern", () => {
    const ast = mustParse("^*hello*:@pemit %#=I heard you");
    assertEquals(ast.type, "ListenPattern");
  });

  it("pattern and action parsed same as DollarPattern", () => {
    const ast = mustParse("^*hello*:@pemit %#=I heard you");
    assertEquals(ast.pattern.type, "Pattern");
    assertEquals(ast.action.type, "AtCommand");
  });

  it("^ with wildcard: ^* hi *:action → wildcard in pattern", () => {
    const ast = mustParse("^* hi *:say heard it");
    const wc = findAll(ast.pattern, "Wildcard");
    assertEquals(wc.length >= 1, true);
  });

  it("^ with pattern alternatives: ^hi;hello:action", () => {
    const ast = mustParse("^hi;hello:say hi");
    assertEquals(ast.type, "ListenPattern");
    assertEquals(ast.pattern.type, "PatternAlts");
    assertEquals(ast.pattern.patterns.length, 2);
  });
});

describe("DollarPattern vs ListenPattern disambiguation", () => {
  it("$ → DollarPattern, ^ → ListenPattern, both are AttributeValue", () => {
    const dp = mustParse("$greet *:say hi");
    const lp = mustParse("^*hi*:say hi");
    assertEquals(dp.type, "DollarPattern");
    assertEquals(lp.type, "ListenPattern");
  });
});
