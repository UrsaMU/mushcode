/**
 * @module
 * Full-featured MUX/RhostMUSH softcode toolkit: parser, AST traversal,
 * canonical printer, static linter, dependency analyzer, and evaluator.
 *
 * @example
 * ```ts
 * import { parse, lint, print, EvalEngine, makeContext, registerStdlib } from "@ursamu/mushcode";
 *
 * const ast   = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
 * const diags = lint(ast);
 * console.log(print(ast)); // "$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]"
 *
 * const engine = new EvalEngine({
 *   getAttr: async (_id, _attr) => null,
 *   resolveTarget: async (_from, expr) => expr === "me" ? "player-uuid" : null,
 *   getName: async (_id) => "Tester",
 *   hasFlag: async (_id, _flag) => false,
 * });
 * registerStdlib(engine);
 * const result = await engine.evalString("[add(1,2)]", makeContext({ enactor: "player-uuid", executor: "player-uuid" }));
 * console.log(result); // "3"
 * ```
 */
// @ursamu/mushcode — MUX/RhostMUSH softcode toolkit
//
// Sub-path imports are also available for tree-shaking:
//   import { parse }     from "@ursamu/mushcode/parse"
//   import { walk }      from "@ursamu/mushcode/traverse"
//   import { print }     from "@ursamu/mushcode/print"
//   import { lint }      from "@ursamu/mushcode/lint"
//   import { extractCommands } from "@ursamu/mushcode/analyze"

// ── Parse ─────────────────────────────────────────────────────────────────────
export { parse, ParseError }                        from "./parser/mod.ts";
export type { ASTNode, NodeType, StartRule,
              SourceLocation, SourcePosition }      from "./parser/mod.ts";

// ── Traverse ──────────────────────────────────────────────────────────────────
export { walk, transform, findAll, findFirst, findFirstOrNull }
                                                    from "./src/traverse/mod.ts";
export type { Visitor, Transformer }                from "./src/traverse/mod.ts";

// ── Print ─────────────────────────────────────────────────────────────────────
export { print }                                    from "./src/print/mod.ts";
export type { PrintOptions, PrintMode }             from "./src/print/mod.ts";

// ── Lint ──────────────────────────────────────────────────────────────────────
export { lint, RULES }                              from "./src/lint/mod.ts";
export type { Diagnostic, Severity, LintOptions, RuleId }
                                                    from "./src/lint/mod.ts";

// ── Analyze ───────────────────────────────────────────────────────────────────
export { extractCommands, extractDeps, extractTagRefs }
                                                    from "./src/analyze/mod.ts";
export type { PatternEntry, DepEntry }              from "./src/analyze/mod.ts";

// ── Eval ──────────────────────────────────────────────────────────────────────
export { EvalEngine, makeContext, registerStdlib }  from "./src/eval/mod.ts";
export type {
  EvalContext, EvalThunk, ObjectAccessor, IEvalEngine,
  FunctionImpl, CommandImpl, IterFrame,
}                                                   from "./src/eval/mod.ts";
