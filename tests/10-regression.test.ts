// ============================================================================
// 10 — Regression tests for every bug fixed in mux-softcode.pegjs
//
// Each test is named after the bug it covers and includes a "was broken"
// comment explaining the pre-fix behaviour.
// ============================================================================

import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

// ── BUG 1: %: (enactor objid) was not in SubCode ─────────────────────────────

describe("BUG-1: %: enactor objid substitution", () => {
  it("%: parses as Substitution(code=':')", () => {
    // Was: parse error — ':' not in single-char class
    const subs = findAll(mustParse("%:"), "Substitution");
    assertEquals(subs.length, 1);
    assertEquals(subs[0].code, ":");
  });

  it("%: works inside a function argument", () => {
    // Was: parse error inside function arg
    const fn = findFirst(mustParse("[f(%:)]"), "FunctionCall");
    assertEquals(fn.args[0].parts[0].code, ":");
  });

  it("%: works in @pemit value", () => {
    const ast = mustParse("@pemit %#=ObjID=%:");
    // deno-lint-ignore no-explicit-any
    assertEquals(findAll(ast.value, "Substitution").some((s) => (s as any).code === ":"), true);
  });
});

// ── BUG 2: %k/%K (moniker) was not in SubCode ────────────────────────────────

describe("BUG-2: %k/%K moniker substitution", () => {
  it("%k parses as Substitution(code='k')", () => {
    // Was: parse error
    const subs = findAll(mustParse("%k"), "Substitution");
    assertEquals(subs.length, 1);
    assertEquals(subs[0].code, "k");
  });

  it("%K parses as Substitution(code='K')", () => {
    const subs = findAll(mustParse("%K"), "Substitution");
    assertEquals(subs.length, 1);
    assertEquals(subs[0].code, "K");
  });

  it("%k in an @pemit value parses correctly", () => {
    const ast = mustParse("@pemit %#=Hello, %k!");
    assertNotEquals(findAll(ast.value, "Substitution").length, 0);
  });
});

// ── BUG 3: %qA–%qZ (uppercase register names) ────────────────────────────────

describe("BUG-3: %qA–%qZ uppercase register names", () => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (const c of uppercase) {
    it(`%q${c} parses as Substitution(code='q${c}')`, () => {
      // Was: SubCode tried "q" n:[0-9a-z] — uppercase letters fell through
      // to the single-char fallback which also didn't include 'q', causing parse error.
      const subs = findAll(mustParse(`%q${c}`), "Substitution");
      assertEquals(subs.length, 1);
      assertEquals(subs[0].code, `q${c}`);
    });
  }
});

// ── BUG 4: Named registers (%qfoo, %qmy_reg) ─────────────────────────────────

describe("BUG-4: Named registers (multi-char)", () => {
  it("%qfoo parses as Substitution(code='qfoo')", () => {
    const subs = findAll(mustParse("%qfoo"), "Substitution");
    assertEquals(subs[0].code, "qfoo");
  });

  it("%qmy_reg parses correctly", () => {
    const subs = findAll(mustParse("%qmy_reg"), "Substitution");
    assertEquals(subs[0].code, "qmy_reg");
  });

  it("%qResult (mixed-case) parses correctly", () => {
    const subs = findAll(mustParse("%qResult"), "Substitution");
    assertEquals(subs[0].code, "qResult");
  });

  it("%q0 (single digit) still works as before", () => {
    const subs = findAll(mustParse("%q0"), "Substitution");
    assertEquals(subs[0].code, "q0");
  });

  it("%qa (single letter) still works as before", () => {
    const subs = findAll(mustParse("%qa"), "Substitution");
    assertEquals(subs[0].code, "qa");
  });
});

// ── BUG 5: Bare ( in function arguments caused parse error ───────────────────

describe("BUG-5: Bare ( in function arguments", () => {
  it("add(1,(2)) — (2) parses as Literal '(2)'", () => {
    // Was: ArgLiteralChars excluded '(' so parsing failed
    const fn = findFirst(mustParse("[add(1,(2))]"), "FunctionCall");
    assertEquals(fn.args[1].parts[0].value, "(2)");
  });

  it("pemit(%#,(text)) — (text) is a literal arg", () => {
    const fn = findFirst(mustParse("[pemit(%#,(text))]"), "FunctionCall");
    assertEquals(fn.args[1].parts[0].value, "(text)");
  });

  it("f((a)) — ((a)) is a literal wrapping a", () => {
    const fn = findFirst(mustParse("[f((a))]"), "FunctionCall");
    assertEquals(fn.args[0].parts[0].value, "(a)");
  });

  it("nested balanced parens: f(((x))) — (((x))) as Literal", () => {
    const fn = findFirst(mustParse("[f(((x)))]"), "FunctionCall");
    assertEquals(fn.args[0].parts[0].value, "((x))");
  });

  it("mix of function call and paren group: f(add(1,2),(x)) — correct arg count", () => {
    const fn = findFirst(mustParse("[f(add(1,2),(x))]"), "FunctionCall");
    assertEquals(fn.name, "f");
    assertEquals(fn.args.length, 2);
    const inner = findFirst(fn.args[0], "FunctionCall");
    assertEquals(inner.name, "add");
    assertEquals(fn.args[1].parts[0].value, "(x)");
  });
});

// ── BUG 6: ^ listen patterns not recognised ──────────────────────────────────

describe("BUG-6: ^-listen patterns", () => {
  it("^*hello*:action → ListenPattern (was: parsed as UserCommand)", () => {
    // Was: AttributeValue = DollarPattern / CommandList — ^ not handled
    const ast = mustParse("^*hello*:@pemit %#=Heard it");
    assertEquals(ast.type, "ListenPattern");
  });

  it("ListenPattern has pattern and action like DollarPattern", () => {
    const ast = mustParse("^*hi*:say hi");
    assertEquals(ast.pattern.type, "Pattern");
    assertEquals(ast.action.type, "UserCommand");
  });

  it("^ with alternatives: ^hi;hello:action → PatternAlts", () => {
    const ast = mustParse("^hi;hello:say heard");
    assertEquals(ast.pattern.type, "PatternAlts");
  });

  it("listen pattern does NOT change parse of DollarPattern", () => {
    const ast = mustParse("$greet *:say hi");
    assertEquals(ast.type, "DollarPattern");
  });
});

// ── BUG 7: &ATTR obj (no =value) treated as UserCommand ──────────────────────

describe("BUG-7: AttributeSet without = (clear attribute form)", () => {
  it("&SCORE me → AttributeSet, value:null (was: UserCommand)", () => {
    // Was: AttributeSet required '=', so '&SCORE me' fell to UserCommand
    const ast = mustParse("&SCORE me");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "SCORE");
    assertEquals(ast.value, null);
  });

  it("&CMD_WALK me → AttributeSet attribute='CMD_WALK'", () => {
    const ast = mustParse("&CMD_WALK me");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "CMD_WALK");
  });

  it("&ATTR obj=val → still works (normal form unaffected)", () => {
    const ast = mustParse("&ATTR me=hello");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.value.parts[0].value, "hello");
  });

  it("&ATTR in command list: @pemit %#=ok;&SCORE me → two commands", () => {
    const ast = mustParse("@pemit %#=ok;&SCORE me");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands[1].type, "AttributeSet");
    assertEquals(ast.commands[1].value, null);
  });
});

// ── BUG 8: %=ATTR substitution not handled ───────────────────────────────────

describe("BUG-8: %=attr substitution", () => {
  it("%=SCORE → Substitution(code='=SCORE')", () => {
    const subs = findAll(mustParse("%=SCORE"), "Substitution");
    assertEquals(subs.length, 1);
    assertEquals(subs[0].code, "=SCORE");
  });

  it("%=MY_ATTR → Substitution with hyphenated name", () => {
    const subs = findAll(mustParse("%=MY_ATTR"), "Substitution");
    assertEquals(subs[0].code, "=MY_ATTR");
  });

  it("%=SCORE works inside a function arg", () => {
    const fn = findFirst(mustParse("[pemit(%#,%=SCORE)]"), "FunctionCall");
    assertEquals(fn.args[1].parts[0].code, "=SCORE");
  });
});
