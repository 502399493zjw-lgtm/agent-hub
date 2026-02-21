import { NextResponse } from 'next/server';
import { getAllTags } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ tags: getAllTags() });
}
