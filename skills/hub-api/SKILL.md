---
name: hub-api
description: 水产市场 Agent Hub API 操作技能。用于在 Agent Hub 上浏览、搜索、创建、更新、删除资产（Skills/Configs/Plugins/Triggers/Channels/Templates）。当用户要求发布资产、查询资产列表、搜索技能、查看资产详情、管理已发布内容时使用此技能。触发词：发布、上架、资产管理、Hub API、水产市场、agent hub、skill install。
---

# Hub API Skill — 水产市场 🐟

> 版本：v3.0 | 2026-02-21 更新
> 新增：设备 Token 认证 + CLI publish + 完整发布链路

## 服务地址

- **生产环境（域名）**：`https://openclawmp.cc`（优先使用）
- **生产环境（IP）**：`http://47.100.235.25:3000`（备用）
- **本地开发**：`http://localhost:3000`（仅在本地 `npm run dev` 时使用）
- API 基路径：`/api`

## 认证体系

### 认证链路总览

```
人类用户注册 (GitHub/Google OAuth)
  → 激活邀请码 (SEAFOOD-2026 等)
  → 在网页生成设备 Token (绑定 Agent 的 instance_id)
  → Agent 用 Token 通过 CLI 发布
```

**核心原则：只有激活了邀请码的用户的 Agent 才能发布。**

### 两种认证方式

| 方式 | 场景 | Header |
|------|------|--------|
| **Session** | 网页浏览器操作 | Cookie（NextAuth 自动管理） |
| **Device Token** | CLI / Agent 发布 | `Authorization: Bearer sm_xxxxx` |

### 设备 Token（Device Token）

Token 绑定三要素：`用户 + 邀请码 + instance_id`

```
POST /api/auth/token
Content-Type: application/json
Cookie: (需已登录)

{ "instanceId": "agent-abc123", "name": "小跃的MacBook" }
```

返回：
```json
{
  "success": true,
  "data": {
    "token": "sm_m1abc_xxxxxxxxxxxxxx",
    "instanceId": "agent-abc123",
    "message": "⚠️ 请保存好你的 token，它只会显示一次！"
  }
}
```

**安全保障：**
- 发布时 API 校验：Token 有效 → 查到绑定的 userId → 检查该用户已激活邀请码 → 放行
- Token 可随时撤销（`DELETE /api/auth/token`）
- 一个用户可以给多个 Agent/设备 生成不同 Token

## 资产类型（6 种，平级关系）

| type | emoji | 中文 | 说明 |
|------|-------|------|------|
| `skill` | 🛠️ | 技能包 | SKILL.md + 脚本，prompt 引导制 |
| `config` | ⚙️ | 配置 | 定义 Agent 人格/行为/路由 |
| `plugin` | 🔌 | 插件工具 | Plugin Tool，代码级扩展 |
| `trigger` | 🔔 | 触发器 | 事件监听与触发 |
| `channel` | 📡 | 通信器 | 消息渠道适配器 |
| `template` | 📦 | 模板 | 以上元素的组合包 |

### 分类判断指南（重要！）

**核心原则：看项目在 OpenClaw 架构中扮演什么角色，而非技术复杂度。**

判断顺序（从最容易确定的开始）：

1. **channel（通信器）** — 项目是否承担了 Agent 与用户之间的**消息输入/输出通道**？
   - ✅ 飞书/Telegram/Discord/Slack 适配器
   - ✅ 桌面可视化客户端（如 KKClaw 球体宠物）— 本质是用 WebSocket/Gateway 接收 Agent 输出并渲染展示，同时接受用户输入回传给 Agent，**和飞书同层**
   - ✅ 任何有 UI 渲染 + 双向通信（WebSocket/HTTP/SSE）+ 连接 Gateway 的项目
   - 🔑 判断标准：**如果把它的显示/交互部分拆出来，它就是一个展示输入输出的渠道**

2. **trigger（触发器）** — 项目是否**监听外部事件**并唤醒 Agent？
   - ✅ 文件监控（fswatch/inotify）、Webhook 接收器、定时器
   - ✅ 邮件/RSS/日历变更监听
   - 🔑 判断标准：它不处理消息，只负责"发现事件 → 通知 Agent"

3. **plugin（插件工具）** — 项目是否给 Agent 提供**新的工具能力**？
   - ✅ MCP server、Tool provider、API wrapper
   - ✅ 数据库连接器、搜索引擎封装
   - 🔑 判断标准：Agent 通过 tool call 调用它完成特定操作

4. **skill（技能包）** — 项目是否用 SKILL.md + prompt 引导 Agent 的行为模式？
   - ✅ 合同审查流程、代码审查流程、内容创作指南
   - ✅ 有 SKILL.md 文件的项目
   - 🔑 判断标准：通过自然语言 prompt 定义 Agent 该怎么做某事

5. **config（配置）** — 项目是否定义 Agent 人格、模型路由或行为参数？
   - ✅ SOUL.md / AGENTS.md / 模型配置
   - ✅ Gateway 配置模板

6. **template（模板）** — 项目是否是多种类型的**打包组合**？
   - ✅ 包含 skill + config + plugin 的完整 Agent 方案
   - ⚠️ 不要因为项目"复杂"就归 template——一个功能完整的桌面客户端仍然可能是 channel

### 常见误判

| 误判 | 正确 | 原因 |
|------|------|------|
| 桌面可视化客户端 → template | → **channel** | 它本质是消息渠道，不是多类型组合 |
| WebSocket 聊天 UI → plugin | → **channel** | 它做的是输入/输出展示，不是提供工具能力 |
| 文件 watcher + 处理逻辑 → skill | → **trigger** | 核心价值是事件监听，处理逻辑是附带的 |
| 一个 API wrapper → skill | → **plugin** | 它提供的是代码级工具调用，不是 prompt 引导 |

## seafood-market CLI

### 安装
```bash
curl -fsSL http://47.100.235.25:3000/install.sh | bash
```

### 登录（保存 Token）
```bash
seafood-market login
# 粘贴从网页生成的设备 Token
# Token 保存到 ~/.seafood-market/token
```

也可用环境变量：`SEAFOOD_TOKEN=sm_xxxxx seafood-market publish ./`

### 发布 ⭐

```bash
# 发布当前目录的 skill（读取 SKILL.md）
seafood-market publish ./my-skill/

# 指定 author 信息（如果 SKILL.md 里没写）
SEAFOOD_AUTHOR_ID=xiaoyue \
SEAFOOD_AUTHOR_NAME="小跃" \
SEAFOOD_AUTHOR_AVATAR="⚡" \
seafood-market publish ./my-skill/
```

**publish 做了什么：**
1. 读取目录下的 `SKILL.md`
2. 解析 YAML frontmatter（name, description, version, tags 等）
3. README 内容 = frontmatter 之后的 Markdown body
4. 显示预览，等待确认
5. 带 Bearer Token POST 到 `/api/assets`

**SKILL.md frontmatter 支持的字段：**
```yaml
---
name: weather
description: "一句话描述"
version: 1.0.0
type: skill        # 默认 skill
displayName: "🌤️ Weather"
tags: "weather, forecast, 天气"   # 逗号分隔
category: "信息查询"
authorId: xiaoyue
authorName: 小跃
authorAvatar: ⚡
longDescription: "详细描述..."
---
```

### 搜索
```bash
seafood-market search "天气"
seafood-market search "文件监控"
```

### 安装
```bash
# 格式：type/@author/slug
seafood-market install skill/@xiaoyue/weather
seafood-market install trigger/@xiaoyue/pdf-watcher
```

### 其他命令
```bash
seafood-market list                          # 已安装列表
seafood-market info skill/weather            # 查看详情
seafood-market uninstall trigger/pdf-watcher # 卸载
```

## API 速查

### 1. 列表 & 搜索（无需认证）

```
GET /api/assets?type=skill&q=weather&sort=downloads&page=1&pageSize=20
```

参数全部可选：`type`, `category`, `q`, `sort`(downloads/rating/updated_at/created_at/trending), `page`, `pageSize`(默认20，最大100)

### 2. 资产详情（无需认证）

```
GET /api/assets/{id}
```

### 3. 创建/发布资产（需认证 + 邀请码）

```
POST /api/assets
Content-Type: application/json
Authorization: Bearer sm_xxxxx
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

**推荐同时传：**
```json
{
  "authorId": "xiaoyue",
  "authorName": "小跃",
  "authorAvatar": "⚡",
  "longDescription": "详细说明...",
  "tags": ["tag1", "tag2"],
  "category": "信息查询",
  "readme": "# README\n\nMarkdown..."
}
```

**认证失败返回：**
- 401：未认证（token 无效或未传）
- 403：用户未激活邀请码

### 4. 更新资产（需认证）

```
PUT /api/assets/{id}
Authorization: Bearer sm_xxxxx
```

### 5. 删除资产（需认证）

```
DELETE /api/assets/{id}
Authorization: Bearer sm_xxxxx
```

### 6. 设备 Token 管理

```
GET  /api/auth/token          # 列出我的 tokens
POST /api/auth/token          # 创建新 token（需 instanceId）
DELETE /api/auth/token        # 撤销 token
```

## 完整发布流程（端到端）

### 方式一：CLI 发布（推荐）

```bash
# 1. 安装 CLI
curl -fsSL http://47.100.235.25:3000/install.sh | bash

# 2. 登录（粘贴从网页获取的设备 Token）
seafood-market login

# 3. 进入 skill 目录，发布
cd ~/my-awesome-skill/
seafood-market publish .

# 4. 验证
seafood-market search "my-awesome-skill"
```

### 方式二：Python 脚本（适合批量/自动化）

```python
import requests, json

REGISTRY = "http://47.100.235.25:3000"
TOKEN = "sm_xxxxx"  # 你的设备 Token

payload = {
    "name": "my-skill",
    "displayName": "🌟 My Skill",
    "type": "skill",
    "description": "一句话描述",
    "version": "1.0.0",
    "authorId": "xiaoyue",
    "authorName": "小跃",
    "authorAvatar": "⚡",
    "tags": ["tag1"],
    "readme": "# README\n\nContent..."
}

r = requests.post(
    f"{REGISTRY}/api/assets",
    json=payload,
    headers={"Authorization": f"Bearer {TOKEN}"}
)
print(r.json())
```

## 部署信息

### 生产环境（阿里云 ECS）
- **IP**：47.100.235.25
- **端口**：3000
- **部署路径**：`/opt/agent-hub`
- **运行方式**：Docker 容器 `agent-hub`
- **数据库**：`/opt/agent-hub/data/hub.db`（SQLite，volume 挂载）
- **GitHub**：`https://github.com/502399493zjw-lgtm/agent-hub`

### 更新部署
```bash
ssh root@47.100.235.25
cd /opt/agent-hub && git pull origin main
docker build -t agent-hub .
docker stop agent-hub && docker rm agent-hub
docker run -d --name agent-hub --restart unless-stopped \
  -p 3000:3000 -v /opt/agent-hub/data:/app/data \
  -e AUTH_SECRET='<secret>' \
  -e NEXTAUTH_URL='http://47.100.235.25:3000' \
  agent-hub
# 修复 DB 权限（每次 rebuild 后需要）
chmod 666 /opt/agent-hub/data/hub.db*
docker restart agent-hub
```

## Hub Score 计算

```
Hub Score = 下载分 × 0.40 + 维护分 × 0.30 + 口碑分 × 0.30
```

下载计分：新装 1 分，更新 +0.3/次，同用户封顶 5 次。

## Asset 完整字段参考

详见 [references/schema.md](references/schema.md)。
