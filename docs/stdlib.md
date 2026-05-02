# Stdlib Reference

All functions listed here are registered by `registerStdlib(engine)`.

```typescript
import { EvalEngine, registerStdlib, makeContext } from "jsr:@ursamu/mushcode/eval";

const engine = new EvalEngine(accessor);
registerStdlib(engine);
```

Errors return `#-1 MESSAGE` strings, matching MUX server conventions.
Integer inputs and outputs use integer arithmetic; mixed or float inputs return
up to 6 significant digits (via `toPrecision(6)`).

**Truthy/falsy**: empty string `""` and `"0"` are false; everything else is true.

---

## Math

### `add(n, n, …)`

Sum of two or more numbers.

```
// [add(1,2,3)]   → "6"
// [add(1.5,2.5)] → "4"
```

### `sub(a, b)`

Subtract `b` from `a`.

```
// [sub(10,3)] → "7"
```

### `mul(n, n, …)`

Product of two or more numbers.

```
// [mul(2,3,4)] → "24"
```

### `div(a, b)`

Division. Both-integer operands truncate toward zero; any float operand returns float. Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [div(10,3)]   → "3"      (integer truncation)
// [div(10.0,3)] → "3.33333"
```

### `mod(a, b)`

Remainder (`a % b`). Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [mod(10,3)] → "1"
// [mod(-7,3)] → "-1"
```

### `abs(n)`

Absolute value.

```
// [abs(-5)] → "5"
```

### `round(n, precision)`

Round `n` to `precision` decimal places.

```
// [round(3.14159,2)] → "3.14"
// [round(3.5,0)]     → "4"
```

### `floor(n)`

Largest integer less than or equal to `n`.

```
// [floor(3.9)] → "3"
// [floor(-1.1)] → "-2"
```

### `ceil(n)`

Smallest integer greater than or equal to `n`.

```
// [ceil(3.1)] → "4"
```

### `trunc(n)`

Truncate toward zero (drops the fractional part).

```
// [trunc(3.9)]  → "3"
// [trunc(-3.9)] → "-3"
```

### `inc(n)`

Add 1 to `n`.

```
// [inc(4)] → "5"
```

### `dec(n)`

Subtract 1 from `n`.

```
// [dec(4)] → "3"
```

### `max(n, n, …)`

Maximum of two or more numbers.

```
// [max(1,5,3)] → "5"
```

### `min(n, n, …)`

Minimum of two or more numbers.

```
// [min(1,5,3)] → "1"
```

### `power(base, exp)`

Raise `base` to the power of `exp`.

```
// [power(2,10)] → "1024"
```

### `sqrt(n)`

Square root. Returns `#-1 ARGUMENT OUT OF RANGE` if `n < 0`.

```
// [sqrt(9)]   → "3"
// [sqrt(2)]   → "1.41421"
```

### `sign(n)`

Returns `-1`, `0`, or `1` depending on the sign of `n`.

```
// [sign(-5)] → "-1"
// [sign(0)]  → "0"
// [sign(7)]  → "1"
```

### `log(n[, base])`

Base-10 logarithm if `base` is omitted; `log(n)/log(base)` otherwise. Returns `#-1 LOG OF ZERO` if `n <= 0`.

```
// [log(100)]  → "2"
// [log(8,2)]  → "3"
```

### `ln(n)`

Natural logarithm. Returns `#-1 LOG OF ZERO` if `n <= 0`.

```
// [ln(1)] → "0"
```

### `exp(n)`

e raised to the power of `n`.

```
// [exp(1)] → "2.71828"
```

### `sin(n)`

Sine of `n` (radians).

```
// [sin(0)] → "0"
```

### `cos(n)`

Cosine of `n` (radians).

```
// [cos(0)] → "1"
```

### `tan(n)`

Tangent of `n` (radians).

```
// [tan(0)] → "0"
```

### `atan(y[, x])`

Arctangent. With one arg: `atan(y)`. With two args: `atan2(y, x)` (full-circle angle).

```
// [atan(1)]    → "0.785398"
// [atan(1,1)]  → "0.785398"
```

### `pi()`

Returns `"3.141592653589793"`.

### `e()`

Returns `"2.718281828459045"`.

### `bound(n, low, high)`

Clamp `n` to the range `[low, high]`.

```
// [bound(15,0,10)] → "10"
// [bound(-3,0,10)] → "0"
```

### `between(n, low, high)`

Returns `"1"` if `low <= n <= high`, `"0"` otherwise.

```
// [between(5,1,10)] → "1"
// [between(0,1,10)] → "0"
```

### `fdiv(a, b)`

Floating-point division regardless of operand types. Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [fdiv(10,3)] → "3.33333"
```

### `fmod(a, b)`

Floating-point modulo. Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [fmod(10.5,3)] → "1.5"
```

### `rand([max] | [min, max])`

Random integer. One arg: returns integer in `[0, max)`. Two args: returns integer in `[min, max]`.

```
// [rand(6)]   → "4"  (0–5)
// [rand(1,6)] → "3"  (1–6)
```

### `die(num, sides[, bonus])`

Roll `num` dice of `sides` sides, optionally add `bonus`. Returns `#-1 ARGUMENT OUT OF RANGE` if `num > 100`, `num < 1`, or `sides < 1`.

```
// [die(3,6)]    → "11"  (3d6)
// [die(1,20,5)] → "18"  (1d20+5)
```

### `mean(n, n, …)`

Arithmetic mean.

```
// [mean(1,2,3,4)] → "2.5"
```

### `median(n, n, …)`

Median value. Even-length lists return the mean of the two middle values.

```
// [median(1,3,5)] → "3"
// [median(1,2,3,4)] → "2.5"
```

### `stddev(n, n, …)`

Population standard deviation.

```
// [stddev(2,4,4,4,5,5,7,9)] → "2"
```

### `lmath(op, list[, delim])`

Apply a statistical operation to a delimited list. `op`: `sum`, `add`, `mul`, `multiply`, `max`, `min`, `mean`, `median`, `stddev`. Returns `#-1 UNKNOWN OPERATION` for unknown ops.

```
// [lmath(sum,1 2 3 4)]   → "10"
// [lmath(max,10|20|5,|)] → "20"
```

### `ladd(list[, delim])`

Sum all numbers in a delimited list.

```
// [ladd(1 2 3)] → "6"
```

### `lmax(list[, delim])`

Maximum value in a delimited list.

```
// [lmax(3 1 4 1 5)] → "5"
```

### `lmin(list[, delim])`

Minimum value in a delimited list.

```
// [lmin(3 1 4 1 5)] → "1"
```

---

### Integer Variants

These force integer arithmetic by truncating operands and/or results.

### `iabs(n)`

Absolute value, truncated to integer.

```
// [iabs(-3.9)] → "3"
```

### `iadd(n, n, …)`

Integer sum (result truncated toward zero).

```
// [iadd(1.9,2.1)] → "3"
```

### `imul(n, n, …)`

Integer product (result truncated toward zero).

```
// [imul(2.5,3.5)] → "8"
```

### `idiv(a, b)`

Integer division (floor, not truncate). Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [idiv(7,2)]   → "3"
// [idiv(-7,2)]  → "-4"
```

### `isub(a, b)`

Integer subtraction (result truncated toward zero).

```
// [isub(5.9,2.1)] → "3"
```

### `isign(n)`

Returns `-1`, `0`, or `1`; integer variant of `sign`.

```
// [isign(-3.5)] → "-1"
```

### `floordiv(a, b)`

Floor division (same as `idiv`). Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [floordiv(-7,2)] → "-4"
```

### `remainder(a, b)`

IEEE remainder: `a - round(a/b) * b`. Returns `#-1 DIVIDE BY ZERO` if `b` is `0`.

```
// [remainder(10,3)] → "1"
```

---

### Bitwise

### `band(n, n, …)`

Bitwise AND of all operands (32-bit integer).

```
// [band(12,10)] → "8"
```

### `bor(n, n, …)`

Bitwise OR of all operands.

```
// [bor(12,10)] → "14"
```

### `bxor(n, n, …)`

Bitwise XOR of all operands.

```
// [bxor(12,10)] → "6"
```

### `bnand(a, b)`

Bitwise NAND of exactly two operands.

```
// [bnand(12,10)] → "-9"
```

### `shl(n, bits)`

Left-shift `n` by `bits` positions.

```
// [shl(1,4)] → "16"
```

### `shr(n, bits)`

Arithmetic right-shift `n` by `bits` positions.

```
// [shr(16,4)] → "1"
```

### `xor(v1, v2, …)`

Returns `"1"` if an odd number of args are truthy, `"0"` otherwise (logical XOR across all args).

```
// [xor(1,0)]   → "1"
// [xor(1,1,1)] → "1"
// [xor(1,1)]   → "0"
```

---

### Geometry

### `dist2d(x1, y1, x2, y2)`

Euclidean distance between two 2-D points.

```
// [dist2d(0,0,3,4)] → "5"
```

### `dist3d(x1, y1, z1, x2, y2, z2)`

Euclidean distance between two 3-D points.

```
// [dist3d(0,0,0,1,1,1)] → "1.73205"
```

---

### Vector Math

Vectors are space-delimited (or custom delimiter) numeric strings.

### `vadd(v1, v2[, delim])`

Component-wise vector addition. Vectors must be the same length.

```
// [vadd(1 2 3, 4 5 6)] → "5 7 9"
```

### `vsub(v1, v2[, delim])`

Component-wise vector subtraction.

```
// [vsub(4 5 6, 1 2 3)] → "3 3 3"
```

### `vmul(v, scalar[, delim])`

Multiply each component of `v` by `scalar`.

```
// [vmul(1 2 3, 2)] → "2 4 6"
```

### `vdot(v1, v2[, delim])`

Dot product of two vectors.

```
// [vdot(1 2 3, 4 5 6)] → "32"
```

### `vcross(v1, v2[, delim])`

Cross product of two 3-element vectors. Returns `#-1` if either vector is not 3 elements.

```
// [vcross(1 0 0, 0 1 0)] → "0 0 1"
```

### `vmag(v[, delim])`

Magnitude (length) of a vector.

```
// [vmag(3 4)] → "5"
```

### `vunit(v[, delim])`

Unit vector (normalize to length 1). Returns `#-1 ZERO VECTOR` if `v` is the zero vector.

```
// [vunit(3 4)] → "0.6 0.8"
```

---

### Numeral Conversion

### `roman(n)`

Convert integer `n` (1–3999) to Roman numerals. Returns `#-1 ARGUMENT OUT OF RANGE` outside that range.

```
// [roman(4)]    → "IV"
// [roman(2024)] → "MMXXIV"
```

### `spellnum(n)`

Spell out an integer in English words.

```
// [spellnum(42)]  → "forty-two"
// [spellnum(100)] → "one hundred"
```

### `baseconv(num, from_base, to_base)`

Convert numeric string `num` from base `from_base` to base `to_base` (2–36). Returns `#-1 INVALID BASE` or `#-1 ARGUMENT IS NOT A NUMBER` on error.

```
// [baseconv(ff,16,10)] → "255"
// [baseconv(10,10,2)]  → "1010"
```

---

## Comparison

All comparison functions operate on numeric values.

### `eq(a, b)`

Returns `"1"` if `a == b`, `"0"` otherwise.

```
// [eq(3,3)]   → "1"
// [eq(3,3.0)] → "1"
```

### `neq(a, b)`

Returns `"1"` if `a != b`, `"0"` otherwise.

```
// [neq(3,4)] → "1"
```

### `gt(a, b)`

Returns `"1"` if `a > b`.

```
// [gt(5,3)] → "1"
```

### `gte(a, b)`

Returns `"1"` if `a >= b`.

```
// [gte(3,3)] → "1"
```

### `lt(a, b)`

Returns `"1"` if `a < b`.

```
// [lt(2,5)] → "1"
```

### `lte(a, b)`

Returns `"1"` if `a <= b`.

```
// [lte(3,3)] → "1"
```

---

## Logic

### `and(v1, v2, …)`

Lazy — short-circuit AND. Returns `"1"` if all args are truthy, `"0"` at the first falsy arg.

```
// [and(1,1,1)] → "1"
// [and(1,0,1)] → "0"
```

### `or(v1, v2, …)`

Lazy — short-circuit OR. Returns the first truthy value found, or `"0"` if none are truthy.

```
// [or(0,hello,world)] → "hello"
// [or(0,0)]           → "0"
```

### `not(v)`

Returns `"1"` if `v` is falsy, `"0"` if truthy.

```
// [not(0)]     → "1"
// [not(hello)] → "0"
```

### `t(v)`

Returns `"1"` if `v` is truthy, `"0"` if falsy (explicit coercion to boolean).

```
// [t(hello)] → "1"
// [t(0)]     → "0"
```

### `cand(v1, v2, …)`

Lazy — identical behavior to `and`. Short-circuit AND returning `"1"`/`"0"`.

### `cor(v1, v2, …)`

Lazy — identical behavior to `or`. Returns first truthy value or `"0"`.

### `andbool(v1, v2, …)`

Lazy — alias of `and`.

### `orbool(v1, v2, …)`

Lazy — alias of `or` except always returns `"1"` for the truthy case (not the value itself).

```
// [orbool(0,hello)] → "1"
```

### `candbool(v1, v2, …)`

Lazy — alias of `cand`.

### `corbool(v1, v2, …)`

Lazy — alias of `cor` (returns the truthy value).

### `allof(v1, v2, …)`

Lazy — evaluates ALL args unconditionally and returns the last value.

```
// [allof(setq(a,1),setq(b,2),done)] → "done"
```

### `firstof(v1, v2, …)`

Lazy — returns the first non-empty value (short-circuit). Returns `""` if all are empty.

```
// [firstof(,,found)] → "found"
```

---

## Control Flow

### `if(cond, iftrue[, iffalse])`

Lazy — evaluate `iftrue` if `cond` is truthy, `iffalse` otherwise. `iffalse` defaults to `""`.

```
// [if(1,yes,no)]     → "yes"
// [if(0,yes,no)]     → "no"
// [if(0,yes)]        → ""
```

### `ifelse(cond, iftrue, iffalse)`

Lazy — like `if` but all three arguments are required.

```
// [ifelse(gt(5,3),big,small)] → "big"
```

### `switch(val, pat1, res1[, pat2, res2, …[, default]])`

Lazy — exact-string comparison. Returns result of the first matching pattern, or `default` (if present), or `""`. Use `case()` for wildcards.

```
// [switch(foo,foo,match,bar,other,none)] → "match"
// [switch(baz,foo,match,bar,other,none)] → "none"
```

### `switchall(val, pat1, res1[, …[, default]])`

Lazy — like `switch` but evaluates ALL matching patterns and concatenates their results.

```
// [switchall(x,x,A,x,B,default)] → "AB"
```

### `case(val, pat1, res1[, pat2, res2, …[, default]])`

Lazy — wildcard-match comparison (`*`, `?`, `[abc]`). Returns result of the first matching pattern.

```
// [case(foobar,foo*,match,none)] → "match"
// [case(hello,h?llo,yes,no)]     → "yes"
```

### `caseall(val, pat1, res1[, …[, default]])`

Lazy — like `case` but evaluates ALL matching patterns and concatenates their results.

### `cond(cond1, val1[, cond2, val2, …[, default]])`

Lazy — evaluate condition/value pairs; return value of first truthy condition. Optional trailing default.

```
// [cond(0,no,1,yes,fallback)] → "yes"
```

### `while(cond, body, iter_expr[, max])`

Lazy — loop while `cond` is truthy, accumulating body outputs. `iter_expr` is evaluated each cycle (side-effects only). `max` caps iterations (default 1000).

```
// [setq(i,0)][while(lt(r(i),5),r(i),setq(i,add(r(i),1)))] → "01234"
```

### `localize(expr)`

Lazy — evaluate `expr` with an isolated copy of the Q-register map. Changes inside do NOT propagate back.

```
// [localize(setq(a,inner))][r(a)] → ""
```

### `letq(reg1, val1[, reg2, val2, …], body)`

Lazy — bind registers temporarily, evaluate `body`, then restore originals. Requires an odd number of arguments (pairs + body).

```
// [letq(x,10,y,20,add(r(x),r(y)))] → "30"
```

---

## Registers

### `setq(reg, value)`

Store `value` in named register `reg`. Returns `""`.

```
// [setq(a,hello)][r(a)] → "hello"
```

### `setr(reg, value)`

Like `setq` but returns `value`.

```
// [setr(a,42)] → "42"
```

### `r(reg)`

Read named register. Returns `""` if unset.

```
// [r(a)] → ""   (if unset)
```

### `unsetq(reg1[, reg2, …])`

Delete one or more Q-registers. Returns `""`.

```
// [setq(a,x)][unsetq(a)][r(a)] → ""
```

### `listq()`

Returns a space-separated sorted list of currently-set Q-register names.

```
// [setq(b,1)][setq(a,2)][listq()] → "a b"
```

---

## Iteration

### `iter(list, body[, idelim[, odelim]])`

Lazy — evaluate `body` once per item. `##` is bound to the current item; `#@` to its 1-based index. Input delimiter defaults to space; output delimiter defaults to space.

```
// [iter(a b c,ucstr(##))]          → "A B C"
// [iter(a|b|c,##,|,|)]             → "a|b|c"
```

### `map(list, body[, idelim[, odelim]])`

Lazy — identical to `iter`. Exists as an alias used when the intent is transformation rather than side effects.

```
// [map(1 2 3,mul(##,2))] → "2 4 6"
```

### `filter(list, body[, idelim[, odelim]])`

Lazy — keep only items for which `body` returns truthy. `##` is the current item; `#@` is 1-based index.

```
// [filter(1 2 3 4,gt(##,2))] → "3 4"
```

### `foreach(str, fn[, start_delim[, end_delim]])`

Lazy — apply `fn` to each CHARACTER of `str`, concatenate results. `##` is the current character; `#@` its 1-based position. `start_delim` and `end_delim` are accepted for TinyMUX compatibility but ignored.

```
// [foreach(abc,ucstr(##))] → "ABC"
```

### `fold(list, fn[, base[, delim]])`

Lazy — left-fold. `fn` receives accumulated value and current item (as `%0` and `%1` / `##`). If `base` is omitted, the first item seeds the accumulator.

```
// [fold(1 2 3 4,add(%0,%1))]   → "10"
// [fold(1 2 3,add(%0,%1),10)]  → "16"
```

### `step(list, fn, step_size[, delim])`

Lazy — call `fn` with `step_size` consecutive items joined as `##` per call.

```
// [step(a b c d,##,2)] → "a b c d"   (fn receives "a b" then "c d")
```

---

## List

### `words(str[, delim])`

Count of items in a delimited list.

```
// [words(a b c)]   → "3"
// [words(a|b,|)]   → "2"
```

### `word(str, n[, delim])`

Return the nth item (1-based). Returns `""` if out of range.

```
// [word(a b c,2)] → "b"
```

### `first(str[, delim])`

Return the first item.

```
// [first(a b c)] → "a"
```

### `last(str[, delim])`

Return the last item.

```
// [last(a b c)] → "c"
```

### `rest(str[, delim])`

All items after the first.

```
// [rest(a b c)] → "b c"
```

### `lrest(str[, delim])`

Alias for `rest`.

### `butlast(str[, delim])`

All items except the last.

```
// [butlast(a b c)] → "a b"
```

### `revwords(str[, delim])`

Reverse item order.

```
// [revwords(a b c)] → "c b a"
```

### `sort(list[, type[, delim[, outdelim]]])`

Sort items. `type`: `a` (alphabetical, default), `i` (case-insensitive), `n` (numeric).

```
// [sort(c a b)]       → "a b c"
// [sort(10 2 20,n)]   → "2 10 20"
```

### `lsort(list[, type[, delim[, outdelim]]])`

Alias for `sort`.

### `sortby(list, fn[, delim])`

Sort list alphabetically by a key derived from `fn`. Note: full UDF-based sort is a stub; currently sorts alphabetically.

### `sortkey(list, attr[, delim])`

Sort list by an attribute key. Currently a stub that sorts alphabetically.

### `unique(list[, delim])`

Remove duplicate items (case-insensitive), preserving first-occurrence order.

```
// [unique(a b a c b)] → "a b c"
```

### `shuffle(list[, delim])`

Randomize item order.

```
// [shuffle(a b c)] → "b a c"  (random)
```

### `extract(list, start, len[, delim[, outdelim]])`

Return `len` items starting at 1-based position `start`.

```
// [extract(a b c d,2,2)] → "b c"
```

### `elements(list, positions[, delim])`

Extract items at 1-based space-separated `positions`. Out-of-range positions silently skipped.

```
// [elements(a b c d,2 4)] → "b d"
```

### `ldelete(list, pos[, delim[, outdelim]])`

Remove item at 1-based position `pos`. Returns list unchanged if `pos` is out of range. Returns `#-1 ARGUMENT IS NOT A NUMBER` on bad pos.

```
// [ldelete(a b c,2)] → "a c"
```

### `delete(list, pos[, delim[, outdelim]])`

Alias for `ldelete`.

### `linsert(list, pos, new[, delim])`

Insert item `new` before 1-based position `pos`. Returns `#-1 ARGUMENT IS NOT A NUMBER` on bad pos.

```
// [linsert(a b c,2,x)] → "a x b c"
```

### `insert(list, pos, new[, delim])`

Alias for `linsert`.

### `lreplace(list, pos, new[, delim[, outdelim]])`

Replace item at 1-based position `pos` with `new`. Returns list unchanged if out of range.

```
// [lreplace(a b c,2,z)] → "a z c"
```

### `replace(list, pos, new[, delim[, outdelim]])`

Alias for `lreplace`.

### `remove(list, item[, delim[, outdelim]])`

Remove the first case-insensitive match for `item`.

```
// [remove(a b a c,a)] → "b a c"
```

### `member(list, word[, delim])`

Return 1-based position of first case-insensitive match for `word`, or `"0"` if not found.

```
// [member(a b c,b)] → "2"
```

### `lpos(list, word[, delim])`

Alias for `member`.

### `match(list, pattern[, delim])`

Return 1-based position of first item matching wildcard `pattern`, or `"0"`.

```
// [match(foo bar baz,b*)] → "2"
```

### `matchall(list, pattern[, delim])`

Return space-separated positions of all items matching wildcard `pattern`.

```
// [matchall(foo bar baz,b*)] → "2 3"
```

### `grab(list, pattern[, delim])`

Return first item matching wildcard `pattern`, or `""`.

```
// [grab(foo bar baz,b*)] → "bar"
```

### `graball(list, pattern[, delim])`

Return all items matching wildcard `pattern`.

```
// [graball(foo bar baz,b*)] → "bar baz"
```

### `ilist([start,] end[, step])`

Generate a space-separated integer list. One arg: `1` to `end`. Two args: `start` to `end`. Three args: with `step`.

```
// [ilist(5)]      → "1 2 3 4 5"
// [ilist(2,8,2)]  → "2 4 6 8"
// [ilist(5,1,-1)] → "5 4 3 2 1"
```

### `lnum([start,] end[, step])`

TinyMUX alias for `ilist`.

### `pickrand(list[, delim])`

Return a random single element from the list.

```
// [pickrand(a b c)] → "b"  (random)
```

### `lrand(min, max, count[, delim])`

Generate `count` random integers in `[min, max]`. Returns `#-1 COUNT IS NEGATIVE` if `count < 0`.

```
// [lrand(1,6,3)] → "4 1 6"  (random)
```

### `choose(list, weights[, delim])`

Weighted random pick. Returns `#-1 WEIGHTS MISMATCH` if counts differ; `#-1 ZERO WEIGHT` if all weights are 0.

```
// [choose(red green blue,1 3 1)] → "green"  (60% chance)
```

### `splice(list1, list2[, delim[, outdelim]])`

Interleave two lists element-by-element.

```
// [splice(a c e, b d f)] → "a b c d e f"
```

### `mix(list1, list2[, list3, …])`

Interleave multiple space-delimited lists round-robin.

```
// [mix(a b, 1 2, x y)] → "a 1 x b 2 y"
```

### `zip(list1, list2[, delim[, outdelim]])`

Zip two lists into `key:value` pairs, stopping at the shorter list.

```
// [zip(a b c, 1 2 3)] → "a:1 b:2 c:3"
```

### `setinter(l1, l2[, delim])`

Items present in both `l1` and `l2` (case-insensitive).

```
// [setinter(a b c, b c d)] → "b c"
```

### `setunion(l1, l2[, delim])`

All unique items from `l1` and `l2`, preserving first-occurrence order.

```
// [setunion(a b c, b c d)] → "a b c d"
```

### `setdiff(l1, l2[, delim])`

Items in `l1` not in `l2` (case-insensitive).

```
// [setdiff(a b c, b c d)] → "a"
```

### `munge(list1, list2, fn[, delim])`

Lazy — sort `list1` by a key derived from calling `fn` with corresponding pairs of items from `list1` and `list2`. Returns sorted `list1`.

```
// [munge(c a b, 3 1 2, %1)] → "a b c"
```

### `itemize(list[, delim[, conjunction[, punct]]])`

Format list in grammatical English. Default conjunction is `"and"` with Oxford comma.

```
// [itemize(a)]         → "a"
// [itemize(a b)]       → "a and b"
// [itemize(a b c)]     → "a, b, and c"
```

### `table(list, col_width[, delim[, numcols]])`

Format list into fixed-width columns (default 2 columns), rows separated by `\r\n`.

```
// [table(a b c d,10)] → "a         b\r\nc         d"
```

### `columns(list, col_width[, delim[, numcols]])`

Alias for `table`.

---

## String

### `strlen(str)`

Character count of `str`.

```
// [strlen(hello)] → "5"
```

### `mid(str, start, len)`

Substring. `start` is 0-based; negative values clamped to 0.

```
// [mid(hello,1,3)] → "ell"
```

### `left(str, n)`

First `n` characters.

```
// [left(hello,3)] → "hel"
```

### `right(str, n)`

Last `n` characters.

```
// [right(hello,3)] → "llo"
```

### `trim(str[, side[, char]])`

Trim whitespace (or `char`). `side`: `l` (left), `r` (right), `b` (both, default).

```
// [trim(  hi  )]      → "hi"
// [trim(xxhixx,b,x)]  → "hi"
```

### `ljust(str, width[, fill])`

Left-justify (right-pad) to `width` with `fill` (default space).

```
// [ljust(hi,5)]   → "hi   "
// [ljust(hi,5,*)] → "hi***"
```

### `rjust(str, width[, fill])`

Right-justify (left-pad) to `width`.

```
// [rjust(hi,5)] → "   hi"
```

### `center(str, width[, fill])`

Center-pad to `width`.

```
// [center(hi,6)] → "  hi  "
```

### `lpad(str, width[, fill])`

Left-pad (right-justify). Alias for `rjust`.

### `rpad(str, width[, fill])`

Right-pad (left-justify). Alias for `ljust`.

### `cpad(str, width[, fill])`

Center-pad. Alias for `center`.

### `ucstr(str)`

Convert to uppercase.

```
// [ucstr(hello)] → "HELLO"
```

### `lcstr(str)`

Convert to lowercase.

```
// [lcstr(HELLO)] → "hello"
```

### `capstr(str)`

Capitalize the first character.

```
// [capstr(hello world)] → "Hello world"
```

### `cat(str, str, …)`

Join two or more strings with a single space.

```
// [cat(foo,bar,baz)] → "foo bar baz"
```

### `strcat(str, …)`

Concatenate all args with no separator.

```
// [strcat(foo,bar,baz)] → "foobarbaz"
```

### `space(n)`

Return `n` space characters.

```
// [space(3)] → "   "
```

### `repeat(str, n)`

Repeat `str` `n` times.

```
// [repeat(ab,3)] → "ababab"
```

### `reverse(str)`

Reverse a string character by character (Unicode-safe).

```
// [reverse(hello)] → "olleh"
```

### `scramble(str)`

Randomly shuffle the characters of `str`.

```
// [scramble(hello)] → "olhle"  (random)
```

### `encrypt(str, key)`

XOR-cipher: each character of `str` XOR'd with the repeating `key`.

```
// [encrypt(hello,key)] → (binary ciphertext)
```

### `decrypt(str, key)`

XOR-cipher decrypt (same operation as `encrypt`).

### `comp(s1, s2)`

Lexicographic comparison: `-1` if `s1 < s2`, `0` if equal, `1` if `s1 > s2`.

```
// [comp(abc,abd)] → "-1"
// [comp(abc,abc)] → "0"
```

### `streq(s1, s2)`

Returns `"1"` if `s1` and `s2` are equal (case-insensitive), `"0"` otherwise.

```
// [streq(Hello,hello)] → "1"
```

### `pos(needle, haystack)`

1-based position of `needle` in `haystack` (case-insensitive). Returns `"0"` if not found.

```
// [pos(ell,hello)] → "2"
```

### `posn(needle, haystack, n)`

Position of the nth occurrence (1-based). Returns `"0"` if fewer than `n` matches.

```
// [posn(a,banana,2)] → "4"
```

### `after(str, delim)`

Text after the first occurrence of `delim`. Returns `""` if not found.

```
// [after(foo:bar,:)] → "bar"
```

### `before(str, delim)`

Text before the first occurrence of `delim`. Returns `str` if not found.

```
// [before(foo:bar,:)] → "foo"
```

### `index(list, delim, pos[, count])`

Return `count` (default 1) items starting at 1-based position `pos` from a list split by `delim`.

```
// [index(a b c d, ,2,2)] → "b c"
```

### `wordpos(str, charpos[, delim])`

Which 1-based word contains 1-based character position `charpos`. Returns `"0"` if out of range.

```
// [wordpos(foo bar,5)] → "2"
```

### `wordstart(str, n[, delim])`

1-based character position where word `n` starts. Returns `"0"` if out of range.

```
// [wordstart(foo bar,2)] → "5"
```

### `wordend(str, n[, delim])`

1-based character position of the last character of word `n`. Returns `"0"` if out of range.

```
// [wordend(foo bar,1)] → "3"
```

### `edit(str, from, to[, from2, to2, …])`

Find-and-replace, one or more from/to pairs applied left-to-right. Case-sensitive. An empty `from` appends `to`.

```
// [edit(hello world,world,MUSH)] → "hello MUSH"
// [edit(abc,a,1,b,2)]            → "12c"
```

### `ledit(list, from, to[, delim])`

Apply `edit(item, from, to)` to each item in `list`.

```
// [ledit(foo bar baz,a,@)] → "foo b@r b@z"
```

### `squish(str[, delim])`

Compress runs of the delimiter (default space) to a single delimiter and trim leading/trailing.

```
// [squish(  a  b  c  )] → "a b c"
```

### `strip(str[, chars])`

Remove all occurrences of each character in `chars` from `str`. With no `chars`, strips all whitespace.

```
// [strip(hello,lo)] → "he"
// [strip(h e l lo)] → "hello"
```

### `stripansi(str)`

Remove ANSI escape sequences (`\x1b[...m`) and softcode color codes (`%cX`, `%xX`).

```
// [stripansi(%crRed%cn)] → "Red"
```

### `secure(str)`

Escape `[`, `]`, `{`, `}`, `;`, `%`, and `\` to prevent evaluation.

```
// [secure([add(1,2)])] → "\[add(1\,2)\]"
```

### `escape(str)`

Escape `[` as `\[` and `%` as `%%` to prevent double-evaluation.

### `strmem(str)`

UTF-8 byte length of `str`.

```
// [strmem(hello)] → "5"
// [strmem(é)]     → "2"
```

### `strdiff(s1, s2)`

Sorted unique characters in `s1` that are not in `s2`.

```
// [strdiff(abc,bc)] → "a"
```

### `strinter(s1, s2)`

Sorted unique characters present in both `s1` and `s2`.

```
// [strinter(abc,bcd)] → "bc"
```

### `strunion(s1, s2)`

Sorted unique characters from either `s1` or `s2`.

```
// [strunion(abc,bcd)] → "abcd"
```

### `strunique(s)`

Remove duplicate characters, preserving first-occurrence order.

```
// [strunique(aabbcc)] → "abc"
```

### `strsort(s)`

Sort characters alphabetically.

```
// [strsort(cab)] → "abc"
```

### `strdelete(str, pos, len)`

Delete `len` characters starting at 1-based position `pos`.

```
// [strdelete(hello,2,3)] → "ho"
```

### `strinsert(str, pos, insert)`

Insert `insert` before 1-based position `pos`.

```
// [strinsert(helo,4,l)] → "hello"
```

### `strreplace(str, pos, new)`

Replace the single character at 1-based position `pos` with `new`. Returns `#-1 ARGUMENT OUT OF RANGE` if `pos` is out of range.

```
// [strreplace(hello,1,H)] → "Hello"
```

### `strtrunc(str, len)`

Truncate to `len` visible characters.

```
// [strtrunc(hello,3)] → "hel"
```

### `strdistance(s1, s2)`

Levenshtein edit distance.

```
// [strdistance(kitten,sitting)] → "3"
```

### `encode64(str)`

Base64-encode.

```
// [encode64(hello)] → "aGVsbG8="
```

### `decode64(str)`

Base64-decode. Returns `#-1 INVALID BASE64` on error.

```
// [decode64(aGVsbG8=)] → "hello"
```

### `url_escape(str)`

Percent-encode for URLs.

```
// [url_escape(hello world)] → "hello%20world"
```

### `url_unescape(str)`

Percent-decode. Returns `#-1 INVALID URL ENCODING` on error.

```
// [url_unescape(hello%20world)] → "hello world"
```

### `regmatch(str, pattern[, registers])`

Test if `str` matches regex `pattern`. Returns `"1"` or `"0"`. If `registers` is a space-separated list of register names, capture groups are stored in them. Returns `#-1 INVALID REGEX` on bad pattern.

```
// [regmatch(hello,hel.*)]     → "1"
// [regmatch(hello,(hel)(lo),a b)][r(a)][r(b)] → "1hellollo"
```

### `regmatchi(str, pattern[, registers])`

Case-insensitive `regmatch`.

### `regedit(str, pattern, replacement)`

Replace the first occurrence of regex `pattern` with `replacement`. Returns `#-1 INVALID REGEX` on bad pattern.

```
// [regedit(hello world,o,0)] → "hell0 world"
```

### `regediti(str, pattern, replacement)`

Case-insensitive `regedit`.

### `regeditall(str, pattern, replacement)`

Replace ALL occurrences of regex `pattern`.

```
// [regeditall(hello world,o,0)] → "hell0 w0rld"
```

### `regeditalli(str, pattern, replacement)`

Case-insensitive `regeditall`.

### `soundex(str)`

American Soundex code (4-character string).

```
// [soundex(Smith)] → "S530"
```

### `soundlike(s1, s2)`

Returns `"1"` if Soundex codes of `s1` and `s2` match.

```
// [soundlike(Smith,Smyth)] → "1"
```

### `subeval(str)`

Expand `%` substitutions in `str` but do NOT evaluate `[...]` function calls. Returns the string with substitutions expanded but function call brackets left as literal text.

```
// [setq(a,hello)][subeval([ucstr(%qa)])] → "[ucstr(hello)]"
```

### `s(str)`

Evaluate `str` as softcode.

```
// [s([add(1,2)])] → "3"
```

### `lit(str)`

Lazy — return the literal source text of the argument without evaluation.

```
// [lit([add(1,2)])] → "[add(1,2)]"
```

---

## Database

All DB functions require an `ObjectAccessor` implementation passed to `EvalEngine`. Methods noted as optional return a fallback if not implemented.

### `get(obj/attr)`

Read attribute `attr` from object `obj`. Returns `""` if unset, `#-1 BAD ARGUMENT FORMAT` if no `/`, `#-1 NO MATCH` if object not found.

Requires `accessor.resolveTarget` and `accessor.getAttr`.

```
// [get(#123/DESC)] → "A dark room."
```

### `xget(obj, attr)`

Like `get` but evaluates the attribute value as softcode before returning.

Requires `accessor.resolveTarget` and `accessor.getAttr`.

```
// [xget(#123,FORMULA)] → (evaluated result)
```

### `v(attr)`

Read attribute from the current executor. Shorthand for `get(%!/attr)`.

Requires `accessor.getAttr`.

```
// [v(DESC)] → "A dark room."
```

### `name(obj)`

Return the display name of an object. Returns `#-1 NO MATCH` if not found.

Requires `accessor.resolveTarget` and `accessor.getName`.

```
// [name(#1)] → "Wizard"
```

### `obj(obj)`

Resolve `obj` to its canonical dbref. Returns `#-1 NO MATCH` if not found.

Requires `accessor.resolveTarget`.

```
// [obj(me)] → "#42"
```

### `type(obj)`

Return the object type string (e.g. `"PLAYER"`, `"ROOM"`, `"THING"`, `"EXIT"`). Returns `#-1 NO MATCH` if not found.

Requires `accessor.resolveTarget`. Requires `accessor.getType`; returns `#-1 NO MATCH` if not implemented.

```
// [type(#1)] → "PLAYER"
```

### `hasattr(obj, attr)`

Returns `"1"` if attribute `attr` exists on `obj`, `"0"` otherwise.

Requires `accessor.resolveTarget` and `accessor.getAttr`.

```
// [hasattr(#1,DESC)] → "1"
```

### `hasflag(obj, flag)`

Returns `"1"` if `obj` has `flag`, `"0"` otherwise.

Requires `accessor.resolveTarget` and `accessor.hasFlag`.

```
// [hasflag(#1,WIZARD)] → "1"
```

### `lattr(obj[, pattern])`

Space-separated list of attribute names on `obj`, optionally filtered by wildcard `pattern`. Returns `""` if `accessor.listAttrs` is not implemented.

Requires `accessor.resolveTarget`. Optionally requires `accessor.listAttrs`.

```
// [lattr(#1)]       → "DESC ADESC SUCC"
// [lattr(#1,*DESC)] → "DESC ADESC"
```

### `u(obj/attr[, arg0, arg1, …])`

Evaluate attribute `attr` on `obj` as a function, passing args as `%0`–`%9`. Runs in a **fresh** register context — caller's registers not visible; `setq()` inside does not propagate back. Returns `#-1 NO MATCH` or `#-1 NO SUCH ATTRIBUTE` on error.

Requires `accessor.resolveTarget` and `accessor.getAttr`.

```
// [u(#1/ADD,%0 plus %1 is [add(%0,%1)],3,4)] → "3 plus 4 is 7"
```

### `ulocal(obj/attr[, arg0, arg1, …])`

Like `u()` but **shares** the parent's register map. `setq()` calls inside propagate back to the caller. Use when a UDF needs to return data via Q-registers.

Requires `accessor.resolveTarget` and `accessor.getAttr`.

### `objeval(obj, expr)`

Evaluate `expr` as softcode in a child context where the executor is `obj`. Fresh register context.

Requires `accessor.resolveTarget`.

```
// [objeval(#5,[name(me)])] → "Lounge"
```

### `pmatch(name)`

Partial player name match. Returns the player's dbref, or `#-1 NO MATCH` if not found or `accessor.findPlayer` is not implemented.

Optionally requires `accessor.findPlayer`.

```
// [pmatch(wiz)] → "#1"
```

### `loc(object)`

Return the location dbref of `object`. Returns `#-1 NO MATCH` or an error if `accessor.getLocation` is not implemented.

Requires `accessor.resolveTarget`. Requires `accessor.getLocation`.

```
// [loc(#42)] → "#0"
```

### `lcon(object[, type])`

Space-separated list of contents of `object`, optionally filtered by `type`. Returns an error if `accessor.getContents` is not implemented.

Requires `accessor.resolveTarget`. Requires `accessor.getContents`.

```
// [lcon(#0)]       → "#5 #12 #42"
// [lcon(#0,PLAYER)] → "#42"
```

### `lwho()`

Space-separated list of connected player dbrefs. Returns an error if `accessor.getConnectedPlayers` is not implemented.

Requires `accessor.getConnectedPlayers`.

```
// [lwho()] → "#1 #42"
```

### `lparent(object)`

Space-separated parent chain for `object`. Returns an error if `accessor.getParentChain` is not implemented.

Requires `accessor.resolveTarget`. Requires `accessor.getParentChain`.

```
// [lparent(#42)] → "#42 #5 #1"
```

### `isnum(str)`

Returns `"1"` if `str` is a valid number, `"0"` otherwise.

```
// [isnum(42)]    → "1"
// [isnum(3.14)]  → "1"
// [isnum(hello)] → "0"
```

### `isdbref(str)`

Returns `"1"` if `str` matches the pattern `#N` (non-negative integer), `"0"` otherwise.

```
// [isdbref(#42)] → "1"
// [isdbref(42)]  → "0"
```

### `null(args…)`

Evaluate all args (for side effects), return `""`.

```
// [null(setq(a,1),setq(b,2))] → ""
```

### `noop(args…)`

Alias for `null`.

---

## Formatting

### `ansi(code, text[, code, text, …])`

Wrap `text` in softcode ANSI formatting (`%cCODE...%cn`). Multiple code/text pairs can be specified.

```
// [ansi(r,Red Text)]   → "%crRed Text%cn"
// [ansi(bh,Bold Blue)] → "%cbhBold Blue%cn"
```

---

## Tags (RhostMUSH)

These functions are provided by the optional RhostMUSH plugin (`@ursamu/mushcode-rhost`), not by `registerStdlib()`. They are documented here for reference.

### `tag(name, text)`

Wrap `text` in a RhostMUSH named tag.

### `listtags()`

Return a list of currently-defined tag names.

### `tagmatch(name, text)`

Return `"1"` if `text` matches a tag named `name`.
