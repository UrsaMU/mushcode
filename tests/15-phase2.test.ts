// ============================================================================
// 14 — Phase 2: CharClass wildcards, new substitution codes, #$ lint
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { mustParse, findAll } from "./helpers.ts";
import { parse } from "../parser/mod.ts";
import { lint } from "../src/lint/mod.ts";

// ── CharClass wildcard in patterns ───────────────────────────────────────────

describe("CharClass pattern wildcards", () => {
  it("[abc] parses as CharClass node with spec 'abc'", () => {
    const ast = mustParse("$test [abc]:@pemit %#=hit");
    const classes = findAll(ast, "CharClass");
    assertEquals(classes.length, 1);
    assertEquals(classes[0].spec, "abc");
  });

  it("[^abc] parses as CharClass with spec '^abc'", () => {
    const ast = mustParse("$test [^abc]:@pemit %#=hit");
    const classes = findAll(ast, "CharClass");
    assertEquals(classes.length, 1);
    assertEquals(classes[0].spec, "^abc");
  });

  it("[!abc] parses as CharClass with spec '!abc'", () => {
    const ast = mustParse("$test [!abc]:@pemit %#=hit");
    const classes = findAll(ast, "CharClass");
    assertEquals(classes.length, 1);
    assertEquals(classes[0].spec, "!abc");
  });

  it("[a-z] parses as CharClass with spec 'a-z'", () => {
    const ast = mustParse("$test [a-z]:@pemit %#=hit");
    const classes = findAll(ast, "CharClass");
    assertEquals(classes.length, 1);
    assertEquals(classes[0].spec, "a-z");
  });

  it("[a-zA-Z0-9] parses as CharClass with combined range spec", () => {
    const ast = mustParse("$test [a-zA-Z0-9]:@pemit %#=hit");
    const classes = findAll(ast, "CharClass");
    assertEquals(classes.length, 1);
    assertEquals(classes[0].spec, "a-zA-Z0-9");
  });

  it("* and ? wildcards still parse correctly alongside CharClass", () => {
    const ast = mustParse("$test *[abc]?:@pemit %#=hit");
    const wildcards = findAll(ast, "Wildcard");
    const classes = findAll(ast, "CharClass");
    assertEquals(wildcards.length, 2);
    assertEquals(classes.length, 1);
  });
});

// ── %(  %)  substitutions ────────────────────────────────────────────────────

describe("Literal paren substitutions", () => {
  function sub(code: string): string {
    const ast = mustParse(`%${code}`);
    const subs = findAll(ast, "Substitution");
    assertEquals(subs.length, 1);
    return subs[0].code as string;
  }

  it("%( → code '('", () => assertEquals(sub("("), "("));
  it("%) → code ')'", () => assertEquals(sub(")"), ")"));
});

// ── #$ does NOT trigger iter-var-outside-iter warning ────────────────────────

describe("#$ lint: iter-var-outside-iter", () => {
  it("#$ outside iter() does NOT produce a lint warning", () => {
    const ast = parse("@pemit %#=#$", "Start");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    // #$ is a valid SpecialVar (last name-lookup dbref), not an error outside iter
    assertEquals(diags.filter(d => d.rule === "iter-var-outside-iter").length, 0);
  });

  it("#$ inside iter() body has no warning", () => {
    const ast = parse("[iter(list,#$)]", "Start");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.filter(d => d.rule === "iter-var-outside-iter").length, 0);
  });
});
