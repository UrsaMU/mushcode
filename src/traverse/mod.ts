/**
 * @module
 * Depth-first AST traversal and tree transformation utilities:
 * `walk()`, `transform()`, `findAll()`, `findFirst()`, `findFirstOrNull()`.
 */
export type { Visitor }                                     from "./walk.ts";
export { walk, findAll, findFirst, findFirstOrNull }        from "./walk.ts";
export type { Transformer }                                 from "./transform.ts";
export { transform }                                        from "./transform.ts";
