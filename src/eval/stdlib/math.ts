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
};
