---
name: libretto-handoff
description: "Emit a self-contained bootstrap prompt for the user to paste into a new libretto session, resuming from the apply phase. Zero files written."
---

# Skill: libretto-handoff

## When to use

After `libretto-propose` completes (all planning artifacts ready), the
orchestrator offers the user a choice: continue in this session or hand off
to a fresh session. This skill generates the handoff prompt for option B.

OpenSpec recommends clearing context before implementation for best results.
The handoff lets the user start a clean session that picks up exactly where
planning left off.

## What it does

Outputs a single markdown code block (plain text, zero files written to disk).
The user copies it into a new Kilo session with the `libretto` agent selected.

## Protocol

1. Confirm the change name and that all 4 planning artifacts exist:
   - `openspec/changes/<change-name>/proposal.md`
   - `openspec/changes/<change-name>/specs/`
   - `openspec/changes/<change-name>/design.md`
   - `openspec/changes/<change-name>/tasks.md`

2. Read `tasks.md` to count total tasks and confirm none are started yet.

3. Output this code block (substitute `<change-name>`):

````
--- 复制以下到新的 libretto 会话 ---
你是 libretto。当前 change: openspec/changes/<change-name>
planning artifacts 已就绪（proposal/specs/design/tasks），共 N 个 task 待实现。

恢复步骤：
1. 加载 libretto-core 与 libretto-apply-change skill
2. 读取 openspec/changes/<change-name>/tasks.md 确认进度（当前 0/N 完成）
3. 按 libretto-apply 协议逐条实现并勾选 [x]
4. 全部完成后触发 libretto-verify-change 验证
5. 验证通过后触发 libretto-archive-change 归档

（注：tasks.md 的 checkbox 是唯一进度状态来源）
--------------------------------------------
````

4. Tell the user: "Open a new Kilo session, select the `libretto` agent, and
   paste the block above. The new session will pick up from the apply phase
   with a clean context window."

## Key principle

The handoff writes NOTHING to disk. All state lives in `tasks.md` checkboxes.
The new session reads tasks.md to determine where to resume. This keeps the
change folder clean (no extra files that would break `openspec validate`).