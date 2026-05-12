import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

// Force-revalidate /api/dashboard, busting both the Next.js ISR cache and
// the Vercel CDN cache so the next fetch reads fresh data from the sheet.
export async function POST() {
  revalidatePath('/api/dashboard');
  return NextResponse.json({ revalidated: true, ts: Date.now() });
}

export async function GET() {
  revalidatePath('/api/dashboard');
  return NextResponse.json({ revalidated: true, ts: Date.now() });
}
