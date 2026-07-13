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
  PARSE_ERROR: 2,
  NOT_WRITABLE: 3,
  LINK_FAILED: 4,
});

export const MANIFEST_NAME = '.kilo-openspec-libretto.json';

// libretto 技能命名空间前缀与权限键（对齐 kilo-superpowers-compose v0.2.0）。
// 隔离靠两套机制：
//   1. 每个 SKILL.md 的 name: 字段直接写 libretto- 前缀（见 skills/*/SKILL.md）。
//      Kilo 按 name: 字段注册技能身份，认字段、不认 junction 文件夹名。
//   2. permission.skill['libretto-*'] = 'deny'（模型侧隔离的 deny 侧，见下方
//      ensureSkillDeny）。Kilo 的 Permission.evaluate 用 findLast 取末尾匹配键，
//      把 'libretto-*': 'deny' 放到 skill 对象末尾即可压过默认 '*': 'allow'，
//      使其它 agent / 默认模型不会自动加载 libretto 技能；libretto 自身 agent
//      仍通过显式 skill 调用使用它们。
export const SKILL_PREFIX = 'libretto-';
export const SKILL_PERMISSION_KEY = 'libretto-*';

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

export function resolvePaths(home) {
  const configDir = path.join(home, '.config', 'kilo');
  const skillsDir = path.join(home, '.kilo', 'skills');
  return {
    home,
    configDir,
    configFile: path.join(configDir, 'kilo.jsonc'),
    agentsDir: path.join(configDir, 'agent'),
    skillsDir,
    // junction 名固定为 libretto。注意：Kilo 按 SKILL.md 的 name: 字段注册技能身份，
    // 不认 junction 文件夹名；前缀隔离靠 skills/*/SKILL.md 里写死的 libretto- 前缀
    // + permission.skill['libretto-*']: 'deny'（见 ensureSkillDeny）。此 junction
    // 仅用于把包内 skills 目录挂到 ~/.kilo/skills/ 下供 Kilo 扫描。
    skillLink: path.join(skillsDir, 'libretto'),
    manifestFile: path.join(configDir, MANIFEST_NAME),
  };
}

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

export function normalizePath(p) {
  return path.resolve(p).toLowerCase();
}

export function skillsPathsContains(paths, target) {
  const t = normalizePath(target);
  return Array.isArray(paths) && paths.some((p) => normalizePath(p) === t);
}

// 确保 config.permission.skill[SKILL_PERMISSION_KEY] = 'deny'，且该键位于对象末尾
// （依赖 kilo Permission.evaluate 的 findLast：末尾的 libretto-*:deny 才能赢过 *）。
// 标量 skill 升级为对象，原值保留于 '*' 键。返回是否发生改动。
// 注意：即便值已是 'deny'，只要它不在末尾（被 '*':allow 等盖在后面），也会重排到末尾
// —— findLast 语义要求 deny 必须是最后一个键才能真正生效。
export function ensureSkillDeny(config, key = SKILL_PERMISSION_KEY) {
  config.permission = config.permission || {};
  let skill = config.permission.skill;
  if (typeof skill === 'string') skill = { '*': skill };
  if (skill === undefined || skill === null) skill = {};
  skill = { ...skill };
  const keys = Object.keys(skill);
  const lastKey = keys[keys.length - 1];
  const needsMove = skill[key] !== 'deny' || lastKey !== key;
  if (needsMove) {
    delete skill[key];
    skill[key] = 'deny'; // 删后重插末尾，保证顺序
  }
  config.permission.skill = skill;
  return needsMove;
}

// 移除 config.permission.skill[SKILL_PERMISSION_KEY]；删后容器若空则一并清理。
// 绝不动用户其它 skill / permission 规则。返回是否发生移除。
export function removeSkillDeny(config, key = SKILL_PERMISSION_KEY) {
  if (!config.permission || !config.permission.skill) return false;
  const skill = config.permission.skill;
  if (!(key in skill)) return false;
  delete skill[key];
  if (Object.keys(skill).length === 0) delete config.permission.skill;
  if (config.permission && Object.keys(config.permission).length === 0) delete config.permission;
  return true;
}

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
// 注意：Windows 上 npm 全局安装产生的是 .ps1/.cmd 垫片，spawnSync 不自动解析
// 它们（ENOENT）。设 shell: true 让 OS 解析 PATHEXT。
export function detectOpenSpecCli() {
  try {
    const result = spawnSync('openspec', ['--version'], {
      timeout: 5000,
      encoding: 'utf8',
      windowsHide: true,
      shell: process.platform === 'win32',
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
  // 6b. 确保 permission.skill['libretto-*']='deny'（模型侧隔离的 deny 侧，幂等）
  const permChanged = ensureSkillDeny(config);
  if ((added || permChanged) && !dryRun) writeJson(ctx.configFile, config);

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
      permissionKey: SKILL_PERMISSION_KEY,
      skillPrefix: SKILL_PREFIX,
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
  }
  // 同步移除 permission.skill 的 libretto-* 键（精确，保留用户其它规则）
  const permRemoved = removeSkillDeny(config);
  if ((removedEntries > 0 || permRemoved) && !dryRun) writeJson(ctx.configFile, config);

  // 4. 移除清单
  removeManifest(ctx.manifestFile, { dryRun, log });

  console.log('✓ kilo-openspec-libretto 已卸载');
  console.log(`  agents: ${agentPaths.length} 个文件`);
  console.log(`  技能链接: ${ctx.skillLink}`);
  console.log(`  kilo.jsonc: skills.paths 移除 ${removedEntries} 条`);
  console.log('  未触碰用户自有的技能 / 代理 / 配置。');
  return EXIT.OK;
}

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