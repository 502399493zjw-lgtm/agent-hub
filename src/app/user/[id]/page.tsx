import { users } from '@/data/mock';
import UserProfileClient from './client';

export function generateStaticParams() {
  return users.map(u => ({ id: u.id }));
}

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <UserProfileClient id={id} />;
}
