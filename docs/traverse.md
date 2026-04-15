# Traverse

```typescript
import { walk, transform, findAll, findFirst, findFirstOrNull } from "jsr:@ursamu/mushcode/traverse";
import type { Visitor, Transformer } from "jsr:@ursamu/mushcode/traverse";
```

## `walk(root, visitor)`

Depth-first walk over an AST. The visitor's `enter` hook is called before a
node's children are visited; `leave` is called after.

```typescript
function walk(root: ASTNode, visitor: Visitor): void
```

```typescript
interface Visitor {
  enter?: (node: ASTNode) => false | void;
  leave?: (node: ASTNode) => void;
}
```

Returning `false` from `enter` skips the node's children and suppresses the
`leave` call for that node.

Nodes are visited in place — you may mutate `node` fields inside a visitor, but
prefer `transform` when you need a new tree.

### Example: collect all function names

```typescript
import { parse }   from "jsr:@ursamu/mushcode/parse";
import { walk }    from "jsr:@ursamu/mushcode/traverse";

const ast   = parse("[add(1,[mul(2,3)])]");
const names: string[] = [];

walk(ast, {
  enter(node) {
    if (node.type === "FunctionCall") names.push(node.name as string);
  },
});

console.log(names); // ["add", "mul"]
```

### Example: skip subtrees

```typescript
walk(ast, {
  enter(node) {
    // Do not descend into braced strings
    if (node.type === "BracedString") return false;
    if (node.type === "Literal") process(node);
  },
});
```

## `transform(root, fn)`

Produce a new tree by applying `fn` to every node top-down. The original tree
is never mutated.

```typescript
function transform(root: ASTNode, fn: Transformer): ASTNode

type Transformer = (node: ASTNode) => ASTNode | null | undefined;
```

Return values from the transformer:

| Return value | Effect                                                                  |
|--------------|-------------------------------------------------------------------------|
| `undefined`  | Keep the node as-is and recurse into its children                       |
| `ASTNode`    | Replace the node with the returned value, then recurse into its children |
| `null`       | Remove the node (from an array slot) or set the field to `null`         |

### Example: replace TagRefs with Literal placeholders

```typescript
import { parse }     from "jsr:@ursamu/mushcode/parse";
import { transform } from "jsr:@ursamu/mushcode/traverse";

const ast = parse("@pemit %#=[get(#room/DESC)]");

const out = transform(ast, (node) => {
  if (node.type === "TagRef") {
    return { type: "Literal", value: `<tag:${node.name}>` };
  }
});

// out contains a new tree with TagRef replaced by Literal
```

### Example: strip all EvalBlocks (flatten to their content)

```typescript
const stripped = transform(ast, (node) => {
  if (node.type === "EvalBlock") {
    // Replace EvalBlock with a Literal that holds its printed content
    // (or return null to remove it entirely)
    return null;
  }
});
```

## `findAll(root, type)`

Collect every node of the given type anywhere in the tree.

```typescript
function findAll(root: ASTNode, type: string): ASTNode[]
```

```typescript
import { parse }   from "jsr:@ursamu/mushcode/parse";
import { findAll } from "jsr:@ursamu/mushcode/traverse";

const ast  = parse("$+finger *:@pemit %#=[u(me/FN,%0,#room)]");
const refs = findAll(ast, "TagRef");
console.log(refs.map(n => n.name)); // ["room"]

const subs = findAll(ast, "Substitution");
console.log(subs.map(n => n.code)); // ["#", "0"]
```

Returns an empty array when no nodes of that type exist.

## `findFirst(root, type)`

Return the first node of the given type. Throws `Error` if none is found.

```typescript
function findFirst(root: ASTNode, type: string): ASTNode
```

```typescript
import { parse }      from "jsr:@ursamu/mushcode/parse";
import { findFirst }  from "jsr:@ursamu/mushcode/traverse";

const ast  = parse("$do *:@pemit %#=[u(me/FN,%0)]");
const call = findFirst(ast, "FunctionCall");
console.log(call.name); // "u"
```

## `findFirstOrNull(root, type)`

Return the first node of the given type, or `null` if none exists. Prefer this
over `findFirst` when the node might not be present.

```typescript
function findFirstOrNull(root: ASTNode, type: string): ASTNode | null
```

```typescript
import { parse }            from "jsr:@ursamu/mushcode/parse";
import { findFirstOrNull }  from "jsr:@ursamu/mushcode/traverse";

const ast  = parse("@pemit %#=Hello");
const call = findFirstOrNull(ast, "FunctionCall");
if (call) {
  console.log(call.name);
} else {
  console.log("no function call found");
}
```
