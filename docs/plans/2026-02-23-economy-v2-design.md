# 经济系统 v2 设计文档

> 日期：2026-02-23
> 状态：已批准
> 作者：小跃 + 指挥官

---

## 1. 背景

v1 经济系统存在严重设计缺陷：
- 养虾币「有进无出」，`hasEnoughCoins()` 已实现但零调用
- 声望与虾币获取事件完全重叠（7 种场景一样），双币实质同币
- 注册奖励直接写 DB 绕过 `addCoins()`，审计链路断裂
- 经济系统只在个人主页「关于」tab 展示，99% 用户路径不可见
- `user_profiles.contribution_points` / `contributor_level` 平行积分体系从未写入
- `publish_version` 奖励已配置未接线
- `asset_installed` 无去重，可无限刷币
- 全站 0 次真实安装

## 2. 设计目标

1. 让虾币「活起来」——有消费场景，建立流通循环
2. 声望与虾币差异化——声望 = 社区认可度，虾币 = 流通货币
3. 声望在核心路径上可见，建立「声望高 = 靠谱」心智
4. 修复实现层 bug，保证审计链路完整

## 3. 双币定位

| 维度 | 声望 (Reputation) | 养虾币 (Shrimp Coins) |
|------|-------------------|----------------------|
| 定位 | 社区认可度 / 信用分 | 流通货币 |
| 获取方式 | 被安装、被 Star、发布、邀请等 | 注册、发布、评论、安装奖励等 |
| 消费方式 | 不可消费（纯展示） | 安装资产扣 1 虾币 |
| 核心信号 | 被安装 > 被 Star > 其他 | 发布 > 安装奖励 > 其他 |

## 4. 事件奖励表

| 事件 | 触发者 | 声望 | 虾币 | 备注 |
|------|--------|------|------|------|
| 注册 | 新用户 | — | +100 | 初始资金，通过 `addCoins(100)` 正确记账 |
| 发布资产 | 作者 | +1 | +50 | 声望低给，防刷发布 |
| 发新版本 | 作者 | +1 | +20 | 鼓励持续维护 |
| 资产被安装（首次） | 作者 | +5 | +10 | 核心声望来源 |
| 资产被更新安装 | 作者 | +5 | +10 | 资产有新版本后，已安装用户更新时再算一次 |
| 被社区 Star | 作者 | +5 | — | 社区内用户手动 Star，不封顶 |
| GitHub Star（导入） | 作者 | 每个 +2，单资产封顶 30 | — | 导入时一次性计算 |
| 提 Issue | 提交者 | +1 | +2 | — |
| 写评论 | 评论者 | — | +3 | 声望不给，纯虾币激励 |
| 邀请用户 | 邀请人 | +5 | +20 | — |
| 安装资产 | 安装者 | — | **-1** | 虾币唯一消费出口 |

### 4.1 安装去重规则

- 同用户同资产，**终身只算一次**奖励（作者 +5 声望 / +10 虾币）
- 当资产发布新版本后，已安装用户更新安装**再算一次**
- 实现方式：`user_installs` 表记录 `(user_id, asset_id, last_version)`，安装时检查

### 4.2 GitHub Star 声望计算

- 导入/同步 GitHub 数据时，计算 `min(github_stars * 2, 30)` 作为该资产的 GitHub Star 声望贡献
- 写入作者的声望（一次性，非每次同步重复加）
- 需要记录 `github_star_rep_synced` 标记避免重复

### 4.3 删除的事件

- `asset_rated_good`（被好评 ≥4 星）→ 删除
- `asset_rated_5star`（被 5 星）→ 删除

## 5. 声望露出方案

### 5.1 导航栏（新增）
- 登录用户在导航栏右侧看到：`★ 180 | 🦐 450`
- 声望 + 虾币余额，一眼可见

### 5.2 资产卡片（新增）
- 作者名旁显示声望数值：`作者名 · ★ 180`
- 所有资产列表页（首页、探索页、搜索结果）统一展示

### 5.3 评论区（新增）
- 评论者头像/名字旁显示声望：`用户名 ★ 60`

### 5.4 个人主页（保留优化）
- 已有声望和虾币展示，保留
- 动态 Timeline 修复空 icon

### 5.5 首页贡献者板块（改造）
- 「社区热门贡献者」展示各作者声望数值
- 排序逻辑改为**按声望降序**（替代当前的下载量+资产数公式）

### 5.6 统计页排行榜（改造）
- 贡献者排行榜增加声望列
- 排序改为按声望降序

## 6. 数据库变更

### 6.1 新增 `user_installs` 表
```sql
CREATE TABLE IF NOT EXISTS user_installs (
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  last_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, asset_id)
);
```

### 6.2 assets 表新增字段
```sql
ALTER TABLE assets ADD COLUMN github_star_rep_synced INTEGER NOT NULL DEFAULT 0;
```

### 6.3 清理
- `user_profiles` 表的 `contribution_points` 和 `contributor_level` 字段标记废弃（不删列，避免破坏性变更）
- `economy.ts` 中删除 `asset_rated_good` 和 `asset_rated_5star` 事件配置

## 7. 代码变更范围

### 7.1 economy.ts
- 更新 `USER_REP_EVENTS` 和 `SHRIMP_COIN_EVENTS` 数值
- 删除 `asset_rated_good` / `asset_rated_5star`
- 新增 `publish_version` 调用点
- 新增 GitHub Star 声望计算函数

### 7.2 assets.ts
- `incrementDownload()` 改造：检查 `user_installs` 去重，扣安装者 1 虾币
- `createAsset()` / `updateAsset()`：接线 `publish_version` 声望/虾币

### 7.3 users.ts
- `createUser()`：注册奖励改为 `addCoins(id, 'shrimp_coin', 100, 'register_bonus')`，删除 INSERT 中的硬编码 `shrimp_coins=100`

### 7.4 social.ts
- `createComment()`：删除 `asset_rated_good` / `asset_rated_5star` 逻辑
- `createIssue()`：声望 +1（新增）

### 7.5 stats.ts
- `topDevelopers` 查询改为按 `users.reputation` 降序

### 7.6 前端组件
- 导航栏组件：新增声望 + 虾币余额展示
- 资产卡片组件：作者名旁加声望
- 评论区组件：头像旁加声望
- 首页贡献者板块：展示声望数值
- 统计页排行榜：加声望列

### 7.7 star 相关
- `starAsset()`：触发给资产作者 +5 声望
- GitHub 导入流程：计算 `min(github_stars * 2, 30)` 写入作者声望

## 8. 不做的

- ❌ 打赏功能
- ❌ 求助悬赏板块
- ❌ 行为徽章
- ❌ 等级体系
- ❌ 虾币排行榜

## 9. 迁移方案

1. 清零所有用户声望和虾币（重新基于历史事件计算）
2. 遍历 `coin_events` 表，按新规则重算每个用户的声望和虾币
3. 遍历 `assets` 表，按 GitHub Stars 计算作者声望贡献
4. 验证所有用户余额与 `coin_events` 审计记录一致
