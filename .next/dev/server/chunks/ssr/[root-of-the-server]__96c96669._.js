module.exports = [
"[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/favicon.ico.mjs { IMAGE => \"[project]/src/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/src/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/src/data/seed.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// ══════════════════════════════════════════════════
// Seed data — imported by db.ts for SQLite seeding
// Only invite codes remain; all fake data removed.
// ══════════════════════════════════════════════════
__turbopack_context__.s([
    "inviteCodes",
    ()=>inviteCodes
]);
const inviteCodes = [
    {
        code: 'SEAFOOD',
        maxUses: 100,
        type: 'super'
    },
    {
        code: 'OPENCLAW',
        maxUses: 100,
        type: 'super'
    },
    {
        code: 'AGENTHUB',
        maxUses: 50,
        type: 'super'
    }
];
}),
"[project]/src/lib/db.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "activateInviteCode",
    ()=>activateInviteCode,
    "addCoins",
    ()=>addCoins,
    "authorizeDevice",
    ()=>authorizeDevice,
    "calculateHubScore",
    ()=>calculateHubScore,
    "completeOnboarding",
    ()=>completeOnboarding,
    "createAsset",
    ()=>createAsset,
    "createComment",
    ()=>createComment,
    "createIssue",
    ()=>createIssue,
    "createSuperInviteCode",
    ()=>createSuperInviteCode,
    "createUser",
    ()=>createUser,
    "deleteAsset",
    ()=>deleteAsset,
    "deleteInviteCode",
    ()=>deleteInviteCode,
    "findUserById",
    ()=>findUserById,
    "findUserByProvider",
    ()=>findUserByProvider,
    "generateUserInviteCodes",
    ()=>generateUserInviteCodes,
    "getActivityEventsByUserId",
    ()=>getActivityEventsByUserId,
    "getAgentUserProfiles",
    ()=>getAgentUserProfiles,
    "getAllCategories",
    ()=>getAllCategories,
    "getAllTags",
    ()=>getAllTags,
    "getAssetById",
    ()=>getAssetById,
    "getAssetCountByType",
    ()=>getAssetCountByType,
    "getAssetManifest",
    ()=>getAssetManifest,
    "getAssetReadme",
    ()=>getAssetReadme,
    "getAssetsByIds",
    ()=>getAssetsByIds,
    "getCoinHistory",
    ()=>getCoinHistory,
    "getCollections",
    ()=>getCollections,
    "getCommentCount",
    ()=>getCommentCount,
    "getCommentsByAssetId",
    ()=>getCommentsByAssetId,
    "getEvolutionEventsByUserId",
    ()=>getEvolutionEventsByUserId,
    "getGrowthData",
    ()=>getGrowthData,
    "getInviteCodeDetail",
    ()=>getInviteCodeDetail,
    "getIssueCount",
    ()=>getIssueCount,
    "getIssuesByAssetId",
    ()=>getIssuesByAssetId,
    "getNotifications",
    ()=>getNotifications,
    "getStats",
    ()=>getStats,
    "getTotalCommentCount",
    ()=>getTotalCommentCount,
    "getTotalIssueCount",
    ()=>getTotalIssueCount,
    "getTotalUserCount",
    ()=>getTotalUserCount,
    "getTrendingAssets",
    ()=>getTrendingAssets,
    "getUserCoins",
    ()=>getUserCoins,
    "getUserInviteCodes",
    ()=>getUserInviteCodes,
    "getUserProfile",
    ()=>getUserProfile,
    "getUserProviderInfo",
    ()=>getUserProviderInfo,
    "hasEnoughCoins",
    ()=>hasEnoughCoins,
    "incrementDownload",
    ()=>incrementDownload,
    "isOnboardingCompleted",
    ()=>isOnboardingCompleted,
    "listAllInviteCodes",
    ()=>listAllInviteCodes,
    "listAssets",
    ()=>listAssets,
    "listAssetsCompact",
    ()=>listAssetsCompact,
    "listAuthorizedDevices",
    ()=>listAuthorizedDevices,
    "listUserProfileIds",
    ()=>listUserProfileIds,
    "listUserProfiles",
    ()=>listUserProfiles,
    "markAllRead",
    ()=>markAllRead,
    "markNotificationRead",
    ()=>markNotificationRead,
    "recalculateHubScore",
    ()=>recalculateHubScore,
    "revokeDevice",
    ()=>revokeDevice,
    "rowToAsset",
    ()=>rowToAsset,
    "searchCollections",
    ()=>searchCollections,
    "searchIssues",
    ()=>searchIssues,
    "searchUserProfiles",
    ()=>searchUserProfiles,
    "softDeleteUser",
    ()=>softDeleteUser,
    "updateAsset",
    ()=>updateAsset,
    "updateAssetManifest",
    ()=>updateAssetManifest,
    "userHasInviteAccess",
    ()=>userHasInviteAccess,
    "validateDevice",
    ()=>validateDevice,
    "validateInviteCode",
    ()=>validateInviteCode
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$better$2d$sqlite3__$5b$external$5d$__$28$better$2d$sqlite3$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$better$2d$sqlite3$29$__ = __turbopack_context__.i("[externals]/better-sqlite3 [external] (better-sqlite3, cjs, [project]/node_modules/better-sqlite3)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$seed$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/data/seed.ts [app-rsc] (ecmascript)");
;
;
;
const DB_PATH = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'data', 'hub.db');
let _db = null;
function getDb() {
    if (!_db) {
        _db = new __TURBOPACK__imported__module__$5b$externals$5d2f$better$2d$sqlite3__$5b$external$5d$__$28$better$2d$sqlite3$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$better$2d$sqlite3$29$__["default"](DB_PATH);
        _db.pragma('journal_mode = WAL');
        initTables(_db);
    }
    return _db;
}
function calculateHubScore(_downloads, _rating, _ratingCount) {
    return {
        hubScore: 0,
        hubScoreBreakdown: {
            downloadScore: 0,
            maintenanceScore: 0,
            reputationScore: 0
        }
    };
}
// ════════════════════════════════════════════
// Coin System — Event Values
// ════════════════════════════════════════════
// User reputation events (honor currency, only goes up)
const USER_REP_EVENTS = {
    publish_asset: 20,
    asset_installed: 3,
    asset_rated_good: 5,
    issue_closed: 5,
    write_comment: 2,
    submit_issue: 2,
    invite_user: 10,
    new_version: 8
};
// Shrimp coins events (spendable currency)
const SHRIMP_COIN_EVENTS = {
    register: 100,
    daily_login: 5,
    publish_asset: 50,
    asset_installed: 10,
    asset_rated_5star: 15,
    write_comment: 3,
    submit_issue: 5,
    invite_user: 30,
    new_version: 20
};
function recalculateHubScore(assetId) {
    const db = getDb();
    const row = db.prepare('SELECT downloads, rating, rating_count FROM assets WHERE id = ?').get(assetId);
    if (!row) return;
    const { hubScore, hubScoreBreakdown } = calculateHubScore(row.downloads, row.rating, row.rating_count);
    db.prepare('UPDATE assets SET hub_score = ?, hub_score_breakdown = ? WHERE id = ?').run(hubScore, JSON.stringify(hubScoreBreakdown), assetId);
}
function incrementDownload(assetId) {
    const db = getDb();
    const result = db.prepare('UPDATE assets SET downloads = downloads + 1 WHERE id = ?').run(assetId);
    if (result.changes === 0) return null;
    recalculateHubScore(assetId);
    // Award coins to asset author
    const asset = db.prepare('SELECT author_id, downloads FROM assets WHERE id = ?').get(assetId);
    if (asset?.author_id) {
        addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_installed, 'asset_installed', assetId);
        addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_installed, 'asset_installed', assetId);
    }
    return asset?.downloads ?? null;
}
function addCoins(userId, coinType, amount, event, refId) {
    const db = getDb();
    const col = coinType === 'reputation' ? 'reputation' : 'shrimp_coins';
    // Check user exists
    const user = db.prepare(`SELECT ${col} FROM users WHERE id = ?`).get(userId);
    if (!user) return;
    const currentBalance = user[col] ?? 0;
    const newBalance = Math.max(0, currentBalance + amount); // never go below 0
    db.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(newBalance, userId);
    db.prepare(`INSERT INTO coin_events (user_id, coin_type, amount, event, ref_id, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(userId, coinType, amount, event, refId ?? null, newBalance, new Date().toISOString());
}
function getUserCoins(userId) {
    const row = getDb().prepare('SELECT reputation, shrimp_coins FROM users WHERE id = ?').get(userId);
    return {
        reputation: row?.reputation ?? 0,
        shrimpCoins: row?.shrimp_coins ?? 100
    };
}
function getCoinHistory(userId, coinType, limit = 50) {
    const db = getDb();
    let sql = 'SELECT * FROM coin_events WHERE user_id = ?';
    const params = [
        userId
    ];
    if (coinType) {
        sql += ' AND coin_type = ?';
        params.push(coinType);
    }
    sql += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);
    const rows = db.prepare(sql).all(...params);
    return rows.map((r)=>({
            id: r.id,
            coinType: r.coin_type,
            amount: r.amount,
            event: r.event,
            refId: r.ref_id,
            balanceAfter: r.balance_after,
            createdAt: r.created_at
        }));
}
function hasEnoughCoins(userId, amount) {
    const { shrimpCoins } = getUserCoins(userId);
    return shrimpCoins >= amount;
}
// ════════════════════════════════════════════
// Table creation
// ════════════════════════════════════════════
function initTables(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, display_name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('skill','channel','plugin','trigger','config','template')),
      author_id TEXT NOT NULL DEFAULT '', author_name TEXT NOT NULL DEFAULT '', author_avatar TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', long_description TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0.0', downloads INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0, rating_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]', category TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '',
      install_command TEXT NOT NULL DEFAULT '', readme TEXT NOT NULL DEFAULT '',
      versions TEXT NOT NULL DEFAULT '[]', dependencies TEXT NOT NULL DEFAULT '[]',
      issue_count INTEGER NOT NULL DEFAULT 0, config_subtype TEXT,
      hub_score INTEGER NOT NULL DEFAULT 70, hub_score_breakdown TEXT NOT NULL DEFAULT '{}',
      upgrade_rate REAL NOT NULL DEFAULT 50, compatibility TEXT NOT NULL DEFAULT '{}',
      files TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, avatar TEXT DEFAULT '',
      provider TEXT NOT NULL, provider_id TEXT NOT NULL, bio TEXT DEFAULT '',
      invite_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT,
      UNIQUE(provider, provider_id)
    );
    CREATE TABLE IF NOT EXISTS invite_codes (
      code TEXT PRIMARY KEY, created_by TEXT DEFAULT 'system', used_by TEXT, used_at TEXT,
      max_uses INTEGER DEFAULT 1, use_count INTEGER DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'normal'
    );
    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT '', published_assets TEXT NOT NULL DEFAULT '[]',
      favorite_assets TEXT NOT NULL DEFAULT '[]', followers INTEGER NOT NULL DEFAULT 0,
      following INTEGER NOT NULL DEFAULT 0, is_agent BOOLEAN NOT NULL DEFAULT 0,
      agent_model TEXT, agent_uptime TEXT, agent_tasks_completed INTEGER NOT NULL DEFAULT 0,
      agent_specialization TEXT, contribution_points INTEGER NOT NULL DEFAULT 0,
      contributor_level TEXT NOT NULL DEFAULT 'newcomer', instance_id TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_name TEXT, user_avatar TEXT, content TEXT, rating INTEGER,
      created_at TEXT, commenter_type TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, author_id TEXT,
      author_name TEXT, author_avatar TEXT, author_type TEXT NOT NULL DEFAULT 'user',
      title TEXT, body TEXT, status TEXT NOT NULL DEFAULT 'open',
      labels TEXT NOT NULL DEFAULT '[]', created_at TEXT, comment_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY, title TEXT, description TEXT,
      curator_id TEXT, curator_name TEXT, curator_avatar TEXT,
      asset_ids TEXT NOT NULL DEFAULT '[]', cover_emoji TEXT,
      followers INTEGER NOT NULL DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT 'self', type TEXT,
      title TEXT, message TEXT, icon TEXT, link_to TEXT,
      is_read BOOLEAN NOT NULL DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS evolution_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, icon TEXT,
      title TEXT, description TEXT, date TEXT, type TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, icon TEXT,
      text TEXT, date TEXT, type TEXT, link_to TEXT,
      actor_type TEXT NOT NULL DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS authorized_devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      authorized_at TEXT NOT NULL,
      last_publish_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS daily_stats (
      day INTEGER PRIMARY KEY, downloads INTEGER NOT NULL DEFAULT 0,
      new_assets INTEGER NOT NULL DEFAULT 0, new_users INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS coin_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      coin_type TEXT NOT NULL CHECK(coin_type IN ('reputation', 'shrimp_coin')),
      amount INTEGER NOT NULL,
      event TEXT NOT NULL,
      ref_id TEXT,
      balance_after INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_coin_events_user ON coin_events(user_id, coin_type);
    CREATE INDEX IF NOT EXISTS idx_coin_events_ref ON coin_events(ref_id);
  `);
    // Migration: add reputation and shrimp_coins columns to users table if missing
    try {
        db.exec(`ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0`);
    } catch  {}
    try {
        db.exec(`ALTER TABLE users ADD COLUMN shrimp_coins INTEGER NOT NULL DEFAULT 100`);
    } catch  {}
    // Migration: add onboarding + custom profile columns
    try {
        db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0`);
    } catch  {}
    try {
        db.exec(`ALTER TABLE users ADD COLUMN custom_name TEXT`);
    } catch  {}
    try {
        db.exec(`ALTER TABLE users ADD COLUMN custom_avatar TEXT`);
    } catch  {}
    try {
        db.exec(`ALTER TABLE users ADD COLUMN provider_name TEXT`);
    } catch  {}
    try {
        db.exec(`ALTER TABLE users ADD COLUMN provider_avatar TEXT`);
    } catch  {}
    // Migration: add manifest column to assets
    try {
        db.exec(`ALTER TABLE assets ADD COLUMN manifest TEXT NOT NULL DEFAULT '{}'`);
    } catch  {}
    // Seed invite codes if empty
    const inviteCount = db.prepare('SELECT COUNT(*) as cnt FROM invite_codes').get();
    if (inviteCount.cnt === 0) {
        const now = new Date().toISOString();
        const insertCode = db.prepare(`INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, 'system', ?, 0, ?, ?)`);
        for (const c of __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$data$2f$seed$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["inviteCodes"]){
            insertCode.run(c.code, c.maxUses, c.type ?? 'system', now);
        }
    }
}
function rowToAsset(row) {
    return {
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        type: row.type,
        author: {
            id: row.author_id || 'u-' + row.author_name.toLowerCase().replace(/\s+/g, '-'),
            name: row.author_name,
            avatar: row.author_avatar
        },
        description: row.description,
        longDescription: row.long_description,
        version: row.version,
        downloads: row.downloads,
        rating: row.rating,
        ratingCount: row.rating_count,
        tags: JSON.parse(row.tags),
        category: row.category,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        installCommand: row.install_command,
        readme: row.readme,
        versions: JSON.parse(row.versions),
        dependencies: JSON.parse(row.dependencies),
        compatibility: JSON.parse(row.compatibility),
        issueCount: row.issue_count,
        files: JSON.parse(row.files || '[]'),
        configSubtype: row.config_subtype ?? undefined
    };
}
function assetToRow(a) {
    const { hubScore, hubScoreBreakdown } = calculateHubScore(a.downloads, a.rating, a.ratingCount);
    return {
        id: a.id,
        name: a.name,
        display_name: a.displayName,
        type: a.type,
        author_id: a.author.id,
        author_name: a.author.name,
        author_avatar: a.author.avatar,
        description: a.description,
        long_description: a.longDescription,
        version: a.version,
        downloads: a.downloads,
        rating: a.rating,
        rating_count: a.ratingCount,
        tags: JSON.stringify(a.tags),
        category: a.category,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
        install_command: a.installCommand,
        readme: a.readme,
        versions: JSON.stringify(a.versions),
        dependencies: JSON.stringify(a.dependencies),
        issue_count: a.issueCount,
        config_subtype: a.configSubtype ?? null,
        files: JSON.stringify(a.files ?? []),
        hub_score: hubScore,
        hub_score_breakdown: JSON.stringify(hubScoreBreakdown),
        upgrade_rate: 0,
        compatibility: JSON.stringify(a.compatibility ?? {})
    };
}
function listAssets(params) {
    const db = getDb();
    const conditions = [];
    const bindings = {};
    if (params.type && [
        'skill',
        'config',
        'plugin',
        'trigger',
        'channel',
        'template'
    ].includes(params.type)) {
        conditions.push('type = @type');
        bindings.type = params.type;
    }
    if (params.category) {
        conditions.push('category = @category');
        bindings.category = params.category;
    }
    if (params.q) {
        conditions.push(`(name LIKE @q OR display_name LIKE @q OR description LIKE @q OR tags LIKE @q)`);
        bindings.q = `%${params.q}%`;
    }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM assets ${where}`).get(bindings).cnt;
    let orderBy;
    switch(params.sort){
        case 'downloads':
            orderBy = 'downloads DESC';
            break;
        case 'rating':
            orderBy = 'rating DESC';
            break;
        case 'updated_at':
        case 'newest':
            orderBy = 'updated_at DESC';
            break;
        case 'created_at':
            orderBy = 'created_at DESC';
            break;
        case 'trending':
            orderBy = 'downloads DESC, updated_at DESC';
            break;
        default:
            orderBy = '(downloads * rating) DESC';
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT * FROM assets ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`).all({
        ...bindings,
        limit: pageSize,
        offset
    });
    return {
        assets: rows.map(rowToAsset),
        total,
        page,
        pageSize
    };
}
function getAssetById(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    return row ? rowToAsset(row) : null;
}
function createAsset(data) {
    const db = getDb();
    const typePrefixes = {
        skill: 's',
        config: 'c',
        plugin: 'p',
        trigger: 'tr',
        channel: 'ch',
        template: 't'
    };
    const prefix = typePrefixes[data.type] || 'x';
    const id = `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString().split('T')[0];
    const authorName = data.authorName || 'CyberNova';
    const authorAvatar = data.authorAvatar || '🤖';
    const authorId = data.authorId || 'u-' + authorName.toLowerCase().replace(/\s+/g, '-');
    // Calculate initial hub score (0 downloads, 0 ratings)
    const { hubScore, hubScoreBreakdown } = calculateHubScore(0, 0, 0);
    const asset = {
        id,
        name: data.name,
        displayName: data.displayName,
        type: data.type,
        author: {
            id: authorId,
            name: authorName,
            avatar: authorAvatar
        },
        description: data.description,
        longDescription: data.longDescription || '',
        version: data.version,
        downloads: 0,
        rating: 0,
        ratingCount: 0,
        tags: data.tags || [],
        category: data.category || '',
        createdAt: now,
        updatedAt: now,
        installCommand: `seafood-market install ${data.type}/@${authorId}/${data.name}`,
        readme: data.readme || '',
        versions: [
            {
                version: data.version,
                changelog: '首次发布',
                date: now
            }
        ],
        dependencies: [],
        compatibility: {
            models: [
                'GPT-4',
                'Claude 3'
            ],
            platforms: [
                'OpenClaw'
            ],
            frameworks: [
                'Node.js'
            ]
        },
        issueCount: 0,
        configSubtype: data.configSubtype
    };
    db.prepare(`INSERT INTO assets (id,name,display_name,type,author_id,author_name,author_avatar,description,long_description,version,downloads,rating,rating_count,tags,category,created_at,updated_at,install_command,readme,versions,dependencies,issue_count,config_subtype,hub_score,hub_score_breakdown,upgrade_rate,compatibility,files) VALUES (@id,@name,@display_name,@type,@author_id,@author_name,@author_avatar,@description,@long_description,@version,@downloads,@rating,@rating_count,@tags,@category,@created_at,@updated_at,@install_command,@readme,@versions,@dependencies,@issue_count,@config_subtype,@hub_score,@hub_score_breakdown,@upgrade_rate,@compatibility,@files)`).run(assetToRow(asset));
    // Award coins to publisher
    if (data.authorId) {
        addCoins(data.authorId, 'reputation', USER_REP_EVENTS.publish_asset, 'publish_asset', id);
        addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.publish_asset, 'publish_asset', id);
    }
    return asset;
}
function updateAsset(id, data) {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
    if (!existing) return null;
    const updates = [];
    const bindings = {
        id
    };
    if (data.name !== undefined) {
        updates.push('name = @name');
        bindings.name = data.name;
    }
    if (data.displayName !== undefined) {
        updates.push('display_name = @dn');
        bindings.dn = data.displayName;
    }
    if (data.description !== undefined) {
        updates.push('description = @desc');
        bindings.desc = data.description;
    }
    if (data.longDescription !== undefined) {
        updates.push('long_description = @ld');
        bindings.ld = data.longDescription;
    }
    if (data.version !== undefined) {
        updates.push('version = @ver');
        bindings.ver = data.version;
    }
    if (data.tags !== undefined) {
        updates.push('tags = @tags');
        bindings.tags = JSON.stringify(data.tags);
    }
    if (data.category !== undefined) {
        updates.push('category = @cat');
        bindings.cat = data.category;
    }
    if (data.readme !== undefined) {
        updates.push('readme = @rm');
        bindings.rm = data.readme;
    }
    if (data.authorId !== undefined) {
        updates.push('author_id = @ai');
        bindings.ai = data.authorId;
    }
    if (data.authorName !== undefined) {
        updates.push('author_name = @an');
        bindings.an = data.authorName;
    }
    if (data.authorAvatar !== undefined) {
        updates.push('author_avatar = @aa');
        bindings.aa = data.authorAvatar;
    }
    if (data.files !== undefined) {
        updates.push('files = @files');
        bindings.files = JSON.stringify(data.files);
    }
    updates.push('updated_at = @ua');
    bindings.ua = new Date().toISOString().split('T')[0];
    db.prepare(`UPDATE assets SET ${updates.join(', ')} WHERE id = @id`).run(bindings);
    return rowToAsset(db.prepare('SELECT * FROM assets WHERE id = ?').get(id));
}
function deleteAsset(id) {
    return getDb().prepare('DELETE FROM assets WHERE id = ?').run(id).changes > 0;
}
function findUserByProvider(provider, providerId) {
    return getDb().prepare('SELECT * FROM users WHERE provider = ? AND provider_id = ?').get(provider, providerId) ?? null;
}
function findUserById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}
function createUser(data) {
    const now = new Date().toISOString();
    getDb().prepare(`INSERT INTO users (id,email,name,avatar,provider,provider_id,bio,invite_code,created_at,updated_at,reputation,shrimp_coins,onboarding_completed,provider_name,provider_avatar) VALUES (?,?,?,?,?,?,'',NULL,?,?,0,?,0,?,?)`).run(data.id, data.email, data.name, data.avatar, data.provider, data.providerId, now, now, SHRIMP_COIN_EVENTS.register, data.name, data.avatar);
    // Record the welcome bonus in coin_events
    addCoins(data.id, 'shrimp_coin', 0, 'register_bonus'); // balance already set to 100 above, just log it
    return findUserById(data.id);
}
function softDeleteUser(id) {
    const now = new Date().toISOString();
    return getDb().prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id).changes > 0;
}
function completeOnboarding(userId, data) {
    const now = new Date().toISOString();
    const db = getDb();
    return db.prepare('UPDATE users SET name = ?, avatar = ?, custom_name = ?, custom_avatar = ?, onboarding_completed = 1, updated_at = ? WHERE id = ?').run(data.name, data.avatar, data.name, data.avatar, now, userId).changes > 0;
}
function isOnboardingCompleted(userId) {
    const row = getDb().prepare('SELECT onboarding_completed FROM users WHERE id = ?').get(userId);
    return !!row?.onboarding_completed;
}
function getUserProviderInfo(userId) {
    const row = getDb().prepare('SELECT provider, provider_name, provider_avatar FROM users WHERE id = ?').get(userId);
    return row ? {
        provider: row.provider,
        providerName: row.provider_name,
        providerAvatar: row.provider_avatar
    } : null;
}
function activateInviteCode(userId, code) {
    const db = getDb();
    const user = findUserById(userId);
    if (!user) return {
        success: false,
        error: '用户不存在'
    };
    if (user.invite_code) return {
        success: false,
        error: '已激活邀请码'
    };
    const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(code);
    if (!invite) return {
        success: false,
        error: '邀请码不存在'
    };
    if (invite.use_count >= invite.max_uses) return {
        success: false,
        error: '邀请码已用完'
    };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return {
        success: false,
        error: '邀请码已过期'
    };
    const now = new Date().toISOString();
    db.transaction(()=>{
        db.prepare('UPDATE users SET invite_code = ?, updated_at = ? WHERE id = ?').run(code, now, userId);
        db.prepare('UPDATE invite_codes SET use_count = use_count + 1, used_at = ? WHERE code = ?').run(now, code);
        // Auto-generate 6 invite codes for the newly activated user
        generateUserInviteCodes(userId);
    })();
    // Award coins to the invite code creator
    const inviteDetail = db.prepare('SELECT created_by FROM invite_codes WHERE code = ?').get(code);
    if (inviteDetail?.created_by && inviteDetail.created_by !== 'system') {
        addCoins(inviteDetail.created_by, 'reputation', USER_REP_EVENTS.invite_user, 'invite_user', userId);
        addCoins(inviteDetail.created_by, 'shrimp_coin', SHRIMP_COIN_EVENTS.invite_user, 'invite_user', userId);
    }
    return {
        success: true
    };
}
function validateInviteCode(code) {
    const invite = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code);
    if (!invite) return {
        valid: false,
        error: '邀请码不存在'
    };
    if (invite.use_count >= invite.max_uses) return {
        valid: false,
        error: '邀请码已用完'
    };
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return {
        valid: false,
        error: '邀请码已过期'
    };
    return {
        valid: true
    };
}
// ════════════════════════════════════════════
// Invite Code System — Generate / Query / Admin
// ════════════════════════════════════════════
/** Generate a random 7-char uppercase letter invite code */ function generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for(let i = 0; i < 7; i++){
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
function dbInviteToInvite(row) {
    return {
        code: row.code,
        createdBy: row.created_by,
        usedBy: row.used_by,
        usedAt: row.used_at,
        maxUses: row.max_uses,
        useCount: row.use_count,
        expiresAt: row.expires_at,
        type: row.type,
        createdAt: row.created_at
    };
}
function generateUserInviteCodes(userId) {
    const db = getDb();
    const now = new Date().toISOString();
    const codes = [];
    const insert = db.prepare(`INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, ?, 1, 0, 'normal', ?)`);
    let attempts = 0;
    while(codes.length < 6 && attempts < 30){
        const code = generateInviteCode();
        const result = insert.run(code, userId, now);
        if (result.changes > 0) {
            codes.push(code);
        }
        attempts++;
    }
    return codes;
}
function getUserInviteCodes(userId) {
    const rows = getDb().prepare('SELECT * FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC').all(userId);
    return rows.map(dbInviteToInvite);
}
function createSuperInviteCode(code, maxUses, createdBy) {
    const db = getDb();
    const now = new Date().toISOString();
    try {
        db.prepare(`INSERT INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, ?, ?, 0, 'super', ?)`).run(code, createdBy, maxUses, now);
        return true;
    } catch  {
        return false; // code already exists
    }
}
function getInviteCodeDetail(code) {
    const row = getDb().prepare('SELECT * FROM invite_codes WHERE code = ?').get(code);
    return row ? dbInviteToInvite(row) : null;
}
function listAllInviteCodes(params) {
    const db = getDb();
    const conditions = [];
    const bindings = {};
    if (params?.type) {
        conditions.push('type = @type');
        bindings.type = params.type;
    }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM invite_codes ${where}`).get(bindings).cnt;
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params?.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT * FROM invite_codes ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`).all({
        ...bindings,
        limit: pageSize,
        offset
    });
    return {
        codes: rows.map(dbInviteToInvite),
        total
    };
}
function deleteInviteCode(code) {
    return getDb().prepare('DELETE FROM invite_codes WHERE code = ?').run(code).changes > 0;
}
function userHasInviteAccess(userId) {
    const user = findUserById(userId);
    return !!user?.invite_code;
}
function authorizeDevice(userId, deviceId, name = '') {
    const now = new Date().toISOString();
    getDb().prepare('INSERT OR REPLACE INTO authorized_devices (device_id, user_id, name, authorized_at) VALUES (?, ?, ?, ?)').run(deviceId, userId, name, now);
    return true;
}
function validateDevice(deviceId) {
    const row = getDb().prepare('SELECT user_id, name FROM authorized_devices WHERE device_id = ?').get(deviceId);
    if (!row) return null;
    getDb().prepare('UPDATE authorized_devices SET last_publish_at = ? WHERE device_id = ?').run(new Date().toISOString(), deviceId);
    return {
        userId: row.user_id,
        name: row.name
    };
}
function listAuthorizedDevices(userId) {
    const rows = getDb().prepare('SELECT device_id, name, authorized_at, last_publish_at FROM authorized_devices WHERE user_id = ?').all(userId);
    return rows.map((r)=>({
            deviceId: r.device_id.slice(0, 12) + '...',
            name: r.name,
            authorizedAt: r.authorized_at,
            lastPublishAt: r.last_publish_at
        }));
}
function revokeDevice(deviceId, userId) {
    const result = getDb().prepare('DELETE FROM authorized_devices WHERE device_id = ? AND user_id = ?').run(deviceId, userId);
    return result.changes > 0;
}
function profileRowToUser(row) {
    const isAgent = !!row.is_agent;
    return {
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        bio: row.bio,
        joinedAt: row.joined_at,
        publishedAssets: JSON.parse(row.published_assets),
        favoriteAssets: JSON.parse(row.favorite_assets),
        followers: row.followers,
        following: row.following,
        isAgent: isAgent,
        agentConfig: isAgent ? {
            model: row.agent_model || '',
            uptime: row.agent_uptime || '',
            tasksCompleted: row.agent_tasks_completed,
            specialization: row.agent_specialization ? JSON.parse(row.agent_specialization) : []
        } : undefined,
        contributionPoints: row.contribution_points,
        contributorLevel: row.contributor_level,
        instanceId: row.instance_id ?? undefined
    };
}
function getUserProfile(id) {
    const row = getDb().prepare('SELECT * FROM user_profiles WHERE id = ?').get(id);
    return row ? profileRowToUser(row) : null;
}
function listUserProfiles() {
    const rows = getDb().prepare('SELECT * FROM user_profiles ORDER BY followers DESC').all();
    return rows.map(profileRowToUser);
}
function searchUserProfiles(query) {
    const rows = getDb().prepare('SELECT * FROM user_profiles WHERE name LIKE ? OR bio LIKE ? ORDER BY followers DESC').all(`%${query}%`, `%${query}%`);
    return rows.map(profileRowToUser);
}
function getAgentUserProfiles() {
    const rows = getDb().prepare('SELECT * FROM user_profiles WHERE is_agent = 1 ORDER BY followers DESC').all();
    return rows.map(profileRowToUser);
}
function listUserProfileIds() {
    const rows = getDb().prepare('SELECT id FROM user_profiles').all();
    return rows.map((r)=>r.id);
}
function commentRowToComment(row) {
    return {
        id: row.id,
        assetId: row.asset_id,
        userId: row.user_id,
        userName: row.user_name,
        userAvatar: row.user_avatar,
        content: row.content,
        rating: row.rating,
        createdAt: row.created_at,
        commenterType: row.commenter_type
    };
}
function getCommentsByAssetId(assetId) {
    const rows = getDb().prepare('SELECT * FROM comments WHERE asset_id = ? ORDER BY created_at DESC').all(assetId);
    return rows.map(commentRowToComment);
}
function createComment(data) {
    const db = getDb();
    const id = 'cm-' + Math.random().toString(36).substring(2, 8);
    const now = new Date().toISOString().split('T')[0];
    db.prepare(`INSERT INTO comments (id,asset_id,user_id,user_name,user_avatar,content,rating,created_at,commenter_type) VALUES (?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.userId, data.userName, data.userAvatar, data.content, data.rating, now, data.commenterType ?? 'user');
    // Award coins to commenter
    addCoins(data.userId, 'reputation', USER_REP_EVENTS.write_comment, 'write_comment', data.assetId);
    addCoins(data.userId, 'shrimp_coin', SHRIMP_COIN_EVENTS.write_comment, 'write_comment', data.assetId);
    // Award coins to asset author for receiving a comment/rating
    const asset = db.prepare('SELECT author_id FROM assets WHERE id = ?').get(data.assetId);
    if (asset?.author_id && asset.author_id !== data.userId) {
        if (data.rating >= 4) {
            addCoins(asset.author_id, 'reputation', USER_REP_EVENTS.asset_rated_good, 'asset_rated_good', data.assetId);
        }
        if (data.rating === 5) {
            addCoins(asset.author_id, 'shrimp_coin', SHRIMP_COIN_EVENTS.asset_rated_5star, 'asset_rated_5star', data.assetId);
        }
    }
    // Recalculate hub score after rating
    recalculateHubScore(data.assetId);
    return {
        id,
        ...data,
        createdAt: now
    };
}
function getCommentCount(assetId) {
    return getDb().prepare('SELECT COUNT(*) as cnt FROM comments WHERE asset_id = ?').get(assetId).cnt;
}
function issueRowToIssue(row) {
    return {
        id: row.id,
        assetId: row.asset_id,
        authorId: row.author_id,
        authorName: row.author_name,
        authorAvatar: row.author_avatar,
        authorType: row.author_type,
        title: row.title,
        body: row.body,
        status: row.status,
        labels: JSON.parse(row.labels),
        createdAt: row.created_at,
        commentCount: row.comment_count
    };
}
function getIssuesByAssetId(assetId) {
    const rows = getDb().prepare('SELECT * FROM issues WHERE asset_id = ? ORDER BY created_at DESC').all(assetId);
    return rows.map(issueRowToIssue);
}
function createIssue(data) {
    const db = getDb();
    const id = 'is-' + Math.random().toString(36).substring(2, 8);
    const now = new Date().toISOString().split('T')[0];
    db.prepare(`INSERT INTO issues (id,asset_id,author_id,author_name,author_avatar,author_type,title,body,status,labels,created_at,comment_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, data.assetId, data.authorId, data.authorName, data.authorAvatar, data.authorType ?? 'user', data.title, data.body, 'open', JSON.stringify(data.labels ?? []), now, 0);
    // Award coins to issue submitter
    addCoins(data.authorId, 'reputation', USER_REP_EVENTS.submit_issue, 'submit_issue', data.assetId);
    addCoins(data.authorId, 'shrimp_coin', SHRIMP_COIN_EVENTS.submit_issue, 'submit_issue', data.assetId);
    return {
        id,
        ...data,
        status: 'open',
        createdAt: now,
        commentCount: 0
    };
}
function searchIssues(query) {
    const rows = getDb().prepare('SELECT * FROM issues WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC').all(`%${query}%`, `%${query}%`);
    return rows.map(issueRowToIssue);
}
function getIssueCount(assetId) {
    return getDb().prepare('SELECT COUNT(*) as cnt FROM issues WHERE asset_id = ?').get(assetId).cnt;
}
function collectionRowToCollection(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        curatorId: row.curator_id,
        curatorName: row.curator_name,
        curatorAvatar: row.curator_avatar,
        assetIds: JSON.parse(row.asset_ids),
        coverEmoji: row.cover_emoji,
        followers: row.followers,
        createdAt: row.created_at
    };
}
function getCollections() {
    const rows = getDb().prepare('SELECT * FROM collections ORDER BY followers DESC').all();
    return rows.map(collectionRowToCollection);
}
function searchCollections(query) {
    const rows = getDb().prepare('SELECT * FROM collections WHERE title LIKE ? OR description LIKE ? ORDER BY followers DESC').all(`%${query}%`, `%${query}%`);
    return rows.map(collectionRowToCollection);
}
function notifRowToNotif(row) {
    return {
        id: row.id,
        type: row.type,
        title: row.title,
        message: row.message,
        icon: row.icon,
        linkTo: row.link_to ?? undefined,
        read: !!row.is_read,
        createdAt: row.created_at
    };
}
function getNotifications(userId = 'self') {
    const rows = getDb().prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return rows.map(notifRowToNotif);
}
function markNotificationRead(id) {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
}
function markAllRead(userId = 'self') {
    getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
}
function getEvolutionEventsByUserId(userId) {
    const rows = getDb().prepare('SELECT * FROM evolution_events WHERE user_id = ? ORDER BY date ASC').all(userId);
    return rows.map((r)=>({
            id: r.id,
            userId: r.user_id,
            icon: r.icon,
            title: r.title,
            description: r.description,
            date: r.date,
            type: r.type
        }));
}
function getActivityEventsByUserId(userId) {
    const rows = getDb().prepare('SELECT * FROM activity_events WHERE user_id = ? ORDER BY date DESC').all(userId);
    return rows.map((r)=>({
            id: r.id,
            userId: r.user_id,
            icon: r.icon,
            text: r.text,
            date: r.date,
            type: r.type,
            linkTo: r.link_to ?? undefined,
            actorType: r.actor_type
        }));
}
function getGrowthData() {
    const rows = getDb().prepare('SELECT * FROM daily_stats ORDER BY day ASC').all();
    return rows.map((r)=>({
            day: r.day,
            downloads: r.downloads,
            newAssets: r.new_assets,
            newUsers: r.new_users
        }));
}
function getStats() {
    const db = getDb();
    const totalAssets = db.prepare('SELECT COUNT(*) as cnt FROM assets').get().cnt;
    const totalDevelopers = db.prepare("SELECT COUNT(DISTINCT author_id) as cnt FROM assets WHERE author_id != ''").get().cnt;
    const totalDownloads = db.prepare('SELECT COALESCE(SUM(downloads), 0) as total FROM assets').get().total;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const weeklyNew = db.prepare('SELECT COUNT(*) as cnt FROM assets WHERE created_at >= ?').get(sevenDaysAgo).cnt;
    const topDevelopers = db.prepare(`SELECT author_id as id, author_name as name, author_avatar as avatar, COUNT(*) as assetCount, COALESCE(SUM(downloads),0) as totalDownloads FROM assets WHERE author_id != '' GROUP BY author_id ORDER BY totalDownloads DESC LIMIT 10`).all();
    const recentRows = db.prepare(`SELECT name, display_name, author_name, author_avatar, version, created_at, updated_at FROM assets ORDER BY updated_at DESC LIMIT 20`).all();
    const recentActivity = recentRows.map((row)=>({
            type: row.created_at === row.updated_at ? 'publish' : 'update',
            authorName: row.author_name,
            authorAvatar: row.author_avatar,
            assetName: row.name,
            assetDisplayName: row.display_name,
            version: row.version,
            timestamp: row.updated_at
        }));
    return {
        totalAssets,
        totalDevelopers,
        totalDownloads,
        weeklyNew,
        topDevelopers,
        recentActivity
    };
}
function getAssetCountByType() {
    const rows = getDb().prepare('SELECT type, COUNT(*) as cnt FROM assets GROUP BY type').all();
    const result = {};
    for (const row of rows)result[row.type] = row.cnt;
    return result;
}
function getTotalCommentCount() {
    return getDb().prepare('SELECT COUNT(*) as cnt FROM comments').get().cnt;
}
function getTotalIssueCount() {
    return getDb().prepare('SELECT COUNT(*) as cnt FROM issues').get().cnt;
}
function getTotalUserCount() {
    return getDb().prepare('SELECT COUNT(*) as cnt FROM user_profiles').get().cnt;
}
function listAssetsCompact(params) {
    const db = getDb();
    const conditions = [];
    const bindings = {};
    if (params.type && [
        'skill',
        'config',
        'plugin',
        'trigger',
        'channel',
        'template'
    ].includes(params.type)) {
        conditions.push('type = @type');
        bindings.type = params.type;
    }
    if (params.category) {
        conditions.push('category = @category');
        bindings.category = params.category;
    }
    if (params.tag) {
        conditions.push('tags LIKE @tag');
        bindings.tag = `%"${params.tag}"%`;
    }
    if (params.q) {
        conditions.push(`(name LIKE @q OR display_name LIKE @q OR description LIKE @q OR tags LIKE @q)`);
        bindings.q = `%${params.q}%`;
    }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const total = db.prepare(`SELECT COUNT(*) as cnt FROM assets ${where}`).get(bindings).cnt;
    let orderBy;
    switch(params.sort){
        case 'installs':
        case 'downloads':
            orderBy = 'downloads DESC';
            break;
        case 'rating':
            orderBy = 'rating DESC';
            break;
        case 'newest':
        case 'updated_at':
            orderBy = 'updated_at DESC';
            break;
        case 'created_at':
            orderBy = 'created_at DESC';
            break;
        default:
            orderBy = 'downloads DESC, updated_at DESC';
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets ${where} ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`).all({
        ...bindings,
        limit: pageSize,
        offset
    });
    return {
        assets: rows.map((r)=>({
                id: r.id,
                name: r.name,
                displayName: r.display_name,
                type: r.type,
                description: r.description,
                tags: JSON.parse(r.tags),
                installs: r.downloads,
                rating: r.rating,
                author: r.author_name,
                authorId: r.author_id,
                version: r.version,
                installCommand: r.install_command,
                updatedAt: r.updated_at,
                category: r.category
            })),
        total,
        page,
        pageSize
    };
}
function getAllTags() {
    const db = getDb();
    const rows = db.prepare('SELECT tags FROM assets').all();
    const tagMap = new Map();
    for (const row of rows){
        const tags = JSON.parse(row.tags);
        for (const t of tags){
            tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
        }
    }
    return [
        ...tagMap.entries()
    ].map(([name, count])=>({
            name,
            count
        })).sort((a, b)=>b.count - a.count);
}
function getAllCategories() {
    const rows = getDb().prepare("SELECT category, COUNT(*) as cnt FROM assets WHERE category != '' GROUP BY category ORDER BY cnt DESC").all();
    return rows.map((r)=>({
            name: r.category,
            count: r.cnt
        }));
}
function getAssetManifest(id) {
    const row = getDb().prepare('SELECT id, manifest FROM assets WHERE id = ?').get(id);
    if (!row) return null;
    return {
        id: row.id,
        manifest: JSON.parse(row.manifest || '{}')
    };
}
function updateAssetManifest(id, manifest) {
    return getDb().prepare('UPDATE assets SET manifest = ? WHERE id = ?').run(JSON.stringify(manifest), id).changes > 0;
}
function getAssetReadme(id) {
    const row = getDb().prepare('SELECT name, display_name, readme, version FROM assets WHERE id = ?').get(id);
    if (!row) return null;
    return {
        name: row.name,
        displayName: row.display_name,
        readme: row.readme,
        version: row.version
    };
}
function getAssetsByIds(ids) {
    if (ids.length === 0) return [];
    const db = getDb();
    const placeholders = ids.map(()=>'?').join(',');
    const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets WHERE id IN (${placeholders})`).all(...ids);
    return rows.map((r)=>({
            id: r.id,
            name: r.name,
            displayName: r.display_name,
            type: r.type,
            description: r.description,
            tags: JSON.parse(r.tags),
            installs: r.downloads,
            rating: r.rating,
            author: r.author_name,
            authorId: r.author_id,
            version: r.version,
            installCommand: r.install_command,
            updatedAt: r.updated_at,
            category: r.category
        }));
}
function getTrendingAssets(period, limit = 10) {
    const db = getDb();
    // For now, trending = most downloads. With more data, could use time-windowed installs.
    const rows = db.prepare(`SELECT id, name, display_name, type, description, tags, downloads, rating, author_name, author_id, version, install_command, updated_at, category FROM assets ORDER BY downloads DESC, updated_at DESC LIMIT ?`).all(Math.min(limit, 50));
    return rows.map((r)=>({
            id: r.id,
            name: r.name,
            displayName: r.display_name,
            type: r.type,
            description: r.description,
            tags: JSON.parse(r.tags),
            installs: r.downloads,
            rating: r.rating,
            author: r.author_name,
            authorId: r.author_id,
            version: r.version,
            installCommand: r.install_command,
            updatedAt: r.updated_at,
            category: r.category
        }));
}
}),
"[project]/src/app/asset/[id]/client.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/app/asset/[id]/client.tsx <module evaluation> from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/app/asset/[id]/client.tsx <module evaluation>", "default");
}),
"[project]/src/app/asset/[id]/client.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const __TURBOPACK__default__export__ = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call the default export of [project]/src/app/asset/[id]/client.tsx from the server, but it's on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/src/app/asset/[id]/client.tsx", "default");
}),
"[project]/src/app/asset/[id]/client.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$asset$2f5b$id$5d2f$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/src/app/asset/[id]/client.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$asset$2f5b$id$5d2f$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/src/app/asset/[id]/client.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$asset$2f5b$id$5d2f$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/src/app/asset/[id]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AssetDetailPage,
    "dynamic",
    ()=>dynamic,
    "generateMetadata",
    ()=>generateMetadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$asset$2f5b$id$5d2f$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/asset/[id]/client.tsx [app-rsc] (ecmascript)");
;
;
;
const dynamic = 'force-dynamic';
async function generateMetadata({ params }) {
    const { id } = await params;
    const asset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAssetById"])(id);
    if (!asset) {
        return {
            title: '资产未找到 — 水产市场'
        };
    }
    return {
        title: `${asset.displayName} — 水产市场`,
        description: asset.description,
        openGraph: {
            title: `${asset.displayName} — 水产市场`,
            description: asset.description,
            type: 'website'
        }
    };
}
async function AssetDetailPage({ params }) {
    const { id } = await params;
    const asset = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAssetById"])(id);
    const comments = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getCommentsByAssetId"])(id);
    const issues = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getIssuesByAssetId"])(id);
    const allAssetsResult = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["listAssets"])({
        pageSize: 100
    });
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$asset$2f5b$id$5d2f$client$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"], {
        id: id,
        initialAsset: asset,
        initialComments: comments,
        initialIssues: issues,
        initialAllAssets: allAssetsResult.assets
    }, void 0, false, {
        fileName: "[project]/src/app/asset/[id]/page.tsx",
        lineNumber: 32,
        columnNumber: 5
    }, this);
}
}),
"[project]/src/app/asset/[id]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/app/asset/[id]/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__96c96669._.js.map