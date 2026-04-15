// Thin Deno wrapper around the Peggy-generated ESM parser.
// Generated with:  npx peggy --format es --allowed-start-rules Start,LockExpr \
//                   -o parser/mux-softcode.mjs grammar/mux-softcode.pegjs

import {
  parse as _parse,
  SyntaxError as _SyntaxError,
} from "./mux-softcode.mjs";

// ── AST Types (mirrors grammar rule names) ───────────────────────────────────

/** Union of every node `type` string the parser can produce. */
export type NodeType =
  | "Literal" | "Escape" | "Substitution" | "SpecialVar" | "Wildcard"
  | "EvalBlock" | "BracedString" | "Text" | "Arg"
  | "FunctionCall" | "DollarPattern" | "ListenPattern"
  | "PatternAlts" | "Pattern"
  | "CommandList" | "AtCommand" | "AttributeSet" | "UserCommand"
  | "TagRef"
  | "LockOr" | "LockAnd" | "LockNot" | "LockMe" | "LockDbref"
  | "LockFlagCheck" | "LockTypeCheck" | "LockAttrCheck" | "LockPlayerName";

/** A character offset, line number (1-based), and column (1-based) in source text. */
export interface SourcePosition {
  offset: number;
  line:   number;
  column: number;
}

/** The start and end {@link SourcePosition} of an AST node in the original source. */
export interface SourceLocation {
  start: SourcePosition;
  end:   SourcePosition;
}

/**
 * A generic AST node.  Every node has a `type` discriminant string and an
 * optional `loc` source location.  Additional properties are node-specific
 * (e.g. `value` on Literal, `name` on FunctionCall).
 */
// deno-lint-ignore no-explicit-any
export type ASTNode = { type: string; loc?: SourceLocation; [key: string]: any };

/** Thrown when the parser encounters a syntax error in the softcode input. */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly location?: { line: number; column: number; offset: number },
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/** Which top-level grammar rule to use as the parse entry point. */
export type StartRule = "Start" | "LockExpr";

/**
 * Parse a raw softcode string and return its AST root node.
 *
 * @param text      The softcode source to parse.
 * @param startRule Grammar entry point — `"Start"` for normal softcode (default),
 *                  `"LockExpr"` for lock-expression strings.
 * @throws {@link ParseError} on syntax errors.
 */
export function parse(text: string, startRule: StartRule = "Start"): ASTNode {
  try {
    return _parse(text, { startRule }) as ASTNode;
  } catch (err) {
    if (err instanceof _SyntaxError) {
      const loc = (err as {
        location?: { start: { line: number; column: number; offset: number } };
      }).location?.start;
      throw new ParseError((err as Error).message, loc);
    }
    throw err;
  }
}
