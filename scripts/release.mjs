#!/usr/bin/env node
/**
 * MoneyBook 一键发布脚本
 *
 * 用法：
 *   node scripts/release.mjs patch          # 1.0.2 -> 1.0.3
 *   node scripts/release.mjs minor          # 1.0.2 -> 1.1.0
 *   node scripts/release.mjs major          # 1.0.2 -> 2.0.0
 *   node scripts/release.mjs 1.2.0          # 指定版本号
 *   node scripts/release.mjs patch --push   # 改版本 + 提交 + 打 tag + 推送（触发 CI 发布）
 *   node scripts/release.mjs patch --dry-run# 仅预览，不做任何修改
 *
 * 流程：
 *   1. 校验 git 工作区干净
 *   2. npm version 更新 package.json / package-lock.json 并生成 git commit + tag
 *   3. （可选 --push）推送分支与 tag，触发 .github/workflows/release.yml 构建发布
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const type = args.find((a) => ['patch', 'minor', 'major'].includes(a)) ?? null;
const explicit = args.find((a) => /^\d+\.\d+\.\d+$/.test(a)) ?? null;
const push = args.includes('--push');
const dryRun = args.includes('--dry-run');

if (!type && !explicit) {
  console.error('用法: node scripts/release.mjs <patch|minor|major|1.2.3> [--push] [--dry-run]');
  console.error('示例: node scripts/release.mjs minor --push');
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
const current = pkg.version;

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  if (dryRun) return '';
  return execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
}

// 1. 校验 git 工作区干净
console.log('==> 检查 git 工作区状态...');
try {
  const dirty = execSync('git status --porcelain', { cwd: root, encoding: 'utf-8' }).trim();
  if (dirty) {
    console.error('错误：工作区存在未提交的更改，请先 commit 或 stash：\n' + dirty);
    process.exit(1);
  }
} catch {
  console.error('错误：无法读取 git 状态，请确认当前目录是一个 git 仓库。');
  process.exit(1);
}

// 2. 预览信息
const versionArg = explicit ?? type;
console.log('----------------------------------------');
console.log(`  当前版本 : ${current}`);
console.log(`  目标版本 : ${explicit ?? `${current} -> ${type}`}`);
console.log(`  推送发布 : ${push ? '是' : '否'}`);
if (dryRun) console.log('  预演模式 : 是（不执行任何修改）');
console.log('----------------------------------------');

if (dryRun) {
  console.log('dry-run 结束，未做任何更改。');
  process.exit(0);
}

// 3. npm version：更新 package.json / package-lock.json，自动 commit + tag
console.log('==> 更新版本号并提交...');
try {
  run(`npm version ${versionArg} -m "release: v%s"`);
} catch (e) {
  console.error('错误：npm version 执行失败。', e.message);
  process.exit(1);
}

// 读取新版本号
const newPkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));
const next = newPkg.version;
console.log(`==> 版本已更新为 v${next}`);

// 4. 推送
if (push) {
  const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root, encoding: 'utf-8' }).trim();
  console.log(`==> 推送到 origin/${branch} 并上传 tag v${next} ...`);
  run(`git push origin ${branch}`);
  run(`git push origin v${next}`);
  console.log('----------------------------------------');
  console.log(`已触发 GitHub Actions 自动构建发布（tag: v${next}）`);
  console.log('可在 https://github.com/Tawesh/money-book/actions 查看进度');
  console.log('发布完成后，用户端将通过 electron-updater 自动检测到新版本。');
} else {
  console.log('----------------------------------------');
  console.log(`版本 v${next} 已提交并打 tag（未推送）。`);
  console.log('确认无误后推送即可触发自动发布：');
  console.log('  git push origin <当前分支>');
  console.log('  git push origin v' + next);
}
