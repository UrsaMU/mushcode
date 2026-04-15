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
  exec(node: ASTNode, ctx: EvalContext): Promise<void>

  readonly accessor: ObjectAccessor
}
```

- `evalString` parses the source string and evaluates it.
- `eval` evaluates an already-parsed `ASTNode` to a string.
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
