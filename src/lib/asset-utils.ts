// ─── Shared asset utilities ────────────────────────────────────────────────────
// Used by both /api/v1/assets/publish and /api/admin/import-github

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/** File extensions recognised as text (60+ common dev formats) */
export const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
  '.py', '.rb', '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp',
  '.lua', '.css', '.scss', '.less', '.html', '.htm', '.vue', '.svelte',
  '.swift', '.kt', '.scala', '.r', '.pl', '.php',
  '.sql', '.graphql', '.gql', '.proto', '.xml', '.csv',
  '.env', '.cfg', '.conf', '.ini', '.config', '.plist',
  '.makefile', '.cmake', '.dockerfile',
  '.gitignore', '.gitattributes', '.npmignore',
  '.editorconfig', '.prettierrc', '.eslintrc', '.lock',
]);

/** Well-known filenames that should be read as text regardless of extension */
export const KNOWN_FILENAMES = new Set([
  'LICENSE', 'LICENSE-MIT', 'LICENSE-APACHE',
  'Makefile', 'Dockerfile', 'Rakefile', 'Gemfile', 'Procfile', 'Vagrantfile',
  '.gitignore', '.npmignore', '.dockerignore',
  '.env', '.env.local', '.env.example',
]);

export const VALID_TYPES = ['skill', 'experience', 'plugin', 'trigger', 'channel'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  children?: FileTreeNode[];
}

export interface InferredMetadata {
  name?: string;
  displayName?: string;
  type?: string;
  description?: string;
  version?: string;
  tags?: string[];
  readme?: string;
}

export interface Frontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Find a file in the tree by name (case-insensitive, recursive).
 */
export function findFileInTree(tree: FileTreeNode[], targetName: string): FileTreeNode | undefined {
  const lowerTarget = targetName.toLowerCase();
  for (const node of tree) {
    if (node.type === 'file' && node.name.toLowerCase() === lowerTarget) {
      return node;
    }
    if (node.type === 'directory' && node.children) {
      const found = findFileInTree(node.children, targetName);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Convert kebab-case / snake_case to Title Case for display names.
 */
export function humanize(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse YAML-like frontmatter from a SKILL.md file.
 * Supports `---` delimited header with simple key: value pairs.
 */
export function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const headerBlock = match[1];
  const body = match[2].trim();
  const frontmatter: Record<string, string> = {};

  for (const line of headerBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kvMatch = trimmed.match(/^([\w-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      frontmatter[kvMatch[1]] = kvMatch[2].trim().replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, body };
}

/**
 * Check if a filename should be treated as a text file.
 */
export function isTextFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || KNOWN_FILENAMES.has(filename);
}

/**
 * Sort file tree nodes: directories first, then alphabetical.
 */
export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Infer asset metadata from an extracted file tree.
 *
 * Priority:
 * 1. SKILL.md frontmatter → type=skill, parse name/displayName/description/version/tags
 * 2. openclaw.plugin.json → type=channel (if channels array present) or plugin
 * 3. README.md → fallback displayName (H1) and description (first paragraph)
 */
export function inferMetadataFromFiles(tree: FileTreeNode[]): InferredMetadata {
  const result: InferredMetadata = {};

  const skillMd = findFileInTree(tree, 'SKILL.md');
  const pluginJson = findFileInTree(tree, 'openclaw.plugin.json');
  const packageJson = findFileInTree(tree, 'package.json');
  const readmeMd = findFileInTree(tree, 'README.md');

  // ── Determine type ──────────────────────────────────────────────────────
  if (skillMd) {
    result.type = 'skill';
  } else if (pluginJson && pluginJson.content) {
    try {
      const pluginData = JSON.parse(pluginJson.content);
      result.type = Array.isArray(pluginData.channels) && pluginData.channels.length > 0
        ? 'channel'
        : 'plugin';
    } catch {
      result.type = 'plugin';
    }
  }

  // ── Extract metadata based on type ──────────────────────────────────────
  if (result.type === 'skill' && skillMd?.content) {
    const { frontmatter, body } = parseFrontmatter(skillMd.content);
    result.description = frontmatter.description || undefined;
    result.displayName = frontmatter.displayName || frontmatter['display-name'] || frontmatter.name || undefined;
    result.name = frontmatter.name || undefined;
    result.version = frontmatter.version || undefined;

    if (frontmatter.tags) {
      result.tags = frontmatter.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    if (body) {
      result.readme = body;
    }
  } else if ((result.type === 'channel' || result.type === 'plugin') && pluginJson?.content) {
    try {
      const pluginData = JSON.parse(pluginJson.content);
      let pkgData: Record<string, unknown> = {};

      if (packageJson?.content) {
        try {
          pkgData = JSON.parse(packageJson.content);
        } catch { /* ignore bad package.json */ }
      }

      result.description = (pluginData.description || pkgData.description || undefined) as string | undefined;
      result.name = (pluginData.id || (pkgData.name as string || '').replace(/^@[^/]+\//, '') || undefined) as string | undefined;
      result.displayName = (pluginData.name || (pkgData.name ? humanize((pkgData.name as string).replace(/^@[^/]+\//, '')) : undefined)) as string | undefined;
      result.version = (pluginData.version || pkgData.version || undefined) as string | undefined;

      if (readmeMd?.content) {
        result.readme = readmeMd.content;
      } else if (pluginData.configSchema && typeof pluginData.configSchema === 'object') {
        const title = result.displayName || result.name || 'Plugin';
        const desc = result.description || '';
        let configSection = '';
        const properties = pluginData.configSchema.properties;

        if (properties && typeof properties === 'object') {
          configSection = '## Configuration\n\n';
          for (const [key, value] of Object.entries(properties)) {
            const propDesc = (value as { description?: string }).description
              ? ` — ${(value as { description?: string }).description}`
              : '';
            configSection += `- **${key}**${propDesc}\n`;
          }
        }

        result.readme = `# ${title}\n\n${desc}${configSection ? '\n\n' + configSection : ''}`;
      }
    } catch { /* ignore parse errors */ }
  }

  // ── README.md fallback for any type ─────────────────────────────────────
  if ((!result.type || result.type === 'trigger' || result.type === 'experience') && readmeMd?.content) {
    if (!result.readme) {
      result.readme = readmeMd.content;
    }

    if (!result.displayName) {
      const h1Match = readmeMd.content.match(/^#\s+(.+)$/m);
      if (h1Match) {
        result.displayName = h1Match[1].trim();
      }
    }

    if (!result.description) {
      for (const line of readmeMd.content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
        result.description = trimmed;
        break;
      }
    }
  }

  // ── Humanize fallback for displayName ───────────────────────────────────
  if (!result.displayName && result.name) {
    result.displayName = humanize(result.name);
  }

  return result;
}
