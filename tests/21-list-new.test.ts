// ============================================================================
// 21 — New list & iter functions
// ============================================================================

import { assertEquals, assertMatch } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  getAttr(_id, _attr) { return Promise.resolve(null); },
  resolveTarget(_from, _expr) { return Promise.resolve(null); },
  getName(id) { return Promise.resolve(id); },
  hasFlag(_id, _flag) { return Promise.resolve(false); },
};

function makeEngine(): EvalEngine {
  const e = new EvalEngine(mockAccessor);
  registerStdlib(e);
  return e;
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "me", executor: "me", ...overrides });
}

function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── ilist / lnum ─────────────────────────────────────────────────────────────

describe("list — ilist / lnum", () => {
  it("ilist(5) → '1 2 3 4 5'",      async () => assertEquals(await ev("[ilist(5)]"),       "1 2 3 4 5"));
  it("ilist(3,7) → '3 4 5 6 7'",    async () => assertEquals(await ev("[ilist(3,7)]"),     "3 4 5 6 7"));
  it("ilist(1,10,2) → '1 3 5 7 9'", async () => assertEquals(await ev("[ilist(1,10,2)]"),  "1 3 5 7 9"));
  it("lnum(5) → '1 2 3 4 5'",       async () => assertEquals(await ev("[lnum(5)]"),        "1 2 3 4 5"));
  it("lnum(3,7) → '3 4 5 6 7'",     async () => assertEquals(await ev("[lnum(3,7)]"),      "3 4 5 6 7"));
});

// ── butlast ──────────────────────────────────────────────────────────────────

describe("list — butlast", () => {
  it("butlast('a b c') → 'a b'", async () => assertEquals(await ev("[butlast(a b c)]"), "a b"));
  it("butlast('a') → ''",        async () => assertEquals(await ev("[butlast(a)]"),     ""));
});

// ── remove ───────────────────────────────────────────────────────────────────

describe("list — remove", () => {
  it("removes first occurrence only", async () =>
    assertEquals(await ev("[remove(a b c b d,b)]"), "a c b d"));
  it("remove item not present = unchanged", async () =>
    assertEquals(await ev("[remove(a b c,x)]"), "a b c"));
  it("remove case-insensitive", async () =>
    assertEquals(await ev("[remove(a B c,b)]"), "a c"));
});

// ── pickrand ─────────────────────────────────────────────────────────────────

describe("list — pickrand", () => {
  it("returns one of the list items", async () => {
    const result = await ev("[pickrand(a b c)]");
    assertMatch(result, /^(a|b|c)$/);
  });
  it("single item always returns that item", async () =>
    assertEquals(await ev("[pickrand(hello)]"), "hello"));
});

// ── lrand ────────────────────────────────────────────────────────────────────

describe("list — lrand", () => {
  it("returns 3 integers each in [1,6]", async () => {
    const result = await ev("[lrand(1,6,3)]");
    const parts = result.split(" ");
    assertEquals(parts.length, 3);
    for (const p of parts) {
      const n = parseInt(p, 10);
      assertEquals(Number.isInteger(n) && n >= 1 && n <= 6, true, `out of range: ${p}`);
    }
  });
  it("count=0 → empty string", async () =>
    assertEquals(await ev("[lrand(1,6,0)]"), ""));
});

// ── choose ───────────────────────────────────────────────────────────────────

describe("list — choose", () => {
  it("only item with weight > 0 is chosen", async () => {
    // Run 20 times; with weights "0 1 0" only "b" should ever be returned
    for (let i = 0; i < 20; i++) {
      const r = await ev("[choose(a b c,0 1 0)]");
      assertEquals(r, "b");
    }
  });
  it("mismatch → #-1 WEIGHTS MISMATCH", async () =>
    assertEquals(await ev("[choose(a b,1 2 3)]"), "#-1 WEIGHTS MISMATCH"));
  it("all zero → #-1 ZERO WEIGHT", async () =>
    assertEquals(await ev("[choose(a b c,0 0 0)]"), "#-1 ZERO WEIGHT"));
});

// ── elements ─────────────────────────────────────────────────────────────────

describe("list — elements", () => {
  it("elements('a b c d e', '1 3 5') → 'a c e'", async () =>
    assertEquals(await ev("[elements(a b c d e,1 3 5)]"), "a c e"));
  it("out-of-range positions silently skipped", async () =>
    assertEquals(await ev("[elements(a b c,1 5)]"), "a"));
});

// ── mix ──────────────────────────────────────────────────────────────────────

describe("list — mix", () => {
  it("mix 2 equal-length lists", async () =>
    assertEquals(await ev("[mix(a b,1 2)]"), "a 1 b 2"));
  it("mix remainder appended", async () =>
    assertEquals(await ev("[mix(a b c,1 2)]"), "a 1 b 2 c"));
  it("mix 3 lists", async () =>
    assertEquals(await ev("[mix(a b,1 2,x y)]"), "a 1 x b 2 y"));
});

// ── zip ──────────────────────────────────────────────────────────────────────

describe("list — zip", () => {
  it("zip equal lists → 'a:1 b:2 c:3'", async () =>
    assertEquals(await ev("[zip(a b c,1 2 3)]"), "a:1 b:2 c:3"));
  it("stops at shorter list", async () =>
    assertEquals(await ev("[zip(a b c,1 2)]"), "a:1 b:2"));
});

// ── splice ───────────────────────────────────────────────────────────────────

describe("list — splice", () => {
  it("splice equal lists", async () =>
    assertEquals(await ev("[splice(a c e,b d f)]"), "a b c d e f"));
  it("splice unequal: remainder appended", async () =>
    assertEquals(await ev("[splice(a c,b d f)]"), "a b c d f"));
});

// ── itemize ──────────────────────────────────────────────────────────────────

describe("list — itemize", () => {
  it("3 items → Oxford comma", async () =>
    assertEquals(await ev("[itemize(a b c)]"), "a, b, and c"));
  it("2 items",                async () =>
    assertEquals(await ev("[itemize(a b)]"),   "a and b"));
  it("1 item",                 async () =>
    assertEquals(await ev("[itemize(a)]"),     "a"));
});

// ── foreach ──────────────────────────────────────────────────────────────────

describe("iter — foreach", () => {
  it("applies fn char-by-char and concatenates", async () => {
    // ## is each char; ucstr(##) upcases it → "ABC"
    const result = await ev("[foreach(abc,[ucstr(##)])]");
    assertEquals(result, "ABC");
  });
  it("empty string → empty", async () =>
    assertEquals(await ev("[foreach(,[ucstr(##)])]"), ""));
  it("counts chars via #@", async () => {
    // #@ is 1-based index; for 3 chars → "1 2 3" joined by nothing → "123"
    const result = await ev("[foreach(xyz,#@)]");
    assertEquals(result, "123");
  });
});

// ── step ─────────────────────────────────────────────────────────────────────

describe("iter — step", () => {
  it("step size 2 processes pairs", async () => {
    // Each chunk of 2 items becomes ## (sub-list); ucstr upcases it
    // "a b" chunks: ["a b", "c d"] → ucstr("a b")="A B", ucstr("c d")="C D" → "A B C D" joined by " "
    const result = await ev("[step(a b c d,[ucstr(##)],2)]");
    assertEquals(result, "A B C D");
  });
  it("step size 1 = one item per call", async () => {
    const result = await ev("[step(a b c,[ucstr(##)],1)]");
    assertEquals(result, "A B C");
  });
});

// ── sort ─────────────────────────────────────────────────────────────────────

describe("list — sort", () => {
  it("alphabetical sort", async () =>
    assertEquals(await ev("[sort(banana apple cherry)]"), "apple banana cherry"));
});

// ── lrest ────────────────────────────────────────────────────────────────────

describe("list — lrest", () => {
  it("lrest('a b c') → 'b c'", async () =>
    assertEquals(await ev("[lrest(a b c)]"), "b c"));
  it("lrest single word → ''", async () =>
    assertEquals(await ev("[lrest(a)]"), ""));
});
