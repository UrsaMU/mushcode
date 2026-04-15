import type { FunctionImpl } from "../context.ts";

export const registerFunctions: Record<string, FunctionImpl> = {
  /** setq(reg, value) — store value in named register; returns "". */
  setq: {
    minArgs: 2, maxArgs: 2,
    exec(args, ctx) {
      const [reg, val] = args as string[];
      ctx.registers.set(reg, val);
      return "";
    },
  },

  /** r(reg) — read named register (empty string if unset). */
  r: {
    minArgs: 1, maxArgs: 1,
    exec(args, ctx) {
      return ctx.registers.get((args as string[])[0]) ?? "";
    },
  },

  /** setr(reg, value) — like setq but returns value. */
  setr: {
    minArgs: 2, maxArgs: 2,
    exec(args, ctx) {
      const [reg, val] = args as string[];
      ctx.registers.set(reg, val);
      return val;
    },
  },
};
