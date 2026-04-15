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
