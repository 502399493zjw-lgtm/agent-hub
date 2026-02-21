---
name: hub-api
description: 水产市场 Agent Hub API 操作技能。用于在 Agent Hub 上浏览、搜索、创建、更新、删除资产（Skills/Configs/Plugins/Triggers/Channels/Templates）。当用户要求发布资产、查询资产列表、搜索技能、查看资产详情、管理已发布内容时使用此技能。触发词：发布、上架、资产管理、Hub API、水产市场、agent hub、skill install。
---

# Hub API Skill — 水产市场 🐟

> 版本：v2.1 | 2026-02-21 更新
> 基于实际使用复盘修正

## 服务地址

- **生产环境（ECS）**：`http://47.100.235.25:3000`（优先使用）
- **本地开发**：`http://localhost:3000`（仅在本地 `npm run dev` 时使用）
- API 基路径：`/api`

**⚠️ 重要**：发布/查询操作默认走生产地址。仅当明确在本地开发调试时才用 localhost。

## 资产类型（6 种，平级关系）

| type | emoji | 中文 | 说明 | installCommand 示例 |
|------|-------|------|------|---------------------|
| `skill` | 🛠️ | 技能包 | SKILL.md + 脚本，prompt 引导制 | `seafood-market install skill/@xiaoyue/web-search` |
| `config` | ⚙️ | 配置 | 定义 Agent 人格/行为/路由 | `seafood-market install config/@cybernova/quantum-sorcerer` |
| `plugin` | 🔌 | 插件工具 | Plugin Tool，代码级扩展 | `seafood-market install plugin/@neondrake/discord-bridge` |
| `trigger` | 🔔 | 触发器 | 事件监听与触发 | `seafood-market install trigger/@xiaoyue/pdf-watcher` |
| `channel` | 📡 | 通信器 | 消息渠道适配器 | `seafood-market install channel/@cybernova/research-pipeline` |
| `template` | 📦 | 模板 | 以上元素的组合包 | `seafood-market install template/@cybernova/personal-assistant` |

Config 子类型（`configSubtype` 字段，用 tag 区分）：`persona` / `routing` / `model` / `scope`

## API 速查

### 1. 列表 & 搜索

```
GET /api/assets?type=skill&category=信息查询&q=weather&sort=downloads&page=1&pageSize=20
```

**参数（全部可选）：**
- `type` — 过滤资产类型（skill/config/plugin/trigger/channel/template）
- `category` — 过滤分类
- `q` — 模糊搜索（匹配 name/displayName/description/tags）
- `sort` — 排序：`downloads` / `rating` / `updated_at` / `created_at` / `trending`
- `page` — 页码（默认 1）
- `pageSize` — 每页数量（默认 20，最大 100）

**返回：**
```json
{
  "success": true,
  "data": {
    "assets": [{ "id": "s1", "name": "weather", ... }],
    "total": 38,
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

### 3. 创建/发布资产

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
  "authorId": "xiaoyue",
  "authorName": "小跃",
  "authorAvatar": "⚡",
  "longDescription": "详细说明...",
  "tags": ["tag1", "tag2"],
  "category": "信息查询",
  "readme": "# README\n\n...",
  "configSubtype": "persona"
}
```

自动生成：`id`（类型前缀+随机码）、`installCommand`（格式 `seafood-market install <type>/@<authorId>/<name>`）、`createdAt`/`updatedAt`、`hubScore=65`、`downloads=0`。

### 4. 更新资产

```
PUT /api/assets/{id}
Content-Type: application/json
```

传入要更新的字段（部分更新），`updatedAt` 自动刷新。

### 5. 删除资产

```
DELETE /api/assets/{id}
```

## 错误格式

```json
{ "success": false, "error": "错误描述" }
```

状态码：400（参数错误）、404（不存在）、500（服务器错误）。

## ⚠️ 已知问题 & 使用注意

### 问题 1：installCommand 格式已变更
- **旧格式**：`openclaw skill install @author/name`
- **新格式**：`seafood-market install <type>/@<author>/<name>`
- CLI 工具名是 `seafood-market`，不是 `openclaw hub`

### 问题 2：author 字段要传完整
创建资产时需要同时传 `authorId` + `authorName` + `authorAvatar`：
```json
{
  "authorId": "xiaoyue",
  "authorName": "小跃",
  "authorAvatar": "⚡"
}
```
如果只传 `authorName` 不传 `authorId`，DB 会存空字符串，后续个人主页和权限关联会出问题。

### 问题 3：seafood-market CLI 默认连 localhost
- `seafood-market` 脚本的 `REGISTRY_URL` 默认是 `http://localhost:3000`
- 连生产需设环境变量：`SEAFOOD_REGISTRY=http://47.100.235.25:3000 seafood-market search xxx`
- 或修改脚本默认值

### 问题 4：评论/Issues/进化/用户 仍走 Mock
以下数据**尚无 DB 表**，仍走内存 mock：
- 评论（Comments）
- Issues
- 进化事件（EvolutionEvent）
- 用户列表（Users）
- 通知（Notifications）
- 收藏集（Collections）

这意味着：重启容器后这些数据会重置为初始 mock 值。资产数据（assets 表）不受影响。

### 问题 5：JSON 字段在 curl 中的转义
发布资产时 `readme` 字段含 Markdown（引号/换行），直接用 curl -d 容易出错。
**推荐方案**：用 Python 脚本或 JSON 文件发送，避免 shell 转义地狱。

```python
import requests, json
payload = {
    "name": "my-skill",
    "displayName": "🌟 My Skill",
    "type": "skill",
    "description": "...",
    "version": "1.0.0",
    "readme": "# Title\n\nMarkdown content..."
}
r = requests.post("http://47.100.235.25:3000/api/assets", json=payload)
print(r.json())
```

### 问题 6：分页只返回 pageSize 条
- 默认 `pageSize=20`，总资产 38 条
- 如需获取全部，传 `pageSize=100`：`GET /api/assets?pageSize=100`

## 部署信息

### 生产环境（阿里云 ECS）
- **IP**：47.100.235.25
- **端口**：3000（需在安全组放行 TCP 3000）
- **部署路径**：`/opt/agent-hub`
- **运行方式**：Docker 容器 `agent-hub`
- **数据库**：`/opt/agent-hub/data/hub.db`（容器内 SQLite）
- **GitHub**：`https://github.com/502399493zjw-lgtm/agent-hub`

### 更新部署流程
```bash
ssh root@47.100.235.25
cd /opt/agent-hub
git pull origin main
docker build -t agent-hub .
docker stop agent-hub && docker rm agent-hub
docker run -d --name agent-hub -p 3000:3000 -v /opt/agent-hub/data:/app/data agent-hub
```

**注意**：如果修改了 DB schema，需要删除旧的 `data/hub.db` 让它重新 seed。

### 本地开发
```bash
cd ~/.openclaw/workspace/agent-hub
npm run dev   # http://localhost:3000
```

## Hub Score 计算规则

```
Hub Score = 下载分 × 0.40 + 维护分 × 0.30 + 口碑分 × 0.30
```

| 维度 | 计算方式 |
|------|----------|
| 下载分 | `log(1 + 加权下载总量)` 归一化到 0-100 |
| 维护分 | Issue 解决率 × 60% + 有无未回复 Issue × 40% |
| 口碑分 | Review 均分 × 评价数权重（<5 条降权） |

下载计分：新装 1 分，更新 +0.3/次，同用户封顶 5 次（2.5 分/用户/资产）。

## seafood-market CLI 用法

### 安装 CLI
```bash
# 一键安装
curl -fsSL http://47.100.235.25:3000/install.sh | bash

# 或手动安装
wget -O ~/.local/bin/seafood-market http://47.100.235.25:3000/seafood-market.sh
chmod +x ~/.local/bin/seafood-market
```

安装后自动配置 `SEAFOOD_REGISTRY=http://47.100.235.25:3000`。

### 常用命令
```bash
# 搜索
seafood-market search "文件监控"

# 安装（格式：type/@author/slug）
seafood-market install trigger/@xiaoyue/pdf-watcher

# 列出已安装
seafood-market list

# 卸载
seafood-market uninstall trigger/pdf-watcher

# 查看详情
seafood-market info trigger/pdf-watcher

# 发布本地资产
seafood-market publish ./my-skill/
```

CLI 位置：`~/.local/bin/seafood-market`（symlink → `~/.openclaw/workspace/agent-hub/tools/seafood-market.sh`）
Lockfile：`~/.openclaw/seafood-lock.json`

## 完整发布流程（最佳实践）

1. 用 Python 脚本构造 payload（避免 JSON 转义问题）
2. `POST http://47.100.235.25:3000/api/assets` 创建资产
3. 确认返回 `{ success: true, data: { id: "xxx" } }`
4. 可通过 `GET /api/assets/{id}` 验证
5. 页面可访问：`http://47.100.235.25:3000/asset/{id}`

## Asset 完整字段参考

详见 [references/schema.md](references/schema.md)。
