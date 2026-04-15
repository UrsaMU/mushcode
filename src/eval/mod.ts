/**
 * @module
 * AST-based softcode evaluator: `EvalEngine`, `makeContext()`, `registerStdlib()`,
 * and the full type vocabulary for contexts, accessors, and function registrations.
 */
export { EvalEngine }          from "./engine.ts";
export { makeContext }         from "./context.ts";
export { registerStdlib }      from "./stdlib/mod.ts";
export type {
  EvalContext, EvalThunk,
  ObjectAccessor, IEvalEngine,
  FunctionImpl, CommandImpl,
  IterFrame,
}                              from "./context.ts";
