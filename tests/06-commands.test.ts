// ============================================================================
// 06 — Commands: @commands, &attribute-set, user commands, command lists
// ============================================================================

import { assertEquals } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

// ── @commands ─────────────────────────────────────────────────────────────────

describe("@commands — basic", () => {
  it("@pemit %#=Hello → AtCommand(pemit), object=%#, value=Hello", () => {
    const ast = mustParse("@pemit %#=Hello");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "pemit");
    assertEquals(ast.switches.length, 0);
    assertEquals(ast.object.parts[0].type, "Substitution");
    assertEquals(ast.object.parts[0].code, "#");
  });

  it("@set me=SAFE → AtCommand(set), object=me, value=SAFE", () => {
    const ast = mustParse("@set me=SAFE");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "set");
    assertEquals(ast.object.parts[0].value, "me");
  });

  it("@examine → AtCommand with no body (object:null, value:null)", () => {
    const ast = mustParse("@examine");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "examine");
    assertEquals(ast.object, null);
    assertEquals(ast.value, null);
  });

  it("@examine Wizard → AtCommand with object only, no =value", () => {
    const ast = mustParse("@examine Wizard");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.object.parts[0].value, "Wizard");
    assertEquals(ast.value, null);
  });
});

describe("@commands — switches", () => {
  it("@lock/enter me=flag^WIZARD → one switch 'enter'", () => {
    const ast = mustParse("@lock/enter me=flag^WIZARD");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "lock");
    assertEquals(ast.switches, ["enter"]);
  });

  it("@pemit/list/noeval %#=x → two switches", () => {
    const ast = mustParse("@pemit/list/noeval %#=x");
    assertEquals(ast.switches, ["list", "noeval"]);
  });

  it("@trigger me/ATTR=arg1,arg2 → no switches, object=me/ATTR", () => {
    const ast = mustParse("@trigger me/ATTR=arg1,arg2");
    assertEquals(ast.name, "trigger");
    assertEquals(ast.switches.length, 0);
  });
});

describe("@commands — complex objects and values", () => {
  it("@pemit %#=[u(me/FN,%0)] → eval block in value", () => {
    const ast = mustParse("@pemit %#=[u(me/FN,%0)]");
    const blocks = findAll(ast.value, "EvalBlock");
    assertEquals(blocks.length, 1);
  });

  it("@trigger #123/ATTR=hello → dbref object", () => {
    const ast = mustParse("@trigger #123/ATTR=hello");
    assertEquals(ast.name, "trigger");
  });

  it("@dolist [lwho()]={@pemit ##=Restart} → eval in object position", () => {
    const ast = mustParse("@dolist [lwho()]={@pemit ##=Restart}");
    assertEquals(ast.name, "dolist");
    const block = findFirst(ast.object, "EvalBlock");
    assertEquals(block.type, "EvalBlock");
  });

  it("@switch [gt(%0,10)]=1,{big},{small} → value has BracedStrings", () => {
    const ast = mustParse("@switch [gt(%0,10)]=1,{big},{small}");
    assertEquals(ast.name, "switch");
    const braces = findAll(ast.value, "BracedString");
    assertEquals(braces.length, 2);
  });
});

// ── &attribute-set ────────────────────────────────────────────────────────────

describe("&attribute-set commands", () => {
  it("&DATA_SCORE me=100 → AttributeSet", () => {
    const ast = mustParse("&DATA_SCORE me=100");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "DATA_SCORE");
    assertEquals(ast.value.parts[0].value, "100");
  });

  it("&FN_ADD me=[add(%0,%1)] → value is EvalBlock", () => {
    const ast = mustParse("&FN_ADD me=[add(%0,%1)]");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "FN_ADD");
    const block = findFirst(ast.value, "EvalBlock");
    assertEquals(block.type, "EvalBlock");
  });

  it("&CMD_FINGER Global=$+finger * → sets a dollar-pattern value", () => {
    const ast = mustParse("&CMD_FINGER Global=$+finger *:@pemit %#=Hello");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.value.type, "DollarPattern");
  });

  it("&SCORE me (no =) → AttributeSet with value:null (clear form)", () => {
    const ast = mustParse("&SCORE me");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "SCORE");
    assertEquals(ast.value, null);
  });

  it("&MY-ATTR me=x → hyphen in attribute name", () => {
    const ast = mustParse("&MY-ATTR me=x");
    assertEquals(ast.attribute, "MY-ATTR");
  });
});

// ── RhostMUSH hidden attribute convention (_-prefix) ─────────────────────────

describe("hidden attribute flag (_-prefix, RhostMUSH)", () => {
  it("&PUBLIC_ATTR me=val → hidden:false", () => {
    const ast = mustParse("&PUBLIC_ATTR me=val");
    assertEquals(ast.hidden, false);
  });

  it("&_INTERNAL me=val → hidden:true", () => {
    const ast = mustParse("&_INTERNAL me=val");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.hidden, true);
  });

  it("&_COR_STATE me=active → hidden:true (_COR_ system prefix)", () => {
    const ast = mustParse("&_COR_STATE me=active");
    assertEquals(ast.hidden, true);
    assertEquals(ast.attribute, "_COR_STATE");
  });

  it("&_SECRET me (clear form) → hidden:true, value:null", () => {
    const ast = mustParse("&_SECRET me");
    assertEquals(ast.hidden, true);
    assertEquals(ast.value, null);
  });

  it("&_FN_HELPER me=[add(%0,%1)] → hidden:true with eval value", () => {
    const ast = mustParse("&_FN_HELPER me=[add(%0,%1)]");
    assertEquals(ast.hidden, true);
    assertEquals(ast.type, "AttributeSet");
  });

  it("hidden flag survives a command list", () => {
    const ast = mustParse("&PUBLIC me=1;&_HIDDEN me=2");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands[0].hidden, false);
    assertEquals(ast.commands[1].hidden, true);
  });
});

// ── User commands ─────────────────────────────────────────────────────────────

describe("User / soft commands", () => {
  it("say Hello → UserCommand", () => {
    const ast = mustParse("say Hello");
    assertEquals(ast.type, "UserCommand");
  });

  it("go north → UserCommand", () => {
    const ast = mustParse("go north");
    assertEquals(ast.type, "UserCommand");
  });

  it("+finger Bob → UserCommand starting with +", () => {
    const ast = mustParse("+finger Bob");
    assertEquals(ast.type, "UserCommand");
  });

  it("look → UserCommand", () => {
    const ast = mustParse("look");
    assertEquals(ast.type, "UserCommand");
  });
});

// ── Command lists ─────────────────────────────────────────────────────────────

describe("Command lists (semicolon-separated)", () => {
  it("@pemit %#=Hi;@pemit %#=Bye → CommandList with two AtCommands", () => {
    const ast = mustParse("@pemit %#=Hi;@pemit %#=Bye");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands.length, 2);
    assertEquals(ast.commands[0].type, "AtCommand");
    assertEquals(ast.commands[1].type, "AtCommand");
  });

  it("say Hi;go north;look → CommandList with 3 commands", () => {
    const ast = mustParse("say Hi;go north;look");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands.length, 3);
  });

  it("single command → returned directly, not wrapped in CommandList", () => {
    const ast = mustParse("@pemit %#=Hello");
    assertEquals(ast.type, "AtCommand");
  });

  it("{cmd;cmd};cmd → brace protects inner semicolons from list split", () => {
    const ast = mustParse("{cmd1;cmd2};cmd3");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands.length, 2);
    // First command is a UserCommand whose only part is the BracedString
    assertEquals(ast.commands[0].type, "UserCommand");
    assertEquals(ast.commands[0].parts[0].type, "BracedString");
  });
});
