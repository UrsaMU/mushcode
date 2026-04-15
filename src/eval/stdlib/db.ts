import type { EvalContext, FunctionImpl } from "../context.ts";

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
  u: {
    minArgs: 1, maxArgs: Infinity,
    async exec(args, ctx, engine) {
      const [target, ...argVals] = args as string[];

      // Resolve object and attribute name
      const pair = splitObjAttr(target);
      const objId   = pair
        ? await engine.accessor.resolveTarget(ctx.enactor, pair[0])
        : ctx.executor;
      const attrName = pair ? pair[1] : target;

      if (!objId) return "#-1 NO MATCH";

      const attrVal = await engine.accessor.getAttr(objId, attrName.toUpperCase());
      if (attrVal === null) return "#-1 NO SUCH ATTRIBUTE";

      const subCtx: EvalContext = {
        ...ctx,
        executor:  objId,
        caller:    ctx.executor,
        args:      argVals,
        registers: new Map(),
        depth:     ctx.depth + 1,
      };

      return engine.evalString(attrVal, subCtx);
    },
  },
};
