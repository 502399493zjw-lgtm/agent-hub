# 零停机部署方案

> 版本：v1.0 | 2026-02-22
> 目标：本地 build + 推镜像 + 蓝绿切换，零停机

---

## 架构

```
用户请求
  │
  ▼
Cloudflare Tunnel → ECS:80
  │
  ▼
Nginx (反向代理)
  ├── upstream: 127.0.0.1:3000 (blue)  ← 当前活跃
  └── upstream: 127.0.0.1:3001 (green) ← 新版本
  │
  ▼
SQLite DB: /opt/agent-hub/data/hub.db (共享 volume)
```

**核心思路：Nginx 做流量网关，蓝绿两个容器交替部署。**

---

## 组件说明

### 1. Nginx（ECS 上常驻）

```nginx
# /etc/nginx/conf.d/agent-hub.conf

upstream agent_hub {
    server 127.0.0.1:3000;  # 部署脚本动态改这行
}

server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://agent_hub;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }

    # 健康检查端点
    location /health {
        proxy_pass http://agent_hub/api/assets?page_size=1;
    }
}
```

Cloudflare Tunnel 指向 ECS:80（Nginx），不再直连 3000。

### 2. 本地 build（Mac ARM → linux/amd64）

```bash
docker buildx build \
  --platform linux/amd64 \
  -t agent-hub:latest \
  --load \
  .
```

### 3. 镜像传输

```bash
docker save agent-hub:latest | gzip > /tmp/agent-hub.tar.gz
scp /tmp/agent-hub.tar.gz root@ECS:/opt/agent-hub.tar.gz
ssh root@ECS "docker load < /opt/agent-hub.tar.gz"
```

### 4. 蓝绿切换

```
部署前状态:  Nginx → :3000 (blue, running)  |  :3001 (green, stopped)

Step 1: 启动新版本到 green 端口
  docker run -d --name agent-hub-green -p 3001:3000 ... agent-hub:latest

Step 2: 健康检查
  curl -sf http://localhost:3001/api/assets → 200 OK

Step 3: Nginx 切流量
  sed -i 's/server 127.0.0.1:3000/server 127.0.0.1:3001/' /etc/nginx/conf.d/agent-hub.conf
  nginx -s reload    ← 这步零停机，Nginx reload 是 graceful 的

Step 4: 停旧容器
  docker rm -f agent-hub-blue

Step 5: 角色对调（为下次部署准备）
  记录当前活跃端口到 /opt/agent-hub/.active-port
```

---

## 部署脚本设计

```bash
#!/usr/bin/env bash
# deploy-v2.sh — 零停机部署

# ── 阶段 1: 本地 ──────────────────────────────
# 1.1 交叉编译 build
# 1.2 SQLite WAL checkpoint（如需同步 DB）
# 1.3 docker save + gzip
# 1.4 scp 镜像到 ECS

# ── 阶段 2: ECS 远程 ─────────────────────────
# 2.1 docker load 加载镜像
# 2.2 读取当前活跃端口（3000 or 3001）
# 2.3 启动新容器到非活跃端口
# 2.4 健康检查（重试 10 次，间隔 2s）
# 2.5 Nginx 切流量 + reload
# 2.6 停旧容器
# 2.7 记录新的活跃端口
# 2.8 验证外部访问
```

---

## ECS 初始化（一次性）

```bash
# 1. 安装 Nginx
apt update && apt install -y nginx

# 2. 写入配置
cat > /etc/nginx/conf.d/agent-hub.conf << 'EOF'
upstream agent_hub {
    server 127.0.0.1:3000;
}
server {
    listen 80;
    location / {
        proxy_pass http://agent_hub;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 3. 删除默认站点、启动
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl start nginx

# 4. 初始化活跃端口标记
echo "3000" > /opt/agent-hub/.active-port

# 5. Cloudflare Tunnel 改指向 :80（原来是 :3000）
# 在 Cloudflare Dashboard 修改 tunnel 配置
```

---

## SQLite 并发安全

两个容器短暂同时运行时共享同一个 SQLite DB：
- Next.js standalone 用 better-sqlite3（同步写，WAL 模式）
- **WAL 模式允许多读单写**，短暂并存期间读请求不阻塞
- 写请求在旧容器停之前可能有极短的锁竞争（< 1s），可接受
- 如果未来写并发真的成问题 → 迁移 PostgreSQL

---

## 回滚

```bash
# 如果新版有问题，切回旧端口
ssh root@ECS << 'EOF'
  OLD_PORT=$(cat /opt/agent-hub/.active-port)
  # Nginx 切回
  sed -i "s/server 127.0.0.1:.*/server 127.0.0.1:${OLD_PORT};/" \
    /etc/nginx/conf.d/agent-hub.conf
  nginx -s reload
  # 停新容器
  docker rm -f agent-hub-$([ "$OLD_PORT" = "3000" ] && echo "green" || echo "blue")
EOF
```

---

## 对比

| 维度 | 现方案（deploy.sh） | 新方案（deploy-v2.sh） |
|------|---------------------|----------------------|
| 停机时间 | ~10-15s | **0s** |
| Build 位置 | ECS 上（OOM 风险） | **本地 Mac** |
| 传输 | rsync 源码 | docker save/load 镜像 |
| 回滚 | 无 | **Nginx 切端口，秒级** |
| 复杂度 | 低 | 中（多 Nginx 一层） |
| 前提 | 无 | ECS 装 Nginx + 改 Tunnel |

---

_由小跃设计，待指挥官确认后实施_
