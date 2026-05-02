import type { EvalThunk, FunctionImpl, IterFrame } from "../context.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitDelim(str: string, delim: string): string[] {
  if (!str) return [];
  return delim === " "
    ? str.trim().split(/\s+/).filter(Boolean)
    : str.split(delim);
}

function joinDelim(items: string[], outDelim: string): string {
  return items.join(outDelim);
}

/** TinyMUX wildcard matching: * = any chars, ? = one char, [abc] = char class. */
function wildcardMatch(pattern: string, str: string): boolean {
  // Convert TinyMUX wildcard to RegExp
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      re += ".*";
    } else if (c === "?") {
      re += ".";
    } else if (c === "[") {
      // pass through character class
      const end = pattern.indexOf("]", i);
      if (end === -1) {
        re += "\\[";
      } else {
        re += pattern.slice(i, end + 1);
        i = end;
      }
    } else {
      re += c.replace(/[.+^${}()|\\]/g, "\\$&");
    }
  }
  re += "$";
  return new RegExp(re, "i").test(str);
}

// ── List functions ────────────────────────────────────────────────────────────

export const listFunctions: Record<string, FunctionImpl> = {
  /** revwords(list[, delim]) — reverse word order. */
  revwords: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      return joinDelim(items.reverse(), delim === " " ? " " : delim);
    },
  },

  /**
   * sort(list[, type][, delim][, outDelim])
   * type: "a" = alpha (default), "n" = numeric, "i" = case-insensitive alpha
   */
  sort: {
    minArgs: 1, maxArgs: 4,
    exec(args) {
      const [str, type = "a", delim = " ", outDelim] = args as string[];
      const items = splitDelim(str, delim);
      const od = outDelim ?? (delim === " " ? " " : delim);
      const t = type.toLowerCase();

      if (t === "n") {
        items.sort((a, b) => parseFloat(a) - parseFloat(b));
      } else if (t === "i") {
        items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      } else {
        items.sort((a, b) => a.localeCompare(b));
      }
      return joinDelim(items, od);
    },
  },

  /** lsort — alias for sort. */
  lsort: {
    minArgs: 1, maxArgs: 4,
    exec(args) {
      const [str, type = "a", delim = " ", outDelim] = args as string[];
      const items = splitDelim(str, delim);
      const od = outDelim ?? (delim === " " ? " " : delim);
      const t = type.toLowerCase();

      if (t === "n") {
        items.sort((a, b) => parseFloat(a) - parseFloat(b));
      } else if (t === "i") {
        items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      } else {
        items.sort((a, b) => a.localeCompare(b));
      }
      return joinDelim(items, od);
    },
  },

  /** sortby(list, attr[, delim]) — stub (requires db accessor). */
  sortby: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, , delim = " "] = args as string[];
      // Without db accessor, return list unchanged
      return splitDelim(str, delim).join(delim === " " ? " " : delim);
    },
  },

  /** unique(list[, delim]) — remove duplicates, preserve order. */
  unique: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const seen = new Set<string>();
      const result: string[] = [];
      for (const item of items) {
        const k = item.toLowerCase();
        if (!seen.has(k)) { seen.add(k); result.push(item); }
      }
      return joinDelim(result, delim === " " ? " " : delim);
    },
  },

  /** shuffle(list[, delim]) — random reorder. */
  shuffle: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return joinDelim(items, delim === " " ? " " : delim);
    },
  },

  /** extract(list, start, len[, delim][, outDelim]) — slice list (1-based). */
  extract: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [str, startStr, lenStr, delim = " ", outDelim] = args as string[];
      const start = parseInt(startStr, 10);
      const len   = parseInt(lenStr,   10);
      if (isNaN(start) || isNaN(len)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const od    = outDelim ?? (delim === " " ? " " : delim);
      const items = splitDelim(str, delim);
      const slice = items.slice(start - 1, start - 1 + Math.max(0, len));
      return joinDelim(slice, od);
    },
  },

  /** ldelete(list, pos[, delim][, outDelim]) — delete item at 1-based position. */
  ldelete: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [str, posStr, delim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const od    = outDelim ?? (delim === " " ? " " : delim);
      const items = splitDelim(str, delim);
      if (pos < 1 || pos > items.length) return joinDelim(items, od);
      items.splice(pos - 1, 1);
      return joinDelim(items, od);
    },
  },

  /** replace(list, pos, new[, delim][, outDelim]) — replace item at position. */
  replace: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [str, posStr, newItem, delim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const od    = outDelim ?? (delim === " " ? " " : delim);
      const items = splitDelim(str, delim);
      if (pos >= 1 && pos <= items.length) items[pos - 1] = newItem;
      return joinDelim(items, od);
    },
  },

  /** insert(list, pos, new[, delim][, outDelim]) — insert before position. */
  insert: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [str, posStr, newItem, delim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const od    = outDelim ?? (delim === " " ? " " : delim);
      const items = splitDelim(str, delim);
      const idx = Math.max(0, Math.min(pos - 1, items.length));
      items.splice(idx, 0, newItem);
      return joinDelim(items, od);
    },
  },

  /** grab(list, pattern[, delim]) — return first matching word. */
  grab: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      return items.find(w => wildcardMatch(pattern, w)) ?? "";
    },
  },

  /** graball(list, pattern[, delim]) — return all matching words. */
  graball: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const matched = items.filter(w => wildcardMatch(pattern, w));
      return joinDelim(matched, delim === " " ? " " : delim);
    },
  },

  /** member(list, word[, delim]) — 1-based position of exact match (case-insensitive), or 0. */
  member: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, word, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const idx = items.findIndex(w => w.toLowerCase() === word.toLowerCase());
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  /** lpos — alias for member. */
  lpos: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, word, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const idx = items.findIndex(w => w.toLowerCase() === word.toLowerCase());
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  /** match(list, pattern[, delim]) — 1-based position of first wildcard match, or 0. */
  match: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const idx = items.findIndex(w => wildcardMatch(pattern, w));
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  /** matchall(list, pattern[, delim]) — space-separated positions of all matches. */
  matchall: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      const positions: string[] = [];
      items.forEach((w, i) => {
        if (wildcardMatch(pattern, w)) positions.push(String(i + 1));
      });
      return positions.join(" ");
    },
  },

  /** fold(list, fn[, base][, delim]) — lazy fold/reduce. */
  fold: {
    eval: "lazy",
    minArgs: 2, maxArgs: 4,
    async exec(args, ctx) {
      const thunks = args as EvalThunk[];
      const list   = await thunks[0]();
      const fn     = thunks[1];

      let base: string | undefined;
      let delim = " ";

      if (thunks.length >= 3) {
        const third = await thunks[2]();
        // Heuristic: if 4 args, third is base and fourth is delim
        if (thunks.length === 4) {
          base  = third;
          delim = (await thunks[3]()) || " ";
        } else {
          // 3 args: could be base or delim (single char = likely delim)
          base  = third;
        }
      }

      const items = splitDelim(list, delim);
      if (items.length === 0) return base ?? "";

      let acc = base !== undefined ? base : items[0];
      const start = base !== undefined ? 0 : 1;

      for (let i = start; i < items.length; i++) {
        const frame: IterFrame = { item: items[i], index: i + 1 };
        acc = await fn({ iterStack: [frame, ...ctx.iterStack], args: [acc, items[i]] });
      }
      return acc;
    },
  },

  /** munge(list1, list2, fn[, delim]) — lazy; pairs items from both lists then sorts by fn result. */
  munge: {
    eval: "lazy",
    minArgs: 3, maxArgs: 4,
    async exec(args, ctx) {
      const thunks = args as EvalThunk[];
      const list1  = await thunks[0]();
      const list2  = await thunks[1]();
      const fn     = thunks[2];
      const delim  = thunks[3] ? ((await thunks[3]()) || " ") : " ";

      const items1 = splitDelim(list1, delim);
      const items2 = splitDelim(list2, delim);
      const len = Math.min(items1.length, items2.length);

      const pairs: Array<{ a: string; b: string; key: string }> = [];
      for (let i = 0; i < len; i++) {
        const frame: IterFrame = { item: items1[i], index: i + 1 };
        const key = await fn({ iterStack: [frame, ...ctx.iterStack], args: [items1[i], items2[i]] });
        pairs.push({ a: items1[i], b: items2[i], key });
      }
      pairs.sort((x, y) => x.key.localeCompare(y.key));
      return pairs.map(p => p.a).join(delim === " " ? " " : delim);
    },
  },
};
