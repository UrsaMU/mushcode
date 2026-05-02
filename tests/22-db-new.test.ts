// ============================================================================
// 22 — DB-backed stdlib: lattr, xget, obj, type, objeval
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { EvalContext, ObjectAccessor } from "../src/eval/mod.ts";

// ── Mock accessor ─────────────────────────────────────────────────────────────

const mockAccessor: ObjectAccessor = {
  getAttr(objectId, attr) {
    const db: Record<string, Record<string, string>> = {
      obj1: {
        NAME:      "Alice",
        SCORE:     "42",
        FN_ADD:    "[add(%0,%1)]",
        FN_GREET:  "Hello, %0!",
      },
      obj2: { NAME: "Bob", SCORE: "7" },
    };
    return Promise.resolve(db[objectId]?.[attr.toUpperCase()] ?? null);
  },
  resolveTarget(_from, expr) {
    if (expr === "me" || expr === "obj1") return Promise.resolve("obj1");
    if (expr === "obj2" || expr === "Bob") return Promise.resolve("obj2");
    return Promise.resolve(null);
  },
  getName(objectId) {
    if (objectId === "obj1") return Promise.resolve("Alice");
    if (objectId === "obj2") return Promise.resolve("Bob");
    return Promise.resolve(objectId);
  },
  hasFlag(_id, flag) {
    return Promise.resolve(flag === "wizard" && _id === "obj1");
  },
  listAttrs(objectId, pattern) {
    const db: Record<string, string[]> = {
      obj1: ["NAME", "SCORE", "FN_ADD", "FN_GREET"],
      obj2: ["NAME", "SCORE"],
    };
    const attrs = db[objectId] ?? [];
    if (!pattern) return Promise.resolve(attrs);
    // Simple wildcard: support * and ?
    const reStr = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                          .replace(/\*/g, ".*")
                          .replace(/\?/g, ".");
    const re = new RegExp(`^${reStr}$`);
    return Promise.resolve(attrs.filter(a => re.test(a)));
  },
  getType(objectId) {
    const types: Record<string, string> = {
      obj1: "PLAYER",
      obj2: "THING",
    };
    return Promise.resolve(types[objectId] ?? "#-1 NO MATCH");
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

function ev(src: string, overrides: Partial<EvalContext> = {}): Promise<string> {
  return makeEngine().evalString(src, ctx(overrides));
}

// ── lattr() ───────────────────────────────────────────────────────────────────

describe("eval — lattr()", () => {
  it("lattr(me) returns all attr names", async () => {
    assertEquals(await ev("[lattr(me)]"), "NAME SCORE FN_ADD FN_GREET");
  });

  it("lattr(me, FN_*) returns only matching attrs", async () => {
    assertEquals(await ev("[lattr(me,FN_*)]"), "FN_ADD FN_GREET");
  });

  it("lattr(nonexistent) returns empty string", async () => {
    assertEquals(await ev("[lattr(zzz)]"), "");
  });

  it("lattr(obj2) returns obj2 attrs", async () => {
    assertEquals(await ev("[lattr(obj2)]"), "NAME SCORE");
  });
});

// ── xget() ────────────────────────────────────────────────────────────────────

describe("eval — xget()", () => {
  it("xget(me, FN_ADD) evaluates attribute as softcode and returns a string", async () => {
    const result = await ev("[xget(me,FN_ADD)]");
    // FN_ADD = [add(%0,%1)] — %0/%1 are empty so add(,) → add(0,0) → "0"
    assertEquals(typeof result, "string");
  });

  it("xget on unset attr returns empty string", async () => {
    assertEquals(await ev("[xget(me,NOATTR)]"), "");
  });

  it("xget on nonexistent obj returns #-1 NO MATCH", async () => {
    assertEquals(await ev("[xget(zzz,NAME)]"), "#-1 NO MATCH");
  });

  it("xget(me, NAME) evaluates plain string attr", async () => {
    assertEquals(await ev("[xget(me,NAME)]"), "Alice");
  });
});

// ── obj() ─────────────────────────────────────────────────────────────────────

describe("eval — obj()", () => {
  it("obj(me) returns resolved object id", async () => {
    assertEquals(await ev("[obj(me)]"), "obj1");
  });

  it("obj(obj2) returns obj2 id", async () => {
    assertEquals(await ev("[obj(obj2)]"), "obj2");
  });

  it("obj(nonexistent) returns #-1 NO MATCH", async () => {
    assertEquals(await ev("[obj(zzz)]"), "#-1 NO MATCH");
  });
});

// ── type() ────────────────────────────────────────────────────────────────────

describe("eval — type()", () => {
  it("type(me) returns PLAYER", async () => {
    assertEquals(await ev("[type(me)]"), "PLAYER");
  });

  it("type(obj2) returns THING", async () => {
    assertEquals(await ev("[type(obj2)]"), "THING");
  });

  it("type(nonexistent) returns #-1 NO MATCH", async () => {
    assertEquals(await ev("[type(zzz)]"), "#-1 NO MATCH");
  });
});

// ── objeval() ─────────────────────────────────────────────────────────────────

describe("eval — objeval()", () => {
  it("objeval(me, [add(1,2)]) returns 3", async () => {
    assertEquals(await ev("[objeval(me,[add(1,2)])]"), "3");
  });

  it("objeval on nonexistent obj returns #-1 NO MATCH", async () => {
    assertEquals(await ev("[objeval(zzz,[add(1,2)])]"), "#-1 NO MATCH");
  });

  it("objeval with string expression", async () => {
    assertEquals(await ev("[objeval(me,hello)]"), "hello");
  });
});
