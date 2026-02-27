#!/usr/bin/env npx tsx
/**
 * 回填现有资产的文件内容
 * 
 * 从 GitHub 拉取文件内容，写入已有资产的 files JSON 中。
 * 
 * Usage:
 *   npx tsx tools/backfill-file-content.ts              # 回填所有 GitHub 导入的资产
 *   npx tsx tools/backfill-file-content.ts --id s-xxx   # 只回填指定资产
 *   npx tsx tools/backfill-file-content.ts --dry-run    # 预览不写入
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'hub.db');
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

// Text file extensions
const TEXT_EXTENSIONS = new Set([
  'md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv',
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'cpp', 'h', 'hpp',
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd',
  'css', 'scss', 'less', 'html', 'htm', 'vue', 'svelte',
  'sql', 'graphql', 'gql', 'proto',
  'dockerfile', 'makefile', 'cmake',
  'env', 'ini', 'cfg', 'conf', 'config',
  'gitignore', 'gitattributes', 'editorconfig', 'eslintrc', 'prettierrc',
]);

const MAX_FILE_SIZE = 50 * 1024;
const MAX_TOTAL_CONTENT = 500 * 1024;
const CONCURRENCY = 5;

function isTextFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  const knownTextFiles = ['makefile', 'dockerfile', 'procfile', 'gemfile', 'rakefile', 'license', 'readme', 'changelog', 'contributing', 'authors'];
  if (knownTextFiles.includes(lower)) return true;
  const ext = lower.split('.').pop() || '';
  return TEXT_EXTENSIONS.has(ext);
}

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'agent-hub-backfill/1.0',
  };
  if (GITHUB_TOKEN) h['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

async function ghFetch(endpoint: string): Promise<any> {
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: githubHeaders() });
    if (res.status === 404) return null;
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        const reset = res.headers.get('x-ratelimit-reset');
        const resetDate = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : 'unknown';
        throw new Error(`Rate limit exceeded. Resets at ${resetDate}.`);
      }
      throw new Error(`403: ${await res.text()}`);
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
    }
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error('Request failed after retries');
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  content?: string;
}

function flattenFiles(nodes: FileNode[], prefix = ''): { path: string; name: string; size: number; node: FileNode }[] {
  const result: { path: string; name: string; size: number; node: FileNode }[] = [];
  for (const node of nodes) {
    const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'file') {
      result.push({ path: fullPath, name: node.name, size: node.size || 0, node });
    }
    if (node.children) {
      result.push(...flattenFiles(node.children, fullPath));
    }
  }
  return result;
}

function setFileContent(nodes: FileNode[], targetPath: string, content: string): boolean {
  const parts = targetPath.split('/');
  if (parts.length === 1) {
    const node = nodes.find(n => n.name === parts[0] && n.type === 'file');
    if (node) { node.content = content; return true; }
    return false;
  }
  const dir = nodes.find(n => n.name === parts[0] && n.type === 'directory');
  if (dir?.children) {
    return setFileContent(dir.children, parts.slice(1).join('/'), content);
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  let targetId = '';
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id') targetId = args[++i];
    if (args[i] === '--dry-run') dryRun = true;
  }

  console.log(`\n🐟 文件内容回填工具`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`${GITHUB_TOKEN ? '🔑 Using GitHub token' : '⚠️  No GITHUB_TOKEN (60 req/h limit). Set GITHUB_TOKEN for 5000/h'}`);
  if (dryRun) console.log(`🔍 DRY RUN`);

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  // Find assets to backfill
  let query = `SELECT id, name, github_url, files FROM assets WHERE github_url != '' AND github_url IS NOT NULL`;
  const params: any[] = [];
  if (targetId) {
    query += ` AND id = ?`;
    params.push(targetId);
  }

  const assets = db.prepare(query).all(...params) as { id: string; name: string; github_url: string; files: string }[];
  console.log(`📦 Found ${assets.length} GitHub-imported assets to process\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const files: FileNode[] = JSON.parse(asset.files || '[]');

    // Check if already has content
    const flat = flattenFiles(files);
    const withContent = flat.filter(f => f.node.content && f.node.content.trim());
    if (withContent.length > 0) {
      console.log(`[${i + 1}/${assets.length}] ⏭️  ${asset.name} — already has ${withContent.length} files with content, skipping`);
      skipped++;
      continue;
    }

    // Parse GitHub URL
    const match = asset.github_url.match(/github\.com\/([^\/]+)\/([^\/\s#?]+)/);
    if (!match) {
      console.log(`[${i + 1}/${assets.length}] ⚠️  ${asset.name} — can't parse GitHub URL: ${asset.github_url}`);
      failed++;
      continue;
    }
    const [, owner, repo] = match;

    console.log(`[${i + 1}/${assets.length}] 📥 ${asset.name} (${owner}/${repo})`);

    try {
      // Find text files to fetch
      const textFiles = flat.filter(f => {
        if (!isTextFile(f.name)) return false;
        if (f.size > MAX_FILE_SIZE) return false;
        if (f.name === 'package-lock.json' || f.name === 'yarn.lock' || f.name === 'pnpm-lock.yaml') return false;
        return true;
      });

      // Sort by size, cap at total limit
      textFiles.sort((a, b) => a.size - b.size);
      let totalSize = 0;
      const toFetch: typeof textFiles = [];
      for (const f of textFiles) {
        if (totalSize + f.size > MAX_TOTAL_CONTENT) break;
        toFetch.push(f);
        totalSize += f.size;
      }

      console.log(`  📂 ${flat.length} total files, ${toFetch.length} text files to fetch (~${Math.round(totalSize / 1024)}KB)`);

      if (dryRun) {
        console.log(`  🔍 DRY RUN — would fetch ${toFetch.length} files\n`);
        continue;
      }

      let fetched = 0;
      for (let j = 0; j < toFetch.length; j += CONCURRENCY) {
        const batch = toFetch.slice(j, j + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (f) => {
            try {
              const data = await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(f.path)}`);
              if (data?.content) {
                return { path: f.path, content: Buffer.from(data.content, 'base64').toString('utf-8') };
              }
              return null;
            } catch { return null; }
          })
        );

        for (const r of results) {
          if (r) {
            setFileContent(files, r.path, r.content);
            fetched++;
          }
        }

        // Rate limit courtesy
        if (j + CONCURRENCY < toFetch.length) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      // Update DB
      db.prepare(`UPDATE assets SET files = ?, updated_at = ? WHERE id = ?`).run(
        JSON.stringify(files),
        new Date().toISOString().split('T')[0],
        asset.id
      );

      console.log(`  ✅ Fetched ${fetched}/${toFetch.length} files, DB updated\n`);
      updated++;

      // Delay between repos
      if (i < assets.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}\n`);
      failed++;
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Summary: ✅ ${updated} updated | ⏭️ ${skipped} skipped | ❌ ${failed} failed`);

  db.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
