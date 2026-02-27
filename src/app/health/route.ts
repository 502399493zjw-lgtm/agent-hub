/**
 * Health check endpoint for Docker HEALTHCHECK
 * No authentication required
 */
import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connectivity
    const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'data', 'hub.db');
    const db = new Database(dbPath, { readonly: true });
    
    // Simple query to verify DB is accessible
    const result = db.prepare('SELECT 1 as health').get() as { health: number };
    db.close();

    if (result?.health !== 1) {
      throw new Error('Database health check failed');
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    }, { status: 200 });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
