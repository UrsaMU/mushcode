# Print

```typescript
import { print } from "jsr:@ursamu/mushcode/print";
import type { PrintOptions, PrintMode } from "jsr:@ursamu/mushcode/print";
```

## `print(node, opts?)`

Convert an AST node back to a canonical softcode string.

```typescript
function print(node: ASTNode, opts?: PrintOptions): string
```

The output is semantically equivalent to the original source. Whitespace around
`@command` syntax may be normalised (e.g. `@pemit%#=x` becomes `@pemit %#=x`).

Lock-expression nodes (`LockOr`, `LockAnd`, etc.) produced by the `"LockExpr"`
start rule are handled automatically.

## `PrintOptions`

```typescript
interface PrintOptions {
  mode?: PrintMode; // default: "compact"
}

type PrintMode = "compact" | "pretty";
```

| Mode        | `CommandList` separator |
|-------------|-------------------------|
| `"compact"` | `;`                     |
| `"pretty"`  | `;\n`                   |

## Examples

### Round-trip a softcode string

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";
import { print } from "jsr:@ursamu/mushcode/print";

const src = "$+say *:@pemit/noeval %#=You say: %0";
const ast = parse(src);
console.log(print(ast)); // "$+say *:@pemit/noeval %#=You say: %0"
```

### Pretty-print a command list

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";
import { print } from "jsr:@ursamu/mushcode/print";

const ast = parse("@pemit %#=Line one;@pemit %#=Line two;@pemit %#=Line three");
console.log(print(ast, { mode: "pretty" }));
// @pemit %#=Line one
// @pemit %#=Line two
// @pemit %#=Line three
```

### Print a transformed tree

```typescript
import { parse }     from "jsr:@ursamu/mushcode/parse";
import { transform } from "jsr:@ursamu/mushcode/traverse";
import { print }     from "jsr:@ursamu/mushcode/print";

// Strip all TagRef nodes before printing
const ast = parse("@pemit %#=[get(#room/DESC)]");
const out = transform(ast, (n) => n.type === "TagRef" ? null : undefined);
console.log(print(out));
```

### Print a lock expression

```typescript
import { parse } from "jsr:@ursamu/mushcode/parse";
import { print } from "jsr:@ursamu/mushcode/print";

const lock = parse("flag^WIZARD|!flag^GUEST", "LockExpr");
console.log(print(lock)); // "flag^WIZARD|!flag^GUEST"
```
