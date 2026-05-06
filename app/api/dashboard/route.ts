import { NextResponse } from 'next/server';
import { fetchDashboardData } from '@/lib/sheets';

// Cache for 5 minutes via Next.js ISR
export const revalidate = 300;

export async function GET() {
  try {
    const data = await fetchDashboardData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[dashboard/route] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
