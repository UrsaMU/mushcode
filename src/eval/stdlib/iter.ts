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

/** TinyMUX truthiness: non-empty, non-"0", non-"#-1" strings. */
function isTruthy(s: string): boolean {
  return s !== "" && s !== "0" && !s.startsWith("#-1");
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
   * map(list, fn[, idelim[, odelim]])
   * Lazy. Evaluates fn for each item with ## bound to the item and #@ to its 1-based index.
   */
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

  /**
   * filter(list, fn[, idelim[, odelim]])
   * Lazy. Keeps items for which fn evaluates to truthy.
   */
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

  /**
   * ilist([start,] end[, step]) — generate integer list.
   * 1 arg: ilist(5) → "1 2 3 4 5"
   * 2 args: ilist(3,7) → "3 4 5 6 7"
   * 3 args: ilist(1,10,3) → "1 4 7 10"
   */
  ilist: {
    minArgs: 1, maxArgs: 3,
    exec(args) {
      const strs = args as string[];
      let start: number, end: number, step: number;

      if (strs.length === 1) {
        start = 1;
        end   = parseInt(strs[0], 10);
        step  = 1;
      } else if (strs.length === 2) {
        start = parseInt(strs[0], 10);
        end   = parseInt(strs[1], 10);
        step  = 1;
      } else {
        start = parseInt(strs[0], 10);
        end   = parseInt(strs[1], 10);
        step  = parseInt(strs[2], 10);
      }

      if (!isFinite(start) || !isFinite(end) || !isFinite(step))
        return "#-1 ARGUMENT IS NOT A NUMBER";
      if (step <= 0)
        return "#-1 ARGUMENT OUT OF RANGE";

      const results: number[] = [];
      for (let n = start; n <= end; n += step) {
        results.push(n);
        if (results.length > 10000) return "#-1 ARGUMENT OUT OF RANGE";
      }
      return results.join(" ");
    },
  },
};
