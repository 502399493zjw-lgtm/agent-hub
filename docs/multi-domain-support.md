# 多域名支持改造总结

## 改造目标
将应用从单域名（openclawmp.cc）改造为支持多域名访问（openclawmp.cc、seafoodmp.com）。

## 改造内容

### 1. 环境变量配置
**文件：`.env.prod`**
- ❌ 移除：`NEXTAUTH_URL=https://openclawmp.cc`
- ✅ 改为：运行时从请求头动态获取

### 2. 邮件发件人配置
**文件：`.env`**
- 保留：`AUTH_EMAIL_FROM=noreply@openclawmp.cc`
- 说明：邮件发件人域名保持不变，仅作为发送地址使用

**文件：`src/lib/auth.ts`**
- 移除默认值 fallback，强制使用环境变量

### 3. 新增工具函数
**文件：`src/lib/get-base-url.ts`**（新建）
```typescript
// 获取完整基础URL（协议+域名）
export async function getBaseUrl(): Promise<string>

// 从Request对象获取基础URL（用于API Route）
export function getBaseUrlFromRequest(request: Request): string

// 仅获取域名（不含协议）
export async function getCurrentDomain(): Promise<string>
```

### 4. API 路由改造
**文件：`src/app/api/auth/cli/route.ts`**
- ✅ 改造：CLI 授权 URL 动态获取
```typescript
// 原代码
const baseUrl = process.env.NEXTAUTH_URL || 'https://hub.openclawmp.cc';

// 改为
const protocol = request.headers.get('x-forwarded-proto') || 'https';
const host = request.headers.get('host') || request.headers.get('x-forwarded-host') || 'openclawmp.cc';
const baseUrl = `${protocol}://${host}`;
```

### 5. 前端页面改造
**文件：`src/app/client.tsx`（首页）**
- ✅ 示例安装命令：使用 `window.location.host` 动态获取

**文件：`src/app/publish/page.tsx`（发布页）**
- ✅ Agent 提示文案：动态生成域名
- ✅ API 文档：显示当前访问的域名

### 6. SSL 证书
**目录：`ssl/`**
- ✅ openclawmp.cc.pem + openclawmp.cc.key
- ✅ seafoodmp.com.pem + seafoodmp.com.key
- 自签名证书，有效期1年（2026-02-28 至 2027-02-28）

### 7. 部署脚本
**文件：`scripts/server-deploy.sh`**
- ✅ 自动扫描 ssl 目录下所有证书
- ✅ 为每个域名生成独立的 Nginx server 块
- ✅ HTTP 自动重定向到 HTTPS

## 运行机制

### 客户端（浏览器）
```typescript
// 自动使用当前浏览器地址
const domain = window.location.host; // openclawmp.cc 或 seafoodmp.com
```

### 服务端（Next.js）
```typescript
// 从请求头获取实际访问的域名
const headers = await headers();
const host = headers.get('host'); // 反向代理传递的真实域名
```

### Nginx 配置
```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name openclawmp.cc seafoodmp.com;
    return 301 https://$host$request_uri;
}

# HTTPS - openclawmp.cc
server {
    listen 443 ssl http2;
    server_name openclawmp.cc;
    ssl_certificate /etc/ssl/certs/openclawmp-cc.crt;
    ssl_certificate_key /etc/ssl/private/openclawmp-cc.key;
    # ... 反向代理配置
}

# HTTPS - seafoodmp.com
server {
    listen 443 ssl http2;
    server_name seafoodmp.com;
    ssl_certificate /etc/ssl/certs/seafoodmp-com.crt;
    ssl_certificate_key /etc/ssl/private/seafoodmp-com.key;
    # ... 反向代理配置
}
```

## 用户体验

### 访问 openclawmp.cc
- 首页显示：`curl -sL https://openclawmp.cc/api/...`
- 发布页显示：`访问 openclawmp.cc，把我的技能...`
- API 文档显示：`POST https://openclawmp.cc/api/assets`

### 访问 seafoodmp.com
- 首页显示：`curl -sL https://seafoodmp.com/api/...`
- 发布页显示：`访问 seafoodmp.com，把我的技能...`
- API 文档显示：`POST https://seafoodmp.com/api/assets`

## 优势
1. ✅ **无需重新部署**：新增域名只需添加 SSL 证书
2. ✅ **自动适配**：前后端自动使用用户访问的域名
3. ✅ **体验一致**：不同域名功能完全相同
4. ✅ **SEO 友好**：每个域名独立索引
5. ✅ **易于维护**：域名配置集中在 Nginx

## 测试验证
```bash
# 构建测试
npm run build  # ✅ 成功

# 本地测试
npm run dev
# 访问 http://localhost:3000 验证动态域名功能

# 部署测试
bash scripts/build-and-pack.sh
bash scripts/server-deploy.sh
# 分别访问两个域名验证
```

## 注意事项
1. **OAuth 回调**：GitHub OAuth 需要在应用设置中添加两个域名的回调地址
2. **邮件链接**：邮件中的链接会根据用户注册时的域名自动生成
3. **Cookie 域**：不同域名的 Cookie 独立，用户需要在每个域名单独登录
4. **证书更新**：生产环境建议使用 Let's Encrypt 等正规 CA 证书

## 未修改的硬编码
保留以下硬编码域名（不影响多域名功能）：
- GitHub OAuth token 交换代理：`github-oauth.openclawmp.cc`（Cloudflare Worker）
- 文档和工具脚本中的示例域名（仅作为参考）
