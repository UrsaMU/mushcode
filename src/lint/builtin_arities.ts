/**
 * Known arity ranges for TinyMUX / RhostMUSH built-in functions.
 * [minArgs, maxArgs] — use Infinity for unlimited upper bound.
 *
 * Only strictly-bounded functions are listed.  Omitting a function means the
 * arg-count rule skips it entirely (no false positives for unknown functions).
 */
export const ARITIES: Readonly<Record<string, [number, number]>> = {
  // Arithmetic
  add:     [1, Infinity],
  sub:     [1, Infinity],
  mul:     [1, Infinity],
  div:     [2, 2],
  mod:     [2, 2],
  abs:     [1, 1],
  // Comparison
  eq:      [2, 2],
  neq:     [2, 2],
  gt:      [2, 2],
  gte:     [2, 2],
  lt:      [2, 2],
  lte:     [2, 2],
  // Logic
  and:     [1, Infinity],
  or:      [1, Infinity],
  not:     [1, 1],
  // Control flow
  if:      [2, 3],
  ifelse:  [3, 3],
  switch:  [3, Infinity],
  // Registers
  setq:    [2, 2],
  r:       [1, 1],
  // Iteration
  iter:    [2, 4],
  map:     [2, 4],
  filter:  [2, 3],
  // Object / attribute
  name:    [1, 1],
  loc:     [1, 1],
  get:     [1, 1],
  set:     [2, 2],
  v:       [1, 1],
  u:       [1, Infinity],
  hasflag: [2, 2],
  hasattr: [2, 2],
  // String
  strlen:  [1, 1],
  mid:     [3, 3],
  left:    [2, 2],
  right:   [2, 2],
  trim:    [1, 3],
  ljust:   [2, 3],
  rjust:   [2, 3],
  center:  [2, 3],
  // List / matching
  words:   [1, 2],
  match:   [2, 3],
  pmatch:  [1, 1],
  lcon:    [1, 2],
  lwho:    [0, 1],
  // Formatting
  ansi:    [2, Infinity],
  // Tags (RhostMUSH)
  tag:         [1, 1],
  listtags:    [0, 1],
  tagmatch:    [1, 1],
};
