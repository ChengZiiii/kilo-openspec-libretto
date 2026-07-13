# Design Document

> 完整设计事实来源：`docs/specs/2026-07-14-libretto-design.md`（锁定版）。
> 本文件是其公开摘要，便于 npm tarball 用户快速理解架构。

## 一句话

`kilo-openspec-libretto` 把 [OpenSpec](https://github.com/Fission-AI/OpenSpec)
工作流（explore → propose → apply → sync → archive + verify）打包成一个 Kilo
agent `libretto`，用户在 agent picker 选取即可进入完整 spec-driven 流程。

## 架构

- **3 agent**：`libretto`（primary 编排器，纯路由）+ `libretto-apply`（实现
  subagent）+ `libretto-verify`（验证 subagent）。
- **8 skill**（`libretto-*` 前缀由 junction 派生）：core / explore / propose /
  apply-change / sync-specs / archive-change / verify-change / handoff。
- **安装器**：npm CLI（`kilo-openspec-libretto install`），幂等，manifest 法卸载，
  junction 隔离 skill，JSONC 备份恢复。
- **强依赖**：`@fission-ai/openspec` CLI（用户全局装；skills 调 `openspec --json`
  做验证/状态/归档）。
- **dormant plugin**：`plugin/index.js` 保留 config-hook，待 Kilo 支持 npm 插件
  加载后启用。

## 关键决策

1. 强依赖 openspec CLI（不自造 delta 合并/校验轮子）
2. 3 agent + 8 skill（镜像 kilo-superpowers-compose）
3. 纯 prompt handoff 跳转新会话（零文件，tasks.md checkbox 是唯一状态源）
4. skill `name:` 裸名 + junction 名 `libretto` 派生 `libretto-*` 显示前缀

详见 `docs/specs/2026-07-14-libretto-design.md`。