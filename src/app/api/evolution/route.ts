import { NextResponse } from 'next/server';
import { listUserProfiles, getEvolutionEventsByUserId } from '@/lib/db';

export async function GET() {
  try {
    const users = listUserProfiles();
    const usersWithEvents = users.map(u => ({
      ...u,
      evolutionEvents: getEvolutionEventsByUserId(u.id),
    }));
    return NextResponse.json({ success: true, data: usersWithEvents });
  } catch (err) {
    console.error('GET /api/evolution error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
