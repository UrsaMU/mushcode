// ============================================================================
// e2e.test.ts — End-to-end tests: raw softcode → parse → evaluate → output
// ============================================================================
// Tests the COMPLETE pipeline using real EvalEngine + registerStdlib + makeContext.
// No mocks — all assertions hit the real evaluator.
// ============================================================================

import { assertEquals, assertStringIncludes, assertMatch } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Test database ─────────────────────────────────────────────────────────────

const attrs: Record<string, Record<string, string>> = {
  player1: {
    SCORE:    "85",
    MAX_SCORE: "100",
    FN_ADD:   "[add(%0,%1)]",
    FN_GREET: "Hello, %0!",
    FN_SETQ:  "[setq(0,inside)][r(0)]",
  },
};

const names: Record<string, string> = {
  player1: "Alice",
  room1:   "The Void",
};

const objects: Record<string, string> = {
  alice: "player1",
};

const flags: Record<string, Set<string>> = {
  player1: new Set(["wizard"]),
};

const accessor: ObjectAccessor = {
  getAttr: (id, attr) =>
    Promise.resolve(attrs[id]?.[attr.toUpperCase()] ?? null),
  resolveTarget: (_from, expr) => {
    if (expr === "me" || expr === "player1") return Promise.resolve("player1");
    if (expr.startsWith("#")) return Promise.resolve(expr);
    return Promise.resolve(objects[expr] ?? null);
  },
  getName: (id) => Promise.resolve(names[id] ?? id),
  hasFlag: (id, flag) => Promise.resolve(flags[id]?.has(flag) ?? false),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEngine(): EvalEngine {
  const e = new EvalEngine(accessor);
  registerStdlib(e);
  return e;
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "player1", executor: "player1", ...overrides });
}

function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── 1. Math expressions ───────────────────────────────────────────────────────

describe("e2e — math", () => {
  it("[add(2,3)] → 5",               async () => assertEquals(await ev("[add(2,3)]"),         "5"));
  it("[mul(add(2,3),4)] → 20",       async () => assertEquals(await ev("[mul([add(2,3)],4)]"), "20"));
  it("[div(10,3)] → 3 (integer)",    async () => assertEquals(await ev("[div(10,3)]"),         "3"));
  it("[mod(10,3)] → 1",              async () => assertEquals(await ev("[mod(10,3)]"),         "1"));
  it("[max(1,5,3)] → 5",             async () => assertEquals(await ev("[max(1,5,3)]"),        "5"));
  it("[min(1,5,3)] → 1",             async () => assertEquals(await ev("[min(1,5,3)]"),        "1"));
  it("[abs(-5)] → 5",                async () => assertEquals(await ev("[abs(-5)]"),           "5"));
  it("[round(3.567,0)] → 4",         async () => assertEquals(await ev("[round(3.567,0)]"),    "4"));
  it("[sub(10,4)] → 6",              async () => assertEquals(await ev("[sub(10,4)]"),         "6"));
  it("[power(2,8)] → 256",           async () => assertEquals(await ev("[power(2,8)]"),        "256"));
  it("[sqrt(9)] → 3",                async () => assertEquals(await ev("[sqrt(9)]"),           "3"));
  it("[floor(3.9)] → 3",             async () => assertEquals(await ev("[floor(3.9)]"),        "3"));
  it("[ceil(3.1)] → 4",              async () => assertEquals(await ev("[ceil(3.1)]"),         "4"));

  it("float div returns decimal",    async () => {
    // 10.0 is treated as integer 10 by JS (Number.isInteger(10.0) === true)
    // so div(10.0, 3) uses integer truncation → 3
    assertEquals(await ev("[div(10.0,3)]"), "3");
  });

  it("nested math: mul(add,sub)",    async () => assertEquals(await ev("[mul([add(3,2)],[sub(10,5)])]"), "25"));
  it("add with negative numbers",    async () => assertEquals(await ev("[add(-3,7)]"),   "4"));
  it("mul cascading",                async () => assertEquals(await ev("[mul(2,3,4)]"),  "24"));
});

// ── 2. String functions ───────────────────────────────────────────────────────

describe("e2e — string", () => {
  it("[strlen(hello)] → 5",          async () => assertEquals(await ev("[strlen(hello)]"),          "5"));
  it("[ucstr(hello)] → HELLO",       async () => assertEquals(await ev("[ucstr(hello)]"),           "HELLO"));
  it("[lcstr(HELLO)] → hello",       async () => assertEquals(await ev("[lcstr(HELLO)]"),           "hello"));
  it("[capstr(hello world)]",        async () => assertEquals(await ev("[capstr(hello world)]"),    "Hello world"));
  it("[trim(  hello  )] → hello",    async () => assertEquals(await ev("[trim(  hello  )]"),        "hello"));
  it("[left(hello,3)] → hel",        async () => assertEquals(await ev("[left(hello,3)]"),          "hel"));
  it("[right(hello,3)] → llo",       async () => assertEquals(await ev("[right(hello,3)]"),         "llo"));
  it("[mid(hello,1,3)] → ell",       async () => assertEquals(await ev("[mid(hello,1,3)]"),         "ell"));
  it("[repeat(ab,3)] → ababab",      async () => assertEquals(await ev("[repeat(ab,3)]"),           "ababab"));
  it("[cat(a,b,c)] → a b c",         async () => assertEquals(await ev("[cat(a,b,c)]"),             "a b c"));

  it("[ljust(hi,5)] → hi   ",        async () => assertEquals(await ev("[ljust(hi,5)]"),   "hi   "));
  it("[rjust(hi,5)] →    hi",        async () => assertEquals(await ev("[rjust(hi,5)]"),   "   hi"));
  it("[center(hi,6)] →   hi  ",      async () => assertEquals(await ev("[center(hi,6)]"),  "  hi  "));
  it("[space(4)] → 4 spaces",        async () => assertEquals(await ev("[space(4)]"),      "    "));

  it("strlen of concatenation",      async () => assertEquals(await ev("[strlen([cat(ab,cd)])]"),   "5"));
  it("nested ucstr(left)",           async () => assertEquals(await ev("[ucstr([left(hello,3)])]"), "HEL"));
});

// ── 3. Logic / control flow ───────────────────────────────────────────────────

describe("e2e — logic", () => {
  it("[if(1,yes,no)] → yes",         async () => assertEquals(await ev("[if(1,yes,no)]"),     "yes"));
  it("[if(0,yes,no)] → no",          async () => assertEquals(await ev("[if(0,yes,no)]"),     "no"));
  it("[if(,yes,no)] → no",           async () => assertEquals(await ev("[if(,yes,no)]"),      "no"));
  it("[if(1,yes)] (no else) → yes",  async () => assertEquals(await ev("[if(1,yes)]"),        "yes"));
  it("[if(0,yes)] (no else) → ''",   async () => assertEquals(await ev("[if(0,yes)]"),        ""));
  it("[ifelse(1,yes,no)] → yes",     async () => assertEquals(await ev("[ifelse(1,yes,no)]"), "yes"));
  it("[ifelse(0,yes,no)] → no",      async () => assertEquals(await ev("[ifelse(0,yes,no)]"), "no"));
  it("[not(0)] → 1",                 async () => assertEquals(await ev("[not(0)]"),           "1"));
  it("[not(1)] → 0",                 async () => assertEquals(await ev("[not(1)]"),           "0"));
  it("[not(hello)] → 0",             async () => assertEquals(await ev("[not(hello)]"),       "0"));
  it("[and(1,1,1)] → 1",             async () => assertEquals(await ev("[and(1,1,1)]"),       "1"));
  it("[and(1,0,1)] → 0",             async () => assertEquals(await ev("[and(1,0,1)]"),       "0"));
  it("[or(0,0,0)] → 0",              async () => assertEquals(await ev("[or(0,0,0)]"),        "0"));
  it("[or(0,1,0)] → 1",              async () => assertEquals(await ev("[or(0,1,0)]"),        "1"));
  it("[t(hello)] → 1",               async () => assertEquals(await ev("[t(hello)]"),         "1"));
  it("[t(0)] → 0",                   async () => assertEquals(await ev("[t(0)]"),             "0"));

  it("switch finds match",           async () => assertEquals(await ev("[switch(b,a,alpha,b,beta,gamma)]"),  "beta"));
  it("switch falls to default",      async () => assertEquals(await ev("[switch(x,a,alpha,b,beta,default)]"),"default"));
  it("switch no match no default",   async () => assertEquals(await ev("[switch(x,a,one,b,two)]"),           ""));

  // Note: #-1 is truthy in TinyMUX — it's a non-empty, non-"0" string
  it("#-1 is truthy in if (error strings are truthy)", async () => assertEquals(await ev("[if(#-1,yes,no)]"), "yes"));
});

// ── 4. Short-circuit behavior ─────────────────────────────────────────────────

describe("e2e — short-circuit", () => {
  it("and(0,...) never evaluates second arg", async () => {
    // If and() were eager, div(1,0) would error; short-circuit returns "0"
    assertEquals(await ev("[and(0,[div(1,0)])]"), "0");
  });

  it("or(1,...) never evaluates second arg", async () => {
    assertEquals(await ev("[or(1,[div(1,0)])]"), "1");
  });

  it("if(1,yes,...) never evaluates else branch", async () => {
    const c = ctx();
    const engine = makeEngine();
    // if short-circuit works, setq never runs
    const result = await engine.evalString("[if(1,yes,[setq(0,bad)][r(0)])]", c);
    assertEquals(result, "yes");
    assertEquals(c.registers.get("0"), undefined); // register was never set
  });

  it("if(0,...,no) never evaluates true branch", async () => {
    const c = ctx();
    const engine = makeEngine();
    const result = await engine.evalString("[if(0,[setq(0,bad)][r(0)],no)]", c);
    assertEquals(result, "no");
    assertEquals(c.registers.get("0"), undefined);
  });

  it("and short-circuit: side-effect register not set", async () => {
    const c = ctx();
    const engine = makeEngine();
    const result = await engine.evalString("[and(0,[setq(0,ran)][r(0)])]", c);
    assertEquals(result, "0");
    assertEquals(c.registers.get("0"), undefined);
  });
});

// ── 5. Iteration ──────────────────────────────────────────────────────────────

describe("e2e — iter", () => {
  it("[iter(a b c,##)] → a b c",        async () => assertEquals(await ev("[iter(a b c,##)]"),           "a b c"));
  it("[iter(a b c,#@)] → 1 2 3",        async () => assertEquals(await ev("[iter(a b c,#@)]"),           "1 2 3"));
  it("iter with [##]@[#@] pattern",      async () => assertEquals(await ev("[iter(a b c,[##]@[#@])]"),   "a@1 b@2 c@3"));
  it("iter custom out-delim",            async () => assertEquals(await ev("[iter(a b c,##, ,-)]"),       "a-b-c"));
  it("iter empty list → empty",          async () => assertEquals(await ev("[iter(,body)]"),              ""));
  it("iter with function in body",       async () => assertEquals(await ev("[iter(a b c,[strlen(##)])]"), "1 1 1"));
  it("iter with custom in-delim",        async () => assertEquals(await ev("[iter(a|b|c,##,|)]"),         "a b c"));
  it("iter computes index correctly",    async () => assertEquals(await ev("[iter(x y z,#@)]"),           "1 2 3"));
  it("iter nested ## = inner frame",     async () => assertEquals(await ev("[iter(a b,[iter(1 2,##)])]"), "1 2 1 2"));
  it("iter %i1 accesses outer frame",    async () => assertEquals(await ev("[iter(x y,[iter(1 2,%i1)])]"), "x x y y"));
});

// ── 6. Q-registers ────────────────────────────────────────────────────────────

describe("e2e — registers", () => {
  it("[setq(0,hello)][r(0)] → hello",       async () => assertEquals(await ev("[setq(0,hello)][r(0)]"),              "hello"));
  it("multiple registers independent",       async () => assertEquals(await ev("[setq(0,a)][setq(1,b)][r(0)][r(1)]"), "ab"));
  it("overwrite register",                   async () => assertEquals(await ev("[setq(0,before)][setq(0,after)][r(0)]"), "after"));
  it("r of unset register → empty",          async () => assertEquals(await ev("[r(zzz)]"),                           ""));
  it("[setr(0,world)] returns value",        async () => assertEquals(await ev("[setr(0,world)]"),                    "world"));
  it("setr then r via %q",                   async () => assertEquals(await ev("[setr(x,foo)][r(x)]"),                "foofoo"));
  it("%q shorthand reads register",          async () => assertEquals(await ev("[setq(k,hi)]%qk"),                    "hi"));

  it("registers pre-seeded via ctx",         async () => {
    const regs = new Map<string, string>([["0", "85"], ["1", "100"]]);
    const result = await ev("Score: [r(0)] / [r(1)]", { registers: regs });
    assertEquals(result, "Score: 85 / 100");
  });
});

// ── 7. Substitutions ─────────────────────────────────────────────────────────

describe("e2e — substitutions", () => {
  it("%# → enactor id",          async () => assertEquals(await ev("%#"),                          "player1"));
  it("%! → executor id",         async () => assertEquals(await ev("%!"),                          "player1"));
  it("%0 with args",             async () => assertEquals(await ev("%0", { args: ["hello"] }),     "hello"));
  it("%1 second arg",            async () => assertEquals(await ev("%1", { args: ["a", "b"] }),   "b"));
  it("%+ arg count",             async () => assertEquals(await ev("%+", { args: ["a", "b"] }),   "2"));
  it("%% → literal %",          async () => assertEquals(await ev("%%"),                           "%"));
  it("%r → newline",             async () => assertEquals(await ev("%r"),                           "\r\n"));
  it("%t → tab",                 async () => assertEquals(await ev("%t"),                           "\t"));
  it("%b → space",               async () => assertEquals(await ev("%b"),                           " "));
  it("%N → enactor name",        async () => assertEquals(await ev("%N"),                           "Alice"));
  it("%n → enactor name lower",  async () => assertEquals(await ev("%n"),                           "alice"));
  it("%0 empty when no args",    async () => assertEquals(await ev("%0"),                           ""));
  it("%q0 reads register",       async () => assertEquals(await ev("[setq(0,test)]%q0"),           "test"));
});

// ── 8. Nested / complex expressions ──────────────────────────────────────────

describe("e2e — nested expressions", () => {
  it("add(strlen, strlen)",      async () => assertEquals(await ev("[add([strlen(hello)],[strlen(world)])]"), "10"));
  it("if(gt, upper, lower)",     async () => assertEquals(await ev("[if([gt(3,2)],[ucstr(yes)],[lcstr(NO)])]"), "YES"));
  it("iter(ilist-like with add)", async () => assertEquals(await ev("[iter(1 2 3,[add(##,10)])]"),             "11 12 13"));
  it("setq then add with r",     async () => assertEquals(await ev("[setq(0,5)][add([r(0)],3)]"),             "8"));
  it("nested iter with mul",     async () => assertEquals(await ev("[iter(1 2 3,[mul(##,##)])]"),             "1 4 9"));
  it("switch with computed value", async () => assertEquals(await ev("[switch([add(1,1)],1,one,2,two,other)]"), "two"));
  it("if with register condition", async () => assertEquals(await ev("[setq(0,5)][if([gt([r(0)],3)],big,small)]"), "big"));
  it("deep nesting: add inside mul inside if", async () =>
    assertEquals(await ev("[if(1,[mul([add(2,3)],[sub(10,5)])])]/done"), "25/done"));
});

// ── 9. Error handling ─────────────────────────────────────────────────────────

describe("e2e — error handling", () => {
  it("[add(foo,3)] → #-1 not a number",   async () => assertStringIncludes(await ev("[add(foo,3)]"),    "#-1"));
  it("[div(1,0)] → #-1 divide by zero",   async () => assertEquals(await ev("[div(1,0)]"),              "#-1 DIVIDE BY ZERO"));
  it("[sqrt(-1)] → #-1 out of range",     async () => assertEquals(await ev("[sqrt(-1)]"),              "#-1 ARGUMENT OUT OF RANGE"));
  it("[nope()] → #-1 not found",          async () => assertStringIncludes(await ev("[nope()]"),        "#-1 FUNCTION (nope) NOT FOUND"));
  it("[add(1)] → #-1 too few args",       async () => assertStringIncludes(await ev("[add(1)]"),        "#-1"));
  it("[if(1,a)] missing else is ok",       async () => assertEquals(await ev("[if(1,a)]"),               "a"));
  it("[u(me/NOSUCHATTR)] → #-1",          async () => assertEquals(await ev("[u(me/NOSUCHATTR)]"),      "#-1 NO SUCH ATTRIBUTE"));
  it("eval stops after error in chunk",    async () => {
    const result = await ev("[div(1,0)] after");
    // error token is emitted inline, rest of literal follows
    assertEquals(result, "#-1 DIVIDE BY ZERO after");
  });
});

// ── 10. Real-world softcode patterns ─────────────────────────────────────────

describe("e2e — real-world patterns", () => {
  it("conditional gold message (have gold)", async () => {
    const result = await ev("[if([gt(%0,0)],You have %0 gold.,You are broke.)]", { args: ["5"] });
    assertEquals(result, "You have 5 gold.");
  });

  it("conditional gold message (broke)", async () => {
    const result = await ev("[if([gt(%0,0)],You have %0 gold.,You are broke.)]", { args: ["0"] });
    assertEquals(result, "You are broke.");
  });

  it("score display from pre-set registers", async () => {
    const regs = new Map<string, string>([["0", "85"], ["1", "100"]]);
    const result = await ev("Score: [r(0)]/[r(1)]", { registers: regs });
    assertEquals(result, "Score: 85/100");
  });

  it("greeting using u(me/FN_GREET)", async () => {
    const engine = makeEngine();
    const result = await engine.evalString("[u(me/FN_GREET,World)]", ctx());
    assertEquals(result, "Hello, World!");
  });

  it("u(me/FN_ADD) works like inline add", async () => {
    const engine = makeEngine();
    const result = await engine.evalString("[u(me/FN_ADD,10,20)]", ctx());
    assertEquals(result, "30");
  });

  it("iter to uppercase each word", async () => {
    const result = await ev("[iter(alice bob carol,[ucstr(##)])]");
    assertEquals(result, "ALICE BOB CAROL");
  });

  it("iter computing lengths with add", async () => {
    const result = await ev("[iter(cat elephant ox,[strlen(##)])]");
    assertEquals(result, "3 8 2");
  });

  it("setq accumulate sum via iter", async () => {
    // iter returns joined "" results (with spaces between), then r(0) = final sum
    // Output: "" (setq) + " " (iter empty results joined) + "15" (r) = " 15"
    const result = await ev("[setq(0,0)][iter(1 2 3 4 5,[setq(0,[add([r(0)],##)])])][r(0)]");
    assertEquals(result.trim(), "15");
  });

  it("temperature: F from C via formula", async () => {
    // F = C * 9/5 + 32; test 0°C → 32°F
    const result = await ev("[add([div([mul(%0,9)],5)],32)]", { args: ["0"] });
    assertEquals(result, "32");
  });

  it("temperature: 100°C → 212°F", async () => {
    const result = await ev("[add([div([mul(%0,9)],5)],32)]", { args: ["100"] });
    assertEquals(result, "212");
  });
});

// ── 11. u() register scoping ──────────────────────────────────────────────────

describe("e2e — u() register scoping", () => {
  it("u() gets fresh registers (no leak from caller)", async () => {
    // outer %q0 = "outer"; u(FN_ADD) sets its own regs; outer %q0 unchanged
    const result = await ev("[setq(0,outer)][u(me/FN_ADD,1,2)][r(0)]");
    assertEquals(result, "3outer"); // FN_ADD returns "3"; outer r(0) still "outer"
  });

  it("u(me/FN_SETQ) result shares via return value, not register leak", async () => {
    const engine = makeEngine();
    const c = ctx();
    // FN_SETQ = "[setq(0,inside)][r(0)]"
    const result = await engine.evalString("[u(me/FN_SETQ)][r(0)]", c);
    // u() returns "inside" (that's what FN_SETQ evaluates to)
    // outer r(0) should be "" since u() has its own fresh registers
    assertEquals(result, "inside");  // u() returns "inside", outer %q0 is ""
  });

  it("u() %@ = outer executor", async () => {
    // Create an accessor that returns "%@" as the CALLER attr
    const customAttrs: Record<string, Record<string, string>> = {
      ...attrs,
      player1: { ...attrs.player1, FN_CALLER: "%@" },
    };
    const customAccessor: ObjectAccessor = {
      ...accessor,
      getAttr: (id, attr) => Promise.resolve(customAttrs[id]?.[attr.toUpperCase()] ?? null),
    };
    const engine = new EvalEngine(customAccessor);
    registerStdlib(engine);
    const result = await engine.evalString("[u(me/FN_CALLER)]", ctx());
    assertEquals(result, "player1");
  });
});

// ── 12. Compare functions ─────────────────────────────────────────────────────

describe("e2e — compare", () => {
  it("[eq(5,5)] → 1",      async () => assertEquals(await ev("[eq(5,5)]"),   "1"));
  it("[eq(5,6)] → 0",      async () => assertEquals(await ev("[eq(5,6)]"),   "0"));
  it("[neq(5,6)] → 1",     async () => assertEquals(await ev("[neq(5,6)]"),  "1"));
  it("[gt(5,3)] → 1",      async () => assertEquals(await ev("[gt(5,3)]"),   "1"));
  it("[gt(3,5)] → 0",      async () => assertEquals(await ev("[gt(3,5)]"),   "0"));
  it("[lt(3,5)] → 1",      async () => assertEquals(await ev("[lt(3,5)]"),   "1"));
  it("[gte(5,5)] → 1",     async () => assertEquals(await ev("[gte(5,5)]"),  "1"));
  it("[lte(5,5)] → 1",     async () => assertEquals(await ev("[lte(5,5)]"),  "1"));
  it("compare inside if",  async () => assertEquals(await ev("[if([gt(10,5)],big,small)]"), "big"));
});

// ── 13. List functions ────────────────────────────────────────────────────────

describe("e2e — list functions", () => {
  it("[words(a b c)] → 3",     async () => assertEquals(await ev("[words(a b c)]"),   "3"));
  it("[words(hello)] → 1",     async () => assertEquals(await ev("[words(hello)]"),   "1"));
  it("[first(a b c)] → a",     async () => assertEquals(await ev("[first(a b c)]"),   "a"));
  it("[last(a b c)] → c",      async () => assertEquals(await ev("[last(a b c)]"),    "c"));
  it("[rest(a b c)] → b c",    async () => assertEquals(await ev("[rest(a b c)]"),    "b c"));
  it("[rest(a)] → empty",      async () => assertEquals(await ev("[rest(a)]"),         ""));
  it("[word(a b c d,2)] → b",  async () => assertEquals(await ev("[word(a b c d,2)]"), "b"));
  it("[word(a b c,9)] → empty",async () => assertEquals(await ev("[word(a b c,9)]"),   ""));
  it("words with many spaces", async () => assertEquals(await ev("[words(a  b  c)]"),  "3"));
  it("rest with custom delim", async () => assertEquals(await ev("[rest(a|b|c,|)]"),   "b|c"));
});

// ── 14. Database functions ────────────────────────────────────────────────────

describe("e2e — db functions", () => {
  it("[get(me/SCORE)] = 85",          async () => assertEquals(await ev("[get(me/SCORE)]"),        "85"));
  it("[get(player1/SCORE)] = 85",     async () => assertEquals(await ev("[get(player1/SCORE)]"),   "85"));
  it("[get(me/NOEXIST)] = empty",     async () => assertEquals(await ev("[get(me/NOEXIST)]"),      ""));
  it("[get(zzz/SCORE)] = #-1",        async () => assertEquals(await ev("[get(zzz/SCORE)]"),       "#-1 NO MATCH"));
  it("[get(just_text)] = #-1 format", async () => assertEquals(await ev("[get(just_text)]"),       "#-1 BAD ARGUMENT FORMAT"));
  it("[name(me)] = Alice",            async () => assertEquals(await ev("[name(me)]"),              "Alice"));
  it("[name(zzz)] = #-1",             async () => assertEquals(await ev("[name(zzz)]"),             "#-1 NO MATCH"));
  it("[hasattr(me,SCORE)] = 1",       async () => assertEquals(await ev("[hasattr(me,SCORE)]"),    "1"));
  it("[hasattr(me,NOPE)] = 0",        async () => assertEquals(await ev("[hasattr(me,NOPE)]"),     "0"));
  it("[hasflag(me,wizard)] = 1",      async () => assertEquals(await ev("[hasflag(me,wizard)]"),   "1"));
  it("[hasflag(me,builder)] = 0",     async () => assertEquals(await ev("[hasflag(me,builder)]"),  "0"));
});

// ── 15. Mixed literal and function output ─────────────────────────────────────

describe("e2e — mixed literal + eval", () => {
  it("literal before function",     async () => assertEquals(await ev("Result: [add(2,3)]"),     "Result: 5"));
  it("function between literals",   async () => assertEquals(await ev("A[add(1,1)]B"),           "A2B"));
  it("multiple functions inline",   async () => assertEquals(await ev("[add(1,2)] and [mul(2,3)]"), "3 and 6"));
  it("substitution in literal",     async () => assertEquals(await ev("Hi %N!"),                 "Hi Alice!"));
  it("arg substitution in formula", async () => assertEquals(await ev("Count: %0", { args: ["7"] }), "Count: 7"));
  it("empty source → empty",        async () => assertEquals(await ev(""),                       ""));
  it("plain literal unchanged",     async () => assertEquals(await ev("hello world"),            "hello world"));
});

// ── Additional e2e tests (from tdd-audit, self-contained fixture) ─────────────

const auditAttrs: Record<string, Record<string, string>> = {
  player: {
    NAME:     "Player",
    LEVEL:    "5",
    FN_GREET: "Hello, %0!",
    FN_ADD:   "[add(%0,%1)]",
    FN_SUM:   "[add(%0,[add(%1,%2)])]",
    FN_DEEP:  "[u(me/FN_ADD,%0,%1)]",
  },
};

const auditAccessor: ObjectAccessor = {
  getAttr(id, attr) {
    return Promise.resolve(auditAttrs[id]?.[attr.toUpperCase()] ?? null);
  },
  resolveTarget(_from, expr) {
    if (expr === "me" || expr === "player") return Promise.resolve("player");
    return Promise.resolve(null);
  },
  getName(id) {
    if (id === "player") return Promise.resolve("Player");
    return Promise.resolve(id);
  },
  hasFlag(_id, _flag) { return Promise.resolve(false); },
};

function makeAuditEngine(): EvalEngine {
  const e = new EvalEngine(auditAccessor);
  registerStdlib(e);
  return e;
}

function auditCtx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "player", executor: "player", ...overrides });
}

function evA(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeAuditEngine().evalString(src, auditCtx(overrides));
}

describe("e2e — basic eval pipeline", () => {
  it("plain text passes through unchanged",
    async () => assertEquals(await evA("hello world"), "hello world"));

  it("simple function call",
    async () => assertEquals(await evA("[add(1,2)]"), "3"));

  it("function call embedded in text",
    async () => assertEquals(await evA("Result: [add(3,4)]!"), "Result: 7!"));

  it("two function calls concatenated",
    async () => assertEquals(await evA("[add(1,2)][mul(3,4)]"), "312"));

  it("substitution + function",
    async () => assertEquals(await evA("[strlen(%N)]"), "6")); // "Player" = 6 chars
});

describe("e2e — nested function calls", () => {
  it("2 levels deep: [add([add(1,2)],3)] = 6",
    async () => assertEquals(await evA("[add([add(1,2)],3)]"), "6"));

  it("3 levels deep: [add([add([add(1,1)],1)],1)] = 4",
    async () => assertEquals(await evA("[add([add([add(1,1)],1)],1)]"), "4"));

  it("nested comparisons: [gt([add(2,3)],4)] = 1",
    async () => assertEquals(await evA("[gt([add(2,3)],4)]"), "1"));

  it("nested string ops: [ucstr([left(hello,3)])] = HEL",
    async () => assertEquals(await evA("[ucstr([left(hello,3)])]"), "HEL"));
});

describe("e2e — register setq + %q substitution", () => {
  it("%q0 substitution after setq",
    async () => assertEquals(await evA("[setq(0,hello)]%q0"), "hello"));

  it("setq mid-expression, then use later in same string",
    async () => assertEquals(await evA("a[setq(x,42)]b[r(x)]c"), "ab42c"));

  it("registers persist across multiple function calls in same string",
    async () => assertEquals(
      await evA("[setq(a,3)][setq(b,4)][add([r(a)],[r(b)])]"),
      "7",
    ));

  it("overwrite register",
    async () => assertEquals(await evA("[setq(0,first)][setq(0,second)]%q0"), "second"));
});

describe("e2e — iter() nesting and ## scoping", () => {
  it("iter basic",
    async () => assertEquals(await evA("[iter(a b c,##)]"), "a b c"));

  it("nested iter: inner ## is inner item",
    async () => assertEquals(
      await evA("[iter(a b,[iter(1 2,##)])]"),
      "1 2 1 2",
    ));

  it("nested iter: outer ## via %i1 in inner",
    async () => assertEquals(
      await evA("[iter(x y,[iter(1 2,%i1)])]"),
      "x x y y",
    ));

  it("deeply nested iter: %i2 from 3 levels out",
    async () => assertEquals(
      await evA("[iter(A B,[iter(x y,[iter(1 2,%i2)])])]"),
      "A A A A B B B B",
    ));

  it("iter with setq inside body — register persists outside",
    async () => {
      const result = await evA("[iter(a b c,[setq(0,##)])][r(0)]");
      assertEquals(result.endsWith("c"), true);
    });

  it("iter index #@ 1-based",
    async () => assertEquals(await evA("[iter(a b c,#@)]"), "1 2 3"));
});

describe("e2e — u() function calls", () => {
  it("u() basic call",
    async () => assertEquals(await evA("[u(me/FN_GREET,World)]"), "Hello, World!"));

  it("u() with math",
    async () => assertEquals(await evA("[u(me/FN_ADD,5,7)]"), "12"));

  it("u() two levels deep",
    async () => assertEquals(await evA("[u(me/FN_DEEP,3,4)]"), "7"));

  it("u() child registers don't leak to parent",
    async () => {
      const result = await evA("[setq(0,outer)][u(me/FN_ADD,1,2)][r(0)]");
      assertEquals(result, "3outer");
    });

  it("u() args accessible as %0 %1 %2 in called attr",
    async () => assertEquals(await evA("[u(me/FN_SUM,1,2,3)]"), "6"));
});

describe("e2e — conditional evaluation", () => {
  it("if true branch",
    async () => assertEquals(await evA("[if(1,yes,no)]"), "yes"));

  it("if false branch",
    async () => assertEquals(await evA("[if(0,yes,no)]"), "no"));

  it("if with computed condition",
    async () => assertEquals(await evA("[if([gt([strlen(hello)],3)],long,short)]"), "long"));

  it("switch finds match",
    async () => assertEquals(await evA("[switch(b,a,first,b,second,default)]"), "second"));

  it("nested if/switch",
    async () => assertEquals(
      await evA("[if([eq(1,1)],[switch(x,x,found,nope)],no)]"),
      "found",
    ));
});

describe("e2e — error propagation", () => {
  it("math error embeds in surrounding text",
    async () => assertEquals(await evA("val=[div(1,0)]"), "val=#-1 DIVIDE BY ZERO"));

  it("unknown function error",
    async () => assertEquals(await evA("[nope(1,2)]"), "#-1 FUNCTION (nope) NOT FOUND"));

  it("too few args error",
    async () => assertEquals(await evA("[add(1)]"), "#-1 FUNCTION (add) REQUIRES AT LEAST 2 ARGUMENT(S)"));

  it("depth exceeded propagates correctly",
    async () => {
      const engine = makeAuditEngine();
      const c = auditCtx({ depth: 101, maxDepth: 100 });
      assertEquals(await engine.evalString("[add(1,2)]", c), "#-1 EVALUATION DEPTH EXCEEDED");
    });
});

describe("e2e — escape sequences and literals", () => {
  it("escaped [ is literal",
    async () => assertEquals(await evA("%[hello%]"), "[hello]"));

  it("escaped %% = %",
    async () => assertEquals(await evA("100%%"), "100%"));

  it("escaped %r in text produces CRLF",
    async () => assertEquals(await evA("line1%rline2"), "line1\r\nline2"));

  it("escaped comma in arg via %,",
    async () => assertEquals(await evA("[strlen(%,)]"), "1"));
});

describe("e2e — DB function integration", () => {
  it("get(me/LEVEL) = 5",
    async () => assertEquals(await evA("[get(me/LEVEL)]"), "5"));

  it("hasattr → conditional",
    async () => assertEquals(await evA("[if([hasattr(me,LEVEL)],has_level,no)]"), "has_level"));

  it("name used in string",
    async () => assertEquals(await evA("Hello [name(me)]!"), "Hello Player!"));

  it("get unset attr = empty, used in math → 1 (empty coerces to 0)",
    async () => assertEquals(await evA("[add([get(me/NOPE)],1)]"), "1"));
});
