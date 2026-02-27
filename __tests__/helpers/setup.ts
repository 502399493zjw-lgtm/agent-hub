/**
 * Global test setup — runs before all test files.
 * Mocks external dependencies that shouldn't be touched in tests.
 */
import { vi } from 'vitest';

// Mock the seed data to use a controlled set of invite codes
// (db.ts's initTables seeds invite codes from this module)
// NOTE: We don't mock it here since __setTestDb already initializes
// with the real seed data (SEAFOOD, OPENCLAW, AGENTHUB).
