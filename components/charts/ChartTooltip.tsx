"use client";

import { formatLong, type ChartFormat } from "./chart-shared";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  format?: ChartFormat | ((v: number) => string);
}

export function ChartTooltip({ active, payload, label, format = "currency" }: TooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const fmt =
    typeof format === "function" ? format : (v: number) => formatLong(v, format);

  return (
    <div className="rounded-lg border border-[var(--card-border)] bg-[#0b1f33]/95 px-3 py-2 text-[12px] shadow-lg backdrop-blur">
      {label && (
        <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            <span className="text-foreground/80">{p.name ?? p.dataKey}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {p.value != null ? fmt(p.value as number) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
