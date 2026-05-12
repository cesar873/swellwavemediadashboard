// Phase 1 + 2 range logic — tabs.md §"Phase 1 range & main-month rules" +
// §"Enabling forecast in the main range". In Phase 2 the picker max extends to
// the latest forecast month and the default `to` jumps to latestActual + 3.

import type { DashboardData } from "./types";
import { labelToIso, compareIso, addMonthsIso } from "./period";

// tabs.md §Phase 2 — default forecast lookahead
export const FORECAST_LOOKAHEAD_MONTHS = 3;

export interface DataWindow {
  monthsIso: string[];      // every month present in the sheet, ascending
  firstDataIso: string;     // earliest month with any data
  latestActualIso: string;  // last month marked Actuals (Phase 1 hard ceiling)
  latestMonthIso: string;   // last month in the sheet (could be forecast)
}

export function deriveDataWindow(data: DashboardData): DataWindow {
  const isos = data.pl.months
    .map(m => labelToIso(m.label))
    .filter((x): x is string => !!x);

  const firstDataIso = isos[0] ?? "";
  const latestMonthIso = isos[isos.length - 1] ?? "";

  // latestActualIso: last month whose status is "Actuals", else last non-zero month
  let latestActualIso = "";
  for (let i = data.pl.months.length - 1; i >= 0; i--) {
    const m = data.pl.months[i];
    const iso = labelToIso(m.label);
    if (!iso) continue;
    if (m.status === "Actuals") { latestActualIso = iso; break; }
  }
  if (!latestActualIso) {
    // Fallback: last month with any non-zero revenue
    for (let i = data.pl.revenue.length - 1; i >= 0; i--) {
      if ((data.pl.revenue[i] ?? 0) !== 0) {
        latestActualIso = labelToIso(data.pl.months[i]?.label ?? "") ?? "";
        if (latestActualIso) break;
      }
    }
  }
  if (!latestActualIso) latestActualIso = latestMonthIso;

  return { monthsIso: isos, firstDataIso, latestActualIso, latestMonthIso };
}

export interface ResolvedRange {
  fromIso: string;
  toIso: string;
  selectedMonths: string[];
  monthsParam: number | null;   // for "?months=N" shortcut
  /** Independent single-month picker. Defaults to latestActualIso, never
   *  clamped by from/to — month-snapshot cards are decoupled from the range. */
  selectedMonthIso: string;
}

export function resolveRange(
  win: DataWindow,
  params: { from?: string; to?: string; months?: string; month?: string },
): ResolvedRange {
  const minIso = win.firstDataIso;
  // Phase 2: picker max extends to the latest month in the sheet (incl. forecasts).
  const maxIso = win.latestMonthIso || win.latestActualIso;

  // Phase 2: default `to` = latestActual + N forecast months, clamped to maxIso.
  const lookaheadIso = win.latestActualIso
    ? addMonthsIso(win.latestActualIso, FORECAST_LOOKAHEAD_MONTHS)
    : "";
  const defaultTo =
    lookaheadIso && compareIso(lookaheadIso, maxIso) <= 0
      ? lookaheadIso
      : maxIso;
  const defaultFrom = win.firstDataIso;

  let fromIso = params.from && isValidIso(params.from) ? params.from : defaultFrom;
  let toIso   = params.to   && isValidIso(params.to)   ? params.to   : defaultTo;

  // ?months=N selects the last N actual months ending at latestActualIso (still
  // anchored to actuals — power users compare last-N actuals, never "last N
  // including forecast"). To see forecast, use the From/To picker.
  let monthsParam: number | null = null;
  if (params.months) {
    const n = parseInt(params.months, 10);
    if (n > 0 && n < 240) {
      monthsParam = n;
      const actualsCeiling = win.latestActualIso || maxIso;
      const allFromTo = win.monthsIso.filter(iso =>
        compareIso(iso, minIso) >= 0 && compareIso(iso, actualsCeiling) <= 0,
      );
      const slice = allFromTo.slice(-n);
      fromIso = slice[0] ?? defaultFrom;
      toIso   = slice[slice.length - 1] ?? actualsCeiling;
    }
  }

  // Clamp
  if (compareIso(fromIso, minIso) < 0) fromIso = minIso;
  if (compareIso(toIso, maxIso) > 0)   toIso   = maxIso;
  if (compareIso(fromIso, toIso) > 0)  fromIso = toIso;

  const selectedMonths = win.monthsIso.filter(iso =>
    compareIso(iso, fromIso) >= 0 && compareIso(iso, toIso) <= 0,
  );

  // Single-month picker — independent from from/to, defaults to latestActualIso.
  const monthParamIso =
    params.month && isValidIso(params.month) && win.monthsIso.includes(params.month)
      ? params.month
      : "";
  const selectedMonthIso = monthParamIso || win.latestActualIso || (win.monthsIso[win.monthsIso.length - 1] ?? "");

  return { fromIso, toIso, selectedMonths, monthsParam, selectedMonthIso };
}

function isValidIso(s: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(s);
}

// Prior period: same length as selectedMonths, immediately before
export function priorPeriod(win: DataWindow, selectedMonths: string[]): string[] {
  if (!selectedMonths.length) return [];
  const firstIdx = win.monthsIso.indexOf(selectedMonths[0]);
  if (firstIdx <= 0) return [];
  const len = selectedMonths.length;
  const start = Math.max(0, firstIdx - len);
  return win.monthsIso.slice(start, firstIdx);
}
