/**
 * @module
 * Converts an AST back to a canonical softcode string via `print()`.
 * Supports compact (semicolon-separated) and pretty (newline-separated) modes.
 *
 * @example
 * ```ts
 * import { parse } from "@ursamu/mushcode/parse";
 * import { print } from "@ursamu/mushcode/print";
 *
 * const ast = parse("@pemit %#=Hello;@pemit %#=World");
 * console.log(print(ast, { mode: "pretty" }));
 * // @pemit %#=Hello
 * // @pemit %#=World
 * ```
 */
export type { PrintMode, PrintOptions } from "./printer.ts";
export { print }                        from "./printer.ts";
