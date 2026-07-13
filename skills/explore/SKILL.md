---
name: explore
description: "No-stakes exploration before committing to a change. Reads codebase, compares options, shapes a plan. Creates no artifacts. Use when requirements are unclear."
---

# Skill: libretto-explore

## When to use

- User's requirements are unclear or fuzzy
- User wants to compare approaches before committing
- User says "I want X but I'm not sure how to do it cleanly"

## What it does

- Investigates the codebase (read files, search patterns)
- Compares 2-3 approaches with trade-offs
- Can create diagrams to clarify thinking
- Produces a recommendation, not artifacts

## What it does NOT do

- Does NOT create any files in `openspec/`
- Does NOT write code
- Does NOT commit to a direction without user agreement

## Protocol

1. Ask the user what they want to explore (if not already stated).
2. Read the relevant parts of the codebase.
3. Present 2-3 viable approaches with trade-offs and a recommendation.
4. Ask which direction interests them.
5. When the user is ready to commit, transition:

```
Ready to turn this into a change? Run /libretto-propose <change-name>.
```

## Key principle

Exploration is free. It costs nothing to think before writing specs. The
goal is to arrive at `libretto-propose` with a sharp, concrete plan rather
than a vague prompt. Already know exactly what you want? Skip this and go
straight to `libretto-propose`.