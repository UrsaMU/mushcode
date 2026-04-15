/**
 * @module
 * Structural analysis of softcode: extract `$command`/`^listen` patterns,
 * dependency edges (`u()`, `@trigger`, `get()`), and `#tagname` references.
 */
export type { PatternEntry }                      from "./commands.ts";
export { extractCommands }                         from "./commands.ts";
export type { DepEntry }                           from "./deps.ts";
export { extractDeps }                             from "./deps.ts";
export { extractTagRefs }                          from "./tags.ts";
