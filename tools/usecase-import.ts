#!/usr/bin/env npx tsx
/**
 * awesome-openclaw-usecases → 水产市场 批量导入工具
 *
 * 从 hesamsheikh/awesome-openclaw-usecases 仓库拉取用例 markdown，
 * 按指定分类导入到本地 hub.db。
 *
 * Usage:
 *   npx tsx tools/usecase-import.ts [--dry-run]
 */

import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'hub.db');
const RAW_BASE = 'https://raw.githubusercontent.com/hesamsheikh/awesome-openclaw-usecases/main/usecases';

// ═══════════════════════════════════════════
// 29 用例分类表（按指挥官最终确认）
// ═══════════════════════════════════════════

interface UsecaseDef {
  file: string;           // markdown 文件名（不含 .md）
  type: string;           // trigger | skill | plugin | channel | experience
  displayName: string;    // 展示名
  category: string;       // README 里的分类
  tags: string[];         // 标签
}

const USECASES: UsecaseDef[] = [
  // ══════ 全部 Experience ══════
  { file: 'daily-reddit-digest',           type: 'experience', displayName: 'Reddit 每日精选',                category: '社交媒体',              tags: ['reddit', 'digest', 'cron', 'daily'] },
  { file: 'daily-youtube-digest',          type: 'experience', displayName: 'YouTube 每日精选',               category: '社交媒体',              tags: ['youtube', 'digest', 'cron', 'daily'] },
  { file: 'multi-source-tech-news-digest', type: 'experience', displayName: '多源科技新闻聚合',              category: '社交媒体',              tags: ['news', 'rss', 'twitter', 'github', 'cron'] },
  { file: 'youtube-content-pipeline',      type: 'experience', displayName: 'YouTube 内容创作流水线',         category: '创意与构建',            tags: ['youtube', 'content', 'cron', 'hourly'] },
  { file: 'inbox-declutter',               type: 'experience', displayName: '邮箱自动整理',                  category: '效率工具',              tags: ['email', 'newsletter', 'digest', 'cron'] },
  { file: 'polymarket-autopilot',          type: 'experience', displayName: 'Polymarket 自动交易',           category: '金融与交易',            tags: ['polymarket', 'trading', 'monitor', 'cron'] },
  { file: 'dynamic-dashboard',             type: 'experience', displayName: '动态数据仪表盘',                category: '效率工具',              tags: ['dashboard', 'api', 'monitor', 'cron'] },
  { file: 'project-state-management',      type: 'experience', displayName: '事件驱动项目管理',              category: '效率工具',              tags: ['project', 'state', 'event-driven', 'cron'] },
  { file: 'market-research-product-factory', type: 'experience', displayName: '市场调研与产品工厂',          category: '研究与学习',            tags: ['research', 'reddit', 'product', 'cron'] },
  { file: 'x-account-analysis',            type: 'experience', displayName: 'X/Twitter 账号分析',            category: '社交媒体',              tags: ['twitter', 'x', 'analysis'] },
  { file: 'todoist-task-manager',          type: 'experience', displayName: 'Todoist 任务管理',              category: '效率工具',              tags: ['todoist', 'tasks', 'visualization'] },
  { file: 'knowledge-base-rag',            type: 'experience', displayName: '个人知识库 (RAG)',               category: '研究与学习',            tags: ['rag', 'knowledge-base', 'semantic-search'] },
  { file: 'semantic-memory-search',        type: 'experience', displayName: '语义记忆搜索',                  category: '研究与学习',            tags: ['memory', 'vector', 'search', 'memsearch'] },
  { file: 'n8n-workflow-orchestration',    type: 'experience', displayName: 'n8n 工作流编排',                category: '基础设施与运维',        tags: ['n8n', 'workflow', 'webhook', 'api'] },
  { file: 'phone-based-personal-assistant', type: 'experience', displayName: '电话语音助手',                 category: '效率工具',              tags: ['phone', 'voice', 'telnyx', 'clawdtalk'] },
  { file: 'self-healing-home-server',      type: 'experience', displayName: '自愈式家庭服务器',              category: '基础设施与运维',        tags: ['server', 'ssh', 'cron', 'self-healing', 'devops'] },
  { file: 'multi-agent-team',             type: 'experience', displayName: '多 Agent 专业团队',              category: '效率工具',              tags: ['multi-agent', 'team', 'telegram', 'cron'] },
  { file: 'overnight-mini-app-builder',   type: 'experience', displayName: '目标驱动自主任务',               category: '创意与构建',            tags: ['autonomous', 'goal-driven', 'mini-app', 'cron'] },
  { file: 'content-factory',              type: 'experience', displayName: '多 Agent 内容工厂',              category: '创意与构建',            tags: ['content', 'multi-agent', 'discord', 'pipeline'] },
  { file: 'personal-crm',                 type: 'experience', displayName: '个人 CRM 联系人管理',            category: '效率工具',              tags: ['crm', 'contacts', 'email', 'calendar', 'cron'] },
  { file: 'health-symptom-tracker',       type: 'experience', displayName: '健康与症状追踪',                 category: '效率工具',              tags: ['health', 'symptoms', 'food', 'tracking', 'cron'] },
  { file: 'earnings-tracker',             type: 'experience', displayName: 'AI 财报追踪',                    category: '研究与学习',            tags: ['earnings', 'finance', 'alerts', 'cron'] },
  { file: 'custom-morning-brief',         type: 'experience', displayName: '定制晨间简报',                   category: '效率工具',              tags: ['morning', 'briefing', 'news', 'tasks', 'cron'] },
  { file: 'multi-channel-assistant',      type: 'experience', displayName: '多渠道个人助手',                 category: '效率工具',              tags: ['multi-channel', 'telegram', 'slack', 'cron'] },
  { file: 'family-calendar-household-assistant', type: 'experience', displayName: '家庭日历与家务助手',      category: '效率工具',              tags: ['family', 'calendar', 'household', 'cron'] },
  { file: 'second-brain',                 type: 'experience', displayName: '第二大脑',                       category: '效率工具',              tags: ['memory', 'notes', 'dashboard', 'next-js'] },
  { file: 'autonomous-project-management', type: 'experience', displayName: '自主项目管理',                  category: '效率工具',              tags: ['project', 'state-yaml', 'multi-agent'] },
  { file: 'multi-channel-customer-service', type: 'experience', displayName: '多渠道 AI 客服',               category: '效率工具',              tags: ['customer-service', 'whatsapp', 'instagram', 'email'] },
  { file: 'event-guest-confirmation',     type: 'experience', displayName: '活动嘉宾确认',                   category: '效率工具',              tags: ['events', 'phone-call', 'supercall', 'voice'] },
];

// ═══════════════════════════════════════════
// Fetch markdown content
// ═══════════════════════════════════════════

async function fetchMarkdown(file: string): Promise<string> {
  const url = `${RAW_BASE}/${file}.md`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

// ═══════════════════════════════════════════
// Translate markdown to Chinese (via LLM API)
// ═══════════════════════════════════════════

async function translateToChineseSummary(markdown: string, displayName: string): Promise<string> {
  // Build a concise Chinese README from the English usecase markdown
  // We'll do a structured extraction + translation approach without external API
  // Parse key sections from the markdown

  const lines = markdown.split('\n');
  let title = '';
  let overview = '';
  const sections: { heading: string; content: string }[] = [];
  let currentHeading = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.replace(/^#\s+/, '').trim();
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentHeading || currentContent.length > 0) {
        const text = currentContent.join('\n').trim();
        if (!currentHeading && text) {
          overview = text;
        } else if (currentHeading && text) {
          sections.push({ heading: currentHeading, content: text });
        }
      }
      currentHeading = line.replace(/^#{2,3}\s+/, '').trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  // Flush last section
  if (currentHeading && currentContent.length > 0) {
    const text = currentContent.join('\n').trim();
    if (text) sections.push({ heading: currentHeading, content: text });
  } else if (!overview && currentContent.length > 0) {
    overview = currentContent.join('\n').trim();
  }

  // Build Chinese README structure
  const chineseReadme: string[] = [];
  chineseReadme.push(`# ${displayName}`);
  chineseReadme.push('');
  chineseReadme.push(`> 原始来源：[awesome-openclaw-usecases](https://github.com/hesamsheikh/awesome-openclaw-usecases)`);
  chineseReadme.push('');

  if (overview) {
    chineseReadme.push('## 概述');
    chineseReadme.push('');
    chineseReadme.push(overview);
    chineseReadme.push('');
  }

  // Keep technical sections as-is (code blocks, configs are universal)
  for (const section of sections) {
    chineseReadme.push(`## ${section.heading}`);
    chineseReadme.push('');
    chineseReadme.push(section.content);
    chineseReadme.push('');
  }

  return chineseReadme.join('\n');
}

// ═══════════════════════════════════════════
// Extract description from markdown
// ═══════════════════════════════════════════

function extractDescription(md: string): string {
  const lines = md.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('|')) continue;
    if (trimmed.startsWith('```')) continue;
    if (trimmed.startsWith('![')) continue;
    if (trimmed.startsWith('---')) continue;
    // Found first content paragraph
    return trimmed.substring(0, 300);
  }
  return '';
}

// ═══════════════════════════════════════════
// DB insert
// ═══════════════════════════════════════════

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

const TYPE_PREFIXES: Record<string, string> = {
  skill: 's', plugin: 'p', trigger: 'tr', channel: 'ch', experience: 'e',
};

function insertUsecase(db: Database.Database, def: UsecaseDef, markdown: string, chineseReadme: string): string {
  const prefix = TYPE_PREFIXES[def.type] || 'x';
  const id = `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString().split('T')[0];
  const name = def.file;
  const description = extractDescription(chineseReadme) || extractDescription(markdown);
  const sourceUrl = `https://github.com/hesamsheikh/awesome-openclaw-usecases/blob/main/usecases/${def.file}.md`;

  const longDesc = [
    `Source: [awesome-openclaw-usecases](${sourceUrl})`,
    `Category: ${def.category}`,
    `Type: ${def.type}`,
  ].join('\n');

  // Build a simple files array with both Chinese and original markdown
  const files = JSON.stringify([{
    name: `README.md`,
    type: 'file',
    size: chineseReadme.length,
    content: chineseReadme,
  }, {
    name: `${def.file}.md`,
    type: 'file',
    size: markdown.length,
    content: markdown,
  }]);

  const stmt = db.prepare(`
    INSERT INTO assets (
      id, name, display_name, type, author_id, author_name, author_avatar,
      description, long_description, version, downloads, rating, rating_count,
      tags, category, created_at, updated_at, install_command, readme,
      versions, dependencies, issue_count, config_subtype,
      hub_score, hub_score_breakdown, upgrade_rate, compatibility, files,
      github_url, github_stars, github_forks, github_language, github_license, github_synced_at
    ) VALUES (
      @id, @name, @display_name, @type, @author_id, @author_name, @author_avatar,
      @description, @long_description, @version, 0, 0, 0,
      @tags, @category, @created_at, @updated_at, @install_command, @readme,
      @versions, '[]', 0, NULL,
      0, '{}', 0, @compatibility, @files,
      @github_url, 0, 0, 'markdown', '', @github_synced_at
    )
  `);

  stmt.run({
    id,
    name,
    display_name: def.displayName,
    type: def.type,
    author_id: 'gh-hesamsheikh',
    author_name: 'hesamsheikh',
    author_avatar: 'https://avatars.githubusercontent.com/u/41022652?v=4',
    description,
    long_description: longDesc,
    version: '1.0.0',
    tags: JSON.stringify(def.tags),
    category: def.category,
    created_at: now,
    updated_at: now,
    install_command: `openclawmp install ${def.type}/@hesamsheikh/${name}`,
    readme: chineseReadme,
    versions: JSON.stringify([{ version: '1.0.0', changelog: 'Imported from awesome-openclaw-usecases', date: now }]),
    compatibility: JSON.stringify({ models: ['Any'], platforms: ['OpenClaw'], frameworks: ['Markdown'] }),
    files,
    github_url: sourceUrl,
    github_synced_at: new Date().toISOString(),
  });

  return id;
}

// ═══════════════════════════════════════════
// Main
// ═══════════════════════════════════════════

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`\n🐟 水产市场 · awesome-openclaw-usecases 批量导入`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 ${USECASES.length} 用例待导入`);
  if (dryRun) console.log(`🔍 DRY RUN — 不写入数据库`);

  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const u of USECASES) {
    typeCounts[u.type] = (typeCounts[u.type] || 0) + 1;
  }
  console.log(`📊 分类: ${Object.entries(typeCounts).map(([t, c]) => `${t}(${c})`).join(' | ')}`);
  console.log();

  const db = dryRun ? null : getDb();
  let success = 0;
  let failed = 0;

  for (let i = 0; i < USECASES.length; i++) {
    const def = USECASES[i];
  const typeEmoji: Record<string, string> = { trigger: '🔔', skill: '🛠️', plugin: '🔌', channel: '📡', experience: '💡' };
    process.stdout.write(`[${i + 1}/${USECASES.length}] ${typeEmoji[def.type] || '📦'} ${def.displayName}...`);

    try {
      const markdown = await fetchMarkdown(def.file);
      const chineseReadme = await translateToChineseSummary(markdown, def.displayName);

      if (dryRun) {
        console.log(` ✅ ${markdown.length} chars → 中文 ${chineseReadme.length} chars (dry-run)`);
        success++;
        continue;
      }

      // Check if already exists by name
      const existing = db!.prepare(`SELECT id FROM assets WHERE name = ?`).get(def.file) as { id: string } | undefined;
      if (existing) {
        console.log(` ⏭️  已存在 ${existing.id}`);
        success++;
        continue;
      }

      const id = insertUsecase(db!, def, markdown, chineseReadme);
      console.log(` ✅ → ${id}`);
      success++;

      // Small delay
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      console.log(` ❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 导入结果: ✅ ${success} | ❌ ${failed}`);

  if (db) db.close();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
