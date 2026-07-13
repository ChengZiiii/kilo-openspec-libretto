# Agent Specifications

本文档定义 libretto 的 3 个 agent 的 frontmatter 与角色。agent 源文件在
`agents/*.md`；frontmatter 由 Kilo 解析。

## libretto（primary 编排器）

| 字段 | 值 |
|---|---|
| `description` | The OpenSpec spec-driven development workflow. |
| `mode` | `primary` |
| `color` | `#8B5CF6` |
| `steps` | `100` |
| `model` | （不设——回退全局默认） |

角色：纯路由器。从不写代码、不做架构决策。强制首步加载 `libretto-core`。
任务分类 checkpoint（simple / complex / explore）。propose 完成后触发 handoff
checkpoint。dispatch `libretto-apply` 实现，dispatch `libretto-verify` 验证。

## libretto-apply（subagent 实现）

| 字段 | 值 |
|---|---|
| `description` | Implementation subagent. Implements tasks from tasks.md against spec deltas. |
| `mode` | `subagent` |

角色：按 `tasks.md` 逐条实现。读 spec delta → 写代码 → 勾选 `[x]`。不做架构
决策，escalate 给 libretto。可中断恢复（读 checkbox）。

## libretto-verify（subagent 验证）

| 字段 | 值 |
|---|---|
| `description` | Verification subagent. Three-dimension review + openspec validate. Reports only. |
| `mode` | `subagent` |

角色：completeness / correctness / coherence 三维度验证 + `openspec validate`。
仅汇报，绝不改代码。裁决 APPROVE / REQUEST CHANGES / COMMENT。