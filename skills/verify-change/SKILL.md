---
name: verify-change
description: "Three-dimension verification of a change's implementation (completeness/correctness/coherence) plus openspec validate. Dispatched to libretto-verify. Reports only."
---

# Skill: libretto-verify-change

## When to use

After `libretto-apply` completes all tasks, before archiving. Dispatched to
the `libretto-verify` subagent.

## Three dimensions

### Completeness
- All tasks in `tasks.md` are checked `[x]`
- Every requirement in the delta specs has corresponding code in the codebase
- Every scenario (`#### Scenario:`) is covered by implementation or test
- No spec requirement was silently dropped

### Correctness
- Implementation matches the spec's stated behavior (not just "works")
- Edge cases described in scenarios are handled
- Error states match the spec's error definitions
- RFC 2119 keywords respected (MUST = hard requirement, SHOULD = recommended)

### Coherence
- Design decisions from `design.md` are reflected in the code structure
- Naming conventions are consistent with the design doc
- Patterns match the project's existing idioms (check surrounding code)
- No unexplained divergence between design and implementation

## Structural validation

Run via bash:
```bash
openspec validate --json
```
Confirm the change's artifact structure is valid. Include any structural
issues in the report.

## Protocol

1. Read the change's delta specs + design.md + tasks.md
2. Search the codebase for implementation evidence
3. Check each dimension exhaustively
4. Run `openspec validate --json`
5. Produce the report (see `libretto-verify` agent for format)

## Key principle

Verify catches drift between specs and implementation BEFORE archiving.
Once archived, the delta merges into the source of truth — if it's wrong,
the truth is wrong. Better to catch it now.