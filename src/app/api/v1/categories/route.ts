import { NextResponse } from 'next/server';
import { getAllCategories } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ categories: getAllCategories() });
}
