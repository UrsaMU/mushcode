import type { EvalContext, FunctionImpl, ObjectAccessor } from "../context.ts";
import { childShared, childIsolated } from "../context.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Split "obj/attr" → [objExpr, attrName].  Returns null if no "/" found. */
function splitObjAttr(s: string): [string, string] | null {
  const slash = s.indexOf("/");
  return slash === -1 ? null : [s.slice(0, slash), s.slice(slash + 1)];
}

// ── DB-backed functions ───────────────────────────────────────────────────────

export const dbFunctions: Record<string, FunctionImpl> = {
  /**
   * get(obj/attr) — read the named attribute from a target object.
   * Returns "" if the attribute is unset.
   */
  get: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const pair = splitObjAttr((args as string[])[0]);
      if (!pair) return "#-1 BAD ARGUMENT FORMAT";
      const [objExpr, attrName] = pair;
      const objId = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return "#-1 NO MATCH";
      return (await engine.accessor.getAttr(objId, attrName.toUpperCase())) ?? "";
    },
  },

  /** name(obj) — return the display name of a target object. */
  name: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const objId = await engine.accessor.resolveTarget(ctx.enactor, (args as string[])[0]);
      if (!objId) return "#-1 NO MATCH";
      return engine.accessor.getName(objId);
    },
  },

  /** hasattr(obj, attr) — "1" if the attribute exists on obj, "0" if not. */
  hasattr: {
    minArgs: 2, maxArgs: 2,
    async exec(args, ctx, engine) {
      const [objExpr, attrName] = args as string[];
      const objId = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return "0";
      const val = await engine.accessor.getAttr(objId, attrName.toUpperCase());
      return val !== null ? "1" : "0";
    },
  },

  /** hasflag(obj, flag) — "1" if obj has the flag, "0" if not. */
  hasflag: {
    minArgs: 2, maxArgs: 2,
    async exec(args, ctx, engine) {
      const [objExpr, flag] = args as string[];
      const objId = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return "0";
      return (await engine.accessor.hasFlag(objId, flag)) ? "1" : "0";
    },
  },

  /**
   * u(obj/attr[, arg0, arg1, …]) — evaluate the named attribute as a function.
   *
   * The attribute value is evaluated as softcode in a child context where:
   *   %0–%9  ← the extra arguments passed to u()
   *   %!     ← the object that owns the attribute (new executor)
   *   %@     ← the previous executor (caller)
   *   %#     ← unchanged (original enactor)
   *   depth  ← incremented by 1 (returns #-1 if maxDepth exceeded)
   *
   * When "obj/" is omitted, the executor is used as the target object.
   */
  /**
   * u(obj/attr[, arg0, arg1, …]) — evaluate an attribute as a function.
   *
   * The child frame **shares** the parent's q-register map, so setq() calls
   * inside the attribute are visible to the caller after u() returns.
   */
  u: {
    minArgs: 1, maxArgs: Infinity,
    async exec(args, ctx, engine) {
      const [target, ...argVals] = args as string[];

      const pair    = splitObjAttr(target);
      const objId   = pair
        ? await engine.accessor.resolveTarget(ctx.enactor, pair[0])
        : ctx.executor;
      const attrName = pair ? pair[1] : target;

      if (!objId) return "#-1 NO MATCH";

      const attrVal = await engine.accessor.getAttr(objId, attrName.toUpperCase());
      if (attrVal === null) return "#-1 NO SUCH ATTRIBUTE";

      // TinyMUX u(): fresh register context — caller's registers not visible,
      // setq() inside does not propagate back to caller.
      const subCtx = childIsolated(ctx, {
        executor:  objId,
        caller:    ctx.executor,
        args:      argVals,
        registers: new Map(),
      });

      return engine.evalString(attrVal, subCtx);
    },
  },

  /**
   * ulocal(obj/attr[, arg0, arg1, …]) — like u() but inherits AND shares back
   * the parent's register map.  setq() inside is visible to the caller.
   * Use when a UDF needs to communicate results via q-registers.
   */
  ulocal: {
    minArgs: 1, maxArgs: Infinity,
    async exec(args, ctx, engine) {
      const [target, ...argVals] = args as string[];

      const pair    = splitObjAttr(target);
      const objId   = pair
        ? await engine.accessor.resolveTarget(ctx.enactor, pair[0])
        : ctx.executor;
      const attrName = pair ? pair[1] : target;

      if (!objId) return "#-1 NO MATCH";

      const attrVal = await engine.accessor.getAttr(objId, attrName.toUpperCase());
      if (attrVal === null) return "#-1 NO SUCH ATTRIBUTE";

      // ulocal(): shares parent register map — mutations propagate back.
      const subCtx = childShared(ctx, {
        executor: objId,
        caller:   ctx.executor,
        args:     argVals,
      });

      return engine.evalString(attrVal, subCtx);
    },
  },

  /** v(attr) — read attribute from the executor (shorthand for get(%!/attr)). */
  v: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const attr = (args as string[])[0];
      return (await engine.accessor.getAttr(ctx.executor, attr.toUpperCase())) ?? "";
    },
  },

  /** isnum(string) — "1" if valid number, "0" otherwise. */
  isnum: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = (args as string[])[0].trim();
      return (s !== "" && isFinite(Number(s))) ? "1" : "0";
    },
  },

  /** isdbref(string) — "1" if matches #N where N is non-negative integer. */
  isdbref: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return /^#\d+$/.test((args as string[])[0]) ? "1" : "0";
    },
  },

  /** null(args...) — evaluates all args, returns "". */
  null: {
    minArgs: 0, maxArgs: Infinity,
    exec() { return ""; },
  },

  /** noop(args...) — alias for null. */
  noop: {
    minArgs: 0, maxArgs: Infinity,
    exec() { return ""; },
  },

  /** pmatch(name) — partial player name match. */
  pmatch: {
    minArgs: 1, maxArgs: 1,
    async exec(args, _ctx, engine) {
      const partial = (args as string[])[0];
      const acc = engine.accessor as ObjectAccessor;
      if (!acc.findPlayer) return "#-1 NO MATCH";
      const result = await acc.findPlayer(partial);
      if (!result) return "#-1 NO MATCH";
      return result;
    },
  },

  /** loc(object) — return location dbref. */
  loc: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const acc = engine.accessor as ObjectAccessor;
      if (!acc.getLocation) return "#-1 FUNCTION (LOC) REQUIRES OBJECT ACCESSOR";
      const objId = await engine.accessor.resolveTarget(ctx.enactor, (args as string[])[0]);
      if (!objId) return "#-1 NO MATCH";
      return await acc.getLocation(objId);
    },
  },

  /** lcon(object[, type]) — return space-separated list of contents. */
  lcon: {
    minArgs: 1, maxArgs: 2,
    async exec(args, ctx, engine) {
      const acc = engine.accessor as ObjectAccessor;
      if (!acc.getContents) return "#-1 FUNCTION (LCON) REQUIRES OBJECT ACCESSOR";
      const [objExpr, type] = args as string[];
      const objId = await engine.accessor.resolveTarget(ctx.enactor, objExpr);
      if (!objId) return "#-1 NO MATCH";
      const contents = await acc.getContents(objId, type?.toUpperCase());
      return contents.join(" ");
    },
  },

  /** lwho() — return space-separated list of connected player dbrefs. */
  lwho: {
    minArgs: 0, maxArgs: 1,
    async exec(_args, _ctx, engine) {
      const acc = engine.accessor as ObjectAccessor;
      if (!acc.getConnectedPlayers) return "#-1 FUNCTION (LWHO) REQUIRES OBJECT ACCESSOR";
      const players = await acc.getConnectedPlayers();
      return players.join(" ");
    },
  },

  /** lparent(object) — return space-separated parent chain. */
  lparent: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx, engine) {
      const acc = engine.accessor as ObjectAccessor;
      if (!acc.getParentChain) return "#-1 FUNCTION (LPARENT) REQUIRES OBJECT ACCESSOR";
      const objId = await engine.accessor.resolveTarget(ctx.enactor, (args as string[])[0]);
      if (!objId) return "#-1 NO MATCH";
      const chain = await acc.getParentChain(objId);
      return chain.join(" ");
    },
  },

  /** ansi(code, text[, code, text...]) — wrap text in ANSI formatting codes. */
  ansi: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      const strs = args as string[];
      if (strs.length % 2 !== 0) strs.push("");
      let result = "";
      for (let i = 0; i < strs.length; i += 2) {
        const code = strs[i].toLowerCase();
        const text = strs[i + 1];
        result += `%c${code}${text}%cn`;
      }
      return result;
    },
  },
};
