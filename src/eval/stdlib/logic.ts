import type { EvalThunk, FunctionImpl } from "../context.ts";

/**
 * TinyMUX truthiness: a string is falsy only if it is "" or "0".
 * Error strings like "#-1" are truthy — they are non-empty and non-zero.
 */
function truthy(s: string): boolean {
  return s !== "" && s !== "0";
}

export const logicFunctions: Record<string, FunctionImpl> = {
  /** if(cond, iftrue[, iffalse]) */
  "if": {
    eval: "lazy",
    minArgs: 2, maxArgs: 3,
    async exec(args) {
      const [cond, yes, no] = args as EvalThunk[];
      return truthy(await cond()) ? await yes() : (no ? await no() : "");
    },
  },

  /** ifelse(cond, iftrue, iffalse) */
  ifelse: {
    eval: "lazy",
    minArgs: 3, maxArgs: 3,
    async exec(args) {
      const [cond, yes, no] = args as EvalThunk[];
      return truthy(await cond()) ? await yes() : await no();
    },
  },

  /**
   * switch(value, pattern1, result1[, …[, default]])
   * Exact-match comparison; returns first matching result or default.
   */
  "switch": {
    eval: "lazy",
    minArgs: 3, maxArgs: Infinity,
    async exec(args) {
      const thunks   = args as EvalThunk[];
      const value    = await thunks[0]();
      const rest     = thunks.slice(1);
      const hasDefault = rest.length % 2 === 1;
      const pairs    = hasDefault ? rest.slice(0, -1) : rest;

      for (let i = 0; i < pairs.length; i += 2) {
        if (value === await pairs[i]()) return await pairs[i + 1]();
      }
      return hasDefault ? await rest[rest.length - 1]() : "";
    },
  },

  /** and(v1, v2, …) — short-circuit, returns "1" or "0". */
  "and": {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        if (!truthy(await thunk())) return "0";
      }
      return "1";
    },
  },

  /**
   * or(v1, v2, …) — short-circuit.
   * Returns the first truthy value found, or "0" if none are truthy.
   */
  "or": {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        const val = await thunk();
        if (truthy(val)) return val;
      }
      return "0";
    },
  },

  /**
   * cond(cond1, val1[, cond2, val2, …[, default]])
   * Evaluate condition/value pairs in order; return the value of the first
   * truthy condition.  If none match and a default is present (odd number of
   * args), return the default; otherwise return "".
   */
  "cond": {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      const thunks = args as EvalThunk[];
      const hasDefault = thunks.length % 2 === 1;
      const pairs = hasDefault ? thunks.slice(0, -1) : thunks;
      for (let i = 0; i < pairs.length; i += 2) {
        if (truthy(await pairs[i]())) return await pairs[i + 1]();
      }
      return hasDefault ? await thunks[thunks.length - 1]() : "";
    },
  },

  not: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return truthy((args as string[])[0]) ? "0" : "1"; },
  },

  /** t(val) — returns "1" if val is truthy, "0" otherwise. */
  t: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return truthy((args as string[])[0]) ? "1" : "0"; },
  },
};
