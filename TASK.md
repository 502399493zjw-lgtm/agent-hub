# Agent Hub v2 Refactor Task

## Context
This is a Next.js project (App Router, TailwindCSS) — a mock/prototype for an "Agent Hub" community platform.
The design spec has been updated to v2. You need to refactor the codebase to match.

**Design Spec**: Read `docs/hub-design-v2.md` for full details.

## What to Change

### 1. `src/data/mock.ts` — Data Layer (CRITICAL)

**AssetType change:**
- OLD: `'skill' | 'config' | 'plugin' | 'trigger' | 'workflow' | 'template'`
- NEW: `'skill' | 'channel' | 'plugin' | 'trigger' | 'config' | 'template'`
- `workflow` is REMOVED. `channel` is ADDED.

**typeConfig update:**
- Remove `workflow` entry
- Add `channel` entry: `{ label: 'Channels', icon: '📡', color: 'text-purple-400', bgColor: 'bg-purple-400/10', borderColor: 'border-purple-400/30' }`
- `config`: change icon to `⚙️`, label stays `Configs`
- `template`: change label to `Templates` (整体模版)

**Config assets get `configSubtype` tag:**
- Add optional `configSubtype?: 'routing' | 'model' | 'persona' | 'scope'` to the Asset interface
- Existing config/persona assets (c1-c7) should have `configSubtype: 'persona'`

**New channel assets (replace workflow assets):**
Convert the 4 workflow assets (wf1-wf4) into channel assets. Create new channel-type mock data:
- `ch1`: Feishu Channel (飞书通信) — author u(1), downloads ~9800
- `ch2`: Discord Bridge (Discord 桥接) — author u(2), downloads ~21000
- `ch3`: Telegram Bot (Telegram 机器人) — author u(2), downloads ~15000
- `ch4`: Slack Connector (Slack 连接器) — author u(3), downloads ~7600

Update all references from old workflow IDs (wf1-wf4) to new channel IDs (ch1-ch4) in users' publishedAssets/favoriteAssets arrays, collections, etc.

**Hub Score fields on Asset:**
Add to Asset interface:
```typescript
hubScore?: number; // 0-100
hubScoreBreakdown?: {
  downloadScore: number;  // 0-100
  maintenanceScore: number; // 0-100
  reputationScore: number; // 0-100
};
upgradeRate?: number; // 0-1, percentage of users who upgraded
```
Generate reasonable hubScore values for all assets (range 60-95, based on downloads & rating).

**User model changes:**
- Add `contributionPoints?: number` and `contributorLevel?: 'newcomer' | 'active' | 'contributor' | 'master' | 'legend'` to User interface
- Add `instanceId?: string` field (OpenClaw Instance ID)
- Remove `ownerUserId` from `agentConfig` (Agents are independent identities in v2)
- Assign contribution points to all users (based on their published assets count × 10 + estimated downloads)

**Evolution data (for user profile page):**
Add a new data structure:
```typescript
export interface EvolutionEvent {
  id: string;
  userId: string;
  icon: string;
  title: string;
  description: string;
  date: string;
  type: 'birth' | 'skill' | 'channel' | 'milestone' | 'config' | 'achievement';
}
```
Create mock evolution events for each user (5-8 events per user showing their growth timeline).

**Activity data (for user profile page):**
Add:
```typescript
export interface ActivityEvent {
  id: string;
  userId: string;
  icon: string;
  text: string;
  date: string;
  type: 'publish' | 'update' | 'issue' | 'review' | 'pr' | 'favorite';
  linkTo?: string;
  actorType: 'user' | 'agent';
}
```
Create mock activity events for each user (8-12 events).

### 2. `src/app/user/[id]/client.tsx` — User Profile (BIG REWRITE)

Redesign the profile page with **two tabs**:

**Tab 1: 进化树 (Evolution Tree)**
- Timeline view showing the user's growth events
- Each node: icon + title + description + date
- Visual: vertical timeline with connecting lines, left-aligned dates, right-aligned content
- Style: cyberpunk feel, gold accent for milestones

**Tab 2: 社区动态 (Activity Feed)**
- Chronological feed of all hub activities
- Each item: icon + text + date + link
- Distinguish user vs agent actions with different indicators (🧑 for human, 🤖 for agent)

Keep the existing header section (avatar, name, bio, stats, follower count) but:
- Add `contributorLevel` badge next to the name
- Add `instanceId` display for agents
- Show `contributionPoints` in stats

### 3. `src/app/evolution/page.tsx` — Evolution Page (REWRITE)

This currently shows "asset fork trees". Rewrite it to be a **community evolution gallery**:
- Show a grid of agents and their latest evolution milestones
- Each card: agent avatar + name + latest milestone + evolution event count
- Clicking navigates to the agent's profile page (Evolution tab)
- Title: "Agent 进化图鉴"

### 4. `src/app/explore/page.tsx` — Explore Page

Update type filters:
- Remove `workflow` filter
- Add `channel` filter: `{ value: 'channel', label: 'Channels', icon: '📡' }`
- Update the valid type list in the `includes()` checks
- Update subtitle text to mention Channels instead of Workflows

### 5. `src/app/page.tsx` — Home Page

- Update type references from `workflow` to `channel`
- Update any descriptive text that mentions "Workflows"
- If there are type filter buttons, update them

### 6. `src/app/publish/page.tsx` — Publish Page

- Update type selector to show 6 new types (replace workflow with channel)
- Add `configSubtype` selector that appears when type = 'config'
- Options: 路由(routing) / 模型(model) / 身份(persona) / Agent Scope(scope)

### 7. `src/app/stats/page.tsx` — Stats Page

- Update type references from workflow to channel
- Update any charts/stats that reference old types

### 8. `src/app/asset/[id]/client.tsx` — Asset Detail Page

- Add **Hub Score** display: a prominent score badge (0-100) with breakdown tooltip/section
- Show breakdown: 下载分 / 维护分 / 口碑分 with progress bars
- Add **upgradeRate** display in the stats section
- In the Issues tab, add status filter buttons (需解决 / 已解决 / 全部)
- Add a new **展示区 (Showcase)** tab after Issues:
  - Grid of screenshots/examples showing the asset in action
  - Mock 2-3 showcase entries per popular asset

### 9. `src/components/asset-card.tsx` — Asset Card

- Update any `workflow` type checks to `channel`
- Ensure the card handles the new `hubScore` field (optionally show a small score badge)

### 10. All files referencing AssetType

Search for `'workflow'` string across all files and replace with `'channel'` where appropriate.
Search for `includes('workflow')` and update the valid type arrays.

## Design Guidelines

- Color scheme: dark cyberpunk with gold (#FFD700) and red (#FF4444) accents
- Use existing TailwindCSS classes (text-gold, text-red, bg-card-bg, border-card-border, etc.)
- Keep the existing component patterns and styling conventions
- Chinese language for UI text
- Emojis for visual flair (existing pattern)

## What NOT to Change

- Authentication system (login/register/auth-context)
- Navigation structure (navbar/footer)
- Star/Follow/Fork components
- Toast/Notification system
- API routes structure (they use mock data anyway)
- Overall layout and routing

## Verification

After changes, run `npm run build` (or `npx next build`) to verify no TypeScript/build errors.
If build fails, fix the errors.

## Important Notes

- This is a PROTOTYPE with mock data — no real backend. All data is in `src/data/mock.ts`.
- Don't break existing functionality. The app should look and feel the same, just with updated types and new features.
- Keep all existing mock assets that aren't being converted. Only workflow→channel conversion affects existing assets.
- The `installCommand` for channel assets should use `openclaw channel install @author/name` pattern.
