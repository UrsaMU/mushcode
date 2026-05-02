import type { EvalThunk, FunctionImpl, IterFrame } from "../context.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Split a string by delimiter.
 * Space delimiter collapses consecutive whitespace (MUX convention).
 */
function splitDelim(str: string, delim: string): string[] {
  if (!str) return [];
  return delim === " "
    ? str.trim().split(/\s+/).filter(Boolean)
    : str.split(delim);
}

function joinDelim(items: string[], delim: string): string {
  return items.join(delim);
}

function isTruthy(s: string): boolean {
  return s !== "" && s !== "0";
}

// ── Iter / list functions ─────────────────────────────────────────────────────

export const iterFunctions: Record<string, FunctionImpl> = {
  /**
   * iter(list, body[, idelim[, odelim]])
   * Evaluates body for each item, binding ## to the item and #@ to its 1-based index.
   */
  iter: {
    eval: "lazy",
    minArgs: 2, maxArgs: 4,
    async exec(args, ctx) {
      const thunks   = args as EvalThunk[];
      const list     = await thunks[0]();
      const body     = thunks[1];
      const inDelim  = thunks[2] ? ((await thunks[2]()) || " ") : " ";
      const outDelim = thunks[3] ? (await thunks[3]())          : " ";

      const items = splitDelim(list, inDelim);
      if (items.length === 0) return "";

      const results: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const frame: IterFrame = { item: items[i], index: i + 1 };
        results.push(await body({ iterStack: [frame, ...ctx.iterStack] }));
      }
      return joinDelim(results, outDelim);
    },
  },

  /** words(str[, delim]) — count words in a space- (or delim-) separated list. */
  words: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      return String(splitDelim(str, delim).length);
    },
  },

  /** word(str, n[, delim]) — return the nth word (1-based). */
  word: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, nStr, delim = " "] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n) || n < 1) throw new Error("ARGUMENT IS NOT A NUMBER");
      return splitDelim(str, delim)[n - 1] ?? "";
    },
  },

  /** first(str[, delim]) — return the first word. */
  first: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      return splitDelim(str, delim)[0] ?? "";
    },
  },

  /** last(str[, delim]) — return the last word. */
  last: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      return items[items.length - 1] ?? "";
    },
  },

  /** rest(str[, delim]) — return all words after the first. */
  rest: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      if (items.length <= 1) return "";
      return joinDelim(items.slice(1), delim === " " ? " " : delim);
    },
  },

  /**
   * foreach(str, fn [,start_delim] [,end_delim]) — LAZY
   * Apply fn to each CHARACTER of str, concatenate results.
   * ## is bound to the current character (TinyMUX semantics: iterates chars, not words).
   *
   * Note: start_delim / end_delim in TinyMUX are used to identify the
   * expression boundaries within fn, not input delimiters. We accept them
   * for compatibility but ignore them (our parser handles brackets natively).
   */
  foreach: {
    eval: "lazy",
    minArgs: 2, maxArgs: 4,
    async exec(args, ctx) {
      const thunks = args as EvalThunk[];
      const str    = await thunks[0]();
      const fn     = thunks[1];
      // thunks[2] and thunks[3] are start/end delimiters — accepted but unused
      if (!str) return "";
      const chars = [...str]; // unicode-safe split
      const results: string[] = [];
      for (let i = 0; i < chars.length; i++) {
        const frame: IterFrame = { item: chars[i], index: i + 1 };
        results.push(await fn({ iterStack: [frame, ...ctx.iterStack] }));
      }
      return results.join("");
    },
  },

  map: {
    eval: "lazy",
    minArgs: 2, maxArgs: 4,
    async exec(args, ctx) {
      const thunks   = args as EvalThunk[];
      const list     = await thunks[0]();
      const body     = thunks[1];
      const inDelim  = thunks[2] ? ((await thunks[2]()) || " ") : " ";
      const outDelim = thunks[3] ? (await thunks[3]())          : " ";
      const items = splitDelim(list, inDelim);
      if (items.length === 0) return "";
      const results: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const frame: IterFrame = { item: items[i], index: i + 1 };
        results.push(await body({ iterStack: [frame, ...ctx.iterStack] }));
      }
      return joinDelim(results, outDelim);
    },
  },

  filter: {
    eval: "lazy",
    minArgs: 2, maxArgs: 4,
    async exec(args, ctx) {
      const thunks   = args as EvalThunk[];
      const list     = await thunks[0]();
      const body     = thunks[1];
      const inDelim  = thunks[2] ? ((await thunks[2]()) || " ") : " ";
      const outDelim = thunks[3] ? (await thunks[3]())          : " ";
      const items = splitDelim(list, inDelim);
      if (items.length === 0) return "";
      const kept: string[] = [];
      for (let i = 0; i < items.length; i++) {
        const frame: IterFrame = { item: items[i], index: i + 1 };
        const result = await body({ iterStack: [frame, ...ctx.iterStack] });
        if (isTruthy(result)) kept.push(items[i]);
      }
      return joinDelim(kept, outDelim);
    },
  },
};
