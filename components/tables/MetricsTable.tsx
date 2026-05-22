import { cn } from "@/lib/utils";
import { formatCurrency, formatPercent, formatNumber } from "@/lib/utils";
import type { MetricRow } from "@/lib/types";

export interface MetricsTableProps {
  rows: MetricRow[];
  monthLabels: string[];           // raw labels as they appear in the sheet header
  statuses: string[];              // "Actuals" | "Forecast" per month
  monthsCount?: number;            // shown in the header e.g. "17 months"
}

function formatCell(value: number, format: MetricRow["format"]): string {
  if (!isFinite(value)) return "—";
  if (value === 0) return "—";
  switch (format) {
    case "percent":  return formatPercent(value);
    case "currency": return formatCurrency(value, { compact: true });
    default:         return formatNumber(value);
  }
}

// formatting.md §3.9 — forecast months get italic + a subtle crosshatch.
export function MetricsTable({ rows, monthLabels, statuses, monthsCount }: MetricsTableProps) {
  const metricsCount = rows.length;
  const months = monthsCount ?? monthLabels.length;

  return (
    <div className="relative">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">All metrics by month</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Every metric from the Metrics tab · global range
          </p>
        </div>
        <div className="text-[11px] tabular-nums text-muted-foreground">
          {metricsCount} metrics · {months} months
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-[var(--card-border)]" style={{ maxHeight: 560 }}>
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-30 sticky-bg-strong border-b border-r border-[var(--card-border)] px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                style={{ minWidth: 200 }}
              >
                Metric
              </th>
              {monthLabels.map((label, i) => {
                const isForecast = statuses[i] === "Forecast";
                return (
                  <th
                    key={`${label}-${i}`}
                    className={cn(
                      "sticky top-0 z-20 sticky-bg-strong border-b border-[var(--card-border)] px-3 py-2 text-right text-[10px] font-medium uppercase tracking-wide",
                      isForecast ? "text-[var(--blue)]/70 italic" : "text-muted-foreground",
                    )}
                    style={{ minWidth: 92 }}
                  >
                    {label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={`${row.name}-${ri}`} className="hover:bg-white/[0.02]">
                <td className="sticky left-0 z-10 sticky-bg border-b border-r border-white/[0.05] px-3 py-2 text-left text-foreground">
                  {row.name}
                </td>
                {row.values.map((v, ci) => {
                  const isForecast = statuses[ci] === "Forecast";
                  return (
                    <td
                      key={ci}
                      className={cn(
                        "border-b border-white/[0.04] px-3 py-2 text-right tabular-nums",
                        isForecast && "italic text-foreground/80",
                      )}
                      style={
                        isForecast
                          ? {
                              backgroundImage:
                                "repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 6px, transparent 6px 12px)",
                            }
                          : undefined
                      }
                    >
                      {formatCell(v, row.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={monthLabels.length + 1}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No metric rows found in the Metrics tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
