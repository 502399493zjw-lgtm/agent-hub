import { NextResponse } from 'next/server';
import { getUserById, getAgentUserById } from '@/data/mock';
import { listAssets } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = getUserById(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const agent = getAgentUserById(id);

  // Get published assets from DB by matching author_id
  const dbResult = listAssets({ pageSize: 100 });
  const publishedAssets = dbResult.assets.filter(a => 
    user.publishedAssets.includes(a.id) || a.author.id === id
  );

  return NextResponse.json({
    user: { ...user, publishedAssets: publishedAssets.map(a => a.id) },
    isAgent: !!agent,
    agentDetails: agent || null,
    publishedAssets,
  });
}
