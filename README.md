# 水产市场

## 本地开发

```bash
# 安装依赖
npm install
# 启动开发服务器
npm run dev
```

## 构建和部署

### ECS 单机部署

1. 本地构建部署包

```bash
# 根目录下执行
bash scripts/build-and-pack.sh
```

2. 将生成的 `dist/openclawmp.tar.gz` 上传到服务器 `/tmp/` 目录下

```bash
# scp 示例
scp dist/openclawmp.tar.gz user@server:/tmp/
```

3. 登录服务器，解压部署包并运行

```bash
# 进入部署目录
cd /opt/openclawmp
# 运行部署脚本（脚本会自动解压部署包 + 配置环境 + 启动服务）
bash server-deploy.sh
```

### 通过 Devops 平台部署到 k8s 集群

1. 本地代码推送到仓库，自动触发 gitlab CI/CD 流水线
2. 流水线会自动构建镜像并推送到镜像仓库
3. 进入 Devops 平台，选择已构建的镜像进行部署
