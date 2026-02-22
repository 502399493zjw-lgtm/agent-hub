/**
 * db/connection.ts — Database connection management.
 * 
 * This module MUST NOT import from any other db/ module to prevent circular dependencies.
 */
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'hub.db');

let _db: Database.Database | null = null;
let _initFn: ((db: Database.Database) => void) | null = null;

/** Register the init function (called by schema.ts at import time) */
export function __registerInitFn(fn: (db: Database.Database) => void): void {
  _initFn = fn;
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 10000');
    _db.pragma('foreign_keys = ON');
    if (_initFn) _initFn(_db);
  }
  return _db;
}

/** @internal — Test-only: inject a pre-configured database instance */
export function __setTestDb(db: Database.Database): void {
  _db = db;
  if (_initFn) _initFn(db);
}
