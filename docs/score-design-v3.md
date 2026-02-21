# 水产市场评分体系 v3 — 极简版

> 资产：下载数为王，像 GitHub Stars 一样直觉
> 用户：双币制 — 声望（荣誉）+ 养虾币（货币）

---

## 一、资产：下载数 + 详情指标

### 列表页（核心展示）

```
┌──────────────────────────────────────┐
│ 📦 weather-forecast          v1.2.0  │
│ 天气预报技能，支持多城市查询          │
│ ⬇️ 1,234 下载                        │
└──────────────────────────────────────┘
```

**就展示一个数字：下载数（installs）。** 排序也按这个来。

### 详情页（展开更多）

| 指标 | 说明 |
|------|------|
| ⬇️ 下载数 | 独立用户安装次数 |
| ⭐ 评分 | 平均分 + 评分人数（如 4.5 / 12 人评） |
| 🐛 Issues | `3 open / 15 closed`（解决率 83%） |
| 💬 评论数 | 社区讨论热度 |
| 📅 最近更新 | 最后一次版本发布时间 |
| 🔗 被引用 | 多少其他资产依赖了它 |

**不算综合分。** 下载数就是最直觉的"这个东西好不好"信号。

---

## 二、用户：双币制

### 2.1 声望（Reputation）— 荣誉货币，只升不降

**代表你在社区的贡献和信任度。不能花，不能转。**

| 事件 | 声望 + |
|------|--------|
| 发布 1 个资产 | +20 |
| 你的资产被安装 1 次 | +3 |
| 你的资产收到好评（4-5星） | +5 |
| 你关闭了 1 个 Issue | +5 |
| 你写了 1 条评论 | +2 |
| 你提了 1 个 Issue | +2 |
| 你邀请了 1 个新用户 | +10 |
| 发布新版本 | +8 |

**用户等级**（按声望）：

| 声望 | 等级 |
|------|------|
| 0+ | 🐚 贝壳 |
| 50+ | 🦐 虾兵 |
| 200+ | 🐟 鱼将 |
| 500+ | 🐙 章鱼 |
| 1000+ | 🦈 鲨皇 |
| 3000+ | 🐋 蓝鲸 |
| 8000+ | 🔱 海神 |

### 2.2 养虾币（Shrimp Coins 🦐💰）— 实用货币，能赚能花

**赚取方式**：

| 事件 | 养虾币 + |
|------|----------|
| 注册账号 | +100（新手礼包） |
| 每日登录 | +5 |
| 发布资产 | +50 |
| 你的资产被安装 1 次 | +10 |
| 你的资产收到 5 星评价 | +15 |
| 写评论 | +3 |
| 提 Issue | +5 |
| 邀请新用户 | +30 |
| 发布新版本 | +20 |
| 完成悬赏任务（未来） | +N（按任务定价） |

**消耗方式**（未来）：

| 用途 | 养虾币 - |
|------|----------|
| 🔥 Token 费用抵扣 | 按比例抵扣 AI 调用费 |
| 🏷️ 资产置顶推广 | -N（限时首页推荐） |
| 🎨 专属头衔/徽章 | -N（装饰性消费） |
| 🏆 发布悬赏任务 | -N（悬赏开发某个 Skill） |

**Token 抵扣换算**（示例，后续可调）：
```
100 养虾币 = 1 元 Token 额度
```

---

## 三、数据模型

```sql
-- 资产表：加 installs 字段就行
ALTER TABLE assets ADD COLUMN installs INTEGER DEFAULT 0;

-- 用户表：加声望 + 养虾币
ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN shrimp_coins INTEGER DEFAULT 100;  -- 注册送 100
ALTER TABLE users ADD COLUMN level TEXT DEFAULT 'shell';

-- 流水表：记录所有变动
CREATE TABLE coin_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  coin_type TEXT NOT NULL,         -- 'reputation' | 'shrimp_coin'
  amount INTEGER NOT NULL,         -- +N 或 -N
  event TEXT NOT NULL,             -- 'asset_installed' | 'publish' | 'token_deduct' ...
  ref_id TEXT,                     -- 关联的 asset_id 或 order_id
  balance_after INTEGER NOT NULL,  -- 变动后余额
  created_at TEXT NOT NULL
);
```

### 核心函数

```typescript
// 一个函数搞定所有加减
function addCoins(userId: string, coinType: 'reputation' | 'shrimp_coin', 
                  amount: number, event: string, refId?: string): void

// 检查余额（花费前校验）
function hasEnoughCoins(userId: string, amount: number): boolean

// 用户等级自动计算
function getUserLevel(reputation: number): string
```

---

## 四、优先级

### Phase 1（现在做）
- 资产展示下载数
- 用户有声望 + 养虾币字段
- 安装/发布/评论时自动加分加币

### Phase 2（后续）
- 详情页展示 Issue 数 / 解决率
- 养虾币消费场景（Token 抵扣）
- 悬赏任务系统

---

_⚡ 小跃 | 2026-02-21_
