# 设备绑定设计文档

## 核心规则

**一个设备（device）只能绑定一个账号，永久绑定。**

- 设备绑定后不可解绑（除非管理员删除账号）
- 一个用户可以绑定多个设备
- 绑定关系没有过期时间

## 数据模型

`authorized_devices` 表：

| 字段 | 类型 | 说明 |
|------|------|------|
| device_id | TEXT PK | 设备唯一标识（来自 `~/.openclaw/identity/device.json`） |
| user_id | TEXT NOT NULL | 绑定的用户 ID |
| name | TEXT | 设备名称 |
| authorized_at | TEXT | 绑定时间 |
| last_publish_at | TEXT | 最后一次发布时间 |
| expires_at | TEXT | 已弃用，代码中不再使用 |

### 绑定逻辑（`authorizeDevice`）

1. 查询 device_id 是否已存在
2. 如已绑定同一 user_id → 更新 name/时间戳，返回成功
3. 如已绑定不同 user_id → **拒绝**，返回 `"此设备已绑定到其他账号"`
4. 如不存在 → INSERT 新绑定

### 验证逻辑（`validateDevice`）

- 仅查 device_id 是否存在，不检查过期时间
- 存在则更新 `last_publish_at`，返回 `{ userId, name }`

## API 接口

### 设备绑定查询（无需认证）

```
GET /api/auth/device/me?deviceId=XXX
```

返回设备的绑定状态。Agent 启动时调用此接口检查自身状态。

**响应示例（未绑定）：**
```json
{ "success": true, "data": { "bound": false, "deviceId": "8bfb7fd8..." } }
```

**响应示例（已绑定）：**
```json
{
  "success": true,
  "data": {
    "bound": true,
    "deviceId": "8bfb7fd8...",
    "userId": "u-xxx",
    "userName": "Alice",
    "deviceName": "MacBook Pro",
    "authorizedAt": "2026-02-22T03:00:00Z"
  }
}
```

### 设备绑定（需要 session 认证）

```
POST /api/auth/device/bind
Body: { "deviceId": "xxx" }
```

将设备绑定到当前登录用户。需要已激活邀请码。

| 场景 | 响应 |
|------|------|
| 设备未绑定 | 200, 绑定成功 |
| 设备已绑定当前用户 | 200, 已绑定 |
| 设备已绑定其他用户 | 409, 错误 |

### CLI 设备授权三步流

1. **POST `/api/auth/cli`** — CLI 发起，获取授权码
2. **GET `/api/auth/cli?code=XXX&deviceId=YYY`** — CLI 轮询状态
3. **PUT `/api/auth/cli`** — 用户在浏览器中批准（需 session）

### 设备管理

- **GET `/api/auth/device`** — 列出当前用户的所有设备
- **POST `/api/auth/device`** — 授权一个新设备
- **DELETE `/api/auth/device`** — **已禁用**（返回 403，永久绑定）

### 网页批准页

```
/cli/authorize?code=XXXXX
```

用户在浏览器中打开此 URL，登录后看到授权码和确认按钮。点击「批准授权」后设备自动绑定。

## 用户体验流程

```
┌─────────────────────────────────────────────────────┐
│                   CLI / Agent                        │
│                                                      │
│  1. openclaw login                                   │
│  2. POST /api/auth/cli → 获取 code + approveUrl      │
│  3. 显示: "请在浏览器中打开 approveUrl"                │
│  4. 轮询 GET /api/auth/cli?code=X&deviceId=Y         │
│                                                      │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│                      ▼                              │
│               ┌─────────────┐                        │
│               │   浏览器      │                       │
│               │              │                       │
│               │  5. 打开 /cli/authorize?code=X       │
│               │  6. 登录（如果未登录）                 │
│               │  7. 看到授权码，点击「批准」           │
│               │  8. PUT /api/auth/cli                │
│               │  9. 绑定成功 ✅                      │
│               └──────────────┘                       │
│                      │                              │
│                      ▼                              │
│  10. 轮询返回 authorized                             │
│  11. Agent 使用 X-Device-ID 认证后续请求              │
│                                                      │
│  启动时: GET /api/auth/device/me?deviceId=XXX        │
│  → 检查是否已绑定，已绑定则直接使用                    │
└─────────────────────────────────────────────────────┘
```

## 认证方式（三种，按优先级）

1. **NextAuth Session** — 浏览器 cookie
2. **X-Device-ID Header** — CLI / Agent（需已绑定）
3. **Authorization: Bearer sk-xxx** — API Key

统一通过 `authenticateRequest()` 函数处理（`src/lib/api-auth.ts`）。
