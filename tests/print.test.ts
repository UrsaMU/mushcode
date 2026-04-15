// ============================================================================
// Print — canonical softcode printer
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode } from "../parser/mod.ts";
import { print } from "../src/print/mod.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function roundtrip(text: string): string {
  return print(parse(text, "Start"));
}

function roundtripLock(text: string): string {
  return print(parse(text, "LockExpr"));
}

// ── Literals and leaves ────────────────────────────────────────────────────────

describe("Print — leaves", () => {
  it("Literal", () => {
    assertEquals(roundtrip("hello world"), "hello world");
  });

  it("Escape → backslash + char", () => {
    assertEquals(roundtrip("\\;"), "\\;");
    assertEquals(roundtrip("\\["), "\\[");
    assertEquals(roundtrip("\\\\"), "\\\\");
  });

  it("Substitution → % + code", () => {
    assertEquals(roundtrip("%0"), "%0");
    assertEquals(roundtrip("%#"), "%#");
    assertEquals(roundtrip("%q0"), "%q0");
  });

  it("SpecialVar — ## #@ #$", () => {
    assertEquals(roundtrip("##"), "##");
    assertEquals(roundtrip("#@"), "#@");
    assertEquals(roundtrip("#$"), "#$");
  });

  it("TagRef → #name", () => {
    assertEquals(roundtrip("[tag(me,#mytag)]"), "[tag(me,#mytag)]");
    // Standalone TagRef in text
    const node: ASTNode = { type: "TagRef", name: "alpha" };
    assertEquals(print(node), "#alpha");
  });
});

// ── Expression containers ──────────────────────────────────────────────────────

describe("Print — EvalBlock and BracedString", () => {
  it("EvalBlock wraps in []", () => {
    assertEquals(roundtrip("[add(1,2)]"), "[add(1,2)]");
  });

  it("BracedString wraps in {}", () => {
    assertEquals(roundtrip("{hello}"), "{hello}");
  });

  it("nested EvalBlock inside BracedString", () => {
    assertEquals(roundtrip("{[add(1,2)]}"), "{[add(1,2)]}");
  });
});

// ── FunctionCall ───────────────────────────────────────────────────────────────

describe("Print — FunctionCall", () => {
  it("no args", () => {
    assertEquals(roundtrip("[rand()]"), "[rand()]");
  });

  it("single arg", () => {
    assertEquals(roundtrip("[strlen(hello)]"), "[strlen(hello)]");
  });

  it("multiple args, comma-separated", () => {
    assertEquals(roundtrip("[add(1,2)]"), "[add(1,2)]");
    assertEquals(roundtrip("[mid(foo,1,2)]"), "[mid(foo,1,2)]");
  });

  it("nested function calls", () => {
    assertEquals(roundtrip("[add(mul(2,3),1)]"), "[add(mul(2,3),1)]");
  });
});

// ── Commands ───────────────────────────────────────────────────────────────────

describe("Print — AtCommand", () => {
  it("basic @pemit with object and value", () => {
    assertEquals(roundtrip("@pemit %#=hello"), "@pemit %#=hello");
  });

  it("AtCommand with switch", () => {
    assertEquals(roundtrip("@pemit/noeval %#=hello"), "@pemit/noeval %#=hello");
  });

  it("AtCommand without value", () => {
    assertEquals(roundtrip("@trigger me/GO"), "@trigger me/GO");
  });

  it("@set with value", () => {
    assertEquals(roundtrip("@set %#=WIZARD"), "@set %#=WIZARD");
  });
});

describe("Print — AttributeSet", () => {
  it("basic &ATTR obj=val", () => {
    assertEquals(roundtrip("&MYATTR me=hello world"), "&MYATTR me=hello world");
  });

  it("attribute with eval block value", () => {
    assertEquals(roundtrip("&FINGER me=[u(me/FN_FINGER)]"), "&FINGER me=[u(me/FN_FINGER)]");
  });
});

// ── CommandList ────────────────────────────────────────────────────────────────

describe("Print — CommandList", () => {
  it("compact mode (default) joins with ;", () => {
    const ast = parse("@pemit %#=a;@pemit %#=b", "Start");
    assertEquals(print(ast), "@pemit %#=a;@pemit %#=b");
  });

  it("pretty mode joins with ;\\n", () => {
    const ast = parse("@pemit %#=a;@pemit %#=b", "Start");
    assertEquals(print(ast, { mode: "pretty" }), "@pemit %#=a;\n@pemit %#=b");
  });
});

// ── Dollar and Listen patterns ─────────────────────────────────────────────────

describe("Print — patterns", () => {
  it("DollarPattern round-trips", () => {
    assertEquals(roundtrip("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]"),
      "$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
  });

  it("ListenPattern round-trips", () => {
    assertEquals(roundtrip("^hello *:@pemit %#=Hi!"),
      "^hello *:@pemit %#=Hi!");
  });

  it("PatternAlts with semicolon separator", () => {
    // Pattern alternatives joined by ;
    const text = "$look;+look:look";
    assertEquals(roundtrip(text), text);
  });
});

// ── Lock expressions ───────────────────────────────────────────────────────────

describe("Print — lock expressions", () => {
  it("me", () => {
    assertEquals(roundtripLock("me"), "me");
  });

  it("dbref", () => {
    assertEquals(roundtripLock("#123"), "#123");
  });

  it("flag check", () => {
    assertEquals(roundtripLock("flag^WIZARD"), "flag^WIZARD");
  });

  it("player name check", () => {
    assertEquals(roundtripLock("=Admin"), "=Admin");
  });

  it("attr check", () => {
    assertEquals(roundtripLock("attr^LOCKED"), "attr^LOCKED");
  });

  it("type check", () => {
    assertEquals(roundtripLock("type^PLAYER"), "type^PLAYER");
  });

  it("LockAnd — & separates operands", () => {
    assertEquals(roundtripLock("flag^WIZARD&flag^ADMIN"), "flag^WIZARD&flag^ADMIN");
  });

  it("LockOr — | separates operands", () => {
    assertEquals(roundtripLock("flag^WIZARD|flag^ADMIN"), "flag^WIZARD|flag^ADMIN");
  });

  it("LockNot — prefix !", () => {
    assertEquals(roundtripLock("!flag^WIZARD"), "!flag^WIZARD");
  });

  it("LockOr inside LockAnd gets parens", () => {
    // (a|b)&c — the OR branch needs parens to preserve precedence
    const result = roundtripLock("(flag^WIZARD|me)&flag^ADMIN");
    assertEquals(result, "(flag^WIZARD|me)&flag^ADMIN");
  });

  it("LockNot wrapping compound expression gets parens", () => {
    const result = roundtripLock("!(flag^WIZARD|me)");
    assertEquals(result, "!(flag^WIZARD|me)");
  });
});
