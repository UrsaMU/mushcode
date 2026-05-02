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

  // ── Random / Dice ────────────────────────────────────────────────────────────

  rand: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      if (a.length === 1) {
        const max = toNum(a[0]);
        return String(Math.floor(Math.random() * max));
      }
      const min = toNum(a[0]), max = toNum(a[1]);
      return String(Math.floor(Math.random() * (max - min + 1)) + min);
    },
  },

  die: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const num   = Math.trunc(toNum(a[0]));
      const sides = Math.trunc(toNum(a[1]));
      const bonus = a[2] !== undefined ? Math.trunc(toNum(a[2])) : 0;
      if (num < 1 || sides < 1 || num > 100) throw new Error("ARGUMENT OUT OF RANGE");
      let sum = 0;
      for (let i = 0; i < num; i++) sum += Math.floor(Math.random() * sides) + 1;
      return String(sum + bonus);
    },
  },

  // ── Statistics ───────────────────────────────────────────────────────────────

  mean: {
    minArgs: 1, maxArgs: Infinity,
    exec(args) {
      const nums = (args as string[]).map(toNum);
      return fmt(nums.reduce((a, b) => a + b, 0) / nums.length);
    },
  },

  median: {
    minArgs: 1, maxArgs: Infinity,
    exec(args) {
      const nums = (args as string[]).map(toNum).sort((a, b) => a - b);
      const mid  = Math.floor(nums.length / 2);
      if (nums.length % 2 === 1) return fmt(nums[mid]);
      return fmt((nums[mid - 1] + nums[mid]) / 2);
    },
  },

  stddev: {
    minArgs: 1, maxArgs: Infinity,
    exec(args) {
      const nums = (args as string[]).map(toNum);
      const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
      return fmt(Math.sqrt(variance));
    },
  },

  lmath: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const op    = a[0].toLowerCase();
      const delim = a[2] ?? " ";
      const nums  = a[1].split(delim).filter(s => s !== "").map(toNum);
      if (nums.length === 0) throw new Error("ARGUMENT OUT OF RANGE");
      switch (op) {
        case "sum": case "add":
          return fmt(nums.reduce((x, y) => x + y, 0));
        case "mul": case "multiply":
          return fmt(nums.reduce((x, y) => x * y, 1));
        case "max":
          return fmt(Math.max(...nums));
        case "min":
          return fmt(Math.min(...nums));
        case "mean": {
          return fmt(nums.reduce((x, y) => x + y, 0) / nums.length);
        }
        case "median": {
          const sorted = [...nums].sort((x, y) => x - y);
          const mid = Math.floor(sorted.length / 2);
          if (sorted.length % 2 === 1) return fmt(sorted[mid]);
          return fmt((sorted[mid - 1] + sorted[mid]) / 2);
        }
        case "stddev": {
          const m = nums.reduce((x, y) => x + y, 0) / nums.length;
          const v = nums.reduce((x, y) => x + (y - m) ** 2, 0) / nums.length;
          return fmt(Math.sqrt(v));
        }
        default:
          throw new Error(`UNKNOWN OPERATION (${op})`);
      }
    },
  },

  ladd: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      const delim = a[1] ?? " ";
      const nums  = a[0].split(delim).filter(s => s !== "").map(toNum);
      return fmt(nums.reduce((x, y) => x + y, 0));
    },
  },

  lmax: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      const delim = a[1] ?? " ";
      const nums  = a[0].split(delim).filter(s => s !== "").map(toNum);
      return fmt(Math.max(...nums));
    },
  },

  lmin: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      const delim = a[1] ?? " ";
      const nums  = a[0].split(delim).filter(s => s !== "").map(toNum);
      return fmt(Math.min(...nums));
    },
  },

  // ── Integer variants ─────────────────────────────────────────────────────────

  iabs: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(Math.abs(Math.trunc(toNum((args as string[])[0])))); },
  },

  iadd: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return String(Math.trunc((args as string[]).map(toNum).reduce((a, b) => a + b, 0)));
    },
  },

  imul: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return String(Math.trunc((args as string[]).map(toNum).reduce((a, b) => a * b, 1)));
    },
  },

  idiv: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return String(Math.floor(toNum(a) / nb));
    },
  },

  isub: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      return String(Math.trunc(toNum(a) - toNum(b)));
    },
  },

  isign: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = toNum((args as string[])[0]);
      return String(n < 0 ? -1 : n > 0 ? 1 : 0);
    },
  },

  floordiv: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return String(Math.floor(toNum(a) / nb));
    },
  },

  remainder: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      const na = toNum(a), nb = toNum(b);
      if (nb === 0) throw new Error("DIVIDE BY ZERO");
      return fmt(na - Math.round(na / nb) * nb);
    },
  },

  // ── Bitwise ──────────────────────────────────────────────────────────────────

  band: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return String((args as string[]).map(s => toNum(s) | 0).reduce((a, b) => a & b));
    },
  },

  bor: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return String((args as string[]).map(s => toNum(s) | 0).reduce((a, b) => a | b));
    },
  },

  bxor: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      return String((args as string[]).map(s => toNum(s) | 0).reduce((a, b) => a ^ b));
    },
  },

  bnand: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = (args as string[]).map(s => toNum(s) | 0);
      return String(~(a & b));
    },
  },

  shl: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      return String((toNum(a) | 0) << (toNum(b) | 0));
    },
  },

  shr: {
    minArgs: 2, maxArgs: 2,
    exec(args) {
      const [a, b] = args as string[];
      return String((toNum(a) | 0) >> (toNum(b) | 0));
    },
  },

  xor: {
    minArgs: 2, maxArgs: Infinity,
    exec(args) {
      const isTruthy = (s: string) => s !== "" && s !== "0";
      const count = (args as string[]).filter(isTruthy).length;
      return String(count % 2 === 1 ? 1 : 0);
    },
  },

  // ── Geometry ─────────────────────────────────────────────────────────────────

  dist2d: {
    minArgs: 4, maxArgs: 4,
    exec(args) {
      const [x1, y1, x2, y2] = (args as string[]).map(toNum);
      return fmt(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2));
    },
  },

  dist3d: {
    minArgs: 6, maxArgs: 6,
    exec(args) {
      const [x1, y1, z1, x2, y2, z2] = (args as string[]).map(toNum);
      return fmt(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2));
    },
  },

  // ── Numeral / text ───────────────────────────────────────────────────────────

  roman: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = Math.trunc(toNum((args as string[])[0]));
      if (n < 1 || n > 3999) throw new Error("ARGUMENT OUT OF RANGE");
      const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
      const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
      let result = "", rem = n;
      for (let i = 0; i < vals.length; i++) {
        while (rem >= vals[i]) { result += syms[i]; rem -= vals[i]; }
      }
      return result;
    },
  },

  spellnum: {
    minArgs: 1, maxArgs: 1,
    exec(args) {
      const n = Math.trunc(toNum((args as string[])[0]));
      return spellNumber(n);
    },
  },

  baseconv: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [numStr, fromBaseStr, toBaseStr] = args as string[];
      const fromBase = Math.trunc(toNum(fromBaseStr));
      const toBase   = Math.trunc(toNum(toBaseStr));
      if (fromBase < 2 || fromBase > 36) throw new Error("INVALID BASE");
      if (toBase   < 2 || toBase   > 36) throw new Error("INVALID BASE");
      const value = parseInt(numStr.trim(), fromBase);
      if (isNaN(value)) throw new Error(`ARGUMENT (${numStr}) IS NOT A NUMBER`);
      return value.toString(toBase);
    },
  },

  // ── Vector math ──────────────────────────────────────────────────────────────

  vadd: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const delim = a[2] ?? " ";
      const v1 = a[0].split(delim).filter(s => s !== "").map(toNum);
      const v2 = a[1].split(delim).filter(s => s !== "").map(toNum);
      if (v1.length !== v2.length) throw new Error("VECTORS MUST BE SAME LENGTH");
      return v1.map((x, i) => fmt(x + v2[i])).join(delim === " " ? " " : delim);
    },
  },

  vsub: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const delim = a[2] ?? " ";
      const v1 = a[0].split(delim).filter(s => s !== "").map(toNum);
      const v2 = a[1].split(delim).filter(s => s !== "").map(toNum);
      if (v1.length !== v2.length) throw new Error("VECTORS MUST BE SAME LENGTH");
      return v1.map((x, i) => fmt(x - v2[i])).join(delim === " " ? " " : delim);
    },
  },

  vmul: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const delim  = a[2] ?? " ";
      const scalar = toNum(a[1]);
      const v = a[0].split(delim).filter(s => s !== "").map(toNum);
      return v.map(x => fmt(x * scalar)).join(delim === " " ? " " : delim);
    },
  },

  vdot: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const delim = a[2] ?? " ";
      const v1 = a[0].split(delim).filter(s => s !== "").map(toNum);
      const v2 = a[1].split(delim).filter(s => s !== "").map(toNum);
      if (v1.length !== v2.length) throw new Error("VECTORS MUST BE SAME LENGTH");
      return fmt(v1.reduce((sum, x, i) => sum + x * v2[i], 0));
    },
  },

  vcross: {
    minArgs: 2, maxArgs: 3,
    exec(args) {
      const a = args as string[];
      const delim = a[2] ?? " ";
      const v1 = a[0].split(delim).filter(s => s !== "").map(toNum);
      const v2 = a[1].split(delim).filter(s => s !== "").map(toNum);
      if (v1.length !== 3 || v2.length !== 3) throw new Error("#-1");
      const cx = fmt(v1[1] * v2[2] - v1[2] * v2[1]);
      const cy = fmt(v1[2] * v2[0] - v1[0] * v2[2]);
      const cz = fmt(v1[0] * v2[1] - v1[1] * v2[0]);
      return [cx, cy, cz].join(delim === " " ? " " : delim);
    },
  },

  vmag: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      const delim = a[1] ?? " ";
      const v = a[0].split(delim).filter(s => s !== "").map(toNum);
      return fmt(Math.sqrt(v.reduce((sum, x) => sum + x ** 2, 0)));
    },
  },

  vunit: {
    minArgs: 1, maxArgs: 2,
    exec(args) {
      const a = args as string[];
      const delim = a[1] ?? " ";
      const v   = a[0].split(delim).filter(s => s !== "").map(toNum);
      const mag = Math.sqrt(v.reduce((sum, x) => sum + x ** 2, 0));
      if (mag === 0) throw new Error("ZERO VECTOR");
      return v.map(x => fmt(x / mag)).join(delim === " " ? " " : delim);
    },
  },

  sign: {
    minArgs: 1, maxArgs: 1,
    exec(args) { return String(Math.sign(toNum((args as string[])[0]))); },
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
    exec(args) { return fmt(Math.exp(toNum((args as string[])[0]))); },
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
      if (xStr !== undefined) return fmt(Math.atan2(toNum(yStr), toNum(xStr)));
      return fmt(Math.atan(toNum(yStr)));
    },
  },

  pi: { minArgs: 0, maxArgs: 0, exec() { return "3.141592653589793"; } },
  e:  { minArgs: 0, maxArgs: 0, exec() { return "2.718281828459045"; } },

  bound: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [nStr, lowStr, highStr] = args as string[];
      return fmt(Math.min(Math.max(toNum(nStr), toNum(lowStr)), toNum(highStr)));
    },
  },

  between: {
    minArgs: 3, maxArgs: 3,
    exec(args) {
      const [nStr, lowStr, highStr] = args as string[];
      const n = toNum(nStr);
      return (n >= toNum(lowStr) && n <= toNum(highStr)) ? "1" : "0";
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

// ── spellnum helper ───────────────────────────────────────────────────────────

const ones  = ["","one","two","three","four","five","six","seven","eight","nine",
               "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen",
               "seventeen","eighteen","nineteen"];
const tens  = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];

function spellBelow1000(n: number): string {
  if (n === 0) return "";
  if (n < 20)  return ones[n];
  if (n < 100) {
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t}-${o}` : t;
  }
  const h   = Math.floor(n / 100);
  const rem = n % 100;
  const hundredPart = `${ones[h]} hundred`;
  if (rem === 0) return hundredPart;
  return `${hundredPart} and ${spellBelow1000(rem)}`;
}

function spellNumber(n: number): string {
  if (n === 0) return "zero";
  const sign = n < 0 ? "negative " : "";
  const abs  = Math.abs(n);
  const millions  = Math.floor(abs / 1_000_000);
  const thousands = Math.floor((abs % 1_000_000) / 1_000);
  const remainder = abs % 1_000;
  const parts: string[] = [];
  if (millions)  parts.push(`${spellBelow1000(millions)} million`);
  if (thousands) parts.push(`${spellBelow1000(thousands)} thousand`);
  if (remainder) parts.push(spellBelow1000(remainder));
  return sign + parts.join(" ");
}
