// ============================================================================
// MUX Softcode Grammar — PEG.js / Peggy
//
// Parses TinyMUX 2.x / PennMUSH softcode stored in attribute values.
// Produces a typed AST suitable for analysis, transformation, and linting.
//
// Allowed start rules: "Start" (attribute value), "LockExpr" (lock key)
//
// Install Peggy:  npm install -g peggy
// Compile:        peggy --allowed-start-rules Start,LockExpr mux-softcode.pegjs
//
// Quick test:
//   const parser = require("./mux-softcode.js");
//   parser.parse('$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]');
//
// AST node types:
//   AttributeValue  DollarPattern  ListenPattern  PatternAlts  Pattern  Wildcard
//   CommandList     AtCommand      AttributeSet   UserCommand
//   EvalBlock       FunctionCall   Arg
//   BracedString    Text
//   Substitution    SpecialVar     Escape         Literal
//   LockOr  LockAnd  LockNot  LockMe  LockDbref
//   LockFlagCheck   LockTypeCheck  LockAttrCheck  LockPlayerName
// ============================================================================

{{
  // ── Module-level helpers (shared across all parses) ──────────────────────

  // Holds the `location` function injected by the per-parse initializer below.
  // Safe because Peggy parsers are synchronous — no interleaving between parses.
  let _loc = null;

  /**
   * Construct a typed AST node, attaching the current source location.
   * `loc` is always present when called from a grammar action; it is absent
   * only on nodes constructed manually in tests or by transform().
   */
  function node(type, props) {
    const n = Object.assign({ type }, props);
    if (_loc) n.loc = _loc();
    return n;
  }

  /**
   * Merge adjacent Literal nodes to reduce AST noise.
   * e.g. [Literal("foo"), Literal("bar")] → [Literal("foobar")]
   * When merging, loc.end is extended to cover the full span.
   */
  function coalesce(parts) {
    if (!parts || parts.length === 0) return parts;
    const out = [];
    for (const p of parts) {
      if (
        p.type === "Literal" &&
        out.length > 0 &&
        out[out.length - 1].type === "Literal"
      ) {
        const last = out[out.length - 1];
        last.value += p.value;
        // Extend the span to cover the merged token
        if (last.loc && p.loc) {
          last.loc = { start: last.loc.start, end: p.loc.end };
        }
      } else {
        out.push(p);
      }
    }
    return out;
  }
}}

{
  // Per-parse initializer: capture the `location` function for this parse run.
  // Called once at the start of every peg$parse() invocation.
  _loc = location;
}

// ============================================================================
// Entry Point
// ============================================================================

// Default start rule — parse a full attribute value.
// Leading/trailing whitespace is consumed so multi-line attribute values
// (whitespace-normalized when stored by MUX) parse cleanly.
Start
  = _ av:AttributeValue _ { return av; }

// An attribute value is either a command-trigger definition or a command list.
AttributeValue
  = DollarPattern
  / ListenPattern
  / CommandList

// Value of an @command or &attr-set after `=`.
// Like AttributeValue but uses CmdToken* for the plain case so that an
// unprotected semicolon at the outer level ends the command rather than
// being consumed into the value.  Semicolons inside `{}` or `[]` are
// still protected and will not break out of the command.
AtCmdValue
  = DollarPattern
  / ListenPattern
  / parts:CmdToken* {
      return node("UserCommand", { parts: coalesce(parts) });
    }


// ============================================================================
// Dollar-Sign Pattern  —  $<pattern> : <action>
//
// Defines a soft-coded user command.  The attribute value begins with `$`
// followed by a glob pattern, a `:`, and then a command action.
//
// Multiple pattern alternatives may be separated by `;` before the `:`.
//
// Examples:
//   $+finger *:@pemit %#=[u(me/FN_FINGER,%0)]
//   $hi;hello;hey *:@pemit %#=Greetings, %0!
//   $+stat/set *=*:@switch [setq(0,pmatch(%0))]=1,{...},{...}
// ============================================================================

DollarPattern
  = "$" pattern:PatternSpec ":" action:CommandList {
      return node("DollarPattern", { pattern, action });
    }

// ============================================================================
// Listen Pattern  —  ^<pattern> : <action>
//
// Defines a soft-coded listen trigger.  When the object hears text that
// matches the pattern, the action is executed.
//
// Identical syntax to DollarPattern but triggered by ambient speech rather
// than typed commands.
//
// Examples:
//   ^*hello*:@pemit %#=I heard you say hello!
//   ^*help*;^*assist*:@pemit %#=Do you need help?
// ============================================================================

ListenPattern
  = "^" pattern:PatternSpec ":" action:CommandList {
      return node("ListenPattern", { pattern, action });
    }


// Multiple glob alternatives before the colon
PatternSpec
  = head:SinglePattern tail:(";" SinglePattern)* {
      const patterns = [head, ...tail.map(t => t[1])];
      return patterns.length === 1
        ? patterns[0]
        : node("PatternAlts", { patterns });
    }

// One glob pattern — may contain * and ? wildcards and escape sequences
SinglePattern
  = parts:PatternPiece+ {
      return node("Pattern", { parts: coalesce(parts) });
    }

PatternPiece
  = "*"              { return node("Wildcard", { wildcard: "*" }); }
  / "?"              { return node("Wildcard", { wildcard: "?" }); }
  / "\\" char:.      { return node("Escape",   { char }); }
  / chars:$([^;:*?\\]+) { return node("Literal", { value: chars }); }


// ============================================================================
// Command List  —  cmd ; cmd ; cmd ...
//
// Commands at the top level are separated by unprotected semicolons.
// A semicolon inside `{}` or `[]` does NOT end a command.
//
// When only one command is present, return it directly (no wrapping node).
// ============================================================================

CommandList
  = head:Command tail:(";" Command)* {
      const commands = [head, ...tail.map(t => t[1])];
      return commands.length === 1
        ? commands[0]
        : node("CommandList", { commands });
    }


// ============================================================================
// Command Forms
//
// MUX softcode has three kinds of commands at the top level:
//   1. @built-in commands:  @pemit, @set, @dolist, @switch, @lock, …
//   2. Attribute-set commands:  &ATTRNAME object=value
//   3. User/soft commands:  +finger Bob, say Hello, go north, …
// ============================================================================

Command
  = AtCommand
  / AttributeSet
  / UserCommand


// ── @command  ──────────────────────────────────────────────────────────────
//
// @name[/switch]* [object[=value]]
//
// The value after `=` is parsed as a full AttributeValue, so it can itself
// contain dollar patterns (e.g., @trigger inside an attribute set) or nested
// command lists.
//
// Note: @command-specific argument syntax (e.g., @switch's comma-delimited
// cases, @wait's time:command form) is NOT parsed here — those cases appear
// as generic text inside the value.  Semantic analysis is a separate concern.
//
// Examples:
//   @pemit %#=Hello, [name(%#)]!
//   @set me=SAFE
//   @lock/enter me=flag^WIZARD
//   @dolist [lwho()]={@pemit ##=Restart in 5 min.}
//   @switch [gt(%0,10)]=1,{big},{small}

AtCommand
  = "@" name:AtCmdName switches:AtSwitch* body:AtCmdBody? {
      return node("AtCommand", {
        name,
        switches,
        object: body ? body.object : null,
        value:  body ? body.value  : null,
      });
    }

AtCmdName = $([a-zA-Z][a-zA-Z0-9_-]*)

AtSwitch
  = "/" n:$([a-zA-Z][a-zA-Z0-9_-]*) { return n; }

// The body of an @command: optional object, optional =value.
// Both alternatives begin with optional whitespace (_).
AtCmdBody
  = _ obj:ObjText "=" val:AtCmdValue {
      return { object: obj, value: val };
    }
  / _ obj:ObjText {
      return { object: obj, value: null };
    }


// ── Attribute-Set Command  ──────────────────────────────────────────────────
//
// &ATTR_NAME object=value
//
// The value is a full AttributeValue, so it may be a DollarPattern
// (the common case when defining soft commands on objects).
//
// Examples:
//   &DATA_SCORE me=100
//   &FN_ADD me=[add(%0,%1)]
//   &CMD_FINGER Global=$+finger *:@pemit %#=[u(me/FN_FINGER,%0)]
//   &DATA_SCORE me                     ← no-value form clears the attribute

AttributeSet
  = "&" attr:AttrIdent _ obj:ObjText "=" val:AtCmdValue {
      return node("AttributeSet", { attribute: attr, object: obj, value: val, hidden: attr.startsWith("_") });
    }
  / "&" attr:AttrIdent _ obj:ObjText {
      return node("AttributeSet", { attribute: attr, object: obj, value: null, hidden: attr.startsWith("_") });
    }

// Attribute name: letters, digits, underscores, hyphens (case-sensitive in storage)
AttrIdent = $([a-zA-Z_][a-zA-Z0-9_-]*)


// ── User / Soft Command (catch-all)  ──────────────────────────────────────
//
// Anything that isn't an @command or &attr-set.
// Includes built-in player commands (say, go, look, …) and soft-coded
// user commands (+finger, +who, etc.) triggered from dollar patterns.
//
// Examples:
//   +finger Bob
//   say Hello, world!
//   go north

UserCommand
  = parts:CmdToken* {
      return node("UserCommand", { parts: coalesce(parts) });
    }


// ============================================================================
// Object Text  (before the `=` in a command)
//
// Used in both @command and &attr-set positions.
// Terminates at `=` or `;` (next command).
//
// Object names may contain spaces (e.g., "Finger Object"), dbrefs (#123),
// function results ([name(%#)]), and substitutions (%N).
// ============================================================================

ObjText
  = parts:ObjToken+ {
      return node("Text", { parts: coalesce(parts) });
    }

ObjToken
  = EvalBlock
  / BracedString
  / Substitution
  / SpecialVar
  / TagRef
  / Escape
  / ObjLiteralChars

// Literal characters in object position: anything except = ; [ { % \ #
// Note: # excluded so ##/#@/#$ can always be picked up as SpecialVar
ObjLiteralChars
  = chars:$([^=;\[{%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$") { return node("Literal", { value: "#" }); }


// ============================================================================
// Command-Level Tokens
//
// Tokens that may appear inside a command's value/body.
// Terminates at `;` (next command).
// ============================================================================

CmdToken
  = EvalBlock
  / BracedString
  / Substitution
  / SpecialVar
  / TagRef
  / Escape
  / CmdLiteralChars

// Literal characters at command level: anything except ; [ { % \ #
// # excluded so ##/#@/#$ are tried as SpecialVar before literal fallback.
CmdLiteralChars
  = chars:$([^;\[{%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$") { return node("Literal", { value: "#" }); }


// ============================================================================
// Braced String  —  { ... }
//
// Protects the contents from the surrounding parser:
//   • Semicolons  `;`  inside braces do NOT separate commands.
//   • Commas      `,`  inside braces do NOT separate function arguments.
//   • Braces nest: { outer { inner } more }
//
// However, the following still apply inside braces:
//   • %x substitutions  (e.g., %N, %0, %q0)
//   • [] evaluation     (e.g., [add(1,2)])
//   • \ escape sequences
//
// Examples:
//   {don't;split;this}
//   {@pemit %#=Hello, %0!}       ← protects the semicolon
//   {[add(%0,1)]}                ← evaluation still happens
// ============================================================================

BracedString
  = "{" parts:BracedToken* "}" {
      return node("BracedString", { parts: coalesce(parts) });
    }

BracedToken
  = BracedString        // nested braces — braces always nest
  / EvalBlock           // [] evaluation still applies inside {}
  / Substitution        // %x substitution still applies
  / SpecialVar          // ## #@ #$ still work
  / TagRef              // #tagname still works inside braces
  / Escape              // \ still escapes
  / BracedLiteralChars  // everything else — including ; , = ( )

// Literal characters inside braces: anything except { } [ % \ #
// Note: ; and , are allowed here — that is the whole point of braces.
// # excluded so ##/#@/#$ can be picked up as SpecialVar.
BracedLiteralChars
  = chars:$([^{}\[%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$") { return node("Literal", { value: "#" }); }


// ============================================================================
// Eval Block  —  [ ... ]
//
// The content is evaluated and the result string replaces the block.
// Evaluation is innermost-first (deep-to-shallow nesting).
//
// The primary content is function calls, but substitutions, nested eval
// blocks, and literal text are also valid inside [].
//
// Examples:
//   [add(1,2)]                     → "3"
//   [name(%#)]                     → enactor's name
//   [if(gt(%0,10),big,small)]
//   [setq(0,pmatch(%0))][r(0)]     → two back-to-back eval blocks
//   [ansi(hg,SUCCESS)]             → bold green "SUCCESS"
// ============================================================================

EvalBlock
  = "[" parts:EvalToken* "]" {
      return node("EvalBlock", { parts: coalesce(parts) });
    }

// Inside an eval block, FunctionCall is tried first because it has a specific
// signature (identifier immediately followed by `(`).  If that fails, fall
// through to the other token types.
EvalToken
  = FunctionCall        // name(arg, ...) — most common eval content
  / EvalBlock           // nested []
  / BracedString        // {} inside [] still protects content
  / Substitution        // %x
  / SpecialVar          // ## #@ #$
  / TagRef              // #tagname
  / Escape              // \x
  / EvalLiteralChars    // anything except [ ] { % \

// In eval context, ( and ) can appear as literal characters
// (they are only syntactically meaningful after an identifier, handled by FunctionCall).
// # excluded so ##/#@/#$ are tried as SpecialVar before literal fallback.
EvalLiteralChars
  = chars:$([^\[\]{}%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$") { return node("Literal", { value: "#" }); }


// ============================================================================
// Function Call  —  name(arg, arg, ...)
//
// All MUX built-in and user-defined functions (via u()) follow this pattern.
// Function names are case-insensitive at runtime; this grammar preserves case.
//
// Zero-argument functions are supported: lwho(), rand(0), secs().
//
// Examples:
//   add(1,2)
//   if(gt(%0,10),big,small)
//   u(me/FN_HELLO,%0,%1)
//   iter([lcon(%L)],##: [get(%q0/S_##)], ,%b  )
//   setq(0,pmatch(trim(%0)))
// ============================================================================

// Zero-arg functions use the first alternative to avoid a zero-length match
// ambiguity: lwho()  secs()  time()  rand()  → args: []
// Functions with arguments use the second alternative.
FunctionCall
  = name:FuncIdent "()" {
      return node("FunctionCall", { name, args: [] });
    }
  / name:FuncIdent "(" args:ArgList ")" {
      return node("FunctionCall", { name, args });
    }

// Function identifiers: letters, digits, underscores (must start with letter/underscore)
FuncIdent = $([a-zA-Z_][a-zA-Z0-9_]*)

// Argument list: one or more arguments separated by commas.
// Empty positional args are valid: setq(0,) · iter(list,,delim)
// FuncArg accepts zero tokens so empty positions parse correctly.
ArgList
  = head:FuncArg tail:("," FuncArg)* {
      return [head, ...tail.map(t => t[1])];
    }

// A single function argument — zero or more arg tokens.
// An empty arg (between two commas, or before/after the only comma) is valid.
FuncArg
  = parts:ArgToken* {
      return node("Arg", { parts: coalesce(parts) });
    }

// Tokens inside a function argument:
//   • `,` and `)` terminate the argument — except when inside {} or []
//   • {} braces protect commas: {a,b} passes literal "a,b" as one argument
//   • [] blocks are evaluated: [add(1,2)] → "3" as part of the argument value
//   • A bare `(` not following an identifier is a literal character (TinyMUX
//     paren-stack semantics).  The matching `)` is also consumed as literal
//     via BalancedParens so common patterns like (text) and (a)(b) work.
//     Note: commas inside BalancedParens still split arguments — use {} if
//     you need a literal comma inside parentheses.
ArgToken
  = FunctionCall        // nested call: iter([lcon(%L)],name(##))
  / EvalBlock           // [...] within an argument
  / BracedString        // {...} — commas and ) inside are literal
  / BalancedParens      // (literal text) — bare ( not preceded by identifier
  / Substitution        // %x
  / SpecialVar          // ## #@ #$
  / TagRef              // #tagname
  / Escape              // \x
  / ArgLiteralChars     // everything except , ( ) [ ] { } % \

// Balanced parentheses in argument context.
// A bare `(` (not preceded by an identifier — which would be FunctionCall)
// is treated as a literal character.  Its matching `)` is also literal.
// Commas inside are NOT protected — they still separate function arguments.
// For commas-inside-parens use braces: {(a,b)} passes "(a,b)" as one arg.
BalancedParens
  = "(" parts:BalancedParenToken* ")" {
      const inner = coalesce(parts);
      return node("Literal", {
        value: "(" + inner.map(p => p.type === "Literal" ? p.value : "").join("") + ")"
      });
    }

// Tokens inside BalancedParens — same as ArgToken except commas are allowed
// as literals (we're inside a paren group, not at a function arg boundary).
BalancedParenToken
  = FunctionCall
  / EvalBlock
  / BracedString
  / BalancedParens
  / Substitution
  / SpecialVar
  / TagRef
  / Escape
  / BalancedParenLiteral

BalancedParenLiteral
  = chars:$([^\[\](){}%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$")    { return node("Literal", { value: "#" }); }

// Literal characters inside function arguments.
// NOTE: ( and ) are excluded because ) ends the argument list and
//       ( is handled by BalancedParens / FunctionCall above.
//       Use {(text)} or \( to pass literal parens without the balancing rule.
// # excluded so ##/#@/#$ are tried as SpecialVar before literal fallback.
ArgLiteralChars
  = chars:$([^,\[\](){}%\\#]+) { return node("Literal", { value: chars }); }
  / "#" !("#" / "@" / "$") { return node("Literal", { value: "#" }); }


// ============================================================================
// Substitutions  —  % + code
//
// Expanded at evaluation time to their runtime values.
//
// Identity / executor context:
//   %#   enactor's dbref               %!   executor's dbref (object running attr)
//   %@   caller's dbref                %+   number of positional arguments
//
// Names:
//   %N   enactor's name (mixed case)   %n   enactor's name (lowercase)
//   %L   enactor's location dbref
//
// Pronouns (resolved from enactor's SEX attribute):
//   %s / %S   subjective  he/she/it    He/She/It
//   %o / %O   objective   him/her/it   Him/Her/It
//   %p / %P   possessive  his/her/its  His/Her/Its
//   %a / %A   absolute    his/hers/its His/Hers/Its
//
// Positional args:
//   %0–%9   positional arguments (passed via u() or @trigger)
//
// Registers:
//   %q0–%q9   local registers (set with setq())
//   %qa–%qz   extended registers (TinyMUX 2.10+)
//
// Iter / loop:
//   %i0–%i9   nested iter() item at depth N (equivalent to itext(N))
//
// Variable attributes (VA–VZ on executor):
//   %VA–%VZ   value of attribute VA through VZ on the executor
//   %va–%vz   same, lowercase key variant (TinyMUX accepts both)
//
// Formatting:
//   %r / %R   carriage return / newline
//   %t / %T   tab character
//   %b / %B   space character
//   %%        literal percent sign
//   %\        literal backslash
//   %[        literal [
//   %]        literal ]
//   %,        literal comma
//   %;        literal semicolon
//
// Command context:
//   %l / %M   text of the last command entered
//   %w        newline if command came from queue, else empty
//   %|        output of previous piped command
//
// ANSI color / formatting (always followed by a code or <spec>):
//   %xN / %cN        single-letter ANSI code  (e.g. %xr = red fg, %xh = bold)
//   %x<spec>         color spec: name, #RRGGBB, or R G B
//   %XN / %CN        uppercase ANSI variant
//   %X<spec> / %C<spec>
// ============================================================================

Substitution
  = "%" code:SubCode {
      return node("Substitution", { code });
    }

SubCode
  // Registers (must come before single-char to avoid e.g. 'q' matching alone)
  // TinyMUX supports %q0-%q9 (indices 0-9), %qa-%qz/%qA-%qZ (indices 10-35),
  // and named registers (%qFoo, %qmy_reg — alphanumeric+underscore, max 32 chars).
  = "q" name:$([0-9a-zA-Z_]+) { return "q" + name; }
  / "i" n:[0-9]      { return "i" + n; }

  // Variable attributes %VA–%VZ, %va–%vz
  / "V" n:[A-Za-z]   { return "V" + n; }
  / "v" n:[A-Za-z]   { return "v" + n; }

  // ANSI color with angle-bracket spec (try before single-letter form)
  / "x" "<" s:$([^>]*) ">"  { return "x<" + s + ">"; }
  / "X" "<" s:$([^>]*) ">"  { return "X<" + s + ">"; }
  / "c" "<" s:$([^>]*) ">"  { return "c<" + s + ">"; }
  / "C" "<" s:$([^>]*) ">"  { return "C<" + s + ">"; }

  // ANSI color single-letter  %xr, %xh, %cb, etc.
  / "x" n:[a-zA-Z0-9]  { return "x" + n; }
  / "X" n:[a-zA-Z0-9]  { return "X" + n; }
  / "c" n:[a-zA-Z0-9]  { return "c" + n; }
  / "C" n:[a-zA-Z0-9]  { return "C" + n; }

  // Literal backslash
  / "\\"  { return "\\"; }

  // %=ATTR — read an attribute value by name on the executor (TinyMUX 2.x)
  // e.g. %=SCORE reads the SCORE attribute.  Must come before the bare = case.
  / "=" name:$([a-zA-Z_][a-zA-Z0-9_-]*) { return "=" + name; }

  // All remaining single-character codes
  // %k/%K = moniker (accented name)
  // %:    = enactor object-id (#dbref:creation_timestamp)
  / c:[#NnSOPAsopaL!0-9RBTMrtblw@+|%kK:] { return c; }

  // Literal bracket / punctuation codes
  / "["  { return "["; }
  / "]"  { return "]"; }
  / ","  { return ","; }
  / ";"  { return ";"; }


// ============================================================================
// Special Variables  —  ## · #@ · #$
//
// Used inside iter() and @dolist to reference the current iteration state.
//
//   ##   current list item value          (= itext(0) at the innermost level)
//   #@   current list item position       (1-indexed; = inum(0))
//   #$   last dbref returned by a name-lookup function
//
// These are tried as higher-priority alternatives before literal text in every
// token context, so they are always recognised even when adjacent to other #
// characters (e.g., #1 is still a literal dbref reference).
// ============================================================================

SpecialVar
  = "##" { return node("SpecialVar", { code: "##" }); }
  / "#@" { return node("SpecialVar", { code: "#@" }); }
  / "#$" { return node("SpecialVar", { code: "#$" }); }


// ============================================================================
// Tag Reference  —  #tagname  (RhostMUSH)
//
// RhostMUSH supports a tag system (@tag/@ltag) where objects can be assigned
// named tags.  `#tagname` is a shorthand that resolves to the object's dbref
// at runtime via objecttag_get().
//
// Tag names begin with a letter or underscore and may contain letters, digits,
// underscores, and hyphens.  Numeric dbrefs (#123) are NOT TagRefs — they are
// handled by the literal fallback rules.  ##, #@, #$ are SpecialVars and take
// priority because SpecialVar is tried before TagRef in every token list.
//
// Examples:
//   #weather          → TagRef(name="weather")
//   #_localdb         → TagRef(name="_localdb")
//   #my-tag           → TagRef(name="my-tag")
// ============================================================================

TagRef
  = "#" name:$([a-zA-Z_][a-zA-Z0-9_-]*) {
      return node("TagRef", { name });
    }


// ============================================================================
// Escape Sequence  —  \ + char
//
// Prevents one level of evaluation for the next character.
// In command context: `;` → literal semicolon, `[` → literal bracket, etc.
// In function-arg context: `,` → literal comma, `)` → literal close-paren.
//
// The grammar records the escaped character as-is for later analysis.
// ============================================================================

Escape
  = "\\" char:. {
      return node("Escape", { char });
    }


// ============================================================================
// Lock Expression Grammar
//
// Lock expressions are used as values in @lock commands.
// This grammar can be used as an alternate start rule for parsing lock keys.
//
// Example lock expressions:
//   me                         owner only
//   #123                       specific dbref
//   flag^WIZARD                players with WIZARD flag
//   !me                        anyone except owner
//   me|#123                    owner OR dbref #123
//   me&#456                    owner AND #456
//   =PlayerName                specific player by name
//   type^ROOM                  type check
//   flag^WIZARD|flag^ADMIN     wizard or admin
//
// Operator precedence (lowest to highest):
//   |   OR
//   &   AND
//   !   NOT (prefix)
//   (primary terms)
// ============================================================================

LockExpr = LockOr

LockOr
  = head:LockAnd tail:("|" LockAnd)* {
      if (tail.length === 0) return head;
      return node("LockOr", { operands: [head, ...tail.map(t => t[1])] });
    }

LockAnd
  = head:LockNot tail:("&" LockNot)* {
      if (tail.length === 0) return head;
      return node("LockAnd", { operands: [head, ...tail.map(t => t[1])] });
    }

LockNot
  = "!" operand:LockNot { return node("LockNot", { operand }); }
  / LockPrimary

LockPrimary
  = "(" _ expr:LockExpr _ ")"  { return expr; }
  / "me" ![a-zA-Z0-9_]         { return node("LockMe", {}); }
  / LockDbref
  / LockFlagCheck
  / LockTypeCheck
  / LockAttrCheck
  / LockPlayerName

// #123 — specific object by dbref  (#-1 is also valid in some contexts)
LockDbref
  = "#" n:$("-"? [0-9]+) {
      return node("LockDbref", { dbref: "#" + n });
    }

// flag^FLAGNAME — object must have this flag
LockFlagCheck
  = "flag^" name:$([a-zA-Z_]+) {
      return node("LockFlagCheck", { flag: name });
    }

// type^ROOM|THING|EXIT|PLAYER — object must be this type
LockTypeCheck
  = "type^" name:$([a-zA-Z_]+) {
      return node("LockTypeCheck", { typeName: name });
    }

// attr^ATTRNAME — object must have this attribute set
LockAttrCheck
  = "attr^" name:$([a-zA-Z_][a-zA-Z0-9_-]*) {
      return node("LockAttrCheck", { attribute: name });
    }

// =PlayerName — specific connected player by name
LockPlayerName
  = "=" name:$([^|&!()[\]{}\r\n]+) {
      return node("LockPlayerName", { name: name.trim() });
    }


// ============================================================================
// Whitespace
// ============================================================================

_  = [ \t\r\n]*
__ = [ \t\r\n]+
