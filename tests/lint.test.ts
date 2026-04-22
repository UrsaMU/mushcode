// ============================================================================
// Lint — all four rules: positive and negative cases
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode } from "../parser/mod.ts";
import { lint, RULES, ariasFromFunctions } from "../src/lint/mod.ts";
import type { Diagnostic } from "../src/lint/mod.ts";
import { rhostArities } from "@ursamu/mushcode-rhost";

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

// ── arg-count: extraArities ────────────────────────────────────────────────────

describe("arg-count — extraArities", () => {
  it("unknown function produces no diagnostic without extraArities", () => {
    // vadd() is rhost-specific — invisible to the default linter
    const ast = p("[vadd(1 2)]");
    const diags = lint(ast, { rules: ["arg-count"] });
    assertEquals(diags.length, 0);
  });

  it("with extraArities: too-few args on a plugin function warns", () => {
    // vadd() requires minArgs:2 — one arg should warn
    const ast = p("[vadd(1 2)]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "arg-count");
    assertEquals(diags[0].message.includes("at least"), true);
  });

  it("with extraArities: correct arg count produces no diagnostic", () => {
    const ast = p("[vadd(1 2,3 4)]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 0);
  });

  it("with extraArities: too-many args on a fixed-arity plugin function warns", () => {
    // type() accepts exactly 1 arg
    const ast = p("[type(me,extra)]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].message.includes("at most"), true);
  });

  it("with extraArities: config() too few args warns", () => {
    const ast = p("[config()]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 1);
  });

  it("with extraArities: mudname() with no args is valid", () => {
    const ast = p("[mudname()]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 0);
  });

  it("extraArities does not suppress unrelated built-in warnings", () => {
    // div() still requires 2 args even when extraArities is set
    const ast = p("[div(1)]");
    const diags = lint(ast, { rules: ["arg-count"], extraArities: rhostArities });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "arg-count");
  });

  it("extraArities can override a built-in arity entry", () => {
    // Override add() to require exactly 2 args; add(1,2,3) should now warn
    const overrideArities: Record<string, [number, number]> = { add: [2, 2] };
    const ast = p("[add(1,2,3)]");
    const diagsBefore = lint(ast, { rules: ["arg-count"] });
    assertEquals(diagsBefore.length, 0); // variadic by default — no warning

    const diagsAfter = lint(ast, { rules: ["arg-count"], extraArities: overrideArities });
    assertEquals(diagsAfter.length, 1);
  });
});

// ── ariasFromFunctions utility ────────────────────────────────────────────────

describe("ariasFromFunctions", () => {
  it("derives arity pairs from a function map", () => {
    const fns = {
      foo: { minArgs: 1, maxArgs: 3 },
      bar: { minArgs: 0, maxArgs: 0 },
      baz: { minArgs: 2, maxArgs: Infinity },
    };
    const arities = ariasFromFunctions(fns);
    assertEquals(arities["foo"], [1, 3]);
    assertEquals(arities["bar"], [0, 0]);
    assertEquals(arities["baz"], [2, Infinity]);
  });

  it("produces an empty object from an empty map", () => {
    assertEquals(ariasFromFunctions({}), {});
  });

  it("result is usable as extraArities", () => {
    const fns = { myFunc: { minArgs: 2, maxArgs: 2 } };
    const ast = p("[myFunc(a)]"); // too few
    const diags = lint(ast, { rules: ["arg-count"], extraArities: ariasFromFunctions(fns) });
    assertEquals(diags.length, 1);
    assertEquals(diags[0].rule, "arg-count");
  });
});

// ── rhostArities coverage ────────────────────────────────────────────────────

describe("rhostArities", () => {
  it("contains pure math functions", () => {
    assertEquals(rhostArities["vadd"] !== undefined, true);
    assertEquals(rhostArities["sin"][0], 1);
    assertEquals(rhostArities["sin"][1], 1);
  });

  it("contains pure string functions", () => {
    assertEquals(rhostArities["soundex"] !== undefined, true);
  });

  it("contains pure encoding functions", () => {
    assertEquals(rhostArities["encode64"] !== undefined, true);
    assertEquals(rhostArities["crc32"] !== undefined, true);
  });

  it("contains DB-backed functions", () => {
    assertEquals(rhostArities["type"][0], 1);
    assertEquals(rhostArities["type"][1], 1);
    assertEquals(rhostArities["flags"][0], 1);
    assertEquals(rhostArities["lattr"][0], 1);
    assertEquals(rhostArities["lattr"][1], 2);
  });

  it("contains config functions", () => {
    assertEquals(rhostArities["config"][0], 1);
    assertEquals(rhostArities["config"][1], 1);
    assertEquals(rhostArities["mudname"][0], 0);
    assertEquals(rhostArities["mudname"][1], 0);
  });

  it("contains cluster functions", () => {
    assertEquals(rhostArities["cluster_get"][0], 2);
    assertEquals(rhostArities["cluster_set"][0], 3);
    assertEquals(rhostArities["cluster_u"][1], Infinity);
  });
});
