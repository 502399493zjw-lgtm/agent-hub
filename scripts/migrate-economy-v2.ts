/**
 * Economy v2 migration: recalculate all user reputation + shrimp coins
 * based on actual events with new values.
 *
 * Run: cd ~/.openclaw/workspace/agent-hub && npx tsx scripts/migrate-economy-v2.ts
 */

// Adjust path as needed — check how other files import from lib/db
import { getDb } from '../src/lib/db/connection';
import { USER_REP_EVENTS, SHRIMP_COIN_EVENTS, syncGithubStarReputation } from '../src/lib/db/economy';

function migrate() {
  const db = getDb();

  console.log('🔄 Economy v2 migration starting...');

  // 1. Reset all users to zero
  db.prepare('UPDATE users SET reputation = 0, shrimp_coins = 0').run();
  console.log('  ✓ Reset all users to zero');

  // 2. Clear old coin_events
  db.prepare('DELETE FROM coin_events').run();
  console.log('  ✓ Cleared old coin_events');

  // 3. Re-process: register bonus for all users
  const users = db.prepare('SELECT id FROM users').all() as { id: string }[];
  for (const u of users) {
    const amount = SHRIMP_COIN_EVENTS.register; // 100
    db.prepare('UPDATE users SET shrimp_coins = ? WHERE id = ?').run(amount, u.id);
    db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      u.id, 'shrimp_coin', amount, 'register', amount, new Date().toISOString()
    );
  }
  console.log(`  ✓ Register bonus for ${users.length} users`);

  // 4. Re-process: publish_asset rewards
  const assets = db.prepare("SELECT id, author_id FROM assets WHERE author_id != ''").all() as { id: string; author_id: string }[];
  for (const a of assets) {
    const u = db.prepare('SELECT reputation, shrimp_coins FROM users WHERE id = ?').get(a.author_id) as { reputation: number; shrimp_coins: number } | undefined;
    if (!u) continue;
    const newRep = u.reputation + USER_REP_EVENTS.publish_asset;
    const newCoins = u.shrimp_coins + SHRIMP_COIN_EVENTS.publish_asset;
    db.prepare('UPDATE users SET reputation = ?, shrimp_coins = ? WHERE id = ?').run(newRep, newCoins, a.author_id);
    db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      a.author_id, 'reputation', USER_REP_EVENTS.publish_asset, 'publish_asset', a.id, newRep, new Date().toISOString()
    );
    db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      a.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_asset, 'publish_asset', a.id, newCoins, new Date().toISOString()
    );
  }
  console.log(`  ✓ Publish rewards for ${assets.length} assets`);

  // 5. GitHub star reputation sync
  db.prepare('UPDATE assets SET github_star_rep_synced = 0').run();
  const ghAssets = db.prepare('SELECT id FROM assets WHERE github_stars > 0').all() as { id: string }[];
  for (const a of ghAssets) {
    syncGithubStarReputation(a.id);
  }
  console.log(`  ✓ GitHub star sync for ${ghAssets.length} assets`);

  // 6. Re-process: community stars (manual only, not auto-star from download)
  const stars = db.prepare("SELECT us.user_id, us.asset_id, a.author_id FROM user_stars us JOIN assets a ON a.id = us.asset_id WHERE us.source = 'manual' AND a.author_id != ''").all() as { user_id: string; asset_id: string; author_id: string }[];
  let starCount = 0;
  for (const s of stars) {
    if (s.user_id === s.author_id) continue; // skip self-star
    const u = db.prepare('SELECT reputation FROM users WHERE id = ?').get(s.author_id) as { reputation: number } | undefined;
    if (!u) continue;
    const newRep = u.reputation + USER_REP_EVENTS.asset_starred;
    db.prepare('UPDATE users SET reputation = ? WHERE id = ?').run(newRep, s.author_id);
    db.prepare('INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      s.author_id, 'reputation', USER_REP_EVENTS.asset_starred, 'asset_starred', s.asset_id, newRep, new Date().toISOString()
    );
    starCount++;
  }
  console.log(`  ✓ Star reputation for ${starCount} manual stars`);

  // 7. Summary
  const summary = db.prepare('SELECT id, name, reputation, shrimp_coins FROM users ORDER BY reputation DESC LIMIT 10').all() as { id: string; name: string; reputation: number; shrimp_coins: number }[];
  console.log('\n📊 Top users after migration:');
  for (const u of summary) {
    console.log(`  ${u.name}: 🎖️ ${u.reputation} rep, 💎 ${u.shrimp_coins} coins`);
  }

  console.log('\n✅ Migration complete!');
}

migrate();
