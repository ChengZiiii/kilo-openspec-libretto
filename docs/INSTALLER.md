# Installer Spec

## bin/lib.js

共享安装逻辑。零第三方依赖（仅 `node:*`）。ESM。

### 导出

| 导出 | 类型 | 用途 |
|---|---|---|
| `EXIT` | `Object.freeze` | 退出码 0–4 |
| `MANIFEST_NAME` | `string` | `.kilo-openspec-libretto.json` |
| `readEnv(env)` | 纯函数 | 读 `KILO_LIBRETTO_*` 环境变量 |
| `resolvePaths(home)` | 纯函数 | 派生 configDir / agentsDir / skillLink 等 |
| `buildContext(env)` | 纯函数 | readEnv + resolvePaths 组合 |
| `stripLineComments(raw)` | 纯函数 | 剥离 JSONC `//` 行注释（字符串外） |
| `normalizePath(p)` | 纯函数 | `path.resolve + toLowerCase` |
| `skillsPathsContains(paths, target)` | 纯函数 | 幂等判定 |
| `detectOpenSpecCli()` | 纯函数 | spawnSync openspec --version，返回 {ok, version?} |
| `runInstall(opts)` | 编排 | 返回退出码 0–4 |
| `runUninstall(opts)` | 编排 | manifest 法精确移除 |
| `runUpdate(opts)` | 编排 | = runInstall（幂等），打印版本变化 |

### 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功 |
| 1 | 通用错误 |
| 2 | kilo.jsonc 解析失败（已从备份恢复） |
| 3 | 目标目录不可写 |
| 4 | skills 链接创建失败（递归复制兜底也失败） |

### 环境变量

| 变量 | 用途 |
|---|---|
| `KILO_HOME` | 覆盖用户主目录 |
| `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` | 跳过 openspec 检测 |
| `KILO_LIBRETTO_DRY_RUN=1` | 只打印不修改 |
| `KILO_LIBRETTO_VERBOSE=1` | 详细日志到 stderr |

### install 步骤

1. openspec CLI 检测（不阻断）
2. 确保目标目录（configDir / agentsDir / skillsDir）
3. 备份 kilo.jsonc
4. 解析 kilo.jsonc（失败恢复备份退出 2）
5. 创建 skill junction（名 `libretto`）
6. 复制 agents/*.md
7. 追加 skills.paths（幂等）
8. 写 manifest

### uninstall 步骤

1. 读 manifest
2. 移除 agents（manifest 记录的路径；缺失时回退已知文件名）
3. 移除 skill junction
4. 从 kilo.jsonc 移除 skills.paths 条目
5. 移除 manifest

### 幂等性

- junction 删除后重建
- agents 覆盖
- skills.paths 已存在则跳过
- update = reinstall