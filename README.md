# @ursamu/mushcode

[![JSR version](https://jsr.io/badges/@ursamu/mushcode)](https://jsr.io/@ursamu/mushcode) v0.6.0

A MUX/RhostMUSH softcode toolkit for Deno and JSR. Parses softcode into an AST,
evaluates it, lints it for common mistakes, prints it back to canonical text, and
extracts structural information from it.

## Installation

```typescript
import { parse, EvalEngine, lint, print, walk } from "jsr:@ursamu/mushcode";
```

Sub-path imports are available for tree-shaking:

| Import path              | Exports                                                                                    |
|--------------------------|--------------------------------------------------------------------------------------------|
| `jsr:@ursamu/mushcode`   | everything below, combined                                                                 |
| `…/parse`                | `parse`, `ParseError`, `ASTNode`, `SourceLocation`, `NodeType`, `StartRule`               |
| `…/traverse`             | `walk`, `transform`, `findAll`, `findFirst`, `findFirstOrNull`                             |
| `…/print`                | `print`, `PrintOptions`, `PrintMode`                                                       |
| `…/lint`                 | `lint`, `RULES`, `Diagnostic`, `Severity`, `LintOptions`, `RuleId`                        |
| `…/analyze`              | `extractCommands`, `extractDeps`, `extractTagRefs`, `PatternEntry`, `DepEntry`             |
| `…/eval`                 | `EvalEngine`, `makeContext`, `registerStdlib`, `ObjectAccessor`, `EvalContext`, and more   |
| `…/pattern`              | `matchPattern`, `execPattern`, `PatternMatch`                                              |

## Quick start

### Parse

```typescript
import { parse, ParseError } from "jsr:@ursamu/mushcode";

const ast = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
console.log(ast.type); // "DollarPattern"

// Lock expressions use the second argument
const lock = parse("flag^WIZARD|attr^STAFF:1", "LockExpr");
```

### Traverse

```typescript
import { parse, findAll } from "jsr:@ursamu/mushcode";

const ast = parse("[add(1,[mul(2,3)])]");
const calls = findAll(ast, "FunctionCall");
console.log(calls.map(n => n.name)); // ["add", "mul"]
```

### Print

```typescript
import { parse, print } from "jsr:@ursamu/mushcode";

const ast = parse("@pemit %#=Hello;@pemit %#=World");
console.log(print(ast, { mode: "pretty" }));
// @pemit %#=Hello
// @pemit %#=World
```

### Lint

```typescript
import { parse, lint } from "jsr:@ursamu/mushcode";

const ast = parse("$finger:@pemit %#=[u(me/FN)]");
const diags = lint(ast);
diags.forEach(d => console.log(`[${d.severity}] ${d.rule}: ${d.message}`));
```

### Analyze

```typescript
import { parse, extractCommands } from "jsr:@ursamu/mushcode";

const ast  = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");
const cmds = extractCommands(ast);
console.log(cmds[0].patternText); // "+finger *"
```

### Evaluate

```typescript
import { EvalEngine, makeContext, registerStdlib } from "jsr:@ursamu/mushcode";

const engine = new EvalEngine({
  async getAttr(id, attr)            { return null; },
  async resolveTarget(from, expr)    { return expr === "me" ? from : null; },
  async getName(id)                  { return "Tester"; },
  async hasFlag(id, flag)            { return false; },
});
registerStdlib(engine);

const ctx    = makeContext({ enactor: "player-uuid", executor: "player-uuid" });
const result = await engine.evalString("[add(1,2)] [capstr(hello)]", ctx);
console.log(result); // "3 Hello"

// evalShallow expands [...] but keeps {...} literal — useful for @command dispatch
const ast     = parse("[add(1,2)] {literal}");
const shallow = await engine.evalShallow(ast, ctx);
console.log(shallow); // "3 {literal}"
```

### Pattern matching

```typescript
import { matchPattern, execPattern } from "jsr:@ursamu/mushcode/pattern";
import { parse } from "jsr:@ursamu/mushcode/parse";

// Pure pattern test
const patternNode = parse("$+finger *", "DollarPattern");
const match = matchPattern(patternNode, "+finger Alice");
if (match) {
  console.log(match.captures); // ["+finger Alice", "Alice"]
}

// Full $pattern:action dispatch pipeline
// Reads attrSource for "$pattern:action", matches input, evaluates action with captures
const result = await execPattern(
  "$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]",
  "+finger Alice",
  ctx,
  engine,
);
```

## Documentation

- [Parser](docs/parser.md) — `parse()`, AST node types, source locations
- [Traverse](docs/traverse.md) — `walk()`, `transform()`, `findAll()`, `findFirst()`
- [Print](docs/print.md) — `print()`, compact and pretty modes
- [Lint](docs/lint.md) — `lint()`, built-in rules, custom rule selection
- [Analyze](docs/analyze.md) — `extractCommands()`, `extractDeps()`, `extractTagRefs()`
- [Eval](docs/eval.md) — `EvalEngine`, `makeContext()`, `ObjectAccessor`
- [Stdlib](docs/stdlib.md) — all built-in softcode functions

## License

MIT
