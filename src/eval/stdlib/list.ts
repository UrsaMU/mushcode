import type { EvalThunk, FunctionImpl, IterFrame } from "../context.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function splitDelim(str: string, delim: string): string[] {
  if (!str) return [];
  return delim === " "
    ? str.trim().split(/\s+/).filter(Boolean)
    : str.split(delim);
}

function joinDelim(items: string[], delim: string): string {
  return items.join(delim);
}

function wildcardMatch(pattern: string, str: string): boolean {
  let re = "^";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") { re += ".*"; }
    else if (c === "?") { re += "."; }
    else if (c === "[") {
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) { re += "\\["; }
      else { re += pattern.slice(i, end + 1); i = end; }
    } else { re += c.replace(/[.+^${}()|\\]/g, "\\$&"); }
  }
  return new RegExp(`${re}$`, "i").test(str);
}

// ── List functions ────────────────────────────────────────────────────────────

export const listFunctions: Record<string, FunctionImpl> = {

  // ── ilist / lnum ────────────────────────────────────────────────────────────

  /**
   * ilist([start,] end [,step]) — generate a list of integers.
   * ilist(5)       → "1 2 3 4 5"
   * ilist(3,7)     → "3 4 5 6 7"
   * ilist(1,10,2)  → "1 3 5 7 9"
   */
  ilist: {
    minArgs: 1, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      let start: number, end: number, step: number;
      if (a.length === 1) {
        start = 1; end = parseInt(a[0], 10); step = 1;
      } else if (a.length === 2) {
        start = parseInt(a[0], 10); end = parseInt(a[1], 10); step = 1;
      } else {
        start = parseInt(a[0], 10); end = parseInt(a[1], 10); step = parseInt(a[2], 10);
      }
      if (isNaN(start) || isNaN(end) || isNaN(step)) return "#-1 ARGUMENT IS NOT A NUMBER";
      if (step === 0) return "#-1 ARGUMENT OUT OF RANGE";
      const result: string[] = [];
      if (step > 0) {
        for (let i = start; i <= end; i += step) result.push(String(i));
      } else {
        for (let i = start; i >= end; i += step) result.push(String(i));
      }
      return result.join(" ");
    },
  },

  /** lnum — TinyMUX alias for ilist */
  lnum: {
    minArgs: 1, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      let start: number, end: number, step: number;
      if (a.length === 1) {
        start = 1; end = parseInt(a[0], 10); step = 1;
      } else if (a.length === 2) {
        start = parseInt(a[0], 10); end = parseInt(a[1], 10); step = 1;
      } else {
        start = parseInt(a[0], 10); end = parseInt(a[1], 10); step = parseInt(a[2], 10);
      }
      if (isNaN(start) || isNaN(end) || isNaN(step)) return "#-1 ARGUMENT IS NOT A NUMBER";
      if (step === 0) return "#-1 ARGUMENT OUT OF RANGE";
      const result: string[] = [];
      if (step > 0) {
        for (let i = start; i <= end; i += step) result.push(String(i));
      } else {
        for (let i = start; i >= end; i += step) result.push(String(i));
      }
      return result.join(" ");
    },
  },

  // ── ldelete / delete ─────────────────────────────────────────────────────────

  /**
   * ldelete(list, pos [,delim] [,outdelim]) — remove item at 1-based position.
   */
  ldelete: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [list, posStr, inDelim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      if (pos < 1 || pos > items.length) return list;
      items.splice(pos - 1, 1);
      return joinDelim(items, outDelim ?? inDelim);
    },
  },

  /** delete — TinyMUX alias for ldelete */
  delete: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [list, posStr, inDelim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      if (pos < 1 || pos > items.length) return list;
      items.splice(pos - 1, 1);
      return joinDelim(items, outDelim ?? inDelim);
    },
  },

  // ── insert / linsert ─────────────────────────────────────────────────────────

  /**
   * insert(list, pos, new [,delim]) — insert item before 1-based position.
   * insert(a b c, 2, x) → "a x b c"
   */
  insert: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [list, posStr, newItem, delim = " "] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, delim);
      const idx = Math.max(0, Math.min(pos - 1, items.length));
      items.splice(idx, 0, newItem);
      return joinDelim(items, delim === " " ? " " : delim);
    },
  },

  /** linsert — alias for insert */
  linsert: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [list, posStr, newItem, delim = " "] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, delim);
      const idx = Math.max(0, Math.min(pos - 1, items.length));
      items.splice(idx, 0, newItem);
      return joinDelim(items, delim === " " ? " " : delim);
    },
  },

  // ── replace / lreplace ───────────────────────────────────────────────────────

  /**
   * replace(list, pos, new [,delim] [,outdelim]) — replace item at 1-based position.
   */
  replace: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [list, posStr, newItem, inDelim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      if (pos < 1 || pos > items.length) return list;
      items[pos - 1] = newItem;
      return joinDelim(items, outDelim ?? inDelim);
    },
  },

  /** lreplace — alias for replace */
  lreplace: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [list, posStr, newItem, inDelim = " ", outDelim] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      if (pos < 1 || pos > items.length) return list;
      items[pos - 1] = newItem;
      return joinDelim(items, outDelim ?? inDelim);
    },
  },

  // ── lrest / rest is in iter.ts — lrest is an alias ──────────────────────────

  /** lrest(list [,delim]) — alias for rest: all words after the first. */
  lrest: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      if (items.length <= 1) return "";
      return joinDelim(items.slice(1), delim === " " ? " " : delim);
    },
  },

  // ── butlast ─────────────────────────────────────────────────────────────────

  /** butlast(list [,delim]) — all items except the last. */
  butlast: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      const items = splitDelim(str, delim);
      if (items.length <= 1) return "";
      return joinDelim(items.slice(0, -1), delim === " " ? " " : delim);
    },
  },

  // ── remove ──────────────────────────────────────────────────────────────────

  /**
   * remove(list, item [,delim] [,outdelim]) — remove FIRST case-insensitive match.
   */
  remove: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [list, item, inDelim = " ", outDelim] = args as string[];
      const items = splitDelim(list, inDelim);
      const target = item.toLowerCase();
      const idx = items.findIndex(w => w.toLowerCase() === target);
      if (idx !== -1) items.splice(idx, 1);
      return joinDelim(items, outDelim ?? inDelim);
    },
  },

  // ── Random ──────────────────────────────────────────────────────────────────

  /** pickrand(list [,delim]) — return a random single element. */
  pickrand: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [list, delim = " "] = args as string[];
      const items = splitDelim(list, delim);
      if (items.length === 0) return "";
      return items[Math.floor(Math.random() * items.length)];
    },
  },

  /**
   * lrand(min, max, count [,delim]) — generate count random integers in [min,max].
   * E.g. lrand(1,6,5) → "3 1 6 2 4"
   */
  lrand: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [minStr, maxStr, countStr, delim = " "] = args as string[];
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      const count = parseInt(countStr, 10);
      if (isNaN(min) || isNaN(max) || isNaN(count)) return "#-1 ARGUMENT IS NOT A NUMBER";
      if (count < 0) return "#-1 COUNT IS NEGATIVE";
      const result: string[] = [];
      for (let i = 0; i < count; i++) {
        result.push(String(min + Math.floor(Math.random() * (max - min + 1))));
      }
      return joinDelim(result, delim);
    },
  },

  /**
   * choose(list, weights [,delim]) — weighted random pick.
   * Returns #-1 WEIGHTS MISMATCH if counts differ; #-1 ZERO WEIGHT if all weights are 0.
   */
  choose: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [list, weightsStr, delim = " "] = args as string[];
      const items = splitDelim(list, delim);
      const weights = splitDelim(weightsStr, delim).map(w => parseInt(w, 10));
      if (items.length !== weights.length) return "#-1 WEIGHTS MISMATCH";
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return "#-1 ZERO WEIGHT";
      let r = Math.random() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },
  },

  // ── Multi-list operations ────────────────────────────────────────────────────

  /**
   * elements(list, positions [,delim]) — extract 1-based positions (space-separated).
   * Out-of-range positions silently skipped.
   */
  elements: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [list, positionsStr, delim = " "] = args as string[];
      const items = splitDelim(list, delim);
      const result: string[] = [];
      for (const p of positionsStr.trim().split(/\s+/)) {
        const idx = parseInt(p, 10);
        if (!isNaN(idx) && idx >= 1 && idx <= items.length) {
          result.push(items[idx - 1]);
        }
      }
      return joinDelim(result, delim === " " ? " " : delim);
    },
  },

  /**
   * splice(list1, list2 [,delim] [,outdelim]) — interleave odd=list1, even=list2.
   * splice(a c e, b d f) → "a b c d e f"
   */
  splice: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [list1, list2, inDelim = " ", outDelim] = args as string[];
      const a = splitDelim(list1, inDelim);
      const b = splitDelim(list2, inDelim);
      const result: string[] = [];
      const maxLen = Math.max(a.length, b.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < a.length) result.push(a[i]);
        if (i < b.length) result.push(b[i]);
      }
      return joinDelim(result, outDelim ?? (inDelim === " " ? " " : inDelim));
    },
  },

  /**
   * mix(list1, list2 [,list3 ...]) — interleave multiple lists round-robin.
   * mix(a b, 1 2, x y) → "a 1 x b 2 y"
   * All lists share space delimiter; last arg is treated as a list too (variadic).
   */
  mix: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      // All args are lists space-delimited
      const lists = (args as string[]).map(l => splitDelim(l, " "));
      const result: string[] = [];
      const maxLen = Math.max(...lists.map(l => l.length));
      for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
          if (i < list.length) result.push(list[i]);
        }
      }
      return result.join(" ");
    },
  },

  /**
   * zip(list1, list2 [,delim] [,outdelim]) — zip two lists into "a:1 b:2 c:3" pairs.
   * Stops at shorter list.
   */
  zip: {
    minArgs: 2, maxArgs: 4,
    exec(args) {
      const [list1, list2, inDelim = " ", outDelim] = args as string[];
      const a = splitDelim(list1, inDelim);
      const b = splitDelim(list2, inDelim);
      const len = Math.min(a.length, b.length);
      const result: string[] = [];
      for (let i = 0; i < len; i++) {
        result.push(`${a[i]}:${b[i]}`);
      }
      return joinDelim(result, outDelim ?? (inDelim === " " ? " " : inDelim));
    },
  },

  // ── Ordering / selection ─────────────────────────────────────────────────────

  /**
   * sort(list [,delim] [,outdelim]) — alphabetical sort.
   */
  sort: {
    minArgs: 1, maxArgs: 4,
    exec(args) {
      const [str, type = "a", delim = " ", outDelim] = args as string[];
      const items = splitDelim(str, delim);
      const od = outDelim ?? (delim === " " ? " " : delim);
      const t = type.toLowerCase();
      if (t === "n") items.sort((a, b) => parseFloat(a) - parseFloat(b));
      else if (t === "i") items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      else items.sort((a, b) => a.localeCompare(b));
      return joinDelim(items, od);
    },
  },

  /**
   * sortkey(list, attr [,delim]) — sort list by a key.
   * Full implementation requires server-side UDF support. For now, sorts items
   * where each item may contain a key portion after a colon, or else sorts
   * alphabetically as a fallback. TODO: full UDF-based sort when ObjectAccessor
   * provides the needed mechanism.
   */
  sortkey: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [list, _attr, inDelim = " "] = args as string[];
      // Stub: just sort alphabetically (full UDF-based sort requires server)
      const items = splitDelim(list, inDelim);
      items.sort((a, b) => a.localeCompare(b));
      return joinDelim(items, inDelim);
    },
  },

  /**
   * step(list, fn, step_size [,delim]) — LAZY
   * Call fn with step_size consecutive items as ## (a sub-list).
   */
  step: {
    eval: "lazy",
    minArgs: 3, maxArgs: 4,
    async exec(args, ctx) {
      const thunks = args as EvalThunk[];
      const list      = await thunks[0]();
      const fn        = thunks[1];
      const stepSizeStr = await thunks[2]();
      const inDelim   = thunks[3] ? ((await thunks[3]()) || " ") : " ";

      const stepSize = parseInt(stepSizeStr, 10);
      if (isNaN(stepSize) || stepSize < 1) return "#-1 ARGUMENT IS NOT A NUMBER";

      const items = splitDelim(list, inDelim);
      const results: string[] = [];

      for (let i = 0; i < items.length; i += stepSize) {
        const chunk = items.slice(i, i + stepSize);
        const chunkStr = chunk.join(inDelim === " " ? " " : inDelim);
        const frame: IterFrame = { item: chunkStr, index: Math.floor(i / stepSize) + 1 };
        results.push(await fn({ iterStack: [frame, ...ctx.iterStack] }));
      }

      return results.join(inDelim === " " ? " " : inDelim);
    },
  },

  // ── Formatting ────────────────────────────────────────────────────────────────

  /**
   * itemize(list [,delim] [,conjunction] [,punct]) — grammatical list join.
   * 1 item:  "a"
   * 2 items: "a and b"
   * 3+:      "a, b, and c"  (Oxford comma by default)
   */
  itemize: {
    minArgs: 1, maxArgs: 4,
    exec(args) {
      const [list, delim = " ", conjunction = "and", punct = ","] = args as string[];
      const items = splitDelim(list, delim);
      if (items.length === 0) return "";
      if (items.length === 1) return items[0];
      if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;
      const last = items[items.length - 1];
      const rest = items.slice(0, -1);
      const sep = punct ? `${punct} ` : " ";
      return `${rest.join(sep)}${punct}${punct ? "" : ""} ${conjunction} ${last}`;
    },
  },

  /**
   * table(list, col_width [,delim] [,numcols] [,outdelim]) — format into fixed columns.
   * Default 2 columns, rows separated by \r\n.
   */
  table: {
    minArgs: 2, maxArgs: 5,
    exec(args) {
      const [list, colWidthStr, inDelim = " ", numColsStr = "2"] = args as string[];
      const colWidth = parseInt(colWidthStr, 10);
      const numCols  = parseInt(numColsStr, 10) || 2;
      if (isNaN(colWidth) || colWidth < 1) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      const rows: string[] = [];
      for (let i = 0; i < items.length; i += numCols) {
        const row = items.slice(i, i + numCols).map(w => w.padEnd(colWidth));
        rows.push(row.join("").trimEnd());
      }
      return rows.join("\r\n");
    },
  },

  /** columns — alias for table */
  columns: {
    minArgs: 2, maxArgs: 5,
    exec(args) {
      const [list, colWidthStr, inDelim = " ", numColsStr = "2"] = args as string[];
      const colWidth = parseInt(colWidthStr, 10);
      const numCols  = parseInt(numColsStr, 10) || 2;
      if (isNaN(colWidth) || colWidth < 1) return "#-1 ARGUMENT IS NOT A NUMBER";
      const items = splitDelim(list, inDelim);
      const rows: string[] = [];
      for (let i = 0; i < items.length; i += numCols) {
        const row = items.slice(i, i + numCols).map(w => w.padEnd(colWidth));
        rows.push(row.join("").trimEnd());
      }
      return rows.join("\r\n");
    },
  },

  revwords: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      return joinDelim(splitDelim(str, delim).reverse(), delim === " " ? " " : delim);
    },
  },

  lsort: {
    minArgs: 1, maxArgs: 4,
    exec(args) {
      const [str, type = "a", delim = " ", outDelim] = args as string[];
      const items = splitDelim(str, delim);
      const od = outDelim ?? (delim === " " ? " " : delim);
      const t = type.toLowerCase();
      if (t === "n") items.sort((a, b) => parseFloat(a) - parseFloat(b));
      else if (t === "i") items.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      else items.sort((a, b) => a.localeCompare(b));
      return joinDelim(items, od);
    },
  },

  sortby: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, , delim = " "] = args as string[];
      return splitDelim(str, delim).join(delim === " " ? " " : delim);
    },
  },

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

  extract: {
    minArgs: 3, maxArgs: 5,
    exec(args) {
      const [str, startStr, lenStr, delim = " ", outDelim] = args as string[];
      const start = parseInt(startStr, 10);
      const len   = parseInt(lenStr, 10);
      if (isNaN(start) || isNaN(len)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const od    = outDelim ?? (delim === " " ? " " : delim);
      const items = splitDelim(str, delim);
      return joinDelim(items.slice(start - 1, start - 1 + Math.max(0, len)), od);
    },
  },

  grab: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      return splitDelim(str, delim).find(w => wildcardMatch(pattern, w)) ?? "";
    },
  },

  graball: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const matched = splitDelim(str, delim).filter(w => wildcardMatch(pattern, w));
      return joinDelim(matched, delim === " " ? " " : delim);
    },
  },

  member: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, word, delim = " "] = args as string[];
      const idx = splitDelim(str, delim).findIndex(w => w.toLowerCase() === word.toLowerCase());
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  lpos: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, word, delim = " "] = args as string[];
      const idx = splitDelim(str, delim).findIndex(w => w.toLowerCase() === word.toLowerCase());
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  match: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const idx = splitDelim(str, delim).findIndex(w => wildcardMatch(pattern, w));
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  matchall: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, pattern, delim = " "] = args as string[];
      const positions: string[] = [];
      splitDelim(str, delim).forEach((w, i) => {
        if (wildcardMatch(pattern, w)) positions.push(String(i + 1));
      });
      return positions.join(" ");
    },
  },

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
        if (thunks.length === 4) { base = third; delim = (await thunks[3]()) || " "; }
        else { base = third; }
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
