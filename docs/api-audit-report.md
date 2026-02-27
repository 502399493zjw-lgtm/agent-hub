# 水产市场（Agent Hub）安全审计与质量审查报告

**审计日期**：2026-02-21
**审计范围**：全部 API 路由、认证系统、DB 层、CLI 工具、前端安全
**项目版本**：当前 main 分支

---

## 🔴 严重（必须立即修复）

### S01 — API Key 明文存储
**文件**：`src/lib/db.ts` (L301-308, L826-834)
**问题**：API Key (`sk-xxx`) 以明文直接存储在 `api_keys` 表的 `key` 字段（PRIMARY KEY）。`findUserByApiKey()` 也是直接用明文 `WHERE key = ?` 查询。如果数据库泄露（SQLite 文件被下载），所有 API Key 立即可用。
**修复建议**：
- 生成 API Key 时，返回给用户明文，但只存储 `sha256(key)` 的 hash 值
- 查询时同样先 hash 再查
- 可保留 key 的前缀 `sk-xxxx...` 用于用户辨识（存储 `key_prefix` 字段）

### S02 — DELETE /api/assets/[id] 完全无认证
**文件**：`src/app/api/assets/[id]/route.ts` (DELETE handler, ~L78-95)
**问题**：DELETE handler 没有调用 `authenticateRequest()`，任何人都可以删除任意资产。这是最严重的权限漏洞。
**修复建议**：
- 添加 `authenticateRequest()` 认证
- 验证当前用户是资产作者或管理员才能删除

### S03 — PUT /api/assets/[id] 缺少所有权校验（IDOR）
**文件**：`src/app/api/assets/[id]/route.ts` (PUT handler, ~L44-75)
**问题**：PUT handler 只检查了用户是否登录+有邀请码，但**不检查用户是否为该资产的作者**。任何已认证用户都可以修改任意资产的所有字段，包括 `authorId`、`authorName` 等——即可以"偷"别人的资产。
**修复建议**：
- 获取 asset 后检查 `asset.author.id === authResult.userId`
- 管理员可以绕过此限制

### S04 — PUT 可篡改 authorId/authorName/authorAvatar
**文件**：`src/lib/db.ts` `updateAsset()` (L530-560)
**问题**：`updateAsset()` 接受 `authorId`、`authorName`、`authorAvatar` 作为可更新字段，且 PUT handler 直接把 `body` 传入。攻击者可以通过 PUT 请求将任意资产的作者改为自己（即使修复了 S03，也应该把这些字段从可更新列表中移除）。
**修复建议**：
- 从 `updateAsset` 的可更新字段中移除 `authorId`、`authorName`、`authorAvatar`
- 或在 API 层过滤掉这些字段再传入

### S05 — Device ID 认证可被伪造
**文件**：`src/lib/api-auth.ts` (L42-48), `src/lib/db.ts` `validateDevice()` (L879-883)
**问题**：Device ID 认证仅检查 `X-Device-ID` header 中的值是否在 `authorized_devices` 表中。Device ID 本身就是一个长随机字符串，但：
1. 它在 `listAuthorizedDevices()` 中只截断显示（`slice(0,12) + '...'`），但完整值存储在 DB 中
2. 如果攻击者知道某用户的 device ID（比如通过日志泄露、网络抓包等），就能完全冒充该用户
3. 没有任何额外校验（IP 绑定、过期时间、使用次数限制等）
**修复建议**：
- 给 device 认证加上过期时间（如 90 天）
- 考虑添加 IP 白名单或 refresh token 机制
- Device ID 应该用更长的随机值（当前取决于客户端生成）

### S06 — Admin Secret 时序攻击
**文件**：`src/app/api/admin/invite/route.ts` (L4-8)
**问题**：`isAdmin()` 使用 `secret === adminSecret` 进行直接字符串比较，存在时序攻击风险。攻击者可通过响应时间差异逐字符暴力破解 admin secret。
**修复建议**：
- 使用 `crypto.timingSafeEqual()` 进行常量时间比较
- 或使用 HMAC 比较

---

## 🟡 中等（应当修复）

### M01 — 全局无 Rate Limiting
**文件**：所有 API 路由
**问题**：整个项目没有任何速率限制。关键风险点：
- `POST /api/auth/register`：可以无限注册账号（只要有有效邀请码）
- `POST /api/auth/invite/validate`：可以暴力破解邀请码（7 位大写字母 = 26^7 ≈ 80 亿种可能，但如果码是有规律的，可能更少）
- `POST /api/assets/upload`：可以无限上传占满磁盘
- `GET /api/search`：可以发起搜索 DoS
**修复建议**：
- 添加全局 rate limiter（如 `upstash/ratelimit` 或简单的内存 rate limiter）
- 对注册、邀请码验证等敏感接口添加更严格的限制（如每 IP 每分钟 5 次）

### M02 — 邀请码缺少暴力破解防护
**文件**：`src/app/api/auth/invite/validate/route.ts`, `src/app/api/auth/register/route.ts`
**问题**：
- 邀请码验证接口 `POST /api/auth/invite/validate` 完全公开，无认证
- 邀请码为 7 位大写字母，熵值有限
- 没有失败次数限制或锁定机制
- 超级邀请码可能有可预测的规律
**修复建议**：
- 添加 rate limiting（每 IP 每分钟最多 3-5 次验证尝试）
- 考虑增加邀请码长度或混入数字
- 记录失败次数，超过阈值临时封禁 IP

### M03 — 上传路由缺少文件大小/类型限制
**文件**：`src/app/api/assets/upload/route.ts`
**问题**：上传路由虽然需要认证，但没有限制：
- 文件大小上限（可以上传超大文件耗尽磁盘）
- 文件类型白名单
- 单用户上传频率
- 总存储配额
**修复建议**：
- 添加文件大小上限（如 10MB）
- 添加文件类型白名单
- 设置用户存储配额

### M04 — 错误日志泄露内部信息
**文件**：多个 API 路由的 catch 块
**问题**：多个路由在 catch 块中使用 `console.error('...error:', err)`，这会将完整的错误堆栈（包括文件路径、数据库路径等）输出到服务器日志。虽然不直接返回给客户端，但如果日志系统配置不当，可能泄露敏感信息。
- `src/app/api/auth/register/route.ts`：`console.error('POST /api/auth/register error:', err)`
- `src/app/api/assets/[id]/route.ts`：多处 `console.error`
**修复建议**：
- 使用结构化日志库（如 pino）
- 生产环境中不输出完整错误对象

### M05 — JWT 无自定义过期时间
**文件**：`src/lib/auth.ts` (NextAuth 配置)
**问题**：NextAuth 配置中没有设置自定义的 JWT maxAge 或 session maxAge，使用默认值（30 天）。对于包含用户权限信息的 JWT，30 天可能过长。
**修复建议**：
- 设置合理的 session maxAge（如 7 天）
- 考虑实现 token 轮换（NextAuth 的 `session.updateAge`）

### M06 — 评论和 Issue 的 POST 可以伪造 authorId
**文件**：`src/app/api/assets/[id]/comments/route.ts`, `src/app/api/assets/[id]/issues/route.ts`
**问题**：评论和 Issue 的 POST handler 虽然使用了 `authenticateRequest()`，但它们从请求 body 中获取 `authorId`（而非直接使用 `authResult.userId`），只是在不提供 authorId 时用 authResult.userId 作为默认值。攻击者可以在 body 中传入任意 `authorId`，以他人名义发表评论/issue。
**修复建议**：
- 强制使用 `authResult.userId` 作为 authorId，忽略 body 中的 authorId 字段

### M07 — SQLite 并发写入无保护
**文件**：`src/lib/db.ts`
**问题**：虽然启用了 WAL 模式（允许并发读），但 SQLite 仍然是单写者模型。在高并发 POST 请求下（如批量上传、评论），可能出现 `SQLITE_BUSY` 错误。代码中没有重试机制。
**修复建议**：
- 设置 `busy_timeout`（已设置 `PRAGMA busy_timeout = 5000`，这点做得好 ✓）
- 但 5 秒可能不够，考虑增加到 10-30 秒或添加应用层重试

### M08 — 搜索参数 `q` 可能导致 LIKE 注入
**文件**：`src/lib/db.ts` `listAssets()` (L455-457)
**问题**：搜索参数 `q` 通过 `%${params.q}%` 构建 LIKE 模式。虽然使用了 named parameter `@q`，值是安全的，但用户输入中的 `%` 和 `_` 字符是 LIKE 通配符，不会被转义。攻击者可以输入 `%` 来匹配所有记录，或用 `_` 进行模式匹配。
**影响**：低。这不是 SQL 注入（参数化查询是安全的），但可能影响搜索结果的准确性。
**修复建议**：
- 转义 LIKE 通配符：`params.q.replace(/%/g, '\\%').replace(/_/g, '\\_')` 并使用 `ESCAPE '\\'`

### M09 — `POST /api/assets` 创建资产时缺少充分的输入验证
**文件**：`src/app/api/assets/route.ts` (POST handler)
**问题**：创建资产时对 `name`、`description` 等字段没有长度限制、格式校验或恶意内容检测。攻击者可以：
- 创建超长名称或描述（导致 DB 膨胀和前端渲染问题）
- 创建包含特殊字符的名称（可能影响 CLI 工具中的路径操作）
- `type` 字段虽然在 `listAssets` 中做了白名单校验，但在 `createAsset` 中没有校验
**修复建议**：
- 添加输入验证：name（2-100 字符）、description（<500 字符）、type 白名单、tags 数量限制

### M10 — POST /api/assets 创建资产时无 authorId 归属问题
**文件**：`src/app/api/assets/route.ts` (POST handler)
**问题**：POST handler 从请求 body 中获取 `authorId`，虽然它也使用 `authResult.userId` 作为默认值。但如果用户在 body 中显式传入不同的 `authorId`，代码会直接使用 body 中的值，允许用户冒充他人发布资产。
**修复建议**：
- 强制使用 `authResult.userId` 作为 authorId

### M11 — 超级邀请码生成使用 Math.random()
**文件**：`src/app/api/admin/invite/route.ts` (L50-54)
**问题**：当管理员不提供自定义邀请码时，使用 `Math.random()` 生成 7 位字母码。`Math.random()` 不是密码学安全的随机数生成器，生成的邀请码可能被预测。
**修复建议**：
- 使用 `crypto.randomBytes()` 或 `crypto.getRandomValues()` 生成邀请码

---

## 🟢 低（建议改进）

### L01 — 分页参数缺少上限限制（V1 API）
**文件**：多个 V1 路由
**问题**：
- `src/app/api/v1/assets/route.ts`：`pageSize` 虽然在 `listAssets()` 中被限制为 `Math.min(100, ...)` ✓
- `src/app/api/v1/assets/batch/route.ts`：批量获取接口接受 `ids` 数组但没限制数量
- `src/app/api/users/[id]/coins/route.ts`：`limit` 限制为 `Math.min(limit, 200)` ✓
- `src/app/api/admin/invite/route.ts`：`pageSize` 没有上限限制
**修复建议**：
- 对 batch 接口添加数量上限（如最多 50 个 ID）
- 对 admin invite 列表添加 pageSize 上限

### L02 — 响应格式不一致
**文件**：多个 API 路由
**问题**：不同路由的响应格式不统一：
- 大部分路由使用 `{ success: true, data: {...} }` ✓
- `GET /api/assets` 返回 `{ assets: [], total, page, pageSize }` 而不是 `{ success: true, data: { assets: [...] } }`
- `GET /api/search` 返回 `{ results: [], total }`
- `GET /api/stats` 返回 `{ stats: {...} }`
- V1 路由有自己的格式（`{ data: [...], meta: {...} }`）
**修复建议**：
- 统一内部 API 的响应包装格式
- V1 公开 API 可以保持独立格式但应一致

### L03 — DB Migration 使用 try/catch ALTER TABLE
**文件**：`src/lib/db.ts` (L313-380)
**问题**：使用 `try { db.exec('ALTER TABLE ... ADD COLUMN ...') } catch {}` 方式进行 migration。这种方式：
- 静默吞掉所有错误（不仅仅是"列已存在"）
- 无法追踪 migration 版本
- 如果 ALTER 因其他原因失败（如磁盘满），也会被忽略
**修复建议**：
- 使用 migration 版本表（`schema_version`）
- 执行 migration 前先检查列是否存在（`PRAGMA table_info`）
- 记录 migration 日志

### L04 — 无外键约束
**文件**：`src/lib/db.ts` (表创建语句)
**问题**：所有表之间没有外键约束（SQLite 默认不启用 FOREIGN_KEY）。例如：
- `assets.author_id` 不引用 `users.id`
- `comments.author_id` 不引用 `users.id`
- `user_stars.user_id` 不引用 `users.id`
- 删除用户时不会级联删除其资产、评论等
**修复建议**：
- 启用 `PRAGMA foreign_keys = ON`
- 添加外键约束和级联删除策略

### L05 — 用户 ID 生成使用 Math.random()
**文件**：`src/lib/auth.ts` `generateUserId()`, `src/app/api/auth/register/route.ts` `generateUserId()`
**问题**：两处 `generateUserId()` 都使用 `Date.now().toString(36) + Math.random().toString(36).substring(2, 8)`。`Math.random()` 不是密码学安全的，理论上可以预测 user ID。虽然 user ID 不是 secret，但可预测的 ID 可能在某些场景下被利用。
**修复建议**：
- 使用 `crypto.randomUUID()` 或 `crypto.randomBytes()`

### L06 — Asset ID 使用短随机字符串
**文件**：`src/lib/db.ts` `createAsset()` (L484-486)
**问题**：Asset ID 格式为 `{prefix}-{6位随机字符}`（如 `s-a3b2c1`），使用 `Math.random().toString(36).substring(2, 8)`。
- 熵值较低（约 31 bits），在大量资产时可能冲突
- 可枚举（攻击者可以遍历所有可能的 ID）
**修复建议**：
- 增加随机部分长度（至少 12 位）
- 使用 `crypto.randomBytes()` 生成

### L07 — `GET /api/users/[id]/coins` 无认证
**文件**：`src/app/api/users/[id]/coins/route.ts`
**问题**：任何人可以查看任意用户的虾币和信誉值余额及历史。虽然这可能是故意公开的（类似 GitHub profile），但 coin 历史可能包含敏感的操作记录。
**修复建议**：
- 如果是公开信息，可以保持现状
- 如果历史记录包含敏感信息，只返回余额（公开），限制历史访问

### L08 — `GET /api/users/[id]` 无认证
**文件**：`src/app/api/users/[id]/route.ts`
**问题**：任何人可以查看任意用户的资料。这可能是故意公开的，但需确认不返回敏感信息。
**修复建议**：确认返回的字段不包含 email 等敏感信息（从代码看，只返回了公开字段 ✓）

### L09 — CLI 工具 token 以明文存储在磁盘
**文件**：`tools/seafood-market.sh`
**问题**：CLI 工具将 API Key 存储在 `~/.config/seafood-market/config` 文件中，以明文形式。如果用户的 home 目录被入侵，API Key 会泄露。
**修复建议**：
- 使用操作系统的密钥链（macOS Keychain、Linux Secret Service）
- 或至少限制文件权限为 `600`（从代码看已经设置了 `chmod 600` ✓）

### L10 — GitHub Import 工具缺少错误处理
**文件**：`tools/github-import.ts`
**问题**：
- GitHub API 请求失败时只打印错误但继续执行
- 没有重试机制
- rate limiting 处理不够健壮
**修复建议**：
- 添加重试逻辑和指数退避
- 更好地处理 GitHub API rate limit

### L11 — 缺少 CORS 配置
**文件**：所有 API 路由
**问题**：没有显式的 CORS 配置。Next.js App Router 默认不添加 CORS headers，这意味着浏览器跨域请求会被阻止。V1 API 作为公开 API 可能需要 CORS 支持。
**修复建议**：
- 为 V1 API 添加适当的 CORS headers
- 使用 Next.js middleware 统一配置

### L12 — `GET /api/github` 路由可能被滥用代理 GitHub API
**文件**：`src/app/api/github/route.ts`
**问题**：该路由作为 GitHub API 的代理，接受 `url` 参数并转发请求。虽然只接受 `https://api.github.com` 开头的 URL，但：
- 使用服务端的 `GITHUB_TOKEN` 发起请求（可能暴露 GitHub token 的 rate limit）
- 没有认证要求，任何人都可以通过它访问 GitHub API
**修复建议**：
- 添加认证要求
- 限制可代理的 GitHub API 端点（白名单）
- 添加 rate limiting

### L13 — 前端 XSS 风险（需进一步确认）
**文件**：前端组件（未在本次审计范围内详细审查）
**问题**：
- 用户输入的资产名称、描述、README 等通过 API 存储后，在前端渲染时是否有转义？
- Next.js/React 默认会转义 JSX 中的字符串 ✓
- 但如果使用 `dangerouslySetInnerHTML` 渲染 README（Markdown），则可能有 XSS 风险
**修复建议**：
- 确保 Markdown 渲染器使用安全的 sanitizer（如 DOMPurify）
- 检查前端是否有 `dangerouslySetInnerHTML` 使用

### L14 — NextAuth CSRF 保护
**文件**：`src/lib/auth.ts`
**问题**：NextAuth v5 自带 CSRF 保护（使用 double-submit cookie 模式）。这点是安全的 ✓。但自定义的 API 路由（非 NextAuth 端点）没有额外的 CSRF 保护。由于这些 API 主要通过 JSON body + `Content-Type: application/json` 调用，浏览器的同源策略提供了一定保护。
**修复建议**：
- 对于状态修改的 API（POST/PUT/DELETE），考虑检查 `Content-Type` 或 `Origin` header

---

## 📊 统计汇总

### 路由总览

| 分类 | 路由数 | 需认证 | 无认证 |
|------|--------|--------|--------|
| /api/assets/* | 8 | 5 (POST, PUT, upload, comment POST, star) | 3 (GET list, GET detail, download, raw, issues GET) |
| /api/auth/* | 10 | 5 (me, device, invite, api-key, cli, account, onboarding) | 5 (register, [...nextauth], invite/validate, invite/activate) |
| /api/admin/* | 1 | 1 (admin secret) | 0 |
| /api/v1/* | 9 | 0 | 9 (全部公开只读) |
| /api/其他 | 7 | 2 (dashboard, notifications) | 5 (search, stats, users, coins, github, evolution) |
| **合计** | **35** | **13** | **22** |

### 认证方式使用统计
- NextAuth session（Web 浏览器）: 所有需认证的路由支持
- Device ID（X-Device-ID header）: 通过 `authenticateRequest()` 的路由支持
- API Key（Bearer sk-xxx）: 通过 `authenticateRequest()` 的路由支持
- Admin Secret（x-admin-secret header）: 仅 admin/invite 路由

### 问题汇总

| 严重级别 | 数量 |
|----------|------|
| 🔴 严重 | 6 |
| 🟡 中等 | 11 |
| 🟢 低 | 14 |
| **总计** | **31** |

### 优先修复建议（按影响排序）

1. **S02** DELETE 无认证 → 紧急修复
2. **S03** PUT 无所有权校验 → 紧急修复
3. **S04** updateAsset 可篡改 authorId → 紧急修复
4. **S01** API Key 明文存储 → 高优先级
5. **M06** 评论/Issue 可伪造 authorId → 高优先级
6. **M10** 创建资产可伪造 authorId → 高优先级
7. **M01** 全局无 Rate Limiting → 中优先级
8. **S05** Device ID 无过期/绑定 → 中优先级
9. **S06** Admin Secret 时序攻击 → 中优先级
10. **M02** 邀请码暴力破解防护 → 中优先级

---

## 附录：各路由审计详情

### 安全的设计模式 ✅

1. **SQL 参数化查询**：全部使用 better-sqlite3 的 `.prepare().run/get/all()` 配合参数绑定，无直接 SQL 拼接 ✓
2. **listAssets 的 ORDER BY**：虽然使用字符串插值 `ORDER BY ${orderBy}`，但 `orderBy` 来自 switch 的硬编码值，安全 ✓
3. **listAssets 的 pageSize 限制**：`Math.min(100, Math.max(1, ...))` ✓
4. **WAL 模式 + busy_timeout**：SQLite 配置合理 ✓
5. **API Key 使用 crypto.randomBytes(16)**：随机性足够（128 bits） ✓
6. **NextAuth CSRF 保护**：自带 double-submit cookie ✓
7. **认证系统三层设计**：session/device/api_key 优先级清晰 ✓
8. **注册时邀请码校验**：流程完整，先验证再创建 ✓
9. **软删除用户被拒登录**：`deleted_at` 检查 ✓
10. **CLI 工具 config 文件权限**：`chmod 600` ✓
