/**
 * @module
 * Structural analysis of softcode: extract `$command`/`^listen` patterns,
 * dependency edges (`u()`, `@trigger`, `get()`), and `#tagname` references.
 *
 * @example
 * ```ts
 * import { parse }           from "@ursamu/mushcode/parse";
 * import { extractCommands } from "@ursamu/mushcode/analyze";
 *
 * const ast  = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
 * const cmds = extractCommands(ast);
 * console.log(cmds[0].patternText); // "+finger *"
 * ```
 */
export type { PatternEntry }                      from "./commands.ts";
export { extractCommands }                         from "./commands.ts";
export type { DepEntry }                           from "./deps.ts";
export { extractDeps }                             from "./deps.ts";
export { extractTagRefs }                          from "./tags.ts";
