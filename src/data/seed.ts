// ══════════════════════════════════════════════════
// Seed data — imported by db.ts for SQLite seeding
// Only invite codes remain; all fake data removed.
// ══════════════════════════════════════════════════

export const inviteCodes = [
  { code: 'SEAFOOD', maxUses: 100, type: 'super' as const },
  { code: 'OPENCLAW', maxUses: 100, type: 'super' as const },
  { code: 'AGENTHUB', maxUses: 50, type: 'super' as const },
];
