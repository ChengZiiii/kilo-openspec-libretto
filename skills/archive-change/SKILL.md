---
name: libretto-archive-change
description: "Archive a completed change: validate, sync delta specs, move to changes/archive/YYYY-MM-DD-<name>/. Final step of the workflow."
---

# Skill: libretto-archive-change

## When to use

After `libretto-verify` passes (or passes with warnings), to finalize the
change and fold its deltas into the main specs.

## What it does

1. Validates the change structure
2. Syncs delta specs into `openspec/specs/` (if not already synced)
3. Moves the change folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`

## Protocol

1. **Pre-check** — confirm:
   - All tasks in `tasks.md` are checked `[x]` (warn if not, don't block)
   - `libretto-verify-change` was run (recommend but don't block)

2. **Archive via CLI** — run via bash:
   ```bash
   openspec archive <change-name> --json
   ```
   This handles validation, spec sync, and the move atomically.

3. **If CLI unavailable** (manual fallback):
   a. Sync delta specs (see `libretto-sync-specs` skill)
   b. Create `openspec/changes/archive/` if missing
   c. Move `openspec/changes/<change-name>/` to
      `openspec/changes/archive/YYYY-MM-DD-<change-name>/`
      (use today's date)

4. **Report** — tell the user:
   - Specs updated (which areas)
   - Archived to `changes/archive/YYYY-MM-DD-<name>/`
   - The change is complete; ready for the next feature

## Key principle

Archiving closes the loop: the delta specs merge into the source of truth,
and the change folder is preserved for audit history. After archive,
`openspec/specs/` describes the new reality.