import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY';

export const revalidate = 0;

export async function GET() {
  try {
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set');
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(key),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const tabs = (meta.data.sheets ?? []).map(s => s.properties?.title ?? '');

    // Fetch first 4 rows of every tab
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEET_ID,
      ranges: tabs.map(t => `'${t}'!A1:Z4`),
      valueRenderOption: 'FORMATTED_VALUE',
    });

    const preview = (batch.data.valueRanges ?? []).map((vr, i) => ({
      tab: tabs[i],
      rows: vr.values ?? [],
    }));

    return NextResponse.json({ tabs, preview });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
