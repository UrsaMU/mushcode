/** A character offset, line number (1-based), and column (1-based) in source text. */
interface SourcePosition {
    /** Zero-based byte offset from the start of the source string. */
    offset: number;
    /** One-based line number. */
    line: number;
    /** One-based column number within the line. */
    column: number;
}
/** The start and end {@link SourcePosition} of an AST node in the original source. */
interface SourceLocation {
    /** Position of the first character of the node. */
    start: SourcePosition;
    /** Position one past the last character of the node. */
    end: SourcePosition;
}
/**
 * A generic AST node.  Every node has a `type` discriminant string and an
 * optional `loc` source location.  Additional properties are node-specific
 * (e.g. `value` on Literal, `name` on FunctionCall).
 */
type ASTNode = {
    type: string;
    loc?: SourceLocation;
    [key: string]: any;
};
/** Thrown when the parser encounters a syntax error in the softcode input. */
declare class ParseError extends Error {
    readonly location?: {
        line: number;
        column: number;
        offset: number;
    } | undefined;
    constructor(message: string, location?: {
        line: number;
        column: number;
        offset: number;
    } | undefined);
}
/** Which top-level grammar rule to use as the parse entry point. */
type StartRule = "Start" | "LockExpr";
/**
 * Parse a raw softcode string and return its AST root node.
 *
 * @param text      The softcode source to parse.
 * @param startRule Grammar entry point — `"Start"` for normal softcode (default),
 *                  `"LockExpr"` for lock-expression strings.
 * @throws {@link ParseError} on syntax errors.
 */
declare function parse(text: string, startRule?: StartRule): ASTNode;

/** Controls how `CommandList` separators are rendered in the output. */
type PrintMode = "compact" | "pretty";
/** Options for the {@link print} function. */
interface PrintOptions {
    /** "compact" (default): CommandList joined by ";".
     *  "pretty": CommandList joined by ";\n". */
    mode?: PrintMode;
}
/**
 * Convert an AST node back to a canonical softcode string.
 *
 * The output is semantically equivalent to the original source but whitespace
 * may be normalised (e.g. `@pemit%#=x` becomes `@pemit %#=x`).
 * Lock-expression nodes (LockOr, LockAnd, …) produced by the "LockExpr" start
 * rule are printed via the lock printer.
 */
declare function print(node: ASTNode, opts?: PrintOptions): string;

export { type ASTNode, ParseError, type PrintMode, type PrintOptions, type SourceLocation, type SourcePosition, type StartRule, parse, print };
