// ============================================================================
// child_slots.ts — authoritative child-field registry for every AST node type
//
// Used by walk() and transform() to know exactly which fields hold child nodes,
// whether each field is a single node (possibly null) or an array of nodes.
//
// Leaf types (Literal, Escape, Substitution, SpecialVar, Wildcard, TagRef,
// LockMe, LockDbref, LockFlagCheck, LockTypeCheck, LockAttrCheck,
// LockPlayerName) have no entry — the walker treats missing entries as leaves.
// ============================================================================

export type SlotKind = "single" | "array";

export interface SlotDef {
  field: string;
  kind:  SlotKind;
}

export const CHILD_SLOTS: Readonly<Record<string, SlotDef[]>> = {
  // ── Commands ────────────────────────────────────────────────────────────────
  CommandList:   [{ field: "commands",  kind: "array"  }],
  AtCommand:     [{ field: "object",    kind: "single" },   // Text | null
                  { field: "value",     kind: "single" }],  // AtCmdValue | null
  AttributeSet:  [{ field: "object",    kind: "single" },   // Text
                  { field: "value",     kind: "single" }],  // AtCmdValue | null
  UserCommand:   [{ field: "parts",     kind: "array"  }],

  // ── Patterns ────────────────────────────────────────────────────────────────
  DollarPattern: [{ field: "pattern",   kind: "single" },
                  { field: "action",    kind: "single" }],
  ListenPattern: [{ field: "pattern",   kind: "single" },
                  { field: "action",    kind: "single" }],
  PatternAlts:   [{ field: "patterns",  kind: "array"  }],
  Pattern:       [{ field: "parts",     kind: "array"  }],

  // ── Expression containers ───────────────────────────────────────────────────
  EvalBlock:     [{ field: "parts",     kind: "array"  }],
  BracedString:  [{ field: "parts",     kind: "array"  }],
  FunctionCall:  [{ field: "args",      kind: "array"  }],
  Arg:           [{ field: "parts",     kind: "array"  }],
  Text:          [{ field: "parts",     kind: "array"  }],

  // ── Lock expressions ────────────────────────────────────────────────────────
  LockOr:        [{ field: "operands",  kind: "array"  }],
  LockAnd:       [{ field: "operands",  kind: "array"  }],
  LockNot:       [{ field: "operand",   kind: "single" }],

  // Leaf types (no entry): Literal, Escape, Substitution, SpecialVar, Wildcard,
  // TagRef, LockMe, LockDbref, LockFlagCheck, LockTypeCheck, LockAttrCheck,
  // LockPlayerName
};
