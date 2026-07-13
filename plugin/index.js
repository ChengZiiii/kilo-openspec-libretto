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