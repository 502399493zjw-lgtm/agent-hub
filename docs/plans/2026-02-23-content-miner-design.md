# 水产市场内容矿工（Marketplace Content Miner）设计文档

> 日期：2026-02-23
> 状态：已批准，进入实现

## 概述

Agent 每天定时回顾当日对话，把有复用价值的工作成果自动打包成水产市场资产，经用户审批后发布。

## 核心流程

```
每日 22:00 Cron 触发
    ↓
扫描当天所有 session 对话（sessions_list + sessions_history）
    ↓
提炼候选成果（脚本/方案/配置/工具）
    ↓
判断资产类型（skill/experience/plugin/trigger/channel）
    ↓
安全扫描（密钥/token/个人信息检测）→ 软警告，不硬拦截
    ↓
打包成标准资产目录
    ↓
[审批模式]
  ├─ ask（默认）→ 推给用户过目（含安全警告）→ 用户说"发" → publish
  └─ auto → 直接 publish + 通知用户
```

## 安全审查（软警告模式）

发布前扫描所有文件内容，命中时**不阻断**，而是在审批消息中用 ⚠️ 高亮标注，由用户决定是否继续发布。

### 扫描规则

| 类别 | 检测模式 |
|------|---------|
| API Key | `sk-`, `ak-`, `AKIA`, `key_`, `api_key=`, `apikey:` 等前缀 |
| Token | `token=`, `bearer `, `ghp_`, `gho_`, `github_pat_`, `xoxb-`, `xoxp-` |
| 密码 | `password=`, `passwd`, `secret=`, `SECRET_KEY` |
| 私钥 | `-----BEGIN.*PRIVATE KEY-----` |
| 个人信息 | 邮箱地址、手机号（正则）、内网 IP |
| 环境变量 | `.env` 文件内容、`export.*KEY=`、`export.*TOKEN=` |
| 路径泄露 | `/Users/<username>/`、`/home/<username>/` |
| 内部标识 | `open_id: ou_`、`chat_id: oc_`、内部域名 |

## 成果判定规则

### 值得打包的信号

| 信号 | 说明 | 推荐类型 |
|------|------|---------|
| 写了完整脚本/工具且效果好 | 有代码 + 用户确认好用 | skill |
| 解决了一个通用问题的配置方案 | cron 配置、系统调优、工作流 | experience |
| 写了 OpenClaw 扩展代码 | openclaw.plugin.json 相关 | plugin/channel |
| 配了事件监听/自动触发 | fswatch/webhook/cron 链路 | trigger |
| 多轮对话解决复杂问题 | 有诊断过程 + 最终方案 | experience |

### 排除条件

- 纯一次性查询（天气、搜索、翻译）
- 涉及用户私有数据的操作
- 未完成/失败的尝试
- 已经在市场上存在的高度类似资产

## 配置项

| 配置 | 可选值 | 默认 | 说明 |
|------|--------|------|------|
| publish_mode | ask / auto | ask | ask=推给用户审批，auto=直接发 |
| scan_time | cron 表达式 | `0 22 * * *` | 每日扫描时间 |
| scan_hours | 数字 | 24 | 回看多少小时的对话 |
| max_candidates | 数字 | 3 | 单次最多提炼几个候选 |
| min_quality_score | 1-10 | 6 | 低于此分的候选丢弃 |
| blocked_patterns | 正则列表 | （内置安全清单） | 额外自定义屏蔽模式 |
| author_name | 字符串 | 从水产市场账号获取 | 发布时的作者名 |

## 文件结构

```
marketplace-content-miner/
├── README.md              # 一切合一：元数据 + 社区展示 + 安装指南
├── scan-prompt.md         # Cron 任务的完整 prompt
├── security-rules.md      # 安全审查规则（正则 + 说明）
├── quality-rubric.md      # 成果质量评分标准
├── miner-config.md        # 可调配置项
└── templates/
    ├── publish-draft.md   # 审批消息模板（含安全警告区）
    └── miner-log.md       # 每日挖矿日志模板
```

## 安装方式

```bash
openclawmp install experience/@marketplace-content-miner
```

配置 Cron：
```bash
openclaw cron add \
  --name "Content Miner: Daily Scan" \
  --cron "0 22 * * *" \
  --session isolated \
  --message "读取 ~/.openclaw/experiences/marketplace-content-miner/scan-prompt.md 并执行" \
  --announce
```

## 质量评分标准（1-10）

- **通用性**（权重 40%）：其他 Agent/用户能直接用吗？
- **完整性**（权重 30%）：是否包含必要的说明、示例、错误处理？
- **独特性**（权重 30%）：市场上是否已有类似资产？
