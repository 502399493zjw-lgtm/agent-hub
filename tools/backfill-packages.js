#!/usr/bin/env node
/**
 * backfill-packages.js
 * 
 * 一次性脚本：为缺少 package 文件的资产，从 DB 的 files 字段生成 .tar.gz
 * 
 * 用法：
 *   node tools/backfill-packages.js                # dry-run（只打印，不写文件）
 *   node tools/backfill-packages.js --execute      # 真正执行
 * 
 * 前提：在项目根目录运行，DB 在 data/hub.db，packages 目录在 data/packages/
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, 'data', 'hub.db');
const PACKAGES_DIR = path.join(ROOT, 'data', 'packages');
const DRY_RUN = !process.argv.includes('--execute');

if (DRY_RUN) {
  console.log('🔍 DRY RUN — 不会写任何文件。加 --execute 执行。\n');
}

// 检查 DB 存在
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ DB not found: ${DB_PATH}`);
  process.exit(1);
}

// 确保 packages 目录存在
if (!fs.existsSync(PACKAGES_DIR)) {
  if (!DRY_RUN) fs.mkdirSync(PACKAGES_DIR, { recursive: true });
}

const db = new Database(DB_PATH, { readonly: DRY_RUN });

// 查出所有资产
const assets = db.prepare('SELECT id, name, type, files FROM assets').all();

let missing = 0;
let skipped = 0;
let created = 0;
let noFiles = 0;

for (const asset of assets) {
  const { id, name, type, files: filesJson } = asset;

  // 检查是否已有 package 文件
  const extensions = ['tar.gz', 'tgz', 'zip', 'skill'];
  const hasPackage = extensions.some(ext =>
    fs.existsSync(path.join(PACKAGES_DIR, `${id}.${ext}`))
  );

  if (hasPackage) {
    skipped++;
    continue;
  }

  // 解析 files
  let files;
  try {
    files = JSON.parse(filesJson || '[]');
  } catch {
    files = [];
  }

  if (!Array.isArray(files) || files.length === 0) {
    noFiles++;
    console.log(`⚪ ${id} (${name}) — 无 files 数据，跳过`);
    continue;
  }

  // Skip assets where all files have 0 content
  const totalChars = files.reduce((s, f) => s + (f.content || '').length, 0);
  if (totalChars === 0) {
    noFiles++;
    console.log(`⚪ ${id} (${name}) — 文件全空（只有文件名），跳过`);
    continue;
  }

  missing++;

  if (DRY_RUN) {
    console.log(`🟡 ${id} (${name}) — 缺 package，有 ${files.length} 个文件可打包`);
    for (const f of files) {
      console.log(`   📄 ${f.name} (${(f.content || '').length} chars)`);
    }
    continue;
  }

  // 创建临时目录，写入文件，打包
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `backfill-${id}-`));
  try {
    for (const f of files) {
      const filePath = path.join(tmpDir, f.name || 'README.md');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, f.content || '');
    }

    const outPath = path.join(PACKAGES_DIR, `${id}.tar.gz`);
    execSync(`tar czf "${outPath}" -C "${tmpDir}" .`, { timeout: 10000 });

    const size = fs.statSync(outPath).size;
    console.log(`✅ ${id} (${name}) — 已生成 ${(size / 1024).toFixed(1)}KB`);
    created++;
  } catch (err) {
    console.error(`❌ ${id} (${name}) — 打包失败: ${err.message}`);
  } finally {
    // 清理临时目录
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

db.close();

console.log(`\n📊 统计：`);
console.log(`   总资产: ${assets.length}`);
console.log(`   已有 package: ${skipped}`);
console.log(`   无 files 数据: ${noFiles}`);
console.log(`   需要补包: ${missing}`);
if (!DRY_RUN) {
  console.log(`   成功创建: ${created}`);
  console.log(`   失败: ${missing - created}`);
}
