import { listUserProfileIds } from '@/lib/db';
import UserProfileClient from './client';

export function generateStaticParams() {
  return listUserProfileIds().map(id => ({ id }));
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserProfileClient id={id} />;
}
