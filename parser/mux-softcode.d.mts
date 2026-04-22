// Type declarations for the Peggy-generated parser.
// deno-lint-ignore-file

export declare class SyntaxError extends Error {
  message: string;
  // deno-lint-ignore no-explicit-any
  location?: { start: { offset: number; line: number; column: number }; [key: string]: any };
}

export declare const StartRules: string[];

// deno-lint-ignore no-explicit-any
export declare function parse(input: string, options?: { startRule?: string; [key: string]: any }): any;
