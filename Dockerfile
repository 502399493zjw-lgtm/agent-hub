# ═══════════════════════════════════════════════
# CI/CD Optimized Dockerfile for Agent Hub
# 使用预构建产物，无需重新编译
# ═══════════════════════════════════════════════

FROM hub.i.basemind.com/base/node:22-alpine

WORKDIR /app

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

# 安装生产依赖（会安装 Linux 兼容的二进制文件）
# .next/node_modules 中的符号链接会自动指向新安装的依赖
RUN npm install --omit=dev && npm cache clean --force

# 拷贝环境变量文件
COPY --chown=nextjs:nodejs .env .env
COPY --chown=nextjs:nodejs .env.prod .env.prod

# 创建数据目录（SQLite 数据库存放位置）
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# 显式指定数据库路径
# TODO：正式上线前需改为 Docker volume 挂载路径
ENV DATABASE_URL=/app/data/hub.db

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# 切换到非特权用户
USER nextjs

# 启动脚本：加载环境变量并启动服务
# 注意：使用 sh 因为 alpine 没有 bash，且不能直接 source，需要用 . 命令
CMD set -a && \
    . .env && \
    . .env.prod && \
    set +a && \
    node server.js
