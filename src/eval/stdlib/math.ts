import type { FunctionImpl } from "../context.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toNum(s: string): number {
  const n = Number(s);
  if (!isFinite(n)) throw new Error(`ARGUMENT (${s}) IS NOT A NUMBER`);
  return n;
}

/** Format a result: integers stay integers; floats get at most 6 sig digits. */
function fmt(n: number): string {
  if (!isFinite(n)) throw new Error("RESULT IS NOT A NUMBER");
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(6)));
}

// ── Math functions ────────────────────────────────────────────────────────────

export const mathFunctions: Record<string, FunctionImpl> = {
  add: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return fmt((args as string[]).map(toNum).reduce((a, b) => a + b, 0));
    },
  },

  sub: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      return fmt(toNum(a) - toNum(b));
    },
  },

  mul: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return fmt((args as string[]).map(toNum).reduce((a, b) => a * b, 1));
    },
  },

  div: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const na = toNum(a), nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      if (Number.isInteger(na) && Number.isInteger(nb)) return String(Math.trunc(na / nb));
      return fmt(na / nb);
    },
  },

  mod: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const na = toNum(a), nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return fmt(na % nb);
    },
  },

  abs: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(Math.abs(toNum((args as string[])[0]))); },
  },

  round: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, p] = args as string[];
      const prec   = Math.max(0, Math.trunc(toNum(p)));
      const factor = Math.pow(10, prec);
      return fmt(Math.round(toNum(a) * factor) / factor);
    },
  },

  floor: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(Math.floor(toNum((args as string[])[0]))); },
  },

  ceil: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(Math.ceil(toNum((args as string[])[0]))); },
  },

  max: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) { return fmt(Math.max(...(args as string[]).map(toNum))); },
  },

  min: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) { return fmt(Math.min(...(args as string[]).map(toNum))); },
  },

  power: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      return fmt(Math.pow(toNum(a), toNum(b)));
    },
  },

  sqrt: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = toNum((args as string[])[0]);
      if (n < 0) throw new Error("ARGUMENT OUT OF RANGE");
      return fmt(Math.sqrt(n));
    },
  },

  sign: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = toNum((args as string[])[0]);
      return String(Math.sign(n));
    },
  },

  log: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [nStr, baseStr] = args as string[];
      const n = toNum(nStr);
      if (n <= 0) throw new Error("LOG OF ZERO");
      if (baseStr !== undefined) {
        const base = toNum(baseStr);
        if (base <= 0 || base === 1) throw new Error("ARGUMENT OUT OF RANGE");
        return fmt(Math.log(n) / Math.log(base));
      }
      return fmt(Math.log10(n));
    },
  },

  ln: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = toNum((args as string[])[0]);
      if (n <= 0) throw new Error("LOG OF ZERO");
      return fmt(Math.log(n));
    },
  },

  exp: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      return fmt(Math.exp(toNum((args as string[])[0])));
    },
  },

  sin: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(Math.sin(toNum((args as string[])[0]))); },
  },

  cos: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(Math.cos(toNum((args as string[])[0]))); },
  },

  tan: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(Math.tan(toNum((args as string[])[0]))); },
  },

  atan: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const [yStr, xStr] = args as string[];
      if (xStr !== undefined) {
        return fmt(Math.atan2(toNum(yStr), toNum(xStr)));
      }
      return fmt(Math.atan(toNum(yStr)));
    },
  },

  pi: {
    minArgs: 0, maxArgs: 0,
    exec() { return "3.141592653589793"; },
  },

  e: {
    minArgs: 0, maxArgs: 0,
    exec() { return "2.718281828459045"; },
  },

  bound: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [nStr, lowStr, highStr] = args as string[];
      const n   = toNum(nStr);
      const low = toNum(lowStr);
      const hi  = toNum(highStr);
      return fmt(Math.min(Math.max(n, low), hi));
    },
  },

  between: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [nStr, lowStr, highStr] = args as string[];
      const n   = toNum(nStr);
      const low = toNum(lowStr);
      const hi  = toNum(highStr);
      return (n >= low && n <= hi) ? "1" : "0";
    },
  },

  fdiv: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return fmt(toNum(a) / nb);
    },
  },

  fmod: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return fmt(toNum(a) % nb);
    },
  },

  trunc: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(Math.trunc(toNum((args as string[])[0]))); },
  },

  inc: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(toNum((args as string[])[0]) + 1); },
  },

  dec: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return fmt(toNum((args as string[])[0]) - 1); },
  },
};
