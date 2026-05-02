// ============================================================================
// 14 — TinyMUX semantic parity: lazy eval, shallow eval, register scoping
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import { parse } from "../parser/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  getAttr(objectId, attr) {
    const db: Record<string, Record<string, string>> = {
      obj1: {
        FN_SETQ:   "[setq(0,inside)]",
        FN_ADD:    "[add(%0,%1)]",
        FN_GREET:  "Hello, %0!",
      },
    };
    return Promise.resolve(db[objectId]?.[attr.toUpperCase()] ?? null);
  },
  resolveTarget(_from, expr) {
    if (expr === "me" || expr === "obj1") return Promise.resolve("obj1");
    return Promise.resolve(null);
  },
  getName(objectId) {
    return Promise.resolve(objectId);
  },
  hasFlag(_id, _flag) {
    return Promise.resolve(false);
  },
};

function makeEngine(): EvalEngine {
  const e = new EvalEngine(mockAccessor);
  registerStdlib(e);
  return e;
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "obj1", executor: "obj1", ...overrides });
}

function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── Lazy evaluation — if() ────────────────────────────────────────────────────

describe("lazy eval — if()", () => {
  it("if(1, yes, no) → yes", async () =>
    assertEquals(await ev("[if(1,yes,no)]"), "yes"));

  it("if(0, yes, no) → no", async () =>
    assertEquals(await ev("[if(0,yes,no)]"), "no"));

  it("false branch not evaluated — setq not called", async () => {
    // If lazy: [setq(0,bad)] in the true branch is never evaluated
    const result = await ev("[if(0,[setq(0,bad)][r(0)],safe)]");
    assertEquals(result, "safe");
  });

  it("false branch setq not visible after call", async () => {
    // [setq(0,bad)] in true branch must be skipped when cond is false
    const result = await ev("[setq(0,orig)][if(0,[setq(0,bad)],noop)][r(0)]");
    assertEquals(result, "nooporig");
  });
});

// ── Lazy evaluation — and() / or() ───────────────────────────────────────────

describe("lazy eval — and()", () => {
  it("and(1,1,0,1) → 0 (stops at first false)", async () =>
    assertEquals(await ev("[and(1,1,0,1)]"), "0"));

  it("and(1,1,1) → 1", async () =>
    assertEquals(await ev("[and(1,1,1)]"), "1"));

  it("and short-circuits: third arg not evaluated after false", async () =>
    assertEquals(await ev("[and(1,0,[div(1,0)])]"), "0"));
});

describe("lazy eval — or()", () => {
  it("or(0,0,yes,0) → yes (first truthy value)", async () =>
    assertEquals(await ev("[or(0,0,yes,0)]"), "yes"));

  it("or(0,0) → 0", async () =>
    assertEquals(await ev("[or(0,0)]"), "0"));

  it("or short-circuits: later args not evaluated after truthy found", async () =>
    assertEquals(await ev("[or(0,hello,[div(1,0)])]"), "hello"));
});

// ── Lazy evaluation — switch() ───────────────────────────────────────────────

describe("lazy eval — switch()", () => {
  it("switch(b,a,alpha,b,beta,gamma) → beta", async () =>
    assertEquals(await ev("[switch(b,a,alpha,b,beta,gamma)]"), "beta"));

  it("switch unmatched with default → default", async () =>
    assertEquals(await ev("[switch(x,a,one,b,two,fallback)]"), "fallback"));

  it("switch skips non-matching result branches", async () => {
    // div(1,0) in a non-matching result must not be evaluated
    assertEquals(await ev("[switch(b,a,[div(1,0)],b,ok,bad)]"), "ok");
  });
});

// ── Lazy evaluation — cond() ─────────────────────────────────────────────────

describe("lazy eval — cond()", () => {
  it("cond: first truthy condition wins", async () =>
    assertEquals(await ev("[cond(0,no,1,yes,default)]"), "yes"));

  it("cond: falls through to default when no match", async () =>
    assertEquals(await ev("[cond(0,a,0,b,fallback)]"), "fallback"));

  it("cond: returns empty when no match and no default", async () =>
    assertEquals(await ev("[cond(0,a,0,b)]"), ""));

  it("cond short-circuits: later conditions not evaluated after match", async () =>
    assertEquals(await ev("[cond(1,found,[div(1,0)],bad)]"), "found"));
});

// ── Lazy evaluation — iter() ─────────────────────────────────────────────────

describe("lazy eval — iter()", () => {
  it("iter(a b c, strlen(##)) → 1 1 1", async () =>
    assertEquals(await ev("[iter(a b c,strlen(##))]"), "1 1 1"));

  it("iter list evaluated eagerly, body lazy per item", async () =>
    assertEquals(await ev("[iter(a b,##!)]"), "a! b!"));
});

// ── TinyMUX truthiness ────────────────────────────────────────────────────────

describe("TinyMUX truthiness", () => {
  it("#-1 is falsy", async () =>
    assertEquals(await ev("[if(#-1,yes,no)]"), "no"));

  it("#-1 ERROR prefix is falsy", async () =>
    assertEquals(await ev("[if(#-1 NO MATCH,yes,no)]"), "no"));

  it("empty string is falsy", async () =>
    assertEquals(await ev("[if(,yes,no)]"), "no"));

  it("0 is falsy", async () =>
    assertEquals(await ev("[if(0,yes,no)]"), "no"));

  it("non-zero is truthy", async () =>
    assertEquals(await ev("[if(42,yes,no)]"), "yes"));
});

// ── Register scoping — u() shares, ulocal() isolates ─────────────────────────

describe("register scoping — u()", () => {
  it("setq inside u() is visible to caller after u() returns", async () => {
    // FN_SETQ = "[setq(0,inside)]"
    const result = await ev("[u(me/FN_SETQ)][r(0)]");
    assertEquals(result, "inside");
  });

  it("pre-set register is preserved and updated by u()", async () => {
    const result = await ev("[setq(0,before)][u(me/FN_SETQ)][r(0)]");
    assertEquals(result, "inside");
  });
});

describe("register scoping — ulocal()", () => {
  it("setq inside ulocal() is NOT visible to caller after ulocal() returns", async () => {
    // FN_SETQ = "[setq(0,inside)]"
    const result = await ev("[setq(0,outer)][ulocal(me/FN_SETQ)][r(0)]");
    assertEquals(result, "outer");
  });

  it("ulocal: register starts empty before call, still empty after", async () => {
    const result = await ev("[ulocal(me/FN_SETQ)][r(0)]");
    assertEquals(result, "");
  });
});

// ── evalShallow ───────────────────────────────────────────────────────────────

describe("evalShallow()", () => {
  it("[get(me/x)] expands, {body} stays literal", async () => {
    const engine = makeEngine();
    const c = ctx();
    // Parse: "[add(1,2)] {literal body}"
    const ast = parse("[add(1,2)] {literal body}", "Start");
    const result = await engine.evalShallow(ast, c);
    assertEquals(result, "3 {literal body}");
  });

  it("nested braces preserved as-is", async () => {
    const engine = makeEngine();
    const c = ctx();
    const ast = parse("{outer {inner}}", "Start");
    const result = await engine.evalShallow(ast, c);
    assertEquals(result, "{outer {inner}}");
  });

  it("eval block inside braced string not evaluated", async () => {
    const engine = makeEngine();
    const c = ctx();
    const ast = parse("{[add(1,2)]}", "Start");
    const result = await engine.evalShallow(ast, c);
    assertEquals(result, "{[add(1,2)]}");
  });
});
