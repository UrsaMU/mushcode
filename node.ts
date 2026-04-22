// Minimal Node.js entry point — only parse + print.
// Avoids pulling in the eval engine (which has Deno-specific stdlib deps).
export { parse, ParseError }           from "./parser/mod.ts";
export type { ASTNode, StartRule,
              SourceLocation,
              SourcePosition }         from "./parser/mod.ts";
export { print }                       from "./src/print/mod.ts";
export type { PrintOptions, PrintMode } from "./src/print/mod.ts";
