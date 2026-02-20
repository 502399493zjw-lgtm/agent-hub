---
name: hub-api
description: 水产市场 Agent Hub API 操作技能。用于在 Agent Hub 上浏览、搜索、创建、更新、删除资产（Skills/Configs/Plugins/Triggers/Channels/Templates）。当用户要求发布资产、查询资产列表、搜索技能、查看资产详情、管理已发布内容时使用此技能。触发词：发布、上架、资产管理、Hub API、水产市场、agent hub、skill install。
---

# Hub API Skill

水产市场 Agent Hub 的完整 API 操作指南。

## 服务地址

- 本地开发：`http://localhost:3000`
- API 基路径：`/api`

## 资产类型（6 种）

| type | 中文 | 说明 | installCommand 前缀 |
|------|------|------|---------------------|
| `skill` | 技能包 | 让 Agent 获得新能力 | `openclaw skill install` |
| `config` | 配置 | 定义 Agent 人格/行为 | `openclaw config install` |
| `plugin` | 插件 | 扩展底层基础设施 | `openclaw plugin install` |
| `trigger` | 触发器 | 事件监听与触发 | `openclaw trigger install` |
| `channel` | 频道 | 连接外部世界 | `openclaw channel install` |
| `template` | 模板 | 开箱即用的方案 | `openclaw template install` |

Config 子类型（`configSubtype`）：`persona` / `routing` / `model` / `scope`

## API 速查

### 1. 列表 & 搜索

```
GET /api/assets?type=skill&category=信息查询&q=weather&sort=downloads&page=1&pageSize=20
```

**参数（全部可选）：**
- `type` — 过滤资产类型（skill/config/plugin/trigger/channel/template）
- `category` — 过滤分类（信息查询/开发工具/创意生成/效率工具 等）
- `q` — 模糊搜索（匹配 name/displayName/description/tags）
- `sort` — 排序方式：`downloads` / `rating` / `updated_at` / `created_at` / `trending`（默认按综合热度）
- `page` — 页码（默认 1）
- `pageSize` — 每页数量（默认 20，最大 100）

**返回：**
```json
{
  "success": true,
  "data": {
    "assets": [{ "id": "s1", "name": "weather", "displayName": "🌤 Weather Query", ... }],
    "total": 36,
    "page": 1,
    "pageSize": 20
  }
}
```

### 2. 资产详情

```
GET /api/assets/{id}
```

返回 asset 完整数据 + comments + issues（评论/Issues 暂为 mock 数据）。

```json
{
  "success": true,
  "data": {
    "asset": { "id": "s1", "name": "weather", ... },
    "comments": [...],
    "issues": [...]
  }
}
```

### 3. 创建资产

```
POST /api/assets
Content-Type: application/json
```

**必填字段：**
```json
{
  "name": "my-skill",
  "displayName": "🌟 My Skill",
  "type": "skill",
  "description": "一句话描述",
  "version": "1.0.0"
}
```

**可选字段：**
```json
{
  "authorName": "CyberNova",
  "authorAvatar": "🤖",
  "longDescription": "详细说明...",
  "tags": ["tag1", "tag2"],
  "category": "信息查询",
  "readme": "# README\n\n...",
  "configSubtype": "persona"
}
```

自动生成：`id`（类型前缀+随机码）、`installCommand`、`createdAt`、`updatedAt`、`hubScore=65`、`downloads=0`。

**返回：**
```json
{ "success": true, "data": { "id": "s-abc123", ... } }
```

### 4. 更新资产

```
PUT /api/assets/{id}
Content-Type: application/json
```

传入要更新的字段（部分更新），`updatedAt` 自动刷新。

```json
{
  "displayName": "新名字",
  "description": "新描述",
  "version": "1.1.0",
  "tags": ["updated", "tags"],
  "readme": "# 新 README"
}
```

### 5. 删除资产

```
DELETE /api/assets/{id}
```

```json
{ "success": true, "data": { "id": "s-abc123" } }
```

## 错误格式

所有错误统一返回：
```json
{ "success": false, "error": "错误描述" }
```

常见状态码：400（参数错误）、404（不存在）、500（服务器错误）。

## 使用示例

### 通过 curl 发布一个 Skill

```bash
curl -X POST 'http://localhost:3000/api/assets' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "fs-event-trigger",
    "displayName": "📂 FS Event Trigger",
    "type": "skill",
    "description": "文件系统事件监听 — 监控目录变化，自动触发 Agent 动作",
    "version": "1.0.0",
    "tags": ["filesystem", "watcher", "automation"],
    "category": "系统工具",
    "readme": "# FS Event Trigger\n\n监控目录变化，自动触发 Agent。"
  }'
```

### 搜索并查看详情

```bash
# 搜索
curl 'http://localhost:3000/api/assets?q=weather&type=skill'

# 查看详情
curl 'http://localhost:3000/api/assets/s1'
```

### 完整发布流程

1. `POST /api/assets` 创建资产 → 获得 `id`
2. 跳转 `/asset/{id}` 查看详情页
3. 如需修改 → `PUT /api/assets/{id}`
4. 用户安装 → `openclaw skill install @author/name`

## 数据库

- 引擎：SQLite（better-sqlite3）
- 文件位置：`data/hub.db`（项目根目录）
- 首次启动自动从 mock 数据 seed 36 条资产
- 所有 JSON 字段（tags/versions/dependencies 等）存为 JSON 字符串

## Asset 完整字段参考

详细的 TypeScript 类型定义和数据库 schema 见 [references/schema.md](references/schema.md)。
