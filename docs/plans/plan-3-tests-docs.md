# Plan 3 — 测试、文档与最终验证（Task 13–17）

> ⚠️ **历史归档（2026-07-14 已被超越）**：本计划含"skill name 必须裸名"等错误验收标准，
> 且不含 `ensureSkillDeny`/`removeSkillDeny` 的模型侧隔离测试。实际实现已修正并新增
> permission deny 测试套件（见 `test/installer.test.js` 与 spec §7.1）。

> **For agentic workers:** REQUIRED SUB-SKILL: Use `compose-subagent-driven-development` or `compose-executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 编写零依赖测试套件（installer + plugin）、项目文档（DESIGN/INSTALLER/AGENTS/REFERENCES）、README 与 repo 级 AGENTS.md，并跑通最终验证（`node --test` + `npm pack` + 隔离 install 往返）。

**Architecture:** 测试用 `node:test` + `node:assert/strict`，零第三方依赖，临时 `KILO_HOME`，绝不触碰真实配置。文档镜像 superpowers-compose 的 docs/ 结构。

**Tech Stack:** Node.js ≥ 18 `node:test`，Markdown。

## Global Constraints

- **零依赖测试**：仅 `node:test` + `node:assert/strict` + `node:fs` + `node:path` + `node:os`。
- **测试隔离**：所有用例用 `os.tmpdir()` 下的临时 `KILO_HOME`，绝不触碰真实 `~/.config/kilo`。
- **openspec 检测 mock**：设 `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` 跳过。
- **spec 事实来源**：`docs/specs/2026-07-14-libretto-design.md` §12（测试策略）。

## 文件结构（本计划范围）

```
test/
├── installer.test.js   ← Task 13（纯函数）→ Task 14（往返）
└── plugin.test.js      ← Task 15
docs/
├── DESIGN.md           ← Task 16
├── INSTALLER.md        ← Task 16
├── AGENTS.md           ← Task 16
└── REFERENCES.md       ← Task 16
README.md               ← Task 17
AGENTS.md               ← Task 17（repo 级，给本仓库 dev agent）
```

---

## Task 13: test/installer.test.js — 纯函数 + fs 辅助 + manifest

**Files:**
- Create: `test/installer.test.js`

**Interfaces:**
- Consumes: `bin/lib.js` 的全部导出

- [ ] **Step 1: 写 test/installer.test.js（纯函数部分）**

```js
// test/installer.test.js
// 安装器逻辑测试（node:test，零依赖）。
// 所有用例使用 os.tmpdir() 下的临时 KILO_HOME，绝不触碰真实配置。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import * as lib from '../bin/lib.js';

const { EXIT } = lib;

// ─── 辅助 ─────────────────────────────────────────────────────────────
function mkTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'libretto-test-'));
}

function ctxFor(home, envExtra = {}) {
  return lib.buildContext({ KILO_HOME: home, ...envExtra });
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
}

// ─── 纯函数：stripLineComments ────────────────────────────────────────
test('stripLineComments: 剥离行注释', () => {
  const raw = ['{', '  // 一条注释', '  "a": 1', '}'].join('\n');
  assert.equal(lib.stripLineComments(raw), ['{', '  ', '  "a": 1', '}'].join('\n'));
});

test('stripLineComments: 保留字符串内的 //', () => {
  const raw = '{"url": "https://example.com/x"}';
  assert.equal(lib.stripLineComments(raw), raw);
});

test('stripLineComments: 保留字符串内含 // 的值', () => {
  const raw = ['{', '  "note": "see // here for details"', '}'].join('\n');
  const out = lib.stripLineComments(raw);
  assert.ok(out.includes('see // here for details'));
});

test('stripLineComments: 行注释在字符串后的同一行也被剥离', () => {
  assert.equal(lib.stripLineComments('{"a": 1} // trailing'), '{"a": 1} ');
});

// ─── 纯函数：normalizePath / skillsPathsContains ──────────────────────
test('skillsPathsContains: 分隔符差异归一', () => {
  const fwd = 'C:/Users/x/kilo-openspec-libretto/skills';
  const back = 'C:\\Users\\x\\kilo-openspec-libretto\\skills';
  assert.ok(lib.skillsPathsContains([fwd], back));
  assert.ok(lib.skillsPathsContains([back], fwd));
});

test('skillsPathsContains: 大小写差异归一', () => {
  assert.ok(lib.skillsPathsContains(['C:\\Users\\X\\Skills'], 'c:\\users\\x\\skills'));
});

test('skillsPathsContains: 不同路径判定为不包含', () => {
  assert.ok(!lib.skillsPathsContains(['a/b'], 'c/d'));
});

// ─── 纯函数：readEnv / resolvePaths ───────────────────────────────────
test('readEnv: KILO_HOME 覆盖默认 home', () => {
  const e = lib.readEnv({ KILO_HOME: '/tmp/fake' });
  assert.equal(e.HOME, '/tmp/fake');
  assert.equal(e.DRY_RUN, false);
  assert.equal(e.VERBOSE, false);
  assert.equal(e.SKIP_OPENSPEC_CHECK, false);
});

test('readEnv: 标志位按 "1" 解析', () => {
  const e = lib.readEnv({
    KILO_HOME: '/tmp/fake',
    KILO_LIBRETTO_DRY_RUN: '1',
    KILO_LIBRETTO_VERBOSE: '1',
    KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1',
  });
  assert.equal(e.DRY_RUN, true);
  assert.equal(e.VERBOSE, true);
  assert.equal(e.SKIP_OPENSPEC_CHECK, true);
});

test('resolvePaths: 派生所有目标路径，junction 名为 libretto', () => {
  const p = lib.resolvePaths('/tmp/fake');
  assert.equal(p.configDir, path.join('/tmp/fake', '.config', 'kilo'));
  assert.equal(p.configFile, path.join(p.configDir, 'kilo.jsonc'));
  assert.equal(p.skillLink, path.join('/tmp/fake', '.kilo', 'skills', 'libretto'));
  assert.equal(p.manifestFile, path.join(p.configDir, '.kilo-openspec-libretto.json'));
});

// ─── readJsonc（fs）──────────────────────────────────────────────────
test('readJsonc: 带行注释的 JSONC 可解析', () => {
  const home = mkTempHome();
  try {
    const f = path.join(home, 'kilo.jsonc');
    fs.writeFileSync(f, ['{', '  // comment', '  "x": 1', '}'].join('\n'), 'utf8');
    const obj = lib.readJsonc(f);
    assert.equal(obj.x, 1);
    assert.equal(obj.__parseError, undefined);
  } finally { rmrf(home); }
});

test('readJsonc: 块注释不被剥离 → 返回 __parseError', () => {
  const home = mkTempHome();
  try {
    const f = path.join(home, 'kilo.jsonc');
    fs.writeFileSync(f, '{"a": 1 /* block */}', 'utf8');
    const obj = lib.readJsonc(f);
    assert.ok(obj.__parseError, '应有解析错误');
  } finally { rmrf(home); }
});

test('readJsonc: 文件不存在返回空对象', () => {
  assert.deepEqual(lib.readJsonc('/no/such/file.jsonc'), {});
});

// ─── manifest 读写往返 ────────────────────────────────────────────────
test('manifest: 写入后可读回', () => {
  const home = mkTempHome();
  try {
    const f = path.join(home, 'm.json');
    const data = { version: '0.1.0', agents: ['a.md'] };
    lib.writeManifest(f, data);
    assert.deepEqual(lib.readManifest(f), data);
  } finally { rmrf(home); }
});

test('manifest: 不存在返回 null，损坏返回 null', () => {
  const home = mkTempHome();
  try {
    assert.equal(lib.readManifest(path.join(home, 'nope.json')), null);
    const f = path.join(home, 'bad.json');
    fs.writeFileSync(f, '{ not json', 'utf8');
    assert.equal(lib.readManifest(f), null);
  } finally { rmrf(home); }
});
```

- [ ] **Step 2: 运行测试**

Run: `node --test`
Expected: 全部 PASS（到目前为止的用例）

- [ ] **Step 3: Commit**

```bash
git add test/installer.test.js
git commit -m "test(installer): 纯函数 + fs 辅助 + manifest 读写"
```

---

## Task 14: test/installer.test.js — install/uninstall 往返 + openspec 检测

**Files:**
- Modify: `test/installer.test.js`（追加往返测试用例）

- [ ] **Step 1: 在 test/installer.test.js 末尾追加 install/uninstall 往返用例**

```js

// ─── runInstall：DRY_RUN 无副作用 ────────────────────────────────────
test('runInstall: DRY_RUN 不创建任何文件', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, {
      KILO_LIBRETTO_DRY_RUN: '1',
      KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1',
    });
    const code = lib.runInstall({ context: ctx });
    assert.equal(code, EXIT.OK);
    assert.ok(!fs.existsSync(ctx.skillLink));
    assert.ok(!fs.existsSync(path.join(ctx.agentsDir, 'libretto.md')));
    assert.ok(!fs.existsSync(ctx.manifestFile));
    assert.ok(!fs.existsSync(ctx.configFile));
  } finally { rmrf(home); }
});

// ─── runInstall：块注释解析失败 → 退出 2 且恢复备份 ────────────────
test('runInstall: 块注释解析失败 → 退出 2 且恢复备份', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    fs.mkdirSync(ctx.configDir, { recursive: true });
    const original = '{\n  /* 块注释不被支持 */\n  "skills": { "paths": [] }\n}\n';
    fs.writeFileSync(ctx.configFile, original, 'utf8');

    const code = lib.runInstall({ context: ctx });
    assert.equal(code, EXIT.PARSE_ERROR);

    const after = fs.readFileSync(ctx.configFile, 'utf8');
    assert.equal(after, original, '配置应从备份恢复');
    assert.ok(!fs.existsSync(ctx.skillLink));
    assert.ok(!fs.existsSync(path.join(ctx.agentsDir, 'libretto.md')));
  } finally { rmrf(home); }
});

// ─── install → uninstall 往返净空 ─────────────────────────────────────
test('往返：install 后 uninstall 应净空本包产物', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });

    const code1 = lib.runInstall({ context: ctx });
    assert.equal(code1, EXIT.OK);

    assert.ok(fs.existsSync(ctx.skillLink));
    assert.ok(fs.existsSync(path.join(ctx.agentsDir, 'libretto.md')));
    assert.ok(fs.existsSync(path.join(ctx.agentsDir, 'libretto-apply.md')));
    assert.ok(fs.existsSync(path.join(ctx.agentsDir, 'libretto-verify.md')));
    assert.ok(fs.existsSync(ctx.manifestFile));
    const cfg = lib.readJsonc(ctx.configFile);
    assert.ok(cfg.skills.paths.length >= 1);

    const code2 = lib.runUninstall({ context: ctx });
    assert.equal(code2, EXIT.OK);

    assert.ok(!fs.existsSync(ctx.skillLink));
    assert.ok(!fs.existsSync(path.join(ctx.agentsDir, 'libretto.md')));
    assert.ok(!fs.existsSync(path.join(ctx.agentsDir, 'libretto-apply.md')));
    assert.ok(!fs.existsSync(path.join(ctx.agentsDir, 'libretto-verify.md')));
    assert.ok(!fs.existsSync(ctx.manifestFile));
    const cfg2 = lib.readJsonc(ctx.configFile);
    assert.equal(cfg2.skills.paths.length, 0);
  } finally { rmrf(home); }
});

// ─── 幂等：重复 install 不重复添加 skills.paths ─────────────────────
test('幂等：重复 install 不产生重复 skills.paths 条目', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    assert.equal(lib.runInstall({ context: ctx }), EXIT.OK);
    assert.equal(lib.runInstall({ context: ctx }), EXIT.OK);
    const cfg = lib.readJsonc(ctx.configFile);
    assert.equal(cfg.skills.paths.length, 1);
  } finally { rmrf(home); }
});

// ─── 卸载保留用户自有文件 ─────────────────────────────────────────────
test('卸载：保留用户自有的 agent / skills.paths 条目', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    fs.mkdirSync(ctx.agentsDir, { recursive: true });
    fs.writeFileSync(path.join(ctx.agentsDir, 'myown.md'), '# My Own Agent\n', 'utf8');

    assert.equal(lib.runInstall({ context: ctx }), EXIT.OK);
    assert.equal(lib.runUninstall({ context: ctx }), EXIT.OK);

    assert.ok(fs.existsSync(path.join(ctx.agentsDir, 'myown.md')), '用户自有 agent 必须保留');
  } finally { rmrf(home); }
});

// ─── runUpdate：等同重新安装 ──────────────────────────────────────────
test('runUpdate: 等同重新安装，幂等', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    assert.equal(lib.runUpdate({ context: ctx }), EXIT.OK);
    assert.ok(fs.existsSync(ctx.manifestFile));
    const m = lib.readManifest(ctx.manifestFile);
    const pkgVersion = JSON.parse(
      fs.readFileSync(path.resolve('package.json'), 'utf8')
    ).version;
    assert.equal(m.version, pkgVersion);
    assert.equal(m.name, 'kilo-openspec-libretto');
  } finally { rmrf(home); }
});

// ─── openspec 检测：不阻断安装 ────────────────────────────────────────
test('runInstall: openspec CLI 不存在时不阻断安装（SKIP_CHECK 关闭）', () => {
  const home = mkTempHome();
  try {
    // 不设 SKIP_OPENSPEC_CHECK，让检测运行（openspec 可能不存在于 CI）
    const ctx = ctxFor(home);
    const code = lib.runInstall({ context: ctx });
    assert.equal(code, EXIT.OK, '即使 openspec 不存在也应安装成功');
    assert.ok(fs.existsSync(ctx.skillLink), 'skill 链接仍应创建');
  } finally { rmrf(home); }
});
```

- [ ] **Step 2: 运行全部测试**

Run: `node --test`
Expected: 全部 PASS（纯函数 + 往返 + 幂等 + openspec 检测）

- [ ] **Step 3: Commit**

```bash
git add test/installer.test.js
git commit -m "test(installer): install/uninstall 往返 + 幂等 + openspec 检测不阻断"
```

---

## Task 15: test/plugin.test.js

**Files:**
- Create: `test/plugin.test.js`

- [ ] **Step 1: 写 test/plugin.test.js**

```js
// test/plugin.test.js
// plugin/index.js 模块测试（node:test，零依赖）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  normalizePath,
  skillsPathsContains,
  parseFrontmatter,
  loadAgents,
  plugin,
} from '../plugin/index.js';

// ─── normalizePath / skillsPathsContains ──────────────────────────────
test('skillsPathsContains: 分隔符 + 大小写归一', () => {
  assert.ok(skillsPathsContains(['C:/X/skills'], 'c:\\x\\skills'));
  assert.ok(!skillsPathsContains(['a/b'], 'c/d'));
});

// ─── parseFrontmatter ─────────────────────────────────────────────────
test('parseFrontmatter: 单行 key: value', () => {
  const md = '---\nname: explore\ndescription: "test"\nmode: primary\n---\nbody';
  const { data, body } = parseFrontmatter(md);
  assert.equal(data.name, 'explore');
  assert.equal(data.description, 'test');
  assert.equal(data.mode, 'primary');
  assert.ok(body.startsWith('body'));
});

test('parseFrontmatter: 无 frontmatter 返回空 data + 原文 body', () => {
  const { data, body } = parseFrontmatter('just text');
  assert.deepEqual(data, {});
  assert.equal(body, 'just text');
});

test('parseFrontmatter: true/false 解析', () => {
  const md = '---\na: true\nb: false\n---\n';
  const { data } = parseFrontmatter(md);
  assert.equal(data.a, true);
  assert.equal(data.b, false);
});

// ─── loadAgents ───────────────────────────────────────────────────────
test('loadAgents: 从临时目录读取 agent .md', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libretto-plg-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'test-agent.md'),
      '---\ndescription: "test"\nmode: primary\n---\n# Body\n',
      'utf8'
    );
    const agents = loadAgents(tmp);
    assert.ok(agents['test-agent']);
    assert.equal(agents['test-agent'].description, 'test');
    assert.equal(agents['test-agent'].mode, 'primary');
    assert.ok(agents['test-agent'].prompt.includes('# Body'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadAgents: 目录不存在返回空对象', () => {
  assert.deepEqual(loadAgents('/no/such/dir'), {});
});

test('loadAgents: 非 primary 的 mode 一律按 subagent 处理', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'libretto-plg-'));
  try {
    fs.writeFileSync(
      path.join(tmp, 'sub.md'),
      '---\ndescription: "sub"\nmode: subagent\n---\nbody',
      'utf8'
    );
    const agents = loadAgents(tmp);
    assert.equal(agents['sub'].mode, 'subagent');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ─── plugin() config 钩子 ─────────────────────────────────────────────
test('plugin: config 钩子注入 agents + skills.paths', async () => {
  const p = await plugin();
  const cfg = {};
  await p.config(cfg);
  // agents 来自包内 agents/ 目录（Plan 2 已创建）
  assert.ok(cfg.agent, 'config.agent 应存在');
  assert.ok(cfg.agent.libretto, 'libretto agent 应注入');
  // skills.paths 应含包内 skills 目录
  assert.ok(Array.isArray(cfg.skills.paths), 'skills.paths 应为数组');
  assert.ok(cfg.skills.paths.length >= 1, '至少一条 skills.paths');
});

test('plugin: config 钩子对 null 入参不抛', async () => {
  const p = await plugin();
  await p.config(null);
  await p.config(undefined);
  await p.config('not an object');
  // 不抛即通过
});

test('plugin: config 钩子幂等（不重复添加 skills.paths）', async () => {
  const p = await plugin();
  const cfg = { skills: { paths: [] } };
  await p.config(cfg);
  const len1 = cfg.skills.paths.length;
  await p.config(cfg);
  assert.equal(cfg.skills.paths.length, len1, '不应重复添加');
});
```

- [ ] **Step 2: 运行全部测试**

Run: `node --test`
Expected: installer + plugin 全部 PASS

- [ ] **Step 3: Commit**

```bash
git add test/plugin.test.js
git commit -m "test(plugin): parseFrontmatter + loadAgents + config 钩子注入 + 幂等"
```

---

## Task 16: docs/（DESIGN + INSTALLER + AGENTS + REFERENCES）

**Files:**
- Create: `docs/DESIGN.md`
- Create: `docs/INSTALLER.md`
- Create: `docs/AGENTS.md`
- Create: `docs/REFERENCES.md`

- [ ] **Step 1: 写 docs/DESIGN.md（指向 spec 的入口 + 架构摘要）**

```markdown
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
```

- [ ] **Step 2: 写 docs/INSTALLER.md**

```markdown
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
```

- [ ] **Step 3: 写 docs/AGENTS.md（三个 agent 的产品规格）**

```markdown
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
```

- [ ] **Step 4: 写 docs/REFERENCES.md**

```markdown
# References

## 上游与依赖

| 项目 | 关系 | 链接 |
|---|---|---|
| Fission-AI/OpenSpec | 工作流来源 + 运行时 CLI 依赖 | https://github.com/Fission-AI/OpenSpec |
| @fission-ai/openspec | npm 包（用户全局安装） | https://www.npmjs.com/package/@fission-ai/openspec |
| kilo-superpowers-compose | 打包范本 | https://github.com/ChengZiiii/kilo-superpowers-compose |

## OpenSpec 文档参考

| 文档 | 内容 |
|---|---|
| concepts.md | specs / changes / delta specs / schemas |
| commands.md | /opsx:propose / apply / archive 等命令参考 |
| agent-contract.md | openspec --json 输出 shape |
| supported-tools.md | 各 AI 工具的 skill/command 路径 |
| how-commands-work.md | CLI vs slash command 区分 |

## Kilo 参考

| 文档 | 内容 |
|---|---|
| kilocode.ai/docs/customize/skills | skill 加载机制 |
| kilocode.ai/docs/customize/custom-modes | agent frontmatter |
| kilocode.ai/docs/code-with-ai/platforms/cli | CLI 配置目录 |
```

- [ ] **Step 5: Commit**

```bash
git add docs/DESIGN.md docs/INSTALLER.md docs/AGENTS.md docs/REFERENCES.md
git commit -m "docs: DESIGN + INSTALLER + AGENTS + REFERENCES"
```

---

## Task 17: README.md + repo AGENTS.md + 最终验证

**Files:**
- Create: `README.md`
- Create: `AGENTS.md`（repo 根级，给本仓库 dev agent）

- [ ] **Step 1: 写 README.md**

```markdown
# kilo-openspec-libretto

[![license](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

> A Kilo Code / Kilo CLI plugin that packages the
> [OpenSpec](https://github.com/Fission-AI/OpenSpec) spec-driven development
> workflow into a single installable package, exposing a **`libretto`**
> orchestrator agent that drives explore → propose → apply → verify →
> sync → archive.

## Prerequisites

- **Node.js ≥ 18**
- **OpenSpec CLI**: `npm install -g @fission-ai/openspec`
  (libretto depends on it at runtime for validation, status, and archiving)

## Installation

> ⚠ **Two steps required.** Step ① installs the CLI binary; step ② installs
> the agents and skills into Kilo.

**Step ① — Install the CLI**:

```bash
npm install -g kilo-openspec-libretto
```

**Step ② — Install into Kilo**:

```bash
kilo-openspec-libretto install
```

**Step ③ — Restart Kilo** (fully quit and reopen; **Reload Window** in VS Code).

After this, `libretto` appears in the agent picker — pick it to enter the
OpenSpec workflow.

**Step ④ — Initialize OpenSpec in your project** (per-project, once):

```bash
cd your-project
openspec init
```

## What gets installed

- **8 skills** under the `libretto` namespace (junction at
  `~/.kilo/skills/libretto`): core, explore, propose, apply-change,
  sync-specs, archive-change, verify-change, handoff.
- **3 agents**: `libretto` (primary orchestrator), `libretto-apply`
  (implementation subagent), `libretto-verify` (verification subagent).

## CLI usage

```text
kilo-openspec-libretto <command>

Commands:
  install     Install skills and agents (default)
  uninstall   Remove everything this package installed (manifest-based)
  update      Re-run install (idempotent)

Options:
  -v, --version    Show version
  -h, --help       Show help
```

### Environment variables

| Variable | Purpose |
|---|---|
| `KILO_HOME=<path>` | Override user home (for testing) |
| `KILO_LIBRETTO_SKIP_OPENSPEC_CHECK=1` | Skip openspec CLI detection |
| `KILO_LIBRETTO_DRY_RUN=1` | Print actions without modifying |
| `KILO_LIBRETTO_VERBOSE=1` | Verbose logging (stderr) |

## Update & uninstall

```bash
npm update -g kilo-openspec-libretto   # upgrade package
kilo-openspec-libretto update          # re-sync to Kilo (idempotent)

kilo-openspec-libretto uninstall       # remove artifacts
npm uninstall -g kilo-openspec-libretto
```

## Development

```bash
node --test     # zero-dependency tests
npm pack        # inspect the tarball
```

## Documentation

- [docs/specs/2026-07-14-libretto-design.md](docs/specs/2026-07-14-libretto-design.md) — locked design
- [docs/DESIGN.md](docs/DESIGN.md) — architecture summary
- [docs/INSTALLER.md](docs/INSTALLER.md) — installer spec
- [docs/AGENTS.md](docs/AGENTS.md) — agent specifications
- [docs/REFERENCES.md](docs/REFERENCES.md) — reference links
- [NOTICE](NOTICE) — OpenSpec CLI dependency attribution

## License

MIT — see [LICENSE](LICENSE). libretto's skills/agents/installer are original
work. Runtime depends on [@fission-ai/openspec](https://github.com/Fission-AI/OpenSpec)
(MIT).
```

- [ ] **Step 2: 写 AGENTS.md（repo 根级）**

```markdown
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
```

- [ ] **Step 3: 运行全部测试**

Run: `node --test`
Expected: 全部 PASS（installer + plugin）

- [ ] **Step 4: npm pack 验证**

Run: `npm pack`
Expected: 生成 `kilo-openspec-libretto-0.1.0.tgz`，包含 `bin/`、`skills/`、
`agents/`、`plugin/`、`NOTICE`（不含 `test/`、`docs/`）

- [ ] **Step 5: 隔离 install 往返验证**

```powershell
$tmp = Join-Path $env:TEMP "libretto-verify-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force
$env:KILO_HOME = $tmp
$env:KILO_LIBRETTO_SKIP_OPENSPEC_CHECK = "1"
node bin/cli.js install
# 检查：~/$tmp/.kilo/skills/libretto 存在、agent 文件存在、manifest 存在
node bin/cli.js uninstall
# 检查：全部移除
Remove-Item -Recurse -Force $tmp
Remove-Item Env:\KILO_HOME
Remove-Item Env:\KILO_LIBRETTO_SKIP_OPENSPEC_CHECK
```

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md
git commit -m "docs: README + repo 级 AGENTS.md + 最终验证通过"
```

---

## Plan 3 完成标志

- [ ] `node --test` 全部 PASS（installer 纯函数 + 往返 + 幂等 + openspec 检测 + plugin）
- [ ] `npm pack` 生成 tarball，包含 bin/skills/agents/plugin/NOTICE，不含 test/docs
- [ ] 隔离 KILO_HOME install→uninstall 往返净空
- [ ] docs/ 四个文档就绪
- [ ] README.md + AGENTS.md 就绪

---

## 全部三个计划完成后的总验证清单

- [ ] `node --test` 全绿
- [ ] `npm pack` 成功
- [ ] 隔离 install 后 `libretto` agent 出现在 agent picker（需重启 Kilo）
- [ ] 隔离 install 后 `libretto-*` skill 出现在 skill picker
- [ ] uninstall 后 agent + skill 全部消失
- [ ] skill 的 `name:` 全部是裸名（无 `libretto-` 前缀）
- [ ] agent prompt 引用的 skill 名与实际一致
