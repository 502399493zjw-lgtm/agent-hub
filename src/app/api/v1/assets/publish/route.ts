import { NextRequest, NextResponse } from 'next/server';
import { createAsset, getAssetById, updateAsset, findUserById, getDb } from '@/lib/db';
import { addCoins, USER_REP_EVENTS, SHRIMP_COIN_EVENTS } from '@/lib/db/economy';
import { authenticateAndCheckBan, unauthorizedResponse, bannedResponse, inviteRequiredResponse } from '@/lib/api-auth';
import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import { execSync } from 'child_process';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const PACKAGES_DIR = path.join(process.cwd(), 'data', 'packages');

export const dynamic = 'force-dynamic';

// ─── Publish validation helpers ─────────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const fm: Record<string, string> = {};
  let body = content;
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  if (match) {
    for (const line of match[1].split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const kv = trimmed.match(/^([\w-]+)\s*:\s*(.*)/);
      if (kv) {
        let val = kv[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fm[kv[1]] = val;
      }
    }
    body = match[2].trim();
  }
  return { frontmatter: fm, body };
}

function extractFromReadme(content: string): { title: string; description: string } {
  let title = '', description = '';
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!title) {
      const m = t.match(/^#\s+(.+)$/);
      if (m) { title = m[1].trim(); continue; }
    }
    if (title && !description && t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('>')) {
      description = t;
      break;
    }
  }
  return { title, description };
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  missing?: string[];
  hint?: string;
  required?: Record<string, string>;
  extractedDisplayName?: string;
  extractedDescription?: string;
  extractedReadme?: string;
}

function validatePackageByType(
  type: string,
  textFiles: Map<string, string>,
  metadata: { displayName?: string; description?: string; readme?: string },
): ValidationResult {
  const missing: string[] = [];
  let dn = metadata.displayName || '';
  let desc = metadata.description || '';
  let readme = metadata.readme || '';

  switch (type) {
    case 'skill': {
      const skillMd = textFiles.get('SKILL.md');
      if (!skillMd) {
        return {
          valid: false, error: '发布校验失败：缺少 SKILL.md', missing: ['SKILL.md'],
          hint: '请创建 SKILL.md，包含 frontmatter（name, description）和技能说明正文。',
          required: { 'SKILL.md': '❌' },
        };
      }
      const { frontmatter: fm, body } = parseFrontmatter(skillMd);
      if (!fm.name && !fm.displayName && !fm['display-name']) missing.push('SKILL.md frontmatter: name');
      if (!fm.description) missing.push('SKILL.md frontmatter: description');
      if (!body) missing.push('SKILL.md 正文（frontmatter 之后的内容）');
      if (missing.length) {
        return {
          valid: false, error: 'SKILL.md 信息不完整', missing,
          hint: 'SKILL.md 需要 frontmatter（name, description）和正文。',
          required: {
            'SKILL.md': '✅',
            name: fm.name || fm.displayName || fm['display-name'] ? '✅' : '❌',
            description: fm.description ? '✅' : '❌',
            body: body ? '✅' : '❌',
          },
        };
      }
      dn = dn || fm.displayName || fm['display-name'] || fm.name;
      desc = desc || fm.description;
      readme = readme || body;
      break;
    }

    case 'plugin':
    case 'channel': {
      const pj = textFiles.get('openclaw.plugin.json');
      if (!pj) {
        return {
          valid: false, error: `缺少 openclaw.plugin.json`, missing: ['openclaw.plugin.json'],
          hint: `${type} 类型必须包含 openclaw.plugin.json。`,
        };
      }
      let pd: Record<string, unknown>;
      try { pd = JSON.parse(pj); } catch {
        return { valid: false, error: 'openclaw.plugin.json JSON 格式错误', missing: ['valid JSON'] };
      }
      if (!pd.id) missing.push('openclaw.plugin.json: id');
      if (type === 'channel' && (!Array.isArray(pd.channels) || !(pd.channels as unknown[]).length)) {
        missing.push('openclaw.plugin.json: channels 数组');
      }
      const rm = textFiles.get('README.md');
      if (!rm) missing.push('README.md');
      if (missing.length) {
        return {
          valid: false, error: `发布校验失败：${missing.join('、')}`, missing,
          hint: `${type} 需要 openclaw.plugin.json（含 id${type === 'channel' ? ' + channels' : ''}）和 README.md。`,
        };
      }
      const ri = extractFromReadme(rm!);
      dn = dn || (pd.name as string) || ri.title;
      desc = desc || (pd.description as string) || ri.description;
      readme = readme || rm!;
      if (!dn) missing.push('displayName');
      if (!desc) missing.push('description');
      if (missing.length) {
        return {
          valid: false, error: `无法提取 ${missing.join('、')}`, missing,
          hint: '请在 openclaw.plugin.json 添加 name/description，或确保 README.md 有标题和描述。',
        };
      }
      break;
    }

    case 'trigger':
    case 'experience': {
      const rm = textFiles.get('README.md');
      if (!rm) {
        return {
          valid: false, error: `缺少 README.md`, missing: ['README.md'],
          hint: `${type} 类型必须包含 README.md（标题 + 描述段落）。`,
        };
      }
      const ri = extractFromReadme(rm);
      if (!ri.title) missing.push('README.md 标题（# xxx）');
      if (!ri.description) missing.push('README.md 描述段落');
      if (missing.length) {
        return {
          valid: false, error: 'README.md 信息不完整', missing,
          hint: 'README.md 需要标题行（# 名称）和描述段落。',
          required: { 'README.md': '✅', title: ri.title ? '✅' : '❌', description: ri.description ? '✅' : '❌' },
        };
      }
      dn = dn || ri.title;
      desc = desc || ri.description;
      readme = readme || rm;
      break;
    }
  }

  return { valid: true, extractedDisplayName: dn, extractedDescription: desc, extractedReadme: readme };
}

// ─── POST handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { auth: authResult, banned } = await authenticateAndCheckBan(request);
    if (!authResult) return unauthorizedResponse();
    if (banned) return bannedResponse();

    const dbUser = findUserById(authResult.userId);
    if (!dbUser?.invite_code) return inviteRequiredResponse();

    const formData = await request.formData();

    // Parse metadata JSON
    const metadataRaw = formData.get('metadata') as string | null;
    if (!metadataRaw) {
      return NextResponse.json({ success: false, error: 'Missing required field: metadata (JSON string)' }, { status: 400 });
    }

    let metadata: {
      name: string; displayName: string; type: string; description: string;
      tags?: string[]; version: string; longDescription?: string;
      category?: string; configSubtype?: string; readme?: string;
    };
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid metadata JSON' }, { status: 400 });
    }

    const { name, type, version } = metadata;
    // Only require name + type + version upfront; displayName/description can be extracted from package
    if (!name || !type || !version) {
      return NextResponse.json({ success: false, error: 'metadata must include: name, type, version' }, { status: 400 });
    }

    const validTypes = ['skill', 'experience', 'plugin', 'trigger', 'channel'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Collect uploaded files
    const uploadedFiles: { path: string; size: number; sha256: string; contentType: string; buffer: Buffer }[] = [];
    let packageFile: { buffer: Buffer; ext: string } | null = null;

    for (const [key, value] of formData.entries()) {
      if (key === 'metadata') continue;
      if (value instanceof File) {
        if (value.size > MAX_FILE_SIZE) {
          return NextResponse.json({ success: false, error: `File ${value.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` }, { status: 400 });
        }
        const buf = Buffer.from(await value.arrayBuffer());
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

        if (key === 'package') {
          const origName = value.name || 'package.tar.gz';
          const isZip = origName.endsWith('.zip') || origName.endsWith('.skill');
          const isTarGz = origName.endsWith('.tar.gz') || origName.endsWith('.tgz');
          if (!isZip && !isTarGz) {
            return NextResponse.json({ success: false, error: 'Package must be .tar.gz, .tgz, .zip, or .skill file' }, { status: 400 });
          }
          packageFile = { buffer: buf, ext: isZip ? (origName.endsWith('.skill') ? 'skill' : 'zip') : 'tar.gz' };
        }

        uploadedFiles.push({
          path: value.name || key,
          size: buf.length,
          sha256,
          contentType: value.type || 'application/octet-stream',
          buffer: buf,
        });
      }
    }

    // ─── Package is required ────────────────────────────────────────────
    if (!packageFile) {
      return NextResponse.json({
        success: false,
        error: 'missing_package',
        message: '发布资产必须包含文件包（.tar.gz / .tgz / .zip / .skill）。水产市场要求"发了就能用"。',
      }, { status: 400 });
    }

    // ─── Extract package + validate (single pass) ───────────────────────

    let packageFilesMetadata: { path: string; size: number; sha256: string; contentType: string }[] = [];
    const textFiles = new Map<string, string>();
    const TEXT_EXTS = ['.md', '.json', '.yaml', '.yml', '.txt', '.js', '.ts', '.py', '.sh'];

    if (packageFile) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclawmp-pkg-'));
      const tmpPkg = path.join(tmpDir, `pkg.${packageFile.ext}`);
      const extractDir = path.join(tmpDir, 'extracted');
      fs.mkdirSync(extractDir, { recursive: true });
      fs.writeFileSync(tmpPkg, packageFile.buffer);

      try {
        if (packageFile.ext === 'tar.gz') {
          try {
            execSync(`tar xzf "${tmpPkg}" -C "${extractDir}" --strip-components=1 2>/dev/null`, { stdio: 'pipe' });
          } catch {
            try { execSync(`tar xzf "${tmpPkg}" -C "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
          }
        } else {
          try { execSync(`unzip -o -q "${tmpPkg}" -d "${extractDir}" 2>/dev/null`, { stdio: 'pipe' }); } catch { /* ignore */ }
        }

        // Walk extracted directory: build file metadata + collect text contents
        const walkDir = (dir: string, prefix: string): void => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              walkDir(path.join(dir, entry.name), rel);
            } else if (entry.isFile()) {
              const fullPath = path.join(dir, entry.name);
              const buf = fs.readFileSync(fullPath);
              const sha = crypto.createHash('sha256').update(buf).digest('hex');
              const ext = path.extname(entry.name).toLowerCase();
              const ct = ext === '.md' ? 'text/markdown'
                : ext === '.json' ? 'application/json'
                : ext === '.js' || ext === '.ts' ? 'text/javascript'
                : ext === '.py' ? 'text/x-python'
                : ext === '.sh' ? 'text/x-shellscript'
                : ext === '.yaml' || ext === '.yml' ? 'text/yaml'
                : 'application/octet-stream';
              packageFilesMetadata.push({ path: rel, size: buf.length, sha256: sha, contentType: ct });

              // Collect text file contents for validation
              if (TEXT_EXTS.includes(ext)) {
                try { textFiles.set(rel, buf.toString('utf-8')); } catch { /* ignore */ }
              }
            }
          }
        };
        walkDir(extractDir, '');
      } finally {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
      }
    }

    // ─── Validate by type ───────────────────────────────────────────────

    const validation = validatePackageByType(type, textFiles, {
      displayName: metadata.displayName,
      description: metadata.description,
      readme: metadata.readme,
    });

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'publish_validation_failed',
        message: validation.error,
        missing: validation.missing,
        hint: validation.hint,
        required: validation.required,
      }, { status: 400 });
    }

    // Server-side enrichment: use extracted values when metadata didn't provide them
    const finalDisplayName = metadata.displayName || validation.extractedDisplayName || name;
    const finalDescription = metadata.description || validation.extractedDescription || '';
    const finalReadme = metadata.readme || validation.extractedReadme || '';

    // ─── Save to DB ─────────────────────────────────────────────────────

    const filesMetadata = packageFilesMetadata.length > 0
      ? packageFilesMetadata
      : uploadedFiles.filter(f => f.path !== (packageFile ? `pkg.${packageFile.ext}` : '')).map(f => ({ path: f.path, size: f.size, sha256: f.sha256, contentType: f.contentType }));

    const db = getDb();
    const existingAssets = db.prepare('SELECT id FROM assets WHERE name = ? AND author_id = ?').all(name, authResult.userId) as { id: string }[];

    let asset;

    if (existingAssets.length > 0) {
      const existingId = existingAssets[0].id;
      updateAsset(existingId, {
        displayName: finalDisplayName,
        description: finalDescription,
        version,
        tags: metadata.tags,
        category: metadata.category,
        longDescription: metadata.longDescription,
        readme: finalReadme,
        files: filesMetadata as unknown as Array<{ name: string; type: string }>,
      });
      asset = getAssetById(existingId)!;

      addCoins(authResult.userId, 'reputation', USER_REP_EVENTS.publish_version, 'publish_version', existingId);
      addCoins(authResult.userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_version, 'publish_version', existingId);
    } else {
      asset = createAsset({
        name,
        displayName: finalDisplayName,
        type,
        description: finalDescription,
        version,
        authorId: authResult.userId,
        authorName: dbUser.name,
        authorAvatar: dbUser.avatar,
        tags: metadata.tags,
        category: metadata.category,
        longDescription: metadata.longDescription,
        readme: finalReadme,
        configSubtype: metadata.configSubtype,
      });
      if (filesMetadata.length > 0) {
        updateAsset(asset.id, { files: filesMetadata as unknown as Array<{ name: string; type: string }> });
      }
    }

    // Save package file
    if (packageFile) {
      fs.mkdirSync(PACKAGES_DIR, { recursive: true });
      const packagePath = path.join(PACKAGES_DIR, `${asset.id}.${packageFile.ext}`);
      fs.writeFileSync(packagePath, packageFile.buffer);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: asset.id,
        name: asset.name,
        version: asset.version,
        files: filesMetadata,
        packageFile: packageFile ? `${asset.id}.${packageFile.ext}` : null,
      },
    }, { status: existingAssets.length > 0 ? 200 : 201 });
  } catch (err) {
    console.error('POST /api/v1/assets/publish error:', err instanceof Error ? err.message : 'Unknown');
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
