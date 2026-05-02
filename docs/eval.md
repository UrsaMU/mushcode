# Eval

```typescript
import { EvalEngine, makeContext, registerStdlib } from "jsr:@ursamu/mushcode/eval";
import type {
  EvalContext, EvalThunk, ObjectAccessor, IEvalEngine,
  FunctionImpl, CommandImpl, IterFrame,
} from "jsr:@ursamu/mushcode/eval";
```

## Quick start

```typescript
import { EvalEngine, makeContext, registerStdlib } from "jsr:@ursamu/mushcode/eval";

// 1. Implement ObjectAccessor against your database
const accessor: ObjectAccessor = {
  async getAttr(id, attr)         { return myDb.getAttr(id, attr); },
  async resolveTarget(from, expr) { return myDb.resolve(from, expr); },
  async getName(id)               { return myDb.getName(id); },
  async hasFlag(id, flag)         { return myDb.hasFlag(id, flag); },
};

// 2. Create engine and load stdlib
const engine = new EvalEngine(accessor);
registerStdlib(engine);

// 3. Build a context and evaluate
const ctx    = makeContext({ enactor: "player-uuid", executor: "object-uuid" });
const result = await engine.evalString("[add(1,2)]", ctx);
console.log(result); // "3"
```

## `ObjectAccessor`

The interface your host application must implement to connect the evaluator to
your game database. All methods return Promises.

```typescript
interface ObjectAccessor {
  /** Read a named attribute from an object. Returns null if absent. */
  getAttr(objectId: string, attr: string): Promise<string | null>;

  /** Resolve a target expression to a UUID. Returns null if not found. */
  resolveTarget(from: string, expr: string): Promise<string | null>;

  /** Return the display name of an object. */
  getName(objectId: string): Promise<string>;

  /** Check whether an object has a flag. */
  hasFlag(objectId: string, flag: string): Promise<boolean>;
}
```

`resolveTarget` receives expressions like `"me"`, `"#uuid"`, `"ObjectName"`,
or the printed form of an eval block. You decide how to resolve them.

### Minimal in-memory implementation

```typescript
const objects = new Map([
  ["uuid-1", { name: "Alice", attrs: new Map([["DESC", "A person."]]), flags: new Set(["CONNECTED"]) }],
]);

const accessor: ObjectAccessor = {
  async getAttr(id, attr) {
    return objects.get(id)?.attrs.get(attr.toUpperCase()) ?? null;
  },
  async resolveTarget(from, expr) {
    if (expr === "me") return from;
    for (const [id, obj] of objects) {
      if (id === expr || obj.name === expr) return id;
    }
    return null;
  },
  async getName(id) {
    return objects.get(id)?.name ?? "#-1 NO SUCH OBJECT";
  },
  async hasFlag(id, flag) {
    return objects.get(id)?.flags.has(flag) ?? false;
  },
};
```

## `EvalEngine`

```typescript
class EvalEngine implements IEvalEngine {
  constructor(accessor: ObjectAccessor)

  registerFunction(name: string, impl: FunctionImpl): this
  registerCommand(name: string, impl: CommandImpl): this

  evalString(source: string, ctx: EvalContext): Promise<string>
  eval(node: ASTNode, ctx: EvalContext): Promise<string>
  evalShallow(node: ASTNode, ctx: EvalContext): Promise<string>
  exec(node: ASTNode, ctx: EvalContext): Promise<void>

  readonly accessor: ObjectAccessor
}
```

- `evalString` parses the source string and evaluates it.
- `eval` evaluates an already-parsed `ASTNode` to a string.
- `evalShallow` evaluates an `ASTNode` but stops at `{braced strings}` — see below.
- `exec` executes a command node for its side effects (returns nothing).

Methods are chainable via `registerFunction` / `registerCommand` return `this`.

## `makeContext(partial)`

Create an `EvalContext` with safe defaults. The `enactor` and `executor` fields
are required; everything else is optional.

```typescript
function makeContext(
  partial: Partial<EvalContext> & Pick<EvalContext, "enactor" | "executor">
): EvalContext
```

```typescript
// Minimal context
const ctx = makeContext({ enactor: "player-1", executor: "player-1" });

// With positional args and a register pre-set
const ctx = makeContext({
  enactor:   "player-1",
  executor:  "object-5",
  args:      ["sword", "shield"],
  registers: new Map([["0", "initial"]]),
  maxDepth:  50,
});
```

## `EvalContext`

```typescript
interface EvalContext {
  enactor:   string;           // %# — who triggered the action
  executor:  string;           // %! — the object running the code
  caller:    string | null;    // %@ — previous executor (null at top level)
  args:      string[];         // %0–%9
  registers: Map<string, string>; // %q<name>, mutated by setq()
  iterStack: IterFrame[];      // ## and #@ — pushed/popped by iter()
  depth:     number;           // current u() recursion depth
  maxDepth:  number;           // recursion limit (default 100)
  signal?:   AbortSignal;      // optional cancellation
}
```

## `registerStdlib(engine)`

Load all built-in softcode functions onto an engine instance.

```typescript
function registerStdlib(engine: IEvalEngine): void
```

Call this once after creating your engine. You can add custom functions before
or after calling it.

See [stdlib.md](stdlib.md) for the full function reference.

## `evalShallow(ast, ctx)`

```typescript
evalShallow(ast: ASTNode, ctx: EvalContext): Promise<string>
```

Like `eval()` but stops at `{braced strings}` — those are kept as literal text
rather than being evaluated. `[...]` function-call blocks are still expanded
normally.

This mirrors how MUX itself evaluates an action attribute before routing it to
a command handler: the server expands inline function calls but leaves braced
arguments for the command to process later.

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";

const ast    = parse("[add(1,2)] {literal}");
const result = await engine.evalShallow(ast, ctx);
console.log(result); // "3 {literal}"
```

Use `evalShallow` in `@command` dispatch: evaluate the full command string
shallowly to resolve the command name and switch, then pass the brace-delimited
argument text to the command handler verbatim.

## Optional `ObjectAccessor` methods

The four methods in the base interface (`getAttr`, `resolveTarget`, `getName`,
`hasFlag`) are the only ones required to start evaluating softcode. A second set
of optional methods unlocks additional stdlib functions. When a method is absent,
the stdlib functions that depend on it return `""` or `#-1 NO MATCH` gracefully,
so you can add them incrementally as your game grows.

```typescript
interface ObjectAccessor {
  // --- required ---
  getAttr(objectId: string, attr: string): Promise<string | null>;
  resolveTarget(from: string, expr: string): Promise<string | null>;
  getName(objectId: string): Promise<string>;
  hasFlag(objectId: string, flag: string): Promise<boolean>;

  // --- optional — unlock additional stdlib functions ---
  getPronoun?(objectId: string, code: string): Promise<string | null> | string | null;
  getMoniker?(objectId: string): Promise<string | null> | string | null;
  getLocation?(id: string): Promise<string> | string;
  getContents?(id: string, type?: string): Promise<string[]> | string[];
  getConnectedPlayers?(): Promise<string[]> | string[];
  getParentChain?(id: string): Promise<string[]> | string[];
  findPlayer?(partial: string): Promise<string | null> | string | null;
  listAttrs?(objectId: string, pattern?: string): Promise<string[]> | string[];
  getType?(objectId: string): Promise<string> | string;
  findObject?(from: string, expr: string): Promise<string | null> | string | null;
}
```

| Method              | Unlocks                                      |
|---------------------|----------------------------------------------|
| `getPronoun`        | `%s`, `%o`, `%p`, `%a` pronoun substitutions |
| `getMoniker`        | `moniker()` / colored name display           |
| `getLocation`       | `loc()`, `%L` substitution                  |
| `getContents`       | `con()`, `lcon()`                            |
| `getConnectedPlayers` | `lwho()`, `conn()`, `doing()`              |
| `getParentChain`    | `hasattr()` with inheritance, `u()` chain    |
| `findPlayer`        | `pmatch()`, `locate()` player search         |
| `listAttrs`         | `lattr()`, `lattrp()`                        |
| `getType`           | `type()`, `istype()`                         |
| `findObject`        | `num()`, extended `locate()`                 |

## Pattern matching

```typescript
import { matchPattern, execPattern } from "jsr:@ursamu/mushcode/pattern";
// or from the main entry point:
import { matchPattern, execPattern } from "jsr:@ursamu/mushcode";
```

### `matchPattern(patternNode, input)`

```typescript
function matchPattern(patternNode: ASTNode, input: string): PatternMatch | null
```

Pure function. Tests `input` against a parsed `$pattern` node. Returns a
`PatternMatch` if the input matches, or `null` if it does not.

```typescript
interface PatternMatch {
  captures: string[]; // [0] = full match (%0), [1]–[9] = wildcard groups (%1–%9)
}
```

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";
import { matchPattern } from "jsr:@ursamu/mushcode/pattern";

const node  = parse("$+finger *", "DollarPattern");
const match = matchPattern(node, "+finger Alice");
// match.captures → ["+finger Alice", "Alice"]

const miss = matchPattern(node, "+look here");
// miss → null
```

### `execPattern(attrSource, input, ctx, engine)`

```typescript
function execPattern(
  attrSource: string,
  input:      string,
  ctx:        EvalContext,
  engine:     IEvalEngine,
): Promise<string | null>
```

Full `$pattern:action` dispatch pipeline:

1. Parses `attrSource` looking for a `$pattern:action` attribute value.
2. Calls `matchPattern` against `input`.
3. If the pattern matches, evaluates the action string with the wildcard captures
   bound to `%0`–`%9` in a child context.
4. Returns the evaluated result, or `null` if the pattern did not match.

```typescript
const result = await execPattern(
  "$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]",
  "+finger Alice",
  ctx,
  engine,
);
// result → null (no return value from @pemit) or the evaluated pemit text
```

Typical use in a MU* server: scan all attributes on an object for `$` patterns
and call `execPattern` on each one until a match is found.

## `childIsolated` / `childShared`

These helpers are exported from `./eval` for plugin authors implementing custom
UDF-style functions.

```typescript
import { childIsolated, childShared } from "jsr:@ursamu/mushcode/eval";

function childIsolated(ctx: EvalContext, overrides?: Partial<EvalContext>): EvalContext
function childShared(ctx: EvalContext, overrides?: Partial<EvalContext>): EvalContext
```

- `childIsolated` — creates a child context with a **fresh** register map.
  This is the semantics of `u()`: the called function starts with no `%q`
  registers inherited from the caller.
- `childShared` — creates a child context that **shares** the parent's register
  map by reference. This is the semantics of `ulocal()`: registers set inside
  the called function are visible to the caller after it returns.

Both functions increment `ctx.depth` and copy all other fields. Pass `overrides`
to set `args`, `executor`, or any other field at the same time.

```typescript
engine.registerFunction("myfunc", {
  minArgs: 1, maxArgs: 1,
  async exec(args, ctx, engine) {
    const child = childIsolated(ctx, { args: args as string[] });
    return engine.evalString("[add(%0,1)]", child);
  },
});
```

## `FunctionImpl`

Register a custom function:

```typescript
interface FunctionImpl {
  eval?:   "eager" | "lazy"; // default: "eager"
  minArgs: number;
  maxArgs: number;
  exec: (
    args:   string[] | EvalThunk[],
    ctx:    EvalContext,
    engine: IEvalEngine,
  ) => Promise<string> | string;
}
```

### Eager function (default)

Arguments are fully evaluated before `exec` is called. `args` is `string[]`.

```typescript
engine.registerFunction("double", {
  minArgs: 1, maxArgs: 1,
  exec(args) {
    return String(Number((args as string[])[0]) * 2);
  },
});

// [double(21)] → "42"
```

### Lazy function

Arguments are passed as `EvalThunk[]`. The function calls only the thunks it
needs. Required for short-circuit logic.

```typescript
engine.registerFunction("coalesce", {
  eval:    "lazy",
  minArgs: 1, maxArgs: Infinity,
  async exec(args) {
    for (const thunk of args as EvalThunk[]) {
      const val = await thunk();
      if (val !== "") return val;
    }
    return "";
  },
});
```

## `EvalThunk`

```typescript
type EvalThunk = (ctxOverride?: Partial<EvalContext>) => Promise<string>;
```

Calling a thunk evaluates its underlying AST node in the current context.
Pass a partial context override to temporarily change evaluation state — this
is how `iter()` sets `##` and `#@` without mutating the parent context.

## `CommandImpl`

Register a custom `@command`:

```typescript
interface CommandImpl {
  exec: (
    switches: string[],
    object:   string | null,
    value:    string | null,
    ctx:      EvalContext,
    engine:   IEvalEngine,
  ) => Promise<void>;
}
```

```typescript
engine.registerCommand("pemit", {
  async exec(switches, object, value, ctx, engine) {
    if (!object || !value) return;
    const targetId = await engine.accessor.resolveTarget(ctx.enactor, object);
    if (!targetId) return;
    const noeval = switches.includes("noeval");
    const text   = noeval ? value : await engine.evalString(value, ctx);
    await myGame.sendMessage(targetId, text);
  },
});
```

## `IterFrame`

The structure pushed onto `ctx.iterStack` by `iter()` and similar functions.

```typescript
interface IterFrame {
  item:  string; // ## — current element value
  index: number; // #@ — current position (1-based)
}
```

## Substitution codes

The evaluator handles these `%X` substitutions from `EvalContext`:

| Code            | Resolves to                             |
|-----------------|-----------------------------------------|
| `%0`–`%9`       | Positional args (`ctx.args[n]`)         |
| `%q<name>`      | Named register (`ctx.registers`)        |
| `%#`            | Enactor UUID                            |
| `%:`            | Enactor UUID (object ID form)           |
| `%!`            | Executor UUID                           |
| `%@`            | Caller UUID (empty string if none)      |
| `%+`            | Argument count                          |
| `%r` / `%R`     | CRLF (`\r\n`)                           |
| `%t` / `%T`     | Tab (`\t`)                              |
| `%b` / `%B`     | Space                                   |
| `%%`            | Literal `%`                             |
| `%[` `%]`       | Literal `[` `]`                         |
| `%,` `%;`       | Literal `,` `;`                         |
| `%\\`           | Literal `\`                             |
| `%N` / `%n`     | Enactor name (upper / lower)            |
| `%L`            | Enactor location (via `resolveTarget`)  |
| `%i0`–`%i9`     | Iter item at stack depth n              |
| `%=ATTR`        | Enactor attribute shorthand             |
| `%x` `%X` `%c` `%C` | ANSI pass-through (returned as-is) |

Special variables (`##`, `#@`) resolve from `ctx.iterStack[0]`.

## Cancellation

Pass an `AbortSignal` to cancel long-running evaluations:

```typescript
const ac  = new AbortController();
const ctx = makeContext({
  enactor:  "player-1",
  executor: "player-1",
  signal:   ac.signal,
});

setTimeout(() => ac.abort(), 500);

try {
  const result = await engine.evalString(complexSrc, ctx);
} catch (e) {
  if (e instanceof DOMException && e.name === "AbortError") {
    console.log("evaluation cancelled");
  }
}
```
