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

// Phase 2 — unit economics (one value per month, aligned to pl.months order).
export interface MetricsData {
  mrr?: number[];
  ltv?: number[];
  ltgp?: number[];
  cac?: number[];
  mrrChurn?: number[];       // 0..1
  clientChurn?: number[];    // 0..1
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

export interface DashboardData {
  lastUpdated: string;
  pl: PLData;
  expenseCategories: ExpenseCategory[];
  cogsCategories: COGSCategory[];
  clients: ClientRow[];
  clientProfits: ClientProfit[];
  teamMembers: TeamMember[];
  teamProfit: TeamProfitRow[];
  serviceCapacity: ServiceCapacity[];
  transactions: Transaction[];
  budget: BudgetRow[];
  metrics: MetricsData;
}
