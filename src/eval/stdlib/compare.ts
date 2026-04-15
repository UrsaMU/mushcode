import type { FunctionImpl } from "../context.ts";

function toNum(s: string): number {
  const n = Number(s);
  if (!isFinite(n)) throw new Error(`ARGUMENT (${s}) IS NOT A NUMBER`);
  return n;
}

export const compareFunctions: Record<string, FunctionImpl> = {
  eq:  { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) === toNum(b) ? "1" : "0"; } },
  neq: { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) !== toNum(b) ? "1" : "0"; } },
  gt:  { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) >   toNum(b) ? "1" : "0"; } },
  gte: { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) >=  toNum(b) ? "1" : "0"; } },
  lt:  { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) <   toNum(b) ? "1" : "0"; } },
  lte: { minArgs: 2, maxArgs: 2, exec(args) { const [a,b] = args as string[]; return toNum(a) <=  toNum(b) ? "1" : "0"; } },
};
