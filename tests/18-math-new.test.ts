// ============================================================================
// 18 — New math functions: rand, die, statistics, integer, bitwise, geometry,
//      numeral/text, and vector functions
// ============================================================================

import { assertEquals, assertMatch } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext } from "../src/eval/mod.ts";

function makeEngine(): EvalEngine {
  const e = new EvalEngine({
    getAttr(_id, _attr) { return Promise.resolve(null); },
    resolveTarget(_from, expr) { return Promise.resolve(expr); },
    getName(id) { return Promise.resolve(id); },
    hasFlag(_id, _flag) { return Promise.resolve(false); },
  });
  registerStdlib(e);
  return e;
}

function ctx(overrides: Partial<EvalContext> = {}): EvalContext {
  return makeContext({ enactor: "me", executor: "me", ...overrides });
}

function ev(src: string): Promise<string> {
  return makeEngine().evalString(src, ctx());
}

// ── Random / Dice ─────────────────────────────────────────────────────────────

describe("new math — rand", () => {
  it("rand(10) returns string integer in [0,9]", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await ev("[rand(10)]");
      const n = parseInt(r, 10);
      assertEquals(String(n), r, "must be integer string");
      assertEquals(n >= 0 && n <= 9, true, `${n} not in [0,9]`);
    }
  });

  it("rand(5,10) returns string integer in [5,10] inclusive", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await ev("[rand(5,10)]");
      const n = parseInt(r, 10);
      assertEquals(String(n), r, "must be integer string");
      assertEquals(n >= 5 && n <= 10, true, `${n} not in [5,10]`);
    }
  });
});

describe("new math — die", () => {
  it("die(1,6) returns integer in [1,6]", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await ev("[die(1,6)]");
      const n = parseInt(r, 10);
      assertEquals(n >= 1 && n <= 6, true, `${n} not in [1,6]`);
    }
  });

  it("die(3,6) returns integer in [3,18]", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await ev("[die(3,6)]");
      const n = parseInt(r, 10);
      assertEquals(n >= 3 && n <= 18, true, `${n} not in [3,18]`);
    }
  });

  it("die(0,6) returns #-1 ARGUMENT OUT OF RANGE", async () => {
    assertEquals(await ev("[die(0,6)]"), "#-1 ARGUMENT OUT OF RANGE");
  });

  it("die(1,0) returns #-1 ARGUMENT OUT OF RANGE", async () => {
    assertEquals(await ev("[die(1,0)]"), "#-1 ARGUMENT OUT OF RANGE");
  });

  it("die(101,6) returns #-1 ARGUMENT OUT OF RANGE", async () => {
    assertEquals(await ev("[die(101,6)]"), "#-1 ARGUMENT OUT OF RANGE");
  });
});

// ── Statistics ────────────────────────────────────────────────────────────────

describe("new math — statistics", () => {
  it("mean(1,2,3) = 2", async () => {
    assertEquals(await ev("[mean(1,2,3)]"), "2");
  });

  it("median(1,2,3,4) = 2.5", async () => {
    assertEquals(await ev("[median(1,2,3,4)]"), "2.5");
  });

  it("median(1,2,3) = 2", async () => {
    assertEquals(await ev("[median(1,2,3)]"), "2");
  });

  it("stddev(2,4,4,4,5,5,7,9) = 2", async () => {
    assertEquals(await ev("[stddev(2,4,4,4,5,5,7,9)]"), "2");
  });

  it("ladd(1 2 3 4 5) = 15", async () => {
    assertEquals(await ev("[ladd(1 2 3 4 5)]"), "15");
  });

  it("lmax(3 1 4 1 5 9) = 9", async () => {
    assertEquals(await ev("[lmax(3 1 4 1 5 9)]"), "9");
  });

  it("lmin(3 1 4) = 1", async () => {
    assertEquals(await ev("[lmin(3 1 4)]"), "1");
  });

  it("lmath(sum, 1 2 3) = 6", async () => {
    assertEquals(await ev("[lmath(sum,1 2 3)]"), "6");
  });

  it("lmath(mul, 2 3 4) = 24", async () => {
    assertEquals(await ev("[lmath(mul,2 3 4)]"), "24");
  });

  it("lmath(max, 3 1 9 2) = 9", async () => {
    assertEquals(await ev("[lmath(max,3 1 9 2)]"), "9");
  });

  it("lmath(min, 3 1 9 2) = 1", async () => {
    assertEquals(await ev("[lmath(min,3 1 9 2)]"), "1");
  });
});

// ── Integer variants ──────────────────────────────────────────────────────────

describe("new math — integer variants", () => {
  it("iabs(-5) = 5", async () => {
    assertEquals(await ev("[iabs(-5)]"), "5");
  });

  it("iabs(5) = 5", async () => {
    assertEquals(await ev("[iabs(5)]"), "5");
  });

  it("iadd(3,4) = 7", async () => {
    assertEquals(await ev("[iadd(3,4)]"), "7");
  });

  it("imul(3,4) = 12", async () => {
    assertEquals(await ev("[imul(3,4)]"), "12");
  });

  it("idiv(7,2) = 3 (floor)", async () => {
    assertEquals(await ev("[idiv(7,2)]"), "3");
  });

  it("idiv(-7,2) = -4 (floor toward -inf)", async () => {
    assertEquals(await ev("[idiv(-7,2)]"), "-4");
  });

  it("idiv(1,0) = #-1 DIVIDE BY ZERO", async () => {
    assertEquals(await ev("[idiv(1,0)]"), "#-1 DIVIDE BY ZERO");
  });

  it("isub(10,3) = 7", async () => {
    assertEquals(await ev("[isub(10,3)]"), "7");
  });

  it("isign(-5) = -1", async () => {
    assertEquals(await ev("[isign(-5)]"), "-1");
  });

  it("isign(0) = 0", async () => {
    assertEquals(await ev("[isign(0)]"), "0");
  });

  it("isign(5) = 1", async () => {
    assertEquals(await ev("[isign(5)]"), "1");
  });

  it("floordiv(7,2) = 3", async () => {
    assertEquals(await ev("[floordiv(7,2)]"), "3");
  });

  it("floordiv(-7,2) = -4", async () => {
    assertEquals(await ev("[floordiv(-7,2)]"), "-4");
  });

  it("floordiv(1,0) = #-1 DIVIDE BY ZERO", async () => {
    assertEquals(await ev("[floordiv(1,0)]"), "#-1 DIVIDE BY ZERO");
  });
});

// ── Bitwise ───────────────────────────────────────────────────────────────────

describe("new math — bitwise", () => {
  it("band(12,10) = 8  (1100 & 1010 = 1000)", async () => {
    assertEquals(await ev("[band(12,10)]"), "8");
  });

  it("bor(12,10) = 14  (1100 | 1010 = 1110)", async () => {
    assertEquals(await ev("[bor(12,10)]"), "14");
  });

  it("bxor(12,10) = 6  (1100 ^ 1010 = 0110)", async () => {
    assertEquals(await ev("[bxor(12,10)]"), "6");
  });

  it("bnand(12,10) = ~8 = -9", async () => {
    assertEquals(await ev("[bnand(12,10)]"), "-9");
  });

  it("shl(1,4) = 16", async () => {
    assertEquals(await ev("[shl(1,4)]"), "16");
  });

  it("shr(16,4) = 1", async () => {
    assertEquals(await ev("[shr(16,4)]"), "1");
  });

  it("xor(1,0) = 1", async () => {
    assertEquals(await ev("[xor(1,0)]"), "1");
  });

  it("xor(1,1) = 0", async () => {
    assertEquals(await ev("[xor(1,1)]"), "0");
  });

  it("xor(1,1,1) = 1 (odd number of truthy)", async () => {
    assertEquals(await ev("[xor(1,1,1)]"), "1");
  });

  it("xor(0,0) = 0", async () => {
    assertEquals(await ev("[xor(0,0)]"), "0");
  });
});

// ── Geometry ──────────────────────────────────────────────────────────────────

describe("new math — geometry", () => {
  it("dist2d(0,0,3,4) = 5", async () => {
    assertEquals(await ev("[dist2d(0,0,3,4)]"), "5");
  });

  it("dist2d(0,0,0,0) = 0", async () => {
    assertEquals(await ev("[dist2d(0,0,0,0)]"), "0");
  });

  it("dist3d(0,0,0,1,2,2) = 3", async () => {
    assertEquals(await ev("[dist3d(0,0,0,1,2,2)]"), "3");
  });
});

// ── Numeral / text ────────────────────────────────────────────────────────────

describe("new math — roman", () => {
  it("roman(2024) = MMXXIV", async () => {
    assertEquals(await ev("[roman(2024)]"), "MMXXIV");
  });

  it("roman(1) = I", async () => {
    assertEquals(await ev("[roman(1)]"), "I");
  });

  it("roman(3999) = MMMCMXCIX", async () => {
    assertEquals(await ev("[roman(3999)]"), "MMMCMXCIX");
  });

  it("roman(0) = #-1 ARGUMENT OUT OF RANGE", async () => {
    assertEquals(await ev("[roman(0)]"), "#-1 ARGUMENT OUT OF RANGE");
  });

  it("roman(4000) = #-1 ARGUMENT OUT OF RANGE", async () => {
    assertEquals(await ev("[roman(4000)]"), "#-1 ARGUMENT OUT OF RANGE");
  });
});

describe("new math — spellnum", () => {
  it("spellnum(42) = forty-two", async () => {
    assertEquals(await ev("[spellnum(42)]"), "forty-two");
  });

  it("spellnum(0) = zero", async () => {
    assertEquals(await ev("[spellnum(0)]"), "zero");
  });

  it("spellnum(100) = one hundred", async () => {
    assertEquals(await ev("[spellnum(100)]"), "one hundred");
  });

  it("spellnum(103) = one hundred and three", async () => {
    assertEquals(await ev("[spellnum(103)]"), "one hundred and three");
  });

  it("spellnum(1000) = one thousand", async () => {
    assertEquals(await ev("[spellnum(1000)]"), "one thousand");
  });
});

describe("new math — baseconv", () => {
  it("baseconv(255,10,16) = ff", async () => {
    assertEquals(await ev("[baseconv(255,10,16)]"), "ff");
  });

  it("baseconv(255,10,2) = 11111111", async () => {
    assertEquals(await ev("[baseconv(255,10,2)]"), "11111111");
  });

  it("baseconv(ff,16,10) = 255", async () => {
    assertEquals(await ev("[baseconv(ff,16,10)]"), "255");
  });

  it("baseconv with base 1 = #-1 INVALID BASE", async () => {
    assertEquals(await ev("[baseconv(5,10,1)]"), "#-1 INVALID BASE");
  });

  it("baseconv with base 37 = #-1 INVALID BASE", async () => {
    assertEquals(await ev("[baseconv(5,10,37)]"), "#-1 INVALID BASE");
  });
});

// ── Vector math ───────────────────────────────────────────────────────────────

describe("new math — vectors", () => {
  it("vadd(1 2 3, 4 5 6) = 5 7 9", async () => {
    assertEquals(await ev("[vadd(1 2 3,4 5 6)]"), "5 7 9");
  });

  it("vsub(5 7 9, 1 2 3) = 4 5 6", async () => {
    assertEquals(await ev("[vsub(5 7 9,1 2 3)]"), "4 5 6");
  });

  it("vmul(1 2 3, 2) = 2 4 6", async () => {
    assertEquals(await ev("[vmul(1 2 3,2)]"), "2 4 6");
  });

  it("vdot(1 2 3, 4 5 6) = 32", async () => {
    assertEquals(await ev("[vdot(1 2 3,4 5 6)]"), "32");
  });

  it("vmag(3 4) = 5", async () => {
    assertEquals(await ev("[vmag(3 4)]"), "5");
  });

  it("vmag(0 0) = 0", async () => {
    assertEquals(await ev("[vmag(0 0)]"), "0");
  });

  it("vunit(3 4) normalizes", async () => {
    const r = await ev("[vunit(3 4)]");
    const parts = r.split(" ").map(Number);
    assertEquals(parts.length, 2);
    const mag = Math.sqrt(parts[0] ** 2 + parts[1] ** 2);
    assertEquals(Math.abs(mag - 1) < 0.001, true, `magnitude ${mag} not ~1`);
  });

  it("vunit(0 0) = #-1 ZERO VECTOR", async () => {
    assertEquals(await ev("[vunit(0 0)]"), "#-1 ZERO VECTOR");
  });

  it("vadd mismatched lengths = #-1 VECTORS MUST BE SAME LENGTH", async () => {
    assertEquals(await ev("[vadd(1 2,3 4 5)]"), "#-1 VECTORS MUST BE SAME LENGTH");
  });

  it("vcross(1 0 0, 0 1 0) = 0 0 1", async () => {
    assertEquals(await ev("[vcross(1 0 0,0 1 0)]"), "0 0 1");
  });

  it("vcross 2D vectors = #-1", async () => {
    assertEquals(await ev("[vcross(1 0,0 1)]"), "#-1 #-1");
  });
});

// ── div() ─────────────────────────────────────────────────────────────────────

describe("math — div()", () => {
  it("div(x,0) → #-1 DIVIDE BY ZERO",
    async () => assertEquals(await ev("[div(1,0)]"), "#-1 DIVIDE BY ZERO"));

  it("div(0,5) → 0",
    async () => assertEquals(await ev("[div(0,5)]"), "0"));

  it("div(7,2) truncates toward zero (integers)",
    async () => assertEquals(await ev("[div(7,2)]"), "3"));

  it("div(-7,2) truncates toward zero",
    async () => assertEquals(await ev("[div(-7,2)]"), "-3"));

  it("div by 0.0 also → DIVIDE BY ZERO",
    async () => assertEquals(await ev("[div(1,0.0)]"), "#-1 DIVIDE BY ZERO"));
});

// ── mod() ─────────────────────────────────────────────────────────────────────

describe("math — mod()", () => {
  it("mod(7,3) = 1",
    async () => assertEquals(await ev("[mod(7,3)]"), "1"));

  it("mod(x,0) → DIVIDE BY ZERO",
    async () => assertEquals(await ev("[mod(5,0)]"), "#-1 DIVIDE BY ZERO"));

  it("mod(-7,3) = -1 (JS semantics, sign follows dividend)",
    async () => assertEquals(await ev("[mod(-7,3)]"), "-1"));

  it("mod(0,5) = 0",
    async () => assertEquals(await ev("[mod(0,5)]"), "0"));
});

// ── sqrt() ────────────────────────────────────────────────────────────────────

describe("math — sqrt()", () => {
  it("sqrt(0) = 0",
    async () => assertEquals(await ev("[sqrt(0)]"), "0"));

  it("sqrt(9) = 3",
    async () => assertEquals(await ev("[sqrt(9)]"), "3"));

  it("sqrt(-1) → ARGUMENT OUT OF RANGE",
    async () => assertEquals(await ev("[sqrt(-1)]"), "#-1 ARGUMENT OUT OF RANGE"));

  it("sqrt(2) ≈ 1.41421 (6 sig digits)",
    async () => assertEquals(await ev("[sqrt(2)]"), "1.41421"));
});

// ── abs() ─────────────────────────────────────────────────────────────────────

describe("math — abs()", () => {
  it("abs(-0) = 0",
    async () => assertEquals(await ev("[abs(-0)]"), "0"));

  it("abs(0) = 0",
    async () => assertEquals(await ev("[abs(0)]"), "0"));

  it("abs(-100) = 100",
    async () => assertEquals(await ev("[abs(-100)]"), "100"));
});

// ── power() ───────────────────────────────────────────────────────────────────

describe("math — power()", () => {
  it("power(0,0) = 1",
    async () => assertEquals(await ev("[power(0,0)]"), "1"));

  it("power(2,0) = 1",
    async () => assertEquals(await ev("[power(2,0)]"), "1"));

  it("power(0,5) = 0",
    async () => assertEquals(await ev("[power(0,5)]"), "0"));

  it("power(2,-1) = 0.5",
    async () => assertEquals(await ev("[power(2,-1)]"), "0.5"));
});

// ── round() ───────────────────────────────────────────────────────────────────

describe("math — round()", () => {
  it("round(2.5,0) = 3 (rounds half up)",
    async () => assertEquals(await ev("[round(2.5,0)]"), "3"));

  it("round(2.55,1) = 2.6",
    async () => assertEquals(await ev("[round(2.55,1)]"), "2.6"));

  it("round with negative precision clamps to 0",
    async () => assertEquals(await ev("[round(2.7,-1)]"), "3"));
});

// ── min() / max() ─────────────────────────────────────────────────────────────

describe("math — min() / max()", () => {
  it("min of single pair",
    async () => assertEquals(await ev("[min(5,10)]"), "5"));

  it("max of single pair",
    async () => assertEquals(await ev("[max(5,10)]"), "10"));

  it("min with negative numbers",
    async () => assertEquals(await ev("[min(-5,-10)]"), "-10"));

  it("max with all equal = that value",
    async () => assertEquals(await ev("[max(3,3,3)]"), "3"));
});

// ── non-number args ───────────────────────────────────────────────────────────

describe("math — non-number argument errors", () => {
  it("add(x,1) → ARGUMENT IS NOT A NUMBER",
    async () => assertEquals(await ev("[add(x,1)]"), "#-1 ARGUMENT (X) IS NOT A NUMBER"));

  it("sub(a,b) → error",
    async () => assertEquals(await ev("[sub(a,b)]"), "#-1 ARGUMENT (A) IS NOT A NUMBER"));

  it("mul(1,x) → error (second arg)",
    async () => assertEquals(await ev("[mul(1,x)]"), "#-1 ARGUMENT (X) IS NOT A NUMBER"));
});

// ── argument count boundaries ─────────────────────────────────────────────────

describe("math — argument count boundaries", () => {
  it("add requires at least 2 args",
    async () => assertEquals(await ev("[add(1)]"), "#-1 FUNCTION (add) REQUIRES AT LEAST 2 ARGUMENT(S)"));

  it("sub requires exactly 2: too many → error",
    async () => assertEquals(await ev("[sub(1,2,3)]"), "#-1 FUNCTION (sub) TAKES AT MOST 2 ARGUMENT(S)"));

  it("div requires exactly 2: too many → error",
    async () => assertEquals(await ev("[div(1,2,3)]"), "#-1 FUNCTION (div) TAKES AT MOST 2 ARGUMENT(S)"));

  it("sqrt requires exactly 1: too many → error",
    async () => assertEquals(await ev("[sqrt(4,2)]"), "#-1 FUNCTION (sqrt) TAKES AT MOST 1 ARGUMENT(S)"));
});
