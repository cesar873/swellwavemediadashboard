// ── Month/period helpers ─────────────────────────────────────────────────────
// Convert "Jan 2026" → "2026-01-01" (monthIso)

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function labelToIso(label: string): string | null {
  if (!label) return null;
  // Accept "Jan 25", "Jan '25", "Jan 2025", "Jan. 2025".
  const m = label.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*'?(\d{2,4})/);
  if (!m) return null;
  const month = MONTH_MAP[m[1]];
  let year = parseInt(m[2], 10);
  if (year < 100) year += 2000;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function isoToLabel(iso: string, opts: { full?: boolean } = {}): string {
  if (!iso) return "—";
  const [yearStr, monthStr] = iso.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  if (isNaN(year) || isNaN(month) || month < 0 || month > 11) return iso;
  return `${opts.full ? MONTH_NAMES[month] : MONTH_ABBR[month]} ${year}`;
}

export function addMonthsIso(iso: string, n: number): string {
  const [yearStr, monthStr] = iso.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1 + n;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// "Apr 2026" or "Apr → Jun 2026 (3 months)". When latestActualIso is supplied
// and the selection extends past it, append a forecast-month count so users
// know forecast data is in scope. (tabs.md §Phase 2 step 7.)
export function periodLabel(months: string[], latestActualIso?: string): string {
  if (!months.length) return "—";
  const base =
    months.length === 1
      ? isoToLabel(months[0])
      : `${isoToLabel(months[0])} → ${isoToLabel(months[months.length - 1])} (${months.length} months)`;
  if (!latestActualIso) return base;
  const forecastCount = months.filter(iso => compareIso(iso, latestActualIso) > 0).length;
  if (!forecastCount) return base;
  return `${base} · includes ${forecastCount} forecast month${forecastCount > 1 ? "s" : ""}`;
}

export function monthsBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso;
  while (compareIso(cur, toIso) <= 0) {
    out.push(cur);
    cur = addMonthsIso(cur, 1);
    if (out.length > 240) break; // safety
  }
  return out;
}
