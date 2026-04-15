# Lint

```typescript
import { lint, RULES } from "jsr:@ursamu/mushcode/lint";
import type { Diagnostic, Severity, LintOptions, RuleId } from "jsr:@ursamu/mushcode/lint";
```

## `lint(root, opts?)`

Run static analysis on an AST and return an array of diagnostics. All four
built-in rules run by default.

```typescript
function lint(root: ASTNode, opts?: LintOptions): Diagnostic[]
```

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";
import { lint }  from "jsr:@ursamu/mushcode/lint";

const ast   = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
const diags = lint(ast);
diags.forEach(d => console.log(`[${d.severity}] ${d.rule}: ${d.message}`));
```

## `LintOptions`

```typescript
interface LintOptions {
  rules?: string[]; // subset of RULES to enable; omit to run all
}
```

Run only specific rules:

```typescript
const diags = lint(ast, { rules: ["missing-wildcard", "arg-count"] });
```

## `RULES`

Tuple of every built-in rule ID:

```typescript
const RULES = [
  "missing-wildcard",
  "iter-var-outside-iter",
  "arg-count",
  "register-before-set",
] as const;

type RuleId = (typeof RULES)[number];
```

## `Diagnostic`

```typescript
interface Diagnostic {
  rule:     string;   // rule ID that produced this diagnostic
  severity: Severity; // "error" | "warning" | "info"
  message:  string;
  node:     ASTNode;  // AST node most closely associated with the issue
}

type Severity = "error" | "warning" | "info";
```

The `node` field can be used with its `loc` property to report source positions:

```typescript
diags.forEach(d => {
  const loc = d.node.loc?.start;
  const pos = loc ? ` (line ${loc.line}, col ${loc.column})` : "";
  console.error(`[${d.severity}] ${d.rule}${pos}: ${d.message}`);
});
```

## Built-in rules

### `missing-wildcard`

A `DollarPattern` or `ListenPattern` has no wildcard (`*` or `?`) segment in
its pattern. This usually means the trigger will only fire on an exact string
match with no arguments, which is rarely intentional.

```typescript
// triggers the rule — "$finger" matches only the literal string "finger"
lint(parse("$finger:@pemit %#=ok"));

// clean — "$finger *" accepts one wildcard argument
lint(parse("$finger *:@pemit %#=ok"));
```

### `iter-var-outside-iter`

`##` (iter item) or `#@` (iter index) is used outside of an `iter()` function
call. These special variables are only defined inside an iteration body; using
them elsewhere always produces an empty string.

```typescript
// triggers the rule — ## used at top level
lint(parse("@pemit %#=##"));

// clean — ## inside iter body
lint(parse("[iter(a b c,##)]"));
```

### `arg-count`

A built-in function is called with fewer arguments than its `minArgs` or more
than its `maxArgs`. The rule checks against known function arities for all
functions registered in the standard library.

```typescript
// triggers the rule — add() requires at least 2 arguments
lint(parse("[add(1)]"));

// triggers the rule — sub() takes exactly 2 arguments
lint(parse("[sub(1,2,3)]"));
```

### `register-before-set`

A named register (`%qX` or `r(X)`) is read before `setq(X, …)` has been called
anywhere in the same expression tree. This does not track runtime flow, only
whether any `setq` for that register name appears anywhere in the tree.

```typescript
// triggers the rule — %q0 read before any setq(0, …)
lint(parse("[r(0)] [setq(0,hello)]"));

// clean — setq before r
lint(parse("[setq(0,hello)][r(0)]"));
```

## Example: format diagnostics as editor annotations

```typescript
import { parse }                from "jsr:@ursamu/mushcode/parse";
import { lint }                 from "jsr:@ursamu/mushcode/lint";
import type { Diagnostic }      from "jsr:@ursamu/mushcode/lint";

function annotate(src: string): { line: number; col: number; message: string }[] {
  const ast   = parse(src);
  const diags = lint(ast);
  return diags.map((d: Diagnostic) => ({
    line:    d.node.loc?.start.line    ?? 1,
    col:     d.node.loc?.start.column  ?? 1,
    message: `[${d.rule}] ${d.message}`,
  }));
}
```
