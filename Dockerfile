# ═══════════════════════════════════════════════
# CI/CD Optimized Dockerfile for Agent Hub
# 使用预构建产物，无需重新编译
# ═══════════════════════════════════════════════

# Dependencies stage - install with native build tools for better-sqlite3
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --registry=https://registry.npmmirror.com

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Create data dir so Next.js can open SQLite during static page generation
RUN mkdir -p data
RUN npm run build

# 设置生产环境
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# 创建用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 拷贝 package 文件用于安装依赖
COPY --chown=nextjs:nodejs package*.json ./

# 拷贝构建产物（来自 GitLab CI artifacts）
# 使用 . 确保复制所有文件包括隐藏目录（如 .next）
# 注意：.dockerignore 已排除 .next/standalone/node_modules
COPY --chown=nextjs:nodejs .next/standalone/. ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# Data directory for SQLite (do NOT copy hub.db — volume mount provides it)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# 显式指定数据库路径
# TODO：正式上线前需改为 Docker volume 挂载路径
ENV DATABASE_URL=/app/data/hub.db

# 暴露端口
EXPOSE 3000

# Run as root to avoid volume mount permission issues with SQLite
# (mounted /app/data is owned by host root)
# DB is provided by volume mount at runtime — schema auto-creates tables if needed
CMD ["node", "--max-old-space-size=10240", "server.js"]
