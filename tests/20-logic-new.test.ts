// ============================================================================
// 20 — New Tier-1 logic/control functions
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Fixture ───────────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  getAttr(_objectId, _attr) { return Promise.resolve(null); },
  resolveTarget(_from, _expr) { return Promise.resolve(null); },
  getName(objectId) { return Promise.resolve(objectId); },
  hasFlag(_id, _flag) { return Promise.resolve(false); },
};

function makeEngine(): EvalEngine {
  const e = new EvalEngine(mockAccessor);
  registerStdlib(e);
  return e;
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "p1", executor: "p1", ...overrides });
}

function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── case ─────────────────────────────────────────────────────────────────────

describe("case — wildcard matching", () => {
  it("first pattern matches",
    async () => assertEquals(
      await ev("[case(hello,h*,starts with h,no match)]"),
      "starts with h",
    ));

  it("second pattern matches",
    async () => assertEquals(
      await ev("[case(world,h*,h-word,w*,w-word,other)]"),
      "w-word",
    ));

  it("no match returns default",
    async () => assertEquals(
      await ev("[case(zzz,h*,h-word,no match)]"),
      "no match",
    ));

  it("no match no default returns empty",
    async () => assertEquals(
      await ev("[case(zzz,h*,h-word,w*,w-word)]"),
      "",
    ));
});

// ── caseall ───────────────────────────────────────────────────────────────────

describe("caseall — all matching wildcards", () => {
  it("both patterns match → concatenated",
    async () => assertEquals(
      await ev("[caseall(ab,a*,first,*b,second,neither)]"),
      "firstsecond",
    ));

  it("no match returns default",
    async () => assertEquals(
      await ev("[caseall(zzz,a*,first,*b,second,neither)]"),
      "neither",
    ));

  it("only one pattern matches",
    async () => assertEquals(
      await ev("[caseall(ab,a*,first,c*,third,default)]"),
      "first",
    ));
});

// ── switchall ─────────────────────────────────────────────────────────────────

describe("switchall — all exact matches", () => {
  it("single match",
    async () => assertEquals(
      await ev("[switchall(b,a,one,b,two,c,three)]"),
      "two",
    ));

  it("no match → default",
    async () => assertEquals(
      await ev("[switchall(x,a,one,b,two,none)]"),
      "none",
    ));

  it("no match no default → empty",
    async () => assertEquals(
      await ev("[switchall(x,a,one,b,two)]"),
      "",
    ));
});

// ── allof ─────────────────────────────────────────────────────────────────────

describe("allof", () => {
  it("returns last arg value",
    async () => assertEquals(await ev("[allof(a,b,c)]"), "c"));

  it("evaluates all regardless of empty early args",
    async () => assertEquals(await ev("[allof(,,last)]"), "last"));
});

// ── firstof ──────────────────────────────────────────────────────────────────

describe("firstof", () => {
  it("returns first non-empty arg",
    async () => assertEquals(await ev("[firstof(,,hello,world)]"), "hello"));

  it("all empty returns empty",
    async () => assertEquals(await ev("[firstof(,)]"), ""));
});

// ── cand ─────────────────────────────────────────────────────────────────────

describe("cand", () => {
  it("both truthy → 1",
    async () => assertEquals(await ev("[cand(1,1)]"), "1"));

  it("second falsy → 0",
    async () => assertEquals(await ev("[cand(1,0)]"), "0"));

  it("first falsy → 0 (short-circuits)",
    async () => assertEquals(await ev("[cand(0,[div(1,0)])]"), "0"));
});

// ── cor ──────────────────────────────────────────────────────────────────────

describe("cor", () => {
  it("returns first truthy value",
    async () => assertEquals(await ev("[cor(0,hello)]"), "hello"));

  it("all falsy → 0",
    async () => assertEquals(await ev("[cor(0,0)]"), "0"));

  it("short-circuits on first truthy",
    async () => assertEquals(await ev("[cor(1,[div(1,0)])]"), "1"));
});

// ── while ─────────────────────────────────────────────────────────────────────

describe("while", () => {
  it("accumulates body output until condition false",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      c.registers.set("0", "0");
      const result = await engine.evalString(
        "[while([lt([r(0)],3)],[r(0)],[setq(0,[add([r(0)],1)])],10)]",
        c,
      );
      assertEquals(result, "012");
    });

  it("body not evaluated if condition starts false",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      c.registers.set("0", "5");
      const result = await engine.evalString(
        "[while([lt([r(0)],3)],[r(0)],[setq(0,[add([r(0)],1)])],10)]",
        c,
      );
      assertEquals(result, "");
    });

  it("respects max_iterations cap",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      c.registers.set("0", "0");
      // cap of 2 — should stop after 2 iterations
      const result = await engine.evalString(
        "[while([lt([r(0)],100)],[r(0)],[setq(0,[add([r(0)],1)])],2)]",
        c,
      );
      assertEquals(result, "01");
    });
});

// ── localize ─────────────────────────────────────────────────────────────────

describe("localize", () => {
  it("inner register change does not affect outer context",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      const result = await engine.evalString(
        "[setq(0,outer)][localize([setq(0,inner)])][r(0)]",
        c,
      );
      assertEquals(result, "outer");
    });

  it("outer registers are readable inside localize",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      c.registers.set("0", "hello");
      const result = await engine.evalString("[localize([r(0)])]", c);
      assertEquals(result, "hello");
    });
});

// ── letq ─────────────────────────────────────────────────────────────────────

describe("letq", () => {
  it("binds register for body then restores",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      const result = await engine.evalString("[letq(0,hello,[r(0)])]", c);
      assertEquals(result, "hello");
      // after letq, %q0 should be gone
      assertEquals(c.registers.get("0"), undefined);
    });

  it("restores previous value after body",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      c.registers.set("0", "outer");
      const result = await engine.evalString(
        "[letq(0,inner,[r(0)])][r(0)]",
        c,
      );
      assertEquals(result, "innerouter");
    });

  it("multiple bindings",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      const result = await engine.evalString(
        "[letq(0,hello,1,world,[r(0)] [r(1)])]",
        c,
      );
      assertEquals(result, "hello world");
    });
});

// ── unsetq ───────────────────────────────────────────────────────────────────

describe("unsetq", () => {
  it("clears a register so r() returns empty",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      const result = await engine.evalString(
        "[setq(0,val)][unsetq(0)][r(0)]",
        c,
      );
      assertEquals(result, "");
    });

  it("returns empty string",
    async () => assertEquals(await ev("[unsetq(0)]"), ""));
});

// ── listq ────────────────────────────────────────────────────────────────────

describe("listq", () => {
  it("returns sorted register names",
    async () => {
      const engine = makeEngine();
      const c = ctx();
      const result = await engine.evalString(
        "[setq(b,2)][setq(a,1)][listq()]",
        c,
      );
      assertEquals(result, "a b");
    });

  it("returns empty when no registers set",
    async () => assertEquals(await ev("[listq()]"), ""));
});

// ── MUX truthy semantics ──────────────────────────────────────────────────────

describe("logic — MUX truthy semantics", () => {
  // Only "" and "0" are false in TinyMUX
  it("empty string is false (t() requires arg)",
    async () => assertEquals(await ev("[t()]"), "#-1 FUNCTION (t) REQUIRES AT LEAST 1 ARGUMENT(S)"));

  it("t(0) = 0",
    async () => assertEquals(await ev("[t(0)]"), "0"));

  it("t(1) = 1",
    async () => assertEquals(await ev("[t(1)]"), "1"));

  it("t(-1) = 1 (non-zero is truthy)",
    async () => assertEquals(await ev("[t(-1)]"), "1"));

  it("t(00) = 1 (string '00' is not '0')",
    async () => assertEquals(await ev("[t(00)]"), "1"));

  it("t(abc) = 1",
    async () => assertEquals(await ev("[t(abc)]"), "1"));

  it("not(0) = 1",
    async () => assertEquals(await ev("[not(0)]"), "1"));

  it("not(1) = 0",
    async () => assertEquals(await ev("[not(1)]"), "0"));

  it("not(abc) = 0 (truthy → not = 0)",
    async () => assertEquals(await ev("[not(abc)]"), "0"));
});

// ── switch() exact-match semantics ────────────────────────────────────────────

describe("logic — switch() exact match (no wildcards)", () => {
  it("switch: 'a*' pattern does NOT match 'abc' (exact, no glob)",
    async () => assertEquals(await ev("[switch(abc,a*,yes,nope)]"), "nope"));

  it("switch: exact '0' matches '0' only",
    async () => assertEquals(await ev("[switch(0,0,zero,one)]"), "zero"));

  it("switch: '0' does NOT match '' (empty)",
    async () => assertEquals(await ev("[switch(,0,zero,default)]"), "default"));

  it("switch: first match wins",
    async () => assertEquals(await ev("[switch(x,x,first,x,second)]"), "first"));

  it("switch: only default (odd args → default)",
    async () => assertEquals(await ev("[switch(a,b,match,fallback)]"), "fallback"));

  it("switch: even args, no default, no match = empty",
    async () => assertEquals(await ev("[switch(z,a,one,b,two)]"), ""));

  it("switch: value with spaces matches exactly",
    async () => assertEquals(await ev("[switch(hello world,hello world,yes,no)]"), "yes"));
});

// ── setq / r() register scoping ───────────────────────────────────────────────

describe("logic — setq / r() register scoping", () => {
  it("setq returns empty string",
    async () => assertEquals(await ev("[setq(0,hello)]"), ""));

  it("r() after setq returns stored value",
    async () => assertEquals(await ev("[setq(x,42)][r(x)]"), "42"));

  it("r() unset register = empty string",
    async () => assertEquals(await ev("[r(unset_reg_xyz)]"), ""));

  it("setq with named register (multi-char)",
    async () => assertEquals(await ev("[setq(abc,test)][r(abc)]"), "test"));

  it("setr(reg,val) stores AND returns val",
    async () => assertEquals(await ev("[setr(0,ping)]"), "ping"));

  it("setr visible via r() after call",
    async () => assertEquals(await ev("[setr(r0,val)][r(r0)]"), "valval"));

  it("%q shorthand reads register",
    async () => assertEquals(await ev("[setq(k,hello)]%qk"), "hello"));

  it("overwriting a register updates it",
    async () => assertEquals(await ev("[setq(0,first)][setq(0,second)][r(0)]"), "second"));
});

// ── and() / or() return values ────────────────────────────────────────────────

describe("logic — and() / or() return values are '1' or '0'", () => {
  it("and true returns '1' (string)",
    async () => assertEquals(await ev("[and(1,1)]"), "1"));

  it("and false returns '0' (string)",
    async () => assertEquals(await ev("[and(1,0)]"), "0"));

  it("or true returns '1' (string)",
    async () => assertEquals(await ev("[or(0,1)]"), "1"));

  it("or false returns '0' (string)",
    async () => assertEquals(await ev("[or(0,0)]"), "0"));

  it("and short-circuit: third arg never evaluated when second is false",
    async () => assertEquals(await ev("[and(1,0,[div(1,0)])]"), "0"));

  it("or short-circuit: second arg never evaluated when first is true",
    async () => assertEquals(await ev("[or(1,[div(1,0)])]"), "1"));
});
