# 手动部署指南（无 Docker）

## 📋 前置要求

### 服务器环境
- **Node.js**: 22+ (推荐使用 nvm 管理)
- **系统**: Linux (Ubuntu/CentOS 等)
- **构建工具**: Python 3, make, g++ (用于 better-sqlite3 编译)

### 本地环境
- Node.js 22+
- Git

---

## 🚀 部署步骤

### 1. 服务器环境准备

```bash
# 安装 Node.js 22 (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 安装构建工具 (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y python3 build-essential

# 或 CentOS/RHEL
sudo yum install -y python3 gcc-c++ make

# 验证安装
node -v  # 应显示 v22.x.x
npm -v
```

### 2. 本地构建

```bash
# 在本地开发机器上
cd /path/to/agent-hub

# 安装依赖
npm install

# 构建生产版本
npm run build

# 检查构建产物
ls -lh .next/standalone/
ls -lh .next/static/
```

### 3. 打包上传

```bash
# 创建部署包
tar -czf agent-hub-deploy.tar.gz \
  .next/standalone/ \
  .next/static/ \
  public/ \
  package.json

# 上传到服务器
scp agent-hub-deploy.tar.gz user@your-server:/opt/agent-hub/

# 上传环境变量文件
scp .env.prod user@your-server:/opt/agent-hub/.env.local
```

### 4. 服务器部署

```bash
# SSH 到服务器
ssh user@your-server

# 解压部署包
cd /opt/agent-hub
tar -xzf agent-hub-deploy.tar.gz

# 将 standalone 内容移到当前目录
cd .next/standalone
mv * ../../
cd ../..

# 复制静态资源（standalone 模式需要手动复制）
# standalone 目录的 .next 只有服务端代码，需要把完整的 static 复制进去
mkdir -p .next
cp -r .next/static/ .next/

# 创建数据目录
mkdir -p data

# 设置环境变量（如果还没有）
# .env.local 应该已通过 scp 上传
```

### 5. 使用 PM2 管理进程

```bash
# 安装 PM2 (全局)
npm install -g pm2

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'agent-hub',
    script: 'node',
    args: 'server.js',
    cwd: '/opt/agent-hub',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOSTNAME: '0.0.0.0',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    env_file: '/opt/agent-hub/.env.local',
    error_file: '/opt/agent-hub/logs/error.log',
    out_file: '/opt/agent-hub/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};
EOF

# 创建日志目录
mkdir -p logs

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs agent-hub

# 设置开机自启
pm2 startup
pm2 save
```

### 6. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt-get install -y nginx  # Ubuntu/Debian
# sudo yum install -y nginx     # CentOS/RHEL

# 创建 Nginx 配置
sudo tee /etc/nginx/sites-available/agent-hub << 'EOF'
server {
    listen 80;
    server_name openclawmp.cc www.openclawmp.cc;

    # 如果需要 HTTPS，使用 certbot
    # listen 443 ssl http2;
    # ssl_certificate /etc/letsencrypt/live/openclawmp.cc/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/openclawmp.cc/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态资源缓存
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
sudo ln -s /etc/nginx/sites-available/agent-hub /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 7. 配置 SSL (Let's Encrypt)

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d openclawmp.cc -d www.openclawmp.cc

# 自动续期
sudo certbot renew --dry-run
```

---

## 📝 环境变量配置

### 生产环境 `.env.local`

创建 `/opt/agent-hub/.env.local`：

```bash
# ── 应用 URL ───────────────────────────────────
NEXTAUTH_URL=https://openclawmp.cc

# ── 认证配置 ──────────────────────────────────
AUTH_SECRET=your-secret-key
AUTH_GITHUB_ID=your-github-id
AUTH_GITHUB_SECRET=your-github-secret
AUTH_RESEND_KEY=your-resend-key
AUTH_EMAIL_FROM=noreply@openclawmp.cc

# ── 管理员配置 ─────────────────────────────────
ADMIN_SECRET=your-admin-secret

# ── 运行时配置 ─────────────────────────────────
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# ── Next.js 配置 ───────────────────────────────
NEXT_TELEMETRY_DISABLED=1

# ── 可选配置 ───────────────────────────────────
# DATABASE_URL=/opt/agent-hub/data/hub.db
# GITHUB_TOKEN=your-github-token
```

---

## 🔄 更新部署

### 自动化更新脚本

创建 `/opt/agent-hub/update.sh`：

```bash
#!/bin/bash
set -e

echo "🔄 开始更新 Agent Hub..."

# 备份数据库
echo "📦 备份数据库..."
cp data/hub.db data/hub.db.backup-$(date +%Y%m%d-%H%M%S)

# 下载新版本
echo "⬇️  下载新版本..."
cd /tmp
scp user@build-server:/path/to/agent-hub-deploy.tar.gz .

# 停止服务
echo "🛑 停止服务..."
pm2 stop agent-hub

# 备份当前版本
echo "💾 备份当前版本..."
cd /opt/agent-hub
tar -czf ../agent-hub-backup-$(date +%Y%m%d-%H%M%S).tar.gz .

# 解压新版本
echo "📂 解压新版本..."
tar -xzf /tmp/agent-hub-deploy.tar.gz

# 移动文件
cd .next/standalone
mv * ../../
cd ../..
cp -r .next/static/ .next/

# 启动服务
echo "🚀 启动服务..."
pm2 start agent-hub

# 检查状态
sleep 3
pm2 status agent-hub

echo "✅ 更新完成！"
```

使用：
```bash
chmod +x /opt/agent-hub/update.sh
./update.sh
```

---

## 🔍 常见问题

### 1. better-sqlite3 编译失败

```bash
# 确保安装了构建工具
sudo apt-get install -y python3 build-essential

# 重新安装依赖
npm rebuild better-sqlite3
```

### 2. 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000

# 修改 .env.local 中的 PORT
PORT=3001
```

### 3. 数据库权限问题

```bash
# 确保数据目录权限正确
chmod 755 /opt/agent-hub/data
chmod 644 /opt/agent-hub/data/hub.db
```

### 4. PM2 进程异常

```bash
# 查看详细日志
pm2 logs agent-hub --lines 100

# 重启进程
pm2 restart agent-hub

# 完全重启 PM2
pm2 kill
pm2 start ecosystem.config.js
```

### 5. Nginx 502 错误

```bash
# 检查 Node 进程是否运行
pm2 status

# 检查端口监听
netstat -tlnp | grep 3000

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

---

## 📊 监控和维护

### PM2 监控

```bash
# 实时监控
pm2 monit

# 查看资源使用
pm2 list

# 查看详细信息
pm2 describe agent-hub
```

### 日志管理

```bash
# 查看应用日志
pm2 logs agent-hub

# 清空日志
pm2 flush

# 日志轮转 (logrotate)
sudo tee /etc/logrotate.d/agent-hub << 'EOF'
/opt/agent-hub/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    copytruncate
}
EOF
```

### 数据库维护

```bash
# 定期备份数据库
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * cp /opt/agent-hub/data/hub.db /opt/agent-hub/backups/hub.db-$(date +\%Y\%m\%d).bak

# 保留最近 7 天的备份
0 3 * * * find /opt/agent-hub/backups/ -name "hub.db-*.bak" -mtime +7 -delete
```

---

## 🚨 回滚方案

```bash
# 停止当前版本
pm2 stop agent-hub

# 恢复备份
cd /opt
tar -xzf agent-hub-backup-YYYYMMDD-HHMMSS.tar.gz -C agent-hub/

# 启动服务
cd agent-hub
pm2 start agent-hub

# 检查状态
pm2 logs agent-hub
```

---

## 📚 对比：Docker vs 手动部署

| 特性 | Docker 部署 | 手动部署 |
|------|------------|---------|
| **环境隔离** | ✅ 完全隔离 | ❌ 共享系统 |
| **部署速度** | ⚡ 快（镜像） | 🐢 慢（构建） |
| **依赖管理** | ✅ 自包含 | ⚠️ 需手动安装 |
| **资源占用** | 📦 较高 | 💾 较低 |
| **回滚** | ✅ 简单 | ⚠️ 需备份 |
| **维护成本** | 🎯 低 | 🔧 中等 |
| **调试** | ⚠️ 需进容器 | ✅ 直接访问 |

**建议**：除非有特殊需求（如极低资源限制），推荐继续使用 Docker 部署。
