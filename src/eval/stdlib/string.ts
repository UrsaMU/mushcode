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
      if (str.length * n > MAX_STRING_LEN) throw new Error("OUTPUT TOO LONG");
      return str.repeat(n);
    },
  },
};
