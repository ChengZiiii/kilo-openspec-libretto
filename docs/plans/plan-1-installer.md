# Plan 1 — 安装器与插件模块（Task 1–6）

> ⚠️ **历史归档（2026-07-14 已被超越）**：本计划基于"junction 文件夹名派生 `libretto-`
> 前缀"的错误前提。**实际机制**（对齐 kilo-superpowers-compose v0.2.0，见
> `docs/specs/2026-07-14-libretto-design.md` §7.1）为：SKILL.md 的 `name:` 字段直写
> `libretto-` 前缀 + 安装器写全局 `permission.skill['libretto-*']: 'deny'` + 每个 agent
> frontmatter 带 `permission.skill['libretto-*']: 'allow'`。下列相关步骤以历史为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use `compose-subagent-driven-development` or `compose-executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 构建 libretto 的 npm 包骨架与安装器（`bin/lib.js` + 入口垫片 + dormant plugin 模块），使其能 `npm pack` 并在隔离 `KILO_HOME` 里跑通 install/uninstall。

**Architecture:** 完全移植 kilo-superpowers-compose 的 `bin/lib.js`（纯函数 + manifest 法 + junction + JSONC 备份恢复），替换所有命名（superpowers→libretto），新增 openspec CLI 检测。零第三方依赖，仅用 `node:*`。

**Tech Stack:** Node.js ≥ 18, ESM, `node:test`, 零第三方依赖。

## Global Constraints

- **跨平台**：所有路径用 `path.join` + `os.homedir()` / `KILO_HOME`，绝不手拼反斜杠。
- **零依赖**：仅 `node:fs` / `node:path` / `node:os` / `node:url` / `node:child_process`。
- **ESM**：`"type": "module"`。
- **junction 名固定 `libretto`**（`~/.kilo/skills/libretto`）——Kilo 用此派生 `libretto-*` 显示前缀。
- **manifest 文件名** `.kilo-openspec-libretto.json`。
- **env 前缀** `KILO_LIBRETTO_*`。
- **退出码** 0 OK · 1 ERROR · 2 PARSE_ERROR · 3 NOT_WRITABLE · 4 LINK_FAILED。
- **幂等**：重复 install 不重复添加 `skills.paths`；junction 删除后重建。
- **JSONC**：仅剥离 `//` 行注释；块注释不处理，解析失败从备份恢复退出 2。
- **spec 事实来源**：`docs/specs/2026-07-14-libretto-design.md`。

## 文件结构（本计划范围）

```
kilo-openspec-libretto/
├── package.json          ← Task 1
├── LICENSE               ← Task 1
├── NOTICE                ← Task 1
├── .gitignore            ← Task 1（已存在，确认/更新）
├── bin/
│   ├── lib.js            ← Task 2（part 1）→ Task 3（part 2）→ Task 4（part 3）
│   ├── cli.js            ← Task 5
│   ├── install.js        ← Task 5
│   ├── uninstall.js      ← Task 5
│   └── update.js         ← Task 5
└── plugin/
    └── index.js          ← Task 6
```

---

## Task 1: 包骨架（package.json + LICENSE + NOTICE + .gitignore）

**Files:**
- Create: `package.json`
- Create: `LICENSE`
- Create: `NOTICE`
- Modify: `.gitignore`（已存在最小版，扩展它）

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "kilo-openspec-libretto",
  "version": "0.1.0",
  "description": "将 OpenSpec 工作流打包为 Kilo 插件：一个 libretto 编排器代理、2 个子代理与 8 个技能，通过 libretto 代理选择器直接进入完整工作流，一条命令安装。强依赖 @fission-ai/openspec CLI。",
  "keywords": [
    "kilo",
    "kilo-code",
    "kilo-cli",
    "openspec",
    "libretto",
    "agent",
    "subagent",
    "skills",
    "spec-driven",
    "workflow",
    "cli"
  ],
  "license": "MIT",
  "author": "ChengZiiii",
  "homepage": "https://github.com/ChengZiiii/kilo-openspec-libretto#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/ChengZiiii/kilo-openspec-libretto.git"
  },
  "bugs": {
    "url": "https://github.com/ChengZiiii/kilo-openspec-libretto/issues"
  },
  "type": "module",
  "engines": {
    "node": ">=18"
  },
  "main": "plugin/index.js",
  "exports": {
    ".": "./plugin/index.js"
  },
  "bin": {
    "kilo-openspec-libretto": "bin/cli.js"
  },
  "kilo": {
    "type": "plugin"
  },
  "opencode": {
    "type": "plugin"
  },
  "files": [
    "bin",
    "skills",
    "agents",
    "plugin",
    "NOTICE"
  ],
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: 写 LICENSE（MIT）**

```
MIT License

Copyright (c) 2026 ChengZiiii

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: 写 NOTICE**

```
NOTICE
=======

kilo-openspec-libretto
----------------------

This package (`kilo-openspec-libretto`) is licensed under the MIT License
(see `LICENSE`). Copyright (c) 2026 ChengZiiii.

This package has a runtime dependency on the OpenSpec CLI:

    @fission-ai/openspec
    Source : https://github.com/Fission-AI/OpenSpec
    License: MIT (Copyright (c) OpenSpec Contributors)

The `skills/`, `agents/`, `bin/`, and `plugin/` contents of this package are
all original work, authored specifically for libretto. They are NOT vendored
from OpenSpec — libretto's skills call the `openspec` CLI at runtime via
`bash` for validation, status, archiving, and other operations.

No OpenSpec source code is included in this package. Users must install
`@fission-ai/openspec` separately:

    npm install -g @fission-ai/openspec
```

- [ ] **Step 4: 更新 .gitignore**

```
node_modules/
*.tgz
*.log
.DS_Store
```

- [ ] **Step 5: 创建空目录占位（确保 git 跟踪目录结构）**

```bash
mkdir -p bin skills agents plugin test docs
# git 不跟踪空目录；后续 task 会填充文件
```

- [ ] **Step 6: 验证 package.json 可解析**

Run: `node -e "console.log(require('./package.json').name)"`
Expected: `kilo-openspec-libretto`

- [ ] **Step 7: Commit**

```bash
git add package.json LICENSE NOTICE .gitignore
git commit -m "chore: 包骨架 — package.json / LICENSE / NOTICE / .gitignore"
```

---

## Task 2: bin/lib.js — 常量 + 纯函数 + fs 辅助 + manifest/link 辅助

**Files:**
- Create: `bin/lib.js`

**Interfaces:**
- Produces: `EXIT`, `MANIFEST_NAME`, `readEnv`, `resolvePaths`, `buildContext`, `stripLineComments`, `normalizePath`, `skillsPathsContains`, `findPackageRoot`, `readPackageJson`, `makeLogger`, `ensureDir`, `linkExists`, `safeRemove`, `readJsonc`, `writeJson`, `backupConfig`, `readManifest`, `writeManifest`, `removeManifest`, `makeSkillsLink`, `listMdFiles`

- [ ] **Step 1: 写 bin/lib.js（纯函数 + fs 辅助部分）**

```js
// bin/lib.js
// kilo-openspec-libretto — 安装器共享逻辑（纯函数 + fs 辅助）。
// 零第三方依赖；仅使用 node:fs / node:path / node:os / node:url / node:child_process。
//
// 设计说明：
// - runInstall / runUninstall / runUpdate **返回退出码**（0–4），不调用 process.exit，
//   以便在 node:test 中直接断言。进程退出由各入口垫片（install.js / cli.js）负责。
// - 跨平台：所有路径用 path.join + os.homedir()/KILO_HOME，绝不手拼反斜杠。
// - skills.paths 幂等判定用规范化路径比较（path.resolve + toLowerCase）。
// - 卸载归属判定用清单法（manifest），替代内容嗅探。
// - openspec CLI 检测：install 时跑 openspec --version，不存在则警告但不阻断。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// ─── 常量 ─────────────────────────────────────────────────────────────
export const EXIT = Object.freeze({
  OK: 0,
  ERROR: 1,
  PARSE_ERROR: 2, // kilo.jsonc 解析失败（已从备份恢复）
  NOT_WRITABLE: 3, // 目标目录不可写
  LINK_FAILED: 4, // junction/symlink 创建失败（且递归复制兜底也失败）
});

// 清单文件名（位于配置目录下，隐藏文件）
export const MANIFEST_NAME = '.kilo-openspec-libretto.json';

const noop = () => {};

// ─── 纯函数 / 配置解析 ─────────────────────────────────────────────────
export function readEnv(env = process.env) {
  return {
    HOME: env.KILO_HOME || os.homedir(),
    DRY_RUN: env.KILO_LIBRETTO_DRY_RUN === '1',
    VERBOSE: env.KILO_LIBRETTO_VERBOSE === '1',
    SKIP_OPENSPEC_CHECK: env.KILO_LIBRETTO_SKIP_OPENSPEC_CHECK === '1',
  };
}

// 由 home 推导所有目标路径（纯函数）。
export function resolvePaths(home) {
  const configDir = path.join(home, '.config', 'kilo');
  const skillsDir = path.join(home, '.kilo', 'skills');
  return {
    home,
    configDir,
    configFile: path.join(configDir, 'kilo.jsonc'),
    agentsDir: path.join(configDir, 'agent'),
    skillsDir,
    // junction 名固定为 libretto —— Kilo 用此文件夹名派生 libretto-* 显示前缀
    skillLink: path.join(skillsDir, 'libretto'),
    manifestFile: path.join(configDir, MANIFEST_NAME),
  };
}

// 组装完整运行上下文。
export function buildContext(env = process.env) {
  return { ...readEnv(env), ...resolvePaths(readEnv(env).HOME) };
}

// JSONC 行注释剥离：仅处理 `//`，且只在字符串外剥离。
// 不处理块注释 —— 若 kilo.jsonc 含块注释导致解析失败，
// 调用方从备份恢复并以退出码 2 退出。
export function stripLineComments(raw) {
  return raw.split('\n').map(stripLine).join('\n');
  function stripLine(line) {
    const idx = line.indexOf('//');
    if (idx === -1) return line;
    const before = line.slice(0, idx);
    const quotes = (before.match(/(?<!\\)"/g) || []).length;
    return quotes % 2 === 0 ? before : line;
  }
}

// 规范化路径用于幂等比较（消除分隔符 / 大小写差异）。
export function normalizePath(p) {
  return path.resolve(p).toLowerCase();
}

// skills.paths 数组是否已包含目标（规范化比较）。
export function skillsPathsContains(paths, target) {
  const t = normalizePath(target);
  return Array.isArray(paths) && paths.some((p) => normalizePath(p) === t);
}

// 从给定目录定位包根：bin/ 的上一级。
export function findPackageRoot(startDir) {
  return path.resolve(startDir, '..');
}

export function readPackageJson(pkgRoot) {
  const file = path.join(pkgRoot, 'package.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ─── 日志辅助 ─────────────────────────────────────────────────────────
export function makeLogger(verbose) {
  return verbose ? (...a) => console.error('[libretto]', ...a) : noop;
}

// ─── fs 辅助 ──────────────────────────────────────────────────────────
export function ensureDir(d, { dryRun = false, log = noop } = {}) {
  if (dryRun) {
    log('would mkdir', d);
    return;
  }
  fs.mkdirSync(d, { recursive: true });
}

export function linkExists(p) {
  return !!fs.lstatSync(p, { throwIfNoEntry: false });
}

// 安全移除：符号链接/junction 用 unlinkSync（绝不深入目标）；
// 真实目录用 rmSync 递归；普通文件用 rmSync。
export function safeRemove(p, { dryRun = false, log = noop } = {}) {
  const st = fs.lstatSync(p, { throwIfNoEntry: false });
  if (!st) return false;
  log('removing', p);
  if (dryRun) return true;
  if (st.isSymbolicLink()) {
    fs.unlinkSync(p);
  } else if (st.isDirectory()) {
    fs.rmSync(p, { recursive: true, force: true });
  } else {
    fs.rmSync(p, { force: true });
  }
  return true;
}

// 读取 JSONC（剥离行注释后解析）。失败返回 { __parseError, __raw }。
export function readJsonc(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8');
  const stripped = stripLineComments(raw);
  try {
    return JSON.parse(stripped);
  } catch (e) {
    return { __parseError: e.message, __raw: raw };
  }
}

// 以 JSON 写回（丢失注释——已知取舍）。
export function writeJson(file, obj, { dryRun = false } = {}) {
  if (dryRun) return;
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

// 备份 kilo.jsonc -> kilo.jsonc.bak.<timestamp>；不存在则返回 null。
export function backupConfig(configFile, { dryRun = false, log = noop } = {}) {
  if (!fs.existsSync(configFile)) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const bak = `${configFile}.bak.${ts}`;
  log('backup', configFile, '->', bak);
  if (dryRun) return bak;
  fs.copyFileSync(configFile, bak);
  return bak;
}

// ─── manifest 读写 ────────────────────────────────────────────────────
export function readManifest(manifestFile) {
  if (!fs.existsSync(manifestFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch {
    return null;
  }
}

export function writeManifest(manifestFile, data, { dryRun = false, log = noop } = {}) {
  log('writing manifest', manifestFile);
  if (dryRun) return;
  fs.writeFileSync(manifestFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function removeManifest(manifestFile, { dryRun = false, log = noop } = {}) {
  return safeRemove(manifestFile, { dryRun, log });
}

// 创建技能链接（Windows junction / Unix symlink），失败则递归复制兜底。
// 返回 { type, ok, error?, fallback? }。
export function makeSkillsLink(src, link, { dryRun = false, log = noop } = {}) {
  if (linkExists(link)) {
    safeRemove(link, { dryRun, log });
  }
  const isWin = process.platform === 'win32';
  const linkType = isWin ? 'junction' : 'symlink';
  log(`creating ${linkType}`, src, '->', link);
  if (dryRun) return { type: linkType, ok: true };
  try {
    fs.symlinkSync(src, link, isWin ? 'junction' : 'dir');
    return { type: linkType, ok: true };
  } catch (e) {
    log(`${linkType} failed (${e.message}); falling back to recursive copy`);
    try {
      fs.cpSync(src, link, { recursive: true, force: true });
      return { type: 'copy', ok: true, fallback: e.message };
    } catch (e2) {
      return {
        type: linkType,
        ok: false,
        error: `${linkType}: ${e.message}; copy fallback: ${e2.message}`,
      };
    }
  }
}

// 列出源目录下的 .md 文件（agents）。
export function listMdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ name: f, abs: path.join(dir, f) }));
}

// ─── openspec CLI 检测 ────────────────────────────────────────────────
// 返回 { ok: boolean, version?: string }。超时 5s，异常不抛。
export function detectOpenSpecCli() {
  try {
    const result = spawnSync('openspec', ['--version'], {
      timeout: 5000,
      encoding: 'utf8',
      windowsHide: true,
    });
    if (result.status === 0) {
      const version = (result.stdout || '').trim();
      return { ok: true, version };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
```

- [ ] **Step 2: 验证文件可 import**

Run: `node -e "import('./bin/lib.js').then(m => console.log(Object.keys(m).join(', ')))"`
Expected: 列出所有导出名（含 `EXIT`, `readEnv`, `detectOpenSpecCli` 等）

- [ ] **Step 3: Commit**

```bash
git add bin/lib.js
git commit -m "feat(installer): bin/lib.js 常量 + 纯函数 + fs/manifest/link 辅助 + openspec 检测"
```

---

## Task 3: bin/lib.js — runInstall（含 openspec 检测集成）

**Files:**
- Modify: `bin/lib.js`（在文件末尾追加 `countSkills` 和 `runInstall`）

**Interfaces:**
- Consumes: Task 2 的全部导出
- Produces: `runInstall(opts)` → 退出码（0–4）

- [ ] **Step 1: 在 bin/lib.js 末尾追加 runInstall + countSkills**

在文件末尾（`detectOpenSpecCli` 之后）追加：

```js

// ─── 编排：安装 ───────────────────────────────────────────────────────
// 返回退出码（0 成功）。失败路径返回对应码并已做清理（如恢复备份）。
export function runInstall(opts = {}) {
  const ctx = opts.context || buildContext();
  const log = makeLogger(ctx.VERBOSE);
  const dryRun = ctx.DRY_RUN;

  const binDir = path.dirname(fileURLToPath(import.meta.url));
  const root = opts.pkgRoot || path.resolve(binDir, '..');

  const srcSkills = path.join(root, 'skills');
  const srcAgents = path.join(root, 'agents');

  let pkg;
  try {
    pkg = readPackageJson(root);
  } catch (e) {
    console.error(`✗ 无法读取 package.json: ${e.message}`);
    return EXIT.ERROR;
  }
  const version = pkg.version || '0.0.0';

  log('package root', root);
  log('config dir', ctx.configDir);

  // 0. openspec CLI 检测（不阻断安装）
  let openspecWarning = false;
  if (!ctx.SKIP_OPENSPEC_CHECK) {
    const detection = detectOpenSpecCli();
    if (detection.ok) {
      console.log(`  openspec CLI: 检测到 ${detection.version || '(未知版本)'}`);
    } else {
      openspecWarning = true;
    }
  }

  // 1. 确保目标目录
  for (const d of [ctx.configDir, ctx.agentsDir, ctx.skillsDir]) {
    try {
      ensureDir(d, { dryRun, log });
    } catch (e) {
      console.error(`✗ 无法创建目录 ${d}: ${e.message}`);
      return EXIT.NOT_WRITABLE;
    }
  }

  // 2. 备份 kilo.jsonc
  const bak = backupConfig(ctx.configFile, { dryRun, log });

  // 3. 预读并校验 kilo.jsonc（解析失败则恢复备份并退出 2）
  log('reading', ctx.configFile);
  const config = readJsonc(ctx.configFile);
  if (config.__parseError) {
    if (bak && !dryRun) {
      try {
        fs.copyFileSync(bak, ctx.configFile);
      } catch (e) {
        log('恢复备份失败:', e.message);
      }
    }
    console.error(`✗ kilo.jsonc 解析失败: ${config.__parseError}（已从备份恢复）`);
    console.error('  注意：本安装器仅支持 // 行注释；块注释 /* */ 不被处理。');
    return EXIT.PARSE_ERROR;
  }

  // 4. 创建技能链接（junction 名 libretto）
  if (!fs.existsSync(srcSkills)) {
    console.error(`✗ 找不到技能源目录: ${srcSkills}`);
    return EXIT.ERROR;
  }
  const linkRes = makeSkillsLink(srcSkills, ctx.skillLink, { dryRun, log });
  if (!linkRes.ok) {
    console.error(`✗ ${linkRes.error}`);
    return EXIT.LINK_FAILED;
  }

  // 5. 复制 agents
  const agentFiles = listMdFiles(srcAgents);
  const installedAgentPaths = [];
  for (const f of agentFiles) {
    const dst = path.join(ctx.agentsDir, f.name);
    log('copy agent', f.abs, '->', dst);
    if (!dryRun) {
      try {
        fs.mkdirSync(ctx.agentsDir, { recursive: true });
        fs.copyFileSync(f.abs, dst);
      } catch (e) {
        console.error(`✗ 复制 agent 失败 ${f.name}: ${e.message}`);
        return EXIT.NOT_WRITABLE;
      }
    }
    installedAgentPaths.push(dst);
  }

  // 6. 追加 skills.paths
  config.skills = config.skills || {};
  config.skills.paths = config.skills.paths || [];
  let added = false;
  if (!skillsPathsContains(config.skills.paths, srcSkills)) {
    config.skills.paths.push(srcSkills);
    added = true;
  }
  if (added && !dryRun) writeJson(ctx.configFile, config);

  // 7. 写清单
  writeManifest(
    ctx.manifestFile,
    {
      name: 'kilo-openspec-libretto',
      version,
      pkgRoot: root,
      skillsSrc: srcSkills,
      skillsLink: ctx.skillLink,
      skillsLinkType: linkRes.type,
      skillsPathsEntry: srcSkills,
      agents: installedAgentPaths,
    },
    { dryRun, log }
  );

  // 8. 汇总
  const skillCount = countSkills(srcSkills);
  console.log('✓ kilo-openspec-libretto 已安装');
  console.log(`  技能: ${skillCount} 个 -> ${ctx.skillLink} (${linkRes.type})`);
  if (linkRes.fallback) {
    console.log(`  注意: 链接创建失败，已回退为递归复制（${linkRes.fallback}）`);
  }
  console.log(`  代理: ${agentFiles.map((f) => f.name).join(', ') || '(无)'}`);
  console.log(`  kilo.jsonc: skills.paths ${added ? '已新增条目' : '已存在（幂等跳过）'}`);
  if (openspecWarning) {
    console.log('');
    console.log('  ⚠ 未检测到 openspec CLI。libretto 运行时需要它。请运行：');
    console.log('    npm install -g @fission-ai/openspec');
    console.log('  安装后重启 Kilo。');
    console.log('  （设 KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1 可跳过此检测）');
  }
  console.log('');
  console.log('  请重启 Kilo CLI / VS Code 扩展以加载。');
  return EXIT.OK;
}

function countSkills(srcSkills) {
  try {
    return fs
      .readdirSync(srcSkills, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .length;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 2: 验证 runInstall 在 DRY_RUN 下返回 0**

Run: `$env:KILO_HOME=[System.IO.Path]::GetTempPath()+ 'libretto-test'; $env:KILO_LIBRETTO_DRY_RUN='1'; $env:KILO_LIBRETTO_SKIP_OPENSPEC_CHECK='1'; node -e "import('./bin/lib.js').then(m => process.exit(m.runInstall()))"`
Expected: 退出码 0，无文件创建

- [ ] **Step 3: Commit**

```bash
git add bin/lib.js
git commit -m "feat(installer): runInstall 编排 + openspec CLI 检测集成"
```

---

## Task 4: bin/lib.js — runUninstall + runUpdate

**Files:**
- Modify: `bin/lib.js`（末尾追加 `runUninstall` 和 `runUpdate`）

**Interfaces:**
- Consumes: Task 2–3 的导出
- Produces: `runUninstall(opts)`, `runUpdate(opts)` → 退出码

- [ ] **Step 1: 在 bin/lib.js 末尾追加 runUninstall**

```js

// ─── 编排：卸载 ───────────────────────────────────────────────────────
export function runUninstall(opts = {}) {
  const ctx = opts.context || buildContext();
  const log = makeLogger(ctx.VERBOSE);
  const dryRun = ctx.DRY_RUN;

  log('uninstall from', ctx.configDir);

  const bak = backupConfig(ctx.configFile, { dryRun, log });
  const manifest = readManifest(ctx.manifestFile);

  // 1. 移除 agents
  const agentPaths = (manifest && manifest.agents) || [];
  if (agentPaths.length === 0) {
    log('清单缺失或无 agents 记录，回退到已知文件名');
    for (const n of ['libretto.md', 'libretto-apply.md', 'libretto-verify.md']) {
      agentPaths.push(path.join(ctx.agentsDir, n));
    }
  }
  for (const p of agentPaths) safeRemove(p, { dryRun, log });

  // 2. 移除技能链接
  if (linkExists(ctx.skillLink)) {
    safeRemove(ctx.skillLink, { dryRun, log });
  }

  // 3. 从 kilo.jsonc 移除本包的 skills.paths 条目
  const config = readJsonc(ctx.configFile);
  if (config.__parseError) {
    if (bak && !dryRun) {
      try {
        fs.copyFileSync(bak, ctx.configFile);
      } catch (e) {
        log('恢复备份失败:', e.message);
      }
    }
    console.error(`✗ kilo.jsonc 解析失败: ${config.__parseError}（已从备份恢复）`);
    return EXIT.PARSE_ERROR;
  }
  let removedEntries = 0;
  if (config.skills && Array.isArray(config.skills.paths)) {
    const entry = (manifest && manifest.skillsPathsEntry) || null;
    const before = config.skills.paths.length;
    config.skills.paths = config.skills.paths.filter((p) => {
      if (entry && normalizePath(p) === normalizePath(entry)) return false;
      return true;
    });
    // 若清单缺 entry，按已知包根启发式移除
    if (!entry) {
      config.skills.paths = config.skills.paths.filter(
        (p) => !/kilo-openspec-libretto[\\/]+skills/i.test(p)
      );
    }
    removedEntries = before - config.skills.paths.length;
    if (!dryRun) writeJson(ctx.configFile, config);
  }

  // 4. 移除清单
  removeManifest(ctx.manifestFile, { dryRun, log });

  console.log('✓ kilo-openspec-libretto 已卸载');
  console.log(`  agents: ${agentPaths.length} 个文件`);
  console.log(`  技能链接: ${ctx.skillLink}`);
  console.log(`  kilo.jsonc: skills.paths 移除 ${removedEntries} 条`);
  console.log('  未触碰用户自有的技能 / 代理 / 配置。');
  return EXIT.OK;
}
```

- [ ] **Step 2: 在 bin/lib.js 末尾追加 runUpdate**

```js

// ─── 编排：更新 ───────────────────────────────────────────────────────
// 重新运行安装（幂等）。若检测到版本变化则打印提示。
export function runUpdate(opts = {}) {
  const ctx = opts.context || buildContext();
  const prev = readManifest(ctx.manifestFile);
  const result = runInstall(opts);
  if (result === EXIT.OK && prev && prev.version) {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    let cur = prev.version;
    try {
      cur = readPackageJson(root).version || prev.version;
    } catch {}
    if (prev.version !== cur) {
      console.log(`  更新: kilo-openspec-libretto ${prev.version} -> ${cur}`);
    }
  }
  return result;
}
```

- [ ] **Step 3: 验证 runUninstall 在 DRY_RUN 下返回 0**

Run: `$env:KILO_LIBRETTO_DRY_RUN='1'; node -e "import('./bin/lib.js').then(m => process.exit(m.runUninstall()))"`
Expected: 退出码 0

- [ ] **Step 4: Commit**

```bash
git add bin/lib.js
git commit -m "feat(installer): runUninstall（清单法）+ runUpdate（幂等重装）"
```

---

## Task 5: 入口垫片（cli.js + install.js + uninstall.js + update.js）

**Files:**
- Create: `bin/cli.js`
- Create: `bin/install.js`
- Create: `bin/uninstall.js`
- Create: `bin/update.js`

**Interfaces:**
- Consumes: `runInstall`, `runUninstall`, `runUpdate` from `bin/lib.js`

- [ ] **Step 1: 写 bin/cli.js**

```js
#!/usr/bin/env node
// bin/cli.js — 主入口分发器。默认子命令为 install。
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runInstall, runUninstall, runUpdate } from './lib.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmd = process.argv[2] || 'install';

function readVersion() {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')
    ).version;
  } catch {
    return 'unknown';
  }
}

if (cmd === '--version' || cmd === '-v') {
  console.log(readVersion());
  process.exit(0);
}

if (cmd === '--help' || cmd === '-h') {
  console.log(
    [
      'kilo-openspec-libretto — 将 OpenSpec 工作流安装到 Kilo。',
      '',
      '用法:',
      '  kilo-openspec-libretto <command>',
      '',
      '命令:',
      '  install     安装技能与代理（默认）',
      '  uninstall   移除本包安装的全部内容（清单法，不触碰用户自有文件）',
      '  update      重新运行安装（幂等）',
      '',
      '选项:',
      '  -v, --version    显示版本号',
      '  -h, --help       显示此帮助',
      '',
      '环境变量:',
      '  KILO_HOME=<path>                     覆盖用户主目录（多用于测试）',
      '  KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1  跳过 openspec CLI 检测',
      '  KILO_LIBRETTO_DRY_RUN=1              只打印将执行的动作，不修改任何文件',
      '  KILO_LIBRETTO_VERBOSE=1              输出详细日志（到 stderr）',
    ].join('\n')
  );
  process.exit(0);
}

let code;
switch (cmd) {
  case 'install':
    code = runInstall();
    break;
  case 'uninstall':
    code = runUninstall();
    break;
  case 'update':
    code = runUpdate();
    break;
  default:
    console.error(`未知命令: ${cmd}`);
    console.error('运行 `kilo-openspec-libretto --help` 查看用法。');
    code = 1;
}
process.exit(code);
```

- [ ] **Step 2: 写 bin/install.js**

```js
#!/usr/bin/env node
// bin/install.js — 安装入口（直接运行时执行；被导入时无副作用）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInstall } from './lib.js';

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(runInstall());
}
```

- [ ] **Step 3: 写 bin/uninstall.js**

```js
#!/usr/bin/env node
// bin/uninstall.js — 卸载入口（清单法精确移除）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUninstall } from './lib.js';

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(runUninstall());
}
```

- [ ] **Step 4: 写 bin/update.js**

```js
#!/usr/bin/env node
// bin/update.js — 更新入口（重新运行安装，幂等）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUpdate } from './lib.js';

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  process.exit(runUpdate());
}
```

- [ ] **Step 5: 验证 --version 与 --help**

Run: `node bin/cli.js --version` → Expected: `0.1.0`
Run: `node bin/cli.js --help` → Expected: 帮助文本

- [ ] **Step 6: Commit**

```bash
git add bin/cli.js bin/install.js bin/uninstall.js bin/update.js
git commit -m "feat(cli): 入口垫片 cli/install/uninstall/update"
```

---

## Task 6: plugin/index.js（dormant config-hook 模块）

**Files:**
- Create: `plugin/index.js`

**Interfaces:**
- Consumes: `agents/*.md`（运行时读取）
- Produces: `plugin()` 工厂函数，返回 `{ config(kiloConfig) }` 钩子

- [ ] **Step 1: 写 plugin/index.js**

```js
// plugin/index.js
// kilo-openspec-libretto — Kilo 插件模块（Path B，当前休眠）。
//
// 这是 Path A（npm CLI 安装器，见 bin/）之外的另一条安装路径：
// 在 kilo.jsonc 里写 "plugin": ["kilo-openspec-libretto"]，Kilo 启动时
// 会加载本模块的默认导出（工厂函数），调用其 config(config) 钩子，向运行时
// 配置对象直接注入 3 个 agent 与 skills.paths。
//
// 硬性约束（与 bin/lib.js 一致）：
// - 零第三方依赖；仅用 node:fs / node:path / node:url。
// - 绝不抛异常：插件崩溃会让 Kilo 启动失败。所有 fs / 解析操作均包 try/catch。
// - 跨平台路径一律用 path.join。
// - skills.paths 幂等判定用规范化路径比较（path.resolve + toLowerCase）。
//
// 实测结论（同 superpowers）：当前 Kilo 不会经 kilo.jsonc 的 plugin:["包名"] 字段
// 加载 npm 命名插件。本模块保留待 Kilo 正式支持后即可启用。
// 用户当前通过 npm CLI 安装（见 bin/）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');

const AGENTS_SRC = path.join(PKG_ROOT, 'agents');
const SKILLS_SRC = path.join(PKG_ROOT, 'skills');

// 规范化路径用于幂等比较。
export function normalizePath(p) {
  try {
    return path.resolve(p).toLowerCase();
  } catch (_) {
    return String(p || '').toLowerCase();
  }
}

export function skillsPathsContains(paths, target) {
  const t = normalizePath(target);
  return Array.isArray(paths) && paths.some((p) => normalizePath(p) === t);
}

function stripQuotes(v) {
  if (v.length >= 2) {
    const a = v[0];
    const b = v[v.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) {
      return v.slice(1, -1);
    }
  }
  return v;
}

// Frontmatter 解析：支持单行 key: value，防御性支持 YAML 块标量。
export function parseFrontmatter(content) {
  const m = typeof content === 'string'
    ? content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
    : null;
  if (!m) return { data: {}, body: typeof content === 'string' ? content : '' };
  const lines = m[1].split(/\r?\n/);
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^([\w-]+)[ \t]*:[ \t]*(.*)$/);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    let val = kv[2];
    if (/^[|>][+-]?$/.test(val)) {
      const folded = val.startsWith('>');
      const collected = [];
      i++;
      while (i < lines.length && (lines[i] === '' || /^[ \t]/.test(lines[i]))) {
        collected.push(lines[i].replace(/^[ \t]+/, ''));
        i++;
      }
      val = (folded ? collected.join(' ') : collected.join('\n')).trim();
      data[key] = val;
      continue;
    }
    const tv = val.trim();
    if (tv === 'true') data[key] = true;
    else if (tv === 'false') data[key] = false;
    else data[key] = stripQuotes(tv);
    i++;
  }
  return { data, body: m[2] };
}

// 读取包内 agents/*.md，剥离 frontmatter 取 description / mode 与正文。
export function loadAgents(agentsSrc) {
  const dir = agentsSrc || AGENTS_SRC;
  const agents = {};
  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        const { data, body } = parseFrontmatter(content);
        const name = file.replace(/\.md$/, '');
        // 提取 permission.skill（若有）
        const permSkill = data.permission_skill || null;
        agents[name] = {
          description: data.description || name,
          mode: data.mode === 'primary' ? 'primary' : 'subagent',
          prompt: body,
          ...(permSkill ? { permission: { skill: permSkill } } : {}),
        };
      } catch (_) {
        // 单个 agent 解析失败不阻断其余
      }
    }
  } catch (_) {
    // agents 目录不存在 / 不可读 → 返回空集
  }
  return agents;
}

// 插件工厂（Kilo 加载入口，当前休眠）。
export async function plugin(_input, _options) {
  const agents = loadAgents();

  return {
    config: async (kiloConfig) => {
      try {
        if (!kiloConfig || typeof kiloConfig !== 'object') return;
        // 1. 注册 agents
        if (!kiloConfig.agent) kiloConfig.agent = {};
        for (const [name, agent] of Object.entries(agents)) {
          kiloConfig.agent[name] = {
            prompt: agent.prompt,
            description: agent.description,
            mode: agent.mode,
            ...(agent.permission ? { permission: agent.permission } : {}),
          };
        }
        // 2. 注册 skills.paths
        if (!kiloConfig.skills) kiloConfig.skills = {};
        if (!Array.isArray(kiloConfig.skills.paths)) kiloConfig.skills.paths = [];
        if (fs.existsSync(SKILLS_SRC) && !skillsPathsContains(kiloConfig.skills.paths, SKILLS_SRC)) {
          kiloConfig.skills.paths.push(SKILLS_SRC);
        }
      } catch (_) {
        // config 钩子内任何异常都不外泄
      }
    },
  };
}

export { plugin as server };
export default plugin;
```

- [ ] **Step 2: 验证 plugin 模块可 import 且 config 钩子可调用**

Run: `node -e "import('./plugin/index.js').then(async m => { const p = await m.plugin(); const cfg = {}; await p.config(cfg); console.log('agents:', Object.keys(cfg.agent||{}).join(',')); console.log('skills.paths:', JSON.stringify(cfg.skills?.paths||[])); })"`
Expected: agents 列表（若 agents/ 已有文件）或空；skills.paths 含包内路径

- [ ] **Step 3: Commit**

```bash
git add plugin/index.js
git commit -m "feat(plugin): dormant config-hook 模块（Path B，待 Kilo 支持后启用）"
```

---

## Plan 1 完成标志

- [ ] `node bin/cli.js --version` 输出 `0.1.0`
- [ ] `node bin/cli.js --help` 输出帮助文本
- [ ] DRY_RUN install 返回 0 且不创建文件
- [ ] `plugin/index.js` 可 import，config 钩子注入 agents + skills.paths
- [ ] `npm pack` 成功生成 tarball（需 agents/ 和 skills/ 至少有占位文件——Plan 2 填充）

> **注意**：完整的 install→uninstall 往返测试在 Plan 3（test/installer.test.js）中覆盖。本计划只验证代码可运行、可 import。
