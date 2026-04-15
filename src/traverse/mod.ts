/**
 * @module
 * Depth-first AST traversal and tree transformation utilities:
 * `walk()`, `transform()`, `findAll()`, `findFirst()`, `findFirstOrNull()`.
 *
 * @example
 * ```ts
 * import { parse }   from "@ursamu/mushcode/parse";
 * import { findAll } from "@ursamu/mushcode/traverse";
 *
 * const ast = parse("[add(1,[mul(2,3)])]");
 * const calls = findAll(ast, "FunctionCall");
 * console.log(calls.map(n => n.name)); // ["add", "mul"]
 * ```
 */
export type { Visitor }                                     from "./walk.ts";
export { walk, findAll, findFirst, findFirstOrNull }        from "./walk.ts";
export type { Transformer }                                 from "./transform.ts";
export { transform }                                        from "./transform.ts";
