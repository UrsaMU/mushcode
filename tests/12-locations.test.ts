// ============================================================================
// 12 — Source locations: every node carries { start, end } with offset/line/col
// ============================================================================

import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode, SourceLocation } from "../parser/mod.ts";
import { findAll } from "./helpers.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function p(text: string): ASTNode {
  return parse(text, "Start");
}

function loc(node: ASTNode): SourceLocation {
  assertExists(node.loc, `node type "${node.type}" has no loc`);
  return node.loc!;
}

// ── Basic position smoke-test ──────────────────────────────────────────────────

describe("loc — every parsed node has start/end", () => {
  it("root UserCommand spans the whole input", () => {
    const ast = p("hello");
    const l = loc(ast);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   5);
    assertEquals(l.start.line,   1);
    assertEquals(l.start.column, 1);
  });

  it("EvalBlock: offsets cover [ ... ]", () => {
    // [add(1,2)] — offsets 0–10
    const ast  = p("[add(1,2)]");
    const ev   = findAll(ast, "EvalBlock")[0];
    const l    = loc(ev);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   10);
  });

  it("FunctionCall: offsets cover name(...)", () => {
    const ast = p("[add(1,2)]");
    const fn  = findAll(ast, "FunctionCall")[0];
    const l   = loc(fn);
    // add(1,2) starts at offset 1, ends at offset 9
    assertEquals(l.start.offset, 1);
    assertEquals(l.end.offset,   9);
  });

  it("Arg: offset covers the argument text", () => {
    const ast  = p("[add(1,2)]");
    const args = findAll(ast, "Arg");
    assertEquals(args.length, 2);
    assertEquals(loc(args[0]).start.offset, 5); // "1" at offset 5
    assertEquals(loc(args[0]).end.offset,   6);
    assertEquals(loc(args[1]).start.offset, 7); // "2" at offset 7
    assertEquals(loc(args[1]).end.offset,   8);
  });

  it("Substitution: loc covers %# exactly", () => {
    const ast  = p("%#");
    const subs = findAll(ast, "Substitution");
    assertEquals(subs.length, 1);
    const l = loc(subs[0]);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   2); // %# is 2 chars
  });

  it("Escape: loc covers \\; exactly", () => {
    const ast  = p("\\;");
    const escs = findAll(ast, "Escape");
    const l    = loc(escs[0]);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   2);
  });

  it("TagRef: loc covers #tagname", () => {
    const ast  = p("#weather");
    const tags = findAll(ast, "TagRef");
    const l    = loc(tags[0]);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   8); // #weather is 8 chars
  });

  it("SpecialVar: loc covers ## exactly", () => {
    const ast = p("##");
    const sv  = findAll(ast, "SpecialVar")[0];
    const l   = loc(sv);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   2);
  });
});

// ── Multi-line positions ────────────────────────────────────────────────────────

describe("loc — line and column numbers", () => {
  it("single-line: column advances correctly", () => {
    // "abc[f()]" — f() starts at column 5 (1-based)
    const ast = p("abc[f()]");
    const fn  = findAll(ast, "FunctionCall")[0];
    assertEquals(loc(fn).start.column, 5);
    assertEquals(loc(fn).start.line,   1);
  });
});

// ── Command-level positions ────────────────────────────────────────────────────

describe("loc — AtCommand and AttributeSet", () => {
  it("AtCommand spans @pemit %#=hi", () => {
    const ast = p("@pemit %#=hi");
    const l   = loc(ast);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   12);
  });

  it("AttributeSet loc is present", () => {
    const ast = p("&ATTR me=val");
    assertExists(ast.loc);
    assertEquals(ast.loc!.start.offset, 0);
  });

  it("hidden AttributeSet loc is present", () => {
    const ast = p("&_HIDDEN me=val");
    assertExists(ast.loc);
    assertEquals(ast.hidden, true);
  });
});

// ── Coalesced literals preserve start/end span ────────────────────────────────

describe("loc — coalesced Literal spans full merged text", () => {
  it("literal span covers all merged chars", () => {
    // "hello world" — one coalesced Literal
    const ast = p("hello world");
    const lit = findAll(ast, "Literal")[0];
    const l   = loc(lit);
    assertEquals(l.start.offset, 0);
    assertEquals(l.end.offset,   11);
  });

  it("mixed text + sub: Literal before %# has correct span", () => {
    // "Hi %# there" — Literal "Hi ", Substitution, Literal " there"
    const ast  = p("Hi %# there");
    const lits = findAll(ast, "Literal");
    assertEquals(loc(lits[0]).start.offset, 0);
    assertEquals(loc(lits[0]).end.offset,   3);   // "Hi "
    assertEquals(loc(lits[1]).start.offset, 5);   // " there"
    assertEquals(loc(lits[1]).end.offset,   11);
  });
});

// ── Manually constructed nodes have no loc (and that's fine) ──────────────────

describe("loc — manually constructed nodes", () => {
  it("node without loc is valid ASTNode", () => {
    const n: ASTNode = { type: "Literal", value: "hi" };
    assertEquals(n.loc, undefined);
    assertEquals(n.type, "Literal");
  });
});
