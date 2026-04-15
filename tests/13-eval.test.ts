// ============================================================================
// 13 — EvalEngine: stdlib functions, substitutions, and error handling
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Test fixture ──────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  async getAttr(objectId, attr) {
    const db: Record<string, Record<string, string>> = {
      obj1: {
        NAME:      "Alice",
        SCORE:     "42",
        FN_ADD:    "[add(%0,%1)]",
        FN_GREET:  "Hello, %0!",
        FN_DEEP:   "[u(me/FN_ADD,%0,%1)]",   // wraps FN_ADD for depth test
        FN_RECUR:  "[u(me/FN_RECUR,%0)]",    // infinite recursion — hits depth limit
      },
      obj2: { NAME: "Bob", SCORE: "7" },
    };
    return db[objectId]?.[attr.toUpperCase()] ?? null;
  },
  async resolveTarget(_from, expr) {
    if (expr === "me" || expr === "obj1") return "obj1";
    if (expr === "obj2" || expr === "Bob") return "obj2";
    return null;
  },
  async getName(objectId) {
    if (objectId === "obj1") return "Alice";
    if (objectId === "obj2") return "Bob";
    return objectId;
  },
  async hasFlag(_id, flag) {
    return flag === "wizard" && _id === "obj1";
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

async function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── Math ──────────────────────────────────────────────────────────────────────

describe("eval — math", () => {
  it("add(1,2) = 3",            async () => assertEquals(await ev("[add(1,2)]"),       "3"));
  it("add variadic",            async () => assertEquals(await ev("[add(1,2,3)]"),     "6"));
  it("sub(5,3) = 2",            async () => assertEquals(await ev("[sub(5,3)]"),       "2"));
  it("mul(3,4) = 12",           async () => assertEquals(await ev("[mul(3,4)]"),       "12"));
  it("div(6,2) = 3 (integer)",  async () => assertEquals(await ev("[div(6,2)]"),       "3"));
  it("div(5,2) = 2 (truncate)", async () => assertEquals(await ev("[div(5,2)]"),       "2"));
  it("mod(7,3) = 1",            async () => assertEquals(await ev("[mod(7,3)]"),       "1"));
  it("abs(-5) = 5",             async () => assertEquals(await ev("[abs(-5)]"),        "5"));
  it("floor(3.7) = 3",          async () => assertEquals(await ev("[floor(3.7)]"),     "3"));
  it("ceil(3.2) = 4",           async () => assertEquals(await ev("[ceil(3.2)]"),      "4"));
  it("round(3.567,2) = 3.57",   async () => assertEquals(await ev("[round(3.567,2)]"),"3.57"));
  it("max(1,5,3) = 5",          async () => assertEquals(await ev("[max(1,5,3)]"),     "5"));
  it("min(1,5,3) = 1",          async () => assertEquals(await ev("[min(1,5,3)]"),     "1"));
  it("power(2,10) = 1024",      async () => assertEquals(await ev("[power(2,10)]"),    "1024"));
  it("sqrt(4) = 2",             async () => assertEquals(await ev("[sqrt(4)]"),        "2"));
  it("div by zero → #-1",       async () => assertEquals(await ev("[div(1,0)]"),       "#-1 DIVIDE BY ZERO"));
  it("sqrt(-1) → #-1",         async () => assertEquals(await ev("[sqrt(-1)]"),       "#-1 ARGUMENT OUT OF RANGE"));
  it("non-number → #-1",       async () => assertEquals(await ev("[add(x,1)]"),       "#-1 ARGUMENT (X) IS NOT A NUMBER"));
});

// ── String ────────────────────────────────────────────────────────────────────

describe("eval — string", () => {
  it("strlen",         async () => assertEquals(await ev("[strlen(hello)]"),        "5"));
  it("mid 0-based",    async () => assertEquals(await ev("[mid(hello,1,3)]"),       "ell"));
  it("left",           async () => assertEquals(await ev("[left(hello,3)]"),        "hel"));
  it("right",          async () => assertEquals(await ev("[right(hello,3)]"),       "llo"));
  it("trim both",      async () => assertEquals(await ev("[trim( hello )]"),        "hello"));
  it("trim left",      async () => assertEquals(await ev("[trim( hello ,l)]"),      "hello "));
  it("trim right",     async () => assertEquals(await ev("[trim( hello ,r)]"),      " hello"));
  it("ucstr",          async () => assertEquals(await ev("[ucstr(hello)]"),         "HELLO"));
  it("lcstr",          async () => assertEquals(await ev("[lcstr(HELLO)]"),         "hello"));
  it("capstr",         async () => assertEquals(await ev("[capstr(hello world)]"),  "Hello world"));
  it("cat joins",      async () => assertEquals(await ev("[cat(hello,world)]"),     "hello world"));
  it("space(3)",        async () => assertEquals(await ev("[space(3)]"),             "   "));
  it("repeat",         async () => assertEquals(await ev("[repeat(ab,3)]"),         "ababab"));
  it("ljust",          async () => assertEquals(await ev("[ljust(hi,5)]"),          "hi   "));
  it("rjust",          async () => assertEquals(await ev("[rjust(hi,5)]"),          "   hi"));
  it("center even",    async () => assertEquals(await ev("[center(hi,6)]"),         "  hi  "));
});

// ── Compare ───────────────────────────────────────────────────────────────────

describe("eval — compare", () => {
  it("eq match",   async () => assertEquals(await ev("[eq(1,1)]"),  "1"));
  it("eq no match",async () => assertEquals(await ev("[eq(1,2)]"),  "0"));
  it("neq",        async () => assertEquals(await ev("[neq(1,2)]"), "1"));
  it("gt true",    async () => assertEquals(await ev("[gt(3,2)]"),  "1"));
  it("gt false",   async () => assertEquals(await ev("[gt(2,3)]"),  "0"));
  it("lt true",    async () => assertEquals(await ev("[lt(2,3)]"),  "1"));
  it("gte equal",  async () => assertEquals(await ev("[gte(3,3)]"), "1"));
  it("lte equal",  async () => assertEquals(await ev("[lte(3,3)]"), "1"));
});

// ── Logic ─────────────────────────────────────────────────────────────────────

describe("eval — logic", () => {
  it("t(1) = 1",                  async () => assertEquals(await ev("[t(1)]"),                           "1"));
  it("t(0) = 0",                  async () => assertEquals(await ev("[t(0)]"),                           "0"));
  it("not(1) = 0",                async () => assertEquals(await ev("[not(1)]"),                         "0"));
  it("not(0) = 1",                async () => assertEquals(await ev("[not(0)]"),                         "1"));
  it("if true branch",            async () => assertEquals(await ev("[if(1,yes)]"),                      "yes"));
  it("if false branch = empty",   async () => assertEquals(await ev("[if(0,yes)]"),                      ""));
  it("if false with else",        async () => assertEquals(await ev("[if(0,yes,no)]"),                   "no"));
  it("ifelse true",               async () => assertEquals(await ev("[ifelse(1,yes,no)]"),               "yes"));
  it("ifelse false",              async () => assertEquals(await ev("[ifelse(0,yes,no)]"),               "no"));
  it("switch finds match",        async () => assertEquals(await ev("[switch(b,a,first,b,second,nope)]"),"second"));
  it("switch uses default",       async () => assertEquals(await ev("[switch(x,a,one,b,two,default)]"),  "default"));
  it("switch no default no match",async () => assertEquals(await ev("[switch(x,a,one,b,two)]"),          ""));
  it("and both true",             async () => assertEquals(await ev("[and(1,1)]"),                       "1"));
  it("and short-circuit false",   async () => assertEquals(await ev("[and(1,0)]"),                       "0"));
  it("or first true",             async () => assertEquals(await ev("[or(0,1)]"),                        "1"));
  it("or all false",              async () => assertEquals(await ev("[or(0,0)]"),                        "0"));
});

// ── Registers ─────────────────────────────────────────────────────────────────

describe("eval — registers", () => {
  it("setq then r", async () => assertEquals(await ev("[setq(0,hello)][r(0)]"),        "hello"));
  it("setr returns value", async () => assertEquals(await ev("[setr(0,world)]"),        "world"));
  it("setr visible via r", async () => assertEquals(await ev("[setr(x,foo)][r(x)]"),   "foofoo"));
  it("r unset = empty",    async () => assertEquals(await ev("[r(zzz)]"),               ""));
  it("%q shorthand",       async () => assertEquals(await ev("[setq(k,hi)]%qk"),        "hi"));
});

// ── Iter ──────────────────────────────────────────────────────────────────────

describe("eval — iter / list", () => {
  it("words space-delimited", async () => assertEquals(await ev("[words(a b c)]"),     "3"));
  it("words single word",      async () => assertEquals(await ev("[words(hello)]"),      "1"));
  it("word(str,2)",            async () => assertEquals(await ev("[word(a b c,2)]"),    "b"));
  it("first",                 async () => assertEquals(await ev("[first(a b c)]"),     "a"));
  it("last",                  async () => assertEquals(await ev("[last(a b c)]"),      "c"));
  it("rest",                  async () => assertEquals(await ev("[rest(a b c)]"),      "b c"));
  it("rest single word",      async () => assertEquals(await ev("[rest(a)]"),           ""));
  it("iter body with ##",     async () => assertEquals(await ev("[iter(a b c,##!)]"),  "a! b! c!"));
  it("iter index with #@",    async () => assertEquals(await ev("[iter(a b c,#@)]"),   "1 2 3"));
  it("iter empty list",       async () => assertEquals(await ev("[iter(,body)]"),      ""));
});

// ── Context substitutions ─────────────────────────────────────────────────────

describe("eval — substitutions", () => {
  it("%# enactor",      async () => assertEquals(await ev("%#"),                      "obj1"));
  it("%! executor",     async () => assertEquals(await ev("%!"),                      "obj1"));
  it("%0 first arg",    async () => assertEquals(await ev("%0",  { args: ["hi"] }),  "hi"));
  it("%1 second arg",   async () => assertEquals(await ev("%1",  { args: ["a","b"]}), "b"));
  it("%+ arg count",    async () => assertEquals(await ev("%+",  { args: ["a","b"]}), "2"));
  it("%r newline",      async () => assertEquals(await ev("%r"),                      "\r\n"));
  it("%t tab",          async () => assertEquals(await ev("%t"),                      "\t"));
  it("%b space",        async () => assertEquals(await ev("%b"),                      " "));
  it("%% literal",      async () => assertEquals(await ev("%%"),                      "%"));
  it("%N name",         async () => assertEquals(await ev("%N"),                      "Alice"));
  it("%n name lower",   async () => assertEquals(await ev("%n"),                      "alice"));
  it("## iter frame",   async () => assertEquals(await ev("[iter(x,##)]"),            "x"));
  it("#@ iter index",   async () => assertEquals(await ev("[iter(x,#@)]"),            "1"));
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("eval — error handling", () => {
  it("unknown fn → #-1",   async () => assertEquals(await ev("[nope()]"),     "#-1 FUNCTION (nope) NOT FOUND"));
  it("too few args → #-1", async () => assertEquals(await ev("[add(1)]"),     "#-1 FUNCTION (add) REQUIRES AT LEAST 2 ARGUMENT(S)"));
  it("too many args → #-1",async () => assertEquals(await ev("[sub(1,2,3)]"), "#-1 FUNCTION (sub) TAKES AT MOST 2 ARGUMENT(S)"));
  it("depth exceeded",     async () => {
    const engine = makeEngine();
    const c = ctx({ depth: 101, maxDepth: 100 });
    assertEquals(await engine.evalString("[add(1,2)]", c), "#-1 EVALUATION DEPTH EXCEEDED");
  });
  it("abort signal", async () => {
    const engine  = makeEngine();
    const ac      = new AbortController();
    ac.abort();
    let threw = false;
    try { await engine.evalString("[add(1,2)]", ctx({ signal: ac.signal })); }
    catch (e) { threw = (e as DOMException).name === "AbortError"; }
    assertEquals(threw, true);
  });
});

// ── Math edge cases ───────────────────────────────────────────────────────────

describe("eval — math edge cases", () => {
  it("float add avoids precision noise", async () => assertEquals(await ev("[add(0.1,0.2)]"),    "0.3"));
  it("negative mod",                    async () => assertEquals(await ev("[mod(-7,3)]"),        "-1"));
  it("div negative truncates toward 0", async () => assertEquals(await ev("[div(-5,2)]"),        "-2"));
  it("mul variadic",                    async () => assertEquals(await ev("[mul(2,3,4)]"),        "24"));
  it("power(0,0) = 1",                  async () => assertEquals(await ev("[power(0,0)]"),        "1"));
  it("abs of 0",                        async () => assertEquals(await ev("[abs(0)]"),            "0"));
  it("round to 0 decimals",             async () => assertEquals(await ev("[round(2.5,0)]"),      "3"));
  it("sqrt of 0",                       async () => assertEquals(await ev("[sqrt(0)]"),            "0"));
  it("large integers stay integers",    async () => assertEquals(await ev("[add(99999999,1)]"),   "100000000"));
});

// ── String edge cases ─────────────────────────────────────────────────────────

describe("eval — string edge cases", () => {
  it("mid negative start clamps to 0", async () => assertEquals(await ev("[mid(hello,-1,3)]"),   "hel"));
  it("mid start past end = empty",     async () => assertEquals(await ev("[mid(hello,10,3)]"),   ""));
  it("mid len=0 = empty",              async () => assertEquals(await ev("[mid(hello,1,0)]"),    ""));
  it("left 0 = empty",                 async () => assertEquals(await ev("[left(hello,0)]"),     ""));
  it("left more than length",          async () => assertEquals(await ev("[left(hi,100)]"),      "hi"));
  it("right 0 = empty",                async () => assertEquals(await ev("[right(hello,0)]"),    ""));
  it("right more than length",         async () => assertEquals(await ev("[right(hi,100)]"),     "hi"));
  it("strlen space is 1",              async () => assertEquals(await ev("[strlen(%b)]"),         "1"));
  it("ljust no-op when str >= width",  async () => assertEquals(await ev("[ljust(hello,3)]"),    "hello"));
  it("center odd padding puts extra on right", async () => assertEquals(await ev("[center(hi,5)]"), " hi  "));
  it("trim custom char",               async () => assertEquals(await ev("[trim(xxhelloxx,b,x)]"), "hello"));
  it("repeat 0 times = empty",         async () => assertEquals(await ev("[repeat(ab,0)]"),      ""));
  it("space 0 = empty",                async () => assertEquals(await ev("[space(0)]"),            ""));
  it("capstr single char",             async () => assertEquals(await ev("[capstr(a)]"),           "A"));
});

// ── Logic edge cases ──────────────────────────────────────────────────────────

describe("eval — logic edge cases", () => {
  it("nested if: if inside condition", async () => assertEquals(await ev("[if([eq(1,1)],yes,no)]"), "yes"));
  it("ifelse with computed condition", async () => assertEquals(await ev("[ifelse([gt(5,3)],big,small)]"), "big"));
  it("and short-circuits: second not evaluated if first false", async () => {
    // If short-circuit works, [div(1,0)] is never evaluated
    assertEquals(await ev("[and(0,[div(1,0)])]"), "0");
  });
  it("or short-circuits: second not evaluated if first true", async () => {
    assertEquals(await ev("[or(1,[div(1,0)])]"), "1");
  });
  it("switch empty value matches empty pattern", async () => assertEquals(await ev("[switch(,,yes)]"), "yes"));
  it("t of non-zero non-empty = 1",   async () => assertEquals(await ev("[t(abc)]"),  "1"));
  it("t of -1 = 1 (truthy)",          async () => assertEquals(await ev("[t(-1)]"),   "1"));
});

// ── Iter edge cases ───────────────────────────────────────────────────────────

describe("eval — iter edge cases", () => {
  it("iter custom delimiter",   async () => assertEquals(await ev("[iter(a|b|c,##,|)]"),      "a b c"));
  it("iter custom out delim",   async () => assertEquals(await ev("[iter(a|b,##,|,.)]"),    "a.b"));
  it("iter nested: inner ## = inner item", async () =>
    assertEquals(await ev("[iter(a b,[iter(1 2,##)])]"),   "1 2 1 2"));
  it("iter nested: outer ## via %i1", async () =>
    assertEquals(await ev("[iter(x y,[iter(1 2,%i1)])]"),  "x x y y"));
  it("rest with custom delim", async () => assertEquals(await ev("[rest(a|b|c,|)]"),  "b|c"));
  it("word out of range = empty", async () => assertEquals(await ev("[word(a b c,9)]"), ""));
  it("words multiple spaces",   async () => assertEquals(await ev("[words(a  b  c)]"), "3"));
});

// ── Substitution edge cases ───────────────────────────────────────────────────

describe("eval — substitution edge cases", () => {
  it("%: = enactor (objid alias)",  async () => assertEquals(await ev("%:"), "obj1"));
  it("%@ = empty when no caller",   async () => assertEquals(await ev("%@"), ""));
  it("%0 empty when no args",       async () => assertEquals(await ev("%0"), ""));
  it("%9 empty when only 2 args",   async () => assertEquals(await ev("%9", { args: ["a","b"] }), ""));
  it("%=NAME reads enactor attr",   async () => assertEquals(await ev("%=NAME"), "Alice"));
  it("%=SCORE reads numeric attr",  async () => assertEquals(await ev("%=SCORE"), "42"));
  it("%=NOEXIST = empty",           async () => assertEquals(await ev("%=NOEXIST"), ""));
  it("%i0 = ## when inside iter",   async () => assertEquals(await ev("[iter(z,%i0)]"), "z"));
  it("ANSI %xr passes through",     async () => assertEquals(await ev("%xr"), "%xr"));
  it("ANSI %cn passes through",     async () => assertEquals(await ev("%cn"), "%cn"));
});

// ── DB functions ──────────────────────────────────────────────────────────────

describe("eval — get / name / hasattr / hasflag", () => {
  it("get(obj1/SCORE) = 42",          async () => assertEquals(await ev("[get(obj1/SCORE)]"),    "42"));
  it("get(me/NAME) = Alice",           async () => assertEquals(await ev("[get(me/NAME)]"),      "Alice"));
  it("get unset attr = empty",         async () => assertEquals(await ev("[get(me/NOPE)]"),      ""));
  it("get no-match target → #-1",     async () => assertEquals(await ev("[get(zzz/SCORE)]"),    "#-1 NO MATCH"));
  it("get no slash → #-1 format",     async () => assertEquals(await ev("[get(just_text)]"),    "#-1 BAD ARGUMENT FORMAT"));
  it("name(obj1) = Alice",            async () => assertEquals(await ev("[name(obj1)]"),        "Alice"));
  it("name(me) = Alice",              async () => assertEquals(await ev("[name(me)]"),          "Alice"));
  it("name no match → #-1",           async () => assertEquals(await ev("[name(zzz)]"),         "#-1 NO MATCH"));
  it("hasattr yes → 1",               async () => assertEquals(await ev("[hasattr(me,NAME)]"),  "1"));
  it("hasattr no → 0",                async () => assertEquals(await ev("[hasattr(me,NOPE)]"),  "0"));
  it("hasattr bad target → 0",        async () => assertEquals(await ev("[hasattr(zzz,NAME)]"), "0"));
  it("hasflag wizard on obj1 → 1",    async () => assertEquals(await ev("[hasflag(me,wizard)]"),"1"));
  it("hasflag builder on obj1 → 0",   async () => assertEquals(await ev("[hasflag(me,builder)]"),"0"));
});

// ── u() function ─────────────────────────────────────────────────────────────

describe("eval — u()", () => {
  it("u(me/FN_GREET,%0) with arg",     async () => assertEquals(await ev("[u(me/FN_GREET,World)]"), "Hello, World!"));
  it("u(me/FN_ADD,%0,%1)",             async () => assertEquals(await ev("[u(me/FN_ADD,3,4)]"),     "7"));
  it("u no-slash uses executor",        async () => assertEquals(await ev("[u(FN_GREET,Test)]"),     "Hello, Test!"));
  it("u no match target → #-1",        async () => assertEquals(await ev("[u(zzz/FN_ADD,1,2)]"),    "#-1 NO MATCH"));
  it("u missing attr → #-1",           async () => assertEquals(await ev("[u(me/NOPE)]"),           "#-1 NO SUCH ATTRIBUTE"));
  it("u increments depth",             async () => assertEquals(await ev("[u(me/FN_DEEP,5,6)]"),    "11"));
  it("u infinite recursion hits limit",async () => assertEquals(await ev("[u(me/FN_RECUR,x)]"),    "#-1 EVALUATION DEPTH EXCEEDED"));
  it("u child registers are fresh",    async () => {
    // setq inside u() must not leak into outer context
    const result = await ev("[setq(0,outer)][u(me/FN_ADD,1,2)][r(0)]");
    assertEquals(result, "3outer"); // FN_ADD returns "3", outer r(0) still "outer"
  });
  it("u %@ = outer executor",          async () => {
    // FN_CALLER attr returns %@ (the caller)
    const engine = makeEngine();
    engine.accessor; // just touch it
    // Register a custom attr getter that exposes %@
    const customAccessor: ObjectAccessor = {
      ...mockAccessor,
      async getAttr(id, attr) {
        if (attr === "FN_CALLER") return "%@";
        return mockAccessor.getAttr(id, attr);
      },
    };
    const e = new EvalEngine(customAccessor);
    registerStdlib(e);
    const result = await e.evalString("[u(me/FN_CALLER)]", ctx());
    assertEquals(result, "obj1");  // caller = previous executor = obj1
  });
});
