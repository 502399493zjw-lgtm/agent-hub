#!/bin/bash

# ═══════════════════════════════════════════════
# Agent Hub Server Deployment Script
# 服务器部署脚本 - 在服务器上运行
# 使用方法: 
#   bash server-deploy.sh              # 完整部署（含解压）
#   bash server-deploy.sh --skip-extract  # 跳过解压，仅重新部署
# ═══════════════════════════════════════════════

set -e

# 解析命令行参数
SKIP_EXTRACT=false
for arg in "$@"; do
  case $arg in
    --skip-extract)
      SKIP_EXTRACT=true
      shift
      ;;
    --help|-h)
      echo "使用方法:"
      echo "  bash server-deploy.sh              # 完整部署（含解压）"
      echo "  bash server-deploy.sh --skip-extract  # 跳过解压，仅重新部署"
      exit 0
      ;;
    *)
      echo "未知参数: $arg"
      echo "使用 --help 查看帮助"
      exit 1
      ;;
  esac
done

# 配置
DEPLOY_PACKAGE="/tmp/openclawmp.tar.gz"
NGINX_CONFIG_FILE="/etc/nginx/conf.d/openclawmp.conf"
PM2_APP_NAME="openclawmp"
SSL_SOURCE_DIR="ssl"
SSL_CERT_DEST_DIR="/etc/ssl/certs"
SSL_KEY_DEST_DIR="/etc/ssl/private"

echo "========================================="
echo "🚀 Agent Hub Server Deployment"
if [ "$SKIP_EXTRACT" = true ]; then
  echo "   模式: 快速重新部署（跳过解压）"
else
  echo "   模式: 完整部署"
fi
echo "=========================================="
echo ""

# ═══════════════════════════════════════════════
# 0. 清理旧文件并解压新部署包
# ═══════════════════════════════════════════════
if [ "$SKIP_EXTRACT" = false ]; then
  echo "0. 清理旧部署并解压新版本..."

  if [ ! -f "$DEPLOY_PACKAGE" ]; then
    echo "❌ 错误: 未找到部署包 $DEPLOY_PACKAGE"
    echo "   请先将 openclawmp.tar.gz 上传到 /tmp/ 目录"
    exit 1
  fi
  echo "   ✓ 找到部署包 $DEPLOY_PACKAGE"

  echo "   清理旧文件..."
  rm -rf .next public ssl
  rm -f server.js package.json .env .env.local .env.prod ecosystem.config.js
  echo "   ✓ 旧文件清理完成（data 目录保留）"

  echo "   解压部署包到当前目录..."
  tar -xzf "$DEPLOY_PACKAGE"
  echo "   ✓ 部署包解压完成"

  if [ ! -f "server.js" ]; then
    echo "❌ 错误: 解压后未找到 server.js"
    echo "   部署包可能不完整或损坏"
    exit 1
  fi

  echo "   ✓ 检测到 Next.js 部署目录"
else
  echo "0. 跳过解压步骤（--skip-extract）"
  
  # 验证必要文件存在
  if [ ! -f "server.js" ] || [ ! -f "package.json" ]; then
    echo "❌ 错误: 当前目录缺少必要文件 (server.js, package.json)"
    echo "   首次部署必须省略 --skip-extract 参数"
    exit 1
  fi
  echo "   ✓ 检测到 Next.js 部署目录"
fi

# ═══════════════════════════════════════════════
# 0.1. 停止旧服务
# ═══════════════════════════════════════════════
echo ""
echo "0.1. 停止旧服务..."

if command -v pm2 &> /dev/null; then
  if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo "   停止 PM2 进程: $PM2_APP_NAME"
    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
    echo "   ✓ PM2 进程已停止"
  else
    echo "   ✓ 未发现运行中的 PM2 进程"
  fi
else
  echo "   ℹ️  PM2 未安装，跳过"
fi

echo "   检查 80 端口占用..."
PORT_80_PIDS=$(lsof -ti :80 2>/dev/null || true)
if [ -n "$PORT_80_PIDS" ]; then
  echo "   发现 80 端口被占用，进程 PID: $PORT_80_PIDS"
  for PID in $PORT_80_PIDS; do
    echo "   杀掉进程 $PID"
    sudo kill -9 "$PID" 2>/dev/null || true
  done
  echo "   ✓ 80 端口进程已清理"
  sleep 2
else
  echo "   ✓ 80 端口未被占用"
fi

# ═══════════════════════════════════════════════
# 1. 检查配置文件
# ═══════════════════════════════════════════════
echo ""
echo "1. 检查配置文件..."
if [ ! -f ".env" ]; then
  echo "❌ 错误: 未找到 .env 文件"
  echo "   请确保在打包时包含了配置文件"
  exit 1
fi
echo "   ✓ 找到 .env 配置文件"

if [ -f ".env.prod" ]; then
  echo "   ✓ 找到 .env.prod 配置文件"
else
  echo "   ℹ️  未找到 .env.prod，将仅使用 .env"
fi

# ═══════════════════════════════════════════════
# 2. 加载环境变量
# ═══════════════════════════════════════════════
echo ""
echo "2. 加载环境变量..."

# 加载 .env 和 .env.prod
set -a
source .env
if [ -f ".env.prod" ]; then
  source .env.prod
fi
set +a

# 设置 Dockerfile 中定义的环境变量（如果未设置）
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export NEXT_TELEMETRY_DISABLED=${NEXT_TELEMETRY_DISABLED:-1}
# 使用双引号避免空格和特殊字符问题
export DATABASE_URL=${DATABASE_URL:-"$(pwd)/data/hub.db"}

echo "   ✓ 环境变量已加载到内存"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo "   DATABASE_URL: $DATABASE_URL"

# ═══════════════════════════════════════════════
# 3. 检查 Node.js 环境
# ═══════════════════════════════════════════════
echo ""
echo "3. 检查 Node.js 环境..."

if ! command -v node &> /dev/null; then
  echo "   ⚠️  未找到 Node.js，正在安装 Node.js 22..."
  
  if command -v yum &> /dev/null; then
    echo "   使用 yum 安装 Node.js 22..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo yum install -y nodejs
  elif command -v apt-get &> /dev/null; then
    echo "   使用 apt 安装 Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "   ❌ 未检测到包管理器 (yum/apt)"
    echo "   请手动安装 Node.js 22+: https://nodejs.org/"
    exit 1
  fi
  
  # 验证安装
  if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js 安装失败"
    exit 1
  fi
  echo "   ✓ Node.js 22 安装完成"
fi

NODE_VERSION=$(node --version)
echo "   ✓ Node.js 版本: $NODE_VERSION"

NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "   ⚠️  Node.js 版本过低 (当前: $NODE_VERSION, 最低要求: v18.0.0)"
  echo "   正在升级到 Node.js 22..."
  
  if command -v yum &> /dev/null; then
    echo "   使用 yum 升级..."
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
    sudo yum install -y nodejs
  elif command -v apt-get &> /dev/null; then
    echo "   使用 apt 升级..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
  else
    echo "   ❌ 未检测到包管理器，无法自动升级"
    exit 1
  fi
  
  # 验证升级
  if ! command -v node &> /dev/null; then
    echo "   ❌ Node.js 升级失败"
    exit 1
  fi
  
  NODE_VERSION=$(node --version)
  echo "   ✓ 已升级到: $NODE_VERSION"
fi

# ═══════════════════════════════════════════════
# 4. 验证必需的环境变量
# ═══════════════════════════════════════════════
echo ""
echo "4. 验证环境变量..."
REQUIRED_VARS="PORT NODE_ENV DATABASE_URL"

MISSING_VARS=""
for VAR in $REQUIRED_VARS; do
  if [ -z "${!VAR}" ]; then
    MISSING_VARS="$MISSING_VARS $VAR"
  fi
done

if [ -n "$MISSING_VARS" ]; then
  echo "❌ 缺少以下必需的环境变量:$MISSING_VARS"
  exit 1
fi
echo "   ✓ 所有必需的环境变量已验证"

# ═══════════════════════════════════════════════
# 5. 检查端口和防火墙
# ═══════════════════════════════════════════════
echo ""
echo "5. 检查服务器端口和防火墙..."

# 检查应用端口（PM2已在0.1步骤停止，此处应该可用）
if netstat -tuln 2>/dev/null | grep -q ":${PORT} "; then
  echo "⚠️  警告: 端口 ${PORT} 仍被占用"
  OCCUPIED_PID=$(lsof -ti:${PORT} 2>/dev/null || echo "unknown")
  echo "   占用进程 PID: $OCCUPIED_PID"
  echo "   尝试清理..."
  if [ "$OCCUPIED_PID" != "unknown" ]; then
    sudo kill -9 $OCCUPIED_PID 2>/dev/null || true
    sleep 2
  fi
fi
echo "   ✓ 端口 ${PORT} 可用"

# 检查 HTTP 端口（80端口已在0.1步骤清理）
if netstat -tuln 2>/dev/null | grep -q ":80 "; then
  echo "⚠️  警告: 端口 80 仍被占用"
  PORT_80_PIDS=$(lsof -ti :80 2>/dev/null || true)
  if [ -n "$PORT_80_PIDS" ]; then
    echo "   尝试清理进程: $PORT_80_PIDS"
    for PID in $PORT_80_PIDS; do
      sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
  fi
fi
echo "   ✓ 端口 80 可用"

# 检查 HTTPS 端口
if netstat -tuln 2>/dev/null | grep -q ":443 "; then
  echo "⚠️  警告: 端口 443 已被占用"
  PORT_443_PIDS=$(lsof -ti :443 2>/dev/null || true)
  if [ -n "$PORT_443_PIDS" ]; then
    echo "   尝试清理进程: $PORT_443_PIDS"
    for PID in $PORT_443_PIDS; do
      sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
  fi
fi
echo "   ✓ 端口 443 可用"

echo ""
echo "   检查防火墙状态..."

if systemctl is-active --quiet firewalld; then
  echo "   ✓ firewalld 运行中"
  
  if ! sudo firewall-cmd --query-service=http --permanent 2>/dev/null | grep -q "yes"; then
    echo "   ℹ️  添加 HTTP 服务到防火墙..."
    sudo firewall-cmd --permanent --add-service=http 2>/dev/null || true
  else
    echo "   ✓ HTTP 服务已启用"
  fi
  
  if ! sudo firewall-cmd --query-service=https --permanent 2>/dev/null | grep -q "yes"; then
    echo "   ℹ️  添加 HTTPS 服务到防火墙..."
    sudo firewall-cmd --permanent --add-service=https 2>/dev/null || true
  else
    echo "   ✓ HTTPS 服务已启用"
  fi
  
  echo "   ✓ 应用端口 ${PORT} 仅本地访问，无需开放防火墙"
  
  echo "   重新加载防火墙规则..."
  sudo firewall-cmd --reload 2>/dev/null || true
  echo "   ✓ 防火墙规则已更新"
else
  echo "   ℹ️  firewalld 未运行，跳过防火墙配置"
fi

# ═══════════════════════════════════════════════
# 6. 确保数据目录存在
# ═══════════════════════════════════════════════
echo ""
echo "6. 确保数据目录存在..."
DATA_DIR=$(dirname "$DATABASE_URL")
mkdir -p "$DATA_DIR"
echo "   ✓ 数据目录已创建: $DATA_DIR"

# ═══════════════════════════════════════════════
# 7. 安装 npm 依赖（确保原生模块兼容）
# ═══════════════════════════════════════════════
echo ""
echo "7. 安装 npm 依赖..."
echo "   检测到 Next.js standalone 部署，重新安装所有依赖以确保跨平台兼容"

# 检查编译环境
echo "   检查编译环境..."
MISSING_TOOLS=""
PYTHON_CMD=""

# 检查 Python 版本（node-gyp 需要 Python 3.7+）
PYTHON_CMD=""
PYTHON_PATH=""

if command -v python3.9 &> /dev/null; then
  PYTHON_CMD="python3.9"
  PYTHON_VERSION=$(python3.9 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
  echo "   ✓ 检测到 Python 3.9: $PYTHON_VERSION"
elif command -v python3.8 &> /dev/null; then
  PYTHON_CMD="python3.8"
  PYTHON_VERSION=$(python3.8 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
  echo "   ✓ 检测到 Python 3.8: $PYTHON_VERSION"
elif command -v python3 &> /dev/null; then
  PYTHON_VERSION=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
  PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
  PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
  
  if [ "$PYTHON_MAJOR" -ge 3 ] && [ "$PYTHON_MINOR" -ge 7 ]; then
    echo "   ✓ Python $PYTHON_VERSION 符合要求（需要 3.7+）"
    PYTHON_CMD="python3"
  else
    echo "   ⚠️  Python $PYTHON_VERSION 版本过低（需要 3.7+）"
    MISSING_TOOLS="$MISSING_TOOLS python3"
  fi
else
  MISSING_TOOLS="$MISSING_TOOLS python3"
fi

if ! command -v make &> /dev/null; then
  MISSING_TOOLS="$MISSING_TOOLS make"
fi
if ! command -v g++ &> /dev/null; then
  MISSING_TOOLS="$MISSING_TOOLS g++"
fi

if [ -n "$MISSING_TOOLS" ]; then
  echo "   ⚠️  缺少或需要升级的构建工具:$MISSING_TOOLS"
  echo "   正在安装/升级..."
  if command -v yum &> /dev/null; then
    # CentOS/RHEL - 尝试安装 Python 3.9 或更高版本
    sudo yum install -y python39 python39-devel make gcc-c++ 2>/dev/null || \
    sudo yum install -y python38 python38-devel make gcc-c++ 2>/dev/null || \
    sudo yum install -y python3 python3-devel make gcc-c++
    
    # 更新 Python 命令
    if command -v python3.9 &> /dev/null; then
      PYTHON_CMD="python3.9"
    elif command -v python3.8 &> /dev/null; then
      PYTHON_CMD="python3.8"
    else
      PYTHON_CMD="python3"
    fi
  elif command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    sudo apt-get update
    sudo apt-get install -y python3 python3-dev make g++
    PYTHON_CMD="python3"
  else
    echo "   ❌ 无法识别的包管理器"
    echo "   请手动安装: Python 3.7+, make, g++"
    exit 1
  fi
  echo "   ✓ 构建工具安装/升级完成"
  
  # 重新检测 Python 命令（安装后可能变化）
  if command -v python3.9 &> /dev/null; then
    PYTHON_CMD="python3.9"
  elif command -v python3.8 &> /dev/null; then
    PYTHON_CMD="python3.8"
  elif command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
  fi
fi

# 获取 Python 完整路径
if [ -n "$PYTHON_CMD" ]; then
  PYTHON_PATH=$(command -v $PYTHON_CMD 2>/dev/null)
  if [ -z "$PYTHON_PATH" ]; then
    echo "   ⚠️  无法找到 $PYTHON_CMD 的完整路径"
    # 尝试常见路径
    for p in /usr/bin/python3.9 /usr/bin/python3.8 /usr/bin/python3; do
      if [ -x "$p" ]; then
        PYTHON_PATH="$p"
        PYTHON_CMD=$(basename "$p")
        echo "   ✓ 找到 Python: $PYTHON_PATH"
        break
      fi
    done
  fi
fi

# 显示编译环境信息
echo "   编译环境信息:"
echo "     - Node.js: $(node --version 2>/dev/null || echo 'Not found')"
echo "     - npm: $(npm --version 2>/dev/null || echo 'Not found')"
if [ -n "$PYTHON_PATH" ]; then
  echo "     - Python: $($PYTHON_PATH --version 2>&1 || echo 'Not found')"
  echo "     - Python 路径: $PYTHON_PATH"
else
  echo "     - Python: Not found"
fi

# 检查 GCC 版本（better-sqlite3 需要 C++20 支持，GCC 10+）
GCC_VERSION=""
USE_OLD_SQLITE3=false

if command -v g++ &> /dev/null; then
  GCC_FULL_VERSION=$(g++ --version 2>/dev/null | head -n1)
  GCC_VERSION=$(g++ -dumpversion 2>/dev/null)
  GCC_MAJOR=$(echo $GCC_VERSION | cut -d. -f1)
  echo "     - GCC: $GCC_FULL_VERSION"
  
  if [ "$GCC_MAJOR" -lt 10 ]; then
    echo "     ⚠️  GCC $GCC_VERSION 不支持 C++20（需要 GCC 10+）"
    echo "     正在升级 GCC 到版本 11..."
    
    if command -v yum &> /dev/null; then
      # CentOS/RHEL 8+: 使用 gcc-toolset-11
      sudo yum install -y gcc-toolset-11 gcc-toolset-11-gcc-c++ 2>/dev/null && {
        echo "     ✓ GCC Toolset 11 安装完成"
        
        # 激活 GCC Toolset 11
        source /opt/rh/gcc-toolset-11/enable 2>/dev/null || true
        export PATH="/opt/rh/gcc-toolset-11/root/usr/bin:$PATH"
        export LD_LIBRARY_PATH="/opt/rh/gcc-toolset-11/root/usr/lib64:$LD_LIBRARY_PATH"
        
        # 验证新版本
        if command -v g++ &> /dev/null; then
          NEW_GCC_VERSION=$(g++ -dumpversion 2>/dev/null)
          NEW_GCC_MAJOR=$(echo $NEW_GCC_VERSION | cut -d. -f1)
          echo "     ✓ GCC 已升级到: $(g++ --version 2>/dev/null | head -n1)"
          
          if [ "$NEW_GCC_MAJOR" -ge 10 ]; then
            GCC_VERSION="$NEW_GCC_VERSION"
            GCC_MAJOR="$NEW_GCC_MAJOR"
            USE_OLD_SQLITE3=false
          else
            echo "     ⚠️  GCC 升级后仍不满足要求，将使用兼容版本的 better-sqlite3"
            USE_OLD_SQLITE3=true
          fi
        fi
      } || {
        # 尝试 CentOS 7 的 devtoolset-11
        sudo yum install -y centos-release-scl 2>/dev/null || true
        sudo yum install -y devtoolset-11 devtoolset-11-gcc-c++ 2>/dev/null && {
          echo "     ✓ Devtoolset 11 安装完成"
          
          source /opt/rh/devtoolset-11/enable 2>/dev/null || true
          export PATH="/opt/rh/devtoolset-11/root/usr/bin:$PATH"
          export LD_LIBRARY_PATH="/opt/rh/devtoolset-11/root/usr/lib64:$LD_LIBRARY_PATH"
          
          NEW_GCC_VERSION=$(g++ -dumpversion 2>/dev/null)
          NEW_GCC_MAJOR=$(echo $NEW_GCC_VERSION | cut -d. -f1)
          echo "     ✓ GCC 已升级到: $(g++ --version 2>/dev/null | head -n1)"
          
          if [ "$NEW_GCC_MAJOR" -ge 10 ]; then
            GCC_VERSION="$NEW_GCC_VERSION"
            GCC_MAJOR="$NEW_GCC_MAJOR"
            USE_OLD_SQLITE3=false
          else
            USE_OLD_SQLITE3=true
          fi
        } || {
          echo "     ⚠️  GCC 升级失败，将使用兼容版本的 better-sqlite3"
          USE_OLD_SQLITE3=true
        }
      }
    elif command -v apt-get &> /dev/null; then
      # Ubuntu/Debian: 安装 GCC 11
      sudo apt-get update
      sudo apt-get install -y gcc-11 g++-11 2>/dev/null && {
        sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 100
        sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 100
        
        NEW_GCC_VERSION=$(g++ -dumpversion 2>/dev/null)
        NEW_GCC_MAJOR=$(echo $NEW_GCC_VERSION | cut -d. -f1)
        echo "     ✓ GCC 已升级到: $(g++ --version 2>/dev/null | head -n1)"
        
        if [ "$NEW_GCC_MAJOR" -ge 10 ]; then
          GCC_VERSION="$NEW_GCC_VERSION"
          GCC_MAJOR="$NEW_GCC_MAJOR"
          USE_OLD_SQLITE3=false
        else
          USE_OLD_SQLITE3=true
        fi
      } || {
        echo "     ⚠️  GCC 升级失败，将使用兼容版本的 better-sqlite3"
        USE_OLD_SQLITE3=true
      }
    else
      echo "     ⚠️  无法自动升级 GCC，将使用兼容版本的 better-sqlite3"
      USE_OLD_SQLITE3=true
    fi
  else
    echo "     ✓ GCC 版本符合要求"
    USE_OLD_SQLITE3=false
  fi
else
  echo "     - GCC: Not found"
  echo "     ⚠️  未检测到 GCC，将使用兼容版本的 better-sqlite3"
  USE_OLD_SQLITE3=true
fi
echo "     - Make: $(make --version 2>/dev/null | head -n1 || echo 'Not found')"

# 安装所有依赖（包括原生模块）
if [ -f "package.json" ]; then
  echo "   开始安装 npm 依赖..."
  echo "   这将确保所有原生模块在服务器环境中正确编译"
  
  # 清理可能残留的 node_modules
  if [ -d "node_modules" ]; then
    echo "   清理旧的 node_modules..."
    rm -rf node_modules
  fi
  
  # 清理 npm 缓存（避免 prebuild 问题）
  echo "   清理 npm 缓存..."
  npm cache clean --force 2>/dev/null || true
  
  # 设置环境变量指定 Python 路径
  if [ -n "$PYTHON_PATH" ]; then
    echo "   配置环境变量使用 Python: $PYTHON_PATH"
    export npm_config_python="$PYTHON_PATH"
    export PYTHON="$PYTHON_PATH"
  fi
  
  # 处理 better-sqlite3 版本兼容性
  if [ "$USE_OLD_SQLITE3" = true ]; then
    echo "   ⚠️  检测到 GCC 版本过低，需要特殊处理 better-sqlite3"
    echo "   修改 package.json 使用兼容旧版 GCC 的 better-sqlite3 版本..."
    
    # 备份原始 package.json
    cp package.json package.json.bak
    
    # 将 better-sqlite3 版本降级到 9.x（支持 C++17）
    if command -v jq &> /dev/null; then
      # 使用 jq 修改 JSON
      jq '.dependencies["better-sqlite3"] = "^9.6.0"' package.json > package.json.tmp
      mv package.json.tmp package.json
    else
      # 使用 sed 简单替换
      sed -i 's/"better-sqlite3": "[^"]*"/"better-sqlite3": "^9.6.0"/' package.json 2>/dev/null || \
      sed -i '' 's/"better-sqlite3": "[^"]*"/"better-sqlite3": "^9.6.0"/' package.json
    fi
    echo "   ✓ 已调整 better-sqlite3 版本为 9.6.0（兼容 GCC 8）"
  fi
  
  # 运行 npm install（使用 --omit=dev 只安装生产依赖）
  echo "   执行 npm install（原生模块自动选择预编译或源码构建）..."
  npm install --omit=dev 2>&1 | tee /tmp/npm-install.log
  
  if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo "   ✓ npm 依赖安装完成"
    
    # 恢复原始 package.json（保持版本一致性）
    if [ "$USE_OLD_SQLITE3" = true ] && [ -f "package.json.bak" ]; then
      mv package.json.bak package.json
      echo "   ✓ 已恢复原始 package.json"
    fi
  else
    echo "   ❌ npm 安装失败"
    echo "   完整日志已保存到: /tmp/npm-install.log"
    echo ""
    echo "   诊断信息:"
    echo "   - GCC 版本: ${GCC_VERSION:-未检测到}"
    echo "   - Python 版本: $($PYTHON_PATH --version 2>&1)"
    echo ""
    echo "   常见解决方案:"
    echo "   1. GCC 版本过低（当前 ${GCC_VERSION:-未知}，需要 10+ 支持 C++20）"
    echo "      解决: sudo yum install gcc-toolset-11 && scl enable gcc-toolset-11 bash"
    echo "   2. 或手动降级 better-sqlite3: npm install better-sqlite3@9.6.0"
    echo "   3. 查看完整日志: cat /tmp/npm-install.log"
    
    # 恢复原始 package.json
    if [ "$USE_OLD_SQLITE3" = true ] && [ -f "package.json.bak" ]; then
      mv package.json.bak package.json
      echo "   ✓ 已恢复原始 package.json"
    fi
    exit 1
  fi
else
  echo "   ❌ 未找到 package.json，无法安装依赖"
  exit 1
fi

# ═══════════════════════════════════════════════
# 8. 安装 PM2
# ═══════════════════════════════════════════════
echo ""
echo "8. 检查 PM2..."
if ! command -v pm2 &> /dev/null; then
  echo "   未检测到 PM2，开始全局安装..."
  npm install -g pm2
  echo "   ✓ PM2 安装完成"
else
  echo "   ✓ PM2 已安装"
fi

# ═══════════════════════════════════════════════
# 9. 启动 PM2 服务
# ═══════════════════════════════════════════════
echo ""
echo "9. 启动 PM2 服务..."

pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

# 创建 PM2 启动配置（将环境变量传递给 PM2）
# 转义 DATABASE_URL 中的特殊字符
ESCAPED_DB_URL=$(echo "$DATABASE_URL" | sed 's/"/\\"/g')

cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '${PM2_APP_NAME}',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: '${NODE_ENV}',
      PORT: '${PORT}',
      NEXT_TELEMETRY_DISABLED: '${NEXT_TELEMETRY_DISABLED}',
      DATABASE_URL: '${ESCAPED_DB_URL}'
    }
  }]
};
EOF

# 使用 ecosystem 配置启动
pm2 start ecosystem.config.js
echo "   ✓ PM2 已启动 (name: ${PM2_APP_NAME}, mode: cluster)"

# ═══════════════════════════════════════════════
# 10. 配置 Nginx 反向代理
# ═══════════════════════════════════════════════
echo ""
echo "10. 配置 Nginx 反向代理..."

if ! command -v nginx &> /dev/null; then
  echo "   ⚠️  Nginx 未安装，正在安装..."
  
  if command -v yum &> /dev/null; then
    echo "   配置 Nginx 官方 YUM 仓库..."
    sudo tee /etc/yum.repos.d/nginx.repo > /dev/null <<'NGINX_REPO'
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
NGINX_REPO
    
    echo "   安装 Nginx..."
    sudo yum install -y nginx
  elif command -v apt-get &> /dev/null; then
    echo "   配置 Nginx 官方 APT 仓库..."
    sudo apt-get install -y curl gnupg2 ca-certificates lsb-release
    echo "deb http://nginx.org/packages/ubuntu $(lsb_release -cs) nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
    curl -fsSL https://nginx.org/keys/nginx_signing.key | sudo apt-key add -
    
    echo "   安装 Nginx..."
    sudo apt-get update
    sudo apt-get install -y nginx
  else
    echo "   ❌ 未检测到包管理器，请手动安装 Nginx"
    exit 1
  fi
fi

if command -v nginx &> /dev/null; then
  echo "   ✓ Nginx 已安装"
  
  NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+' || echo "unknown")
  echo "   当前版本: nginx/$NGINX_VERSION"
  
  # 扫描并安装所有 SSL 证书
  echo "   扫描 SSL 证书目录..."
  sudo mkdir -p "$SSL_CERT_DEST_DIR"
  sudo mkdir -p "$SSL_KEY_DEST_DIR"
  
  SSL_DOMAINS=""
  SSL_CONFIGS=""
  CERT_COUNT=0
  
  if [ -d "$SSL_SOURCE_DIR" ]; then
    # 查找所有 .pem 证书文件
    for CERT_FILE in "$SSL_SOURCE_DIR"/*.pem; do
      if [ -f "$CERT_FILE" ]; then
        # 提取域名（文件名格式：domain.com.pem）
        CERT_FILENAME=$(basename "$CERT_FILE")
        DOMAIN=${CERT_FILENAME%.pem}
        KEY_FILE="$SSL_SOURCE_DIR/${DOMAIN}.key"
        
        if [ -f "$KEY_FILE" ]; then
          echo "   → 发现域名证书: $DOMAIN"
          
          # 生成目标文件名（替换点号为破折号）
          SAFE_DOMAIN=$(echo "$DOMAIN" | tr '.' '-')
          CERT_DEST="$SSL_CERT_DEST_DIR/${SAFE_DOMAIN}.crt"
          KEY_DEST="$SSL_KEY_DEST_DIR/${SAFE_DOMAIN}.key"
          
          # 安装证书
          sudo cp "$CERT_FILE" "$CERT_DEST"
          sudo cp "$KEY_FILE" "$KEY_DEST"
          sudo chmod 644 "$CERT_DEST"
          sudo chown root:nginx "$KEY_DEST" 2>/dev/null || sudo chown root:www-data "$KEY_DEST" 2>/dev/null || true
          sudo chmod 640 "$KEY_DEST"
          
          # 收集域名列表
          SSL_DOMAINS="$SSL_DOMAINS $DOMAIN"
          
          # 生成该域名的 SSL 配置
          SSL_CONFIGS="${SSL_CONFIGS}
# HTTPS 配置 - ${DOMAIN}
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    
    ssl_certificate ${CERT_DEST};
    ssl_certificate_key ${KEY_DEST};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    client_max_body_size 500M;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
"
          
          CERT_COUNT=$((CERT_COUNT + 1))
        else
          echo "   ⚠️  跳过 $DOMAIN: 未找到对应的 .key 文件"
        fi
      fi
    done
  fi
  
  if [ $CERT_COUNT -gt 0 ]; then
    echo "   ✓ 已安装 $CERT_COUNT 个域名的 SSL 证书:$SSL_DOMAINS"
    HAS_SSL=1
  else
    echo "   ⚠️  未找到 SSL 证书，仅配置 HTTP"
    HAS_SSL=0
  fi
  
  echo "   禁用 Nginx 默认站点..."
  NGINX_DEFAULT_CONF="/etc/nginx/nginx.conf"
  
  if [ ! -f "${NGINX_DEFAULT_CONF}.backup" ]; then
    sudo cp "$NGINX_DEFAULT_CONF" "${NGINX_DEFAULT_CONF}.backup"
    echo "   ✓ 已备份原配置"
  fi
  
  if sudo grep -q "listen.*80" "$NGINX_DEFAULT_CONF" 2>/dev/null; then
    sudo sed -i 's/^\([[:space:]]*\)listen\([[:space:]]*\)80/\1# listen\280/' "$NGINX_DEFAULT_CONF" 2>/dev/null || true
    sudo sed -i 's/^\([[:space:]]*\)listen\([[:space:]]*\)\[::\]:80/\1# listen\2[::]:80/' "$NGINX_DEFAULT_CONF" 2>/dev/null || true
    echo "   ✓ 已禁用默认配置中的 80 端口监听"
  fi
  
  echo "   生成 Nginx 配置文件..."
  
  if [ $HAS_SSL -eq 1 ]; then
    # 有 SSL 证书：HTTP 重定向到 HTTPS
    sudo tee "$NGINX_CONFIG_FILE" > /dev/null <<EOF
# Agent Hub 反向代理配置（多域名支持）

# HTTP 配置 - 重定向到 HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name$SSL_DOMAINS;
    
    # 强制跳转 HTTPS
    return 301 https://\$host\$request_uri;
}

$SSL_CONFIGS
EOF
  else
    # 无 SSL 证书：仅 HTTP
    sudo tee "$NGINX_CONFIG_FILE" > /dev/null <<EOF
# Agent Hub 反向代理配置（仅 HTTP）

# HTTP 配置
server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    client_max_body_size 500M;
    
    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
  fi
  
  echo "   ✓ Nginx 配置已生成"
  echo "   ✓ 配置文件: ${NGINX_CONFIG_FILE}"
  
  echo "   检查 Nginx 配置语法..."
  if sudo nginx -t 2>&1; then
    echo "   ✓ Nginx 配置语法正确"
    
    if systemctl is-active --quiet nginx; then
      echo "   重新加载 Nginx 配置..."
      sudo systemctl reload nginx
      echo "   ✓ Nginx 已重新加载"
    else
      echo "   启动 Nginx..."
      sudo systemctl start nginx
      echo "   ✓ Nginx 已启动"
    fi
    
    sudo systemctl enable nginx 2>/dev/null || true
    echo "   ✓ Nginx 开机自启已启用"
  else
    echo "   ❌ Nginx 配置有误"
    sudo cat "$NGINX_CONFIG_FILE"
    exit 1
  fi
  
  # SELinux 配置
  if command -v getenforce &> /dev/null; then
    SELINUX_STATUS=$(getenforce 2>/dev/null || echo "Disabled")
    if [ "$SELINUX_STATUS" != "Disabled" ]; then
      echo ""
      echo "   配置 SELinux..."
      sudo setsebool -P httpd_can_network_connect=1 2>/dev/null || true
      sudo setsebool -P httpd_can_network_relay=1 2>/dev/null || true
      echo "   ✓ SELinux 规则已配置"
    fi
  fi
fi

# ═══════════════════════════════════════════════
# 11. 验证服务健康状态
# ═══════════════════════════════════════════════
echo ""
echo "11. 验证服务健康状态..."

# 确保 curl 已安装
if ! command -v curl &> /dev/null; then
  echo "   ⚠️  curl 未安装，正在安装..."
  if command -v yum &> /dev/null; then
    sudo yum install -y curl
  elif command -v apt-get &> /dev/null; then
    sudo apt-get install -y curl
  fi
fi

sleep 3
MAX_RETRIES=5
RETRY_COUNT=0
HEALTH_CHECK_PASSED=""

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -f -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
    echo "   ✓ 服务健康检查通过"
    HEALTH_CHECK_PASSED=1
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "   等待服务响应... ($RETRY_COUNT/$MAX_RETRIES)"
      sleep 2
    fi
  fi
done

if [ -z "$HEALTH_CHECK_PASSED" ]; then
  echo ""
  echo "❌ 服务启动失败或健康检查超时"
  echo "   查看 PM2 日志: pm2 logs $PM2_APP_NAME"
  echo "   停止进程: pm2 delete $PM2_APP_NAME"
  exit 1
fi

# ═══════════════════════════════════════════════
# 12. 保存 PM2 配置
# ═══════════════════════════════════════════════
echo ""
echo "12. 保存 PM2 进程列表..."
pm2 save
echo "   ✓ PM2 进程列表已保存 (pm2 resurrect 可自动拉起)"

# ═══════════════════════════════════════════════
# 13. 显示部署完成信息
# ═══════════════════════════════════════════════
echo ""
echo "=========================================="
echo "✅ 部署成功！"
echo "=========================================="
echo ""
echo "🌐 服务信息:"
echo "   内部地址: http://127.0.0.1:${PORT}"
if [ $HAS_SSL -eq 1 ]; then
  echo "   已配置的域名:"
  for DOMAIN in $SSL_DOMAINS; do
    echo "     - https://$DOMAIN (SSL)"
  done
  echo "   HTTP 自动重定向到 HTTPS"
else
  echo "   HTTP 访问: http://<服务器IP或域名>"
  echo "   ⚠️  未配置 SSL，建议添加证书到 ssl/ 目录"
fi
echo ""
echo "📋 PM2 常用命令:"
echo "   查看状态: pm2 status $PM2_APP_NAME"
echo "   查看日志: pm2 logs $PM2_APP_NAME"
echo "   重启服务: pm2 restart $PM2_APP_NAME"
echo "   停止服务: pm2 delete $PM2_APP_NAME"
echo ""
echo "🗄️  数据库位置: $DATABASE_URL"
echo ""
