// ─── 共享的资产工具函数（用于 /api/v1/assets/publish 与 /api/admin/import-github）───────────────
// 本文件封装了「文件树遍历、文本文件判断、Frontmatter 解析、元数据推断」等通用逻辑。

// ─── 常量 ───────────────────────────────────────────────────────────────────────

// 最大单文件体积（20MB）—— 用于限制上传/解析时的文本读取等场景
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * 被识别为「纯文本」的文件扩展名集合（60+ 常见开发格式）
 * - 用于决定是否尝试把文件内容当作文本加载/展示
 */
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

/**
 * 一些「知名文件名」即使没有扩展名，也应视为文本读取
 */
export const KNOWN_FILENAMES = new Set([
  'LICENSE', 'LICENSE-MIT', 'LICENSE-APACHE',
  'Makefile', 'Dockerfile', 'Rakefile', 'Gemfile', 'Procfile', 'Vagrantfile',
  '.gitignore', '.npmignore', '.dockerignore',
  '.env', '.env.local', '.env.example',
]);

// 平台支持的资产类型（推断时会用到）
export const VALID_TYPES = ['skill', 'experience', 'plugin', 'trigger', 'channel'];

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

// 文件树节点：既可以是文件也可以是目录
export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;      // 可选：文件大小（字节）
  content?: string;   // 可选：文件文本内容（仅文本文件才会有）
  children?: FileTreeNode[]; // 可选：目录子节点
}

// 从文件中「推断」出来的元数据结构
export interface InferredMetadata {
  name?: string;
  displayName?: string;
  type?: string;
  description?: string;
  version?: string;
  tags?: string[];
  readme?: string; // 可能来源于 README.md 或 SKILL.md 的正文
}

// Frontmatter 解析结果：头部键值对 + 正文
export interface Frontmatter {
  frontmatter: Record<string, string>;
  body: string;
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

/**
 * 在文件树中按名称查找文件（不区分大小写，递归）
 * @param tree 根节点数组
 * @param targetName 目标文件名（例如 'README.md'）
 */
export function findFileInTree(tree: FileTreeNode[], targetName: string): FileTreeNode | undefined {
  const lowerTarget = targetName.toLowerCase();
  for (const node of tree) {
    // 命中文件名：直接返回
    if (node.type === 'file' && node.name.toLowerCase() === lowerTarget) {
      return node;
    }
    // 若为目录则递归向下查找
    if (node.type === 'directory' && node.children) {
      const found = findFileInTree(node.children, targetName);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * 将 kebab-case / snake_case 转换为 Title Case（仅用于展示名美化）
 * 例如："my-plugin_name" → "My Plugin Name"
 */
export function humanize(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * 解析类似 YAML 的 Frontmatter（针对 SKILL.md）
 * 支持形如：
 * ---\n
 * key: value\n
 * ...\n
 * ---\n
 * 正文内容
 */
export function parseFrontmatter(content: string): Frontmatter {
  // 使用正则切分头部与正文；头部与正文之间以 --- 分隔
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
  if (!match) {
    // 无 Frontmatter，则全部视为正文
    return { frontmatter: {}, body: content };
  }

  const headerBlock = match[1]; // 头部键值对
  const body = match[2].trim(); // 正文
  const frontmatter: Record<string, string> = {};

  // 逐行解析 key: value（忽略空行与以 # 开头的注释行）
  for (const line of headerBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const kvMatch = trimmed.match(/^([\w-]+)\s*:\s*(.*)/);
    if (kvMatch) {
      // 去掉可能包裹的引号
      frontmatter[kvMatch[1]] = kvMatch[2].trim().replace(/^[["']|[["']]$/g, '');
    }
  }

  return { frontmatter, body };
}

/**
 * 判断一个文件名是否应作为文本文件处理
 * 逻辑：后缀在 TEXT_EXTENSIONS 中，或文件名在 KNOWN_FILENAMES 中
 */
export function isTextFile(filename: string): boolean {
  const ext = '.' + filename.split('.').pop()?.toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || KNOWN_FILENAMES.has(filename);
}

/**
 * 排序文件树节点：目录在前，随后按名称字典序排序
 */
export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 从解压后的文件树中推断资产元数据
 * 优先级：
 * 1) SKILL.md 的 Frontmatter → 直接视为 type=skill，并解析 name/displayName/description/version/tags
 * 2) openclaw.plugin.json → 如果包含 channels 数组则 type=channel，否则 type=plugin
 * 3) README.md → 兜底：H1 作为 displayName，首段文本作为 description，全文作为 readme
 */
export function inferMetadataFromFiles(tree: FileTreeNode[]): InferredMetadata {
  const result: InferredMetadata = {};

  // 预先尝试定位可能用到的文件
  const skillMd = findFileInTree(tree, 'SKILL.md');
  const pluginJson = findFileInTree(tree, 'openclaw.plugin.json');
  const packageJson = findFileInTree(tree, 'package.json');
  const readmeMd = findFileInTree(tree, 'README.md');

  // ── 推断类型 ────────────────────────────────────────────────────────────
  if (skillMd) {
    // 只要存在 SKILL.md，则直接认为是 skill 类型
    result.type = 'skill';
  } else if (pluginJson && pluginJson.content) {
    // 存在 openclaw.plugin.json，则解析其 channels 字段来区分 channel / plugin
    try {
      const pluginData = JSON.parse(pluginJson.content);
      result.type = Array.isArray(pluginData.channels) && pluginData.channels.length > 0
        ? 'channel'
        : 'plugin';
    } catch {
      // JSON 解析失败时，降级为 plugin 类型
      result.type = 'plugin';
    }
  }

  // ── 根据类型抽取更丰富的元数据 ─────────────────────────────────────────
  if (result.type === 'skill' && skillMd?.content) {
    // 从 SKILL.md 的 frontmatter + 正文推断
    const { frontmatter, body } = parseFrontmatter(skillMd.content);
    result.description = frontmatter.description || undefined;
    result.displayName = frontmatter.displayName || frontmatter['display-name'] || frontmatter.name || undefined;
    result.name = frontmatter.name || undefined;
    result.version = frontmatter.version || undefined;

    // tags: 形如 "a, b, c" → ["a","b","c"]
    if (frontmatter.tags) {
      result.tags = frontmatter.tags.split(',').map((t) => t.trim()).filter(Boolean);
    }

    // body 作为 readme（去掉 frontmatter 的正文部分）
    if (body) {
      result.readme = body;
    }
  } else if ((result.type === 'channel' || result.type === 'plugin') && pluginJson?.content) {
    // 从 openclaw.plugin.json（以及可选的 package.json）推断
    try {
      const pluginData = JSON.parse(pluginJson.content);
      let pkgData: Record<string, unknown> = {};

      // 尝试解析 package.json 以补充 name/description/version
      if (packageJson?.content) {
        try {
          pkgData = JSON.parse(packageJson.content);
        } catch { /* 忽略无效的 package.json */ }
      }

      // 描述信息：优先 plugin.json.description，其次 package.json.description
      result.description = (pluginData.description || pkgData.description || undefined) as string | undefined;
      // 机器名：优先 plugin.json.id，其次 package.json.name 去除 scope（@scope/pkg → pkg）
      result.name = (pluginData.id || (pkgData.name as string || '').replace(/^@[^/]+\//, '') || undefined) as string | undefined;
      // 展示名：优先 plugin.json.name，其次根据 package.json.name 美化
      result.displayName = (pluginData.name || (pkgData.name ? humanize((pkgData.name as string).replace(/^@[^/]+\//, '')) : undefined)) as string | undefined;
      // 版本号：优先 plugin.json.version，其次 package.json.version
      result.version = (pluginData.version || pkgData.version || undefined) as string | undefined;

      // README 优先读取 README.md；否则基于 configSchema 生成一个简单的 README 片段
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
    } catch { /* 忽略 plugin.json 解析错误 */ }
  }

  // ── README.md 兜底逻辑（适用于未明确类型或 experience/trigger 等）────────────────
  if ((!result.type || result.type === 'trigger' || result.type === 'experience') && readmeMd?.content) {
    // 若前面未写入 readme，这里用 README.md 填充
    if (!result.readme) {
      result.readme = readmeMd.content;
    }

    // 若还没有展示名：尝试从 README 的 H1 获取（第一行形如 "# Title"）
    if (!result.displayName) {
      const h1Match = readmeMd.content.match(/^#\s+(.+)$/m);
      if (h1Match) {
        result.displayName = h1Match[1].trim();
      }
    }

    // 若还没有描述：从 README 的首个非空非标题行取一段文字
    if (!result.description) {
      for (const line of readmeMd.content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
        result.description = trimmed;
        break;
      }
    }
  }

  // ── 展示名兜底：若有机器名 name，则美化后作为 displayName ───────────────────────
  if (!result.displayName && result.name) {
    result.displayName = humanize(result.name);
  }

  return result;
}
