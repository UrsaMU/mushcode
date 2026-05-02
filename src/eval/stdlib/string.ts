import type { FunctionImpl } from "../context.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Maximum number of characters any single string-building function may produce.
 * Mirrors TinyMUX's per-expression output limit (~8 000 chars).
 * Prevents unbounded memory allocation from player-authored softcode.
 */
export const MAX_STRING_LEN = 8_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(str: string, width: number, fill: string, align: "left" | "right" | "center"): string {
  if (width > MAX_STRING_LEN) throw new Error("OUTPUT TOO LONG");
  const ch  = fill[0] ?? " ";
  const len = str.length;
  if (len >= width) return str;
  const total = width - len;
  if (align === "left")   return str + ch.repeat(total);
  if (align === "right")  return ch.repeat(total) + str;
  const lPad = Math.floor(total / 2);
  return ch.repeat(lPad) + str + ch.repeat(total - lPad);
}

// ── String functions ──────────────────────────────────────────────────────────

export const stringFunctions: Record<string, FunctionImpl> = {
  strlen: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String((args as string[])[0].length); },
  },

  /** mid(str, start, length) — 0-based start position (TinyMUX convention). Negative start clamped to 0. */
  mid: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, startStr, lenStr] = args as string[];
      const start = parseInt(startStr, 10);
      const len   = parseInt(lenStr,   10);
      if (isNaN(start) || isNaN(len)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const s = Math.max(0, start);
      return str.slice(s, s + Math.max(0, len));
    },
  },

  left: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, nStr] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return str.slice(0, Math.max(0, n));
    },
  },

  right: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, nStr] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return n > 0 ? str.slice(-n) : "";
    },
  },

  /** trim(str[, side[, char]]) — side: "l"|"r"|"b" (both, default). */
  trim: {
    minArgs: 1, maxArgs: 3,
    exec(args) {
      const [str, side = "b", char = " "] = args as string[];
      const ch = (char[0] ?? " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const s  = side.toLowerCase();
      if (s === "l") return str.replace(new RegExp(`^${ch}+`), "");
      if (s === "r") return str.replace(new RegExp(`${ch}+$`), "");
      return str.replace(new RegExp(`^${ch}+`), "").replace(new RegExp(`${ch}+$`), "");
    },
  },

  ljust: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "left");
    },
  },

  rjust: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "right");
    },
  },

  center: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "center");
    },
  },

  ucstr: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return (args as string[])[0].toUpperCase(); },
  },

  lcstr: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return (args as string[])[0].toLowerCase(); },
  },

  capstr: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = (args as string[])[0];
      return s ? s[0].toUpperCase() + s.slice(1) : "";
    },
  },

  /** cat(str1, str2, ...) — joins with a single space. */
  cat: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) { return (args as string[]).join(" "); },
  },

  space: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = parseInt((args as string[])[0], 10);
      if (isNaN(n) || n < 0) throw new Error("ARGUMENT IS NOT A NUMBER");
      if (n > MAX_STRING_LEN) throw new Error("OUTPUT TOO LONG");
      return " ".repeat(n);
    },
  },

  repeat: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, nStr] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n) || n < 0) throw new Error("ARGUMENT IS NOT A NUMBER");
      if (n <= 0) return "";
      if (str.length * n > MAX_STRING_LEN) throw new Error("OUTPUT TOO LONG");
      return str.repeat(n);
    },
  },

  reverse: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return [...(args as string[])[0]].reverse().join("");
    },
  },

  scramble: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const chars = [...(args as string[])[0]];
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join("");
    },
  },

  encrypt: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, key] = args as string[];
      if (!key) return str;
      const result: string[] = [];
      for (let i = 0; i < str.length; i++) {
        result.push(String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
      }
      return result.join("");
    },
  },

  decrypt: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      // XOR is symmetric
      const [str, key] = args as string[];
      if (!key) return str;
      const result: string[] = [];
      for (let i = 0; i < str.length; i++) {
        result.push(String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
      }
      return result.join("");
    },
  },

  comp: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      if (s1 < s2) return "-1";
      if (s1 > s2) return "1";
      return "0";
    },
  },

  streq: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      return s1.toLowerCase() === s2.toLowerCase() ? "1" : "0";
    },
  },

  /** index(list, delim, pos[, count]) — extract word(s) at 1-based position. */
  index: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [list, delim, posStr, countStr] = args as string[];
      const pos   = parseInt(posStr, 10);
      const count = countStr !== undefined ? parseInt(countStr, 10) : 1;
      if (isNaN(pos) || isNaN(count)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const parts = delim === " "
        ? list.trim().split(/\s+/).filter(Boolean)
        : list.split(delim);
      const start = pos - 1;
      if (start < 0 || start >= parts.length) return "";
      const slice = parts.slice(start, start + Math.max(0, count));
      return slice.join(delim === " " ? " " : delim);
    },
  },

  /** setinter(list1, list2[, delim]) — intersection of two lists. */
  setinter: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [l1, l2, delim = " "] = args as string[];
      const split = (s: string) =>
        delim === " " ? s.trim().split(/\s+/).filter(Boolean) : s.split(delim);
      const set2 = new Set(split(l2).map(w => w.toLowerCase()));
      const inter = split(l1).filter(w => set2.has(w.toLowerCase()));
      return inter.join(delim === " " ? " " : delim);
    },
  },

  /** setunion(list1, list2[, delim]) — union, deduplicated, preserving order. */
  setunion: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [l1, l2, delim = " "] = args as string[];
      const split = (s: string) =>
        delim === " " ? s.trim().split(/\s+/).filter(Boolean) : s.split(delim);
      const seen = new Set<string>();
      const result: string[] = [];
      for (const w of [...split(l1), ...split(l2)]) {
        const k = w.toLowerCase();
        if (!seen.has(k)) { seen.add(k); result.push(w); }
      }
      return result.join(delim === " " ? " " : delim);
    },
  },

  /** setdiff(list1, list2[, delim]) — elements in list1 not in list2. */
  setdiff: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [l1, l2, delim = " "] = args as string[];
      const split = (s: string) =>
        delim === " " ? s.trim().split(/\s+/).filter(Boolean) : s.split(delim);
      const set2 = new Set(split(l2).map(w => w.toLowerCase()));
      const diff = split(l1).filter(w => !set2.has(w.toLowerCase()));
      return diff.join(delim === " " ? " " : delim);
    },
  },

  /** hastype(obj, type) — stub returning "0" (requires db accessor). */
  hastype: {
    minArgs: 2, maxArgs: 2,
    exec() { return "0"; },
  },
};
