// ============================================================================
// Lint — all four rules: positive and negative cases
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode } from "../parser/mod.ts";
import { lint, RULES } from "../src/lint/mod.ts";
import type { Diagnostic } from "../src/lint/mod.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function p(text: string): ASTNode {
  return parse(text, "Start");
}

function rulesOf(diags: Diagnostic[]): string[] {
  return diags.map(d => d.rule);
}

// ── missing-wildcard ────────────────────────────────────────────────────────────

describe("missing-wildcard", () => {
  it("no diagnostic when wildcards match usage", () => {
    const ast = p("$+finger *:@pemit %#=%0");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 0);
  });

  it("no diagnostic when %1 is used and pattern has one wildcard", () => {
    const ast = p("$say *:@pemit %#=%1");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 0);
  });

  it("warns when %1 is used but pattern has no wildcards", () => {
    const ast = p("$look:@pemit %#=%1");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "missing-wildcard");
    assertEquals(diags[0].severity, "warning");
  });

  it("warns when %2 is used but pattern has only one wildcard", () => {
    const ast = p("$cmd *:@pemit %#=%2");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "missing-wildcard");
  });

  it("no diagnostic for %0 even with no wildcards (%0 is always available)", () => {
    const ast = p("$look:@pemit %#=%0");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 0);
  });

  it("warns for ListenPattern too", () => {
    const ast = p("^hello:@pemit %#=%1");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "missing-wildcard");
  });

  it("no false positive when action uses no positional subs", () => {
    const ast = p("$look:@pemit %#=hello");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.length, 0);
  });
});

// ── iter-var-outside-iter ─────────────────────────────────────────────────────

describe("iter-var-outside-iter", () => {
  it("## inside iter() — no diagnostic", () => {
    const ast = p("[iter(lwho(),## )]");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 0);
  });

  it("## inside map() — no diagnostic", () => {
    const ast = p("[map(myattr,##)]");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 0);
  });

  it("## inside @dolist — no diagnostic", () => {
    const ast = p("@dolist lwho()={@pemit ##=hi}");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 0);
  });

  it("## outside iter — warns", () => {
    const ast = p("[pemit(%#,##)]");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "iter-var-outside-iter");
    assertEquals(diags[0].severity, "warning");
  });

  it("#@ outside iter — warns", () => {
    const ast = p("[pemit(%#,#@)]");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "iter-var-outside-iter");
  });

  it("bare ## in attribute value — warns", () => {
    const ast = p("&ATTR me=##");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 1);
  });

  it("nested iter() — ## valid at both levels", () => {
    const ast = p("[iter(iter(inner,##),##)]");
    const diags = lint(ast, { rules: ["iter-var-outside-iter"] });
    assertEquals(diags.length, 0);
  });
});

// ── arg-count ──────────────────────────────────────────────────────────────────

describe("arg-count", () => {
  it("no diagnostic for correct arg counts", () => {
    const ast = p("[add(1,2)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 0);
  });

  it("warns when too few args", () => {
    // div() requires exactly 2 args
    const ast = p("[div(1)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "arg-count");
    assertEquals(diags[0].severity, "warning");
    assertEquals(diags[0].message.includes("at least"), true);
  });

  it("warns when too many args", () => {
    // strlen() accepts only 1 arg
    const ast = p("[strlen(foo,bar)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "arg-count");
    assertEquals(diags[0].message.includes("at most"), true);
  });

  it("unknown function — no diagnostic", () => {
    const ast = p("[myfunc(a,b,c)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 0);
  });

  it("mid() with 3 args — no diagnostic", () => {
    const ast = p("[mid(foo,1,2)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 0);
  });
});

// ── register-before-set ────────────────────────────────────────────────────────

describe("register-before-set", () => {
  it("no diagnostic when register is set before use", () => {
    const ast = p("[setq(0,hello)][pemit(%#,%q0)]");
    const diags = lint(ast, { rules: ["register-before-set"] });
    assertEquals(diags.length, 0);
  });

  it("info diagnostic when %q0 used with no setq", () => {
    const ast = p("[pemit(%#,%q0)]");
    const diags = lint(ast, { rules: ["register-before-set"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "register-before-set");
    assertEquals(diags[0].severity, "info");
    assertEquals(diags[0].message.includes("%q0"), true);
  });

  it("r() read of unset register — info diagnostic", () => {
    const ast = p("[r(0)]");
    const diags = lint(ast, { rules: ["register-before-set"] });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "register-before-set");
  });

  it("no diagnostic when r() matches setq()", () => {
    const ast = p("[setq(foo,bar)][r(foo)]");
    const diags = lint(ast, { rules: ["register-before-set"] });
    assertEquals(diags.length, 0);
  });

  it("named register — no diagnostic when set", () => {
    const ast = p("[setq(name,Alice)][pemit(%#,%qname)]");
    const diags = lint(ast, { rules: ["register-before-set"] });
    assertEquals(diags.length, 0);
  });
});

// ── LintOptions: rules whitelist ───────────────────────────────────────────────

describe("lint — options", () => {
  it("runs all rules by default", () => {
    // Pattern with no wildcards using %1 → missing-wildcard
    // ## outside iter → iter-var-outside-iter
    const ast = p("$look:@pemit %#=%1 ##");
    const diags = lint(ast);
    const rules = rulesOf(diags);
    assertEquals(rules.includes("missing-wildcard"), true);
    assertEquals(rules.includes("iter-var-outside-iter"), true);
  });

  it("whitelist: only runs specified rules", () => {
    const ast = p("$look:@pemit %#=%1 ##");
    const diags = lint(ast, { rules: ["missing-wildcard"] });
    assertEquals(diags.every(d => d.rule === "missing-wildcard"), true);
  });

  it("RULES constant lists all rule ids", () => {
    assertEquals(RULES.length, 4);
    assertEquals(Array.from(RULES).includes("missing-wildcard"), true);
    assertEquals(Array.from(RULES).includes("iter-var-outside-iter"), true);
    assertEquals(Array.from(RULES).includes("arg-count"), true);
    assertEquals(Array.from(RULES).includes("register-before-set"), true);
  });

  it("empty rules list produces no diagnostics", () => {
    const ast = p("$look:@pemit %#=%1");
    const diags = lint(ast, { rules: [] });
    assertEquals(diags.length, 0);
  });
});
