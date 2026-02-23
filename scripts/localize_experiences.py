#!/usr/bin/env python3
"""
Localize 29 experience assets in hub-test.db:
- Chinese display_name
- Chinese description (30-60 chars)
- Combined readme (Chinese + English original)
- files JSON array with README_CN.md and README.md
"""
import sqlite3
import json
import os
import sys

DB_PATH = os.path.expanduser("~/.openclaw/workspace/agent-hub/data/hub-test.db")

LOCALIZATIONS = {
    "x-447a3b266bbd57fe": {
        "cn_display_name": "Reddit 每日摘要",
        "cn_description": "每天自动抓取你关注的 Subreddit 热门帖子，根据你的偏好持续优化推荐，打造个性化 Reddit 日报。",
        "cn_readme": """# Reddit 每日摘要

## 痛点

Reddit 信息量巨大，手动刷多个 Subreddit 既耗时又容易错过精华内容。你需要一个自动化的筛选机制，每天把最值得看的帖子送到你面前。

## 方案概述

利用 OpenClaw 搭配 reddit-readonly Skill，每天定时抓取你指定的 Subreddit 热门帖子，并根据你的反馈不断优化推荐策略。

### 核心功能

- 浏览 Subreddit 的热门/最新/置顶帖子
- 按话题搜索帖子
- 拉取评论区上下文
- 生成精选列表供你手动浏览

> 注意：仅支持只读操作，不支持发帖、投票或评论。

## 所需 Skill

安装 [reddit-readonly](https://clawhub.ai/buksan1950/reddit-readonly) Skill，无需认证。

## 配置步骤

安装 Skill 后，向 OpenClaw 发送以下 Prompt：

```text
我想让你每天给我推送以下 Subreddit 的热门帖子。
<粘贴 Subreddit 列表>
为 Reddit 流程创建一个独立记忆，记录我喜欢看的帖子类型。
每天问我对推荐内容是否满意，把我的偏好保存为筛选规则（比如：不要 meme）。
每天下午 5 点运行这个流程，给我推送摘要。
```"""
    },

    "x-1ebb9e9f79f5e31e": {
        "cn_display_name": "YouTube 每日摘要",
        "cn_description": "自动追踪你喜爱的 YouTube 频道更新，获取视频转录并生成要点摘要，告别算法推荐的不可靠。",
        "cn_readme": """# YouTube 每日摘要

## 痛点

YouTube 的推荐算法不可靠——你明明订阅了频道，新视频却经常不出现在首页和通知中。手动逐个检查频道更新既低效又容易遗漏。

## 方案概述

通过 OpenClaw 搭配 youtube-full Skill，自动追踪你关注的 YouTube 频道，获取最新视频的转录内容并生成精华摘要，每天定时推送。

### 核心功能

- 自动获取指定频道的最新视频列表
- 提取视频转录并总结关键要点
- 每日定时推送摘要（或按需生成）

## 所需 Skill

安装 [youtube-full](https://clawhub.ai/therohitdas/youtube-full) Skill：

```bash
npx clawhub@latest install youtube-full
```

注册即送 100 免费额度，无需信用卡。频道查询和解析完全免费，仅转录消耗额度。

## 配置步骤

### 方式一：按频道订阅

```text
每天早上 8 点，获取以下 YouTube 频道的最新视频并生成摘要：
- @TED / @Fireship / @ThePrimeTimeagen / @lexfridman

对于过去 24-48 小时内发布的每个新视频：
1. 获取转录内容
2. 用 2-3 条要点总结核心观点
3. 附上视频标题、频道名和链接

将频道列表保存到记忆中，方便后续增删。
```

### 方式二：按关键词追踪

维护一个 seen-videos.txt 文件记录已处理的视频 ID，只获取未处理视频的转录，避免浪费额度。

## 使用技巧

- `channel/latest` 和 `channel/resolve` 接口完全免费
- 仅转录消耗 1 个额度
- 可要求不同风格的摘要：关键要点、精彩引用、有趣时间戳等"""
    },

    "x-e770a638b59931bd": {
        "cn_display_name": "X 账号分析",
        "cn_description": "对你的 X (Twitter) 账号进行深度质量分析，洞察内容模式和互动规律，发现爆款与冷门帖之间的差异。",
        "cn_readme": """# X 账号分析

## 痛点

X 自带的分析功能侧重数据统计，缺乏对内容质量的深度洞察。市面上的第三方工具收费 $10-$50/月，且多聚焦在数字而非"为什么"。你想知道的是：哪些帖子为什么爆了？哪些又为什么无人问津？

## 方案概述

利用 OpenClaw 的 Bird Skill 直接分析你的 X 账号，获取深度质量洞察：

- 哪些内容模式最容易引发传播？
- 哪些话题能带来最多互动？
- 高赞帖和低赞帖之间的核心差异是什么？

## 所需 Skill

Bird Skill（内置），通过 `clawhub install bird` 安装。

## 配置步骤

1. 确保 Bird Skill 正常工作
2. 建议为 ClawdBot 创建一个独立 X 账号以保障安全隔离
3. 登录 x.com，提供正确的 Cookie 信息（`auth-token`、`ct0`）授权 OpenClaw 访问
4. 让 OpenClaw 抓取你最近的 N 条推文，随意提问进行深度分析"""
    },

    "x-cec4705d5c028be5": {
        "cn_display_name": "多源科技新闻聚合",
        "cn_description": "从 109+ 个 RSS、Twitter、GitHub 和搜索引擎源自动聚合科技资讯，智能评分去重后推送高质量日报。",
        "cn_readme": """# 多源科技新闻聚合

## 痛点

关注 AI、开源和前沿科技需要每天刷几十个 RSS 源、Twitter 账号、GitHub 仓库和新闻网站。手动策展费时费力，现有工具要么缺乏质量过滤，要么配置复杂。

## 方案概述

搭建四层数据管道，定时自动运行：

1. **RSS 源**（46 个）— OpenAI、Hacker News、MIT Tech Review 等
2. **Twitter/X KOL**（44 个账号）— @karpathy、@sama、@VitalikButerin 等
3. **GitHub Releases**（19 个仓库）— vLLM、LangChain、Ollama、Dify 等
4. **网页搜索**（4 个主题）— 通过 Brave Search API

所有文章自动去重（标题相似度匹配）并质量评分（权威来源 +3、多源交叉 +5、时效性 +2、互动量 +1），最终推送到 Discord、邮箱或 Telegram。

## 所需 Skill

- [tech-news-digest](https://clawhub.ai/skills/tech-news-digest) — `clawhub install tech-news-digest`
- [gog](https://clawhub.ai/skills/gog)（可选，用于邮件推送）

## 配置步骤

向 OpenClaw 发送安装和配置 Prompt，即可设置每日推送渠道和自定义信息源。

## 环境变量（可选）

- `X_BEARER_TOKEN` — Twitter/X API Bearer Token
- `BRAVE_API_KEY` — Brave Search API Key
- `GITHUB_TOKEN` — GitHub Token（提升 API 速率限制）"""
    },

    "x-d07423d9b3152b80": {
        "cn_display_name": "目标驱动自主任务",
        "cn_description": "将 OpenClaw 变成自驱型员工——你只需描述目标，Agent 每天自动规划并执行任务，甚至一夜之间构建 MVP 应用。",
        "cn_readme": """# 目标驱动自主任务

## 痛点

大多数人都有宏大目标，却难以拆解为每日可执行的步骤。即便拆解了，执行也耗尽了所有时间。你需要的不是一个听命行事的工具，而是一个能主动规划并执行的 AI 员工。

## 方案概述

将 OpenClaw 打造为自驱型员工：你只需一次性输入所有目标，Agent 每天自动生成 4-5 个可执行任务并亲自完成——包括在你睡觉时构建惊喜 Mini App。

### 核心功能

- 一次性输入所有个人和职业目标
- Agent 每天早上自动规划可自主完成的任务
- 任务类型多样：调研、脚本编写、功能开发、内容创作、竞品分析
- 自动执行并在自建看板上跟踪进度
- 每晚可构建一个惊喜 MVP 应用

## 所需 Skill

- Telegram 或 Discord 集成
- `sessions_spawn` / `sessions_send`（自主任务执行）
- Next.js 或类似框架（看板——OpenClaw 会为你搭建）

## 配置步骤

### 第一步：输入你的目标（最关键）

把你想实现的一切都告诉 OpenClaw——事业、个人、商业目标。描述越详细，Agent 生成的任务越精准。

### 第二步：设置自主任务

让 Agent 每天早上 8:00 自动想出 4-5 个任务，自行调度并执行，在看板上实时更新状态。

### 第三步：搭建看板（可选）

让 OpenClaw 用 Next.js 搭建一个看板，展示任务的待办、进行中和已完成状态。

## 核心洞察

- 目标描述越详细越好——上下文越丰富，任务越精准
- Agent 会发现你意想不到的任务和机会
- 这个系统会随时间复合增长——Agent 学会哪类任务最有效"""
    },

    "x-ea01bccbb9d8f066": {
        "cn_display_name": "YouTube 内容流水线",
        "cn_description": "为日更 YouTube 创作者打造的自动化内容发掘系统——实时扫描热点、语义去重避免重复、自动生成选题大纲。",
        "cn_readme": """# YouTube 内容流水线

## 痛点

作为日更 YouTube 创作者，每天寻找新鲜、及时的视频选题非常耗时。跟踪已覆盖的话题以避免重复、保持领先趋势更是难上加难。

## 方案概述

自动化整个内容发掘和调研流程：

- **定时扫描**：每小时 Cron 任务扫描 AI 领域突发新闻（网页 + X/Twitter），推送选题建议到 Telegram
- **90 天视频目录**：维护历史视频记录（含播放量和话题分析），避免重复覆盖
- **语义去重**：所有选题存入 SQLite 数据库并生成向量嵌入，确保不会重复推荐
- **一键深度调研**：在 Slack 分享链接，OpenClaw 自动调研话题、搜索 X 相关帖子、查询知识库，创建含完整大纲的 Asana 卡片

## 所需 Skill

- `web_search`（内置）
- [x-research-v2](https://clawhub.ai)（X/Twitter 搜索）
- [knowledge-base](https://clawhub.ai)（RAG）
- Asana 或 Todoist 集成
- `gog` CLI（YouTube 数据分析）

## 配置步骤

1. 设置 Telegram 话题接收选题
2. 安装 knowledge-base 和 x-research Skill
3. 创建 SQLite 数据库用于选题追踪
4. 配置每小时扫描、语义去重和 Slack 触发深度调研"""
    },

    "x-0d7d82433b9a095f": {
        "cn_display_name": "多 Agent 内容工厂",
        "cn_description": "在 Discord 中搭建多 Agent 内容流水线——调研、写作、设计三个 Agent 协作，一觉醒来内容就绪。",
        "cn_readme": """# 多 Agent 内容工厂

## 痛点

内容创作包含三个阶段——调研、写作、设计——大多数创作者仍在手动完成每个环节。即便有 AI 工具辅助，也需要逐步操作。你需要的是一条全自动流水线，一个 Agent 的产出直接驱动下一个。

## 方案概述

在 Discord 中搭建多 Agent 内容工厂，不同 Agent 在各自频道中负责调研、写作和视觉素材：

- **调研 Agent**：每天早上扫描热门话题、竞品内容和社交媒体，发现最佳内容机会
- **写作 Agent**：将最佳选题转化为完整脚本、推文串或 Newsletter 草稿
- **封面 Agent**：生成 AI 缩略图或封面图
- 自动按计划运行（如每天早 8 点），你醒来就能审阅完成的内容

## 所需 Skill

- Discord 集成（多频道）
- `sessions_spawn` / `sessions_send`
- 社交媒体调研工具
- 图像生成（本地或 API）

## 配置步骤

1. 创建 Discord 服务器，设置 `#research`、`#scripts`、`#thumbnails` 频道
2. 配置三个 Agent 的职责和调度
3. 根据平台定制输出格式——推文串、视频脚本、博客文章等

## 核心洞察

- 链式 Agent 是关键——调研驱动写作，写作驱动设计
- Discord 频道让你轻松分别审阅和反馈
- 可适配任何内容格式"""
    },

    "x-2fea4606c37395dc": {
        "cn_display_name": "N8n 工作流编排",
        "cn_description": "通过 N8n Webhook 代理模式实现 OpenClaw 与外部 API 的安全交互——凭证隔离、可视化调试、零 Token 消耗。",
        "cn_readme": """# OpenClaw + N8n 工作流编排

## 痛点

让 AI Agent 直接管理 API Key 并调用外部服务是安全隐患。每新增一个集成就多一个凭证暴露风险，而确定性的子任务（发邮件、更新表格）不应消耗 LLM Token。

## 方案概述

OpenClaw 通过 Webhook 将所有外部 API 交互委托给 N8n 工作流——Agent 永远不接触凭证，每个集成可视化可审计。

### 三大优势

- **可观测性**：N8n 可视化 UI 让每个工作流一目了然
- **安全性**：API Key 存储在 N8n 凭证库，Agent 只知道 Webhook URL
- **性能**：确定性任务作为工作流运行，零 Token 消耗

### 工作原理

```
OpenClaw → Webhook（无凭证）→ N8n 工作流（含 API Key）→ 外部服务
```

## 所需 Skill

- N8n API 访问
- Docker（推荐预配置方案）

## 配置步骤

### 方式一：Docker 一键部署

```bash
git clone https://github.com/caprihan/openclaw-n8n-stack.git
cd openclaw-n8n-stack && cp .env.template .env
docker-compose up -d
```

### 方式二：手动配置

在 AGENTS.md 中添加代理模式规则：所有外部 API 调用通过 N8n Webhook，永不存储凭证。

## 核心洞察

- N8n 有 400+ 集成节点，大部分外部服务已支持
- 「构建 → 测试 → 锁定」循环至关重要
- 每次执行都有完整审计日志"""
    },

    "x-b27ed543005231eb": {
        "cn_display_name": "自愈式家庭服务器",
        "cn_description": "将 OpenClaw 打造为 7×24 运维 Agent——自动健康检查、故障自愈、每日晨报、安全审计，全面托管 HomeLab。",
        "cn_readme": """# 自愈式家庭服务器与基础设施管理

## 痛点

运营家庭服务器意味着 7×24 小时随时待命：凌晨服务宕机、证书静默过期、磁盘空间耗尽、Pod 反复崩溃——而你可能正在睡觉。

## 方案概述

将 OpenClaw 变成持久化运维 Agent，具备 SSH 访问、Cron 自动化以及故障检测、诊断和修复能力。

### 核心功能

- **自动健康监控**：定时检查服务、部署和系统资源
- **故障自愈**：发现问题后自主修复（重启 Pod、扩容、修正配置）
- **基础设施即代码**：编写并应用 Terraform、Ansible、K8s 清单
- **每日晨报**：系统健康、日历、天气和任务状态汇总
- **邮件分拣**：扫描收件箱，标记可操作项，归档噪音
- **安全审计**：定期扫描硬编码密钥、特权容器和过度权限

## 所需 Skill

- SSH 访问 / `kubectl` / `terraform` / `ansible`
- `1password` CLI / `gog` CLI / 日历 API

## 配置步骤

### 1. 核心 Agent 配置
在 AGENTS.md 中定义访问范围和安全规则。

### 2. Cron 调度
每 15 分钟检查任务 → 每小时健康检查 → 每 6 小时自检 → 每日晨报 → 每周安全审计。

### 3. 安全设置（必须！）
TruffleHog pre-push hook + 本地 Gitea 暂存 + 1Password 专用 vault + 分支保护。

## 核心洞察

- AI **会**硬编码密钥——pre-push hook 和密钥扫描是必须的
- Cron 定时自动化比临时命令提供更多日常价值
- 知识提取的价值随时间复合增长"""
    },

    "x-888fe0246e77ac40": {
        "cn_display_name": "自主项目管理",
        "cn_description": "通过 Subagent 实现去中心化项目管理——Agent 基于共享 STATE.yaml 自主协作，无需中央编排瓶颈。",
        "cn_readme": """# 自主项目管理与 Subagent 协作

## 痛点

传统编排模式让主 Agent 变成交通警察，成为瓶颈。复杂项目（多仓库重构、调研冲刺）需要能并行工作、无需持续监督的 Agent 群。

## 方案概述

去中心化项目管理：多个 Subagent 通过共享 STATE.yaml 文件自主协作，无需中央编排器。

### 核心设计

- **去中心化协调**：Agent 读写共享 `STATE.yaml` 协同工作
- **并行执行**：多个 Subagent 同时处理独立任务
- **无编排器开销**：主会话保持精简（CEO 模式——仅做战略决策）
- **自文档化**：任务状态持久化在版本控制文件中

## 工作流程

1. 主 Agent 收到任务 → 分发给 Subagent
2. Subagent 读取 STATE.yaml → 找到分配的任务
3. Subagent 自主工作 → 更新进度
4. 其他 Agent 轮询 → 接手已解除阻塞的工作
5. 主 Agent 定期检查 → 审查状态、调整优先级

## 所需 Skill

- `sessions_spawn` / `sessions_send`
- 文件系统访问
- Git（推荐）

## 核心洞察

- STATE.yaml 比编排器扩展性更好
- Git 提交变更即获得完整审计日志
- 主 Agent 做得越少，响应越快"""
    },

    "x-e26c133be056850c": {
        "cn_display_name": "多渠道智能客服",
        "cn_description": "将 WhatsApp、Instagram、邮件和 Google 评价整合为统一 AI 客服平台，自动响应常见咨询并支持人工转接。",
        "cn_readme": """# 多渠道 AI 智能客服平台

## 痛点

中小企业同时管理 WhatsApp、Instagram 私信、邮件和 Google 评价，客户期望全天候即时响应，但雇人值守成本高昂。

## 方案概述

将所有客户触点整合到一个 AI 统一收件箱中：

### 核心功能

- **统一收件箱**：WhatsApp Business、Instagram 私信、Gmail、Google 评价一站管理
- **AI 自动应答**：处理常见问题、预约请求和一般咨询
- **人工转接**：复杂问题自动升级或标记待审
- **测试模式**：演示系统效果时不影响真实客户
- **业务知识库**：基于你的服务、价格和政策定制回答
- **多语言支持**：自动检测并匹配客户语言

## 所需 Skill

- WhatsApp Business API / Instagram Graph API
- `gog` CLI（Gmail）/ Google Business Profile API

## 配置步骤

1. 连接各渠道 API
2. 创建业务知识库（服务、价格、营业时间、FAQ）
3. 在 AGENTS.md 中配置路由规则和升级策略
4. 设置心跳检查监控响应状态"""
    },

    "x-daf8be5ee0d8e5cf": {
        "cn_display_name": "电话语音助手",
        "cn_description": "通过电话与 AI Agent 对话——无需 App 或浏览器，随时随地语音访问日历、任务和网页搜索。",
        "cn_readme": """# 电话语音助手

## 痛点

你想从任何电话访问 AI Agent，无需智能手机 App 或浏览器。开车、走路或双手被占时，你需要免提语音交互。

## 方案概述

ClawdTalk 让 OpenClaw 可以接听和拨打电话，将任意电话变成 AI 助手的入口：

### 核心功能

- 拨打指定号码即可与 AI Agent 语音对话
- 通过语音获取日历提醒、Jira 更新和网页搜索结果
- 集成 Telnyx 实现可靠的电话连接
- SMS 支持即将上线

## 所需 Skill

- [ClawdTalk](https://github.com/team-telnyx/clawdtalk-client)
- 日历 Skill（Google Calendar 或 Outlook）
- Jira Skill
- 网页搜索 Skill

## 配置步骤

安装 ClawdTalk Skill 后，即可通过拨打电话号码直接与 OpenClaw 对话。支持日历查询、任务更新、网页搜索等常见操作。"""
    },

    "x-ccbe6dc6f97be9db": {
        "cn_display_name": "邮箱自动整理",
        "cn_description": "每天自动阅读订阅邮件并生成精华摘要，根据你的反馈持续优化推荐，告别 Newsletter 轰炸。",
        "cn_readme": """# 邮箱自动整理

## 痛点

订阅邮件（Newsletter）如洪水般涌入邮箱，堆积如山却从不打开。你需要一个自动化的筛选和摘要机制，只把真正重要的内容呈现给你。

## 方案概述

利用 OpenClaw 搭配 Gmail Skill，每天定时阅读所有 Newsletter 并生成精华摘要，同时根据你的反馈不断优化选择标准。

## 所需 Skill

安装 [Gmail OAuth Setup](https://clawhub.ai/kai-jar/gmail-oauth) Skill。

## 配置步骤

1. （可选）为 OpenClaw 创建一个专用 Gmail 账号
2. （可选）将所有 Newsletter 订阅迁移到 OpenClaw 专用邮箱
3. 安装 Skill 并确认正常工作
4. 向 OpenClaw 发送配置 Prompt：

```text
每天晚上 8 点运行 Cron 任务，阅读过去 24 小时的所有 Newsletter 邮件，
给我一份最重要内容的摘要和原文链接。
然后问我对摘要质量的反馈，根据我的偏好更新记忆，优化未来的推荐。
```"""
    },

    "x-017813f6146f734a": {
        "cn_display_name": "个人 CRM",
        "cn_description": "自动扫描邮件和日历发现联系人，构建个人关系数据库，每天会议前推送参会者背景简报。",
        "cn_readme": """# 个人 CRM 与自动联系人发现

## 痛点

手动记录见过的人、时间和谈话内容几乎不可能。重要的跟进不知不觉就遗漏了，重要会议前也想不起与对方的交往背景。

## 方案概述

自动构建和维护个人 CRM：

- **每日自动扫描**：Cron 任务扫描邮件和日历，发现新联系人和互动记录
- **结构化数据库**：存储联系人及关系上下文
- **自然语言查询**：「我认识 [某人] 吗？」「谁需要跟进？