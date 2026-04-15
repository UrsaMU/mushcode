# Stdlib

All functions listed here are registered by `registerStdlib(engine)`.

```typescript
import { EvalEngine, registerStdlib, makeContext } from "jsr:@ursamu/mushcode/eval";

const engine = new EvalEngine(accessor);
registerStdlib(engine);
```

Errors return `#-1 MESSAGE` strings, matching MUX server conventions.
Integer inputs and outputs use integer arithmetic; mixed or float inputs return
up to 6 significant digits.

---

## Math

### `add(n, n, …)`

Sum of two or more numbers.

```typescript
// [add(1,2,3)] → "6"
// [add(1.5,2.5)] → "4"
```

### `sub(a, b)`

Subtraction.

```typescript
// [sub(10,3)] → "7"
```

### `mul(n, n, …)`

Product of two or more numbers.

```typescript
// [mul(2,3,4)] → "24"
```

### `div(a, b)`

Division. Integer operands use integer (truncating) division. Returns `#-1
DIVIDE BY ZERO` if `b` is 0.

```typescript
// [div(10,3)]   → "3"   (integer truncation)
// [div(10.0,3)] → "3.33333"
```

### `mod(a, b)`

Remainder. Returns `#-1 DIVIDE BY ZERO` if `b` is 0.

```typescript
// [mod(10,3)] → "1"
```

### `abs(n)`

Absolute value.

```typescript
// [abs(-5)] → "5"
```

### `round(n, places)`

Round `n` to `places` decimal places.

```typescript
// [round(3.14159,2)] → "3.14"
// [round(3.5,0)]     → "4"
```

### `floor(n)`

Floor (round down to nearest integer).

```typescript
// [floor(3.9)] → "3"
// [floor(-1.1)] → "-2"
```

### `ceil(n)`

Ceiling (round up to nearest integer).

```typescript
// [ceil(3.1)] → "4"
```

### `max(n, n, …)` / `min(n, n, …)`

Maximum or minimum of two or more values.

```typescript
// [max(1,5,3)] → "5"
// [min(1,5,3)] → "1"
```

### `power(base, exp)`

Exponentiation.

```typescript
// [power(2,8)] → "256"
```

### `sqrt(n)`

Square root. Returns `#-1 ARGUMENT OUT OF RANGE` for negative input.

```typescript
// [sqrt(9)]   → "3"
// [sqrt(2)]   → "1.41421"
```

---

## String

### `strlen(str)`

Length of a string.

```typescript
// [strlen(Hello)] → "5"
```

### `mid(str, start, len)`

Substring. `start` is 0-based.

```typescript
// [mid(Hello,1,3)] → "ell"
```

### `left(str, n)` / `right(str, n)`

First or last `n` characters.

```typescript
// [left(Hello,3)]  → "Hel"
// [right(Hello,3)] → "llo"
```

### `trim(str)`

Strip leading and trailing whitespace.

```typescript
// [trim(  hi  )] → "hi"
```

### `ljust(str, width[, fill])` / `rjust(str, width[, fill])` / `center(str, width[, fill])`

Pad a string to `width` characters. Default fill character is space.

```typescript
// [ljust(hi,6)]    → "hi    "
// [rjust(hi,6)]    → "    hi"
// [center(hi,6)]   → "  hi  "
// [ljust(hi,6,-)]  → "hi----"
```

### `ucstr(str)` / `lcstr(str)` / `capstr(str)`

Uppercase, lowercase, or capitalise first letter.

```typescript
// [ucstr(hello)] → "HELLO"
// [lcstr(HELLO)] → "hello"
// [capstr(hello world)] → "Hello world"
```

### `cat(str, …)`

Concatenate arguments with a single space between each.

```typescript
// [cat(hello,world)] → "hello world"
```

### `space(n)`

A string of `n` spaces.

```typescript
// [space(3)] → "   "
```

### `repeat(str, n)`

Repeat `str` exactly `n` times.

```typescript
// [repeat(-,5)] → "-----"
```

---

## Compare

All compare functions return `"1"` (true) or `"0"` (false).

### `eq(a, b)` / `neq(a, b)`

Numeric equality / inequality.

```typescript
// [eq(3,3)]  → "1"
// [neq(3,4)] → "1"
```

### `gt(a, b)` / `gte(a, b)` / `lt(a, b)` / `lte(a, b)`

Numeric greater-than, greater-or-equal, less-than, less-or-equal.

```typescript
// [gt(5,3)]  → "1"
// [lte(3,3)] → "1"
```

---

## Logic

`if`, `ifelse`, `switch`, `and`, and `or` are **lazy** — they only evaluate the
branches they need.

### `if(cond, then)`

If `cond` is truthy (non-zero, non-empty), return `then`. Otherwise return `""`.

```typescript
// [if(1,yes)]  → "yes"
// [if(0,yes)]  → ""
```

### `ifelse(cond, then, else)`

If `cond` is truthy, return `then`; otherwise return `else`.

```typescript
// [ifelse([gt(%0,10)],big,small)] → "big" or "small"
```

### `switch(value, match1, result1, match2, result2, …[, default])`

Exact-match switch. Compares `value` against each `match` string in order.
Returns the corresponding `result` for the first match, or `default` (or `""`)
if nothing matches.

```typescript
// [switch(%0,1,one,2,two,other)] → "one" if %0 is "1"
```

### `and(a, b, …)` / `or(a, b, …)`

Short-circuit logical AND / OR. Return `"1"` or `"0"`.

```typescript
// [and(1,1,0)] → "0"
// [or(0,0,1)]  → "1"
```

### `not(a)`

Logical NOT.

```typescript
// [not(0)] → "1"
// [not(1)] → "0"
```

### `t(a)`

Truthiness test — returns `"1"` if `a` is non-empty and non-`"0"`, else `"0"`.

```typescript
// [t(hello)] → "1"
// [t(0)]     → "0"
// [t()]      → "0"
```

---

## Registers

### `setq(reg, val)` / `setr(reg, val)`

Store `val` in register `reg`. Both forms are equivalent. Returns `""` and
mutates `ctx.registers`.

```typescript
// [setq(0,hello)][r(0)] → "hello"
```

### `r(reg)`

Read register `reg`. Returns `""` if not set.

```typescript
// [setq(name,Alice)][r(name)] → "Alice"
```

---

## Iter / List

### `iter(list, body[, idelim[, odelim]])`

Evaluate `body` for each item in `list`. Inside `body`, `##` holds the current
item and `#@` holds its 1-based position. Default delimiter is space (which
also collapses consecutive whitespace, MUX-style).

`iter` is **lazy** — `body` is evaluated once per item.

```typescript
// [iter(a b c,## is #@)] → "a is 1 b is 2 c is 3"
// [iter(a|b|c,##,|,;)]   → "a;b;c"
```

### `words(str[, delim])`

Count of items in a space- (or delim-) separated list.

```typescript
// [words(a b c)]   → "3"
// [words(a|b,|)]   → "2"
```

### `word(str, n[, delim])`

The nth word (1-based).

```typescript
// [word(a b c,2)] → "b"
```

### `first(str[, delim])` / `last(str[, delim])`

First or last word.

```typescript
// [first(a b c)] → "a"
// [last(a b c)]  → "c"
```

### `rest(str[, delim])`

All words after the first.

```typescript
// [rest(a b c)] → "b c"
```

---

## DB

These functions call through to `ObjectAccessor` methods.

### `get(obj/attr)`

Read the named attribute from `obj`. Returns `""` if the attribute is unset.
Returns `#-1 NO MATCH` if `obj` cannot be resolved, or `#-1 BAD ARGUMENT
FORMAT` if the argument has no `/`.

```typescript
// [get(me/DESC)] — reads DESC from the enactor
// [get(#room/NAME)] — reads NAME from a TagRef-resolved object
```

### `name(obj)`

Display name of `obj`.

```typescript
// [name(me)] → "Alice"
```

### `hasattr(obj, attr)`

`"1"` if the attribute exists on `obj`, `"0"` otherwise.

```typescript
// [hasattr(me,DESC)] → "1" or "0"
```

### `hasflag(obj, flag)`

`"1"` if `obj` has `flag`, `"0"` otherwise.

```typescript
// [hasflag(me,WIZARD)] → "1" or "0"
```

### `u(obj/attr[, arg0, arg1, …])`

Evaluate the named attribute as a function call. Creates a child `EvalContext`
where:
- `%0`–`%9` are the extra arguments passed to `u()`
- `%!` is the object that owns the attribute (new executor)
- `%@` is the previous executor (caller)
- `%#` is unchanged (original enactor)
- `depth` is incremented; returns `#-1 EVALUATION DEPTH EXCEEDED` at `maxDepth`

```typescript
// [u(me/FN_DOUBLE,21)] → evaluates the FN_DOUBLE attr with %0="21"
```

If `obj/` is omitted (bare attribute name), the executor is used as the target.
