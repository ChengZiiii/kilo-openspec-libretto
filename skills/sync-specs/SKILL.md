---
name: sync-specs
description: "Merge a change's delta specs (ADDED/MODIFIED/REMOVED) into the main openspec/specs/ directory. Usually automatic during archive; use manually for long-running changes."
---

# Skill: libretto-sync-specs

## When to use

- Manually, when you want main specs updated before archiving (e.g., parallel
  changes need the updated base)
- Usually NOT needed: `libretto-archive-change` prompts to sync automatically

## What it does

Reads delta specs from `openspec/changes/<change-name>/specs/` and merges
them into `openspec/specs/`:
- `ADDED Requirements` → appended to the corresponding main spec
- `MODIFIED Requirements` → replaces the existing requirement
- `REMOVED Requirements` → deleted from the main spec

## Protocol

1. **Prefer the CLI** — try via bash:
   ```bash
   openspec archive <change-name> --json
   ```
   The archive command syncs specs automatically. If you only want to sync
   (not archive), check if the CLI has a sync subcommand. If not, proceed
   manually.

2. **Manual merge** (if CLI unavailable or sync-only needed):
   - For each `openspec/changes/<change-name>/specs/<area>/spec.md`:
     a. Read the delta sections (ADDED / MODIFIED / REMOVED)
     b. Read the target `openspec/specs/<area>/spec.md` (create if missing)
     c. Apply ADDED: append new requirements + scenarios
     d. Apply MODIFIED: replace matching requirement by name
     e. Apply REMOVED: delete matching requirement
     f. Write the updated main spec

3. **Validate** — run `openspec validate --json` after syncing.

4. **Report** — tell the orchestrator which specs were updated.

## Key principle

Sync is intelligent, not copy-paste. When adding scenarios to an existing
requirement, merge them — don't duplicate the requirement. The change stays
active after sync (it is not archived).