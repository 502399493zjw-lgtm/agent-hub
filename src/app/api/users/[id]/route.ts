import { NextResponse } from 'next/server';
import { getUserProfile, listAssets, getEvolutionEventsByUserId, getActivityEventsByUserId } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = getUserProfile(id);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get published assets from DB by matching author_id
  const dbResult = listAssets({ pageSize: 100 });
  const publishedAssets = dbResult.assets.filter(a => 
    user.publishedAssets.includes(a.id) || a.author.id === id
  );

  const evolutionEvents = getEvolutionEventsByUserId(id);
  const activityEvents = getActivityEventsByUserId(id);

  return NextResponse.json({
    user: { ...user, publishedAssets: publishedAssets.map(a => a.id) },
    isAgent: user.isAgent,
    agentDetails: user.isAgent ? user.agentConfig : null,
    publishedAssets,
    evolutionEvents,
    activityEvents,
  });
}
