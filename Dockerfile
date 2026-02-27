# ═══════════════════════════════════════════════
# CI/CD Optimized Dockerfile for Agent Hub
# 使用预构建产物，无需重新编译
# ═══════════════════════════════════════════════

FROM node:22-alpine AS runner

WORKDIR /app

# 设置生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 拷贝构建产物（来自 GitLab CI artifacts）
COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static
COPY --chown=nextjs:nodejs public ./public

# 拷贝环境变量文件
COPY --chown=nextjs:nodejs .env .env
COPY --chown=nextjs:nodejs .env.prod .env.prod

# 创建数据目录（SQLite 数据库存放位置）
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

# 暴露端口
EXPOSE 3000

# 切换到非特权用户
USER nextjs

# 启动脚本：加载环境变量并启动服务
# 注意：使用 sh 因为 alpine 没有 bash，且不能直接 source，需要用 . 命令
CMD set -a && \
    . .env && \
    . .env.prod && \
    set +a && \
    node server.js
