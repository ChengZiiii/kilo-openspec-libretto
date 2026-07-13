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

// ─── 模型侧隔离：permission.skill['libretto-*']='deny' ────────────────
// 对齐 kilo-superpowers-compose v0.2.0 的隔离机制：Kilo 的 Permission.evaluate
// 用 findLast 取末尾匹配键，故把 'libretto-*': 'deny' 放到 skill 对象末尾，
// 压过默认的 '*': 'allow'，使其它 agent / 默认模型不会自动加载 libretto 技能。
// 仅 libretto 自身的 agent 通过显式 skill 调用使用它们。

test('常量: SKILL_PERMISSION_KEY 与 SKILL_PREFIX', () => {
  assert.equal(lib.SKILL_PERMISSION_KEY, 'libretto-*');
  assert.equal(lib.SKILL_PREFIX, 'libretto-');
});

test('ensureSkillDeny: 无 permission 时新增 deny 键', () => {
  const cfg = {};
  const changed = lib.ensureSkillDeny(cfg);
  assert.equal(changed, true);
  assert.equal(cfg.permission.skill['libretto-*'], 'deny');
});

test('ensureSkillDeny: 已是 deny 时幂等（不改、不重复）', () => {
  const cfg = { permission: { skill: { 'libretto-*': 'deny' } } };
  const changed = lib.ensureSkillDeny(cfg);
  assert.equal(changed, false);
  assert.deepEqual(cfg.permission.skill, { 'libretto-*': 'deny' });
});

test('ensureSkillDeny: 标量 skill 升级为对象并保留 * 原值', () => {
  const cfg = { permission: { skill: 'ask' } };
  const changed = lib.ensureSkillDeny(cfg);
  assert.equal(changed, true);
  assert.equal(cfg.permission.skill['*'], 'ask', '原标量值应保留到 * 键');
  assert.equal(cfg.permission.skill['libretto-*'], 'deny');
});

test('ensureSkillDeny: 保留用户其它 skill 规则', () => {
  const cfg = { permission: { skill: { 'my-tool-*': 'allow', '*': 'ask' } } };
  lib.ensureSkillDeny(cfg);
  assert.equal(cfg.permission.skill['my-tool-*'], 'allow');
  assert.equal(cfg.permission.skill['*'], 'ask');
  assert.equal(cfg.permission.skill['libretto-*'], 'deny');
});

test('ensureSkillDeny: deny 键位于 skill 对象末尾（findLast 依赖）', () => {
  const cfg = { permission: { skill: { 'a': 'allow', 'libretto-*': 'deny', 'b': 'allow' } } };
  lib.ensureSkillDeny(cfg); // 已存在但不在末尾 → 应移到末尾
  const keys = Object.keys(cfg.permission.skill);
  assert.equal(keys[keys.length - 1], 'libretto-*', 'deny 键必须在末尾才能压过 *');
});

test('removeSkillDeny: 移除 deny 键', () => {
  const cfg = { permission: { skill: { 'libretto-*': 'deny', '*': 'ask' } } };
  const removed = lib.removeSkillDeny(cfg);
  assert.equal(removed, true);
  assert.equal(cfg.permission.skill['libretto-*'], undefined);
  assert.equal(cfg.permission.skill['*'], 'ask', '其它规则保留');
});

test('removeSkillDeny: 移除后容器空则清理 skill / permission', () => {
  const cfg = { permission: { skill: { 'libretto-*': 'deny' } } };
  lib.removeSkillDeny(cfg);
  // permission 整个被删（含 skill），故先断言 permission 为 undefined
  assert.equal(cfg.permission, undefined, '空 permission 应删除（skill 随之消失）');
});

test('removeSkillDeny: 无 deny 键时返回 false 不动结构', () => {
  const cfg = { permission: { skill: { '*': 'ask' } } };
  const removed = lib.removeSkillDeny(cfg);
  assert.equal(removed, false);
  assert.deepEqual(cfg.permission.skill, { '*': 'ask' });
});

test('removeSkillDeny: 无 permission 时安全返回 false', () => {
  const cfg = {};
  assert.equal(lib.removeSkillDeny(cfg), false);
});

// ─── 集成：install 写 deny / uninstall 移 deny ─────────────────────────
test('集成：install 后 kilo.jsonc 含 libretto-*: deny', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    assert.equal(lib.runInstall({ context: ctx }), EXIT.OK);
    const cfg = lib.readJsonc(ctx.configFile);
    assert.equal(cfg.permission.skill['libretto-*'], 'deny', 'install 应写入模型侧 deny');
    // manifest 应记录隔离相关字段
    const m = lib.readManifest(ctx.manifestFile);
    assert.equal(m.permissionKey, 'libretto-*');
    assert.equal(m.skillPrefix, 'libretto-');
  } finally { rmrf(home); }
});

test('集成：uninstall 后 kilo.jsonc 不再含 libretto-* deny', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    lib.runInstall({ context: ctx });
    lib.runUninstall({ context: ctx });
    const cfg = lib.readJsonc(ctx.configFile);
    assert.equal(
      (cfg.permission && cfg.permission.skill && cfg.permission.skill['libretto-*']) || undefined,
      undefined,
      'uninstall 应移除 deny 键'
    );
  } finally { rmrf(home); }
});

test('集成：install/uninstall 保留用户已有的 skill 权限规则', () => {
  const home = mkTempHome();
  try {
    const ctx = ctxFor(home, { KILO_LIBRETTO_SKIP_OPENSPEC_CHECK: '1' });
    fs.mkdirSync(ctx.configDir, { recursive: true });
    fs.writeFileSync(
      ctx.configFile,
      JSON.stringify({ permission: { skill: { 'my-tool-*': 'allow', '*': 'ask' } } }, null, 2),
      'utf8'
    );
    lib.runInstall({ context: ctx });
    let cfg = lib.readJsonc(ctx.configFile);
    assert.equal(cfg.permission.skill['my-tool-*'], 'allow');
    assert.equal(cfg.permission.skill['*'], 'ask');
    assert.equal(cfg.permission.skill['libretto-*'], 'deny');

    lib.runUninstall({ context: ctx });
    cfg = lib.readJsonc(ctx.configFile);
    assert.equal(cfg.permission.skill['my-tool-*'], 'allow', '用户规则卸载后必须保留');
    assert.equal(cfg.permission.skill['*'], 'ask');
    assert.equal(cfg.permission.skill['libretto-*'], undefined);
  } finally { rmrf(home); }
});