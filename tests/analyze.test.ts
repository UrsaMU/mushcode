// ============================================================================
// Analyze — extractCommands, extractDeps, extractTagRefs
// ============================================================================

import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { parse } from "../parser/mod.ts";
import type { ASTNode } from "../parser/mod.ts";
import { extractCommands, extractDeps, extractTagRefs } from "../src/analyze/mod.ts";

// ── Helpers ────────────────────────────────────────────────────────────────────

function p(text: string): ASTNode {
  return parse(text, "Start");
}

// ── extractCommands ────────────────────────────────────────────────────────────

describe("extractCommands", () => {
  it("returns empty array for plain text", () => {
    assertEquals(extractCommands(p("hello")), []);
  });

  it("extracts a single DollarPattern", () => {
    const ast = p("$+finger *:@pemit %#=%0");
    const cmds = extractCommands(ast);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].type, "dollar");
    assertEquals(cmds[0].patternText, "+finger *");
    assertEquals(cmds[0].pattern.type, "Pattern");
    assertEquals(cmds[0].action.type, "AtCommand");
  });

  it("extracts a single ListenPattern", () => {
    const ast = p("^hello *:@pemit %#=Hi!");
    const cmds = extractCommands(ast);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].type, "listen");
    assertEquals(cmds[0].patternText, "hello *");
  });

  it("extracts multiple patterns from a manually built CommandList", () => {
    // In practice each $-trigger is its own attribute value; we build
    // a synthetic CommandList to verify extractCommands walks the whole tree.
    const ast: ASTNode = {
      type: "CommandList",
      commands: [
        p("$+look:look"),
        p("$+who:doing"),
      ],
    };
    const cmds = extractCommands(ast);
    assertEquals(cmds.length, 2);
    assertEquals(cmds[0].type, "dollar");
    assertEquals(cmds[1].type, "dollar");
  });

  it("extracts both dollar and listen patterns from a synthetic tree", () => {
    const ast: ASTNode = {
      type: "CommandList",
      commands: [
        p("$say *:@pemit %#=%0"),
        p("^hello:@pemit %#=hi"),
      ],
    };
    const cmds = extractCommands(ast);
    const types = cmds.map(c => c.type);
    assertEquals(types.includes("dollar"), true);
    assertEquals(types.includes("listen"), true);
  });

  it("pattern node is the Pattern/PatternAlts node", () => {
    const ast = p("$+finger *:@pemit %#=%0");
    const cmds = extractCommands(ast);
    const ptype = cmds[0].pattern.type;
    assertEquals(ptype === "Pattern" || ptype === "PatternAlts", true);
  });

  it("extracts PatternAlts correctly", () => {
    const ast = p("$look;+look:look");
    const cmds = extractCommands(ast);
    assertEquals(cmds.length, 1);
    assertEquals(cmds[0].patternText.includes("look"), true);
  });
});

// ── extractDeps ────────────────────────────────────────────────────────────────

describe("extractDeps", () => {
  it("returns empty array for plain text", () => {
    assertEquals(extractDeps(p("hello")), []);
  });

  it("detects u() call", () => {
    const ast = p("[u(me/FN_FINGER,%0)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 1);
    assertEquals(deps[0].type, "u");
    assertEquals(deps[0].target, "me/FN_FINGER");
  });

  it("detects get() call", () => {
    const ast = p("[get(me/MYATTR)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 1);
    assertEquals(deps[0].type, "get");
    assertEquals(deps[0].target, "me/MYATTR");
  });

  it("detects v() call (treated as get)", () => {
    const ast = p("[v(MYATTR)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 1);
    assertEquals(deps[0].type, "get");
    assertEquals(deps[0].target, "MYATTR");
  });

  it("detects @trigger command", () => {
    const ast = p("@trigger me/GO_ACTION=arg");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 1);
    assertEquals(deps[0].type, "trigger");
    assertEquals(deps[0].target, "me/GO_ACTION");
  });

  it("collects multiple deps from one attribute", () => {
    const ast = p("[u(me/FN1)][get(me/ATTR)][v(OTHER)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 3);
    const types = deps.map(d => d.type);
    assertEquals(types.filter(t => t === "u").length, 1);
    assertEquals(types.filter(t => t === "get").length, 2);
  });

  it("ignores non-dep function calls like strlen()", () => {
    const ast = p("[strlen(hello)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 0);
  });

  it("dynamic target (eval in first arg) is included as-printed", () => {
    const ast = p("[u([switch(%0,a,me,#5)]/FUNC)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 1);
    assertEquals(deps[0].type, "u");
    // target is the printed first arg — contains the eval block
    assertEquals(deps[0].target.includes("["), true);
  });

  it("case-insensitive: U() and GET() are detected", () => {
    const ast = p("[U(me/FN)][GET(me/A)]");
    const deps = extractDeps(ast);
    assertEquals(deps.length, 2);
  });
});

// ── extractTagRefs ─────────────────────────────────────────────────────────────

describe("extractTagRefs", () => {
  it("returns empty array when no TagRefs", () => {
    assertEquals(extractTagRefs(p("hello")), []);
  });

  it("extracts a single TagRef", () => {
    const ast = p("[tag(me,#combat)]");
    const tags = extractTagRefs(ast);
    assertEquals(tags, ["combat"]);
  });

  it("deduplicates repeated TagRefs", () => {
    const ast = p("[tag(me,#combat)][tag(me,#combat)]");
    const tags = extractTagRefs(ast);
    assertEquals(tags, ["combat"]);
  });

  it("collects multiple distinct TagRefs sorted alphabetically", () => {
    const ast = p("[tag(me,#zebra)][tag(me,#alpha)][tag(me,#middle)]");
    const tags = extractTagRefs(ast);
    assertEquals(tags, ["alpha", "middle", "zebra"]);
  });

  it("detects TagRef in attribute set value", () => {
    const ast = p("&ATTR me=[tag(me,#mytag)]");
    const tags = extractTagRefs(ast);
    assertEquals(tags, ["mytag"]);
  });

  it("tagmatch() references", () => {
    const ast = p("[tagmatch(me,#hero,#npc)]");
    const tags = extractTagRefs(ast);
    assertEquals(tags.includes("hero"), true);
    assertEquals(tags.includes("npc"), true);
  });
});
