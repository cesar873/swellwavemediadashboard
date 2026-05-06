import { google } from 'googleapis';
import type { DashboardData, PLData, ExpenseCategory, COGSCategory, ClientRow, ClientProfit, TeamMember, ServiceCapacity } from './types';

const SPREADSHEET_ID = '1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY';

// ── Auth ──────────────────────────────────────────────────────────────────────
function getAuth() {
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!key) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY env var not set');
  const credentials = JSON.parse(key);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
type CellValue = string | number | boolean | null | undefined;
type Row = CellValue[];
type Grid = Row[];

function parseNum(v: CellValue): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v)
    .replace(/[$, ]/g, '')
    .replace(/%$/, '')
    .replace(/\((.+)\)/, '-$1')
    .replace(/\\-/, '-');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseStr(v: CellValue): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Find the first row containing all the given substrings (case-insensitive). */
function findRow(grid: Grid, ...markers: string[]): { row: Row; idx: number } | null {
  for (let i = 0; i < grid.length; i++) {
    const rowStr = grid[i].map(c => parseStr(c).toLowerCase()).join('|');
    if (markers.every(m => rowStr.includes(m.toLowerCase()))) {
      return { row: grid[i], idx: i };
    }
  }
  return null;
}

/** Extract N numeric values from a row starting at the first non-label column. */
function numericValues(row: Row, count: number, startCol = 1): number[] {
  const out: number[] = [];
  for (let c = startCol; c < row.length && out.length < count; c++) {
    const n = parseNum(row[c]);
    out.push(n);
  }
  while (out.length < count) out.push(0);
  return out.slice(0, count);
}

/** Find a label row and return its numeric values. */
function rowValues(grid: Grid, label: string, count: number): number[] {
  const found = findRow(grid, label);
  if (!found) return Array(count).fill(0);
  return numericValues(found.row, count);
}

// ── Main fetch + parse ────────────────────────────────────────────────────────
export async function fetchDashboardData(): Promise<DashboardData> {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Discover sheet tabs
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetList = meta.data.sheets ?? [];

  // 2. Fetch all tabs in one batchGet — FORMATTED_VALUE so dates/months come back as
  //    readable strings ("Jan 2026") rather than serial numbers (45928).
  const ranges = sheetList.map(s => `'${s.properties?.title}'!A1:AJ500`);
  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  // 3. Merge all grids into one (different sections live in different tabs)
  const allGrids: { title: string; grid: Grid }[] = (batchRes.data.valueRanges ?? []).map(
    (vr, i) => ({
      title: sheetList[i]?.properties?.title ?? `Sheet${i}`,
      grid: (vr.values ?? []) as Grid,
    })
  );

  // 4. Find the P&L grid (the one containing "Income Summary")
  const plGrid = allGrids.find(g => findRow(g.grid, 'Income Summary'))?.grid
    ?? allGrids[0]?.grid ?? [];

  // 5. Find the clients grid (the one with "Client" + "Service" + "Pod" columns)
  const clientGrid = allGrids.find(g => findRow(g.grid, 'Client', 'Service', 'Pod'))?.grid
    ?? plGrid;

  // 6. Determine months — scan every row in plGrid looking for the one that has
  //    the most cells matching "Mon YYYY" (e.g. "Jan 2026", "Feb 2026").
  const MON_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).{0,5}20\d\d/i;
  let bestMonthRow: Row = [];
  let bestMonthCount = 0;
  for (const row of plGrid) {
    const matches = row.filter(c => MON_RE.test(parseStr(c)));
    if (matches.length > bestMonthCount) { bestMonthCount = matches.length; bestMonthRow = row; }
  }
  // Also try the Income Summary row as a fallback
  if (bestMonthCount === 0) {
    const isr = findRow(plGrid, 'Income Summary')?.row ?? [];
    bestMonthRow = isr;
  }
  const monthCols = bestMonthRow
    .map(parseStr)
    .filter(s => MON_RE.test(s) || s.includes('20'))
    .slice(0, 6);

  const N = monthCols.length || 4;

  // 7. Status row (Actuals / Forecast)
  const statusRow = findRow(plGrid, 'Status')?.row ?? [];
  const statuses = statusRow.slice(1).map(parseStr).filter(s => s === 'Actuals' || s === 'Forecast').slice(0, N);

  const months = monthCols.map((label, i) => ({
    label,
    status: statuses[i] ?? 'Actuals',
  }));

  // ── P&L ──────────────────────────────────────────────────────────────────
  const revenue   = rowValues(plGrid, 'Total Revenue', N);
  const cogsTotal = rowValues(plGrid, 'TOTAL COST OF SALES', N);
  const opex      = rowValues(plGrid, 'TOTAL OPERATING EXPENSES', N);
  const netIncome = rowValues(plGrid, 'Net Income', N);
  const netMargin = rowValues(plGrid, 'Net Profit Margin', N);

  const grossProfit = revenue.map((r, i) => r - cogsTotal[i]);
  const grossMargin = revenue.map((r, i) => r > 0 ? +((grossProfit[i] / r) * 100).toFixed(2) : 0);
  const netMarginPct = netMargin.map(n => Math.abs(n) > 1 ? n : +(n * 100).toFixed(2)); // handle both % and decimal

  const pl: PLData = { months, revenue, cogs: cogsTotal, grossProfit, grossMargin, opex, netIncome, netMargin: netMarginPct };

  // ── COGS categories ──────────────────────────────────────────────────────
  const cogsLabels = ['Contractors - Service Delivery', 'Influencer Contract Payments', 'Subcontracted Services'];
  const cogsCategories: COGSCategory[] = cogsLabels.map(name => ({
    name,
    values: rowValues(plGrid, name, N),
  })).filter(c => c.values.some(v => v !== 0));

  // ── OpEx categories ──────────────────────────────────────────────────────
  const opexLabels = [
    'Referral Partners',
    'Meals & Entertainment',
    'Travel - Lodging',
    'Travel - Flights',
    'Travel & Auto Expenses',
    'Legal and Other Professional Fees',
    'Software - Agency Tools',
    'Software - AI Tools',
    'Software - Other',
    'Office Supplies',
    'Tax Payments',
    'Financial Services',
    'Bank Charges and other fees',
    'Uncategorized Expense',
    'Accounting Services',
  ];
  const expenseCategories: ExpenseCategory[] = opexLabels.map(name => ({
    name,
    values: rowValues(plGrid, name, N),
  })).filter(c => c.values.some(v => v !== 0));

  // ── Clients (revenue by month) ──────────────────────────────────────────
  // Find the header row: must contain Client + Status + Service + Start Date + at least one month col
  const clientHeaderResult = findRow(clientGrid, 'Client', 'Status', 'Service', 'Start Date');
  const clientHeaderIdx = clientHeaderResult?.idx ?? -1;

  const clientRows: ClientRow[] = [];
  if (clientHeaderIdx >= 0) {
    const hdr = clientGrid[clientHeaderIdx];
    // Figure out which column is which
    const colOf = (key: string) => hdr.findIndex(c => parseStr(c).toLowerCase().includes(key.toLowerCase()));
    const iClient = colOf('Client');
    const iStatus = colOf('Status');
    const iService = colOf('Service');
    const iPod     = colOf('Pod');
    const iStart   = colOf('Start Date');
    const iSource  = colOf('Source');
    const iTeam    = colOf('Team');
    const iEnd     = colOf('End Reason');

    // Month columns: find columns whose header contains "2026" or "2025"
    const monthColIdxs: number[] = [];
    hdr.forEach((c, i) => {
      if (/20\d\d/.test(parseStr(c))) monthColIdxs.push(i);
    });
    const revMonths = monthColIdxs.map(i => parseStr(hdr[i]));

    for (let r = clientHeaderIdx + 1; r < clientGrid.length; r++) {
      const row = clientGrid[r];
      const client = iClient >= 0 ? parseStr(row[iClient]) : '';
      if (!client || client === 'Client') continue;

      const monthlyRevenue = monthColIdxs.map(i => parseNum(row[i]));
      clientRows.push({
        client,
        status:        iStatus  >= 0 ? parseStr(row[iStatus])  : '',
        service:       iService >= 0 ? parseStr(row[iService]) : '',
        pod:           iPod     >= 0 ? parseStr(row[iPod])     : '',
        startDate:     iStart   >= 0 ? parseStr(row[iStart])   : '',
        source:        iSource  >= 0 ? parseStr(row[iSource])  : '',
        teamMember:    iTeam    >= 0 ? parseStr(row[iTeam])    : '',
        endReason:     iEnd     >= 0 ? parseStr(row[iEnd])     : '',
        monthlyRevenue,
      });
    }
  }

  // ── Client profitability ──────────────────────────────────────────────────
  const profitHeader = findRow(plGrid, 'Client', 'Revenue', 'People Cost', 'Profit');
  const clientProfits: ClientProfit[] = [];
  if (profitHeader) {
    const hdr = profitHeader.row;
    const iC  = hdr.findIndex(c => parseStr(c).toLowerCase() === 'client');
    const iSv = hdr.findIndex(c => parseStr(c).toLowerCase() === 'service');
    const iPd = hdr.findIndex(c => parseStr(c).toLowerCase() === 'pod');
    const iRv = hdr.findIndex(c => parseStr(c).toLowerCase() === 'revenue');
    const iPC = hdr.findIndex(c => parseStr(c).toLowerCase().includes('people cost'));
    const iGP = hdr.findIndex(c => parseStr(c).toLowerCase().includes('profit'));
    const iMg = hdr.findIndex(c => parseStr(c).toLowerCase().includes('margin'));

    for (let r = profitHeader.idx + 1; r < plGrid.length; r++) {
      const row = plGrid[r];
      const client = iC >= 0 ? parseStr(row[iC]) : '';
      if (!client) continue;
      const revenue = iRv >= 0 ? parseNum(row[iRv]) : 0;
      const peopleCost = iPC >= 0 ? parseNum(row[iPC]) : 0;
      const profit = iGP >= 0 ? parseNum(row[iGP]) : revenue - peopleCost;
      const rawMargin = iMg >= 0 ? parseStr(row[iMg]) : '';
      const margin = rawMargin.includes('%')
        ? parseFloat(rawMargin)
        : revenue > 0 ? +((profit / revenue) * 100).toFixed(1) : 0;

      clientProfits.push({
        client,
        service:     iSv >= 0 ? parseStr(row[iSv]) : '',
        pod:         iPd >= 0 ? parseStr(row[iPd]) : '',
        revenue, peopleCost, profit, margin,
      });
    }
  }

  // ── Team Members ──────────────────────────────────────────────────────────
  const peopleGrid = allGrids.find(g => findRow(g.grid, 'Name', 'Department', 'Contracted Salary'))?.grid ?? plGrid;
  const teamHeader = findRow(peopleGrid, 'Name', 'Department', 'Contracted Salary');
  const teamMembers: TeamMember[] = [];
  if (teamHeader) {
    const hdr = teamHeader.row;
    const get = (key: string) => hdr.findIndex(c => parseStr(c).toLowerCase().includes(key.toLowerCase()));
    const iName = get('Name'), iStatus = get('Status'), iDept = get('Department');
    const iCat  = get('Category'), iStart = get('Start Date'), iHrs = get('Total Hours');
    const iSal  = get('Contracted Salary'), iCPH = get('Cost per Hour');

    for (let r = teamHeader.idx + 1; r < peopleGrid.length; r++) {
      const row = peopleGrid[r];
      const name = parseStr(row[iName >= 0 ? iName : 0]);
      if (!name || name === 'Name') continue;
      teamMembers.push({
        name,
        status:           parseStr(row[iStatus >= 0 ? iStatus : 1]),
        department:       parseStr(row[iDept   >= 0 ? iDept   : 2]),
        category:         parseStr(row[iCat    >= 0 ? iCat    : 3]),
        startDate:        parseStr(row[iStart  >= 0 ? iStart  : 4]),
        totalHours:       parseNum(row[iHrs    >= 0 ? iHrs    : 8]),
        contractedSalary: parseNum(row[iSal    >= 0 ? iSal    : 9]),
        costPerHour:      parseNum(row[iCPH    >= 0 ? iCPH    : 10]),
      });
    }
  }

  // ── Service Capacity ──────────────────────────────────────────────────────
  const capGrid = allGrids.find(g => findRow(g.grid, 'Service', 'Intensity', 'Media Buying'))?.grid ?? plGrid;
  const capHeader = findRow(capGrid, 'Service', 'Intensity', 'Media Buying');
  const serviceCapacity: ServiceCapacity[] = [];
  if (capHeader) {
    const hdr = capHeader.row;
    const iSv  = hdr.findIndex(c => parseStr(c).toLowerCase() === 'service');
    const iInt = hdr.findIndex(c => parseStr(c).toLowerCase() === 'intensity');
    const iMB  = hdr.findIndex(c => parseStr(c).toLowerCase().includes('media buying'));
    const iLd  = hdr.findIndex(c => parseStr(c).toLowerCase().includes('leadership'));
    const iCS  = hdr.findIndex(c => parseStr(c).toLowerCase().includes('client success'));

    const VALID_INTENSITY = new Set(['low', 'mid', 'medium', 'high']);
    for (let r = capHeader.idx + 1; r < capGrid.length; r++) {
      const row = capGrid[r];
      const service   = parseStr(row[iSv  >= 0 ? iSv  : 0]);
      const intensity = parseStr(row[iInt >= 0 ? iInt : 1]);
      // Stop as soon as we hit a row that isn't a real capacity row
      if (!service || !intensity) continue;
      if (!VALID_INTENSITY.has(intensity.toLowerCase())) continue;
      const mb  = parseNum(row[iMB >= 0 ? iMB : 2]);
      const ld  = parseNum(row[iLd >= 0 ? iLd : 3]);
      const cs  = parseNum(row[iCS >= 0 ? iCS : 4]);
      serviceCapacity.push({ service, intensity, mediaBuying: mb, leadership: ld, clientSuccess: cs, totalHours: mb + ld + cs });
    }
  }

  return {
    lastUpdated: new Date().toISOString(),
    pl,
    expenseCategories,
    cogsCategories,
    clients: clientRows,
    clientProfits,
    teamMembers,
    serviceCapacity,
  };
}
