---
name: propose
description: "Create a change and draft its planning artifacts (proposal, delta specs, design, tasks) in openspec/changes/<name>/. The core planning step."
---

# Skill: libretto-propose

## When to use

After exploration (or directly if requirements are clear), when ready to
create a structured change proposal.

## What it does

Creates `openspec/changes/<change-name>/` containing:

```
openspec/changes/<change-name>/
├── proposal.md    # Why + what + scope
├── specs/         # Delta specs (ADDED/MODIFIED/REMOVED requirements)
│   └── <area>/spec.md
├── design.md      # Technical approach + architecture decisions
└── tasks.md       # Implementation checklist (hierarchical checkboxes)
```

## Protocol

1. **Scaffold the change** — run via bash:
   ```bash
   openspec new change <change-name> --json
   ```
   If the `openspec` CLI is unavailable or this fails, create the directory
   structure manually: `mkdir -p openspec/changes/<change-name>/specs`.

2. **Write proposal.md** — capture:
   - **Intent**: why this change exists
   - **Scope**: what's in / out
   - **Approach**: high-level direction

3. **Write delta specs** (in `specs/<area>/spec.md`) — describe what's
   CHANGING, not the whole world:
   - `## ADDED Requirements` — new behavior with `#### Scenario:` blocks
   - `## MODIFIED Requirements` — changed behavior (note what changed)
   - `## REMOVED Requirements` — deprecated behavior
   Use RFC 2119 keywords (SHALL/MUST/SHOULD/MAY).

4. **Write design.md** — technical approach:
   - Architecture decisions (with rationale)
   - Data flow / file changes
   - Keep implementation details here, not in specs

5. **Write tasks.md** — implementation checklist:
   ```markdown
   # Tasks

   ## 1. <section>
   - [ ] 1.1 <task>
   - [ ] 1.2 <task>

   ## 2. <section>
   - [ ] 2.1 <task>
   ```

6. **Validate** — run `openspec validate --json` to check structure.

7. **Report** — tell the user the change is ready, summarize what was created,
   and ask them to review. Then the orchestrator offers the handoff checkpoint.

## Naming

- Use kebab-case: `add-dark-mode`, `fix-login-redirect`, `refactor-auth`
- Avoid generic names: `update`, `changes`, `wip`

## Key principle

Delta specs describe the DIFF, not the destination. `ADDED` this requirement,
`MODIFIED` that one. This is what makes OpenSpec work for existing codebases.