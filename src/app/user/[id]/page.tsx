import { getUserProfile, listAssets, getEvolutionEventsByUserId, getActivityEventsByUserId, listUserProfileIds } from '@/lib/db';
import UserProfileClient from './client';
import type { Metadata } from 'next';
import type { EvolutionEvent, ActivityEvent } from '@/data/mock';

export function generateStaticParams() {
  return listUserProfileIds().map(id => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const user = getUserProfile(id);
  if (!user) {
    return { title: '用户未找到 — 水产市场' };
  }
  return {
    title: `${user.name} — 水产市场`,
    description: user.bio || `${user.name} 的个人主页`,
    openGraph: {
      title: `${user.name} — 水产市场`,
      description: user.bio || `${user.name} 的个人主页`,
      type: 'profile',
    },
  };
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = getUserProfile(id);

  // Get published assets from DB by matching author_id
  const dbResult = listAssets({ pageSize: 100 });
  const publishedAssets = user
    ? dbResult.assets.filter(a => user.publishedAssets.includes(a.id) || a.author.id === id)
    : [];

  const evolutionEvents = getEvolutionEventsByUserId(id) as EvolutionEvent[];
  const activityEvents = getActivityEventsByUserId(id) as ActivityEvent[];

  return (
    <UserProfileClient
      id={id}
      initialUser={user}
      initialPublished={publishedAssets}
      initialEvolutionEvents={evolutionEvents}
      initialActivityEvents={activityEvents}
    />
  );
}
