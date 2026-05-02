// ============================================================================
// 17 — Pattern matching and execution: matchPattern, execPattern
// ============================================================================

import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it }                  from "@std/testing/bdd";
import { parse }                          from "../parser/mod.ts";
import { matchPattern, execPattern }      from "../src/pattern/mod.ts";
import { EvalEngine, makeContext, registerStdlib } from "../src/eval/mod.ts";
import type { ObjectAccessor }            from "../src/eval/mod.ts";

// ── Shared engine fixture ─────────────────────────────────────────────────────

const accessor: ObjectAccessor = {
  getAttr: (_id, _attr) => Promise.resolve(null),
  resolveTarget: (_from, expr) => Promise.resolve(expr === "me" ? "player1" : null),
  getName: (_id) => Promise.resolve("TestPlayer"),
  hasFlag: (_id, _flag) => Promise.resolve(false),
};

function makeEngine() {
  const engine = new EvalEngine(accessor);
  registerStdlib(engine);
  // Register a simple @pemit that captures output for testing.
  const outputs: string[] = [];
  engine.registerCommand("pemit", {
    exec: async (_sw, _obj, val, _ctx, eng) => {
      // Evaluate val in the calling context so %1 etc. resolve.
      outputs.push(val ?? "");
    },
  });
  return { engine, outputs };
}

const ctx = makeContext({ enactor: "player1", executor: "player1" });

// ── Helper: extract pattern node from a dollar/listen pattern string ──────────

function getPatternNode(src: string) {
  const ast = parse(src);
  return ast.pattern as ReturnType<typeof parse>;
}

// ── matchPattern tests ────────────────────────────────────────────────────────

describe("matchPattern", () => {
  it("exact match — no captures", () => {
    const p = getPatternNode("$look:ignored");
    const m = matchPattern(p, "look");
    assertEquals(m?.input, "look");
    assertEquals(m?.captures, []);
  });

  it("case-insensitive: $Look matches 'look'", () => {
    const p = getPatternNode("$Look:ignored");
    const m = matchPattern(p, "look");
    assertNotEquals(m, null);
  });

  it("case-insensitive: $look matches 'LOOK'", () => {
    const p = getPatternNode("$look:ignored");
    const m = matchPattern(p, "LOOK");
    assertNotEquals(m, null);
  });

  it("no match — extra word", () => {
    const p = getPatternNode("$go:ignored");
    assertEquals(matchPattern(p, "go north"), null);
  });

  it("no match — wrong command", () => {
    const p = getPatternNode("$+greet *:ignored");
    assertEquals(matchPattern(p, "+wave Alice"), null);
  });

  it("single wildcard: $go * captures the remainder", () => {
    const p = getPatternNode("$go *:ignored");
    const m = matchPattern(p, "go north");
    assertEquals(m?.captures, ["north"]);
    assertEquals(m?.input, "go north");
  });

  it("prefix command: $+greet * captures name", () => {
    const p = getPatternNode("$+greet *:ignored");
    const m = matchPattern(p, "+greet Alice");
    assertEquals(m?.captures, ["Alice"]);
  });

  it("two wildcards: $+tell * = * splits correctly", () => {
    const p = getPatternNode("$+tell * = *:ignored");
    const m = matchPattern(p, "+tell Alice = hi there");
    assertEquals(m?.captures, ["Alice", "hi there"]);
  });

  it("two wildcards greedy: first * gets 'a b c', second * gets ''", () => {
    // With two * in '$+cmd * *', the first is non-greedy (.*?) and the second
    // greedy (.*).  They are separated by a space literal, so first gets 'a'
    // and second gets 'b c' when input is '+cmd a b c'.
    const p = getPatternNode("$+cmd * *:ignored");
    const m = matchPattern(p, "+cmd a b c");
    // The regex becomes: ^\+cmd (.*?) (.*)$
    // first = "a", second = "b c"
    assertEquals(m?.captures[0], "a");
    assertEquals(m?.captures[1], "b c");
  });

  it("single char wildcard ?: matches exactly one char", () => {
    const p = getPatternNode("$go ?:ignored");
    const m = matchPattern(p, "go n");
    assertEquals(m?.captures, ["n"]);
  });

  it("single char wildcard ?: does not match zero chars", () => {
    const p = getPatternNode("$go ?:ignored");
    assertEquals(matchPattern(p, "go "), null);
  });

  it("single char wildcard ?: does not match two chars", () => {
    const p = getPatternNode("$go ?:ignored");
    assertEquals(matchPattern(p, "go no"), null);
  });

  it("PatternAlts: first alt matches", () => {
    const p = getPatternNode("$go;walk:ignored");
    assertNotEquals(matchPattern(p, "go"), null);
  });

  it("PatternAlts: second alt matches", () => {
    const p = getPatternNode("$go;walk:ignored");
    assertNotEquals(matchPattern(p, "walk"), null);
  });

  it("PatternAlts: neither alt matches", () => {
    const p = getPatternNode("$go;walk:ignored");
    assertEquals(matchPattern(p, "run"), null);
  });

  it("empty wildcard capture: $go * matches 'go ' → captures ['']", () => {
    const p = getPatternNode("$go *:ignored");
    const m = matchPattern(p, "go ");
    assertEquals(m?.captures, [""]);
  });

  it("$* matches everything", () => {
    const p = getPatternNode("$*:ignored");
    const m = matchPattern(p, "");
    assertNotEquals(m, null);
    assertEquals(m?.captures, [""]);

    const m2 = matchPattern(p, "anything at all");
    assertNotEquals(m2, null);
  });

  it("escaped asterisk in pattern matches literal '*'", () => {
    const p = getPatternNode("$tell \\*:ignored");
    const m = matchPattern(p, "tell *");
    assertNotEquals(m, null);
    assertEquals(m?.captures, []);
  });

  it("escaped asterisk does not match text", () => {
    const p = getPatternNode("$tell \\*:ignored");
    assertEquals(matchPattern(p, "tell something"), null);
  });

  it("no wildcards: exact match only", () => {
    const p = getPatternNode("$north:ignored");
    assertNotEquals(matchPattern(p, "north"), null);
    assertEquals(matchPattern(p, "north x"), null);
  });
});

// ── execPattern tests ─────────────────────────────────────────────────────────

describe("execPattern", () => {
  it("non-pattern attribute returns null", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("[add(1,2)]", "anything", ctx, engine);
    assertEquals(result, null);
  });

  it("no match returns null", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$go *:@pemit %#=You went %1!", "wave hi", ctx, engine);
    assertEquals(result, null);
  });

  it("match returns '' (command action has no value)", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$go *:@pemit %#=You went %1!", "go north", ctx, engine);
    // @pemit exec has side effects; eval returns "" for command nodes
    assertEquals(result, "");
  });

  it("%0 is the full input", async () => {
    const { engine } = makeEngine();
    // Use an expression action so we can inspect %0.
    const result = await execPattern("$go *:[%0]", "go north", ctx, engine);
    assertEquals(result, "go north");
  });

  it("%1 is first wildcard capture", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$go *:[%1]", "go north", ctx, engine);
    assertEquals(result, "north");
  });

  it("multiple wildcards: %1 and %2", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$+tell * = *:[%1] and [%2]", "+tell Alice = hello world", ctx, engine);
    assertEquals(result, "Alice and hello world");
  });

  it("action expression [add(%1,%2)] evaluates correctly", async () => {
    const { engine } = makeEngine();
    // Pattern: "$add * and *" — input "add 3 and 4"
    const result = await execPattern("$add * and *:[add(%1,%2)]", "add 3 and 4", ctx, engine);
    assertEquals(result, "7");
  });

  it("ListenPattern works the same way", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("^hello *:[%1]", "hello world", ctx, engine);
    assertEquals(result, "world");
  });

  it("ListenPattern no match returns null", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("^hello *:[%1]", "goodbye world", ctx, engine);
    assertEquals(result, null);
  });

  it("exact-match pattern executes action with %0 = full input", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$look:[%0]", "look", ctx, engine);
    assertEquals(result, "look");
  });

  it("case-insensitive match still executes action", async () => {
    const { engine } = makeEngine();
    const result = await execPattern("$LOOK:[%0]", "look", ctx, engine);
    assertEquals(result, "look");
  });
});
