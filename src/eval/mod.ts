/**
 * @module
 * AST-based softcode evaluator: `EvalEngine`, `makeContext()`, `registerStdlib()`,
 * and the full type vocabulary for contexts, accessors, and function registrations.
 *
 * @example
 * ```ts
 * import { EvalEngine, makeContext, registerStdlib } from "@ursamu/mushcode/eval";
 *
 * const engine = new EvalEngine({
 *   getAttr: async (_id, _attr) => null,
 *   resolveTarget: async (_from, expr) => expr === "me" ? "player-uuid" : null,
 *   getName: async (_id) => "Tester",
 *   hasFlag: async (_id, _flag) => false,
 * });
 * registerStdlib(engine);
 *
 * const ctx    = makeContext({ enactor: "player-uuid", executor: "player-uuid" });
 * const result = await engine.evalString("[add(1,2)] [capstr(hello)]", ctx);
 * console.log(result); // "3 Hello"
 * ```
 */
export { EvalEngine }          from "./engine.ts";
export { makeContext }         from "./context.ts";
export { registerStdlib }      from "./stdlib/mod.ts";
export type {
  EvalContext, EvalThunk,
  ObjectAccessor, IEvalEngine,
  FunctionImpl, CommandImpl,
  IterFrame, SubHandlerFn, CommandFallbackFn,
}                              from "./context.ts";
