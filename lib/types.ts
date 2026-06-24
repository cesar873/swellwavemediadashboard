export interface MonthlyData {
  label: string; // e.g. "Jan 2026"
  status: string; // "Actuals" | "Forecast"
}

export interface PLData {
  months: MonthlyData[];
  revenue: number[];
  cogs: number[];
  grossProfit: number[];
  grossMargin: number[];
  opex: number[];
  netIncome: number[];
  netMargin: number[];
}

export interface ExpenseCategory {
  name: string;
  values: number[];
}

export interface COGSCategory {
  name: string;
  values: number[];
}

export interface RevenueCategory {
  name: string;
  values: number[];
}

export interface ClientRow {
  client: string;
  status: string;
  service: string;
  pod: string;
  startDate: string;
  source: string;
  teamMember: string;
  monthlyRevenue: number[];
  endReason?: string;
}

export interface ClientProfit {
  client: string;
  service: string;
  pod: string;
  revenue: number;
  peopleCost: number;
  profit: number;
  margin: number;
}

export interface TeamMember {
  name: string;
  status: string;
  department: string;
  category: string;
  startDate: string;
  totalHours: number;
  contractedSalary: number;
  costPerHour: number;
}

export interface ServiceCapacity {
  service: string;
  intensity: string;
  mediaBuying: number;
  leadership: number;
  clientSuccess: number;
  totalHours: number;
}

export interface BudgetRow {
  month: string;        // "Jan 2026" (trimmed)
  category: string;
  group: 'Revenue' | 'COGS' | 'Expenses' | 'Metrics' | string;
  budget: number;
  actual: number;
  varianceDollar: number;  // budget - actual
  variancePct: number;     // sheet's stored % (already a number like 64)
  isTotal: boolean;        // true for "Total Revenue", "Total Cost of Sales", etc.
}

export interface Transaction {
  date: string;            // ISO yyyy-mm-dd or formatted string
  id: string;
  kind: 'Revenue' | 'Expense';
  accountCode: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;          // always positive
}

// Phase 2 — unit economics.
// Typed shortcut arrays are re-aligned to pl.months order so the rest of the
// dashboard can index them by the same indices it uses for revenue/cogs/etc.
// The generic metricRows / metricMonths fields preserve the Metrics tab's own
// month layout for the analytics page table + charts.
export interface MetricRow {
  name: string;
  rawStrings: string[];                       // display strings as they appear in the sheet
  values: number[];                           // parsed numbers (percent rows are stored as 0..1)
  format: 'currency' | 'percent' | 'number';  // detected from rawStrings
}

export interface MetricsData {
  // Generic capture — used by the Analytics table + counting toggle.
  metricRows: MetricRow[];
  metricMonths: string[];        // raw labels, e.g. "Jan 25"
  metricMonthsIso: string[];     // iso, e.g. "2025-01-01"
  metricStatuses: string[];      // "Actuals" | "Forecast" per metric month

  // Typed shortcuts — aligned to pl.months order (NOT metricMonths).
  mrr?: number[];
  ltv?: number[];
  ltgp?: number[];
  cac?: number[];
  mrrChurn?: number[];           // 0..1
  clientChurn?: number[];        // 0..1
  newClients?: number[];
  lostClients?: number[];
  activeClients?: number[];
}

// Phase 3 — per-person rollup (one row per person, sheet-wide totals or
// last-month snapshot, depending on what the sheet provides).
export interface TeamProfitRow {
  name: string;
  department: string;
  hoursAvailable: number;
  revenueCovered: number;
  utilization: number;       // 0..1
  vsTarget: number;          // 0..1, can be negative (under) or positive (over)
  revenueGap: number;        // negative = below target, positive = surplus
}

// Phase Operations — one row per receivable/invoice line from the Receivables
// tab. Status lives in column Q, client-written notes in column X. rowNumber is
// the 1-based sheet row so server actions can target Q{row} / X{row}.
// Mirrors the buildout Invoices schema; missing columns degrade to ""/0.
export interface Receivable {
  rowNumber: number;
  client: string;
  service: string;
  amount: number;
  openAmount: number;
  status: string;       // column Q
  notes: string;        // column X
  invoiceDate: string;
  sentDate: string;
  dueDate: string;
  paidDate: string;
  daysOverdue: number;  // positive = late, negative = future-due, 0 = paid/unknown
  payType: string;      // e.g. "Monthly - Auto"
  paymentRule: string;  // e.g. "10% of Ad Spend"
  adSpend: number;
  discounts: number;
  otherChange: number;
  payPlatform: string;  // e.g. "Bank", "Stripe", "Bill"
  currency: string;     // e.g. "USD"
  invoiceNumber: string;
  monthIso: string;     // derived from invoiceDate (else dueDate)
  paidMonthIso: string; // derived from paidDate (for period-scoped Collected)
  raw: Record<string, string>;
}

// Phase Operations — Transactions clarification (Bookkeeping tab).
// Bookkeeper posts context in E:M (M = Account, absolute); client writes
// Category (col N) + Comment (col O) through the dashboard. rowNumber is the
// 1-based sheet row for write-back.
export interface BookkeepingTxn {
  rowNumber: number;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  account: string;    // column M
  category: string;   // column N (client-writeable)
  comment: string;    // column O (client-writeable)
  raw: Record<string, string>;
}

export interface BookkeepingData {
  coa: string[];               // chart of accounts (col B, row 2+)
  transactions: BookkeepingTxn[];
}

export interface DashboardData {
  lastUpdated: string;
  pl: PLData;
  revenueCategories: RevenueCategory[];
  expenseCategories: ExpenseCategory[];
  cogsCategories: COGSCategory[];
  clients: ClientRow[];
  /** Month labels (raw, e.g. "Jan 2026" or "Jan 25") aligned to ClientRow.monthlyRevenue indices. */
  clientMonthLabels: string[];
  /** ISO month strings (e.g. "2026-01-01") aligned to ClientRow.monthlyRevenue indices. */
  clientMonthsIso: string[];
  clientProfits: ClientProfit[];
  teamMembers: TeamMember[];
  teamProfit: TeamProfitRow[];
  serviceCapacity: ServiceCapacity[];
  transactions: Transaction[];
  budget: BudgetRow[];
  metrics: MetricsData;
}
