---
name: libretto-apply-change
description: "Implement tasks from a change's tasks.md against its spec deltas. Write code, run tests, check off items. Dispatched to libretto-apply."
---

# Skill: libretto-apply-change

## When to use

After a change's planning artifacts are approved, to implement the tasks.
This skill is loaded by the `libretto-apply` subagent.

## Protocol

1. **Read context** — load:
   - `openspec/changes/<change-name>/tasks.md` (the checklist)
   - `openspec/changes/<change-name>/specs/` (delta specs — what to build)
   - `openspec/changes/<change-name>/design.md` (technical approach)
   - `openspec/specs/` (existing specs for context, if relevant)

2. **Check openspec status** — run via bash:
   ```bash
   openspec status --change <change-name> --json
   ```
   This shows artifact completion and which tasks are ready.

3. **Work through tasks** in order:
   - For each unchecked task `- [ ]`:
     a. Read the spec requirement it implements
     b. Write the code
     c. Run tests (TDD: write failing test first if project has tests)
     d. Verify the test passes
     e. Mark the checkbox: change `- [ ]` to `- [x]` in tasks.md
   - Skip tasks blocked by incomplete dependencies

4. **After all tasks** — run the full test suite. All must pass.

5. **Report** — summarize to the orchestrator:
   - Files created/modified
   - Tasks completed (X/Y with IDs)
   - Test results
   - Deviations + rationale

## Resuming after interruption

Progress is tracked in `tasks.md` checkboxes. To resume:
- Read tasks.md
- Find the first unchecked task
- Continue from there

## Key principle

Spec first, code second. Every task should trace back to a requirement in the
delta specs. If you find yourself writing code that isn't in any spec, stop
and escalate to the orchestrator — the spec may need updating.