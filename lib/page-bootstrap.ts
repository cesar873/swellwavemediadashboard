import { getCachedDashboardData } from "./data";
import { deriveDataWindow, resolveRange, priorPeriod } from "./default-range";
import { isoToLabel, labelToIso, periodLabel } from "./period";
import type { DashboardData } from "./types";

export type PageSearchParams = {
  from?: string;
  to?: string;
  months?: string;
};

export interface BootstrappedPage {
  data: DashboardData;
  monthsIso: string[];                  // every month in the sheet
  latestActualIso: string;
  fromIso: string;
  toIso: string;
  selectedMonths: string[];             // months in current range, ascending
  priorMonths: string[];                // same-length window immediately prior
  selectedIndices: number[];            // indices into data.pl.months
  priorIndices: number[];
  monthsParam: number | null;
  periodLabel: string;
  rangeLabel: string;
  /** First index in selectedMonths that is a forecast month, or -1 if none. */
  forecastStartInSelection: number;
}

// Parse URL filters and return everything every page needs.
export async function bootstrapPage(
  searchParams: PageSearchParams,
): Promise<BootstrappedPage> {
  const data = await getCachedDashboardData();
  const win = deriveDataWindow(data);
  const range = resolveRange(win, searchParams);
  const prior = priorPeriod(win, range.selectedMonths);

  const monthLabels = data.pl.months.map(m => labelToIso(m.label) ?? "");
  const indexOfIso = (iso: string) => monthLabels.indexOf(iso);

  const selectedIndices = range.selectedMonths.map(indexOfIso).filter(i => i >= 0);
  const priorIndices = prior.map(indexOfIso).filter(i => i >= 0);

  const pl = periodLabel(range.selectedMonths, win.latestActualIso);
  const rangeLabel =
    range.selectedMonths.length === 1
      ? isoToLabel(range.selectedMonths[0])
      : `${isoToLabel(range.selectedMonths[0])} – ${isoToLabel(
          range.selectedMonths[range.selectedMonths.length - 1],
        )}`;

  const forecastStartInSelection = range.selectedMonths.findIndex(
    iso => iso > win.latestActualIso,
  );

  return {
    data,
    monthsIso: win.monthsIso,
    latestActualIso: win.latestActualIso,
    fromIso: range.fromIso,
    toIso: range.toIso,
    selectedMonths: range.selectedMonths,
    priorMonths: prior,
    selectedIndices,
    priorIndices,
    monthsParam: range.monthsParam,
    periodLabel: pl,
    rangeLabel,
    forecastStartInSelection,
  };
}

// Aggregation helpers
export function sumAt(arr: number[], indices: number[]): number {
  let s = 0;
  for (const i of indices) s += arr[i] ?? 0;
  return s;
}

export function deltaPct(current: number, prior: number): number | null {
  if (!isFinite(current) || !isFinite(prior) || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}
