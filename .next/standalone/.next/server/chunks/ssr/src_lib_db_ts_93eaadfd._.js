module.exports=[61469,a=>{"use strict";var b=a.i(85148),c=a.i(14747);let d=[{code:"SEAFOOD",maxUses:100,type:"super"},{code:"OPENCLAW",maxUses:100,type:"super"},{code:"AGENTHUB",maxUses:50,type:"super"}],e=c.default.join(process.cwd(),"data","hub.db"),f=null;function g(){return f||((f=new b.default(e)).pragma("journal_mode = WAL"),function(a){a.exec(`
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
  `);try{a.exec("ALTER TABLE users ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN shrimp_coins INTEGER NOT NULL DEFAULT 100")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN onboarding_completed INTEGER NOT NULL DEFAULT 0")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN custom_name TEXT")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN custom_avatar TEXT")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN provider_name TEXT")}catch{}try{a.exec("ALTER TABLE users ADD COLUMN provider_avatar TEXT")}catch{}try{a.exec("ALTER TABLE assets ADD COLUMN manifest TEXT NOT NULL DEFAULT '{}'")}catch{}if(0===a.prepare("SELECT COUNT(*) as cnt FROM invite_codes").get().cnt){let b=new Date().toISOString(),c=a.prepare("INSERT OR IGNORE INTO invite_codes (code, created_by, max_uses, use_count, type, created_at) VALUES (?, 'system', ?, 0, ?, ?)");for(let a of d)c.run(a.code,a.maxUses,a.type??"system",b)}}(f)),f}function h(a){return{id:a.id,name:a.name,displayName:a.display_name,type:a.type,author:{id:a.author_id||"u-"+a.author_name.toLowerCase().replace(/\s+/g,"-"),name:a.author_name,avatar:a.author_avatar},description:a.description,longDescription:a.long_description,version:a.version,downloads:a.downloads,rating:a.rating,ratingCount:a.rating_count,tags:JSON.parse(a.tags),category:a.category,createdAt:a.created_at,updatedAt:a.updated_at,installCommand:a.install_command,readme:a.readme,versions:JSON.parse(a.versions),dependencies:JSON.parse(a.dependencies),compatibility:JSON.parse(a.compatibility),issueCount:a.issue_count,files:JSON.parse(a.files||"[]"),configSubtype:a.config_subtype??void 0}}function i(a){let b,c=g(),d=[],e={};a.type&&["skill","config","plugin","trigger","channel","template"].includes(a.type)&&(d.push("type = @type"),e.type=a.type),a.category&&(d.push("category = @category"),e.category=a.category),a.q&&(d.push("(name LIKE @q OR display_name LIKE @q OR description LIKE @q OR tags LIKE @q)"),e.q=`%${a.q}%`);let f=d.length>0?"WHERE "+d.join(" AND "):"",i=c.prepare(`SELECT COUNT(*) as cnt FROM assets ${f}`).get(e).cnt;switch(a.sort){case"downloads":b="downloads DESC";break;case"rating":b="rating DESC";break;case"updated_at":case"newest":b="updated_at DESC";break;case"created_at":b="created_at DESC";break;case"trending":b="downloads DESC, updated_at DESC";break;default:b="(downloads * rating) DESC"}let j=Math.max(1,a.page??1),k=Math.min(100,Math.max(1,a.pageSize??20));return{assets:c.prepare(`SELECT * FROM assets ${f} ORDER BY ${b} LIMIT @limit OFFSET @offset`).all({...e,limit:k,offset:(j-1)*k}).map(h),total:i,page:j,pageSize:k}}function j(a){let b=g().prepare("SELECT * FROM assets WHERE id = ?").get(a);return b?h(b):null}function k(a){let b=g().prepare("SELECT provider, provider_name, provider_avatar FROM users WHERE id = ?").get(a);return b?{provider:b.provider,providerName:b.provider_name,providerAvatar:b.provider_avatar}:null}function l(a){let b=!!a.is_agent;return{id:a.id,name:a.name,avatar:a.avatar,bio:a.bio,joinedAt:a.joined_at,publishedAssets:JSON.parse(a.published_assets),favoriteAssets:JSON.parse(a.favorite_assets),followers:a.followers,following:a.following,isAgent:b,agentConfig:b?{model:a.agent_model||"",uptime:a.agent_uptime||"",tasksCompleted:a.agent_tasks_completed,specialization:a.agent_specialization?JSON.parse(a.agent_specialization):[]}:void 0,contributionPoints:a.contribution_points,contributorLevel:a.contributor_level,instanceId:a.instance_id??void 0}}function m(a){let b=g().prepare("SELECT * FROM user_profiles WHERE id = ?").get(a);return b?l(b):null}function n(){return g().prepare("SELECT * FROM user_profiles ORDER BY followers DESC").all().map(l)}function o(a){return g().prepare("SELECT * FROM user_profiles WHERE name LIKE ? OR bio LIKE ? ORDER BY followers DESC").all(`%${a}%`,`%${a}%`).map(l)}function p(){return g().prepare("SELECT id FROM user_profiles").all().map(a=>a.id)}function q(a){return{id:a.id,assetId:a.asset_id,userId:a.user_id,userName:a.user_name,userAvatar:a.user_avatar,content:a.content,rating:a.rating,createdAt:a.created_at,commenterType:a.commenter_type}}function r(a){return g().prepare("SELECT * FROM comments WHERE asset_id = ? ORDER BY created_at DESC").all(a).map(q)}function s(a){return{id:a.id,assetId:a.asset_id,authorId:a.author_id,authorName:a.author_name,authorAvatar:a.author_avatar,authorType:a.author_type,title:a.title,body:a.body,status:a.status,labels:JSON.parse(a.labels),createdAt:a.created_at,commentCount:a.comment_count}}function t(a){return g().prepare("SELECT * FROM issues WHERE asset_id = ? ORDER BY created_at DESC").all(a).map(s)}function u(a){return g().prepare("SELECT * FROM issues WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC").all(`%${a}%`,`%${a}%`).map(s)}function v(a){return g().prepare("SELECT * FROM evolution_events WHERE user_id = ? ORDER BY date ASC").all(a).map(a=>({id:a.id,userId:a.user_id,icon:a.icon,title:a.title,description:a.description,date:a.date,type:a.type}))}function w(a){return g().prepare("SELECT * FROM activity_events WHERE user_id = ? ORDER BY date DESC").all(a).map(a=>({id:a.id,userId:a.user_id,icon:a.icon,text:a.text,date:a.date,type:a.type,linkTo:a.link_to??void 0,actorType:a.actor_type}))}function x(){return g().prepare("SELECT * FROM daily_stats ORDER BY day ASC").all().map(a=>({day:a.day,downloads:a.downloads,newAssets:a.new_assets,newUsers:a.new_users}))}function y(){let a=g(),b=a.prepare("SELECT COUNT(*) as cnt FROM assets").get().cnt,c=a.prepare("SELECT COUNT(DISTINCT author_id) as cnt FROM assets WHERE author_id != ''").get().cnt,d=a.prepare("SELECT COALESCE(SUM(downloads), 0) as total FROM assets").get().total,e=new Date(Date.now()-6048e5).toISOString().split("T")[0],f=a.prepare("SELECT COUNT(*) as cnt FROM assets WHERE created_at >= ?").get(e).cnt;return{totalAssets:b,totalDevelopers:c,totalDownloads:d,weeklyNew:f,topDevelopers:a.prepare("SELECT author_id as id, author_name as name, author_avatar as avatar, COUNT(*) as assetCount, COALESCE(SUM(downloads),0) as totalDownloads FROM assets WHERE author_id != '' GROUP BY author_id ORDER BY totalDownloads DESC LIMIT 10").all(),recentActivity:a.prepare("SELECT name, display_name, author_name, author_avatar, version, created_at, updated_at FROM assets ORDER BY updated_at DESC LIMIT 20").all().map(a=>({type:a.created_at===a.updated_at?"publish":"update",authorName:a.author_name,authorAvatar:a.author_avatar,assetName:a.name,assetDisplayName:a.display_name,version:a.version,timestamp:a.updated_at}))}}function z(){let a=g().prepare("SELECT type, COUNT(*) as cnt FROM assets GROUP BY type").all(),b={};for(let c of a)b[c.type]=c.cnt;return b}function A(){return g().prepare("SELECT COUNT(*) as cnt FROM comments").get().cnt}function B(){return g().prepare("SELECT COUNT(*) as cnt FROM issues").get().cnt}a.s(["getActivityEventsByUserId",()=>w,"getAssetById",()=>j,"getAssetCountByType",()=>z,"getCommentsByAssetId",()=>r,"getEvolutionEventsByUserId",()=>v,"getGrowthData",()=>x,"getIssuesByAssetId",()=>t,"getStats",()=>y,"getTotalCommentCount",()=>A,"getTotalIssueCount",()=>B,"getUserProfile",()=>m,"getUserProviderInfo",()=>k,"listAssets",()=>i,"listUserProfileIds",()=>p,"listUserProfiles",()=>n,"searchIssues",()=>u,"searchUserProfiles",()=>o],61469)}];

//# sourceMappingURL=src_lib_db_ts_93eaadfd._.js.map