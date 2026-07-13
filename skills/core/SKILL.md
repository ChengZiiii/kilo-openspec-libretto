---
name: libretto-core
description: "Bootstrap discipline for libretto. Load this FIRST every session. Checks openspec CLI + openspec/ dir, establishes checkpoint rules and skill load order."
---

# Skill: libretto-core

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, you may skip
the interactive prerequisite checks below but must still follow the skill
load order rules.
</SUBAGENT-STOP>

## Purpose

This is the bootstrap skill for the libretto workflow. Load it FIRST every
session. It establishes discipline rules and checks prerequisites.

## Prerequisite checks

### 1. openspec CLI availability

Run `openspec --version` (via bash). If it fails:
- Tell the user: "libretto requires the OpenSpec CLI. Install it with:
  `npm install -g @fission-ai/openspec`"
- Stop until resolved.

### 2. openspec/ directory

Check if `openspec/` exists in the current project root. If not:
- Tell the user: "This project hasn't been initialized with OpenSpec."
- Offer to run `openspec init` (ask for permission first).
- If user declines, stop — libretto cannot operate without openspec/.

## Skill load order

The libretto workflow has 8 skills. Load them based on the current phase:

| Phase | Skill |
|---|---|
| Every session start (first) | `libretto-core` (this one) |
| Requirements unclear / investigating | `libretto-explore` |
| Ready to plan a change | `libretto-propose` |
| Implementing tasks (dispatched to libretto-apply) | `libretto-apply-change` |
| Merging delta specs into main | `libretto-sync-specs` |
| Verifying implementation (dispatched to libretto-verify) | `libretto-verify-change` |
| Archiving a completed change | `libretto-archive-change` |
| Emitting handoff prompt for new session | `libretto-handoff` |

## Checkpoint rule

Before starting any non-trivial work, emit:

```
[CHECKPOINT] Task classification: {simple | complex | explore}
Rationale: {one sentence}
```

## Core principle

libretto is **spec-driven**: you agree on what to build (via specs) before
writing code. The `openspec` CLI is the engine (validation, status, archiving,
delta merging); these skills are the steering wheel. Never write code without
a corresponding spec or change folder.

## OpenSpec workflow at a glance

```
explore → propose → [review] → apply → verify → sync → archive
 (opt)    (plan)    (user)    (code)   (check)  (merge) (file away)
```

- `libretto-explore`: no-stakes thinking, no artifacts
- `libretto-propose`: creates `openspec/changes/<name>/` with proposal + specs(deltas) + design + tasks
- `libretto-apply-change`: implements tasks.md, checks off `[x]`
- `libretto-verify-change`: three-dimension check before archiving
- `libretto-sync-specs`: merges delta specs into `openspec/specs/`
- `libretto-archive-change`: moves change to `changes/archive/YYYY-MM-DD-<name>/`