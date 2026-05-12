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

    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `'Transactions'!A1:J5000`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const rows = r.data.values ?? [];
    const header = rows[0] ?? [];
    const dataRows = rows.slice(1);

    const types = new Set<string>();
    const categories = new Set<string>();
    for (const row of dataRows) {
      if (row[2]) types.add(String(row[2]));
      if (row[4]) categories.add(String(row[4]));
    }

    return NextResponse.json({
      header,
      rowCount: dataRows.length,
      types: [...types],
      categories: [...categories].sort(),
      firstRow: dataRows[0],
      lastRow: dataRows[dataRows.length - 1],
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
