#!/usr/bin/env bash
# Agent Hub 一键部署脚本（v2 - 本地 build + 推镜像）
# 用法: ./deploy.sh [--skip-db] [--skip-build]
#
# 流程:
#   1. 本地 docker buildx（交叉编译 linux/amd64）
#   2. docker save + gzip 导出镜像
#   3. scp 镜像到 ECS
#   4. docker load + 重建容器（蓝绿切换，零停机）
#   5. 验证

set -euo pipefail

# ── 配置 ──────────────────────────────────────────
ECS_HOST="root@47.100.235.25"
ECS_DIR="/opt/agent-hub"
LOCAL_DIR="$HOME/.openclaw/workspace/agent-hub"
SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=no"
CONTAINER_NAME="agent-hub"
IMAGE_NAME="agent-hub"
DATA_VOLUME="${ECS_DIR}/data"
LOCAL_IMAGE="/tmp/agent-hub.tar.gz"

SKIP_DB=false
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-db) SKIP_DB=true ;;
    --skip-build) SKIP_BUILD=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# ── 颜色 ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

step() { echo -e "\n${GREEN}▶ $1${NC}"; }
info() { echo -e "  ${CYAN}ℹ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✖ $1${NC}"; exit 1; }

# ── 0. 前置检查 ────────────────────────────────────
step "前置检查..."
docker info >/dev/null 2>&1 || fail "Docker 未运行，请先启动 Docker Desktop"
ssh $SSH_OPTS $ECS_HOST "echo 'SSH OK'" || fail "SSH 连接失败"
echo "  ✅ Docker + SSH 就绪"

# ── 1. 本地 Docker Build（交叉编译）──────────────
if [ "$SKIP_BUILD" = false ]; then
  step "本地 Docker Build（linux/amd64）..."
  cd "$LOCAL_DIR"
  BUILD_START=$(date +%s)
  docker buildx build \
    --platform linux/amd64 \
    -t ${IMAGE_NAME}:latest \
    --load \
    . 2>&1 | tail -20
  BUILD_END=$(date +%s)
  info "Build 耗时: $((BUILD_END - BUILD_START))s"

  step "导出镜像..."
  docker save ${IMAGE_NAME}:latest | gzip > "$LOCAL_IMAGE"
  SIZE=$(du -h "$LOCAL_IMAGE" | cut -f1)
  info "镜像大小: $SIZE"
else
  warn "跳过 build（使用已有镜像）"
  [ -f "$LOCAL_IMAGE" ] || fail "镜像文件不存在: $LOCAL_IMAGE"
fi

# ── 2. SQLite WAL Checkpoint ───────────────────────
if [ "$SKIP_DB" = false ] && [ -f "$LOCAL_DIR/data/hub.db" ]; then
  step "SQLite WAL checkpoint..."
  node -e "
    const Database = require('better-sqlite3');
    const db = new Database('${LOCAL_DIR}/data/hub.db');
    db.pragma('wal_checkpoint(TRUNCATE)');
    const count = db.prepare('SELECT COUNT(*) as c FROM assets').get();
    console.log('  资产数:', count.c);
    db.close();
  " || warn "Checkpoint 失败，继续用当前文件"
fi

# ── 3. 推送镜像到 ECS ─────────────────────────────
step "推送镜像到 ECS..."
SCP_START=$(date +%s)
scp $SSH_OPTS "$LOCAL_IMAGE" "$ECS_HOST:/tmp/agent-hub.tar.gz"
SCP_END=$(date +%s)
info "传输耗时: $((SCP_END - SCP_START))s"

step "ECS 加载镜像..."
ssh $SSH_OPTS $ECS_HOST "docker load < /tmp/agent-hub.tar.gz && rm -f /tmp/agent-hub.tar.gz"
echo "  ✅ 镜像加载完成"

# ── 4. 同步 DB（可选）─────────────────────────────
if [ "$SKIP_DB" = false ] && [ -f "$LOCAL_DIR/data/hub.db" ]; then
  step "同步 DB 到 ECS..."
  ssh $SSH_OPTS $ECS_HOST "mkdir -p ${DATA_VOLUME}"
  # 先停容器防 WAL 锁冲突
  ssh $SSH_OPTS $ECS_HOST "docker stop $CONTAINER_NAME 2>/dev/null || true"
  ssh $SSH_OPTS $ECS_HOST "rm -f ${DATA_VOLUME}/hub.db-wal ${DATA_VOLUME}/hub.db-shm"
  scp $SSH_OPTS "$LOCAL_DIR/data/hub.db" "$ECS_HOST:$DATA_VOLUME/hub.db"
  echo "  ✅ DB 同步完成"
else
  warn "跳过 DB 同步"
fi

# ── 5. 蓝绿部署（零停机）──────────────────────────
step "蓝绿部署..."

# 检查当前运行的是哪个颜色
CURRENT=$(ssh $SSH_OPTS $ECS_HOST "docker inspect -f '{{index .Config.Labels \"deploy.color\"}}' $CONTAINER_NAME 2>/dev/null || echo ''")
if [ "$CURRENT" = "blue" ]; then
  NEW_COLOR="green"
else
  NEW_COLOR="blue"
fi
NEW_CONTAINER="${CONTAINER_NAME}-${NEW_COLOR}"
info "当前: ${CURRENT:-none} → 新: $NEW_COLOR"

# 启动新容器（临时端口）
ssh $SSH_OPTS $ECS_HOST "
  docker rm -f $NEW_CONTAINER 2>/dev/null || true
  docker run -d \
    --name $NEW_CONTAINER \
    --restart unless-stopped \
    -p 3001:3000 \
    --env-file ${ECS_DIR}/.env.local \
    -v ${DATA_VOLUME}:/app/data \
    --label deploy.color=$NEW_COLOR \
    $IMAGE_NAME
"
info "新容器 $NEW_CONTAINER 启动在 :3001"

# 等待健康检查
step "等待新容器就绪..."
READY=false
for i in $(seq 1 15); do
  HEALTH=$(ssh $SSH_OPTS $ECS_HOST "curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/assets 2>/dev/null || echo '000'")
  if [ "$HEALTH" = "200" ]; then
    READY=true
    info "新容器健康检查通过（${i}s）"
    break
  fi
  sleep 1
done

if [ "$READY" = false ]; then
  warn "新容器未就绪，回滚..."
  ssh $SSH_OPTS $ECS_HOST "docker rm -f $NEW_CONTAINER 2>/dev/null || true"
  fail "部署失败，旧容器仍在运行"
fi

# 切换：停旧起新
ssh $SSH_OPTS $ECS_HOST "
  docker stop $CONTAINER_NAME 2>/dev/null || true
  docker rm $CONTAINER_NAME 2>/dev/null || true
  docker stop $NEW_CONTAINER
  docker rm $NEW_CONTAINER
  docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p 3000:3000 \
    --env-file ${ECS_DIR}/.env.local \
    -v ${DATA_VOLUME}:/app/data \
    --label deploy.color=$NEW_COLOR \
    $IMAGE_NAME
"
info "切换完成，$CONTAINER_NAME 运行中 ($NEW_COLOR)"

# ── 6. 验证 ───────────────────────────────────────
step "最终验证..."
sleep 3

STATUS=$(ssh $SSH_OPTS $ECS_HOST "docker inspect -f '{{.State.Status}}' $CONTAINER_NAME 2>/dev/null || echo 'not_found'")
if [ "$STATUS" != "running" ]; then
  fail "容器状态异常: $STATUS"
fi
echo "  ✅ 容器运行正常"

RESULT=$(ssh $SSH_OPTS $ECS_HOST "curl -s http://localhost:3000/api/assets 2>/dev/null | head -c 100" || echo "FAIL")
if echo "$RESULT" | grep -q '"assets"'; then
  echo "  ✅ API 正常"
else
  warn "API 响应异常: $RESULT"
fi

ASSET_COUNT=$(ssh $SSH_OPTS $ECS_HOST "curl -s 'http://localhost:3000/api/assets?page_size=1' 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get(\"total\",\"?\"))'" 2>/dev/null || echo "?")
echo "  📦 资产数: $ASSET_COUNT"

EXT_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "https://openclawmp.cc" 2>/dev/null || echo "000")
if [ "$EXT_STATUS" = "200" ]; then
  echo "  🌐 外部访问正常 (https://openclawmp.cc)"
else
  warn "外部访问状态码: $EXT_STATUS"
fi

# 清理本地镜像文件
rm -f "$LOCAL_IMAGE"

echo -e "\n${GREEN}🎉 部署完成！${NC}"
