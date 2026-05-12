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

export interface DashboardData {
  lastUpdated: string;
  pl: PLData;
  expenseCategories: ExpenseCategory[];
  cogsCategories: COGSCategory[];
  clients: ClientRow[];
  clientProfits: ClientProfit[];
  teamMembers: TeamMember[];
  serviceCapacity: ServiceCapacity[];
  transactions: Transaction[];
}
