#!/bin/bash
# ═══════════════════════════════════════════════
# Build and Pack Script for OpenClaw MP
# 生成构建产物并打包为可部署的 tar.gz
# ═══════════════════════════════════════════════

set -e  # 遇到错误立即退出

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}  OpenClaw MP Build & Pack Tool${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════
# Step 1: 清理旧的构建产物
# ═══════════════════════════════════════════════
echo -e "${YELLOW}[1/5] Cleaning old build artifacts...${NC}"
if [ -d "dist" ]; then
  rm -rf dist
  echo -e "${GREEN}✓ Removed old dist directory${NC}"
fi
mkdir -p dist
echo ""

# ═══════════════════════════════════════════════
# Step 2: 运行构建
# ═══════════════════════════════════════════════
echo -e "${YELLOW}[2/5] Running npm run build...${NC}"
npm run build
if [ $? -ne 0 ]; then
  echo -e "${RED}✗ Build failed!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build completed successfully${NC}"
echo ""

# ═══════════════════════════════════════════════
# Step 3: 验证构建产物
# ═══════════════════════════════════════════════
echo -e "${YELLOW}[3/5] Verifying build artifacts...${NC}"
if [ ! -d ".next/standalone" ]; then
  echo -e "${RED}✗ Standalone output not found!${NC}"
  echo -e "${RED}  Make sure next.config.ts has 'output: \"standalone\"'${NC}"
  exit 1
fi
if [ ! -d ".next/static" ]; then
  echo -e "${RED}✗ Static assets not found!${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Build artifacts verified${NC}"
echo ""

# ═══════════════════════════════════════════════
# Step 4: 准备打包目录
# ═══════════════════════════════════════════════
echo -e "${YELLOW}[4/5] Preparing package directory...${NC}"
PACK_DIR="dist/package"
mkdir -p "$PACK_DIR"

# 复制 standalone 产物
echo "  → Copying standalone output..."
# 使用 . 而不是 * 来确保复制隐藏文件/目录（如 .next）
cp -r .next/standalone/. "$PACK_DIR/"

# 删除根目录的 node_modules（包含平台相关的原生模块）
# 但保留 .next/node_modules 中的符号链接（Next.js 需要这些链接名）
echo "  → Removing root node_modules (platform-specific binaries)..."
if [ -d "$PACK_DIR/node_modules" ]; then
  rm -rf "$PACK_DIR/node_modules"
fi

# 验证并重新创建 .next/node_modules 符号链接（避免 tar 跟随符号链接打包）
echo "  → Recreating .next/node_modules symlinks..."
# 先删除已复制的目录（包含实际文件）
if [ -d "$PACK_DIR/.next/node_modules" ]; then
  rm -rf "$PACK_DIR/.next/node_modules"
fi

# 重新创建符号链接目录
mkdir -p "$PACK_DIR/.next/node_modules"

# 从原始 standalone 输出读取符号链接信息并重建
if [ -d ".next/standalone/.next/node_modules" ]; then
  for link in .next/standalone/.next/node_modules/*; do
    if [ -L "$link" ]; then
      linkname=$(basename "$link")
      # 获取链接目标（相对路径）
      target=$(readlink "$link")
      # 在打包目录中重建符号链接
      ln -s "$target" "$PACK_DIR/.next/node_modules/$linkname"
      echo "     ✓ Created symlink: $linkname -> $target"
    fi
  done
fi

# 复制 static 资源到正确位置
echo "  → Copying static assets..."
mkdir -p "$PACK_DIR/.next"
cp -r .next/static "$PACK_DIR/.next/"

# 复制 public 目录
if [ -d "public" ]; then
  echo "  → Copying public directory..."
  cp -r public "$PACK_DIR/"
fi

# 复制环境变量文件
if [ -f ".env" ]; then
  echo "  → Copying .env..."
  cp .env "$PACK_DIR/"
else
  echo -e "${YELLOW}  ! .env not found, skipping...${NC}"
fi

if [ -f ".env.prod" ]; then
  echo "  → Copying .env.prod..."
  cp .env.prod "$PACK_DIR/"
fi

# 注意：不再复制 ssl 目录（使用 Cloudflare SSL）

# 复制数据目录结构（空目录，用于挂载）
echo "  → Creating data directory..."
mkdir -p "$PACK_DIR/data"
# 清理可能被复制进来的 data 目录内容（保留目录结构，不打包实际数据）
if [ -d "$PACK_DIR/data" ]; then
  rm -rf "$PACK_DIR/data"/*
fi

echo -e "${GREEN}✓ Package directory prepared${NC}"
echo ""

# 复制运维脚本
echo "  → Copying server-deploy.sh..."
if [ -f "scripts/server-deploy.sh" ]; then
  cp scripts/server-deploy.sh "$PACK_DIR/"
else
  echo -e "${YELLOW}  ! scripts/server-deploy.sh not found, skipping...${NC}"
fi

# ═══════════════════════════════════════════════
# Step 5: 打包
# ═══════════════════════════════════════════════
echo -e "${YELLOW}[5/5] Creating tarball...${NC}"
cd dist
# 使用 --no-xattrs 避免 macOS 扩展属性（Linux tar 可能不支持）
# 使用 --no-mac-metadata 去除 Apple 特定元数据
tar --no-xattrs --no-mac-metadata -czf openclawmp.tar.gz -C package . 2>/dev/null || \
  tar -czf openclawmp.tar.gz -C package .
cd ..

# 获取打包文件大小
PACK_SIZE=$(du -h "dist/openclawmp.tar.gz" | cut -f1)

# 清理临时目录
rm -rf "$PACK_DIR"

echo -e "${GREEN}✓ Package created: dist/openclawmp.tar.gz (${PACK_SIZE})${NC}"
echo ""

# ═══════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Build and pack completed successfully!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""
echo -e "📦 Package: ${GREEN}dist/openclawmp.tar.gz${NC} (${PACK_SIZE})"
echo ""
echo -e "To deploy:"
echo -e "  1. scp dist/openclawmp.tar.gz user@server:/tmp/"
echo -e "  2. tar -xzf /tmp/openclawmp.tar.gz" /opt/openclawmp
echo -e "  3. cd /opt/openclawmp && bash server-deploy.sh"
echo ""
