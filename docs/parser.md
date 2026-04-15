# Parser

```typescript
import { parse, ParseError } from "jsr:@ursamu/mushcode/parse";
import type { ASTNode, NodeType, SourceLocation, StartRule } from "jsr:@ursamu/mushcode/parse";
```

## `parse(text, startRule?)`

Parse a raw softcode string and return its AST root node.

```typescript
function parse(text: string, startRule?: StartRule): ASTNode
```

| Parameter   | Type        | Default     | Description                               |
|-------------|-------------|-------------|-------------------------------------------|
| `text`      | `string`    | —           | Softcode source to parse                  |
| `startRule` | `StartRule` | `"Start"`   | Grammar entry point (see below)           |

Throws `ParseError` on syntax errors.

### Start rules

- `"Start"` — normal softcode: commands, function calls, substitutions, patterns
- `"LockExpr"` — lock expression string, e.g. `flag^WIZARD|attr^STAFF:1`

```typescript
// Normal softcode
const ast = parse("$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]");

// Lock expression
const lock = parse("flag^WIZARD|!flag^GUEST", "LockExpr");
```

## `ParseError`

Thrown when the parser encounters invalid input.

```typescript
class ParseError extends Error {
  readonly location?: { line: number; column: number; offset: number };
}
```

```typescript
try {
  parse("[unclosed(");
} catch (e) {
  if (e instanceof ParseError) {
    console.error(`Syntax error at line ${e.location?.line}: ${e.message}`);
  }
}
```

## Types

### `ASTNode`

Every node in the tree conforms to this type:

```typescript
type ASTNode = {
  type: string;         // node type discriminant
  loc?: SourceLocation; // source span (always present unless disabled)
  [key: string]: any;   // node-specific fields
};
```

Node-specific fields are accessed by checking `node.type` first:

```typescript
if (ast.type === "FunctionCall") {
  console.log(ast.name);              // string
  console.log((ast.args as ASTNode[]).length);
}
if (ast.type === "Literal") {
  console.log(ast.value as string);
}
```

### `SourceLocation`

```typescript
interface SourceLocation {
  start: SourcePosition;
  end:   SourcePosition;
}

interface SourcePosition {
  offset: number; // byte offset from start of input (0-based)
  line:   number; // 1-based line number
  column: number; // 1-based column number
}
```

```typescript
const ast = parse("add(1,2)");
// ast.loc.start → { offset: 0, line: 1, column: 1 }
// ast.loc.end   → { offset: 8, line: 1, column: 9 }
```

### `NodeType`

Union of every type string the parser can produce:

```typescript
type NodeType =
  | "Literal" | "Escape" | "Substitution" | "SpecialVar" | "Wildcard"
  | "EvalBlock" | "BracedString" | "Text" | "Arg"
  | "FunctionCall" | "DollarPattern" | "ListenPattern"
  | "PatternAlts" | "Pattern"
  | "CommandList" | "AtCommand" | "AttributeSet" | "UserCommand"
  | "TagRef"
  | "LockOr" | "LockAnd" | "LockNot" | "LockMe" | "LockDbref"
  | "LockFlagCheck" | "LockTypeCheck" | "LockAttrCheck" | "LockPlayerName";
```

## Node reference

### Expression nodes

| Type           | Key fields                              | Description                            |
|----------------|-----------------------------------------|----------------------------------------|
| `Literal`      | `value: string`                         | Plain text segment                     |
| `Escape`       | `char: string`                          | Backslash-escaped character            |
| `Substitution` | `code: string`                          | `%X` substitution (code = `"#"`, `"0"`, `"qA"`, …) |
| `SpecialVar`   | `code: string`                          | `##` (iter item) or `#@` (iter index)  |
| `TagRef`       | `name: string`                          | `#tagname` reference                   |
| `EvalBlock`    | `parts: ASTNode[]`                      | `[…]` evaluated block                  |
| `BracedString` | `parts: ASTNode[]`                      | `{…}` braced literal                   |
| `Arg`          | `parts: ASTNode[]`                      | One comma-separated function argument  |
| `FunctionCall` | `name: string`, `args: ASTNode[]`       | `name(arg1,arg2,…)`                    |

### Command nodes

| Type           | Key fields                                                        | Description              |
|----------------|-------------------------------------------------------------------|--------------------------|
| `CommandList`  | `commands: ASTNode[]`                                             | `;`-separated statements |
| `AtCommand`    | `name: string`, `switches: string[]`, `object?: ASTNode`, `value?: ASTNode` | `@name/sw obj=val` |
| `AttributeSet` | `attribute: string`, `object: ASTNode`, `value?: ASTNode`        | `&ATTR obj=val`          |
| `UserCommand`  | `parts: ASTNode[]`                                                | Freeform typed command   |

### Pattern nodes

| Type            | Key fields                              | Description                        |
|-----------------|-----------------------------------------|------------------------------------|
| `DollarPattern` | `pattern: ASTNode`, `action: ASTNode`   | `$pattern:action` trigger          |
| `ListenPattern` | `pattern: ASTNode`, `action: ASTNode`   | `^pattern:action` listen trigger   |
| `Pattern`       | `parts: ASTNode[]`                      | Pattern body segments              |
| `PatternAlts`   | `patterns: ASTNode[]`                   | `;`-separated pattern alternatives |
| `Wildcard`      | `wildcard: string`                      | `"*"` or `"?"`                     |

### Lock nodes (LockExpr start rule)

| Type              | Key fields                              |
|-------------------|-----------------------------------------|
| `LockOr`          | `left: ASTNode`, `right: ASTNode`       |
| `LockAnd`         | `left: ASTNode`, `right: ASTNode`       |
| `LockNot`         | `operand: ASTNode`                      |
| `LockMe`          | _(no extra fields)_                     |
| `LockDbref`       | `dbref: string`                         |
| `LockFlagCheck`   | `flag: string`                          |
| `LockTypeCheck`   | `objtype: string`                       |
| `LockAttrCheck`   | `attr: string`, `value: string`         |
| `LockPlayerName`  | `name: string`                          |

## Examples

### Collecting all substitution codes in a softcode string

```typescript
import { parse }   from "jsr:@ursamu/mushcode/parse";
import { findAll } from "jsr:@ursamu/mushcode/traverse";

const ast  = parse("@pemit %#=Hello %N, you have %0 coins.");
const subs = findAll(ast, "Substitution");
console.log(subs.map(n => n.code)); // ["#", "N", "0"]
```

### Checking for parse errors with location info

```typescript
import { parse, ParseError } from "jsr:@ursamu/mushcode/parse";

function safeParse(src: string) {
  try {
    return { ok: true, ast: parse(src) };
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, error: e.message, line: e.location?.line };
    }
    throw e;
  }
}
```
