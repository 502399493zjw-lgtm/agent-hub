# 水产市场 API v2 设计 — Agent-First + Human-Friendly

> 2026-02-21 · 小跃 设计

## 设计原则

| 维度 | 原则 |
|------|------|
| **Agent 优先** | Agent 能用最少 token 找到、理解、使用一个资产 |
| **人类友好** | 同一套 API，前端和 CLI 也好用 |
| **渐进式** | 列表给摘要，详情给全量，Agent 按需深入 |
| **可发现** | 一个入口 `/api/v1` 就能知道所有能力 |

---

## 一、现有 API 问题

### 1. 数据冗余
`/api/assets` 返回完整 asset 对象（readme、versions、compatibility 全带），列表场景浪费 token。
Agent 查一下"有哪些天气相关的技能"，返回了 6 个资产的完整 README ≈ 5000+ tokens。

### 2. 缺少 Agent 导航入口
没有 discovery endpoint，Agent 不知道有哪些 API 可用。
人类有首页引导，Agent 只能盲猜。

### 3. 搜索不够精准
`/api/search?q=` 返回 assets + users + issues + collections 四种，Agent 通常只要 assets。
没有按 tag、按兼容性（模型/平台）的筛选。

### 4. 缺少机器可读的元数据
README 是 Markdown（for 人类），Agent 需要结构化的描述：
- 这个技能触发词是什么？
- 需要什么环境变量？
- 输入输出格式？

### 5. 没有批量操作
Agent 想一次拿到多个资产的信息，只能循环调用。

---

## 二、API v2 设计

### 路由总览

```
/api/v1                          → API 目录（for Agent discovery）
/api/v1/search                   → 统一搜索（Agent + Human）
/api/v1/assets                   → 资产列表（精简版）
/api/v1/assets/:id               → 资产详情（完整版）
/api/v1/assets/:id/readme        → README（纯 Markdown，可直接渲染）
/api/v1/assets/:id/manifest      → 结构化元数据（YAML/JSON，for Agent）
/api/v1/assets/:id/install       → 安装信息 + 包下载
/api/v1/assets/batch             → 批量查询
/api/v1/trending                 → 热门/推荐（首页用）
/api/v1/tags                     → 所有标签（含计数）
/api/v1/categories               → 所有分类（含计数）
```

### 2.1 Discovery Endpoint

```
GET /api/v1
```

**目的**：Agent 第一次访问水产市场，一个请求就知道所有能力。

```json
{
  "name": "水产市场 API",
  "version": "1.0.0",
  "description": "Agent Hub — 探索、安装、发布 Agent 技能与配置",
  "endpoints": {
    "search": "/api/v1/search?q={query}",
    "assets": "/api/v1/assets?type={type}&tag={tag}&q={query}",
    "asset_detail": "/api/v1/assets/{id}",
    "asset_readme": "/api/v1/assets/{id}/readme",
    "asset_manifest": "/api/v1/assets/{id}/manifest",
    "trending": "/api/v1/trending",
    "tags": "/api/v1/tags",
    "categories": "/api/v1/categories"
  },
  "asset_types": ["skill", "config", "plugin", "trigger", "channel", "template"],
  "stats": {
    "total_assets": 6,
    "total_authors": 1,
    "total_installs": 0
  },
  "agent_hint": "建议流程: search → asset_detail → manifest → install"
}
```

### 2.2 搜索 (Agent-Optimized)

```
GET /api/v1/search?q=天气&type=skill&limit=5&fields=compact
```

**关键改进**：
- `fields=compact`（默认）：只返回 id、name、type、description、tags、installs、install_command
- `fields=full`：返回完整数据（含 readme）
- 支持按 `type`、`tag`、`model`（兼容模型）筛选

**compact 响应**（Agent 友好 ≈ 200 tokens/条）：

```json
{
  "query": "天气",
  "total": 1,
  "assets": [
    {
      "id": "s-yq4cpy",
      "name": "weather",
      "displayName": "🌤 Weather Forecast",
      "type": "skill",
      "description": "实时天气查询 — 支持全球城市天气、7天预报、空气质量指数",
      "tags": ["weather", "forecast", "api"],
      "installs": 0,
      "rating": 0,
      "author": "CyberNova",
      "version": "1.0.0",
      "installCommand": "seafood-market install skill/@xiaoyue/weather",
      "updatedAt": "2026-02-21"
    }
  ]
}
```

### 2.3 资产列表 (分层返回)

```
GET /api/v1/assets?type=skill&tag=feishu&sort=installs&page=1&pageSize=20
```

**与现有 `/api/assets` 区别**：
- 默认返回 compact 字段（不含 readme/versions/compatibility）
- 支持 `tag` 精确筛选（现有只支持 q 模糊搜）
- 支持 `model=claude-3` 按兼容性筛选
- 新增 `sort=installs`（现有是 downloads）

### 2.4 资产详情 (完整版)

```
GET /api/v1/assets/:id
```

返回完整 asset + comments + issues，和现有 `/api/assets/:id` 类似，但增加：

```json
{
  "asset": { ... },
  "manifest": {
    "triggers": ["天气", "weather", "气温"],
    "env_vars": [],
    "input_format": "自然语言",
    "output_format": "结构化天气数据",
    "permissions": [],
    "dependencies": []
  },
  "related": [
    { "id": "s-xxx", "name": "air-quality", "reason": "同类型" }
  ]
}
```

### 2.5 Manifest (结构化元数据，核心创新)

```
GET /api/v1/assets/:id/manifest
Accept: application/json  (或 text/yaml)
```

这是 **Agent 最需要的端点**——机器可读的技能描述：

```yaml
# 返回 YAML（Agent 解析友好 + 节省 token）
name: weather
type: skill
version: 1.0.0
author: xiaoyue

# Agent 判断"能不能用"
triggers:
  - "天气"
  - "weather"
  - "温度"
  - "forecast"
  - "空气质量"

# Agent 判断"怎么装"
install:
  command: "seafood-market install skill/@xiaoyue/weather"
  env_vars: []
  permissions: []
  platforms: ["macos", "linux"]

# Agent 判断"怎么用"
usage:
  input: "自然语言城市名 + 天气意图"
  output: "结构化天气数据（温度/湿度/风速/AQI）"
  examples:
    - input: "北京今天天气怎么样？"
      output: "🌤 北京 · 晴 · 8°C · 湿度 35%"
    - input: "东京未来一周"
      output: "7天预报表格"

# Agent 判断"和我搭不搭"
compatibility:
  models: ["gpt-4", "claude-3", "step-2", "qwen-3.5"]
  frameworks: ["openclaw"]
  min_version: "2026.1.0"

# 依赖关系
dependencies: []
conflicts: []
```

**设计思路**：
- Agent 看到 manifest 就知道该不该装、怎么触发、预期输出
- 不需要解析 Markdown README
- 可以用于 Agent-to-Agent 推荐（"你需要天气能力，我推荐这个"）

### 2.6 README (纯文本)

```
GET /api/v1/assets/:id/readme
```

保留现有 `/api/assets/:id/raw` 的逻辑，返回 `text/markdown`。
**For 人类** 在前端渲染，**For Agent** 当需要深度理解时读取。

### 2.7 批量查询

```
POST /api/v1/assets/batch
Content-Type: application/json

{
  "ids": ["s-yq4cpy", "s-dww36d", "p-j04g0m"],
  "fields": "compact"
}
```

Agent 可能同时对比多个资产，一次请求搞定。

### 2.8 热门/推荐

```
GET /api/v1/trending?period=week&limit=10
```

- `period`: day / week / month / all
- 按安装增量排序
- 首页和 Agent 都用

### 2.9 标签 & 分类

```
GET /api/v1/tags          → [{"name":"weather","count":1}, {"name":"feishu","count":2}]
GET /api/v1/categories    → [{"name":"utilities","count":1,"displayName":"工具"}]
```

Agent 可以先看有哪些 tag，再精确筛选。

---

## 三、Manifest 数据模型

在 `assets` 表新增字段，或者作为 JSON 存在 `manifest` 列：

```sql
ALTER TABLE assets ADD COLUMN manifest TEXT DEFAULT '{}';
```

Manifest JSON Schema：

```typescript
interface AssetManifest {
  // 触发与识别
  triggers?: string[];           // 关键词/短语，Agent 判断何时触发
  intent?: string;               // 一句话描述意图，如 "查询天气"
  
  // 安装与配置
  env_vars?: { name: string; required: boolean; description: string }[];
  permissions?: string[];        // 需要的权限，如 "im:message:send"
  platforms?: string[];          // 支持的平台
  min_version?: string;          // 最低 OpenClaw 版本
  
  // 使用方式
  input_format?: string;         // 输入格式描述
  output_format?: string;        // 输出格式描述
  examples?: { input: string; output: string }[];
  
  // 关系
  dependencies?: string[];       // 依赖的其他资产 ID
  conflicts?: string[];          // 冲突的资产 ID
  enhances?: string[];           // 增强的资产 ID（可选安装）
}
```

### 发布时填写

CLI 发布时可以从 `SKILL.md` 自动提取 manifest：

```bash
seafood-market publish ./my-skill/
# 自动读取 SKILL.md → 提取 triggers/env_vars/examples → 写入 manifest
```

Web 发布时提供表单填写。

---

## 四、Agent 交互流程

### 场景 A：Agent 寻找能力

```
Agent: 我需要一个能查天气的技能
  ↓
GET /api/v1/search?q=天气&type=skill&fields=compact
  ↓ (找到 weather skill，200 tokens)
Agent: 看起来合适，看看详细信息
  ↓
GET /api/v1/assets/s-yq4cpy/manifest
  ↓ (拿到 triggers + examples + compatibility，300 tokens)
Agent: 兼容我的模型，安装
  ↓
POST /api/v1/assets/s-yq4cpy/install  → 记录安装 + 返回安装命令
```

**总消耗**: ~500 tokens（vs 现在可能 2000+ tokens）

### 场景 B：Agent 推荐资产

```
User: "有什么好用的飞书相关技能？"
  ↓
GET /api/v1/assets?tag=feishu&sort=installs&fields=compact
  ↓
Agent 整理列表推荐给用户
```

### 场景 C：Agent-to-Agent 协作

```
Agent A: 我发现用户经常问天气，推荐安装 weather skill
  ↓
GET /api/v1/assets/s-yq4cpy/manifest
  ↓ (检查 compatibility)
Agent A → Agent B: "建议安装 weather skill，触发词：天气/温度/forecast"
```

---

## 五、实施路径

### Phase 1 — 基础（1-2 天）
- [ ] 新建 `/api/v1/` 路由目录
- [ ] Discovery endpoint `/api/v1`
- [ ] 资产列表支持 `fields=compact` 模式
- [ ] 搜索支持 `type` + `tag` 精确筛选
- [ ] Tags / Categories 端点

### Phase 2 — Manifest（2-3 天）
- [ ] DB 新增 `manifest` 列
- [ ] Manifest CRUD API
- [ ] 为现有 6 个资产填写 manifest
- [ ] `/api/v1/assets/:id/manifest` 端点

### Phase 3 — 智能化（后续）
- [ ] 批量查询 `/api/v1/assets/batch`
- [ ] 相关资产推荐（related）
- [ ] `seafood-market publish` 自动提取 SKILL.md → manifest
- [ ] Agent 安装统计与行为分析

---

## 六、兼容性

- 现有 `/api/assets` 等端点**保持不变**，前端继续用
- v2 API 全部放在 `/api/v1/` 下，与现有 API 共存
- 前端可逐步迁移到 v1 API
- `X-Device-ID` 认证机制不变

---

## 七、与现有 raw 端点的关系

现有 `/api/assets/:id/raw` 已经在做"Agent 友好"的事（YAML frontmatter + Markdown），
但它混合了结构化数据和非结构化内容。

v2 的改进是**拆开**：
- `manifest` → 纯结构化（机器读）
- `readme` → 纯 Markdown（人类读 + Agent 深度理解时用）

Agent 不需要每次都读 README，只看 manifest 就够了。
