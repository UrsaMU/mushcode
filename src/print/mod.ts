/**
 * @module
 * Converts an AST back to a canonical softcode string via `print()`.
 * Supports compact (semicolon-separated) and pretty (newline-separated) modes.
 */
export type { PrintMode, PrintOptions } from "./printer.ts";
export { print }                        from "./printer.ts";
