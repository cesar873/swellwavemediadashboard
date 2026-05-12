import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SPREADSHEET_ID = '1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY';
export const revalidate = 0;

export async function GET() {
  try {
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(key), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `'Budget'!A1:G500`, valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = r.data.values ?? [];
    const groups = new Set<string>();
    const months  = new Set<string>();
    const cats    = new Set<string>();
    for (const row of rows.slice(1)) {
      if (row[0]) months.add(String(row[0]));
      if (row[1]) cats.add(String(row[1]));
      if (row[2]) groups.add(String(row[2]));
    }
    return NextResponse.json({
      header: rows[0], rowCount: rows.length - 1,
      groups: [...groups], months: [...months], categories: [...cats].sort(),
      first10: rows.slice(1, 11),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
