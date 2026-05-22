import { google } from 'googleapis';
import type { DashboardData, PLData, ExpenseCategory, COGSCategory, ClientRow, ClientProfit, TeamMember, TeamProfitRow, ServiceCapacity, Transaction, BudgetRow, MetricsData } from './types';

const SPREADSHEET_ID = '1JkaZ1qfrWqEwmSmG-sjdgQ0a3ZaQHtD5zl_RgehqdeY';

// Local copy of labelToIso to avoid importing /lib/period.ts (which imports
// types that aren't safe to cross-import at this layer).
const MON_TO_NUM: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
function labelToIsoLocal(label: string): string {
  if (!label) return '';
  // Accept both 2-digit ("Jan 25", "Jan '25") and 4-digit ("Jan 2025") years.
  const m = label.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?(\d{2,4})/);
  if (!m) return '';
  const month = MON_TO_NUM[m[1]];
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

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
  // Match month labels with either 2-digit ("Jan 25") or 4-digit ("Jan 2025")
  // years. The PL tab uses 4-digit; the Metrics tab uses 2-digit.
  const MON_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?(\d{2}|20\d{2})\b/i;
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

  // ── Dynamically extract COGS + OpEx categories from the sheet ─────────────
  // Walk every row between the section boundaries and grab anything with a label
  // and non-zero data — that way we pick up whatever categories the sheet has,
  // not just a hardcoded list.
  const incomeSummaryIdx = findRow(plGrid, 'Income Summary')?.idx
                        ?? findRow(plGrid, 'Revenue Summary')?.idx
                        ?? -1;
  const totalRevIdx  = findRow(plGrid, 'Total Revenue')?.idx ?? -1;
  const totalCogsIdx = findRow(plGrid, 'TOTAL COST OF SALES')?.idx
                    ?? findRow(plGrid, 'Total Cost of Sales')?.idx
                    ?? findRow(plGrid, 'Total Cost of Goods Sold')?.idx
                    ?? -1;
  const totalOpexIdx = findRow(plGrid, 'TOTAL OPERATING EXPENSES')?.idx
                    ?? findRow(plGrid, 'Total Operating Expenses')?.idx
                    ?? -1;

  const SKIP_LABEL = /^(total\b|cost of (sales|goods)|operating expenses?|gross profit|net income|income summary|gross margin|net margin|status)/i;

  function extractDetailRows(startIdx: number, endIdx: number): { name: string; values: number[] }[] {
    if (startIdx < 0 || endIdx <= startIdx) return [];
    const out: { name: string; values: number[] }[] = [];
    for (let i = startIdx + 1; i < endIdx; i++) {
      const row = plGrid[i] || [];
      const name = parseStr(row[0]);
      if (!name) continue;
      if (SKIP_LABEL.test(name)) continue;
      const values = numericValues(row, N);
      if (values.some(v => v !== 0)) {
        out.push({ name, values });
      }
    }
    return out;
  }

  const revenueCategories: { name: string; values: number[] }[] =
    extractDetailRows(incomeSummaryIdx, totalRevIdx);
  const cogsCategories: COGSCategory[]     = extractDetailRows(totalRevIdx,  totalCogsIdx);
  const expenseCategories: ExpenseCategory[] = extractDetailRows(totalCogsIdx, totalOpexIdx);

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

  // ── Transactions ──────────────────────────────────────────────────────────
  const txnsGrid = allGrids.find(g => g.title.toLowerCase() === 'transactions')?.grid
                ?? allGrids.find(g => findRow(g.grid, 'Transaction ID', 'Category', 'Amount'))?.grid
                ?? [];
  const transactions: Transaction[] = [];
  if (txnsGrid.length > 1) {
    const hdr = txnsGrid[0];
    const col = (key: string) => hdr.findIndex(c => parseStr(c).toLowerCase() === key.toLowerCase());
    const colLike = (key: string) => hdr.findIndex(c => parseStr(c).toLowerCase().includes(key.toLowerCase()));
    const iDate = col('Date');
    const iId   = colLike('Transaction ID');
    const iAcct = colLike('Account Code');
    const iCat  = col('Category');
    const iDesc = col('Description');
    const iVend = colLike('Client / Vendor');
    const iAmt  = col('Amount');

    for (let r = 1; r < txnsGrid.length; r++) {
      const row = txnsGrid[r];
      const date = iDate >= 0 ? parseStr(row[iDate]) : '';
      const category = iCat >= 0 ? parseStr(row[iCat]) : '';
      if (!date || !category) continue;
      const amount = parseNum(row[iAmt]);
      if (!amount) continue;
      const accountCode = iAcct >= 0 ? parseStr(row[iAcct]) : '';
      const isRevenue = /\brevenue\b|\bincome\b/i.test(category) || /^4/.test(accountCode);
      transactions.push({
        date,
        id:          iId   >= 0 ? parseStr(row[iId])   : '',
        kind:        isRevenue ? 'Revenue' : 'Expense',
        accountCode,
        category,
        description: iDesc >= 0 ? parseStr(row[iDesc]) : '',
        vendor:      iVend >= 0 ? parseStr(row[iVend]) : '',
        amount:      Math.abs(amount),
      });
    }
  }

  // ── Budget vs Actuals ─────────────────────────────────────────────────────
  const budgetGrid = allGrids.find(g => g.title.toLowerCase() === 'budget')?.grid ?? [];
  const budget: BudgetRow[] = [];
  if (budgetGrid.length > 1) {
    const hdr = budgetGrid[0];
    const colExact = (k: string) => hdr.findIndex(c => parseStr(c).toLowerCase() === k.toLowerCase());
    const iMonth  = colExact('Month');
    const iCat    = colExact('Category');
    const iGroup  = colExact('Group');
    const iBudget = colExact('Budget');
    const iActual = colExact('Actual');
    const iVarD   = colExact('Variance $');
    const iVarP   = colExact('Variance %');

    for (let r = 1; r < budgetGrid.length; r++) {
      const row = budgetGrid[r];
      const month    = iMonth  >= 0 ? parseStr(row[iMonth]).trim() : '';
      const category = iCat    >= 0 ? parseStr(row[iCat])          : '';
      if (!month || !category) continue;
      const group    = iGroup  >= 0 ? parseStr(row[iGroup])        : '';
      budget.push({
        month, category, group,
        budget:         iBudget >= 0 ? parseNum(row[iBudget]) : 0,
        actual:         iActual >= 0 ? parseNum(row[iActual]) : 0,
        varianceDollar: iVarD   >= 0 ? parseNum(row[iVarD])   : 0,
        variancePct:    iVarP   >= 0 ? parseNum(row[iVarP])   : 0,
        isTotal: /^total\s/i.test(category),
      });
    }
  }

  // ── Metrics (Phase 2) ─────────────────────────────────────────────────────
  // Look for a tab named "Metrics" (case-insensitive). The Metrics tab has its
  // own month columns and rows for every metric the operator tracks. We capture
  // ALL rows generically so the Analytics table can show every metric, and we
  // also expose typed shortcuts for the most common fields.
  const metricsGrid = allGrids.find(g => g.title.toLowerCase() === 'metrics')?.grid ?? [];
  const metrics: MetricsData = {
    metricRows: [],
    metricMonths: [],
    metricMonthsIso: [],
    metricStatuses: [],
  };

  if (metricsGrid.length > 1) {
    // 1. Find the month header row in the Metrics tab (its own columns).
    let metricMonthRow: Row = [];
    let metricMonthRowIdx = -1;
    let bestMatches = 0;
    for (let i = 0; i < metricsGrid.length; i++) {
      const row = metricsGrid[i];
      const matches = row.filter(c => MON_RE.test(parseStr(c)));
      if (matches.length > bestMatches) {
        bestMatches = matches.length;
        metricMonthRow = row;
        metricMonthRowIdx = i;
      }
    }
    // Build a list of {col, label} for every cell in the header that is a month.
    const metricMonthCells: { col: number; label: string }[] = [];
    metricMonthRow.forEach((c, i) => {
      const s = parseStr(c);
      if (MON_RE.test(s)) metricMonthCells.push({ col: i, label: s });
    });
    const metricMonths = metricMonthCells.map(c => c.label);
    const metricMonthsIso = metricMonths.map(l => labelToIsoLocal(l));

    // 2. Optional Status row (Actuals / Forecast) — same column layout as months.
    const metricStatusFound = findRow(metricsGrid, 'Status');
    const metricStatuses: string[] = metricMonthCells.map(c => {
      const s = metricStatusFound ? parseStr(metricStatusFound.row[c.col]) : '';
      return s === 'Forecast' ? 'Forecast' : 'Actuals';
    });

    // 3. Collect every data row in the Metrics tab (skip the month header itself,
    // the Status row, and any blank label).
    const SKIP_NAME = /^(status|month|metric|metrics)$/i;
    const metricRows: { name: string; rawStrings: string[]; values: number[]; format: 'currency' | 'percent' | 'number' }[] = [];
    for (let r = 0; r < metricsGrid.length; r++) {
      if (r === metricMonthRowIdx) continue;
      if (metricStatusFound && r === metricStatusFound.idx) continue;
      const row = metricsGrid[r] || [];
      const name = parseStr(row[0]);
      if (!name) continue;
      if (SKIP_NAME.test(name)) continue;
      // Pull the raw display string + parsed number for each month column.
      const rawStrings = metricMonthCells.map(c => parseStr(row[c.col]));
      // Skip rows that are entirely empty across months.
      if (rawStrings.every(s => s === '')) continue;
      const values = rawStrings.map(s => parseNum(s));
      // Detect format from the raw strings.
      const hasPct = rawStrings.some(s => /%$/.test(s));
      const hasCurrency = rawStrings.some(s => /^\(?\$|\$$|[KkMm]$/.test(s));
      let format: 'currency' | 'percent' | 'number' = 'number';
      if (hasPct) format = 'percent';
      else if (hasCurrency) format = 'currency';
      // If percent and the raw values look like "18.4%", store as 0.184.
      const finalValues = format === 'percent'
        ? values.map(v => (Math.abs(v) > 1 ? v / 100 : v))
        : values;
      metricRows.push({ name, rawStrings, values: finalValues, format });
    }

    metrics.metricRows = metricRows;
    metrics.metricMonths = metricMonths;
    metrics.metricMonthsIso = metricMonthsIso;
    metrics.metricStatuses = metricStatuses;

    // 4. Typed shortcuts — look up by name, case-insensitive exact match first,
    // then fall back to "contains". Returns the values aligned to PL months
    // (re-aligning by month label) so the rest of the dashboard stays consistent.
    const findMetric = (...candidates: string[]): { name: string; values: number[]; format: string } | undefined => {
      for (const cand of candidates) {
        const exact = metricRows.find(r => r.name.toLowerCase() === cand.toLowerCase());
        if (exact) return exact;
      }
      for (const cand of candidates) {
        const partial = metricRows.find(r => r.name.toLowerCase().includes(cand.toLowerCase()));
        if (partial) return partial;
      }
      return undefined;
    };

    // Re-align a Metrics-tab series to the PL-month order.
    const alignToPl = (values: number[]): number[] => {
      return months.map(m => {
        const iso = labelToIsoLocal(m.label);
        const idx = metricMonthsIso.indexOf(iso);
        return idx >= 0 ? values[idx] ?? 0 : 0;
      });
    };

    const pickAligned = (...candidates: string[]) => {
      const found = findMetric(...candidates);
      return found ? alignToPl(found.values) : undefined;
    };

    metrics.mrr           = pickAligned('MRR', 'Monthly Recurring Revenue');
    metrics.ltv           = pickAligned('Unique Client LTV', 'LTV', 'Lifetime Value');
    metrics.ltgp          = pickAligned('LTGP', 'Lifetime Gross Profit');
    metrics.cac           = pickAligned('Unique Client CAC', 'CAC', 'Customer Acquisition Cost');
    metrics.mrrChurn      = pickAligned('MRR Churn', 'Revenue Churn');
    metrics.clientChurn   = pickAligned('Unique Client Churn', 'Client Churn', 'Logo Churn', 'Customer Churn');
    metrics.newClients    = pickAligned('Unique Clients Signed', 'Clients Signed', 'New Clients', 'Signed', 'New Customers');
    metrics.lostClients   = pickAligned('Unique Clients Lost', 'Clients Lost', 'Lost Clients', 'Lost', 'Churned Clients');
    metrics.activeClients = pickAligned('Total Unique Clients', 'Active Clients', 'Total Clients');
  }

  // ── Team Profit (Phase 3) ─────────────────────────────────────────────────
  // Looks for a header row with Name + Revenue Covered (+ Utilization).
  // If absent, returns empty and the People page renders its empty state.
  const teamProfit: TeamProfitRow[] = [];
  let teamProfitHit: { grid: Grid; row: Row; idx: number } | null = null;
  for (const g of allGrids) {
    const hit =
      findRow(g.grid, 'Name', 'Revenue Covered') ??
      findRow(g.grid, 'Team Member', 'Revenue Covered');
    if (hit) { teamProfitHit = { grid: g.grid, row: hit.row, idx: hit.idx }; break; }
  }
  if (teamProfitHit) {
    const grid = teamProfitHit.grid;
    const hdr = teamProfitHit.row;
    const col = (key: string) => hdr.findIndex(c => parseStr(c).toLowerCase().includes(key.toLowerCase()));
    const iName = col('Name') >= 0 ? col('Name') : col('Team Member');
    const iDept = col('Department');
    const iHrs  = col('Hours Available') >= 0 ? col('Hours Available') : col('Hours');
    const iRev  = col('Revenue Covered');
    const iUtl  = col('Utilization');
    const iTgt  = col('vs Target');
    const iGap  = col('Revenue Gap');
    for (let r = teamProfitHit.idx + 1; r < grid.length; r++) {
      const row = grid[r];
      const name = iName >= 0 ? parseStr(row[iName]) : '';
      if (!name || /^total\b/i.test(name)) continue;
      const utlRaw = iUtl >= 0 ? parseStr(row[iUtl]) : '';
      const tgtRaw = iTgt >= 0 ? parseStr(row[iTgt]) : '';
      const utilization = utlRaw.includes('%') ? parseFloat(utlRaw) / 100 : parseNum(utlRaw);
      const vsTarget    = tgtRaw.includes('%') ? parseFloat(tgtRaw) / 100 : parseNum(tgtRaw);
      teamProfit.push({
        name,
        department:     iDept >= 0 ? parseStr(row[iDept]) : '',
        hoursAvailable: iHrs  >= 0 ? parseNum(row[iHrs])  : 0,
        revenueCovered: iRev  >= 0 ? parseNum(row[iRev])  : 0,
        utilization:    Math.abs(utilization) > 1 ? utilization / 100 : utilization,
        vsTarget:       Math.abs(vsTarget) > 1 ? vsTarget / 100 : vsTarget,
        revenueGap:     iGap  >= 0 ? parseNum(row[iGap])  : 0,
      });
    }
  }

  return {
    lastUpdated: new Date().toISOString(),
    pl,
    revenueCategories,
    expenseCategories,
    cogsCategories,
    clients: clientRows,
    clientProfits,
    teamMembers,
    teamProfit,
    serviceCapacity,
    transactions,
    budget,
    metrics,
  };
}
