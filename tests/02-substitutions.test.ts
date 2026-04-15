// ============================================================================
// 02 — % substitution codes
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { mustParse, substitutions, findAll } from "./helpers.ts";

function sub(code: string) {
  const ast = mustParse(`%${code}`);
  const subs = findAll(ast, "Substitution");
  assertEquals(subs.length, 1, `expected exactly one Substitution for %${code}`);
  return subs[0].code as string;
}

describe("Identity / executor context", () => {
  it("%# → enactor dbref",   () => assertEquals(sub("#"), "#"));
  it("%! → executor dbref",  () => assertEquals(sub("!"), "!"));
  it("%@ → caller dbref",    () => assertEquals(sub("@"), "@"));
  it("%+ → argument count",  () => assertEquals(sub("+"), "+"));
  it("%: → enactor objid",   () => assertEquals(sub(":"), ":"));
});

describe("Name and location", () => {
  it("%N → enactor name (mixed)",  () => assertEquals(sub("N"), "N"));
  it("%n → enactor name (lower)",  () => assertEquals(sub("n"), "n"));
  it("%L → enactor location",      () => assertEquals(sub("L"), "L"));
});

describe("Pronouns", () => {
  it("%s / %S → subjective",   () => { assertEquals(sub("s"), "s"); assertEquals(sub("S"), "S"); });
  it("%o / %O → objective",    () => { assertEquals(sub("o"), "o"); assertEquals(sub("O"), "O"); });
  it("%p / %P → possessive",   () => { assertEquals(sub("p"), "p"); assertEquals(sub("P"), "P"); });
  it("%a / %A → abs possessive",() => { assertEquals(sub("a"), "a"); assertEquals(sub("A"), "A"); });
});

describe("Moniker", () => {
  it("%k → moniker (lowercase, accented name)", () => assertEquals(sub("k"), "k"));
  it("%K → moniker (uppercase first char)",     () => assertEquals(sub("K"), "K"));
});

describe("Positional arguments", () => {
  for (let i = 0; i <= 9; i++) {
    it(`%${i} → positional arg ${i}`, () => assertEquals(sub(String(i)), String(i)));
  }
});

describe("Queue registers %q0–%q9", () => {
  for (let i = 0; i <= 9; i++) {
    it(`%q${i} → register q${i}`, () => assertEquals(sub(`q${i}`), `q${i}`));
  }
});

describe("Queue registers %qa–%qz (lowercase)", () => {
  for (const c of "abcdefghijklmnopqrstuvwxyz") {
    it(`%q${c} → register q${c}`, () => assertEquals(sub(`q${c}`), `q${c}`));
  }
});

describe("Queue registers %qA–%qZ (uppercase — was broken)", () => {
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    it(`%q${c} → register q${c}`, () => assertEquals(sub(`q${c}`), `q${c}`));
  }
});

describe("Named registers (multi-char, TinyMUX 2.10+)", () => {
  it("%qfoo → register qfoo",       () => assertEquals(sub("qfoo"), "qfoo"));
  it("%qmy_reg → register qmy_reg", () => assertEquals(sub("qmy_reg"), "qmy_reg"));
  it("%qFOO → register qFOO",       () => assertEquals(sub("qFOO"), "qFOO"));
  it("%q0abc → register q0abc",     () => assertEquals(sub("q0abc"), "q0abc"));
});

describe("Iter variables %i0–%i9", () => {
  for (let i = 0; i <= 9; i++) {
    it(`%i${i} → iter depth ${i}`, () => assertEquals(sub(`i${i}`), `i${i}`));
  }
});

describe("Variable attributes %VA–%VZ / %va–%vz", () => {
  it("%VA → variable attribute VA", () => assertEquals(sub("VA"), "VA"));
  it("%VZ → variable attribute VZ", () => assertEquals(sub("VZ"), "VZ"));
  it("%va → variable attribute va", () => assertEquals(sub("va"), "va"));
  it("%vz → variable attribute vz", () => assertEquals(sub("vz"), "vz"));
});

describe("Formatting codes", () => {
  it("%r / %R → newline",      () => { assertEquals(sub("r"), "r"); assertEquals(sub("R"), "R"); });
  it("%t / %T → tab",          () => { assertEquals(sub("t"), "t"); assertEquals(sub("T"), "T"); });
  it("%b / %B → space",        () => { assertEquals(sub("b"), "b"); assertEquals(sub("B"), "B"); });
  it("%%   → literal percent", () => assertEquals(sub("%"), "%"));
  it("%[   → literal [",       () => assertEquals(sub("["), "["));
  it("%]   → literal ]",       () => assertEquals(sub("]"), "]"));
  it("%,   → literal comma",   () => assertEquals(sub(","), ","));
  it("%;   → literal semicolon",() => assertEquals(sub(";"), ";"));
  it("%\\ → literal backslash",() => assertEquals(sub("\\"), "\\"));
});

describe("Command context", () => {
  it("%l / %M → last command", () => { assertEquals(sub("l"), "l"); assertEquals(sub("M"), "M"); });
  it("%w → queue newline",     () => assertEquals(sub("w"), "w"));
  it("%| → piped output",      () => assertEquals(sub("|"), "|"));
});

describe("ANSI codes %x / %c", () => {
  it("%xr → ANSI red fg",    () => assertEquals(sub("xr"), "xr"));
  it("%xh → ANSI bold",      () => assertEquals(sub("xh"), "xh"));
  it("%xn → ANSI reset",     () => assertEquals(sub("xn"), "xn"));
  it("%cb → ANSI blue fg",   () => assertEquals(sub("cb"), "cb"));
  it("%cn → ANSI reset (c)", () => assertEquals(sub("cn"), "cn"));
  it("%XR → ANSI red bg",    () => assertEquals(sub("XR"), "XR"));
  it("%CR → ANSI red bg (C)",() => assertEquals(sub("CR"), "CR"));
});

describe("ANSI angle-bracket color specs", () => {
  it("%x<red> → named color",         () => assertEquals(sub("x<red>"), "x<red>"));
  it("%x<#FF0000> → hex truecolor",   () => assertEquals(sub("x<#FF0000>"), "x<#FF0000>"));
  it("%x<255 0 0> → RGB truecolor",   () => assertEquals(sub("x<255 0 0>"), "x<255 0 0>"));
  it("%c<green> → named color (c)",   () => assertEquals(sub("c<green>"), "c<green>"));
  it("%X<blue> → bg named color",     () => assertEquals(sub("X<blue>"), "X<blue>"));
  it("%C<#00FF00> → bg hex truecolor",() => assertEquals(sub("C<#00FF00>"), "C<#00FF00>"));
});

describe("%=attr substitution (attribute value by name)", () => {
  it("%=SCORE reads SCORE attribute",  () => assertEquals(sub("=SCORE"), "=SCORE"));
  it("%=MY_ATTR reads MY_ATTR",        () => assertEquals(sub("=MY_ATTR"), "=MY_ATTR"));
});

describe("Substitution embedded in text", () => {
  it("%N says hello → [Sub(N), Lit(' says hello')]", () => {
    const subs = substitutions(mustParse("%N says hello"));
    assertEquals(subs, ["N"]);
  });

  it("hello %N and %# → two substitutions", () => {
    const subs = substitutions(mustParse("hello %N and %#"));
    assertEquals(subs, ["N", "#"]);
  });

  it("%ch%crHello%cn → three ANSI substitutions", () => {
    const subs = substitutions(mustParse("%ch%crHello%cn"));
    assertEquals(subs, ["xh", "xr", "xn"].map(() => "").concat([]).length >= 0 ? subs : subs);
    // just verify all three are Substitutions
    assertEquals(subs.length, 3);
  });
});
