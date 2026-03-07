import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db/connection';

// ═══════════════════════════════════════════
// Admin auth (same as import-github)
// ═══════════════════════════════════════════

function isAdminAuthed(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || !secret) return false;
  const secretBuf = Buffer.from(secret);
  const adminSecretBuf = Buffer.from(adminSecret);
  if (secretBuf.length !== adminSecretBuf.length) {
    const padded = Buffer.alloc(adminSecretBuf.length);
    secretBuf.copy(padded);
    crypto.timingSafeEqual(padded, adminSecretBuf);
    return false;
  }
  return crypto.timingSafeEqual(secretBuf, adminSecretBuf);
}

// ═══════════════════════════════════════════
// LLM config
// ═══════════════════════════════════════════

const API_KEY = process.env.TRANSLATE_API_KEY || process.env.MODELSPROXY_KEY || '';
const BASE_URL = (process.env.TRANSLATE_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4').replace(/\/$/, '');
const MODEL = process.env.TRANSLATE_MODEL || 'glm-4.5-air';
const DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ═══════════════════════════════════════════
// LLM call
// ═══════════════════════════════════════════

async function callLLM(systemPrompt: string, userContent: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(180_000), // 180s timeout to prevent hanging on long README translation
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ═══════════════════════════════════════════
// Translation logic
// ═══════════════════════════════════════════

const TITLE_DESC_SYSTEM = `你是一个技术文档翻译专家。你的任务是将 AI Agent 工具/技能的英文名称和描述翻译成中文。

规则：
1. 输出格式严格为两行，第一行是中文名称，第二行是中文描述
2. 专有名词保留英文（如 GitHub, OpenClaw, MCP, LLM, API, Docker）
3. 名称要简洁有力，像产品名
4. 描述要准确传达功能，一句话概括
5. 不要添加任何额外解释或标记
6. 如果原文已是中文，原样输出即可`;

async function translateTitleAndDesc(displayName: string, description: string): Promise<{ titleZh: string; descZh: string }> {
  const prompt = `英文名称：${displayName}\n英文描述：${description}`;
  const result = await callLLM(TITLE_DESC_SYSTEM, prompt);

  const lines = result.split('\n').filter((l: string) => l.trim());
  if (lines.length >= 2) {
    return {
      titleZh: lines[0].replace(/^(中文名称[：:]\s*)/i, '').trim(),
      descZh: lines.slice(1).join(' ').replace(/^(中文描述[：:]\s*)/i, '').trim(),
    };
  }
  const single = lines[0] || displayName;
  return { titleZh: single, descZh: single };
}

const README_SYSTEM = `你是一个技术文档翻译专家。将以下 Markdown 文档从英文翻译为中文。

规则：
1. 保持 Markdown 格式不变（标题、列表、链接、加粗、斜体等）
2. 代码块（\`\`\`...\`\`\`）完整保留，不翻译其中内容
3. 保留所有内联代码（\`code\`）不翻译
4. 保留所有 URL 链接不变
5. 专有名词保留英文（GitHub, Docker, npm, API, CLI, MCP, LLM, OpenClaw 等技术术语）
6. 不要添加或删除任何内容，忠实翻译
7. 如果某段已是中文，原样保留
8. 直接输出翻译后的 Markdown，不要包裹在代码块中`;

async function translateReadme(readme: string): Promise<string> {
  if (!readme.trim()) return '';

  const MAX_CHUNK = 3000;
  const chunks: string[] = [];
  const paragraphs = readme.split(/\n\n/);
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_CHUNK && current.length > 0) {
      chunks.push(current);
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) chunks.push(current);

  const translated: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const result = await callLLM(README_SYSTEM, chunks[i]);
    translated.push(result);
    if (i < chunks.length - 1) await sleep(DELAY_MS);
  }

  return translated.join('\n\n');
}

// ═══════════════════════════════════════════
// Ensure _en columns exist (migration)
// ═══════════════════════════════════════════

function ensureEnColumns(db: ReturnType<typeof getDb>) {
  const cols = db.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
  const colNames = new Set(cols.map((c: { name: string }) => c.name));

  if (!colNames.has('display_name_en')) {
    db.exec(`ALTER TABLE assets ADD COLUMN display_name_en TEXT DEFAULT NULL`);
  }
  if (!colNames.has('description_en')) {
    db.exec(`ALTER TABLE assets ADD COLUMN description_en TEXT DEFAULT NULL`);
  }
  if (!colNames.has('readme_en')) {
    db.exec(`ALTER TABLE assets ADD COLUMN readme_en TEXT DEFAULT NULL`);
  }
}

// ═══════════════════════════════════════════
// POST /api/admin/translate
// ═══════════════════════════════════════════

interface TranslateRequest {
  ids: string[];            // asset IDs to translate
  skipReadme?: boolean;     // skip README translation
  force?: boolean;          // re-translate even if already translated
  dryRun?: boolean;         // preview only, don't write
}

interface TranslateResultItem {
  id: string;
  displayName?: string;
  titleZh?: string;
  descZh?: string;
  readmeTranslated?: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ids, skipReadme = false, force = false, dryRun = false } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids is required (string array)' }, { status: 400 });
  }

  if (ids.length > 50) {
    return NextResponse.json({ error: 'Max 50 assets per request' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'TRANSLATE_API_KEY or MODELSPROXY_KEY not configured' }, { status: 500 });
  }

  const db = getDb();
  ensureEnColumns(db);

  const results: TranslateResultItem[] = [];

  for (const id of ids) {
    const asset = db.prepare(
      `SELECT id, display_name, description, readme, display_name_en, description_en, readme_en FROM assets WHERE id = ?`
    ).get(id) as {
      id: string; display_name: string; description: string; readme: string;
      display_name_en: string | null; description_en: string | null; readme_en: string | null;
    } | undefined;

    if (!asset) {
      results.push({ id, error: 'Asset not found' });
      continue;
    }

    const result: TranslateResultItem = { id, displayName: asset.display_name };

    try {
      // 1. Translate title + description
      const needTitle = force || !asset.display_name_en;
      const needDesc = force || !asset.description_en;

      if (needTitle || needDesc) {
        const { titleZh, descZh } = await translateTitleAndDesc(
          asset.display_name, asset.description
        );
        if (needTitle) result.titleZh = titleZh;
        if (needDesc) result.descZh = descZh;
        await sleep(DELAY_MS);
      }

      // 2. Translate README
      const needReadme = !skipReadme && (force || !asset.readme_en) && asset.readme;
      let readmeZh: string | null = null;

      if (needReadme) {
        readmeZh = await translateReadme(asset.readme);
        result.readmeTranslated = true;
      }

      // 3. Write to DB
      if (!dryRun && (result.titleZh || result.descZh || readmeZh)) {
        const updateStmt = db.prepare(`
          UPDATE assets SET
            display_name_en = COALESCE(@display_name_en, display_name_en),
            description_en = COALESCE(@description_en, description_en),
            readme_en = COALESCE(@readme_en, readme_en),
            display_name = COALESCE(@display_name_zh, display_name),
            description = COALESCE(@description_zh, description),
            readme = COALESCE(@readme_zh, readme),
            updated_at = @updated_at
          WHERE id = @id
        `);

        updateStmt.run({
          id: asset.id,
          display_name_en: result.titleZh ? asset.display_name : null,
          description_en: result.descZh ? asset.description : null,
          readme_en: readmeZh ? asset.readme : null,
          display_name_zh: result.titleZh || null,
          description_zh: result.descZh || null,
          readme_zh: readmeZh,
          updated_at: new Date().toISOString().split('T')[0],
        });
      }

      results.push(result);
    } catch (err: any) {
      results.push({ id, displayName: asset.display_name, error: err.message?.slice(0, 200) });
    }
  }

  const success = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;

  return NextResponse.json({
    ok: true,
    dryRun,
    summary: { total: ids.length, success, failed },
    results,
  });
}
