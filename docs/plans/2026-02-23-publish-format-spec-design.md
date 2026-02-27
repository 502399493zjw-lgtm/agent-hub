# Publish 格式规范设计

> 日期：2026-02-23
> 状态：approved
> 作者：小跃 + 指挥官

---

## 1. 背景

水产市场有 5 种资产类型（skill / plugin / channel / trigger / experience），当前 publish 流程缺乏统一的格式校验：
- 没有强制要求 README.md，导致社区页面展示信息不全
- displayName / description 来源不统一，部分资产上架后信息缺失
- install 会 fallback 生成文件（如自动生成 SKILL.md），掩盖了发布时的信息缺失问题
- 不同类型的入口文件、安装位置、Agent 使用方式各不相同，但缺乏明确规范

## 2. 设计目标

1. **统一社区展示质量**：每个资产都有 displayName + description + 可读的详情内容
2. **Hard block 策略**：缺少必需项时拒绝发布，并返回明确提示，引导 Agent 补全
3. **各类型各走各的**：入口文件、metadata 来源、安装位置按类型区分
4. **install 不造假**：不做 fallback 文件生成，下载什么就是什么

## 3. 各类型规范

### 3.1 通用必需项（所有类型）

| 字段 | 说明 | 校验方式 |
|------|------|---------|
| displayName | 展示名，纯文本，禁 emoji | 非空字符串 |
| description | 一句话描述 | 非空字符串 |
| README.md | 社区详情页展示内容 | package 中存在该文件 |

> **例外**：skill 类型的详情页内容用 SKILL.md 正文（非 YAML 部分），但仍然需要 README.md 作为 package 中的人类可读文档。
>
> **更正**：skill 不要求 README.md。SKILL.md 正文同时承担详情页展示和文档功能。其余 4 种类型必须有 README.md。

### 3.2 Skill

| 项目 | 规范 |
|------|------|
| 必需入口文件 | `SKILL.md`（含 frontmatter） |
| displayName 来源 | SKILL.md frontmatter `displayName` 或 `name` |
| description 来源 | SKILL.md frontmatter `description` |
| 社区详情页内容 | SKILL.md 正文（frontmatter 之后的部分） |
| 不要求 | README.md |
| install 位置 | `~/.openclaw/skills/<name>/` |
| Agent 使用方式 | OpenClaw 自动扫描 SKILL.md → 注入 system prompt |

**SKILL.md frontmatter 示例**：

```yaml
---
name: weather
displayName: "天气查询"
description: "通过 wttr.in 获取全球任意城市的实时天气和预报"
version: 1.0.0
type: skill
tags: "weather, wttr"
---

# 天气查询技能

（这部分是社区详情页展示内容，也是 Agent 的操作指引）
...
```

**校验规则**：
1. package 中必须有 `SKILL.md`
2. SKILL.md 必须有 frontmatter（`---` 包裹的 YAML 块）
3. frontmatter 中必须有 `name`（非空）
4. frontmatter 中必须有 `description`（非空）
5. SKILL.md 正文（frontmatter 之后）不能为空

### 3.3 Plugin

| 项目 | 规范 |
|------|------|
| 必需入口文件 | `openclaw.plugin.json` |
| displayName 来源 | 优先 plugin.json `name` → 没有则从 README.md 标题提取 |
| description 来源 | 优先 plugin.json `description` → 没有则从 README.md 首段提取 |
| 社区详情页内容 | `README.md` |
| install 位置 | `~/.openclaw/extensions/<name>/` |
| Agent 使用方式 | OpenClaw 自动加载 plugin |

**校验规则**：
1. package 中必须有 `openclaw.plugin.json`
2. plugin.json 必须有 `id`（非空）
3. package 中必须有 `README.md`（非空）
4. displayName 必须可提取（plugin.json `name` 或 README 标题，至少一个存在）
5. description 必须可提取（plugin.json `description` 或 README 首段，至少一个存在）

### 3.4 Channel

| 项目 | 规范 |
|------|------|
| 必需入口文件 | `openclaw.plugin.json`（含 `channels` 字段） |
| displayName 来源 | 优先 plugin.json `name` → 没有则从 README.md 标题提取 |
| description 来源 | 优先 plugin.json `description` → 没有则从 README.md 首段提取 |
| 社区详情页内容 | `README.md` |
| install 位置 | `~/.openclaw/extensions/<name>/` |
| Agent 使用方式 | OpenClaw 自动加载 channel |

**校验规则**：
1. 同 Plugin 全部规则
2. 额外：plugin.json 必须有 `channels` 字段（数组，长度 ≥ 1）

### 3.5 Trigger

| 项目 | 规范 |
|------|------|
| 必需入口文件 | `README.md` |
| displayName 来源 | README.md 标题（第一个 `# ` 行） |
| description 来源 | README.md 首段（标题后第一段非空文本） |
| 社区详情页内容 | `README.md` |
| install 位置 | `~/.openclaw/triggers/<name>/` |
| Agent 使用方式 | Agent 读 README → 配 cron / heartbeat / 脚本 |

**校验规则**：
1. package 中必须有 `README.md`（非空）
2. README 必须有标题（`# xxx`）→ 用作 displayName
3. README 标题后必须有描述段落 → 用作 description

### 3.6 Experience

| 项目 | 规范 |
|------|------|
| 必需入口文件 | `README.md` |
| displayName 来源 | README.md 标题（第一个 `# ` 行） |
| description 来源 | README.md 首段（标题后第一段非空文本） |
| 社区详情页内容 | `README.md` |
| install 位置 | `~/.openclaw/experiences/<name>/` |
| Agent 使用方式 | Agent 读 README → 按指引配置/操作 |

**校验规则**：
1. 同 Trigger

## 4. Publish 校验流程

```
Agent 调用 publish API / CLI
  │
  ├─ 检查 type 字段
  │   └─ 无 type → 尝试自动检测（SKILL.md → skill, plugin.json → plugin/channel）
  │      └─ 检测失败 → reject: "无法判断资产类型，请在 SKILL.md frontmatter 或 metadata 中指定 type"
  │
  ├─ 按类型校验入口文件
  │   ├─ skill: SKILL.md 存在？
  │   ├─ plugin: openclaw.plugin.json 存在？
  │   ├─ channel: openclaw.plugin.json 存在且含 channels？
  │   ├─ trigger: README.md 存在？
  │   └─ experience: README.md 存在？
  │   └─ 缺失 → reject: "缺少必需入口文件：{文件名}"
  │
  ├─ 提取 displayName + description
  │   ├─ skill: 从 SKILL.md frontmatter
  │   ├─ plugin/channel: 优先 plugin.json → fallback README.md
  │   └─ trigger/experience: 从 README.md
  │   └─ 提取失败 → reject: "无法提取 displayName/description，请确保 {具体要求}"
  │
  ├─ 校验社区展示内容
  │   ├─ skill: SKILL.md 正文非空？
  │   └─ 其余: README.md 非空？
  │   └─ 为空 → reject: "社区展示内容为空，请补充 {SKILL.md 正文 / README.md}"
  │
  └─ 全部通过 → 继续发布流程
```

**reject 响应格式**：

```json
{
  "error": "publish_validation_failed",
  "message": "发布校验失败：缺少 README.md",
  "missing": ["README.md"],
  "hint": "请创建 README.md 文件，包含：标题（# 资产名）、一段描述、使用说明。Agent 可自动生成。",
  "type": "plugin",
  "required": {
    "entryFile": "openclaw.plugin.json ✅",
    "readme": "README.md ❌",
    "displayName": "—（需要 README 才能提取）",
    "description": "—（需要 README 才能提取）"
  }
}
```

## 5. Install 行为

### 5.1 按类型安装位置

| 类型 | 安装位置 | 安装后行为 |
|------|---------|----------|
| skill | `~/.openclaw/skills/<name>/` | OpenClaw 下次启动自动扫描 SKILL.md |
| plugin | `~/.openclaw/extensions/<name>/` | OpenClaw 下次启动自动加载 |
| channel | `~/.openclaw/extensions/<name>/` | OpenClaw 下次启动自动加载 |
| trigger | `~/.openclaw/triggers/<name>/` | 提示 Agent 读 README 配置 |
| experience | `~/.openclaw/experiences/<name>/` | 提示 Agent 读 README 操作 |

### 5.2 install 不生成 fallback 文件

当前 CLI 在资产没有 package 时会 fallback 生成 SKILL.md → **删除此逻辑**。

install 行为简化为：
1. 调 API 获取资产 metadata + package URL
2. 下载 package（tar.gz）
3. 解压到对应目录
4. 写 `manifest.json`（安装记录）
5. **skill/plugin/channel**：提示 "已安装，重启 OpenClaw 生效"
6. **trigger/experience**：提示 "已安装，请读 README.md 完成配置"

### 5.3 无 package 的资产

如果资产没有 package file（metadata-only），install 应该：
- 报错："该资产没有可安装的 package，请在水产市场页面查看详情"
- 不再 fallback 生成文件

## 6. CLI publish 流程改动

当前 `extractMetadata()` 已有多优先级检测逻辑，需要改为：

1. **校验优先于提取**：先按 type 检查必需文件是否存在
2. **提取 displayName/description**：按各类型规则提取
3. **校验完整性**：所有必需项都有值？
4. **失败时给出明确提示**：告诉 Agent 缺什么、怎么补

**CLI 端校验**（在打包上传之前就拦截，节省网络开销）：

```
openclawmp publish .
  │
  ├─ 检测 type（现有逻辑）
  ├─ 按 type 校验必需文件（新增）
  │   └─ 缺失 → 打印清晰的错误 + 提示 Agent 怎么补
  ├─ 提取 metadata（现有逻辑，按新规则调整来源优先级）
  ├─ 校验 displayName + description 非空（新增）
  │   └─ 缺失 → 打印错误 + 提示
  ├─ 预览确认（现有逻辑）
  └─ 打包上传（现有逻辑）
```

**服务端也做相同校验**（double check，防止绕过 CLI 直接调 API）。

## 7. 改动清单

### 7.1 publish API（服务端）

文件：`src/app/api/v1/assets/publish/route.ts`

- [ ] 解压 package 后，按 type 校验入口文件
- [ ] 按 type + 优先级提取 displayName / description
- [ ] 校验社区展示内容（SKILL.md 正文 / README.md）
- [ ] 校验失败 → 返回 400 + 结构化错误（missing / hint / required）
- [ ] 去掉 `metadataIncomplete` 宽容逻辑，改为 hard block

### 7.2 publish CLI（客户端）

文件：`~/.agents/skills/openclawmp/scripts/lib/commands/publish.js`

- [ ] `extractMetadata()` 调整：按 type 分别走不同提取路径
- [ ] 新增 `validatePublish(type, skillDir)` 函数：前置校验
- [ ] 校验失败 → 清晰的 error 输出 + Agent 可读的修复提示

### 7.3 install CLI

文件：`~/.agents/skills/openclawmp/scripts/lib/commands/install.js`

- [ ] plugin/channel 安装目录改为 `~/.openclaw/extensions/<name>/`（当前是 `plugins/` `channels/`）
- [ ] 删除 fallback SKILL.md 生成逻辑
- [ ] 无 package 时报错，不再 fallback
- [ ] trigger/experience 安装后提示 "请读 README.md 完成配置"

### 7.4 openclawmp 技能文档

文件：`~/.agents/skills/openclawmp/SKILL.md`

- [ ] 更新发布规范章节，写明各类型必需文件
- [ ] 更新 install 行为说明

## 8. 不做的事情

- **不改 OpenClaw 核心的 skill 扫描逻辑**——那是上游
- **不改 openclaw.plugin.json 的 schema**——那是上游标准
- **不新增 frontmatter 字段**——用现有字段就够
- **不做 AI 自动补全**——reject 时提示 Agent 手动补，Agent 自己会写

---

_设计完成：2026-02-23_
