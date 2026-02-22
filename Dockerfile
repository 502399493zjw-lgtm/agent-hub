FROM node:22-alpine AS base

# Dependencies stage - install with native build tools for better-sqlite3
FROM base AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --registry=https://registry.npmmirror.com

# Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Data directory for SQLite (do NOT copy hub.db — volume mount provides it)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as root to avoid volume mount permission issues with SQLite
# (mounted /app/data is owned by host root)
# Entrypoint: copy seed DB only if no DB exists in the mounted volume
COPY --chown=nextjs:nodejs data/hub.db /app/data/hub.db.seed
CMD ["sh", "-c", "if [ ! -f /app/data/hub.db ]; then cp /app/data/hub.db.seed /app/data/hub.db; fi; node server.js"]
