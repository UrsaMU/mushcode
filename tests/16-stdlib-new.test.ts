// ============================================================================
// 15 — Phase 3 stdlib additions
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Test fixture ──────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  getAttr(_id, _attr) { return Promise.resolve(null); },
  resolveTarget(_from, expr) {
    if (expr === "me" || expr === "obj1") return Promise.resolve("obj1");
    return Promise.resolve(null);
  },
  getName(id) { return Promise.resolve(id); },
  hasFlag()   { return Promise.resolve(false); },
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

// ── ilist ─────────────────────────────────────────────────────────────────────

describe("ilist", () => {
  it("ilist(5) → 1 2 3 4 5",       async () => assertEquals(await ev("[ilist(5)]"),       "1 2 3 4 5"));
  it("ilist(3,7) → 3 4 5 6 7",     async () => assertEquals(await ev("[ilist(3,7)]"),     "3 4 5 6 7"));
  it("ilist(1,10,3) → 1 4 7 10",   async () => assertEquals(await ev("[ilist(1,10,3)]"),  "1 4 7 10"));
  it("ilist step 0 → #-1",         async () => assertEquals(await ev("[ilist(1,5,0)]"),   "#-1 ARGUMENT OUT OF RANGE"));
  it("ilist empty range",           async () => assertEquals(await ev("[ilist(5,3)]"),     ""));
});

// ── match / matchall ──────────────────────────────────────────────────────────

describe("match / matchall", () => {
  it("match finds first b*",         async () => assertEquals(await ev("[match(foo bar baz,b*)]"), "2"));
  it("match no match → 0",           async () => assertEquals(await ev("[match(foo bar baz,qux)]"), "0"));
  it("match case-insensitive",       async () => assertEquals(await ev("[match(Foo BAR baz,foo)]"),  "1"));
  it("matchall returns all",         async () => assertEquals(await ev("[matchall(foo bar baz,b*)]"), "2 3"));
  it("matchall no match → empty",    async () => assertEquals(await ev("[matchall(foo bar,qux)]"),   ""));
});

// ── v ─────────────────────────────────────────────────────────────────────────

describe("v", () => {
  it("v(attr) → empty when no accessor attr", async () => assertEquals(await ev("[v(MYATTR)]"), ""));
});

// ── isnum / isdbref ───────────────────────────────────────────────────────────

describe("isnum / isdbref", () => {
  it("isnum(42) → 1",     async () => assertEquals(await ev("[isnum(42)]"),    "1"));
  it("isnum(3.14) → 1",   async () => assertEquals(await ev("[isnum(3.14)]"),  "1"));
  it("isnum(foo) → 0",    async () => assertEquals(await ev("[isnum(foo)]"),   "0"));
  it("isnum(-5) → 1",     async () => assertEquals(await ev("[isnum(-5)]"),    "1"));
  it("isdbref(#42) → 1",  async () => assertEquals(await ev("[isdbref(#42)]"), "1"));
  it("isdbref(42) → 0",   async () => assertEquals(await ev("[isdbref(42)]"),  "0"));
  it("isdbref(#-1) → 0",  async () => assertEquals(await ev("[isdbref(#-1)]"), "0"));
  it("isdbref(#0) → 1",   async () => assertEquals(await ev("[isdbref(#0)]"),  "1"));
});

// ── null / noop ───────────────────────────────────────────────────────────────

describe("null / noop", () => {
  it("null returns empty",          async () => assertEquals(await ev("[null(side effect)]"),  ""));
  it("noop returns empty",          async () => assertEquals(await ev("[noop(foo,bar)]"),       ""));
  it("null no args returns empty",  async () => assertEquals(await ev("[null()]"),              ""));
});

// ── Math additions ────────────────────────────────────────────────────────────

describe("math additions", () => {
  it("log(100) → 2",         async () => assertEquals(await ev("[log(100)]"),       "2"));
  it("log(8,2) → 3",         async () => assertEquals(await ev("[log(8,2)]"),       "3"));
  it("log(0) → #-1",         async () => assertEquals(await ev("[log(0)]"),         "#-1 LOG OF ZERO"));
  it("ln(1) → 0",            async () => assertEquals(await ev("[ln(1)]"),          "0"));
  it("exp(0) → 1",           async () => assertEquals(await ev("[exp(0)]"),         "1"));
  it("sin(0) → 0",           async () => assertEquals(await ev("[sin(0)]"),         "0"));
  it("cos(0) → 1",           async () => assertEquals(await ev("[cos(0)]"),         "1"));
  it("tan(0) → 0",           async () => assertEquals(await ev("[tan(0)]"),         "0"));
  it("pi()",                 async () => assertEquals(await ev("[pi()]"),            "3.141592653589793"));
  it("e()",                  async () => assertEquals(await ev("[e()]"),             "2.718281828459045"));
  it("sign(-5) → -1",        async () => assertEquals(await ev("[sign(-5)]"),        "-1"));
  it("sign(0) → 0",          async () => assertEquals(await ev("[sign(0)]"),         "0"));
  it("sign(5) → 1",          async () => assertEquals(await ev("[sign(5)]"),         "1"));
  it("bound(5,1,10) → 5",    async () => assertEquals(await ev("[bound(5,1,10)]"),   "5"));
  it("bound(0,1,10) → 1",    async () => assertEquals(await ev("[bound(0,1,10)]"),   "1"));
  it("bound(15,1,10) → 10",  async () => assertEquals(await ev("[bound(15,1,10)]"),  "10"));
  it("between(5,1,10) → 1",  async () => assertEquals(await ev("[between(5,1,10)]"), "1"));
  it("between(0,1,10) → 0",  async () => assertEquals(await ev("[between(0,1,10)]"), "0"));
  it("fdiv(7,2) → float",    async () => assertEquals(await ev("[fdiv(7,2)]"),        "3.5"));
  it("trunc(3.9) → 3",       async () => assertEquals(await ev("[trunc(3.9)]"),       "3"));
  it("trunc(-3.9) → -3",     async () => assertEquals(await ev("[trunc(-3.9)]"),      "-3"));
  it("inc(5) → 6",           async () => assertEquals(await ev("[inc(5)]"),           "6"));
  it("dec(5) → 4",           async () => assertEquals(await ev("[dec(5)]"),           "4"));
});

// ── String additions ──────────────────────────────────────────────────────────

describe("string additions", () => {
  it("repeat(ab,3) → ababab",      async () => assertEquals(await ev("[repeat(ab,3)]"),           "ababab"));
  it("repeat(ab,0) → empty",       async () => assertEquals(await ev("[repeat(ab,0)]"),           ""));
  it("reverse(hello) → olleh",     async () => assertEquals(await ev("[reverse(hello)]"),         "olleh"));
  it("comp(a,b) → -1",             async () => assertEquals(await ev("[comp(a,b)]"),              "-1"));
  it("comp(b,a) → 1",              async () => assertEquals(await ev("[comp(b,a)]"),              "1"));
  it("comp(a,a) → 0",              async () => assertEquals(await ev("[comp(a,a)]"),              "0"));
  it("streq(hello,HELLO) → 1",     async () => assertEquals(await ev("[streq(hello,HELLO)]"),     "1"));
  it("streq(foo,bar) → 0",         async () => assertEquals(await ev("[streq(foo,bar)]"),         "0"));
  it("setinter(a b c,b c d) → b c",async () => assertEquals(await ev("[setinter(a b c,b c d)]"),  "b c"));
  it("setunion(a b,b c) → a b c",  async () => assertEquals(await ev("[setunion(a b,b c)]"),      "a b c"));
  it("setdiff(a b c,b) → a c",     async () => assertEquals(await ev("[setdiff(a b c,b)]"),       "a c"));
});

// ── List additions ────────────────────────────────────────────────────────────

describe("list additions", () => {
  it("revwords(a b c) → c b a",         async () => assertEquals(await ev("[revwords(a b c)]"),          "c b a"));
  it("sort(c a b) → a b c",             async () => assertEquals(await ev("[sort(c a b)]"),              "a b c"));
  it("sort(3 1 2,n) → 1 2 3",           async () => assertEquals(await ev("[sort(3 1 2,n)]"),            "1 2 3"));
  it("unique(a b a c b) → a b c",       async () => assertEquals(await ev("[unique(a b a c b)]"),        "a b c"));
  it("extract(a b c d e,2,3) → b c d",  async () => assertEquals(await ev("[extract(a b c d e,2,3)]"),   "b c d"));
  it("ldelete(a b c d,2) → a c d",      async () => assertEquals(await ev("[ldelete(a b c d,2)]"),       "a c d"));
  it("replace(a b c d,2,X) → a X c d", async () => assertEquals(await ev("[replace(a b c d,2,X)]"),     "a X c d"));
  it("insert(a b c,2,X) → a X b c",    async () => assertEquals(await ev("[insert(a b c,2,X)]"),        "a X b c"));
  it("grab(foo bar baz,b*) → bar",      async () => assertEquals(await ev("[grab(foo bar baz,b*)]"),     "bar"));
  it("graball(foo bar baz,b*) → bar baz",async () => assertEquals(await ev("[graball(foo bar baz,b*)]"), "bar baz"));
  it("member(a b c,b) → 2",             async () => assertEquals(await ev("[member(a b c,b)]"),          "2"));
  it("member(a b c,x) → 0",             async () => assertEquals(await ev("[member(a b c,x)]"),          "0"));
  it("lpos(a b c,b) → 2",              async () => assertEquals(await ev("[lpos(a b c,b)]"),             "2"));
});

// ── DB stubs ──────────────────────────────────────────────────────────────────

describe("db stubs (no accessor)", () => {
  it("loc → #-1 stub",     async () => assertEquals(await ev("[loc(obj1)]"),     "#-1 FUNCTION (LOC) REQUIRES OBJECT ACCESSOR"));
  it("lcon → #-1 stub",    async () => assertEquals(await ev("[lcon(obj1)]"),    "#-1 FUNCTION (LCON) REQUIRES OBJECT ACCESSOR"));
  it("lwho → #-1 stub",    async () => assertEquals(await ev("[lwho()]"),        "#-1 FUNCTION (LWHO) REQUIRES OBJECT ACCESSOR"));
  it("lparent → #-1 stub", async () => assertEquals(await ev("[lparent(obj1)]"),"#-1 FUNCTION (LPARENT) REQUIRES OBJECT ACCESSOR"));
});

// ── ansi ──────────────────────────────────────────────────────────────────────

describe("ansi", () => {
  it("ansi(h,Hello) → %chHello%cn",           async () => assertEquals(await ev("[ansi(h,Hello)]"),           "%chHello%cn"));
  it("ansi(r,red,n,normal) → combined",       async () => assertEquals(await ev("[ansi(r,red,n,normal)]"),    "%crred%cn%cnnormal%cn"));
});

// ── map / filter lazy ─────────────────────────────────────────────────────────

describe("map / filter (lazy)", () => {
  it("map strlen each item",           async () => assertEquals(await ev("[map(a bb ccc,strlen(##))]"),       "1 2 3"));
  it("map index tracking with #@",     async () => assertEquals(await ev("[map(a b c,#@)]"),                 "1 2 3"));
  it("filter gt(##,2) keeps 3 4 5",    async () => assertEquals(await ev("[filter(1 2 3 4 5,gt(##,2))]"),   "3 4 5"));
  it("filter nothing passes → empty",  async () => assertEquals(await ev("[filter(1 2,gt(##,9))]"),          ""));
});
