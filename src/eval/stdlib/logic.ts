import type { EvalContext, EvalThunk, FunctionImpl } from "../context.ts";

/** MUX truthiness: empty string and "0" are false; everything else is true. */
function truthy(s: string): boolean {
  return s !== "" && s !== "0";
}

/**
 * Convert a MUX wildcard pattern (*, ?, [abc]) to a RegExp anchored at both ends.
 * Special regex chars are escaped; * → .*, ? → ., [abc] kept verbatim.
 */
function wildcardToRegex(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*") {
      re += ".*";
    } else if (ch === "?") {
      re += ".";
    } else if (ch === "[") {
      // pass through character class verbatim
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) {
        re += "\\[";
      } else {
        re += pattern.slice(i, end + 1);
        i = end;
      }
    } else {
      re += ch.replace(/[.+^${}()|\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`, "i");
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
   * Evaluate condition/value pairs; return value of first truthy condition.
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

  // ── case / caseall / switchall ───────────────────────────────────────────────

  /**
   * case(val, pattern1, result1[, …[, default]])
   * Wildcard-match comparison; returns first matching result or default.
   */
  "case": {
    eval: "lazy",
    minArgs: 3, maxArgs: Infinity,
    async exec(args) {
      const thunks     = args as EvalThunk[];
      const value      = await thunks[0]();
      const rest       = thunks.slice(1);
      const hasDefault = rest.length % 2 === 1;
      const pairs      = hasDefault ? rest.slice(0, -1) : rest;

      for (let i = 0; i < pairs.length; i += 2) {
        const pat = await pairs[i]();
        if (wildcardToRegex(pat).test(value)) return await pairs[i + 1]();
      }
      return hasDefault ? await rest[rest.length - 1]() : "";
    },
  },

  /**
   * caseall(val, pattern1, result1[, …[, default]])
   * Like case but evaluates ALL matching results and concatenates them.
   */
  caseall: {
    eval: "lazy",
    minArgs: 3, maxArgs: Infinity,
    async exec(args) {
      const thunks     = args as EvalThunk[];
      const value      = await thunks[0]();
      const rest       = thunks.slice(1);
      const hasDefault = rest.length % 2 === 1;
      const pairs      = hasDefault ? rest.slice(0, -1) : rest;

      const results: string[] = [];
      let matched = false;
      for (let i = 0; i < pairs.length; i += 2) {
        const pat = await pairs[i]();
        if (wildcardToRegex(pat).test(value)) {
          results.push(await pairs[i + 1]());
          matched = true;
        }
      }
      if (!matched && hasDefault) results.push(await rest[rest.length - 1]());
      return results.join("");
    },
  },

  /**
   * switchall(val, case1, result1[, …[, default]])
   * Like switch but evaluates ALL matching cases (exact equality) and concatenates results.
   */
  switchall: {
    eval: "lazy",
    minArgs: 3, maxArgs: Infinity,
    async exec(args) {
      const thunks     = args as EvalThunk[];
      const value      = await thunks[0]();
      const rest       = thunks.slice(1);
      const hasDefault = rest.length % 2 === 1;
      const pairs      = hasDefault ? rest.slice(0, -1) : rest;

      const results: string[] = [];
      let matched = false;
      for (let i = 0; i < pairs.length; i += 2) {
        if (value === await pairs[i]()) {
          results.push(await pairs[i + 1]());
          matched = true;
        }
      }
      if (!matched && hasDefault) results.push(await rest[rest.length - 1]());
      return results.join("");
    },
  },

  // ── allof / firstof ──────────────────────────────────────────────────────────

  /** allof(v1, v2, …) — evaluate ALL args, return last value. */
  allof: {
    eval: "lazy",
    minArgs: 1, maxArgs: Infinity,
    async exec(args) {
      const thunks = args as EvalThunk[];
      let last = "";
      for (const thunk of thunks) last = await thunk();
      return last;
    },
  },

  /** firstof(v1, v2, …) — return first non-empty arg (short-circuit). */
  firstof: {
    eval: "lazy",
    minArgs: 1, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        const v = await thunk();
        if (v !== "") return v;
      }
      return "";
    },
  },

  // ── cand / cor and bool aliases ──────────────────────────────────────────────

  /** cand(v1, v2, …) — short-circuit AND; returns "1"/"0". */
  cand: {
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
   * cor(v1, v2, …) — short-circuit OR.
   * Returns the first truthy value, or "0" if none are truthy.
   */
  cor: {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        const v = await thunk();
        if (truthy(v)) return v;
      }
      return "0";
    },
  },

  /** andbool — alias of and (bool coercion; same behavior). */
  andbool: {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        if (!truthy(await thunk())) return "0";
      }
      return "1";
    },
  },

  /** orbool — alias of or (bool coercion; same behavior). */
  orbool: {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        if (truthy(await thunk())) return "1";
      }
      return "0";
    },
  },

  /** candbool — alias of cand. */
  candbool: {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        if (!truthy(await thunk())) return "0";
      }
      return "1";
    },
  },

  /** corbool — alias of cor. */
  corbool: {
    eval: "lazy",
    minArgs: 2, maxArgs: Infinity,
    async exec(args) {
      for (const thunk of args as EvalThunk[]) {
        const v = await thunk();
        if (truthy(v)) return v;
      }
      return "0";
    },
  },

  // ── while ────────────────────────────────────────────────────────────────────

  /**
   * while(cond, body, iter_expr[, max_iterations])
   * Loop while cond is truthy, accumulating body output.
   */
  "while": {
    eval: "lazy",
    minArgs: 3, maxArgs: 4,
    async exec(args) {
      const thunks      = args as EvalThunk[];
      const [cond, body, iterExpr, maxThunk] = thunks;
      const maxIter = maxThunk ? parseInt(await maxThunk(), 10) : 1000;
      const cap = isNaN(maxIter) || maxIter < 0 ? 1000 : maxIter;

      const results: string[] = [];
      let count = 0;
      while (truthy(await cond()) && count < cap) {
        results.push(await body());
        await iterExpr();
        count++;
      }
      return results.join("");
    },
  },

  // ── localize ─────────────────────────────────────────────────────────────────

  /**
   * localize(expr) — evaluate expr with an isolated copy of Q-registers.
   * Changes inside do not propagate back to the caller.
   */
  localize: {
    eval: "lazy",
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx) {
      const [thunk] = args as EvalThunk[];
      // Pass a copy of registers so inner changes don't affect outer context
      return await thunk({ registers: new Map(ctx.registers) });
    },
  },

  // ── letq ─────────────────────────────────────────────────────────────────────

  /**
   * letq(reg1, val1[, reg2, val2, ...], body)
   * Bind registers temporarily, evaluate body, then restore originals.
   * Args: must be odd number (pairs + body), minimum 3.
   */
  letq: {
    eval: "lazy",
    minArgs: 3, maxArgs: Infinity,
    async exec(args, ctx) {
      const thunks = args as EvalThunk[];
      if (thunks.length % 2 === 0) return "#-1 WRONG NUMBER OF ARGUMENTS";

      const bodyThunk = thunks[thunks.length - 1];
      const pairs     = thunks.slice(0, -1);

      // Save original values and apply new bindings
      const saved = new Map<string, string | undefined>();
      for (let i = 0; i < pairs.length; i += 2) {
        const reg = await pairs[i]();
        const val = await pairs[i + 1]();
        saved.set(reg, ctx.registers.get(reg));
        ctx.registers.set(reg, val);
      }

      let result: string;
      try {
        result = await bodyThunk();
      } finally {
        // Restore original values
        for (const [reg, origVal] of saved) {
          if (origVal === undefined) ctx.registers.delete(reg);
          else ctx.registers.set(reg, origVal);
        }
      }
      return result;
    },
  },
};
