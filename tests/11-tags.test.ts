// ============================================================================
// 11 — RhostMUSH tag system: @tag/@ltag commands, #tagname TagRef nodes,
//       tag()/listtags()/tagmatch() functions
//
// Sources: RhostMUSH trunk Server/src/object.c (objecttag_*),
//          Server/src/command.c (@tag/@ltag registration),
//          Server/src/functions.c (fun_tag, fun_listtags, fun_tagmatch)
// ============================================================================

import { assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

// ── TagRef node ───────────────────────────────────────────────────────────────

describe("TagRef — #tagname syntax", () => {
  it("#weather → TagRef(name='weather')", () => {
    const ast = mustParse("#weather");
    const tags = findAll(ast, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("#globals → TagRef(name='globals')", () => {
    const tags = findAll(mustParse("#globals"), "TagRef");
    assertEquals(tags[0].name, "globals");
  });

  it("#_localdb → TagRef(name='_localdb') — underscore-prefixed personal tag", () => {
    const tags = findAll(mustParse("#_localdb"), "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "_localdb");
  });

  it("#my-tag → TagRef(name='my-tag') — hyphen in tag name", () => {
    const tags = findAll(mustParse("#my-tag"), "TagRef");
    assertEquals(tags[0].name, "my-tag");
  });

  it("#weather_data → TagRef (underscore in name)", () => {
    const tags = findAll(mustParse("#weather_data"), "TagRef");
    assertEquals(tags[0].name, "weather_data");
  });
});

describe("TagRef disambiguation — must NOT become TagRef", () => {
  it("#123 stays as Literal '#123' (numeric dbref)", () => {
    const ast = mustParse("#123");
    const tags = findAll(ast, "TagRef");
    assertEquals(tags.length, 0);
    // coalesce merges '#' + '123' into one Literal
    const lits = findAll(ast, "Literal");
    // deno-lint-ignore no-explicit-any
    const combined = lits.map((l) => (l as any).value).join("");
    assertEquals(combined, "#123");
  });

  it("## stays as SpecialVar '##' (iter current)", () => {
    const sv = findAll(mustParse("##"), "SpecialVar");
    assertEquals(sv.length, 1);
    assertEquals(sv[0].code, "##");
    assertEquals(findAll(mustParse("##"), "TagRef").length, 0);
  });

  it("#@ stays as SpecialVar '#@'", () => {
    const sv = findAll(mustParse("#@"), "SpecialVar");
    assertEquals(sv[0].code, "#@");
    assertEquals(findAll(mustParse("#@"), "TagRef").length, 0);
  });

  it("#$ stays as SpecialVar '#$'", () => {
    const sv = findAll(mustParse("#$"), "SpecialVar");
    assertEquals(sv[0].code, "#$");
    assertEquals(findAll(mustParse("#$"), "TagRef").length, 0);
  });

  it("bare # not followed by identifier stays Literal", () => {
    const ast = mustParse("obj # here");
    assertEquals(findAll(ast, "TagRef").length, 0);
  });
});

// ── TagRef in various positions ───────────────────────────────────────────────

describe("TagRef in command/object positions", () => {
  it("@trigger #weather/ATTR=hello → TagRef in @trigger object", () => {
    const ast = mustParse("@trigger #weather/ATTR=hello");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "trigger");
    const tags = findAll(ast.object, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("@set #globals=MAGIC → TagRef in @set object", () => {
    const ast = mustParse("@set #globals=MAGIC");
    assertEquals(ast.type, "AtCommand");
    const tags = findAll(ast.object, "TagRef");
    assertEquals(tags[0].name, "globals");
  });

  it("#weather in value position → TagRef in command value", () => {
    const ast = mustParse("@pemit %#=#weather");
    assertEquals(ast.type, "AtCommand");
    const tags = findAll(ast.value, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("@trigger #db/EVENT=%0 → TagRef + literal /EVENT in object", () => {
    const ast = mustParse("@trigger #db/EVENT=%0");
    const tags = findAll(ast.object, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "db");
    // /EVENT should be literal text in the object
    const lits = findAll(ast.object, "Literal");
    // deno-lint-ignore no-explicit-any
    assertEquals(lits.some((l) => (l as any).value.includes("EVENT")), true);
  });
});

describe("TagRef in function arguments", () => {
  it("pemit(#weather,msg) → TagRef as first arg", () => {
    const fn = findFirst(mustParse("[pemit(#weather,Hello!)]"), "FunctionCall");
    assertEquals(fn.name, "pemit");
    const tags = findAll(fn.args[0], "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("get(#globals/SCORE) → TagRef in get() arg", () => {
    const fn = findFirst(mustParse("[get(#globals/SCORE)]"), "FunctionCall");
    assertEquals(fn.name, "get");
    const tags = findAll(fn.args[0], "TagRef");
    assertEquals(tags[0].name, "globals");
  });

  it("loc(#db) → TagRef in loc() arg", () => {
    const fn = findFirst(mustParse("[loc(#db)]"), "FunctionCall");
    const tags = findAll(fn.args[0], "TagRef");
    assertEquals(tags[0].name, "db");
  });

  it("set(#weather,RAINY) → TagRef in set() first arg", () => {
    const fn = findFirst(mustParse("[set(#weather,RAINY)]"), "FunctionCall");
    const tags = findAll(fn.args[0], "TagRef");
    assertEquals(tags[0].name, "weather");
  });
});

describe("TagRef inside braces", () => {
  it("{@trigger #weather/ATTR} → TagRef inside BracedString", () => {
    const ast = mustParse("{@trigger #weather/ATTR}");
    const tags = findAll(ast, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("{pemit #globals hello} → TagRef in braced command", () => {
    const tags = findAll(mustParse("{pemit #globals hello}"), "TagRef");
    assertEquals(tags[0].name, "globals");
  });
});

// ── @tag command ──────────────────────────────────────────────────────────────

describe("@tag command (admin-only global tags)", () => {
  it("@tag/add weather=#4 → AtCommand(tag) with switch 'add'", () => {
    const ast = mustParse("@tag/add weather=#4");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "tag");
    assertEquals(ast.switches, ["add"]);
    assertEquals(ast.object.parts[0].value, "weather");
  });

  it("@tag/remove weather → AtCommand(tag) with switch 'remove', no value", () => {
    const ast = mustParse("@tag/remove weather");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "tag");
    assertEquals(ast.switches, ["remove"]);
    assertEquals(ast.object.parts[0].value, "weather");
    assertEquals(ast.value, null);
  });

  it("@tag/list → AtCommand(tag) with switch 'list', no args", () => {
    const ast = mustParse("@tag/list");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "tag");
    assertEquals(ast.switches, ["list"]);
    assertEquals(ast.object, null);
    assertEquals(ast.value, null);
  });

  it("@tag/list 2 → AtCommand with page number in object position", () => {
    const ast = mustParse("@tag/list 2");
    assertEquals(ast.name, "tag");
    assertEquals(ast.switches, ["list"]);
    // page number lands in object slot
    assertNotEquals(ast.object, null);
  });

  it("@tag (no switch, no args) → AtCommand(tag), behaves as @tag/list", () => {
    const ast = mustParse("@tag");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "tag");
  });

  it("@tag/add cron=[pmatch(Cron)] → eval block in value position", () => {
    const ast = mustParse("@tag/add cron=[pmatch(Cron)]");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "tag");
    assertEquals(ast.switches, ["add"]);
    const fns = findAll(ast.value, "FunctionCall");
    assertEquals(fns[0].name, "pmatch");
  });
});

// ── @ltag command ─────────────────────────────────────────────────────────────

describe("@ltag command (public personal tags)", () => {
  it("@ltag/add mydb=#4 → AtCommand(ltag) with switch 'add'", () => {
    const ast = mustParse("@ltag/add mydb=#4");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "ltag");
    assertEquals(ast.switches, ["add"]);
    assertEquals(ast.object.parts[0].value, "mydb");
  });

  it("@ltag/remove mydb → AtCommand(ltag), switch 'remove'", () => {
    const ast = mustParse("@ltag/remove mydb");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "ltag");
    assertEquals(ast.switches, ["remove"]);
  });

  it("@ltag/list → AtCommand(ltag), switch 'list'", () => {
    const ast = mustParse("@ltag/list");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "ltag");
    assertEquals(ast.switches, ["list"]);
  });
});

// ── tag() / listtags() / tagmatch() functions ─────────────────────────────────

describe("tag() function — resolves name to dbref", () => {
  it("[tag(weather)] → FunctionCall(tag)", () => {
    const fn = findFirst(mustParse("[tag(weather)]"), "FunctionCall");
    assertEquals(fn.name, "tag");
    assertEquals(fn.args[0].parts[0].value, "weather");
  });

  it("@trigger [tag(weather)]/ATTR=hello → FunctionCall in object position", () => {
    const ast = mustParse("@trigger [tag(weather)]/ATTR=hello");
    assertEquals(ast.type, "AtCommand");
    const fn = findFirst(ast.object, "FunctionCall");
    assertEquals(fn.name, "tag");
    assertEquals(fn.args[0].parts[0].value, "weather");
  });

  it("[set([tag(globals)],RAINY)] → tag() inside set() call", () => {
    const outer = findFirst(mustParse("[set([tag(globals)],RAINY)]"), "FunctionCall");
    assertEquals(outer.name, "set");
    const inner = findFirst(outer.args[0], "FunctionCall");
    assertEquals(inner.name, "tag");
  });

  it("@pemit %#=[tag(cron)] → tag() call in @pemit value", () => {
    const ast = mustParse("@pemit %#=[tag(cron)]");
    const fn = findFirst(ast.value, "FunctionCall");
    assertEquals(fn.name, "tag");
  });
});

describe("listtags() function", () => {
  it("[listtags()] → FunctionCall(listtags) zero args", () => {
    const fn = findFirst(mustParse("[listtags()]"), "FunctionCall");
    assertEquals(fn.name, "listtags");
    assertEquals(fn.args.length, 0);
  });

  it("[listtags(me)] → FunctionCall with object arg", () => {
    const fn = findFirst(mustParse("[listtags(me)]"), "FunctionCall");
    assertEquals(fn.name, "listtags");
    assertEquals(fn.args[0].parts[0].value, "me");
  });
});

describe("tagmatch() function", () => {
  it("[tagmatch(wea*)] → FunctionCall(tagmatch) with glob pattern", () => {
    const fn = findFirst(mustParse("[tagmatch(wea*)]"), "FunctionCall");
    assertEquals(fn.name, "tagmatch");
    // wildcard '*' in arg is a Wildcard node
    assertEquals(findAll(fn.args[0], "Wildcard").length, 0); // not a pattern context
    // in arg context * is just a literal character
    // deno-lint-ignore no-explicit-any
    const text = fn.args[0].parts.map((p: any) => p.value ?? "").join("");
    assertEquals(text.includes("wea"), true);
  });

  it("[tagmatch(*)] → FunctionCall(tagmatch) wildcard glob", () => {
    const fn = findFirst(mustParse("[tagmatch(*)]"), "FunctionCall");
    assertEquals(fn.name, "tagmatch");
  });
});

// ── Real-world patterns ───────────────────────────────────────────────────────

describe("Real-world RhostMUSH tag patterns", () => {
  it("@dolist [listtags()]={@tag/remove ##} → removes all tags", () => {
    const ast = mustParse("@dolist [listtags()]={@tag/remove ##}");
    assertEquals(ast.type, "AtCommand");
    assertEquals(ast.name, "dolist");
    const listfn = findFirst(ast.object, "FunctionCall");
    assertEquals(listfn.name, "listtags");
    // Inside the brace there should be an @tag/remove command
    const sv = findAll(ast.value, "SpecialVar");
    assertEquals(sv.some((s) => s.code === "##"), true);
  });

  it("&CMD_WEATHER Global=$+weather:@pemit %#=[get(#weather/CURR)] → TagRef in attr value", () => {
    const ast = mustParse("&CMD_WEATHER Global=$+weather:@pemit %#=[get(#weather/CURR)]");
    assertEquals(ast.type, "AttributeSet");
    assertEquals(ast.attribute, "CMD_WEATHER");
    // value is a DollarPattern
    assertEquals(ast.value.type, "DollarPattern");
    const tags = findAll(ast.value, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
  });

  it("@tag/add and #tagref in same command list", () => {
    const ast = mustParse("@tag/add db=#4;@pemit %#=[name(#db)]");
    assertEquals(ast.type, "CommandList");
    assertEquals(ast.commands[0].name, "tag");
    const tags = findAll(ast.commands[1], "TagRef");
    assertEquals(tags[0].name, "db");
  });

  it("#weather alongside substitution: #weather %N greet", () => {
    const ast = mustParse("#weather %N greet");
    const tags = findAll(ast, "TagRef");
    assertEquals(tags.length, 1);
    assertEquals(tags[0].name, "weather");
    const subs = findAll(ast, "Substitution");
    assertEquals(subs[0].code, "N");
  });

  it("multiple TagRefs in one expression", () => {
    const ast = mustParse("@trigger #cron/RUN;@trigger #weather/UPDATE");
    assertEquals(ast.type, "CommandList");
    const tags = findAll(ast, "TagRef");
    assertEquals(tags.length, 2);
    assertEquals(tags[0].name, "cron");
    assertEquals(tags[1].name, "weather");
  });
});
