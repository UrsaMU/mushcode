// ============================================================================
// 08 — Lock expressions (LockExpr start rule)
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { parseLock } from "./helpers.ts";

describe("Lock primaries", () => {
  it("me → LockMe", () => {
    assertEquals(parseLock("me").type, "LockMe");
  });

  it("#123 → LockDbref", () => {
    const ast = parseLock("#123");
    assertEquals(ast.type, "LockDbref");
    assertEquals(ast.dbref, "#123");
  });

  it("#-1 → LockDbref (negative dbref)", () => {
    const ast = parseLock("#-1");
    assertEquals(ast.type, "LockDbref");
    assertEquals(ast.dbref, "#-1");
  });

  it("flag^WIZARD → LockFlagCheck", () => {
    const ast = parseLock("flag^WIZARD");
    assertEquals(ast.type, "LockFlagCheck");
    assertEquals(ast.flag, "WIZARD");
  });

  it("type^ROOM → LockTypeCheck", () => {
    const ast = parseLock("type^ROOM");
    assertEquals(ast.type, "LockTypeCheck");
    assertEquals(ast.typeName, "ROOM");
  });

  it("attr^MYATTR → LockAttrCheck", () => {
    const ast = parseLock("attr^MYATTR");
    assertEquals(ast.type, "LockAttrCheck");
    assertEquals(ast.attribute, "MYATTR");
  });

  it("=PlayerName → LockPlayerName", () => {
    const ast = parseLock("=Alice");
    assertEquals(ast.type, "LockPlayerName");
    assertEquals(ast.name, "Alice");
  });

  it("=Player Name → LockPlayerName preserves spaces", () => {
    const ast = parseLock("=Player Name");
    assertEquals(ast.type, "LockPlayerName");
    assertEquals(ast.name, "Player Name");
  });
});

describe("LockNot", () => {
  it("!me → LockNot wrapping LockMe", () => {
    const ast = parseLock("!me");
    assertEquals(ast.type, "LockNot");
    assertEquals(ast.operand.type, "LockMe");
  });

  it("!flag^WIZARD → LockNot wrapping LockFlagCheck", () => {
    const ast = parseLock("!flag^WIZARD");
    assertEquals(ast.type, "LockNot");
    assertEquals(ast.operand.type, "LockFlagCheck");
  });

  it("!!me → double negation", () => {
    const ast = parseLock("!!me");
    assertEquals(ast.type, "LockNot");
    assertEquals(ast.operand.type, "LockNot");
  });
});

describe("LockOr (| operator)", () => {
  it("me|#123 → LockOr with two operands", () => {
    const ast = parseLock("me|#123");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands.length, 2);
    assertEquals(ast.operands[0].type, "LockMe");
    assertEquals(ast.operands[1].type, "LockDbref");
  });

  it("flag^WIZARD|flag^ADMIN → LockOr", () => {
    const ast = parseLock("flag^WIZARD|flag^ADMIN");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands[0].flag, "WIZARD");
    assertEquals(ast.operands[1].flag, "ADMIN");
  });

  it("a|b|c → LockOr with 3 operands (left-associative via PEG list)", () => {
    const ast = parseLock("me|#123|#456");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands.length, 3);
  });
});

describe("LockAnd (& operator)", () => {
  it("me&#123 → LockAnd with two operands", () => {
    const ast = parseLock("me&#123");
    assertEquals(ast.type, "LockAnd");
    assertEquals(ast.operands.length, 2);
    assertEquals(ast.operands[0].type, "LockMe");
    assertEquals(ast.operands[1].type, "LockDbref");
  });

  it("flag^WIZARD&flag^BUILDER → LockAnd", () => {
    const ast = parseLock("flag^WIZARD&flag^BUILDER");
    assertEquals(ast.type, "LockAnd");
  });
});

describe("Operator precedence: & binds tighter than |", () => {
  it("a|b&c → LockOr(a, LockAnd(b,c))", () => {
    const ast = parseLock("me|flag^WIZARD&#123");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands[0].type, "LockMe");
    assertEquals(ast.operands[1].type, "LockAnd");
  });
});

describe("Parenthesized lock expressions", () => {
  it("(me) → LockMe (parens stripped)", () => {
    assertEquals(parseLock("(me)").type, "LockMe");
  });

  it("(me|#123)&flag^WIZARD → LockAnd(LockOr, LockFlagCheck)", () => {
    const ast = parseLock("(me|#123)&flag^WIZARD");
    assertEquals(ast.type, "LockAnd");
    assertEquals(ast.operands[0].type, "LockOr");
    assertEquals(ast.operands[1].type, "LockFlagCheck");
  });
});

describe("Complex real-world lock expressions", () => {
  it("flag^WIZARD|flag^ADMIN → wizard or admin", () => {
    const ast = parseLock("flag^WIZARD|flag^ADMIN");
    assertEquals(ast.type, "LockOr");
  });

  it("me|=Alice → owner or specific player", () => {
    const ast = parseLock("me|=Alice");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands[1].type, "LockPlayerName");
  });

  it("!me → not owner", () => {
    assertEquals(parseLock("!me").type, "LockNot");
  });

  it("attr^STAFF|flag^WIZARD → attr check or flag check", () => {
    const ast = parseLock("attr^STAFF|flag^WIZARD");
    assertEquals(ast.type, "LockOr");
    assertEquals(ast.operands[0].type, "LockAttrCheck");
    assertEquals(ast.operands[1].type, "LockFlagCheck");
  });
});
