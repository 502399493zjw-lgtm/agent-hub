#!/usr/bin/env node
/**
 * refetch-github-files.js
 * Re-fetch file contents from GitHub for assets with empty files.
 * Uses GitHub Trees API + Blobs API.
 * 
 * Usage:
 *   node refetch-github-files.js              # dry-run
 *   node refetch-github-files.js --execute    # actually update DB + generate packages
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DRY_RUN = !process.argv.includes('--execute');
const DB_PATH = path.join(__dirname, '..', 'data', 'hub.db');
const PACKAGES_DIR = path.join(__dirname, '..', 'data', 'packages');

// Text file extensions we want to fetch content for
const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml',
  '.toml', '.cfg', '.ini', '.env', '.sh', '.bash', '.zsh', '.py', '.rb',
  '.go', '.rs', '.java', '.c', '.h', '.cpp', '.css', '.scss', '.html',
  '.xml', '.svg', '.dockerfile', '.gitignore', '.gitattributes',
  '.prettierrc', '.prettierignore', '.eslintrc', '.mjs', '.cjs',
  '.lock', '.example', '.bat', '.ps1',
]);

// Files without extension that are still text
const TEXT_FILENAMES = new Set([
  'Dockerfile', 'Makefile', 'LICENSE', 'Procfile', 'Gemfile',
  '.gitignore', '.gitattributes', '.prettierrc', '.prettierignore',
  '.dockerignore', '.env', '.env.example',
]);

// Max file size to fetch (20KB)
const MAX_FILE_SIZE = 20 * 1024;
// Max total files per asset
const MAX_FILES = 100;

const TARGETS = [
  { id: 'ch-1653e58fc2658831', owner: 'freestylefly', repo: 'openclaw-wechat', subdir: null },
  { id: 'ch-2f03e637d60a9678', owner: 'justlovemaki', repo: 'OpenClaw-Docker-CN-IM', subdir: null },
  { id: 'p-29dbfacadfaf05fc', owner: 'BlockRunAI', repo: 'ClawRouter', subdir: null },
  { id: 'p-60d34ee1b1780c6b', owner: 'mnfst', repo: 'manifest', subdir: null },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'openclawmp-refetch/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
    };
    // Add GitHub token if available
    if (process.env.GITHUB_TOKEN) {
      options.headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${url}\n${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function isTextFile(filepath) {
  const basename = path.basename(filepath);
  if (TEXT_FILENAMES.has(basename)) return true;
  const ext = path.extname(filepath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // No extension files in root are often text (LICENSE, etc)
  if (!ext && !filepath.includes('/')) return true;
  return false;
}

async function fetchRepoFiles(owner, repo, subdir) {
  console.log(`  📡 Fetching tree for ${owner}/${repo}${subdir ? '/' + subdir : ''}...`);
  
  // Get default branch
  const repoInfo = await httpsGet(`https://api.github.com/repos/${owner}/${repo}`);
  const branch = repoInfo.default_branch || 'main';
  
  // Get recursive tree
  const tree = await httpsGet(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
  
  if (!tree.tree) {
    console.log(`  ⚠️ No tree found`);
    return [];
  }
  
  // Filter to text blobs within subdir
  let blobs = tree.tree.filter(item => {
    if (item.type !== 'blob') return false;
    if (subdir && !item.path.startsWith(subdir + '/')) return false;
    if (item.size > MAX_FILE_SIZE) return false;
    return isTextFile(item.path);
  });
  
  // Also include directory entries (for tree structure)
  let dirs = tree.tree.filter(item => {
    if (item.type !== 'tree') return false;
    if (subdir && !item.path.startsWith(subdir + '/')) return false;
    // Only top-level dirs
    const relPath = subdir ? item.path.slice(subdir.length + 1) : item.path;
    return !relPath.includes('/');
  });
  
  console.log(`  📄 Found ${blobs.length} text files, ${dirs.length} directories`);
  
  if (blobs.length > MAX_FILES) {
    console.log(`  ⚠️ Truncating to ${MAX_FILES} files`);
    blobs = blobs.slice(0, MAX_FILES);
  }
  
  const files = [];
  
  // Add directory entries (no content)
  for (const dir of dirs) {
    const relPath = subdir ? dir.path.slice(subdir.length + 1) : dir.path;
    files.push({ path: relPath, content: '' });
  }
  
  // Fetch content for each blob
  for (const blob of blobs) {
    const relPath = subdir ? blob.path.slice(subdir.length + 1) : blob.path;
    try {
      const blobData = await httpsGet(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${blob.sha}`);
      let content = '';
      if (blobData.encoding === 'base64') {
        content = Buffer.from(blobData.content, 'base64').toString('utf8');
      } else {
        content = blobData.content || '';
      }
      files.push({ path: relPath, content });
      process.stdout.write('.');
      // Rate limit: 100ms delay between blob fetches
      await sleep(100);
    } catch (err) {
      console.log(`\n  ⚠️ Failed to fetch ${relPath}: ${err.message}`);
      files.push({ path: relPath, content: '' });
    }
  }
  console.log(''); // newline after dots
  
  return files;
}

async function main() {
  if (DRY_RUN) {
    console.log('🔍 DRY RUN — 不会修改 DB 或生成文件。加 --execute 执行。\n');
  } else {
    console.log('🚀 EXECUTE MODE — 将更新 DB 并生成 package 文件。\n');
  }

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);
  
  let success = 0, failed = 0;
  
  for (const target of TARGETS) {
    console.log(`\n🔄 ${target.id} — ${target.owner}/${target.repo}`);
    
    try {
      const files = await fetchRepoFiles(target.owner, target.repo, target.subdir);
      const totalChars = files.reduce((s, f) => s + f.content.length, 0);
      const nonEmpty = files.filter(f => f.content.length > 0).length;
      
      console.log(`  📊 ${files.length} 条目, ${nonEmpty} 个有内容, ${totalChars} 总字符`);
      
      if (totalChars === 0) {
        console.log(`  ⚠️ 仍然无内容可抓取，跳过`);
        failed++;
        continue;
      }
      
      if (!DRY_RUN) {
        // Update DB files field
        const filesJson = JSON.stringify(files);
        db.prepare('UPDATE assets SET files = ? WHERE id = ?').run(filesJson, target.id);
        console.log(`  💾 DB files 字段已更新`);
        
        // Generate package tar.gz
        const tmpDir = `/tmp/backfill-${target.id}`;
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
        fs.mkdirSync(tmpDir, { recursive: true });
        
        for (const f of files) {
          if (!f.content) continue; // skip dirs / empty
          const filePath = path.join(tmpDir, f.path);
          fs.mkdirSync(path.dirname(filePath), { recursive: true });
          fs.writeFileSync(filePath, f.content);
        }
        
        const tarPath = path.join(PACKAGES_DIR, `${target.id}.tar.gz`);
        execSync(`tar czf "${tarPath}" -C "${tmpDir}" .`, { stdio: 'pipe' });
        const size = (fs.statSync(tarPath).size / 1024).toFixed(1);
        console.log(`  📦 Package 已生成: ${size}KB`);
        
        // Cleanup
        fs.rmSync(tmpDir, { recursive: true });
        success++;
      } else {
        console.log(`  ✅ (dry-run) 可以抓取并打包`);
        success++;
      }
    } catch (err) {
      console.log(`  ❌ 失败: ${err.message}`);
      failed++;
    }
  }
  
  db.close();
  console.log(`\n📊 完成: 成功 ${success}, 失败 ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
