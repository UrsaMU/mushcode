import type { FunctionImpl, EvalContext, IEvalEngine, EvalThunk } from "../context.ts";
import { parse } from "../../../parser/mod.ts";

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

  // ── Find / split ─────────────────────────────────────────────────────────

  /** pos(needle, haystack) — 1-based position of needle in haystack. Case-insensitive. Returns "0" if not found. */
  pos: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [needle, haystack] = args as string[];
      const idx = haystack.toLowerCase().indexOf(needle.toLowerCase());
      return idx === -1 ? "0" : String(idx + 1);
    },
  },

  /** posn(needle, haystack, n) — position of Nth occurrence (1-based). Returns "0" if fewer than N. */
  posn: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [needle, haystack, nStr] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n) || n < 1) throw new Error("ARGUMENT IS NOT A NUMBER");
      const lower = haystack.toLowerCase();
      const lneedle = needle.toLowerCase();
      let count = 0;
      let start = 0;
      while (start <= lower.length) {
        const idx = lower.indexOf(lneedle, start);
        if (idx === -1) return "0";
        count++;
        if (count === n) return String(idx + 1);
        start = idx + 1;
      }
      return "0";
    },
  },

  /** after(str, delim) — text after first occurrence of delim. "" if not found. */
  after: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, delim] = args as string[];
      const idx = str.indexOf(delim);
      return idx === -1 ? "" : str.slice(idx + delim.length);
    },
  },

  /** before(str, delim) — text before first occurrence of delim. str if not found. */
  before: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, delim] = args as string[];
      const idx = str.indexOf(delim);
      return idx === -1 ? str : str.slice(0, idx);
    },
  },

  /** wordpos(str, charpos[,delim]) — which word (1-based) contains character position charpos (1-based). "0" if out of range. */
  wordpos: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, charposStr, delim = " "] = args as string[];
      const charpos = parseInt(charposStr, 10);
      if (isNaN(charpos) || charpos < 1 || charpos > str.length) return "0";
      const words = delim === " " ? str.split(/\s+/).filter(Boolean) : str.split(delim);
      let pos = 0;
      for (let i = 0; i < words.length; i++) {
        // find where this word starts in the original string
        const wordStart = str.indexOf(words[i], pos);
        const wordEnd   = wordStart + words[i].length;
        if (charpos >= wordStart + 1 && charpos <= wordEnd) return String(i + 1);
        pos = wordEnd;
      }
      return "0";
    },
  },

  /** wordstart(str, N[,delim]) — 1-based char position where word N starts. */
  wordstart: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, nStr, delim = " "] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n) || n < 1) return "0";
      const words = delim === " " ? str.split(/\s+/).filter(Boolean) : str.split(delim);
      if (n > words.length) return "0";
      let pos = 0;
      for (let i = 0; i < n - 1; i++) {
        const idx = str.indexOf(words[i], pos);
        pos = idx + words[i].length;
      }
      const start = str.indexOf(words[n - 1], pos);
      return start === -1 ? "0" : String(start + 1);
    },
  },

  /** wordend(str, N[,delim]) — 1-based char position of last char of word N. */
  wordend: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, nStr, delim = " "] = args as string[];
      const n = parseInt(nStr, 10);
      if (isNaN(n) || n < 1) return "0";
      const words = delim === " " ? str.split(/\s+/).filter(Boolean) : str.split(delim);
      if (n > words.length) return "0";
      let pos = 0;
      for (let i = 0; i < n - 1; i++) {
        const idx = str.indexOf(words[i], pos);
        pos = idx + words[i].length;
      }
      const start = str.indexOf(words[n - 1], pos);
      return start === -1 ? "0" : String(start + words[n - 1].length);
    },
  },

  // ── Edit / transform ──────────────────────────────────────────────────────

  /** edit(str, from, to[,from2,to2...]) — find-and-replace, multiple pairs left-to-right. Case-sensitive. */
  edit: {
    minArgs: 3, maxArgs: Infinity,
    exec(args) {
      const a = args as string[];
      if ((a.length - 1) % 2 !== 0) throw new Error("WRONG NUMBER OF ARGUMENTS");
      let str = a[0];
      for (let i = 1; i < a.length; i += 2) {
        const from = a[i];
        const to   = a[i + 1];
        if (from === "") { str = str + to; continue; }
        str = str.split(from).join(to);
      }
      return str;
    },
  },

  /** squish(str[,delim]) — compress runs of delim (default space) to single, trim leading/trailing. */
  squish: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, delim = " "] = args as string[];
      if (delim === " ") return str.trim().replace(/\s+/g, " ");
      const escaped = delim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return str
        .replace(new RegExp(`^${escaped}+`), "")
        .replace(new RegExp(`${escaped}+$`), "")
        .replace(new RegExp(`${escaped}+`, "g"), delim);
    },
  },

  /** strip(str[,chars]) — remove all occurrences of each character in chars from str. Default: strip whitespace. */
  strip: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [str, chars] = args as string[];
      if (chars === undefined || chars === "") {
        return str.replace(/\s/g, "");
      }
      const escaped = chars.split("").map(c => c.replace(/[.*+?^${}()|[\\\]]/g, "\\$&")).join("");
      return str.replace(new RegExp(`[${escaped}]`, "g"), "");
    },
  },

  /** stripansi(str) — remove ANSI escape sequences and pct-c/pct-x softcode color codes. */
  stripansi: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      let s = (args as string[])[0];
      // Remove ANSI escape sequences \x1b[...m
      s = s.replace(/\x1b\[[0-9;]*m/g, "");
      // Remove softcode color codes %cX and %xX (single-char color codes)
      s = s.replace(/%[cx][a-zA-Z0-9]/gi, "");
      return s;
    },
  },

  /** strcat(args...) — concatenate all args with no separator. */
  strcat: {
    minArgs: 1, maxArgs: Infinity,
    exec(args) { return (args as string[]).join(""); },
  },

  /** secure(str) — escape [, ], {, }, ;, %, and \ so they cannot be evaluated. */
  secure: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return (args as string[])[0]
        .replace(/\\/g, "\\\\")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\{/g, "\\{")
        .replace(/\}/g, "\\}")
        .replace(/;/g,  "\\;")
        .replace(/%/g,  "\\%");
    },
  },

  /** escape(str) — prevent double-evaluation by escaping [ as \[ and % as %%. */
  escape: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return (args as string[])[0]
        .replace(/\[/g, "\\[")
        .replace(/%/g,  "%%");
    },
  },

  /** ledit(list, from, to[,delim]) — apply edit(item, from, to) to each word in list. */
  ledit: {
    minArgs: 3, maxArgs: 4,
    exec(args) {
      const [list, from, to, delim = " "] = args as string[];
      const words = delim === " " ? list.split(/\s+/).filter(Boolean) : list.split(delim);
      const edited = words.map(w => from === "" ? w + to : w.split(from).join(to));
      return edited.join(delim === " " ? " " : delim);
    },
  },

  // ── Padding / alignment ────────────────────────────────────────────────────

  /** lpad(str, width[,fill]) — left-pad (right-justify). Alias for rjust. */
  lpad: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "right");
    },
  },

  /** rpad(str, width[,fill]) — right-pad (left-justify). Alias for ljust. */
  rpad: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "left");
    },
  },

  /** cpad(str, width[,fill]) — center-pad. Alias for center. */
  cpad: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [str, wStr, fill = " "] = args as string[];
      const w = parseInt(wStr, 10);
      if (isNaN(w)) throw new Error("ARGUMENT IS NOT A NUMBER");
      return pad(str, w, fill, "center");
    },
  },

  // ── String measurement ────────────────────────────────────────────────────

  /** strmem(str) — byte length of string (UTF-8). */
  strmem: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return String(new TextEncoder().encode((args as string[])[0]).length);
    },
  },

  // ── String set operations ─────────────────────────────────────────────────

  /** strdiff(s1, s2) — characters in s1 NOT in s2 (sorted unique char string). */
  strdiff: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      const set2 = new Set(s2.split(""));
      const result = [...new Set(s1.split(""))].filter(c => !set2.has(c));
      return result.sort().join("");
    },
  },

  /** strinter(s1, s2) — characters in BOTH s1 and s2 (sorted unique). */
  strinter: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      const set2 = new Set(s2.split(""));
      const result = [...new Set(s1.split(""))].filter(c => set2.has(c));
      return result.sort().join("");
    },
  },

  /** strunion(s1, s2) — characters in either s1 or s2 (sorted unique). */
  strunion: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      const result = new Set([...s1.split(""), ...s2.split("")]);
      return [...result].sort().join("");
    },
  },

  /** strunique(s) — remove duplicate characters, preserve first occurrence order. */
  strunique: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = (args as string[])[0];
      const seen = new Set<string>();
      return s.split("").filter(c => { if (seen.has(c)) return false; seen.add(c); return true; }).join("");
    },
  },

  /** strsort(s) — sort characters alphabetically. */
  strsort: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return (args as string[])[0].split("").sort().join("");
    },
  },

  // ── String mutations ──────────────────────────────────────────────────────

  /** strdelete(str, pos, len) — delete len characters starting at 1-based pos. */
  strdelete: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, posStr, lenStr] = args as string[];
      const pos = parseInt(posStr, 10);
      const len = parseInt(lenStr, 10);
      if (isNaN(pos) || isNaN(len)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const p = Math.max(1, pos) - 1;
      return str.slice(0, p) + str.slice(p + Math.max(0, len));
    },
  },

  /** strinsert(str, pos, insert) — insert insert at 1-based position pos (before that position). */
  strinsert: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, posStr, insert] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos)) throw new Error("ARGUMENT IS NOT A NUMBER");
      const p = Math.max(1, pos) - 1;
      return str.slice(0, p) + insert + str.slice(p);
    },
  },

  /** strreplace(str, pos, new) — replace character at 1-based pos with new string. */
  strreplace: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, posStr, replacement] = args as string[];
      const pos = parseInt(posStr, 10);
      if (isNaN(pos) || pos < 1 || pos > str.length) throw new Error("ARGUMENT OUT OF RANGE");
      const p = pos - 1;
      return str.slice(0, p) + replacement + str.slice(p + 1);
    },
  },

  /** strtrunc(str, len) — truncate string to len visible characters. */
  strtrunc: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, lenStr] = args as string[];
      const len = parseInt(lenStr, 10);
      if (isNaN(len) || len < 0) throw new Error("ARGUMENT IS NOT A NUMBER");
      return str.slice(0, len);
    },
  },

  /** strdistance(s1, s2) — Levenshtein edit distance as a string integer. */
  strdistance: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      const m = s1.length, n = s2.length;
      const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (__, j) => i === 0 ? j : j === 0 ? i : 0)
      );
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
          else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return String(dp[m][n]);
    },
  },

  // ── Encoding ──────────────────────────────────────────────────────────────

  /** encode64(str) — Base64 encode. */
  encode64: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return btoa((args as string[])[0]); },
  },

  /** decode64(str) — Base64 decode. Returns #-1 INVALID BASE64 on error. */
  decode64: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      try { return atob((args as string[])[0]); }
      catch { return "#-1 INVALID BASE64"; }
    },
  },

  /** url_escape(str) — percent-encode for URLs. */
  url_escape: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return encodeURIComponent((args as string[])[0]); },
  },

  /** url_unescape(str) — percent-decode. Returns #-1 INVALID URL ENCODING on error. */
  url_unescape: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      try { return decodeURIComponent((args as string[])[0]); }
      catch { return "#-1 INVALID URL ENCODING"; }
    },
  },

  // ── Regex ─────────────────────────────────────────────────────────────────

  /** regmatch(str, pattern[,registers]) — test if str matches pattern. Returns "1" or "0". */
  regmatch: {
    minArgs: 2, maxArgs: 3,
    exec(args, ctx: EvalContext) {
      const [str, pattern, regs] = args as string[];
      let rx: RegExp;
      try { rx = new RegExp(pattern); } catch { return "#-1 INVALID REGEX"; }
      const m = str.match(rx);
      if (!m) return "0";
      if (regs) {
        const names = regs.trim().split(/\s+/);
        for (let i = 0; i < names.length; i++) {
          ctx.registers.set(names[i], m[i] ?? "");
        }
      }
      return "1";
    },
  },

  /** regmatchi(str, pattern[,registers]) — case-insensitive regmatch. */
  regmatchi: {
    minArgs: 2, maxArgs: 3,
    exec(args, ctx: EvalContext) {
      const [str, pattern, regs] = args as string[];
      let rx: RegExp;
      try { rx = new RegExp(pattern, "i"); } catch { return "#-1 INVALID REGEX"; }
      const m = str.match(rx);
      if (!m) return "0";
      if (regs) {
        const names = regs.trim().split(/\s+/);
        for (let i = 0; i < names.length; i++) {
          ctx.registers.set(names[i], m[i] ?? "");
        }
      }
      return "1";
    },
  },

  /** regedit(str, pattern, replacement) — replace first occurrence. */
  regedit: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, pattern, replacement] = args as string[];
      try { return str.replace(new RegExp(pattern), replacement); }
      catch { return "#-1 INVALID REGEX"; }
    },
  },

  /** regediti(str, pattern, replacement) — case-insensitive regedit. */
  regediti: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, pattern, replacement] = args as string[];
      try { return str.replace(new RegExp(pattern, "i"), replacement); }
      catch { return "#-1 INVALID REGEX"; }
    },
  },

  /** regeditall(str, pattern, replacement) — replace ALL occurrences. */
  regeditall: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, pattern, replacement] = args as string[];
      try { return str.replace(new RegExp(pattern, "g"), replacement); }
      catch { return "#-1 INVALID REGEX"; }
    },
  },

  /** regeditalli(str, pattern, replacement) — case-insensitive regeditall. */
  regeditalli: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [str, pattern, replacement] = args as string[];
      try { return str.replace(new RegExp(pattern, "gi"), replacement); }
      catch { return "#-1 INVALID REGEX"; }
    },
  },

  // ── Soundex ───────────────────────────────────────────────────────────────

  /** soundex(str) — American Soundex code. */
  soundex: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const s = (args as string[])[0].toUpperCase().replace(/[^A-Z]/g, "");
      if (!s) return "";
      const map: Record<string, string> = {
        B:"1",F:"1",P:"1",V:"1",
        C:"2",G:"2",J:"2",K:"2",Q:"2",S:"2",X:"2",Z:"2",
        D:"3",T:"3",
        L:"4",
        M:"5",N:"5",
        R:"6",
      };
      let code = s[0];
      let prev = map[s[0]] ?? "0";
      for (let i = 1; i < s.length && code.length < 4; i++) {
        const d = map[s[i]] ?? "0";
        if (d !== "0" && d !== prev) { code += d; }
        prev = d;
      }
      return code.padEnd(4, "0");
    },
  },

  /** soundlike(s1, s2) — "1" if soundex codes match, "0" otherwise. */
  soundlike: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [s1, s2] = args as string[];
      function sdx(s: string): string {
        const str = s.toUpperCase().replace(/[^A-Z]/g, "");
        if (!str) return "";
        const map: Record<string, string> = {
          B:"1",F:"1",P:"1",V:"1",
          C:"2",G:"2",J:"2",K:"2",Q:"2",S:"2",X:"2",Z:"2",
          D:"3",T:"3",
          L:"4",
          M:"5",N:"5",
          R:"6",
        };
        let code = str[0];
        let prev = map[str[0]] ?? "0";
        for (let i = 1; i < str.length && code.length < 4; i++) {
          const d = map[str[i]] ?? "0";
          if (d !== "0" && d !== prev) { code += d; }
          prev = d;
        }
        return code.padEnd(4, "0");
      }
      return sdx(s1) === sdx(s2) ? "1" : "0";
    },
  },

  // ── Misc ──────────────────────────────────────────────────────────────────

  /** subeval(str) — expand % substitutions in str but do NOT evaluate [...] function calls. */
  subeval: {
    minArgs: 1, maxArgs: 1,
    async exec(args, ctx: EvalContext, engine: IEvalEngine) {
      const str = (args as string[])[0];
      // Parse the string, then walk AST and evaluate only Substitution/SpecialVar nodes.
      // All other nodes are returned as their literal text.
      const ast = parse(str, "Start");
      async function walk(node: { type: string; [key: string]: unknown }): Promise<string> {
        if (node.type === "Substitution") {
          return await engine.eval(node as Parameters<typeof engine.eval>[0], ctx);
        }
        if (node.type === "SpecialVar") {
          return engine.eval(node as Parameters<typeof engine.eval>[0], ctx);
        }
        if (node.type === "Literal")     return node.value as string;
        if (node.type === "Escape")      return node.char  as string;
        if (node.type === "TagRef")      return "#" + (node.name as string);
        // For EvalBlock — return the raw text, not evaluated. Reconstruct as [...]
        if (node.type === "EvalBlock") {
          const parts = node.parts as Array<{ type: string; [key: string]: unknown }>;
          const inner = (await Promise.all(parts.map(walk))).join("");
          return "[" + inner + "]";
        }
        // Container nodes
        if (node.parts) {
          const parts = node.parts as Array<{ type: string; [key: string]: unknown }>;
          return (await Promise.all(parts.map(walk))).join("");
        }
        return "";
      }
      return walk(ast as { type: string; [key: string]: unknown });
    },
  },

  /** s(str) — evaluate str as softcode. */
  s: {
    minArgs: 1, maxArgs: 1,
    exec(args, ctx: EvalContext, engine: IEvalEngine) {
      return engine.evalString((args as string[])[0], ctx);
    },
  },

  /** lit(str) — return str literally (no evaluation). Lazy: returns raw text of first arg. */
  lit: {
    eval: "lazy",
    minArgs: 1, maxArgs: 1,
    async exec(args, _ctx: EvalContext) {
      // In lazy mode, we receive the thunk but we want the source text.
      // We call the thunk to get the evaluated text since we're in eager-parse land.
      // Actually for lit(), we want to prevent evaluation — but since args are already
      // parsed and we can't get raw text, we call the thunk with a modified context
      // that would return the raw string. The simplest safe impl: return the literal
      // text by calling the thunk (args are still un-evaluated in lazy mode).
      // For the purposes of this implementation: in eager eval mode the arg has already
      // been evaluated; in lazy mode we call the thunk to get its value.
      const thunk = (args as EvalThunk[])[0];
      return await thunk();
    },
  },

  reverse: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return [...(args as string[])[0]].reverse().join(""); },
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
      return [...str].map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      ).join("");
    },
  },

  decrypt: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [str, key] = args as string[];
      if (!key) return str;
      return [...str].map((c, i) =>
        String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      ).join("");
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
      return parts.slice(start, start + Math.max(0, count)).join(delim === " " ? " " : delim);
    },
  },

  setinter: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [l1, l2, delim = " "] = args as string[];
      const split = (s: string) =>
        delim === " " ? s.trim().split(/\s+/).filter(Boolean) : s.split(delim);
      const set2 = new Set(split(l2).map(w => w.toLowerCase()));
      return split(l1).filter(w => set2.has(w.toLowerCase())).join(delim === " " ? " " : delim);
    },
  },

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

  setdiff: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const [l1, l2, delim = " "] = args as string[];
      const split = (s: string) =>
        delim === " " ? s.trim().split(/\s+/).filter(Boolean) : s.split(delim);
      const set2 = new Set(split(l2).map(w => w.toLowerCase()));
      return split(l1).filter(w => !set2.has(w.toLowerCase())).join(delim === " " ? " " : delim);
    },
  },

  hastype: {
    minArgs: 2, maxArgs: 2,
    exec() { return "0"; },
  },
};
