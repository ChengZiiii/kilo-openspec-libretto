# Design Document — kilo-openspec-libretto

> Status: **Design locked — awaiting implementation plan**
> Last updated: 2026-07-14
> Author: ChengZiiii

本文档是 `kilo-openspec-libretto` 的权威设计事实来源。已决定的条目标 ✅；仍开放
的条目标 ❓。架构变更须同步本文档。

---

## 1. 目标与非目标

### 目标

- **一键安装**：`npm install -g kilo-openspec-libretto` 后在 Kilo CLI 与 VS Code
  Kilo Code 扩展中均可用（两者共享 `~/.config/kilo/` 与 `~/.kilo/`）。
- **可发现入口**：安装后 agent picker 出现 `libretto`，用户选取即进入 OpenSpec
  工作流，无需读文档、无需斜杠命令。
- **忠实 OpenSpec**：完整复刻 OpenSpec 1.6 的核心 profile 工作流（explore →
  propose → apply → sync → archive + verify），阶段间纪律为强制而非建议。
- **复用 superpowers-compose 的打包经验**：3-agent 编排器结构、junction 命名空间
  隔离 skill、幂等安装器、manifest 法卸载、JSONC 备份恢复、dormant plugin 模块。

### 非目标（v0.1）

- ❌ 不重新实现 OpenSpec CLI 的能力（delta 合并、schema 校验、stores、view 仪表盘）。
  libretto **强依赖** `@fission-ai/openspec` CLI。
- ❌ 不 vendor OpenSpec 源码。libretto 的 skill / agent / installer 全部原创，仅在
  运行时通过 `bash` 调 `openspec ... --json`。
- ❌ 不打包 `@fission-ai/openspec`（作为 peerDependency / 外部全局依赖）。
- ❌ 不实现 stores / bulk-archive / onboard 等 expanded profile（留作后续版本）。
- ❌ 不注册斜杠命令（同 superpowers v0.1.3+，靠 agent picker 进流程）。

---

## 2. 已锁定决策（brainstorming 结论）

| # | 决策点 | 选择 | 理由 |
|---|---|---|---|
| D1 | CLI 依赖 | **强依赖 `openspec` CLI** | OpenSpec 的核心价值（delta 合并、schema 校验、`instructions --json` 编排）都在 CLI 里，自造必然漂移 |
| D2 | agent / skill 结构 | **3 agent + 8 skill**（镜像 compose） | 编排器纯路由；apply 与 verify 天然适合隔离成 subagent |
| D3 | session-jump 形态 | **纯 prompt handoff，零文件** | Kilo 无程序化开会话 API；tasks.md checkbox 已是恢复状态的完美载体；落盘卡片会破坏 openspec 校验 |

---

## 3. 高层架构

```
┌──────────────────────────────────────────────────────────────┐
│  npm registry                                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ kilo-openspec-libretto (npm pkg)                     │    │
│  │  ├─ package.json (bin + kilo/opencode plugin hook)   │    │
│  │  ├─ plugin/index.js (Path B: dormant config-hook)    │    │
│  │  ├─ bin/{cli,install,uninstall,update,lib}.js        │    │
│  │  ├─ skills/  (8 SKILL.md folders, 原创)              │    │
│  │  └─ agents/  (libretto.md, libretto-apply.md, ...)   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
                           │
                           │  npm install -g  &&  kilo-openspec-libretto install
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  用户机器（全局一次性安装）                                    │
│  ┌─ ~/.kilo/skills/libretto → junction 到 pkg/skills         │
│  ├─ ~/.config/kilo/agent/libretto.md ← copied               │
│  ├─ ~/.config/kilo/agent/libretto-apply.md ← copied         │
│  ├─ ~/.config/kilo/agent/libretto-verify.md ← copied        │
│  └─ ~/.config/kilo/kilo.jsonc.skills.paths += pkg/skills    │
└──────────────────────────────────────────────────────────────┘
                           │
                           │  另需（per-project，由 OpenSpec CLI 创建）
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  项目工作区                                                    │
│  openspec/              ← `openspec init` 生成（libretto 不负责）│
│  ├─ specs/              ← 当前行为的事实来源                    │
│  ├─ changes/<name>/     ← 一个 change 一个文件夹               │
│  │  ├─ proposal.md / design.md / tasks.md                    │
│  │  └─ specs/<area>/spec.md   ← delta（ADDED/MODIFIED/REMOVED）│
│  └─ changes/archive/    ← 归档后的 change                      │
└──────────────────────────────────────────────────────────────┘
                           │
                           │  用户在 Kilo 选 `libretto` agent
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Kilo CLI / VS Code 扩展                                      │
│  - 扫描 skills/ → 8 个 skill 加载（仅 libretto 命名空间）       │
│  - 扫描 agent/ → 3 个 agent 注册                              │
│  - 用户选 `libretto` → OpenSpec 工作流激活                     │
│  - libretto 经 bash 调 `openspec ... --json` 做重活            │
└──────────────────────────────────────────────────────────────┘
```

**关键洞察**：Kilo CLI 与 Kilo Code 共享 `~/.config/kilo/` 与 `~/.kilo/`，故一处安装
覆盖两个客户端（同 superpowers，已验证）。OpenSpec 的 `openspec/` 工作区目录由
OpenSpec CLI 的 `openspec init` 创建，**不在 libretto 安装范围内**——职责分离。

---

## 4. 包布局

```
kilo-openspec-libretto/
├── package.json                 ✅ "files" 白名单 = ["bin","skills","agents","plugin","NOTICE"]
├── README.md                    ✅
├── LICENSE                      ✅ MIT
├── NOTICE                       ✅ 依赖 @fission-ai/openspec(MIT) 归属；skill/agent/installer 原创
├── AGENTS.md                    ✅ 给本仓库工作 agent 的指令（中文环境）
├── bin/
│   ├── cli.js                   ✅ 主入口（默认 install，分发子命令）
│   ├── install.js               ✅ 安装入口垫片
│   ├── uninstall.js             ✅ 卸载入口垫片（manifest 法）
│   ├── update.js                ✅ 更新入口垫片（= 重新 install，幂等）
│   └── lib.js                   ✅ 安装器共享逻辑（纯函数 + openspec 检测）
├── plugin/
│   └── index.js                 ✅ dormant config-hook（同 superpowers，待 Kilo 支持后启用）
├── skills/                      ✅ 8 个原创 skill 目录（文件夹裸名；name: 字段写 libretto- 前缀）
│   ├── core/SKILL.md            # 显示 libretto-core（启动纪律，等价 compose-using-superpowers）
│   ├── explore/SKILL.md         # 显示 libretto-explore
│   ├── propose/SKILL.md         # 显示 libretto-propose
│   ├── apply-change/SKILL.md    # 显示 libretto-apply-change（镜像 openspec-apply-change）
│   ├── sync-specs/SKILL.md      # 显示 libretto-sync-specs
│   ├── archive-change/SKILL.md  # 显示 libretto-archive-change
│   ├── verify-change/SKILL.md   # 显示 libretto-verify-change
│   └── handoff/SKILL.md         # 显示 libretto-handoff
├── agents/                      ✅ 3 个 agent .md（均不设 model 字段）
│   ├── libretto.md              # 编排器（primary）
│   ├── libretto-apply.md        # 实现 subagent
│   └── libretto-verify.md       # 验证 subagent
├── test/                        ✅ node:test 零依赖（excluded from tarball via files）
│   ├── installer.test.js
│   └── plugin.test.js
└── docs/
    ├── DESIGN.md                （本文档的镜像 / 发布版）
    ├── INSTALLER.md
    ├── AGENTS.md
    └── REFERENCES.md
```

---

## 5. 命名决策（已锁定）

| 资源 | 名称 | 理由 |
|---|---|---|
| npm 包 | `kilo-openspec-libretto` | 描述性、可搜索、与仓库名一致 |
| bin CLI 命令 | `kilo-openspec-libretto` | 与包名一致（npm Kebab-case 约定） |
| 主 agent | `libretto` | 用户指定；短、好记 |
| subagent — 实现 | `libretto-apply` | OpenSpec 的 apply 阶段 |
| subagent — 验证 | `libretto-verify` | OpenSpec 的 verify 阶段 |
| skill 命名空间目录（junction 名） | `libretto` | `~/.kilo/skills/libretto` junction 指向包内 `skills/`。junction 名仅作磁盘挂载点，**不参与命名**——Kilo 按 SKILL.md 的 `name:` 字段注册技能（见下行）。 |
| 各 skill `name:`（SKILL.md frontmatter） | **直写前缀**：`libretto-core`、`libretto-explore`、`libretto-propose`、`libretto-apply-change`、`libretto-sync-specs`、`libretto-archive-change`、`libretto-verify-change`、`libretto-handoff` | `name:` 字段即注册身份（实测 superpowers v0.2.0：`compose-brainstorming` 写在 `name:` 里）。文件夹名保持裸名（`core/`、`explore/`…）。 |
| skill 显示名（Kilo picker） | 同 `name:` 字段：`libretto-core`、`libretto-explore`… | 由 `name:` 字段直接决定，非 junction 派生。 |
| manifest 文件 | `.kilo-openspec-libretto.json` | 位于 `~/.config/kilo/`，隐藏 |
| 环境变量前缀 | `KILO_LIBRETTO_*` | 对应 superpowers 的 `KILO_SUPERPOWERS_*` |
| 斜杠命令 | 无 | 靠 agent picker 进流程（同 superpowers v0.1.3+） |

---

## 6. 三个 Agent

frontmatter 设 `description` / `mode` / `color` / `steps`，**不设 `model` 字段**——
回退到用户全局默认模型（同 superpowers 决策）。**三个 libretto agent 的 frontmatter
额外带 `permission.skill: { "libretto-*": "allow" }`**——这是 skill 隔离的硬层（见
§7.1）：只有 libretto 系 agent 被允许调用 `libretto-*` skill。若 Kilo 当前版本不识别
agent frontmatter 里的 `permission.skill` 键（P2 实测确认），降级为软隔离——仅靠
libretto 编排器 prompt 引用这些 skill（与 superpowers v0.1 实际行为一致），并在文档里
把「全局 `skill: { "libretto-*": "deny" }`」作为可选加固手段记录。

### 6.1 `libretto`（primary，纯路由器）

- **自己从不写代码，从不做架构决策。**
- 强制第一步：加载 `libretto-core` skill（启动纪律 + openspec CLI 与 `openspec/`
  前置检查）。
- 对每个请求先发 checkpoint 做任务分类：
  - **简单**（trivial 一两行修复）：跳过完整 change 流程，直接让 `libretto-apply`
    做或 libretto 自己做，完成后 `libretto-verify-change` 轻量过一遍。
  - **探索**（需求不清）：先 `libretto-explore`（无 artifact），澄清后转 `libretto-propose`。
  - **复杂 / 新功能**：走完整流程 `libretto-explore? → libretto-propose →
    [handoff or dispatch] → apply → libretto-verify-change → libretto-sync-specs →
    libretto-archive-change`。
- `libretto-propose` 完成（4 个 planning artifact 就绪）后，**触发 `libretto-handoff`**：
    给用户「跳转新会话」选项；用户选择继续则直接 dispatch `libretto-apply`。
- 实现：dispatch `libretto-apply`（per change / per task 批次）。
- 验证：apply 完成后 dispatch `libretto-verify`。
- 归档：`libretto-verify` 通过后由 libretto 触发 `libretto-archive-change`（调
  `openspec archive`）。
- dispatch 时必须带：具体 change 名 / 路径、要加载的 skill、期望输出格式。
- 语气：简短果断（同 compose）。

### 6.2 `libretto-apply`（subagent，实现）

- 强制加载顺序：`libretto-core` → `libretto-apply-change`。
- 按 `tasks.md` 逐条实现：读 spec delta → 写代码 → 勾选 `[x]` → 运行测试。
- 不做架构决策；遇到歧义 escalate 给 `libretto`，不直接问用户。
- 每条 task 完成后更新 `tasks.md` 的 checkbox。
- 可被中断后恢复（读 checkbox 判断进度）。
- 完成后向 `libretto` 汇报：改动文件路径、tasks 进度（X/Y）、测试输出摘要、
  任何偏离 spec 的地方（带理由）、发现的后续工作（不擅自扩范围）。
- 硬规则：无失败测试不写实现代码（沿用 TDD 纪律，若项目有测试设施）；声明完成
  前必须跑过验证。

### 6.3 `libretto-verify`（subagent，验证）

- 强制加载顺序：`libretto-core` → `libretto-verify-change`。
- 三维度验证（对齐 OpenSpec `/opsx:verify`）：
  - **Completeness**：所有 task 勾选、所有 requirement 有对应代码、scenario 覆盖。
  - **Correctness**：实现匹配 spec 意图、边界条件、错误状态。
  - **Coherence**：design 决策在代码中体现、命名一致。
- 结构校验：调 `openspec validate --json` 确认 change 结构合法。
- **仅汇报，绝不改代码。**
- 报告格式：CRITICAL（阻断 archive）/ WARNING（应修）/ SUGGESTION（可选），每条
  带 `file:line`。
- 裁决：APPROVE / REQUEST CHANGES / COMMENT。

---

## 7. Skill 清单（8 个，全部原创）

每个 skill 文件夹是裸名，但 SKILL.md 的 `name:` 字段**直写 `libretto-` 前缀**（见 §7.1 第 1 层）。显示名由 `name:` 字段直接决定，不关 junction 名的事。下表第一列「文件夹」仅作磁盘组织参考。

| 文件夹（裸名） | `name:` 字段 / 显示名 | 触发 | 职责 | 调 openspec CLI |
|---|---|---|---|---|
| `core` | `libretto-core` | 每次 libretto 会话首步 | 启动纪律、checkpoint 规则、何时加载哪个 skill、`openspec --version` 与 `openspec/` 存在性前置检查 | 是（探测） |
| `explore` | `libretto-explore` | 用户需求不清 / libretto 判定探索态 | 无 artifact 探索对话，读 codebase，对比方案，产出结论，可转 propose | 否（只读代码） |
| `propose` | `libretto-propose` | 已明确要做什么 | 建 change + 起草 proposal/specs(deltas)/design/tasks | 是（`openspec new change <name> --json`） |
| `apply-change` | `libretto-apply-change` | dispatched 给 libretto-apply | 单 task / 整 change 实现协议：读 spec → 写代码 → 勾选 → 测试 | 否（操作代码与 tasks.md） |
| `sync-specs` | `libretto-sync-specs` | archive 前 / 手动合并 | delta（ADDED/MODIFIED/REMOVED）合并进 `openspec/specs/` | 是（或交给 archive 自动） |
| `archive-change` | `libretto-archive-change` | verify 通过后 | 归档：移到 `changes/archive/YYYY-MM-DD-<name>/`、合并 delta | 是（`openspec archive <name> --json`） |
| `verify-change` | `libretto-verify-change` | dispatched 给 libretto-verify | 三维度验证 + 结构校验协议 | 是（`openspec validate --json`） |
| `handoff` | `libretto-handoff` | propose 完成后 | 输出自包含 bootstrap prompt（纯文本） | 否 |

> 命名说明：skill 名刻意与 agent 名错开——agent 叫 `libretto-apply` / `libretto-verify`，
> skill 叫 `libretto-apply-change` / `libretto-verify-change`，避免 picker 里同名混淆。
> bootstrap 用 `core` 而非 `using-libretto`，否则显示成 `libretto-using-libretto`（双重
> libretto）；`libretto-core` 即 superpowers `compose-using-superpowers` 的等价物。

### 7.1 skill 隔离 + 前缀机制（特性 A）

> ⚠ **2026-07-14 修正**：本节原以为"junction 文件夹名派生 `libretto-` 前缀"——
> **错误**。实测 kilo-superpowers-compose v0.2.0 证实：Kilo 按 SKILL.md 的 `name:`
> 字段注册技能身份，**认字段、不认 junction 文件夹名**。隔离靠下述三件事，缺一不可。

隔离与前缀分三层，复刻 superpowers v0.2.0 实测机制：

**第 1 层 — `name:` 字段直写前缀（产生 `libretto-` 前缀）**

每个 SKILL.md 的 `name:` 字段**直接写** `libretto-` 前缀（`name: libretto-explore`
等）。Kilo 扫描 `~/.kilo/skills/libretto/<skill>/SKILL.md` 时按 `name:` 字段注册，
于是显示名即 `libretto-explore`、`libretto-propose`…。文件夹名保持**裸名**
（`explore/`、`propose/`…），仅作磁盘组织，不参与命名。**实测**：superpowers v0.2.0
的 `skills/brainstorming/SKILL.md` 里 `name:` 即为 `compose-brainstorming`（非裸名），
安装后 picker 显示 `compose-brainstorming`。agent 引用 skill 必须用带前缀的名
（`libretto-core` 等），否则调不到。

**第 2 层 — 全局 `permission.skill['libretto-*']: 'deny'`（模型侧硬隔离）**

安装器向 `kilo.jsonc` 写入 `permission.skill['libretto-*'] = 'deny'`，且**置于 skill
对象末尾**。Kilo 的 `Permission.evaluate` 用 `findLast` 取末尾匹配键，故末尾的
`libretto-*: deny` 压过默认的 `*: allow`，使**其它 agent / 默认模型不会自动加载**
libretto 技能。见 `bin/lib.js` 的 `ensureSkillDeny` / `removeSkillDeny`（install 写入、
uninstall 移除，均幂等且保留用户其它 skill 规则）。标量 `skill` 值会被升级为对象、
原值保留于 `'*'` 键。

**第 3 层 — 每个 libretto agent 的 `permission.skill['libretto-*']: 'allow'`（解锁自身）**

三个 libretto agent 的 frontmatter 带 `permission.skill: { "libretto-*": "allow" }`，
作为第 2 层全局 deny 的**白名单**——只有 libretto 系 agent 被允许调用 `libretto-*`
skill（per-agent allow 在该 agent 作用域内压过全局 deny）。三者配合 =
"全局 deny 挡住所有人，仅 libretto 自身 agent 显式 allow 放行"。用户自有的
`~/.kilo/skills/<name>` 与项目内 `.kilocode/skills/openspec-*` 都不受影响。

### 7.2 跳转新会话（特性 B）

`libretto-handoff` skill 在 propose 完成（proposal + specs + design + tasks 四件套
就绪）后由 libretto 触发，输出一个 **markdown 代码块（纯文本，零文件）**：

````
--- 复制以下到新的 libretto 会话 ---
你是 libretto。当前 change: openspec/changes/<change-name>
planning artifacts 已就绪（proposal/specs/design/tasks）。

恢复步骤：
1. 加载 libretto-core 与 libretto-apply-change skill
2. 读取 openspec/changes/<change-name>/tasks.md 确认进度
3. 按 libretto-apply 协议逐条实现并勾选 [x]
4. 全部完成后建议触发 libretto-verify-change

（注：tasks.md 的 checkbox 是唯一进度状态来源）
--------------------------------------------
````

用户复制粘贴到新 Kilo 会话即可从 apply 阶段无缝恢复。不写任何额外文件，不破坏
openspec 校验。

---

## 8. 安装器（bin/lib.js）

完全镜像 superpowers 的 `lib.js` 设计，新增 **openspec CLI 检测**。

### 8.1 复用自 superpowers 的部分（逐字对齐行为）

- `runInstall / runUninstall / runUpdate` 返回退出码（0–4），不调 `process.exit`，
  便于 node:test 断言。
- 跨平台路径：一律 `path.join` + `os.homedir()` / `KILO_HOME`，绝不手拼反斜杠。
- `skills.paths` 幂等判定：`path.resolve + toLowerCase` 规范化比较。
- 卸载归属判定：manifest 法（`.kilo-openspec-libretto.json`），不靠内容嗅探。
- JSONC：仅剥离 `//` 行注释（字符串外）；块注释 `/* */` 不处理，解析失败则从备份
  恢复并退出 2。
- 打补丁前备份 `kilo.jsonc`，解析失败时恢复（退出码 2）。
- junction（Windows）/ symlink（Unix）创建技能链接，失败回退递归复制。
  **junction 名固定为 `libretto`**（`~/.kilo/skills/libretto` → 包内 `skills/`）——
  junction 仅作磁盘挂载点，**不参与命名**（Kilo 按 `name:` 字段注册，见 §7.1 第 1 层）。
  lib.js 中 `skillLink = path.join(skillsDir, 'libretto')`。
- manifest 记录：name / version / pkgRoot / skillsSrc / skillsLink（=
  `~/.kilo/skills/libretto`）/ skillsLinkType / **permissionKey**（`libretto-*`）/
  **skillPrefix**（`libretto-`）/ skillsPathsEntry / agents。

### 8.2 libretto 新增：openspec CLI 检测

- install（与 update）路径上跑 `openspec --version`（经 `child_process.spawnSync`，
  超时 5s，捕获异常）。
- **不存在时不阻断** libretto 安装：agent / skill / skills.paths 照常装。
  打印醒目警告：
  > ⚠ 未检测到 `openspec` CLI。libretto 运行时需要它。请运行：
  >   npm install -g @fission-ai/openspec
  > 安装后重启 Kilo。详见 README。
- 检测到时打印版本号确认。
- 环境变量 `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` 跳过检测（CI / 离线场景）。
- 检测结果不写入 manifest（运行时再探测，避免 manifest 漂移误导）。

### 8.3 环境变量

| 变量 | 用途 |
|---|---|
| `KILO_HOME=<path>` | 覆盖用户主目录（测试 / 隔离配置） |
| `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` | 跳过 openspec CLI 检测 |
| `KILO_LIBRETTO_DRY_RUN=1` | 只打印将执行的动作，不修改任何文件 |
| `KILO_LIBRETTO_VERBOSE=1` | 详细日志（到 stderr） |

### 8.4 退出码

`0` 成功 · `1` 通用错误 · `2` `kilo.jsonc` 解析失败（已从备份恢复） · `3` 目标目录
不可写 · `4` skills 链接创建失败（递归复制兜底也失败）。

### 8.5 幂等性

- junction 删除后重建（最新代码胜出）。
- agent `.md` 覆盖（幂等）。
- `kilo.jsonc`：`skills.paths` 条目已存在则跳过，绝不重复添加。
- `update` = 重新跑 `install`。

---

## 9. 安装路径（Path A / Path B）

**Path A — npm CLI（唯一支持的方法，同 superpowers 实测结论）**：

```bash
npm install -g kilo-openspec-libretto
kilo-openspec-libretto install
```

**Path B — Kilo `plugin` 字段（dormant）**：`plugin/index.js` 保留 config-hook 模块
（零依赖、全 try/catch、不会拖垮启动），但当前 Kilo 不经 `plugin:["包名"]` 字段加载
npm 命名插件（superpowers 已实测，见其 DESIGN §10 Q5）。README 明确警告**不要**把
包名加进 `plugin` 字段。待 Kilo 正式支持后即可零改动启用。

---

## 10. per-project 初始化

`openspec/` 工作区目录由 OpenSpec CLI 的 `openspec init` 创建，**不在 libretto
安装范围内**。`libretto-core` skill 首次在项目里跑时：

1. 检测 `openspec/` 是否存在于当前工作区。
2. 不存在 → 提示用户运行 `openspec init`（征得同意后可代跑）。
3. 存在 → 继续。

职责分离：libretto 全局装一次；per-project 初始化交给 OpenSpec CLI（它才知道用户
要给哪些 tool 生成 skill 文件、用哪个 profile）。

---

## 11. 许可证与归属

- 本包 `kilo-openspec-libretto` 自身 **MIT**（见 `LICENSE`）。
- `skills/`、`agents/`、`bin/`、`plugin/` 内容**全部原创**（参考 OpenSpec 公开文档
  的工作流描述，但 skill 文本为重新撰写，非 verbatim 复制）。
- libretto **运行时强依赖** `@fission-ai/openspec`（MIT，© OpenSpec Contributors）。
  `NOTICE` 记录该依赖与上游仓库链接。
- 不 vendor 任何 OpenSpec 源码。

---

## 12. 测试策略

- `test/installer.test.js`：node:test，零依赖，临时 `KILO_HOME`，绝不触碰真实配置。
  - 纯函数：`stripLineComments`、`normalizePath`、`skillsPathsContains`、
    `readEnv`、`resolvePaths`、`readJsonc`。
  - manifest 读写往返。
  - `runInstall` DRY_RUN 无副作用。
  - 块注释解析失败 → 退出 2 + 恢复备份。
  - install → uninstall 往返净空。
  - 幂等：重复 install 不重复添加 `skills.paths`。
  - 卸载保留用户自有 agent / skills.paths 条目。
  - `runUpdate` 等同重新安装。
  - **openspec 检测**：`PATH` 里无 `openspec` 时不阻断安装（mock `spawnSync`）。
- `test/plugin.test.js`：`plugin/index.js` 的 `parseFrontmatter`、`loadAgents`、
  `skillsPathsContains`、config 钩子注入 agent / skills.paths。

---

## 13. 与 superpowers-compose 的差异

| 维度 | superpowers-compose | libretto |
|---|---|---|
| 工作流来源 | obra/superpowers 14 skill（verbatim vendor） | OpenSpec（原创 skill，调 openspec CLI） |
| skill 数 | 14 | 8 |
| agent 数 | 3 | 3（同构：orchestrator + apply + verify） |
| 外部 CLI 依赖 | 无 | `@fission-ai/openspec`（强依赖） |
| skill 内容 | verbatim 复制上游 MIT 内容 | 原创（参考 OpenSpec docs） |
| 状态载体 | 无（纯方法论 skill） | `openspec/` 目录（proposal/specs/design/tasks + checkbox） |
| session-jump | compose 编排器内置 option B | 独立 `libretto-handoff` skill（纯 prompt） |
| 安装器 | 镜像 mimo-compose | 镜像 superpowers + openspec 检测 |
| NOTICE | 记录 vendored obra 内容 | 记录运行时依赖 openspec CLI（不 vendor） |

---

## 14. 风险登记

| 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|
| 用户未装 `openspec` CLI 就用 libretto | 高 | skill 调 CLI 全失败 | install 时检测 + 醒目提示；`libretto-core` 运行时再探测并指引 |
| OpenSpec CLI 输出 schema 在大版本间漂移 | 中 | skill 解析 `--json` 出错 | `NOTICE` / README 锁定推荐 `@fission-ai/openspec` 版本范围；skill 对未知字段宽容（只取所需键） |
| `openspec init` 生成的项目级 skill 与 libretto 全局 skill 命名冲突 | 低 | 都叫 propose 等 | libretto skill 在 `libretto/` 命名空间下，OpenSpec 的在 `.kilocode/skills/openspec-*/`，路径不同不冲突；文档说明二选一即可 |
| Kilo `plugin` 字段不生效 | 中 | Path B 不可用 | Path A（npm CLI）是唯一支持方法，README 明确警告（同 superpowers） |
| Windows junction 创建失败 | 低 | skill 不加载 | 回退递归复制（同 superpowers） |
| `kilo.jsonc` 含块注释导致解析失败 | 低 | Kilo 不启动 | 备份后恢复，退出 2（同 superpowers） |
| handoff prompt 被用户误改导致新会话丢上下文 | 低 | 恢复失败 | prompt 明确指向 tasks.md 作为唯一状态源；tasks.md checkbox 是真相 |

---

## 15. 路线图

| 阶段 | 目标 | 完成标志 |
|---|---|---|
| **P1 — 设计** | 锁定全部决策 | 本文档审批通过 |
| **P2 — 最小可跑** | npm 包装好、`libretto` agent 出现在 picker、能驱动一个完整 change | 本地 `npm i -g && install` 后选 libretto 跑通 explore→propose→apply→archive |
| **P3 — 打磨** | uninstall/update、openspec 检测、README、测试全绿 | uninstall 干净；update 保留用户配置；`node --test` 全过 |
| **P4 — 分发** | 发布 npm 公开包 | 包在 npm；README 完整 |

---

## 16. 参考资料

- 上游工作流：https://github.com/Fission-AI/OpenSpec （MIT，v1.6.0）
- 打包范本：`kilo-superpowers-compose`（同级仓库，`docs/...` 之外另址托管）
- OpenSpec 概念：`docs/concepts.md`、`docs/overview.md`、`docs/commands.md`
- OpenSpec CLI 契约：`docs/agent-contract.md`（`--json` 输出 shape）
- Kilo 架构：`~/.config/kilo/`、`~/.kilo/`、`.kilo/`；CLI 与 VS Code 扩展共享配置
