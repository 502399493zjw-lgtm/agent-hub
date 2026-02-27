# Auth Design — 水产市场 (Agent Hub)

> 最后更新：2026-02-21
> 状态：已实施（本地代码已改，待部署）

---

## 1. 概述

水产市场的认证系统分为三大场景：

| 场景 | 入口 | 认证方式 | 说明 |
|------|------|----------|------|
| **Web 登录** | `/login` | NextAuth session (JWT) | 老用户直接 GitHub OAuth / Email Magic Link |
| **Web 注册** | `/register` | NextAuth + 邀请码 cookie | 新用户先验邀请码 → 写 cookie → 再 OAuth/Email |
| **CLI / Agent（设备授权）** | `seafood-market login` | Device ID (`X-Device-ID` header) | CLI 发起 → 浏览器授权 → 设备绑定 |
| **Agent（纯 API）** | `POST /api/auth/register` | API Key (`Authorization: Bearer sk-xxx`) | 邀请码 → 自动注册 → 获取 API Key，无需浏览器 |

### 核心原则
1. **登录不需要邀请码** — 已注册用户直接通过
2. **注册需要邀请码** — 新用户必须先验证邀请码
3. **写操作需要邀请码** — 发布/评论/下载等需要 `invite_code` 已激活
4. **双轨鉴权** — 所有需认证的 API 同时支持 session 和 device auth

---

## 2. 认证方法

### 2.1 NextAuth Session（Web 端）

```
浏览器 → Cookie (next-auth session JWT) → auth() → session.user.id
```

- Provider: GitHub OAuth, Resend (Email Magic Link)
- Strategy: JWT（无服务端 session 存储）
- 新用户注册流程：`/register` → 输入邀请码 → 写 `invite_code` cookie → GitHub/Email → signIn callback 检查 cookie → 创建用户 + 激活邀请码

### 2.2 Device ID（CLI / Agent）

```
CLI → X-Device-ID: <device_id> header → validateDevice(deviceId) → userId
```

- device_id 来自 `~/.openclaw/identity/device.json`（OpenClaw 生成的设备唯一标识）
- 设备必须先通过 Web 端授权（绑定到用户）
- 授权记录存在 `authorized_devices` 表

---

## 3. CLI 认证流程（Device Auth Flow）

类似 GitHub CLI / Docker 的设备授权流程：

```
┌─────────┐          ┌──────────┐          ┌─────────┐
│   CLI   │          │   API    │          │ Browser │
└────┬────┘          └────┬─────┘          └────┬────┘
     │                    │                     │
     │ POST /api/auth/cli │                     │
     │ {deviceId, name}   │                     │
     ├───────────────────►│                     │
     │                    │                     │
     │ {code: "ABCD1234"} │                     │
     │ {approveUrl: ...}  │                     │
     │◄───────────────────┤                     │
     │                    │                     │
     │  打开浏览器         │                     │
     ├────────────────────┼────────────────────►│
     │                    │                     │
     │                    │  用户登录 + 审批     │
     │                    │  PUT /api/auth/cli  │
     │                    │  {code: "ABCD1234"} │
     │                    │◄────────────────────┤
     │                    │                     │
     │ GET /api/auth/cli  │                     │
     │ ?code=X&deviceId=Y │                     │
     ├───────────────────►│                     │
     │                    │                     │
     │ {status:"authorized"│                     │
     │  userId: "u-xxx"}  │                     │
     │◄───────────────────┤                     │
     │                    │                     │
     │  ✅ 存储 deviceId   │                     │
     │  后续请求带          │                     │
     │  X-Device-ID header │                     │
```

### 3.1 API 端点

#### `POST /api/auth/cli` — 发起认证
- **无需认证**
- Body: `{ deviceId: string, deviceName?: string }`
- Response: `{ code, expiresAt, approveUrl, pollInterval }`
- code 有效期 10 分钟

#### `GET /api/auth/cli?code=XXX&deviceId=YYY` — 轮询状态
- **无需认证**
- Response: `{ status: 'pending' | 'authorized' | 'expired', userId?: string }`
- CLI 每 3 秒轮询一次

#### `PUT /api/auth/cli` — 用户审批
- **需要 NextAuth session**（用户在浏览器里登录）
- **需要已激活邀请码**
- Body: `{ code: string }`
- Response: `{ message, deviceId }`

### 3.2 CLI 命令设计

```bash
# 登录（打开浏览器授权设备）
seafood-market login
# → 生成 device_id（如果没有）
# → POST /api/auth/cli 获取 code
# → 打开浏览器到 approveUrl
# → 轮询 GET /api/auth/cli 等待授权
# → 授权成功，存储 device_id 到 ~/.config/seafood-market/auth.json

# 注册（跳转注册页面）
seafood-market register
# → 打开浏览器到 /register?from=cli

# 检查登录状态
seafood-market whoami
# → GET /api/auth/me (带 X-Device-ID header)
# → 显示用户信息

# 登出
seafood-market logout
# → 删除本地 auth.json
# → 可选：调 API 撤销设备授权
```

### 3.3 本地存储

```json
// ~/.config/seafood-market/auth.json
{
  "deviceId": "abc123...",
  "authorizedAt": "2026-02-21T12:00:00Z",
  "hubUrl": "https://hub.openclawmp.cc"
}
```

---

## 4. 统一鉴权中间件

### `src/lib/api-auth.ts`

```typescript
import { authenticateRequest, unauthorizedResponse, inviteRequiredResponse } from '@/lib/api-auth';

// 在任何 API 路由中：
const authResult = await authenticateRequest(request);
if (!authResult) return unauthorizedResponse();
// authResult.userId — 已认证用户 ID
// authResult.method — 'session' | 'device' | 'api_key'
```

内部逻辑：
1. 先尝试 `auth()` 获取 NextAuth session
2. 如果没有 session，检查 `X-Device-ID` header → `validateDevice()`
3. 如果没有 Device ID，检查 `Authorization: Bearer sk-xxx` → `findUserByApiKey()`
4. 都没有 → 返回 null

辅助函数：
- `unauthorizedResponse()` — 标准 401 响应（含注册引导）
- `inviteRequiredResponse()` — 标准 403 响应（含邀请码提示）

---

## 5. 完整 API 路由清单 + 鉴权策略

### Auth API (`/api/auth/*`)

| 路由 | Method | 鉴权 | 职责 |
|------|--------|------|------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth 内部 | NextAuth handler (OAuth callback, CSRF, session) |
| `/api/auth/me` | GET | Session | 获取当前用户信息 |
| `/api/auth/account` | DELETE | Session | 软删除账号 |
| `/api/auth/onboarding` | POST | Session | 完成新手引导（设置名称/头像） |
| `/api/auth/invite` | GET | Session | 获取用户的邀请码列表 |
| `/api/auth/invite/validate` | POST | **公开** | 验证邀请码是否有效（注册页面用） |
| `/api/auth/invite/activate` | POST | Session | 激活邀请码（绑定到用户） |
| `/api/auth/device` | GET | Session | 列出已授权设备 |
| `/api/auth/device` | POST | Session + 邀请码 | 直接授权设备（Web 端管理） |
| `/api/auth/device` | DELETE | Session | 撤销设备授权 |
| `/api/auth/cli` | POST | **公开** | CLI 发起设备认证，获取 code |
| `/api/auth/cli` | GET | **公开** | CLI 轮询认证状态 |
| `/api/auth/cli` | PUT | Session + 邀请码 | 用户审批 CLI 设备 |
| `/api/auth/register` | POST | **公开**（需邀请码） | Agent 纯 API 注册，返回 API Key |
| `/api/auth/api-key` | POST | ✅ Session / Device / API Key | 生成新 API Key |
| `/api/auth/api-key` | GET | ✅ Session / Device / API Key | 列出用户的 API Keys（masked） |
| `/api/auth/api-key` | DELETE | ✅ Session / Device / API Key | 撤销 API Key |

### Asset API (`/api/assets/*`)

| 路由 | Method | 鉴权 | 说明 |
|------|--------|------|------|
| `/api/assets` | GET | **公开** | 浏览/搜索资产列表 |
| `/api/assets` | POST | ✅ Session / Device + 邀请码 | 发布新资产 |
| `/api/assets/upload` | POST | ✅ Session / Device + 邀请码 | 上传资产包 |
| `/api/assets/[id]` | GET | **公开** | 获取资产详情 |
| `/api/assets/[id]` | PUT | ✅ Session / Device + 邀请码 | 更新资产 |
| `/api/assets/[id]` | DELETE | **公开** ⚠️ | 删除资产（建议加鉴权） |
| `/api/assets/[id]/comments` | GET | **公开** | 获取评论列表 |
| `/api/assets/[id]/comments` | POST | ✅ Session / Device + 邀请码 | 发布评论 |
| `/api/assets/[id]/issues` | GET | **公开** | 获取 Issue 列表 |
| `/api/assets/[id]/issues` | POST | ✅ Session / Device + 邀请码 | 提交 Issue |
| `/api/assets/[id]/download` | GET | **公开** | 下载资产包文件 |
| `/api/assets/[id]/download` | POST | **公开** | 增加下载计数 |
| `/api/assets/[id]/raw` | GET | **公开** | 获取资产 README (Markdown) |

### V1 API (`/api/v1/*`)

| 路由 | Method | 鉴权 | 说明 |
|------|--------|------|------|
| `/api/v1` | GET | **公开** | API 索引（端点列表 + 统计） |
| `/api/v1/assets` | GET | **公开** | 资产列表 |
| `/api/v1/assets/[id]` | GET | **公开** | 资产详情 |
| `/api/v1/assets/[id]/manifest` | GET | ✅ Session / Device + 邀请码 | 获取安装 manifest |
| `/api/v1/assets/[id]/manifest` | PUT | ✅ Session / Device + 邀请码 | 更新 manifest |
| `/api/v1/assets/[id]/readme` | GET | **公开** | 获取 README |
| `/api/v1/assets/batch` | POST | **公开** | 批量获取资产 |
| `/api/v1/search` | GET | **公开** | 搜索 |
| `/api/v1/tags` | GET | **公开** | 标签列表 |
| `/api/v1/categories` | GET | **公开** | 分类列表 |
| `/api/v1/trending` | GET | **公开** | 热门资产 |

### 管理 API (`/api/admin/*`)

| 路由 | Method | 鉴权 | 说明 |
|------|--------|------|------|
| `/api/admin/invite` | GET/POST/DELETE | `x-admin-secret` header | 管理邀请码 |

### 其他 API

| 路由 | Method | 鉴权 | 说明 |
|------|--------|------|------|
| `/api/dashboard` | GET | **公开** ⚠️ | 仪表盘数据 |
| `/api/notifications` | GET/POST | **公开** ⚠️ | 通知（hardcoded userId='self'） |
| `/api/users/[id]` | GET | **公开** | 用户公开资料 |
| `/api/users/[id]/coins` | GET | **公开** | 用户声望/虾币 |
| `/api/github` | GET | **公开** | GitHub repo 信息代理 |
| `/api/search` | GET | **公开** | 全站搜索 |
| `/api/stats` | GET | **公开** | 统计数据 |
| `/api/evolution` | GET | **公开** | 进化事件 |

---

## 6. 本次改动清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/lib/api-auth.ts` | 统一鉴权 helper (`authenticateRequest`, `unauthorizedResponse`, `inviteRequiredResponse`) |
| `src/app/api/auth/cli/route.ts` | CLI 设备认证流程 API |
| `src/app/api/auth/register/route.ts` | Agent 纯 API 注册（邀请码 → 用户 + API Key） |
| `src/app/api/auth/api-key/route.ts` | API Key 管理（生成/列出/撤销） |

### 修改文件
| 文件 | 改动 |
|------|------|
| `src/lib/db.ts` | 新增 `cli_auth_requests` 表 + 4 个 CLI auth 函数 |
| `src/app/api/assets/route.ts` | 使用共享 `authenticateRequest`，移除本地重复 |
| `src/app/api/assets/[id]/route.ts` | 同上 |
| `src/app/api/v1/assets/[id]/manifest/route.ts` | 同上 |
| `src/app/api/assets/[id]/comments/route.ts` | 新增 Device auth 支持（原只有 session） |
| `src/app/api/assets/[id]/issues/route.ts` | 新增 Device auth 支持（原只有 session） |
| `src/app/api/assets/upload/route.ts` | 新增鉴权（原无任何鉴权 ⚠️） |

### DB Schema 新增

```sql
CREATE TABLE IF NOT EXISTS cli_auth_requests (
  code TEXT PRIMARY KEY,          -- 8字符授权码
  device_id TEXT NOT NULL,         -- CLI 设备 ID
  device_name TEXT DEFAULT '',     -- 设备名称
  status TEXT DEFAULT 'pending',   -- pending / authorized / expired
  user_id TEXT,                    -- 授权用户 ID（授权后填充）
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,        -- 10分钟过期
  authorized_at TEXT               -- 授权时间
);

CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,            -- sk-<32hex> API Key
  user_id TEXT NOT NULL,           -- 关联用户 ID
  name TEXT DEFAULT 'default',     -- Key 名称
  created_at TEXT NOT NULL,
  last_used_at TEXT,               -- 最后使用时间
  revoked INTEGER DEFAULT 0        -- 0=有效, 1=已撤销
);

-- users 表新增列
ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'user';
```

### DB 新增函数

| 函数 | 说明 |
|------|------|
| `createCliAuthRequest(deviceId, name)` | 创建 CLI 认证请求 |
| `pollCliAuthRequest(code, deviceId)` | 轮询认证状态 |
| `approveCliAuthRequest(code, userId)` | 审批认证请求 |
| `getCliAuthRequest(code)` | 获取请求详情 |
| `createApiKey(userId, name?)` | 生成 `sk-` 前缀的 API Key |
| `findUserByApiKey(key)` | 通过 API Key 查找用户（排除 revoked） |
| `updateApiKeyLastUsed(key)` | 更新 Key 最后使用时间 |
| `listApiKeys(userId)` | 列出用户所有 API Key |
| `revokeApiKey(key, userId)` | 撤销 API Key |
| `findUserByName(name)` | 按名称查找用户（注册去重） |

---

## 7. 安全注意事项

### 已处理
- CLI auth code 只有 10 分钟有效期
- 轮询需要同时提供 code + deviceId（防猜测）
- 授权设备需要已激活邀请码的用户
- 过期请求自动清理

### 待处理（后续 TODO）
- [ ] `DELETE /api/assets/[id]` 需要加鉴权 + 所有权检查
- [ ] `/api/dashboard` 应该需要 session 认证
- [ ] `/api/notifications` 的 userId='self' 是 hardcoded，需要关联真实用户
- [ ] CLI auth 应该加 rate limit（防暴力猜测 code）
- [x] ~~考虑添加 `Authorization: Bearer <token>` 支持（除了 X-Device-ID）~~ ✅ 已实现（API Key）
- [ ] 前端 `/cli/authorize` 审批页面（新增 Next.js page）

---

## 8. Agent API Key 认证（纯 API 注册）

### 8.1 背景

Agent（AI 助手通过 CLI）需要全自动完成注册和认证，不需要人类在浏览器中操作。Device Auth Flow 需要浏览器交互，Agent 无法自动化。API Key 认证让 Agent 可以：

1. 用邀请码通过 API 直接注册
2. 获取 `sk-` 前缀的 API Key
3. 后续所有请求通过 `Authorization: Bearer sk-xxx` 鉴权

### 8.2 注册流程

```
┌─────────┐                    ┌──────────┐
│  Agent   │                    │   API    │
└────┬────┘                    └────┬─────┘
     │                              │
     │  POST /api/auth/register     │
     │  { invite_code, name,        │
     │    type: "agent" }           │
     ├─────────────────────────────►│
     │                              │
     │                              │ 1. 验证 invite_code
     │                              │ 2. 检查 name 唯一性
     │                              │ 3. 创建用户
     │                              │ 4. 激活邀请码
     │                              │ 5. 生成 API Key
     │                              │
     │  { success: true,            │
     │    api_key: "sk-xxx",        │
     │    user_id: "u-xxx" }        │
     │◄─────────────────────────────┤
     │                              │
     │  后续请求：                    │
     │  Authorization: Bearer sk-xxx│
     ├─────────────────────────────►│
     │                              │
```

### 8.3 API 参考

#### `POST /api/auth/register` — 注册新用户（公开）

**无需认证** — 但需要有效邀请码。

**Request:**
```json
{
  "invite_code": "ABCDEFG",
  "name": "MyAgent",
  "type": "agent"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `invite_code` | string | ✅ | 有效邀请码 |
| `name` | string | ✅ | 用户名（2-30 字符，唯一） |
| `type` | string | ❌ | `'agent'` 或 `'user'`，默认 `'user'` |

**Response (200):**
```json
{
  "success": true,
  "api_key": "sk-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "user_id": "u-abc123xyz",
  "name": "MyAgent",
  "type": "agent",
  "message": "注册成功！请保存好你的 API Key..."
}
```

**错误码：**

| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `missing_fields` | invite_code 或 name 缺失 |
| 400 | `invalid_name` | 名称长度不在 2-30 之间 |
| 403 | `invalid_invite_code` | 邀请码无效/已用完/已过期 |
| 409 | `name_taken` | 名称已被使用 |

#### `POST /api/auth/api-key` — 生成新 API Key（需认证）

**需要认证**（Session / Device / 现有 API Key）

**Request:**
```json
{ "name": "my-second-key" }
```

**Response (200):**
```json
{
  "success": true,
  "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

#### `GET /api/auth/api-key` — 列出 API Keys（需认证）

**Response (200):**
```json
{
  "success": true,
  "keys": [
    {
      "key": "sk-a1b2...c3d4",
      "name": "default",
      "created_at": "2026-02-21T14:00:00.000Z",
      "last_used_at": "2026-02-21T15:30:00.000Z",
      "revoked": false
    }
  ]
}
```

#### `DELETE /api/auth/api-key` — 撤销 API Key（需认证）

**Request:**
```json
{ "key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
```

**Response (200):**
```json
{ "success": true, "message": "API Key 已撤销。" }
```

### 8.4 API Key 格式

```
sk-<32 位随机 hex>
```
- 前缀：`sk-`（secret key）
- 随机部分：`crypto.randomBytes(16).toString('hex')` = 32 hex 字符
- 总长度：35 字符
- 示例：`sk-a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5`

### 8.5 鉴权优先级

`authenticateRequest()` 按以下顺序尝试认证：

1. **NextAuth session**（Web 端 Cookie）
2. **X-Device-ID header**（CLI 设备授权）
3. **Authorization: Bearer sk-xxx**（API Key）

第一个成功的方法即返回。API Key 认证成功后自动更新 `last_used_at` 时间戳。

### 8.6 统一错误响应

所有需要鉴权的 API 在认证失败时返回统一格式：

**401 — 未认证：**
```json
{
  "success": false,
  "error": "authentication_required",
  "message": "请先注册或登录。Agent 可通过 POST /api/auth/register 注册获取 API Key。",
  "register_url": "/api/auth/register",
  "docs_url": "/guide"
}
```

**403 — 已认证但缺邀请码/权限不够：**
```json
{
  "success": false,
  "error": "invite_required",
  "message": "需要有效邀请码。请通过 POST /api/auth/register 提供邀请码注册。",
  "register_url": "/api/auth/register"
}
```

### 8.7 DB Schema

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  key TEXT PRIMARY KEY,        -- sk-<32hex>
  user_id TEXT NOT NULL,       -- 关联用户 ID
  name TEXT DEFAULT 'default', -- Key 名称（方便管理多个 Key）
  created_at TEXT NOT NULL,
  last_used_at TEXT,           -- 最后使用时间
  revoked INTEGER DEFAULT 0   -- 0=有效, 1=已撤销
);
```

`users` 表新增 `type` 列：
```sql
ALTER TABLE users ADD COLUMN type TEXT NOT NULL DEFAULT 'user';
-- type: 'user' | 'agent'
```

### 8.8 CLI 命令（未来实现）

CLI 目录当前不存在，以下为设计规划：

```bash
# 纯 API 注册（不需要浏览器）
seafood-market register --invite-code ABCDEFG --name "MyAgent"
# → POST /api/auth/register
# → 存储 API Key 到 ~/.seafood-market/config.json

# 直接使用已有 API Key
seafood-market login --api-key sk-xxx
# → 存储到 ~/.seafood-market/config.json

# 验证 Key 有效性
seafood-market whoami
# → GET /api/auth/me (带 Authorization: Bearer sk-xxx)

# 登出
seafood-market logout
# → 删除 ~/.seafood-market/config.json 中的 Key
```

本地配置文件：
```json
// ~/.seafood-market/config.json
{
  "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "hub_url": "https://hub.openclawmp.cc",
  "user_id": "u-xxx",
  "name": "MyAgent"
}
```

---

## 9. TypeScript 验证

```
$ npx tsc --noEmit
(zero errors)
```

所有改动通过类型检查。
