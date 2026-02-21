# Asset Schema Reference

> v2.1 | 2026-02-21 更新，与实际 DB 和 API 实现对齐

## TypeScript 类型定义

```typescript
type AssetType = 'skill' | 'channel' | 'plugin' | 'trigger' | 'config' | 'template';

interface Asset {
  id: string;                    // 自动生成：类型前缀 + 随机码（如 s-abc123, tr-gotegm）
  name: string;                  // 包名，小写+连字符（如 web-search）
  displayName: string;           // 显示名称（如 🔍 Web Search）
  type: AssetType;               // 资产类型
  author: {
    id: string;                  // 作者 ID（如 xiaoyue, u1）
    name: string;                // 作者名（如 小跃）
    avatar: string;              // 头像（emoji 或 URL，如 ⚡）
  };
  description: string;           // 一句话简介（≤200 字）
  longDescription: string;       // 详细描述
  version: string;               // 语义版本号（如 2.1.0）
  downloads: number;             // 下载量
  rating: number;                // 评分（0-5）
  ratingCount: number;           // 评分人数
  tags: string[];                // 标签数组（最多 5 个）
  category: string;              // 分类
  createdAt: string;             // 创建日期（YYYY-MM-DD）
  updatedAt: string;             // 更新日期
  installCommand: string;        // 安装命令（自动生成，格式：seafood-market install <type>/@<author>/<name>）
  readme: string;                // README 内容（Markdown）
  versions: VersionEntry[];      // 版本历史
  dependencies: string[];        // 依赖的资产 ID
  compatibility: Compatibility;  // 兼容性信息
  issueCount: number;            // Issue 数
  configSubtype?: 'routing' | 'model' | 'persona' | 'scope';  // Config 子类型
  hubScore?: number;             // Hub Score（0-100）
  hubScoreBreakdown?: {
    downloadScore: number;       // 下载热度分（0-100）
    maintenanceScore: number;    // 维护活跃分（0-100）
    reputationScore: number;     // 口碑声誉分（0-100）
  };
  upgradeRate?: number;          // 升级率（%）
  files?: FileNode[];            // 文件树（展示用）
}

interface VersionEntry {
  version: string;
  changelog: string;
  date: string;
}

interface Compatibility {
  models: string[];              // 支持的模型
  platforms: string[];           // 支持的平台
  frameworks: string[];          // 支持的框架
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  content?: string;
  children?: FileNode[];
}
```

## 数据库 Schema（SQLite，实际生产版本）

```sql
CREATE TABLE IF NOT EXISTS assets (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN ('skill','channel','plugin','trigger','config','template')),
  author_id        TEXT NOT NULL DEFAULT '',
  author_name      TEXT NOT NULL DEFAULT '',
  author_avatar    TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  version          TEXT NOT NULL DEFAULT '1.0.0',
  downloads        INTEGER NOT NULL DEFAULT 0,
  rating           REAL NOT NULL DEFAULT 0,
  rating_count     INTEGER NOT NULL DEFAULT 0,
  tags             TEXT NOT NULL DEFAULT '[]',       -- JSON array
  category         TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT '',
  updated_at       TEXT NOT NULL DEFAULT '',
  install_command  TEXT NOT NULL DEFAULT '',
  readme           TEXT NOT NULL DEFAULT '',
  versions         TEXT NOT NULL DEFAULT '[]',       -- JSON array of VersionEntry
  dependencies     TEXT NOT NULL DEFAULT '[]',       -- JSON array of asset IDs
  issue_count      INTEGER NOT NULL DEFAULT 0,
  config_subtype   TEXT,                             -- persona/routing/model/scope
  hub_score        INTEGER NOT NULL DEFAULT 70,
  hub_score_breakdown TEXT NOT NULL DEFAULT '{}',    -- JSON object
  upgrade_rate     REAL NOT NULL DEFAULT 50,
  compatibility    TEXT NOT NULL DEFAULT '{}',       -- JSON Compatibility object
  files            TEXT NOT NULL DEFAULT '[]'        -- JSON FileNode array
);
```

**注意**：v2.1 相比 v1 的变化：
- 移除了 `fork_count` 和 `forked_from` 列（实际代码中未使用）
- 新增了 `author_id` 列（作者身份唯一标识）
- 新增了 `files` 列（文件树 JSON）

## 字段映射（TypeScript ↔ DB）

| TypeScript 字段 | DB 列名 | 类型转换 |
|----------------|---------|---------|
| `displayName` | `display_name` | 直接 |
| `longDescription` | `long_description` | 直接 |
| `ratingCount` | `rating_count` | 直接 |
| `installCommand` | `install_command` | 直接 |
| `issueCount` | `issue_count` | 直接 |
| `configSubtype` | `config_subtype` | `undefined` ↔ `NULL` |
| `hubScore` | `hub_score` | 直接 |
| `hubScoreBreakdown` | `hub_score_breakdown` | `JSON.stringify` ↔ `JSON.parse` |
| `upgradeRate` | `upgrade_rate` | 直接 |
| `tags` | `tags` | `JSON.stringify` ↔ `JSON.parse` |
| `versions` | `versions` | `JSON.stringify` ↔ `JSON.parse` |
| `dependencies` | `dependencies` | `JSON.stringify` ↔ `JSON.parse` |
| `compatibility` | `compatibility` | `JSON.stringify` ↔ `JSON.parse` |
| `files` | `files` | `JSON.stringify` ↔ `JSON.parse` |
| `author.id` | `author_id` | 对象拆分/组装 |
| `author.name` | `author_name` | 对象拆分/组装 |
| `author.avatar` | `author_avatar` | 对象拆分/组装 |

## ID 生成规则

| 资产类型 | 前缀 | 示例 |
|---------|------|------|
| skill | `s-` | `s-abc123` |
| config | `c-` | `c-x7k9m2` |
| plugin | `p-` | `p-def456` |
| trigger | `tr-` | `tr-gotegm` |
| channel | `ch-` | `ch-jk012` |
| template | `t-` | `t-mn345` |

## 分类列表

信息查询 / 开发工具 / 创意生成 / 数据处理 / 效率工具 / 语言处理 / 创意角色 / 教育辅导 / 商业顾问 / 趣味角色 / 存储引擎 / 通信集成 / 基础设施 / 安全认证 / 自动化 / 语音处理 / 事件触发 / 知识工作 / 内容创作 / 开发运维 / 客户服务 / Agent 模板

## 当前数据概况（2026-02-21）

- 总资产：38 条（36 seed + 2 手动发布）
- 小跃发布的资产：fs-event-trigger (tr-gotegm) + pdf-watcher (tr-1p4d6k)
- DB 文件：`data/hub.db`（首次启动自动 seed）
