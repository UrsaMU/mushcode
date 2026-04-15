// ============================================================================
// 05 — Braced strings  { ... }
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

describe("Basic braced strings", () => {
  it("{text} → BracedString with Literal", () => {
    // Start returns UserCommand; the braced string is the first (and only) part
    const ast = mustParse("{text}");
    assertEquals(ast.parts[0].type, "BracedString");
    assertEquals(ast.parts[0].parts[0].value, "text");
  });

  it("{} → empty BracedString", () => {
    const ast = mustParse("{}");
    assertEquals(ast.parts[0].type, "BracedString");
    assertEquals(ast.parts[0].parts.length, 0);
  });

  it("{don't;split;this} → semicolons are literals inside braces", () => {
    const ast = mustParse("{don't;split;this}");
    assertEquals(ast.parts[0].type, "BracedString");
    // Only one BracedString — the semicolons did not create a CommandList
    assertEquals(findAll(ast, "CommandList").length, 0);
  });

  it("{a,b,c} → commas are literals inside braces", () => {
    const ast = mustParse("{a,b,c}");
    assertEquals(ast.parts[0].type, "BracedString");
    // All text with commas coalesced into one Literal
    assertEquals(findAll(ast, "Literal")[0].value, "a,b,c");
  });
});

describe("Nested braces", () => {
  it("{ outer { inner } more } → nested BracedStrings", () => {
    const ast = mustParse("{ outer { inner } more }");
    assertEquals(ast.parts[0].type, "BracedString");
    const nested = findAll(ast.parts[0], "BracedString");
    // outer BracedString + one inner
    assertEquals(nested.length, 2);
  });

  it("{{{deep}}} → triple nesting", () => {
    const ast = mustParse("{{{deep}}}");
    const all = findAll(ast, "BracedString");
    assertEquals(all.length, 3);
  });
});

describe("Eval blocks still active inside braces", () => {
  it("{[add(1,2)]} → EvalBlock inside BracedString", () => {
    const ast = mustParse("{[add(1,2)]}");
    assertEquals(ast.parts[0].type, "BracedString");
    const block = findFirst(ast, "EvalBlock");
    assertEquals(block.type, "EvalBlock");
  });

  it("{@pemit %#=Hello, %0!} → substitution inside brace", () => {
    const ast = mustParse("{@pemit %#=Hello, %0!}");
    const subs = findAll(ast, "Substitution");
    assertEquals(subs.length >= 1, true);
  });
});

describe("Braces in command list actions", () => {
  it("@dolist lwho()={@pemit ##=Restart in 5 min.} → single command in brace", () => {
    const ast = mustParse("@dolist lwho()={@pemit ##=Restart in 5 min.}");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "dolist");
    // The value is a BracedString wrapping the @pemit command
    const brace = findFirst(ast.value, "BracedString");
    assertEquals(brace.type, "BracedString");
  });

  it("@switch x=1,{big},{small} → brace-protected command bodies", () => {
    const ast = mustParse("@switch x=1,{big},{small}");
    assertEquals(ast.type, "AtCommand");
    const braces = findAll(ast.value, "BracedString");
    assertEquals(braces.length, 2);
  });
});

describe("Braces in function arguments protect commas", () => {
  it("iter(list,{##: score},, ) → brace protects colon-space in template", () => {
    const ast = mustParse("[iter(list,{##: score},,)]");
    const fn = findFirst(ast, "FunctionCall");
    assertEquals(fn.name, "iter");
    assertEquals(fn.args[1].parts[0].type, "BracedString");
  });

  it("f({a,b}) → single arg because comma is inside braces", () => {
    const fn = findFirst(mustParse("[f({a,b})]"), "FunctionCall");
    assertEquals(fn.args.length, 1);
    assertEquals(fn.args[0].parts[0].type, "BracedString");
  });
});

describe("Braces with special chars that would otherwise break parsing", () => {
  it("{use \\; here} → escape inside brace", () => {
    const ast = mustParse("{use \\; here}");
    const esc = findAll(ast, "Escape");
    assertEquals(esc.length, 1);
    assertEquals(esc[0].char, ";");
  });

  it("{has = sign} → equals sign is literal inside brace", () => {
    const ast = mustParse("{has = sign}");
    assertEquals(ast.parts[0].type, "BracedString");
    // should parse without treating = as command separator
    const lits = findAll(ast.parts[0], "Literal");
    // deno-lint-ignore no-explicit-any
    const combined = lits.map((l) => (l as any).value as string).join("");
    assertEquals(combined.includes("="), true);
  });
});
