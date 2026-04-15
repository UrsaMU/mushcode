// ============================================================================
// 01 — Literal text, escape sequences, special variables
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, literals } from "./helpers.ts";

describe("Literal text", () => {
  it("bare text → UserCommand with one Literal", () => {
    const ast = mustParse("Hello World");
    assertEquals(ast.type, "UserCommand");
    assertEquals(ast.parts[0].type, "Literal");
    assertEquals(ast.parts[0].value, "Hello World");
  });

  it("empty input → empty UserCommand", () => {
    const ast = mustParse("");
    assertEquals(ast.type, "UserCommand");
    assertEquals(ast.parts.length, 0);
  });

  it("whitespace-only → empty UserCommand (whitespace consumed by Start rule)", () => {
    const ast = mustParse("   ");
    assertEquals(ast.type, "UserCommand");
    assertEquals(ast.parts.length, 0);
  });

  it("text with special characters: , ! ? @ stays literal", () => {
    const ast = mustParse("Hello, World! foo@bar?baz");
    assertEquals(literals(ast), ["Hello, World! foo@bar?baz"]);
  });

  it("coalesces adjacent literals", () => {
    // Without any substitutions, all text merges into one Literal node
    const ast = mustParse("foo bar baz");
    assertEquals(ast.parts.length, 1);
    assertEquals(ast.parts[0].value, "foo bar baz");
  });
});

describe("Escape sequences", () => {
  it("\\; → Escape node, char=;", () => {
    const ast = mustParse("\\;");
    assertEquals(ast.type, "UserCommand");
    const esc = findAll(ast, "Escape");
    assertEquals(esc.length, 1);
    assertEquals(esc[0].char, ";");
  });

  it("\\[ → Escape node, char=[", () => {
    const ast = mustParse("\\[");
    const esc = findAll(ast, "Escape");
    assertEquals(esc[0].char, "[");
  });

  it("\\, → Escape inside function arg", () => {
    const ast = mustParse("[f(a\\,b)]");
    const esc = findAll(ast, "Escape");
    assertEquals(esc.length, 1);
    assertEquals(esc[0].char, ",");
  });

  it("\\\\ → Escape node, char=\\", () => {
    const ast = mustParse("\\\\");
    const esc = findAll(ast, "Escape");
    assertEquals(esc[0].char, "\\");
  });
});

describe("SpecialVar nodes (##, #@, #$)", () => {
  it("## → SpecialVar code ##", () => {
    const ast = mustParse("##");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv.length, 1);
    assertEquals(sv[0].code, "##");
  });

  it("#@ → SpecialVar code #@", () => {
    const ast = mustParse("#@");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv[0].code, "#@");
  });

  it("#$ → SpecialVar code #$", () => {
    const ast = mustParse("#$");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv[0].code, "#$");
  });

  it("## inside iter call is a SpecialVar, not a literal #", () => {
    const ast = mustParse("[iter(lwho(),##)]");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv.length, 1);
    assertEquals(sv[0].code, "##");
  });

  it("#123 (dbref reference) stays as Literal, not SpecialVar", () => {
    const ast = mustParse("#123");
    const sv = findAll(ast, "SpecialVar");
    assertEquals(sv.length, 0);
    // coalesce merges the '#' token and '123' into one Literal
    assertEquals(literals(ast), ["#123"]);
  });
});
