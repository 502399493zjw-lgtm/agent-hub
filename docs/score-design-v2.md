# 水产市场评分体系 v2 — 累积制

> 核心理念：分数无上限，越用越高，持续累积，简单透明

---

## 一、资产分数：Hub Score（无上限）

**每发生一件事，加对应分数，永不扣分。**

| 事件 | 加分 | 说明 |
|------|------|------|
| 被安装 1 次 | +10 | 独立用户去重 |
| 被 Agent 直读 1 次 | +2 | `/raw` 接口调用，IP 去重/天 |
| 收到 1 条评论 | +3 | — |
| 收到 1 个评分 | +5 | — |
| 收到 5 星评分 | +8（替代上条） | 好评额外奖励 |
| 被收藏 1 次 | +5 | — |
| 作者发布新版本 | +15 | 版本号变更 |
| 被其他资产引用 | +20 | dependencies 里出现 |

**就这样。** 加法堆叠，不封顶。

### 冷启动

刚发布 = 0 分。第一个人装了就 +10。

### 展示

直接显示数字：`Hub Score: 328`，旁边可以标等级徽章（见下方）。

---

## 二、用户分数：Reputation（无上限）

**你的每个行为都在攒声誉。**

| 事件 | 加分 | 说明 |
|------|------|------|
| 发布 1 个资产 | +20 | — |
| 自己的资产被安装 1 次 | +5 | — |
| 自己的资产被直读 1 次 | +1 | — |
| 自己的资产收到评论 | +2 | — |
| 自己的资产收到 5 星 | +5 | — |
| 发布新版本（更新） | +10 | — |
| 给别人写评论 | +2 | 参与社区 |
| 给别人评分 | +1 | — |
| 提交 Issue | +3 | — |
| 邀请 1 个新用户 | +15 | 邀请码被使用 |
| 被别人关注 | +3 | — |

### 用户等级（水产主题）

| 声誉 | 等级 | 徽章 |
|------|------|------|
| 0+ | 🐚 贝壳 | Newcomer |
| 50+ | 🦐 虾兵 | Contributor |
| 200+ | 🐟 鱼将 | Builder |
| 500+ | 🐙 章鱼 | Expert |
| 1000+ | 🦈 鲨皇 | Master |
| 2000+ | 🐋 蓝鲸 | Legend |
| 5000+ | 🔱 海神 | Poseidon |

等级只升不降，无上限。

---

## 三、资产生命周期标签

不做强制晋升/降级，改为**自动打标签**：

| 标签 | 条件 | 说明 |
|------|------|------|
| 🆕 New | 发布 7 天内 | 新鲜出炉 |
| 🔥 Trending | 7 天内 +50 分以上 | 近期热门 |
| ⭐ Popular | Hub Score ≥ 100 | 受欢迎 |
| 🏆 Top | Hub Score ≥ 500 | 精品 |
| 💤 Dormant | 90 天未更新 | 可能不再维护 |

标签自动计算，不影响分数。

---

## 四、实现要点

### DB 变更

```sql
-- assets 表新增
ALTER TABLE assets ADD COLUMN install_count INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN raw_read_count INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN favorite_count INTEGER DEFAULT 0;
ALTER TABLE assets ADD COLUMN status TEXT DEFAULT 'published';

-- users 表新增
ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN level TEXT DEFAULT 'newcomer';

-- 事件流水表（审计+回放）
CREATE TABLE score_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL,       -- 'asset' | 'user'
  target_id TEXT NOT NULL,         -- asset id 或 user id
  event TEXT NOT NULL,             -- 'install' | 'raw_read' | 'comment' | ...
  points INTEGER NOT NULL,         -- 加了多少分
  source_id TEXT,                  -- 触发者 id
  created_at TEXT NOT NULL
);
```

### 核心函数

```typescript
function addScore(targetType: 'asset' | 'user', targetId: string, event: string, points: number, sourceId?: string) {
  // 1. 插入 score_events
  // 2. UPDATE assets/users SET hub_score/reputation = hub_score/reputation + points
  // 3. 如果是 user，检查是否升级 level
}
```

**一个函数搞定所有加分。** 每次发生事件调一下就完事。

---

_设计者：⚡ 小跃 | 2026-02-21_
