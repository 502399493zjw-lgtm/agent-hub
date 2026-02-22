/**
 * db/index.ts — Re-exports all public API from modular db/ modules.
 *
 * Import order matters: schema.ts must be imported first to register
 * the initTables function before any getDb() calls.
 */

// Connection (must be first — other modules depend on getDb)
export { getDb, __setTestDb } from './connection';

// Schema (import triggers __registerInitFn side-effect)
export { initTables, rebuildFtsIndex } from './schema';

// Economy (coins, stars, hub score) — imported early since other modules depend on it
export {
  calculateHubScore, recalculateHubScore,
  USER_REP_EVENTS, SHRIMP_COIN_EVENTS,
  addCoins, getUserCoins, getCoinHistory, hasEnoughCoins,
  starAsset, unstarAsset, isStarred, getAssetUserStarCount, getTotalStars,
  getUserStarInfo, getTopStarredAssets,
  type CoinEvent, getUserCoinEvents,
} from './economy';

// Assets
export {
  rowToAsset, type DbRow,
  type ListParams, listAssets, getAssetById, createAsset, updateAsset, deleteAsset,
  incrementDownload,
  type AssetCompact, listAssetsCompact,
  type L1ListParams, listAssetsL1, getAssetL2,
  getAllTags, getAllCategories,
  getAssetManifest, updateAssetManifest, getAssetReadme,
  getAssetsByIds, getTrendingAssets,
  type AssetVersionInfo, getAssetVersions, getAssetVersion,
  type HashResolveResult, resolveByHash,
} from './assets';

// Users
export {
  type DbUser,
  findUserByProvider, findUserById, createUser, softDeleteUser,
  completeOnboarding, isOnboardingCompleted,
  getUserProviderInfo, updateProviderInfo,
  findUserByEmail, findUserByName,
  isAdmin, banUser, unbanUser, isBanned, setUserRole, getUserRole,
  updateProfile, updateAvatar,
  type DbUserProfile,
  getUserProfile, listUserProfiles, searchUserProfiles,
  getAgentUserProfiles, listUserProfileIds,
} from './users';

// Auth (API Keys, Devices, Invite Codes, CLI Auth, Verification Tokens)
export {
  createVerificationToken, useVerificationToken,
  activateInviteCode, validateInviteCode,
  type InviteCode,
  generateUserInviteCodes, getUserInviteCodes,
  createSuperInviteCode, getInviteCodeDetail,
  listAllInviteCodes, deleteInviteCode, userHasInviteAccess,
  type DbApiKey,
  createApiKey, findUserByApiKey, updateApiKeyLastUsed,
  listApiKeys, revokeApiKey, revokeApiKeyByRawKey,
  authorizeDevice, validateDevice, listAuthorizedDevices, revokeDevice, getDeviceBinding,
  createCliAuthRequest, pollCliAuthRequest, approveCliAuthRequest, getCliAuthRequest,
} from './auth';

// Social (Comments, Issues, Collections)
export {
  getCommentsByAssetId, createComment, getCommentCount,
  getIssuesByAssetId, createIssue, searchIssues, getIssueCount,
  getCollections, searchCollections,
} from './social';

// Stats (Notifications, Evolution/Activity Events, Growth, Stats)
export {
  getNotifications, markNotificationRead, markAllRead,
  getEvolutionEventsByUserId, getActivityEventsByUserId,
  getGrowthData, type StatsData, getStats,
  getAssetCountByType, getTotalCommentCount, getTotalIssueCount, getTotalUserCount,
} from './stats';
