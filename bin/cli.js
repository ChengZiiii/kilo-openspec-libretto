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