# Publish Format Spec Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce per-type publish validation (entry files + displayName + description + README/SKILL.md content) with hard block, and fix install CLI to match new conventions.

**Architecture:** Server-side validation in publish API extracts package → validates by type → rejects with structured error. CLI-side validation mirrors server checks before upload. Install CLI drops fallback generation, routes plugin/channel to extensions/.

**Tech Stack:** Next.js API route (TypeScript), Node.js CLI (CommonJS)

**Design doc:** `docs/plans/2026-02-23-publish-format-spec-design.md`

---

## Task 1: Server-side publish validation (single extraction pass)

**Files:**
- Modify: `src/app/api/v1/assets/publish/route.ts`

**Step 1: Add validation helpers after imports (after line 10)**

Add `parseFrontmatter`, `extractFromReadme`, and `validatePackageByType` functions:

```typescript
// --- Publish validation ---

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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
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
    if (!title) { const m = t.match(/^#\s+(.+)$/); if (m) { title = m[1].trim(); continue; } }
    if (title && !description && t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('>')) { description = t; break; }
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
  metadata: { displayName?: string; description?: string; readme?: string }
): ValidationResult {
  const missing: string[] = [];
  let dn = metadata.displayName || '';
  let desc = metadata.description || '';
  let readme = metadata.readme || '';

  switch (type) {
    case 'skill': {
      const skillMd = textFiles.get('SKILL.md');
      if (!skillMd) return { valid: false, error: '发布校验失败：缺少 SKILL.md', missing: ['SKILL.md'], hint: '请创建 SKILL.md，包含 frontmatter（name, description）和技能说明正文。', required: { 'SKILL.md': '❌' } };
      const { frontmatter: fm, body } = parseFrontmatter(skillMd);
      if (!fm.name && !fm.displayName) missing.push('SKILL.md frontmatter: name');
      if (!fm.description) missing.push('SKILL.md frontmatter: description');
      if (!body) missing.push('SKILL.md 正文（frontmatter 之后的内容）');
      if (missing.length) return { valid: false, error: 'SKILL.md 信息不完整', missing, hint: 'SKILL.md 需要 frontmatter（name, description）和正文。', required: { 'SKILL.md': '✅', name: fm.name || fm.displayName ? '✅' : '❌', description: fm.description ? '✅' : '❌', body: body ? '✅' : '❌' } };
      dn = dn || fm.displayName || fm['display-name'] || fm.name;
      desc = desc || fm.description;
      readme = readme || body;
      break;
    }
    case 'plugin':
    case 'channel': {
      const pj = textFiles.get('openclaw.plugin.json');
      if (!pj) return { valid: false, error: `缺少 openclaw.plugin.json`, missing: ['openclaw.plugin.json'], hint: `${type} 类型必须包含 openclaw.plugin.json。` };
      let pd: Record<string, unknown>;
      try { pd = JSON.parse(pj); } catch { return { valid: false, error: 'openclaw.plugin.json JSON 格式错误', missing: ['valid JSON'] }; }
      if (!pd.id) missing.push('openclaw.plugin.json: id');
      if (type === 'channel' && (!Array.isArray(pd.channels) || !(pd.channels as unknown[]).length)) missing.push('openclaw.plugin.json: channels 数组');
      const rm = textFiles.get('README.md');
      if (!rm) missing.push('README.md');
      if (missing.length) return { valid: false, error: `发布校验失败：${missing.join('、')}`, missing, hint: `${type} 需要 openclaw.plugin.json（含 id${type === 'channel' ? ' + channels' : ''}）和 README.md。` };
      const ri = extractFromReadme(rm!);
      dn = dn || (pd.name as string) || ri.title;
      desc = desc || (pd.description as string) || ri.description;
      readme = readme || rm!;
      if (!dn) missing.push('displayName');
      if (!desc) missing.push('description');
      if (missing.length) return { valid: false, error: `无法提取 ${missing.join('、')}`, missing, hint: '请在 openclaw.plugin.json 添加 name/description，或确保 README.md 有标题和描述。' };
      break;
    }
    case 'trigger':
    case 'experience': {
      const rm = textFiles.get('README.md');
      if (!rm) return { valid: false, error: `缺少 README.md`, missing: ['README.md'], hint: `${type} 类型必须包含 README.md（标题 + 描述段落）。` };
      const ri = extractFromReadme(rm);
      if (!ri.title) missing.push('README.md 标题（# xxx）');
      if (!ri.description) missing.push('README.md 描述段落');
      if (missing.length) return { valid: false, error: 'README.md 信息不完整', missing, hint: 'README.md 需要标题行（# 名称）和描述段落。', required: { 'README.md': '✅', title: ri.title ? '✅' : '❌', description: ri.description ? '✅' : '❌' } };
      dn = dn || ri.title;
      desc = desc || ri.description;
      readme = readme || rm;
      break;
    }
  }
  return { valid: true, extractedDisplayName: dn, extractedDescription: desc, extractedReadme: readme };
}
```

**Step 2: Merge extraction + validation into single pass**

Replace the current walkDir block (lines ~88-130) with a version that also collects `textFiles`:

```typescript
    let packageFilesMetadata: { path: string; size: number; sha256: string; contentType: string }[] = [];
    const textFiles = new Map<string, string>();

    if (packageFile) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclawmp-pkg-'));
      // ... existing extraction code ...
      // Inside walkDir, after computing sha/ct, add:
      //   const TEXT_EXTS = ['.md','.json','.yaml','.yml','.txt','.js','.ts','.py','.sh'];
      //   if (TEXT_EXTS.includes(ext)) { try { textFiles.set(rel, buf.toString('utf-8')); } catch {} }
      // ... rest of walkDir ...
    }

    // Validate
    const validation = validatePackageByType(type, textFiles, { displayName, description, readme: metadata.readme });
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: 'publish_validation_failed', message: validation.error, missing: validation.missing, hint: validation.hint, required: validation.required }, { status: 400 });
    }

    // Use extracted values as enrichment
    const finalDisplayName = displayName || validation.extractedDisplayName || name;
    const finalDescription = description || validation.extractedDescription || '';
    const finalReadme = metadata.readme || validation.extractedReadme || '';
```

Then use `finalDisplayName`, `finalDescription`, `finalReadme` in createAsset/updateAsset calls.

**Step 3: Remove 'template' from validTypes (line ~51)**

```typescript
    const validTypes = ['skill', 'experience', 'plugin', 'trigger', 'channel'];
```

**Step 4: Relax initial metadata check — only require name + type + version**

```typescript
    if (!name || !type || !version) {
      return NextResponse.json({ success: false, error: 'metadata must include: name, type, version' }, { status: 400 });
    }
```

**Step 5: Commit**

```bash
cd ~/.openclaw/workspace/agent-hub
git add src/app/api/v1/assets/publish/route.ts
git commit -m "feat: per-type publish validation with hard block + single extraction pass"
```

---

## Task 2: CLI publish validation

**Files:**
- Modify: `~/.agents/skills/openclawmp/scripts/lib/commands/publish.js`

**Step 1: Add `validateForPublish` function after `extractMetadata` (~line 105)**

```javascript
function validateForPublish(skillDir, type, meta) {
  const errors = [];
  switch (type) {
    case 'skill': {
      const p = path.join(skillDir, 'SKILL.md');
      if (!fs.existsSync(p)) { errors.push('缺少 SKILL.md'); break; }
      const { frontmatter, body } = parseFrontmatter(fs.readFileSync(p, 'utf-8'));
      if (!frontmatter.name && !frontmatter.displayName) errors.push('SKILL.md frontmatter 缺少 name');
      if (!frontmatter.description) errors.push('SKILL.md frontmatter 缺少 description');
      if (!body.trim()) errors.push('SKILL.md 正文为空');
      break;
    }
    case 'plugin':
    case 'channel': {
      const pj = path.join(skillDir, 'openclaw.plugin.json');
      if (!fs.existsSync(pj)) { errors.push(`缺少 openclaw.plugin.json`); break; }
      try {
        const d = JSON.parse(fs.readFileSync(pj, 'utf-8'));
        if (!d.id) errors.push('openclaw.plugin.json 缺少 id');
        if (type === 'channel' && (!Array.isArray(d.channels) || !d.channels.length)) errors.push('openclaw.plugin.json 缺少 channels');
      } catch { errors.push('openclaw.plugin.json JSON 格式错误'); break; }
      if (!fs.existsSync(path.join(skillDir, 'README.md'))) errors.push('缺少 README.md');
      if (!meta.displayName || !meta.description) errors.push('无法提取 displayName/description');
      break;
    }
    case 'trigger':
    case 'experience': {
      const rp = path.join(skillDir, 'README.md');
      if (!fs.existsSync(rp)) { errors.push('缺少 README.md'); break; }
      const c = fs.readFileSync(rp, 'utf-8');
      let hasTitle = false, hasDesc = false;
      for (const l of c.split('\n')) {
        const t = l.trim();
        if (!hasTitle && /^#\s+.+/.test(t)) { hasTitle = true; continue; }
        if (hasTitle && !hasDesc && t && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('>')) { hasDesc = true; break; }
      }
      if (!hasTitle) errors.push('README.md 缺少标题（# xxx）');
      if (!hasDesc) errors.push('README.md 缺少描述段落');
      break;
    }
  }
  return { valid: !errors.length, errors };
}
```

**Step 2: Call validation in `run()` before preview**

Insert after type detection, before the preview block:

```javascript
  const { valid, errors: valErrors } = validateForPublish(skillDir, meta.type, meta);
  if (!valid) {
    console.log('');
    err('发布校验失败：');
    for (const e of valErrors) console.log(`  ${c('red', '✗')} ${e}`);
    console.log('');
    info('请补全以上内容后重新发布。');
    process.exit(1);
  }
```

**Step 3: Commit**

---

## Task 3: Fix install CLI

**Files:**
- Modify: `~/.agents/skills/openclawmp/scripts/lib/config.js` (line ~28)
- Modify: `~/.agents/skills/openclawmp/scripts/lib/commands/install.js`

**Step 1: Update ASSET_TYPES in config.js**

```javascript
const ASSET_TYPES = {
  skill:      'skills',
  plugin:     'extensions',
  trigger:    'triggers',
  channel:    'extensions',
  experience: 'experiences',
};
```

**Step 2: Remove `generateSkillMd` function from install.js** (lines ~91-109)

Delete entire function.

**Step 3: Replace fallback block with error**

Replace:
```javascript
  if (!hasPackage) {
    info('No package available, generating from metadata...');
    generateSkillMd(asset, targetDir);
    console.log('  Generated: SKILL.md from metadata');
  }
```

With:
```javascript
  if (!hasPackage) {
    try { fs.rmSync(targetDir, { recursive: true, force: true }); } catch {}
    err('该资产没有可安装的 package。');
    console.log(`  请在水产市场查看详情：${config.getApiBase()}/asset/${asset.id}`);
    process.exit(1);
  }
```

**Step 4: Update `showPostInstallHints`**

```javascript
function showPostInstallHints(type, slug, targetDir) {
  switch (type) {
    case 'skill':
      console.log(`   ${c('green', 'Ready!')} Will be loaded in the next agent session.`);
      break;
    case 'plugin':
      console.log(`   ${c('yellow', 'Requires restart:')} openclaw gateway restart`);
      break;
    case 'channel':
      console.log(`   ${c('yellow', 'Requires config:')} Set credentials in openclaw.json, then restart`);
      break;
    case 'trigger':
      console.log(`   ${c('yellow', 'Manual setup:')} Read README.md for cron/heartbeat configuration`);
      console.log(`   ${c('dim', `cat ${targetDir}/README.md`)}`);
      break;
    case 'experience':
      console.log(`   ${c('yellow', 'Reference:')} Read README.md for setup instructions`);
      console.log(`   ${c('dim', `cat ${targetDir}/README.md`)}`);
      break;
  }
}
```

Update call site to pass `targetDir`.

**Step 5: Commit**

---

## Task 4: Update SKILL.md documentation

**Files:**
- Modify: `~/.agents/skills/openclawmp/SKILL.md`

**Step 1: Update 发布规范 section**

Add per-type publish requirements table and validation rules.

**Step 2: Update install behavior docs**

- plugin/channel → `~/.openclaw/extensions/`
- No fallback generation
- trigger/experience → read README

**Step 3: Commit**

---

## Task 5: TypeScript check + local test

**Step 1: Type check**

```bash
cd ~/.openclaw/workspace/agent-hub && npx tsc --noEmit
```

**Step 2: Test happy path** (valid skill publish)

**Step 3: Test rejection paths** (missing SKILL.md, missing README, missing plugin.json)

**Step 4: Fix any issues, commit**

```bash
git add -A && git commit -m "fix: publish format spec final adjustments"
```

---

## File change summary

| File | Change |
|------|--------|
| `src/app/api/v1/assets/publish/route.ts` | +validatePackageByType, single extraction, server-side enrichment, remove 'template', relax initial check |
| `scripts/lib/commands/publish.js` (CLI) | +validateForPublish pre-check |
| `scripts/lib/commands/install.js` (CLI) | Remove generateSkillMd, error on no-package, update hints |
| `scripts/lib/config.js` (CLI) | plugin/channel → extensions/ |
| `SKILL.md` (openclawmp skill) | Update publish spec + install docs |
