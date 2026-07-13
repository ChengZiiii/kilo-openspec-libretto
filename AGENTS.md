# AGENTS.md

供在本仓库中工作的 AI 代理（如 Kilo 会话）参考的指南。请先阅读本文件。

## 工作语言

**本项目为中文开发环境。** 代理与用户的交流、提交信息、代码注释、新增文档
默认使用简体中文。

## 仓库现状 —— 动手前必读

本仓库是 `kilo-openspec-libretto`——将 OpenSpec 工作流打包为 Kilo 插件。
当前已有：`package.json`、`bin/`（安装器）、`skills/`（8 个技能）、
`agents/`（3 个代理）、`plugin/`（dormant）、`test/`（node:test）、
`docs/`（设计稿 + 文档）、`LICENSE`、`NOTICE`。

- **运行测试**：`node --test`（零依赖，使用临时 `KILO_HOME`）。
- **检视发布包**：`npm pack`。
- **本地试装**：用隔离 `KILO_HOME`，例如
  `$env:KILO_HOME="<临时目录>"; $env:KILO_LIBRETTO_SKIP_OPENSPEC_CHECK="1"; node bin/cli.js install`。
- **不要**直接对真实 `~/.config/kilo/kilo.jsonc` 执行安装，除非用户明确要求。

## 事实来源

`docs/specs/2026-07-14-libretto-design.md` 是锁定的设计事实来源；架构变更须
同步该文档及 `docs/DESIGN.md`。

## 关键约束（已决定 —— 不要随意更改）

- **skill 裸名 + junction 派生前缀**：`name:` 字段保持裸名（`explore`、
  `propose`…），`libretto-` 前缀由 `~/.kilo/skills/libretto` junction 文件夹名
  派生。绝不手写 `libretto-` 前缀。
- **强依赖 openspec CLI**：skills 调 `openspec ... --json` 做重活；不重造 delta
  合并/校验。
- **零第三方依赖**：仅用 `node:*`。
- **跨平台路径**：一律 `path.join`，绝不手拼反斜杠。
- **不自动 postinstall**：安装是显式的（`kilo-openspec-libretto install`）。
- **打补丁前备份 kilo.jsonc**，解析失败恢复（退出 2）。
- **安装幂等**。

## 命名

| 对象 | 名称 |
|---|---|
| npm 包 / CLI | `kilo-openspec-libretto` |
| 主 agent | `libretto`（`mode: primary`） |
| subagent — 实现 | `libretto-apply` |
| subagent — 验证 | `libretto-verify` |
| skill 命名空间 | `libretto`（junction） |
| manifest | `.kilo-openspec-libretto.json` |