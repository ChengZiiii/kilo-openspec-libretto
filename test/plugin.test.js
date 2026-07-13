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