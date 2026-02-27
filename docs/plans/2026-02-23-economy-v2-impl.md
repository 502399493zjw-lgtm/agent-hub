# Economy v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Differentiate reputation/shrimp coins, add coin spending (install costs 1), fix bugs, make reputation visible across all core UI paths.

**Architecture:** Update economy event configs → fix registration flow → add install dedup table → wire star→reputation → update all coin reward call sites → add reputation to API responses → update 6 frontend touchpoints (navbar, asset card, comment, home contributors, stats, profile).

**Tech Stack:** Next.js 16, SQLite (better-sqlite3), TypeScript, Tailwind CSS

**Design Doc:** `docs/plans/2026-02-23-economy-v2-design.md`

---

### Task 1: Update Economy Event Configs

**Files:**
- Modify: `src/lib/db/economy.ts:38-55`

**Step 1: Update event config objects**

Replace the current `USER_REP_EVENTS` and `SHRIMP_COIN_EVENTS` with:

```typescript
export const USER_REP_EVENTS = {
  publish_asset: 1,
  asset_installed: 5,
  submit_issue: 1,
  invite_user: 5,
  publish_version: 1,
  asset_starred: 5,           // community star
  github_star_synced: 2,      // per github star, capped at 30 per asset
} as const;

export const SHRIMP_COIN_EVENTS = {
  register: 100,
  publish_asset: 50,
  asset_installed: 10,
  write_comment: 3,
  submit_issue: 2,
  invite_user: 20,
  publish_version: 20,
  install_asset: -1,          // spending: user pays to install
} as const;
```

Note: `asset_rated_good` and `asset_rated_5star` are removed.

**Step 2: Verify file saves cleanly**

Run: `cd ~/.openclaw/workspace/agent-hub && npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors related to economy.ts (existing errors elsewhere OK)

**Step 3: Commit**

```bash
git add src/lib/db/economy.ts
git commit -m "feat(economy-v2): update event configs — differentiate rep vs coins"
```

---

### Task 2: Fix Registration Coin Flow

**Files:**
- Modify: `src/lib/db/users.ts:34`

**Step 1: Fix createUser to use addCoins instead of hardcoded INSERT value**

In `createUser()`, line 34, the INSERT currently sets `shrimp_coins` to `SHRIMP_COIN_EVENTS.register` (100) directly in the SQL. Change it to:

1. Set `shrimp_coins` to `0` in the INSERT statement
2. After the INSERT, call `addCoins()` for the register bonus

```typescript
// In createUser(), change the INSERT to use 0 for shrimp_coins:
getDb().prepare(`INSERT INTO users (id,email,name,avatar,provider,provider_id,bio,invite_code,created_at,updated_at,reputation,shrimp_coins,onboarding_completed,provider_name,provider_avatar) VALUES (?,?,?,?,?,?,'',NULL,?,?,0,0,0,?,?)`).run(data.id, data.email, data.name, data.avatar, data.provider, data.providerId, now, now, data.name, data.avatar);

// Then add the register bonus through the audit trail:
addCoins(data.id, 'shrimp_coin', SHRIMP_COIN_EVENTS.register, 'register');
```

Note: Need to add import of `addCoins` and `SHRIMP_COIN_EVENTS` at top of users.ts.

**Step 2: Verify**

Run: `npx tsc --noEmit 2>&1 | grep users.ts`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/db/users.ts
git commit -m "fix(economy-v2): register bonus via addCoins for proper audit trail"
```

---

### Task 3: Create user_installs Table + Install Dedup Logic

**Files:**
- Modify: `src/lib/db/schema.ts` (add table creation)
- Modify: `src/lib/db/assets.ts` (rewrite `incrementDownload`)

**Step 1: Add user_installs table to schema.ts**

In `schema.ts`, after the `user_stars` table creation block (~line 231), add:

```typescript
// Install tracking for dedup
db.exec(`
  CREATE TABLE IF NOT EXISTS user_installs (
    user_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    last_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, asset_id)
  )
`);
```

**Step 2: Rewrite incrementDownload in assets.ts**

Replace the current `incrementDownload` function (lines 270-290) with:

```typescript
export function incrementDownload(assetId: string, userId?: string): number | null {
  const db = getDb();

  // Always increment the download counter
  const result = db.prepare('UPDATE assets SET downloads = downloads + 1 WHERE id = ?').run(assetId);
  if (result.changes === 0) return null;

  const asset = db.prepare('SELECT author_id, version, downloads FROM assets WHERE id = ?').get(assetId) as { author_id: string; version: string; downloads: number } | undefined;
  if (!asset) return null;

  if (userId) {
    // Auto-star on download
    db.prepare('INSERT OR IGNORE INTO user_stars (user_id, asset_id, source) VALUES (?, ?, ?)').run(userId, assetId, 'download');

    // Deduct 1 shrimp coin from installer
    if (hasEnoughCoins(userId, 1)) {
      addCoins(userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.install_asset, 'install_asset', assetId);
    }

    // Dedup: check if this user already installed this asset at this version
    const existing = db.prepare('SELECT last_version FROM user_installs WHERE user_id = ? AND asset_id = ?').get(userId, assetId) as { last_version: string } | undefined;

    if (!existing) {
      // First install ever — reward author
      db.prepare('INSERT INTO user_installs (user_id, asset_id, last_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(userId, assetId, asset.version, new Date().toISOString(), new Date().toISOString());
      if (asset.author_id && asset.author_id !== userId) {
        addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
        addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
      }
    } else if (existing.last_version !== asset.version) {
      // Update install (new version) — reward author again
      db.prepare('UPDATE user_installs SET last_version = ?, updated_at = ? WHERE user_id = ? AND asset_id = ?').run(asset.version, new Date().toISOString(), userId, assetId);
      if (asset.author_id && asset.author_id !== userId) {
        addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
        addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
      }
    }
    // else: same user, same version — no reward (dedup)
  } else {
    // Anonymous download — reward author (no dedup possible)
    if (asset.author_id) {
      addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
      addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
    }
  }

  return asset.downloads;
}
```

Add `hasEnoughCoins` to the import from `./economy` at the top of assets.ts.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "assets.ts|schema.ts"`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/lib/db/assets.ts
git commit -m "feat(economy-v2): install dedup + installer pays 1 shrimp coin"
```

---

### Task 4: Wire Star → Reputation

**Files:**
- Modify: `src/lib/db/economy.ts` (update `starAsset` function)

**Step 1: Update starAsset to award reputation to asset author**

Replace the current `starAsset` function:

```typescript
export function starAsset(userId: string, assetId: string, source: 'manual' | 'download' = 'manual'): boolean {
  const db = getDb();
  const result = db.prepare(
    'INSERT OR IGNORE INTO user_stars (user_id, asset_id, source) VALUES (?, ?, ?)'
  ).run(userId, assetId, source);

  if (result.changes > 0 && source === 'manual') {
    // Award reputation to asset author (not for auto-star on download)
    const asset = db.prepare('SELECT author_id FROM assets WHERE id = ?').get(assetId) as { author_id: string } | undefined;
    if (asset?.author_id && asset.author_id !== userId) {
      addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_starred, 'asset_starred', assetId);
    }
  }

  return result.changes > 0;
}
```

**Step 2: Add GitHub Star reputation sync function**

Add after the existing star functions:

```typescript
/**
 * One-time sync of GitHub stars → author reputation.
 * Called during GitHub import. Capped at 30 rep per asset.
 */
export function syncGithubStarReputation(assetId: string): void {
  const db = getDb();
  const asset = db.prepare('SELECT author_id, github_stars, github_star_rep_synced FROM assets WHERE id = ?').get(assetId) as { author_id: string; github_stars: number; github_star_rep_synced: number } | undefined;
  if (!asset || asset.github_star_rep_synced || !asset.author_id || !asset.github_stars) return;

  const repAmount = Math.min(asset.github_stars * USER_REP_EVENTS.github_star_synced, 30);
  if (repAmount > 0) {
    addCoins(asset.author_id, 'reputation', repAmount, 'github_star_synced', assetId);
  }
  db.prepare('UPDATE assets SET github_star_rep_synced = 1 WHERE id = ?').run(assetId);
}
```

**Step 3: Add github_star_rep_synced column to schema.ts**

In `schema.ts`, in the ALTER TABLE section for assets:

```typescript
if (!hasColumn('assets', 'github_star_rep_synced')) {
  db.exec(`ALTER TABLE assets ADD COLUMN github_star_rep_synced INTEGER NOT NULL DEFAULT 0`);
}
```

**Step 4: Verify**

Run: `npx tsc --noEmit 2>&1 | grep economy.ts`

**Step 5: Commit**

```bash
git add src/lib/db/economy.ts src/lib/db/schema.ts
git commit -m "feat(economy-v2): star → reputation + github star sync"
```

---

### Task 5: Fix Social.ts — Remove Rated Events, Update Issue Rewards

**Files:**
- Modify: `src/lib/db/social.ts:36-45,100-101`

**Step 1: Update createComment rewards**

In `createComment()`, replace lines 36-45:

```typescript
// Old: awards both rep + coins for comment, plus rated_good/5star
// New: only award shrimp coins for comments (no reputation)
addCoins(data.userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.write_comment, 'write_comment', data.assetId);

// Remove the entire asset_rated_good and asset_rated_5star blocks
// (delete the if blocks that check rating >= 4 and rating === 5)
```

Remove the import of `USER_REP_EVENTS` if no longer needed in social.ts (check after edits — `createIssue` still uses it).

**Step 2: Update createIssue rewards**

In `createIssue()`, lines 100-101, change to:

```typescript
addCoins(data.authorId, 'reputation', USER_REP_EVENTS.submit_issue, 'submit_issue', data.assetId);
addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.submit_issue, 'submit_issue', data.assetId);
```

(This may already be correct — verify the values match the new config: rep=1, coins=2.)

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | grep social.ts`

**Step 4: Commit**

```bash
git add src/lib/db/social.ts
git commit -m "feat(economy-v2): remove rated events, comment only awards coins"
```

---

### Task 6: Update API Responses to Include Author Reputation

**Files:**
- Modify: `src/lib/db/assets.ts` (asset serialization to include author reputation)
- Modify: `src/data/types.ts` (Asset type)
- Modify: `src/lib/db/stats.ts` (topDevelopers query)
- Modify: `src/app/api/auth/me/route.ts` (include rep + coins in /me response)

**Step 1: Add authorReputation to Asset type**

In `src/data/types.ts`, add to the Asset interface (line ~16):

```typescript
author: { id: string; name: string; avatar: string; reputation?: number };
```

**Step 2: Add reputation to asset serialization**

In `src/lib/db/assets.ts`, in the `serializeAsset` function (around line 39-60), join `users` table to get author reputation. Update the query in `getAssets()` and `getAssetById()` to LEFT JOIN users for author reputation:

In the `serializeAsset` helper, add:
```typescript
authorReputation: row.author_reputation ?? 0,
```

And in the author object:
```typescript
author: { id: row.author_id, name: row.author_name, avatar: row.author_avatar, reputation: row.author_reputation ?? 0 },
```

Update the SQL queries in `getAssets()` (line ~169-176) to add:
```sql
LEFT JOIN users u ON u.id = a.author_id
```
And select `u.reputation as author_reputation`.

Similarly update `getAssetById()` (line ~185).

**Step 3: Update topDevelopers query in stats.ts**

Replace the topDevelopers query (line 85) with:

```typescript
const topDevelopers = db.prepare(`
  SELECT a.author_id as id, a.author_name as name, a.author_avatar as avatar,
    COUNT(*) as assetCount, COALESCE(SUM(a.downloads),0) as totalDownloads,
    COALESCE(u.reputation, 0) as reputation
  FROM assets a
  LEFT JOIN users u ON u.id = a.author_id
  WHERE a.author_id != ''
  GROUP BY a.author_id
  ORDER BY COALESCE(u.reputation, 0) DESC
  LIMIT 10
`).all() as { id: string; name: string; avatar: string; assetCount: number; totalDownloads: number; reputation: number }[];
```

Update the type definition on line 72 to include `reputation: number`.

**Step 4: Update /api/auth/me to include reputation + shrimpCoins**

In `src/app/api/auth/me/route.ts`, add to the response data:

```typescript
reputation: user.reputation ?? 0,
shrimpCoins: user.shrimp_coins ?? 0,
```

**Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | head -20`

**Step 6: Commit**

```bash
git add src/data/types.ts src/lib/db/assets.ts src/lib/db/stats.ts src/app/api/auth/me/route.ts
git commit -m "feat(economy-v2): expose reputation in API responses"
```

---

### Task 7: Frontend — Navbar Reputation + Coins Display

**Files:**
- Modify: `src/components/navbar.tsx`
- Modify: `src/lib/auth-context.tsx`

**Step 1: Extend useAuth to include reputation + shrimpCoins**

In `auth-context.tsx`, add a `useSWR` or `useEffect` fetch to `/api/auth/me` to get reputation + shrimpCoins, and include them in the user object:

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useAuth() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const userId = session?.user?.id;

  // Fetch extended user data (reputation, coins)
  const { data: meData } = useSWR(
    userId ? '/api/auth/me' : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  const user = session?.user
    ? {
        id: session.user.id ?? '',
        name: session.user.name ?? '',
        avatar: session.user.image ?? '',
        email: session.user.email ?? '',
        provider: (session.user as Record<string, unknown>).provider as string ?? '',
        inviteCode: (session.user as Record<string, unknown>).inviteCode as string | null ?? null,
        bio: '',
        reputation: meData?.data?.reputation ?? 0,
        shrimpCoins: meData?.data?.shrimpCoins ?? 0,
      }
    : null;

  const logout = () => signOut({ callbackUrl: '/' });
  return { user, isLoading, logout };
}
```

**Step 2: Add reputation + coins to navbar**

In `navbar.tsx`, in the user section (where avatar/name is shown, before the dropdown), add:

```tsx
{user && (
  <div className="hidden sm:flex items-center gap-2 text-xs text-muted mr-2">
    <span title="声望">★ {user.reputation}</span>
    <span className="text-muted/30">·</span>
    <span title="养虾币">🦐 {user.shrimpCoins}</span>
  </div>
)}
```

Place this just before the avatar/dropdown button in the desktop nav.

**Step 3: Verify visually**

Run: `cd ~/.openclaw/workspace/agent-hub && PORT=3002 npm run dev &`
Open: `http://localhost:3002` and check navbar shows ★ + 🦐 when logged in.

**Step 4: Commit**

```bash
git add src/lib/auth-context.tsx src/components/navbar.tsx
git commit -m "feat(economy-v2): show reputation + coins in navbar"
```

---

### Task 8: Frontend — Asset Card Author Reputation

**Files:**
- Modify: `src/components/asset-card.tsx`

**Step 1: Add reputation display next to author name**

In the author section of AssetCard (around line 44-50), after the author name span, add:

```tsx
{asset.author.reputation !== undefined && asset.author.reputation > 0 && (
  <span className="text-[10px] text-muted font-mono" title="声望">★{asset.author.reputation}</span>
)}
```

**Step 2: Verify visually**

Check explore page — each card should show `★N` next to author name.

**Step 3: Commit**

```bash
git add src/components/asset-card.tsx
git commit -m "feat(economy-v2): show author reputation on asset cards"
```

---

### Task 9: Frontend — Comment Area Author Reputation

**Files:**
- Modify: `src/app/asset/[id]/client.tsx` (comment rendering section, ~line 800+)

**Step 1: Add reputation to comment display**

In the comment rendering section, after the `userName` span, add reputation:

```tsx
<span className="text-[10px] text-muted font-mono" title="声望">★{c.authorReputation ?? 0}</span>
```

This requires comments to carry author reputation. Two options:
- A) Join users table in `getCommentsByAssetId` query to include reputation
- B) Show a placeholder and lazy-load

**Go with A.** Modify `src/lib/db/social.ts` `getCommentsByAssetId()` to JOIN users and include reputation in the returned data. Update the Comment type in `src/data/types.ts` to add `authorReputation?: number`.

**Step 2: Verify**

Check asset detail page comments tab.

**Step 3: Commit**

```bash
git add src/lib/db/social.ts src/data/types.ts src/app/asset/[id]/client.tsx
git commit -m "feat(economy-v2): show author reputation in comments"
```

---

### Task 10: Frontend — Home Page Contributors + Stats Page

**Files:**
- Modify: `src/app/client.tsx` (home page contributor pills, ~line 244-285)
- Modify: `src/app/stats/client.tsx` (contributor ranking)

**Step 1: Update home page contributor pills**

In `src/app/client.tsx`, the contributor pill currently shows `{dev.assetCount} 个资产 · {dev.totalDownloads} ↓`. Change to:

```tsx
<div className="flex items-center gap-2 text-[11px] text-muted">
  <span className="font-semibold text-foreground/70">★ {dev.reputation ?? 0}</span>
  <span className="text-muted/30">·</span>
  <span>{dev.assetCount ?? 0} 个资产</span>
</div>
```

**Step 2: Update stats page contributor ranking**

In `src/app/stats/client.tsx`, the contributor list (line ~41-45) sorts by downloads. Change to sort by reputation (the data is already sorted by reputation from the API after Task 6). Update the display to show reputation prominently.

**Step 3: Verify visually**

Check home page contributor section and /stats page.

**Step 4: Commit**

```bash
git add src/app/client.tsx src/app/stats/client.tsx
git commit -m "feat(economy-v2): reputation in home contributors + stats ranking"
```

---

### Task 11: Wire publish_version + GitHub Import Sync

**Files:**
- Modify: `src/app/api/v1/assets/publish/route.ts` or wherever version updates happen
- Modify: GitHub import flow (if it exists as a route)

**Step 1: Find and wire publish_version**

Check if there's a version update endpoint. The `publish` route likely handles both new publish and version updates. Add `publish_version` reward when an existing asset gets a new version:

```typescript
// After successful version update:
addCoins(authorId, 'reputation', USER_REP_EVENTS.publish_version, 'publish_version', assetId);
addCoins(authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_version, 'publish_version', assetId);
```

**Step 2: Wire GitHub star sync into import flow**

Find the GitHub import route (`src/app/api/admin/import-github/route.ts`) and call `syncGithubStarReputation(assetId)` after each asset is imported.

**Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | head -10`

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(economy-v2): wire publish_version rewards + github star rep sync"
```

---

### Task 12: Migration Script — Recalculate All Balances

**Files:**
- Create: `scripts/migrate-economy-v2.ts`

**Step 1: Write migration script**

```typescript
/**
 * Economy v2 migration: recalculate all user reputation + shrimp coins
 * based on actual events with new values.
 *
 * Run: npx tsx scripts/migrate-economy-v2.ts
 */
import { getDb } from '../src/lib/db/connection';
import { USER_REP_EVENTS, SHRIMP_COIN_EVENTS, syncGithubStarReputation } from '../src/lib/db/economy';

const db = getDb();

// 1. Reset all users to zero
db.prepare('UPDATE users SET reputation = 0, shrimp_coins = 0').run();

// 2. Clear old coin_events
db.prepare('DELETE FROM coin_events').run();

// 3. Re-process: register bonus for all users
const users = db.prepare('SELECT id FROM users').all() as { id: string }[];
for (const u of users) {
  // Register bonus
  db.prepare('UPDATE users SET shrimp_coins = ? WHERE id = ?').run(SHRIMP_COIN_EVENTS.register, u.id);
  db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    u.id, 'shrimp_coin', SHRIMP_COIN_EVENTS.register, 'register', SHRIMP_COIN_EVENTS.register, new Date().toISOString()
  );
}

// 4. Re-process: publish_asset rewards
const assets = db.prepare('SELECT id, author_id FROM assets WHERE author_id != \'\'').all() as { id: string; author_id: string }[];
for (const a of assets) {
  // publish_asset
  const u = db.prepare('SELECT reputation, shrimp_coins FROM users WHERE id = ?').get(a.author_id) as { reputation: number; shrimp_coins: number } | undefined;
  if (!u) continue;
  const newRep = u.reputation + USER_REP_EVENTS.publish_asset;
  const newCoins = u.shrimp_coins + SHRIMP_COIN_EVENTS.publish_asset;
  db.prepare('UPDATE users SET reputation = ?, shrimp_coins = ? WHERE id = ?').run(newRep, newCoins, a.author_id);
  db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.author_id, 'reputation', USER_REP_EVENTS.publish_asset, 'publish_asset', a.id, newRep, new Date().toISOString());
  db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(a.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_asset, 'publish_asset', a.id, newCoins, new Date().toISOString());
}

// 5. GitHub star reputation sync
db.prepare('UPDATE assets SET github_star_rep_synced = 0').run();
const ghAssets = db.prepare('SELECT id FROM assets WHERE github_stars > 0').all() as { id: string }[];
for (const a of ghAssets) {
  syncGithubStarReputation(a.id);
}

// 6. Re-process: community stars (user_stars with source='manual')
const stars = db.prepare('SELECT us.user_id, us.asset_id, a.author_id FROM user_stars us JOIN assets a ON a.id = us.asset_id WHERE us.source = \'manual\' AND a.author_id != \'\'').all() as { user_id: string; asset_id: string; author_id: string }[];
for (const s of stars) {
  if (s.user_id === s.author_id) continue;
  const u = db.prepare('SELECT reputation FROM users WHERE id = ?').get(s.author_id) as { reputation: number } | undefined;
  if (!u) continue;
  const newRep = u.reputation + USER_REP_EVENTS.asset_starred;
  db.prepare('UPDATE users SET reputation = ? WHERE id = ?').run(newRep, s.author_id);
  db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(s.author_id, 'reputation', USER_REP_EVENTS.asset_starred, 'asset_starred', s.asset_id, newRep, new Date().toISOString());
}

console.log(`Migration complete. ${users.length} users, ${assets.length} assets processed.`);
```

**Step 2: Run migration on dev DB**

Run: `cd ~/.openclaw/workspace/agent-hub && npx tsx scripts/migrate-economy-v2.ts`
Expected: "Migration complete. N users, M assets processed."

**Step 3: Verify data**

Run: `sqlite3 data/hub.db "SELECT id, name, reputation, shrimp_coins FROM users ORDER BY reputation DESC LIMIT 5"`

**Step 4: Commit**

```bash
git add scripts/migrate-economy-v2.ts
git commit -m "feat(economy-v2): migration script to recalculate all balances"
```

---

### Task 13: Verify Full Flow on Port 3002

**Step 1: Start dev server**

Run: `cd ~/.openclaw/workspace/agent-hub && PORT=3002 npm run dev`

**Step 2: Check all touchpoints**

1. Home page → contributor section shows ★ reputation
2. Navbar → shows ★ + 🦐 for logged-in user
3. Explore page → asset cards show author ★
4. Asset detail → comments show commenter ★
5. User profile → reputation + coins displayed
6. /stats → contributor ranking by reputation

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(economy-v2): complete implementation — verified on port 3002"
```
