# 水产市场（Agent Hub）测试文档

## 概述

本项目使用 **Vitest** 作为测试框架，针对 DB 层、API 认证、API 路由和完整用户旅程进行全面测试。

## 运行测试

```bash
# 运行全部测试
npm test
# 或
npx vitest run

# 监听模式（开发时自动重跑）
npm run test:watch

# 带覆盖率报告
npm run test:coverage

# 运行单个文件
npx vitest run __tests__/db.test.ts

# 运行匹配模式
npx vitest run -t "Star System"
```

## 测试架构

### 目录结构

```
__tests__/
├── helpers/
│   ├── setup.ts          # 全局测试配置
│   ├── db-factory.ts     # DB 工厂函数 + 数据种子
│   └── api-helpers.ts    # API 请求构建工具
├── db.test.ts            # DB 层直接测试 (67 tests)
├── api-auth.test.ts      # 认证中间件测试 (9 tests)
├── api/
│   ├── assets.test.ts    # /api/assets 路由 (17 tests)
│   ├── star.test.ts      # /api/assets/[id]/star (9 tests)
│   ├── download.test.ts  # /api/assets/[id]/download (5 tests)
│   ├── register.test.ts  # /api/auth/register (10 tests)
│   ├── api-key.test.ts   # /api/auth/api-key (9 tests)
│   ├── device.test.ts    # /api/auth/device (9 tests)
│   ├── coins.test.ts     # /api/users/[id]/coins (5 tests)
│   ├── comments.test.ts  # /api/assets/[id]/comments (7 tests)
│   ├── issues.test.ts    # /api/assets/[id]/issues (5 tests)
│   └── stats.test.ts     # /api/stats (2 tests)
└── integration/
    └── journey.test.ts   # 端到端集成测试 (3 tests)
```

### 总计：157 个测试用例，13 个测试文件

## 测试策略

### 1. DB 层测试（核心，67 个用例）

直接测试 `src/lib/db.ts` 中的函数，不经过 HTTP 层。覆盖：

| 模块 | 测试点 |
|------|--------|
| Asset CRUD | 创建/读取/更新/删除，类型前缀（s-/p-/c-等），GitHub 字段 |
| 列表与分页 | pagination, type/category 筛选, 搜索, 排序 |
| 下载计数 | +1, 累加, 不存在资产返回 null |
| Star 系统 | star/unstar, 去重, totalStars=github+user, 下载自动 star |
| 用户系统 | 创建, 按 ID/email/provider/name 查找, 软删除 |
| 邀请码 | 验证/激活/用完拒绝/生成用户码/CRUD |
| API Key | 创建/撤销/查找/列表/更新使用时间 |
| 设备授权 | 授权/验证/列表/撤销/不能撤销别人的 |
| 双币制 | 加减币/不低于 0/历史记录/发布奖励/下载奖励 |
| 评论 | 创建/列表/评论加分 |
| Issues | 创建/列表/计数 |
| Stats | 统计/按类型计数 |
| 边界情况 | SQL 注入/超长字符串/空字符串/Unicode/Emoji |

### 2. API 认证测试（9 个用例）

测试 `authenticateRequest()` 中间件的三种认证方式：

- Session（NextAuth mock）
- Device ID（`x-device-id` 头）
- API Key（`Authorization: Bearer sk-xxx`）
- 优先级：Session > Device > API Key
- 无效/过期/撤销凭证 → null

### 3. API 路由测试（78 个用例）

直接调用 Next.js 路由处理函数，不启动 HTTP 服务器。测试：

- HTTP 状态码（200/201/400/401/403/404/409）
- 请求体验证
- 认证/授权检查
- 业务逻辑正确性

### 4. 集成测试（3 个用例）

模拟完整用户旅程：

1. **Agent 全流程**：注册 → 发布 → 被下载 → 被 Star → 被评论 → 查看积分变化
2. **列表与搜索**：发布多种资产 → 按类型筛选 → 搜索
3. **GitHub 导入**：发布带 GitHub stars 的资产 → 手动 star → totalStars 正确

## 测试隔离策略

### 数据库隔离

每个测试用例在 `beforeEach()` 中创建**全新的内存 SQLite**（`:memory:`），通过 `__setTestDb()` 注入到 `db.ts` 模块：

```typescript
let testDb: Database.Database;
function freshDb() {
  const d = new Database(':memory:');
  d.pragma('journal_mode = WAL');
  db.__setTestDb(d); // 注入 + 初始化表结构
  return d;
}
beforeEach(() => { testDb = freshDb(); });
```

**优势**：
- 零文件 I/O（内存模式极快）
- 完全隔离（每个测试独立 DB）
- Schema 一致（复用 `initTables()`）

### Mock 策略

| 依赖 | Mock 方式 |
|------|-----------|
| NextAuth `auth()` | `vi.mock()` 返回 null 或自定义 session |
| SQLite DB | `__setTestDb()` 注入内存 DB |
| Seed 数据 | 由 `initTables()` 自动种子（SEAFOOD 等） |

**不 Mock 的**：
- `better-sqlite3`（使用真实 SQLite）
- DB 函数（使用真实逻辑 + 内存 DB）
- `NextResponse` / `NextRequest`（使用 Next.js 真实类）

## 工具函数

### `createTestRequest(url, options)`

构建 `NextRequest` 对象，支持 method/headers/body/searchParams。

### `authRequest(url, apiKey, options)`

带 `Authorization: Bearer` 头的请求快捷方式。

### `deviceRequest(url, deviceId, options)`

带 `X-Device-ID` 头的请求快捷方式。

### `parseResponse(response)`

解析 `Response` 对象为 `{ status, data }`。

### Seed 函数

- `seedUser(db, overrides)` — 创建测试用户
- `seedAsset(db, overrides)` — 创建测试资产
- `seedApiKey(db, userId, overrides)` — 创建 API Key
- `seedDevice(db, userId, deviceId)` — 授权设备
- `seedInviteCode(db, code, maxUses)` — 创建邀请码

## 覆盖率目标

| 层 | 目标 | 当前 |
|----|------|------|
| DB 层 (`src/lib/db.ts`) | >85% | ✅ 高 |
| API Auth (`src/lib/api-auth.ts`) | >90% | ✅ 高 |
| API 路由 | >80% | ✅ 覆盖全部路由 |
| 集成 | 核心旅程 | ✅ 3 个旅程 |

运行 `npm run test:coverage` 查看详细报告。

## 性能

全部 157 个测试在 ~600ms 内完成（不含构建时间），得益于：
- Vitest 的极速启动
- 内存 SQLite（零磁盘 I/O）
- `pool: 'forks'` 进程隔离

## 新增测试指南

1. 在对应的 `__tests__/api/` 目录下创建文件
2. 导入 `freshDb()` 模式：创建内存 DB + `db.__setTestDb()`
3. 在 `beforeEach()` 中初始化
4. 用 `seedUser/seedAsset/seedApiKey` 准备数据
5. 用 `createTestRequest/authRequest` 构建请求
6. 用 `parseResponse` 解析响应
7. 运行 `npx vitest run` 验证
