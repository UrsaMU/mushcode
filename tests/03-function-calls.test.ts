// ============================================================================
// 03 — Function calls inside eval blocks
// ============================================================================

import { assertEquals, assertExists } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import { mustParse, findAll, findFirst } from "./helpers.ts";

function evalFn(src: string) {
  const ast = mustParse(src);
  return findFirst(ast, "FunctionCall");
}

describe("Zero-argument functions", () => {
  it("lwho()  → FunctionCall, args:[]", () => {
    const fn = evalFn("[lwho()]");
    assertEquals(fn.name, "lwho");
    assertEquals(fn.args.length, 0);
  });

  it("secs()  → FunctionCall, args:[]", () => {
    const fn = evalFn("[secs()]");
    assertEquals(fn.name, "secs");
    assertEquals(fn.args.length, 0);
  });

  it("time()  → FunctionCall, args:[]", () => {
    const fn = evalFn("[time()]");
    assertEquals(fn.name, "time");
    assertEquals(fn.args.length, 0);
  });
});

describe("One-argument functions", () => {
  it("name(%#) → FunctionCall, 1 arg containing Substitution", () => {
    const fn = evalFn("[name(%#)]");
    assertEquals(fn.name, "name");
    assertEquals(fn.args.length, 1);
    assertEquals(fn.args[0].parts[0].type, "Substitution");
    assertEquals(fn.args[0].parts[0].code, "#");
  });

  it("strlen(hello) → FunctionCall, 1 literal arg", () => {
    const fn = evalFn("[strlen(hello)]");
    assertEquals(fn.args[0].parts[0].value, "hello");
  });
});

describe("Multi-argument functions", () => {
  it("add(1,2) → two literal args", () => {
    const fn = evalFn("[add(1,2)]");
    assertEquals(fn.name, "add");
    assertEquals(fn.args.length, 2);
    assertEquals(fn.args[0].parts[0].value, "1");
    assertEquals(fn.args[1].parts[0].value, "2");
  });

  it("if(gt(%0,10),big,small) → 3 args", () => {
    const fn = evalFn("[if(gt(%0,10),big,small)]");
    assertEquals(fn.name, "if");
    assertEquals(fn.args.length, 3);
  });

  it("setq(0,hello) → 2 args, first is digit literal", () => {
    const fn = evalFn("[setq(0,hello)]");
    assertEquals(fn.args[0].parts[0].value, "0");
    assertEquals(fn.args[1].parts[0].value, "hello");
  });
});

describe("Empty arguments", () => {
  it("setq(0,) → second arg is empty Arg node", () => {
    const fn = evalFn("[setq(0,)]");
    assertEquals(fn.args.length, 2);
    assertEquals(fn.args[1].parts.length, 0);
  });

  it("f(,b) → first arg empty, second is 'b'", () => {
    const fn = evalFn("[f(,b)]");
    assertEquals(fn.args[0].parts.length, 0);
    assertEquals(fn.args[1].parts[0].value, "b");
  });

  it("iter(list,,delim) → middle arg is empty", () => {
    const fn = evalFn("[iter(list,,delim)]");
    assertEquals(fn.args.length, 3);
    assertEquals(fn.args[1].parts.length, 0);
  });
});

describe("Nested function calls", () => {
  it("add(mul(2,3),1) → outer add, inner mul", () => {
    const add = evalFn("[add(mul(2,3),1)]");
    assertEquals(add.name, "add");
    const mul = findFirst(add.args[0], "FunctionCall");
    assertEquals(mul.name, "mul");
    assertEquals(mul.args[0].parts[0].value, "2");
    assertEquals(mul.args[1].parts[0].value, "3");
  });

  it("if(gt(%0,10),big,small) → nested gt inside if", () => {
    const ifFn = evalFn("[if(gt(%0,10),big,small)]");
    const gt = findFirst(ifFn.args[0], "FunctionCall");
    assertEquals(gt.name, "gt");
  });

  it("setq(0,pmatch(trim(%0))) → 3 levels of nesting", () => {
    const fn = evalFn("[setq(0,pmatch(trim(%0)))]");
    assertEquals(fn.name, "setq");
    const pmatch = findFirst(fn.args[1], "FunctionCall");
    assertEquals(pmatch.name, "pmatch");
    const trim = findFirst(pmatch.args[0], "FunctionCall");
    assertEquals(trim.name, "trim");
  });
});

describe("Function call with substitutions in args", () => {
  it("u(me/FN_FINGER,%0) → u with 2 args, second is Substitution(0)", () => {
    const fn = evalFn("[u(me/FN_FINGER,%0)]");
    assertEquals(fn.name, "u");
    assertEquals(fn.args[0].parts[0].value, "me/FN_FINGER");
    assertEquals(fn.args[1].parts[0].code, "0");
  });

  it("ansi(hg,SUCCESS) → 2 literal args", () => {
    const fn = evalFn("[ansi(hg,SUCCESS)]");
    assertEquals(fn.args[0].parts[0].value, "hg");
    assertEquals(fn.args[1].parts[0].value, "SUCCESS");
  });
});

describe("Back-to-back eval blocks", () => {
  it("[setq(0,hello)][r(0)] → two FunctionCalls", () => {
    const ast = mustParse("[setq(0,hello)][r(0)]");
    const fns = findAll(ast, "FunctionCall");
    assertEquals(fns.length, 2);
    assertEquals(fns[0].name, "setq");
    assertEquals(fns[1].name, "r");
  });
});

describe("Function args with braces protecting commas", () => {
  it("iter([lcon(%L)],{##: name},, ) → brace-protected output template", () => {
    const fn = evalFn("[iter([lcon(%L)],{##: name},,)]");
    assertEquals(fn.name, "iter");
    assertEquals(fn.args[1].parts[0].type, "BracedString");
  });
});

describe("Case-insensitive function names (grammar preserves case)", () => {
  it("ADD(1,2) → name is 'ADD'", () => {
    const fn = evalFn("[ADD(1,2)]");
    assertEquals(fn.name, "ADD");
  });

  it("Strlen(x) → name is 'Strlen'", () => {
    const fn = evalFn("[Strlen(x)]");
    assertEquals(fn.name, "Strlen");
  });
});

describe("Underscore-prefixed function names", () => {
  it("_myfunc(x) → FunctionCall with name '_myfunc'", () => {
    const fn = evalFn("[_myfunc(x)]");
    assertEquals(fn.name, "_myfunc");
  });
});

describe("Bare ( in argument (was broken before fix)", () => {
  it("add(1,(2)) → second arg is Literal '(2)'", () => {
    const fn = evalFn("[add(1,(2))]");
    assertEquals(fn.args[1].parts[0].value, "(2)");
  });

  it("pemit(%#,(text)) → second arg contains literal (text)", () => {
    const fn = evalFn("[pemit(%#,(text))]");
    assertEquals(fn.args[1].parts[0].value, "(text)");
  });

  it("ansi(h,(bold text)) → literal (bold text) as arg", () => {
    const fn = evalFn("[ansi(h,(bold text))]");
    assertEquals(fn.args[1].parts[0].value, "(bold text)");
  });
});
