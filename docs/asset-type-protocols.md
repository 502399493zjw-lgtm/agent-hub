# 水产市场 — 资产类型上传与安装协议

> 每种资产类型的定义、文件结构、上传规范、安装位置、生效机制。

---

## 总览

| 类型 | 中文名 | 安装目录 | 核心文件 | 生效方式 |
|------|--------|---------|---------|---------|
| `template` | 合集 | `~/.openclaw/templates/<slug>/` | `manifest.json` + 子资产引用 | 批量安装子资产 |
| `skill` | 技能 | `~/openclaw/skills/<slug>/` | `SKILL.md` | Agent 自动发现，按需加载 |
| `config` | 配置 | `~/.openclaw/configs/<slug>/` | `config.yaml` 或 `.json` | 手动 apply 或 gateway patch |
| `plugin` | 插件 | `~/openclaw/extensions/<slug>/` | `openclaw.plugin.json` + `.ts`/`.js` | Gateway 重启后自动加载 |
| `trigger` | 触发器 | `~/.openclaw/triggers/<slug>/` | `trigger.sh` 或脚本 + hooks mapping | 注册 hooks + LaunchAgent/cron |
| `channel` | 频道 | `~/openclaw/extensions/<slug>/` | `openclaw.plugin.json`（含 channels 声明）| Gateway 重启 + config 配置 |

---

## 1. 📋 合集（template）

**定义**：多个资产的组合包，一键安装即获得完整 Agent 方案（技能 + 配置 + 触发器等）。

### 文件结构
```
<slug>/
├── manifest.json        # 元数据 + 子资产列表
├── README.md            # 方案说明文档
├── preview.png          # 预览图（可选）
└── overrides/           # 覆盖配置（可选）
    ├── SOUL.md          # 预设人格
    └── AGENTS.md        # 预设行为规则
```

### manifest.json 规范
```json
{
  "name": "my-agent-pack",
  "displayName": "我的全能 Agent",
  "version": "1.0.0",
  "type": "template",
  "author": { "id": "xiaoyue", "name": "小跃" },
  "assets": [
    { "type": "skill", "ref": "@xiaoyue/web-search" },
    { "type": "skill", "ref": "@xiaoyue/code-review" },
    { "type": "config", "ref": "@xiaoyue/coder-personality" },
    { "type": "trigger", "ref": "@xiaoyue/pdf-watcher" }
  ],
  "overrides": {
    "soul": "overrides/SOUL.md",
    "agents": "overrides/AGENTS.md"
  }
}
```

### 上传协议
1. 必填：`manifest.json`（含 `assets` 数组，每项引用已发布的资产）
2. 必填：`README.md`（方案概述、适用场景、包含资产说明）
3. 可选：`overrides/` 目录预设配置文件
4. 验证：所有 `assets[].ref` 引用的资产必须已存在于水产市场

### 安装协议
```bash
seafood-market install template/@<author>/<slug>
```
1. 下载 manifest → 解析 `assets` 列表
2. 逐个安装子资产（调用各类型自己的安装流程）
3. 如有 `overrides/`，复制到 `~/.openclaw/workspace/`
4. 记录到 lockfile，标记为合集安装

### 生效机制
- 子资产各自按类型生效（技能立即发现，插件需重启等）
- 合集本身不直接运行，是安装编排器

---

## 2. 📦 技能（skill）

**定义**：Agent 的可调用能力模块，通过 SKILL.md 提供 prompt 指令 + 可选脚本/引用资料。

### 文件结构
```
<slug>/
├── SKILL.md             # 核心：技能描述 + Agent 行为指令（必须）
├── manifest.json        # 元数据（水产市场用）
├── scripts/             # 可执行脚本（可选）
│   └── run.sh
└── references/          # 参考资料（可选）
    └── api-docs.md
```

### SKILL.md 规范
```markdown
# <技能名>

## Description
技能描述（会被注入 system prompt 的 <available_skills>）

## Instructions
Agent 加载此技能后应遵循的指令...

## Examples
使用示例...
```

### 上传协议
1. 必填：`SKILL.md`（≥50 字描述 + 指令）
2. 必填：`manifest.json`（name, displayName, version, type="skill", description, tags）
3. 可选：`scripts/`（可执行脚本，需声明所需权限）
4. 可选：`references/`（参考文档，Agent 按需 read）
5. 验证：SKILL.md 格式检查，description 字段非空

### 安装协议
```bash
seafood-market install skill/@<author>/<slug>
```
1. 下载资产包 → 解压到 `~/openclaw/skills/<slug>/`
2. 确保 `SKILL.md` 存在
3. 无需重启 —— Agent 下次对话时自动发现

### 生效机制
- OpenClaw 在每次对话前扫描 `~/openclaw/skills/` + `~/.agents/skills/`
- 将 SKILL.md 的 description 注入 `<available_skills>` XML
- Agent 按需 `read(SKILL.md)` 获取完整指令
- scripts/ 通过 `exec` 工具执行

---

## 3. ⚙️ 配置（config）

**定义**：Agent 的行为参数预设，包括模型选择、人格定义、路由规则、工作流偏好等。

### 文件结构
```
<slug>/
├── manifest.json        # 元数据 + config 子类型标签
├── README.md            # 配置说明
├── config.yaml          # 主配置文件（或 .json）
└── files/               # 附属文件（可选）
    ├── SOUL.md          # 人格文件
    └── AGENTS.md        # 行为规则
```

### 配置子类型（用 tag 区分）
| Tag | 说明 | 典型内容 |
|-----|------|---------|
| `personality` | 人格/身份 | SOUL.md, IDENTITY.md |
| `model` | 模型偏好 | 默认模型、thinking 级别、token 限制 |
| `routing` | 路由规则 | 渠道策略、群聊策略、子代理限制 |
| `workflow` | 工作流 | cron 任务模板、heartbeat 配置 |
| `agent-scope` | Agent 范围 | 工具白名单/黑名单、安全策略 |

### 上传协议
1. 必填：`manifest.json`（含 tags 标识子类型）
2. 必填：`README.md`（配置说明 + 使用方法）
3. 必填：`config.yaml` 或配置文件（具体格式视子类型而定）
4. 可选：`files/` 附属文件
5. 验证：config 文件格式合法（YAML/JSON parse）

### 安装协议
```bash
seafood-market install config/@<author>/<slug>
```
1. 下载 → 解压到 `~/.openclaw/configs/<slug>/`
2. 不自动生效 —— 需用户确认后 apply

### 生效机制
- **人格类**：将 `files/SOUL.md` 复制到 `~/.openclaw/workspace/SOUL.md`
- **模型类**：通过 `gateway config.patch` 写入 openclaw.json
- **路由类**：通过 `gateway config.patch` 更新策略
- **工作流类**：通过 `cron add` 注册定时任务
- 均需用户确认或 `--apply` 参数显式触发

---

## 4. 🔌 插件（plugin）

**定义**：OpenClaw 进程内扩展，通过 Plugin API 注册工具（Tools）、服务（Services）、Gateway 处理器等底层能力。

### 文件结构
```
<slug>/
├── openclaw.plugin.json  # 插件清单（必须）
├── manifest.json         # 水产市场元数据
├── index.ts              # 入口文件
├── src/                  # 源码
│   └── tools.ts
├── skills/               # 插件附带的技能（可选）
│   └── <name>/SKILL.md
└── package.json          # 依赖声明（可选）
```

### openclaw.plugin.json 规范
```json
{
  "id": "<slug>",
  "tools": ["./src/tools"],
  "skills": ["./skills"],
  "configSchema": {
    "type": "object",
    "properties": {}
  }
}
```

### 上传协议
1. 必填：`openclaw.plugin.json`（合法的 plugin manifest）
2. 必填：`manifest.json`（水产市场元数据）
3. 必填：入口文件（`.ts` 或 `.js`）
4. 可选：`package.json`（如有外部依赖）
5. 验证：plugin manifest 格式、入口文件存在、TypeScript 语法检查
6. ⚠️ 安全审核：插件在 Agent 进程内运行，需要信任审查

### 安装协议
```bash
seafood-market install plugin/@<author>/<slug>
```
1. 下载 → 解压到 `~/openclaw/extensions/<slug>/`
2. 如有 `package.json`，运行 `npm install --production`
3. **需要 Gateway 重启** 才能加载

### 生效机制
- Gateway 启动时 `discovery.ts` 扫描 extensions 目录
- 读取 `openclaw.plugin.json` → `loader.ts` 用 jiti 加载 .ts 源码
- 插件通过 `OpenClawPluginApi` 注册：Tools / Services / Gateway handlers
- 同进程运行，无跨进程开销

---

## 5. 🎯 触发器（trigger）

**定义**：事件驱动的自动化模块，监听外部事件（文件系统、webhook、定时等）并唤醒 Agent 执行任务。

### 文件结构
```
<slug>/
├── manifest.json         # 水产市场元数据
├── SKILL.md              # 触发器使用说明（Agent 可读）
├── scripts/
│   ├── install.sh        # 安装脚本（注册 watcher/LaunchAgent）
│   ├── uninstall.sh      # 卸载脚本
│   └── watcher.sh        # 主监听脚本
├── transforms/           # Hooks transform 脚本（可选）
│   └── transform.js
└── config.json           # 默认配置（监听路径、过滤规则等）
```

### 上传协议
1. 必填：`manifest.json`
2. 必填：`scripts/watcher.sh`（或等效主脚本）
3. 必填：`scripts/install.sh` + `scripts/uninstall.sh`
4. 可选：`transforms/` hooks 转换脚本
5. 可选：`config.json` 默认配置
6. 验证：脚本可执行权限、无危险命令（rm -rf 等）

### 安装协议
```bash
seafood-market install trigger/@<author>/<slug>
```
1. 下载 → 解压到 `~/.openclaw/triggers/<slug>/`
2. 运行 `scripts/install.sh`：
   - 注册 LaunchAgent（macOS）或 systemd service（Linux）
   - 配置 hooks mapping（gateway config.patch）
   - 复制 transform 脚本到 `~/.openclaw/hooks/transforms/`
3. 提示用户确认监听路径和过滤规则

### 生效机制
- **文件类触发器**：fswatch / inotify 内核级监听 → POST `/hooks/<endpoint>` → JS transform → Agent session
- **Webhook 类触发器**：直接配置 hooks mapping，外部服务 POST → Agent
- **定时类触发器**：注册 cron job（通过 OpenClaw cron API）
- 链路：外部事件 → watcher 脚本 → POST OpenClaw hooks → transform → Agent isolated session

---

## 6. 📡 频道（channel）

**定义**：Agent 与外部平台的通信桥梁，实现消息收发、格式适配、身份映射。本质是一种特殊插件。

### 文件结构
```
<slug>/
├── openclaw.plugin.json  # 插件清单，含 channels 声明（必须）
├── manifest.json         # 水产市场元数据
├── index.ts              # 入口文件
├── src/
│   ├── channel.ts        # Channel 接口实现
│   └── tools.ts          # 频道专属工具（如 feishu_doc, slack_send）
├── skills/               # 频道使用指南（可选）
└── package.json
```

### openclaw.plugin.json 规范
```json
{
  "id": "<slug>",
  "channels": ["<channel-name>"],
  "tools": ["./src/tools"],
  "skills": ["./skills"],
  "configSchema": {
    "type": "object",
    "properties": {
      "appId": { "type": "string" },
      "appSecret": { "type": "string" }
    }
  }
}
```

### 上传协议
1. 必填：`openclaw.plugin.json`（`channels` 数组非空）
2. 必填：`manifest.json`
3. 必填：Channel 接口实现（消息收发、格式转换）
4. 可选：频道专属 Tools
5. 验证：plugin manifest 含 channels 声明、接口实现完整
6. ⚠️ 安全审核：频道处理消息内容，需要信任审查

### 安装协议
```bash
seafood-market install channel/@<author>/<slug>
```
1. 下载 → 解压到 `~/openclaw/extensions/<slug>/`
2. 如有 `package.json`，运行 `npm install --production`
3. 提示用户配置凭证：
   ```
   ⚠️ 需要配置 channels.<name> 凭证
   运行: openclaw config set channels.<name>.appId <your-id>
   运行: openclaw config set channels.<name>.appSecret <your-secret>
   ```
4. **需要 Gateway 重启**

### 生效机制
- 与插件相同的加载机制（discovery + jiti loader）
- 额外注册 Channel 适配器（消息格式转换、webhook 接收）
- 需在 `openclaw.json` 的 `channels` 中启用并配置凭证
- 支持 WebSocket / Webhook / Polling 等连接模式

---

## 通用安装命令格式

```bash
# 安装
seafood-market install <type>/@<author>/<slug>

# 卸载
seafood-market uninstall <type>/<slug>

# 搜索
seafood-market search <keyword>

# 查看已安装
seafood-market list

# 查看详情
seafood-market info <type>/<slug>
```

## Lockfile 结构

```json
{
  "version": 1,
  "installed": {
    "skill/web-search": {
      "version": "1.2.0",
      "author": "xiaoyue",
      "installedAt": "2026-02-20T12:00:00Z",
      "location": "~/openclaw/skills/web-search",
      "fromTemplate": null
    },
    "template/full-stack-agent": {
      "version": "1.0.0",
      "author": "xiaoyue",
      "installedAt": "2026-02-20T12:00:00Z",
      "location": "~/.openclaw/templates/full-stack-agent",
      "children": ["skill/web-search", "config/coder-personality"]
    }
  }
}
```

---

_Last updated: 2026-02-20_
