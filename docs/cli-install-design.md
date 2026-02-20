# Agent Hub CLI Install 设计文档

> 水产市场各资产类型的 CLI 安装能力设计

---

## 一、现状分析

### OpenClaw 现有 Skills 体系

**扫描源（优先级从低到高）：**

| 来源 | 目录 | Source 标识 | 说明 |
|------|------|------------|------|
| Extra | `skills.load.extraDirs` 配置 | `openclaw-extra` | 插件注入的 skill 目录 |
| Bundled | 内置 `skills/` | `openclaw-bundled` | OpenClaw 自带 |
| Managed | `~/.openclaw/skills/` | `openclaw-managed` | ClawHub CLI 安装的 |
| Personal | `~/.agents/skills/` | `agents-skills-personal` | 用户个人 skills |
| Project | `$workspace/.agents/skills/` | `agents-skills-project` | 项目级 skills |
| Workspace | `$workspace/skills/` | `openclaw-workspace` | 当前工作区 |

> 同名 skill 高优先级覆盖低优先级。

**现有安装方式：**

| 方式 | 命令 | 安装位置 | 状态 |
|------|------|---------|------|
| ClawHub Registry | `clawhub install <slug>` | 当前目录的 `skills/` | ✅ 可用 |
| 手动复制 | `cp -r ... ~/.openclaw/skills/` | managed 目录 | ✅ 可用 |
| Skill 依赖安装 | SKILL.md 声明 `install:` | 自动 brew/npm/go/download | ✅ 可用 |
| Hub CLI Install | `openclaw skill install @author/name` | — | ❌ 不存在 |

**关键发现：**
- `openclaw skills` 子命令只有 `list` / `info` / `check`，**没有 install/uninstall**
- `clawhub` CLI 是独立工具，支持 install/publish/search，但只面向 skills
- OpenClaw 的 install 体系（`skills-install.ts`）负责的是 skill **依赖**的安装（brew/npm/go/download），不是 skill 本身
- 6 种资产类型（skill/config/plugin/trigger/channel/template）目前只有 **skill** 有安装基础

---

## 二、设计方案

### 统一 CLI 命令

```bash
openclaw hub install <type>/<slug>          # 从 Hub Registry 安装
openclaw hub install <type>/<slug>@1.2.0    # 指定版本
openclaw hub uninstall <type>/<slug>        # 卸载
openclaw hub search <query>                 # 搜索
openclaw hub publish <path>                 # 发布
openclaw hub info <type>/<slug>             # 查看详情
openclaw hub list                           # 列出已安装
openclaw hub update [type/slug]             # 更新（全部或指定）
```

**为什么用 `openclaw hub` 而不是 `openclaw skill install`：**
- 6 种资产类型共用一套命令，不需要记 6 个动词
- `type/slug` 格式天然区分类型：`skill/web-search`、`config/cyberpunk-persona`
- 与 `clawhub` CLI 对齐但更简洁（clawhub 面向开发者，hub 面向用户）

### 6 种资产类型的安装行为

```
openclaw hub install skill/web-search
openclaw hub install config/cyberpunk-persona
openclaw hub install plugin/discord-bridge
openclaw hub install trigger/fs-event-trigger
openclaw hub install channel/telegram-relay
openclaw hub install template/customer-service
```

| 类型 | 安装目录 | 生效方式 | 文件结构 |
|------|---------|---------|---------|
| **skill** | `~/.openclaw/skills/<slug>/` | 下次 session 自动加载 | `SKILL.md` + scripts/ + references/ |
| **config** | `~/.openclaw/configs/<slug>/` | `openclaw hub apply config/<slug>` | `config.yaml` + `SOUL.md` 等 |
| **plugin** | `~/.openclaw/plugins/<slug>/` | 需重启 gateway | `plugin.ts` / npm package |
| **trigger** | `~/.openclaw/triggers/<slug>/` | 自动注册 hooks | `watcher.sh` + `*.plist` |
| **channel** | `~/.openclaw/channels/<slug>/` | 需重启 + 配置凭证 | `channel.ts` + `config.yaml` |
| **template** | 创建新 workspace | `openclaw hub apply template/<slug>` | 完整工作区蓝图 |

### 安装流程（通用）

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────┐
│ 解析 type/  │───▶│ Hub API 查  │───▶│  下载 .tar   │───▶│  解压到目  │
│ slug@ver    │    │ 询元数据    │    │  .gz 包      │    │  标目录    │
└─────────────┘    └─────────────┘    └──────────────┘    └────────────┘
                                                               │
                          ┌────────────────────────────────────┘
                          ▼
                   ┌──────────────┐    ┌────────────────┐
                   │  执行 post-  │───▶│  输出安装结果  │
                   │  install     │    │  + 后续操作    │
                   └──────────────┘    └────────────────┘
```

#### 各类型的 post-install 差异

**skill** — 最简单：
```bash
# 安装完即可用，无需额外操作
✅ Installed skill/web-search v2.1.0
   Location: ~/.openclaw/skills/web-search/
   Ready: will be loaded in next session
```

**config** — 需要 apply 激活：
```bash
✅ Installed config/cyberpunk-persona v1.0.0
   Location: ~/.openclaw/configs/cyberpunk-persona/
   
   To activate, run:
   $ openclaw hub apply config/cyberpunk-persona
   
   This will:
   - Copy SOUL.md to your workspace
   - Merge config entries into openclaw.json
```

**plugin** — 需重启：
```bash
✅ Installed plugin/discord-bridge v3.0.0
   Location: ~/.openclaw/plugins/discord-bridge/
   
   ⚠️  Requires gateway restart to take effect.
   $ openclaw gateway restart
   
   Configuration needed:
   - Set DISCORD_BOT_TOKEN in openclaw.json → channels.discord
```

**trigger** — 自动安装守护进程：
```bash
✅ Installed trigger/fs-event-trigger v1.0.0
   Location: ~/.openclaw/triggers/fs-event-trigger/
   
   Post-install:
   - Checking fswatch... ✅ found
   - Checking hooks config... ✅ enabled
   
   Quick start:
   $ bash ~/.openclaw/triggers/fs-event-trigger/scripts/generate-watcher.sh \
       --name pdf-watcher --watch-dir ~/Downloads --extensions pdf
```

**channel** — 需凭证配置：
```bash
✅ Installed channel/telegram-relay v1.0.0
   Location: ~/.openclaw/channels/telegram-relay/
   
   ⚠️  Configuration required:
   1. Set bot token: openclaw config set channels.telegram.botToken <TOKEN>
   2. Restart gateway: openclaw gateway restart
```

**template** — 蓝图初始化：
```bash
✅ Installed template/customer-service v1.0.0
   
   To create a new workspace from this template:
   $ openclaw hub apply template/customer-service --workspace ./my-agent
   
   This will scaffold:
   - SOUL.md (Agent 人格)
   - AGENTS.md (工作流程)
   - skills/ (预装技能)
   - tools/ (工具配置)
```

---

## 三、包格式（Package Format）

### 包结构

```
<slug>-<version>.tar.gz
├── manifest.json        # 包元数据（必需）
├── SKILL.md / config.yaml / plugin.ts  # 主文件（按类型）
├── scripts/             # 可选
├── references/          # 可选
└── assets/              # 可选
```

### manifest.json

```json
{
  "schema": 1,
  "type": "skill",
  "name": "fs-event-trigger",
  "displayName": "📂 文件事件触发器",
  "version": "1.0.0",
  "author": {
    "id": "u_xiaoyue_001",
    "name": "小跃",
    "avatar": "⚡",
    "email": "xiaoyue@example.com"
  },
  "description": "监控目录变化，自动唤醒 Agent 处理新文件",
  "tags": ["filesystem", "watcher", "automation"],
  "category": "事件触发",
  "dependencies": {
    "skills": [],
    "binaries": ["fswatch"],
    "node": [],
    "python": []
  },
  "postInstall": {
    "message": "Run generate-watcher.sh to create your first watcher",
    "requiresRestart": false,
    "requiresConfig": ["hooks.enabled", "hooks.token"]
  },
  "compatibility": {
    "os": ["darwin", "linux"],
    "openclaw": ">=2026.2.0"
  }
}
```

---

## 四、创建者身份体系（Author Identity）

### 核心问题

没有 author ID，整个生态就是裸奔：
- 发布时：谁都能自称「小跃」发包
- 更新时：无法验证操作者 == 原作者
- 展示时：同名作者无法区分
- 协作时：权限转移无从谈起

### 身份标识设计

每个创建者有全局唯一的 **Author ID**（类似 npm username），所有资产发布时绑定此 ID。

#### Author 数据结构

```typescript
interface Author {
  id: string;           // 全局唯一 ID，如 "xiaoyue" 或 "u_abc123"
  name: string;         // 显示名称，如 "小跃"
  avatar?: string;      // emoji 或头像 URL
  email?: string;       // 可选，用于 Gravatar 或通知
  provider?: string;    // 认证来源：github / clawhub / feishu / local
  providerId?: string;  // 第三方平台 ID（如 GitHub user ID）
  createdAt: string;    // ISO-8601
  verified: boolean;    // 是否通过邮箱/OAuth 验证
}
```

#### ID 生成策略

| 场景 | ID 格式 | 示例 |
|------|---------|------|
| GitHub OAuth | github username | `xiaoyue` |
| ClawHub 账号 | clawhub username | `cybernova` |
| 飞书 OAuth | `feishu_` + hash | `feishu_a0fb34` |
| 本地匿名 | `local_` + random | `local_k7m9x2` |

**优先用可读 ID**（GitHub/ClawHub username），匿名发布才走随机 ID。

### 发布时的身份绑定

```
openclaw hub publish ./my-skill/
```

流程：
```
1. 读取 ~/.openclaw/hub-credentials.json → 取 author.id
2. 如果没登录 → 提示 `openclaw hub login` 先
3. 自动将 author.id 写入 manifest.json（覆盖本地手填的）
4. Registry 服务端再次校验 token ↔ author.id 一致性
5. 包入库，author.id 作为 owner 字段存入 DB
```

**关键**：服务端 override。即使你手动改 manifest 里的 author.id，服务端也会用 token 对应的真实 ID 覆盖。防篡改。

### 权限模型

```typescript
interface AssetPermission {
  ownerId: string;          // 创建者 author.id（唯一所有者）
  maintainers: string[];    // 协作者 author.id 列表（可发布新版本）
  organization?: string;    // 可选的组织归属
}
```

| 操作 | 谁能做 |
|------|--------|
| 发布新版本 | owner + maintainers |
| 删除/下架 | owner only |
| 添加 maintainer | owner only |
| Transfer 所有权 | owner only（双方确认） |

### CLI 登录流程

```bash
# 方式 1：OAuth（推荐）
$ openclaw hub login
Opening browser for authentication...
✅ Logged in as xiaoyue (via GitHub)
Token saved to ~/.openclaw/hub-credentials.json

# 方式 2：Token 手动输入
$ openclaw hub login --token <token>
✅ Logged in as xiaoyue

# 查看身份
$ openclaw hub whoami
xiaoyue (GitHub) — 12 published assets

# 登出
$ openclaw hub logout
```

### 凭证存储

```json
// ~/.openclaw/hub-credentials.json
{
  "token": "hub_xxxxxxxxxxxx",
  "author": {
    "id": "xiaoyue",
    "name": "小跃",
    "provider": "github"
  },
  "expiresAt": "2026-08-20T00:00:00Z"
}
```

### 包名归属（Scoped Packages）

```
@<author-id>/<slug>
```

| 包全名 | 含义 |
|--------|------|
| `@xiaoyue/fs-event-trigger` | 小跃发布的 fs-event-trigger |
| `@cybernova/web-search` | CyberNova 发布的 web-search |
| `@official/base-config` | 官方发布的 base-config |

**规则：**
- 只有 `xiaoyue` 这个 author 能在 `@xiaoyue/` scope 下发包
- 安装时可省略 scope：`openclaw hub install skill/fs-event-trigger`（如果全局唯一）
- 有冲突时必须带 scope：`openclaw hub install skill/@xiaoyue/web-search`

### 本地未登录时的行为

| 操作 | 未登录 | 已登录 |
|------|--------|--------|
| `hub install` | ✅ 正常安装 | ✅ |
| `hub search` | ✅ 正常搜索 | ✅ |
| `hub publish` | ❌ 拒绝，提示登录 | ✅ |
| `hub uninstall` | ✅ 删本地文件 | ✅ |

安装和搜索不需要登录（npm 也是如此），发布必须登录。

---

## 五、Registry API

Hub Registry 是水产市场的后端服务，CLI 通过它发现和下载包。

### Endpoints

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/registry/search?q=&type=&page=` | 搜索资产 |
| `GET` | `/api/registry/packages/{type}/{slug}` | 包元数据（所有版本） |
| `GET` | `/api/registry/packages/{type}/{slug}/{version}` | 指定版本元数据 |
| `GET` | `/api/registry/packages/{type}/{slug}/{version}/download` | 下载 .tar.gz |
| `POST` | `/api/registry/packages` | 发布新包（需认证） |
| `DELETE` | `/api/registry/packages/{type}/{slug}/{version}` | 删除版本（需认证） |

### 认证

```bash
# 登录获取 token
openclaw hub login

# Token 存储
~/.openclaw/hub-credentials.json
```

---

## 六、Lockfile

记录已安装资产的精确版本，便于复现和更新。

```
~/.openclaw/hub-lock.json
```

```json
{
  "version": 1,
  "installed": {
    "skill/web-search": {
      "version": "2.1.0",
      "installedAt": "2026-02-20T15:00:00Z",
      "integrity": "sha256-abc123...",
      "location": "~/.openclaw/skills/web-search/"
    },
    "trigger/fs-event-trigger": {
      "version": "1.0.0",
      "installedAt": "2026-02-20T15:30:00Z",
      "integrity": "sha256-def456...",
      "location": "~/.openclaw/triggers/fs-event-trigger/"
    }
  }
}
```

---

## 七、发布流程

```bash
# 1. 本地打包 + 验证
openclaw hub pack ./my-skill/
# → 生成 my-skill-1.0.0.tar.gz + 验证 manifest.json

# 2. 发布到 Registry
openclaw hub publish ./my-skill/
# → 上传到 Hub Registry，生成资产页面

# 3. 或者发布已有 .tar.gz
openclaw hub publish ./my-skill-1.0.0.tar.gz
```

### 发布验证清单

```
✓ manifest.json 格式正确
✓ type 字段合法（6 种之一）
✓ version 是合法 semver
✓ 主文件存在（SKILL.md / config.yaml / ...）
✓ 包大小 < 10MB
✓ 无敏感文件（.env / credentials / private keys）
✗ 安全扫描通过（脚本无恶意命令）
```

---

## 八、实施路径

### Phase 1 — Skill Install（最小可用）

**目标**：让 `openclaw hub install skill/<slug>` 跑通。

```
1. 水产市场 API 加 /api/registry/packages 端点（返回 tar.gz 下载链接）
2. 本地实现 `openclaw hub install` 子命令
3. 下载 → 解压到 ~/.openclaw/skills/<slug>/
4. 写入 hub-lock.json
5. 输出安装结果
```

**预计工作量**：1-2 天

### Phase 2 — Config + Trigger

```
1. Config: 安装 + apply（SOUL.md 注入、config merge）
2. Trigger: 安装 + 依赖检查（fswatch/inotifywait）+ 启动提示
3. openclaw hub uninstall + hub list
```

### Phase 3 — Plugin + Channel + Template

```
1. Plugin: npm/node 依赖安装 + gateway 注册
2. Channel: 凭证配置向导
3. Template: workspace 蓝图克隆
4. openclaw hub update 批量更新
```

### Phase 4 — 社区生态

```
1. openclaw hub login（Token 认证）
2. openclaw hub publish（上传到 Registry）
3. 安全审计 + 签名验证
4. 评分/评论 CLI 交互
```

---

## 九、与现有体系的关系

```
                    ┌─────────────────────┐
                    │    clawhub.com      │  ← 社区 Registry（技能为主）
                    │   clawhub CLI       │
                    └────────┬────────────┘
                             │ 兼容
                    ┌────────▼────────────┐
                    │   Agent Hub 水产市场 │  ← 全类型 Registry（6 种资产）
                    │   openclaw hub CLI  │
                    └────────┬────────────┘
                             │ install
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
   ~/.openclaw/skills/ ~/.openclaw/configs/ ~/.openclaw/triggers/
          │                  │                  │
          ▼                  ▼                  ▼
   OpenClaw Skills Scan   config apply      hooks/watcher
```

**clawhub 共存策略：**
- `clawhub install <slug>` → 继续可用，安装到 `./skills/`
- `openclaw hub install skill/<slug>` → 安装到 `~/.openclaw/skills/`（managed）
- Hub Registry 可选兼容 clawhub 包格式（tar.gz + manifest）
- 未来 clawhub 可作为 Hub 的上游源之一
