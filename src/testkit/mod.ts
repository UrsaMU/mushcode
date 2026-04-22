/**
 * @module
 * `@rhost/testkit` — in-process test helpers for RhostMUSH softcode.
 *
 * Wraps `EvalEngine` + `MemoryStore` with the full RhostMUSH plugin and stdlib,
 * plus missing-but-essential functions (`v`, `default`, `mod`, `grab`, `num`,
 * `isdbref`, `or`, `and`, `not`, `if`, `ifelse`) that MIAM-style softcode
 * relies on but the parser's stdlib does not yet export.
 *
 * @example
 * ```ts
 * import { TestWorld, expect } from "@ursamu/mushcode/testkit";
 * import { describe, it }      from "@std/testing/bdd";
 *
 * describe("my system", () => {
 *   it("adds two numbers", async () => {
 *     const w = new TestWorld();
 *     expect(await w.eval("[add(2,3)]")).toEqual("5");
 *   });
 * });
 * ```
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { EvalEngine, makeContext, registerStdlib } from "../eval/mod.ts";
import { MemoryStore, createRhostPlugin }           from "../plugins/rhost/mod.ts";
import type { MemoryStoreConfig, MemObjectInit }     from "../plugins/rhost/mod.ts";
import type { EvalContext, FunctionImpl }            from "../eval/context.ts";

export { MemoryStore };
export type { MemoryStoreConfig };

// ── Missing-but-needed stdlib supplements ────────────────────────────────────
//
// These functions appear in MIAM softcode and in standard MUSH specs but are
// not yet in the parser's stdlib or rhost plugin.  They are registered by
// TestWorld.  A future stdlib expansion should absorb them.

const SUPPLEMENT_FUNCTIONS: Record<string, FunctionImpl> = {

  // hasflag(obj, flag) — override the stdlib version to trim flag argument.
  // In a real MUSH server, function args are trimmed by the server.  The
  // eval engine does not trim, so `hasflag(%0, WIZARD)` passes " WIZARD"
  // (with leading space).  This override trims before the flag lookup.
  hasflag: {
    minArgs: 2, maxArgs: 2,
    async exec(args, ctx, engine) {
      const [objExpr, flagRaw] = args as string[];
      const flag  = flagRaw.trim();
      const objId = await engine.accessor.resolveTarget(ctx.enactor, objExpr.trim());
      if (!objId) return "0";
      return (await engine.accessor.hasFlag(objId, flag)) ? "1" : "0";
    },
  },

  // get(obj/attr) — override stdlib to trim both sides of the slash.
  get: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const raw = ((args as string[])[0] ?? "").trim();
      const slash = raw.indexOf("/");
      if (slash === -1) return "#-1 BAD ARGUMENT FORMAT";
      const objExpr  = raw.slice(0, slash).trim();
      const attrName = raw.slice(slash + 1).trim().toUpperCase();
      const objId    = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return "#-1 NO MATCH";
      return (await engine.accessor.getAttr(objId, attrName)) ?? "";
    },
  },

  // match(list, pattern[, delim]) — return 1-based position of matching
  // element, or 0 if not found.  Standard MUSH semantics.
  match: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [list, pattern, delim = " "] = (args as string[]).map(s => s.trim());
      if (!list) return "0";
      const elements = list.split(delim);
      const re = new RegExp(
        "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i",
      );
      const idx = elements.findIndex(e => re.test(e));
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  // isnum(x) — "1" if x is a valid finite number, "0" otherwise.
  isnum: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = ((args as string[])[0] ?? "").trim();
      if (s === "") return "0";
      return isFinite(Number(s)) ? "1" : "0";
    },
  },

  // div(a, b) — integer division (floor toward zero, TinyMUX semantics).
  div: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = (args as string[]).map(s => Number(s.trim()));
      if (b === 0) return "#-1 DIVISION BY ZERO";
      return String(Math.trunc(a / b));
    },
  },

  // repeat(str, n) — repeat string n times.
  repeat: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, nStr] = args as string[];
      const n = Math.max(0, Math.floor(Number(nStr.trim())));
      return str.repeat(n);
    },
  },

  // strlen(str) — length of string.
  strlen: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(((args as string[])[0] ?? "").length); },
  },

  // extract(list, first, len[, delim]) — extract len elements from position first.
  extract: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [list, firstStr, lenStr, delim = ":"] = args as string[];
      const elements = list.split(delim.trim() || ":");
      const first    = Math.max(1, parseInt(firstStr.trim()));
      const len      = parseInt(lenStr.trim());
      return elements.slice(first - 1, first - 1 + len).join(delim.trim() || ":");
    },
  },

  // v(attrname) — read a named attribute from the current executor.
  // Equivalent to get(executor/attr) but used throughout MIAM via v(D_CFG) etc.
  v: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const attr = ((args as string[])[0] ?? "").toUpperCase();
      return (await engine.accessor.getAttr(ctx.executor, attr)) ?? "";
    },
  },

  // default(obj/attr, fallback) — returns attr value when set and non-empty,
  // otherwise returns fallback.
  default: {
    minArgs: 2, maxArgs: Infinity,
    async exec(args, ctx, engine) {
      const a = args as string[];
      const slash = a[0].indexOf("/");
      if (slash === -1) {
        // default(attr, fallback) — read from executor
        const val = await engine.accessor.getAttr(ctx.executor, a[0].toUpperCase());
        return (val !== null && val !== "") ? val : (a[1] ?? "");
      }
      const objExpr  = a[0].slice(0, slash);
      const attrName = a[0].slice(slash + 1);
      const objId    = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return a[1] ?? "";
      const val = await engine.accessor.getAttr(objId, attrName.toUpperCase());
      return (val !== null && val !== "") ? val : (a[1] ?? "");
    },
  },

  // mod(a, b) — alias for the softcode modulo operation (TinyMUX name).
  // The rhost plugin registers this as modulo(); add mod() as well.
  mod: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = (args as string[]).map(Number);
      if (b === 0) return "#-1 DIVISION BY ZERO";
      return String(a % b);
    },
  },

  // grab(list, pattern, delim?) — return first element of list matching glob.
  // Standard MUSH function used in GFN_TZ for timezone lookup.
  grab: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [list, pattern, delim = " "] = args as string[];
      const elements = list.split(delim);
      const re = new RegExp(
        "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
        "i",
      );
      return elements.find(e => re.test(e)) ?? "";
    },
  },

  // num(obj) — return the dbref of a named object (used in MIAM STARTUP).
  // In the engine, resolveTarget("name") returns the dbref.
  num: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const expr = (args as string[])[0];
      const id   = await engine.accessor.resolveTarget(ctx.enactor, expr);
      return id ?? "#-1";
    },
  },

  // isdbref(str) — "1" if str looks like a valid dbref (#N where N >= 0), else "0".
  isdbref: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return /^#\d+$/.test(((args as string[])[0] ?? "").trim()) ? "1" : "0";
    },
  },

  // search(name=X) — simple name search returning a dbref or "#-1 NOT FOUND".
  // In tests this is a stub that checks the enactor's MemoryStore.
  search: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const query = ((args as string[])[0] ?? "").trim();
      const nameMatch = query.match(/^name=(.+)$/i);
      if (!nameMatch) return "#-1 NOT FOUND";
      const id = await engine.accessor.resolveTarget(ctx.enactor, nameMatch[1]);
      return id ?? "#-1 NOT FOUND";
    },
  },

  // searchng(type=X, name=X) — RhostMUSH-native search.  Same semantics as
  // the stub above for name= queries.
  searchng: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const query = ((args as string[])[0] ?? "").trim();
      const nameMatch = query.match(/^(?:object|name)=(.+)$/i);
      if (!nameMatch) return "#-1 NOT FOUND";
      const id = await engine.accessor.resolveTarget(ctx.enactor, nameMatch[1]);
      return id ?? "#-1 NOT FOUND";
    },
  },

  // t(x) — truth test: "1" if x is truthy (non-empty, non-zero, non-error).
  t: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = ((args as string[])[0] ?? "").trim();
      if (s === "" || s === "0" || s.startsWith("#-")) return "0";
      return "1";
    },
  },
};

// ── TestWorld ─────────────────────────────────────────────────────────────────

/**
 * An in-process MUSH world for unit-testing softcode without a live server.
 *
 * Creates a `MemoryStore` + `EvalEngine` wired with the full RhostMUSH plugin,
 * the standard library, and additional supplement functions required by
 * MIAM-style softcode.
 *
 * @example
 * ```ts
 * const w = new TestWorld();
 * const cfg = w.createObject("MIAM Config <cfg>", "thing");
 * w.setAttr(cfg, "WHO_WIDTH", "79");
 * expect(await w.eval(`[get(${cfg}/WHO_WIDTH)]`)).toEqual("79");
 * ```
 */
export class TestWorld {
  readonly store:  MemoryStore;
  readonly engine: EvalEngine;

  constructor(config?: MemoryStoreConfig) {
    this.store  = new MemoryStore(config);
    this.engine = new EvalEngine(this.store);
    registerStdlib(this.engine);
    this.engine.use(createRhostPlugin(this.store));
    // Register MIAM-required supplements
    for (const [name, impl] of Object.entries(SUPPLEMENT_FUNCTIONS)) {
      this.engine.registerFunction(name, impl);
    }
  }

  // ── Object manipulation ───────────────────────────────────────────────────

  /**
   * Create a new object and return its dbref.
   *
   * @example
   * const cfg = world.createObject("MIAM Config <cfg>", "thing");
   */
  createObject(
    name: string,
    type: MemObjectInit["type"] = "thing",
    location?: string,
  ): string {
    return this.store.createObject({ name, type, location });
  }

  /** Set an attribute on an object.  Attr names are case-insensitive. */
  setAttr(dbref: string, attr: string, value: string): void {
    this.store.setAttr(dbref, attr, value);
  }

  /** Read an attribute from an object.  Returns `null` when absent. */
  getAttr(dbref: string, attr: string): Promise<string | null> {
    return this.store.getAttr(dbref, attr);
  }

  /** Add a flag to an object (lowercase). */
  addFlag(dbref: string, flag: string): void {
    this.store.addFlag(dbref, flag);
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  /**
   * Evaluate a softcode string.  `enactor` defaults to a fresh player object.
   */
  async eval(
    softcode: string,
    enactor?: string,
    executor?: string,
  ): Promise<string> {
    const id = enactor ?? this.store.createObject({ name: "Tester", type: "player" });
    const ex = executor ?? id;
    return this.engine.evalString(
      softcode,
      makeContext({ enactor: id, executor: ex }),
    );
  }

  /**
   * Evaluate a softcode string with explicit enactor AND executor.
   * Use this when the softcode uses `v()` to read from a specific object.
   */
  async evalAs(
    softcode: string,
    enactor: string,
    executor: string,
    args: string[] = [],
  ): Promise<string> {
    return this.engine.evalString(
      softcode,
      makeContext({ enactor, executor, args }),
    );
  }

  /**
   * Call `u(dbref/attr, ...args)` and return the result.
   * Inside the UDF, `%!` (executor) is set to `dbref` and `v()` reads from it.
   */
  async evalAttr(
    dbref: string,
    attr: string,
    args: string[] = [],
    enactor?: string,
  ): Promise<string> {
    const actor = enactor ?? this.store.createObject({ name: "Tester", type: "player" });
    const argStr = args.length ? "," + args.join(",") : "";
    return this.engine.evalString(
      `[u(${dbref}/${attr}${argStr})]`,
      makeContext({ enactor: actor, executor: actor }),
    );
  }

  /**
   * Store a softcode string as an attribute (trimmed).
   * Use this to install UDF bodies before calling `evalAttr`.
   */
  loadAttr(dbref: string, attr: string, softcode: string): void {
    this.store.setAttr(dbref, attr, softcode.trim());
  }
}

// ── Assertion builder ─────────────────────────────────────────────────────────

interface Matchers {
  /** Strict string equality. */
  toEqual(expected: string): void;
  /** Substring containment. */
  toContain(substring: string): void;
  /** Regular-expression match. */
  toMatch(pattern: RegExp): void;
  /** Value starts with `"#-"` (MUSH error). */
  toBeError(): void;
  /** Value is non-empty, non-zero, and not a MUSH error. */
  toBeTruthy(): void;
  /** Negation namespace. */
  not: {
    toEqual(expected: string): void;
    toContain(substring: string): void;
    toBeError(): void;
  };
}

/**
 * Fluent assertion wrapper around a softcode result string.
 *
 * @example
 * ```ts
 * expect(await world.eval("[add(2,3)]")).toEqual("5");
 * expect(await world.eval("[add(2,3)]")).not.toEqual("6");
 * expect(await world.eval("[u(#99/MISSING)]")).toBeError();
 * ```
 */
export function expect(actual: string): Matchers {
  return {
    toEqual(expected: string) {
      assertEquals(actual, expected);
    },
    toContain(substring: string) {
      assertStringIncludes(actual, substring);
    },
    toMatch(pattern: RegExp) {
      if (!pattern.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${pattern}`);
      }
    },
    toBeError() {
      if (!actual.startsWith("#-")) {
        throw new Error(`Expected a MUSH error (#-N …) but got: "${actual}"`);
      }
    },
    toBeTruthy() {
      if (actual === "" || actual === "0" || actual.startsWith("#-")) {
        throw new Error(`Expected a truthy value but got: "${actual}"`);
      }
    },
    not: {
      toEqual(expected: string) {
        if (actual === expected) {
          throw new Error(`Expected values to differ, both are: "${actual}"`);
        }
      },
      toContain(substring: string) {
        if (actual.includes(substring)) {
          throw new Error(`Expected "${actual}" NOT to contain "${substring}"`);
        }
      },
      toBeError() {
        if (actual.startsWith("#-")) {
          throw new Error(`Expected a non-error value but got: "${actual}"`);
        }
      },
    },
  };
}

// ── MIAM world factory ────────────────────────────────────────────────────────

/**
 * Create a `TestWorld` pre-wired with the minimal MIAM object graph:
 * Config, Core, Globals, CharGen, Commands, Staff — each with the object
 * reference attributes (`D_CFG`, `D_CORE`, …) pointing at the right dbrefs.
 *
 * Returns the world plus a map of object names → dbrefs.
 *
 * Use this as the base fixture for MIAM-level integration tests.
 *
 * @example
 * ```ts
 * const { world, objs } = buildMiamWorld();
 * world.setAttr(objs.cfg, "WHO_WIDTH", "79");
 * // Now any UDF that calls v(D_CFG) from the Core object can read it:
 * expect(await world.evalAttr(objs.core, "GFN_ISWIZ", [objs.god])).toEqual("1");
 * ```
 */
export function buildMiamWorld(): {
  world: TestWorld;
  objs: Record<string, string>;
} {
  const world = new TestWorld();
  const objs: Record<string, string> = {};

  objs.god  = "#1";   // pre-seeded God player
  objs.cfg  = world.createObject("MIAM Config <cfg>",   "thing");
  objs.core = world.createObject("MIAM Core <core>",    "thing");
  objs.glob = world.createObject("MIAM Globals <glob>", "thing");
  objs.cg   = world.createObject("MIAM CharGen <cg>",   "thing");
  objs.cmd  = world.createObject("MIAM Commands <cmd>", "thing");
  objs.stf  = world.createObject("MIAM Staff <stf>",    "thing");

  // Wire cross-object references on the Core object (matches STARTUP)
  world.setAttr(objs.core, "D_CFG",  objs.cfg);
  world.setAttr(objs.core, "D_CORE", objs.core);
  world.setAttr(objs.core, "D_GLOB", objs.glob);
  world.setAttr(objs.core, "D_CG",   objs.cg);
  world.setAttr(objs.core, "D_CMD",  objs.cmd);
  world.setAttr(objs.core, "D_STF",  objs.stf);

  return { world, objs };
}
