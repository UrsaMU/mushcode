# Analyze

```typescript
import { extractCommands, extractDeps, extractTagRefs } from "jsr:@ursamu/mushcode/analyze";
import type { PatternEntry, DepEntry } from "jsr:@ursamu/mushcode/analyze";
```

All three functions accept any `ASTNode` root and scan the entire subtree, so
they work on `CommandList` roots, single `AttributeSet` values, or any other
node type.

## `extractCommands(root)`

Return all `DollarPattern` (`$command`) and `ListenPattern` (`^listen`) nodes
as a flat list with their printed pattern text.

```typescript
function extractCommands(root: ASTNode): PatternEntry[]
```

```typescript
interface PatternEntry {
  type:        "dollar" | "listen"; // which trigger kind
  patternText: string;              // printed pattern, e.g. "+finger *"
  pattern:     ASTNode;            // raw Pattern or PatternAlts node
  action:      ASTNode;            // action expression node
}
```

### Example

```typescript
import { parse }           from "jsr:@ursamu/mushcode/parse";
import { extractCommands } from "jsr:@ursamu/mushcode/analyze";

const src = `
  $+finger *:@pemit %#=[u(me/FN_FINGER,%0)]
  $+help:@pemit %#=[u(me/FN_HELP)]
  ^* says *:@pemit %#=## said something
`;

const ast   = parse(src);
const cmds  = extractCommands(ast);

for (const cmd of cmds) {
  console.log(`${cmd.type} "${cmd.patternText}"`);
}
// dollar "+finger *"
// dollar "+help"
// listen "* says *"
```

### Using the action node

```typescript
import { print }  from "jsr:@ursamu/mushcode/print";

for (const cmd of cmds) {
  console.log(`  action: ${print(cmd.action)}`);
}
```

## `extractDeps(root)`

Return dependency edges: `u()` attribute calls, `@trigger` commands, and
`get()`/`v()` attribute reads.

```typescript
function extractDeps(root: ASTNode): DepEntry[]
```

```typescript
interface DepEntry {
  type:   "u" | "trigger" | "get"; // dependency kind
  target: string;                  // printed first argument / object expression
}
```

Dynamic targets (e.g. `u([r(0)]/ATTR)`) are included with their printed form;
the caller decides how to interpret them.

### Example

```typescript
import { parse }       from "jsr:@ursamu/mushcode/parse";
import { extractDeps } from "jsr:@ursamu/mushcode/analyze";

const ast  = parse("@pemit %#=[u(me/FN_A)][get(#room/DESC)];@trigger #target/EV=%0");
const deps = extractDeps(ast);

for (const dep of deps) {
  console.log(`${dep.type}: ${dep.target}`);
}
// u: me/FN_A
// get: #room/DESC
// trigger: #target
```

### Building a dependency graph

```typescript
import { parse }           from "jsr:@ursamu/mushcode/parse";
import { extractCommands } from "jsr:@ursamu/mushcode/analyze";
import { extractDeps }     from "jsr:@ursamu/mushcode/analyze";

function graphFor(src: string) {
  const ast  = parse(src);
  const cmds = extractCommands(ast);
  return cmds.map(cmd => ({
    pattern: cmd.patternText,
    deps:    extractDeps(cmd.action),
  }));
}
```

## `extractTagRefs(root)`

Return a deduplicated, sorted list of every tag name referenced by `#tagname`
nodes anywhere in the tree.

```typescript
function extractTagRefs(root: ASTNode): string[]
```

### Example

```typescript
import { parse }          from "jsr:@ursamu/mushcode/parse";
import { extractTagRefs } from "jsr:@ursamu/mushcode/analyze";

const ast  = parse("[get(#room/DESC)][get(#room/NAME)][u(#db/FN)]");
const tags = extractTagRefs(ast);
console.log(tags); // ["db", "room"]  (deduplicated, sorted)
```

### Checking for unresolved tags

```typescript
const knownTags = new Set(["room", "db", "weather"]);
const refs      = extractTagRefs(ast);
const unknown   = refs.filter(tag => !knownTags.has(tag));
if (unknown.length) {
  console.warn("Unresolved tag refs:", unknown);
}
```
